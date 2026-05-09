#!/usr/bin/env node
/**
 * Manual backup runner — mirrors the chunked-upload logic in src/lib/backup.ts.
 * Usage: npm run backup
 *
 * Each collection is uploaded as one or more gzipped chunks (≤ 9 MB each) to
 * stay under Cloudinary's free-tier 10 MB per-file limit.  A lightweight
 * manifest file ties everything together.
 *
 * Loads env from .env / .env.local with a tiny regex parser (no dotenv dependency).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

/* ─── Constants ──────────────────────────────────────────── */

const BACKUP_FOLDER = 'mongodb-backups';
const MANIFEST_TAG = 'mongodb-backup';
const MANIFEST_TAG_EXPLICIT = 'mongodb-backup-manifest';
const CHUNK_TAG = 'mongodb-backup-chunk';
const MAX_CHUNK_BYTES = 9 * 1024 * 1024; // 9 MB safety margin

/* ─── env parser ─────────────────────────────────────────── */

function loadEnvFile(filePath) {
    if (!existsSync(filePath)) return;
    const raw = readFileSync(filePath, 'utf8');
    for (const rawLine of raw.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        const key = m[1];
        let value = m[2];
        // Strip surrounding quotes
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) {
            process.env[key] = value;
        }
    }
}

const cwd = process.cwd();
loadEnvFile(resolve(cwd, '.env.local'));
loadEnvFile(resolve(cwd, '.env'));

/* ─── config ─────────────────────────────────────────────── */

const {
    MONGODB_URI,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
} = process.env;

const required = {
    MONGODB_URI,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
};
const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
}

cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
});

/* ─── helpers ────────────────────────────────────────────── */

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const formatDate = (d) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function uploadRaw(buf, publicId, tags) {
    return new Promise((resolveUpload, rejectUpload) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'raw',
                public_id: publicId,
                overwrite: false,
                tags,
            },
            (err, result) => (err ? rejectUpload(err) : resolveUpload(result)),
        );
        stream.end(buf);
    });
}

/**
 * Build gzipped chunks for a single collection so that no single file
 * exceeds MAX_CHUNK_BYTES. Empty collections produce zero chunks.
 */
function buildChunks(name, documents) {
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

    const out = [];

    function fit(slice) {
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

/* ─── main ───────────────────────────────────────────────── */

async function main() {
    console.log('🔌 Connecting to MongoDB…');
    console.time('mongoose-connect');
    await mongoose.connect(MONGODB_URI, {
        bufferCommands: false,
        dbName: 'RebelXHQSystems',
        minPoolSize: 1,
        maxPoolSize: 5,
    });
    console.timeEnd('mongoose-connect');

    const db = mongoose.connection.db;
    const dbName = db.databaseName;

    const all = await db.listCollections().toArray();
    const collInfos = all.filter((c) => !c.name.startsWith('system.'));
    console.log(`📦 Exporting ${collInfos.length} collections from "${dbName}"…`);

    const now = new Date();
    const date = formatDate(now);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const basePath = `${BACKUP_FOLDER}/${date}/${timestamp}`;

    const manifestCollections = [];
    let totalDocs = 0;
    let totalBytes = 0;

    for (const info of collInfos) {
        const name = info.name;
        const documents = await db.collection(name).find({}).toArray();
        totalDocs += documents.length;
        console.log(`  • ${name}: ${documents.length.toLocaleString()} docs`);

        const chunks = buildChunks(name, documents);
        const refs = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const publicId = `${basePath}/${name}-${i}`;
            const sizeMB = (chunk.gz.byteLength / 1024 / 1024).toFixed(2);
            console.log(`    ☁️  chunk ${i}: ${sizeMB} MB → ${publicId}`);
            const uploaded = await uploadRaw(chunk.gz, publicId, [
                CHUNK_TAG,
                `date:${date}`,
                `db:${dbName}`,
                `backup:${timestamp}`,
            ]);
            totalBytes += chunk.gz.byteLength;
            refs.push({ url: uploaded.secure_url, count: chunk.docs.length });
        }

        if (chunks.length === 0) {
            console.log(`    ⏭  (empty — skipped)`);
        }

        manifestCollections.push({ name, count: documents.length, chunks: refs });
    }

    // Upload manifest
    const manifest = {
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
    console.log(`\n📋 Uploading manifest (${(manifestGz.byteLength / 1024).toFixed(1)} KB) → ${manifestPublicId}`);

    const uploaded = await uploadRaw(manifestGz, manifestPublicId, [
        MANIFEST_TAG,
        MANIFEST_TAG_EXPLICIT,
        `date:${date}`,
        `db:${dbName}`,
    ]);

    console.log('\n✅ Backup complete');
    console.log('   manifest  :', uploaded.public_id);
    console.log('   url       :', uploaded.secure_url);
    console.log('   total docs:', totalDocs.toLocaleString());
    console.log('   total size:', `${(totalBytes / 1024 / 1024).toFixed(2)} MB (across ${manifestCollections.reduce((s, c) => s + c.chunks.length, 0)} chunks)`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(async (err) => {
    console.error('❌ Backup failed:', err);
    try {
        await mongoose.disconnect();
    } catch {}
    process.exit(1);
});
