'use client';

import React, { useState } from 'react';
import { 
    TrendingUp, DollarSign, Activity, PieChart, BarChart3, 
    ArrowUpRight, ArrowDownRight, Calendar, Download, Filter,
    Briefcase, CreditCard, Wallet, LineChart, Layers, AlertCircle,
    Factory, Lock
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
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-slate-50">
                <div className="text-slate-400 text-[10px] font-mono uppercase tracking-widest animate-pulse">
                    Decrypting Financial Data...
                </div>
            </div>
        );
    }

    // SECURITY GATE
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-slate-50 border-t border-slate-200">
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

    // Simulate Financial Data (would be API driven in production)
    const metrics = [
        {
            label: "Gross Revenue",
            value: "$142,892.00",
            change: "+12.4%",
            trend: "up",
            desc: "Valid orders after spam filtration",
            icon: <DollarSign className="w-5 h-5 text-emerald-600" />
        },
        {
            label: "Net Profit (EBITDA)",
            value: "$48,201.50",
            change: "+8.1%",
            trend: "up",
            desc: "After COGS, Labor & Opex",
            icon: <Wallet className="w-5 h-5 text-blue-600" />
        },
        {
            label: "Avg. Order Value",
            value: "$76.40",
            change: "-2.3%",
            trend: "down",
            desc: "Reviewing seasonal bundles",
            icon: <CreditCard className="w-5 h-5 text-purple-600" />
        },
        {
            label: "Gross Margin",
            value: "62.4%",
            change: "+2.4%",
            trend: "up", 
            desc: "After COGM deduction",
            icon: <Factory className="w-5 h-5 text-amber-600" />
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
            
            {/* Page Header - Flat Design (Replaces Global Header Actions) */}
            <div className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-30 shadow-sm">
                <div>
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">
                        <Briefcase className="w-3 h-3" />
                        <span>Executive Reporting</span>
                    </div>
                    <h1 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
                        Business Intelligence
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-100 border border-slate-200 p-1 rounded-sm">
                        {['Today', 'Week', 'Month to Date', 'Year'].map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={cn(
                                    "px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all rounded-sm",
                                    timeRange === range 
                                        ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
                                        : "text-slate-400 hover:text-slate-600"
                                )}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <button className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors flex items-center gap-2 rounded-sm shadow-md">
                        <Download className="w-3 h-3" /> Export PDF
                    </button>
                </div>
            </div>

            <div className="max-w-[1600px] mx-auto px-8 py-8 space-y-8">
                
                {/* Executive Summary Section */}
                <div className="bg-white border border-slate-200 p-8 shadow-sm">
                    <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                        <Activity className="w-5 h-5 text-slate-400" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                            Executive Summary • <span className="text-emerald-600">{timeRange}</span>
                        </h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                        {metrics.map((metric, idx) => (
                            <div key={idx} className="group relative">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="p-2 bg-slate-50 group-hover:bg-slate-100 transition-colors border border-slate-100 rounded-sm">
                                        {metric.icon}
                                    </div>
                                    <div className={cn(
                                        "flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-sm",
                                        metric.trend === 'up' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                    )}>
                                        {metric.trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                        {metric.change}
                                    </div>
                                </div>
                                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{metric.label}</div>
                                <div className="text-2xl font-black text-slate-900 tracking-tight">{metric.value}</div>
                                <div className="text-[10px] text-slate-500 mt-2 font-medium border-l-2 border-slate-200 pl-2 leading-tight">
                                    {metric.desc}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Deep Dive Analysis Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left Col: Revenue Composition */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white border border-slate-200 p-8 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                                    <BarChart3 className="w-4 h-4 text-slate-400" />
                                    Revenue Composition
                                </h3>
                                <div className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">SOURCE: LEDGER_V2</div>
                            </div>
                            
                            <div className="space-y-8">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                                        <span>Wholesale (B2B)</span>
                                        <span className="text-slate-900">$84,200.00 (59%)</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-100 overflow-hidden rounded-full">
                                        <div className="h-full bg-slate-900 w-[59%]" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                                        <span>DTC / E-Commerce</span>
                                        <span className="text-slate-900">$48,102.00 (34%)</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-100 overflow-hidden rounded-full">
                                        <div className="h-full bg-emerald-500 w-[34%]" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                                        <span>Raw Material Sales</span>
                                        <span className="text-slate-900">$10,590.00 (7%)</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-100 overflow-hidden rounded-full">
                                        <div className="h-full bg-blue-500 w-[7%]" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-slate-100">
                                <p className="text-sm font-serif leading-relaxed text-slate-600 bg-slate-50 p-4 border-l-4 border-slate-200">
                                    <strong className="block text-xs uppercase font-sans font-bold text-slate-400 mb-2">Strategic Insight</strong>
                                    Wholesale continues to dominate revenue share, but DTC margins have improved by 2.4% following the "Spam Filtration" project which clarified our actual customer acquisition costs. The <span className="font-mono text-xs bg-white border border-slate-200 px-1 rounded mx-1">COGM_LIVE</span> metric indicates that raw material sales are currently our lowest margin channel and should perhaps be reviewed by the Neural Board for optimization.
                                </p>
                            </div>
                        </div>

                        {/* Recent Alerts / Anomalies */}
                        <div className="bg-slate-900 text-white p-8 border border-slate-800 relative overflow-hidden shadow-2xl">
                            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <AlertCircle className="w-48 h-48" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 mb-8 text-emerald-400">
                                <Activity className="w-4 h-4" />
                                Neural Board: Anomaly Detection
                            </h3>
                            <div className="space-y-6 relative z-10">
                                <div className="flex gap-4 items-start border-l-2 border-emerald-500 pl-4 py-1">
                                    <div className="text-[10px] font-mono opacity-50 pt-1 w-16">09:41 AM</div>
                                    <div>
                                        <div className="text-sm font-bold text-emerald-200">Unusual Margin Compression</div>
                                        <div className="text-xs text-slate-300 mt-1 leading-relaxed max-w-lg">
                                            Detected a 4% variance in COGM for "Kratom Powder 500g" batch #L-992. Labor hours exceeded standard recipe time by 45 minutes.
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start border-l-2 border-blue-500 pl-4 py-1">
                                    <div className="text-[10px] font-mono opacity-50 pt-1 w-16">08:15 AM</div>
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
                    <div className="space-y-8">
                        <div className="bg-white border border-slate-200 p-8 h-full flex flex-col shadow-sm">
                            <div className="mb-8">
                                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                                    <Layers className="w-4 h-4 text-slate-400" />
                                    Cost Breakdown
                                </h3>
                                <div className="text-[10px] text-slate-400 mt-1 font-mono">PERIOD: {timeRange.toUpperCase()}</div>
                            </div>

                            <div className="flex-1 flex flex-col justify-center space-y-4">
                                <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                    <div className="text-xs font-bold uppercase text-slate-500">Raw Materials</div>
                                    <div className="text-sm font-mono font-bold text-slate-900">42%</div>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                    <div className="text-xs font-bold uppercase text-slate-500">Labor (Tracked)</div>
                                    <div className="text-sm font-mono font-bold text-slate-900">28%</div>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                    <div className="text-xs font-bold uppercase text-slate-500">Packaging</div>
                                    <div className="text-sm font-mono font-bold text-slate-900">12%</div>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                    <div className="text-xs font-bold uppercase text-slate-500">Overhead/Ops</div>
                                    <div className="text-sm font-mono font-bold text-slate-900">18%</div>
                                </div>
                            </div>

                            <div className="mt-8 text-[11px] text-slate-500 leading-relaxed italic border-t border-slate-100 pt-6">
                                <strong className="block text-xs uppercase font-sans font-bold text-slate-400 mb-2 not-italic">Operational Memo</strong>
                                "Labor costs are trending downward due to the new automated shutoff feature in the Manufacturing module. Packaging variance remains stable."
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-emerald-50 border border-emerald-100 p-6 shadow-sm">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 mb-4 flex items-center gap-2">
                                <Briefcase className="w-3 h-3" />
                                Strategic Actions
                            </h3>
                            <div className="space-y-3">
                                <button className="w-full py-3 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200">
                                    Download P&L Statement
                                </button>
                                <button className="w-full py-3 bg-white border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-50 transition-colors">
                                    Audit COGM Variance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
