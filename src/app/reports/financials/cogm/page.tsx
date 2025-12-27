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
    Layers,
    Filter,
    Loader2
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

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
}

export default function COGMPage() {
    const router = useRouter();
    const [records, setRecords] = useState<ManufacturingRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [topMaterials, setTopMaterials] = useState<any[]>([]);
    const [productionBySku, setProductionBySku] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Filters
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
    const [skuOptions, setSkuOptions] = useState<{ label: string; value: string }[]>([]);

    // Fetch SKU options (only those used in manufacturing)
    useEffect(() => {
        fetch('/api/reports/cogm/skus')
            .then(res => res.json())
            .then(data => {
                if (data.skus) {
                    setSkuOptions(data.skus.map((s: any) => ({ label: s.name, value: s._id })));
                }
            })
            .catch(console.error);
    }, []);

    // Reset pagination when filters change
    useEffect(() => {
        setPage(1);
        setHasMore(true);
        // Don't clear records immediately to avoid flicker, fetch will handle replacement
    }, [dateRange, selectedSkus]);

    // Data Fetching
    const fetchData = useCallback(async () => {
        if (!hasMore && page > 1) return;
        
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });

            if (selectedSkus.length > 0) {
                params.append('sku', selectedSkus.join(','));
            }

            const res = await fetch(`/api/reports/cogm?${params.toString()}`);
            const data = await res.json();

            if (res.ok) {
                if (page === 1) {
                    setRecords(data.records || []);
                    // Update summaries only on initial load/filter change to keep context
                    setSummary(data.summary);
                    setTopMaterials(data.topMaterials || []);
                    setProductionBySku(data.productionBySku || []);
                    setTotal(data.total || 0);
                } else {
                    setRecords(prev => {
                        // Avoid duplicates if strict mode causes double fetch
                        const newIds = new Set(data.records.map((r: any) => r._id));
                        const filteredPrev = prev.filter(r => !newIds.has(r._id));
                        return [...filteredPrev, ...data.records];
                    });
                }
                
                // Determine if there are more records
                setHasMore((data.records || []).length === 20);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, dateRange, selectedSkus]); // hasMore excluded from deps to allow fetch on filter change reset

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !loading) {
                setPage(prev => prev + 1);
            }
        }, { threshold: 0.1 });

        if (loadMoreRef.current) {
            observer.observe(loadMoreRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, loading]);

    // Shell Viewport Lock: Prevents window-level scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            case 'In Progress': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            case 'Draft': return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-400';
            case 'Medium': return 'text-amber-400';
            case 'Low': return 'text-slate-400';
            default: return 'text-slate-400';
        }
    };

    const getSkuName = (sku: any) => {
        return typeof sku === 'object' && sku ? sku.name : sku || '-';
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 text-slate-900">
            {/* Sticky Page Header */}
            <div className="shrink-0 h-10 border-b border-slate-200 bg-white/80 backdrop-blur-md px-4 flex items-center justify-between z-10 shadow-sm">
                <div className="flex items-center space-x-3">
                    <button onClick={() => router.back()} className="hover:bg-slate-100 transition-colors p-1">
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-1" />
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <Link href="/" className="hover:text-slate-900 transition-colors">Dashboard</Link>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <Link href="/reports/financials" className="hover:text-slate-900 transition-colors">Financials</Link>
                        <ChevronRight className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-900 font-medium">Cost of Goods Manufactured</span>
                        <span className="text-slate-300 mx-1">|</span>
                        <span className="text-slate-900 font-bold">{summary?.totalBatches || 0} Batches</span>
                    </div>
                </div>

                {/* Inline Filters */}
                <div className="flex items-center gap-2">
                    {/* Date Range */}
                    <div className="flex items-center gap-2 bg-white border border-slate-200 px-2 h-7 shadow-sm transition-colors hover:border-slate-300">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={e => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="bg-transparent text-[10px] font-medium text-slate-600 outline-none w-20"
                        />
                        <span className="text-slate-300 text-[10px]">-</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={e => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="bg-transparent text-[10px] font-medium text-slate-600 outline-none w-20"
                        />
                    </div>

                    {/* SKU Filter */}
                    <MultiSelectFilter
                        label="SKU"
                        icon={Package}
                        options={skuOptions}
                        selectedValues={selectedSkus}
                        onChange={setSelectedSkus}
                        className="h-7 border-slate-200 bg-white hover:border-slate-300 text-slate-600 shadow-sm rounded-none"
                    />
                </div>
            </div>

            {/* Split Content View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Column: Ledger Table */}
                <div className="flex-1 overflow-y-auto bg-white min-w-0 relative scrollbar-custom">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
                            <tr>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">WO#</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Date</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">SKU</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Qty Mfg.</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Priority</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Status</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Created By</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Mat. Cost</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Pack. Cost</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Labor Cost</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Total Cost</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Unit Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {records.length === 0 && !loading ? (
                                <tr><td colSpan={12} className="px-3 py-12 text-center text-[10px] text-slate-500">No records found</td></tr>
                            ) : records.map(record => (
                                <tr 
                                    key={record._id} 
                                    onClick={() => router.push(`/warehouse/manufacturing/${record._id}`)}
                                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                                >
                                    <td className="px-3 py-2 text-[10px] font-bold text-slate-900 border-r border-slate-50">{record.label || record._id.slice(-6)}</td>
                                    <td className="px-3 py-2 text-[10px] text-slate-500 border-r border-slate-50">{formatDate(record.createdAt)}</td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 border-r border-slate-50 max-w-[150px] truncate" title={getSkuName(record.sku)}>{getSkuName(record.sku)}</td>
                                    <td className="px-3 py-2 text-[10px] font-bold text-purple-600 border-r border-slate-50">{record.qty?.toLocaleString() || 0} {record.uom}</td>
                                    <td className={cn("px-3 py-2 text-[10px] font-bold border-r border-slate-50", getPriorityColor(record.priority))}>
                                        {record.priority}
                                    </td>
                                    <td className="px-3 py-2 border-r border-slate-50">
                                        <span className={cn("px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-none border", getStatusColor(record.status))}>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 border-r border-slate-50 whitespace-nowrap">
                                        {record.createdBy ? `${record.createdBy.firstName} ${record.createdBy.lastName?.charAt(0)}.` : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 text-right border-r border-slate-50 font-mono">
                                        {(record.materialCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 text-right border-r border-slate-50 font-mono">
                                        {(record.packagingCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 text-right border-r border-slate-50 font-mono">
                                        {(record.laborCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] font-bold text-slate-900 text-right border-r border-slate-50 font-mono">
                                        {(record.totalCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] font-bold text-emerald-600 text-right font-mono">
                                        {(record.unitCost || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Load More Sentinel */}
                    <div ref={loadMoreRef} className="h-10 flex items-center justify-center border-t border-slate-50 mt-auto shrink-0">
                        {loading && hasMore && (
                            <div className="flex items-center gap-2 text-slate-400 text-[10px]">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Loading more...</span>
                            </div>
                        )}
                        {!hasMore && records.length > 0 && (
                            <span className="text-slate-300 text-[9px] uppercase tracking-widest py-2">End of List</span>
                        )}
                    </div>
                </div>

                {/* Right Column: Side Panels */}
                <div className="w-[300px] shrink-0 overflow-y-auto bg-slate-50 border-l border-slate-200 scrollbar-custom">
                    <div className="p-4 space-y-6">
                        {/* Production by SKU */}
                        <div className="bg-white border border-slate-100 shadow-sm rounded-none p-4">
                            <h3 className="font-bold flex items-center gap-2 mb-4 text-[10px] uppercase tracking-wider text-slate-900">
                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                                Top Production
                            </h3>
                            <div className="space-y-2">
                                {productionBySku.length === 0 ? (
                                    <p className="text-slate-400 text-[10px]">No data</p>
                                ) : productionBySku.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="w-4 h-4 rounded-none bg-emerald-50 text-emerald-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <span className="text-[10px] text-slate-600 truncate">{item.name}</span>
                                        </div>
                                        <span className="text-emerald-600 font-bold text-[10px] shrink-0 ml-2">{item.totalQty?.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Materials Used */}
                        <div className="bg-white border border-slate-100 shadow-sm rounded-none p-4">
                            <h3 className="font-bold flex items-center gap-2 mb-4 text-[10px] uppercase tracking-wider text-slate-900">
                                <Package className="w-3 h-3 text-blue-600" />
                                Top Materials
                            </h3>
                            <div className="space-y-2">
                                {topMaterials.length === 0 ? (
                                    <p className="text-slate-400 text-[10px]">No data</p>
                                ) : topMaterials.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="w-4 h-4 rounded-none bg-blue-50 text-blue-600 text-[9px] font-bold flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-[10px] text-slate-600 truncate">{item.name}</span>
                                                {item.totalScrapped > 0 && (
                                                    <span className="text-[9px] text-red-500 flex items-center">
                                                        <AlertTriangle className="w-2 h-2 mr-1" />
                                                        {item.totalScrapped}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-blue-600 font-bold text-[10px] shrink-0 ml-2">{item.totalQty?.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tiny Footer */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-100/50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System Ready</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">COGM Report Shell v1.0</span>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
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
        purple: 'from-purple-500 to-purple-600 shadow-purple-500/20'
    };

    return (
        <div className="bg-white border border-slate-100 shadow-sm rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg", colorClasses[color as keyof typeof colorClasses])}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                    <p className="text-2xl font-black text-slate-900">{value}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">{label}</p>
                </div>
            </div>
        </div>
    );
}
