'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface ClockInState {
    entryId: string;
    timeIn: string;
    clockedInAt: number; // epoch ms when clocked in
}

interface ClockInContextType {
    isClockedIn: boolean;
    clockState: ClockInState | null;
    elapsedSeconds: number;
    clockIn: () => Promise<void>;
    clockOut: () => Promise<void>;
    loading: boolean;
}

const ClockInContext = createContext<ClockInContextType | null>(null);

export function ClockInProvider({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const userEmail = session?.user?.email || '';

    const [clockState, setClockState] = useState<ClockInState | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [loading, setLoading] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Check for active clock-in on mount (entry with no timeOut for today)
    const checkActiveClockIn = useCallback(async () => {
        if (!userEmail) return;
        try {
            const res = await fetch(`/api/hr/timesheets/clock-status?user=${encodeURIComponent(userEmail)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.active) {
                    // Parse the timeIn to compute elapsed
                    const today = new Date();
                    const timeIn = data.active.timeIn;
                    const clockedInAt = parseTimeToEpoch(timeIn, today);
                    setClockState({
                        entryId: data.active._id,
                        timeIn,
                        clockedInAt,
                    });
                }
            }
        } catch (err) {
            console.error('Failed to check clock status', err);
        }
    }, [userEmail]);

    useEffect(() => {
        checkActiveClockIn();
    }, [checkActiveClockIn]);

    // Tick the elapsed timer every second
    useEffect(() => {
        if (clockState) {
            const tick = () => {
                const now = Date.now();
                setElapsedSeconds(Math.floor((now - clockState.clockedInAt) / 1000));
            };
            tick();
            intervalRef.current = setInterval(tick, 1000);
            return () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
            };
        } else {
            setElapsedSeconds(0);
        }
    }, [clockState]);

    // Auto clock-out at 6 PM — only if clocked in for more than 10 hours
    useEffect(() => {
        if (!clockState) return;

        const checkAutoClockOut = () => {
            const now = new Date();
            const elapsedHours = (now.getTime() - clockState.clockedInAt) / (1000 * 60 * 60);
            if (now.getHours() >= 18 && elapsedHours > 10) {
                autoClockOut();
            }
        };
        const autoInterval = setInterval(checkAutoClockOut, 30000);
        checkAutoClockOut();
        return () => clearInterval(autoInterval);
    }, [clockState]);

    const autoClockOut = async () => {
        if (!clockState) return;
        try {
            await fetch(`/api/hr/timesheets/${clockState.entryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timeOut: '6:00:00 PM' }),
            });
            setClockState(null);
        } catch (err) {
            console.error('Auto clock-out failed', err);
        }
    };

    const clockIn = async () => {
        if (!userEmail) return;
        setLoading(true);
        try {
            const now = new Date();
            const timeIn = formatTime(now);
            // Fetch hourlyRate from user
            let hourlyRate = 0;
            try {
                const uRes = await fetch(`/api/users?limit=1&search=${encodeURIComponent(userEmail)}`);
                if (uRes.ok) {
                    const uData = await uRes.json();
                    const u = (uData.users || []).find((u: any) => u.email === userEmail);
                    if (u) hourlyRate = u.hourlyRate || 0;
                }
            } catch {}

            const res = await fetch('/api/hr/timesheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: now.toISOString().split('T')[0],
                    user: userEmail,
                    hourlyRate,
                    timeIn,
                    timeOut: '',
                    createdBy: userEmail,
                }),
            });
            if (res.ok) {
                const entry = await res.json();
                setClockState({
                    entryId: entry._id,
                    timeIn,
                    clockedInAt: Date.now(),
                });
            }
        } catch (err) {
            console.error('Clock in failed', err);
        } finally {
            setLoading(false);
        }
    };

    const clockOut = async () => {
        if (!clockState) return;
        setLoading(true);
        try {
            const now = new Date();
            const timeOut = formatTime(now);
            const res = await fetch(`/api/hr/timesheets/${clockState.entryId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timeOut }),
            });
            if (res.ok) {
                setClockState(null);
            }
        } catch (err) {
            console.error('Clock out failed', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ClockInContext.Provider value={{
            isClockedIn: !!clockState,
            clockState,
            elapsedSeconds,
            clockIn,
            clockOut,
            loading,
        }}>
            {children}
        </ClockInContext.Provider>
    );
}

export function useClockIn() {
    const ctx = useContext(ClockInContext);
    if (!ctx) throw new Error('useClockIn must be used inside ClockInProvider');
    return ctx;
}

// Helpers
function formatTime(d: Date): string {
    let h = d.getHours();
    const m = d.getMinutes();
    const s = d.getSeconds();
    const period = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} ${period}`;
}

function parseTimeToEpoch(timeStr: string, baseDate: Date): number {
    const match = timeStr.match(/^(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?$/i);
    if (!match) return Date.now();
    let h = parseInt(match[1]);
    const m = parseInt(match[2]);
    const s = parseInt(match[3] || '0');
    const period = match[4]?.toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    const d = new Date(baseDate);
    d.setHours(h, m, s, 0);
    return d.getTime();
}
