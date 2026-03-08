'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';

interface RoutePerm {
    crud: { create: boolean; read: boolean; update: boolean; delete: boolean };
    fields: Record<string, boolean>;
}

interface PermissionCache {
    workspaceId: string;
    workspaceName: string;
    workspaceColor: string;
    routePermissions: Record<string, RoutePerm>;
    keyPermissions: Record<string, RoutePerm & { enabled: boolean }>;
    enabledModules: string[];
    enabledRoutes: string[];
}

// Global in-memory cache — survives across component remounts but not page refreshes
let _permCache: PermissionCache | null = null;
let _permLoading = false;
let _permPromise: Promise<PermissionCache | null> | null = null;

/**
 * usePermissions() — Efficient workspace permission hook.
 * 
 * - SuperAdmin: all operations return true, no API calls.
 * - Other roles: loads permissions ONCE from the flattened API and caches in memory.
 * - O(1) lookup for CRUD and field visibility.
 */
export function usePermissions(routeOverride?: string) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const [perms, setPerms] = useState<PermissionCache | null>(_permCache);
    const [loading, setLoading] = useState(!_permCache);

    const isSuperAdmin = (session?.user as any)?.role === 'SuperAdmin';
    const workspaceId = (session?.user as any)?.workspaceId;
    const targetRoute = routeOverride || pathname;
    const hasWorkspace = !!workspaceId;

    // Load permissions once
    useEffect(() => {
        if (isSuperAdmin || !workspaceId) {
            setLoading(false);
            return;
        }

        // Already cached
        if (_permCache && _permCache.workspaceId === workspaceId) {
            setPerms(_permCache);
            setLoading(false);
            return;
        }

        // Already loading (another component instance triggered it)
        if (_permPromise) {
            _permPromise.then(data => {
                setPerms(data);
                setLoading(false);
            });
            return;
        }

        // Fetch and cache
        _permLoading = true;
        _permPromise = fetch(`/api/workspaces/permissions?workspaceId=${workspaceId}`)
            .then(r => r.json())
            .then(data => {
                if (data.error) {
                    console.error('Permission load error:', data.error);
                    return null;
                }
                _permCache = data;
                return data;
            })
            .catch(err => {
                console.error('Permission fetch error:', err);
                return null;
            })
            .finally(() => {
                _permLoading = false;
                _permPromise = null;
            });

        _permPromise.then(data => {
            setPerms(data);
            setLoading(false);
        });
    }, [isSuperAdmin, workspaceId]);

    // CRUD checks
    const can = useCallback((op: 'create' | 'read' | 'update' | 'delete', route?: string): boolean => {
        if (isSuperAdmin) return true;
        if (!hasWorkspace) return false; // No workspace = no access
        if (!perms) return true; // Default open until loaded (graceful degradation)

        const target = route || targetRoute;
        const routePerm = perms.routePermissions[target];
        if (!routePerm) {
            // Check if any parent route matches (for detail pages like /sales/wholesale-orders/123)
            const parentRoute = Object.keys(perms.routePermissions).find(r => target.startsWith(r + '/') || target === r);
            if (parentRoute) {
                return perms.routePermissions[parentRoute].crud[op];
            }
            return false; // Route not in workspace = no access
        }
        return routePerm.crud[op];
    }, [isSuperAdmin, hasWorkspace, perms, targetRoute]);

    // Field visibility check
    const isFieldVisible = useCallback((fieldName: string, route?: string): boolean => {
        if (isSuperAdmin) return true;
        if (!hasWorkspace) return false;
        if (!perms) return false; // Hide sensitive fields until permissions are loaded

        const target = route || targetRoute;
        const routePerm = perms.routePermissions[target];
        if (!routePerm) {
            const parentRoute = Object.keys(perms.routePermissions).find(r => target.startsWith(r + '/') || target === r);
            if (parentRoute) {
                return perms.routePermissions[parentRoute].fields[fieldName] ?? true;
            }
            return true;
        }
        return routePerm.fields[fieldName] ?? true; // Default visible if not defined
    }, [isSuperAdmin, hasWorkspace, perms, targetRoute]);

    // Module-level check
    const isModuleEnabled = useCallback((moduleKey: string): boolean => {
        if (isSuperAdmin) return true;
        if (!hasWorkspace) return false; // No workspace = no modules
        if (!perms) return true; // Loading — default open
        return perms.enabledModules.includes(moduleKey);
    }, [isSuperAdmin, hasWorkspace, perms]);

    // Route-level check
    const isRouteEnabled = useCallback((route: string): boolean => {
        if (isSuperAdmin) return true;
        if (!hasWorkspace) return false; // No workspace = no routes
        if (!perms) return true;
        return perms.enabledRoutes.includes(route);
    }, [isSuperAdmin, hasWorkspace, perms]);

    // Sub-module enabled check (by key)
    const isSubModuleEnabled = useCallback((subKey: string): boolean => {
        if (isSuperAdmin) return true;
        if (!hasWorkspace) return false;
        if (!perms) return false;
        return perms.keyPermissions?.[subKey]?.enabled ?? false;
    }, [isSuperAdmin, hasWorkspace, perms]);

    // Field visibility check by sub-module key (for sub-modules sharing the same route)
    const isFieldVisibleByKey = useCallback((subKey: string, fieldName: string): boolean => {
        if (isSuperAdmin) return true;
        if (!hasWorkspace) return false;
        if (!perms) return false;
        const keyPerm = perms.keyPermissions?.[subKey];
        if (!keyPerm) return true; // Sub-module not in workspace — default visible
        return keyPerm.fields[fieldName] ?? true;
    }, [isSuperAdmin, hasWorkspace, perms]);

    return {
        loading,
        isSuperAdmin,
        can,
        canCreate: (r?: string) => can('create', r),
        canRead: (r?: string) => can('read', r),
        canUpdate: (r?: string) => can('update', r),
        canDelete: (r?: string) => can('delete', r),
        isFieldVisible,
        isFieldVisibleByKey,
        isModuleEnabled,
        isRouteEnabled,
        isSubModuleEnabled,
        workspaceName: perms?.workspaceName || '',
        workspaceColor: perms?.workspaceColor || '#f2b61c',
        // Force reload permissions (e.g. after workspace change)
        reload: () => {
            _permCache = null;
            _permPromise = null;
            setPerms(null);
            setLoading(true);
        },
    };
}
