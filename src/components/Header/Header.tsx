'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MegaMenu } from './MegaMenu';
import { DynamicActions } from './DynamicActions';
import { MobileMenu } from './MobileMenu';

export const Header = () => {
    return (
        <header className="sticky top-0 z-[1000] w-full bg-black border-b border-white/10">
            <div className="max-w-[1600px] mx-auto h-10 px-6 flex items-center">
                {/* Left: 10% Logo */}
                <div className="w-[10%] flex items-center">
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

                {/* Center: 60% Menus */}
                <div className="w-[60%] h-full">
                    <MegaMenu />
                </div>

                {/* Right: 30% Actions */}
                <div className="w-[30%] flex items-center justify-end">
                    <DynamicActions />
                    <MobileMenu />
                </div>
            </div>
        </header>
    );
};
