import { google } from 'googleapis';
import { getServiceAccountAuth } from './src/lib/google-docs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
    const auth = getServiceAccountAuth();
    const docs = google.docs({ version: 'v1', auth });
    
    const doc = await docs.documents.get({ documentId: '1wAtench6ZMQOyaBiQvfxuVMgkBMBSc0lLnRp5g4Cv1Y' });
    const body = doc.data.body;
    
    if (body?.content) {
        for (let i = 0; i < body.content.length; i++) {
            const el = body.content[i];
            if (el.table) {
                console.log(`\n=== TABLE at index ${i} ===`);
                console.log(`  element.startIndex = ${el.startIndex}`);
                console.log(`  element.endIndex = ${el.endIndex}`);
                console.log(`  rows: ${el.table.tableRows?.length}`);
                
                // Check for lineItem placeholders
                const rows = el.table.tableRows || [];
                for (let r = 0; r < rows.length; r++) {
                    const cells = rows[r].tableCells || [];
                    const texts: string[] = [];
                    for (const cell of cells) {
                        const cellText = cell.content?.map((c: any) => 
                            c.paragraph?.elements?.map((e: any) => e.textRun?.content || '').join('') || ''
                        ).join('') || '';
                        texts.push(cellText.trim());
                    }
                    console.log(`  Row ${r}: [${texts.join(' | ')}]`);
                }
            }
        }
    }
}

main().catch(console.error);
