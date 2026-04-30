'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Search, Bell, User, LogOut, Sun, Moon, X, Palmtree, CalendarDays, Loader2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/components/ThemeProvider';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTimers } from '@/components/TimerContext';
import { useNotifications } from '@/components/NotificationContext';
import { useClockIn } from '@/components/ClockInContext';
import { GlobalRouteSearch } from './GlobalRouteSearch';
import { VACATION_TYPES, getVacationTypeConfig } from '@/constants/vacation-types';

const DynamicActionsContent = () => {
    const { data: session } = useSession();
    const { theme, toggleTheme } = useTheme();
    const { timers } = useTimers();
    const { unreadCount, setIsPanelOpen } = useNotifications();
    const { isClockedIn, elapsedSeconds, clockIn, clockOut, loading: clockLoading } = useClockIn();
    const totalBadge = unreadCount + timers.length;
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchValue, setSearchValue] = useState('');
    const [vacationModalOpen, setVacationModalOpen] = useState(false);
    const [vacationSaving, setVacationSaving] = useState(false);
    const [vacationForm, setVacationForm] = useState({ dateFrom: '', dateTo: '', vacationType: 'Annual Leave', reason: '' });
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    // Routes that support search
    const searchableRoutes = ['/crm/leads', '/crm/clients', '/crm/tasks', '/warehouse/purchase-orders'];
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

    return (<>
        <div className="flex items-center justify-end space-x-1 w-full h-full">
            {/* Global Route Search (Command Palette) */}
            <div className="hidden sm:block mr-2">
                <GlobalRouteSearch />
            </div>

            {/* Local Data Search Bar */}
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
                className={`relative p-1.5 rounded-full transition-all cursor-pointer ${totalBadge > 0
                    ? 'text-primary hover:text-primary/80 hover:bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                title={totalBadge > 0 ? `${totalBadge} notification${totalBadge > 1 ? 's' : ''}` : 'No notifications'}
            >
                <Bell className={`w-4 h-4 ${timers.length > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''}`} />
                {totalBadge > 0 && (
                    <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center text-white text-[9px] font-black rounded-full px-1 border-2 border-background shadow-lg ${timers.length > 0 ? 'bg-red-500' : 'bg-primary'}`}>
                        {totalBadge}
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

            {/* Clock-In Timer */}
            {isClockedIn && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 animate-in fade-in slide-in-from-right-2 duration-300">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-mono font-black text-emerald-400 tabular-nums tracking-wider">
                        {formatElapsed(elapsedSeconds)}
                    </span>
                    <button
                        onClick={clockOut}
                        disabled={clockLoading}
                        className="ml-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer border border-red-500/20"
                    >
                        Out
                    </button>
                </div>
            )}

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
                                href={`/profile/${(session?.user as any)?.profileId || (session?.user as any)?.id || ''}`}
                                onClick={() => setIsUserMenuOpen(false)}
                                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-secondary transition-colors"
                            >
                                <User className="w-4 h-4" />
                                <span>Profile</span>
                            </Link>
                            <div className="my-1 border-t border-border/50" />
                            {/* Clock In / Clock Out */}
                            {isClockedIn ? (
                                <button
                                    onClick={async () => { await clockOut(); setIsUserMenuOpen(false); }}
                                    disabled={clockLoading}
                                    className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-500 hover:text-red-400 hover:bg-red-500/5 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    <span className="relative flex h-4 w-4 items-center justify-center">
                                        <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-40" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                    </span>
                                    <span className="flex-1 text-left">{clockLoading ? 'Saving...' : 'Clock Out'}</span>
                                    <span className="text-[10px] font-mono font-bold text-red-400/80 tabular-nums">{formatElapsed(elapsedSeconds)}</span>
                                </button>
                            ) : (
                                <button
                                    onClick={async () => { await clockIn(); setIsUserMenuOpen(false); }}
                                    disabled={clockLoading}
                                    className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    <span className="relative flex h-4 w-4 items-center justify-center">
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                    </span>
                                    <span>{clockLoading ? 'Saving...' : 'Clock In'}</span>
                                </button>
                            )}
                            {/* + Vacation */}
                            <button
                                onClick={() => { setIsUserMenuOpen(false); setVacationModalOpen(true); }}
                                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/5 transition-colors cursor-pointer"
                            >
                                <Palmtree className="w-4 h-4" />
                                <span>+ Vacation</span>
                            </button>
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

        {/* Vacation Request Modal */}
        {vacationModalOpen && (
            <VacationFormModal
                form={vacationForm}
                setForm={setVacationForm}
                saving={vacationSaving}
                onClose={() => setVacationModalOpen(false)}
                onSubmit={async () => {
                    const days = calcBusinessDays(vacationForm.dateFrom, vacationForm.dateTo);
                    if (!vacationForm.dateFrom || !vacationForm.dateTo || days <= 0) { toast.error('Select valid dates'); return; }
                    setVacationSaving(true);
                    try {
                        const res = await fetch('/api/hr/vacations', {
                            method: 'POST', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ...vacationForm, totalDays: days, employee: session?.user?.email || '', employeeName: session?.user?.name || session?.user?.email || '' }),
                        });
                        if (res.ok) {
                            toast.success('Vacation request submitted!');
                            setVacationModalOpen(false);
                            setVacationForm({ dateFrom: '', dateTo: '', vacationType: 'Annual Leave', reason: '' });
                        } else { const d = await res.json(); toast.error(d.error || 'Failed'); }
                    } catch { toast.error('Failed to submit'); } finally { setVacationSaving(false); }
                }}
            />
        )}
    </>);
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

function formatElapsed(totalSec: number): string {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calcBusinessDays(from: string, to: string): number {
    if (!from || !to) return 0;
    const d1 = new Date(from); const d2 = new Date(to);
    if (d2 < d1) return 0;
    let count = 0;
    const cur = new Date(d1);
    while (cur <= d2) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++;
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}


function VacationFormModal({ form, setForm, saving, onClose, onSubmit }: {
    form: { dateFrom: string; dateTo: string; vacationType: string; reason: string };
    setForm: React.Dispatch<React.SetStateAction<typeof form>>;
    saving: boolean; onClose: () => void; onSubmit: () => void;
}) {
    const days = calcBusinessDays(form.dateFrom, form.dateTo);
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 h-12 flex items-center justify-between shrink-0">
                    <h2 className="text-white font-black text-[13px] uppercase tracking-widest">Request Vacation</h2>
                    <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Date From *</label>
                            <input type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                                className="w-full h-9 px-3 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Date To *</label>
                            <input type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))}
                                style={{ colorScheme: 'dark' }}
                                className="w-full h-9 px-3 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none" />
                        </div>
                    </div>
                    {days > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                            <CalendarDays className="w-4 h-4 text-primary" />
                            <span className="text-sm font-bold text-primary">{days} business day{days > 1 ? 's' : ''}</span>
                            <span className="text-[10px] text-primary/60 ml-1">(excl. weekends)</span>
                        </div>
                    )}
                    <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Vacation Type *</label>
                        <select value={form.vacationType} onChange={e => setForm(f => ({ ...f, vacationType: e.target.value }))}
                            className="w-full h-9 px-3 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none cursor-pointer">
                            {VACATION_TYPES.map(t => <option key={t} value={t}>{getVacationTypeConfig(t).emoji} {t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Reason</label>
                        <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Brief reason for your leave..."
                            className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none" />
                    </div>
                </div>
                <div className="px-4 h-12 border-t border-border flex items-center justify-end gap-2 shrink-0">
                    <button onClick={onClose} className="h-8 px-4 border border-border text-muted-foreground rounded-lg text-[11px] font-bold uppercase cursor-pointer hover:bg-secondary transition-all">Cancel</button>
                    <button onClick={onSubmit} disabled={saving} className="h-8 px-5 bg-primary text-black rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50 transition-all shadow">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Submit
                    </button>
                </div>
            </div>
        </div>
    );
}
