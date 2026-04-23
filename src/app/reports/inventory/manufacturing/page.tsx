'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { KPIS, SEV_COLORS } from './data';
import { ChevronRight, Loader2 } from 'lucide-react';

/* ── Status color map ─────────────────────────────────────── */
const STATUS_CHIP: Record<string, { bg: string; text: string; border: string }> = {
    'Pending':       { bg: 'bg-yellow-500/15', text: 'text-yellow-500', border: 'border-yellow-500/30' },
    'Processing':    { bg: 'bg-amber-500/15', text: 'text-amber-500', border: 'border-amber-500/30' },
    'Ready to QC':   { bg: 'bg-blue-500/15', text: 'text-blue-500', border: 'border-blue-500/30' },
    'In Progress':   { bg: 'bg-sky-500/15', text: 'text-sky-500', border: 'border-sky-500/30' },
    'On Hold':       { bg: 'bg-orange-500/15', text: 'text-orange-500', border: 'border-orange-500/30' },
    'Cancelled':     { bg: 'bg-rose-500/15', text: 'text-rose-500', border: 'border-rose-500/30' },
};
const getStatusChip = (status: string) => STATUS_CHIP[status] || { bg: 'bg-secondary', text: 'text-muted-foreground', border: 'border-border' };

/* ── Component ───────────────────────────────────────────── */
export default function ManufacturingKPIReport() {
    const [kpis, setKpis] = useState<Record<string, any> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/reports/manufacturing/kpis')
            .then(r => r.json())
            .then(json => { setKpis(json.data || json); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Separate hero KPI from regular ones
    const heroKPI = KPIS.find(k => (k as any).hero);
    const regularKPIs = KPIS.filter(k => !(k as any).hero);

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

                {/* ── Hero KPI Card (Full-width banner) ──────── */}
                {loading ? (
                    <div className="h-40 bg-card border border-border/50 rounded-xl animate-pulse mb-6" />
                ) : heroKPI && kpis ? (() => {
                    const val = kpis[heroKPI.key] ?? 0;
                    const sev = heroKPI.severity(val);
                    const c = SEV_COLORS[sev];
                    const Icon = heroKPI.icon;
                    const statusBreakdown = kpis.unfulfilledStatusBreakdown || [];

                    return (
                        <Link
                            href={`/reports/inventory/manufacturing/${heroKPI.id}`}
                            className={cn(
                                "relative block w-full border-2 rounded-2xl p-6 mb-6 transition-all duration-200 hover:shadow-2xl active:scale-[0.995] group overflow-hidden",
                                sev === 'red' ? 'border-rose-500/60 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent' :
                                sev === 'amber' ? 'border-amber-500/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent' :
                                'border-emerald-500/40 bg-gradient-to-r from-emerald-500/8 via-emerald-500/3 to-transparent'
                            )}
                        >
                            {/* Animated accent line */}
                            <div className={cn(
                                "absolute top-0 left-0 h-1 w-full",
                                sev === 'red' ? 'bg-gradient-to-r from-rose-500 via-rose-400 to-transparent' :
                                sev === 'amber' ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-transparent' :
                                'bg-gradient-to-r from-emerald-500 via-emerald-400 to-transparent'
                            )} />

                            <div className="flex items-center justify-between">
                                {/* Left: Icon + Count + Label */}
                                <div className="flex items-center gap-5">
                                    <div className={cn(
                                        "w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg",
                                        sev === 'red' ? 'bg-rose-500/20 text-rose-500 ring-2 ring-rose-500/30' :
                                        sev === 'amber' ? 'bg-amber-500/20 text-amber-500 ring-2 ring-amber-500/30' :
                                        'bg-emerald-500/20 text-emerald-500 ring-2 ring-emerald-500/30'
                                    )}>
                                        <Icon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <div className={cn("text-5xl font-black tracking-tight", c.value)}>
                                            {val}
                                        </div>
                                        <div className="text-base font-black text-foreground mt-0.5">{heroKPI.label}</div>
                                        <div className="text-xs text-muted-foreground">{heroKPI.desc}</div>
                                    </div>
                                </div>

                                {/* Right: Status breakdown chips */}
                                <div className="flex items-center gap-4">
                                    {statusBreakdown.length > 0 && (
                                        <div className="flex flex-wrap gap-2 justify-end max-w-md">
                                            {statusBreakdown.map((s: any) => {
                                                const chip = getStatusChip(s.status);
                                                return (
                                                    <div
                                                        key={s.status}
                                                        className={cn(
                                                            "flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors",
                                                            chip.bg, chip.border
                                                        )}
                                                    >
                                                        <span className={cn("text-xl font-black", chip.text)}>{s.count}</span>
                                                        <div className="flex flex-col">
                                                            <span className={cn("text-[10px] font-black uppercase tracking-widest leading-tight", chip.text)}>
                                                                {s.status}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground font-medium">
                                                                {(s.totalQty || 0).toLocaleString()} units
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <ChevronRight className={cn(
                                        "w-6 h-6 transition-transform group-hover:translate-x-1",
                                        sev === 'red' ? 'text-rose-500/50' :
                                        sev === 'amber' ? 'text-amber-500/50' :
                                        'text-emerald-500/50'
                                    )} />
                                </div>
                            </div>
                        </Link>
                    );
                })() : null}

                {/* ── KPI Card Grid ──────────────────────────── */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-32 bg-card border border-border/50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : kpis ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-300">
                        {regularKPIs.map(kpi => {
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
