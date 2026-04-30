'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MegaMenu } from './MegaMenu';
import { DynamicActions } from './DynamicActions';
import { RouteContext } from '@/components/Header/RouteContext';
import { MobileMenu } from './MobileMenu';

/* ── Sparkle Particle ───────────────────────────────────────── */
const Sparkle = ({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) => (
    <span
        className="logo-sparkle"
        style={{
            '--sparkle-delay': `${delay}ms`,
            '--sparkle-x': `${x}px`,
            '--sparkle-y': `${y}px`,
            width: size,
            height: size,
        } as React.CSSProperties}
    />
);

export const Header = () => {
    const [isHovered, setIsHovered] = useState(false);
    const [sparkles, setSparkles] = useState<{ id: number; delay: number; x: number; y: number; size: number }[]>([]);
    const sparkleCounter = useRef(0);

    const generateSparkles = useCallback(() => {
        const newSparkles = Array.from({ length: 8 }, () => {
            sparkleCounter.current += 1;
            const angle = Math.random() * Math.PI * 2;
            const distance = 14 + Math.random() * 18;
            return {
                id: sparkleCounter.current,
                delay: Math.random() * 300,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                size: 2 + Math.random() * 3,
            };
        });
        setSparkles(newSparkles);
    }, []);

    useEffect(() => {
        if (isHovered) {
            generateSparkles();
            const interval = setInterval(generateSparkles, 700);
            return () => clearInterval(interval);
        } else {
            setSparkles([]);
        }
    }, [isHovered, generateSparkles]);

    return (
        <header className="sticky top-0 z-[1000] w-full bg-background border-b border-border transition-colors duration-300">
            <div className="max-w-[1600px] mx-auto h-9 px-2 sm:px-4 flex items-center">
                {/* Left: Logo */}
                <div className="shrink-0 flex items-center lg:w-[5%]">
                    <Link
                        href="/"
                        className="flex items-center group"
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                    >
                        <div className="logo-container relative h-7 w-7 sm:h-8 sm:w-8">
                            {/* Outer glow aura */}
                            <span className="logo-aura" />

                            {/* Pulse ring on hover */}
                            <span className={`logo-pulse-ring ${isHovered ? 'logo-pulse-ring--active' : ''}`} />

                            {/* Shimmer sweep */}
                            <span className="logo-shimmer" />

                            {/* Sparkle particles */}
                            {sparkles.map((s) => (
                                <Sparkle key={s.id} delay={s.delay} x={s.x} y={s.y} size={s.size} />
                            ))}

                            {/* Logo image */}
                            <Image
                                src="/logo.png"
                                alt="RebelX Logo"
                                fill
                                sizes="32px"
                                className="object-contain relative z-10 drop-shadow-[0_0_6px_rgba(242,182,28,0.5)] transition-all duration-500 group-hover:drop-shadow-[0_0_12px_rgba(242,182,28,0.8)] group-hover:scale-110"
                                priority
                            />
                        </div>
                    </Link>
                </div>

                {/* Navigation: Menus - hidden on mobile/tablet, MobileMenu handles that */}
                <div className="hidden lg:block lg:w-[40%] h-full">
                    <MegaMenu />
                </div>

                {/* Route Context: Dynamic title + route-specific actions - hidden on mobile */}
                <div className="hidden lg:flex lg:w-[35%] h-full items-center">
                    <RouteContext />
                </div>

                {/* Right: Actions - fills remaining space on mobile */}
                <div className="flex-1 lg:w-[20%] flex items-center justify-end gap-1">
                    <DynamicActions />
                    <MobileMenu />
                </div>
            </div>
        </header>
    );
};
