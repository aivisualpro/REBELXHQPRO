'use client';

import { useEffect } from 'react';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Global error:', error);
    }, [error]);

    return (
        <html>
            <body style={{ margin: 0, padding: 0, background: '#0a0a0a', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                    <div style={{ textAlign: 'center', maxWidth: '400px', padding: '24px' }}>
                        <div style={{ fontSize: '48px', fontWeight: 900, color: '#ef4444', marginBottom: '16px' }}>Error</div>
                        <p style={{ fontSize: '14px', color: '#a1a1aa', marginBottom: '12px' }}>
                            A critical error occurred.
                        </p>
                        <p style={{ fontSize: '11px', color: '#71717a', fontFamily: 'monospace', background: '#18181b', border: '1px solid #27272a', padding: '12px', borderRadius: '6px', textAlign: 'left', wordBreak: 'break-all', marginBottom: '20px' }}>
                            {error.message || 'Unknown error'}
                        </p>
                        <button
                            onClick={reset}
                            style={{ padding: '8px 20px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', background: '#fafafa', color: '#0a0a0a', border: 'none', cursor: 'pointer' }}
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
