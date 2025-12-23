'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getRouteActions } from '@/hooks/useHeaderActions';
import { cn } from '@/lib/utils';
import { Search, Bell, User, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';

export const DynamicActions = () => {
    const { data: session } = useSession();
    const pathname = usePathname();
    const actions = getRouteActions(pathname);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="flex items-center justify-end space-x-3 w-full h-full">
            {/* Route Specific Actions */}
            {actions.length > 0 && (
                <div className="hidden md:flex items-center space-x-2 mr-4 border-r border-white/10 pr-6">
                    {actions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={action.onClick}
                            className={cn(
                                "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all transform active:scale-95",
                                action.variant === 'primary'
                                    ? "bg-accent text-white shadow-lg shadow-accent/20 hover:bg-accent/90"
                                    : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
                            )}
                        >
                            <action.icon className="w-4 h-4" />
                            <span className="hidden xl:inline">{action.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Global Actions */}
            <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
                    <Search className="w-4.5 h-4.5" />
                </button>
                <button className="relative p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all">
                    <Bell className="w-4.5 h-4.5" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-black" />
                </button>

                <div className="w-px h-5 bg-white/10 mx-1" />

                {/* User Menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full border transition-all overflow-hidden",
                            isUserMenuOpen
                                ? "border-accent bg-accent/10 text-white"
                                : "border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white"
                        )}
                    >
                        {session?.user?.image ? (
                            <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-4 h-4" />
                        )}
                    </button>

                    <AnimatePresence>
                        {isUserMenuOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 mt-2 w-48 py-2 bg-black border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden text-left"
                            >
                                <div className="px-4 py-2 border-b border-white/5 mb-1">
                                    <p className="text-xs text-white font-bold truncate">{session?.user?.name || session?.user?.email}</p>
                                </div>
                                <button className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                                    <User className="w-4 h-4" />
                                    <span>Profile</span>
                                </button>
                                <div className="my-1 border-t border-white/5" />
                                <button
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Logout</span>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
};
