'use client';

import React, { useState, useEffect, useMemo, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KPIS, SEV_COLORS } from '../data';

export default function ManufacturingKPIDrilldown({ params }: { params: Promise<{ kpi: string }> }) {
    const { kpi: kpiId } = use(params);
    const activeKPI = KPIS.find(k => k.id === kpiId);

    const [kpis, setKpis] = useState<Record<string, number> | null>(null);
    const [drilldownData, setDrilldownData] = useState<any[]>([]);
    const [drilldownLoading, setDrilldownLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortCol, setSortCol] = useState('');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        // Fetch overall KPIs just to get the severity value
        fetch('/api/reports/manufacturing/kpis')
            .then(r => r.json())
            .then(json => setKpis(json.data || json))
            .catch(() => {});

        // Fetch drilldown data
        fetch(`/api/reports/manufacturing/kpis?drilldown=${kpiId}`)
            .then(r => r.json())
            .then(json => {
                setDrilldownData(json.data || []);
                setDrilldownLoading(false);
            })
            .catch(() => {
                setDrilldownData([]);
                setDrilldownLoading(false);
            });
    }, [kpiId]);

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

    if (!activeKPI) {
        return <div className="p-10 text-center text-muted-foreground">KPI not found.</div>;
    }

    const Icon = activeKPI.icon;

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
                        <Link href="/reports/inventory/manufacturing" className="hover:text-foreground transition-colors">Manufacturing</Link>
                        <span>/</span>
                        <span className="text-foreground">{activeKPI.label}</span>
                    </div>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <Link
                        href="/reports/inventory/manufacturing"
                        className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-fit"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to KPI Overview
                    </Link>

                    {/* Drill-down Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", SEV_COLORS[activeKPI.severity(kpis?.[activeKPI.key] ?? 0)].icon)}>
                                <Icon className="w-5 h-5" />
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
            </div>
        </div>
    );
}
