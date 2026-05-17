'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { ArrowUpDown, X, Search, Loader2, Plus, ClipboardCheck, Pencil, Trash2, Hash, ChevronDown, Check, Package, Calendar } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditAdjustment {
    _id: string;
    sku: { _id: string; name: string; uom: string; image?: string; tier?: number } | string;
    lotNumber: string;
    qty: number;
    cost: number;
    reason: string;
    createdBy: { firstName: string; lastName: string } | string;
    createdAt: string;
}

interface CacheEntry {
    adjustments: AuditAdjustment[];
    hasMore: boolean;
    page: number;
    total: number;
    sortBy: string;
    sortOrder: string;
    search: string;
    lotNumbers: string[];
    datePreset: string;
    fromDate: string;
    toDate: string;
    timestamp: number;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Table Columns ────────────────────────────────────────────────────────────

const COLUMNS = [
    { key: 'createdAt', label: 'Date', sortable: true, width: 'w-[100px]' },
    { key: 'sku', label: 'SKU', sortable: true, width: 'w-[220px]' },
    { key: 'lotNumber', label: 'Lot #', sortable: true, width: 'w-[100px]' },
    { key: 'qty', label: 'Qty', sortable: true, width: 'w-[60px]', align: 'text-right' as const },
    { key: 'cost', label: 'Cost', sortable: true, width: 'w-[80px]', align: 'text-right' as const },
    { key: 'reason', label: 'Reason', sortable: true, width: 'w-[320px]' },
    { key: 'createdBy', label: 'Created By', sortable: false, width: 'w-[140px]' },
    { key: 'actions', label: '', sortable: false, width: 'w-[80px]', align: 'text-right' as const },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: number }) {
    return (
        <span className={cn(
            'flex-shrink-0 w-4 h-4 !rounded-full flex items-center justify-center text-[10px] font-black text-white',
            tier === 1 ? 'bg-emerald-600' : tier === 2 ? 'bg-blue-600' : 'bg-orange-500'
        )} title={`Tier ${tier}`}>{tier}</span>
    );
}

function QtyBadge({ qty }: { qty: number }) {
    const isPositive = qty > 0;
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-black font-mono"
            style={isPositive
                ? { backgroundColor: '#166534', color: '#bbf7d0', border: '1px solid #15803d' }
                : { backgroundColor: '#7f1d1d', color: '#fecaca', border: '1px solid #991b1b' }}
        >
            {isPositive ? '+' : ''}{qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
        </span>
    );
}

function SkeletonRow({ index }: { index: number }) {
    return (
        <tr className="border-b border-border/30">
            {COLUMNS.map((col) => (
                <td key={col.key} className={cn('px-2 py-2.5', col.width)}>
                    <div
                        className={cn(
                            'h-3.5 rounded-sm bg-secondary animate-pulse',
                            col.key === 'sku' ? 'w-4/5' :
                                col.key === 'reason' ? 'w-3/4' :
                                    col.key === 'createdBy' ? 'w-16' : 'w-10'
                        )}
                        style={{ animationDelay: `${index * 30}ms` }}
                    />
                </td>
            ))}
        </tr>
    );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

const TableRow = React.memo(function TableRow({
    item, highlight, onEdit, onDelete, onPickLot
}: {
    item: AuditAdjustment; highlight?: boolean;
    onEdit: (e: React.MouseEvent) => void; onDelete: (e: React.MouseEvent) => void;
    onPickLot: (e: React.MouseEvent) => void;
}) {
    const skuData = typeof item.sku === 'object' && item.sku?.name
        ? item.sku
        : { _id: '', name: typeof item.sku === 'string' ? item.sku : '-', uom: '', image: '', tier: undefined };
    const skuTier = typeof item.sku === 'object' && item.sku !== null ? (item.sku as any).tier : undefined;
    const skuId = typeof item.sku === 'object' && item.sku !== null ? (item.sku as any)._id : '';
    const userName = typeof item.createdBy === 'object' && item.createdBy?.firstName
        ? `${item.createdBy.firstName} ${item.createdBy.lastName}`
        : typeof item.createdBy === 'string' ? item.createdBy : '-';

    const { canDelete } = usePermissions();

    return (
        <tr
            data-aa-id={item._id}
            className={cn(
                'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 border-b border-border/60',
                highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
            )}
        >
            {/* Date */}
            <td className="px-2.5 py-2.5 text-[12px] font-mono text-foreground/70 cursor-pointer">
                {formatDate(item.createdAt)}
            </td>

            {/* SKU Name + Tier (Clickable → SKU Detail Page) */}
            <td className="px-2.5 py-2.5 text-[12px] font-semibold text-foreground cursor-pointer">
                <div className="flex items-center gap-1.5">
                    {skuTier ? <TierBadge tier={skuTier} /> : null}
                    {skuId ? (
                        <a
                            href={`/warehouse/skus/${skuId}`}
                            className="truncate whitespace-nowrap text-primary hover:text-primary/80 hover:underline transition-colors cursor-pointer"
                            title={skuData.name}
                        >{skuData.name}</a>
                    ) : (
                        <span className="truncate whitespace-nowrap" title={skuData.name}>{skuData.name}</span>
                    )}
                </div>
            </td>

            {/* Lot Number */}
            <td className="px-2.5 py-2.5 text-[12px] font-mono text-foreground/80 tracking-tight cursor-pointer">
                <div className="flex items-center gap-1.5">
                    <span className="truncate">{item.lotNumber || <span className="text-muted-foreground/30">—</span>}</span>
                    {skuId && (
                        <button
                            onClick={onPickLot}
                            className="p-1 rounded-md hover:bg-primary/10 text-muted-foreground/40 hover:text-primary transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                            title="Pick Lot Number"
                        >
                            <Package className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </td>

            {/* Qty */}
            <td className="px-2.5 py-2.5 text-right cursor-pointer">
                <QtyBadge qty={item.qty} />
            </td>

            {/* Cost */}
            <td className="px-2.5 py-2.5 text-right text-[12px] font-mono font-medium text-foreground/70 cursor-pointer">
                {item.cost && item.cost > 0
                    ? `$${item.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
                    : <span className="text-muted-foreground/30">—</span>}
            </td>

            {/* Reason */}
            <td className="px-2.5 py-2.5 text-[12px] text-foreground/80 truncate cursor-pointer max-w-[320px]" title={item.reason}>
                {item.reason || <span className="text-muted-foreground/30">—</span>}
            </td>

            {/* Created By */}
            <td className="px-2.5 py-2.5 text-[12px] font-medium text-foreground/80 truncate cursor-pointer">
                {userName}
            </td>

            {/* Actions */}
            <td className="px-2.5 py-2.5 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={onEdit}
                        className="p-1.5 rounded-md text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                        title="Edit Adjustment"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {canDelete() && (
                        <button
                            onClick={onDelete}
                            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete Adjustment"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </td>

        </tr>
    );
});

// ─── Adjustment Modal ─────────────────────────────────────────────────────────

function AdjustmentModal({ onClose, initialData, skus, sessionUser, onSuccess }: {
    onClose: () => void;
    initialData: AuditAdjustment | null;
    skus: { label: string; value: string }[];
    sessionUser: any;
    onSuccess: () => void;
}) {
    const [formData, setFormData] = useState({
        sku: initialData ? (typeof initialData.sku === 'object' ? initialData.sku._id : initialData.sku) : '',
        lotNumber: initialData?.lotNumber || '',
        qty: initialData?.qty || 0,
        reason: initialData?.reason || '',
    });
    const [saving, setSaving] = useState(false);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const url = initialData ? `/api/warehouse/audit-adjustments/${initialData._id}` : '/api/warehouse/audit-adjustments';
            const method = initialData ? 'PUT' : 'POST';
            const payload = { ...formData, createdBy: initialData ? undefined : (sessionUser?.id || sessionUser?.name || 'Unknown') };
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (res.ok) {
                toast.success(initialData ? 'Adjustment updated' : 'Adjustment created');
                globalCache.current = null;
                onSuccess();
                onClose();
            } else {
                toast.error('Operation failed');
            }
        } catch { toast.error('Error saving data'); }
        finally { setSaving(false); }
    };

    const inp = 'w-full px-3 h-9 bg-secondary border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors';

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background border border-border w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded-xl">
                <div className="flex items-center justify-between px-5 h-11 border-b border-border shrink-0 bg-secondary rounded-t-xl">
                    <h2 className="text-[10px] font-black uppercase tracking-widest">{initialData ? 'Edit Adjustment' : 'New Adjustment'}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-custom">
                    {/* SKU */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">SKU</label>
                        {initialData ? (
                            <input type="text"
                                value={typeof initialData.sku === 'object' ? (initialData.sku as any).name : initialData.sku}
                                disabled className="w-full px-3 h-9 bg-secondary border border-border rounded-lg text-[12px] text-muted-foreground cursor-not-allowed" />
                        ) : (
                            <SearchableSelect options={skus} value={formData.sku} onChange={val => setFormData({ ...formData, sku: val })} placeholder="Select SKU..." className="w-full" />
                        )}
                    </div>

                    {/* Lot + Qty */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Lot Number</label>
                            <div className="flex gap-1.5">
                                <input type="text" value={formData.lotNumber} onChange={e => setFormData({ ...formData, lotNumber: e.target.value })}
                                    className="flex-1 px-3 h-9 bg-secondary border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors"
                                    placeholder="Enter Lot #" />
                                {formData.sku && (
                                    <button type="button" onClick={() => setIsLotModalOpen(true)}
                                        className="px-2.5 h-9 bg-primary/10 border border-primary/30 rounded-lg text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors whitespace-nowrap cursor-pointer">
                                        Pick
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Quantity</label>
                            <input type="number" step="any" value={formData.qty}
                                onChange={e => { const v = parseFloat(e.target.value); setFormData({ ...formData, qty: isNaN(v) ? 0 : v }); }} className={inp} placeholder="0" />
                            <p className="text-[10px] text-muted-foreground/60">Positive adds, negative removes.</p>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Reason</label>
                        <textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-3 py-2 bg-secondary border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors min-h-[80px] resize-none"
                            placeholder="Why is this being adjusted?" />
                    </div>

                    {/* Actions */}
                    <div className="h-10 pt-1 flex gap-2 border-t border-border mt-2">
                        <button type="button" onClick={onClose} className="flex-1 flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-secondary transition-colors rounded-lg cursor-pointer">Cancel</button>
                        <button type="submit" disabled={saving || (!initialData && !formData.sku)}
                            className="flex-1 flex items-center justify-center gap-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                            <span>{initialData ? 'Save Changes' : 'Create'}</span>
                        </button>
                    </div>
                </form>

                {isLotModalOpen && formData.sku && (
                    <LotSelectionModal isOpen={isLotModalOpen} onClose={() => setIsLotModalOpen(false)}
                        onSelect={lotNumber => { setFormData({ ...formData, lotNumber }); setIsLotModalOpen(false); }}
                        skuId={formData.sku} currentLotNumber={formData.lotNumber} title="Select Lot" />
                )}
            </div>
        </div>
    );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function AuditAdjustmentsPageWrapper() {
    return (
        <Suspense fallback={<ShellSkeleton />}>
            <AuditAdjustmentsContent />
        </Suspense>
    );
}

function ShellSkeleton() {
    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3">
                <div className="h-4 w-40 bg-secondary animate-pulse rounded" />
                <div className="h-4 w-12 bg-secondary animate-pulse rounded ml-4" />
            </div>
            <div className="flex-1 overflow-hidden px-2 py-1">
                <table className="w-full text-left border-separate border-spacing-0">
                    <thead className="bg-secondary border-b border-border sticky top-0 z-10">
                        <tr>
                            {COLUMNS.map((col) => (
                                <th key={col.key} className={cn('px-2 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-0', col.width)}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Content ──────────────────────────────────────────────────────────────────

function AuditAdjustmentsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [adjustments, setAdjustments] = useState<AuditAdjustment[]>(globalCache.current?.adjustments || []);
    const [isLoading, setIsLoading] = useState(!globalCache.current);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
    const [total, setTotal] = useState(globalCache.current?.total || 0);
    const [error, setError] = useState<string | null>(null);

    // Initialize from URL params
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
    const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc');

    // Date Filter State
    const [datePreset, setDatePreset] = useState<string>(searchParams.get('datePreset') || globalCache.current?.datePreset || 'All Time');
    const [fromDate, setFromDate] = useState<string>(searchParams.get('fromDate') || globalCache.current?.fromDate || '');
    const [toDate, setToDate] = useState<string>(searchParams.get('toDate') || globalCache.current?.toDate || '');
    const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
    const dateDropdownRef = useRef<HTMLDivElement>(null);

    const handleDatePreset = (preset: string) => {
        const today = new Date();
        const formatDateStr = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        let start = '';
        let end = '';

        if (preset === 'This Month') {
            start = formatDateStr(new Date(today.getFullYear(), today.getMonth(), 1));
            end = formatDateStr(new Date(today.getFullYear(), today.getMonth() + 1, 0));
        } else if (preset === 'Last Month') {
            start = formatDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1));
            end = formatDateStr(new Date(today.getFullYear(), today.getMonth(), 0));
        } else if (preset === 'This Year') {
            start = formatDateStr(new Date(today.getFullYear(), 0, 1));
            end = formatDateStr(new Date(today.getFullYear(), 11, 31));
        } else if (preset === 'Last Year') {
            start = formatDateStr(new Date(today.getFullYear() - 1, 0, 1));
            end = formatDateStr(new Date(today.getFullYear() - 1, 11, 31));
        }

        setDatePreset(preset);
        setFromDate(start);
        setToDate(end);
        setIsDateDropdownOpen(false);
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AuditAdjustment | null>(null);
    const [skus, setSkus] = useState<{ label: string; value: string }[]>([]);
    const [globalSettings, setGlobalSettings] = useState<any>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [filterId, setFilterId] = useState<string | null>(searchParams.get('id') || null);

    // Inline lot picker state
    const [lotPickerItem, setLotPickerItem] = useState<AuditAdjustment | null>(null);

    // Lot number filter state
    const [selectedLots, setSelectedLots] = useState<string[]>([]);
    const [availableLots, setAvailableLots] = useState<string[]>([]);
    const [lotDropdownOpen, setLotDropdownOpen] = useState(false);
    const [lotSearch, setLotSearch] = useState('');
    const lotDropdownRef = useRef<HTMLDivElement | null>(null);

    const pageRef = useRef(globalCache.current?.page || 0);
    const mountedRef = useRef(true);
    const fetchingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const reqSeqRef = useRef(0);

    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

    // ─── Side data ──────────────────────────────────────────────────────────

    useEffect(() => {
        fetch('/api/skus?limit=0&ignoreDate=true&simple=true').then(r => r.json())
            .then(d => { if (d.skus) setSkus(d.skus.map((s: any) => ({ label: s.name, value: s._id }))); }).catch(() => { });
        fetch('/api/settings').then(r => r.json()).then(setGlobalSettings).catch(() => { });
        // Fetch distinct lot numbers for filter
        fetch('/api/warehouse/audit-adjustments?limit=0&distinctLots=true').then(r => r.json()).then(d => {
            // Extract unique lot numbers from all adjustments
            const lotSet = new Set<string>();
            (d.adjustments || []).forEach((a: any) => { if (a.lotNumber && a.lotNumber.trim()) lotSet.add(a.lotNumber.trim()); });
            setAvailableLots(Array.from(lotSet).sort());
        }).catch(() => {
            // Fallback: fetch a large page to get distinct lots
            fetch('/api/warehouse/audit-adjustments?limit=5000&page=1').then(r => r.json()).then(d => {
                const lotSet = new Set<string>();
                (d.adjustments || []).forEach((a: any) => { if (a.lotNumber && a.lotNumber.trim()) lotSet.add(a.lotNumber.trim()); });
                setAvailableLots(Array.from(lotSet).sort());
            }).catch(() => {});
        });
    }, []);

    // Handle createNew URL param
    useEffect(() => {
        if (searchParams.get('createNew') === 'true') {
            setEditingItem(null); setIsModalOpen(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('createNew');
            router.replace(`/warehouse/audit-adjustments${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
        }
    }, [searchParams, router]);

    // ─── Debounce ────────────────────────────────────────────────────────────

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 250);
        return () => clearTimeout(t);
    }, [search]);

    // Close lot dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (lotDropdownRef.current && !lotDropdownRef.current.contains(e.target as Node)) {
                setLotDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close date dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
                setIsDateDropdownOpen(false);
            }
        };
        if (isDateDropdownOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isDateDropdownOpen]);

    // ─── Sync filters to URL ─────────────────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set('search', debouncedSearch);
        if (sortBy !== 'createdAt') params.set('sortBy', sortBy);
        if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
        if (datePreset !== 'All Time') params.set('datePreset', datePreset);
        if (fromDate) params.set('fromDate', fromDate);
        if (toDate) params.set('toDate', toDate);

        const qs = params.toString();
        const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}`;
        const currentQs = window.location.search.replace(/^\?/, '');
        if (currentQs !== qs) {
            router.replace(newUrl, { scroll: false });
        }
    }, [debouncedSearch, sortBy, sortOrder, datePreset, fromDate, toDate, router]);

    // ─── Scroll-back highlight ──────────────────────────────────────────────

    useEffect(() => {
        const savedId = sessionStorage.getItem('aa_scroll_to');
        const savedScroll = sessionStorage.getItem('aa_scroll_top');
        if (savedId) {
            sessionStorage.removeItem('aa_scroll_to');
            sessionStorage.removeItem('aa_scroll_top');
            setHighlightId(savedId);
            if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
            const tryScroll = (attempts = 0) => {
                const row = document.querySelector(`[data-aa-id="${savedId}"]`);
                if (row) { setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); setTimeout(() => setHighlightId(null), 3000); }
                else if (attempts < 30) setTimeout(() => tryScroll(attempts + 1), 200);
            };
            setTimeout(() => tryScroll(), 100);
        }
    }, []);

    // ─── Fetch ──────────────────────────────────────────────────────────────

    const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const seq = ++reqSeqRef.current;

        fetchingRef.current = true;
        if (isAppend) setIsLoadingMore(true); else setIsLoading(true);

        try {
            const params = new URLSearchParams({
                page: String(pageNum), limit: String(PAGE_SIZE),
                search: debouncedSearch, sortBy, sortOrder,
            });
            if (filterId) params.set('id', filterId);
            if (selectedLots.length > 0) params.set('lotNumber', selectedLots.join(','));
            if (fromDate) params.set('fromDate', fromDate + 'T00:00:00.000Z');
            if (toDate) params.set('toDate', toDate + 'T23:59:59.999Z');

            const res = await fetch(`/api/warehouse/audit-adjustments?${params}`, { signal: controller.signal });
            const data = await res.json();
            if (seq !== reqSeqRef.current || !mountedRef.current) return;

            if (res.ok) {
                const newItems: AuditAdjustment[] = data.adjustments || [];
                const newHasMore = data.hasMore ?? false;
                const newTotal = data.total || 0;

                if (isAppend) {
                    setAdjustments(prev => {
                        const ids = new Set(prev.map(a => a._id));
                        const merged = [...prev, ...newItems.filter(a => !ids.has(a._id))];
                        globalCache.current = { adjustments: merged, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, lotNumbers: selectedLots, datePreset, fromDate, toDate, timestamp: Date.now() };
                        return merged;
                    });
                } else {
                    setAdjustments(newItems);
                    setTotal(newTotal);
                    globalCache.current = { adjustments: newItems, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, lotNumbers: selectedLots, datePreset, fromDate, toDate, timestamp: Date.now() };
                }
                setHasMore(newHasMore);
                pageRef.current = pageNum;
                setError(null);
            } else {
                setError(data.error || 'Failed to fetch');
            }
        } catch (e: any) {
            if (e?.name === 'AbortError') return;
            if (mountedRef.current) setError(e.message);
        } finally {
            fetchingRef.current = false;
            if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); }
        }
    }, [sortBy, sortOrder, debouncedSearch, filterId, selectedLots, fromDate, toDate]);

    // ─── Initial load / filter changes ──────────────────────────────────────

    const fetchPageRef = useRef(fetchPage);
    fetchPageRef.current = fetchPage;
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            // Skip cache when filtering by specific ID
            if (!filterId) {
                const cache = globalCache.current;
                if (cache && cache.adjustments.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
                    cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch && JSON.stringify(cache.lotNumbers) === JSON.stringify(selectedLots) && cache.datePreset === datePreset && cache.fromDate === fromDate && cache.toDate === toDate) {
                    setAdjustments(cache.adjustments); setHasMore(cache.hasMore); setTotal(cache.total);
                    pageRef.current = cache.page; setIsLoading(false); return;
                }
            }
        }
        globalCache.current = null;
        pageRef.current = 0;
        setAdjustments([]);
        setHasMore(true);
        fetchPageRef.current(1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy, sortOrder, debouncedSearch, filterId, selectedLots, datePreset, fromDate, toDate]);

    // ─── Infinite scroll ────────────────────────────────────────────────────

    useEffect(() => {
        const sentinel = sentinelRef.current;
        const container = scrollRef.current;
        if (!sentinel || !container) return;
        const observer = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPageRef.current(pageRef.current + 1, true); },
            { root: container, rootMargin: '600px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoading]);

    // ─── Sort handler ───────────────────────────────────────────────────────

    const handleSort = (col: string) => {
        if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortOrder('asc'); }
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const missingImg = globalSettings?.missingSkuImage || '';

    // ─── Delete handler ─────────────────────────────────────────────────────

    const handleDeleteAdjustment = (adjustmentId: string) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this adjustment?</p>
                <p className="text-xs text-gray-400">This action cannot be undone.</p>
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                const res = await fetch(`/api/warehouse/audit-adjustments/${adjustmentId}`, {
                                    method: 'DELETE'
                                });
                                if (res.ok) {
                                    toast.success('Adjustment deleted');
                                    globalCache.current = null;
                                    pageRef.current = 0;
                                    fetchPageRef.current(1, false);
                                } else {
                                    const data = await res.json();
                                    toast.error(data.error || 'Failed to delete');
                                }
                            } catch (e) {
                                toast.error('Error deleting adjustment');
                            }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
    };

    // ─── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

            {/* ─── Page Header (manufacturing-style) ────────────────── */}
            <div className="shrink-0 border-b border-border bg-background">
                <div className="px-4 py-2.5 flex items-center gap-4">

                    {/* Title */}
                    <div className="flex items-center gap-2 shrink-0">
                        <ClipboardCheck className="w-4 h-4 text-primary" />
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Audit Adjustments</h1>
                    </div>

                    {/* Separator */}
                    <div className="h-5 w-px bg-border shrink-0" />

                    {/* Total count */}
                    <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums shrink-0">
                        {total > 0 ? total.toLocaleString() : ''}
                    </span>

                    {/* Filter badge when viewing single record */}
                    {filterId && (
                        <button
                            onClick={() => { setFilterId(null); router.replace('/warehouse/audit-adjustments', { scroll: false }); globalCache.current = null; pageRef.current = 0; fetchPageRef.current(1, false); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/30 rounded text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/20 transition-colors cursor-pointer shrink-0"
                        >
                            <span>Filtered</span>
                            <X className="w-3 h-3" />
                        </button>
                    )}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Lot Number Filter */}
                    <div ref={lotDropdownRef} className="relative shrink-0">
                        <button
                            onClick={() => setLotDropdownOpen(p => !p)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border',
                                selectedLots.length > 0
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
                            )}
                        >
                            <Hash className="w-3.5 h-3.5" />
                            <span className="uppercase tracking-wider">
                                {selectedLots.length === 0 ? 'Lot #' : selectedLots.length === 1 ? selectedLots[0] : `${selectedLots.length} Lots`}
                            </span>
                            <ChevronDown className={cn('w-3 h-3 transition-transform', lotDropdownOpen && 'rotate-180')} />
                        </button>

                        {lotDropdownOpen && (
                            <div className="absolute top-full mt-1.5 right-0 z-50 bg-background border border-border rounded-xl shadow-2xl min-w-[240px] max-w-[300px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-3 py-2 border-b border-border bg-secondary">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Filter by Lot Number</span>
                                </div>

                                {/* Search within lots */}
                                <div className="px-2.5 py-2 border-b border-border">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50" />
                                        <input
                                            type="text"
                                            placeholder="Search lots..."
                                            value={lotSearch}
                                            onChange={e => setLotSearch(e.target.value)}
                                            className="w-full pl-7 pr-3 h-7 bg-secondary border border-border rounded-md text-[11px] outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/50 transition-colors"
                                            autoFocus
                                        />
                                    </div>
                                </div>

                                <div className="py-1 max-h-[280px] overflow-y-auto scrollbar-custom">
                                    {/* All option */}
                                    <button
                                        onClick={() => { setSelectedLots([]); setLotDropdownOpen(false); setLotSearch(''); }}
                                        className={cn(
                                            'w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-semibold hover:bg-secondary transition-colors cursor-pointer text-left',
                                            selectedLots.length === 0 && 'text-primary'
                                        )}
                                    >
                                        <div className={cn(
                                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                            selectedLots.length === 0 ? 'bg-primary border-primary' : 'border-border'
                                        )}>
                                            {selectedLots.length === 0 && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span>All Lots</span>
                                    </button>

                                    {availableLots
                                        .filter(l => !lotSearch || l.toLowerCase().includes(lotSearch.toLowerCase()))
                                        .map(lot => {
                                            const isSelected = selectedLots.includes(lot);
                                            return (
                                                <button
                                                    key={lot}
                                                    onClick={() => {
                                                        setSelectedLots(prev =>
                                                            isSelected ? prev.filter(l => l !== lot) : [...prev, lot]
                                                        );
                                                    }}
                                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-semibold hover:bg-secondary transition-colors cursor-pointer text-left"
                                                >
                                                    <div className={cn(
                                                        'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                                                        isSelected ? 'bg-primary border-primary' : 'border-border'
                                                    )}>
                                                        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                                    </div>
                                                    <span className="font-mono text-[11px] tracking-tight truncate">{lot}</span>
                                                </button>
                                            );
                                        })}

                                    {availableLots.filter(l => !lotSearch || l.toLowerCase().includes(lotSearch.toLowerCase())).length === 0 && (
                                        <div className="px-3 py-4 text-center text-[11px] text-muted-foreground/50 uppercase tracking-widest">
                                            No matching lots
                                        </div>
                                    )}
                                </div>

                                {selectedLots.length > 0 && (
                                    <div className="px-3 py-2 border-t border-border bg-secondary">
                                        <button
                                            onClick={() => { setSelectedLots([]); setLotDropdownOpen(false); setLotSearch(''); }}
                                            className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors cursor-pointer"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Date Filter Dropdown */}
                    <div className="relative shrink-0" ref={dateDropdownRef}>
                        <button
                            onClick={() => setIsDateDropdownOpen(p => !p)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-8 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer bg-secondary border-border hover:bg-secondary/80',
                                (fromDate || toDate)
                                    ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                                    : 'text-foreground'
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="uppercase tracking-wider text-nowrap">
                                {datePreset !== 'All Time' ? datePreset : (fromDate || toDate) ? 'Custom' : 'All Time'}
                            </span>
                            <ChevronDown className={cn('w-3 h-3 transition-transform', isDateDropdownOpen && 'rotate-180')} />
                        </button>
                        {isDateDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 bg-background border border-border rounded-xl shadow-2xl min-w-[280px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-3 py-2 border-b border-border bg-secondary flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date Filter</span>
                                    {(fromDate || toDate || datePreset !== 'All Time') && (
                                        <button onClick={() => { setDatePreset('All Time'); setFromDate(''); setToDate(''); setIsDateDropdownOpen(false); }} className="text-[9px] font-bold text-primary hover:underline cursor-pointer">
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="p-3 bg-background grid gap-1.5 grid-cols-2 text-center pb-3 border-b border-border">
                                    {['This Month', 'Last Month', 'This Year', 'Last Year'].map(preset => (
                                        <button
                                            key={preset}
                                            onClick={() => handleDatePreset(preset)}
                                            className={cn(
                                                'px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer',
                                                datePreset === preset ? 'bg-primary border-primary text-white' : 'bg-secondary border-border hover:bg-secondary/80 text-foreground'
                                            )}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 bg-background space-y-2">
                                    <div className="space-y-1 text-left">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">From</label>
                                        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDatePreset('Custom'); }} className="w-full bg-background border border-border rounded-lg px-2 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all text-foreground [color-scheme:dark_light]" />
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">To</label>
                                        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDatePreset('Custom'); }} className="w-full bg-background border border-border rounded-lg px-2 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all text-foreground [color-scheme:dark_light]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search SKU, lot, reason..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-8 pr-8 h-8 w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>

                    {/* Add button */}
                    <button
                        onClick={e => { e.stopPropagation(); setEditingItem(null); setIsModalOpen(true); }}
                        className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0"
                    >
                        <Plus className="w-3 h-3" />
                        <span className="hidden sm:inline text-[12px] font-black uppercase tracking-widest">Add</span>
                    </button>
                </div>
            </div>

            {/* ─── Table ──────────────────────────────────────────── */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
                <div className="min-w-fit px-2 py-1">
                    <table className="w-full text-left border-separate border-spacing-0 relative z-0">
                        <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
                            <tr>
                                {COLUMNS.map(col => (
                                    <th
                                        key={col.key}
                                        onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                        className={cn(
                                            'px-2.5 py-2 text-[12px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                                            col.width,
                                            col.align || 'text-left',
                                            col.sortable && 'cursor-pointer hover:bg-secondary dark:hover:bg-secondary transition-colors',
                                        )}
                                    >
                                        <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                                            <span>{col.label}</span>
                                            {col.sortable && <ArrowUpDown className={cn('w-2.5 h-2.5 transition-colors', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td>
                                </tr>
                            ) : adjustments.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-2 py-16 text-center">
                                        <ClipboardCheck className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                                        <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                                            {debouncedSearch ? 'No matching adjustments' : filterId ? 'Adjustment not found' : 'No adjustments found'}
                                        </p>
                                        {filterId && (
                                            <button
                                                onClick={() => { setFilterId(null); router.replace('/warehouse/audit-adjustments', { scroll: false }); globalCache.current = null; pageRef.current = 0; fetchPageRef.current(1, false); }}
                                                className="mt-3 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border rounded hover:bg-secondary transition-colors cursor-pointer"
                                            >Show All Adjustments</button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                adjustments.map((item) => (
                                    <TableRow
                                        key={item._id}
                                        item={item}
                                        highlight={highlightId === item._id || filterId === item._id}
                                        onEdit={(e) => {
                                            e.stopPropagation();
                                            setEditingItem(item);
                                            setIsModalOpen(true);
                                        }}
                                        onDelete={(e) => {
                                            e.stopPropagation();
                                            handleDeleteAdjustment(item._id);
                                        }}
                                        onPickLot={(e) => {
                                            e.stopPropagation();
                                            setLotPickerItem(item);
                                        }}
                                    />
                                ))
                            )}

                            {/* Loading more skeleton rows */}
                            {isLoadingMore && (
                                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={`loading-${i}`} index={i} />)
                            )}
                        </tbody>
                    </table>

                    {/* Sentinel for infinite scroll */}
                    <div ref={sentinelRef} className="h-1" />

                    {/* End marker */}
                    {!isLoading && !hasMore && adjustments.length > 0 && (
                        <div className="flex items-center justify-center py-4 gap-2">
                            <div className="h-px w-12 bg-border" />
                            <span className="text-[12px] text-muted-foreground/40 uppercase tracking-widest font-bold">
                                {adjustments.length.toLocaleString()} records loaded
                            </span>
                            <div className="h-px w-12 bg-border" />
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Modal ──────────────────────────────────────────── */}
            {isModalOpen && (
                <AdjustmentModal
                    onClose={() => setIsModalOpen(false)}
                    initialData={editingItem}
                    skus={skus}
                    sessionUser={session?.user}
                    onSuccess={() => { pageRef.current = 0; fetchPageRef.current(1, false); }}
                />
            )}

            {/* ─── Inline Lot Picker Modal ────────────────────────── */}
            {lotPickerItem && (() => {
                const skuId = typeof lotPickerItem.sku === 'object' && lotPickerItem.sku !== null
                    ? (lotPickerItem.sku as any)._id
                    : '';
                if (!skuId) return null;
                return (
                    <LotSelectionModal
                        isOpen={true}
                        onClose={() => setLotPickerItem(null)}
                        onSelect={async (lotNumber, cost) => {
                            try {
                                const res = await fetch(`/api/warehouse/audit-adjustments/${lotPickerItem._id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        lotNumber,
                                        qty: lotPickerItem.qty,
                                        reason: lotPickerItem.reason,
                                    }),
                                });
                                if (res.ok) {
                                    toast.success(`Lot updated to ${lotNumber || '(cleared)'}`);
                                    // Update local state immediately
                                    setAdjustments(prev => prev.map(a =>
                                        a._id === lotPickerItem._id ? { ...a, lotNumber: lotNumber || '' } : a
                                    ));
                                    globalCache.current = null;
                                } else {
                                    toast.error('Failed to update lot');
                                }
                            } catch {
                                toast.error('Error updating lot');
                            }
                            setLotPickerItem(null);
                        }}
                        skuId={skuId}
                        currentLotNumber={lotPickerItem.lotNumber}
                        title="Select Lot Number"
                    />
                );
            })()}
        </div>
    );
}
