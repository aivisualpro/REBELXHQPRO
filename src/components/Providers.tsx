'use client';

import { SessionProvider } from "next-auth/react";

import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './ThemeProvider';
import { TimerProvider } from './TimerContext';
import { NotificationProvider } from './NotificationContext';
import { NotificationPanel } from './NotificationPanel';
import { ClockInProvider } from './ClockInContext';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={false}>
            <ThemeProvider>
                <TimerProvider>
                    <ClockInProvider>
                        <NotificationProvider>
                            {children}
                            <NotificationPanel />
                        </NotificationProvider>
                    </ClockInProvider>
                </TimerProvider>
                <Toaster position="bottom-right" reverseOrder={false} />
            </ThemeProvider>
        </SessionProvider>
    );
}
