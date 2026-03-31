'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface NotificationItem {
    _id: string;
    category: 'orders' | 'timers' | 'others';
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
    metadata?: any;
}

interface NotificationContextType {
    notifications: NotificationItem[];
    unreadCount: number;
    unreadByCategory: Record<string, number>;
    isLoading: boolean;
    isPanelOpen: boolean;
    setIsPanelOpen: (open: boolean) => void;
    activeCategory: string;
    setActiveCategory: (cat: string) => void;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: (category?: string) => Promise<void>;
    lastSyncAt: string | null;
    isSyncing: boolean;
    triggerSync: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const AUTO_SYNC_INTERVAL = 30 * 60 * 1000; // 30 minutes
const NOTIFICATION_POLL_INTERVAL = 60 * 1000; // 1 minute

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadByCategory, setUnreadByCategory] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState('orders');
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isSyncingRef = useRef(false); // ⚡ Ref to avoid re-creating triggerSync on state change

    // Fetch notifications from API
    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications?limit=100');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
                setUnreadByCategory(data.unreadByCategory || {});
            }
        } catch (e) {
            console.error('Failed to fetch notifications:', e);
        }
    }, []);

    // Mark single notification as read
    const markAsRead = useCallback(async (id: string) => {
        try {
            await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (e) {
            console.error('Failed to mark as read:', e);
        }
    }, []);

    // Mark all as read (optionally by category)
    const markAllAsRead = useCallback(async (category?: string) => {
        try {
            await fetch('/api/notifications/read-all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(category ? { category } : {})
            });
            setNotifications(prev => prev.map(n =>
                (!category || n.category === category) ? { ...n, isRead: true } : n
            ));
            if (category) {
                setUnreadByCategory(prev => ({ ...prev, [category]: 0 }));
                setUnreadCount(prev => Math.max(0, prev - (unreadByCategory[category] || 0)));
            } else {
                setUnreadByCategory({});
                setUnreadCount(0);
            }
        } catch (e) {
            console.error('Failed to mark all as read:', e);
        }
    }, [unreadByCategory]);

    // Trigger incremental web orders sync
    // ⚡ Uses ref for isSyncing to keep this callback stable (no re-creation on state change)
    const triggerSync = useCallback(async () => {
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/retail/web-orders/sync', { method: 'POST' });
            if (res.ok) {
                setLastSyncAt(new Date().toISOString());
                // Poll for sync completion, then refresh notifications
                let pollCount = 0;
                const MAX_POLLS = 60; // 60 × 5s = 5 minutes max wait
                const checkCompletion = async () => {
                    pollCount++;
                    if (pollCount > MAX_POLLS) {
                        console.warn('⚠️ Sync poll timeout — releasing client lock');
                        isSyncingRef.current = false;
                        setIsSyncing(false);
                        setTimeout(() => fetchNotifications(), 1000);
                        return;
                    }
                    try {
                        const statusRes = await fetch('/api/retail/web-orders/sync');
                        if (statusRes.ok) {
                            const status = await statusRes.json();
                            if (!status.isSyncing) {
                                isSyncingRef.current = false;
                                setIsSyncing(false);
                                // Refresh notifications after sync completes
                                setTimeout(() => fetchNotifications(), 1000);
                                return;
                            }
                        }
                    } catch { }
                    // Keep checking every 5 seconds
                    setTimeout(checkCompletion, 5000);
                };
                setTimeout(checkCompletion, 3000);
            } else if (res.status === 409) {
                // A sync is already running (common during dev hot-reloads) — release lock silently
                isSyncingRef.current = false;
                setIsSyncing(false);
            } else {
                isSyncingRef.current = false;
                setIsSyncing(false);
            }
        } catch (e) {
            console.error('Failed to trigger sync:', e);
            isSyncingRef.current = false;
            setIsSyncing(false);
        }
    }, [fetchNotifications]); // ⚡ No dependency on isSyncing — uses ref instead

    // Initial load
    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Poll notifications every minute
    useEffect(() => {
        pollIntervalRef.current = setInterval(fetchNotifications, NOTIFICATION_POLL_INTERVAL);
        return () => {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        };
    }, [fetchNotifications]);

    // ⚡ Auto-sync web orders: initial sync 10s after mount + every 30 minutes
    useEffect(() => {
        // Run an initial sync shortly after app loads
        const initialSyncTimeout = setTimeout(() => {
            console.log('🔄 Auto-sync: Initial web orders sync...');
            triggerSync();
        }, 10_000); // 10 seconds after mount

        // Then repeat every 30 minutes
        syncIntervalRef.current = setInterval(() => {
            console.log('🔄 Auto-sync: Scheduled 30-min web orders sync...');
            triggerSync();
        }, AUTO_SYNC_INTERVAL);

        return () => {
            clearTimeout(initialSyncTimeout);
            if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
        };
    }, [triggerSync]);

    // Refresh notifications when panel opens
    useEffect(() => {
        if (isPanelOpen) fetchNotifications();
    }, [isPanelOpen, fetchNotifications]);

    return (
        <NotificationContext.Provider value={{
            notifications, unreadCount, unreadByCategory,
            isLoading, isPanelOpen, setIsPanelOpen,
            activeCategory, setActiveCategory,
            fetchNotifications, markAsRead, markAllAsRead,
            lastSyncAt, isSyncing, triggerSync,
        }}>
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within NotificationProvider');
    return context;
}
