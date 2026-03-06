import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
    await mongoose.connect(process.env.MONGODB_URI as string, { dbName: 'RebelXHQSystems' });
    const db = mongoose.connection.db!;
    const col = db.collection('workspaces');
    const workspaces = await col.find({}).toArray();

    for (const ws of workspaces) {
        const reportsModule = (ws.modules as any[])?.find(m => m.key === 'reports');
        if (reportsModule) {
            const hasDashboard = reportsModule.subModules?.some((sm: any) => sm.key === 'dashboard');
            if (!hasDashboard) {
                const dashboardSubModule = {
                    key: 'dashboard',
                    label: 'Dashboard',
                    route: '/reports/dashboard',
                    enabled: reportsModule.enabled,
                    crud: { create: true, read: true, update: true, delete: true },
                    fields: [
                        { field: 'kpis', label: 'KPIs', visible: true },
                        { field: 'aiInsights', label: 'AI Insights', visible: true },
                        { field: 'clientRetention', label: 'Client Retention', visible: true },
                    ],
                };
                await col.updateOne(
                    { _id: ws._id, 'modules.key': 'reports' },
                    { $push: { 'modules.$.subModules': { $each: [dashboardSubModule], $position: 0 } } as any }
                );
                console.log(`✅ Added dashboard to workspace: ${ws.name}`);
            } else {
                console.log(`⏩ Already has dashboard: ${ws.name}`);
            }
        } else {
            console.log(`⚠️  No reports module in: ${ws.name}`);
        }
    }

    await mongoose.disconnect();
    console.log('Done!');
}

main().catch(err => { console.error(err); process.exit(1); });
