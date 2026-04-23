'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Package,
    Loader2,
    ExternalLink,
    Search,
    Layers,
    ShoppingCart,
    ChevronRight,
    Hash,
    DollarSign,
    ArrowUpRight,
    CircleDollarSign,
    Zap,
    AlertTriangle,
    Filter,
    Check,
    ChevronDown,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const formatTitleCase = (str: string) => {
    if (!str) return '';
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
};

interface SkuGroupSummary {
    skuId: string;
    name: string;
    category: string;
    uom: string;
    count: number;
    totalQty: number;
    totalValue: number;
    types?: Record<string, { count: number; totalQty: number; totalValue: number }>;
}

interface Summary {
    totalSkus: number;
    totalItems: number;
    totalQty: number;
    totalValue: number;
}

interface DetailItem {
    id: string;
    source: 'Web Order' | 'Sale Order';
    orderId: string;
    lineItemId?: number;
    orderNumber: string;
    website?: string;
    status: string;
    date: string;
    lotNumber: string;
    cost: number;
    quantity: number;
    total: number;
    link: string;
}

type TypeFilter = string;

const WEBSITE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'KINGKKRATOM': { bg: 'bg-amber-500/15', text: 'text-amber-500', border: 'border-amber-500/30' },
    'GRASSROOTSHARVEST': { bg: 'bg-emerald-500/15', text: 'text-emerald-500', border: 'border-emerald-500/30' },
    'GRHKTATOM': { bg: 'bg-blue-500/15', text: 'text-blue-500', border: 'border-blue-500/30' },
    'GUDTONICS': { bg: 'bg-cyan-500/15', text: 'text-cyan-500', border: 'border-cyan-500/30' },
    'REBELXBRANDS': { bg: 'bg-purple-500/15', text: 'text-purple-500', border: 'border-purple-500/30' },
};

const STATUS_COLORS: Record<string, string> = {
    'completed': 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30',
    'Completed': 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30',
    'processing': 'bg-blue-500 text-white',
    'Processing': 'bg-blue-500 text-white',
    'pending': 'bg-yellow-500 text-white',
    'Pending': 'bg-yellow-500 text-white',
    'on-hold': 'bg-amber-500 text-white',
    'Picking': 'bg-sky-500 text-white',
    'Shipped': 'bg-indigo-500 text-white',
    'shipped': 'bg-indigo-500 text-white',
};

const formatCurrency = (val: number) => {
    if (!val && val !== 0) return '-';
    return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getItemTypeLabel = (item: DetailItem) => {
    if (item.source === 'Web Order' && item.website) {
        return item.website as string;
    }
    return item.source;
};

// ── Wrapper with Suspense boundary for useSearchParams ──
export default function MissingCostPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col h-[calc(100vh-48px)] bg-background items-center justify-center">
                <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Loading...</p>
            </div>
        }>
            <MissingCostContent />
        </Suspense>
    );
}

function MissingCostContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [groups, setGroups] = useState<SkuGroupSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSkuId, setSelectedSkuId] = useState<string | null>(searchParams.get('skuId') || null);
    const [sidebarSearch, setSidebarSearch] = useState(searchParams.get('search') || '');
    const [typeFilters, setTypeFilters] = useState<string[]>(() => {
        const t = searchParams.get('type');
        if (!t || t === 'all') return [];
        return t.split(',').filter(Boolean);
    });

    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsTypeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync state → URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (selectedSkuId) params.set('skuId', selectedSkuId);
        if (sidebarSearch) params.set('search', sidebarSearch);
        if (typeFilters.length > 0) params.set('type', typeFilters.join(','));

        const qs = params.toString();
        const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}`;
        if (window.location.search.replace(/^\?/, '') !== qs) {
            router.replace(newUrl, { scroll: false });
        }
    }, [selectedSkuId, sidebarSearch, typeFilters, router]);

    // Detail state (lazy-loaded per SKU)
    const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Apply state — per-SKU only, no modal
    const [isApplying, setIsApplying] = useState(false);
    const [applyFixed, setApplyFixed] = useState<number | null>(null);



    const runApply = useCallback(async (skuId: string) => {
        setIsApplying(true);
        setApplyFixed(null);
        try {
            const res = await fetch('/api/reports/missing-cost/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skuId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Apply failed');

            const fixed = data.stats?.totalFixed ?? 0;
            setApplyFixed(fixed);

            // Live-remove resolved rows using the returned order IDs
            if (data.resolvedOrderIds?.length) {
                const resolvedSet = new Set<string>(data.resolvedOrderIds);
                
                setDetailItems(prev => {
                    let removedQty = 0;
                    let removedValue = 0;
                    const remaining = [];
                    
                    for (const item of prev) {
                        if (resolvedSet.has(item.orderId)) {
                            removedQty += item.quantity || 0;
                            removedValue += item.total || 0;
                        } else {
                            remaining.push(item);
                        }
                    }

                    // If rows resolved, remove SKU counts, qty, and value from sidebar
                    if (fixed > 0) {
                        setGroups(prevGroups => {
                            return prevGroups.map(g =>
                                g.skuId === skuId ? { 
                                    ...g, 
                                    count: Math.max(0, g.count - fixed),
                                    totalQty: Math.max(0, g.totalQty - removedQty),
                                    totalValue: Math.max(0, g.totalValue - removedValue)
                                } : g
                            ).filter(g => g.count > 0);
                        });
                    }

                    return remaining;
                });
            }

            // Clear the fixed counter after 3s
            setTimeout(() => setApplyFixed(null), 3000);
        } catch (e: any) {
            console.error('Apply failed:', e);
        } finally {
            setIsApplying(false);
        }
    }, []);

    // ── Load sidebar summary ──
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/reports/missing-cost');
                if (res.ok) {
                    const json = await res.json();
                    const payload = json.data || json;
                    setGroups(payload.groups || []);
                    // Only auto-select first SKU if none was provided via URL
                    if (!selectedSkuId && payload.groups?.length > 0) {
                        setSelectedSkuId(payload.groups[0].skuId);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch missing-cost data:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Load detail items when SKU changes ──
    const loadSkuDetail = useCallback(async (skuId: string) => {
        try {
            setDetailLoading(true);
            setDetailItems([]);
            const res = await fetch(`/api/reports/missing-cost?skuId=${skuId}`);
            if (res.ok) {
                const json = await res.json();
                const payload = json.data || json;
                setDetailItems(payload.items || []);
            }
        } catch (e) {
            console.error('Failed to fetch SKU detail:', e);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedSkuId) {
            loadSkuDetail(selectedSkuId);
        }
    }, [selectedSkuId, loadSkuDetail]);

    // Filter detail items by type
    const filteredDetailItems = useMemo(() => {
        if (typeFilters.length === 0) return detailItems;
        return detailItems.filter(i => typeFilters.includes(getItemTypeLabel(i)));
    }, [detailItems, typeFilters]);


    const displayedTypes = useMemo(() => {
        const types = new Set<string>();
        // Add any currently selected filters so they don't disappear while active
        typeFilters.forEach(t => types.add(t));
        // Add all types that actually exist in the global groups
        groups.forEach(g => {
            if (g.types) {
                Object.keys(g.types).forEach(t => types.add(t));
            }
        });
        return Array.from(types).sort();
    }, [groups, typeFilters]);

    // Filter sidebar by search and type filters
    const filteredGroups = useMemo(() => {
        let currentGroups = groups;

        // Apply type filters
        if (typeFilters.length > 0) {
            currentGroups = groups.map(g => {
                let filteredCount = 0;
                let filteredQty = 0;
                let filteredValue = 0;
                
                for (const t of typeFilters) {
                    if (g.types && g.types[t]) {
                        filteredCount += g.types[t].count;
                        filteredQty += g.types[t].totalQty;
                        filteredValue += g.types[t].totalValue;
                    }
                }
                
                return {
                    ...g,
                    count: filteredCount,
                    totalQty: filteredQty,
                    totalValue: filteredValue
                };
            }).filter(g => g.count > 0);
        }

        if (!sidebarSearch.trim()) return currentGroups;
        const q = sidebarSearch.toLowerCase();
        return currentGroups.filter(g =>
            g.name.toLowerCase().includes(q) ||
            g.category?.toLowerCase().includes(q)
        );
    }, [groups, typeFilters, sidebarSearch]);

    // Derive global summary dynamically from filteredGroups so it stays in sync
    const summary = useMemo<Summary | null>(() => {
        if (!filteredGroups || filteredGroups.length === 0) return null;
        return {
            totalSkus: filteredGroups.length,
            totalItems: filteredGroups.reduce((s, g) => s + g.count, 0),
            totalQty: filteredGroups.reduce((s, g) => s + g.totalQty, 0),
            totalValue: filteredGroups.reduce((s, g) => s + g.totalValue, 0),
        };
    }, [filteredGroups]);

    // Get selected group summary
    const selectedGroupSummary = useMemo(() => {
        if (!selectedSkuId) return null;
        if (selectedSkuId === 'all') {
            return {
                skuId: 'all',
                name: 'All SKUs',
                category: 'MIXED',
                uom: '',
                count: summary?.totalItems || 0,
                totalQty: summary?.totalQty || 0,
                totalValue: summary?.totalValue || 0,
            };
        }
        return filteredGroups.find(g => g.skuId === selectedSkuId) || null;
    }, [filteredGroups, selectedSkuId, summary]);

    // Check if there are any records that can actually receive a cost application
    const hasApplicableRecords = useMemo(() => {
        if (detailLoading || !selectedGroupSummary) return false;
        return filteredDetailItems.some(i => !['Purchase Order', 'Opening Balance', 'Manufacturing'].includes(getItemTypeLabel(i)));
    }, [filteredDetailItems, detailLoading, selectedGroupSummary]);

    // ── Loading State ──
    if (loading) {
        return (
            <div className="flex flex-col h-[calc(100vh-48px)] bg-background items-center justify-center">
                <div className="relative">
                    <div className="absolute inset-0 bg-rose-500/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="w-10 h-10 text-rose-500 animate-spin relative z-10" />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                    Analyzing Cost Gaps...
                </p>
            </div>
        );
    }

    // ── Empty State ──
    if (!groups.length) {
        return (
            <div className="flex flex-col h-[calc(100vh-48px)] bg-background items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <DollarSign className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-lg font-black text-foreground mb-1">All Clear!</h2>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                    No transactions with missing cost found
                </p>
            </div>
        );
    }

    // Type filter counts are handled dynamically now

    return (
        <>
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">

            {/* ── Summary Stats Bar ── */}
            <div className="shrink-0 border-b border-border bg-background px-4">
                <div className="flex items-center justify-between h-12">
                    <div className="flex items-center gap-6 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-2 shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center">
                                <CircleDollarSign className="w-3.5 h-3.5 text-rose-500" />
                            </div>
                            <h1 className="text-sm font-black uppercase tracking-widest text-foreground">Missing Cost</h1>
                        </div>
                        <div className="h-5 w-px bg-border shrink-0" />
                        {summary && (
                            <>
                                <StatChip icon={Layers} label="SKUs" value={summary.totalSkus} color="rose" />
                                <StatChip icon={Hash} label="Records" value={summary.totalItems.toLocaleString()} color="blue" />
                                <StatChip icon={ShoppingCart} label="Total Qty" value={summary.totalQty.toLocaleString()} color="purple" />
                                <StatChip icon={DollarSign} label="Value" value={formatCurrency(summary.totalValue)} color="emerald" />
                            </>
                        )}
                    </div>
                    
                    {/* Global Type Filter Dropdown */}
                    <div className="relative shrink-0" ref={dropdownRef}>
                        <button
                            onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 border border-border rounded-md transition-colors"
                        >
                            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs font-bold text-foreground">
                                {typeFilters.length === 0 ? 'All Types' : `${typeFilters.length} Selected`}
                            </span>
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>

                        {isTypeDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-56 bg-background border border-border rounded-md shadow-lg z-50 overflow-hidden flex flex-col">
                                <div className="p-2 border-b border-border bg-secondary flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filter by Type</span>
                                    {typeFilters.length > 0 && (
                                        <button 
                                            onClick={() => setTypeFilters([])}
                                            className="text-[9px] font-bold text-rose-500 hover:text-rose-400 uppercase tracking-wider"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-64 overflow-y-auto p-1 scrollbar-custom">
                                    {displayedTypes.map(type => {
                                        const isSelected = typeFilters.includes(type);
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setTypeFilters(prev => 
                                                        prev.includes(type) 
                                                            ? prev.filter(t => t !== type)
                                                            : [...prev, type]
                                                    );
                                                }}
                                                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-secondary rounded-md transition-colors text-left group"
                                            >
                                                <span className={cn(
                                                    "text-xs font-bold truncate",
                                                    isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                                )}>
                                                    {type}
                                                </span>
                                                <div className={cn(
                                                    "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                                    isSelected ? "bg-rose-500 border-rose-500" : "border-border"
                                                )}>
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── Left Sidebar: SKU List ── */}
                <div className="w-[450px] border-r border-border bg-background flex flex-col overflow-hidden shrink-0">
                    <div className="p-2 border-b border-border shrink-0">
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search SKUs..."
                                value={sidebarSearch}
                                onChange={e => setSidebarSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-rose-500/30 focus:border-rose-500/50 text-foreground placeholder:text-muted-foreground transition-colors"
                            />
                        </div>
                        <div className="flex items-center gap-3 px-3 mt-3">
                            <div className="w-6 shrink-0"></div>
                            <div className="flex-1 min-w-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">SKU</span>
                            </div>
                            <div className="w-14 text-right pr-6 shrink-0">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Records</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-custom">
                        {/* All Option */}
                        <button
                            onClick={() => setSelectedSkuId('all')}
                            className={cn(
                                "w-full text-left px-3 py-2.5 border-b border-border transition-all group relative",
                                selectedSkuId === 'all'
                                    ? "bg-rose-500/10 border-l-2 border-l-rose-500"
                                    : "hover:bg-secondary border-l-2 border-l-transparent"
                            )}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className={cn(
                                    "w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black",
                                    selectedSkuId === 'all' ? "bg-rose-500 text-white" : "bg-secondary text-muted-foreground"
                                )}>
                                    <Layers className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={cn(
                                        "text-xs font-bold leading-tight truncate",
                                        selectedSkuId === 'all' ? "text-foreground" : "text-foreground/80"
                                    )}>
                                        All SKUs
                                    </div>
                                </div>
                                <div className="w-14 text-right pr-2 shrink-0 flex items-center justify-end gap-2">
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-wider",
                                        selectedSkuId === 'all' ? "text-rose-500" : "text-muted-foreground"
                                    )}>
                                        {summary?.totalItems || 0}
                                    </span>
                                    <ChevronRight className={cn(
                                        "w-3.5 h-3.5 shrink-0 transition-transform",
                                        selectedSkuId === 'all' ? "text-rose-500 translate-x-0.5" : "text-muted-foreground/50"
                                    )} />
                                </div>
                            </div>
                        </button>
                        {filteredGroups.map((group, idx) => {
                            const isSelected = selectedSkuId === group.skuId;
                            return (
                                <button
                                    key={group.skuId}
                                    onClick={() => setSelectedSkuId(group.skuId)}
                                    className={cn(
                                        "w-full text-left px-3 py-2.5 border-b border-border transition-all group relative",
                                        isSelected
                                            ? "bg-rose-500/10 border-l-2 border-l-rose-500"
                                            : "hover:bg-secondary border-l-2 border-l-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3 w-full pl-9">
                                        <div className="flex-1 min-w-0">
                                            <div className={cn(
                                                "text-xs font-bold leading-tight line-clamp-2",
                                                isSelected ? "text-foreground" : "text-foreground/80"
                                            )}>
                                                {group.name}
                                            </div>
                                        </div>
                                        <div className="w-14 text-right pr-2 shrink-0 flex items-center justify-end gap-2">
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-wider",
                                                isSelected ? "text-rose-500" : "text-muted-foreground"
                                            )}>
                                                {group.count}
                                            </span>
                                            <ChevronRight className={cn(
                                                "w-3.5 h-3.5 shrink-0 transition-transform",
                                                isSelected ? "text-rose-500 translate-x-0.5" : "text-muted-foreground/50"
                                            )} />
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                        {filteredGroups.length === 0 && (
                            <div className="p-4 text-center">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">No SKUs found</p>
                            </div>
                        )}
                    </div>
                    <div className="p-2 border-t border-border bg-secondary shrink-0">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                            {filteredGroups.length} of {groups.length} SKUs
                        </div>
                    </div>
                </div>

                {/* ── Right Content: Transaction Ledger ── */}
                <div className="flex-1 bg-background flex flex-col overflow-hidden">
                    {selectedGroupSummary ? (
                        <>
                            {/* SKU Header — SOLID */}
                            <div className="shrink-0 border-b border-border bg-background px-4">
                                <div className="flex items-center justify-between h-12">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                                            <Package className="w-4 h-4 text-rose-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black text-foreground leading-tight line-clamp-1">
                                                {selectedGroupSummary.name}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {selectedGroupSummary.category && (
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                                        {selectedGroupSummary.category}
                                                    </span>
                                                )}
                                                {selectedGroupSummary.category && <span className="text-[9px] font-bold text-muted-foreground">·</span>}
                                                <span className="text-[9px] font-black uppercase tracking-widest text-rose-500">
                                                    {selectedGroupSummary.count} missing cost
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">

                                        {/* ✨ Apply This SKU button */}
                                        {hasApplicableRecords && (
                                            <button
                                                id="btn-apply-sku-cost"
                                                onClick={() => runApply(selectedGroupSummary.skuId)}
                                                disabled={isApplying}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-violet-500/15 hover:bg-violet-500/25 disabled:opacity-60 disabled:cursor-not-allowed text-violet-400 text-xs font-bold transition-colors border border-violet-500/20"
                                            >
                                                {isApplying ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <Zap className="w-3 h-3" />
                                                )}
                                                <span>
                                                    {isApplying
                                                        ? 'Applying...'
                                                        : applyFixed !== null
                                                            ? `✓ Fixed ${applyFixed}`
                                                            : 'Apply Costs'
                                                    }
                                                </span>
                                            </button>
                                        )}
                                        <button
                                            onClick={() => router.push(`/warehouse/skus/${selectedGroupSummary.skuId}`)}
                                            disabled={selectedGroupSummary.skuId === 'all'}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary transition-colors text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <span>View SKU</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Transaction Table */}
                            <div className="flex-1 overflow-auto">
                                {detailLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                                    </div>
                                ) : (
                                    <table className="w-full border-collapse text-left">
                                        <thead className="bg-secondary border-y border-border sticky top-0 z-20">
                                            <tr>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[110px]">Date</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[150px]">Type</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[120px]">Reference</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[220px]">Lot #</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[80px]">Cost</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-center w-[80px]">Qty</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[160px]">Status</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right w-[100px]">Total</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[40px]"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredDetailItems.map((item) => {
                                                const websiteColor = item.website ? WEBSITE_COLORS[item.website] : null;
                                                const statusColor = STATUS_COLORS[item.status] || 'bg-secondary text-muted-foreground';

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        className="hover:bg-secondary transition-colors group"
                                                    >
                                                        <td className="px-3 py-2 text-xs font-mono font-bold text-foreground whitespace-nowrap">
                                                            {formatDate(item.date)}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {item.source === 'Web Order' && websiteColor ? (
                                                                <span className={cn(
                                                                    "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                                                                    websiteColor.bg, websiteColor.text, websiteColor.border
                                                                )}>
                                                                    {item.website}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-secondary text-muted-foreground border border-border">
                                                                    {formatTitleCase(item.source)}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td
                                                            className="px-3 py-2 text-xs font-bold text-foreground cursor-pointer hover:underline"
                                                            onClick={() => router.push(item.link)}
                                                        >
                                                            {item.orderNumber}
                                                        </td>
                                                        {/* Lot # */}
                                                        <td className="px-3 py-2">
                                                            <span className="px-2 py-0.5 text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded">
                                                                {item.lotNumber}
                                                            </span>
                                                        </td>
                                                        {/* Cost (missing!) */}
                                                        <td className="px-3 py-2">
                                                            <span className="px-2 py-1 text-[10px] font-black uppercase tracking-wider border rounded bg-rose-500/10 text-rose-500 border-rose-500/30">
                                                                $0.00
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="text-xs font-black text-rose-500">
                                                                -{Math.round(item.quantity)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span className={cn(
                                                                "px-2 py-0.5 text-[10px] font-black tracking-wider",
                                                                statusColor
                                                            )}>
                                                                {formatTitleCase(item.status)}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs font-black text-foreground">
                                                            {formatCurrency(item.total)}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <ArrowUpRight
                                                                className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors cursor-pointer"
                                                                onClick={() => router.push(item.link)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                                    <Package className="w-7 h-7 text-muted-foreground" />
                                </div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    Select a SKU from the sidebar
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>

        </>
    );
}

// ── Stat Chip Component ──
function StatChip({ icon: Icon, label, value, color }: {
    icon: any;
    label: string;
    value: string | number;
    color: 'rose' | 'blue' | 'purple' | 'emerald';
}) {
    const colorMap = {
        rose: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    };

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md border shrink-0",
            colorMap[color]
        )}>
            <Icon className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            <span className="text-[11px] font-black">{value}</span>
        </div>
    );
}
