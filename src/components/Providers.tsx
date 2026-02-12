'use client';

import { SessionProvider } from "next-auth/react";

import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './ThemeProvider';
import { TimerProvider } from './TimerContext';
import { TimerPanel } from './TimerPanel';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider refetchOnWindowFocus={false}>
            <ThemeProvider>
                <TimerProvider>
                    {children}
                    <TimerPanel />
                </TimerProvider>
                <Toaster position="bottom-right" reverseOrder={false} />
            </ThemeProvider>
        </SessionProvider>
    );
}
