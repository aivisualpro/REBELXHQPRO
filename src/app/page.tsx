'use client';

import React, { useState, useEffect } from 'react';
import { 
    Activity, 
    ShoppingCart, 
    Layers, 
    Wrench,
    TrendingUp,
    TrendingDown,
    Zap,
    Brain,
    Bot,
    ArrowRight,
    ArrowUpRight,
    MessageSquare,
    DollarSign,
    CreditCard,
    PieChart,
    BarChart3,
    Users,
    Package,
    Target,
    Sparkles,
    Send,
    X,
    ChevronRight,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

type DateFilterOption = 'thisMonth' | 'lastMonth' | 'last3Months' | 'thisYear';

const getDateRange = (filter: DateFilterOption) => {
    const now = new Date();
    let startDate: Date;
    const endDate = now;
    
    switch (filter) {
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            break;
        case 'last3Months':
            startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
            break;
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            break;
        case 'thisMonth':
        default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
    }
    
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
    };
};

export default function DashboardPage() {
    const router = useRouter();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [aiCards, setAiCards] = useState<any[]>([]);
    const [aiSummary, setAiSummary] = useState<string>("");
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dateFilter, setDateFilter] = useState<DateFilterOption>('thisMonth');
    
    // Chat State
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{role: 'ai' | 'user', content: string}[]>([
         { role: 'ai', content: "I am connected to your live data stream. What would you like to know?" }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const chatScrollRef = React.useRef<HTMLDivElement>(null);

    // Update time every minute
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        setLoading(true);
        const { startDate, endDate } = getDateRange(dateFilter);
        fetch(`/api/dashboard/stats?startDate=${startDate}&endDate=${endDate}`)
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
                
                fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        context: { 
                            ...data.kpis, 
                            topProducts: data.topProducts,
                            employeeStats: data.employeeStats 
                        },
                        prompt: "GENERATE_DASHBOARD_INSIGHTS"
                    })
                })
                .then(r => r.json())
                .then(ai => {
                    if (ai.cards) {
                        setAiCards(ai.cards);
                    } else if (ai.text) {
                        setAiSummary(ai.text);
                    }
                })
                .catch(e => console.error(e));
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [dateFilter]);

    const filterOptions: { key: DateFilterOption; label: string }[] = [
        { key: 'thisMonth', label: 'This Month' },
        { key: 'lastMonth', label: 'Last Month' },
        { key: 'last3Months', label: 'Last 3 Months' },
        { key: 'thisYear', label: 'This Year' }
    ];

    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages]);

    const handleChatSend = async () => {
        if (!chatInput.trim()) return;
        
        const userMsg = chatInput;
        setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatInput('');
        setIsThinking(true);

        try {
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    context: { ...stats?.kpis, topProducts: stats?.topProducts, employeeStats: stats?.employeeStats },
                    prompt: userMsg 
                })
            });
            const data = await res.json();
            setChatMessages(prev => [...prev, { role: 'ai', content: data.text }]);
        } catch (e) {
            setChatMessages(prev => [...prev, { role: 'ai', content: "My connection was interrupted. Please try again." }]);
        } finally {
            setIsThinking(false);
        }
    };

    const formatCurrency = (val: number) => {
        if (!val) return '$0';
        if (val >= 1000000) return '$' + (val / 1000000).toFixed(2) + 'm';
        if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
        return '$' + val.toLocaleString();
    };

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    // Calculate business health score
    const healthScore = stats ? Math.min(100, Math.round(
        ((stats.kpis?.netProfit || 0) / (stats.kpis?.totalRevenue || 1) * 50) + 
        (50 - (stats.kpis?.openTickets || 0) * 2) +
        (stats.kpis?.lowStock < 50 ? 20 : 0)
    )) : 78;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
            
            {/* Animated Background Grid */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />
            
            {/* Floating Orbs */}
            <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[150px]" />

            {/* Business Eye Chat Overlay */}
            {isChatOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className="bg-slate-900 border border-slate-700/50 w-full max-w-2xl h-[650px] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                        {/* Chat Header */}
                        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-blue-600/20 to-purple-600/20">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <Brain className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <span className="font-bold text-white text-lg">Business Eye AI</span>
                                    <div className="flex items-center space-x-1.5">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className="text-xs text-slate-400">Online • Llama 3.3 70B</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        
                        {/* Chat Messages */}
                        <div className="flex-1 p-6 overflow-y-auto space-y-5" ref={chatScrollRef}>
                            {chatMessages.map((msg, i) => (
                                <div key={i} className={cn("flex gap-3", msg.role === 'user' ? "flex-row-reverse" : "")}>
                                    <div className={cn(
                                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                                        msg.role === 'ai' 
                                            ? "bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30" 
                                            : "bg-emerald-500"
                                    )}>
                                        {msg.role === 'ai' ? <Bot className="w-4 h-4 text-blue-400" /> : <span className="text-[10px] font-bold text-white">YOU</span>}
                                    </div>
                                    <div className={cn(
                                        "px-4 py-3 rounded-2xl text-sm max-w-[80%] leading-relaxed",
                                        msg.role === 'ai' 
                                            ? "bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/50" 
                                            : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-tr-none shadow-lg shadow-emerald-500/20"
                                    )}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isThinking && (
                                <div className="flex gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
                                        <Bot className="w-4 h-4 text-blue-400 animate-pulse" />
                                    </div>
                                    <div className="bg-slate-800/80 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Chat Input */}
                        <div className="p-5 border-t border-slate-700/50 bg-slate-800/50">
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                                    placeholder="Ask anything about your business..." 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-5 pr-14 py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                />
                                <button 
                                    onClick={handleChatSend}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity shadow-lg shadow-blue-500/30"
                                >
                                    <Send className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="relative z-10 max-w-[1800px] mx-auto px-6 lg:px-10 py-8">
                
                {/* Top Header */}
                <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 gap-6">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Sparkles className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight">
                                    REBELX <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">HQ PRO</span>
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-slate-400 text-sm font-medium">
                                {getGreeting()}, Commander.
                            </p>
                            <div className="flex items-center gap-1.5">
                                {filterOptions.map(opt => (
                                    <button
                                        key={opt.key}
                                        onClick={() => setDateFilter(opt.key)}
                                        className={cn(
                                            "px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full transition-all",
                                            dateFilter === opt.key
                                                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                                                : "bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        {/* Business Health Score */}
                        <div className="flex items-center gap-4 bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl px-6 py-4">
                            <div className="relative">
                                <svg className="w-16 h-16 -rotate-90">
                                    <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-700" />
                                    <circle 
                                        cx="32" cy="32" r="28" fill="none" 
                                        stroke="url(#healthGradient)" 
                                        strokeWidth="4" 
                                        strokeLinecap="round"
                                        strokeDasharray={`${healthScore * 1.76} 176`}
                                        className="transition-all duration-1000"
                                    />
                                    <defs>
                                        <linearGradient id="healthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl font-black text-white">{loading ? '--' : healthScore}</span>
                                </div>
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Business Health</div>
                                <div className="text-sm font-bold text-emerald-400">Excellent</div>
                            </div>
                        </div>

                        {/* AI Chat Button */}
                        <button 
                            onClick={() => setIsChatOpen(true)}
                            className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl px-6 py-4 transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
                        >
                            <Brain className="w-5 h-5" />
                            <span className="font-bold">Ask AI</span>
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </header>

                {/* AI Neural Board */}
                <section className="mb-10">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                <Eye className="w-4 h-4 text-purple-400" />
                            </div>
                            <h2 className="text-lg font-bold">Neural Board Insights</h2>
                            <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full uppercase tracking-widest">Live AI</span>
                        </div>
                    </div>
                    
                    {aiCards.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {aiCards.map((card, idx) => (
                                <div 
                                    key={idx} 
                                    className={cn(
                                        "group relative bg-slate-800/40 backdrop-blur-sm border rounded-2xl p-6 hover:bg-slate-800/60 transition-all cursor-pointer overflow-hidden",
                                        card.status === 'positive' ? 'border-emerald-500/30 hover:border-emerald-500/50' :
                                        card.status === 'warning' ? 'border-amber-500/30 hover:border-amber-500/50' :
                                        'border-slate-700/50 hover:border-slate-600'
                                    )}
                                >
                                    {/* Status Glow */}
                                    <div className={cn(
                                        "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20",
                                        card.status === 'positive' ? 'bg-emerald-500' :
                                        card.status === 'warning' ? 'bg-amber-500' :
                                        'bg-slate-500'
                                    )} />
                                    
                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className={cn(
                                                "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                                                card.status === 'positive' ? 'bg-emerald-500/20 text-emerald-300' :
                                                card.status === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                                                'bg-slate-700 text-slate-400'
                                            )}>
                                                {card.role}
                                            </span>
                                            {card.status === 'positive' && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                                            {card.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                                            {card.status === 'neutral' && <Target className="w-5 h-5 text-slate-400" />}
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed">{card.insight}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1,2,3,4,5,6].map(i => (
                                <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 animate-pulse">
                                    <div className="w-24 h-5 bg-slate-700 rounded mb-4" />
                                    <div className="w-32 h-6 bg-slate-700 rounded mb-3" />
                                    <div className="w-full h-4 bg-slate-700/50 rounded mb-2" />
                                    <div className="w-3/4 h-4 bg-slate-700/50 rounded" />
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* KPI Grid */}
                <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-10">
                    <KpiTile
                        icon={DollarSign}
                        label="Revenue"
                        value={loading ? '...' : formatCurrency(stats?.kpis?.totalRevenue)}
                        change="+12.5%"
                        positive
                        onClick={() => router.push('/reports/financials/income-statement')}
                    />
                    <KpiTile
                        icon={TrendingUp}
                        label="Net Profit"
                        value={loading ? '...' : formatCurrency(stats?.kpis?.netProfit)}
                        change="~73%"
                        positive
                        onClick={() => router.push('/reports/financials/income-statement')}
                    />
                    <KpiTile
                        icon={ShoppingCart}
                        label="Web Orders"
                        value={loading ? '...' : stats?.kpis?.webOrders?.toLocaleString()}
                        change="+8%"
                        positive
                        onClick={() => router.push('/sales/web-orders')}
                    />
                    <KpiTile
                        icon={Package}
                        label="Manual Sales"
                        value={loading ? '...' : stats?.kpis?.manualSales?.toLocaleString()}
                        change="+5%"
                        positive
                    />
                    <KpiTile
                        icon={Users}
                        label="Clients"
                        value={loading ? '...' : stats?.kpis?.activeClients?.toLocaleString()}
                        change="+23"
                        positive
                        onClick={() => router.push('/crm/clients')}
                    />
                    <KpiTile
                        icon={Package}
                        label="Products"
                        value={loading ? '...' : stats?.kpis?.totalSkus?.toLocaleString()}
                        change="Active"
                        neutral
                        onClick={() => router.push('/warehouse/skus')}
                    />
                    <KpiTile
                        icon={Layers}
                        label="Low Stock"
                        value={loading ? '...' : stats?.kpis?.lowStock}
                        change="Monitor"
                        warning
                    />
                    <KpiTile
                        icon={Wrench}
                        label="Open Tickets"
                        value={loading ? '...' : stats?.kpis?.openTickets}
                        change="Pending"
                        warning={stats?.kpis?.openTickets > 5}
                         neutral={stats?.kpis?.openTickets <= 5}
                        onClick={() => router.push('/help/tickets')}
                    />
                </section>

                {/* Bottom Grid: Top Products & Team Performance */}
                <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Products */}
                    <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                                </div>
                                <h3 className="font-bold">Top Selling Products</h3>
                            </div>
                            <button className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
                                View All <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {stats?.topProducts?.slice(0, 5).map((product: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-400 font-black text-xs">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-slate-200 group-hover:text-white transition-colors">{product.name || product._id}</div>
                                            <div className="text-xs text-slate-500">{product.totalQty?.toLocaleString()} units sold</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-emerald-400">{formatCurrency(product.totalRevenue)}</div>
                                    </div>
                                </div>
                            )) || (
                                <div className="text-slate-500 text-sm">Loading top products...</div>
                            )}
                        </div>
                    </div>

                    {/* Team Performance */}
                    <div className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Users className="w-4 h-4 text-blue-400" />
                                </div>
                                <h3 className="font-bold">Team Activity</h3>
                            </div>
                            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full uppercase tracking-widest">This Month</span>
                        </div>
                        <div className="space-y-4">
                            {stats?.employeeStats?.slice(0, 5).map((emp: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                            {emp.name?.charAt(0) || '?'}
                                        </div>
                                        <div>
                                            <div className="font-medium text-sm text-slate-200 group-hover:text-white transition-colors">{emp.name || 'Unknown'}</div>
                                            <div className="text-xs text-slate-500">{emp.department || 'N/A'}</div>
                                        </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <div className="text-xs text-slate-400">
                                            <span className="text-blue-400">{emp.breakdown?.calls || 0}</span> calls
                                        </div>
                                        <div className="font-bold text-white">{emp.totalActivities} total</div>
                                    </div>
                                </div>
                            )) || (
                                <div className="text-slate-500 text-sm">Loading team data...</div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="mt-10 text-center">
                    <p className="text-[10px] text-slate-600 font-medium">
                        Powered by <span className="text-slate-500">Groq Llama 3.3 70B</span> • RebelX HQ Pro v2.0
                    </p>
                </footer>
            </div>
        </div>
    );
}

function KpiTile({ icon: Icon, label, value, change, positive, warning, neutral, onClick }: {
    icon: any;
    label: string;
    value: string;
    change: string;
    positive?: boolean;
    warning?: boolean;
    neutral?: boolean;
    onClick?: () => void;
}) {
    return (
        <div 
            onClick={onClick}
            className={cn(
                "bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-5 hover:bg-slate-800/60 hover:border-slate-600 transition-all group",
                onClick && "cursor-pointer"
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    positive ? "bg-emerald-500/20 text-emerald-400" :
                    warning ? "bg-amber-500/20 text-amber-400" :
                    "bg-slate-700 text-slate-400"
                )}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    positive ? "bg-emerald-500/20 text-emerald-300" :
                    warning ? "bg-amber-500/20 text-amber-300" :
                    "bg-slate-700 text-slate-400"
                )}>
                    {change}
                </span>
            </div>
            <div className="text-2xl font-black text-white group-hover:scale-105 transition-transform origin-left">{value}</div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{label}</div>
        </div>
    );
}
