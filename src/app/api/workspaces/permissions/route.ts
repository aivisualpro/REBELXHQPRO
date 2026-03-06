import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import Workspace from '@/models/Workspace';

export const dynamic = 'force-dynamic';

/**
 * GET /api/workspaces/permissions?workspaceId=xxx
 * 
 * Returns a flattened, pre-computed permission map for a workspace.
 * This is designed to be called ONCE at login and cached client-side.
 * 
 * Response shape:
 * {
 *   workspaceName: string,
 *   routePermissions: Record<string, { crud: {...}, fields: Record<string, boolean> }>,
 *   enabledModules: string[],
 *   enabledRoutes: string[]
 * }
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const workspaceId = searchParams.get('workspaceId');

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
        }

        await dbConnect();
        const workspace = await Workspace.findById(workspaceId).lean();

        if (!workspace) {
            return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
        }

        // Pre-compute a flat permission map for O(1) lookups client-side
        const routePermissions: Record<string, {
            crud: { create: boolean; read: boolean; update: boolean; delete: boolean };
            fields: Record<string, boolean>;
        }> = {};
        const enabledModules: string[] = [];
        const enabledRoutes: string[] = [];

        for (const mod of (workspace as any).modules || []) {
            if (!mod.enabled) continue;
            enabledModules.push(mod.key);

            for (const sub of mod.subModules || []) {
                if (!sub.enabled) continue;
                enabledRoutes.push(sub.route);

                const fieldMap: Record<string, boolean> = {};
                for (const f of sub.fields || []) {
                    fieldMap[f.field] = f.visible;
                }

                routePermissions[sub.route] = {
                    crud: {
                        create: sub.crud?.create ?? true,
                        read: sub.crud?.read ?? true,
                        update: sub.crud?.update ?? true,
                        delete: sub.crud?.delete ?? true,
                    },
                    fields: fieldMap,
                };
            }
        }

        return NextResponse.json({
            workspaceId: (workspace as any)._id,
            workspaceName: (workspace as any).name,
            workspaceColor: (workspace as any).color,
            routePermissions,
            enabledModules,
            enabledRoutes,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
