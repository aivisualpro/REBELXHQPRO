'use client';

import React, { useState, useEffect } from 'react';
import { 
    DollarSign, 
    TrendingUp, 
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
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
    Check,
    Users
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

interface IncomeData {
    revenue: {
        total: number;
        web: number;
        wholesale: number;
        webOrders: number;
        wholesaleOrders: number;
    };
    cogs: number;
    grossProfit: number;
    grossMargin: number;
    operatingExpenses: {
        salaries: number;
        marketing: number;
        utilities: number;
        other: number;
        total: number;
    };
    totalShipping: number;
    totalTax: number;
    netIncome: number;
    netMargin: number;
    monthlyRevenue: Array<{ _id: string; revenue: number; orders: number }>;
}

export default function IncomeStatementWrapper() {
    return (
        <React.Suspense fallback={<div className="h-[calc(100vh-40px)] flex items-center justify-center bg-background"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" /></div>}>
            <IncomeStatementPage />
        </React.Suspense>
    );
}

function IncomeStatementPage() {
    const r = useRouter();
    const s = useSearchParams();

    // Timezone-safe date initialization
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const firstOfMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

    const urlStart = s.get('startDate');
    const urlEnd = s.get('endDate');
    const urlSource = s.get('source') as 'total' | 'web' | 'wholesale';
    const urlSalesRep = s.get('salesRep');

    const [source, setSource] = useState<'total' | 'web' | 'wholesale'>(urlSource || 'total');
    const [dateRange, setDateRange] = useState({
        startDate: urlStart || firstOfMonthStr,
        endDate: urlEnd || todayStr
    });

    const [datePreset, setDatePreset] = useState<DatePreset>(
        (!urlStart && !urlEnd) ? 'this_month' : 'custom'
    );
    const [selectedReps, setSelectedReps] = useState<string[]>(urlSalesRep ? urlSalesRep.split(',') : []);
    const [filterOpen, setFilterOpen] = useState(false);
    const filterDropdownRef = React.useRef<HTMLDivElement>(null);
    const [salesRepOptions, setSalesRepOptions] = useState<{ label: string; value: string }[]>([]);

    useEffect(() => {
        fetch('/api/users?limit=1000')
            .then(res => res.json())
            .then(data => {
                const users = data.users || [];
                setSalesRepOptions(users.map((u: any) => ({
                    label: `${u.firstName} ${u.lastName}`,
                    value: u._id
                })));
            })
            .catch(console.error);
    }, []);

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

    const toggleRep = (repId: string) => {
        setSelectedReps(prev =>
            prev.includes(repId) ? prev.filter(r => r !== repId) : [...prev, repId]
        );
    };

    const applyFilters = () => {
        setFilterOpen(false);
        fetchData();
    };

    const [data, setData] = useState<IncomeData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const srQuery = selectedReps.length > 0 ? `&salesRep=${selectedReps.join(',')}` : '';
            const res = await fetch(`/api/reports/income-statement?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&source=${source}${srQuery}`);
            const json = await res.json();
            setData(json);

            // Sync with URL
            const params = new URLSearchParams();
            if (dateRange.startDate && dateRange.startDate !== 'all') params.set('startDate', dateRange.startDate);
            if (dateRange.endDate && dateRange.endDate !== 'all') params.set('endDate', dateRange.endDate);
            if (source && source !== 'total') params.set('source', source);
            if (selectedReps.length > 0) params.set('salesRep', selectedReps.join(','));

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
    }, [source]);

    const formatCurrency = (val: number) => {
        if (!val) return '$0';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
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
                            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <DollarSign className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-black tracking-tight uppercase text-foreground">Income Statement</h1>
                            </div>
                        </div>

                        {/* Source Filter Tabs */}
                        <div className="flex items-center bg-secondary/60 border border-border rounded-lg p-0.5">
                            <button
                                onClick={() => setSource('total')}
                                className={cn(
                                    'flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all cursor-pointer',
                                    source === 'total'
                                        ? 'bg-emerald-600 text-white shadow-md'
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
                                className={cn(
                                    "flex items-center gap-2 bg-secondary/60 hover:bg-secondary border border-border px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                                    (selectedReps.length > 0) 
                                        ? "border-emerald-500 text-emerald-600" 
                                        : "text-foreground"
                                )}
                            >
                                <Filter className="w-4 h-4" />
                                Filters {(selectedReps.length > 0) && `(${selectedReps.length})`}
                                <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                            </button>

                            {filterOpen && (
                                <div className="absolute right-0 top-full mt-2 w-[320px] bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
                                    <div className="p-4 border-b border-border">
                                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3 flex items-center gap-1.5 cursor-default">
                                            <Calendar className="w-3.5 h-3.5 text-emerald-500" /> Time Period
                                        </h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['this_month', 'last_month', 'this_year', 'last_year', 'all_time'] as DatePreset[]).map(preset => (
                                                <button
                                                    key={preset}
                                                    onClick={() => handlePresetChange(preset)}
                                                    className={cn(
                                                        "px-3 py-2 text-[11px] font-bold rounded-md transition-colors text-left border",
                                                        datePreset === preset
                                                            ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 shadow-sm"
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
                                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500/50 transition-colors" 
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
                                                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:border-emerald-500/50 transition-colors" 
                                            />
                                        </div>
                                    </div>

                                    <div className="p-4 max-h-[200px] overflow-y-auto scrollbar-custom border-b border-border">
                                        <div className="flex items-center justify-between mb-3 cursor-default">
                                            <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-blue-500" /> Sales Reps
                                            </h3>
                                            {selectedReps.length > 0 && (
                                                <button onClick={() => setSelectedReps([])} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-500 transition-colors">Clear</button>
                                            )}
                                        </div>
                                        {salesRepOptions.length === 0 ? (
                                            <div className="text-xs text-muted-foreground italic px-2">Loading reps...</div>
                                        ) : (
                                            <div className="space-y-1">
                                                {salesRepOptions.map(rep => (
                                                    <button
                                                        key={rep.value}
                                                        onClick={() => toggleRep(rep.value)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-3 py-2 rounded-md transition-all text-left group border",
                                                            selectedReps.includes(rep.value) 
                                                                ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" 
                                                                : "hover:bg-secondary text-muted-foreground border-transparent"
                                                        )}
                                                    >
                                                        <span className="text-xs font-bold leading-none">{rep.label}</span>
                                                        {selectedReps.includes(rep.value) && <Check className="w-3.5 h-3.5 animate-in zoom-in" />}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="p-4 bg-secondary/30 shrink-0 border-t border-border">
                                        <button 
                                            onClick={applyFilters}
                                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] uppercase tracking-wider px-4 py-3 rounded-lg transition-colors shadow-md"
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
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <SummaryCard 
                        label="Total Revenue"
                        value={loading ? '...' : formatCompact(data?.revenue?.total || 0)}
                        icon={TrendingUp}
                        color="emerald"
                        subtext={
                            source === 'web' ? `${data?.revenue?.webOrders || 0} Web Orders` :
                            source === 'wholesale' ? `${data?.revenue?.wholesaleOrders || 0} Wholesale Orders` :
                            `${data?.revenue?.webOrders || 0} Web + ${data?.revenue?.wholesaleOrders || 0} Wholesale`
                        }
                    />
                    <SummaryCard 
                        label="Gross Profit"
                        value={loading ? '...' : formatCompact(data?.grossProfit || 0)}
                        icon={PieChart}
                        color="blue"
                        subtext={`${data?.grossMargin?.toFixed(1) || 0}% Margin`}
                    />
                    <SummaryCard 
                        label="Cost of Goods"
                        value={loading ? '...' : formatCompact(data?.cogs || 0)}
                        icon={TrendingDown}
                        color="amber"
                        subtext="Click for SKU profitability"
                        onClick={() => r.push(`/reports/financials/cogs?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&source=${source}`)}
                    />
                    <SummaryCard 
                        label="Net Income"
                        value={loading ? '...' : formatCompact(data?.netIncome || 0)}
                        icon={DollarSign}
                        color="purple"
                        subtext={`${data?.netMargin?.toFixed(1) || 0}% Net Margin`}
                    />
                    </div>

                    {/* Income Statement Table */}
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                    {/* Table Header */}
                    <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                        <h2 className="font-bold text-lg text-foreground">Detailed Statement</h2>
                        <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                            <Download className="w-4 h-4" />
                            Export PDF
                        </button>
                    </div>

                    {/* Statement Rows */}
                    <div className="divide-y divide-border/40">
                        {/* REVENUE SECTION */}
                        <StatementSection title="Revenue" isHeader />
                        <StatementRow 
                            label="Web Sales Revenue" 
                            value={formatCurrency(data?.revenue?.web || 0)} 
                            indent
                            subLabel={`${data?.revenue?.webOrders || 0} orders`}
                        />
                        <StatementRow 
                            label="Wholesale Revenue" 
                            value={formatCurrency(data?.revenue?.wholesale || 0)} 
                            indent
                            subLabel={`${data?.revenue?.wholesaleOrders || 0} orders`}
                        />
                        <StatementRow 
                            label="Total Revenue" 
                            value={formatCurrency(data?.revenue?.total || 0)} 
                            isTotal
                            positive
                        />

                        {/* COGS SECTION */}
                        <StatementSection title="Cost of Goods Sold" isHeader />
                        <StatementRow 
                            label="Inventory Purchases" 
                            value={formatCurrency(data?.cogs || 0)} 
                            indent
                            negative
                        />
                        <StatementRow 
                            label="Total COGS" 
                            value={`(${formatCurrency(data?.cogs || 0)})`} 
                            isTotal
                            negative
                            onClick={() => r.push(`/reports/financials/cogs?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}&source=${source}`)}
                        />

                        {/* GROSS PROFIT */}
                        <StatementRow 
                            label="Gross Profit" 
                            value={formatCurrency(data?.grossProfit || 0)} 
                            isTotal
                            highlight
                            positive
                            margin={`${data?.grossMargin?.toFixed(1) || 0}%`}
                        />

                        {/* OPERATING EXPENSES */}
                        <StatementSection title="Operating Expenses" isHeader />
                        <StatementRow label="Salaries & Wages" value={formatCurrency(data?.operatingExpenses?.salaries || 0)} indent />
                        <StatementRow label="Marketing & Advertising" value={formatCurrency(data?.operatingExpenses?.marketing || 0)} indent />
                        <StatementRow label="Utilities" value={formatCurrency(data?.operatingExpenses?.utilities || 0)} indent />
                        <StatementRow label="Other Expenses" value={formatCurrency(data?.operatingExpenses?.other || 0)} indent />
                        <StatementRow 
                            label="Total Operating Expenses" 
                            value={`(${formatCurrency(data?.operatingExpenses?.total || 0)})`} 
                            isTotal
                            negative
                        />

                        {/* TAXES & FEES DEDUCTIONS */}
                        <StatementSection title="Taxes & Allowances" isHeader />
                        <StatementRow 
                            label="Shipping Income Ded." 
                            value={`(${formatCurrency(data?.totalShipping || 0)})`} 
                            indent 
                            negative
                        />
                        <StatementRow 
                            label="Tax Collected Ded." 
                            value={`(${formatCurrency(data?.totalTax || 0)})`} 
                            indent 
                            negative
                        />

                        {/* NET INCOME */}
                        <StatementRow 
                            label="Net Income" 
                            value={formatCurrency(data?.netIncome || 0)} 
                            isTotal
                            highlight
                            positive
                            margin={`${data?.netMargin?.toFixed(1) || 0}%`}
                            isFinal
                        />
                    </div>
                </div>

                {/* Monthly Revenue Chart */}
                <div className="mt-10 bg-card border border-border rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-emerald-500" />
                            <h3 className="font-bold text-foreground">Monthly Revenue Trend</h3>
                        </div>
                        <span className="text-xs text-muted-foreground">{data?.monthlyRevenue?.length || 0} months</span>
                    </div>
                    
                    {data?.monthlyRevenue && data.monthlyRevenue.length > 0 ? (
                        <div className="flex items-end gap-3 h-56">
                            {data.monthlyRevenue.map((month, idx) => {
                                const revenues = data.monthlyRevenue.map(m => m.revenue || 0);
                                const maxRev = Math.max(...revenues, 1);
                                const heightPx = Math.max(8, Math.round((month.revenue / maxRev) * 180));
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center justify-end group" style={{ height: '100%' }}>
                                        <div className="text-[10px] text-emerald-600 font-bold mb-1">
                                            {formatCompact(month.revenue)}
                                        </div>
                                        <div 
                                            className="w-full max-w-[60px] mx-auto bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all group-hover:from-emerald-500 group-hover:to-emerald-300 cursor-pointer hover:scale-105"
                                            style={{ height: `${heightPx}px` }}
                                            title={`${month._id}: ${formatCurrency(month.revenue)} (${month.orders} orders)`}
                                        />
                                        <div className="text-[10px] text-muted-foreground font-bold mt-2">
                                            {month._id?.split('-')[1] || idx}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">
                            {loading ? 'Loading chart data...' : 'No monthly data available for this period.'}
                        </div>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color, subtext, onClick }: {
    label: string;
    value: string;
    icon: any;
    color: 'emerald' | 'blue' | 'amber' | 'purple';
    subtext?: string;
    onClick?: () => void;
}) {
    const colorStyles: Record<string, { bg: string; border: string; text: string; iconColor: string }> = {
        emerald: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#10b981', iconColor: '#10b981' },
        blue: { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.25)', text: '#3b82f6', iconColor: '#3b82f6' },
        amber: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#f59e0b', iconColor: '#f59e0b' },
        purple: { bg: 'rgba(168,85,247,0.12)', border: 'rgba(168,85,247,0.25)', text: '#a855f7', iconColor: '#a855f7' }
    };

    const cs = colorStyles[color];

    return (
        <div 
            onClick={onClick}
            className={cn("rounded-2xl p-6 relative overflow-hidden group border transition-all", onClick && "cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:border-foreground/20")}
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

function StatementSection({ title, isHeader }: { title: string; isHeader?: boolean }) {
    return (
        <div className="px-6 py-3 bg-secondary/40">
            <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{title}</span>
        </div>
    );
}

function StatementRow({ 
    label, 
    value, 
    indent, 
    isTotal, 
    highlight, 
    positive, 
    negative,
    subLabel,
    margin,
    isFinal,
    onClick
}: { 
    label: string; 
    value: string; 
    indent?: boolean;
    isTotal?: boolean;
    highlight?: boolean;
    positive?: boolean;
    negative?: boolean;
    subLabel?: string;
    margin?: string;
    isFinal?: boolean;
    onClick?: () => void;
}) {
    return (
        <div 
            onClick={onClick}
            className={cn(
                "px-6 py-4 flex items-center justify-between group transition-all",
                highlight ? "bg-secondary/50" : "hover:bg-secondary/30",
                isFinal && "bg-gradient-to-r from-emerald-500/10 to-transparent border-t-2 border-emerald-500/30",
                onClick && "cursor-pointer hover:bg-secondary/60"
            )}
        >
            <div className={cn("flex items-center gap-2", indent && "pl-6")}>
                {indent && <Minus className="w-3 h-3 text-muted-foreground/50" />}
                <span className={cn(
                    "text-sm",
                    isTotal ? "font-bold text-foreground" : "text-muted-foreground",
                    highlight && "text-lg font-black"
                )}>
                    {label}
                </span>
                {subLabel && <span className="text-xs text-muted-foreground/60 ml-2">({subLabel})</span>}
            </div>
            <div className="flex items-center gap-4">
                {margin && (
                    <span className="text-xs font-bold bg-emerald-500/15 text-emerald-600 px-2 py-0.5 rounded-full">
                        {margin}
                    </span>
                )}
                <span className={cn(
                    "font-mono text-sm",
                    isTotal ? "font-bold text-foreground" : "text-muted-foreground",
                    positive && "text-emerald-600",
                    negative && "text-red-500",
                    highlight && "text-lg font-black"
                )}>
                    {value}
                </span>
            </div>
        </div>
    );
}
