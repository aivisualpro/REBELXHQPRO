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
 *   keyPermissions: Record<string, { crud: {...}, fields: Record<string, boolean>, enabled: boolean }>,
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
        // Key-based permissions for sub-modules sharing the same route
        const keyPermissions: Record<string, {
            crud: { create: boolean; read: boolean; update: boolean; delete: boolean };
            fields: Record<string, boolean>;
            enabled: boolean;
        }> = {};
        const enabledModules: string[] = [];
        const enabledRoutes: string[] = [];

        for (const mod of (workspace as any).modules || []) {
            const hasEnabledSubModule = mod.subModules?.some((s: any) => s.enabled);
            const isModuleEnabled = mod.enabled || hasEnabledSubModule;
            
            if (!isModuleEnabled) continue;
            enabledModules.push(mod.key);

            for (const sub of mod.subModules || []) {
                const fieldMap: Record<string, boolean> = {};
                for (const f of sub.fields || []) {
                    fieldMap[f.field] = f.visible;
                }

                const crudPerm = {
                    create: sub.crud?.create ?? true,
                    read: sub.crud?.read ?? true,
                    update: sub.crud?.update ?? true,
                    delete: sub.crud?.delete ?? true,
                };

                // Always store by key (unique per sub-module)
                keyPermissions[sub.key] = {
                    crud: crudPerm,
                    fields: fieldMap,
                    enabled: sub.enabled ?? false,
                };

                if (!sub.enabled) continue;
                enabledRoutes.push(sub.route);

                // Route-based: merge fields if multiple sub-modules share a route
                if (routePermissions[sub.route]) {
                    // Merge fields from this sub-module into existing route entry
                    Object.assign(routePermissions[sub.route].fields, fieldMap);
                    // Merge CRUD permissions (additive - if any sub-module allows it, it is allowed for the route)
                    routePermissions[sub.route].crud.create = routePermissions[sub.route].crud.create || crudPerm.create;
                    routePermissions[sub.route].crud.read   = routePermissions[sub.route].crud.read || crudPerm.read;
                    routePermissions[sub.route].crud.update = routePermissions[sub.route].crud.update || crudPerm.update;
                    routePermissions[sub.route].crud.delete = routePermissions[sub.route].crud.delete || crudPerm.delete;
                } else {
                    routePermissions[sub.route] = {
                        crud: crudPerm,
                        fields: fieldMap,
                    };
                }
            }
        }

        return NextResponse.json({
            workspaceId: (workspace as any)._id,
            workspaceName: (workspace as any).name,
            workspaceColor: (workspace as any).color,
            routePermissions,
            keyPermissions,
            enabledModules,
            enabledRoutes,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
