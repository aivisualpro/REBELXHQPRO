'use client';

import { useEffect } from 'react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Page error:', error);
    }, [error]);

    return (
        <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
            <div className="text-center space-y-4 max-w-md px-6">
                <div className="text-4xl font-black text-red-500">Error</div>
                <p className="text-sm text-muted-foreground">
                    Something went wrong loading this page.
                </p>
                <p className="text-xs text-muted-foreground/60 font-mono bg-secondary/50 border border-border p-3 rounded text-left break-all">
                    {error.message || 'Unknown error'}
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                        onClick={reset}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-foreground text-background hover:bg-foreground/80 transition-colors"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        </div>
    );
}
