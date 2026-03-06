'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Plus, Search, Building2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Vendor {
  _id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  website?: string;
  paymentTerms?: string;
  carrierPreference?: string;
  status?: string;
  createdAt: string;
}

interface CacheEntry {
  vendors: Vendor[];
  hasMore: boolean;
  page: number;
  total: number;
  sortBy: string;
  sortOrder: string;
  search: string;
  status: string;
  timestamp: number;
}

// ─── Module-level cache (survives route changes) ──────────────────────────────

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Status Badge ─────────────────────────────────────────────────────────────

function VendorStatusBadge({ status }: { status?: string }) {
  const s = status || 'Active';
  const styleMap: Record<string, { bg: string; color: string; border?: string }> = {
    'Active': { bg: '#16a34a', color: '#ffffff' },
    'Inactive': { bg: '#dc2626', color: '#ffffff' },
    'Pending': { bg: '#e2e8f0', color: '#000000', border: '1px solid #cbd5e1' },
  };
  const style = styleMap[s] || { bg: '#64748b', color: '#ffffff' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider vendor-status-badge"
      data-status={s}
      style={{ backgroundColor: style.bg, color: style.color, border: style.border, borderRadius: '4px' }}
    >
      {s}
    </span>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'name', label: 'Company', width: 'w-[200px]' },
  { key: 'contactName', label: 'Contact', width: 'w-[130px]' },
  { key: 'phone', label: 'Phone', width: 'w-[130px]' },
  { key: 'email', label: 'Email', width: 'w-[200px]' },
  { key: 'address', label: 'Address', width: 'w-[170px]' },
  { key: 'city', label: 'City', width: 'w-[100px]' },
  { key: 'paymentTerms', label: 'Pay Terms', width: 'w-[100px]' },
  { key: 'status', label: 'Status', width: 'w-[80px]' },
  { key: 'createdAt', label: 'Created', width: 'w-[100px]' },
];

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = React.memo(function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/60" style={{ opacity: 1 - index * 0.035 }}>
      {COLUMNS.map(col => (
        <td key={col.key} className="px-2.5 py-2.5">
          <div className="h-3 rounded bg-muted-foreground/10 animate-pulse" style={{ width: col.key === 'name' ? '80%' : col.key === 'email' ? '70%' : '60%' }} />
        </td>
      ))}
    </tr>
  );
});

// ─── Table Row ────────────────────────────────────────────────────────────────

const VendorRow = React.memo(function VendorRow({
  vendor, onClick, highlight
}: { vendor: Vendor; onClick: () => void; highlight?: boolean }) {
  return (
    <tr
      data-vendor-id={vendor._id}
      className={cn(
        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
        highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
      )}
      onClick={onClick}
    >
      <td className="px-2.5 py-2.5 w-[200px] text-[12px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3 h-3 text-muted-foreground/40 shrink-0" />
          <span className="truncate">{vendor.name}</span>
        </div>
      </td>
      <td className="px-2.5 py-2.5 w-[130px] text-[12px] text-foreground/70 truncate">{vendor.contactName || '—'}</td>
      <td className="px-2.5 py-2.5 w-[130px] text-[12px] font-mono text-foreground/70">{vendor.phone || '—'}</td>
      <td className="px-2.5 py-2.5 w-[200px] text-[12px] text-foreground/70 truncate">{vendor.email || '—'}</td>
      <td className="px-2.5 py-2.5 w-[170px] text-[12px] text-foreground/60 truncate">{vendor.address || '—'}</td>
      <td className="px-2.5 py-2.5 w-[100px] text-[12px] text-foreground/60">{vendor.city || '—'}</td>
      <td className="px-2.5 py-2.5 w-[100px] text-[12px] text-foreground/70 uppercase font-medium">{vendor.paymentTerms || '—'}</td>
      <td className="px-2.5 py-2.5 w-[80px]"><VendorStatusBadge status={vendor.status} /></td>
      <td className="px-2.5 py-2.5 w-[100px] text-[12px] font-mono text-foreground/60">{formatDate(vendor.createdAt)}</td>
    </tr>
  );
});

// ─── Main Content ─────────────────────────────────────────────────────────────

function VendorsContent() {
  const router = useRouter();

  const [vendors, setVendors] = useState<Vendor[]>(globalCache.current?.vendors || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [total, setTotal] = useState(globalCache.current?.total || 0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeStatus, setActiveStatus] = useState<string>('All');
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Debounce search ────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Scroll-back & highlight ─────────────────────────────────────────────

  useEffect(() => {
    const savedId = sessionStorage.getItem('vendor_scroll_to');
    const savedScroll = sessionStorage.getItem('vendor_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('vendor_scroll_to');
      sessionStorage.removeItem('vendor_scroll_top');
      setHighlightId(savedId);
      if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-vendor-id="${savedId}"]`);
        if (row) {
          setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
          setTimeout(() => setHighlightId(null), 3000);
        } else if (attempts < 30) {
          setTimeout(() => tryScroll(attempts + 1), 200);
        }
      };
      setTimeout(() => tryScroll(), 100);
    }
  }, []);

  // ─── Fetch page ──────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++reqSeqRef.current;

    fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        sortBy,
        sortOrder,
        search: debouncedSearch,
      });
      if (activeStatus !== 'All') params.set('status', activeStatus);

      const res = await fetch(`/api/vendors?${params}`, { signal: controller.signal });
      const data = await res.json();

      if (seq !== reqSeqRef.current) return;
      if (!mountedRef.current) return;

      if (res.ok) {
        const newVendors = data.vendors || [];
        const newHasMore = data.hasMore ?? false;
        const newTotal = data.total || 0;

        if (isAppend) {
          setVendors(prev => {
            const existingIds = new Set(prev.map(v => v._id));
            const filtered = newVendors.filter((v: Vendor) => !existingIds.has(v._id));
            const merged = [...prev, ...filtered];
            globalCache.current = { vendors: merged, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, timestamp: Date.now() };
            return merged;
          });
        } else {
          setVendors(newVendors);
          setTotal(newTotal);
          globalCache.current = { vendors: newVendors, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, timestamp: Date.now() };
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
  }, [sortBy, sortOrder, debouncedSearch, activeStatus]);

  // ─── Initial load / filter changes ─────────────────────────────────────

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);
  const prevFiltersRef = useRef({ sortBy, sortOrder, search: debouncedSearch, status: activeStatus });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged = prev.sortBy !== sortBy || prev.sortOrder !== sortOrder || prev.search !== debouncedSearch || prev.status !== activeStatus;
    prevFiltersRef.current = { sortBy, sortOrder, search: debouncedSearch, status: activeStatus };

    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.vendors.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch && cache.status === activeStatus) {
        setVendors(cache.vendors);
        setHasMore(cache.hasMore);
        setTotal(cache.total);
        pageRef.current = cache.page;
        setIsLoading(false);
        return;
      }
    }

    globalCache.current = null;
    pageRef.current = 0;
    setVendors([]);
    setHasMore(true);
    fetchPageRef.current(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, debouncedSearch, activeStatus]);

  // ─── Infinite scroll ─────────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    if (!sentinel || !scrollContainer) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPageRef.current(pageRef.current + 1, true); },
      { root: scrollContainer, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // ─── Sort ─────────────────────────────────────────────────────────────────

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(column); setSortOrder('asc'); }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const STATUS_TABS = ['All', 'Active', 'Inactive'] as const;
  const statusColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
    'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
    'Active': { bg: '#16a34a', color: '#ffffff', hoverBg: 'rgba(22,163,74,0.08)' },
    'Inactive': { bg: '#dc2626', color: '#ffffff', hoverBg: 'rgba(220,38,38,0.08)' },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

      {/* ─── Local Page Header ─────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex items-center gap-3 overflow-x-auto">

        {/* Page Title */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">VENDORS</span>
          <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">
            {total > 0 ? total.toLocaleString() : ''}
          </span>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border shrink-0" />

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
          {STATUS_TABS.map((tab) => {
            const sc = statusColors[tab];
            const isActive = activeStatus === tab;
            return (
              <button
                key={tab}
                onClick={() => { setActiveStatus(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                style={isActive
                  ? { backgroundColor: sc?.bg, color: sc?.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                  : { color: 'inherit', backgroundColor: 'transparent' }
                }
                onMouseEnter={e => { if (!isActive && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border shrink-0" />

        {/* Search */}
        <div className="relative flex items-center shrink-0">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search vendors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 h-8 w-56 bg-secondary/60 border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Add Button */}
        <button
          onClick={() => router.push('/warehouse/vendors/new')}
          className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black uppercase tracking-widest">ADD</span>
        </button>
      </div>

      {/* ─── Table ─────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                      col.width,
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span>{col.label}</span>
                      <ArrowUpDown className={cn('w-2.5 h-2.5 transition-colors', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
              ) : vendors.length === 0 ? (
                <tr><td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No vendors found</td></tr>
              ) : (
                vendors.map((vendor) => (
                  <VendorRow
                    key={vendor._id}
                    vendor={vendor}
                    highlight={highlightId === vendor._id}
                    onClick={() => {
                      sessionStorage.setItem('vendor_scroll_to', vendor._id);
                      if (scrollRef.current) sessionStorage.setItem('vendor_scroll_top', String(scrollRef.current.scrollTop));
                      router.push(`/warehouse/vendors/${vendor._id}`);
                    }}
                  />
                ))
              )}
            </tbody>
          </table>

          {/* Load more sentinel */}
          <div ref={sentinelRef} className="h-2" />

          {/* Loading more indicator */}
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {/* End of list */}
          {!hasMore && vendors.length > 0 && !isLoading && (
            <div className="text-center py-4 text-[11px] text-muted-foreground/40 uppercase tracking-widest">
              — {vendors.length.toLocaleString()} vendors loaded —
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VendorsPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
        <div className="h-12 border-b border-border bg-background" />
        <div className="flex-1" />
      </div>
    }>
      <VendorsContent />
    </Suspense>
  );
}
