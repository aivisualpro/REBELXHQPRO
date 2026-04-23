'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, ArrowUpDown, Loader2, List, Plus, X, Download, Calendar, ChevronDown } from 'lucide-react';
import { cn, formatDate, toDateInputValue } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpeningBalance {
    _id: string;
    sku: { _id: string; name: string; image?: string } | string;
    lotNumber: string;
    qty: number;
    uom: string;
    cost: number;
    expirationDate?: string;
    createdAt: string;
}

interface CacheEntry {
    balances: OpeningBalance[];
    hasMore: boolean;
    page: number;
    total: number;
    sortBy: string;
    sortOrder: string;
    search: string;
    datePreset: string;
    fromDate: string;
    toDate: string;
    timestamp: number;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000;
const PAGE_SIZE = 50;

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = React.memo(function SkeletonRow({ index }: { index: number }) {
    return (
        <tr className="border-b border-border/60" style={{ opacity: 1 - index * 0.04 }}>
            <td className="px-2.5 py-2.5 w-10"><div className="w-6 h-6 rounded-md bg-muted-foreground/10 animate-pulse" /></td>
            {[45, 20, 12, 10, 15, 15, 15].map((w, i) => (
                <td key={i} className="px-2.5 py-2.5">
                    <div className="h-3 rounded bg-muted-foreground/10 animate-pulse" style={{ width: `${w}%` }} />
                </td>
            ))}
        </tr>
    );
});

// ─── UOM Pill ─────────────────────────────────────────────────────────────────

function UomPill({ value }: { value: string }) {
    return (
        <span style={{ backgroundColor: 'rgba(254,153,0,0.12)', color: '#b45309', border: '1px solid rgba(254,153,0,0.25)', borderRadius: '5px' }}
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-black font-mono uppercase tracking-widest">
            {value}
        </span>
    );
}

// ─── Expiry Badge ─────────────────────────────────────────────────────────────

function ExpiryBadge({ date }: { date?: string }) {
    if (!date) return <span className="text-muted-foreground/30 text-[11px]">—</span>;
    const d = new Date(date);
    const now = new Date();
    const daysLeft = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
    const isExpired = daysLeft < 0;
    const isSoon = daysLeft >= 0 && daysLeft <= 30;
    return (
        <span
            style={isExpired
                ? { backgroundColor: 'rgba(220,38,38,0.12)', color: '#dc2626', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '5px' }
                : isSoon
                    ? { backgroundColor: 'rgba(217,119,6,0.12)', color: '#d97706', border: '1px solid rgba(217,119,6,0.25)', borderRadius: '5px' }
                    : undefined}
            className={cn(
                'inline-flex items-center px-2 py-0.5 text-[11px] font-mono',
                !isExpired && !isSoon && 'text-foreground/60',
                (isExpired || isSoon) && 'font-bold'
            )}
        >
            {formatDate(d)}
        </span>
    );
}

// ─── Form Modal ───────────────────────────────────────────────────────────────

function OBModal({
    editingId, formData, setFormData, allSkus, onClose, onSaved,
    onOpenLotSelector
}: {
    editingId: string | null;
    formData: any;
    setFormData: React.Dispatch<React.SetStateAction<any>>;
    allSkus: { _id: string; name: string }[];
    onClose: () => void;
    onSaved: () => void;
    onOpenLotSelector: () => void;
}) {
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.sku) { toast.error('Please select a SKU'); return; }
        setSaving(true);
        try {
            const url = editingId ? `/api/opening-balances/${editingId}` : '/api/opening-balances';
            const res = await fetch(url, {
                method: editingId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                toast.success(editingId ? 'Updated successfully' : 'Created successfully');
                globalCache.current = null;
                onSaved();
                onClose();
            } else {
                toast.error('Failed to save');
            }
        } catch { toast.error('Error saving item'); }
        finally { setSaving(false); }
    };

    const inp = 'w-full px-3 h-9 bg-secondary border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors';

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background border border-border w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded-xl">
                <div className="flex items-center justify-between px-5 h-11 border-b border-border shrink-0 bg-secondary rounded-t-xl">
                    <h2 className="text-[10px] font-black uppercase tracking-widest">{editingId ? 'Edit Opening Balance' : 'Add Opening Balance'}</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer"><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-custom">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">SKU</label>
                        <SearchableSelect
                            placeholder="Select SKU"
                            options={allSkus.map(s => ({ value: s._id, label: s.name }))}
                            value={formData.sku}
                            onChange={val => setFormData((p: any) => ({ ...p, sku: val }))}
                            className="w-full text-[12px]"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Lot Number</label>
                            <div className="flex gap-2 h-9">
                                <input type="text" value={formData.lotNumber} onChange={e => setFormData((p: any) => ({ ...p, lotNumber: e.target.value }))}
                                    className="flex-1 px-3 h-full bg-secondary border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors"
                                    placeholder="Enter Lot #" />
                                <button type="button" onClick={onOpenLotSelector}
                                    className="px-3 h-full bg-secondary border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer" title="Select Existing Lot">
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Quantity</label>
                            <input type="number" step="0.01" value={formData.qty} onChange={e => setFormData((p: any) => ({ ...p, qty: parseFloat(e.target.value) }))} className={inp} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">UOM</label>
                            <input type="text" value={formData.uom} onChange={e => setFormData((p: any) => ({ ...p, uom: e.target.value }))} className={inp} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Cost ($)</label>
                            <input type="number" step="0.01" value={formData.cost} onChange={e => setFormData((p: any) => ({ ...p, cost: parseFloat(e.target.value) }))} className={inp} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Expiration Date (Optional)</label>
                        <input type="date" value={formData.expirationDate} onChange={e => setFormData((p: any) => ({ ...p, expirationDate: e.target.value }))} className={inp} />
                    </div>
                    <div className="h-10 pt-1 flex gap-2 border-t border-border mt-2">
                        <button type="button" onClick={onClose} className="flex-1 flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-secondary transition-colors rounded-lg cursor-pointer">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all rounded-lg disabled:opacity-50 cursor-pointer">
                            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                            Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

const EMPTY_FORM = { sku: '', lotNumber: '', qty: 0, uom: 'pcs', cost: 0, expirationDate: '' };

function OpeningBalancesContent() {
    const router = useRouter();
    const { data: session } = useSession();
    const searchParams = useSearchParams();

    const [balances, setBalances] = useState<OpeningBalance[]>(globalCache.current?.balances || []);
    const [isLoading, setIsLoading] = useState(!globalCache.current);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
    const [total, setTotal] = useState(globalCache.current?.total || 0);
    const [error, setError] = useState<string | null>(null);

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

    // CRUD / Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ ...EMPTY_FORM });
    const [allSkus, setAllSkus] = useState<{ _id: string; name: string }[]>([]);
    const [globalSettings, setGlobalSettings] = useState<any>(null);
    const [lotSelector, setLotSelector] = useState<{ isOpen: boolean; mode: 'form' | 'row'; itemId?: string; skuId: string; currentLot: string; }>({ isOpen: false, mode: 'form', skuId: '', currentLot: '' });
    const [highlightId, setHighlightId] = useState<string | null>(null);

    const pageRef = useRef(globalCache.current?.page || 0);
    const mountedRef = useRef(true);
    const fetchingRef = useRef(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const reqSeqRef = useRef(0);

    useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

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

    // ─── Side data ──────────────────────────────────────────────────────────

    useEffect(() => {
        fetch('/api/skus?limit=0&ignoreDate=true&simple=true').then(r => r.json()).then(d => setAllSkus(d.skus || [])).catch(() => { });
        fetch('/api/settings').then(r => r.json()).then(setGlobalSettings).catch(() => { });
    }, []);

    // Handle createNew URL param
    useEffect(() => {
        if (searchParams.get('createNew') === 'true') {
            handleOpenAdd();
            const params = new URLSearchParams(searchParams.toString());
            params.delete('createNew');
            window.history.replaceState(null, '', `?${params.toString()}`);
        }
    }, [searchParams]);

    // ─── Debounce ────────────────────────────────────────────────────────────

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    // ─── Sync filters to URL ────────────────────────────────────────────────
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

    // ─── Scroll-back highlight ───────────────────────────────────────────────

    useEffect(() => {
        const savedId = sessionStorage.getItem('ob_scroll_to');
        const savedScroll = sessionStorage.getItem('ob_scroll_top');
        if (savedId) {
            sessionStorage.removeItem('ob_scroll_to');
            sessionStorage.removeItem('ob_scroll_top');
            setHighlightId(savedId);
            if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
            const tryScroll = (attempts = 0) => {
                const row = document.querySelector(`[data-ob-id="${savedId}"]`);
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
                page: String(pageNum),
                limit: String(PAGE_SIZE),
                search: debouncedSearch,
                sortBy,
                sortOrder,
            });
            if (fromDate) params.set('fromDate', fromDate + 'T00:00:00.000Z');
            if (toDate) params.set('toDate', toDate + 'T23:59:59.999Z');

            const res = await fetch(`/api/opening-balances?${params}`, { signal: controller.signal });
            const data = await res.json();

            if (seq !== reqSeqRef.current || !mountedRef.current) return;

            if (res.ok) {
                const newBalances: OpeningBalance[] = data.openingBalances || [];
                const newHasMore = data.hasMore ?? false;
                const newTotal = data.total || 0;

                if (isAppend) {
                    setBalances(prev => {
                        const ids = new Set(prev.map(b => b._id));
                        const merged = [...prev, ...newBalances.filter(b => !ids.has(b._id))];
                        globalCache.current = { balances: merged, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, datePreset, fromDate, toDate, timestamp: Date.now() };
                        return merged;
                    });
                } else {
                    setBalances(newBalances);
                    setTotal(newTotal);
                    globalCache.current = { balances: newBalances, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, datePreset, fromDate, toDate, timestamp: Date.now() };
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
    }, [sortBy, sortOrder, debouncedSearch, fromDate, toDate]);

    // ─── Initial load / filter changes ──────────────────────────────────────

    const fetchPageRef = useRef(fetchPage);
    fetchPageRef.current = fetchPage;
    const isFirstMount = useRef(true);
    const prevFiltersRef = useRef({ sortBy, sortOrder, search: debouncedSearch });

    useEffect(() => {
        const prev = prevFiltersRef.current;
        prevFiltersRef.current = { sortBy, sortOrder, search: debouncedSearch };

        if (isFirstMount.current) {
            isFirstMount.current = false;
            const cache = globalCache.current;
            if (cache && cache.balances.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
                cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch && cache.datePreset === datePreset && cache.fromDate === fromDate && cache.toDate === toDate) {
                setBalances(cache.balances); setHasMore(cache.hasMore); setTotal(cache.total);
                pageRef.current = cache.page; setIsLoading(false); return;
            }
        }

        globalCache.current = null;
        pageRef.current = 0;
        setBalances([]);
        setHasMore(true);
        fetchPageRef.current(1, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortBy, sortOrder, debouncedSearch, datePreset, fromDate, toDate]);

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

    // ─── CRUD Handlers ───────────────────────────────────────────────────────

    const handleOpenAdd = () => { setEditingId(null); setFormData({ ...EMPTY_FORM }); setIsModalOpen(true); };
    const handleOpenEdit = (item: OpeningBalance) => {
        setEditingId(item._id);
        setFormData({
            sku: typeof item.sku === 'object' ? item.sku._id : item.sku,
            lotNumber: item.lotNumber || '',
            qty: item.qty || 0,
            uom: item.uom || 'pcs',
            cost: item.cost || 0,
            expirationDate: toDateInputValue(item.expirationDate)
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        confirmDeleteToast('Delete this opening balance?', async () => {
            try {
                const res = await fetch(`/api/opening-balances/${id}`, { method: 'DELETE' });
                if (res.ok) { toast.success('Deleted successfully'); globalCache.current = null; pageRef.current = 0; fetchPageRef.current(1, false); }
                else toast.error('Failed to delete');
            } catch { toast.error('Error deleting item'); }
        });
    };

    const handleLotSelect = async (lot: string) => {
        if (lotSelector.mode === 'form') {
            setFormData((p: any) => ({ ...p, lotNumber: lot }));
            setLotSelector(p => ({ ...p, isOpen: false }));
        } else if (lotSelector.mode === 'row' && lotSelector.itemId) {
            try {
                const toastId = toast.loading('Updating lot number...');
                const res = await fetch(`/api/opening-balances/${lotSelector.itemId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lotNumber: lot })
                });
                if (res.ok) { toast.success('Lot number updated', { id: toastId }); globalCache.current = null; pageRef.current = 0; fetchPageRef.current(1, false); }
                else toast.error('Failed to update', { id: toastId });
            } catch { toast.error('Error updating lot'); }
            setLotSelector(p => ({ ...p, isOpen: false }));
        }
    };

    const handleSort = (col: string) => {
        if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
        else { setSortBy(col); setSortOrder('asc'); }
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleExport = async () => {
        try {
            const toastId = toast.loading('Exporting Opening Balances...');
            const res = await fetch('/api/opening-balances?limit=0');
            const data = await res.json();
            if (data.openingBalances && Array.isArray(data.openingBalances)) {
                const csvRows = [];
                csvRows.push(['_id', 'sku', 'sku_name', 'lotNumber', 'qty', 'uom', 'cost', 'createdAt'].join(','));
                
                for (const ob of data.openingBalances) {
                    const skuId = typeof ob.sku === 'object' ? ob.sku._id : ob.sku;
                    const skuName = typeof ob.sku === 'object' ? ob.sku.name : ob.sku;
                    
                    csvRows.push([
                        ob._id || '',
                        skuId || '',
                        `"${(skuName || '').replace(/"/g, '""')}"`,
                        `"${(ob.lotNumber || '').replace(/"/g, '""')}"`,
                        ob.qty || 0,
                        ob.uom || '',
                        ob.cost || 0,
                        ob.createdAt || ''
                    ].join(','));
                }
                
                const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Opening_Balances_Export_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                toast.success('Export downloaded!', { id: toastId });
            } else {
                toast.error('Failed to load data for export', { id: toastId });
            }
        } catch (e: any) {
            toast.error('Export failed: ' + e.message);
        }
    };

    const getSkuName = (val: any) => (typeof val === 'object' && val?.name ? val.name : val || '-');
    const getSkuImage = (val: any) => (typeof val === 'object' && val?.image ? val.image : '');

    const COLS = [
        { key: 'img', label: 'Img', sortable: false, width: 'w-10' },
        { key: 'sku', label: 'SKU', sortable: true, width: 'w-[280px]' },
        { key: 'lotNumber', label: 'Lot Number', sortable: true, width: 'w-[130px]' },
        { key: 'qty', label: 'Qty', sortable: true, width: 'w-[80px]', align: 'text-right' },
        { key: 'uom', label: 'UOM', sortable: true, width: 'w-[80px]' },
        { key: 'cost', label: 'Cost ($)', sortable: true, width: 'w-[110px]', align: 'text-right' },
        { key: 'expirationDate', label: 'Expires', sortable: true, width: 'w-[110px]' },
        { key: 'createdAt', label: 'Created', sortable: true, width: 'w-[100px]' },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

            {/* ─── Local Page Header ───────────────────────────────────────── */}
            <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex flex-wrap items-center gap-3">

                {/* Title + count */}
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-black uppercase tracking-widest text-foreground">OPENING BALANCES</span>
                    <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">{total > 0 ? total.toLocaleString() : ''}</span>
                </div>

                <div className="h-5 w-px bg-border shrink-0" />

                {/* Search */}
                <div className="relative flex items-center shrink-0">
                    <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search SKU or lot..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 pr-8 h-8 w-60 bg-secondary border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex-1" />
                
                {/* Date Filter Dropdown */}
                <div className="relative shrink-0" ref={dateDropdownRef}>
                    <button
                        onClick={() => setIsDateDropdownOpen(p => !p)}
                        className={cn(
                            'flex items-center gap-1.5 px-3 h-8 rounded border text-[11px] font-semibold transition-all cursor-pointer bg-secondary border-border hover:bg-secondary/80',
                            (fromDate || toDate)
                                ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                                : 'text-foreground'
                        )}
                    >
                        <Calendar className="w-3 h-3" />
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

                {/* EXPORT button */}
                <button
                    onClick={e => { e.stopPropagation(); handleExport(); }}
                    className="h-8 px-3 bg-secondary text-foreground hover:bg-secondary/80 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-black uppercase tracking-widest">EXPORT</span>
                </button>

                {/* ADD button */}
                <button
                    onClick={e => { e.stopPropagation(); handleOpenAdd(); }}
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
                                            col.sortable && 'cursor-pointer hover:bg-secondary transition-colors',
                                        )}
                                    >
                                        <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                                            <span>{col.label}</span>
                                            {col.sortable && <ArrowUpDown className={cn('w-2.5 h-2.5', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} index={i} />)
                            ) : error ? (
                                <tr><td colSpan={8} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
                            ) : balances.length === 0 ? (
                                <tr><td colSpan={8} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No records found</td></tr>
                            ) : balances.map(item => (
                                <tr
                                    key={item._id}
                                    data-ob-id={item._id}
                                    className={cn(
                                        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
                                        highlightId === item._id && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
                                    )}
                                    onClick={() => {
                                        sessionStorage.setItem('ob_scroll_to', item._id);
                                        if (scrollRef.current) sessionStorage.setItem('ob_scroll_top', String(scrollRef.current.scrollTop));
                                        router.push(`/warehouse/opening-balances/${item._id}`);
                                    }}
                                >
                                    {/* Image */}
                                    <td className="px-2.5 py-2.5 w-10 border-r border-border/40">
                                        <div className="w-6 h-6 rounded-md bg-secondary overflow-hidden border border-border flex-shrink-0">
                                            <img
                                                src={getSkuImage(item.sku) || globalSettings?.missingSkuImage || '/sku-placeholder.png'}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={e => {
                                                    const t = e.target as HTMLImageElement;
                                                    const fb = globalSettings?.missingSkuImage || '/sku-placeholder.png';
                                                    if (!t.src.includes('sku-placeholder.png')) t.src = fb;
                                                }}
                                            />
                                        </div>
                                    </td>

                                    {/* SKU Name */}
                                    <td className="px-2.5 py-2.5 w-[280px] text-[12px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors border-r border-border/40">
                                        <div className="flex items-center">
                                            <span className="truncate" title={getSkuName(item.sku)}>{getSkuName(item.sku)}</span>
                                        </div>
                                    </td>

                                    {/* Lot Number */}
                                    <td className="px-2.5 py-2.5 w-[130px] border-r border-border/40">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-mono text-foreground/70 tracking-tight">{item.lotNumber}</span>
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    const skuId = typeof item.sku === 'object' ? item.sku._id : item.sku;
                                                    setLotSelector({ isOpen: true, mode: 'row', itemId: item._id, skuId, currentLot: item.lotNumber });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded-md text-muted-foreground hover:text-primary transition-all cursor-pointer"
                                                title="Change Lot Number"
                                            >
                                                <List className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </td>

                                    {/* Qty */}
                                    <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono font-bold text-foreground/80 text-right border-r border-border/40">
                                        {item.qty.toLocaleString()}
                                    </td>

                                    {/* UOM */}
                                    <td className="px-2.5 py-2.5 w-[80px] border-r border-border/40">
                                        <UomPill value={item.uom} />
                                    </td>

                                    {/* Cost */}
                                    <td className="px-2.5 py-2.5 w-[110px] text-[12px] font-mono text-right text-foreground/80 border-r border-border/40">
                                        ${(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                    </td>

                                    {/* Expires */}
                                    <td className="px-2.5 py-2.5 w-[110px] border-r border-border/40">
                                        <ExpiryBadge date={item.expirationDate} />
                                    </td>

                                    {/* Created At */}
                                    <td className="px-2.5 py-2.5 w-[100px] text-[11px] font-mono text-foreground/50">
                                        {formatDate(item.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Sentinel */}
                    <div ref={sentinelRef} className="h-2" />

                    {isLoadingMore && (
                        <div className="flex items-center justify-center gap-2 py-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    )}

                    {!hasMore && balances.length > 0 && !isLoading && (
                        <div className="text-center py-4 text-[11px] text-muted-foreground/40 uppercase tracking-widest">
                            — {balances.length.toLocaleString()} records loaded —
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Add/Edit Modal ──────────────────────────────────────────── */}
            {isModalOpen && (
                <OBModal
                    editingId={editingId}
                    formData={formData}
                    setFormData={setFormData}
                    allSkus={allSkus}
                    onClose={() => setIsModalOpen(false)}
                    onSaved={() => { pageRef.current = 0; fetchPageRef.current(1, false); }}
                    onOpenLotSelector={() => {
                        if (!formData.sku) { toast.error('Please select a SKU first'); return; }
                        setLotSelector({ isOpen: true, mode: 'form', skuId: formData.sku, currentLot: formData.lotNumber });
                    }}
                />
            )}

            {/* ─── Lot Selection Modal ─────────────────────────────────────── */}
            <LotSelectionModal
                isOpen={lotSelector.isOpen}
                onClose={() => setLotSelector(p => ({ ...p, isOpen: false }))}
                onSelect={handleLotSelect}
                skuId={lotSelector.skuId}
                currentLotNumber={lotSelector.currentLot}
                title={lotSelector.mode === 'row' ? 'Change Lot Number' : 'Select Reference Lot'}
            />
        </div>
    );
}

export default function OpeningBalancesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <OpeningBalancesContent />
        </Suspense>
    );
}
