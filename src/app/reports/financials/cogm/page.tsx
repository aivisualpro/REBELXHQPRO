'use client';

import {
    Factory,
    Calendar,
    Package,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    RefreshCw,
    ChevronRight,
    Search,
    Layers,
    Filter,
    Loader2,
    ArrowLeft,
    DollarSign,
    X,
    ChevronDown
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { cn, formatDate } from '@/lib/utils';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface ManufacturingRecord {
    _id: string;
    sku: { _id: string; name: string } | string;
    label: string;
    qty: number;
    uom: string;
    status: string;
    priority: string;
    scheduledStart?: string;
    scheduledFinish?: string;
    createdBy?: { firstName: string; lastName: string };
    finishedBy?: { firstName: string; lastName: string };
    createdAt: string;
    lineItems: Array<{
        sku: { _id: string; name: string } | string;
        recipeQty: number;
        qtyScrapped: number;
        uom: string;
    }>;
    materialCost?: number;
    packagingCost?: number;
    laborCost?: number;
    totalCost?: number;
    unitCost?: number;
}

interface Summary {
    totalBatches: number;
    totalQtyProduced: number;
    completedBatches: number;
    inProgressBatches: number;
    draftBatches: number;
    totalMaterialCost: number;
    totalPackagingCost: number;
    totalLaborCost: number;
    totalCost: number;
}

export default function COGMPageWrapper() {
    return (
        <Suspense fallback={
            <div className="h-full flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
            </div>
        }>
            <COGMPage />
        </Suspense>
    );
}

function COGMPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Init from URL Params
    const urlStart = searchParams.get('startDate');
    const urlEnd = searchParams.get('endDate');
    const urlSku = searchParams.get('sku');
    const urlSearch = searchParams.get('search');
    const urlDatePreset = searchParams.get('datePreset');

    const [records, setRecords] = useState<ManufacturingRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [topMaterials, setTopMaterials] = useState<any[]>([]);
    const [productionBySku, setProductionBySku] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Date Utils
    const getLocalDateString = (d: Date) => 
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const today = new Date();
    const defaultStart = getLocalDateString(new Date(today.getFullYear(), 0, 1)); // Jan 1st
    const defaultEnd = getLocalDateString(new Date(today.getFullYear(), 11, 31)); // Dec 31st

    // Filters
    const [dateRange, setDateRange] = useState({
        startDate: urlStart !== null ? urlStart : defaultStart,
        endDate: urlEnd !== null ? urlEnd : defaultEnd
    });
    const [datePreset, setDatePreset] = useState(() => {
        if (urlDatePreset) return urlDatePreset;
        const s = urlStart !== null ? urlStart : defaultStart;
        const e = urlEnd !== null ? urlEnd : defaultEnd;
        if (s === defaultStart && e === defaultEnd) return 'This Year';
        if (!s && !e) return 'All Time';
        return 'Custom';
    });
    const [dateFilterOpen, setDateFilterOpen] = useState(false);
    const dateFilterRef = useRef<HTMLDivElement | null>(null);

    const [selectedSkus, setSelectedSkus] = useState<string[]>(urlSku ? urlSku.split(',') : []);
    const [skuOptions, setSkuOptions] = useState<{ label: string; value: string }[]>([]);
    const [search, setSearch] = useState(urlSearch || '');
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    // URL Sync
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        
        if (dateRange.startDate) params.set('startDate', dateRange.startDate);
        else params.delete('startDate');
        
        if (dateRange.endDate) params.set('endDate', dateRange.endDate);
        else params.delete('endDate');

        if (selectedSkus.length > 0) params.set('sku', selectedSkus.join(','));
        else params.delete('sku');

        if (debouncedSearch) params.set('search', debouncedSearch);
        else params.delete('search');

        if (datePreset && datePreset !== 'Custom') params.set('datePreset', datePreset);
        else params.delete('datePreset');

        const currentQs = searchParams.toString();
        const newQs = params.toString();
        
        if (currentQs !== newQs) {
            router.push(`${window.location.pathname}?${newQs}`, { scroll: false });
        }
    }, [dateRange, selectedSkus, debouncedSearch, datePreset, router, searchParams]);

    useEffect(() => {
        fetch('/api/reports/cogm/skus')
            .then(res => res.json())
            .then(data => {
                if (data.skus) setSkuOptions(data.skus.map((s: any) => ({ label: s.name, value: s._id })));
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        setPage(1);
        setHasMore(true);
    }, [dateRange, selectedSkus, debouncedSearch]);

    const fetchData = useCallback(async () => {
        if (!hasMore && page > 1) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20'
            });

            if (dateRange.startDate) params.append('startDate', dateRange.startDate);
            if (dateRange.endDate) params.append('endDate', dateRange.endDate);
            if (selectedSkus.length > 0) params.append('sku', selectedSkus.join(','));
            if (debouncedSearch) params.append('search', debouncedSearch);

            const res = await fetch(`/api/reports/cogm?${params.toString()}`);
            const data = await res.json();

            if (res.ok) {
                if (page === 1) {
                    setRecords(data.records || []);
                    setSummary(data.summary);
                    setTopMaterials(data.topMaterials || []);
                    setProductionBySku(data.productionBySku || []);
                    setTotal(data.total || 0);
                } else {
                    setRecords(prev => {
                        const newIds = new Set(data.records.map((r: any) => r._id));
                        const filteredPrev = prev.filter(r => !newIds.has(r._id));
                        return [...filteredPrev, ...data.records];
                    });
                }
                setHasMore((data.records || []).length === 20);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, dateRange, selectedSkus, debouncedSearch]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loading) {
                setPage(prev => prev + 1);
            }
        }, { threshold: 0.1 });

        if (loadMoreRef.current) observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMore, loading]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
                setDateFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handlePresetChange = (preset: string) => {
        const today = new Date();
        let start = '';
        let end = '';

        if (preset === 'This Month') {
            start = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
            end = getLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        } else if (preset === 'Last Month') {
            start = getLocalDateString(new Date(today.getFullYear(), today.getMonth() - 1, 1));
            end = getLocalDateString(new Date(today.getFullYear(), today.getMonth(), 0));
        } else if (preset === 'This Year') {
            start = getLocalDateString(new Date(today.getFullYear(), 0, 1));
            end = getLocalDateString(new Date(today.getFullYear(), 11, 31));
        } else if (preset === 'Last Year') {
            start = getLocalDateString(new Date(today.getFullYear() - 1, 0, 1));
            end = getLocalDateString(new Date(today.getFullYear() - 1, 11, 31));
        } else if (preset === 'All Time') {
            start = '';
            end = '';
        }

        setDatePreset(preset);
        setDateRange({ startDate: start, endDate: end });
        setDateFilterOpen(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Fulfilled':
            case 'Completed': return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
            case 'In Progress': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30';
            case 'Draft': return 'bg-slate-500/20 text-muted-foreground border-border';
            default: return 'bg-secondary text-muted-foreground border-border';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-500 dark:text-red-400';
            case 'Medium': return 'text-amber-500 dark:text-amber-400';
            case 'Low': return 'text-muted-foreground';
            default: return 'text-muted-foreground';
        }
    };

    const getSkuName = (sku: any) => {
        return typeof sku === 'object' && sku ? sku.name : sku || '-';
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-200">
            {/* Top Header */}
            <div className="relative shrink-0 h-14 border-b border-border bg-background backdrop-blur-xl px-4 flex items-center justify-between z-50 shadow-sm transition-colors duration-200">
                <div className="flex items-center space-x-3">
                    <button onClick={() => router.back()} className="hover:bg-secondary rounded-full transition-colors p-2 text-muted-foreground cursor-pointer">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        <Link href="/reports/financials" className="hover:text-foreground transition-colors">Financials</Link>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        <span className="text-foreground font-semibold">Cost of Goods Mfg</span>
                        <span className="text-muted-foreground/30 mx-1">|</span>
                        <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">{summary?.totalBatches || 0} Batches</span>
                    </div>
                </div>

                {/* Inline Filters */}
                <div className="flex items-center gap-3 relative z-50">
                    {/* Visual Search */}
                    <div className="relative w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search WO#..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 h-9 bg-background border border-border rounded-lg text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground transition-colors shadow-sm"
                        />
                    </div>

                    {/* Date Filter */}
                    <div ref={dateFilterRef} className="relative shrink-0">
                        <button
                            onClick={() => setDateFilterOpen(p => !p)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border text-[11px] font-semibold transition-all cursor-pointer bg-background hover:bg-secondary shadow-sm hover:border-border/80',
                                (dateRange.startDate || dateRange.endDate)
                                    ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="uppercase tracking-wider text-nowrap">
                                {datePreset !== 'All Time' ? datePreset : (dateRange.startDate || dateRange.endDate) ? 'Custom' : 'All Time'}
                            </span>
                            <ChevronDown className={cn('w-3 h-3 transition-transform', dateFilterOpen && 'rotate-180')} />
                        </button>
                        {dateFilterOpen && (
                            <div className="absolute top-full mt-1.5 right-0 z-50 bg-background border border-border rounded-xl shadow-2xl min-w-[280px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-3 py-2 border-b border-border bg-secondary flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date Filter</span>
                                    {(dateRange.startDate || dateRange.endDate || datePreset !== 'All Time') && (
                                        <button onClick={() => { setDatePreset('All Time'); setDateRange({ startDate: '', endDate: '' }); setDateFilterOpen(false); }} className="text-[9px] font-bold text-primary hover:underline cursor-pointer">
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="p-3 bg-background grid gap-1.5 grid-cols-2 text-center pb-3 border-b border-border">
                                    {['All Time', 'This Month', 'Last Month', 'This Year', 'Last Year'].map((preset, idx) => (
                                        <button
                                            key={preset}
                                            onClick={() => handlePresetChange(preset)}
                                            className={cn(
                                                'px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer',
                                                preset === 'All Time' && idx === 0 ? 'col-span-2' : '',
                                                datePreset === preset ? 'bg-primary border-primary text-white' : 'bg-secondary border-border hover:bg-secondary/80 text-foreground'
                                            )}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 bg-background space-y-2">
                                    <div className="space-y-1 text-left">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">From</label>
                                        <input type="date" value={dateRange.startDate} onChange={e => { setDateRange({ ...dateRange, startDate: e.target.value }); setDatePreset('Custom'); }} className="w-full bg-background border border-border rounded-lg px-2 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all text-foreground [color-scheme:dark_light]" />
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">To</label>
                                        <input type="date" value={dateRange.endDate} onChange={e => { setDateRange({ ...dateRange, endDate: e.target.value }); setDatePreset('Custom'); }} className="w-full bg-background border border-border rounded-lg px-2 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all text-foreground [color-scheme:dark_light]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-[180px]">
                        <MultiSelectFilter
                            label="SKU"
                            icon={Package}
                            options={skuOptions}
                            selectedValues={selectedSkus}
                            onChange={setSelectedSkus}
                            dropdownWidth="w-[450px]"
                            className="h-9 border-border bg-background hover:bg-secondary text-foreground shadow-sm text-[11px] rounded-lg w-full justify-between"
                        />
                    </div>

                    {(search || selectedSkus.length > 0 || datePreset !== 'this_year') && (
                        <button 
                            onClick={() => {
                                const today = new Date();
                                setSearch('');
                                setSelectedSkus([]);
                                setDatePreset('This Year');
                                setDateRange({
                                    startDate: getLocalDateString(new Date(today.getFullYear(), 0, 1)),
                                    endDate: getLocalDateString(new Date(today.getFullYear(), 11, 31))
                                });
                            }} 
                            className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 transition-all ml-1 shadow-sm shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Split Content View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Column: Ledger Table */}
                <div className="flex-1 overflow-y-auto bg-background min-w-0 relative scrollbar-custom transition-colors duration-200">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-secondary border-b border-border shadow-sm">
                            <tr>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[70px]">WO#</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[80px]">Date</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border">SKU</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[80px] text-right">Qty Mfg.</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[50px]">UOM</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[100px]">Created By</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right border-r border-border min-w-[90px]">Mat. Cost</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right border-r border-border min-w-[90px]">Pack. Cost</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right border-r border-border min-w-[90px]">Labor Cost</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right border-r border-border min-w-[90px]">Total Cost</th>
                                <th className="px-3 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest text-right min-w-[90px]">Unit Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {records.length === 0 && !loading ? (
                                <tr><td colSpan={12} className="px-4 py-16 text-center text-[11px] font-medium text-muted-foreground">No records found matching your filters</td></tr>
                            ) : records.map(record => (
                                <tr
                                    key={record._id}
                                    onClick={() => router.push(`/warehouse/manufacturing/${record._id}`)}
                                    className="hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer group"
                                >
                                    <td className="px-3 py-3 text-[11px] font-bold text-foreground border-r border-border group-hover:text-primary transition-colors">
                                        {record.label || record._id.slice(-6)}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-medium text-muted-foreground border-r border-border">
                                        {formatDate(record.createdAt)}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-medium text-foreground/80 border-r border-border max-w-[200px] truncate" title={getSkuName(record.sku)}>
                                        {getSkuName(record.sku)}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-bold text-primary border-r border-border text-right font-mono">
                                        {record.qty?.toLocaleString() || 0}
                                    </td>
                                    <td className="px-3 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border">
                                        {record.uom || '-'}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-medium text-muted-foreground border-r border-border whitespace-nowrap">
                                        {record.createdBy ? `${record.createdBy.firstName} ${record.createdBy.lastName?.charAt(0)}.` : '-'}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] text-foreground/80 text-right border-r border-border font-mono tracking-tight">
                                        {(record.materialCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] text-foreground/80 text-right border-r border-border font-mono tracking-tight">
                                        {(record.packagingCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] text-foreground/80 text-right border-r border-border font-mono tracking-tight">
                                        {(record.laborCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-bold text-foreground text-right border-r border-border font-mono tracking-tight">
                                        {(record.totalCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-3 text-[11px] font-bold text-primary text-right font-mono tracking-tight group-hover:bg-primary/5 transition-colors">
                                        {(record.qty > 0 ? (record.totalCost || 0) / record.qty : 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Load More Sentinel */}
                    <div ref={loadMoreRef} className="h-16 flex items-center justify-center border-t border-border mt-auto shrink-0 bg-transparent">
                        {loading && hasMore && (
                            <div className="flex items-center gap-2 text-primary text-[11px] font-medium bg-primary/10 px-4 py-2 rounded-full">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Loading more records...</span>
                            </div>
                        )}
                        {!hasMore && records.length > 0 && (
                            <span className="text-muted-foreground text-[11px] font-bold uppercase tracking-widest py-2 flex items-center gap-2">
                                <div className="w-8 h-px bg-border"></div>
                                End of List
                                <div className="w-8 h-px bg-border"></div>
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Column: Side Panels */}
                <div className="w-[340px] shrink-0 overflow-y-auto bg-secondary border-l border-border scrollbar-custom p-2 space-y-2 transition-colors duration-200">
                    
                    {/* COGM Summary Card */}
                    {summary && (
                        <div className="bg-background border border-border shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-2 overflow-hidden relative">
                            <h3 className="font-bold flex items-center gap-2 mb-4 text-[11px] uppercase tracking-widest text-foreground relative z-10">
                                <div className="w-6 h-6 rounded-md bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                                    <DollarSign className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                </div>
                                COGM Summary
                            </h3>
                            <div className="space-y-2 relative z-10 w-full mb-1">
                                {(() => {
                                    const tCost = summary.totalCost || 0;
                                    const mCost = summary.totalMaterialCost || 0;
                                    const pCost = summary.totalPackagingCost || 0;
                                    const lCost = summary.totalLaborCost || 0;
                                    const qProd = summary.totalQtyProduced || 0;
                                    
                                    const unitC = qProd > 0 ? (tCost / qProd) : 0;
                                    const mPerc = tCost > 0 ? (mCost / tCost) * 100 : 0;
                                    const pPerc = tCost > 0 ? (pCost / tCost) * 100 : 0;
                                    const lPerc = tCost > 0 ? (lCost / tCost) * 100 : 0;

                                    const formatDollars = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
                                    
                                    return (
                                        <>
                                            {/* Cost Per Unit */}
                                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md group transition-all duration-300 hover:border-teal-500">
                                                <span className="relative z-10 text-[11px] font-black text-white uppercase tracking-tight drop-shadow-sm">Cost Per Unit</span>
                                                <span className="relative z-10 text-[12px] font-black text-teal-400 font-mono tracking-tight cursor-default drop-shadow-sm" title={unitC.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}>{unitC.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>

                                            {/* Material Cost */}
                                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md transition-all duration-300 hover:border-teal-500">
                                                <div className="absolute left-0 top-0 bottom-0 bg-teal-600 dark:bg-teal-500 transition-all duration-1000" style={{ width: `${mPerc}%` }} />
                                                <span className="relative z-10 text-[11px] font-black text-white uppercase tracking-tight drop-shadow-sm">Material Cost <span className="font-mono ml-1 text-[12px] text-teal-100">{formatDollars(mCost)}</span></span>
                                                <span className="relative z-10 text-[11px] font-black text-white drop-shadow-sm">{Math.round(mPerc)}%</span>
                                            </div>

                                            {/* Packaging Cost */}
                                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md transition-all duration-300 hover:border-teal-500">
                                                <div className="absolute left-0 top-0 bottom-0 bg-teal-600 dark:bg-teal-500 transition-all duration-1000" style={{ width: `${pPerc}%` }} />
                                                <span className="relative z-10 text-[11px] font-black text-white uppercase tracking-tight drop-shadow-sm">Packaging Cost <span className="font-mono ml-1 text-[12px] text-teal-100">{formatDollars(pCost)}</span></span>
                                                <span className="relative z-10 text-[11px] font-black text-white drop-shadow-sm">{Math.round(pPerc)}%</span>
                                            </div>

                                            {/* Labor Cost */}
                                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md transition-all duration-300 hover:border-teal-500">
                                                <div className="absolute left-0 top-0 bottom-0 bg-teal-600 dark:bg-teal-500 transition-all duration-1000" style={{ width: `${lPerc}%` }} />
                                                <span className="relative z-10 text-[11px] font-black text-white uppercase tracking-tight drop-shadow-sm">Labor Cost <span className="font-mono ml-1 text-[12px] text-teal-100">{formatDollars(lCost)}</span></span>
                                                <span className="relative z-10 text-[11px] font-black text-white drop-shadow-sm">{Math.round(lPerc)}%</span>
                                            </div>

                                            {/* Total Cost */}
                                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md mt-1 mb-1 transition-all duration-300 hover:border-emerald-500">
                                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/20 to-transparent pointer-events-none" />
                                                <span className="relative z-10 text-[11px] font-black text-white uppercase tracking-tight drop-shadow-sm">Total Cost</span>
                                                <span className="relative z-10 text-[13px] font-black text-white font-mono tracking-tight drop-shadow-sm">{formatDollars(tCost)}</span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Top Production Card */}
                    <div className="bg-background border border-border shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-2 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <TrendingUp className="w-32 h-32 text-primary" />
                        </div>
                        
                        <h3 className="font-bold flex items-center gap-2 mb-5 text-[11px] uppercase tracking-widest text-foreground relative z-10">
                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                            </div>
                            Top Production
                        </h3>
                        <div className="space-y-3 relative z-10">
                            {productionBySku.length === 0 ? (
                                <p className="text-muted-foreground text-[11px] font-medium italic">Data generating...</p>
                            ) : productionBySku.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary transition-colors border border-transparent hover:border-border">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className={cn(
                                            "w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center shrink-0 shadow-sm",
                                            idx === 0 ? "bg-amber-500/20 text-amber-500 border border-amber-500/30" : 
                                            idx === 1 ? "bg-slate-500/20 text-slate-500 border border-slate-500/30" :
                                            idx === 2 ? "bg-orange-500/20 text-orange-500 border border-orange-500/30" :
                                            "bg-secondary text-muted-foreground"
                                        )}>
                                            {idx + 1}
                                        </span>
                                        <span className="text-[11px] font-medium text-foreground/80 truncate" title={item.name}>{item.name}</span>
                                    </div>
                                    <span className="text-primary font-extrabold text-[11px] shrink-0 ml-3 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                        {item.totalQty?.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Top Materials Used */}
                    <div className="bg-background border border-border shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-2 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <Package className="w-32 h-32 text-blue-500" />
                        </div>

                        <h3 className="font-bold flex items-center gap-2 mb-5 text-[11px] uppercase tracking-widest text-foreground relative z-10">
                            <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                                <Package className="w-3.5 h-3.5 text-blue-500" />
                            </div>
                            Top Materials
                        </h3>
                        <div className="space-y-3 relative z-10">
                            {topMaterials.length === 0 ? (
                                <p className="text-muted-foreground text-[11px] font-medium italic">Data generating...</p>
                            ) : topMaterials.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary transition-colors border border-transparent hover:border-border">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[11px] font-black flex items-center justify-center shrink-0 shadow-sm">
                                            {idx + 1}
                                        </span>
                                        <div className="flex flex-col overflow-hidden">
                                            <span className="text-[11px] font-medium text-foreground/80 truncate" title={item.name}>{item.name}</span>
                                            {item.totalScrapped > 0 && (
                                                <span className="text-[11px] font-bold text-red-500 flex items-center mt-0.5">
                                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                                    {item.totalScrapped} Scrapped
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-blue-500 font-extrabold text-[11px] shrink-0 ml-3 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                        {item.totalQty?.toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Mini Footer */}
            <div className="h-[28px] border-t border-border bg-background backdrop-blur-sm shrink-0 flex items-center justify-between px-5 z-[50] transition-colors duration-200">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">System Ready</span>
                    </div>
                </div>
                <div className="flex items-center space-x-5">
                    <span className="text-[11px] text-muted-foreground/80 font-mono font-bold uppercase tracking-tighter">COGM Ledger v2.1</span>
                    <span className="text-[11px] text-muted-foreground/80 font-mono font-bold uppercase tracking-widest">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </span>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
    const colorClasses = {
        blue: 'from-blue-500 to-blue-600 shadow-blue-500/20',
        emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/20',
        amber: 'from-amber-500 to-amber-600 shadow-amber-500/20',
        slate: 'from-slate-500 to-slate-600 shadow-slate-500/20',
        purple: 'from-primary/80 to-primary shadow-primary/20'
    };

    return (
        <div className="bg-background border border-border shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full -mr-10 -mt-10 pointer-events-none transition-transform duration-500 group-hover:scale-110"></div>
            <div className="flex items-center gap-4 relative z-10">
                <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg", colorClasses[color as keyof typeof colorClasses])}>
                    <Icon className="w-6 h-6 text-white drop-shadow-sm" />
                </div>
                <div>
                    <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
                    <p className="text-[11px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">{label}</p>
                </div>
            </div>
        </div>
    );
}
