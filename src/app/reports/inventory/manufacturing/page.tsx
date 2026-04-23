'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    ArrowLeft, Download, Search, Loader2, CheckCircle2, AlertTriangle,
    ClipboardList, Trash2, DollarSign, Clock, Users, FileWarning,
    Package, Timer, Activity, BarChart3, Repeat, ShieldAlert, XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── KPI Definitions ─────────────────────────────────────── */
const KPIS: {
    id: string; label: string; desc: string; icon: any; key: string;
    severity: (v: number) => 'red' | 'amber' | 'green';
    cols: { key: string; label: string; w?: string }[];
}[] = [
    {
        id: 'incomplete', label: 'Incomplete MOs', desc: 'Open manufacturing orders',
        icon: ClipboardList, key: 'incomplete',
        severity: v => v > 10 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: 'ageDays', label: 'Age (Days)', w: 'w-24' },
            { key: 'priority', label: 'Priority', w: 'w-24' }, { key: 'qty', label: 'Qty', w: 'w-20' },
            { key: 'scheduledFinish', label: 'Sched. Finish', w: 'w-32' },
        ],
    },
    {
        id: 'scrap', label: 'Wastage / Scrap', desc: 'MOs with scrap recorded',
        icon: Trash2, key: 'scrap',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'scrapQty', label: 'Scrap Qty', w: 'w-24' }, { key: 'scrapPct', label: 'Scrap %', w: 'w-20' },
            { key: 'qty', label: 'Planned Qty', w: 'w-24' }, { key: 'status', label: 'Status', w: 'w-28' },
        ],
    },
    {
        id: 'missingCost', label: 'Missing Cost', desc: 'Fulfilled MOs with zero cost',
        icon: DollarSign, key: 'missingCost',
        severity: v => v > 10 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'qty', label: 'Qty', w: 'w-20' }, { key: 'totalCost', label: 'Total Cost', w: 'w-24' },
            { key: 'createdAt', label: 'Completed', w: 'w-28' },
        ],
    },
    {
        id: 'laborAnomalies', label: 'Labor Anomalies', desc: 'Same-SKU labor hour outliers',
        icon: Users, key: 'laborAnomalies',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'laborHours', label: 'Labor Hrs', w: 'w-24' }, { key: 'skuMedian', label: 'Median', w: 'w-20' },
            { key: 'p25', label: 'P25', w: 'w-16' }, { key: 'p75', label: 'P75', w: 'w-16' },
            { key: 'deviationPct', label: 'Dev %', w: 'w-20' },
        ],
    },
    {
        id: 'costOutliers', label: 'Cost/Unit Outliers', desc: 'Same-SKU cost deviations',
        icon: BarChart3, key: 'costOutliers',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'costPerUnit', label: 'Cost/Unit', w: 'w-24' }, { key: 'skuMedian', label: 'Median', w: 'w-24' },
            { key: 'deviationPct', label: 'Dev %', w: 'w-20' }, { key: 'totalCost', label: 'Total Cost', w: 'w-24' },
        ],
    },
    {
        id: 'overdue', label: 'Overdue MOs', desc: 'Past scheduled finish date',
        icon: Timer, key: 'overdue',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'daysOverdue', label: 'Days Overdue', w: 'w-28' }, { key: 'qty', label: 'Qty', w: 'w-20' },
            { key: 'priority', label: 'Priority', w: 'w-24' }, { key: 'status', label: 'Status', w: 'w-28' },
        ],
    },
    {
        id: 'noBom', label: 'No BOM / Recipe', desc: 'MOs without linked recipe',
        icon: FileWarning, key: 'noBom',
        severity: v => v > 0 ? 'red' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: 'createdAt', label: 'Created', w: 'w-28' },
            { key: 'createdBy', label: 'Created By', w: 'w-28' },
        ],
    },
    {
        id: 'unreserved', label: 'Component Shortages', desc: 'Open MOs with unassigned lots',
        icon: Package, key: 'unreserved',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: 'qty', label: 'Qty', w: 'w-20' },
            { key: '_missing', label: 'Missing Components' },
        ],
    },
    {
        id: 'operatorDiscrepancies', label: 'Operator Overlaps', desc: 'Same operator on 2+ MOs same day',
        icon: ShieldAlert, key: 'operatorDiscrepancies',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'operator', label: 'Operator', w: 'w-32' }, { key: 'date', label: 'Date', w: 'w-28' },
            { key: '_mos', label: 'Work Orders' },
        ],
    },
    {
        id: 'yieldVariance', label: 'Yield Variance', desc: 'Output differs from planned qty',
        icon: Activity, key: 'yieldVariance',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'planned', label: 'Planned', w: 'w-20' }, { key: 'actual', label: 'Actual', w: 'w-20' },
            { key: 'variancePct', label: 'Variance %', w: 'w-24' }, { key: 'scrapQty', label: 'Scrap', w: 'w-20' },
        ],
    },
    {
        id: 'noValuation', label: 'Valuation Missing', desc: 'Labor logged but cost not posted',
        icon: XCircle, key: 'noValuation',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'qty', label: 'Qty', w: 'w-20' }, { key: 'laborCost', label: 'Labor Cost', w: 'w-24' },
            { key: 'totalCost', label: 'Total Cost', w: 'w-24' }, { key: 'createdAt', label: 'Created', w: 'w-28' },
        ],
    },
    {
        id: 'reworkLoops', label: 'Rework Loops', desc: 'Same SKU used twice in one MO',
        icon: Repeat, key: 'reworkLoops',
        severity: v => v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: '_dupes', label: 'Duplicate Components' },
        ],
    },
];

const SEV_COLORS = {
    red: { border: 'border-rose-500/60', bg: 'bg-rose-500/8', icon: 'bg-rose-500/20 text-rose-500', value: 'text-rose-500', dot: 'bg-rose-500' },
    amber: { border: 'border-amber-500/60', bg: 'bg-amber-500/8', icon: 'bg-amber-500/20 text-amber-500', value: 'text-amber-400', dot: 'bg-amber-500' },
    green: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', icon: 'bg-emerald-500/20 text-emerald-500', value: 'text-emerald-500', dot: 'bg-emerald-500' },
};

/* ── Component ───────────────────────────────────────────── */
export default function ManufacturingKPIReport() {
    const [kpis, setKpis] = useState<Record<string, number> | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeDrilldown, setActiveDrilldown] = useState<string | null>(null);
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [drilldownLoading, setDrilldownLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortCol, setSortCol] = useState('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        fetch('/api/reports/manufacturing/kpis')
            .then(r => r.json())
            .then(json => { setKpis(json.data || json); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const openDrilldown = async (kpiId: string) => {
        setActiveDrilldown(kpiId);
        setDrilldownLoading(true);
        setSearchTerm('');
        setSortCol('');
        try {
            const r = await fetch(`/api/reports/manufacturing/kpis?drilldown=${kpiId}`);
            const json = await r.json();
            setDrilldownData(json.data || []);
        } catch { setDrilldownData([]); }
        setDrilldownLoading(false);
    };

    const activeKPI = KPIS.find(k => k.id === activeDrilldown);

    const filteredData = useMemo(() => {
        let d = [...drilldownData];
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            d = d.filter(r => JSON.stringify(r).toLowerCase().includes(q));
        }
        if (sortCol) {
            d.sort((a, b) => {
                const av = a[sortCol], bv = b[sortCol];
                const cmp = typeof av === 'number' ? av - bv : String(av || '').localeCompare(String(bv || ''));
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return d;
    }, [drilldownData, searchTerm, sortCol, sortDir]);

    const exportCSV = () => {
        if (!activeKPI || !filteredData.length) return;
        const keys = activeKPI.cols.map(c => c.key).filter(k => !k.startsWith('_'));
        const header = activeKPI.cols.filter(c => !c.key.startsWith('_')).map(c => c.label).join(',');
        const rows = filteredData.map(r => keys.map(k => {
            let v = r[k];
            if (k === 'createdAt' || k === 'scheduledFinish') v = v ? new Date(v).toLocaleDateString() : '';
            return `"${String(v || '').replace(/"/g, '""')}"`;
        }).join(','));
        const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${activeKPI.id}_export.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    const toggleSort = (col: string) => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('desc'); }
    };

    const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';
    const fmtVal = (key: string, val: any) => {
        if (key === 'createdAt' || key === 'scheduledFinish') return fmtDate(val);
        if (val === null || val === undefined) return '—';
        return String(val);
    };

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
                        {activeDrilldown ? (
                            <>
                                <button onClick={() => setActiveDrilldown(null)} className="hover:text-foreground transition-colors">Manufacturing</button>
                                <span>/</span>
                                <span className="text-foreground">{activeKPI?.label}</span>
                            </>
                        ) : (
                            <span className="text-foreground">Manufacturing</span>
                        )}
                    </div>
                </div>

                {/* ── KPI Card Grid ──────────────────────────── */}
                {!activeDrilldown && (
                    <>
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
                                        <button
                                            key={kpi.id}
                                            onClick={() => openDrilldown(kpi.id)}
                                            className={cn(
                                                "relative text-left border rounded-xl p-5 transition-all duration-200 hover:shadow-lg active:scale-[0.98] group",
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
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground py-20">Failed to load KPI data.</div>
                        )}
                    </>
                )}

                {/* ── Drill-down View ────────────────────────── */}
                {activeDrilldown && activeKPI && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-200">
                        <button
                            onClick={() => setActiveDrilldown(null)}
                            className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" /> Back to KPI Overview
                        </button>

                        {/* Drill-down Header */}
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", SEV_COLORS[activeKPI.severity(kpis?.[activeKPI.key] ?? 0)].icon)}>
                                    <activeKPI.icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-foreground">{activeKPI.label}</h2>
                                    <p className="text-xs text-muted-foreground">{filteredData.length} records</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                                        placeholder="Search..."
                                        className="bg-secondary border border-border text-xs font-medium pl-8 pr-3 py-2 rounded-lg w-52 outline-none focus:border-foreground/30 transition-colors"
                                    />
                                </div>
                                <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 bg-secondary border border-border text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors">
                                    <Download className="w-3.5 h-3.5" /> CSV
                                </button>
                            </div>
                        </div>

                        {/* Drill-down Table */}
                        {drilldownLoading ? (
                            <div className="flex items-center justify-center py-20">
                                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                            </div>
                        ) : filteredData.length === 0 ? (
                            <div className="bg-card border border-emerald-500/30 rounded-xl p-12 flex flex-col items-center justify-center text-center">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-3" />
                                <h3 className="text-sm font-black text-foreground">No issues detected</h3>
                                <p className="text-xs text-muted-foreground mt-1">This KPI is healthy for the current date range.</p>
                            </div>
                        ) : (
                            <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-border/50 bg-secondary/50">
                                                {activeKPI.cols.map(col => (
                                                    <th
                                                        key={col.key}
                                                        onClick={() => !col.key.startsWith('_') && toggleSort(col.key)}
                                                        className={cn(
                                                            "text-left px-4 py-3 font-bold uppercase tracking-wider text-muted-foreground select-none",
                                                            !col.key.startsWith('_') && "cursor-pointer hover:text-foreground",
                                                            col.w
                                                        )}
                                                    >
                                                        {col.label}
                                                        {sortCol === col.key && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/30">
                                            {filteredData.map((row, i) => (
                                                <tr key={i} className="hover:bg-secondary/30 transition-colors">
                                                    {activeKPI.cols.map(col => (
                                                        <td key={col.key} className={cn("px-4 py-3 text-foreground", col.w)}>
                                                            {col.key === 'label' ? (
                                                                <Link href={`/warehouse/manufacturing/${row._id}`} className="font-bold text-blue-400 hover:underline">
                                                                    {row.label || row._id?.toString().slice(-6)}
                                                                </Link>
                                                            ) : col.key === 'status' ? (
                                                                <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase border",
                                                                    row.status === 'Fulfilled' ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
                                                                    : row.status === 'Processing' ? 'bg-amber-500/20 text-amber-500 border-amber-500/30'
                                                                    : row.status === 'Ready to QC' ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
                                                                    : 'bg-secondary text-muted-foreground border-border'
                                                                )}>
                                                                    {row.status}
                                                                </span>
                                                            ) : col.key === 'priority' ? (
                                                                <span className={cn("text-[10px] font-black uppercase",
                                                                    row.priority === 'Extreme' ? 'text-rose-500' : row.priority === 'High' ? 'text-amber-500' : 'text-muted-foreground'
                                                                )}>
                                                                    {row.priority}
                                                                </span>
                                                            ) : col.key === '_missing' ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {(row.missingComponents || []).slice(0, 3).map((c: any, j: number) => (
                                                                        <span key={j} className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded border border-rose-500/20">
                                                                            {c.skuName}
                                                                        </span>
                                                                    ))}
                                                                    {(row.missingComponents || []).length > 3 && <span className="text-muted-foreground">+{row.missingComponents.length - 3}</span>}
                                                                </div>
                                                            ) : col.key === '_mos' ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {(row.moLabels || row.moIds || []).slice(0, 4).map((lbl: string, j: number) => (
                                                                        <Link key={j} href={`/warehouse/manufacturing/${row.moIds?.[j] || ''}`} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded border border-blue-500/20 hover:underline">
                                                                            {lbl}
                                                                        </Link>
                                                                    ))}
                                                                </div>
                                                            ) : col.key === '_dupes' ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {(row.duplicateSkus || []).map((d: any, j: number) => (
                                                                        <span key={j} className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold rounded border border-amber-500/20">
                                                                            {d.skuName} x{d.occurrences}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : col.key === 'deviationPct' ? (
                                                                <span className={cn("font-black", parseFloat(row[col.key]) > 0 ? 'text-rose-400' : 'text-emerald-400')}>
                                                                    {row[col.key]}%
                                                                </span>
                                                            ) : col.key === 'variancePct' || col.key === 'scrapPct' ? (
                                                                <span className="font-bold">{row[col.key]}%</span>
                                                            ) : (
                                                                fmtVal(col.key, row[col.key])
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
