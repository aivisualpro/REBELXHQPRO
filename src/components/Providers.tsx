'use client';

import { SessionProvider } from "next-auth/react";

import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ThemeProvider>
                {children}
                <Toaster position="bottom-right" reverseOrder={false} />
            </ThemeProvider>
        </SessionProvider>
    );
}
