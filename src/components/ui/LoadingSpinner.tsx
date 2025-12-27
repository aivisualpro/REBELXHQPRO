'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    message?: string;
    className?: string;
}

export function LoadingSpinner({ size = 'md', message, className }: LoadingSpinnerProps) {
    const sizeClasses = {
        sm: 'w-8 h-8',
        md: 'w-12 h-12',
        lg: 'w-16 h-16'
    };

    return (
        <div className={cn("flex flex-col items-center justify-center gap-4", className)}>
            <div className={cn(
                "relative",
                sizeClasses[size]
            )}>
                {/* Spinning ring */}
                <div className={cn(
                    "absolute inset-0 rounded-full border-2 border-slate-200",
                    sizeClasses[size]
                )} />
                <div className={cn(
                    "absolute inset-0 rounded-full border-2 border-transparent border-t-slate-800 animate-spin",
                    sizeClasses[size]
                )} />
                
                {/* Logo in center */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <img 
                        src="/logo.png" 
                        alt="Loading" 
                        className={cn(
                            "object-contain animate-pulse",
                            size === 'sm' ? 'w-5 h-5' : size === 'md' ? 'w-8 h-8' : 'w-10 h-10'
                        )} 
                    />
                </div>
            </div>
            
            {message && (
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest animate-pulse">
                    {message}
                </p>
            )}
        </div>
    );
}
