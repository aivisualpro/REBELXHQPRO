'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MegaMenu } from './MegaMenu';
import { DynamicActions } from './DynamicActions';
import { RouteContext } from '@/components/Header/RouteContext';
import { MobileMenu } from './MobileMenu';

export const Header = () => {
    return (
        <header className="sticky top-0 z-[1000] w-full bg-background border-b border-border transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto h-9 px-3 flex items-center">
                {/* Left: 5% Logo */}
                <div className="w-[5%] flex items-center">
                    <Link href="/" className="flex items-center group">
                        <div className="relative h-8 w-8 transition-transform duration-300 group-hover:scale-105">
                            <Image
                                src="/logo.png"
                                alt="RebelX Logo"
                                fill
                                sizes="32px"
                                className="object-contain"
                                priority
                            />
                        </div>
                    </Link>
                </div>

                {/* Navigation: 50% Menus */}
                <div className="w-[50%] h-full">
                    <MegaMenu />
                </div>

                {/* Route Context: 30% - Dynamic title + route-specific actions */}
                <div className="w-[30%] h-full flex items-center">
                    <RouteContext />
                </div>

                {/* Right: 15% Actions - Global actions */}
                <div className="w-[15%] flex items-center justify-end">
                    <DynamicActions />
                    <MobileMenu />
                </div>
            </div>
        </header>
    );
};
