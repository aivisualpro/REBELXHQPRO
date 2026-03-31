'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
    Search,
    Calendar,
    Download,
    RefreshCw,
    Package,
    ChevronRight,
    Layers,
    Box,
    Clock,
    CheckCircle2,
    Loader2,
    Zap,
    History
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryRecord {
    _id: string;
    name: string;
    category: string;
    subCategory: string;
    uom: string;
    availableQty: number;
    reOrderPoint: number;
    orderUpto: number;
    avgCost: number;
    totalCost: number;
    computedAt?: string;
}

export default function InventoryOnHandPage() {
    const [searchSku, setSearchSku] = useState('');
    const [data, setData] = useState<InventoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
    const [rebuildStatus, setRebuildStatus] = useState<'idle' | 'running' | 'done'>('idle');
    const [isHistorical, setIsHistorical] = useState(false);

    // Till Date — defaults to today
    const todayStr = new Date().toISOString().split('T')[0];
    const [tillDate, setTillDate] = useState(todayStr);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
    const [highlightedSkuId, setHighlightedSkuId] = useState<string | null>(null);

    // ── Instant read from snapshot (or historical aggregation) ──────────────
    const fetchData = useCallback(async (dateStr?: string) => {
        setLoading(true);
        try {
            const date = dateStr ?? tillDate;
            const url = date !== todayStr
                ? `/api/reports/inventory-on-hand?tillDate=${date}`
                : '/api/reports/inventory-on-hand';
            const res = await fetch(url);
            const json = await res.json();
            if (json.records) {
                setData(json.records);
                setIsHistorical(json.isHistorical ?? false);
                if (json.records[0]?.computedAt) setLastComputedAt(json.records[0].computedAt);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tillDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // After data loads, check if we came back from a SKU detail page
    useEffect(() => {
        if (data.length === 0) return;
        const lastSku = sessionStorage.getItem('lastViewedSku');
        if (!lastSku) return;
        sessionStorage.removeItem('lastViewedSku');
        setHighlightedSkuId(lastSku);
        // Scroll the row into view
        setTimeout(() => {
            document.getElementById(`sku-row-${lastSku}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
        // Clear blink after 3 seconds
        const t = setTimeout(() => setHighlightedSkuId(null), 3000);
        return () => clearTimeout(t);
    }, [data]);

    // When till-date changes, re-fetch
    const handleDateChange = (newDate: string) => {
        setTillDate(newDate);
        fetchData(newDate);
    };

    // ── Background rebuild (runs in Mongo, user doesn't wait) ───────────────
    const triggerRebuild = async () => {
        if (isRebuilding) return;
        setIsRebuilding(true);
        setRebuildStatus('running');
        try {
            const res = await fetch('/api/reports/inventory-snapshot/rebuild', { method: 'POST' });
            if (res.ok) {
                setRebuildStatus('done');
                // Return to today's live snapshot after rebuild
                setTillDate(todayStr);
                await fetchData(todayStr);
                setTimeout(() => setRebuildStatus('idle'), 3000);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRebuilding(false);
        }
    };

    // ── Sidebar hierarchy ────────────────────────────────────────────────────
    const hierarchy = useMemo(() => {
        const tree: Record<string, Set<string>> = {};
        data.forEach(item => {
            const cat = item.category || 'Uncategorized';
            const sub = item.subCategory || 'Uncategorized';
            if (!tree[cat]) tree[cat] = new Set();
            tree[cat].add(sub);
        });
        return tree;
    }, [data]);

    // ── Filtered table data ──────────────────────────────────────────────────
    const filteredData = useMemo(() => {
        return data.filter(item => {
            if (searchSku && !item.name.toLowerCase().includes(searchSku.toLowerCase()) && !item._id.toLowerCase().includes(searchSku.toLowerCase())) return false;
            if (selectedCategory && item.category !== selectedCategory) return false;
            if (selectedSubCategory && item.subCategory !== selectedSubCategory) return false;
            return true;
        });
    }, [data, searchSku, selectedCategory, selectedSubCategory]);

    // ── Summary widgets ──────────────────────────────────────────────────────
    const { totalValue, finishedVal, rawVal, packingVal } = useMemo(() => {
        let total = 0, finished = 0, raw = 0, packing = 0;
        data.forEach(item => {
            const v = item.totalCost || 0;
            total += v;
            if (item.category === 'Finished Goods') finished += v;
            else if (item.category === 'Packaging') packing += v;
            else raw += v;
        });
        return { totalValue: total, finishedVal: finished, rawVal: raw, packingVal: packing };
    }, [data]);

    const fmt = (v: number) => !v ? '$0' : '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const fmt2 = (v: number) => !v ? '$0.00' : '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const pct = (part: number) => totalValue ? Math.round((part / totalValue) * 100) : 0;

    const timeAgo = (d: string | null) => {
        if (!d) return 'Never computed';
        const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
        if (diff < 1) return 'Just now';
        if (diff < 60) return `${diff}m ago`;
        return `${Math.floor(diff / 60)}h ago`;
    };

    const toggleCat = (cat: string) =>
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-background text-foreground overflow-hidden">
            <style>{`
                @keyframes skuRowBlink {
                    0%, 100% { background-color: transparent; }
                    20%, 60% { background-color: rgba(99,102,241,0.18); }
                }
                .sku-row-blink { animation: skuRowBlink 0.55s ease-in-out 5; }
            `}</style>
            {/* ── Compact Header ── */}
            <div className="shrink-0 bg-background border-b border-border px-6 py-3 z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
                        <span>Reports</span><span>/</span><span className="text-foreground">Inventory On Hand</span>
                    </div>
                    {/* Mode badge */}
                    {!loading && (
                        isHistorical ? (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1">
                                <History className="w-3 h-3" />
                                Historical: {tillDate}
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 border border-border rounded-md px-2.5 py-1">
                                <Zap className="w-3 h-3 text-emerald-500" />
                                <span className="font-semibold">Live · {timeAgo(lastComputedAt)}</span>
                            </div>
                        )
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text" placeholder="Search SKU..."
                            value={searchSku} onChange={e => setSearchSku(e.target.value)}
                            className="bg-secondary/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 w-[180px]"
                        />
                    </div>

                    {/* Till Date Picker */}
                    <div className={cn(
                        "flex items-center gap-2 border rounded-lg px-3 py-2 transition-colors",
                        tillDate !== todayStr
                            ? "bg-amber-500/10 border-amber-500/30"
                            : "bg-secondary/50 border-border"
                    )}>
                        <Calendar className={cn("w-4 h-4", tillDate !== todayStr ? "text-amber-500" : "text-muted-foreground")} />
                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider hidden sm:inline">Till:</span>
                        <input
                            type="date"
                            value={tillDate}
                            max={todayStr}
                            onChange={e => handleDateChange(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-foreground cursor-pointer"
                        />
                        {tillDate !== todayStr && (
                            <button
                                onClick={() => handleDateChange(todayStr)}
                                className="text-[10px] font-black text-amber-600 dark:text-amber-400 hover:text-foreground transition-colors uppercase tracking-wider ml-1"
                            >Today
                            </button>
                        )}
                    </div>

                    {/* Refresh / Rebuild */}
                    <button
                        onClick={triggerRebuild}
                        disabled={isRebuilding}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all",
                            rebuildStatus === 'done'
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                : "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20",
                            isRebuilding && "opacity-70 cursor-not-allowed"
                        )}
                    >
                        {rebuildStatus === 'done' ? (
                            <><CheckCircle2 className="w-4 h-4" /> Updated</>
                        ) : isRebuilding ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Computing...</>
                        ) : (
                            <><RefreshCw className="w-4 h-4" /> Refresh Data</>
                        )}
                    </button>

                    <button className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-bold transition-all">
                        <Download className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* ── Left Sidebar ── */}
                <div className="w-[260px] shrink-0 border-r border-border bg-card/30 flex-col h-full overflow-hidden hidden md:flex">
                    <div className="p-4 border-b border-border bg-card/50">
                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" /> Classification
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-custom">
                        <button
                            onClick={() => { setSelectedCategory(null); setSelectedSubCategory(null); }}
                            className={cn("w-full text-left px-3 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 mb-1",
                                !selectedCategory ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-secondary"
                            )}
                        >
                            <Box className="w-4 h-4 opacity-70" /> All Inventory
                        </button>
                        {Object.entries(hierarchy).map(([cat, subs]) => (
                            <div key={cat} className="mb-0.5">
                                <button
                                    onClick={() => { toggleCat(cat); setSelectedCategory(cat); setSelectedSubCategory(null); }}
                                    className={cn("w-full text-left px-3 py-2 text-sm font-bold rounded-md transition-colors flex items-center justify-between group",
                                        selectedCategory === cat && !selectedSubCategory ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-secondary"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expandedCategories[cat] && "rotate-90")} />
                                        <span className="truncate">{cat}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground/50 group-hover:text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded-sm">{Array.from(subs).length}</span>
                                </button>
                                {expandedCategories[cat] && (
                                    <div className="pl-7 pr-2 py-0.5 space-y-0.5 border-l-2 border-border/50 ml-4">
                                        {Array.from(subs).map(sub => (
                                            <button key={sub}
                                                onClick={() => { setSelectedCategory(cat); setSelectedSubCategory(sub); }}
                                                className={cn("w-full text-left px-3 py-1.5 text-xs font-semibold rounded-md transition-colors truncate",
                                                    selectedSubCategory === sub ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                                )}
                                            >{sub}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Main Body ── */}
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Widgets — fixed height strip */}
                    <div className="shrink-0 px-5 pt-4 pb-3">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {[
                                    { label: 'Total Inventory Value', value: fmt(totalValue), pctVal: null, color: 'from-indigo-500 to-blue-600' },
                                    { label: `Finished Goods ${pct(finishedVal)}%`, value: fmt(finishedVal), pctVal: pct(finishedVal), color: 'from-emerald-500 to-teal-600' },
                                    { label: `Raw Material ${pct(rawVal)}%`, value: fmt(rawVal), pctVal: pct(rawVal), color: 'from-amber-500 to-orange-500' },
                                    { label: `Packaging ${pct(packingVal)}%`, value: fmt(packingVal), pctVal: pct(packingVal), color: 'from-purple-500 to-violet-600' },
                                ].map((w, i) => (
                                    <div key={i} className="bg-card border border-border rounded-xl p-4 overflow-hidden relative">
                                        {w.pctVal !== null && (
                                            <div
                                                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${w.color} opacity-10 transition-all duration-700`}
                                                style={{ width: `${w.pctVal}%` }}
                                            />
                                        )}
                                        <div className="relative z-10 text-[10px] font-black uppercase text-muted-foreground tracking-wider mb-2">{w.label}</div>
                                        <div className="relative z-10 text-2xl font-black text-foreground">{loading ? '—' : w.value}</div>
                                    </div>
                                ))}
                        </div>
                    </div>

                    {/* Table — fills remaining height */}
                    <div className="flex-1 min-h-0 flex flex-col mx-5 mb-4 bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-4 h-4 text-indigo-500" />
                                        <span className="font-bold text-sm">Inventory Items</span>
                                        {selectedCategory && (
                                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] rounded-full font-black uppercase tracking-widest">
                                                {selectedCategory}{selectedSubCategory ? ` › ${selectedSubCategory}` : ''}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-muted-foreground">{loading ? '...' : `${filteredData.length} items`}</span>
                                </div>

                        <div className="flex-1 overflow-auto scrollbar-custom">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-48">
                                            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
                                        </div>
                                    ) : filteredData.length > 0 ? (
                                        <table className="w-full border-collapse text-sm">
                                            <thead className="sticky top-0 z-10 bg-secondary border-b border-border">
                                                <tr>
                                                    <th className="px-5 py-3 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">SKU Name</th>
                                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">Category</th>
                                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">Sub Category</th>
                                                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest">Qty</th>
                                                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest">UOM</th>
                                                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest">Avg Cost</th>
                                                    <th className="px-5 py-3 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest">Total Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/30">
                                                {filteredData.map((sku) => (
                                                    <tr
                                                        id={`sku-row-${sku._id}`}
                                                        key={sku._id}
                                                        className={cn(
                                                            'transition-colors',
                                                            highlightedSkuId === sku._id ? 'sku-row-blink' : 'hover:bg-secondary/30'
                                                        )}
                                                    >
                                                        <td className="px-5 py-2.5">
                                                            <Link
                                                                href={`/warehouse/skus/${sku._id}`}
                                                                onClick={() => sessionStorage.setItem('lastViewedSku', sku._id)}
                                                                className="font-bold text-foreground text-sm cursor-pointer hover:underline decoration-muted-foreground/40 underline-offset-2"
                                                            >
                                                                {sku.name}
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span className="inline-flex bg-secondary/80 border border-border px-2 py-0.5 rounded text-[10px] font-bold text-foreground">{sku.category}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-semibold">{sku.subCategory}</td>
                                                        <td className="px-4 py-2.5 text-right">
                                                            <span className={cn("font-black px-2 py-0.5 rounded text-sm", sku.availableQty <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10")}>
                                                                {sku.availableQty.toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-center text-[11px] font-bold text-muted-foreground uppercase">{sku.uom || '—'}</td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-foreground">{fmt2(sku.avgCost)}</td>
                                                        <td className="px-5 py-2.5 text-right font-black text-indigo-600 dark:text-indigo-400">{fmt(sku.totalCost)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                                            <Package className="w-10 h-10 mb-3 opacity-20" />
                                            <p className="text-sm font-bold">No inventory records found.</p>
                                            <p className="text-xs">Try clicking "Refresh Data" to compute the latest snapshot.</p>
                                        </div>
                                    )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
