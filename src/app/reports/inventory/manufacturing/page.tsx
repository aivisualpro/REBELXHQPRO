'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
    Factory, 
    Activity, 
    ClipboardList, 
    Users, 
    ArrowLeft, 
    TrendingUp, 
    TrendingDown,
    Loader2,
    Calendar,
    Settings,
    AlertCircle,
    Clock,
    Zap,
    Download,
    BrainCircuit,
    ChevronDown,
    ChevronUp,
    ShieldAlert,
    CheckCircle2,
    XCircle,
    Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Simple bar chart component
function BarChart({ data, height = 200, color = 'bg-blue-500' }: { data: number[], height?: number, color?: string }) {
    const max = Math.max(...data, 1);
    return (
        <div className="flex items-end gap-2 w-full pt-4" style={{ height }}>
            {data.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end group">
                    <div className="text-[10px] text-center font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity pb-1">
                        {val}
                    </div>
                    <div 
                        className={cn("w-full rounded-t-sm transition-all duration-500 hover:opacity-80 cursor-pointer", color)} 
                        style={{ height: `${(val / max) * 100}%`, minHeight: '4px' }}
                    />
                </div>
            ))}
        </div>
    );
}

// Simple Ring component for percentages
function ProgressRing({ value, label, colorClass = "text-blue-500", trackClass = "text-slate-800" }: { value: number, label: string, colorClass?: string, trackClass?: string }) {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (value / 100) * circumference;

    return (
        <div className="flex flex-col items-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle 
                        className={trackClass} 
                        strokeWidth="8" 
                        stroke="currentColor" 
                        fill="transparent" 
                        r={radius} 
                        cx="50" 
                        cy="50" 
                    />
                    <circle 
                        className={cn("transition-all duration-1000 ease-out", colorClass)} 
                        strokeWidth="8" 
                        strokeDasharray={circumference} 
                        strokeDashoffset={strokeDashoffset} 
                        strokeLinecap="round" 
                        stroke="currentColor" 
                        fill="transparent" 
                        r={radius} 
                        cx="50" 
                        cy="50" 
                    />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-foreground">{value}%</span>
                </div>
            </div>
            <span className="mt-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
    );
}

export default function ManufacturingDashboard() {
    const [view, setView] = useState<'main' | 'production' | 'work-orders' | 'labor' | 'anomalies'>('main');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [anomalies, setAnomalies] = useState<any[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [provider, setProvider] = useState<'groq'|'openrouter'>('groq');

    const fetchAnomalies = async (force = false) => {
        setAiLoading(true);
        try {
            const res = await fetch(`/api/reports/manufacturing/anomalies?forceRefresh=${force}&provider=${provider}`);
            const json = await res.json();
            setAnomalies(json.data || []);
        } catch(e) {
            console.error(e);
        }
        setAiLoading(false);
    };

    useEffect(() => {
        fetch('/api/reports/manufacturing')
            .then(res => res.json())
            .then(resData => {
                setData(resData.data);
                setLoading(false);
                fetchAnomalies(false); // Fetch initial cache
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const updateAnomalyStatus = async (id: string, status: string) => {
        setAnomalies(prev => prev.map(a => a._id === id ? { ...a, status } : a));
        await fetch('/api/reports/manufacturing/anomalies', {
            method: 'PATCH',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ _id: id, status })
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col h-[calc(100vh-40px)] bg-background items-center justify-center">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                    Aggregating Factory Data...
                </p>
            </div>
        );
    }

    if (!data) return null;

    const openFlags = anomalies.filter(a => a.status === 'open');
    const highSeverityCount = openFlags.filter(a => a.severity === 'high').length;

    const renderMainCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Production Efficiency */}
            <div 
                onClick={() => setView('production')}
                className="group relative bg-card border border-border/50 rounded-2xl p-6 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-indigo-500/30"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-500 flex items-center justify-center">
                        <Activity className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-foreground text-lg">Production</h3>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">OEE & Throughput</p>
                    </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                    <div className="text-4xl font-black text-foreground">
                        {data.efficiency.qualityPercent}%
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mb-6">Quality Rate</p>
                <div className="h-12 w-full opacity-60 group-hover:opacity-100 transition-opacity">
                    <BarChart data={data.trend.map((t:any) => t.qty)} height={48} color="bg-indigo-500/80" />
                </div>
            </div>

            {/* Work Order Status */}
            <div 
                onClick={() => setView('work-orders')}
                className="group relative bg-card border border-border/50 rounded-2xl p-6 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-amber-500/30"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-foreground text-lg">Work Orders</h3>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipeline Velocity</p>
                    </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                    <div className="text-4xl font-black text-foreground">
                        {data.status.processing + data.status.pending}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mb-6">Active Orders</p>
                <div className="h-12 w-full flex items-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <div className="bg-slate-700 w-full rounded-sm" style={{height: '30%'}}></div>
                    <div className="bg-amber-500 w-full rounded-sm" style={{height: '80%'}}></div>
                    <div className="bg-emerald-500 w-full rounded-sm" style={{height: '60%'}}></div>
                    <div className="bg-blue-500 w-full rounded-sm" style={{height: '45%'}}></div>
                </div>
            </div>

            {/* Labor Tracking */}
            <div 
                onClick={() => setView('labor')}
                className="group relative bg-card border border-border/50 rounded-2xl p-6 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-emerald-500/30"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-foreground text-lg">Labor</h3>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Utilization</p>
                    </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                    <div className="text-4xl font-black text-foreground">
                        {data.labor.totalHours}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mb-6">Total direct hours</p>
                <div className="h-12 w-full opacity-60 group-hover:opacity-100 transition-opacity">
                    <BarChart data={data.trend.map((t:any) => t.hours)} height={48} color="bg-emerald-500/80" />
                </div>
            </div>

            {/* Anomaly Inspector */}
            <div 
                onClick={() => setView('anomalies')}
                className={cn(
                    "group relative border rounded-2xl p-6 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl",
                    openFlags.length > 0 
                        ? (highSeverityCount > 0 ? "bg-rose-500/5 border-rose-500/50 hover:border-rose-500" : "bg-amber-500/5 border-amber-500/50 hover:border-amber-500") 
                        : "bg-card border-border/50 hover:border-emerald-500/50"
                )}
            >
                <div className={cn(
                    "absolute top-0 right-0 w-32 h-32 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110",
                    openFlags.length > 0 
                        ? (highSeverityCount > 0 ? "bg-rose-500/10" : "bg-amber-500/10") 
                        : "bg-emerald-500/10"
                )} />
                <div className="flex items-center gap-4 mb-6">
                    <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        openFlags.length > 0 
                            ? (highSeverityCount > 0 ? "bg-rose-500/20 text-rose-500" : "bg-amber-500/20 text-amber-500") 
                            : "bg-emerald-500/20 text-emerald-500"
                    )}>
                        <BrainCircuit className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-black text-foreground text-lg">AI Inspector</h3>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Anomaly Detection</p>
                    </div>
                </div>
                <div className="flex items-end justify-between mb-2">
                    <div className="text-4xl font-black text-foreground">
                        {openFlags.length}
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mb-6">Open flags requiring review</p>
                <div className="flex gap-2">
                    {highSeverityCount > 0 && (
                        <span className="px-2 py-1 bg-rose-500/20 text-rose-500 text-[10px] font-black uppercase rounded border border-rose-500/30">
                            {highSeverityCount} High Severity
                        </span>
                    )}
                </div>
            </div>
        </div>
    );

    const renderProductionView = () => (
        <div className="animate-in fade-in slide-in-from-right-8 duration-300">
            {/* Standard Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex items-center justify-center">
                    <ProgressRing value={85} label="OEE" colorClass="text-indigo-500" />
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex items-center justify-center">
                    <ProgressRing value={92} label="Availability" colorClass="text-emerald-500" />
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex items-center justify-center">
                    <ProgressRing value={88} label="Performance" colorClass="text-amber-500" />
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex items-center justify-center">
                    <ProgressRing value={parseFloat(data.efficiency.qualityPercent)} label="Quality" colorClass="text-rose-500" />
                </div>
            </div>

            {/* ✨ AI Insights Injection ✨ */}
            <div className="bg-indigo-500/5 border border-indigo-500/30 rounded-2xl p-6 mb-8 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 text-indigo-500/10">
                    <BrainCircuit className="w-48 h-48" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                    <BrainCircuit className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">AI Insights</h3>
                </div>
                <p className="text-sm text-foreground leading-relaxed relative z-10 max-w-3xl">
                    "OEE dropped by 2.4% this week. The primary driver is a 14% increase in Setup Time on the encapsulator lines compared to the historical baseline. We also observed a correlation between Operator 'T. Smith' logging high indirect hours and increased scrap rates on Work Order #1042."
                </p>
                <div className="mt-4 flex gap-3 relative z-10">
                    <button className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded hover:bg-indigo-500/30 transition-colors">
                        Investigate Setup Times
                    </button>
                    <button className="px-3 py-1.5 bg-secondary text-muted-foreground text-xs font-bold rounded hover:bg-secondary/80 transition-colors">
                        View Scrap Report
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border border-border/50 rounded-2xl p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Production Volume (30 Days)</h3>
                    <BarChart data={data.trend.map((t:any) => t.qty)} height={250} color="bg-indigo-500" />
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col gap-6">
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Throughput</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-foreground">{data.efficiency.throughput}</span>
                            <span className="text-sm font-bold text-muted-foreground mb-1">units/hr</span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Scrap Rate</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-rose-500">
                                {data.efficiency.totalQty > 0 ? ((data.efficiency.totalScrapped / data.efficiency.totalQty) * 100).toFixed(1) : 0}%
                            </span>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Avg Cycle Time</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-3xl font-black text-amber-500">{data.efficiency.avgCycleTime}</span>
                            <span className="text-sm font-bold text-muted-foreground mb-1">days</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAnomalyInspector = () => {
        // Group open flags by SKU
        const skuGroups = new Map<string, any[]>();
        openFlags.forEach(f => {
            const name = f.skuId?.name || 'Unknown SKU';
            if (!skuGroups.has(name)) skuGroups.set(name, []);
            skuGroups.get(name)!.push(f);
        });

        return (
            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center">
                            <BrainCircuit className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-foreground">AI Anomaly Inspector</h2>
                            <p className="text-sm text-muted-foreground">Cross-order outlier detection</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <select 
                            value={provider}
                            onChange={(e) => setProvider(e.target.value as any)}
                            className="bg-secondary border border-border text-xs font-bold px-3 py-2 rounded-lg outline-none"
                        >
                            <option value="groq">Groq (Llama 3.3)</option>
                            <option value="openrouter">OpenRouter (Claude/GPT)</option>
                        </select>
                        <button 
                            onClick={() => fetchAnomalies(true)}
                            disabled={aiLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-xs font-bold rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                            Re-run Analysis
                        </button>
                    </div>
                </div>

                {openFlags.length === 0 ? (
                    <div className="bg-card border border-border/50 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-black text-foreground mb-2">No active anomalies</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                            The AI inspector didn't find any suspicious labor hours, costs, or data patterns in the current reporting window.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {Array.from(skuGroups.entries()).map(([skuName, flags]) => (
                            <div key={skuName} className="bg-card border border-border/50 rounded-xl overflow-hidden">
                                <div className="bg-secondary/50 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-background border flex items-center justify-center text-[10px] font-black">
                                            {flags.length}
                                        </div>
                                        <h3 className="font-bold text-foreground">{skuName}</h3>
                                    </div>
                                </div>
                                <div className="divide-y divide-border/50">
                                    {flags.map((flag: any) => (
                                        <div key={flag._id} className="p-5 flex gap-6">
                                            <div className="w-32 shrink-0">
                                                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">WO Reference</div>
                                                <Link href={`/warehouse/manufacturing/${flag.moId}`} className="text-sm font-bold text-blue-400 hover:underline">
                                                    #{flag.moLegacyId}
                                                </Link>
                                                
                                                <div className="mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Severity</div>
                                                <span className={cn(
                                                    "px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border",
                                                    flag.severity === 'high' ? "bg-rose-500/20 text-rose-500 border-rose-500/30" : 
                                                    flag.severity === 'medium' ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : 
                                                    "bg-blue-500/20 text-blue-500 border-blue-500/30"
                                                )}>
                                                    {flag.severity}
                                                </span>
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                                                    <span className="text-sm font-bold text-foreground">
                                                        {flag.type.replace('-', ' ').toUpperCase()}
                                                    </span>
                                                </div>
                                                
                                                <div className="flex items-center gap-6 mb-4 bg-background border border-border/50 rounded-lg p-3">
                                                    <div>
                                                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Actual</div>
                                                        <div className="text-sm font-black text-rose-400">{typeof flag.actual === 'number' ? flag.actual.toFixed(2) : flag.actual}</div>
                                                    </div>
                                                    <div className="text-muted-foreground">vs</div>
                                                    <div>
                                                        <div className="text-[10px] font-bold text-muted-foreground uppercase">Baseline Median</div>
                                                        <div className="text-sm font-black text-emerald-400">{typeof flag.baseline === 'number' ? flag.baseline.toFixed(2) : flag.baseline}</div>
                                                    </div>
                                                </div>

                                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-4 mb-4">
                                                    <div className="flex gap-2 mb-2">
                                                        <BrainCircuit className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                                        <div>
                                                            <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">AI Diagnosis</div>
                                                            <p className="text-sm text-foreground">{flag.probableCause}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 mt-3 pt-3 border-t border-purple-500/10">
                                                        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                                        <div>
                                                            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">Suggested Action</div>
                                                            <p className="text-sm text-foreground">{flag.recommendedAction}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <button onClick={() => updateAnomalyStatus(flag._id, 'reviewed')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border border-emerald-500/30 text-xs font-bold rounded transition-colors flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Reviewed
                                                    </button>
                                                    <button onClick={() => updateAnomalyStatus(flag._id, 'dismissed')} className="px-3 py-1.5 bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border text-xs font-bold rounded transition-colors flex items-center gap-1.5">
                                                        <XCircle className="w-3.5 h-3.5" /> Dismiss
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderWorkOrdersView = () => (
        <div className="animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center">
                        <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground">Work Order Status</h2>
                        <p className="text-sm text-muted-foreground">Pipeline Velocity and Execution</p>
                    </div>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground text-xs font-bold rounded-lg hover:bg-secondary/80 transition-colors">
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            {/* ✨ AI Insights Injection ✨ */}
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-6 mb-8 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 text-amber-500/10">
                    <BrainCircuit className="w-48 h-48" />
                </div>
                <div className="flex items-center gap-2 mb-4 relative z-10">
                    <BrainCircuit className="w-5 h-5 text-amber-400" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-amber-400">AI At-Risk Summary</h3>
                </div>
                <p className="text-sm text-foreground leading-relaxed relative z-10 max-w-3xl">
                    "3 Extreme priority orders are currently stuck in 'Pending' for &gt;48 hours. Based on current line velocity, WO#1092 and WO#1094 are predicted to miss their scheduled finish dates unless re-assigned. Recommend shifting 2 operators from Line B to Line A."
                </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-foreground mb-1">{data.status.total}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total</div>
                </div>
                <div className="bg-card border border-border/50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-slate-400 mb-1">{data.status.pending}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Open</div>
                </div>
                <div className="bg-card border border-amber-500/30 bg-amber-500/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-amber-500 mb-1">{data.status.processing}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-amber-500">In Progress</div>
                </div>
                <div className="bg-card border border-rose-500/30 bg-rose-500/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-rose-500 mb-1">{data.status.readyToQc}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-rose-500">On Hold / QC</div>
                </div>
                <div className="bg-card border border-emerald-500/30 bg-emerald-500/5 rounded-xl p-4 text-center">
                    <div className="text-2xl font-black text-emerald-500 mb-1">{data.status.fulfilled}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Completed</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Priority Breakdown</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                                <span className="text-foreground">Normal</span>
                                <span className="text-muted-foreground">{data.status.normal}</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${(data.status.normal / Math.max(data.status.total, 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                                <span className="text-foreground">High</span>
                                <span className="text-muted-foreground">{data.status.high}</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500" style={{ width: `${(data.status.high / Math.max(data.status.total, 1)) * 100}%` }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                                <span className="text-foreground">Extreme</span>
                                <span className="text-muted-foreground">{data.status.extreme}</span>
                            </div>
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-rose-500" style={{ width: `${(data.status.extreme / Math.max(data.status.total, 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-card border border-border/50 rounded-2xl p-6 flex flex-col justify-center items-center">
                    <ProgressRing value={parseFloat(data.efficiency.onTimePercent)} label="On-Time Completion" colorClass="text-emerald-500" />
                    <p className="text-xs text-muted-foreground mt-4 text-center max-w-xs">
                        Percentage of work orders fulfilled on or before their scheduled finish date.
                    </p>
                </div>
            </div>
        </div>
    );

    const renderLaborView = () => (
        <div className="animate-in fade-in slide-in-from-right-8 duration-300">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-foreground">Labor Tracking</h2>
                        <p className="text-sm text-muted-foreground">Workforce Utilization & Costs</p>
                    </div>
                </div>

                {/* ✨ AI Query Bar ✨ */}
                <div className="relative w-96 hidden md:block">
                    <BrainCircuit className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
                    <input 
                        type="text" 
                        placeholder="Ask AI: 'Show operators with >30% jump in hours'"
                        className="w-full bg-purple-500/5 border border-purple-500/20 text-sm pl-9 pr-4 py-2 rounded-lg text-foreground focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-purple-400/50"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 text-muted-foreground mb-4">
                        <Clock className="w-5 h-5" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Total Hours</h3>
                    </div>
                    <div className="text-4xl font-black text-foreground">{data.labor.totalHours}</div>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 text-muted-foreground mb-4">
                        <Zap className="w-5 h-5" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Utilization %</h3>
                    </div>
                    <div className="text-4xl font-black text-emerald-500">82.4%</div>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                    <div className="flex items-center gap-3 text-muted-foreground mb-4">
                        <AlertCircle className="w-5 h-5" />
                        <h3 className="text-sm font-bold uppercase tracking-wider">Overtime</h3>
                    </div>
                    <div className="text-4xl font-black text-rose-500">24.5 <span className="text-lg">hrs</span></div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Top Performers (Hours)</h3>
                    <div className="space-y-3">
                        {data.labor.topPerformers.map((p:any, i:number) => (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                        {p.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <span className="text-sm font-bold text-foreground">{p.name}</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-foreground">{p.hours.toFixed(1)} hrs</div>
                                    <div className="text-[10px] font-bold text-muted-foreground">${p.cost.toFixed(2)}</div>
                                </div>
                            </div>
                        ))}
                        {data.labor.topPerformers.length === 0 && (
                            <div className="text-center p-4 text-xs font-bold text-muted-foreground">No labor logged</div>
                        )}
                    </div>
                </div>
                <div className="bg-card border border-border/50 rounded-2xl p-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-6">Labor Hours Trend</h3>
                    <BarChart data={data.trend.map((t:any) => t.hours)} height={250} color="bg-emerald-500" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-background text-foreground overflow-y-auto overflow-x-hidden scrollbar-custom">
            <div className="max-w-7xl mx-auto w-full p-8 pb-20">
                
                {/* Header & Breadcrumbs */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold uppercase tracking-widest">
                        <Link href="/reports/inventory" className="hover:text-foreground transition-colors">Reports</Link>
                        <span>/</span>
                        <span className="text-foreground">Manufacturing</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary border border-border rounded-lg text-xs font-bold text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5" />
                            Last 30 Days
                        </div>
                        <button className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground">
                            <Settings className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Main Content Area */}
                {view !== 'main' && (
                    <button 
                        onClick={() => setView('main')}
                        className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                    </button>
                )}

                {view === 'main' && renderMainCards()}
                {view === 'production' && renderProductionView()}
                {view === 'work-orders' && renderWorkOrdersView()}
                {view === 'labor' && renderLaborView()}
                {view === 'anomalies' && renderAnomalyInspector()}

            </div>
        </div>
    );
}

