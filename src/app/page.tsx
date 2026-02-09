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
    Eye,
    UserX,
    UserCheck,
    Flame,
    Snowflake,
    HeartCrack,
    ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/components/ThemeProvider';

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
    const { data: session } = useSession();
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
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
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
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

    // Client metrics
    const clientInactivity = stats?.clientInactivity || {};
    const totalWholesale = clientInactivity.totalWholesaleClients || 0;
    const activeClients = clientInactivity.activeClients || 0;
    const retentionRate = totalWholesale > 0 ? Math.round((activeClients / totalWholesale) * 100) : 100;

    return (
        <div className={cn(
            "h-full flex flex-col relative overflow-hidden",
            isDark 
                ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
                : "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900"
        )}>
            
            {/* Animated Background Grid */}
            <div className={cn("absolute inset-0 pointer-events-none", isDark ? "opacity-[0.03]" : "opacity-[0.04]")} style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${isDark ? '%23ffffff' : '%23000000'}' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />
            
            {/* Floating Orbs */}
            <div className={cn(
                "absolute top-20 left-20 w-96 h-96 rounded-full blur-[120px] animate-pulse pointer-events-none",
                isDark ? "bg-blue-500/10" : "bg-blue-500/[0.07]"
            )} />
            <div className={cn(
                "absolute bottom-20 right-20 w-96 h-96 rounded-full blur-[120px] animate-pulse pointer-events-none",
                isDark ? "bg-purple-500/10" : "bg-purple-500/[0.06]"
            )} style={{ animationDelay: '1s' }} />
            <div className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] pointer-events-none",
                isDark ? "bg-emerald-500/5" : "bg-emerald-500/[0.04]"
            )} />

            {/* Business Eye Chat Overlay */}
            {isChatOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className={cn(
                        "w-full max-w-2xl h-[650px] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300",
                        isDark ? "bg-slate-900 border border-slate-700/50" : "bg-white border border-slate-200"
                    )}>
                        {/* Chat Header */}
                        <div className={cn(
                            "p-5 flex items-center justify-between",
                            isDark 
                                ? "border-b border-slate-700/50 bg-gradient-to-r from-blue-600/20 to-purple-600/20" 
                                : "border-b border-slate-200 bg-gradient-to-r from-blue-50 to-purple-50"
                        )}>
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <Brain className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <span className={cn("font-bold text-lg", isDark ? "text-white" : "text-slate-900")}>Business Eye AI</span>
                                    <div className="flex items-center space-x-1.5">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                                        <span className={cn("text-xs", isDark ? "text-slate-400" : "text-slate-500")}>Online • Llama 3.3 70B</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsChatOpen(false)} className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                                isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-slate-100 hover:bg-slate-200"
                            )}>
                                <X className={cn("w-5 h-5", isDark ? "text-slate-400" : "text-slate-500")} />
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
                                            ? isDark 
                                                ? "bg-slate-800/80 text-slate-200 rounded-tl-none border border-slate-700/50"
                                                : "bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200"
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
                                    <div className={cn(
                                        "px-4 py-3 rounded-2xl rounded-tl-none flex items-center space-x-2",
                                        isDark ? "bg-slate-800/80 border border-slate-700/50" : "bg-slate-100 border border-slate-200"
                                    )}>
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Chat Input */}
                        <div className={cn(
                            "p-5",
                            isDark ? "border-t border-slate-700/50 bg-slate-800/50" : "border-t border-slate-200 bg-slate-50"
                        )}>
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                                    placeholder="Ask anything about your business..." 
                                    className={cn(
                                        "w-full rounded-2xl pl-5 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all",
                                        isDark 
                                            ? "bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500"
                                            : "bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400"
                                    )}
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

            {/* Sticky Page Header */}
            <div className={cn(
                "flex-none z-40 backdrop-blur-md shadow-2xl",
                isDark 
                    ? "bg-slate-900/80 border-b border-white/5 shadow-black/20" 
                    : "bg-white/80 border-b border-slate-200/80 shadow-slate-200/50"
            )}>
                <div className="max-w-[1800px] mx-auto p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Brand & Filters */}
                    <div className="flex items-center gap-6">
                        <div className="flex items-center space-x-3">
                            <div>
                                <h1 className="text-2xl font-black tracking-tight leading-none">
                                    REBELX <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">HQ PRO</span>
                                </h1>
                                <p className={cn("text-[10px] font-medium mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                                    {getGreeting()}, {session?.user?.name || 'Commander'}.
                                </p>
                            </div>
                        </div>

                        <div className={cn("h-8 w-px mx-2 hidden lg:block", isDark ? "bg-white/10" : "bg-slate-200")} />

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            {filterOptions.map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => setDateFilter(opt.key)}
                                    className={cn(
                                        "h-9 px-3 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap flex items-center justify-center",
                                        dateFilter === opt.key
                                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                                            : isDark 
                                                ? "bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/50"
                                                : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 border border-slate-200"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* Stats & Actions */}
                    <div className="flex items-center gap-4">
                        {/* Business Health Score */}
                        <div className={cn(
                            "hidden md:flex items-center gap-2 rounded-xl pl-2 pr-3 h-9",
                            isDark ? "bg-slate-800/50 border border-slate-700/50" : "bg-slate-100 border border-slate-200"
                        )}>
                            <div className="relative w-6 h-6">
                                <svg className="w-full h-full -rotate-90">
                                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" className={isDark ? "text-slate-700" : "text-slate-200"} />
                                    <circle 
                                        cx="12" cy="12" r="10" fill="none" 
                                        stroke="url(#headerHealthGradient)" 
                                        strokeWidth="2" 
                                        strokeLinecap="round"
                                        strokeDasharray={`${healthScore * 0.628} 62.8`}
                                        className="transition-all duration-1000"
                                    />
                                    <defs>
                                        <linearGradient id="headerHealthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#10b981" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className={cn("text-[8px] font-black", isDark ? "text-white" : "text-slate-800")}>{loading ? '..' : healthScore}</span>
                                </div>
                            </div>
                            <div>
                                <div className={cn("text-[7px] font-bold uppercase tracking-widest leading-none mb-0.5", isDark ? "text-slate-400" : "text-slate-500")}>Health</div>
                                <div className="text-[10px] font-bold text-emerald-500 leading-none">Excellent</div>
                            </div>
                        </div>

                        {/* AI Chat Button */}
                        <button 
                            onClick={() => setIsChatOpen(true)}
                            className="group flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl px-4 h-9 transition-all shadow-lg shadow-primary/20 hover:shadow-primary/40 cursor-pointer"
                        >
                            <Brain className="w-4 h-4" />
                            <span className="font-bold text-xs uppercase tracking-widest">Ask AI</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Scrollable Main Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 w-full">
                <div className="max-w-[1800px] mx-auto p-4">
                    
                    {/* AI Neural Board */}
                    <section className="mb-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Eye className="w-4 h-4 text-purple-400" />
                                </div>
                                <h2 className="text-lg font-bold">Neural Board Insights</h2>
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                                    isDark ? "bg-purple-500/20 text-purple-300" : "bg-purple-100 text-purple-600"
                                )}>Live AI</span>
                            </div>
                        </div>
                        
                        {aiCards.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {aiCards.map((card, idx) => (
                                    <div 
                                        key={idx} 
                                        className={cn(
                                            "group relative backdrop-blur-sm border rounded-2xl p-6 transition-all cursor-pointer overflow-hidden",
                                            isDark ? "bg-slate-800/40 hover:bg-slate-800/60" : "bg-white/80 hover:bg-white shadow-sm hover:shadow-md",
                                            card.status === 'positive' 
                                                ? isDark ? 'border-emerald-500/30 hover:border-emerald-500/50' : 'border-emerald-300 hover:border-emerald-400' :
                                            card.status === 'warning' 
                                                ? isDark ? 'border-amber-500/30 hover:border-amber-500/50' : 'border-amber-300 hover:border-amber-400' :
                                            isDark ? 'border-slate-700/50 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300'
                                        )}
                                    >
                                        {/* Status Glow */}
                                        <div className={cn(
                                            "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl",
                                            isDark ? "opacity-20" : "opacity-10",
                                            card.status === 'positive' ? 'bg-emerald-500' :
                                            card.status === 'warning' ? 'bg-amber-500' :
                                            'bg-slate-500'
                                        )} />
                                        
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-4">
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                                                    card.status === 'positive' 
                                                        ? isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700' :
                                                    card.status === 'warning' 
                                                        ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' :
                                                    isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                                                )}>
                                                    {card.role}
                                                </span>
                                                {card.status === 'positive' && <TrendingUp className="w-5 h-5 text-emerald-400" />}
                                                {card.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                                                {card.status === 'neutral' && <Target className="w-5 h-5 text-slate-400" />}
                                            </div>
                                            <h3 className={cn("text-lg font-bold mb-2", isDark ? "text-white" : "text-slate-900")}>{card.title}</h3>
                                            <p className={cn("text-sm leading-relaxed", isDark ? "text-slate-400" : "text-slate-500")}>{card.insight}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[1,2,3,4,5,6].map(i => (
                                    <div key={i} className={cn(
                                        "border rounded-2xl p-6 animate-pulse",
                                        isDark ? "bg-slate-800/40 border-slate-700/50" : "bg-white border-slate-200"
                                    )}>
                                        <div className={cn("w-24 h-5 rounded mb-4", isDark ? "bg-slate-700" : "bg-slate-200")} />
                                        <div className={cn("w-32 h-6 rounded mb-3", isDark ? "bg-slate-700" : "bg-slate-200")} />
                                        <div className={cn("w-full h-4 rounded mb-2", isDark ? "bg-slate-700/50" : "bg-slate-100")} />
                                        <div className={cn("w-3/4 h-4 rounded", isDark ? "bg-slate-700/50" : "bg-slate-100")} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Client Retention Command Center */}
                    <section className="mb-10">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/30 to-red-500/30 flex items-center justify-center">
                                    <Flame className="w-4 h-4 text-orange-400" />
                                </div>
                                <h2 className="text-lg font-bold">Client Retention Command Center</h2>
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                                    isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-600"
                                )}>Wholesale Only</span>
                            </div>
                            <button 
                                onClick={() => router.push('/crm/clients')}
                                className={cn("text-xs transition-colors flex items-center gap-1", isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900")}
                            >
                                View All Clients <ChevronRight className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Hero Stats Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
                            {/* Retention Rate - Large Card */}
                            <div className={cn(
                                "lg:col-span-2 relative overflow-hidden backdrop-blur-sm rounded-3xl p-6 group transition-all",
                                isDark 
                                    ? "bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 hover:border-emerald-400/50" 
                                    : "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 hover:border-emerald-300 shadow-sm"
                            )}>
                                <div className={cn("absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl", isDark ? "bg-emerald-500/20" : "bg-emerald-400/15")} />
                                <div className={cn("absolute bottom-0 left-0 w-32 h-32 rounded-full blur-2xl", isDark ? "bg-teal-500/10" : "bg-teal-400/10")} />
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-4">
                                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                                        <span className={cn("text-[10px] font-black uppercase tracking-widest", isDark ? "text-emerald-300" : "text-emerald-600")}>Retention Rate</span>
                                    </div>
                                    <div className="flex items-end gap-4">
                                        <div className={cn("text-6xl font-black leading-none", isDark ? "text-white" : "text-slate-900")}>
                                            {loading ? '..' : retentionRate}<span className="text-3xl text-emerald-500">%</span>
                                        </div>
                                        <div className="relative w-24 h-24">
                                            <svg className="w-full h-full -rotate-90">
                                                <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="8" className={isDark ? "text-slate-700/50" : "text-emerald-200/60"} />
                                                <circle 
                                                    cx="48" cy="48" r="40" fill="none" 
                                                    stroke="url(#retentionGradient)" 
                                                    strokeWidth="8" 
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${retentionRate * 2.51} 251`}
                                                    className="transition-all duration-1000"
                                                />
                                                <defs>
                                                    <linearGradient id="retentionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                                        <stop offset="0%" stopColor="#10b981" />
                                                        <stop offset="100%" stopColor="#14b8a6" />
                                                    </linearGradient>
                                                </defs>
                                            </svg>
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <UserCheck className="w-8 h-8 text-emerald-500" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                                            <span className={isDark ? "text-slate-400" : "text-slate-500"}>Active: <span className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>{loading ? '..' : activeClients}</span></span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-slate-500 rounded-full" />
                                            <span className={isDark ? "text-slate-400" : "text-slate-500"}>Total: <span className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>{loading ? '..' : totalWholesale}</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Risk Cards */}
                            <div 
                                className={cn(
                                    "relative overflow-hidden backdrop-blur-sm rounded-3xl p-5 group hover:scale-[1.02] transition-all cursor-pointer",
                                    isDark 
                                        ? "bg-gradient-to-br from-amber-900/30 to-yellow-900/20 border border-amber-500/40 hover:border-amber-400/60"
                                        : "bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 hover:border-amber-300 shadow-sm"
                                )}
                                onClick={() => router.push('/crm/clients?filter=inactive-30')}
                            >
                                <div className={cn("absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl animate-pulse", isDark ? "bg-amber-500/20" : "bg-amber-400/15")} />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <Clock className="w-6 h-6 text-amber-500" />
                                        <span className={cn(
                                            "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                                            isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700"
                                        )}>Warm</span>
                                    </div>
                                    <div className={cn("text-4xl font-black mb-1", isDark ? "text-white" : "text-slate-900")}>{loading ? '..' : (clientInactivity.i30 || 0)}</div>
                                    <div className={cn("text-[11px] font-bold uppercase tracking-wider", isDark ? "text-amber-400/80" : "text-amber-600")}>30-60 Days</div>
                                    <div className={cn("mt-3 h-1.5 rounded-full overflow-hidden", isDark ? "bg-slate-700/50" : "bg-amber-100")}>
                                        <div className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full transition-all duration-500" style={{ width: `${totalWholesale > 0 ? (clientInactivity.i30 / totalWholesale) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div 
                                className={cn(
                                    "relative overflow-hidden backdrop-blur-sm rounded-3xl p-5 group hover:scale-[1.02] transition-all cursor-pointer",
                                    isDark 
                                        ? "bg-gradient-to-br from-orange-900/30 to-red-900/20 border border-orange-500/40 hover:border-orange-400/60"
                                        : "bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 hover:border-orange-300 shadow-sm"
                                )}
                                onClick={() => router.push('/crm/clients?filter=inactive-60')}
                            >
                                <div className={cn("absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl animate-pulse", isDark ? "bg-orange-500/20" : "bg-orange-400/15")} style={{ animationDelay: '0.5s' }} />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <Snowflake className="w-6 h-6 text-orange-500" />
                                        <span className={cn(
                                            "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                                            isDark ? "bg-orange-500/20 text-orange-300" : "bg-orange-100 text-orange-700"
                                        )}>Cold</span>
                                    </div>
                                    <div className={cn("text-4xl font-black mb-1", isDark ? "text-white" : "text-slate-900")}>{loading ? '..' : (clientInactivity.i60 || 0)}</div>
                                    <div className={cn("text-[11px] font-bold uppercase tracking-wider", isDark ? "text-orange-400/80" : "text-orange-600")}>60-90 Days</div>
                                    <div className={cn("mt-3 h-1.5 rounded-full overflow-hidden", isDark ? "bg-slate-700/50" : "bg-orange-100")}>
                                        <div className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full transition-all duration-500" style={{ width: `${totalWholesale > 0 ? (clientInactivity.i60 / totalWholesale) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>

                            <div 
                                className={cn(
                                    "relative overflow-hidden backdrop-blur-sm rounded-3xl p-5 group hover:scale-[1.02] transition-all cursor-pointer",
                                    isDark 
                                        ? "bg-gradient-to-br from-red-900/40 to-rose-900/30 border border-red-500/50 hover:border-red-400/70"
                                        : "bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 hover:border-red-300 shadow-sm"
                                )}
                                onClick={() => router.push('/crm/clients?filter=inactive-90')}
                            >
                                <div className={cn("absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl animate-pulse", isDark ? "bg-red-500/30" : "bg-red-400/15")} style={{ animationDelay: '1s' }} />
                                <div className="relative z-10">
                                    <div className="flex items-center justify-between mb-3">
                                        <HeartCrack className="w-6 h-6 text-red-500" />
                                        <span className={cn(
                                            "text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-full",
                                            isDark ? "bg-red-500/30 text-red-300" : "bg-red-100 text-red-700"
                                        )}>Lost</span>
                                    </div>
                                    <div className={cn("text-4xl font-black mb-1", isDark ? "text-white" : "text-slate-900")}>{loading ? '..' : (clientInactivity.i90 || 0)}</div>
                                    <div className={cn("text-[11px] font-bold uppercase tracking-wider", isDark ? "text-red-400/80" : "text-red-600")}>90+ Days</div>
                                    <div className={cn("mt-3 h-1.5 rounded-full overflow-hidden", isDark ? "bg-slate-700/50" : "bg-red-100")}>
                                        <div className="h-full bg-gradient-to-r from-red-500 to-rose-500 rounded-full transition-all duration-500" style={{ width: `${totalWholesale > 0 ? (clientInactivity.i90 / totalWholesale) * 100 : 0}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* At Risk Clients Preview */}
                        {clientInactivity.details?.i90?.length > 0 && (
                            <div className={cn(
                                "rounded-2xl p-4",
                                isDark ? "bg-slate-800/30 border border-red-500/20" : "bg-red-50/50 border border-red-200"
                            )}>
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <span className={cn("text-xs font-bold uppercase tracking-widest", isDark ? "text-red-300" : "text-red-600")}>Critical Risk Clients (90+ Days)</span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                    {clientInactivity.details.i90.slice(0, 5).map((c: any, idx: number) => (
                                        <div 
                                            key={idx} 
                                            className={cn(
                                                "rounded-xl p-3 transition-colors cursor-pointer",
                                                isDark 
                                                    ? "bg-slate-900/50 border border-slate-700/50 hover:border-red-500/40" 
                                                    : "bg-white border border-slate-200 hover:border-red-300 shadow-sm"
                                            )}
                                            onClick={() => router.push(`/crm/clients/${c._id}`)}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500/30 to-rose-500/30 flex items-center justify-center text-red-400 font-bold text-xs">
                                                    {c.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className={cn("text-xs font-medium truncate", isDark ? "text-white" : "text-slate-900")}>{c.name || 'Unknown'}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px]">
                                                <span className="text-slate-500">{c.daysSinceLastActivity}d ago</span>
                                                <span className={isDark ? "text-slate-400" : "text-slate-500"}>{c.totalOrders} orders</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
                            isDark={isDark}
                            onClick={() => router.push('/reports/financials/income-statement')}
                        />
                        <KpiTile
                            icon={TrendingUp}
                            label="Net Profit"
                            value={loading ? '...' : formatCurrency(stats?.kpis?.netProfit)}
                            change="~73%"
                            positive
                            isDark={isDark}
                            onClick={() => router.push('/reports/financials/income-statement')}
                        />
                        <KpiTile
                            icon={ShoppingCart}
                            label="Web Orders"
                            value={loading ? '...' : stats?.kpis?.webOrders?.toLocaleString()}
                            change="+8%"
                            positive
                            isDark={isDark}
                            onClick={() => router.push('/sales/web-orders')}
                        />
                        <KpiTile
                            icon={Package}
                            label="Manual Sales"
                            value={loading ? '...' : stats?.kpis?.manualSales?.toLocaleString()}
                            change="+5%"
                            positive
                            isDark={isDark}
                        />
                        <KpiTile
                            icon={Users}
                            label="Clients"
                            value={loading ? '...' : stats?.kpis?.activeClients?.toLocaleString()}
                            change="+23"
                            positive
                            isDark={isDark}
                            onClick={() => router.push('/crm/clients')}
                        />
                        <KpiTile
                            icon={Package}
                            label="Products"
                            value={loading ? '...' : stats?.kpis?.totalSkus?.toLocaleString()}
                            change="Active"
                            neutral
                            isDark={isDark}
                            onClick={() => router.push('/warehouse/skus')}
                        />
                        <KpiTile
                            icon={Layers}
                            label="Low Stock"
                            value={loading ? '...' : stats?.kpis?.lowStock}
                            change="Monitor"
                            warning
                            isDark={isDark}
                        />
                        <KpiTile
                            icon={Wrench}
                            label="Open Tickets"
                            value={loading ? '...' : stats?.kpis?.openTickets}
                            change="Pending"
                            warning={stats?.kpis?.openTickets > 5}
                            neutral={stats?.kpis?.openTickets <= 5}
                            isDark={isDark}
                            onClick={() => router.push('/help/tickets')}
                        />
                    </section>

                    {/* Bottom Grid: Top Products & Team Performance */}
                    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top Products */}
                        <div className={cn(
                            "backdrop-blur-sm border rounded-2xl p-6",
                            isDark ? "bg-slate-800/40 border-slate-700/50" : "bg-white/80 border-slate-200 shadow-sm"
                        )}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <h3 className="font-bold">Top Selling Products</h3>
                                </div>
                                <button className={cn("text-xs transition-colors flex items-center gap-1", isDark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-900")}>
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
                                                <div className={cn("font-medium text-sm transition-colors", isDark ? "text-slate-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900")}>{product.name || product._id}</div>
                                                <div className="text-xs text-slate-500">{product.totalQty?.toLocaleString()} units sold</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-emerald-500">{formatCurrency(product.totalRevenue)}</div>
                                        </div>
                                    </div>
                                )) || (
                                    <div className="text-slate-500 text-sm">Loading top products...</div>
                                )}
                            </div>
                        </div>

                        {/* Team Performance */}
                        <div className={cn(
                            "backdrop-blur-sm border rounded-2xl p-6",
                            isDark ? "bg-slate-800/40 border-slate-700/50" : "bg-white/80 border-slate-200 shadow-sm"
                        )}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                        <Users className="w-4 h-4 text-blue-400" />
                                    </div>
                                    <h3 className="font-bold">Team Activity</h3>
                                </div>
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                                    isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-600"
                                )}>This Month</span>
                            </div>
                            <div className="space-y-4">
                                {stats?.employeeStats?.slice(0, 5).map((emp: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                                {emp.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <div className={cn("font-medium text-sm transition-colors", isDark ? "text-slate-200 group-hover:text-white" : "text-slate-700 group-hover:text-slate-900")}>{emp.name || 'Unknown'}</div>
                                                <div className="text-xs text-slate-500">{emp.department || 'N/A'}</div>
                                            </div>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            <div className="text-xs text-slate-400">
                                                <span className="text-blue-400">{emp.breakdown?.calls || 0}</span> calls
                                            </div>
                                            <div className={cn("font-bold", isDark ? "text-white" : "text-slate-900")}>{emp.totalActivities} total</div>
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
                        <p className={cn("text-[10px] font-medium", isDark ? "text-slate-600" : "text-slate-400")}>
                            Powered by <span className={isDark ? "text-slate-500" : "text-slate-500"}>Groq Llama 3.3 70B</span> • RebelX HQ Pro v2.0
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );
}

function KpiTile({ icon: Icon, label, value, change, positive, warning, neutral, isDark, onClick }: {
    icon: any;
    label: string;
    value: string;
    change: string;
    positive?: boolean;
    warning?: boolean;
    neutral?: boolean;
    isDark: boolean;
    onClick?: () => void;
}) {
    return (
        <div 
            onClick={onClick}
            className={cn(
                "backdrop-blur-sm border rounded-2xl p-5 transition-all group",
                isDark 
                    ? "bg-slate-800/40 border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600" 
                    : "bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300 shadow-sm hover:shadow-md",
                onClick && "cursor-pointer"
            )}
        >
            <div className="flex items-center justify-between mb-3">
                <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    positive ? "bg-emerald-500/20 text-emerald-400" :
                    warning ? "bg-amber-500/20 text-amber-400" :
                    isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"
                )}>
                    <Icon className="w-4 h-4" />
                </div>
                <span className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded",
                    positive 
                        ? isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-emerald-700" :
                    warning 
                        ? isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700" :
                    isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"
                )}>
                    {change}
                </span>
            </div>
            <div className={cn("text-2xl font-black group-hover:scale-105 transition-transform origin-left", isDark ? "text-white" : "text-slate-900")}>{value}</div>
            <div className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", isDark ? "text-slate-500" : "text-slate-400")}>{label}</div>
        </div>
    );
}
