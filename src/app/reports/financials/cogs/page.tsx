'use client';

import React, { useState, useEffect } from 'react';
import { 
    DollarSign, 
    TrendingUp, 
    TrendingDown,
    Calendar,
    Download,
    RefreshCw,
    PieChart,
    BarChart3,
    Minus,
    ChevronRight,
    Globe,
    ShoppingCart,
    Layers,
    Filter,
    ChevronDown,
    PackageSearch,
    Package
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';

const getLocalDateString = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

type DatePreset = 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'all_time' | 'custom';

function getPresetRange(preset: DatePreset): { startDate: string; endDate: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    switch (preset) {
        case 'this_month':
            return {
                startDate: getLocalDateString(y, m, 1),
                endDate: getLocalDateString(y, m, d),
            };
        case 'last_month': {
            const firstLM = new Date(y, m - 1, 1);
            const lastLM = new Date(y, m, 0);
            return {
                startDate: getLocalDateString(firstLM.getFullYear(), firstLM.getMonth(), 1),
                endDate: getLocalDateString(lastLM.getFullYear(), lastLM.getMonth(), lastLM.getDate()),
            };
        }
        case 'this_year':
            return {
                startDate: getLocalDateString(y, 0, 1),
                endDate: getLocalDateString(y, m, d),
            };
        case 'last_year':
            return {
                startDate: getLocalDateString(y - 1, 0, 1),
                endDate: getLocalDateString(y - 1, 11, 31),
            };
        case 'all_time':
            return {
                startDate: 'all',
                endDate: 'all',
            };
        default:
            return {
                startDate: getLocalDateString(y, m, 1),
                endDate: getLocalDateString(y, m, d),
            };
    }
}

interface CogsData {
    summary: {
        totalCogs: number;
        totalOrders: number;
        totalItems: number;
        totalRevenue: number;
        avgCogsPerOrder: number;
        avgCostPerItem: number;
        blendedMargin: number;
    };
    topSkus: Array<{
        id: string;
        name: string;
        category: string;
        totalQty: number;
        totalCost: number;
        revenue: number;
        margin: number;
    }>;
    monthlyCogs: Array<{
        _id: string;
        cogs: number;
    }>;
}

export default function CogsWrapper() {
    return (
        <React.Suspense fallback={<div className="h-[calc(100vh-40px)] flex items-center justify-center bg-background"><RefreshCw className="w-8 h-8 text-rose-500 animate-spin" /></div>}>
            <CogsPage />
        </React.Suspense>
    );
}

function CogsPage() {
    const r = useRouter();
    const s = useSearchParams();

    // Timezone-safe date initialization
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const urlStart = s.get('startDate');
    const urlEnd = s.get('endDate');
    const urlSource = s.get('source') as 'total' | 'web' | 'wholesale';

    const [source, setSource] = useState<'total' | 'web' | 'wholesale'>(urlSource || 'total');
    const [dateRange, setDateRange] = useState({
        startDate: urlStart || firstOfMonthStr,
        endDate: urlEnd || todayStr
    });

    const [datePreset, setDatePreset] = useState<DatePreset>(
        (!urlStart && !urlEnd) ? 'this_month' : 'custom'
    );
    const [filterOpen, setFilterOpen] = useState(false);
    const filterDropdownRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
                setFilterOpen(false);
            }
        };
        if (filterOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [filterOpen]);

    const handlePresetChange = (preset: DatePreset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            setDateRange(getPresetRange(preset));
        }
    };

    const applyFilters = () => {
        setFilterOpen(false);
        fetchData();
    };

    const [data, setData] = useState<CogsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/cogs?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&source=${source}`);
            const json = await res.json();
            setData(json);

            // Sync with URL
            const params = new URLSearchParams();
            if (dateRange.startDate && dateRange.startDate !== 'all') params.set('startDate', dateRange.startDate);
            if (dateRange.endDate && dateRange.endDate !== 'all') params.set('endDate', dateRange.endDate);
            if (source && source !== 'total') params.set('source', source);

            const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
            r.push(newUrl, { scroll: false });

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source]);

    const formatCurrency = (val: number) => {
        if (!val) return '$0';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const formatDecimalCurrency = (val: number) => {
        if (!val) return '$0.00';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatCompact = (val: number) => {
        if (!val) return '$0';
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'M';
        if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'K';
        return '$' + val.toFixed(0);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-background text-foreground overflow-hidden transition-colors duration-300">
            {/* Sticky Page Header */}
            <div className="shrink-0 bg-background border-b border-border px-6 py-4 z-10">
                <div className="max-w-[1400px] mx-auto">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
                                <PackageSearch className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight uppercase text-foreground">Cost of Goods Sold</h1>
                                <p className="text-muted-foreground text-xs">SKU level profitability analysis</p>
                            </div>
                        </div>

                        {/* Source Filter Tabs */}
                        <div className="flex items-center bg-secondary/60 border border-border rounded-lg p-0.5">
                            <button
                                onClick={() => setSource('total')}
                                className={cn(
                                    'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer',
                                    source === 'total'
                                        ? 'bg-rose-600 text-white shadow-md'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                )}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                Total
                            </button>
                            <button
                                onClick={() => setSource('web')}
                                className={cn(
                                    'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer',
                                    source === 'web'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                )}
                            >
                                <Globe className="w-3.5 h-3.5" />
                                Web Orders
                            </button>
                            <button
                                onClick={() => setSource('wholesale')}
                                className={cn(
                                    'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer',
                                    source === 'wholesale'
                                        ? 'bg-orange-600 text-white shadow-md'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                                )}
                            >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                Wholesale
                            </button>
                        </div>

                        {/* Filters Dropdown */}
                        <div className="relative" ref={filterDropdownRef}>
                            <button 
                                onClick={() => setFilterOpen(!filterOpen)}
                                className="flex items-center gap-2 bg-secondary/60 hover:bg-secondary border border-border px-4 py-2.5 rounded-lg text-sm font-bold transition-all text-foreground"
                            >
                                <Filter className="w-4 h-4" />
                                Filters
                                <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                            </button>

                            {filterOpen && (
                                <div className="absolute right-0 top-full mt-2 w-[320px] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-border">
                                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3 flex items-center gap-1.5 cursor-default">
                                            <Calendar className="w-3.5 h-3.5 text-rose-500" /> Time Period
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['this_month', 'last_month', 'this_year', 'last_year', 'all_time'] as DatePreset[]).map(preset => (
                                                <button
                                                    key={preset}
                                                    onClick={() => handlePresetChange(preset)}
                                                    className={cn(
                                                        "px-3 py-2 text-[11px] font-bold rounded-md transition-colors text-left border",
                                                        datePreset === preset
                                                            ? "bg-rose-500/15 text-rose-600 border-rose-500/30 shadow-sm"
                                                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary border-transparent"
                                                    )}
                                                >
                                                    {preset.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Custom Date Ranges */}
                                    <div className="p-4 border-b border-border space-y-3 bg-secondary/20">
                                        <div className="relative">
                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Start Date</label>
                                            <input 
                                                type="date" 
                                                value={dateRange.startDate === 'all' ? '' : dateRange.startDate} 
                                                onChange={e => {
                                                    setDateRange(prev => ({ ...prev, startDate: e.target.value }));
                                                    setDatePreset('custom');
                                                }} 
                                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-rose-500/50 transition-colors" 
                                            />
                                        </div>
                                        <div className="relative">
                                            <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">End Date</label>
                                            <input 
                                                type="date" 
                                                value={dateRange.endDate === 'all' ? '' : dateRange.endDate} 
                                                onChange={e => {
                                                    setDateRange(prev => ({ ...prev, endDate: e.target.value }));
                                                    setDatePreset('custom');
                                                }} 
                                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-rose-500/50 transition-colors" 
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 bg-secondary/30 shrink-0 border-t border-border">
                                        <button 
                                            onClick={applyFilters}
                                            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] uppercase tracking-wider px-4 py-3 rounded-lg transition-colors shadow-md"
                                        >
                                            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
                                            Apply Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-custom">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard 
                            label="Total COGS"
                            value={loading ? '...' : formatCompact(data?.summary?.totalCogs || 0)}
                            icon={TrendingDown}
                            color="rose"
                            subtext="Total Cost of Goods Sold"
                        />
                        <SummaryCard 
                            label="Items Shipped"
                            value={loading ? '...' : (data?.summary?.totalItems || 0).toLocaleString()}
                            icon={Package}
                            color="blue"
                            subtext={`Avg ${formatDecimalCurrency(data?.summary?.avgCostPerItem || 0)} / item`}
                        />
                        <SummaryCard 
                            label="Total Orders"
                            value={loading ? '...' : (data?.summary?.totalOrders || 0).toLocaleString()}
                            icon={ShoppingCart}
                            color="amber"
                            subtext={`Avg ${formatCurrency(data?.summary?.avgCogsPerOrder || 0)} COGS / order`}
                        />
                        <SummaryCard 
                            label="Blended Margin"
                            value={loading ? '...' : `${(data?.summary?.blendedMargin || 0).toFixed(1)}%`}
                            icon={PieChart}
                            color="emerald"
                            subtext={`Revenue vs COGS (Est.)`}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Monthly Trend Chart */}
                        <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center h-[350px]">
                            <div className="flex items-center justify-between w-full mb-6">
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="w-5 h-5 text-rose-500" />
                                    <h3 className="font-bold text-foreground">Monthly COGS</h3>
                                </div>
                            </div>
                            
                            {data?.monthlyCogs && data.monthlyCogs.length > 0 ? (
                                <div className="flex items-end justify-center gap-3 h-full w-full pb-2">
                                    {data.monthlyCogs.map((month, idx) => {
                                        const cogsList = data.monthlyCogs.map(m => m.cogs || 0);
                                        const maxCogs = Math.max(...cogsList, 1);
                                        const heightPx = Math.max(8, Math.round((month.cogs / maxCogs) * (200)));
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center justify-end group max-w-[40px]" style={{ height: '100%' }}>
                                                <div className="hidden group-hover:block text-[9px] text-rose-600 font-bold mb-1 -translate-y-1 transition-all">
                                                    {formatCompact(month.cogs)}
                                                </div>
                                                <div 
                                                    className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-sm transition-all group-hover:from-rose-500 group-hover:to-rose-300 cursor-pointer"
                                                    style={{ height: `${heightPx}px` }}
                                                    title={`${month._id}: ${formatCurrency(month.cogs)}`}
                                                />
                                                <div className="text-[9px] text-muted-foreground font-bold mt-2 rotate-[-45deg] origin-top-left translate-y-2">
                                                    {month._id?.split('-')[1] || idx}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-muted-foreground text-sm w-full">
                                    {loading ? 'Loading chart data...' : 'No historical data available'}
                                </div>
                            )}
                        </div>

                        {/* Top SKUs List */}
                        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-sm flex flex-col h-[600px] lg:h-[350px]">
                            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
                                <h3 className="font-bold text-foreground flex items-center gap-2">
                                    <PackageSearch className="w-4 h-4 text-emerald-500" />
                                    Cost Breakdown by SKU
                                </h3>
                                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                    <Download className="w-4 h-4" />
                                    Export CSV
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto w-full scrollbar-custom">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin" />
                                    </div>
                                ) : data?.topSkus && data.topSkus.length > 0 ? (
                                    <table className="w-full border-collapse">
                                        <thead className="bg-secondary/40 sticky top-0 z-10 border-b border-border/50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-[10px] font-black uppercase text-muted-foreground tracking-widest">SKU Name</th>
                                                <th className="px-4 py-3 text-left text-[10px] font-black uppercase text-muted-foreground tracking-widest hidden md:table-cell">Category</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Qty</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest">Tot. Cost</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                            {data.topSkus.map((sku, idx) => (
                                                <tr key={idx} className="hover:bg-secondary/30 transition-colors group">
                                                    <td className="px-6 py-3">
                                                        <div className="text-sm font-semibold text-foreground truncate max-w-[180px] sm:max-w-xs">{sku.name}</div>
                                                    </td>
                                                    <td className="px-4 py-3 hidden md:table-cell">
                                                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{sku.category}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-sm font-medium text-foreground">{sku.totalQty.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="text-sm font-bold text-rose-500">{formatCurrency(sku.totalCost)}</div>
                                                        <div className="text-[10px] text-muted-foreground mt-0.5">{formatDecimalCurrency(sku.totalCost / (sku.totalQty || 1))} ea</div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                                        No SKU tracking data available for this period.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color, subtext }: {
    label: string;
    value: string;
    icon: any;
    color: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
    subtext?: string;
}) {
    const colorStyles: Record<string, { bg: string; border: string; text: string; iconColor: string }> = {
        emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#10b981', iconColor: '#10b981' },
        blue: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', text: '#3b82f6', iconColor: '#3b82f6' },
        amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b', iconColor: '#f59e0b' },
        purple: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)', text: '#a855f7', iconColor: '#a855f7' },
        rose: { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.25)', text: '#f43f5e', iconColor: '#f43f5e' }
    };

    const cs = colorStyles[color];

    return (
        <div 
            className="rounded-2xl p-6 relative overflow-hidden group border transition-colors"
            style={{ backgroundColor: cs.bg, borderColor: cs.border }}
        >
            <div className="flex items-center justify-between mb-4">
                <Icon className="w-6 h-6" style={{ color: cs.iconColor }} />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <div className="text-3xl font-black text-foreground mb-1">{value}</div>
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            {subtext && <div className="text-xs text-muted-foreground/70 mt-1">{subtext}</div>}
        </div>
    );
}
