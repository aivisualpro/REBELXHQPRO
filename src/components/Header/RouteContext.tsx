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
            title: 'Wholesale Orders',
            actions: [
                { label: 'Sync Costs', icon: RefreshCw, href: '/sales/wholesale-orders?syncCosts=true', variant: 'outline' },
                { label: 'Add', icon: Plus, href: '/sales/wholesale-orders?createNew=true', variant: 'primary' },
            ]
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
            title: 'Clients',
            actions: []
        };
    }

    // Client Detail
    if (pathname.match(/^\/crm\/clients\/[^/]+$/)) {
        return {
            title: 'Client Details',
            actions: []
        };
    }

    // Products/SKUs
    if (pathname === '/warehouse/skus') {
        return {
            title: 'Products',
            actions: [
                { label: 'Add', icon: Plus, href: '/warehouse/skus?createNew=true', variant: 'primary' },
            ]
        };
    }

    // Purchase Orders
    if (pathname === '/warehouse/purchase-orders') {
        return {
            title: 'Purchase Orders',
            actions: [
                { label: 'Add', icon: Plus, variant: 'primary' },
            ]
        };
    }

    // Inventory
    if (pathname === '/warehouse/inventory') {
        return {
            title: 'Inventory',
            actions: []
        };
    }

    // Schedules
    if (pathname === '/jobs/schedules') {
        return {
            title: 'Schedules',
            actions: [
                { label: 'Add', icon: Plus, variant: 'primary' },
            ]
        };
    }

    // Time Cards
    if (pathname === '/jobs/time-cards') {
        return {
            title: 'Time Cards',
            actions: []
        };
    }

    // Reports
    if (pathname.includes('/reports')) {
        return {
            title: 'Reports',
            actions: []
        };
    }

    // Inbox
    if (pathname === '/crm/inbox') {
        return {
            title: 'Inbox',
            actions: []
        };
    }

    // Dashboard
    if (pathname === '/') {
        return {
            title: 'Dashboard',
            actions: []
        };
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
        return <div id="header-portal-target" className="flex items-center justify-between w-full h-full px-4" />;
    }

    return (
        <div className="flex items-center justify-between w-full h-full px-4">
            {/* Title */}
            <h1 className="text-sm font-bold text-foreground uppercase tracking-tight">
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
