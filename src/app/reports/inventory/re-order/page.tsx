'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Search,
    Download,
    RefreshCw,
    AlertCircle,
    ChevronRight,
    Layers,
    Box,
    ShoppingCart,
    Clock,
    CheckCircle2,
    Loader2
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

export default function ReOrderReportPage() {
    const [searchSku, setSearchSku] = useState('');
    const [data, setData] = useState<InventoryRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRebuilding, setIsRebuilding] = useState(false);
    const [lastComputedAt, setLastComputedAt] = useState<string | null>(null);
    const [rebuildStatus, setRebuildStatus] = useState<'idle' | 'running' | 'done'>('idle');

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // ── Instant read from snapshot (reorderOnly=true filters in Mongo via $expr) ──
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/reports/inventory-on-hand?reorderOnly=true');
            const json = await res.json();
            if (json.records) {
                setData(json.records);
                if (json.records[0]?.computedAt) setLastComputedAt(json.records[0].computedAt);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ── Background rebuild ───────────────────────────────────────────────────
    const triggerRebuild = async () => {
        if (isRebuilding) return;
        setIsRebuilding(true);
        setRebuildStatus('running');
        try {
            const res = await fetch('/api/reports/inventory-snapshot/rebuild', { method: 'POST' });
            if (res.ok) {
                setRebuildStatus('done');
                await fetchData();
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

    const filteredData = useMemo(() => {
        return data.filter(item => {
            if (searchSku && !item.name.toLowerCase().includes(searchSku.toLowerCase()) && !item._id.toLowerCase().includes(searchSku.toLowerCase())) return false;
            if (selectedCategory && item.category !== selectedCategory) return false;
            if (selectedSubCategory && item.subCategory !== selectedSubCategory) return false;
            return true;
        });
    }, [data, searchSku, selectedCategory, selectedSubCategory]);

    const { totalLowItems, totalMissingQty, estReorderCost } = useMemo(() => {
        let missingQty = 0, reorderCost = 0;
        data.forEach(item => {
            const needed = Math.max(0, (item.orderUpto || 0) - item.availableQty);
            missingQty += needed;
            reorderCost += needed * (item.avgCost || 0);
        });
        return { totalLowItems: data.length, totalMissingQty: missingQty, estReorderCost: reorderCost };
    }, [data]);

    const fmt = (v: number) => !v ? '$0' : '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const fmt2 = (v: number) => !v ? '$0.00' : '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
            {/* ── Compact Header ── */}
            <div className="shrink-0 bg-background border-b border-border px-6 py-3 z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-widest">
                        <span>Reports</span><span>/</span><span className="text-foreground">Re-Order</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 border border-border rounded-md px-2.5 py-1">
                        <Clock className="w-3 h-3" />
                        <span className="font-semibold">{timeAgo(lastComputedAt)}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text" placeholder="Search SKU..."
                            value={searchSku} onChange={e => setSearchSku(e.target.value)}
                            className="bg-secondary/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500 w-[180px]"
                        />
                    </div>

                    <button
                        onClick={triggerRebuild}
                        disabled={isRebuilding}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all",
                            rebuildStatus === 'done'
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                : "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20",
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
                        <Download className="w-4 h-4" /><span className="hidden sm:inline">Export</span>
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
                                !selectedCategory ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "text-foreground hover:bg-secondary"
                            )}
                        >
                            <Box className="w-4 h-4 opacity-70" /> All Shortages
                        </button>
                        {Object.entries(hierarchy).map(([cat, subs]) => (
                            <div key={cat} className="mb-0.5">
                                <button
                                    onClick={() => { toggleCat(cat); setSelectedCategory(cat); setSelectedSubCategory(null); }}
                                    className={cn("w-full text-left px-3 py-2 text-sm font-bold rounded-md transition-colors flex items-center justify-between group",
                                        selectedCategory === cat && !selectedSubCategory ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "text-foreground hover:bg-secondary"
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
                                                    selectedSubCategory === sub ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                    <div className="flex-1 overflow-y-auto scrollbar-custom p-5">
                        <div className="max-w-[1600px] mx-auto space-y-5">

                            {/* Summary Widgets */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {[
                                    { icon: AlertCircle, label: 'SKUs Below Threshold', value: loading ? '—' : totalLowItems.toString(), color: 'rose' },
                                    { icon: Box, label: 'Total Units Missing', value: loading ? '—' : totalMissingQty.toLocaleString(), color: 'orange' },
                                    { icon: ShoppingCart, label: 'Est. Reorder Value', value: loading ? '—' : fmt(estReorderCost), color: 'amber' },
                                ].map((w, i) => {
                                    const Icon = w.icon;
                                    return (
                                        <div key={i} className={cn("bg-card border rounded-xl p-5 shadow-sm", `border-${w.color}-500/20 bg-${w.color}-500/5`)}>
                                            <div className={cn("text-[11px] font-black uppercase tracking-wider mb-2 flex items-center gap-2", `text-${w.color}-500/70`)}>
                                                <Icon className="w-3.5 h-3.5" />{w.label}
                                            </div>
                                            <div className={cn("text-3xl font-black", `text-${w.color}-600 dark:text-${w.color}-500`)}>{w.value}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Table */}
                            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-orange-500" />
                                        <span className="font-bold text-sm">Low Stock Items</span>
                                        {selectedCategory && (
                                            <span className="px-2 py-0.5 bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[10px] rounded-full font-black uppercase tracking-widest">
                                                {selectedCategory}{selectedSubCategory ? ` › ${selectedSubCategory}` : ''}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs font-bold text-muted-foreground">{loading ? '...' : `${filteredData.length} items`}</span>
                                </div>

                                <div className="overflow-auto max-h-[calc(100vh-350px)] scrollbar-custom">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-48">
                                            <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
                                        </div>
                                    ) : filteredData.length > 0 ? (
                                        <table className="w-full border-collapse text-sm">
                                            <thead className="sticky top-0 z-10 bg-secondary border-b border-border">
                                                <tr>
                                                    <th className="px-5 py-3 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">SKU</th>
                                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">Category</th>
                                                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest">Current Qty</th>
                                                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest border-l border-border/50">Reorder Pt.</th>
                                                    <th className="px-4 py-3 text-center text-[11px] font-black text-indigo-500 tracking-widest bg-indigo-500/5">Order Upto</th>
                                                    <th className="px-4 py-3 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest border-l border-border/50">Missing Qty</th>
                                                    <th className="px-5 py-3 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest">Est. Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/30">
                                                {filteredData.map((sku) => {
                                                    const needed = Math.max(0, (sku.orderUpto || 0) - sku.availableQty);
                                                    const estCost = needed * (sku.avgCost || 0);
                                                    return (
                                                        <tr key={sku._id} className="hover:bg-secondary/30 transition-colors">
                                                            <td className="px-5 py-2.5">
                                                                <div className="font-bold text-foreground">{sku.name}</div>
                                                                <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{sku._id}</div>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <span className="inline-flex bg-secondary/80 border border-border px-2 py-0.5 rounded text-[10px] font-bold text-foreground">{sku.category}</span>
                                                                <div className="text-[10px] text-muted-foreground mt-1">{sku.subCategory}</div>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center">
                                                                <span className={cn("font-black text-sm px-2 py-0.5 rounded", sku.availableQty <= 0 ? "text-rose-500 bg-rose-500/10" : "text-amber-500 bg-amber-500/10")}>
                                                                    {sku.availableQty.toLocaleString()}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-center border-l border-border/50 font-bold text-foreground">{sku.reOrderPoint || 0}</td>
                                                            <td className="px-4 py-2.5 text-center bg-indigo-500/5 font-black text-indigo-600 dark:text-indigo-400">{sku.orderUpto || 0}</td>
                                                            <td className="px-4 py-2.5 text-center border-l border-border/50">
                                                                <span className="font-bold text-orange-500">+{needed.toLocaleString()}</span>
                                                            </td>
                                                            <td className="px-5 py-2.5 text-right">
                                                                <div className="font-black text-foreground">{fmt(estCost)}</div>
                                                                {sku.avgCost > 0 && <div className="text-[9px] text-muted-foreground font-bold">@ {fmt2(sku.avgCost)}/ea</div>}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                                            <AlertCircle className="w-10 h-10 mb-3 opacity-20" />
                                            <p className="text-sm font-bold">{data.length === 0 ? 'No snapshot available.' : 'No SKUs below threshold!'}</p>
                                            <p className="text-xs">{data.length === 0 ? 'Click "Refresh Data" to compute inventory.' : 'All your stock levels look healthy.'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
