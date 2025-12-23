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
    ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    netIncome: number;
    netMargin: number;
    monthlyRevenue: Array<{ _id: string; revenue: number; orders: number }>;
}

export default function IncomeStatementPage() {
    const [data, setData] = useState<IncomeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Jan 1
        endDate: new Date().toISOString().split('T')[0] // Today
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/reports/income-statement?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const formatCurrency = (val: number) => {
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
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 lg:p-10">
            {/* Header */}
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                <DollarSign className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">Income Statement</h1>
                                <p className="text-slate-400 text-sm">Profit & Loss Report</p>
                            </div>
                        </div>
                    </div>

                    {/* Date Range Picker */}
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <input 
                                type="date" 
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                                className="bg-transparent text-sm text-white focus:outline-none"
                            />
                            <span className="text-slate-500">to</span>
                            <input 
                                type="date" 
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                                className="bg-transparent text-sm text-white focus:outline-none"
                            />
                        </div>
                        <button 
                            onClick={fetchData}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
                        >
                            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                            Apply
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    <SummaryCard 
                        label="Total Revenue"
                        value={loading ? '...' : formatCompact(data?.revenue?.total || 0)}
                        icon={TrendingUp}
                        color="emerald"
                        subtext={`${data?.revenue?.webOrders || 0} Web + ${data?.revenue?.wholesaleOrders || 0} Wholesale`}
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
                        subtext="Procurement cost"
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
                <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden">
                    {/* Table Header */}
                    <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
                        <h2 className="font-bold text-lg">Detailed Statement</h2>
                        <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                            <Download className="w-4 h-4" />
                            Export PDF
                        </button>
                    </div>

                    {/* Statement Rows */}
                    <div className="divide-y divide-slate-700/30">
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
                <div className="mt-10 bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <BarChart3 className="w-5 h-5 text-emerald-400" />
                            <h3 className="font-bold">Monthly Revenue Trend</h3>
                        </div>
                        <span className="text-xs text-slate-500">{data?.monthlyRevenue?.length || 0} months</span>
                    </div>
                    
                    {data?.monthlyRevenue && data.monthlyRevenue.length > 0 ? (
                        <div className="flex items-end gap-3 h-56">
                            {data.monthlyRevenue.map((month, idx) => {
                                const revenues = data.monthlyRevenue.map(m => m.revenue || 0);
                                const maxRev = Math.max(...revenues, 1);
                                // Calculate height in pixels (container is h-56 = 224px, minus label space ~40px = 184px usable)
                                const heightPx = Math.max(8, Math.round((month.revenue / maxRev) * 180));
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center justify-end group" style={{ height: '100%' }}>
                                        <div className="text-[10px] text-emerald-300 font-bold mb-1">
                                            {formatCompact(month.revenue)}
                                        </div>
                                        <div 
                                            className="w-full max-w-[60px] mx-auto bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-lg transition-all group-hover:from-emerald-500 group-hover:to-emerald-300 cursor-pointer hover:scale-105"
                                            style={{ height: `${heightPx}px` }}
                                            title={`${month._id}: ${formatCurrency(month.revenue)} (${month.orders} orders)`}
                                        />
                                        <div className="text-[10px] text-slate-400 font-bold mt-2">
                                            {month._id?.split('-')[1] || idx}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-56 flex items-center justify-center text-slate-500 text-sm">
                            {loading ? 'Loading chart data...' : 'No monthly data available for this period.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, icon: Icon, color, subtext }: {
    label: string;
    value: string;
    icon: any;
    color: 'emerald' | 'blue' | 'amber' | 'purple';
    subtext?: string;
}) {
    const colorClasses = {
        emerald: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400',
        blue: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400',
        amber: 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400',
        purple: 'from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-400'
    };

    return (
        <div className={cn(
            "bg-gradient-to-br border rounded-2xl p-6 relative overflow-hidden group",
            colorClasses[color]
        )}>
            <div className="flex items-center justify-between mb-4">
                <Icon className={cn("w-6 h-6", colorClasses[color].split(' ').pop())} />
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
            </div>
            <div className="text-3xl font-black text-white mb-1">{value}</div>
            <div className="text-sm font-medium text-slate-400">{label}</div>
            {subtext && <div className="text-xs text-slate-500 mt-1">{subtext}</div>}
        </div>
    );
}

function StatementSection({ title, isHeader }: { title: string; isHeader?: boolean }) {
    return (
        <div className="px-6 py-3 bg-slate-700/20">
            <span className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</span>
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
    isFinal
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
}) {
    return (
        <div className={cn(
            "px-6 py-4 flex items-center justify-between group hover:bg-slate-700/20 transition-colors",
            highlight && "bg-slate-700/30",
            isFinal && "bg-gradient-to-r from-emerald-500/10 to-transparent border-t-2 border-emerald-500/30"
        )}>
            <div className={cn("flex items-center gap-2", indent && "pl-6")}>
                {indent && <Minus className="w-3 h-3 text-slate-600" />}
                <span className={cn(
                    "text-sm",
                    isTotal ? "font-bold text-white" : "text-slate-300",
                    highlight && "text-lg font-black"
                )}>
                    {label}
                </span>
                {subLabel && <span className="text-xs text-slate-500 ml-2">({subLabel})</span>}
            </div>
            <div className="flex items-center gap-4">
                {margin && (
                    <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full">
                        {margin}
                    </span>
                )}
                <span className={cn(
                    "font-mono text-sm",
                    isTotal ? "font-bold text-white" : "text-slate-300",
                    positive && "text-emerald-400",
                    negative && "text-red-400",
                    highlight && "text-lg font-black"
                )}>
                    {value}
                </span>
            </div>
        </div>
    );
}
