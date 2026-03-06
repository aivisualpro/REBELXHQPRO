'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2, ChevronRight, Link2, Unlink, CheckCircle2, AlertCircle,
  Layers, ChevronsDownUp, ChevronsUpDown, ExternalLink, Eye, EyeOff, Search,
  Plus, X, Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedSkuEntry {
  skuId: string;
  multiplier: number;
}

interface Variation {
  _id?: string;
  id?: number;
  name: string;
  image?: string;
  price?: number;
  regularPrice?: number;
  salePrice?: number;
  stockQuantity?: number;
  stockStatus?: string;
  linkedSkuId?: string | null;
  multiplier?: number;
  linkedSkus?: LinkedSkuEntry[];
  totalWebOrders?: number;
}

interface WebProduct {
  _id: string;
  name: string;
  image?: string;
  category: string;
  subCategory: string;
  materialType: string;
  uom: string;
  salePrice: number;
  website?: string;
  webId?: number;
  type?: string;
  status?: string;
  stockQuantity?: number;
  stockStatus?: string;
  linkedSkuId?: string | null;
  multiplier?: number;
  linkedSkus?: LinkedSkuEntry[];
  totalWebOrders?: number;
  variations?: Variation[];
}

interface SkuOption { value: string; label: string; }

// Normalize legacy single-link + new multi-link into a unified array
function getLinkedSkus(item: { linkedSkuId?: string | null; multiplier?: number; linkedSkus?: LinkedSkuEntry[] }): LinkedSkuEntry[] {
  if (item.linkedSkus && item.linkedSkus.length > 0) return item.linkedSkus;
  if (item.linkedSkuId) return [{ skuId: item.linkedSkuId, multiplier: item.multiplier || 1 }];
  return [];
}
interface CacheEntry {
  products: WebProduct[]; hasMore: boolean; page: number; total: number;
  sortBy: string; sortOrder: string; search: string; website: string;
  hideZeroOrders: boolean; showArchived: boolean; timestamp: number;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000; // 1 min (data changes more often — link/unlink ops)
const PAGE_SIZE = 50;

// ─── Website Badge ────────────────────────────────────────────────────────────

function WebsiteBadge({ website }: { website?: string }) {
  const styleMap: Record<string, { bg: string; color: string }> = {
    KING: { bg: '#d97706', color: '#fff' },
    GRASS: { bg: '#16a34a', color: '#fff' },
    GRHK: { bg: '#0891b2', color: '#fff' },
    REBEL: { bg: '#7c3aed', color: '#fff' },
    GUD: { bg: '#e11d48', color: '#fff' },
  };
  const key = Object.keys(styleMap).find(k => website?.toUpperCase().includes(k));
  const s = key ? styleMap[key] : { bg: '#64748b', color: '#fff' };
  return (
    <span
      className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {website || 'N/A'}
    </span>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = React.memo(function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/60" style={{ opacity: 1 - index * 0.04 }}>
      {[40, 15, 12, 22, 10, 10].map((w, i) => (
        <td key={i} className="px-2.5 py-2.5">
          <div className="h-3 rounded bg-muted-foreground/10 animate-pulse" style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
});

// ─── Main Content ─────────────────────────────────────────────────────────────

function WebProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<WebProduct[]>(globalCache.current?.products || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [total, setTotal] = useState(globalCache.current?.total || 0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'totalWebOrders');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc');
  const [activeWebsite, setActiveWebsite] = useState<string>(searchParams.get('website') || 'All');
  const [hideZeroOrders, setHideZeroOrders] = useState(searchParams.get('hideZero') === 'true');
  const [showArchived, setShowArchived] = useState(searchParams.get('archived') === 'true');

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [skuList, setSkuList] = useState<any[]>([]);
  const [linkingProductId, setLinkingProductId] = useState<string | null>(null);
  const [activeDropdownRow, setActiveDropdownRow] = useState<string | null>(null);
  const [globalLinkStats, setGlobalLinkStats] = useState<{ totalLinkable: number; totalLinked: number }>({ totalLinkable: 0, totalLinked: 0 });
  const [globalSettings, setGlobalSettings] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState({ isSyncing: false, currentStep: '', progress: 0, total: 0 });

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef(0);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ─── Debounce search ────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); }, 250);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Sync ALL filters to URL ───────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (activeWebsite !== 'All') params.set('website', activeWebsite);
    if (sortBy !== 'totalWebOrders') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    if (hideZeroOrders) params.set('hideZero', 'true');
    if (showArchived) params.set('archived', 'true');
    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedSearch, activeWebsite, sortBy, sortOrder, hideZeroOrders, showArchived, router]);

  // ─── Sync URL back to state (browser back/forward) ─────────────────────

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlWebsite = searchParams.get('website') || 'All';
    const urlSortBy = searchParams.get('sortBy') || 'totalWebOrders';
    const urlSortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    const urlHideZero = searchParams.get('hideZero') === 'true';
    const urlArchived = searchParams.get('archived') === 'true';
    if (urlSearch !== debouncedSearch) { setSearch(urlSearch); setDebouncedSearch(urlSearch); }
    if (urlWebsite !== activeWebsite) setActiveWebsite(urlWebsite);
    if (urlSortBy !== sortBy) setSortBy(urlSortBy);
    if (urlSortOrder !== sortOrder) setSortOrder(urlSortOrder);
    if (urlHideZero !== hideZeroOrders) setHideZeroOrders(urlHideZero);
    if (urlArchived !== showArchived) setShowArchived(urlArchived);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ─── Side data fetches ───────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(setGlobalSettings).catch(() => { });
  }, []);

  useEffect(() => {
    fetch('/api/skus?limit=0&ignoreDate=true&simple=true&category=Finished Goods')
      .then(r => r.json()).then(d => setSkuList(d.skus || [])).catch(() => { });
  }, []);

  const fetchProducts = useCallback(async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++reqSeqRef.current;

    fetchingRef.current = true;
    setIsLoadingMore(pageRef.current > 0);
    if (pageRef.current === 0) setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(pageRef.current + 1),
        limit: String(PAGE_SIZE),
        search: debouncedSearch,
        sortBy, sortOrder,
      });
      if (activeWebsite !== 'All') params.set('website', activeWebsite);
      if (hideZeroOrders) params.set('hideZeroOrders', 'true');
      if (showArchived) params.set('showArchived', 'true');

      const res = await fetch(`/api/retail/web-products?${params}`, { signal: controller.signal });
      const data = await res.json();

      if (seq !== reqSeqRef.current || !mountedRef.current) return;

      if (res.ok) {
        const newProducts: WebProduct[] = data.webProducts || [];
        const newTotal = data.total || 0;
        const newHasMore = data.hasMore ?? (newProducts.length === PAGE_SIZE);
        if (data.linkStats) setGlobalLinkStats(data.linkStats);

        const nextPage = pageRef.current + 1;
        setProducts(prev => {
          const isAppend = pageRef.current > 0;
          const list = isAppend ? (() => { const ids = new Set(prev.map(p => p._id)); return [...prev, ...newProducts.filter(p => !ids.has(p._id))]; })() : newProducts;
          globalCache.current = { products: list, hasMore: newHasMore, page: nextPage, total: newTotal, sortBy, sortOrder, search: debouncedSearch, website: activeWebsite, hideZeroOrders, showArchived, timestamp: Date.now() };
          return list;
        });
        setTotal(newTotal);
        setHasMore(newHasMore);
        pageRef.current = nextPage;
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
  }, [sortBy, sortOrder, debouncedSearch, activeWebsite, hideZeroOrders, showArchived]);

  // ─── Initial load / filter changes ─────────────────────────────────────

  const fetchProductsRef = useRef(fetchProducts);
  fetchProductsRef.current = fetchProducts;
  const isFirstMount = useRef(true);
  const prevFiltersRef = useRef({ sortBy, sortOrder, search: debouncedSearch, website: activeWebsite, hideZeroOrders, showArchived });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    prevFiltersRef.current = { sortBy, sortOrder, search: debouncedSearch, website: activeWebsite, hideZeroOrders, showArchived };

    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.products.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch &&
        cache.website === activeWebsite && cache.hideZeroOrders === hideZeroOrders && cache.showArchived === showArchived) {
        setProducts(cache.products); setHasMore(cache.hasMore); setTotal(cache.total); pageRef.current = cache.page; setIsLoading(false);
        return;
      }
    }

    globalCache.current = null;
    pageRef.current = 0;
    setProducts([]);
    setHasMore(true);
    fetchProductsRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, debouncedSearch, activeWebsite, hideZeroOrders, showArchived]);

  // ─── Infinite scroll sentinel ────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchProductsRef.current(); },
      { root: container, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // ─── Sync status polling ─────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/retail/web-products/sync').then(r => r.json()).then(data => {
      if (data.isSyncing) {
        setSyncStatus(data);
        const interval = setInterval(async () => {
          const res = await fetch('/api/retail/web-products/sync');
          const d = await res.json();
          setSyncStatus(d);
          if (!d.isSyncing && (d.currentStep === 'Complete' || d.currentStep === 'Failed')) {
            clearInterval(interval);
            if (d.currentStep === 'Complete') { globalCache.current = null; pageRef.current = 0; fetchProductsRef.current(); }
          }
        }, 1000);
      }
    }).catch(() => { });
  }, []);

  // ─── SKU linking (Multi-SKU) ──────────────────────────────────────────────

  const skuOptions: SkuOption[] = useMemo(() => skuList.map((s: any) => ({ value: s._id, label: s.name || s._id })), [skuList]);
  const getSkuName = useCallback((skuId: string) => skuList.find((s: any) => s._id === skuId)?.name || skuId, [skuList]);

  const linkStats = useMemo(() => {
    const { totalLinkable, totalLinked } = globalLinkStats;
    return { totalLinkable, totalLinked, pct: totalLinkable > 0 ? Math.round((totalLinked / totalLinkable) * 100) : 0 };
  }, [globalLinkStats]);

  // Add a new SKU to the linked list
  const handleAddLinkedSku = async (productId: string, skuId: string, variationId?: string | number) => {
    if (!skuId) return;
    const cellKey = productId + (variationId ? `-${variationId}` : '');
    setLinkingProductId(cellKey);
    const toastId = toast.loading('Linking SKU & updating orders...');

    // Optimistic update
    setProducts(prev => prev.map(p => {
      if (p._id !== productId) return p;
      const updated = { ...p };
      if (variationId) {
        updated.variations = updated.variations?.map(v => {
          const vid = v.id || v._id;
          if (vid == variationId) {
            const existing = getLinkedSkus(v);
            if (existing.some(e => e.skuId === skuId)) return v;
            return { ...v, linkedSkus: [...existing, { skuId, multiplier: 1 }] };
          }
          return v;
        });
      } else {
        const existing = getLinkedSkus(p);
        if (!existing.some(e => e.skuId === skuId)) {
          updated.linkedSkus = [...existing, { skuId, multiplier: 1 }];
        }
      }
      return updated;
    }));

    try {
      const res = await fetch(`/api/retail/web-products/${productId}/link-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', skuId, variationId, multiplier: 1 })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Linked! ${data.ordersUpdated || 0} orders updated`, { id: toastId });
        globalCache.current = null;
      } else {
        toast.error(data.error || 'Failed', { id: toastId });
        globalCache.current = null; pageRef.current = 0; setProducts([]); setHasMore(true); fetchProductsRef.current();
      }
    } catch {
      toast.error('Error linking SKU', { id: toastId });
      globalCache.current = null; pageRef.current = 0; setProducts([]); setHasMore(true); fetchProductsRef.current();
    } finally {
      setLinkingProductId(null);
    }
  };

  // Remove a SKU from the linked list
  const handleRemoveLinkedSku = async (productId: string, skuId: string, variationId?: string | number) => {
    const cellKey = productId + (variationId ? `-${variationId}` : '');
    setLinkingProductId(cellKey);
    const toastId = toast.loading('Unlinking SKU...');

    // Optimistic update
    setProducts(prev => prev.map(p => {
      if (p._id !== productId) return p;
      const updated = { ...p };
      if (variationId) {
        updated.variations = updated.variations?.map(v => {
          const vid = v.id || v._id;
          if (vid == variationId) {
            const existing = getLinkedSkus(v);
            return { ...v, linkedSkus: existing.filter(e => e.skuId !== skuId), linkedSkuId: null };
          }
          return v;
        });
      } else {
        const existing = getLinkedSkus(p);
        updated.linkedSkus = existing.filter(e => e.skuId !== skuId);
        updated.linkedSkuId = null;
      }
      return updated;
    }));

    try {
      const res = await fetch(`/api/retail/web-products/${productId}/link-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', skuId, variationId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Unlinked! ${data.ordersUpdated || 0} orders cleared`, { id: toastId });
        globalCache.current = null;
      } else {
        toast.error(data.error || 'Failed', { id: toastId });
        globalCache.current = null; pageRef.current = 0; setProducts([]); setHasMore(true); fetchProductsRef.current();
      }
    } catch {
      toast.error('Error unlinking SKU', { id: toastId });
      globalCache.current = null; pageRef.current = 0; setProducts([]); setHasMore(true); fetchProductsRef.current();
    } finally {
      setLinkingProductId(null);
    }
  };

  // Update multiplier for a specific linked SKU
  const handleUpdateLinkedSkuMultiplier = async (productId: string, skuId: string, multiplier: number, variationId?: string | number) => {
    const m = Math.max(1, multiplier);

    // Optimistic update
    setProducts(prev => prev.map(p => {
      if (p._id !== productId) return p;
      const updated = { ...p };
      if (variationId) {
        updated.variations = updated.variations?.map(v => {
          const vid = v.id || v._id;
          if (vid == variationId) {
            const existing = getLinkedSkus(v);
            return { ...v, linkedSkus: existing.map(e => e.skuId === skuId ? { ...e, multiplier: m } : e) };
          }
          return v;
        });
      } else {
        const existing = getLinkedSkus(p);
        updated.linkedSkus = existing.map(e => e.skuId === skuId ? { ...e, multiplier: m } : e);
      }
      return updated;
    }));

    try {
      const res = await fetch(`/api/retail/web-products/${productId}/link-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateMultiplier', skuId, variationId, multiplier: m })
      });
      if (!res.ok) toast.error('Failed to update multiplier');
      globalCache.current = null;
    } catch { toast.error('Failed to update multiplier'); }
  };

  // ─── Archive Toggle ──────────────────────────────────────────────────────

  const handleToggleArchive = async (productId: string, currentArchived: boolean) => {
    const toastId = toast.loading(currentArchived ? 'Unarchiving...' : 'Archiving...');
    setProducts(prev => prev.filter(p => {
      if (p._id === productId && (!showArchived && !currentArchived)) return false;
      return true;
    }).map(p => {
      if (p._id === productId) return { ...p, isArchived: !currentArchived } as any;
      return p;
    }));

    try {
      const res = await fetch(`/api/retail/web-products/${productId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !currentArchived })
      });
      if (res.ok) {
        toast.success(currentArchived ? 'Restored' : 'Archived', { id: toastId });
        globalCache.current = null;
      } else {
        toast.error('Failed', { id: toastId });
        fetchProductsRef.current();
      }
    } catch {
      toast.error('Failed', { id: toastId });
      fetchProductsRef.current();
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getVariationLabel = (product: WebProduct, variation: Variation) => {
    const escaped = product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return variation.name.replace(new RegExp(`^${escaped}\\s*-\\s*`, 'i'), '');
  };

  const highlightText = useCallback((text: string): React.ReactNode => {
    const tokens = debouncedSearch.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length || !text) return text;
    const allPatterns: string[] = [];
    tokens.forEach(token => {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      allPatterns.push(escaped);
      if (token.length >= 4) allPatterns.push(token.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      if (token.length >= 6) allPatterns.push(token.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    });
    allPatterns.sort((a, b) => b.length - a.length);
    const uniquePatterns = [...new Set(allPatterns)].filter(p => p.length > 0);
    if (!uniquePatterns.length) return text;
    try {
      const regex = new RegExp(`(${uniquePatterns.join('|')})`, 'gi');
      const parts = text.split(regex);
      if (parts.length <= 1) return text;
      const testRegex = new RegExp(`^(?:${uniquePatterns.join('|')})$`, 'i');
      return <>{parts.map((part, i) => !part ? null : testRegex.test(part) ? <span key={i} className="bg-primary/20 text-primary font-bold rounded-sm px-0.5">{part}</span> : <span key={i}>{part}</span>)}</>;
    } catch { return text; }
  }, [debouncedSearch]);

  // ─── Multi-SKU Cell Renderer ──────────────────────────────────────────────

  const renderSkuCell = (product: WebProduct, variation?: Variation) => {
    const item = variation || product;
    const linked = getLinkedSkus(item);
    const variationId = variation ? (variation.id || variation._id) : undefined;
    const cellKey = product._id + (variationId ? `-${variationId}` : '');
    const isLinking = linkingProductId === cellKey;

    if (isLinking) return (
      <div className="flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" />
        <span className="text-xs text-primary font-bold uppercase tracking-wider">Linking...</span>
      </div>
    );

    // Filter out already-linked SKUs from the dropdown options
    const linkedIds = new Set(linked.map(l => l.skuId));
    const availableOptions = skuOptions.filter(o => !linkedIds.has(o.value));

    return (
      <div className="flex flex-col gap-1.5 min-w-[200px]" onClick={e => e.stopPropagation()}>
        {/* Render each linked SKU as a compact row */}
        {linked.map((entry) => (
          <div key={entry.skuId} className="flex items-center gap-1.5 group/sku">
            {/* Multiplier input */}
            <input
              type="number"
              min="1"
              step="1"
              value={entry.multiplier}
              onChange={e => handleUpdateLinkedSkuMultiplier(product._id, entry.skuId, parseInt(e.target.value) || 1, variationId)}
              className="w-10 h-6 px-1 border border-border/60 bg-background text-[10px] font-bold font-mono rounded text-center focus:border-primary/50 focus:outline-none transition-colors shrink-0"
              title="Multiplier"
            />
            <span className="text-[10px] text-muted-foreground/50 shrink-0">×</span>
            {/* SKU name pill */}
            <span
              className="flex-1 truncate text-[11px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-1 rounded cursor-pointer hover:bg-emerald-500/20 transition-colors"
              onClick={() => router.push(`/warehouse/skus/${entry.skuId}`)}
              title={getSkuName(entry.skuId)}
            >
              {getSkuName(entry.skuId)}
            </span>
            {/* Remove button */}
            <button
              onClick={() => handleRemoveLinkedSku(product._id, entry.skuId, variationId)}
              className="p-0.5 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-600 transition-colors shrink-0 opacity-0 group-hover/sku:opacity-100"
              title="Remove SKU"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {/* Add SKU dropdown */}
        <SearchableSelect
          options={availableOptions}
          value=""
          onChange={value => handleAddLinkedSku(product._id, value, variationId)}
          placeholder={linked.length > 0 ? '+ Add SKU...' : 'Link SKU...'}
          className="w-full"
          triggerClassName={cn(
            'h-7 text-[11px] font-bold rounded border border-dashed transition-all',
            linked.length > 0
              ? 'bg-secondary/30 border-border/40 text-muted-foreground hover:bg-secondary/50'
              : 'bg-rose-500/5 border-rose-500/20 text-rose-500 hover:bg-rose-500/10'
          )}
          onOpenChange={open => setActiveDropdownRow(open ? cellKey : null)}
        />
      </div>
    );
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const expandAll = () => setExpandedRows(new Set(products.filter(p => p.type === 'variable' && p.variations?.length).map(p => p._id)));
  const collapseAll = () => setExpandedRows(new Set());

  const handleSort = (col: string, dir: 'asc' | 'desc') => { setSortBy(col); setSortOrder(dir); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ─── Website Tabs ─────────────────────────────────────────────────────────

  const WEBSITE_TABS = ['All', 'KINGKKRATOM', 'GRASSROOTSHARVEST', 'GRHKTATOM', 'REBELXBRANDS', 'GUDTONICS'] as const;
  const WEBSITE_COLORS: Record<string, { bg: string; color: string; hoverBg: string }> = {
    'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
    'KINGKKRATOM': { bg: '#d97706', color: '#ffffff', hoverBg: 'rgba(217,119,6,0.08)' },
    'GRASSROOTSHARVEST': { bg: '#16a34a', color: '#ffffff', hoverBg: 'rgba(22,163,74,0.08)' },
    'GRHKTATOM': { bg: '#0891b2', color: '#ffffff', hoverBg: 'rgba(8,145,178,0.08)' },
    'REBELXBRANDS': { bg: '#7c3aed', color: '#ffffff', hoverBg: 'rgba(124,58,237,0.08)' },
    'GUDTONICS': { bg: '#e11d48', color: '#ffffff', hoverBg: 'rgba(225,29,72,0.08)' },
  };

  const COLS = ['Name', 'Website', 'Price', 'Linked SKU', 'Orders', 'Web ID'];

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

      {/* ─── Sync Progress Bar ────────────────────────────────────────── */}
      {syncStatus.isSyncing && (
        <div className="bg-primary px-4 h-10 flex items-center justify-between text-black animate-in slide-in-from-top duration-300 shadow-md relative z-[60] shrink-0">
          <div className="flex items-center gap-3 flex-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">{syncStatus.currentStep}</span>
            {syncStatus.total > 0 && (
              <div className="flex-1 max-w-sm bg-black/10 h-1.5 rounded-full overflow-hidden mx-6">
                <div className="bg-black h-full transition-all duration-500" style={{ width: `${(syncStatus.progress / syncStatus.total) * 100}%` }} />
              </div>
            )}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest ml-4">
            {syncStatus.total > 0 ? `${Math.round((syncStatus.progress / syncStatus.total) * 100)}% (${syncStatus.progress}/${syncStatus.total})` : 'Initializing...'}
          </div>
        </div>
      )}

      {/* ─── Local Page Header ──────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex items-center gap-3 overflow-x-auto">

        {/* Title + count */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">WEB PRODUCTS</span>
          <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">{total > 0 ? total.toLocaleString() : ''}</span>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Website Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          {WEBSITE_TABS.map(tab => {
            const sc = WEBSITE_COLORS[tab];
            const isActive = activeWebsite === tab;
            return (
              <button key={tab} onClick={() => { setActiveWebsite(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                style={isActive ? { backgroundColor: sc.bg, color: sc.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { color: 'inherit', backgroundColor: 'transparent' }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >{tab === 'All' ? 'All' : tab.replace('KRATOM', '').replace('HARVEST', '').replace('BRANDS', '').replace('TONICS', '')}</button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Link progress */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', linkStats.pct === 100 ? 'bg-emerald-500' : linkStats.pct > 50 ? 'bg-amber-500' : 'bg-rose-500')}
              style={{ width: `${linkStats.pct}%` }}
            />
          </div>
          <span className={cn('text-[10px] font-black uppercase tracking-wider', linkStats.pct === 100 ? 'text-emerald-500' : linkStats.pct > 50 ? 'text-amber-500' : 'text-rose-500')}>
            {linkStats.totalLinked}/{linkStats.totalLinkable}
          </span>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Search */}
        <div className="relative flex items-center shrink-0">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 h-8 w-52 bg-secondary/60 border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
          />
        </div>

        <div className="flex-1" />

        {/* Hide zero orders toggle */}
        <button
          onClick={() => { setHideZeroOrders(p => !p); }}
          className={cn('p-2 rounded-lg transition-colors cursor-pointer shrink-0', hideZeroOrders ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60')}
          title={hideZeroOrders ? 'Showing products with orders only' : 'Show all products'}
        >
          {hideZeroOrders ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Show Archived filter */}
        <button
          onClick={() => { setShowArchived(p => !p); }}
          className={cn('h-8 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 text-[11px] font-bold uppercase tracking-widest', showArchived ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60')}
          title={showArchived ? 'Viewing Archived Products' : 'Show Archived Products'}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Archived</span>
        </button>

        {/* Expand / Collapse All */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={expandAll} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-colors cursor-pointer" title="Expand All">
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </button>
          <button onClick={collapseAll} className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-colors cursor-pointer" title="Collapse All">
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Table ─────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
            <thead className="bg-background border-b border-border sticky top-0 z-10">
              <tr>
                {/* Name */}
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[320px]"
                  onClick={() => handleSort('name', sortBy === 'name' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                  <div className="flex items-center gap-1"><span>Name</span></div>
                </th>
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[120px]"
                  onClick={() => handleSort('website', sortBy === 'website' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                  <span>Website</span>
                </th>
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[90px]"
                  onClick={() => handleSort('salePrice', sortBy === 'salePrice' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                  <span>Price</span>
                </th>
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[280px]">
                  <span>Linked SKUs</span>
                </th>
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[80px]"
                  onClick={() => handleSort('totalWebOrders', sortBy === 'totalWebOrders' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                  <span>Orders</span>
                </th>
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[80px] text-center">
                  <span>Archive</span>
                </th>
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[80px]"
                  onClick={() => handleSort('webId', sortBy === 'webId' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                  <span>Web ID</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No products found</td></tr>
              ) : products.map(product => {
                const isVariable = product.type === 'variable' && product.variations && product.variations.length > 0;
                const isExpanded = expandedRows.has(product._id);
                let linkedCount = 0; let totalCount = 0;
                if (isVariable) { totalCount = product.variations!.length; linkedCount = product.variations!.filter(v => getLinkedSkus(v).length > 0).length; }
                else { totalCount = 1; linkedCount = getLinkedSkus(product).length > 0 ? 1 : 0; }
                const allLinked = linkedCount === totalCount;
                const someLinked = linkedCount > 0 && linkedCount < totalCount;

                return (
                  <React.Fragment key={product._id}>
                    {/* Parent Row */}
                    <tr
                      className={cn(
                        'group transition-colors duration-150 cursor-pointer border-b border-border/60',
                        isExpanded ? 'bg-secondary/10' : 'hover:bg-muted/30 dark:hover:bg-muted/10',
                        allLinked && 'border-l-2 border-l-emerald-500',
                        someLinked && !allLinked && 'border-l-2 border-l-amber-500',
                        !someLinked && !allLinked && 'border-l-2 border-l-rose-500/30',
                        activeDropdownRow === product._id && '!bg-primary/5 ring-1 ring-inset ring-primary/20',
                      )}
                      onClick={() => { isVariable ? toggleExpand(product._id) : router.push(`/warehouse/web-products/${product._id}`); }}
                    >
                      {/* Name */}
                      <td className="px-2.5 py-2.5 text-sm font-semibold text-foreground/90 group-hover:text-foreground border-r border-border/40">
                        <div className="flex items-center gap-2">
                          {isVariable ? (
                            <ChevronRight className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', isExpanded && 'rotate-90 text-primary')} />
                          ) : <div className="w-4 shrink-0" />}
                          <div className="w-7 h-7 rounded-md bg-secondary overflow-hidden border border-border flex-shrink-0">
                            <img src={product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="truncate" title={product.name}>{highlightText(product.name)}</span>
                          {isVariable && (
                            <button onClick={e => { e.stopPropagation(); router.push(`/warehouse/web-products/${product._id}`); }}
                              className="p-1.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer" title="Open detail">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Website */}
                      <td className="px-2.5 py-3 border-r border-border/40">
                        <WebsiteBadge website={product.website} />
                      </td>

                      {/* Price */}
                      <td className="px-2.5 py-3 text-sm font-black font-mono text-foreground/80 border-r border-border/40">
                        ${(product.salePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Linked SKUs (with inline multipliers) */}
                      <td className="px-2.5 py-2 border-r border-border/40 align-top">
                        {isVariable ? (
                          <div className="flex items-center gap-2">
                            {allLinked ? (
                              <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 tracking-wider rounded">
                                <CheckCircle2 className="w-3.5 h-3.5" />All Linked
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-600 uppercase tracking-widest bg-amber-500/10 px-2 py-1 tracking-wider rounded">
                                <AlertCircle className="w-3.5 h-3.5" />{linkedCount}/{totalCount}
                              </span>
                            )}
                          </div>
                        ) : renderSkuCell(product)}
                      </td>

                      {/* Orders (clickable → navigate to web-orders) */}
                      <td className="px-2.5 py-3 border-r border-border/40" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => router.push(`/sales/web-orders?productId=${product.webId}&website=${product.website || ''}`)}
                          className="text-sm font-black text-emerald-600 font-mono hover:underline hover:text-emerald-500 cursor-pointer transition-colors"
                          title="View orders for this product"
                        >
                          {product.totalWebOrders || 0}
                        </button>
                      </td>

                      {/* Archive */}
                      <td className="px-2.5 py-3 border-r border-border/40 text-center" onClick={e => e.stopPropagation()}>
                        <label className="relative inline-flex items-center cursor-pointer disabled:opacity-50">
                          <input type="checkbox" className="sr-only peer" checked={(product as any).isArchived || false} onChange={() => handleToggleArchive(product._id, (product as any).isArchived || false)} />
                          <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-400 after:border after:rounded-full after:h-4 after:w-4 after:transition-all after:shadow-md peer-checked:bg-rose-500 shadow-inner border border-gray-400 dark:border-gray-500"></div>
                        </label>
                      </td>

                      {/* Web ID */}
                      <td className="px-2.5 py-3 text-xs text-foreground/70 font-mono font-semibold">
                        {product.webId || '—'}
                      </td>
                    </tr>

                    {/* Variation Sub-Rows */}
                    {isVariable && isExpanded && product.variations!.map((variation, vIdx) => {
                      const vid = variation.id || variation._id;
                      const vLinked = !!variation.linkedSkuId;
                      return (
                        <tr
                          key={`${product._id}-v-${vid || vIdx}`}
                          className={cn(
                            'group bg-secondary/5 border-b border-border/40 transition-colors duration-150 animate-in fade-in slide-in-from-top-1 duration-200',
                            'hover:bg-secondary/20',
                            vLinked ? 'border-l-2 border-l-emerald-500/50' : 'border-l-2 border-l-rose-500/20',
                            activeDropdownRow === `${product._id}-${vid}` && '!bg-primary/5 ring-1 ring-inset ring-primary/20'
                          )}
                          style={{ animationDelay: `${vIdx * 25}ms` }}
                        >
                          {/* Variation Name */}
                          <td className="px-2.5 py-2.5 text-xs font-medium text-foreground/80 border-r border-border/40">
                            <div className="flex items-center gap-2 pl-6">
                              <div className="flex items-center shrink-0 mr-1">
                                <div className="w-4 border-b border-border/50 border-l border-l-border/50 h-3 rounded-bl-sm" />
                              </div>
                              <Layers className="w-4 h-4 text-blue-500 shrink-0" />
                              <div className="w-6 h-6 rounded bg-secondary overflow-hidden border border-border flex-shrink-0">
                                <img src={variation.image || product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="font-semibold text-foreground/90 truncate">{highlightText(getVariationLabel(product, variation))}</span>
                            </div>
                          </td>
                          <td className="px-2.5 py-2.5 border-r border-border/40" />
                          <td className="px-2.5 py-2.5 text-xs text-foreground/80 font-mono font-bold border-r border-border/40">
                            ${((variation.salePrice || variation.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2.5 py-2 border-r border-border/40 align-top">{renderSkuCell(product, variation)}</td>
                          <td className="px-2.5 py-2.5 border-r border-border/40" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => router.push(`/sales/web-orders?productId=${product.webId}&variationId=${vid}&website=${product.website || ''}`)}
                              className="text-sm font-black text-emerald-600 font-mono hover:underline hover:text-emerald-500 cursor-pointer transition-colors"
                              title="View orders for this variation"
                            >
                              {(variation as any).totalWebOrders || 0}
                            </button>
                          </td>
                          <td className="px-2.5 py-2.5 border-r border-border/40" />
                          <td className="px-2.5 py-2.5 text-xs text-foreground/60 font-mono font-semibold">{vid || '—'}</td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
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

          {!hasMore && products.length > 0 && !isLoading && (
            <div className="text-center py-4 text-[11px] text-muted-foreground/40 uppercase tracking-widest">
              — {products.length.toLocaleString()} products loaded —
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WebProductsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <WebProductsContent />
    </Suspense>
  );
}
