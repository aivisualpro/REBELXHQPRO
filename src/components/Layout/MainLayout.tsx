'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from '@/components/Header/Header';

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
    const pathname = usePathname();
    const isLoginPage = pathname === '/login';

    return (
        <div className="min-h-screen flex flex-col">
            {!isLoginPage && <Header />}
            <main className="flex-1 w-full">
                {children}
            </main>
        </div>
    );
};
