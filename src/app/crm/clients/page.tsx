'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowUpDown, Search, Plus, X, Loader2, Users, Mail, Phone, MessageSquare, Send, Trash2, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import ClientModal from '@/components/crm/ClientModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Client {
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
    companyType: string;
}

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
    clients: Client[];
    hasMore: boolean;
    page: number;
    sortBy: string;
    sortOrder: string;
    search: string;
    companyType: string;
    timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Columns ─────────────────────────────────────────────────────────────────

const COLUMNS = [
    { key: 'name', label: 'Name', width: 'w-[280px]' },
    { key: 'contact', label: 'Email', width: 'w-[40px]', nosort: true },
    { key: 'phone', label: 'Phone', width: 'w-[40px]', nosort: true },
    { key: 'sms', label: 'SMS', width: 'w-[40px]', nosort: true },
    { key: 'address', label: 'Address', width: 'w-[140px]', nosort: true },
    { key: 'salesPerson', label: 'Rep', width: 'w-[100px]' },
    { key: 'companyType', label: 'Type', width: 'w-[90px]' },
    { key: 'totalRevenue', label: 'Revenue', width: 'w-[90px]', align: 'text-right' as const },
    { key: 'balance', label: 'Balance', width: 'w-[80px]', align: 'text-right' as const },
    { key: 'orderCount', label: 'Orders', width: 'w-[55px]', align: 'text-right' as const },
    { key: 'activities', label: 'Activity', width: 'w-[90px]', nosort: true },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v: number) {
    if (!v && v !== 0) return <span className="text-muted-foreground/30">—</span>;
    if (v === 0) return <span className="text-muted-foreground/30">—</span>;
    const abs = Math.abs(v);
    const sign = v < 0 ? '- ' : '';
    if (abs >= 1000) return <span className="tabular-nums">{sign}${(abs / 1000).toFixed(1)}k</span>;
    return <span className="tabular-nums">{sign}${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const s = status?.toLowerCase() || '';
    const styleMap: Record<string, { bg: string; color: string }> = {
        'shop': { bg: '#059669', color: '#ffffff' },
        'distro': { bg: '#0284c7', color: '#ffffff' },
        'vape store': { bg: '#7c3aed', color: '#ffffff' },
        'potential': { bg: '#d97706', color: '#ffffff' },
        'whl': { bg: '#64748b', color: '#ffffff' },
        'master distro': { bg: '#dc2626', color: '#ffffff' },
    };
    const match = Object.keys(styleMap).find(k => s.includes(k));
    const style = match ? styleMap[match] : null;
    return (
        <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={style ? { backgroundColor: style.bg, color: style.color, borderRadius: '4px' } : { borderRadius: '4px' }}>
            {status || '—'}
        </span>
    );
}

// ─── Skeleton Row ────────────────────────────────────────────────────────────

function SkeletonRow({ index }: { index: number }) {
    return (
        <tr className="border-b border-border/30">
            {COLUMNS.map((col) => (
                <td key={col.key} className={cn('px-2 py-2.5', col.width)}>
                    <div
                        className={cn(
                            'h-3.5 rounded-sm bg-secondary/80 animate-pulse',
                            col.key === 'name' ? 'w-4/5' : col.key === 'companyType' ? 'w-14' : col.key === 'salesPerson' ? 'w-16' : 'w-8'
                        )}
                        style={{ animationDelay: `${index * 30}ms` }}
                    />
                </td>
            ))}
        </tr>
    );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

const ClientTableRow = React.memo(function ClientTableRow({
    client, onClick, highlight, onCall, onSms, onEmail
}: {
    client: Client;
    onClick: () => void;
    highlight?: boolean;
    onCall: (id: string, phone: string) => void;
    onSms: (id: string, phone: string) => void;
    onEmail: (email: string) => void;
}) {
    return (
        <tr
            data-client-id={client._id}
            className={cn(
                'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
                highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
            )}
            onClick={onClick}
        >
            {/* Name */}
            <td className="px-2.5 py-2.5 w-[280px] text-[12px] font-semibold text-foreground group-hover:text-foreground transition-colors">
                <div className="flex items-center gap-2">
                    <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all truncate max-w-[240px]">{client.name}</span>
                </div>
            </td>

            {/* Email action */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {client.emails?.[0]?.value ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEmail(client.emails[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded transition-colors cursor-pointer"
                        title={client.emails[0].value}
                    >
                        <Mail className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>

            {/* Phone action */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {client.phones?.[0]?.value ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onCall(client._id, client.phones[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 rounded transition-colors cursor-pointer"
                        title={client.phones[0].value}
                    >
                        <Phone className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>

            {/* SMS action */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {client.phones?.[0]?.value ? (
                    <button
                        onClick={(e) => { e.stopPropagation(); onSms(client._id, client.phones[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-purple-600 hover:text-white hover:border-purple-600 rounded transition-colors cursor-pointer"
                        title="Send SMS"
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>

            {/* Address */}
            <td className="px-2.5 py-2.5 w-[140px] text-[12px] text-foreground truncate">
                {client.addresses?.[0] ? `${client.addresses[0].city}, ${client.addresses[0].state}` : '—'}
            </td>

            {/* Rep */}
            <td className="px-2.5 py-2.5 w-[100px] text-[12px] font-medium text-foreground truncate">
                {client.salesPerson ? `${client.salesPerson.firstName} ${client.salesPerson.lastName}` : <span className="text-muted-foreground/60 italic">Unassigned</span>}
            </td>

            {/* Type */}
            <td className="px-2.5 py-2.5 w-[90px]"><StatusBadge status={client.companyType || 'POTENTIAL'} /></td>

            {/* Revenue */}
            <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-right font-black text-foreground group-hover:text-foreground transition-colors">
                {fmtCurrency(client.totalRevenue)}
            </td>

            {/* Balance */}
            <td className={cn("px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-right font-bold", client.balance > 0 ? "text-red-500" : "text-emerald-500")}>
                {fmtCurrency(client.balance)}
            </td>

            {/* Orders */}
            <td className="px-2.5 py-2.5 w-[55px] text-[12px] font-mono text-right text-foreground">
                <span className="inline-flex items-center justify-center w-6 h-5 rounded bg-secondary text-[10px] font-black text-foreground">{client.orderCount || 0}</span>
            </td>

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

export default function ClientsPage() {
    return (
        <Suspense fallback={<ShellSkeleton />}>
            <ClientsContent />
        </Suspense>
    );
}

function ShellSkeleton() {
    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-secondary animate-pulse" />
                <div className="h-4 w-24 bg-secondary/80 animate-pulse rounded" />
                <div className="h-5 w-px bg-border" />
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 w-16 bg-secondary/80 animate-pulse rounded-lg" style={{ animationDelay: `${i * 50}ms` }} />)}
            </div>
            <div className="flex-1 overflow-hidden px-2 py-1">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10">
                        <tr>{COLUMNS.map((col) => (
                            <th key={col.key} className={cn('px-2 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-0', col.width)}>{col.label}</th>
                        ))}</tr>
                    </thead>
                    <tbody>{Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)}</tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function ClientsContent() {
    const router = useRouter();

    const [clients, setClients] = useState<Client[]>(globalCache.current?.clients || []);
    const [isLoading, setIsLoading] = useState(!globalCache.current);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState('totalRevenue');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [activeType, setActiveType] = useState<string>('All');

    const pageRef = useRef(globalCache.current?.page || 0);
    const mountedRef = useRef(true);
    const fetchingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Compose email state
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
    useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

    // Scroll-back & highlight
    const [highlightId, setHighlightId] = useState<string | null>(null);
    useEffect(() => {
        const savedId = sessionStorage.getItem('cl_scroll_to');
        const savedScroll = sessionStorage.getItem('cl_scroll_top');
        if (savedId) {
            sessionStorage.removeItem('cl_scroll_to'); sessionStorage.removeItem('cl_scroll_top');
            setHighlightId(savedId);
            if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
            const tryScroll = (attempts = 0) => {
                const row = document.querySelector(`[data-client-id="${savedId}"]`);
                if (row) { setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); setTimeout(() => setHighlightId(null), 3000); }
                else if (attempts < 30) setTimeout(() => tryScroll(attempts + 1), 200);
            };
            setTimeout(() => tryScroll(), 100);
        }
    }, []);

    // Status tabs & counts
    const TYPE_TABS = ['All', 'SHOP', 'DISTRO', 'VAPE STORE', 'POTENTIAL', 'WHL', 'MASTER DISTRO'] as const;
    const [typeCounts, setTypeCounts] = useState<Record<string, number>>({});
    const [countsLoaded, setCountsLoaded] = useState(false);
    const fetchTypeCounts = useCallback(async () => {
        try { const res = await fetch('/api/clients/counts'); if (res.ok) { const d = await res.json(); if (d.counts) { setTypeCounts(d.counts); setCountsLoaded(true); } } } catch { }
    }, []);
    useEffect(() => { fetchTypeCounts(); }, [fetchTypeCounts]);
    useEffect(() => { if (clients.length > 0) fetchTypeCounts(); }, [clients.length, fetchTypeCounts]);

    // ─── Fetch ──────────────────────────────────────────────────────────────────
    const abortRef = useRef<AbortController | null>(null);
    const seqRef = useRef(0);

    const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController(); abortRef.current = ctrl;
        const seq = ++seqRef.current; fetchingRef.current = true;
        if (isAppend) setIsLoadingMore(true); else setIsLoading(true);
        try {
            const params = new URLSearchParams({
                page: String(pageNum), limit: String(PAGE_SIZE), sortBy, sortOrder, search: debouncedSearch,
                minRevenue: '20',
            });
            if (activeType !== 'All') params.set('companyType', activeType);
            const res = await fetch(`/api/clients?${params}`, { signal: ctrl.signal });
            const data = await res.json();
            if (seq !== seqRef.current || !mountedRef.current) return;
            if (res.ok) {
                const newClients = data.clients || []; const total = data.total || 0;
                const newHasMore = (pageNum * PAGE_SIZE) < total;
                if (isAppend) {
                    setClients(prev => {
                        const ids = new Set(prev.map(c => c._id));
                        const merged = [...prev, ...newClients.filter((c: Client) => !ids.has(c._id))];
                        globalCache.current = { clients: merged, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, companyType: activeType, timestamp: Date.now() };
                        return merged;
                    });
                } else {
                    setClients(newClients);
                    globalCache.current = { clients: newClients, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, companyType: activeType, timestamp: Date.now() };
                }
                setHasMore(newHasMore); pageRef.current = pageNum; setError(null);
            } else { setError(data.error || 'Failed to fetch'); }
        } catch (e: any) { if (e?.name === 'AbortError') return; if (mountedRef.current) setError(e.message); }
        finally { fetchingRef.current = false; if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); } }
    }, [sortBy, sortOrder, debouncedSearch, activeType]);

    const fetchPageRef = useRef(fetchPage); fetchPageRef.current = fetchPage;
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            const c = globalCache.current;
            if (c && c.clients.length > 0 && (Date.now() - c.timestamp) < CACHE_TTL && c.sortBy === sortBy && c.sortOrder === sortOrder && c.search === debouncedSearch && c.companyType === activeType) {
                setClients(c.clients); setHasMore(c.hasMore); pageRef.current = c.page; setIsLoading(false); return;
            }
        }
        globalCache.current = null; pageRef.current = 0; setClients([]); setHasMore(true);
        fetchPageRef.current(1, false);
    }, [sortBy, sortOrder, debouncedSearch, activeType]);

    // Infinite scroll
    useEffect(() => {
        const sentinel = sentinelRef.current; const container = scrollRef.current;
        if (!sentinel || !container) return;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPage(pageRef.current + 1, true);
        }, { root: container, rootMargin: '600px' });
        obs.observe(sentinel); return () => obs.disconnect();
    }, [hasMore, isLoading, fetchPage]);

    const handleSort = (column: string) => {
        if (sortBy === column) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        else { setSortBy(column); setSortOrder('desc'); }
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleTabChange = (tab: string) => { setActiveType(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); };

    // ─── Google Voice ──────────────────────────────────────────────────────────
    const initiateGoogleVoice = (clientId: string, phoneNumber: string, type: 'calls' | 'messages') => {
        const digitsOnly = phoneNumber.replace(/\D/g, '');
        let e164;
        if (phoneNumber.includes('+')) e164 = digitsOnly;
        else if (digitsOnly.startsWith('1') && digitsOnly.length === 11) e164 = digitsOnly;
        else if (digitsOnly.length === 10) e164 = '1' + digitsOnly;
        else e164 = digitsOnly;

        const width = 450, height = 650;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        const url = type === 'calls'
            ? `https://voice.google.com/u/0/calls?a=nc,%2B${e164}`
            : `https://voice.google.com/u/0/messages?number=%2B${e164}`;

        window.open(url, 'GoogleVoiceWindow', `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no`);

        setTimeout(async () => {
            const activityType = type === 'calls' ? 'Call' : 'Text';
            const shouldLog = confirm(`Log this ${activityType} to CRM?\n\nClick OK to log, or Cancel to skip.`);
            if (shouldLog) {
                const notes = prompt(`Any notes for this ${activityType}? (optional):`) || '';
                try {
                    const res = await fetch('/api/crm/log-call', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clientId, phoneNumber, type: activityType, notes })
                    });
                    if (res.ok) { toast.success(`${activityType} logged to CRM!`); }
                } catch { toast.error('Failed to log activity'); }
            }
        }, 3000);
    };

    // ─── Send Email ────────────────────────────────────────────────────────────
    const handleSendEmail = async () => {
        if (!composeData.to || !composeData.subject) { toast.error('Please fill in recipient and subject'); return; }
        setSendingEmail(true);
        try {
            const res = await fetch('/api/gmail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(composeData) });
            const data = await res.json();
            if (res.ok) { toast.success('Email sent!'); setIsComposeOpen(false); setComposeData({ to: '', subject: '', body: '' }); }
            else { toast.error(data.error || 'Failed to send'); }
        } catch { toast.error('Failed to send email'); }
        finally { setSendingEmail(false); }
    };

    // ─── Tab Colors ────────────────────────────────────────────────────────────
    const typeColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
        'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
        'SHOP': { bg: '#059669', color: '#ffffff', hoverBg: 'rgba(5,150,105,0.08)' },
        'DISTRO': { bg: '#0284c7', color: '#ffffff', hoverBg: 'rgba(2,132,199,0.08)' },
        'VAPE STORE': { bg: '#7c3aed', color: '#ffffff', hoverBg: 'rgba(124,58,237,0.08)' },
        'POTENTIAL': { bg: '#d97706', color: '#ffffff', hoverBg: 'rgba(217,119,6,0.08)' },
        'WHL': { bg: '#64748b', color: '#ffffff', hoverBg: 'rgba(100,116,139,0.08)' },
        'MASTER DISTRO': { bg: '#dc2626', color: '#ffffff', hoverBg: 'rgba(220,38,38,0.08)' },
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
            {/* ─── Page Header with Type Tabs, Search & Actions ──────────── */}
            <div className="shrink-0 border-b border-border bg-background">
                <div className="px-4 py-2.5 flex items-center gap-4">
                    {/* Title */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Users className="w-4 h-4 text-primary" />
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Clients</h1>
                    </div>

                    <div className="h-5 w-px bg-border shrink-0" />

                    {/* Type Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
                        {TYPE_TABS.map((tab) => {
                            const sc = typeColors[tab]; const isActive = activeType === tab;
                            return (
                                <button key={tab} onClick={() => handleTabChange(tab)}
                                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                                    style={isActive ? { backgroundColor: sc?.bg, color: sc?.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { color: 'inherit', backgroundColor: 'transparent' }}
                                    onMouseEnter={e => { if (!isActive && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                                >
                                    {tab}
                                    <span className="ml-1.5 text-[11px] tabular-nums" style={{ opacity: isActive ? 0.75 : 0.5 }}>
                                        {countsLoaded ? typeCounts[tab]?.toLocaleString() || 0 : <span className="inline-block w-4 h-3 rounded-sm bg-muted-foreground/10 animate-pulse align-middle" />}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex-1" />

                    {/* Search */}
                    <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input type="text" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-8 h-8 w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded" />
                        {search && (<button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"><X className="h-3 w-3" /></button>)}
                    </div>

                    {/* Add button */}
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                        <Plus className="w-3 h-3" />
                        <span className="hidden sm:inline text-[12px] font-black uppercase tracking-widest">Add</span>
                    </button>
                </div>
            </div>

            <ClientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => { globalCache.current = null; pageRef.current = 0; setClients([]); setHasMore(true); fetchPageRef.current(1, false); }}
                initialType="Client"
            />

            {/* Table */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
                <div className="min-w-fit px-2 py-1">
                    <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
                        <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
                            <tr>
                                {COLUMNS.map(col => (
                                    <th key={col.key}
                                        onClick={() => !col.nosort && handleSort(col.key)}
                                        className={cn(
                                            'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                                            col.width, col.align || 'text-left',
                                            !col.nosort && 'cursor-pointer hover:bg-secondary/60 dark:hover:bg-secondary/50 transition-colors'
                                        )}>
                                        <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                                            <span>{col.label}</span>
                                            {!col.nosort && <ArrowUpDown className={cn('w-2.5 h-2.5 transition-colors', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)
                            ) : error ? (
                                <tr><td colSpan={COLUMNS.length} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td></tr>
                            ) : clients.length === 0 ? (
                                <tr><td colSpan={COLUMNS.length} className="px-2 py-16 text-center">
                                    <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                                    <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                                        {debouncedSearch ? 'No matching clients' : activeType !== 'All' ? `No ${activeType} clients` : 'No clients found'}
                                    </p>
                                </td></tr>
                            ) : (
                                clients.map(client => (
                                    <ClientTableRow key={client._id} client={client} highlight={highlightId === client._id}
                                        onClick={() => {
                                            sessionStorage.setItem('cl_scroll_to', client._id);
                                            if (scrollRef.current) sessionStorage.setItem('cl_scroll_top', String(scrollRef.current.scrollTop));
                                            router.push(`/crm/clients/${client._id}`);
                                        }}
                                        onCall={(id, phone) => initiateGoogleVoice(id, phone, 'calls')}
                                        onSms={(id, phone) => initiateGoogleVoice(id, phone, 'messages')}
                                        onEmail={(email) => { setComposeData({ to: email, subject: '', body: '' }); setIsComposeOpen(true); }}
                                    />
                                ))
                            )}
                            {isLoadingMore && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={`m-${i}`} index={i} />)}
                        </tbody>
                    </table>
                    <div ref={sentinelRef} className="h-1" />
                    {!isLoading && !hasMore && clients.length > 0 && (
                        <div className="flex items-center justify-center py-4 gap-2">
                            <div className="h-px w-12 bg-border" />
                            <span className="text-[12px] text-muted-foreground/40 uppercase tracking-widest font-bold">{clients.length} clients loaded</span>
                            <div className="h-px w-12 bg-border" />
                        </div>
                    )}
                </div>
            </div>

            {/* Compose Email Modal */}
            {isComposeOpen && (
                <div className="fixed bottom-0 right-12 w-[540px] bg-card border border-border shadow-2xl z-[1001] animate-in slide-in-from-bottom-5 duration-300 rounded-t-lg overflow-hidden">
                    <div className="bg-[#1A1A1A] text-white px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">New message</span>
                        <button onClick={() => setIsComposeOpen(false)} className="hover:text-slate-300 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="p-0">
                        <div className="px-4 border-b border-border">
                            <input type="text" placeholder="Recipients" className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground"
                                value={composeData.to} onChange={(e) => setComposeData({ ...composeData, to: e.target.value })} />
                        </div>
                        <div className="px-4 border-b border-border">
                            <input type="text" placeholder="Subject" className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground"
                                value={composeData.subject} onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })} />
                        </div>
                        <div className="px-4">
                            <textarea placeholder="Message" rows={12} className="w-full text-sm py-4 bg-transparent focus:outline-none resize-none placeholder:text-muted font-medium text-foreground leading-relaxed"
                                value={composeData.body} onChange={(e) => setComposeData({ ...composeData, body: e.target.value })} />
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                            <div className="flex items-center space-x-1">
                                <button onClick={handleSendEmail} disabled={sendingEmail}
                                    className="flex items-center space-x-3 px-8 py-2.5 bg-[#F9E137] text-black text-[11px] font-black uppercase tracking-[0.15em] hover:bg-[#EBD000] transition-all mr-4 disabled:opacity-50 cursor-pointer">
                                    {sendingEmail ? (<><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin rounded-full" /><span>Sending...</span></>) : (<><span>Send</span><Send className="w-3.5 h-3.5" /></>)}
                                </button>
                                <button className="p-2 hover:bg-secondary/50 hover:text-foreground transition-all rounded-sm cursor-pointer text-slate-500" title="Attach files"><Paperclip className="w-4 h-4" /></button>
                            </div>
                            <button onClick={() => { setIsComposeOpen(false); setComposeData({ to: '', subject: '', body: '' }); }}
                                className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 transition-all rounded-sm cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
