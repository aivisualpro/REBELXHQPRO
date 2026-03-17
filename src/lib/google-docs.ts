import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Get an authenticated Google API client using Service Account credentials.
 * Requires GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY in env.
 */
export function getServiceAccountAuth() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!email || !rawKey) {
        throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variables');
    }

    // Replace escaped newlines with actual newlines (common in env vars)
    const key = rawKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
        email,
        key,
        scopes: [
            'https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive',
        ],
    });

    // Explicitly set the project ID so googleapis doesn't pick up
    // GOOGLE_CLIENT_ID from env (which belongs to a different project)
    auth.projectId = 'rebelx-crm';

    return auth;
}

// ─── Mutex to serialise in-process PDF requests ─────────────────────────────
class Mutex {
    private queue: Array<() => void> = [];
    private locked = false;

    async lock(): Promise<() => void> {
        return new Promise((resolve) => {
            if (!this.locked) {
                this.locked = true;
                resolve(() => this.unlock());
            } else {
                this.queue.push(() => resolve(() => this.unlock()));
            }
        });
    }

    private unlock() {
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            if (next) next();
        } else {
            this.locked = false;
        }
    }
}

const pdfMutex = new Mutex();

/**
 * Generate a PDF from a Google Docs template by replacing {{variables}} with data.
 *
 * Strategy (MODIFY-IN-PLACE with verified restore):
 * 1. Acquire mutex (serialise concurrent callers in this process)
 * 2. Backup the template as DOCX
 * 3. Modify the template in-place (insert rows, replace placeholders)
 * 4. Export as PDF
 * 5. Restore template from DOCX backup
 * 6. Verify restore succeeded (poll until {{placeholders}} reappear)
 * 7. Release mutex
 *
 * The verification step (6) is critical — the DOCX→Docs conversion that
 * Drive performs after the upload is *asynchronous*. Without verification,
 * a subsequent request could see a template with static values instead of
 * placeholders, permanently corrupting it.
 */
export async function generatePdfFromTemplate(
    templateId: string,
    replacements: Record<string, string>,
    tableRows?: Record<string, string>[]
): Promise<Buffer> {
    const auth = getServiceAccountAuth();
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    // Serialise — only one PDF generation at a time per process
    const unlock = await pdfMutex.lock();

    let backupBuffer: Buffer | null = null;

    try {
        // ── Cleanup: delete any orphaned _tmp_pdf_* files from previous runs ──
        try {
            const orphans = await drive.files.list({
                q: "name contains '_tmp_pdf_' and trashed = false",
                fields: 'files(id, name)',
                pageSize: 50,
            });
            const files = orphans.data.files || [];
            if (files.length > 0) {
                console.log(`Cleaning up ${files.length} orphaned _tmp_pdf_ files...`);
                for (const f of files) {
                    try {
                        await drive.files.delete({ fileId: f.id! });
                    } catch { /* ignore individual delete failures */ }
                }
            }
        } catch (cleanupErr) {
            // Non-critical — continue with PDF generation
            console.warn('Temp file cleanup failed (non-critical):', cleanupErr);
        }

        // 1. Backup template as DOCX for safe restore after PDF export
        const backupResponse = await drive.files.export(
            { fileId: templateId, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
            { responseType: 'arraybuffer' }
        );
        backupBuffer = Buffer.from(backupResponse.data as ArrayBuffer);

        // 2. Handle line items: insert extra rows if more than 1 row of data
        if (tableRows && tableRows.length > 1) {
            const doc = await docs.documents.get({ documentId: templateId });
            const body = doc.data.body;

            if (body?.content) {
                for (const element of body.content) {
                    if (!element.table) continue;
                    const rows = element.table.tableRows || [];

                    // Check if this table has {{lineItems.*}} placeholders
                    if (!hasLineItemPlaceholders(rows)) continue;
                    if (rows.length < 2) continue;

                    const templateRowIndex = rows.length - 1;
                    const tableStartIndex = element.startIndex ?? element.table.tableRows?.[0]?.tableCells?.[0]?.content?.[0]?.startIndex;
                    if (tableStartIndex == null) {
                        console.warn('Could not determine table start index, skipping row insertion');
                        continue;
                    }

                    // Insert extra empty rows below the template row
                    const insertRequests: any[] = [];
                    for (let i = 1; i < tableRows.length; i++) {
                        insertRequests.push({
                            insertTableRow: {
                                tableCellLocation: {
                                    tableStartLocation: { index: tableStartIndex },
                                    rowIndex: templateRowIndex,
                                    columnIndex: 0,
                                },
                                insertBelow: true,
                            },
                        });
                    }

                    await docs.documents.batchUpdate({
                        documentId: templateId,
                        requestBody: { requests: insertRequests },
                    });

                    break; // Only handle the first matching table
                }
            }

            // 3. Populate the extra rows (rows 2+) with line item data via insertText
            const updatedDoc = await docs.documents.get({ documentId: templateId });
            const updatedBody = updatedDoc.data.body;

            if (updatedBody?.content) {
                for (const element of updatedBody.content) {
                    if (!element.table) continue;
                    const rows = element.table.tableRows || [];

                    if (!hasLineItemPlaceholders(rows)) continue;

                    const { templateRowIdx, columnPlaceholders } = findTemplateRow(rows);
                    if (templateRowIdx < 0) continue;

                    const insertTextRequests: any[] = [];

                    for (let dataIdx = 1; dataIdx < tableRows.length; dataIdx++) {
                        const rowIdx = templateRowIdx + dataIdx;
                        if (rowIdx >= rows.length) break;

                        const row = rows[rowIdx];
                        const cells = row.tableCells || [];

                        for (let c = cells.length - 1; c >= 0; c--) {
                            if (c >= columnPlaceholders.length) continue;
                            const placeholder = columnPlaceholders[c];
                            if (!placeholder) continue;

                            const value = tableRows[dataIdx][placeholder] || '';
                            if (!value) continue;

                            const cell = cells[c];
                            const firstParagraph = cell.content?.[0];
                            const firstElement = firstParagraph?.paragraph?.elements?.[0];
                            if (firstElement?.startIndex != null) {
                                insertTextRequests.push({
                                    insertText: {
                                        location: { index: firstElement.startIndex },
                                        text: value,
                                    },
                                });
                            }
                        }
                    }

                    insertTextRequests.sort((a: any, b: any) =>
                        b.insertText.location.index - a.insertText.location.index
                    );

                    if (insertTextRequests.length > 0) {
                        await docs.documents.batchUpdate({
                            documentId: templateId,
                            requestBody: { requests: insertTextRequests },
                        });
                    }

                    break;
                }
            }
        }

        // 4. Apply all text replacements using replaceAllText
        const allReplaceRequests: any[] = [];

        for (const [placeholder, value] of Object.entries(replacements)) {
            allReplaceRequests.push({
                replaceAllText: {
                    containsText: { text: placeholder, matchCase: true },
                    replaceText: value,
                },
            });
        }

        if (tableRows && tableRows.length > 0) {
            const firstRow = tableRows[0];
            for (const [placeholder, value] of Object.entries(firstRow)) {
                allReplaceRequests.push({
                    replaceAllText: {
                        containsText: { text: placeholder, matchCase: true },
                        replaceText: value,
                    },
                });
            }
        }

        if (allReplaceRequests.length > 0) {
            await docs.documents.batchUpdate({
                documentId: templateId,
                requestBody: { requests: allReplaceRequests },
            });
        }

        // 5. Export as PDF
        const pdfResponse = await drive.files.export(
            { fileId: templateId, mimeType: 'application/pdf' },
            { responseType: 'arraybuffer' }
        );

        return Buffer.from(pdfResponse.data as ArrayBuffer);

    } finally {
        // 6. ALWAYS restore template from DOCX backup
        if (backupBuffer) {
            await restoreAndVerify(drive, docs, templateId, backupBuffer);
        }

        // 7. Release lock
        unlock();
    }
}

/**
 * Restore the template from a DOCX backup and verify that the placeholders
 * are back. The DOCX→Docs conversion is asynchronous on Google's side, so
 * we poll until we see `{{` in the document body (up to ~8 seconds).
 */
async function restoreAndVerify(
    drive: ReturnType<typeof google.drive>,
    docs: ReturnType<typeof google.docs>,
    templateId: string,
    backupBuffer: Buffer,
    maxRetries = 4
) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            // Upload the DOCX backup to overwrite the modified template
            const readable = new Readable();
            readable.push(backupBuffer);
            readable.push(null);

            await drive.files.update({
                fileId: templateId,
                media: {
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    body: readable,
                },
            });

            // Wait for the async DOCX→Docs conversion to complete
            // Increasing delay: 2s, 3s, 4s, 5s
            const delayMs = (attempt + 2) * 1000;
            await new Promise(resolve => setTimeout(resolve, delayMs));

            // Verify the placeholders are back
            const doc = await docs.documents.get({ documentId: templateId });
            const bodyText = extractAllText(doc.data.body);

            if (bodyText.includes('{{')) {
                // Placeholders are restored — success
                if (attempt > 0) {
                    console.log(`Template restored after ${attempt + 1} attempts`);
                }
                return;
            }

            console.warn(`Restore attempt ${attempt + 1}: placeholders not found yet, retrying...`);
        } catch (restoreErr) {
            console.error(`Restore attempt ${attempt + 1} failed:`, restoreErr);
        }
    }

    console.error('CRITICAL: Template restore verification failed after all retries. ' +
        'The template may need manual restoration from Google Docs version history.');
}

/**
 * Extract all text content from a Google Docs body (for verification).
 */
function extractAllText(body: any): string {
    if (!body?.content) return '';
    const parts: string[] = [];
    for (const el of body.content) {
        if (el.paragraph) {
            for (const pe of (el.paragraph.elements || [])) {
                if (pe.textRun?.content) parts.push(pe.textRun.content);
            }
        }
        if (el.table) {
            for (const row of (el.table.tableRows || [])) {
                for (const cell of (row.tableCells || [])) {
                    for (const p of (cell.content || [])) {
                        for (const pe of (p.paragraph?.elements || [])) {
                            if (pe.textRun?.content) parts.push(pe.textRun.content);
                        }
                    }
                }
            }
        }
    }
    return parts.join('');
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Check if any table row contains {{lineItems.*}} placeholders.
 * Joins text across runs to handle split placeholders.
 */
function hasLineItemPlaceholders(rows: any[]): boolean {
    return rows.some((row: any) => {
        const cellTexts = getCellTexts(row);
        return cellTexts.some(text => text.includes('{{lineItems.'));
    });
}

/**
 * Find the template row (the one with {{lineItems.*}} placeholders) and
 * extract the placeholder name for each column.
 */
function findTemplateRow(rows: any[]): { templateRowIdx: number; columnPlaceholders: string[] } {
    for (let r = 0; r < rows.length; r++) {
        const cellTexts = getCellTexts(rows[r]);
        if (cellTexts.some(text => text.includes('{{lineItems.'))) {
            const columnPlaceholders = cellTexts.map(text => {
                const match = text.match(/\{\{lineItems\.[^}]+\}\}/);
                return match ? match[0] : '';
            });
            return { templateRowIdx: r, columnPlaceholders };
        }
    }
    return { templateRowIdx: -1, columnPlaceholders: [] };
}

/**
 * Extract full text content of each cell in a table row.
 * Joins text across multiple text runs to reconstruct split placeholders.
 */
function getCellTexts(row: any): string[] {
    return (row.tableCells || []).map((cell: any) => {
        return (cell.content || []).map((p: any) =>
            (p.paragraph?.elements || []).map((e: any) => e.textRun?.content || '').join('')
        ).join('');
    });
}
