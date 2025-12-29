'use client';

import React, { useState } from 'react';
import { 
    TrendingUp, DollarSign, Activity, BarChart3, 
    ArrowUpRight, ArrowDownRight, Download,
    Briefcase, CreditCard, Wallet, Layers, AlertCircle,
    Factory, Lock, ArrowLeft, Truck, Package, Users, Clock,
    Scale, Target, Zap, TrendingDown, CircleDollarSign,
    ShoppingCart, Repeat, AlertTriangle, CheckCircle2, 
    Calendar, Globe, Box, Gauge, PiggyBank, BarChart2,
    Timer, Banknote, Receipt, ShieldCheck, Brain
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function BusinessReportsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [timeRange, setTimeRange] = useState('Month');
    const [activeTab, setActiveTab] = useState<'overview' | 'profitability' | 'operations' | 'customers'>('overview');

    // ROLE-BASED ACCESS CONTROL
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    // LOADING STATE
    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-40px)] bg-slate-50">
                <div className="text-slate-400 text-[10px] font-mono uppercase tracking-widest animate-pulse">
                    Synthesizing Business Intelligence Layer...
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
                    This interface exposes live, unfiltered financial data including COGM variances, cash flow velocity, and customer lifetime value analytics.
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

    // ============================================================================
    // SIMULATED DATA (Modeled after Schema Capabilities)
    // In production, this would be fetched from API endpoints
    // ============================================================================
    
    const coreMetrics = [
        { label: "Gross Revenue", value: "$142,892", change: "+12.4%", trend: "up", icon: <DollarSign className="w-4 h-4 text-emerald-600" /> },
        { label: "Net Profit", value: "$48,201", change: "+8.1%", trend: "up", icon: <Wallet className="w-4 h-4 text-blue-600" /> },
        { label: "Inventory Value", value: "$342,900", change: "+5.2%", trend: "up", icon: <Package className="w-4 h-4 text-purple-600" /> },
        { label: "Gross Margin", value: "62.4%", change: "+2.4%", trend: "up", icon: <Factory className="w-4 h-4 text-amber-600" /> },
        { label: "Avg Order Value", value: "$76.40", change: "-2.3%", trend: "down", icon: <ShoppingCart className="w-4 h-4 text-rose-600" /> },
        { label: "Orders Processed", value: "1,872", change: "+18.2%", trend: "up", icon: <Receipt className="w-4 h-4 text-cyan-600" /> },
    ];

    const cashFlowData = {
        inflow: 142892,
        outflow: 94691,
        netCashFlow: 48201,
        operatingCashFlow: 52400,
        daysOfCash: 94,
        burnRate: 3156,
    };

    const inventoryHealth = {
        totalSKUs: 847,
        fastMovers: 124,
        slowMovers: 312,
        deadStock: 48,
        turnoverRate: 4.2,
        daysOnHand: 87,
        reorderAlerts: 12,
    };

    const customerInsights = {
        totalCustomers: 4892,
        newThisMonth: 342,
        repeatRate: 34.2,
        avgLTV: 892,
        churnRate: 8.4,
        atRiskCount: 156,
        npsScore: 72,
    };

    const profitabilityByChannel = [
        { channel: "DTC Website", revenue: 48102, margin: 78, orders: 892, aov: 53.92 },
        { channel: "Wholesale B2B", revenue: 84200, margin: 42, orders: 124, aov: 679.03 },
        { channel: "Amazon FBA", revenue: 8400, margin: 28, orders: 312, aov: 26.92 },
        { channel: "Raw Materials", revenue: 10590, margin: 12, orders: 18, aov: 588.33 },
    ];

    const topPerformingSKUs = [
        { name: "Kratom Powder 500g", revenue: 24800, units: 412, margin: 68, trend: "up" },
        { name: "Extract Shots (12pk)", revenue: 18200, units: 284, margin: 82, trend: "up" },
        { name: "Capsules 120ct", revenue: 14600, units: 892, margin: 71, trend: "flat" },
        { name: "Sample Pack", revenue: 8400, units: 1204, margin: 45, trend: "down" },
    ];

    const underperformingSKUs = [
        { name: "Tea Bags 30ct", revenue: 1200, units: 42, margin: 18, issue: "Low Velocity" },
        { name: "Bulk Powder 5kg", revenue: 4800, units: 8, margin: -4, issue: "Negative Margin" },
        { name: "Liquid Extract 30ml", revenue: 2100, units: 64, margin: 22, issue: "High Returns" },
    ];

    const manufacturingEfficiency = {
        avgCOGM: 28.4,
        laborCostPerUnit: 0.42,
        yieldRate: 97.4,
        batchesThisMonth: 42,
        avgBatchTime: 4.2,
        varianceFromStandard: -12,
    };

    const logisticsMetrics = {
        shippingCharged: 12400,
        actualShippingCost: 9500,
        arbitrage: 2900,
        avgDeliveryDays: 3.2,
        damagedShipments: 4,
        returnRate: 2.8,
    };

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden bg-white">
            
            {/* ===== HEADER ===== */}
            <div className="sticky top-0 z-[10] bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-10 shadow-sm">
                <div className="flex items-center space-x-3">
                    <button onClick={() => router.back()} className="hover:bg-slate-100 transition-colors p-1 rounded-full">
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                        <Brain className="w-3 h-3" />
                        <span>Executive Intelligence</span>
                    </div>
                    <div className="h-4 w-px bg-slate-200" />
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                        Business Command Center
                    </h1>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center bg-slate-100 border border-slate-200 p-0.5 rounded-sm">
                        {['Week', 'Month', 'Quarter', 'Year', 'All Time'].map((range) => (
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
                    <button className="text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5" title="Export PDF">
                        <Download className="w-3.5 h-3.5" /> 
                    </button>
                </div>
            </div>

            {/* ===== TAB NAVIGATION ===== */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 flex items-center gap-1 h-9 shrink-0">
                {[
                    { id: 'overview', label: 'Executive Overview', icon: <Gauge className="w-3 h-3" /> },
                    { id: 'profitability', label: 'Profitability Deep-Dive', icon: <CircleDollarSign className="w-3 h-3" /> },
                    { id: 'operations', label: 'Operational Excellence', icon: <Factory className="w-3 h-3" /> },
                    { id: 'customers', label: 'Customer Intelligence', icon: <Users className="w-3 h-3" /> },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all rounded-t-sm border-b-2",
                            activeTab === tab.id 
                                ? "bg-white text-slate-900 border-slate-900 shadow-sm" 
                                : "text-slate-400 border-transparent hover:text-slate-600 hover:bg-white/50"
                        )}
                    >
                        {tab.icon}
                        <span className="hidden md:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* ===== SCROLLABLE CONTENT ===== */}
            <div className="flex-1 overflow-y-auto bg-slate-50/50 scrollbar-custom">
                <div className="max-w-[1800px] mx-auto px-6 py-6 space-y-6">

                    {/* ========== TAB: EXECUTIVE OVERVIEW ========== */}
                    {activeTab === 'overview' && (
                        <>
                            {/* Core Metrics Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                                {coreMetrics.map((metric, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 p-4 shadow-sm rounded-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="p-1.5 bg-slate-50 border border-slate-100 rounded-sm">{metric.icon}</div>
                                            <div className={cn(
                                                "flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-sm",
                                                metric.trend === 'up' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                                            )}>
                                                {metric.trend === 'up' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                {metric.change}
                                            </div>
                                        </div>
                                        <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{metric.label}</div>
                                        <div className="text-lg font-black text-slate-900 tracking-tight">{metric.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Cash Flow & Working Capital */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <Banknote className="w-4 h-4 text-slate-400" />
                                        Cash Flow Velocity
                                    </h3>
                                    <div className="grid grid-cols-3 gap-6 mb-6">
                                        <div className="text-center p-4 bg-emerald-50 border border-emerald-100 rounded-sm">
                                            <div className="text-2xl font-black text-emerald-700">${(cashFlowData.inflow / 1000).toFixed(1)}k</div>
                                            <div className="text-[9px] font-bold uppercase text-emerald-600 mt-1">Cash Inflow</div>
                                        </div>
                                        <div className="text-center p-4 bg-rose-50 border border-rose-100 rounded-sm">
                                            <div className="text-2xl font-black text-rose-700">${(cashFlowData.outflow / 1000).toFixed(1)}k</div>
                                            <div className="text-[9px] font-bold uppercase text-rose-600 mt-1">Cash Outflow</div>
                                        </div>
                                        <div className="text-center p-4 bg-blue-50 border border-blue-100 rounded-sm">
                                            <div className="text-2xl font-black text-blue-700">${(cashFlowData.netCashFlow / 1000).toFixed(1)}k</div>
                                            <div className="text-[9px] font-bold uppercase text-blue-600 mt-1">Net Cash Flow</div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-lg font-black text-slate-900">{cashFlowData.daysOfCash}</div>
                                            <div className="text-[9px] text-slate-500 uppercase font-bold">Days of Cash</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-black text-slate-900">${cashFlowData.burnRate}/day</div>
                                            <div className="text-[9px] text-slate-500 uppercase font-bold">Burn Rate</div>
                                        </div>
                                        <div>
                                            <div className="text-lg font-black text-emerald-600">${(cashFlowData.operatingCashFlow / 1000).toFixed(1)}k</div>
                                            <div className="text-[9px] text-slate-500 uppercase font-bold">Operating CF</div>
                                        </div>
                                    </div>
                                    <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-3 border-l-4 border-emerald-400">
                                        <strong className="text-slate-900">Cash Flow Insight:</strong> With 94 days of cash runway at current burn rate, the business has strong liquidity. The positive operating cash flow of $52.4k indicates healthy core operations. Consider allocating excess cash to inventory expansion or debt reduction.
                                    </div>
                                </div>

                                {/* Inventory Health */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <Box className="w-4 h-4 text-slate-400" />
                                        Inventory Health
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase text-slate-500">Total SKUs</span>
                                            <span className="text-sm font-mono font-black text-slate-900">{inventoryHealth.totalSKUs}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-emerald-50 border border-emerald-100 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase text-emerald-700">Fast Movers (&gt;10/wk)</span>
                                            <span className="text-sm font-mono font-black text-emerald-700">{inventoryHealth.fastMovers}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-amber-50 border border-amber-100 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase text-amber-700">Slow Movers</span>
                                            <span className="text-sm font-mono font-black text-amber-700">{inventoryHealth.slowMovers}</span>
                                        </div>
                                        <div className="flex justify-between items-center p-3 bg-rose-50 border border-rose-100 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase text-rose-700">Dead Stock (0 sales 90d)</span>
                                            <span className="text-sm font-mono font-black text-rose-700">{inventoryHealth.deadStock}</span>
                                        </div>
                                        <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
                                            <div>
                                                <div className="text-lg font-black text-slate-900">{inventoryHealth.turnoverRate}x</div>
                                                <div className="text-[9px] text-slate-500 uppercase font-bold">Turnover/Yr</div>
                                            </div>
                                            <div>
                                                <div className="text-lg font-black text-slate-900">{inventoryHealth.daysOnHand}</div>
                                                <div className="text-[9px] text-slate-500 uppercase font-bold">Days on Hand</div>
                                            </div>
                                        </div>
                                        {inventoryHealth.reorderAlerts > 0 && (
                                            <div className="flex items-center gap-2 p-2 bg-rose-100 border border-rose-200 rounded-sm text-[10px] font-bold text-rose-700">
                                                <AlertTriangle className="w-3 h-3" />
                                                {inventoryHealth.reorderAlerts} SKUs below reorder point
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Channel Performance + Top SKUs */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Channel Revenue */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <Globe className="w-4 h-4 text-slate-400" />
                                        Revenue by Channel
                                    </h3>
                                    <div className="space-y-4">
                                        {profitabilityByChannel.map((ch, idx) => (
                                            <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold uppercase text-slate-700">{ch.channel}</span>
                                                    <span className="text-sm font-black text-slate-900">${(ch.revenue / 1000).toFixed(1)}k</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-2">
                                                    <div 
                                                        className={cn(
                                                            "h-full rounded-full",
                                                            ch.margin >= 70 ? "bg-emerald-500" : ch.margin >= 40 ? "bg-blue-500" : ch.margin >= 20 ? "bg-amber-500" : "bg-rose-500"
                                                        )} 
                                                        style={{ width: `${ch.margin}%` }} 
                                                    />
                                                </div>
                                                <div className="flex justify-between text-[9px] text-slate-500">
                                                    <span>Margin: <strong className={cn(ch.margin >= 50 ? "text-emerald-600" : "text-slate-700")}>{ch.margin}%</strong></span>
                                                    <span>{ch.orders} orders • AOV ${ch.aov.toFixed(0)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Top & Bottom SKUs */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-4">
                                        <Target className="w-4 h-4 text-slate-400" />
                                        SKU Performance Matrix
                                    </h3>
                                    <div className="mb-4">
                                        <div className="text-[9px] font-bold uppercase text-emerald-600 mb-2 flex items-center gap-1">
                                            <ArrowUpRight className="w-3 h-3" /> Top Performers
                                        </div>
                                        <div className="space-y-2">
                                            {topPerformingSKUs.slice(0, 3).map((sku, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-100 rounded-sm text-[10px]">
                                                    <span className="font-bold text-slate-700 truncate max-w-[140px]">{sku.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-slate-500">{sku.units} units</span>
                                                        <span className="font-black text-emerald-700">{sku.margin}%</span>
                                                        <span className="font-black text-slate-900">${(sku.revenue / 1000).toFixed(1)}k</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[9px] font-bold uppercase text-rose-600 mb-2 flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Needs Attention
                                        </div>
                                        <div className="space-y-2">
                                            {underperformingSKUs.map((sku, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-rose-50 border border-rose-100 rounded-sm text-[10px]">
                                                    <span className="font-bold text-slate-700 truncate max-w-[140px]">{sku.name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-rose-600 font-bold">{sku.issue}</span>
                                                        <span className={cn("font-black", sku.margin < 0 ? "text-rose-700" : "text-amber-700")}>{sku.margin}%</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-600 bg-amber-50 p-3 border-l-4 border-amber-400">
                                        <strong className="text-amber-900">Action Required:</strong> "Bulk Powder 5kg" is operating at negative margin. Recommend price increase of 15% or discontinuation.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ========== TAB: PROFITABILITY DEEP-DIVE ========== */}
                    {activeTab === 'profitability' && (
                        <>
                            {/* Margin Waterfall */}
                            <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                    <Scale className="w-4 h-4 text-slate-400" />
                                    Profit Waterfall Analysis
                                </h3>
                                <div className="flex items-end justify-between h-48 px-4 mb-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 bg-blue-500 rounded-t-sm" style={{ height: '180px' }}></div>
                                        <div className="text-[9px] font-bold mt-2 text-center">Gross<br/>Revenue</div>
                                        <div className="text-xs font-black">$142.9k</div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 bg-rose-400 rounded-t-sm" style={{ height: '72px' }}></div>
                                        <div className="text-[9px] font-bold mt-2 text-center">COGS</div>
                                        <div className="text-xs font-black text-rose-600">-$40.6k</div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 bg-emerald-500 rounded-t-sm" style={{ height: '108px' }}></div>
                                        <div className="text-[9px] font-bold mt-2 text-center">Gross<br/>Profit</div>
                                        <div className="text-xs font-black">$102.3k</div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 bg-rose-400 rounded-t-sm" style={{ height: '40px' }}></div>
                                        <div className="text-[9px] font-bold mt-2 text-center">Labor</div>
                                        <div className="text-xs font-black text-rose-600">-$22.4k</div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 bg-rose-400 rounded-t-sm" style={{ height: '28px' }}></div>
                                        <div className="text-[9px] font-bold mt-2 text-center">Overhead</div>
                                        <div className="text-xs font-black text-rose-600">-$18.2k</div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 bg-rose-400 rounded-t-sm" style={{ height: '18px' }}></div>
                                        <div className="text-[9px] font-bold mt-2 text-center">Marketing</div>
                                        <div className="text-xs font-black text-rose-600">-$8.4k</div>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 bg-emerald-600 rounded-t-sm" style={{ height: '60px' }}></div>
                                        <div className="text-[9px] font-bold mt-2 text-center">Net<br/>Profit</div>
                                        <div className="text-xs font-black text-emerald-700">$48.2k</div>
                                    </div>
                                </div>
                                <div className="text-[11px] text-slate-600 bg-slate-50 p-4 border-l-4 border-blue-400 leading-relaxed">
                                    <strong className="text-slate-900">Profitability Insight:</strong> Your net margin of 33.7% is exceptionally healthy for this industry. The largest opportunity for improvement is in COGS reduction through better supplier negotiations. A 5% reduction in COGS would add $2,030/month to bottom line.
                                </div>
                            </div>

                            {/* Margin by Product Category */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <Layers className="w-4 h-4 text-slate-400" />
                                        Margin by Product Category
                                    </h3>
                                    <div className="space-y-4">
                                        {[
                                            { category: "Extract Shots", margin: 82, revenue: 18200, color: "emerald" },
                                            { category: "Capsules", margin: 71, revenue: 34600, color: "emerald" },
                                            { category: "Powder (Retail)", margin: 68, revenue: 42800, color: "blue" },
                                            { category: "Powder (Wholesale)", margin: 42, revenue: 38200, color: "amber" },
                                            { category: "Tea Products", margin: 28, revenue: 4800, color: "rose" },
                                            { category: "Raw Materials", margin: 12, revenue: 10590, color: "rose" },
                                        ].map((cat, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className="uppercase text-slate-700">{cat.category}</span>
                                                    <span className={cn(
                                                        cat.margin >= 60 ? "text-emerald-600" : cat.margin >= 40 ? "text-amber-600" : "text-rose-600"
                                                    )}>{cat.margin}% margin • ${(cat.revenue / 1000).toFixed(1)}k</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div className={cn(
                                                        "h-full rounded-full",
                                                        cat.color === "emerald" ? "bg-emerald-500" : cat.color === "blue" ? "bg-blue-500" : cat.color === "amber" ? "bg-amber-500" : "bg-rose-500"
                                                    )} style={{ width: `${cat.margin}%` }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Cost Structure */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <PiggyBank className="w-4 h-4 text-slate-400" />
                                        Cost Structure Breakdown
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            { name: "Raw Materials", percent: 42, amount: 39815, trend: "down", trendVal: "-3%" },
                                            { name: "Direct Labor", percent: 24, amount: 22754, trend: "down", trendVal: "-12%" },
                                            { name: "Packaging", percent: 12, amount: 11377, trend: "flat", trendVal: "0%" },
                                            { name: "Shipping (Net)", percent: 7, amount: 6637, trend: "up", trendVal: "+4%" },
                                            { name: "Overhead/Ops", percent: 8, amount: 7585, trend: "flat", trendVal: "0%" },
                                            { name: "Marketing", percent: 6, amount: 5689, trend: "up", trendVal: "+8%" },
                                            { name: "Platform Fees", percent: 1, amount: 948, trend: "flat", trendVal: "0%" },
                                        ].map((cost, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="w-10 text-right text-sm font-black text-slate-900">{cost.percent}%</div>
                                                <div className="flex-1">
                                                    <div className="h-4 bg-slate-100 rounded-sm overflow-hidden">
                                                        <div className="h-full bg-slate-700 rounded-sm" style={{ width: `${cost.percent * 2}%` }} />
                                                    </div>
                                                </div>
                                                <div className="w-24 text-[10px] font-bold text-slate-700">{cost.name}</div>
                                                <div className="w-16 text-[10px] text-right font-mono">${(cost.amount / 1000).toFixed(1)}k</div>
                                                <div className={cn(
                                                    "w-12 text-[9px] font-bold text-right",
                                                    cost.trend === "down" ? "text-emerald-600" : cost.trend === "up" ? "text-rose-600" : "text-slate-400"
                                                )}>
                                                    {cost.trendVal}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-600 bg-emerald-50 p-3 border-l-4 border-emerald-400">
                                        <strong className="text-emerald-900">Efficiency Win:</strong> Labor costs down 12% from new encapsulation machine. Annualized savings: ~$32,000.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ========== TAB: OPERATIONAL EXCELLENCE ========== */}
                    {activeTab === 'operations' && (
                        <>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Manufacturing Metrics */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <Factory className="w-4 h-4 text-slate-400" />
                                        Factory Performance
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[9px] font-bold uppercase text-emerald-700">Yield Rate</span>
                                                <span className="text-lg font-black text-emerald-700">{manufacturingEfficiency.yieldRate}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-emerald-200 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500" style={{ width: `${manufacturingEfficiency.yieldRate}%` }} />
                                            </div>
                                            <div className="text-[9px] text-emerald-600 mt-1">Loss: {(100 - manufacturingEfficiency.yieldRate).toFixed(1)}% (Spillage/QC)</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-sm text-center">
                                                <div className="text-lg font-black text-slate-900">{manufacturingEfficiency.batchesThisMonth}</div>
                                                <div className="text-[9px] font-bold uppercase text-slate-500">Batches</div>
                                            </div>
                                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-sm text-center">
                                                <div className="text-lg font-black text-slate-900">{manufacturingEfficiency.avgBatchTime}h</div>
                                                <div className="text-[9px] font-bold uppercase text-slate-500">Avg Time</div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-sm">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold uppercase text-blue-700">Labor Cost/Unit</span>
                                                <span className="text-sm font-black text-blue-700">${manufacturingEfficiency.laborCostPerUnit}</span>
                                            </div>
                                            <div className="text-[9px] text-emerald-600 mt-1 flex items-center gap-1">
                                                <ArrowDownRight className="w-3 h-3" />
                                                {Math.abs(manufacturingEfficiency.varianceFromStandard)}% below standard
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Logistics Performance */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <Truck className="w-4 h-4 text-slate-400" />
                                        Logistics & Fulfillment
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold uppercase text-emerald-700">Shipping Arbitrage</span>
                                                <span className="text-lg font-black text-emerald-700">+${logisticsMetrics.arbitrage.toLocaleString()}</span>
                                            </div>
                                            <div className="text-[9px] text-slate-600">
                                                Charged: ${logisticsMetrics.shippingCharged.toLocaleString()} | Cost: ${logisticsMetrics.actualShippingCost.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-sm text-center">
                                                <div className="text-lg font-black text-slate-900">{logisticsMetrics.avgDeliveryDays}</div>
                                                <div className="text-[9px] font-bold uppercase text-slate-500">Avg Days</div>
                                            </div>
                                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-sm text-center">
                                                <div className="text-lg font-black text-amber-700">{logisticsMetrics.returnRate}%</div>
                                                <div className="text-[9px] font-bold uppercase text-amber-600">Return Rate</div>
                                            </div>
                                        </div>
                                        {logisticsMetrics.damagedShipments > 0 && (
                                            <div className="flex items-center gap-2 p-2 bg-rose-50 border border-rose-100 rounded-sm text-[10px] font-bold text-rose-700">
                                                <AlertTriangle className="w-3 h-3" />
                                                {logisticsMetrics.damagedShipments} damaged shipments this period
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Quality & Compliance */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                                        Quality & Compliance
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-sm text-center">
                                            <div className="text-3xl font-black text-emerald-700">100%</div>
                                            <div className="text-[9px] font-bold uppercase text-emerald-600 mt-1">Lab Test Pass Rate</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-sm text-center">
                                                <div className="text-lg font-black text-slate-900">42</div>
                                                <div className="text-[9px] font-bold uppercase text-slate-500">COAs Issued</div>
                                            </div>
                                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-sm text-center">
                                                <div className="text-lg font-black text-slate-900">0</div>
                                                <div className="text-[9px] font-bold uppercase text-slate-500">Recalls</div>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-blue-50 border border-blue-100 rounded-sm flex items-center gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                            <span className="text-[10px] font-bold text-blue-700">FDA cGMP Compliant</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Anomaly Detection */}
                            <div className="bg-amber-50 border border-amber-100 p-6 shadow-sm rounded-sm">
                                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-amber-900 mb-4">
                                    <AlertCircle className="w-4 h-4" />
                                    Neural Board: Operational Anomalies
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white p-4 border border-amber-200 rounded-sm">
                                        <div className="text-[9px] font-mono text-amber-700/50">09:41 AM</div>
                                        <div className="text-sm font-bold text-amber-900 mt-1">COGM Variance Detected</div>
                                        <div className="text-[10px] text-amber-800/70 mt-2 leading-relaxed">
                                            Batch #L-992 exceeded standard labor by 45min. Recommend workflow audit.
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 border border-amber-200 rounded-sm">
                                        <div className="text-[9px] font-mono text-amber-700/50">08:15 AM</div>
                                        <div className="text-sm font-bold text-amber-900 mt-1">Inventory Velocity Slowdown</div>
                                        <div className="text-[10px] text-amber-800/70 mt-2 leading-relaxed">
                                            Extract Shots turnover rate decreased 22%. Consider promotional discount.
                                        </div>
                                    </div>
                                    <div className="bg-white p-4 border border-amber-200 rounded-sm">
                                        <div className="text-[9px] font-mono text-amber-700/50">Yesterday</div>
                                        <div className="text-sm font-bold text-amber-900 mt-1">Shipping Cost Spike</div>
                                        <div className="text-[10px] text-amber-800/70 mt-2 leading-relaxed">
                                            Zone 5+ shipments up 34%. Negotiate better rates or adjust free shipping threshold.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ========== TAB: CUSTOMER INTELLIGENCE ========== */}
                    {activeTab === 'customers' && (
                        <>
                            {/* Customer Overview */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white border border-slate-200 p-4 shadow-sm rounded-sm">
                                    <div className="text-[9px] font-bold uppercase text-slate-400">Total Customers</div>
                                    <div className="text-2xl font-black text-slate-900">{customerInsights.totalCustomers.toLocaleString()}</div>
                                    <div className="text-[9px] text-emerald-600 mt-1">+{customerInsights.newThisMonth} this month</div>
                                </div>
                                <div className="bg-white border border-slate-200 p-4 shadow-sm rounded-sm">
                                    <div className="text-[9px] font-bold uppercase text-slate-400">Repeat Purchase Rate</div>
                                    <div className="text-2xl font-black text-slate-900">{customerInsights.repeatRate}%</div>
                                    <div className="text-[9px] text-slate-500 mt-1">Industry avg: 27%</div>
                                </div>
                                <div className="bg-white border border-slate-200 p-4 shadow-sm rounded-sm">
                                    <div className="text-[9px] font-bold uppercase text-slate-400">Avg. Lifetime Value</div>
                                    <div className="text-2xl font-black text-emerald-600">${customerInsights.avgLTV}</div>
                                    <div className="text-[9px] text-emerald-600 mt-1">↑ 14% vs last quarter</div>
                                </div>
                                <div className="bg-white border border-slate-200 p-4 shadow-sm rounded-sm">
                                    <div className="text-[9px] font-bold uppercase text-slate-400">NPS Score</div>
                                    <div className="text-2xl font-black text-blue-600">{customerInsights.npsScore}</div>
                                    <div className="text-[9px] text-blue-600 mt-1">Excellent (70+)</div>
                                </div>
                            </div>

                            {/* Retention Analysis */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-slate-900 text-white p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-emerald-400 mb-6">
                                        <Repeat className="w-4 h-4" />
                                        Retention Command Center
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="text-center">
                                            <div className="text-3xl font-black text-white">{customerInsights.repeatRate}%</div>
                                            <div className="text-[9px] font-bold uppercase text-emerald-400 mt-1">Repeat Rate</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-black text-rose-400">{customerInsights.churnRate}%</div>
                                            <div className="text-[9px] font-bold uppercase text-rose-400 mt-1">Churn Rate</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-3xl font-black text-amber-400">{customerInsights.atRiskCount}</div>
                                            <div className="text-[9px] font-bold uppercase text-amber-400 mt-1">At Risk</div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-white/10 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase">Active (Ordered &lt; 30d)</span>
                                            <span className="text-sm font-black">2,142</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white/10 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase">Warm (30-60d)</span>
                                            <span className="text-sm font-black text-amber-400">892</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-white/10 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase">At Risk (60-90d)</span>
                                            <span className="text-sm font-black text-rose-400">{customerInsights.atRiskCount}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-rose-500/20 border border-rose-500/30 rounded-sm">
                                            <span className="text-[10px] font-bold uppercase">Critical (&gt;90d)</span>
                                            <span className="text-sm font-black text-rose-400">412</span>
                                        </div>
                                    </div>
                                    <button className="w-full mt-4 py-2 bg-emerald-600 text-white text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors rounded-sm">
                                        Deploy Retention Campaign
                                    </button>
                                </div>

                                {/* Customer Value Distribution */}
                                <div className="bg-white border border-slate-200 p-6 shadow-sm rounded-sm">
                                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900 mb-6">
                                        <BarChart2 className="w-4 h-4 text-slate-400" />
                                        Customer Value Distribution
                                    </h3>
                                    <div className="space-y-3">
                                        {[
                                            { tier: "Whales ($2000+)", count: 48, revenue: 124000, percent: 28 },
                                            { tier: "High Value ($500-2k)", count: 312, revenue: 186000, percent: 42 },
                                            { tier: "Mid Value ($100-500)", count: 1842, revenue: 98000, percent: 22 },
                                            { tier: "Low Value (<$100)", count: 2690, revenue: 34892, percent: 8 },
                                        ].map((tier, idx) => (
                                            <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[10px] font-bold uppercase text-slate-700">{tier.tier}</span>
                                                    <span className="text-sm font-black text-slate-900">{tier.percent}% of Rev</span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mb-2">
                                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${tier.percent}%` }} />
                                                </div>
                                                <div className="flex justify-between text-[9px] text-slate-500">
                                                    <span>{tier.count.toLocaleString()} customers</span>
                                                    <span>${(tier.revenue / 1000).toFixed(0)}k total value</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-100 text-[10px] text-slate-600 bg-blue-50 p-3 border-l-4 border-blue-400">
                                        <strong className="text-blue-900">Pareto Principle:</strong> 7.4% of customers ("Whales" + "High Value") generate 70% of revenue. Focus retention efforts here.
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                </div>
            </div>
        </div>
    );
}
