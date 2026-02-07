'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function ReportsPage() {
    return (
        <div className="flex flex-col items-center justify-center h-full bg-background">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-lg font-bold text-foreground mb-1">Reports</h1>
            <p className="text-sm text-muted-foreground">Coming soon</p>
        </div>
    );
}
