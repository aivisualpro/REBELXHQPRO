'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X, Square, Clock, ExternalLink, Factory, ShoppingCart, Bell, CheckCheck, RefreshCw, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimers } from '@/components/TimerContext';
import { useNotifications } from '@/components/NotificationContext';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const CATEGORIES = [
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'timers', label: 'Timers', icon: Clock },
    { id: 'others', label: 'Others', icon: Bell },
] as const;

function formatTimeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// ─── Timer Section ──────────────────────────────────────────────────────────────

function TimerSection() {
    const router = useRouter();
    const { timers, currentTime, stopTimer, formatDuration } = useTimers();
    const { setIsPanelOpen } = useNotifications();

    const handleStopTimer = async (laborId: string, orderId: string) => {
        const result = stopTimer(laborId);
        if (!result) return;

        try {
            const orderRes = await fetch(`/api/manufacturing/${orderId}`);
            if (!orderRes.ok) throw new Error('Failed to fetch order');
            const orderData = await orderRes.json();

            const updatedLabor = (orderData.labor || []).map((l: any) =>
                l._id === laborId ? { ...l, duration: result.duration } : l
            );

            await fetch(`/api/manufacturing/${orderId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labor: updatedLabor })
            });

            toast.success('Timer stopped & saved');
        } catch (e) {
            toast.error('Failed to save timer');
        }
    };

    const grouped = timers.reduce<Record<string, typeof timers>>((acc, timer) => {
        if (!acc[timer.orderId]) acc[timer.orderId] = [];
        acc[timer.orderId].push(timer);
        return acc;
    }, {});

    if (timers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-8">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider text-center">
                    No active timers
                </p>
                <p className="text-[10px] text-muted-foreground/60 text-center">
                    Start a timer on any manufacturing labor entry and it will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="py-2">
            {Object.entries(grouped).map(([orderId, orderTimers]) => {
                const firstTimer = orderTimers[0];
                return (
                    <div key={orderId} className="mb-1">
                        <button
                            onClick={() => {
                                router.push(`/warehouse/manufacturing/${orderId}`);
                                setIsPanelOpen(false);
                            }}
                            className="w-full px-4 py-2 flex items-center justify-between hover:bg-secondary/50 transition-colors cursor-pointer group"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <Factory className="w-3.5 h-3.5 text-primary shrink-0" />
                                <div className="min-w-0 text-left">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">WO #</span>
                                        <span className="text-[11px] font-black text-foreground font-mono">{firstTimer.orderLabel || 'N/A'}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{firstTimer.skuName}</p>
                                </div>
                            </div>
                            <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </button>

                        {orderTimers.map(timer => {
                            const elapsed = Math.floor((currentTime - timer.startedAt) / 1000);
                            return (
                                <div key={timer.laborId} className="mx-3 mb-1.5 bg-red-500/5 border border-red-500/15 rounded overflow-hidden">
                                    <div className="px-3 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative shrink-0">
                                                <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
                                                <span className="relative block w-2 h-2 rounded-full bg-red-500" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-bold text-foreground truncate">{timer.userName}</p>
                                                <p className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">{timer.laborType}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-black font-mono text-red-500 tabular-nums">
                                                {formatDuration(elapsed)}
                                            </span>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleStopTimer(timer.laborId, timer.orderId); }}
                                                className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors cursor-pointer"
                                                title="Stop Timer"
                                            >
                                                <Square className="w-3 h-3 fill-current" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="h-0.5 bg-red-500/10">
                                        <div
                                            className="h-full bg-red-500/40 transition-all duration-1000"
                                            style={{ width: `${Math.min((elapsed % 60) / 60 * 100, 100)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

// ─── Notifications List ─────────────────────────────────────────────────────────

function NotificationsList({ category }: { category: string }) {
    const router = useRouter();
    const { notifications, markAsRead, setIsPanelOpen } = useNotifications();

    const filtered = notifications.filter(n => n.category === category);

    if (filtered.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-8">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                    {category === 'orders' ? <Package className="w-5 h-5 text-muted-foreground" /> : <Bell className="w-5 h-5 text-muted-foreground" />}
                </div>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider text-center">
                    No {category} notifications
                </p>
                <p className="text-[10px] text-muted-foreground/60 text-center">
                    {category === 'orders' ? 'Web order sync notifications will appear here.' : 'System notifications will appear here.'}
                </p>
            </div>
        );
    }

    return (
        <div className="py-1">
            {filtered.map(notif => (
                <button
                    key={notif._id}
                    onClick={() => {
                        if (!notif.isRead) markAsRead(notif._id);
                        if (notif.link) {
                            router.push(notif.link);
                            setIsPanelOpen(false);
                        }
                    }}
                    className={cn(
                        'w-full px-4 py-3 flex items-start gap-3 text-left transition-colors cursor-pointer border-b border-border/40',
                        notif.isRead
                            ? 'hover:bg-secondary/30'
                            : 'bg-primary/[0.03] hover:bg-primary/[0.06]'
                    )}
                >
                    {/* Unread dot */}
                    <div className="mt-1.5 shrink-0">
                        {!notif.isRead ? (
                            <span className="block w-2 h-2 rounded-full bg-primary shadow-sm shadow-primary/30" />
                        ) : (
                            <span className="block w-2 h-2 rounded-full bg-transparent" />
                        )}
                    </div>

                    {/* Icon */}
                    <div className={cn(
                        'mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                        notif.category === 'orders'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-sky-500/10 text-sky-500'
                    )}>
                        {notif.category === 'orders'
                            ? <ShoppingCart className="w-3.5 h-3.5" />
                            : <Bell className="w-3.5 h-3.5" />
                        }
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                        <p className={cn(
                            'text-[11px] leading-tight',
                            notif.isRead ? 'font-semibold text-foreground/80' : 'font-bold text-foreground'
                        )}>
                            {notif.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[9px] text-muted-foreground/50 mt-1 font-medium uppercase tracking-wider">{formatTimeAgo(notif.createdAt)}</p>

                        {/* Sync stats for order notifications */}
                        {notif.metadata?.type === 'web-order-sync' && (
                            <div className="flex items-center gap-2 mt-1.5">
                                {notif.metadata.added > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">
                                        +{notif.metadata.added} new
                                    </span>
                                )}
                                {notif.metadata.updated > 0 && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500">
                                        {notif.metadata.updated} updated
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </button>
            ))}
        </div>
    );
}

// ─── Main Panel ─────────────────────────────────────────────────────────────────

export const NotificationPanel = () => {
    const {
        isPanelOpen, setIsPanelOpen,
        activeCategory, setActiveCategory,
        unreadCount, unreadByCategory,
        markAllAsRead, isSyncing, triggerSync, lastSyncAt,
    } = useNotifications();
    const { timers } = useTimers();

    const getCategoryCount = (catId: string) => {
        if (catId === 'timers') return timers.length;
        return unreadByCategory[catId] || 0;
    };

    const totalBadge = unreadCount + timers.length;

    return (
        <AnimatePresence>
            {isPanelOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-[2px]"
                        onClick={() => setIsPanelOpen(false)}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="fixed top-0 right-0 bottom-0 w-[380px] z-[9999] bg-background border-l border-border shadow-2xl flex flex-col"
                    >
                        {/* Panel Header */}
                        <div className="h-9 px-4 flex items-center justify-between border-b border-border bg-secondary/50 shrink-0">
                            <div className="flex items-center gap-2">
                                <Bell className="w-3.5 h-3.5 text-primary" />
                                <h2 className="text-[11px] font-black uppercase tracking-widest text-foreground">
                                    Notifications
                                </h2>
                                {totalBadge > 0 && (
                                    <span className="text-[9px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                        {totalBadge}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {/* Mark all as read */}
                                {unreadCount > 0 && activeCategory !== 'timers' && (
                                    <button
                                        onClick={() => markAllAsRead(activeCategory)}
                                        className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                        title="Mark all as read"
                                    >
                                        <CheckCheck className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {/* Manual sync trigger */}
                                {activeCategory === 'orders' && (
                                    <button
                                        onClick={triggerSync}
                                        disabled={isSyncing}
                                        className={cn(
                                            'p-1 transition-colors cursor-pointer',
                                            isSyncing ? 'text-primary animate-spin' : 'text-muted-foreground hover:text-foreground'
                                        )}
                                        title={isSyncing ? 'Syncing...' : 'Sync now'}
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsPanelOpen(false)}
                                    className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Category Tabs */}
                        <div className="h-9 px-2 flex items-center gap-0.5 border-b border-border bg-background shrink-0">
                            {CATEGORIES.map(cat => {
                                const count = getCategoryCount(cat.id);
                                const isActive = activeCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.id)}
                                        className={cn(
                                            'flex-1 h-full flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer border-b-2 -mb-px',
                                            isActive
                                                ? 'text-foreground border-foreground'
                                                : 'text-muted-foreground border-transparent hover:text-foreground'
                                        )}
                                    >
                                        <cat.icon className="w-3 h-3" />
                                        <span>{cat.label}</span>
                                        {count > 0 && (
                                            <span className={cn(
                                                'min-w-[16px] h-4 flex items-center justify-center text-[9px] font-black rounded-full px-1',
                                                isActive
                                                    ? cat.id === 'timers' ? 'bg-red-500 text-white' : 'bg-primary text-background'
                                                    : cat.id === 'timers' ? 'bg-red-500/15 text-red-500' : 'bg-secondary text-muted-foreground'
                                            )}>
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Sync status bar */}
                        {activeCategory === 'orders' && isSyncing && (
                            <div className="px-4 py-1.5 bg-primary/5 border-b border-primary/10 flex items-center gap-2">
                                <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                                <span className="text-[10px] font-bold text-primary">Syncing web orders...</span>
                            </div>
                        )}

                        {activeCategory === 'orders' && lastSyncAt && !isSyncing && (
                            <div className="px-4 py-1 bg-secondary/30 border-b border-border/40 flex items-center justify-between">
                                <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">
                                    Last sync: {formatTimeAgo(lastSyncAt)}
                                </span>
                                <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">
                                    Auto-syncs every 30 min
                                </span>
                            </div>
                        )}

                        {/* Panel Body */}
                        <div className="flex-1 overflow-y-auto scrollbar-custom">
                            {activeCategory === 'timers' ? (
                                <TimerSection />
                            ) : (
                                <NotificationsList category={activeCategory} />
                            )}
                        </div>

                        {/* Panel Footer */}
                        {activeCategory === 'timers' && timers.length > 0 && (
                            <div className="h-9 px-4 flex items-center justify-between border-t border-border bg-secondary/30 shrink-0">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                                    {timers.length} active timer{timers.length > 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
