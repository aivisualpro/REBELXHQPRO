import { gzipSync, gunzipSync } from 'zlib';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import cloudinary from '@/lib/cloudinary';

/* ─────────────────────────────────────────────────────────────
 * Storage layout
 *
 * One backup =
 *   mongodb-backups/<YYYY-MM-DD>/<timestamp>/_manifest        (gzipped JSON)
 *   mongodb-backups/<YYYY-MM-DD>/<timestamp>/<collection>-<i> (gzipped JSON, one or more chunks per collection)
 *
 * Each individual file is kept under ~9 MB gzipped to stay below
 * Cloudinary's 10 MB raw-file ceiling on the free tier.
 *
 * Tags:
 *   manifest → ['mongodb-backup', 'mongodb-backup-manifest', 'date:<date>', 'db:<dbName>']
 *   chunks   → ['mongodb-backup-chunk', 'date:<date>', 'db:<dbName>', 'backup:<timestamp>']
 *
 * Listing keeps the original `tags=mongodb-backup AND resource_type:raw`
 * expression — it returns manifests only, since chunks aren't tagged with
 * `mongodb-backup`.
 * ───────────────────────────────────────────────────────────── */

const BACKUP_FOLDER = 'mongodb-backups';
const MANIFEST_TAG = 'mongodb-backup';
const MANIFEST_TAG_EXPLICIT = 'mongodb-backup-manifest';
const CHUNK_TAG = 'mongodb-backup-chunk';
const MAX_CHUNK_BYTES = 9 * 1024 * 1024; // 9 MB safety margin under Cloudinary's 10 MB free cap

/* ─── Types ──────────────────────────────────────────────── */

export interface BackupMetadata {
    dbName: string;
    timestamp: string; // ISO
    date: string;      // YYYY-MM-DD
    collectionCount: number;
    totalDocs: number;
    sizeBytes: number; // total gzipped bytes across all chunks
}

export interface ChunkRef {
    url: string;
    count: number;
}

export interface ManifestCollection {
    name: string;
    count: number;
    chunks: ChunkRef[];
}

export interface BackupManifest {
    metadata: BackupMetadata;
    collections: ManifestCollection[];
}

export interface BackupResource {
    public_id: string;
    secure_url: string;
    bytes: number;
    created_at: string;
    tags: string[];
    date: string;
    timestamp: string;
}

export interface CollectionPageResult {
    name: string;
    count: number;
    documents: any[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

/* ─── Helpers ────────────────────────────────────────────── */

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function formatDate(d: Date) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function extractDateFromPublicId(publicId: string): string {
    const match = publicId.match(/mongodb-backups\/(\d{4}-\d{2}-\d{2})\//);
    return match ? match[1] : '';
}

function extractTimestampFromPublicId(publicId: string): string {
    // mongodb-backups/<date>/<timestamp>/_manifest
    const match = publicId.match(/mongodb-backups\/\d{4}-\d{2}-\d{2}\/([^/]+)\/_manifest$/);
    return match ? match[1] : '';
}

async function uploadRaw(buf: Buffer, publicId: string, tags: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'raw',
                public_id: publicId,
                overwrite: false,
                tags,
            },
            (err, result) => (err ? reject(err) : resolve(result)),
        );
        stream.end(buf);
    });
}

async function fetchGzippedJson<T>(url: string): Promise<T> {
    if (!url.startsWith('https://res.cloudinary.com/')) {
        throw new Error('Invalid backup URL');
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to download: ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const decoded = gunzipSync(buf);
    return JSON.parse(decoded.toString('utf8')) as T;
}

/**
 * Build gzipped chunks for a single collection so that no single file exceeds
 * MAX_CHUNK_BYTES. Empty collections produce zero chunks.
 */
function buildChunks(name: string, documents: any[]): { docs: any[]; gz: Buffer }[] {
    if (documents.length === 0) return [];

    // Try the whole collection as one chunk first.
    const fullJson = JSON.stringify({ name, count: documents.length, documents });
    const fullGz = gzipSync(Buffer.from(fullJson, 'utf8'));
    if (fullGz.byteLength <= MAX_CHUNK_BYTES) {
        return [{ docs: documents, gz: fullGz }];
    }

    // Estimate batch size from the full gzipped ratio, with a 25% safety margin.
    const estChunks = Math.ceil(fullGz.byteLength / MAX_CHUNK_BYTES);
    const safeChunks = Math.max(2, Math.ceil(estChunks * 1.25));
    const initialBatch = Math.max(1, Math.ceil(documents.length / safeChunks));

    const out: { docs: any[]; gz: Buffer }[] = [];

    function fit(slice: any[]) {
        const json = JSON.stringify({ name, count: slice.length, documents: slice });
        const gz = gzipSync(Buffer.from(json, 'utf8'));
        if (gz.byteLength <= MAX_CHUNK_BYTES || slice.length <= 1) {
            out.push({ docs: slice, gz });
            return;
        }
        const mid = Math.floor(slice.length / 2);
        fit(slice.slice(0, mid));
        fit(slice.slice(mid));
    }

    for (let i = 0; i < documents.length; i += initialBatch) {
        fit(documents.slice(i, i + initialBatch));
    }
    return out;
}

/* ─────────────────────────────────────────────────────────────
 * runBackup — exports every collection, gzips per-collection
 * (chunked when oversized), uploads each to Cloudinary, finalises
 * with a manifest.
 * ───────────────────────────────────────────────────────────── */

export async function runBackup(): Promise<BackupResource> {
    await dbConnect();
    const conn = mongoose.connection;
    if (!conn || !conn.db) throw new Error('Mongoose connection is not ready');
    const db = conn.db;
    const dbName = db.databaseName;

    const allColls = await db.listCollections().toArray();
    const collInfos = allColls.filter(c => !c.name.startsWith('system.'));

    const now = new Date();
    const date = formatDate(now);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const basePath = `${BACKUP_FOLDER}/${date}/${timestamp}`;

    const manifestCollections: ManifestCollection[] = [];
    let totalDocs = 0;
    let totalBytes = 0;

    for (const info of collInfos) {
        const name = info.name;
        const documents = await db.collection(name).find({}).toArray();
        totalDocs += documents.length;

        const chunks = buildChunks(name, documents);
        const refs: ChunkRef[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const publicId = `${basePath}/${name}-${i}`;
            const uploaded: any = await uploadRaw(chunk.gz, publicId, [
                CHUNK_TAG,
                `date:${date}`,
                `db:${dbName}`,
                `backup:${timestamp}`,
            ]);
            totalBytes += chunk.gz.byteLength;
            refs.push({ url: uploaded.secure_url, count: chunk.docs.length });
        }

        manifestCollections.push({ name, count: documents.length, chunks: refs });
    }

    const manifest: BackupManifest = {
        metadata: {
            dbName,
            timestamp: now.toISOString(),
            date,
            collectionCount: manifestCollections.length,
            totalDocs,
            sizeBytes: totalBytes,
        },
        collections: manifestCollections,
    };

    const manifestGz = gzipSync(Buffer.from(JSON.stringify(manifest), 'utf8'));
    const manifestPublicId = `${basePath}/_manifest`;

    const uploaded: any = await uploadRaw(manifestGz, manifestPublicId, [
        MANIFEST_TAG,
        MANIFEST_TAG_EXPLICIT,
        `date:${date}`,
        `db:${dbName}`,
    ]);

    return {
        public_id: uploaded.public_id,
        secure_url: uploaded.secure_url,
        bytes: uploaded.bytes,
        created_at: uploaded.created_at,
        tags: uploaded.tags || [MANIFEST_TAG, MANIFEST_TAG_EXPLICIT, `date:${date}`, `db:${dbName}`],
        date,
        timestamp,
    };
}

/* ─────────────────────────────────────────────────────────────
 * listBackups — returns one resource per backup (the manifest).
 * ───────────────────────────────────────────────────────────── */

export async function listBackups(): Promise<BackupResource[]> {
    const all: BackupResource[] = [];
    let nextCursor: string | undefined;

    do {
        const search: any = cloudinary.search
            .expression('tags=mongodb-backup AND resource_type:raw')
            .sort_by('created_at', 'desc')
            .max_results(500)
            .with_field('tags')
            .with_field('context');
        if (nextCursor) search.next_cursor(nextCursor);
        const res: any = await search.execute();

        for (const r of res.resources || []) {
            const date = extractDateFromPublicId(r.public_id);
            const timestamp = extractTimestampFromPublicId(r.public_id);
            // Skip anything that isn't a manifest
            if (!timestamp) continue;
            all.push({
                public_id: r.public_id,
                secure_url: r.secure_url,
                bytes: r.bytes,
                created_at: r.created_at,
                tags: r.tags || [],
                date,
                timestamp,
            });
        }
        nextCursor = res.next_cursor;
    } while (nextCursor);

    return all;
}

/* ─────────────────────────────────────────────────────────────
 * fetchManifest — downloads + decodes only the manifest file.
 * Tiny payload (a few KB) regardless of total backup size.
 * ───────────────────────────────────────────────────────────── */

export async function fetchManifest(url: string): Promise<BackupManifest> {
    return fetchGzippedJson<BackupManifest>(url);
}

/* ─────────────────────────────────────────────────────────────
 * fetchCollectionPage — given a manifest + collection name,
 * downloads only the chunks needed to satisfy the requested
 * page (or all chunks when full=true).
 * ───────────────────────────────────────────────────────────── */

export async function fetchCollectionPage(
    manifest: BackupManifest,
    collectionName: string,
    options: { page?: number; pageSize?: number; full?: boolean } = {},
): Promise<CollectionPageResult> {
    const coll = manifest.collections.find(c => c.name === collectionName);
    if (!coll) throw new Error(`Collection "${collectionName}" not found in backup`);

    if (options.full) {
        const docs: any[] = [];
        for (const ref of coll.chunks) {
            const part = await fetchGzippedJson<{ name: string; count: number; documents: any[] }>(
                ref.url,
            );
            docs.push(...part.documents);
        }
        return {
            name: coll.name,
            count: coll.count,
            documents: docs,
            page: 1,
            pageSize: docs.length,
            total: coll.count,
            totalPages: 1,
        };
    }

    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.max(1, Math.min(500, options.pageSize ?? 50));
    const total = coll.count;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const end = start + pageSize;

    const docs: any[] = [];
    let cursor = 0;
    for (const ref of coll.chunks) {
        const chunkStart = cursor;
        const chunkEnd = cursor + ref.count;
        cursor = chunkEnd;
        if (chunkEnd <= start) continue;
        if (chunkStart >= end) break;
        const part = await fetchGzippedJson<{ name: string; count: number; documents: any[] }>(
            ref.url,
        );
        const localStart = Math.max(0, start - chunkStart);
        const localEnd = Math.min(part.documents.length, end - chunkStart);
        for (let i = localStart; i < localEnd; i++) {
            docs.push(part.documents[i]);
        }
    }

    return {
        name: coll.name,
        count: coll.count,
        documents: docs,
        page: safePage,
        pageSize,
        total,
        totalPages,
    };
}

/* ─────────────────────────────────────────────────────────────
 * Back-compat alias used by the inspect endpoint.
 * ───────────────────────────────────────────────────────────── */

export async function fetchAndParseBackup(url: string): Promise<BackupManifest> {
    return fetchManifest(url);
}
