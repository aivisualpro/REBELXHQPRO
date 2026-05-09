'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Plus, Download, Upload, RefreshCw, Filter, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouteConfig {
    title: string;
    actions?: {
        label: string;
        icon: React.ElementType;
        href?: string;
        onClick?: () => void;
        variant?: 'primary' | 'secondary' | 'outline';
    }[];
    isPortal?: boolean;
}

// Define route configurations
const getRouteConfig = (pathname: string): RouteConfig | null => {
    // Wholesale Orders
    if (pathname === '/sales/wholesale-orders') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Web Orders
    if (pathname === '/sales/web-orders') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Subscriptions
    if (pathname === '/sales/subscriptions') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Wholesale Order Detail
    if (pathname.match(/^\/sales\/wholesale-orders\/[^/]+$/)) {
        return {
            title: '', // Will be portaled
            actions: [],
            isPortal: true // Flag to identify portal mode
        };
    }

    // Web Order Detail
    if (pathname.match(/^\/sales\/web-orders\/[^/]+$/)) {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Leads
    if (pathname === '/crm/leads') {
        return {
            title: '', // Will be portaled
            actions: [],
            isPortal: true // Flag to identify portal mode
        };
    }

    // Clients
    if (pathname === '/crm/clients') {
        return {
            title: '', // Will be portaled
            actions: [],
            isPortal: true // Flag to identify portal mode
        };
    }

    // Client Detail
    if (pathname.match(/^\/crm\/clients\/[^/]+$/)) {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Vendors
    if (pathname === '/warehouse/vendors') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Products/SKUs
    if (pathname === '/warehouse/skus') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Web Products
    if (pathname === '/warehouse/web-products') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Opening Balances
    if (pathname === '/warehouse/opening-balances') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Opening Balance Detail
    if (pathname.match(/^\/warehouse\/opening-balances\/[^/]+$/)) {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Purchase Orders
    if (pathname === '/warehouse/purchase-orders') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Inventory
    if (pathname === '/warehouse/inventory') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Audit Adjustments
    if (pathname === '/warehouse/audit-adjustments') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Audit Adjustment Detail
    if (pathname.match(/^\/warehouse\/audit-adjustments\/[^/]+$/)) {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Recipes
    if (pathname === '/warehouse/recipes') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Recipe Detail
    if (pathname.match(/^\/warehouse\/recipes\/[^/]+$/)) {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Manufacturing
    if (pathname === '/warehouse/manufacturing') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Schedules
    if (pathname === '/jobs/schedules') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Time Cards
    if (pathname === '/jobs/time-cards') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Reports
    if (pathname.includes('/reports')) {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }



    // Dashboard
    if (pathname === '/' || pathname === '/reports/dashboard') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Profile
    if (pathname === '/profile' || pathname.startsWith('/profile/')) {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Tasks
    if (pathname === '/crm/tasks') {
        return {
            title: '',
            actions: [],
            isPortal: true
        };
    }

    // Settings — uses its own in-page header
    if (pathname === '/admin/settings') {
        return null;
    }

    // Default: No context
    return null;
};

export const RouteContext = () => {
    const pathname = usePathname();
    const config = getRouteConfig(pathname);

    if (!config) {
        return <div className="w-full" />;
    }

    if (config.isPortal) {
        return <div id="header-portal-target" className="flex items-center justify-between w-full h-full px-4 relative z-10" />;
    }

    return (
        <div className="flex items-center gap-3 w-full h-full px-4">
            {/* Title */}
            <h1 className="text-sm font-bold text-foreground uppercase tracking-tight whitespace-nowrap">
                {config.title}
            </h1>

            {/* Actions */}
            {config.actions && config.actions.length > 0 && (
                <div className="flex items-center space-x-2">
                    {config.actions.map((action, index) => {
                        const Icon = action.icon;
                        const buttonClass = cn(
                            "flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer",
                            action.variant === 'primary'
                                ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                                : action.variant === 'secondary'
                                    ? "bg-secondary text-foreground hover:bg-secondary/80"
                                    : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                        );

                        if (action.href) {
                            return (
                                <Link key={index} href={action.href} className={buttonClass}>
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{action.label}</span>
                                </Link>
                            );
                        }

                        return (
                            <button key={index} onClick={action.onClick} className={buttonClass}>
                                <Icon className="w-3.5 h-3.5" />
                                <span>{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
