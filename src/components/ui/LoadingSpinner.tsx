'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
    className?: string;
}

const LoadingSparkle = ({ delay, x, y, size }: { delay: number; x: number; y: number; size: number }) => (
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

export function LoadingSpinner({ size = 'md', message, className }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-10 h-10',
        md: 'w-16 h-16',
        lg: 'w-20 h-20'
    };

    const imgSizeClasses = {
        sm: 'w-7 h-7',
        md: 'w-11 h-11',
        lg: 'w-14 h-14'
    };

    const [sparkles, setSparkles] = useState<{ id: number; delay: number; x: number; y: number; size: number }[]>([]);
    const sparkleCounter = useRef(0);

    const generateSparkles = useCallback(() => {
        const count = size === 'sm' ? 5 : size === 'md' ? 8 : 10;
        const dist = size === 'sm' ? 12 : size === 'md' ? 20 : 28;
        const newSparkles = Array.from({ length: count }, () => {
            sparkleCounter.current += 1;
            const angle = Math.random() * Math.PI * 2;
            const distance = dist + Math.random() * dist * 0.8;
            return {
                id: sparkleCounter.current,
                delay: Math.random() * 400,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                size: 2 + Math.random() * 3,
            };
        });
        setSparkles(newSparkles);
    }, [size]);

    useEffect(() => {
        generateSparkles();
        const interval = setInterval(generateSparkles, 900);
        return () => clearInterval(interval);
    }, [generateSparkles]);

    return (
        <div className={cn("flex flex-col items-center justify-center gap-5", className)}>
            <div className={cn("logo-container relative", sizeClasses[size])}>
                {/* Golden aura glow */}
                <span className="logo-aura" />

                {/* Pulse ring */}
                <span className="logo-pulse-ring logo-pulse-ring--active" />

                {/* Shimmer sweep */}
                <span className="logo-shimmer" />

                {/* Sparkle particles */}
                {sparkles.map((s) => (
                    <LoadingSparkle key={s.id} delay={s.delay} x={s.x} y={s.y} size={s.size} />
                ))}

                {/* Crown logo */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <img
                        src="/logo.png"
                        alt="Loading"
                        className={cn(
                            "object-contain drop-shadow-[0_0_10px_rgba(242,182,28,0.6)]",
                            imgSizeClasses[size]
                        )}
                    />
                </div>
            </div>

            {message && (
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] loading-text-pulse">
                    {message}
                </p>
            )}
        </div>
    );
}

