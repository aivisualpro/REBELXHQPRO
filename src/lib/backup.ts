import { gzipSync, gunzipSync } from 'zlib';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongoose';
import cloudinary from '@/lib/cloudinary';

/* ─────────────────────────────────────────────────────────────
 * Types
 * ───────────────────────────────────────────────────────────── */

export interface BackupMetadata {
    dbName: string;
    timestamp: string;       // ISO
    date: string;            // YYYY-MM-DD
    collectionCount: number;
    totalDocs: number;
    sizeBytes: number;
}

export interface BackupCollection {
    name: string;
    count: number;
    documents: any[];
}

export interface BackupPayload {
    metadata: BackupMetadata;
    collections: BackupCollection[];
}

export interface BackupResource {
    public_id: string;
    secure_url: string;
    bytes: number;
    created_at: string;
    tags: string[];
    date: string;            // extracted from public_id (YYYY-MM-DD)
    timestamp: string;       // extracted from public_id
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */

const BACKUP_FOLDER = 'mongodb-backups';
const BACKUP_TAG = 'mongodb-backup';

function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`;
}

function formatDate(d: Date) {
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function extractDateFromPublicId(publicId: string): string {
    // mongodb-backups/<YYYY-MM-DD>/full-backup-<timestamp>
    const match = publicId.match(/mongodb-backups\/(\d{4}-\d{2}-\d{2})\//);
    return match ? match[1] : '';
}

function extractTimestampFromPublicId(publicId: string): string {
    const match = publicId.match(/full-backup-([^/]+)$/);
    return match ? match[1] : '';
}

/* ─────────────────────────────────────────────────────────────
 * runBackup — exports every collection, gzips, uploads to Cloudinary
 * ───────────────────────────────────────────────────────────── */

export async function runBackup(): Promise<BackupResource> {
    await dbConnect();

    const conn = mongoose.connection;
    if (!conn || !conn.db) {
        throw new Error('Mongoose connection is not ready');
    }
    const db = conn.db;
    const dbName = db.databaseName;

    // List collections, skip system.*
    const allColls = await db.listCollections().toArray();
    const collInfos = allColls.filter(c => !c.name.startsWith('system.'));

    const collections: BackupCollection[] = [];
    let totalDocs = 0;

    for (const info of collInfos) {
        const name = info.name;
        const docs = await db.collection(name).find({}).toArray();
        totalDocs += docs.length;
        collections.push({ name, count: docs.length, documents: docs });
    }

    const now = new Date();
    const date = formatDate(now);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const payload: BackupPayload = {
        metadata: {
            dbName,
            timestamp: now.toISOString(),
            date,
            collectionCount: collections.length,
            totalDocs,
            sizeBytes: 0, // filled below
        },
        collections,
    };

    const json = JSON.stringify(payload);
    const gzipped = gzipSync(Buffer.from(json, 'utf8'));
    payload.metadata.sizeBytes = gzipped.byteLength;

    const publicId = `${BACKUP_FOLDER}/${date}/full-backup-${timestamp}`;

    const uploaded: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'raw',
                public_id: publicId,
                overwrite: false,
                tags: [BACKUP_TAG, `date:${date}`, `db:${dbName}`],
                context: {
                    collectionCount: String(collections.length),
                    totalDocs: String(totalDocs),
                    dbName,
                },
            },
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            },
        );
        stream.end(gzipped);
    });

    return {
        public_id: uploaded.public_id,
        secure_url: uploaded.secure_url,
        bytes: uploaded.bytes,
        created_at: uploaded.created_at,
        tags: uploaded.tags || [BACKUP_TAG, `date:${date}`, `db:${dbName}`],
        date,
        timestamp,
    };
}

/* ─────────────────────────────────────────────────────────────
 * listBackups — pulls all backup resources from Cloudinary
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
            all.push({
                public_id: r.public_id,
                secure_url: r.secure_url,
                bytes: r.bytes,
                created_at: r.created_at,
                tags: r.tags || [],
                date: extractDateFromPublicId(r.public_id),
                timestamp: extractTimestampFromPublicId(r.public_id),
            });
        }
        nextCursor = res.next_cursor;
    } while (nextCursor);

    return all;
}

/* ─────────────────────────────────────────────────────────────
 * fetchAndParseBackup — downloads a backup .json.gz and decodes
 * ───────────────────────────────────────────────────────────── */

export async function fetchAndParseBackup(url: string): Promise<BackupPayload> {
    if (!url.startsWith('https://res.cloudinary.com/')) {
        throw new Error('Invalid backup URL');
    }
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
        throw new Error(`Failed to download backup: ${res.status} ${res.statusText}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const decoded = gunzipSync(buf);
    const text = decoded.toString('utf8');
    return JSON.parse(text) as BackupPayload;
}
