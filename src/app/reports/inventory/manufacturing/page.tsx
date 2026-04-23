'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { KPIS, SEV_COLORS } from './data';

/* ── Component ───────────────────────────────────────────── */
export default function ManufacturingKPIReport() {
    const [kpis, setKpis] = useState<Record<string, number> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/reports/manufacturing/kpis')
            .then(r => r.json())
            .then(json => { setKpis(json.data || json); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    /* ── Render ─────────────────────────────────────────── */
    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-background text-foreground overflow-y-auto scrollbar-custom">
            <div className="w-full p-4">

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        <Link href="/reports/inventory" className="hover:text-foreground transition-colors">Reports</Link>
                        <span>/</span>
                        <Link href="/reports/inventory" className="hover:text-foreground transition-colors">Inventory</Link>
                        <span>/</span>
                        <span className="text-foreground">Manufacturing</span>
                    </div>
                </div>

                {/* ── KPI Card Grid ──────────────────────────── */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-32 bg-card border border-border/50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : kpis ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
                        {KPIS.map(kpi => {
                            const val = kpis[kpi.key] ?? 0;
                            const sev = kpi.severity(val);
                            const c = SEV_COLORS[sev];
                            const Icon = kpi.icon;
                            return (
                                <Link
                                    key={kpi.id}
                                    href={`/reports/inventory/manufacturing/${kpi.id}`}
                                    className={cn(
                                        "relative text-left border rounded-xl p-5 transition-all duration-200 hover:shadow-lg active:scale-[0.98] group block",
                                        c.border, c.bg
                                    )}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", c.icon)}>
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <div className={cn("w-2.5 h-2.5 rounded-full mt-1", c.dot)} />
                                    </div>
                                    <div className={cn("text-3xl font-black mb-1", c.value)}>{val}</div>
                                    <div className="text-sm font-bold text-foreground">{kpi.label}</div>
                                    <div className="text-[11px] text-muted-foreground">{kpi.desc}</div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-20">Failed to load KPI data.</div>
                )}
            </div>
        </div>
    );
}
