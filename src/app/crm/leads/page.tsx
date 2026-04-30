'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowUpDown, Search, Plus, X, Loader2, Briefcase, Mail, Phone, MessageSquare,
    List, LayoutGrid, GripVertical, User, Layers, CheckCircle2, Calendar, Send, Trash2, Paperclip, ChevronDown, UserCircle, Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
import ClientModal from '@/components/crm/ClientModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Lead {
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
}

interface Rep {
    _id: string;
    firstName: string;
    lastName: string;
}

const PIPELINE_STAGES = [
    { id: 'Initial Contact', label: 'Initial Contact', color: 'text-white', bgColor: 'bg-slate-600 border-slate-700', icon: <User className="w-4 h-4" /> },
    { id: 'Sampling', label: 'Sampling', color: 'text-white', bgColor: 'bg-purple-600 border-purple-700', icon: <Layers className="w-4 h-4" /> },
    { id: 'New Prospect', label: 'New Prospect', color: 'text-white', bgColor: 'bg-blue-600 border-blue-700', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'Closed won', label: 'Closed Won', color: 'text-white', bgColor: 'bg-emerald-600 border-emerald-700', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'Closed lost', label: 'Closed Lost', color: 'text-white', bgColor: 'bg-red-600 border-red-700', icon: <X className="w-4 h-4" /> },
    { id: 'Uncategorized', label: 'Uncategorized', color: 'text-white', bgColor: 'bg-slate-800 border-slate-900', icon: <Calendar className="w-4 h-4" /> },
];

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
    leads: Lead[];
    hasMore: boolean;
    page: number;
    sortBy: string;
    sortOrder: string;
    search: string;
    status: string;
    repFilter: string;
    timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Columns ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Table Row ───────────────────────────────────────────────────────────────

const LeadTableRow = React.memo(function LeadTableRow({
    lead, onClick, highlight, onCall, onSms, onEmail
}: {
    lead: Lead; onClick: () => void; highlight?: boolean;
    onCall: (id: string, phone: string) => void;
    onSms: (id: string, phone: string) => void;
    onEmail: (email: string) => void;
}) {
    return (
        <tr data-lead-id={lead._id}
            className={cn(
                'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
                highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
            )} onClick={onClick}>
            {/* Name */}
            <td className="px-2.5 py-2.5 w-[280px] text-[12px] font-semibold text-foreground group-hover:text-foreground transition-colors">
                <div className="flex items-center gap-2">
                    <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all truncate max-w-[240px]">{lead.name}</span>
                </div>
            </td>
            {/* Email */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {lead.emails?.[0]?.value ? (
                    <button onClick={(e) => { e.stopPropagation(); onEmail(lead.emails[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-blue-600 hover:text-white hover:border-blue-600 rounded transition-colors cursor-pointer" title={lead.emails[0].value}>
                        <Mail className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>
            {/* Call */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {lead.phones?.[0]?.value ? (
                    <button onClick={(e) => { e.stopPropagation(); onCall(lead._id, lead.phones[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 rounded transition-colors cursor-pointer" title={lead.phones[0].value}>
                        <Phone className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>
            {/* SMS */}
            <td className="px-2.5 py-2.5 w-[40px]">
                {lead.phones?.[0]?.value ? (
                    <button onClick={(e) => { e.stopPropagation(); onSms(lead._id, lead.phones[0].value); }}
                        className="p-1.5 bg-muted/20 border border-border/50 text-foreground/80 hover:bg-purple-600 hover:text-white hover:border-purple-600 rounded transition-colors cursor-pointer" title="Send SMS">
                        <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
            </td>
            {/* Address */}
            <td className="px-2.5 py-2.5 w-[130px] text-[12px] text-foreground truncate">
                {lead.addresses?.[0] ? `${lead.addresses[0].city}, ${lead.addresses[0].state}` : '—'}
            </td>
            {/* Rep */}
            <td className="px-2.5 py-2.5 w-[100px] text-[12px] font-medium text-foreground truncate">
                {lead.salesPerson ? `${lead.salesPerson.firstName} ${lead.salesPerson.lastName}` : <span className="text-muted-foreground/60 italic">—</span>}
            </td>
            {/* Type */}
            <td className="px-2.5 py-2.5 w-[80px]"><TypeBadge type={lead.companyType || 'POTENTIAL'} /></td>
            {/* Stage */}
            <td className="px-2.5 py-2.5 w-[90px]"><StatusBadge status={lead.contactStatus || ''} /></td>
            {/* Lead Aging */}
            <td className="px-2.5 py-2.5 w-[210px]"><LeadAgingCounter lastActivity={lead.lastActivity} /></td>
            {/* Activities */}
            <td className="px-2.5 py-2.5 w-[90px]">
                <div className="flex items-center justify-center space-x-0.5">
                    <span className={cn("inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                        (lead.emailCount || 0) > 0 ? "bg-blue-600 border border-blue-600 text-white shadow-sm" : "bg-muted/20 border border-border/50 text-foreground/80"
                    )}>{lead.emailCount || 0}</span>
                    <span className={cn("inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                        (lead.callCount || 0) > 0 ? "bg-emerald-600 border border-emerald-600 text-white shadow-sm" : "bg-muted/20 border border-border/50 text-foreground/80"
                    )}>{lead.callCount || 0}</span>
                    <span className={cn("inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                        (lead.smsCount || 0) > 0 ? "bg-purple-600 border border-purple-600 text-white shadow-sm" : "bg-muted/20 border border-border/50 text-foreground/80"
                    )}>{lead.smsCount || 0}</span>
                </div>
            </td>
        </tr>
    );
});

// ─── Pipeline Grid View ──────────────────────────────────────────────────────

function PipelineGridView({
    pipelineData, onLeadClick, onLeadDrop, draggedLead, setDraggedLead, dragOverStage, setDragOverStage, onStageScroll, onInitiateVoice
}: {
    pipelineData: Record<string, { leads: Lead[]; loading: boolean; total: number }>;
    onLeadClick: (lead: Lead) => void;
    onLeadDrop: (e: React.DragEvent, status: string) => void;
    draggedLead: Lead | null;
    setDraggedLead: (lead: Lead | null) => void;
    dragOverStage: string | null;
    setDragOverStage: (stage: string | null) => void;
    onStageScroll?: (stageId: string, e: React.UIEvent<HTMLDivElement>) => void;
    onInitiateVoice: (id: string, phone: string, type: 'calls' | 'messages') => void;
}) {
    return (
        <div className="h-full bg-secondary overflow-x-auto scrollbar-custom dark:bg-background">
            <div className="flex space-x-4 h-full min-w-max p-4">
                {PIPELINE_STAGES.map((stage) => {
                    const data = pipelineData[stage.id] || { leads: [], loading: false, total: 0 };
                    return (
                        <div key={stage.id}
                            className={cn("flex flex-col w-[300px] bg-background border border-border rounded-lg h-full transition-all", dragOverStage === stage.id && "ring-2 ring-primary ring-offset-2")}
                            onDragOver={(e) => { e.preventDefault(); setDragOverStage(stage.id); }}
                            onDragLeave={() => setDragOverStage(null)} onDrop={(e) => onLeadDrop(e, stage.id)}>
                            <div className={cn("px-4 py-3 border-b flex items-center justify-between shrink-0 rounded-t-lg", stage.bgColor)}>
                                <div className="flex items-center space-x-2">
                                    <span className={stage.color}>{stage.icon}</span>
                                    <span className={cn("text-[10px] font-black uppercase tracking-wider", stage.color)}>{stage.label}</span>
                                </div>
                                <span className={cn("text-xs font-black", stage.color)}>{data.total}</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 scrollbar-custom" onScroll={(e) => onStageScroll?.(stage.id, e)}>
                                {data.leads.length === 0 && !data.loading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                        <p className="text-[10px] font-bold uppercase italic">No leads here</p>
                                    </div>
                                ) : data.leads.map((lead) => (
                                    <div key={lead._id} draggable
                                        onDragStart={(e) => { setDraggedLead(lead); e.dataTransfer.effectAllowed = 'move'; }}
                                        onClick={() => onLeadClick(lead)}
                                        className={cn("bg-background border border-border p-3 flex flex-col space-y-2.5 cursor-grab active:cursor-grabbing hover:shadow-lg hover:border-primary/30 transition-all rounded-lg group/card",
                                            draggedLead?._id === lead._id && "opacity-50 scale-95")}>
                                        <div className="flex items-start justify-between">
                                            <div className="text-[14px] font-black text-foreground line-clamp-1 group-hover/card:text-primary transition-colors">{lead.name}</div>
                                            <GripVertical className="w-4 h-4 text-muted-foreground/50 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <TypeBadge type={lead.companyType || 'POTENTIAL'} />
                                        </div>
                                        {lead.salesPerson && (
                                            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded border border-border/50 bg-secondary w-fit">
                                                <div className="flex items-center justify-center"><User className="w-3 h-3 text-muted-foreground" /></div>
                                                <span className="text-[10.5px] font-bold text-foreground/80">{lead.salesPerson.firstName} {lead.salesPerson.lastName}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center space-x-2">
                                            <button onClick={(e) => { e.stopPropagation(); onInitiateVoice(lead._id, lead.phones?.[0]?.value || '', 'calls'); }}
                                                className={cn("flex items-center space-x-1 px-2.5 py-1.5 rounded border transition-colors cursor-pointer",
                                                    lead.callCount ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" : "bg-muted/20 border-border/50 text-foreground/80 hover:bg-muted/40")}>
                                                <Phone className="w-3.5 h-3.5" /><span className="text-[9.5px] font-black">{lead.callCount || 0}</span>
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); onInitiateVoice(lead._id, lead.phones?.[0]?.value || '', 'messages'); }}
                                                className={cn("flex items-center space-x-1 px-2.5 py-1.5 rounded border transition-colors cursor-pointer",
                                                    lead.smsCount ? "bg-purple-600 border-purple-600 text-white shadow-sm" : "bg-muted/20 border-border/50 text-foreground/80 hover:bg-muted/40")}>
                                                <MessageSquare className="w-3.5 h-3.5" /><span className="text-[9.5px] font-black">{lead.smsCount || 0}</span>
                                            </button>
                                            <a href={lead.emails?.[0]?.value ? `mailto:${lead.emails[0].value}` : '#'} onClick={(e) => e.stopPropagation()}
                                                className={cn("flex items-center space-x-1 px-2.5 py-1.5 rounded border transition-colors cursor-pointer",
                                                    lead.emailCount ? "bg-blue-600 border-blue-600 text-white shadow-sm" : "bg-muted/20 border-border/50 text-foreground/80 hover:bg-muted/40")}>
                                                <Mail className="w-3.5 h-3.5" /><span className="text-[9.5px] font-black">{lead.emailCount || 0}</span>
                                            </a>
                                        </div>
                                        <div className="pt-2 border-t border-border/50">
                                            <LeadAgingCounter lastActivity={lead.lastActivity} />
                                        </div>
                                    </div>
                                ))}
                                {data.loading && <div className="flex items-center justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function LeadsPage() {
    return (
        <Suspense fallback={<ShellSkeleton />}>
            <LeadsContent />
        </Suspense>
    );
}

function ShellSkeleton() {
    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3">
                <div className="h-4 w-4 rounded bg-secondary animate-pulse" />
                <div className="h-4 w-16 bg-secondary animate-pulse rounded" />
                <div className="h-5 w-px bg-border" />
                {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-6 w-20 bg-secondary animate-pulse rounded-lg" style={{ animationDelay: `${i * 50}ms` }} />)}
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

function LeadsContent() {
    const router = useRouter();
    const sp = useSearchParams();

    const [leads, setLeads] = useState<Lead[]>(globalCache.current?.leads || []);
    const [isLoading, setIsLoading] = useState(!globalCache.current);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState(sp.get('search') || '');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState('totalRevenue');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [activeStatus, setActiveStatus] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table');
    const [minRevenueSlab, setMinRevenueSlab] = useState('20');
    const [repFilter, setRepFilter] = useState<string>('');  // '' = All reps
    const [repList, setRepList] = useState<Rep[]>([]);
    const [repDropdownOpen, setRepDropdownOpen] = useState(false);
    const repDropdownRef = useRef<HTMLDivElement | null>(null);

    const pageRef = useRef(globalCache.current?.page || 0);
    const mountedRef = useRef(true);
    const fetchingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    // Pipeline state
    const [pipelineData, setPipelineData] = useState<Record<string, { leads: Lead[]; loading: boolean; total: number }>>(() => {
        const init: any = {};
        PIPELINE_STAGES.forEach(s => { init[s.id] = { leads: [], loading: false, total: 0 }; });
        return init;
    });
    const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
    const [dragOverStage, setDragOverStage] = useState<string | null>(null);

    // Compose & modal
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
    useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

    // Fetch reps for filter
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/users?limit=200&sortBy=firstName&sortOrder=asc');
                if (res.ok) { const d = await res.json(); setRepList(d.users || []); }
            } catch { }
        })();
    }, []);

    // Close rep dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (repDropdownRef.current && !repDropdownRef.current.contains(e.target as Node)) setRepDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Fetch settings
    useEffect(() => {
        (async () => { try { const r = await fetch('/api/settings'); if (r.ok) { const d = await r.json(); if (d.crmMinRevenueSlab) setMinRevenueSlab(d.crmMinRevenueSlab); } } catch { } })();
    }, []);

    // Scroll-back
    const [highlightId, setHighlightId] = useState<string | null>(null);
    useEffect(() => {
        const id = sessionStorage.getItem('ld_scroll_to');
        const sc = sessionStorage.getItem('ld_scroll_top');
        if (id) {
            sessionStorage.removeItem('ld_scroll_to'); sessionStorage.removeItem('ld_scroll_top');
            setHighlightId(id);
            if (sc && scrollRef.current) scrollRef.current.scrollTop = parseInt(sc, 10);
            const tryScroll = (a = 0) => {
                const row = document.querySelector(`[data-lead-id="${id}"]`);
                if (row) { setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); setTimeout(() => setHighlightId(null), 3000); }
                else if (a < 30) setTimeout(() => tryScroll(a + 1), 200);
            };
            setTimeout(() => tryScroll(), 100);
        }
    }, []);

    // Stage tabs with colors
    const STAGE_TABS = ['All', 'Initial Contact', 'Sampling', 'New Prospect', 'Closed won', 'Closed lost', 'Uncategorized'] as const;
    const stageColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
        'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
        'Initial Contact': { bg: '#64748b', color: '#ffffff', hoverBg: 'rgba(100,116,139,0.08)' },
        'Sampling': { bg: '#7c3aed', color: '#ffffff', hoverBg: 'rgba(124,58,237,0.08)' },
        'New Prospect': { bg: '#2563eb', color: '#ffffff', hoverBg: 'rgba(37,99,235,0.08)' },
        'Closed won': { bg: '#059669', color: '#ffffff', hoverBg: 'rgba(5,150,105,0.08)' },
        'Closed lost': { bg: '#dc2626', color: '#ffffff', hoverBg: 'rgba(220,38,38,0.08)' },
        'Uncategorized': { bg: '#94a3b8', color: '#ffffff', hoverBg: 'rgba(148,163,184,0.08)' },
    };

    // ─── Fetch (Table) ─────────────────────────────────────────────────────────
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
                maxRevenue: minRevenueSlab, contactType_nin: 'Client',
            });
            if (repFilter) params.set('salesPerson', repFilter);
            if (activeStatus !== 'All') {
                if (activeStatus === 'Uncategorized') {
                    const others = PIPELINE_STAGES.filter(s => s.id !== 'Uncategorized').map(s => s.id).join(',');
                    params.set('contactStatus_nin', others);
                } else {
                    params.set('contactStatus', activeStatus);
                }
            }
            const res = await fetch(`/api/clients?${params}`, { signal: ctrl.signal });
            const data = await res.json();
            if (seq !== seqRef.current || !mountedRef.current) return;
            if (res.ok) {
                const newLeads = data.clients || []; const total = data.total || 0;
                const newHasMore = (pageNum * PAGE_SIZE) < total;
                if (isAppend) {
                    setLeads(prev => {
                        const ids = new Set(prev.map(l => l._id));
                        const merged = [...prev, ...newLeads.filter((l: Lead) => !ids.has(l._id))];
                        globalCache.current = { leads: merged, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, repFilter, timestamp: Date.now() };
                        return merged;
                    });
                } else {
                    setLeads(newLeads);
                    globalCache.current = { leads: newLeads, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, repFilter, timestamp: Date.now() };
                }
                setHasMore(newHasMore); pageRef.current = pageNum; setError(null);
            } else { setError(data.error || 'Failed to fetch'); }
        } catch (e: any) { if (e?.name === 'AbortError') return; if (mountedRef.current) setError(e.message); }
        finally { fetchingRef.current = false; if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); } }
    }, [sortBy, sortOrder, debouncedSearch, activeStatus, minRevenueSlab, repFilter]);

    const fetchPageRef = useRef(fetchPage); fetchPageRef.current = fetchPage;
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (viewMode !== 'table') return;
        if (isFirstMount.current) {
            isFirstMount.current = false;
            const c = globalCache.current;
            if (c && c.leads.length > 0 && (Date.now() - c.timestamp) < CACHE_TTL && c.sortBy === sortBy && c.sortOrder === sortOrder && c.search === debouncedSearch && c.status === activeStatus && c.repFilter === repFilter) {
                setLeads(c.leads); setHasMore(c.hasMore); pageRef.current = c.page; setIsLoading(false); return;
            }
        }
        globalCache.current = null; pageRef.current = 0; setLeads([]); setHasMore(true);
        fetchPageRef.current(1, false);
    }, [sortBy, sortOrder, debouncedSearch, activeStatus, viewMode, repFilter]);

    // ─── Fetch Pipeline ────────────────────────────────────────────────────────
    const fetchPipelineStage = useCallback(async (stageId: string, pageToFetch: number, isAppending = false) => {
        setPipelineData(prev => ({ ...prev, [stageId]: { ...prev[stageId], loading: true } }));
        try {
            const params = new URLSearchParams({
                page: String(pageToFetch), limit: '10', search: debouncedSearch, sortBy, sortOrder,
                maxRevenue: minRevenueSlab, contactType_nin: 'Client',
            });
            if (repFilter) params.set('salesPerson', repFilter);
            if (stageId === 'Uncategorized') {
                params.set('contactStatus_nin', PIPELINE_STAGES.filter(s => s.id !== 'Uncategorized').map(s => s.id).join(','));
            } else { params.set('contactStatus', stageId); }
            const res = await fetch(`/api/clients?${params}`);
            const data = await res.json();
            if (data.clients) {
                setPipelineData(prev => {
                    const combined = isAppending ? [...prev[stageId].leads, ...data.clients] : data.clients;
                    const map = new Map<string, Lead>(); combined.forEach((l: Lead) => map.set(l._id, l));
                    return { ...prev, [stageId]: { leads: Array.from(map.values()), total: data.total, loading: false } };
                });
            }
        } catch { setPipelineData(prev => ({ ...prev, [stageId]: { ...prev[stageId], loading: false } })); }
    }, [debouncedSearch, sortBy, sortOrder, minRevenueSlab, repFilter]);

    useEffect(() => {
        if (viewMode === 'pipeline') PIPELINE_STAGES.forEach(s => fetchPipelineStage(s.id, 1, false));
    }, [viewMode, debouncedSearch, sortBy, sortOrder, fetchPipelineStage]);

    // Infinite scroll
    useEffect(() => {
        if (viewMode !== 'table') return;
        const sentinel = sentinelRef.current; const container = scrollRef.current;
        if (!sentinel || !container) return;
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPage(pageRef.current + 1, true);
        }, { root: container, rootMargin: '600px' });
        obs.observe(sentinel); return () => obs.disconnect();
    }, [hasMore, isLoading, fetchPage, viewMode]);

    const handleSort = (col: string) => {
        if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortOrder('desc'); }
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleTabChange = (tab: string) => { setActiveStatus(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); };
    const handleRepChange = (id: string) => { setRepFilter(id); setRepDropdownOpen(false); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); };

    // ─── Google Voice ──────────────────────────────────────────────────────────
    const initiateGoogleVoice = (leadId: string, phoneNumber: string, type: 'calls' | 'messages') => {
        if (!phoneNumber) { toast.error('No phone number'); return; }
        const d = phoneNumber.replace(/\D/g, '');
        let e164; if (phoneNumber.includes('+')) e164 = d; else if (d.startsWith('1') && d.length === 11) e164 = d; else if (d.length === 10) e164 = '1' + d; else e164 = d;
        const w = 450, h = 650, l = (window.screen.width / 2) - (w / 2), t = (window.screen.height / 2) - (h / 2);
        window.open(type === 'calls' ? `https://voice.google.com/u/0/calls?a=nc,%2B${e164}` : `https://voice.google.com/u/0/messages?number=%2B${e164}`, 'GoogleVoiceWindow', `width=${w},height=${h},left=${l},top=${t},menubar=no,status=no,toolbar=no`);
        setTimeout(async () => {
            const at = type === 'calls' ? 'Call' : 'Text';
            if (confirm(`Log this ${at} to CRM?\n\nOK to log, Cancel to skip.`)) {
                const notes = prompt(`Notes for this ${at}? (optional):`) || '';
                try { const r = await fetch('/api/crm/log-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: leadId, phoneNumber, type: at, notes }) }); if (r.ok) toast.success(`${at} logged!`); } catch { toast.error('Failed to log'); }
            }
        }, 3000);
    };

    const handleLeadDrop = async (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault(); setDragOverStage(null);
        if (!draggedLead || (draggedLead.contactStatus || 'Uncategorized') === targetStatus) { setDraggedLead(null); return; }
        const prev = draggedLead.contactStatus || 'Uncategorized';
        const updated = { ...draggedLead, contactStatus: targetStatus };
        setLeads(p => p.map(l => l._id === draggedLead._id ? updated : l));
        setPipelineData(p => ({ ...p, [prev]: { ...p[prev], leads: p[prev].leads.filter(l => l._id !== draggedLead._id), total: Math.max(0, p[prev].total - 1) }, [targetStatus]: { ...p[targetStatus], leads: [updated, ...p[targetStatus].leads], total: p[targetStatus].total + 1 } }));
        try { const r = await fetch(`/api/clients/${draggedLead._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactStatus: targetStatus }) }); if (!r.ok) throw new Error(); toast.success(`Lead moved to ${targetStatus}`); } catch { fetchPipelineStage(prev, 1, false); fetchPipelineStage(targetStatus, 1, false); toast.error('Failed to update'); }
        setDraggedLead(null);
    };

    const handleSendEmail = async () => {
        if (!composeData.to || !composeData.subject) { toast.error('Fill in recipient and subject'); return; }
        setSendingEmail(true);
        try { const r = await fetch('/api/gmail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(composeData) }); const d = await r.json(); if (r.ok) { toast.success('Email sent!'); setIsComposeOpen(false); setComposeData({ to: '', subject: '', body: '' }); } else toast.error(d.error || 'Failed'); } catch { toast.error('Failed'); }
        finally { setSendingEmail(false); }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-background">
                <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 sm:gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <Briefcase className="w-4 h-4 text-primary" />
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Leads</h1>
                    </div>
                    <div className="h-5 w-px bg-border shrink-0" />

                    {/* Stage Tabs */}
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin flex-1 min-w-0 sm:flex-none">
                        {STAGE_TABS.map((tab) => {
                            const sc = stageColors[tab]; const isActive = activeStatus === tab;
                            return (
                                <button key={tab} onClick={() => handleTabChange(tab)}
                                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                                    style={isActive ? { backgroundColor: sc?.bg, color: sc?.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { color: 'inherit', backgroundColor: 'transparent' }}
                                    onMouseEnter={e => { if (!isActive && sc) (e.currentTarget).style.backgroundColor = sc.hoverBg; }}
                                    onMouseLeave={e => { if (!isActive) (e.currentTarget).style.backgroundColor = 'transparent'; }}>
                                    {tab}
                                </button>
                            );
                        })}
                    </div>

                    <div className="hidden sm:block flex-1" />

                    {/* View Toggle */}
                    <div className="hidden sm:flex items-center bg-secondary p-0.5 rounded border border-border h-8 shrink-0">
                        <button onClick={() => setViewMode('table')} className={cn("flex items-center space-x-1 px-2.5 h-full rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer", viewMode === 'table' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                            <List className="w-3 h-3" /><span>Table</span>
                        </button>
                        <button onClick={() => setViewMode('pipeline')} className={cn("flex items-center space-x-1 px-2.5 h-full rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer", viewMode === 'pipeline' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                            <LayoutGrid className="w-3 h-3" /><span>Pipeline</span>
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative shrink-0 w-full sm:w-auto order-last sm:order-none">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input type="text" placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-8 h-8 w-full sm:w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"><X className="h-3 w-3" /></button>}
                    </div>

                    {/* Rep Filter Dropdown */}
                    <div ref={repDropdownRef} className="relative shrink-0 hidden sm:block">
                        <button
                            onClick={() => setRepDropdownOpen(!repDropdownOpen)}
                            className={cn(
                                'flex items-center gap-1.5 h-8 px-2.5 border text-[12px] font-semibold rounded transition-all cursor-pointer whitespace-nowrap',
                                repFilter
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/20'
                            )}
                        >
                            <UserCircle className="w-3.5 h-3.5" />
                            <span className="max-w-[100px] truncate">
                                {repFilter ? repList.find(r => r._id === repFilter)?.firstName + ' ' + repList.find(r => r._id === repFilter)?.lastName : 'All Reps'}
                            </span>
                            <ChevronDown className={cn('w-3 h-3 transition-transform', repDropdownOpen && 'rotate-180')} />
                        </button>
                        {repDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-xl z-50 py-1 max-h-72 overflow-y-auto scrollbar-custom animate-in fade-in slide-in-from-top-1 duration-150">
                                <button
                                    onClick={() => handleRepChange('')}
                                    className={cn('w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-2',
                                        !repFilter && 'text-primary font-bold bg-primary/5')}
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    All Reps
                                </button>
                                <div className="h-px bg-border my-1" />
                                {repList.map(rep => (
                                    <button
                                        key={rep._id}
                                        onClick={() => handleRepChange(rep._id)}
                                        className={cn('w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-muted/50 transition-colors cursor-pointer flex items-center gap-2',
                                            repFilter === rep._id && 'text-primary font-bold bg-primary/5')}
                                    >
                                        <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-[9px] font-black text-foreground shrink-0">
                                            {rep.firstName?.[0]}{rep.lastName?.[0]}
                                        </div>
                                        {rep.firstName} {rep.lastName}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add */}
                    <button onClick={() => setIsModalOpen(true)} className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0">
                        <Plus className="w-3 h-3" /><span className="hidden sm:inline text-[12px] font-black uppercase tracking-widest">Add</span>
                    </button>
                </div>
            </div>

            <ClientModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={() => {
                if (viewMode === 'table') { globalCache.current = null; pageRef.current = 0; setLeads([]); setHasMore(true); fetchPageRef.current(1, false); }
                else PIPELINE_STAGES.forEach(s => fetchPipelineStage(s.id, 1, false));
            }} initialType="Lead" />

            {/* Content */}
            {viewMode === 'table' ? (
                <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
                    <div className="min-w-fit px-2 py-1">
                        <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
                            <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
                                <tr>{COLUMNS.map(col => (
                                    <th key={col.key} onClick={() => !col.nosort && handleSort(col.key)}
                                        className={cn('px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                                            col.width, col.align || 'text-left', !col.nosort && 'cursor-pointer hover:bg-secondary dark:hover:bg-secondary transition-colors')}>
                                        <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                                            <span>{col.label}</span>
                                            {!col.nosort && <ArrowUpDown className={cn('w-2.5 h-2.5 transition-colors', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                                        </div>
                                    </th>
                                ))}</tr>
                            </thead>
                            <tbody>
                                {isLoading ? Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />) : error ? (
                                    <tr><td colSpan={COLUMNS.length} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td></tr>
                                ) : leads.length === 0 ? (
                                    <tr><td colSpan={COLUMNS.length} className="px-2 py-16 text-center">
                                        <Briefcase className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                                        <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">{debouncedSearch ? 'No matching leads' : activeStatus !== 'All' ? `No ${activeStatus} leads` : 'No leads found'}</p>
                                    </td></tr>
                                ) : leads.map(lead => (
                                    <LeadTableRow key={lead._id} lead={lead} highlight={highlightId === lead._id}
                                        onClick={() => { sessionStorage.setItem('ld_scroll_to', lead._id); if (scrollRef.current) sessionStorage.setItem('ld_scroll_top', String(scrollRef.current.scrollTop)); router.push(`/crm/leads/${lead._id}`); }}
                                        onCall={(id, ph) => initiateGoogleVoice(id, ph, 'calls')}
                                        onSms={(id, ph) => initiateGoogleVoice(id, ph, 'messages')}
                                        onEmail={(em) => { setComposeData({ to: em, subject: '', body: '' }); setIsComposeOpen(true); }}
                                    />
                                ))}
                                {isLoadingMore && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={`m-${i}`} index={i} />)}
                            </tbody>
                        </table>
                        <div ref={sentinelRef} className="h-1" />
                        {!isLoading && !hasMore && leads.length > 0 && (
                            <div className="flex items-center justify-center py-4 gap-2">
                                <div className="h-px w-12 bg-border" /><span className="text-[12px] text-muted-foreground/40 uppercase tracking-widest font-bold">{leads.length} leads loaded</span><div className="h-px w-12 bg-border" />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <PipelineGridView
                    pipelineData={pipelineData} onLeadClick={(lead) => router.push(`/crm/leads/${lead._id}`)}
                    onLeadDrop={handleLeadDrop} draggedLead={draggedLead} setDraggedLead={setDraggedLead}
                    dragOverStage={dragOverStage} setDragOverStage={setDragOverStage}
                    onStageScroll={(stageId, e) => {
                        const stage = pipelineData[stageId]; if (!stage || stage.loading || stage.leads.length >= stage.total) return;
                        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                        if (scrollHeight - scrollTop <= clientHeight + 100) fetchPipelineStage(stageId, Math.ceil(stage.leads.length / 10) + 1, true);
                    }}
                    onInitiateVoice={initiateGoogleVoice}
                />
            )}

            {/* Compose Email Modal */}
            {isComposeOpen && (
                <div className="fixed bottom-0 right-0 sm:right-12 w-full sm:w-[540px] bg-card border border-border shadow-2xl z-[1001] animate-in slide-in-from-bottom-5 duration-300 rounded-t-lg overflow-hidden">
                    <div className="bg-[#1A1A1A] text-white px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">New message</span>
                        <button onClick={() => setIsComposeOpen(false)} className="hover:text-slate-300 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="p-0">
                        <div className="px-4 border-b border-border"><input type="text" placeholder="Recipients" className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground" value={composeData.to} onChange={(e) => setComposeData({ ...composeData, to: e.target.value })} /></div>
                        <div className="px-4 border-b border-border"><input type="text" placeholder="Subject" className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground" value={composeData.subject} onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })} /></div>
                        <div className="px-4"><textarea placeholder="Message" rows={12} className="w-full text-sm py-4 bg-transparent focus:outline-none resize-none placeholder:text-muted font-medium text-foreground leading-relaxed" value={composeData.body} onChange={(e) => setComposeData({ ...composeData, body: e.target.value })} /></div>
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                            <div className="flex items-center space-x-1">
                                <button onClick={handleSendEmail} disabled={sendingEmail} className="flex items-center space-x-3 px-8 py-2.5 bg-[#F9E137] text-black text-[11px] font-black uppercase tracking-[0.15em] hover:bg-[#EBD000] transition-all mr-4 disabled:opacity-50 cursor-pointer">
                                    {sendingEmail ? <><div className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin rounded-full" /><span>Sending...</span></> : <><span>Send</span><Send className="w-3.5 h-3.5" /></>}
                                </button>
                                <button className="p-2 hover:bg-secondary hover:text-foreground transition-all rounded-sm cursor-pointer text-slate-500" title="Attach"><Paperclip className="w-4 h-4" /></button>
                            </div>
                            <button onClick={() => { setIsComposeOpen(false); setComposeData({ to: '', subject: '', body: '' }); }} className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 transition-all rounded-sm cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
