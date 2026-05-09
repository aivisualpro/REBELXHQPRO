#!/usr/bin/env node
/**
 * Manual backup runner — mirrors the cron logic in src/app/api/cron/backup/route.ts.
 * Usage: npm run backup
 *
 * Loads env from .env / .env.local with a tiny regex parser (no dotenv dependency).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';

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

    const collections = [];
    let totalDocs = 0;
    for (const info of collInfos) {
        const docs = await db.collection(info.name).find({}).toArray();
        totalDocs += docs.length;
        console.log(`  • ${info.name}: ${docs.length.toLocaleString()} docs`);
        collections.push({ name: info.name, count: docs.length, documents: docs });
    }

    const now = new Date();
    const date = formatDate(now);
    const timestamp = now.toISOString().replace(/[:.]/g, '-');

    const payload = {
        metadata: {
            dbName,
            timestamp: now.toISOString(),
            date,
            collectionCount: collections.length,
            totalDocs,
            sizeBytes: 0,
        },
        collections,
    };

    const json = JSON.stringify(payload);
    const gzipped = gzipSync(Buffer.from(json, 'utf8'));
    payload.metadata.sizeBytes = gzipped.byteLength;

    const publicId = `mongodb-backups/${date}/full-backup-${timestamp}`;
    console.log(`☁️  Uploading ${(gzipped.byteLength / 1024 / 1024).toFixed(2)} MB to Cloudinary as ${publicId}…`);

    const uploaded = await new Promise((resolveUpload, rejectUpload) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                resource_type: 'raw',
                public_id: publicId,
                overwrite: false,
                tags: ['mongodb-backup', `date:${date}`, `db:${dbName}`],
                context: {
                    collectionCount: String(collections.length),
                    totalDocs: String(totalDocs),
                    dbName,
                },
            },
            (err, result) => (err ? rejectUpload(err) : resolveUpload(result)),
        );
        stream.end(gzipped);
    });

    console.log('✅ Backup complete');
    console.log('   public_id :', uploaded.public_id);
    console.log('   url       :', uploaded.secure_url);
    console.log('   bytes     :', uploaded.bytes);
    console.log('   docs      :', totalDocs.toLocaleString());

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
