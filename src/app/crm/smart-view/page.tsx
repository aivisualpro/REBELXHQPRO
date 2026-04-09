'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowUpDown, Search, X, Loader2, Briefcase, Mail, Phone, MessageSquare,
    User, Layers, CheckCircle2, Calendar,
    Hourglass, PhoneCall, AlertTriangle, Eye, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SmartViewClient {
    _id: string;
    name: string;
    contactPerson?: string;
    emails: { value: string; label?: string }[];
    phones: { value: string; label?: string }[];
    addresses: { city: string; state: string }[];
    salesPerson?: { firstName: string; lastName: string };
    totalRevenue: number;
    balance: number;
    orderCount: number;
    emailCount?: number;
    callCount?: number;
    smsCount?: number;
    lastActivity?: string;
    companyType: string;
    contactStatus?: string;
    forecastedAmount?: number;
}

// ─── View Configs ────────────────────────────────────────────────────────────

const VIEW_CONFIG: Record<string, {
    title: string;
    description: string;
    icon: React.ReactNode;
    accentColor: string;
    iconBg: string;
}> = {
    'daily-calling': {
        title: 'Daily Calling List',
        description: 'Contacts with phone numbers not yet called today',
        icon: <Phone className="w-4 h-4" />,
        accentColor: 'text-blue-500',
        iconBg: 'bg-blue-500/10 border-blue-500/20',
    },
    'leads-to-call': {
        title: 'Leads to Call',
        description: 'Leads with phone numbers that have never been called',
        icon: <PhoneCall className="w-4 h-4" />,
        accentColor: 'text-orange-500',
        iconBg: 'bg-orange-500/10 border-orange-500/20',
    },
    'no-contact-7d': {
        title: 'No Contact > 7 Days',
        description: 'Contacts with no activity in the last 7 days',
        icon: <Hourglass className="w-4 h-4" />,
        accentColor: 'text-amber-500',
        iconBg: 'bg-amber-500/10 border-amber-500/20',
    }
};

// ─── Columns (identical to /crm/leads) ──────────────────────────────────────

const COLUMNS: { key: string; label: string; width: string; nosort?: boolean; align?: string }[] = [
    { key: 'name', label: 'Name', width: 'w-[280px]' },
    { key: 'contact', label: 'Email', width: 'w-[40px]', nosort: true },
    { key: 'phone', label: 'Call', width: 'w-[40px]', nosort: true },
    { key: 'sms', label: 'SMS', width: 'w-[40px]', nosort: true },
    { key: 'address', label: 'Address', width: 'w-[130px]', nosort: true },
    { key: 'salesPerson', label: 'Rep', width: 'w-[100px]' },
    { key: 'companyType', label: 'Type', width: 'w-[80px]' },
    { key: 'contactStatus', label: 'Stage', width: 'w-[90px]' },
    { key: 'aging', label: 'Lead Aging', width: 'w-[210px]', nosort: true },
    { key: 'activities', label: 'Activity', width: 'w-[90px]', nosort: true },
];

// ─── Helpers (same as leads page) ───────────────────────────────────────────

const AgingChip = ({ value, label, showSeparator, color }: { value: string | number; label: string; showSeparator: boolean; color: string }) => {
    const isEmpty = Number(value) === 0;
    const displayColor = isEmpty ? '#CBD5E1' : color;
    return (
        <div className="flex items-center">
            <div className="flex flex-col items-center px-0.5 shrink-0 min-w-[24px]">
                <span className="text-[11px] font-black leading-none" style={{ color: displayColor }}>{String(value).padStart(2, '0')}</span>
                <span className="text-[6px] font-black mt-0.5" style={{ color: displayColor }}>{label}</span>
            </div>
            {showSeparator && <div className="h-4 w-[1px] bg-border/50" />}
        </div>
    );
};

function LeadAgingCounter({ lastActivity }: { lastActivity?: string }) {
    const [duration, setDuration] = useState<{ years: number; months: number; days: number; hours: number; minutes: number; seconds: number } | null>(null);
    useEffect(() => {
        if (!lastActivity) return;
        const update = () => {
            let diff = Date.now() - new Date(lastActivity).getTime();
            if (diff < 0) diff = 0;
            const seconds = Math.floor((diff / 1000) % 60);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
            setDuration({ years: Math.floor(totalDays / 365), months: Math.floor((totalDays % 365) / 30), days: (totalDays % 365) % 30, hours, minutes, seconds });
        };
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [lastActivity]);
    if (!lastActivity || !duration) return <span className="text-muted-foreground/30 text-[12px]">—</span>;
    const parts = [
        { value: duration.years, label: 'YR', color: '#D25353' },
        { value: duration.months, label: 'MO', color: '#E9762B' },
        { value: duration.days, label: 'DY', color: '#FFD41D' },
        { value: duration.hours, label: 'HR', color: '#4D2B8C' },
        { value: duration.minutes, label: 'MN', color: '#0C7779' },
        { value: duration.seconds, label: 'SC', color: '#EA7B7B' },
    ];
    return <div className="flex items-center">{parts.map((p, i) => <AgingChip key={p.label} value={p.value} label={p.label} color={p.color} showSeparator={i < parts.length - 1} />)}</div>;
}

function StatusBadge({ status }: { status: string }) {
    const styleMap: Record<string, { bg: string; color: string }> = {
        'initial contact': { bg: '#64748b', color: '#ffffff' },
        'sampling': { bg: '#7c3aed', color: '#ffffff' },
        'new prospect': { bg: '#2563eb', color: '#ffffff' },
        'closed won': { bg: '#059669', color: '#ffffff' },
        'closed lost': { bg: '#dc2626', color: '#ffffff' },
    };
    const s = status?.toLowerCase() || '';
    const match = Object.keys(styleMap).find(k => s.includes(k));
    const style = match ? styleMap[match] : null;
    return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={style ? { backgroundColor: style.bg, color: style.color, borderRadius: '4px' } : { borderRadius: '4px', color: '#94a3b8' }}>
            {status || '—'}
        </span>
    );
}

function TypeBadge({ type }: { type: string }) {
    const s = type?.toLowerCase() || '';
    let colorClass = "bg-slate-600 border-slate-700 text-white";
    if (s.includes('potential') || s.includes('lead')) colorClass = "bg-blue-600 border-blue-700 text-white";
    else if (s.includes('shop')) colorClass = "bg-emerald-600 border-emerald-700 text-white";
    else if (s.includes('distro')) colorClass = "bg-sky-600 border-sky-700 text-white";
    return <span className={cn("px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border", colorClass)}>{type || '—'}</span>;
}

// ─── Skeleton Row ────────────────────────────────────────────────────────────

function SkeletonRow({ index }: { index: number }) {
    return (
        <tr className="border-b border-border/30">
            {COLUMNS.map((col) => (
                <td key={col.key} className={cn('px-2 py-2.5', col.width)}>
                    <div className={cn('h-3.5 rounded-sm bg-secondary animate-pulse',
                        col.key === 'name' ? 'w-4/5' : col.key === 'aging' ? 'w-full' : col.key === 'contactStatus' ? 'w-14' : 'w-8'
                    )} style={{ animationDelay: `${index * 30}ms` }} />
                </td>
            ))}
        </tr>
    );
}

// ─── Table Row (same as leads) ───────────────────────────────────────────────

const ClientTableRow = React.memo(function ClientTableRow({
    client, onClick, onCall, onSms, onEmail
}: {
    client: SmartViewClient; onClick: () => void;
    onCall: (id: string, phone: string) => void;
    onSms: (id: string, phone: string) => void;
    onEmail: (email: string) => void;
}) {
    return (
        <tr className="group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60"
            onClick={onClick}>
            {/* Name */}
            <td className="px-2.5 py-2.5 w-[280px] text-[12px] font-semibold text-foreground group-hover:text-foreground transition-colors">
                <div className="flex items-center gap-2">
                    <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all truncate max-w-[240px]">{client.name}</span>
                </div>
            </td>
            {/* Email */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {client.emails?.[0]?.value ? (
                    <button onClick={(e) => { e.stopPropagation(); onEmail(client.emails[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded transition-colors cursor-pointer" title={client.emails[0].value}>
                        <Mail className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>
            {/* Call */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {client.phones?.[0]?.value ? (
                    <button onClick={(e) => { e.stopPropagation(); onCall(client._id, client.phones[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 rounded transition-colors cursor-pointer" title={client.phones[0].value}>
                        <Phone className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>
            {/* SMS */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {client.phones?.[0]?.value ? (
                    <button onClick={(e) => { e.stopPropagation(); onSms(client._id, client.phones[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-purple-600 hover:text-white hover:border-purple-600 rounded transition-colors cursor-pointer" title="Send SMS">
                        <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>
            {/* Address */}
            <td className="px-2.5 py-2.5 w-[130px] text-[12px] text-foreground truncate">
                {client.addresses?.[0] ? `${client.addresses[0].city}, ${client.addresses[0].state}` : '—'}
            </td>
            {/* Rep */}
            <td className="px-2.5 py-2.5 w-[100px] text-[12px] font-medium text-foreground truncate">
                {client.salesPerson ? `${client.salesPerson.firstName} ${client.salesPerson.lastName}` : <span className="text-muted-foreground/60 italic">—</span>}
            </td>
            {/* Type */}
            <td className="px-2.5 py-2.5 w-[80px]"><TypeBadge type={client.companyType || 'POTENTIAL'} /></td>
            {/* Stage */}
            <td className="px-2.5 py-2.5 w-[90px]"><StatusBadge status={client.contactStatus || ''} /></td>
            {/* Lead Aging */}
            <td className="px-2.5 py-2.5 w-[210px]"><LeadAgingCounter lastActivity={client.lastActivity} /></td>
            {/* Activities */}
            <td className="px-2.5 py-2.5 w-[90px]">
                <div className="flex items-center justify-center space-x-0.5">
                    <span className={cn("inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                        (client.emailCount || 0) > 0 ? "bg-blue-600 border border-blue-600 text-white shadow-sm" : "bg-muted/20 border border-border/50 text-foreground/80"
                    )}>{client.emailCount || 0}</span>
                    <span className={cn("inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                        (client.callCount || 0) > 0 ? "bg-emerald-600 border border-emerald-600 text-white shadow-sm" : "bg-muted/20 border border-border/50 text-foreground/80"
                    )}>{client.callCount || 0}</span>
                    <span className={cn("inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                        (client.smsCount || 0) > 0 ? "bg-purple-600 border border-purple-600 text-white shadow-sm" : "bg-muted/20 border border-border/50 text-foreground/80"
                    )}>{client.smsCount || 0}</span>
                </div>
            </td>
        </tr>
    );
});

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function SmartViewPage() {
    return (
        <Suspense fallback={<ShellSkeleton />}>
            <SmartViewContent />
        </Suspense>
    );
}

function ShellSkeleton() {
    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-secondary animate-pulse" />
                <div className="h-4 w-32 bg-secondary animate-pulse rounded" />
                <div className="flex-1" />
                <div className="h-8 w-56 bg-secondary animate-pulse rounded" />
            </div>
            <div className="flex-1 overflow-hidden px-2 py-1">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-secondary"><tr>{COLUMNS.map(c => <th key={c.key} className={cn('px-2 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest', c.width)}>{c.label}</th>)}</tr></thead>
                    <tbody>{Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)}</tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function SmartViewContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const view = searchParams.get('view') || 'daily-calling';
    const config = VIEW_CONFIG[view];

    const [clients, setClients] = useState<SmartViewClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const scrollRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

    useEffect(() => {
        setPage(1);
        setSearch('');
        setDebouncedSearch('');
    }, [view]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/crm/smart-views?view=${view}&page=${page}&limit=50`);
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
        fetchData();
    }, [fetchData]);

    // Client-side filter by search
    const filteredClients = debouncedSearch
        ? clients.filter(c =>
            c.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            c.emails?.some(e => e.value?.toLowerCase().includes(debouncedSearch.toLowerCase())) ||
            c.phones?.some(p => p.value?.includes(debouncedSearch))
        )
        : clients;

    // ─── Google Voice ──────────────────────────────────────────────────────────
    const initiateGoogleVoice = (clientId: string, phoneNumber: string, type: 'calls' | 'messages') => {
        if (!phoneNumber) { toast.error('No phone number'); return; }
        const d = phoneNumber.replace(/\D/g, '');
        let e164; if (phoneNumber.includes('+')) e164 = d; else if (d.startsWith('1') && d.length === 11) e164 = d; else if (d.length === 10) e164 = '1' + d; else e164 = d;
        const w = 450, h = 650, l = (window.screen.width / 2) - (w / 2), t = (window.screen.height / 2) - (h / 2);
        window.open(type === 'calls' ? `https://voice.google.com/u/0/calls?a=nc,%2B${e164}` : `https://voice.google.com/u/0/messages?number=%2B${e164}`, 'GoogleVoiceWindow', `width=${w},height=${h},left=${l},top=${t},menubar=no,status=no,toolbar=no`);
        setTimeout(async () => {
            const at = type === 'calls' ? 'Call' : 'Text';
            if (confirm(`Log this ${at} to CRM?\n\nOK to log, Cancel to skip.`)) {
                const notes = prompt(`Notes for this ${at}? (optional):`) || '';
                try {
                    const r = await fetch('/api/crm/log-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId, phoneNumber, type: at, notes }) });
                    if (r.ok) { toast.success(`${at} logged!`); fetchData(); }
                } catch { toast.error('Failed to log'); }
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

    const IconNode = config.icon;

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
            {/* Header — identical structure to leads page */}
            <div className="shrink-0 border-b border-border bg-background">
                <div className="px-4 py-2.5 flex items-center gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className={cn("w-5 h-5 flex items-center justify-center", config.accentColor)}>
                            {config.icon}
                        </div>
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">{config.title}</h1>
                    </div>
                    <div className="h-5 w-px bg-border shrink-0" />

                    {/* Live count badge */}
                    <div className={cn("flex items-center space-x-2 px-3 py-1 rounded-lg border", config.iconBg)}>
                        <Zap className={cn("w-3.5 h-3.5", config.accentColor)} />
                        <span className={cn("text-sm font-black", config.accentColor)}>{total}</span>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                            {total === 1 ? 'contact' : 'contacts'}
                        </span>
                    </div>

                    <div className="flex-1" />

                    {/* Search */}
                    <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input type="text" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-8 h-8 w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"><X className="h-3 w-3" /></button>}
                    </div>
                </div>
            </div>

            {/* Table Content */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
                <div className="min-w-fit px-2 py-1">
                    <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
                        <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
                            <tr>{COLUMNS.map(col => (
                                <th key={col.key}
                                    className={cn('px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                                        col.width, col.align || 'text-left')}>
                                    <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                                        <span>{col.label}</span>
                                    </div>
                                </th>
                            ))}</tr>
                        </thead>
                        <tbody>
                            {loading ? Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />) : filteredClients.length === 0 ? (
                                <tr><td colSpan={COLUMNS.length} className="px-2 py-16 text-center">
                                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center border mx-auto mb-3", config.iconBg)}>
                                        <div className={cn("opacity-40", config.accentColor)}>{config.icon}</div>
                                    </div>
                                    <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                                        {debouncedSearch ? 'No matching contacts' : 'No contacts in this view'}
                                    </p>
                                </td></tr>
                            ) : filteredClients.map(client => (
                                <ClientTableRow key={client._id} client={client}
                                    onClick={() => router.push(`/crm/leads/${client._id}`)}
                                    onCall={(id, ph) => initiateGoogleVoice(id, ph, 'calls')}
                                    onSms={(id, ph) => initiateGoogleVoice(id, ph, 'messages')}
                                    onEmail={(em) => window.open(`mailto:${em}`, '_blank')}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Footer */}
            {totalPages > 1 && (
                <div className="shrink-0 flex items-center justify-between px-6 py-2.5 border-t border-border bg-secondary">
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
