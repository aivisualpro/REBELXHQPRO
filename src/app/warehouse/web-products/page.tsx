'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Loader2, ChevronRight, Link2, Unlink, CheckCircle2, AlertCircle,
  Layers, ChevronsDownUp, ChevronsUpDown, ExternalLink, Eye, EyeOff, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  totalWebOrders?: number;
  variations?: Variation[];
}

interface SkuOption { value: string; label: string; }
interface CacheEntry {
  products: WebProduct[]; hasMore: boolean; page: number; total: number;
  sortBy: string; sortOrder: string; search: string; website: string;
  hideZeroOrders: boolean; timestamp: number;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000; // 1 min (data changes more often — link/unlink ops)
const PAGE_SIZE = 50;

// ─── Website Badge ────────────────────────────────────────────────────────────

function WebsiteBadge({ website }: { website?: string }) {
  const styleMap: Record<string, { bg: string; color: string }> = {
    KING: { bg: 'linear-gradient(135deg,#d97706,#ea580c)', color: '#fff' },
    GRASS: { bg: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff' },
    GRHK: { bg: 'linear-gradient(135deg,#0891b2,#2563eb)', color: '#fff' },
    REBEL: { bg: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff' },
    GUD: { bg: 'linear-gradient(135deg,#e11d48,#db2777)', color: '#fff' },
  };
  const key = Object.keys(styleMap).find(k => website?.toUpperCase().includes(k));
  const s = key ? styleMap[key] : { bg: '#64748b', color: '#fff' };
  return (
    <span
      className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap"
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
  const [sortBy, setSortBy] = useState('totalWebOrders');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeWebsite, setActiveWebsite] = useState<string>('All');
  const [hideZeroOrders, setHideZeroOrders] = useState(false);

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
          globalCache.current = { products: list, hasMore: newHasMore, page: nextPage, total: newTotal, sortBy, sortOrder, search: debouncedSearch, website: activeWebsite, hideZeroOrders, timestamp: Date.now() };
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
  }, [sortBy, sortOrder, debouncedSearch, activeWebsite, hideZeroOrders]);

  // ─── Initial load / filter changes ─────────────────────────────────────

  const fetchProductsRef = useRef(fetchProducts);
  fetchProductsRef.current = fetchProducts;
  const isFirstMount = useRef(true);
  const prevFiltersRef = useRef({ sortBy, sortOrder, search: debouncedSearch, website: activeWebsite, hideZeroOrders });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    prevFiltersRef.current = { sortBy, sortOrder, search: debouncedSearch, website: activeWebsite, hideZeroOrders };

    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.products.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch &&
        cache.website === activeWebsite && cache.hideZeroOrders === hideZeroOrders) {
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
  }, [sortBy, sortOrder, debouncedSearch, activeWebsite, hideZeroOrders]);

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

  // ─── SKU linking ─────────────────────────────────────────────────────────

  const skuOptions: SkuOption[] = useMemo(() => skuList.map((s: any) => ({ value: s._id, label: s.name || s._id })), [skuList]);
  const getSkuName = useCallback((skuId: string) => skuList.find((s: any) => s._id === skuId)?.name || skuId, [skuList]);

  const handleLinkSku = async (productId: string, skuId: string, variationId?: string | number) => {
    const cellKey = productId + (variationId ? `-${variationId}` : '');
    setLinkingProductId(cellKey);
    const toastId = toast.loading(skuId ? 'Linking SKU & updating orders...' : 'Unlinking SKU...');

    setProducts(prev => prev.map(p => {
      if (p._id !== productId) return p;
      const updated = { ...p };
      if (variationId) {
        updated.variations = updated.variations?.map(v => {
          const vid = v.id || v._id;
          if (vid == variationId) return { ...v, linkedSkuId: skuId || null };
          return v;
        });
      } else {
        updated.linkedSkuId = skuId || null;
      }
      return updated;
    }));

    try {
      const res = await fetch(`/api/retail/web-products/${productId}/link-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuId, variationId })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(skuId ? `Linked! ${data.ordersUpdated || 0} orders updated` : `Unlinked! ${data.ordersUpdated || 0} orders cleared`, { id: toastId });
        globalCache.current = null;
      } else {
        toast.error(data.error || 'Failed', { id: toastId });
        globalCache.current = null; pageRef.current = 0; fetchProductsRef.current();
      }
    } catch {
      toast.error('Error linking SKU', { id: toastId });
      globalCache.current = null; pageRef.current = 0; fetchProductsRef.current();
    } finally {
      setLinkingProductId(null);
    }
  };

  const linkStats = useMemo(() => {
    const { totalLinkable, totalLinked } = globalLinkStats;
    return { totalLinkable, totalLinked, pct: totalLinkable > 0 ? Math.round((totalLinked / totalLinkable) * 100) : 0 };
  }, [globalLinkStats]);

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
      if (token.length >= 4) allPatterns.push(escaped.slice(0, -1));
      if (token.length >= 6) allPatterns.push(escaped.slice(0, -2));
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

  const renderSkuCell = (product: WebProduct, variation?: Variation) => {
    const currentLinkedSkuId = variation ? variation.linkedSkuId : product.linkedSkuId;
    const variationId = variation ? (variation.id || variation._id) : undefined;
    const cellKey = product._id + (variationId ? `-${variationId}` : '');
    const isLinking = linkingProductId === cellKey;

    if (isLinking) return (
      <div className="flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin text-primary" />
        <span className="text-[9px] text-primary font-bold uppercase tracking-wider">Linking...</span>
      </div>
    );

    if (currentLinkedSkuId) return (
      <div className="flex items-center gap-1.5 min-w-[180px]" onClick={e => e.stopPropagation()}>
        <span
          className="flex-1 truncate text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md cursor-pointer hover:bg-emerald-500/20 transition-colors"
          onClick={() => router.push(`/warehouse/skus/${currentLinkedSkuId}`)}
          title={`Go to SKU: ${currentLinkedSkuId}`}
        >
          {getSkuName(currentLinkedSkuId)}
        </span>
        <button
          onClick={e => { e.stopPropagation(); handleLinkSku(product._id, '', variationId); }}
          className="p-1 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-500 transition-colors shrink-0"
          title="Unlink SKU"
        >
          <Unlink className="w-3 h-3" />
        </button>
      </div>
    );

    return (
      <div className="flex items-center gap-1.5 min-w-[180px]" onClick={e => e.stopPropagation()}>
        <SearchableSelect
          options={skuOptions}
          value=""
          onChange={value => handleLinkSku(product._id, value, variationId)}
          placeholder="Link SKU..."
          className="w-full"
          triggerClassName="h-6 text-[10px] rounded-md border border-dashed transition-all bg-rose-500/5 border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
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
          className={cn('p-2 rounded-lg transition-colors cursor-pointer', hideZeroOrders ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60')}
          title={hideZeroOrders ? 'Showing products with orders only' : 'Show all products'}
        >
          {hideZeroOrders ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
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
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[220px]">
                  <span>Linked SKU</span>
                </th>
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))] w-[80px]"
                  onClick={() => handleSort('totalWebOrders', sortBy === 'totalWebOrders' && sortOrder === 'asc' ? 'desc' : 'asc')}>
                  <span>Orders</span>
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
                <tr><td colSpan={6} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No products found</td></tr>
              ) : products.map(product => {
                const isVariable = product.type === 'variable' && product.variations && product.variations.length > 0;
                const isExpanded = expandedRows.has(product._id);
                let linkedCount = 0; let totalCount = 0;
                if (isVariable) { totalCount = product.variations!.length; linkedCount = product.variations!.filter(v => v.linkedSkuId).length; }
                else { totalCount = 1; linkedCount = product.linkedSkuId ? 1 : 0; }
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
                      <td className="px-2.5 py-2.5 text-[12px] font-medium text-foreground/90 group-hover:text-foreground border-r border-border/40">
                        <div className="flex items-center gap-1.5">
                          {isVariable ? (
                            <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200', isExpanded && 'rotate-90 text-primary')} />
                          ) : <div className="w-3.5 shrink-0" />}
                          <div className="w-6 h-6 rounded-md bg-secondary overflow-hidden border border-border flex-shrink-0">
                            <img src={product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'} alt="" className="w-full h-full object-cover" />
                          </div>
                          <span className="truncate" title={product.name}>{highlightText(product.name)}</span>
                          {isVariable && (
                            <button onClick={e => { e.stopPropagation(); router.push(`/warehouse/web-products/${product._id}`); }}
                              className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors shrink-0 opacity-0 group-hover:opacity-100 cursor-pointer" title="Open detail">
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Website */}
                      <td className="px-2.5 py-2.5 border-r border-border/40">
                        <WebsiteBadge website={product.website} />
                      </td>

                      {/* Price */}
                      <td className="px-2.5 py-2.5 text-[12px] font-mono text-foreground/70 border-r border-border/40">
                        ${(product.salePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Linked SKU */}
                      <td className="px-2.5 py-2.5 border-r border-border/40">
                        {isVariable ? (
                          <div className="flex items-center gap-1.5">
                            {allLinked ? (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-wider">
                                <CheckCircle2 className="w-3 h-3" />All Linked
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                                <AlertCircle className="w-3 h-3" />{linkedCount}/{totalCount}
                              </span>
                            )}
                          </div>
                        ) : renderSkuCell(product)}
                      </td>

                      {/* Orders */}
                      <td className="px-2.5 py-2.5 text-[12px] font-black text-emerald-600 font-mono border-r border-border/40">
                        {product.totalWebOrders || 0}
                      </td>

                      {/* Web ID */}
                      <td className="px-2.5 py-2.5 text-[11px] text-muted-foreground/60 font-mono">
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
                          <td className="px-2.5 py-2 text-[11px] text-foreground/70 border-r border-border/40">
                            <div className="flex items-center gap-1.5 pl-5">
                              <div className="flex items-center shrink-0 mr-0.5">
                                <div className="w-3 border-b border-border/50 border-l border-l-border/50 h-2.5 rounded-bl-sm" />
                              </div>
                              <Layers className="w-3 h-3 text-blue-400 shrink-0" />
                              <div className="w-5 h-5 rounded bg-secondary overflow-hidden border border-border flex-shrink-0">
                                <img src={variation.image || product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'} alt="" className="w-full h-full object-cover" />
                              </div>
                              <span className="font-medium text-foreground/80 truncate">{highlightText(getVariationLabel(product, variation))}</span>
                            </div>
                          </td>
                          <td className="px-2.5 py-2 border-r border-border/40" />
                          <td className="px-2.5 py-2 text-[11px] text-foreground/60 font-mono border-r border-border/40">
                            ${((variation.salePrice || variation.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-2.5 py-2 border-r border-border/40">{renderSkuCell(product, variation)}</td>
                          <td className="px-2.5 py-2 text-[12px] font-black text-emerald-600 font-mono border-r border-border/40">{(variation as any).totalWebOrders || 0}</td>
                          <td className="px-2.5 py-2 text-[10px] text-muted-foreground/50 font-mono">{vid || '—'}</td>
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
