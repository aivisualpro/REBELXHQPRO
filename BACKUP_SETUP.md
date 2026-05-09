# MongoDB Backup System

A two-layer safety net for the MongoDB Atlas database powering this app.

## Layer 1 — Atlas Cloud Backup (do this in the Atlas dashboard)

1. Sign in to MongoDB Atlas → pick the cluster.
2. **Backup → Configuration → Edit** → enable **Cloud Backup**.
3. Pick the default snapshot schedule (or tighten it if needed). 24-hour PITR is plenty for most apps.
4. Save.

That's it for Layer 1 — Atlas now snapshots the cluster automatically and lets you restore through the UI.

## Layer 2 — Daily JSON export to Cloudinary (this repo)

A Vercel cron hits `/api/cron/backup` every day, which exports every collection to a single gzipped JSON blob and uploads it to Cloudinary as a `raw` resource. Public IDs follow:

```
mongodb-backups/<YYYY-MM-DD>/full-backup-<timestamp>
```

Each upload is tagged `mongodb-backup`, `date:<YYYY-MM-DD>`, and `db:<dbName>`. Nothing ever overwrites — every run lands at a fresh path.

### Setup steps

1. **Generate a cron secret:**

    ```bash
    openssl rand -hex 32
    ```

2. **Add it to your env:**
    - Local: append `CRON_SECRET=<value>` to `.env.local`.
    - Vercel: Project → Settings → Environment Variables → add `CRON_SECRET` to Production (and Preview if desired).

3. **Make sure the existing env vars are set** (locally and on Vercel):
    `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

4. **Test the export end-to-end locally:**

    ```bash
    npm run backup
    ```

    This connects to Mongo, dumps every collection, gzips, and uploads to Cloudinary. You should see a success line with the public_id and URL.

5. **Deploy.** The cron registers itself from `vercel.json` on the next production deploy.

6. **Browse backups in the app:** `/admin/settings/backups`. Pick a date → pick a collection → page through documents. Search and field-level filters operate on the current page (50 docs/page); use **Download all** to grab the entire collection as JSON.

### Cron schedule

Configured as `0 6 * * *` UTC, which is 11 PM Pacific during PDT (March–November). When the U.S. flips back to PST (early November–March), the run will instead fire at 10 PM Pacific. If the exact 11 PM local time matters, switch the cron to `0 7 * * *` during PST.

### Files

- `src/lib/backup.ts` — `runBackup`, `listBackups`, `fetchAndParseBackup`.
- `src/app/api/cron/backup/route.ts` — bearer-protected cron endpoint, `maxDuration = 300`.
- `src/app/api/admin/backups/route.ts` — list endpoint, deduped to one backup per date.
- `src/app/api/admin/backups/inspect/route.ts` — metadata + per-collection counts for one backup.
- `src/app/api/admin/backups/collection/route.ts` — paginated docs (`?page=&pageSize=`) or `?full=true` for download-all.
- `src/app/admin/settings/backups/page.tsx` — admin UI.
- `scripts/run-backup.mjs` — manual runner (`npm run backup`).
- `vercel.json` — cron entry.
