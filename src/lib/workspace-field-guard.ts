import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongoose';
import Workspace from '@/models/Workspace';
import { NextRequest } from 'next/server';

/**
 * Field map for a workspace sub-module:
 * { fieldName: visible (true/false) }
 * Only fields explicitly set to false need action — all others default to true.
 */
type FieldMap = Record<string, boolean>;

/** In-process cache so we don't DB-query on every request. Keyed by workspaceId+subKey. */
const _cache = new Map<string, { fields: FieldMap; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 1-minute TTL

/**
 * getWorkspaceFieldMap(workspaceId, subKey)
 * Returns a field visibility map for the given workspace sub-module.
 * Uses an in-process TTL cache to avoid per-request DB lookups.
 */
async function getWorkspaceFieldMap(workspaceId: string, subKey: string): Promise<FieldMap> {
    const cacheKey = `${workspaceId}::${subKey}`;
    const cached = _cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.fields;
    }

    await dbConnect();
    const workspace = await Workspace.findById(workspaceId)
        .select('modules')
        .lean() as any;

    const fieldMap: FieldMap = {};
    if (workspace?.modules) {
        for (const mod of workspace.modules) {
            for (const sub of mod.subModules || []) {
                if (sub.key === subKey) {
                    for (const f of sub.fields || []) {
                        fieldMap[f.field] = f.visible;
                    }
                }
            }
        }
    }

    _cache.set(cacheKey, { fields: fieldMap, expiresAt: Date.now() + CACHE_TTL_MS });
    return fieldMap;
}

/**
 * stripHiddenFields(obj, fieldMap)
 * Deletes keys from obj whose workspace field visibility is explicitly false.
 * Mutates obj in-place and returns it.
 */
export function stripHiddenFields<T extends Record<string, any>>(obj: T, fieldMap: FieldMap): T {
    for (const [field, visible] of Object.entries(fieldMap)) {
        if (!visible) {
            delete obj[field];
        }
    }
    return obj;
}

/**
 * getSessionFieldMap(request, subKey)
 *
 * Reads the logged-in user's workspaceId from the JWT session,
 * then returns the workspace's field visibility map for the given sub-module key.
 *
 * Returns null if:
 *  - No session (unauthenticated)
 *  - User is SuperAdmin (no restrictions)
 *  - User has no workspaceId assigned
 */
export async function getSessionFieldMap(
    request: NextRequest,
    subKey: string
): Promise<FieldMap | null> {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const user = session.user as any;

    // SuperAdmins have unrestricted access — never strip fields
    if (user.role === 'SuperAdmin') return null;

    const workspaceId = user.workspaceId;
    if (!workspaceId) return null;

    const fieldMap = await getWorkspaceFieldMap(workspaceId, subKey);
    return fieldMap;
}

/**
 * applyOrderFieldGuard(order, fieldMap)
 *
 * Applies field-level security to a wholesale sale order object:
 *  1. Strips hidden top-level fields (e.g. 'cost', 'margin') from the order itself
 *  2. Strips hidden fields from every lineItem (uses 'wo-lineitems' conventions)
 *
 * The fieldMap comes from `getSessionFieldMap(request, 'wholesale-orders')` for
 * order-level fields, or 'wo-lineitems' for line-item-level fields.
 */
export function applyOrderFieldGuard(
    order: any,
    orderFieldMap: FieldMap,
    lineItemFieldMap: FieldMap
): any {
    if (!order) return order;

    // Strip hidden top-level order fields
    stripHiddenFields(order, orderFieldMap);

    // Strip hidden line-item fields from every line item
    if (Array.isArray(order.lineItems)) {
        order.lineItems = order.lineItems.map((item: any) =>
            stripHiddenFields({ ...item }, lineItemFieldMap)
        );
    }

    return order;
}
