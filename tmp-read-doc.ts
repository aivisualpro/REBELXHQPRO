import { google } from 'googleapis';
import { getServiceAccountAuth } from './src/lib/google-docs.ts';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
    const auth = getServiceAccountAuth();
    const drive = google.drive({ version: 'v3', auth });
    
    try {
        console.log("Getting template parent folder...");
        const templateReq = await drive.files.get({
            fileId: '1wAtench6ZMQOyaBiQvfxuVMgkBMBSc0lLnRp5g4Cv1Y',
            fields: 'parents'
        });
        const parents = templateReq.data.parents;
        console.log("Parents:", parents);

        console.log("Copying to parent folder...");
        const copyResponse = await drive.files.copy({
            fileId: '1wAtench6ZMQOyaBiQvfxuVMgkBMBSc0lLnRp5g4Cv1Y',
            requestBody: {
                name: `Invoice_Temp_${Date.now()}`,
                parents: parents, // Use the user's folder so it uses their quota
            },
        });
        console.log("Copied! ID:", copyResponse.data.id);
        
        await drive.files.delete({ fileId: copyResponse.data.id! });
        console.log("Deleted!");
    } catch (err: any) {
        console.error("Error:", err.message);
    }
}

main().catch(console.error);
