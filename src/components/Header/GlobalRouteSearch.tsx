'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Command, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { MODULE_BLUEPRINTS } from '@/constants/workspace-modules';
import { usePermissions } from '@/hooks/usePermissions';
import { motion, AnimatePresence } from 'framer-motion';

export const GlobalRouteSearch = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { isSubModuleEnabled, isModuleEnabled } = usePermissions();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setSearchQuery('');
        }
    }, [isOpen]);

    // Construct a flat list of accessible routes
    const accessibleRoutes = React.useMemo(() => {
        const routes: { label: string; route: string; moduleLabel: string }[] = [];
        for (const mod of MODULE_BLUEPRINTS) {
            if (!isModuleEnabled(mod.key)) continue;
            for (const sub of mod.subModules) {
                if (isSubModuleEnabled(sub.key)) {
                    routes.push({
                        label: sub.label,
                        route: sub.route,
                        moduleLabel: mod.label
                    });
                }
            }
        }
        return routes;
    }, [isModuleEnabled, isSubModuleEnabled]);

    const filteredRoutes = React.useMemo(() => {
        if (!searchQuery.trim()) return accessibleRoutes;
        const q = searchQuery.toLowerCase();
        return accessibleRoutes.filter(r => 
            r.label.toLowerCase().includes(q) || 
            r.moduleLabel.toLowerCase().includes(q)
        );
    }, [accessibleRoutes, searchQuery]);

    const handleSelect = (route: string) => {
        setIsOpen(false);
        router.push(route);
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all border border-transparent hover:border-border cursor-pointer"
                title="Global Search (⌘K)"
            >
                <Search className="w-4 h-4" />
                <span className="hidden lg:flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest opacity-60">
                    Search...
                </span>
                <kbd className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border text-[9px] font-mono font-bold">
                    <Command className="w-3 h-3" /> K
                </kbd>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[2000]"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-lg bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-[2001]"
                        >
                            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                                <Search className="w-5 h-5 text-muted-foreground" />
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search modules, routes..."
                                    className="flex-1 bg-transparent border-none outline-none text-foreground text-sm font-medium placeholder:text-muted-foreground/50"
                                />
                                <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded bg-secondary text-muted-foreground text-[10px] font-bold uppercase tracking-widest">
                                    ESC
                                </kbd>
                            </div>

                            <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin">
                                {filteredRoutes.length === 0 ? (
                                    <div className="px-4 py-8 text-center">
                                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                            No routes found
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {filteredRoutes.map((route, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSelect(route.route)}
                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-secondary/80 focus:bg-secondary/80 focus:outline-none transition-colors group cursor-pointer text-left"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                        {route.label}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                        {route.moduleLabel}
                                                    </span>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary -translate-x-2 group-hover:translate-x-0 transition-all" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
};
