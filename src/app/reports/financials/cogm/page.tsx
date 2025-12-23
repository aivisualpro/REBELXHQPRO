'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { Pagination } from '@/components/ui/Pagination';
import Link from 'next/link';

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
}

interface Summary {
    totalBatches: number;
    totalQtyProduced: number;
    completedBatches: number;
    inProgressBatches: number;
    draftBatches: number;
}

export default function COGMPage() {
    const [records, setRecords] = useState<ManufacturingRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [topMaterials, setTopMaterials] = useState<any[]>([]);
    const [productionBySku, setProductionBySku] = useState<any[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

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

    const fetchData = useCallback(async () => {
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
                setRecords(data.records || []);
                setSummary(data.summary);
                setTopMaterials(data.topMaterials || []);
                setProductionBySku(data.productionBySku || []);
                setTotalPages(data.totalPages || 1);
                setTotal(data.total || 0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [page, dateRange, selectedSkus]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
            <div className="max-w-[1800px] mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                        <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
                        <ChevronRight className="w-3 h-3" />
                        <Link href="/reports/financials" className="hover:text-white transition-colors">Financials</Link>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-white font-medium">Cost of Goods Manufactured</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                                <Factory className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">Cost of Goods Manufactured</h1>
                                <p className="text-slate-400 text-sm mt-1">Manufacturing batches, materials used, and production summary</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchData}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-8 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 px-4 py-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={e => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="bg-transparent text-sm outline-none"
                        />
                        <span className="text-slate-500">to</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={e => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="bg-transparent text-sm outline-none"
                        />
                    </div>
                    <MultiSelectFilter
                        label="SKU"
                        icon={Package}
                        options={skuOptions}
                        selectedValues={selectedSkus}
                        onChange={setSelectedSkus}
                    />
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <SummaryCard 
                        label="Total Batches" 
                        value={summary?.totalBatches || 0} 
                        icon={Layers}
                        color="blue"
                    />
                    <SummaryCard 
                        label="Qty Produced" 
                        value={summary?.totalQtyProduced?.toLocaleString() || '0'} 
                        icon={TrendingUp}
                        color="emerald"
                    />
                    <SummaryCard 
                        label="Completed" 
                        value={summary?.completedBatches || 0} 
                        icon={CheckCircle2}
                        color="emerald"
                    />
                    <SummaryCard 
                        label="In Progress" 
                        value={summary?.inProgressBatches || 0} 
                        icon={Clock}
                        color="amber"
                    />
                    <SummaryCard 
                        label="Draft" 
                        value={summary?.draftBatches || 0} 
                        icon={FileText}
                        color="slate"
                    />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Manufacturing Records Table */}
                    <div className="lg:col-span-2 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-700/50">
                            <h3 className="font-bold flex items-center gap-2">
                                <Factory className="w-4 h-4 text-purple-400" />
                                Manufacturing Batches
                                <span className="text-xs text-slate-500 ml-2">({total} records)</span>
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-700/50">
                                        <th className="px-4 py-3 font-bold">Label</th>
                                        <th className="px-4 py-3 font-bold">SKU</th>
                                        <th className="px-4 py-3 font-bold">Qty</th>
                                        <th className="px-4 py-3 font-bold">Status</th>
                                        <th className="px-4 py-3 font-bold">Priority</th>
                                        <th className="px-4 py-3 font-bold">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/30">
                                    {loading ? (
                                        <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading...</td></tr>
                                    ) : records.length === 0 ? (
                                        <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No records found</td></tr>
                                    ) : records.map(record => (
                                        <tr key={record._id} className="hover:bg-slate-700/20 transition-colors">
                                            <td className="px-4 py-3 text-sm font-bold">{record.label || record._id.slice(-6)}</td>
                                            <td className="px-4 py-3 text-sm text-slate-300">{getSkuName(record.sku)}</td>
                                            <td className="px-4 py-3 text-sm font-bold text-purple-400">{record.qty?.toLocaleString() || 0} {record.uom}</td>
                                            <td className="px-4 py-3">
                                                <span className={cn("px-2 py-1 text-[10px] font-bold uppercase rounded border", getStatusColor(record.status))}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className={cn("px-4 py-3 text-sm font-bold", getPriorityColor(record.priority))}>
                                                {record.priority}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-400">{formatDate(record.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-700/50">
                            <Pagination
                                currentPage={page}
                                totalPages={totalPages}
                                onPageChange={setPage}
                                totalItems={total}
                                itemsPerPage={20}
                                itemName="batches"
                            />
                        </div>
                    </div>

                    {/* Side Panels */}
                    <div className="space-y-6">
                        {/* Production by SKU */}
                        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                            <h3 className="font-bold flex items-center gap-2 mb-4">
                                <TrendingUp className="w-4 h-4 text-emerald-400" />
                                Top Production SKUs
                            </h3>
                            <div className="space-y-3">
                                {productionBySku.length === 0 ? (
                                    <p className="text-slate-500 text-sm">No data</p>
                                ) : productionBySku.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <span className="text-sm truncate max-w-[150px]">{item.name}</span>
                                        </div>
                                        <span className="text-emerald-400 font-bold text-sm">{item.totalQty?.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Top Materials Used */}
                        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                            <h3 className="font-bold flex items-center gap-2 mb-4">
                                <Package className="w-4 h-4 text-blue-400" />
                                Top Materials Used
                            </h3>
                            <div className="space-y-3">
                                {topMaterials.length === 0 ? (
                                    <p className="text-slate-500 text-sm">No data</p>
                                ) : topMaterials.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className="w-6 h-6 rounded-md bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">
                                                {idx + 1}
                                            </span>
                                            <div>
                                                <span className="text-sm truncate max-w-[150px] block">{item.name}</span>
                                                {item.totalScrapped > 0 && (
                                                    <span className="text-[10px] text-red-400">
                                                        <AlertTriangle className="w-2.5 h-2.5 inline mr-1" />
                                                        {item.totalScrapped} scrapped
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-blue-400 font-bold text-sm">{item.totalQty?.toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
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
        <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg", colorClasses[color as keyof typeof colorClasses])}>
                    <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                    <p className="text-2xl font-black">{value}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">{label}</p>
                </div>
            </div>
        </div>
    );
}
