'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Search, Bell, User, LogOut, Sun, Moon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/components/ThemeProvider';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTimers } from '@/components/TimerContext';

const DynamicActionsContent = () => {
    const { data: session } = useSession();
    const { theme, toggleTheme } = useTheme();
    const { timers, setIsPanelOpen } = useTimers();
    const activeTimerCount = timers.length;
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Routes that support search
    const searchableRoutes = ['/crm/leads', '/crm/clients', '/crm/tasks', '/sales/wholesale-orders', '/warehouse/purchase-orders', '/warehouse/kits', '/warehouse/manufacturing', '/warehouse/audit-adjustments'];
    const isSearchable = searchableRoutes.includes(pathname);

    // Sync search value from URL
    useEffect(() => {
        const urlSearch = searchParams.get('search') || '';
        setSearchValue(urlSearch);
        if (urlSearch) setIsSearchOpen(true);
    }, [searchParams]);

    // Focus input when search opens
    useEffect(() => {
        if (isSearchOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearchOpen]);

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

    const handleSearchChange = (value: string) => {
        setSearchValue(value);
        // Update URL with search param
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set('search', value);
        } else {
            params.delete('search');
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    const handleSearchClose = () => {
        setIsSearchOpen(false);
        setSearchValue('');
        // Clear search from URL
        const params = new URLSearchParams(searchParams.toString());
        params.delete('search');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="flex items-center justify-end space-x-1 w-full h-full">
            {/* Search Bar */}
            {isSearchable && (
                <AnimatePresence mode="wait">
                    {isSearchOpen ? (
                        <motion.div
                            key="search-input"
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 200, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className="relative flex items-center overflow-hidden"
                        >
                            <Search className="absolute left-2 w-3 h-3 text-muted-foreground pointer-events-none" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchValue}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                placeholder="Search..."
                                className="w-full h-7 pl-7 pr-7 text-xs bg-secondary/80 border border-border rounded-full text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 transition-all"
                            />
                            <button
                                onClick={handleSearchClose}
                                className="absolute right-1.5 p-0.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition-colors cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </motion.div>
                    ) : (
                        <motion.button
                            key="search-icon"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSearchOpen(true)}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all cursor-pointer"
                            title="Search"
                        >
                            <Search className="w-4 h-4" />
                        </motion.button>
                    )}
                </AnimatePresence>
            )}

            {/* Global Actions */}
            <button 
                onClick={() => setIsPanelOpen(true)}
                className={`relative p-1.5 rounded-full transition-all cursor-pointer ${
                    activeTimerCount > 0 
                        ? 'text-red-500 hover:text-red-400 hover:bg-red-500/10' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
                title={activeTimerCount > 0 ? `${activeTimerCount} active timer${activeTimerCount > 1 ? 's' : ''}` : 'No active timers'}
            >
                <Bell className={`w-4 h-4 ${activeTimerCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}`} />
                {activeTimerCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full px-1 border-2 border-background shadow-lg">
                        {activeTimerCount}
                    </span>
                )}
            </button>
            <button 
                onClick={toggleTheme}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all group cursor-pointer"
                title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
                {theme === 'light' ? (
                    <Moon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                ) : (
                    <Sun className="w-4 h-4 group-hover:rotate-90 transition-transform" />
                )}
            </button>

            <div className="w-px h-5 bg-border mx-1" />

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={cn(
                        "flex items-center justify-center w-7 h-7 rounded-full border transition-all overflow-hidden cursor-pointer",
                        isUserMenuOpen
                            ? "border-accent bg-accent/10 text-foreground"
                            : "border-border bg-secondary text-muted hover:border-accent hover:text-foreground"
                    )}
                >
                    {session?.user?.image ? (
                        <img src={session.user.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-3.5 h-3.5" />
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
    );
};

// Export with Suspense wrapper to fix build error with useSearchParams
export const DynamicActions = () => {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-end space-x-1 w-full h-full">
                <div className="w-4 h-4 rounded-full bg-secondary animate-pulse" />
                <div className="w-4 h-4 rounded-full bg-secondary animate-pulse" />
                <div className="w-4 h-4 rounded-full bg-secondary animate-pulse" />
            </div>
        }>
            <DynamicActionsContent />
        </Suspense>
    );
};
