'use client';

import React, { useState } from 'react';
import { Menu, X, ChevronRight } from 'lucide-react';
import { MENU_ITEMS } from '@/constants/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export const MobileMenu = () => {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

    const visibleMenuItems = MENU_ITEMS.filter(item => {
        if (item.title === 'Admin') {
            return (session?.user as any)?.role === 'SuperAdmin';
        }
        return true;
    });

    return (
        <div className="lg:hidden flex items-center">
            <button
                onClick={() => setIsOpen(true)}
                className="p-2 text-muted hover:text-foreground transition-colors"
            >
                <Menu className="w-6 h-6" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 w-80 h-full bg-card shadow-2xl z-50 flex flex-col"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <span className="font-bold text-lg text-foreground">Menu</span>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 -mr-2 text-muted hover:text-foreground"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto py-4">
                                {visibleMenuItems.map((menu) => (
                                    <div key={menu.title} className="px-4">
                                        <button
                                            onClick={() => setExpandedMenu(expandedMenu === menu.title ? null : menu.title)}
                                            className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-secondary transition-colors group"
                                        >
                                            <div className="flex items-center space-x-3 text-muted group-hover:text-foreground">
                                                <menu.icon className="w-5 h-5" />
                                                <span className="font-medium">{menu.title}</span>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 transition-transform ${expandedMenu === menu.title ? 'rotate-90' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {expandedMenu === menu.title && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden ml-11 space-y-1"
                                                >
                                                    {menu.items.map((item) => (
                                                        <Link
                                                            key={item.href}
                                                            href={item.href}
                                                            onClick={() => setIsOpen(false)}
                                                            className="block p-3 text-sm text-muted hover:text-foreground transition-colors"
                                                        >
                                                            {item.title}
                                                        </Link>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 border-t border-border">
                                <button 
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full bg-[#FFEF5F] text-black p-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:opacity-90 transition-all"
                                >
                                    Logout
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};
