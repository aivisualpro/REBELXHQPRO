'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header/Header';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden">
            {!isLoginPage && <Header />}
            <main className="flex-1 w-full min-h-0 overflow-hidden bg-slate-50">
                {children}
            </main>
        </div>
    );
};
