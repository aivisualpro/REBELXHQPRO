'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { ArrowUpDown, X, Search, Loader2, Plus, List } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuditAdjustment {
    _id: string;
    sku: { _id: string; name: string; uom: string; image?: string; tier?: number } | string;
    lotNumber: string;
    qty: number;
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
    timestamp: number;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000;
const PAGE_SIZE = 50;

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: number }) {
    const colors: Record<number, string> = { 1: '#22c55e', 2: '#3b82f6', 3: '#f97316' };
    return (
        <span className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white shadow-sm"
            style={{ backgroundColor: colors[tier] || '#94a3b8' }} title={`Tier ${tier}`}>{tier}</span>
    );
}

// ─── Qty Badge ────────────────────────────────────────────────────────────────

function QtyBadge({ qty }: { qty: number }) {
    const isPositive = qty > 0;
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black font-mono"
            style={isPositive
                ? { backgroundColor: 'rgba(34,197,94,0.12)', color: '#16a34a', border: '1px solid rgba(34,197,94,0.25)' }
                : { backgroundColor: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)' }}
        >
            {isPositive ? '+' : ''}{qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
        </span>
    );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = React.memo(function SkeletonRow({ index }: { index: number }) {
    return (
        <tr className="border-b border-border/60" style={{ opacity: 1 - index * 0.04 }}>
            <td className="px-2.5 py-2.5 w-10"><div className="w-6 h-6 rounded-md bg-muted-foreground/10 animate-pulse" /></td>
            {[38, 18, 10, 25, 18, 15].map((w, i) => (
                <td key={i} className="px-2.5 py-2.5">
                    <div className="h-3 rounded bg-muted-foreground/10 animate-pulse" style={{ width: `${w}%` }} />
                </td>
            ))}
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

    const inp = 'w-full px-3 h-9 bg-secondary/50 border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors';

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background border border-border w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded-xl">
                <div className="flex items-center justify-between px-5 h-11 border-b border-border shrink-0 bg-secondary/30 rounded-t-xl">
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
                                    className="flex-1 px-3 h-9 bg-secondary/50 border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors"
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
                                onChange={e => setFormData({ ...formData, qty: parseFloat(e.target.value) })} className={inp} placeholder="0" />
                            <p className="text-[10px] text-muted-foreground/60">Positive adds, negative removes.</p>
                        </div>
                    </div>

                    {/* Reason */}
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Reason</label>
                        <textarea value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors min-h-[80px] resize-none"
                            placeholder="Why is this being adjusted?" />
                    </div>

                    {/* Actions */}
                    <div className="h-10 pt-1 flex gap-2 border-t border-border mt-2">
                        <button type="button" onClick={onClose} className="flex-1 flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/80 transition-colors rounded-lg cursor-pointer">Cancel</button>
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

// ─── Main Content ─────────────────────────────────────────────────────────────

function AuditAdjustmentsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [adjustments, setAdjustments] = useState<AuditAdjustment[]>(globalCache.current?.adjustments || []);
    const [isLoading, setIsLoading] = useState(!globalCache.current);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
    const [total, setTotal] = useState(globalCache.current?.total || 0);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AuditAdjustment | null>(null);
    const [skus, setSkus] = useState<{ label: string; value: string }[]>([]);
    const [globalSettings, setGlobalSettings] = useState<any>(null);
    const [highlightId, setHighlightId] = useState<string | null>(null);

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
    }, []);

    // Handle createNew URL param
    useEffect(() => {
        if (searchParams.get('createNew') === 'true') {
            setEditingItem(null); setIsModalOpen(true);
            const params = new URLSearchParams(searchParams.toString());
            params.delete('createNew');
            router.replace(`/warehouse/audit-adjustments${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
        }
    }, [searchParams]);

    // ─── Debounce ────────────────────────────────────────────────────────────

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    // ─── Scroll-back highlight ───────────────────────────────────────────────

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

    // ─── Fetch ───────────────────────────────────────────────────────────────

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
                        globalCache.current = { adjustments: merged, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, timestamp: Date.now() };
                        return merged;
                    });
                } else {
                    setAdjustments(newItems);
                    setTotal(newTotal);
                    globalCache.current = { adjustments: newItems, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, timestamp: Date.now() };
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
    }, [sortBy, sortOrder, debouncedSearch]);

    // ─── Initial load / filter changes ──────────────────────────────────────

    const fetchPageRef = useRef(fetchPage);
    fetchPageRef.current = fetchPage;
    const isFirstMount = useRef(true);

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false;
            const cache = globalCache.current;
            if (cache && cache.adjustments.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
                cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch) {
                setAdjustments(cache.adjustments); setHasMore(cache.hasMore); setTotal(cache.total);
                pageRef.current = cache.page; setIsLoading(false); return;
            }
        }
        globalCache.current = null;
        pageRef.current = 0;
        setAdjustments([]);
        setHasMore(true);
        fetchPageRef.current(1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy, sortOrder, debouncedSearch]);

    // ─── Infinite scroll ────────────────────────────────────────────────────

    useEffect(() => {
        const sentinel = sentinelRef.current;
        const container = scrollRef.current;
        if (!sentinel || !container) return;
        const observer = new IntersectionObserver(
            entries => { if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPageRef.current(pageRef.current + 1, true); },
            { root: container, rootMargin: '400px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, isLoading]);

    const handleSort = (col: string) => {
        if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortOrder('asc'); }
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const getSkuData = (val: any) => {
        if (typeof val === 'object' && val?.name) return val;
        return { _id: '', name: typeof val === 'string' ? val : '-', uom: '', image: '' };
    };
    const renderUser = (val: any) => {
        if (typeof val === 'object' && val?.firstName) return `${val.firstName} ${val.lastName}`;
        if (typeof val === 'string') return val;
        return '-';
    };

    const missingImg = globalSettings?.missingSkuImage || '';

    const COLS = [
        { key: 'img', label: 'Img', sortable: false, width: 'w-10' },
        { key: 'sku', label: 'SKU', sortable: true, width: 'w-[220px]' },
        { key: 'lotNumber', label: 'Lot #', sortable: true, width: 'w-[120px]' },
        { key: 'qty', label: 'Qty', sortable: true, width: 'w-[100px]' },
        { key: 'reason', label: 'Reason', sortable: true, width: 'w-[260px]' },
        { key: 'createdBy', label: 'Created By', sortable: false, width: 'w-[140px]' },
        { key: 'createdAt', label: 'Date', sortable: true, width: 'w-[100px]' },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

            {/* ─── Local Page Header ───────────────────────────────────────── */}
            <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex items-center gap-3 overflow-x-auto">

                {/* Title + count */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">AUDIT ADJUSTMENTS</span>
                    <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">{total > 0 ? total.toLocaleString() : ''}</span>
                </div>

                <div className="h-5 w-px bg-border shrink-0" />

                {/* Search */}
                <div className="relative flex items-center shrink-0">
                    <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search SKU, lot, reason..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 pr-8 h-8 w-64 bg-secondary/60 border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex-1" />

                {/* ADD button */}
                <button
                    onClick={e => { e.stopPropagation(); setEditingItem(null); setIsModalOpen(true); }}
                    className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-black uppercase tracking-widest">ADD</span>
                </button>
            </div>

            {/* ─── Table ──────────────────────────────────────────────────── */}
            <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
                <div className="min-w-fit px-2 py-1">
                    <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
                        <thead className="bg-background border-b border-border sticky top-0 z-10">
                            <tr>
                                {COLS.map(col => (
                                    <th
                                        key={col.key}
                                        onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                        className={cn(
                                            'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                                            col.width,
                                            col.sortable && 'cursor-pointer hover:bg-secondary/60 transition-colors',
                                        )}
                                    >
                                        <div className="flex items-center gap-1">
                                            <span>{col.label}</span>
                                            {col.sortable && <ArrowUpDown className={cn('w-2.5 h-2.5 flex-shrink-0', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} index={i} />)
                            ) : error ? (
                                <tr><td colSpan={7} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
                            ) : adjustments.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No records found</td></tr>
                            ) : adjustments.map(item => {
                                const skuData = getSkuData(item.sku);
                                const imgSrc = skuData.image || missingImg || '';
                                const skuTier = typeof item.sku === 'object' && item.sku !== null ? (item.sku as any).tier : undefined;

                                return (
                                    <tr
                                        key={item._id}
                                        data-aa-id={item._id}
                                        className={cn(
                                            'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
                                            highlightId === item._id && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
                                        )}
                                        onClick={() => {
                                            sessionStorage.setItem('aa_scroll_to', item._id);
                                            if (scrollRef.current) sessionStorage.setItem('aa_scroll_top', String(scrollRef.current.scrollTop));
                                            router.push(`/warehouse/audit-adjustments/${item._id}`);
                                        }}
                                    >
                                        {/* Image */}
                                        <td className="px-2.5 py-2.5 w-10 border-r border-border/40">
                                            <div className="w-6 h-6 rounded-md overflow-hidden bg-secondary flex items-center justify-center border border-border flex-shrink-0">
                                                <img src={imgSrc || '/sku-placeholder.png'} alt="" className="w-full h-full object-cover"
                                                    onError={e => {
                                                        const t = e.target as HTMLImageElement;
                                                        const fb = missingImg || '/sku-placeholder.png';
                                                        if (!t.src.includes('sku-placeholder.png')) t.src = fb;
                                                    }} />
                                            </div>
                                        </td>

                                        {/* SKU Name + Tier */}
                                        <td className="px-2.5 py-2.5 w-[220px] text-[12px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors border-r border-border/40">
                                            <div className="flex items-center gap-1.5">
                                                {skuTier ? <TierBadge tier={skuTier} /> : null}
                                                <span className="truncate" title={skuData.name}>{skuData.name}</span>
                                            </div>
                                        </td>

                                        {/* Lot Number */}
                                        <td className="px-2.5 py-2.5 w-[120px] text-[11px] font-mono text-foreground/60 tracking-tight border-r border-border/40">
                                            {item.lotNumber || <span className="text-muted-foreground/30">—</span>}
                                        </td>

                                        {/* Qty */}
                                        <td className="px-2.5 py-2.5 w-[100px] border-r border-border/40">
                                            <QtyBadge qty={item.qty} />
                                        </td>

                                        {/* Reason */}
                                        <td className="px-2.5 py-2.5 w-[260px] text-[11px] text-foreground/60 truncate border-r border-border/40" title={item.reason}>
                                            {item.reason || <span className="text-muted-foreground/30">—</span>}
                                        </td>

                                        {/* Created By */}
                                        <td className="px-2.5 py-2.5 w-[140px] text-[11px] text-foreground/60 border-r border-border/40">
                                            {renderUser(item.createdBy)}
                                        </td>

                                        {/* Date */}
                                        <td className="px-2.5 py-2.5 w-[100px] text-[11px] font-mono text-foreground/50">
                                            {new Date(item.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Infinite scroll sentinel */}
                    <div ref={sentinelRef} className="h-2" />

                    {isLoadingMore && (
                        <div className="flex items-center justify-center gap-2 py-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    )}

                    {!hasMore && adjustments.length > 0 && !isLoading && (
                        <div className="text-center py-4 text-[11px] text-muted-foreground/40 uppercase tracking-widest">
                            — {adjustments.length.toLocaleString()} records loaded —
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Modal ──────────────────────────────────────────────────── */}
            {isModalOpen && (
                <AdjustmentModal
                    onClose={() => setIsModalOpen(false)}
                    initialData={editingItem}
                    skus={skus}
                    sessionUser={session?.user}
                    onSuccess={() => { pageRef.current = 0; fetchPageRef.current(1, false); }}
                />
            )}
        </div>
    );
}

export default function AuditAdjustmentsPageWrapper() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <AuditAdjustmentsPage />
        </Suspense>
    );
}
