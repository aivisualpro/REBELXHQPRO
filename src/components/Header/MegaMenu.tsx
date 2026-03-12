'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { MENU_ITEMS } from '@/constants/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';
import { usePermissions } from '@/hooks/usePermissions';

// Map navigation menu titles to workspace module keys
const MENU_TO_MODULE_KEY: Record<string, string> = {
    'Admin': 'admin',
    'CRM': 'crm',
    'Sales': 'sales',
    'Warehouse': 'warehouse',
    'Reports': 'reports',
    'Help': 'help',
};

export const MegaMenu = () => {
    const { data: session } = useSession();
    const { isSuperAdmin, isModuleEnabled, isRouteEnabled } = usePermissions();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const visibleMenuItems = MENU_ITEMS.filter(item => {
        // SuperAdmin sees everything
        if (isSuperAdmin) return true;
        // Check workspace module permission
        const moduleKey = MENU_TO_MODULE_KEY[item.title];
        if (moduleKey) {
            return isModuleEnabled(moduleKey);
        }
        return true;
    });

    return (
        <nav className="hidden lg:flex items-center justify-center space-x-8 h-full">
            {visibleMenuItems.map((menu) => {
                const isLinkOnly = menu.items.length === 0 || menu.title === 'CRM';
                const href = menu.items[0]?.href || '#';

                // Filter sub-items by route permissions (SuperAdmin sees all)
                const visibleItems = isSuperAdmin
                    ? menu.items
                    : menu.items.filter(item => isRouteEnabled(item.href));

                // If no visible items, skip entire menu
                if (visibleItems.length === 0 && !isLinkOnly) return null;

                if (isLinkOnly) {
                    return (
                        <Link
                            key={menu.title}
                            href={menu.title === 'CRM' ? '/crm/inbox' : href}
                            className="text-sm font-medium text-muted transition-colors hover:text-foreground h-full flex items-center cursor-pointer"
                        >
                            {menu.title}
                        </Link>
                    );
                }

                return (
                    <div
                        key={menu.title}
                        className="relative h-full flex items-center"
                        onMouseEnter={() => setActiveMenu(menu.title)}
                        onMouseLeave={() => setActiveMenu(null)}
                    >
                        <button className={cn(
                            "flex items-center space-x-1 text-sm font-medium transition-colors hover:text-foreground cursor-pointer",
                            activeMenu === menu.title ? "text-foreground" : "text-muted"
                        )}>
                            <span>{menu.title}</span>
                            <ChevronDown className={cn(
                                "w-4 h-4 transition-transform duration-200",
                                activeMenu === menu.title ? "rotate-180" : ""
                            )} />
                        </button>

                        <AnimatePresence>
                            {activeMenu === menu.title && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute top-full left-0 pt-2 z-50"
                                >
                                    <div className="bg-card rounded-lg shadow-xl border border-border py-2 min-w-[200px]">
                                        {visibleItems.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className="flex items-center space-x-3 px-4 py-2.5 hover:bg-secondary transition-colors group cursor-pointer"
                                            >
                                                <item.icon className="w-4 h-4 text-muted group-hover:text-foreground" />
                                                <span className="text-sm font-medium text-muted group-hover:text-foreground">
                                                    {item.title}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </nav>
    );
};
