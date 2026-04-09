'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Phone, PhoneCall, Hourglass, Eye, AlertTriangle,
    Mail, MessageSquare, ArrowLeft, Loader2, ChevronRight,
    MapPin, User, Clock, Zap, ExternalLink, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface SmartViewClient {
    _id: string;
    name: string;
    emails: { value: string; label?: string }[];
    phones: { value: string; label?: string }[];
    addresses: { city: string; state: string }[];
    contactStatus?: string;
    companyType?: string;
    forecastedAmount?: number;
    lastActivity?: string;
    emailCount?: number;
    callCount?: number;
    smsCount?: number;
}

const VIEW_CONFIG: Record<string, {
    title: string;
    description: string;
    icon: React.ReactNode;
    gradient: string;
    accentColor: string;
    iconBg: string;
    emptyMessage: string;
}> = {
    'daily-calling': {
        title: 'Daily Calling List',
        description: 'Contacts with phone numbers not yet called today',
        icon: <Phone className="w-5 h-5" />,
        gradient: 'from-blue-500/10 via-blue-400/5 to-transparent',
        accentColor: 'text-blue-500',
        iconBg: 'bg-blue-500/10 border-blue-500/20',
        emptyMessage: 'All contacts have been called today! 🎉'
    },
    'leads-to-call': {
        title: 'Leads to Call',
        description: 'Leads with phone numbers that have never been called',
        icon: <PhoneCall className="w-5 h-5" />,
        gradient: 'from-orange-500/10 via-orange-400/5 to-transparent',
        accentColor: 'text-orange-500',
        iconBg: 'bg-orange-500/10 border-orange-500/20',
        emptyMessage: 'All leads have been called at least once!'
    },
    'no-contact-7d': {
        title: 'No Contact > 7 Days',
        description: 'Contacts with no activity in the last 7 days',
        icon: <Hourglass className="w-5 h-5" />,
        gradient: 'from-amber-500/10 via-amber-400/5 to-transparent',
        accentColor: 'text-amber-500',
        iconBg: 'bg-amber-500/10 border-amber-500/20',
        emptyMessage: 'All contacts have been reached within 7 days!'
    }
};

function TimeSince({ date }: { date?: string }) {
    const [text, setText] = useState('');

    useEffect(() => {
        if (!date) return;
        const update = () => {
            const diff = Date.now() - new Date(date).getTime();
            const mins = Math.floor(diff / 60000);
            const hrs = Math.floor(mins / 60);
            const days = Math.floor(hrs / 24);
            if (days > 0) setText(`${days}d ago`);
            else if (hrs > 0) setText(`${hrs}h ago`);
            else if (mins > 0) setText(`${mins}m ago`);
            else setText('Just now');
        };
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, [date]);

    if (!date) return <span className="text-muted-foreground/30 text-[10px]">Never</span>;
    return <span className="text-[10px] font-bold text-muted-foreground">{text}</span>;
}

function SmartViewContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const view = searchParams.get('view') || 'daily-calling';
    const config = VIEW_CONFIG[view];

    const [clients, setClients] = useState<SmartViewClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/crm/smart-views?view=${view}&page=${page}&limit=25`);
            const data = await res.json();
            if (data.clients) {
                setClients(data.clients);
                setTotal(data.total);
                setTotalPages(data.totalPages);
            }
        } catch (error) {
            console.error('Error fetching smart view:', error);
            toast.error('Failed to load smart view data');
        } finally {
            setLoading(false);
        }
    }, [view, page]);

    useEffect(() => {
        setPage(1);
        setSearchQuery('');
    }, [view]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredClients = searchQuery
        ? clients.filter(c =>
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.emails?.some(e => e.value?.toLowerCase().includes(searchQuery.toLowerCase())) ||
            c.phones?.some(p => p.value?.includes(searchQuery))
        )
        : clients;

    const initiateCall = (clientId: string, phoneNumber: string) => {
        const digitsOnly = phoneNumber.replace(/\D/g, '');
        let e164;
        if (phoneNumber.includes('+')) e164 = digitsOnly;
        else if (digitsOnly.startsWith('1') && digitsOnly.length === 11) e164 = digitsOnly;
        else if (digitsOnly.length === 10) e164 = '1' + digitsOnly;
        else e164 = digitsOnly;

        const width = 450, height = 650;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        window.open(
            `https://voice.google.com/u/0/calls?a=nc,%2B${e164}`,
            'GoogleVoiceWindow',
            `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no`
        );

        setTimeout(async () => {
            const shouldLog = confirm('Log this Call to CRM?\n\nClick OK to log, or Cancel to skip.');
            if (shouldLog) {
                const notes = prompt('Any notes for this Call? (optional):') || '';
                try {
                    const res = await fetch('/api/crm/log-call', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientId, phoneNumber, type: 'Call', notes })
                    });
                    if (res.ok) {
                        toast.success('Call logged to CRM!');
                        fetchData();
                    }
                } catch { toast.error('Failed to log activity'); }
            }
        }, 3000);
    };

    if (!config) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Invalid smart view</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden">
            {/* Premium Header */}
            <div className={cn("relative shrink-0 border-b border-border overflow-hidden")}>
                <div className={cn("absolute inset-0 bg-gradient-to-r", config.gradient)} />
                <div className="relative px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={() => router.push('/crm/inbox')}
                                className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                                <ArrowLeft className="w-4 h-4" />
                            </button>
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border", config.iconBg)}>
                                <div className={config.accentColor}>{config.icon}</div>
                            </div>
                            <div>
                                <h1 className="text-sm font-black text-foreground uppercase tracking-tight">{config.title}</h1>
                                <p className="text-[11px] text-muted-foreground mt-0.5">{config.description}</p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            {/* Live count badge */}
                            <div className={cn(
                                "flex items-center space-x-2 px-3 py-1.5 rounded-lg border",
                                config.iconBg
                            )}>
                                <Zap className={cn("w-3.5 h-3.5", config.accentColor)} />
                                <span className={cn("text-sm font-black", config.accentColor)}>{total}</span>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                    {total === 1 ? 'contact' : 'contacts'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="mt-3 relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Filter contacts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-8 pl-9 pr-4 text-[11px] bg-secondary/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder:text-muted-foreground/50 text-foreground"
                        />
                    </div>
                </div>
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="flex flex-col items-center space-y-3">
                            <Loader2 className={cn("w-8 h-8 animate-spin", config.accentColor)} />
                            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Loading...</span>
                        </div>
                    </div>
                ) : filteredClients.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center border", config.iconBg)}>
                            <div className={cn("opacity-40", config.accentColor)}>{config.icon}</div>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium">{config.emptyMessage}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {filteredClients.map((client, idx) => (
                            <div
                                key={client._id}
                                className="group relative flex items-center px-6 py-3 hover:bg-secondary/30 transition-all duration-200 cursor-pointer"
                                onClick={() => router.push(`/crm/leads/${client._id}`)}
                            >
                                {/* Index / Avatar */}
                                <div className="flex items-center space-x-4 min-w-[200px]">
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 border transition-all",
                                        "bg-secondary border-border text-muted-foreground",
                                        "group-hover:border-primary/30 group-hover:bg-primary/5"
                                    )}>
                                        {client.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-bold text-foreground truncate max-w-[160px] group-hover:text-primary transition-colors">
                                            {client.name}
                                        </p>
                                        {client.companyType && (
                                            <span className={cn(
                                                "inline-block text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full mt-0.5 border",
                                                client.companyType?.toLowerCase().includes('potential')
                                                    ? "text-blue-500 border-blue-200 dark:border-blue-500/20"
                                                    : client.companyType?.toLowerCase().includes('active') || client.companyType?.toLowerCase().includes('won')
                                                        ? "text-emerald-500 border-emerald-200 dark:border-emerald-500/20"
                                                        : "text-muted-foreground border-border"
                                            )}>
                                                {client.companyType}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="flex-1 flex items-center space-x-6 px-4">
                                    {/* Email */}
                                    <div className="flex items-center space-x-2 min-w-[180px]">
                                        <Mail className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                        <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                                            {client.emails?.[0]?.value || '—'}
                                        </span>
                                    </div>

                                    {/* Phone */}
                                    <div className="flex items-center space-x-2 min-w-[130px]">
                                        <Phone className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                        <span className="text-[11px] text-muted-foreground truncate">
                                            {client.phones?.[0]?.value || '—'}
                                        </span>
                                    </div>

                                    {/* Location */}
                                    <div className="flex items-center space-x-2 min-w-[100px]">
                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                        <span className="text-[11px] text-muted-foreground truncate">
                                            {client.addresses?.[0] ? `${client.addresses[0].city}, ${client.addresses[0].state}` : '—'}
                                        </span>
                                    </div>

                                    {/* Last Activity */}
                                    <div className="flex items-center space-x-2 min-w-[80px]">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                                        <TimeSince date={client.lastActivity} />
                                    </div>
                                </div>

                                {/* Activity Indicators */}
                                <div className="flex items-center space-x-1.5 shrink-0">
                                    <span className={cn(
                                        "inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded text-[9px] font-black",
                                        (client.emailCount || 0) > 0
                                            ? "bg-blue-500 text-white shadow-sm shadow-blue-500/20"
                                            : "bg-secondary text-muted-foreground/30"
                                    )}>
                                        {client.emailCount || 0}
                                    </span>
                                    <span className={cn(
                                        "inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded text-[9px] font-black",
                                        (client.callCount || 0) > 0
                                            ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/20"
                                            : "bg-secondary text-muted-foreground/30"
                                    )}>
                                        {client.callCount || 0}
                                    </span>
                                    <span className={cn(
                                        "inline-flex items-center justify-center min-w-[22px] h-5 px-1 rounded text-[9px] font-black",
                                        (client.smsCount || 0) > 0
                                            ? "bg-purple-500 text-white shadow-sm shadow-purple-500/20"
                                            : "bg-secondary text-muted-foreground/30"
                                    )}>
                                        {client.smsCount || 0}
                                    </span>
                                </div>

                                {/* Quick Actions (visible on hover) */}
                                <div className="flex items-center space-x-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {client.phones?.[0]?.value && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                initiateCall(client._id, client.phones[0].value);
                                            }}
                                            className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-muted-foreground hover:text-emerald-500 rounded-lg transition-colors cursor-pointer"
                                            title="Call"
                                        >
                                            <Phone className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    {client.emails?.[0]?.value && (
                                        <a
                                            href={`mailto:${client.emails[0].value}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-muted-foreground hover:text-blue-500 rounded-lg transition-colors"
                                            title="Email"
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                        </a>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/crm/leads/${client._id}`);
                                        }}
                                        className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-colors cursor-pointer"
                                        title="View Details"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                {/* Active indicator line */}
                                <div className={cn(
                                    "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity",
                                    config.accentColor === 'text-blue-500' ? 'bg-blue-500' :
                                        config.accentColor === 'text-red-500' ? 'bg-red-500' :
                                            config.accentColor === 'text-orange-500' ? 'bg-orange-500' :
                                                config.accentColor === 'text-amber-500' ? 'bg-amber-500' :
                                                    'bg-violet-500'
                                )} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between px-6 py-2.5 border-t border-border bg-secondary/20">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                        Page {page} of {totalPages} · {total} total
                    </span>
                    <div className="flex items-center space-x-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider border border-border rounded hover:bg-secondary transition-colors disabled:opacity-30 cursor-pointer"
                        >
                            Previous
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider border border-border rounded hover:bg-secondary transition-colors disabled:opacity-30 cursor-pointer"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function SmartViewPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <SmartViewContent />
        </Suspense>
    );
}
