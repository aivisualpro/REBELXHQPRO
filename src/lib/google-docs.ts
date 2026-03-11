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

/**
 * Generate a PDF from a Google Docs template by replacing {{variables}} with data.
 *
 * Strategy:
 * 1. Backup the template as DOCX (for safe restore)
 * 2. If multiple line items, insert extra table rows
 * 3. Populate extra rows using insertText at cell indices
 * 4. Replace all placeholders using replaceAllText (handles split text runs)
 * 5. Export as PDF
 * 6. Restore template from DOCX backup
 *
 * @param templateId - The Google Docs template file ID
 * @param replacements - Key-value pairs for header replacements
 * @param tableRows - Array of objects for line item rows
 * @returns Buffer containing the PDF
 */
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

export async function generatePdfFromTemplate(
    templateId: string,
    replacements: Record<string, string>,
    tableRows?: Record<string, string>[]
): Promise<Buffer> {
    const auth = getServiceAccountAuth();
    const drive = google.drive({ version: 'v3', auth });
    const docs = google.docs({ version: 'v1', auth });

    // Acquire lock to prevent concurrent requests from corrupting the single template document
    const unlock = await pdfMutex.lock();

    let backupBuffer: Buffer | null = null;

    try {
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
                    const tableStartIndex = element.startIndex!;

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

                    // Find the template row and extract column→placeholder mapping
                    const { templateRowIdx, columnPlaceholders } = findTemplateRow(rows);
                    if (templateRowIdx < 0) continue;

                    // Build insertText requests for rows 2+ (processed in reverse index order)
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

                            // Find the insertion point in the empty cell
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

                    // Sort by descending index to avoid index shifting
                    insertTextRequests.sort((a: any, b: any) =>
                        b.insertText.location.index - a.insertText.location.index
                    );

                    if (insertTextRequests.length > 0) {
                        await docs.documents.batchUpdate({
                            documentId: templateId,
                            requestBody: { requests: insertTextRequests },
                        });
                    }

                    break; // Only handle the first matching table
                }
            }
        }

        // 4. Apply all text replacements using replaceAllText
        //    This handles both header fields AND the template row's line item placeholders.
        //    replaceAllText works across text run boundaries, so split placeholders are fine.
        const allReplaceRequests: any[] = [];

        // Header replacements (e.g., {{label}}, {{date}}, {{clientId.name}}, etc.)
        for (const [placeholder, value] of Object.entries(replacements)) {
            allReplaceRequests.push({
                replaceAllText: {
                    containsText: { text: placeholder, matchCase: true },
                    replaceText: value,
                },
            });
        }

        // Line item placeholders in the template row (first data row)
        // replaceAllText matches only in the template row since extra rows were empty
        // and populated with actual values (not placeholders)
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
        // 6. ALWAYS restore template from DOCX backup (even if an error occurred)
        try {
            if (backupBuffer) {
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
            }
        } catch (restoreErr) {
            console.error('CRITICAL: Failed to restore template from backup:', restoreErr);
        }
        
        // Release lock
        unlock();
    }
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
