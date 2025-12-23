'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { MENU_ITEMS } from '@/constants/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useSession } from 'next-auth/react';

export const MegaMenu = () => {
    const { data: session } = useSession();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const visibleMenuItems = MENU_ITEMS.filter(item => {
        if (item.title === 'Admin') {
            return (session?.user as any)?.role === 'SuperAdmin';
        }
        return true;
    });

    return (
        <nav className="hidden lg:flex items-center justify-center space-x-8 h-full">
            {visibleMenuItems.map((menu) => (
                <div
                    key={menu.title}
                    className="relative h-full flex items-center"
                    onMouseEnter={() => setActiveMenu(menu.title)}
                    onMouseLeave={() => setActiveMenu(null)}
                >
                    <button className={cn(
                        "flex items-center space-x-1 text-sm font-medium transition-colors hover:text-white",
                        activeMenu === menu.title ? "text-white" : "text-gray-400"
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
                                transition={{ duration: 0.2 }}
                                className="absolute top-full left-1/2 -translate-x-1/2 w-[600px] pt-4 z-50"
                            >
                                <div className="bg-white rounded-xl shadow-2xl border border-border p-6 mega-menu-gradient grid grid-cols-2 gap-4">
                                    <div className="col-span-1 border-r border-border pr-6">
                                        <div className="flex items-center space-x-3 mb-4">
                                            <div className="p-2 bg-slate-50 rounded-lg text-accent">
                                                <menu.icon className="w-5 h-5" />
                                            </div>
                                            <h3 className="font-semibold text-lg">{menu.title}</h3>
                                        </div>
                                        <p className="text-sm text-muted leading-relaxed">
                                            Access all {menu.title} workflows, data, and management tools from here.
                                        </p>
                                    </div>
                                    <div className="col-span-1 space-y-1">
                                        {menu.items.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className="flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                                            >
                                                <div className="p-1.5 bg-transparent group-hover:bg-white rounded-md transition-colors">
                                                    <item.icon className="w-4 h-4 text-muted group-hover:text-accent" />
                                                </div>
                                                <span className="text-sm font-medium text-muted group-hover:text-primary">
                                                    {item.title}
                                                </span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </nav>
    );
};
