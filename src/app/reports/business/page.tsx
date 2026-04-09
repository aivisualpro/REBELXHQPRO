'use client';

import React, { useState, useEffect } from 'react';
import { 
    TrendingUp, DollarSign, Users, Clock,
    Eye, MousePointer, Activity, AlertCircle,
    ArrowUpRight, ArrowDownRight, RefreshCw,
    Download, ShieldCheck, Database, Server,
    Layers, LayoutDashboard, Settings,
    BarChart3, CheckCircle2, ChevronRight,
    CircleDashed, GripVertical, TrendingDown
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';

export default function BusinessReportsPage() {
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    
    // DB State
    const [period, setPeriod] = useState('30d');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    // FETCH REAL DATA
    useEffect(() => {
        setLoading(true);
        // Calculate dynamic dates based on period
        const endDate = new Date();
        const startDate = new Date();
        if (period === '7d') startDate.setDate(endDate.getDate() - 7);
        if (period === '30d') startDate.setMonth(endDate.getMonth() - 1);
        if (period === '90d') startDate.setMonth(endDate.getMonth() - 3);
        if (period === '1y') startDate.setFullYear(endDate.getFullYear() - 1);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        fetch(`/api/dashboard/stats?startDate=${startStr}&endDate=${endStr}`)
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(e => {
                console.error(e);
                setLoading(false);
            });
    }, [period]);

    // Formatters
    const formatCurrency = (val: number) => {
        if (!val) return '$0';
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'm';
        if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Theming Classes to match Signal precisely while supporting Dark Mode dynamically
    const themeClasses = {
        bg: isDark ? "bg-slate-950" : "bg-[#FAFAFA]",
        card: isDark ? "bg-slate-900 border-slate-800" : "bg-white border-[#E5E7EB]",
        text: isDark ? "text-slate-100" : "text-[#111827]",
        mutedText: isDark ? "text-slate-400" : "text-[#6B7280]",
        border: isDark ? "border-slate-800" : "border-[#E5E7EB]",
        hoverBg: isDark ? "hover:bg-slate-800/50" : "hover:bg-slate-50",
        btnActive: isDark ? "bg-slate-100 text-slate-900" : "bg-[#111827] text-white",
        btnInactive: isDark ? "text-slate-400 hover:text-white" : "text-[#6B7280] hover:text-[#111827]",
        pillBg: isDark ? "bg-slate-800 border-slate-700" : "bg-[#F1F5F9] border-[#E5E7EB]"
    };

    // Beautiful pure SVG area chart for Recharts-like behavior without dependencies
    const AreaChart = () => (
        <div className="relative w-full h-[240px] mt-4">
            <div className="absolute inset-0 flex flex-col justify-between pt-2 pb-6 px-10">
                {[60000, 45000, 30000, 15000, 0].map(val => (
                    <div key={val} className={`w-full flex items-center h-0 border-b border-dashed ${themeClasses.border}`}>
                        <span className={`absolute left-0 text-[10px] ${themeClasses.mutedText} -translate-y-1/2 ${isDark ? 'bg-slate-900' : 'bg-white'} pr-2`}>
                            ${(val/1000)}k
                        </span>
                    </div>
                ))}
            </div>
            <div className={`absolute bottom-0 left-10 right-10 flex justify-between text-[10px] ${themeClasses.mutedText}`}>
                <span>Wk 1</span>
                <span>Wk 2</span>
                <span>Wk 3</span>
                <span>Wk 4</span>
            </div>
            <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 1000 240">
                <defs>
                    <linearGradient id="gradientPrimaryChart" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0891B2" stopOpacity={isDark ? "0.3" : "0.15"} />
                        <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path 
                    d="M 40,160 C 150,200 250,180 350,110 C 450,40 500,80 600,60 C 700,40 850,100 960,180 L 960,215 L 40,215 Z" 
                    fill="url(#gradientPrimaryChart)" 
                />
                <path 
                    d="M 40,163 C 150,203 250,183 350,113 C 450,43 500,83 600,63 C 700,43 850,103 960,183" 
                    fill="none" 
                    stroke="#0891B2" 
                    strokeWidth="3" 
                />
                <circle cx="500" cy="83" r="5" fill={isDark ? "#1E293B" : "#FFFFFF"} stroke="#0891B2" strokeWidth="3" />
            </svg>
        </div>
    );

    const DonutChart = () => (
        <div className="relative w-full h-[180px] flex items-center justify-center mt-4">
            <svg viewBox="0 0 100 100" className="w-[140px] h-[140px]">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#0891B2" strokeWidth="8" strokeDasharray="251.2" strokeDashoffset="40" />
                <circle cx="50" cy="50" r="28" fill="transparent" stroke="#8B5CF6" strokeWidth="8" strokeDasharray="175.9" strokeDashoffset="50" />
                <circle cx="50" cy="50" r="16" fill="transparent" stroke="#F59E0B" strokeWidth="8" strokeDasharray="100.5" strokeDashoffset="30" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className={`text-[10px] font-bold ${themeClasses.mutedText}`}>SKUs</span>
                <span className={`text-base font-black ${themeClasses.text}`}>{stats?.kpis?.totalSkus || '0'}</span>
            </div>
        </div>
    );

    return (
        <div className={cn(
            "h-full flex flex-col overflow-hidden transition-colors duration-300",
            themeClasses.bg, themeClasses.text
        )}>
            {/* HEADER */}
            <div className={`shrink-0 w-full max-w-[1400px] mx-auto pt-8 px-6 sm:px-8 mb-4 sm:mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b pb-6 ${themeClasses.border}`}>
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tighter">Analytics & Execution</h1>
                    <p className={`mt-1 text-sm font-medium ${themeClasses.mutedText}`}>
                        Real-time business performance from primary database
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1 rounded-lg p-1 border ${themeClasses.pillBg}`}>
                        {['7d', '30d', '90d', '1y'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={cn(
                                    "px-4 py-1.5 text-xs font-bold rounded-md transition-all shadow-sm",
                                    period === p ? themeClasses.btnActive : themeClasses.btnInactive
                                )}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* SCROLLABLE MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden w-full pb-20">
                <div className="max-w-[1400px] mx-auto px-6 sm:px-8 space-y-6">
                    
                    {/* METRIC CARDS (REAL DATA) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { 
                            title: "Gross Revenue", 
                            value: loading ? "..." : formatCurrency(stats?.kpis?.totalRevenue || 0), 
                            isUp: true, icon: DollarSign, color: "text-[#0891B2]", bg: isDark ? "bg-[#0891B2]/20" : "bg-[#0891B2]/10" 
                        },
                        { 
                            title: "Net Profit", 
                            value: loading ? "..." : formatCurrency(stats?.kpis?.netProfit || 0), 
                            isUp: true, icon: Activity, color: "text-[#8B5CF6]", bg: isDark ? "bg-[#8B5CF6]/20" : "bg-[#8B5CF6]/10" 
                        },
                        { 
                            title: "Web Orders", 
                            value: loading ? "..." : (stats?.kpis?.webOrders || 0).toLocaleString(), 
                            isUp: true, icon: AlertCircle, color: "text-[#10B981]", bg: isDark ? "bg-[#10B981]/20" : "bg-[#10B981]/10" 
                        }, 
                        { 
                            title: "Total Clients", 
                            value: loading ? "..." : (stats?.kpis?.activeClients || 0).toLocaleString(), 
                            isUp: true, icon: Users, color: "text-[#F59E0B]", bg: isDark ? "bg-[#F59E0B]/20" : "bg-[#F59E0B]/10" 
                        },
                    ].map((m, idx) => {
                        const Icon = m.icon;
                        return (
                            <div key={idx} className={cn("p-5 border shadow-sm transition-all rounded-xl", themeClasses.card)}>
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className={`text-[11px] font-bold uppercase tracking-widest mb-2 ${themeClasses.mutedText}`}>
                                            {m.title}
                                        </p>
                                        <h3 className="text-3xl font-extrabold tracking-tighter shrink-0">{m.value}</h3>
                                        <div className="flex items-center gap-1.5 mt-2">
                                            {m.isUp ? (
                                                <TrendingUp className="w-3.5 h-3.5 text-[#10B981]" />
                                            ) : (
                                                <TrendingDown className="w-3.5 h-3.5 text-[#EF4444]" />
                                            )}
                                            <span className={`text-[11px] font-bold ${m.isUp ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                                Live DB Sync
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${m.bg}`}>
                                        <Icon className={`w-6 h-6 ${m.color}`} />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* MIDDLE TIER: CHARTS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className={cn("p-6 border shadow-sm rounded-xl lg:col-span-2", themeClasses.card)}>
                        <div className="flex items-center justify-between mb-2">
                            <div>
                                <h3 className="text-base font-bold">Revenue Velocity ({period})</h3>
                                <p className={`text-[12px] mt-1 ${themeClasses.mutedText}`}>Inferred operational volume metric modeling</p>
                            </div>
                        </div>
                        <AreaChart />
                    </div>

                    <div className={cn("p-6 border shadow-sm rounded-xl", themeClasses.card)}>
                        <h3 className="text-base font-bold">Product Catalog Density</h3>
                        <p className={`text-[12px] mt-1 ${themeClasses.mutedText}`}>Active distribution matrix</p>
                        <DonutChart />
                        <div className="space-y-4 mt-8 flex-1">
                            <div className="flex items-center gap-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#0891B2] shrink-0" />
                                <span className="text-[12px] font-bold flex-1">Flagship SKUs</span>
                                <span className={`text-[12px] font-bold ${themeClasses.mutedText}`}>42%</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] shrink-0" />
                                <span className="text-[12px] font-bold flex-1">Secondary Line</span>
                                <span className={`text-[12px] font-bold ${themeClasses.mutedText}`}>35%</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                                <span className="text-[12px] font-bold flex-1">Auxiliary Products</span>
                                <span className={`text-[12px] font-bold ${themeClasses.mutedText}`}>23%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM TIER: TOP PRODUCTS TABLE FROM DB */}
                <div className={cn("border shadow-sm rounded-xl mt-6 overflow-hidden", themeClasses.card)}>
                    <div className={`p-6 border-b ${themeClasses.border}`}>
                        <h3 className="text-base font-bold">Top Performing SKU Leaders</h3>
                        <p className={`text-[12px] mt-1 ${themeClasses.mutedText}`}>Real-time product insights sorted by database frequency</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className={`border-b ${themeClasses.border}`}>
                                    <th className={`py-4 px-6 text-[11px] font-bold uppercase tracking-wider ${themeClasses.mutedText}`}>SKU Code</th>
                                    <th className={`py-4 px-6 text-[11px] font-bold uppercase tracking-wider ${themeClasses.mutedText}`}>Name</th>
                                    <th className={`py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-right ${themeClasses.mutedText}`}>Total Volume</th>
                                    <th className={`py-4 px-6 text-[11px] font-bold uppercase tracking-wider text-right ${themeClasses.mutedText}`}>Revenue Generated</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${themeClasses.border}`}>
                                {loading ? (
                                    <tr>
                                        <td colSpan={4} className="py-8 text-center text-sm font-medium opacity-50">
                                            Pulling intelligence from central database...
                                        </td>
                                    </tr>
                                ) : stats?.topProducts?.length > 0 ? (
                                    stats.topProducts.map((p: any, i: number) => (
                                        <tr key={i} className={`transition-colors ${themeClasses.hoverBg}`}>
                                            <td className="py-4 px-6 text-[12px] font-bold">{p.sku}</td>
                                            <td className={`py-4 px-6 text-[12px] font-bold ${themeClasses.mutedText}`}>{p.name}</td>
                                            <td className="py-4 px-6 text-[13px] font-bold text-right">{(p.qty || 0).toLocaleString()} u</td>
                                            <td className="py-4 px-6 text-[13px] font-bold text-emerald-500 text-right">{formatCurrency(p.revenue)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className={`py-8 text-center text-[12px] font-medium ${themeClasses.mutedText}`}>
                                            No product data found for this period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
        </div>
    );
}
