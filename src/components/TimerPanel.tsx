'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { X, Square, Clock, ExternalLink, Factory } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTimers } from '@/components/TimerContext';
import toast from 'react-hot-toast';

export const TimerPanel = () => {
    const router = useRouter();
    const { timers, currentTime, stopTimer, isPanelOpen, setIsPanelOpen, formatDuration } = useTimers();

    const handleStopTimer = async (laborId: string, orderId: string) => {
        const result = stopTimer(laborId);
        if (!result) return;

        // Save the duration to the backend
        try {
            // Fetch order to get current labor array
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

    // Group timers by order
    const grouped = timers.reduce<Record<string, typeof timers>>((acc, timer) => {
        if (!acc[timer.orderId]) acc[timer.orderId] = [];
        acc[timer.orderId].push(timer);
        return acc;
    }, {});

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
                                <div className="relative">
                                    <Clock className="w-3.5 h-3.5 text-red-500" />
                                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                                </div>
                                <h2 className="text-[11px] font-black uppercase tracking-widest text-foreground">
                                    Active Timers
                                </h2>
                                <span className="text-[9px] font-mono font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                                    {timers.length}
                                </span>
                            </div>
                            <button
                                onClick={() => setIsPanelOpen(false)}
                                className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Panel Body */}
                        <div className="flex-1 overflow-y-auto scrollbar-custom">
                            {timers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 px-8">
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
                            ) : (
                                <div className="py-2">
                                    {Object.entries(grouped).map(([orderId, orderTimers]) => {
                                        const firstTimer = orderTimers[0];
                                        return (
                                            <div key={orderId} className="mb-1">
                                                {/* Order Header */}
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

                                                {/* Timer Entries */}
                                                {orderTimers.map(timer => {
                                                    const elapsed = Math.floor((currentTime - timer.startedAt) / 1000);
                                                    return (
                                                        <div
                                                            key={timer.laborId}
                                                            className="mx-3 mb-1.5 bg-red-500/5 border border-red-500/15 rounded overflow-hidden"
                                                        >
                                                            <div className="px-3 py-2 flex items-center justify-between">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    {/* Pulsing dot */}
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
                                                                    {/* Live timer display */}
                                                                    <span className="text-sm font-black font-mono text-red-500 tabular-nums">
                                                                        {formatDuration(elapsed)}
                                                                    </span>
                                                                    {/* Stop button */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleStopTimer(timer.laborId, timer.orderId);
                                                                        }}
                                                                        className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors cursor-pointer"
                                                                        title="Stop Timer"
                                                                    >
                                                                        <Square className="w-3 h-3 fill-current" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            {/* Progress bar animation */}
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
                            )}
                        </div>

                        {/* Panel Footer */}
                        {timers.length > 0 && (
                            <div className="h-9 px-4 flex items-center justify-between border-t border-border bg-secondary/30 shrink-0">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">
                                    {timers.length} timer{timers.length > 1 ? 's' : ''} across {Object.keys(grouped).length} order{Object.keys(grouped).length > 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
