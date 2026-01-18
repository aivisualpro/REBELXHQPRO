'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { getRouteActions } from '@/hooks/useHeaderActions';
import { cn } from '@/lib/utils';
import { Search, Bell, User, LogOut, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/components/ThemeProvider';

export const DynamicActions = () => {
    const { data: session } = useSession();
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
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


            {/* Global Actions */}
            <div className="flex items-center space-x-2">
                <button className="p-2 text-muted hover:text-foreground hover:bg-secondary rounded-full transition-all cursor-pointer">
                    <Search className="w-4.5 h-4.5" />
                </button>
                <button className="relative p-2 text-muted hover:text-foreground hover:bg-secondary rounded-full transition-all cursor-pointer">
                    <Bell className="w-4.5 h-4.5" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-card" />
                </button>
                <button 
                    onClick={toggleTheme}
                    className="p-2 text-muted hover:text-foreground hover:bg-secondary rounded-full transition-all group cursor-pointer"
                    title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                >
                    {theme === 'light' ? (
                        <Moon className="w-4.5 h-4.5 group-hover:rotate-12 transition-transform" />
                    ) : (
                        <Sun className="w-4.5 h-4.5 group-hover:rotate-90 transition-transform" />
                    )}
                </button>

                <div className="w-px h-5 bg-border mx-1" />

                {/* User Menu */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-full border transition-all overflow-hidden cursor-pointer",
                            isUserMenuOpen
                                ? "border-accent bg-accent/10 text-foreground"
                                : "border-border bg-secondary text-muted hover:border-accent hover:text-foreground"
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
                                    className="absolute right-0 mt-2 w-48 py-2 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden text-left"
                                >
                                    <div className="px-4 py-2 border-b border-border/50 mb-1">
                                        <p className="text-xs text-foreground font-bold truncate">{session?.user?.name || session?.user?.email}</p>
                                    </div>
                                    <Link 
                                        href="/profile" 
                                        onClick={() => setIsUserMenuOpen(false)}
                                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-secondary transition-colors"
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Profile</span>
                                    </Link>
                                    <div className="my-1 border-t border-border/50" />
                                    <button
                                        onClick={() => signOut({ callbackUrl: '/login' })}
                                        className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
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
