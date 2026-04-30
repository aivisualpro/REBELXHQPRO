'use client';

import React from 'react';
import { Palmtree } from 'lucide-react';

export default function VacationsPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="px-4 py-2.5 flex items-center gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                            <Palmtree className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Vacations</h1>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <Palmtree className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
                    <h2 className="text-sm font-bold text-muted-foreground">Vacations Module</h2>
                    <p className="text-xs text-muted-foreground/60 mt-1">Vacation management coming soon.</p>
                </div>
            </div>
        </div>
    );
}
