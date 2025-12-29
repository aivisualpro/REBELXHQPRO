'use client';

import React, { useState } from 'react';
import { 
    TrendingUp, DollarSign, Activity, PieChart, BarChart3, 
    ArrowUpRight, ArrowDownRight, Calendar, Download, Filter,
    Briefcase, CreditCard, Wallet, LineChart, Layers, AlertCircle,
    Factory, Lock, ArrowLeft
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function BusinessReportsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [timeRange, setTimeRange] = useState('Month to Date');

    // ROLE-BASED ACCESS CONTROL
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    // LOADING STATE
    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-40px)] bg-slate-50">
                <div className="text-slate-400 text-[10px] font-mono uppercase tracking-widest animate-pulse">
                    Decrypting Financial Data...
                </div>
            </div>
        );
    }

    // SECURITY GATE
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-40px)] bg-slate-50 border-t border-slate-200">
                <Lock className="w-12 h-12 text-slate-300 mb-6" />
                <h1 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Executive Clearance Required</h1>
                <p className="text-sm text-slate-400 mt-3 max-w-md text-center leading-relaxed">
                    This interface exposes live, unfiltered financial data including COGM variances and net profit margins. Access is strictly limited to C-Suite and Senior Admin roles.
                </p>
                <button 
                    onClick={() => router.push('/')} 
                    className="mt-8 px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                    Return to Operational Dashboard
                </button>
            </div>
        );
    }

    // Simulate Financial Data
    const metrics = [
        {
            label: "Gross Revenue",
            value: "$142,892.00",
            change: "+12.4%",
            trend: "up",
            desc: "Valid orders after spam filtration",
            icon: <DollarSign className="w-4 h-4 text-emerald-600" />
        },
        {
            label: "Net Profit (EBITDA)",
            value: "$48,201.50",
            change: "+8.1%",
            trend: "up",
            desc: "After COGS, Labor & Opex",
            icon: <Wallet className="w-4 h-4 text-blue-600" />
        },
        {
            label: "Avg. Order Value",
            value: "$76.40",
            change: "-2.3%",
            trend: "down",
            desc: "Reviewing seasonal bundles",
            icon: <CreditCard className="w-4 h-4 text-purple-600" />
        },
        {
            label: "Gross Margin",
            value: "62.4%",
            change: "+2.4%",
            trend: "up", 
            desc: "After COGM deduction",
            icon: <Factory className="w-4 h-4 text-amber-600" />
        }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden bg-white">
            
            {/* Page Header - Exact match to SKU Detail Shell (h-10) */}
            <div className="sticky top-0 z-[10] bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-10 shadow-sm">
                <div className="flex items-center space-x-3">
                     <button onClick={() => router.back()} className="hover:bg-slate-100 transition-colors p-1 rounded-full">
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                        <Briefcase className="w-3 h-3" />
                        <span>Executive Reporting</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200" />
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                        Business Intelligence
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-sm">
                        {['Today', 'Week', 'Month', 'Year'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={cn(
                                    "px-3 py-0.5 text-[9px] font-bold uppercase tracking-wide transition-all rounded-sm",
                                    timeRange === range 
                                        ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <div className="h-4 w-px bg-slate-200 hidden md:block" />
                    <button className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5" title="Export PDF">
                        <Download className="w-3.5 h-3.5" /> 
                    </button>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 scrollbar-custom">
                <div className="max-w-[1600px] mx-auto px-6 py-8 space-y-8">
                    
                    {/* Executive Summary Section */}
                    <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <Activity className="w-4 h-4 text-slate-400" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">
                                Executive Summary • <span className="text-emerald-600">{timeRange.toUpperCase()}</span>
                            </h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                            {metrics.map((metric, idx) => (
                                <div key={idx} className="group relative p-4 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all bg-slate-50/30">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="p-1.5 bg-white border border-slate-100 rounded-sm">
                                            {metric.icon}
                                        </div>
                                        <div className={cn(
                                            "flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-sm",
                                            metric.trend === 'up' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                        )}>
                                            {metric.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                            {metric.change}
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{metric.label}</div>
                                    <div className="text-xl font-black text-slate-900 tracking-tight mb-2">{metric.value}</div>
                                    <div className="text-[9px] text-slate-500 font-medium border-l-2 border-slate-200 pl-2 leading-tight">
                                        {metric.desc}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Deep Dive Analysis Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Left Col: Revenue Composition */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                                        <BarChart3 className="w-4 h-4 text-slate-400" />
                                        Revenue Composition
                                    </h3>
                                    <div className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">SOURCE: LEDGER_V2</div>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                                            <span>Wholesale (B2B)</span>
                                            <span className="text-slate-900">$84,200.00 (59%)</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 overflow-hidden rounded-full">
                                            <div className="h-full bg-slate-900 w-[59%]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                                            <span>DTC / E-Commerce</span>
                                            <span className="text-slate-900">$48,102.00 (34%)</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 overflow-hidden rounded-full">
                                            <div className="h-full bg-emerald-500 w-[34%]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                                            <span>Raw Material Sales</span>
                                            <span className="text-slate-900">$10,590.00 (7%)</span>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 overflow-hidden rounded-full">
                                            <div className="h-full bg-blue-500 w-[7%]" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <p className="text-sm font-serif leading-relaxed text-slate-600 bg-slate-50 p-4 border-l-4 border-slate-200">
                                        <strong className="block text-[10px] uppercase font-sans font-bold text-slate-400 mb-2">Strategic Insight</strong>
                                        Wholesale continues to dominate revenue share, but DTC margins have improved by 2.4% following the "Spam Filtration" project which clarified our actual customer acquisition costs. The <span className="font-mono text-[10px] bg-white border border-slate-200 px-1 rounded mx-1">COGM_LIVE</span> metric indicates that raw material sales are currently our lowest margin channel and should perhaps be reviewed by the Neural Board for optimization.
                                    </p>
                                </div>
                            </div>

                            {/* Recent Alerts / Anomalies */}
                            <div className="bg-slate-900 text-white p-6 border border-slate-800 relative overflow-hidden shadow-2xl rounded-sm">
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                    <AlertCircle className="w-32 h-32" />
                                </div>
                                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-6 text-emerald-400">
                                    <Activity className="w-4 h-4" />
                                    Neural Board: Anomaly Detection
                                </h3>
                                <div className="space-y-4 relative z-10">
                                    <div className="flex gap-4 items-start border-l-2 border-emerald-500 pl-4 py-1">
                                        <div className="text-[9px] font-mono opacity-50 pt-1 w-12">09:41 AM</div>
                                        <div>
                                            <div className="text-sm font-bold text-emerald-200">Unusual Margin Compression</div>
                                            <div className="text-xs text-slate-300 mt-1 leading-relaxed max-w-lg">
                                                Detected a 4% variance in COGM for "Kratom Powder 500g" batch #L-992. Labor hours exceeded standard recipe time by 45 minutes.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start border-l-2 border-blue-500 pl-4 py-1">
                                        <div className="text-[9px] font-mono opacity-50 pt-1 w-12">08:15 AM</div>
                                        <div>
                                            <div className="text-sm font-bold text-blue-200">Capital Efficiency Potential</div>
                                            <div className="text-xs text-slate-300 mt-1 leading-relaxed max-w-lg">
                                                Inventory turnover for "Extract Shots" has slowed significantly. Recommended action: Initiate targeted email campaign to active 60-day cohort.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Col: Cost Analysis */}
                        <div className="space-y-6">
                            <div className="bg-white border border-slate-200 p-6 h-full flex flex-col shadow-sm rounded-sm">
                                <div className="mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                                        <Layers className="w-4 h-4 text-slate-400" />
                                        Cost Breakdown
                                    </h3>
                                    <div className="text-[9px] text-slate-400 mt-1 font-mono">PERIOD: {timeRange.toUpperCase()}</div>
                                </div>

                                <div className="flex-1 flex flex-col justify-center space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                        <div className="text-[10px] font-bold uppercase text-slate-500">Raw Materials</div>
                                        <div className="text-xs font-mono font-bold text-slate-900">42%</div>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                        <div className="text-[10px] font-bold uppercase text-slate-500">Labor (Tracked)</div>
                                        <div className="text-xs font-mono font-bold text-slate-900">28%</div>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                        <div className="text-[10px] font-bold uppercase text-slate-500">Packaging</div>
                                        <div className="text-xs font-mono font-bold text-slate-900">12%</div>
                                    </div>
                                    <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                        <div className="text-[10px] font-bold uppercase text-slate-500">Overhead/Ops</div>
                                        <div className="text-xs font-mono font-bold text-slate-900">18%</div>
                                    </div>
                                </div>

                                <div className="mt-8 text-[10px] text-slate-500 leading-relaxed italic border-t border-slate-100 pt-6">
                                    <strong className="block text-[9px] uppercase font-sans font-bold text-slate-400 mb-2 not-italic">Operational Memo</strong>
                                    "Labor costs are trending downward due to the new automated shutoff feature in the Manufacturing module. Packaging variance remains stable."
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-emerald-50 border border-emerald-100 p-6 shadow-sm rounded-sm">
                                <h3 className="text-[9px] font-black uppercase tracking-widest text-emerald-800 mb-4 flex items-center gap-2">
                                    <Briefcase className="w-3 h-3" />
                                    Strategic Actions
                                </h3>
                                <div className="space-y-2">
                                    <button className="w-full py-2.5 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 rounded-sm">
                                        Download P&L Statement
                                    </button>
                                    <button className="w-full py-2.5 bg-white border border-emerald-200 text-emerald-700 text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-50 transition-colors rounded-sm">
                                        Audit COGM Variance
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
