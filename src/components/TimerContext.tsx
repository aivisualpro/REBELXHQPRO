'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export interface ActiveTimer {
    laborId: string;
    orderId: string;
    orderLabel: string;      // WO # label
    skuName: string;         // Product name
    userName: string;        // Person doing labor
    laborType: string;       // e.g. "WO Labor"
    startedAt: number;       // Date.now() timestamp
    hourlyRate: number;
}

interface TimerContextType {
    timers: ActiveTimer[];
    currentTime: number;
    startTimer: (timer: ActiveTimer) => void;
    stopTimer: (laborId: string) => { duration: string; durationSeconds: number } | null;
    isTimerRunning: (laborId: string) => boolean;
    getTimer: (laborId: string) => ActiveTimer | undefined;
    getTimersByOrder: (orderId: string) => ActiveTimer[];
    isPanelOpen: boolean;
    setIsPanelOpen: (open: boolean) => void;
    formatDuration: (seconds: number) => string;
}

const TimerContext = createContext<TimerContextType | null>(null);

const STORAGE_KEY = 'rebelx_manufacturing_timers';

const loadTimersFromStorage = (): ActiveTimer[] => {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Failed to load timers from localStorage', e);
    }
    return [];
};

const saveTimersToStorage = (timers: ActiveTimer[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
    } catch (e) {
        console.error('Failed to save timers to localStorage', e);
    }
};

export const formatDurationUtil = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function TimerProvider({ children }: { children: React.ReactNode }) {
    const [timers, setTimers] = useState<ActiveTimer[]>([]);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const initialized = useRef(false);
    const timersRef = useRef<ActiveTimer[]>([]);

    // Keep ref in sync
    useEffect(() => {
        timersRef.current = timers;
    }, [timers]);

    // Load timers from localStorage on mount
    useEffect(() => {
        if (!initialized.current) {
            const stored = loadTimersFromStorage();
            setTimers(stored);
            timersRef.current = stored;
            initialized.current = true;
        }
    }, []);

    // Persist timers to localStorage whenever they change
    useEffect(() => {
        if (initialized.current) {
            saveTimersToStorage(timers);
        }
    }, [timers]);

    // Tick every second if any timers are active
    useEffect(() => {
        if (timers.length === 0) return;
        const interval = setInterval(() => {
            setCurrentTime(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, [timers.length]);

    const startTimer = useCallback((timer: ActiveTimer) => {
        setTimers(prev => {
            if (prev.find(t => t.laborId === timer.laborId)) return prev;
            return [...prev, timer];
        });
    }, []);

    const stopTimer = useCallback((laborId: string): { duration: string; durationSeconds: number } | null => {
        const timer = timersRef.current.find(t => t.laborId === laborId);
        if (!timer) return null;
        const durationSeconds = Math.floor((Date.now() - timer.startedAt) / 1000);
        const duration = formatDurationUtil(durationSeconds);
        setTimers(prev => prev.filter(t => t.laborId !== laborId));
        return { duration, durationSeconds };
    }, []);

    const isTimerRunning = useCallback((laborId: string) => {
        return timers.some(t => t.laborId === laborId);
    }, [timers]);

    const getTimer = useCallback((laborId: string) => {
        return timers.find(t => t.laborId === laborId);
    }, [timers]);

    const getTimersByOrder = useCallback((orderId: string) => {
        return timers.filter(t => t.orderId === orderId);
    }, [timers]);

    const formatDuration = useCallback((seconds: number) => {
        return formatDurationUtil(seconds);
    }, []);

    return (
        <TimerContext.Provider value={{
            timers,
            currentTime,
            startTimer,
            stopTimer,
            isTimerRunning,
            getTimer,
            getTimersByOrder,
            isPanelOpen,
            setIsPanelOpen,
            formatDuration,
        }}>
            {children}
        </TimerContext.Provider>
    );
}

export function useTimers() {
    const ctx = useContext(TimerContext);
    if (!ctx) throw new Error('useTimers must be used within a TimerProvider');
    return ctx;
}
