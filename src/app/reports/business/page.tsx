'use client';

import React, { useState } from 'react';
import { 
    TrendingUp, DollarSign, Activity, PieChart, BarChart3, 
    ArrowUpRight, ArrowDownRight, Calendar, Download, Filter,
    Briefcase, CreditCard, Wallet, LineChart, Layers, AlertCircle,
    Factory, Lock, ArrowLeft, Truck, Package, Users, Clock,
    Scale, AlertTriangle, CheckCircle2
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
                    Decrypting Deep-Layer Intelligence...
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
                    This interface exposes live, unfiltered financial data including COGM variances, shipping margin arbitrage, and customer retention cohorts. Access is strictly limited to C-Suite.
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

    // SIMULATED DATA (Modeled after Schema Capabilities)
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
            label: "Inventory Value",
            value: "$342,900.00",
            change: "+5.2%",
            trend: "up",
            desc: "At Cost (FIFO Basis)",
            icon: <Package className="w-4 h-4 text-purple-600" />
        },
        {
            label: "Gross Margin",
            value: "62.4%",
            change: "+2.4%",
            trend: "up", 
            desc: "Weighted Avg across SKUs",
            icon: <Factory className="w-4 h-4 text-amber-600" />
        }
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden bg-white">
            
            {/* Page Header */}
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
                        {['Today', 'Week', 'Month', 'Quarter', 'Year'].map((range) => (
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
                    
                    {/* 1. FINANCIAL PERFORMANCE (TOP ROW) */}
                    <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                            <Activity className="w-4 h-4 text-slate-400" />
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-900">
                                Financial Performance • <span className="text-emerald-600">{timeRange.toUpperCase()}</span>
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

                    {/* 2. REVENUE & MANUFACTURING INTELLIGENCE */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* 2a. Product Margin Analysis */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                                        <Scale className="w-4 h-4 text-slate-400" />
                                        Margin By Channel (EBIT)
                                    </h3>
                                    <div className="text-[9px] font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">SOURCE: LEDGER_V2</div>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                                            <span>Wholesale (High Vol, Low Margin)</span>
                                            <div className="flex gap-4">
                                                <span className="text-slate-400">Rev: $84,200</span>
                                                <span className="text-slate-900 font-black">Margin: 42%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 overflow-hidden rounded-full flex">
                                            <div className="h-full bg-slate-900 w-[42%]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                                            <span>DTC (Low Vol, High Margin)</span>
                                            <div className="flex gap-4">
                                                <span className="text-slate-400">Rev: $48,102</span>
                                                <span className="text-emerald-600 font-black">Margin: 78%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 overflow-hidden rounded-full flex">
                                            <div className="h-full bg-emerald-500 w-[78%]" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide">
                                            <span>Raw Material Sales (Liquid)</span>
                                            <div className="flex gap-4">
                                                <span className="text-slate-400">Rev: $10,590</span>
                                                <span className="text-amber-600 font-black">Margin: 12%</span>
                                            </div>
                                        </div>
                                        <div className="h-2 w-full bg-slate-100 overflow-hidden rounded-full flex">
                                            <div className="h-full bg-amber-500 w-[12%]" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-slate-100">
                                    <p className="text-sm font-serif leading-relaxed text-slate-600 bg-slate-50 p-4 border-l-4 border-emerald-400">
                                        <strong className="block text-[10px] uppercase font-sans font-bold text-slate-400 mb-2">Strategic Insight</strong>
                                        The <span className="font-bold text-emerald-700">78% margin</span> on DTC sales validates the "Spam Filtration" strategy. We are now capturing high-quality organic traffic. However, Raw Material sales are dragging the blended margin down. Recommendation: <span className="italic">Rotate capital out of Raw Material inventory and reinvest in DTC finished goods (Extract Shots).</span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2b. Manufacturing Precision (Labor & Claims) */}
                        <div className="space-y-6">
                            <div className="bg-white border border-slate-200 p-6 h-full flex flex-col shadow-sm rounded-sm">
                                <div className="mb-6">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                                        <Factory className="w-4 h-4 text-slate-400" />
                                        Factory Precision
                                    </h3>
                                    <div className="text-[9px] text-slate-400 mt-1 font-mono">LABOR & YIELD</div>
                                </div>

                                <div className="flex-1 space-y-6">
                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[9px] font-bold text-slate-500 uppercase">Input/Output Yield</div>
                                            <div className="text-xs font-mono font-black text-slate-900">97.4%</div>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 w-[97.4%]" />
                                        </div>
                                        <div className="text-[9px] text-slate-400 mt-2">Loss: 2.6% (Spillage/Testing)</div>
                                    </div>

                                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[9px] font-bold text-slate-500 uppercase">Avg Labor Cost / Unit</div>
                                            <div className="text-xs font-mono font-black text-slate-900">$0.42</div>
                                        </div>
                                        <div className="text-[9px] text-emerald-600 mt-1 flex items-center gap-1">
                                            <ArrowDownRight className="w-3 h-3" />
                                            12% vs Standard
                                        </div>
                                        <div className="text-[9px] text-slate-400 mt-2 leading-tight">Variance due to faster encapsulation run rates on new machine.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. LOGISTICS & CRM (BOTTOM ROW) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-12">
                        
                        {/* 3a. Logistics Gap (Shipping Arbitrage) */}
                        <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm flex flex-col">
                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                <Truck className="w-4 h-4 text-slate-400" />
                                The Logistics Gap
                            </h3>
                            <div className="flex items-end justify-between mb-8">
                                <div className="text-center w-1/3">
                                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Shipping Charged</div>
                                    <div className="text-xl font-black text-slate-900">$12,400</div>
                                </div>
                                <div className="w-1/3 flex flex-col items-center">
                                    <div className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded uppercase tracking-wider mb-2">
                                        +$2,900 Arbitrage
                                    </div>
                                    <div className="h-px w-full bg-slate-200"></div>
                                </div>
                                <div className="text-center w-1/3">
                                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Actual Cost</div>
                                    <div className="text-xl font-black text-slate-900">$9,500</div>
                                </div>
                            </div>
                            <div className="mt-auto text-[10px] text-slate-500 leading-relaxed bg-slate-50 p-3 border-l-2 border-slate-300">
                                <strong>Logistics Memo:</strong> We are profiting on shipping. While positive for EBITDA, consider reinvesting this surplus into "Free Express Upgrades" for orders &gt; $150 to boost retention.
                            </div>
                        </div>

                        {/* 3b. Customer Retention Health */}
                        <div className="bg-slate-900 text-white p-6 border border-slate-800 shadow-sm rounded-sm relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                <Users className="w-40 h-40" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-emerald-400 mb-6">
                                <Activity className="w-4 h-4" />
                                Retention Command
                            </h3>
                            <div className="grid grid-cols-2 gap-8 relative z-10">
                                <div>
                                    <div className="text-[3rem] font-black text-white leading-none">14</div>
                                    <div className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider mt-1">Clients Saved</div>
                                    <div className="text-[9px] text-slate-400 mt-2">Re-activated from "At Risk" (60-day) cohort via automated tasks.</div>
                                </div>
                                <div>
                                    <div className="text-[3rem] font-black text-rose-500 leading-none">42</div>
                                    <div className="text-[10px] font-bold uppercase text-rose-400 tracking-wider mt-1">High Risk</div>
                                    <div className="text-[9px] text-slate-400 mt-2">Clients with no purchase &gt; 90 days. Total value at risk: ~$24k/mo.</div>
                                </div>
                            </div>
                            <div className="mt-8 pt-4 border-t border-slate-800 flex gap-2">
                                <button className="flex-1 py-2 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors rounded-sm">
                                    Deploy "Save" Script
                                </button>
                                <button className="flex-1 py-2 bg-slate-800 text-white border border-slate-700 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors rounded-sm">
                                    View Risk List
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* 4. NEURAL BOARD (FULL WIDTH) */}
                    <div className="bg-amber-50 border border-amber-100 p-6 shadow-sm rounded-sm">
                         <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-amber-900 mb-4">
                            <AlertCircle className="w-4 h-4" />
                            Neural Board: Anomaly Detection
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="flex gap-4 items-start bg-white p-4 border border-amber-100 rounded-sm">
                                <div className="text-[9px] font-mono text-amber-900/50 pt-1 w-12">09:41 AM</div>
                                <div>
                                    <div className="text-sm font-bold text-amber-900">Unusual Margin Compression</div>
                                    <div className="text-xs text-amber-800/70 mt-1 leading-relaxed">
                                        Detected a 4% variance in COGM for "Kratom Powder 500g" batch #L-992. Labor hours exceeded standard recipe time by 45 minutes.
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start bg-white p-4 border border-amber-100 rounded-sm">
                                <div className="text-[9px] font-mono text-amber-900/50 pt-1 w-12">08:15 AM</div>
                                <div>
                                    <div className="text-sm font-bold text-amber-900">Capital Efficiency Potential</div>
                                    <div className="text-xs text-amber-800/70 mt-1 leading-relaxed">
                                        Inventory turnover for "Extract Shots" has slowed significantly. Recommended action: Initiate targeted email campaign to active 60-day cohort.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
