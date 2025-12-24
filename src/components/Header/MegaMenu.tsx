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
                                transition={{ duration: 0.15 }}
                                className="absolute top-full left-0 pt-2 z-50"
                            >
                                <div className="bg-white rounded-lg shadow-xl border border-slate-200 py-2 min-w-[200px]">
                                    {menu.items.map((item) => (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className="flex items-center space-x-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
                                        >
                                            <item.icon className="w-4 h-4 text-slate-400 group-hover:text-slate-700" />
                                            <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">
                                                {item.title}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </nav>
    );
};
