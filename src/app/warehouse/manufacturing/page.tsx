'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpDown,
  Search,
  Plus,
  X,
  Factory,
  Loader2,
  Flame,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ManufacturingOrder {
  _id: string;
  label?: string;
  sku: { _id: string; name: string; tier?: number } | string;
  uom: string;
  qty: number;
  qtyDifference: number;
  priority: string;
  status: string;
  createdBy?: { firstName: string; lastName: string };
  finishedBy?: { firstName: string; lastName: string };
  createdAt: string;
  materialCost?: number;
  packagingCost?: number;
  laborCost?: number;
  totalCost?: number;
}

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  orders: ManufacturingOrder[];
  hasMore: boolean;
  page: number;
  sortBy: string;
  sortOrder: string;
  search: string;
  status: string;
  priority: string;
  timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Table Columns ───────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'label', label: 'WO#', width: 'w-[60px]' },
  { key: 'createdAt', label: 'Date', width: 'w-[80px]' },
  { key: 'sku', label: 'SKU', width: 'w-[200px]' },
  { key: 'qty', label: 'Qty', width: 'w-[60px]', align: 'text-right' },
  { key: 'priority', label: 'Priority', width: 'w-[72px]' },
  { key: 'status', label: 'Status', width: 'w-[90px]' },
  { key: 'createdBy', label: 'Created By', width: 'w-[100px]' },
  { key: 'materialCost', label: 'Material', width: 'w-[80px]', align: 'text-right' },
  { key: 'packagingCost', label: 'Packaging', width: 'w-[70px]', align: 'text-right' },
  { key: 'laborCost', label: 'Labor', width: 'w-[70px]', align: 'text-right' },
  { key: 'totalCost', label: 'Total', width: 'w-[80px]', align: 'text-right' },
  { key: 'unitCost', label: 'Unit', width: 'w-[70px]', align: 'text-right' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSkuName(o: ManufacturingOrder) {
  return typeof o.sku === 'object' && o.sku ? o.sku.name : String(o.sku || '');
}

function getCreatedByName(o: ManufacturingOrder) {
  return o.createdBy ? `${o.createdBy.firstName} ${o.createdBy.lastName}` : '';
}

function formatCurrency(v: number) {
  if (!v) return <span className="text-muted-foreground/30">—</span>;
  return <span className="tabular-nums">${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, { bg: string; color: string; border?: string; darkBg?: string; darkColor?: string }> = {
    'Fulfilled': { bg: '#000000', color: '#ffffff', darkBg: 'rgba(16,185,129,0.2)', darkColor: '#34d399' },
    'Processing': { bg: '#2563eb', color: '#ffffff', darkBg: 'rgba(59,130,246,0.2)', darkColor: '#60a5fa' },
    'Ready to QC': { bg: '#d97706', color: '#ffffff', darkBg: 'rgba(245,158,11,0.2)', darkColor: '#fbbf24' },
    'Pending': { bg: '#e2e8f0', color: '#000000', border: '1px solid #cbd5e1', darkBg: 'rgba(100,116,139,0.2)', darkColor: '#cbd5e1' },
  };
  const s = styleMap[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider status-badge"
      data-status={status}
      style={s ? { backgroundColor: s.bg, color: s.color, border: s.border, borderRadius: '4px' } : { borderRadius: '4px' }}
    >
      {status || '—'}
    </span>
  );
}

// Normalize priority: handles both "Normal" and "3-Normal" formats
function normalizePriority(p: string): string {
  if (!p) return 'Normal';
  if (p.includes('Extreme') || p.includes('extreme')) return 'Extreme';
  if (p.includes('High') || p.includes('high')) return 'High';
  return 'Normal';
}

function PriorityBadge({ priority }: { priority: string }) {
  const p = normalizePriority(priority);
  if (p === 'Normal') return <span className="text-[12px] text-muted-foreground/50">—</span>;
  return (
    <span className={cn(
      'text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 !rounded-md',
      p === 'Extreme' ? 'bg-red-600 text-white dark:bg-red-500/15 dark:text-red-400' : 'bg-orange-600 text-white dark:bg-orange-500/15 dark:text-orange-400'
    )}>
      {p === 'Extreme' ? '⚡ Ext' : '↑ High'}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  return (
    <span className={cn(
      'flex-shrink-0 w-4 h-4 !rounded-full flex items-center justify-center text-[10px] font-black text-white',
      tier === 1 ? 'bg-emerald-600' : tier === 2 ? 'bg-blue-600' : 'bg-orange-500'
    )} title={`Tier ${tier}`}>
      {tier}
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
              'h-3.5 rounded-sm bg-secondary/80 animate-pulse',
              col.key === 'sku' ? 'w-4/5' :
                col.key === 'status' ? 'w-14' :
                  col.key === 'createdBy' ? 'w-16' :
                    col.key === 'label' ? 'w-8' : 'w-10'
            )}
            style={{ animationDelay: `${index * 30}ms` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

const TableRow = React.memo(function TableRow({
  order, onClick, highlight
}: {
  order: ManufacturingOrder; onClick: () => void; highlight?: boolean;
}) {
  const unitCost = order.qty > 0 ? (order.totalCost || 0) / order.qty : 0;
  const skuName = getSkuName(order);
  const tier = typeof order.sku === 'object' && order.sku ? order.sku.tier : null;

  return (
    <tr
      data-order-id={order._id}
      className={cn(
        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
        highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
      )}
      onClick={onClick}
    >
      <td className="px-2.5 py-2.5 w-[60px] text-[12px] font-mono font-bold text-foreground/90 group-hover:text-foreground transition-colors">
        <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all">{order.label || '-'}</span>
      </td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-foreground/60">
        {formatDate(order.createdAt)}
      </td>
      <td className="px-2.5 py-2.5 text-[12px] text-foreground/90 group-hover:text-foreground transition-colors font-semibold">
        <div className="flex items-center gap-1.5">
          {tier && <TierBadge tier={tier} />}
          <span className="whitespace-nowrap">{skuName}</span>
        </div>
      </td>
      <td className="px-2.5 py-2.5 w-[60px] text-[12px] font-mono text-right text-foreground/90 font-bold">{order.qty?.toLocaleString() || '-'}</td>
      <td className="px-2.5 py-2.5 w-[72px]"><PriorityBadge priority={order.priority} /></td>
      <td className="px-2.5 py-2.5 w-[90px]"><StatusBadge status={order.status} /></td>
      <td className="px-2.5 py-2.5 w-[100px] text-[12px] font-medium text-foreground/60 truncate">{getCreatedByName(order) || '-'}</td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-right text-foreground/70">{formatCurrency(order.materialCost || 0)}</td>
      <td className="px-2.5 py-2.5 w-[70px] text-[12px] font-mono text-right text-foreground/70">{formatCurrency(order.packagingCost || 0)}</td>
      <td className="px-2.5 py-2.5 w-[70px] text-[12px] font-mono text-right text-foreground/70">{formatCurrency(order.laborCost || 0)}</td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-right font-black text-foreground group-hover:text-foreground transition-colors">{formatCurrency(order.totalCost || 0)}</td>
      <td className="px-2.5 py-2.5 w-[70px] text-[12px] font-mono text-right text-foreground/70">{formatCurrency(unitCost)}</td>
    </tr>
  );
});

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ManufacturingPage() {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <ManufacturingContent />
    </Suspense>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
      {/* Skeleton header */}
      <div className="shrink-0 border-b border-border px-4 py-2.5 flex items-center gap-3">
        <div className="h-4 w-32 bg-secondary/80 animate-pulse rounded" />
        <div className="flex gap-1.5 ml-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-6 w-16 bg-secondary/80 animate-pulse rounded-lg" style={{ animationDelay: `${i * 50}ms` }} />)}
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-2 py-1">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10">
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

// ─── Content ─────────────────────────────────────────────────────────────────

function ManufacturingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<ManufacturingOrder[]>(globalCache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current || globalCache.current.orders.length === 0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeStatus, setActiveStatus] = useState<string>('All');
  const [activePriority, setActivePriority] = useState<string>('All');

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Debounced search ────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Sync search to URL ────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    } else {
      params.delete('search');
    }
    const newQs = params.toString();
    const currentQs = searchParams.toString();
    if (newQs !== currentQs) {
      router.push(`${window.location.pathname}${newQs ? '?' + newQs : ''}`, { scroll: false });
    }
  }, [debouncedSearch, router, searchParams]);

  // ─── Sync URL back to state (browser back/forward) ─────────────────────

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== debouncedSearch) {
      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // ─── Fetch a page ────────────────────────────────────────────────────────

  const [highlightId, setHighlightId] = useState<string | null>(null);

  // ─── Scroll-back & highlight on return from detail ──────────────────────
  useEffect(() => {
    const savedId = sessionStorage.getItem('mfg_scroll_to');
    const savedScroll = sessionStorage.getItem('mfg_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('mfg_scroll_to');
      sessionStorage.removeItem('mfg_scroll_top');
      setHighlightId(savedId);

      // Restore scroll position instantly
      if (savedScroll && scrollRef.current) {
        scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      }

      // Wait for rows to render, then scroll into view
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-order-id="${savedId}"]`);
        if (row) {
          setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
          setTimeout(() => setHighlightId(null), 3000);
        } else if (attempts < 30) {
          setTimeout(() => tryScroll(attempts + 1), 200);
        }
      };
      // Small delay to let cache-restore render first
      setTimeout(() => tryScroll(), 100);
    }
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef(0);

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Increment sequence — only the latest response gets applied
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

      // Server-side filters
      if (activeStatus !== 'All') params.set('status', activeStatus);
      if (activePriority !== 'All') params.set('priority', activePriority);

      const res = await fetch(`/api/manufacturing?${params}`, { signal: controller.signal });
      const data = await res.json();

      // Discard stale response if a newer request has been issued
      if (seq !== reqSeqRef.current) return;
      if (!mountedRef.current) return;

      if (res.ok) {
        const newOrders = data.orders || [];
        const newHasMore = data.hasMore ?? false;

        if (isAppend) {
          // Deduplicate by _id
          setOrders(prev => {
            const existingIds = new Set(prev.map(o => o._id));
            const filtered = newOrders.filter((o: ManufacturingOrder) => !existingIds.has(o._id));
            const merged = [...prev, ...filtered];
            // Update cache
            globalCache.current = {
              orders: merged, hasMore: newHasMore, page: pageNum,
              sortBy, sortOrder, search: debouncedSearch,
              status: activeStatus, priority: activePriority,
              timestamp: Date.now()
            };
            return merged;
          });
        } else {
          setOrders(newOrders);
          globalCache.current = {
            orders: newOrders, hasMore: newHasMore, page: pageNum,
            sortBy, sortOrder, search: debouncedSearch,
            status: activeStatus, priority: activePriority,
            timestamp: Date.now()
          };
        }

        setHasMore(newHasMore);
        pageRef.current = pageNum;
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch');
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // Intentionally cancelled — ignore
      if (mountedRef.current) setError(e.message);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, activePriority]);

  // ─── Initial load & filter changes ───────────────────────────────────────

  const isFirstMount = useRef(true);

  useEffect(() => {
    // 1. Initial Mount: Check cache
    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.orders.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch &&
        cache.status === activeStatus && cache.priority === activePriority) {
        
        // Instant restore without skeleton flashing
        setOrders(cache.orders);
        setHasMore(cache.hasMore);
        pageRef.current = cache.page;
        setIsLoading(false);
        return;
      }
    }

    // 2. Not cached / filters changed: fresh fetch
    // Do NOT call setOrders([]) here; it causes UI to briefly flash "0 items" before isLoading kicks in.
    globalCache.current = null;
    pageRef.current = 0;
    setHasMore(true);
    setIsLoading(true);
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, activePriority]);

  // ─── Scroll to load more ─────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    if (!sentinel || !scrollContainer) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) {
          fetchPage(pageRef.current + 1, true);
        }
      },
      { root: scrollContainer, rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, fetchPage]);

  // ─── Sort handler ────────────────────────────────────────────────────────

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Status Tabs ─────────────────────────────────────────────────────────

  const STATUS_TABS = ['All', 'Pending', 'Processing', 'Ready to QC', 'Fulfilled'] as const;

  // Database-wide status counts (aggregation pipeline)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    All: 0, Pending: 0, Processing: 0, 'Ready to QC': 0, Fulfilled: 0
  });
  const [countsLoaded, setCountsLoaded] = useState(false);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/manufacturing/counts');
      if (res.ok) {
        const data = await res.json();
        if (data.counts) {
          setStatusCounts(data.counts);
          setCountsLoaded(true);
        }
      }
    } catch { /* silent */ }
  }, []);

  // Fetch counts on mount
  useEffect(() => {
    fetchStatusCounts();
  }, [fetchStatusCounts]);

  // Refresh counts when orders change (new data loaded, status changed, etc.)
  useEffect(() => {
    if (orders.length > 0) fetchStatusCounts();
  }, [orders.length, fetchStatusCounts]);

  const PRIORITY_TABS = ['All', 'Normal', 'High', 'Extreme'] as const;

  // No client-side filtering needed — server handles status + priority
  const filteredOrders = orders;

  const handleTabChange = (tab: string) => {
    setActiveStatus(tab);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePriorityChange = (p: string) => {
    setActivePriority(p);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* ─── Page Header with Status Tabs, Search & Actions ──────────── */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-4 py-2.5 flex items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-2 shrink-0">
            <Factory className="w-4 h-4 text-primary" />
            <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Manufacturing</h1>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {STATUS_TABS.map((tab) => {
              const statusColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
                'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
                'Fulfilled': { bg: '#000000', color: '#ffffff', hoverBg: 'rgba(0,0,0,0.06)' },
                'Processing': { bg: '#2563eb', color: '#ffffff', hoverBg: 'rgba(37,99,235,0.08)' },
                'Ready to QC': { bg: '#d97706', color: '#ffffff', hoverBg: 'rgba(217,119,6,0.08)' },
                'Pending': { bg: '#64748b', color: '#ffffff', hoverBg: 'rgba(100,116,139,0.08)' },
              };
              const sc = statusColors[tab];
              const isActive = activeStatus === tab;
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                  style={isActive
                    ? { backgroundColor: sc?.bg, color: sc?.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }
                    : { color: 'inherit', backgroundColor: 'transparent' }
                  }
                  onMouseEnter={e => { if (!isActive && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  {tab}
                  <span
                    className="ml-1.5 text-[11px] tabular-nums"
                    style={{ opacity: isActive ? 0.75 : 0.5 }}
                  >
                    {countsLoaded
                      ? statusCounts[tab]?.toLocaleString() || 0
                      : <span className="inline-block w-4 h-3 rounded-sm bg-muted-foreground/10 animate-pulse align-middle" />
                    }
                  </span>
                </button>
              );
            })}
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Priority Filter */}
          <div className="flex items-center gap-1 shrink-0">
            <Flame className="w-3.5 h-3.5 text-muted-foreground/50 mr-0.5" />
            {PRIORITY_TABS.map((p) => (
              <button
                key={p}
                onClick={() => handlePriorityChange(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer',
                  activePriority === p
                    ? p === 'Extreme' ? 'bg-red-500/15 text-red-500 shadow-sm ring-1 ring-red-500/20'
                      : p === 'High' ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 shadow-sm ring-1 ring-orange-500/20'
                        : p === 'Normal' ? 'bg-slate-500/10 text-slate-700 dark:text-slate-400 shadow-sm ring-1 ring-slate-500/20'
                          : 'bg-secondary text-foreground shadow-sm ring-1 ring-border shadow-sm'
                    : 'text-foreground/70 dark:text-foreground/60 hover:text-foreground hover:bg-muted/50'
                )}
              >
                {p === 'Extreme' && '⚡ '}{p === 'High' && '↑ '}{p}
              </button>
            ))}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
            onClick={() => router.push('/warehouse/manufacturing/new')}
            className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline text-[12px] font-black uppercase tracking-widest">Add</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 dark:hover:bg-secondary/50 transition-colors border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                      col.width,
                      col.align || 'text-left'
                    )}
                  >
                    <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
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
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-16 text-center">
                    <Factory className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                      {debouncedSearch ? 'No matching orders' : activeStatus !== 'All' ? `No ${activeStatus} orders` : 'No orders found'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order._id}
                    order={order}
                    highlight={highlightId === order._id}
                    onClick={() => {
                      sessionStorage.setItem('mfg_scroll_to', order._id);
                      if (scrollRef.current) sessionStorage.setItem('mfg_scroll_top', String(scrollRef.current.scrollTop));
                      router.push(`/warehouse/manufacturing/${order._id}`);
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
          {!isLoading && !hasMore && filteredOrders.length > 0 && (
            <div className="flex items-center justify-center py-4 gap-2">
              <div className="h-px w-12 bg-border" />
              <span className="text-[12px] text-muted-foreground/40 uppercase tracking-widest font-bold">
                {filteredOrders.length} orders loaded
              </span>
              <div className="h-px w-12 bg-border" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
