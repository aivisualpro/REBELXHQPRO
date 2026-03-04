'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  Search,
  Plus,
  X,
  Factory,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ManufacturingOrder {
  _id: string;
  label?: string;
  sku: { _id: string; name: string; tier?: number } | string;
  recipesId: string;
  uom: string;
  qty: number;
  qtyDifference: number;
  scheduledStart: string;
  scheduledFinish: string;
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

// ─── In-Memory SWR Cache ─────────────────────────────────────────────────────

interface CacheEntry {
  orders: ManufacturingOrder[];
  total: number;
  hasMore: boolean;
  timestamp: number;
  key: string;
}

const cache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000;
const PAGE_SIZE = 50; // Load 50 at a time for fast fill

function getCacheKey(search: string, sortBy: string, sortOrder: string) {
  return `${search}|${sortBy}|${sortOrder}`;
}

// ─── Table Columns ───────────────────────────────────────────────────────────

const COLUMNS: { key: string; label: string; width: string; align?: string }[] = [
  { key: 'label', label: 'WO#', width: 'w-[70px]' },
  { key: 'createdAt', label: 'Date', width: 'w-[90px]' },
  { key: 'sku', label: 'SKU', width: 'min-w-[200px]' },
  { key: 'qty', label: 'Qty', width: 'w-[70px]', align: 'text-right' },
  { key: 'priority', label: 'Priority', width: 'w-[80px]' },
  { key: 'status', label: 'Status', width: 'w-[100px]' },
  { key: 'createdBy', label: 'Created By', width: 'w-[120px]' },
  { key: 'materialCost', label: 'Material', width: 'w-[90px]', align: 'text-right' },
  { key: 'packagingCost', label: 'Packaging', width: 'w-[90px]', align: 'text-right' },
  { key: 'laborCost', label: 'Labor', width: 'w-[90px]', align: 'text-right' },
  { key: 'totalCost', label: 'Total', width: 'w-[90px]', align: 'text-right' },
  { key: 'unitCost', label: 'Unit Cost', width: 'w-[90px]', align: 'text-right' },
];

// ─── Skeleton Row ────────────────────────────────────────────────────────────

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/30" style={{ animationDelay: `${index * 20}ms` }}>
      {COLUMNS.map((col) => (
        <td key={col.key} className={cn('px-2 py-2', col.width)}>
          <div
            className={cn(
              'h-3 rounded-sm bg-secondary/80 animate-pulse',
              col.key === 'sku' ? 'w-3/4' :
                col.key === 'status' ? 'w-14' :
                  col.key === 'createdBy' ? 'w-20' :
                    col.key === 'label' ? 'w-10' : 'w-12'
            )}
            style={{ animationDelay: `${index * 20 + 100}ms` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-[8px] font-black uppercase tracking-wider transition-colors',
        status === 'Fulfilled' ? 'bg-emerald-500/10 text-emerald-500' :
          status === 'Processing' ? 'bg-blue-500/10 text-blue-500' :
            status === 'Ready to QC' ? 'bg-amber-500/10 text-amber-400' :
              status === 'Pending' ? 'bg-slate-500/10 text-slate-400' :
                'bg-muted text-muted-foreground'
      )}
    >
      {status}
    </span>
  );
}

// ─── Priority Badge ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'Normal') return <span className="text-[10px] text-muted-foreground/60">—</span>;
  return (
    <span className={cn(
      'text-[10px] font-black uppercase tracking-wider',
      priority === 'Extreme' ? 'text-red-500' :
        priority === 'High' ? 'text-orange-500' : 'text-muted-foreground'
    )}>
      {priority === 'Extreme' ? '⚡ Extreme' : priority === 'High' ? '↑ High' : priority}
    </span>
  );
}

// ─── Tier Badge ──────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: number }) {
  return (
    <span
      className={cn(
        'flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm',
        tier === 1 ? 'bg-emerald-500' : tier === 2 ? 'bg-blue-500' : 'bg-orange-500'
      )}
      title={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}

// ─── Currency Format ─────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  if (!value) return <span className="text-muted-foreground/30">—</span>;
  return (
    <span className="tabular-nums">
      ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

const TableRow = React.memo(function TableRow({
  order,
  index,
  onClick,
}: {
  order: ManufacturingOrder;
  index: number;
  onClick: () => void;
}) {
  const unitCost = order.qty && order.qty > 0 ? (order.totalCost || 0) / order.qty : 0;
  const skuName = typeof order.sku === 'object' && order.sku !== null ? order.sku.name : (order.sku || '-');
  const tier = typeof order.sku === 'object' && order.sku !== null ? (order.sku as any)?.tier : null;

  return (
    <tr
      className="group hover:bg-primary/[0.03] transition-colors duration-150 cursor-pointer border-b border-border/30"
      onClick={onClick}
      style={{
        animation: 'fadeSlideIn 0.2s ease-out both',
        animationDelay: `${Math.min(index * 12, 250)}ms`,
      }}
    >
      <td className="px-2 py-1.5 text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
        <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all">
          {order.label || '-'}
        </span>
      </td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground/70">
        {new Date(order.createdAt).toLocaleDateString()}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
        <div className="flex items-center gap-1.5">
          {tier && <TierBadge tier={tier} />}
          <span className="truncate max-w-[250px]">{skuName}</span>
        </div>
      </td>
      <td className="px-2 py-1.5 text-[11px] font-mono text-right text-muted-foreground">
        {order.qty?.toLocaleString() || '-'}
      </td>
      <td className="px-2 py-1.5"><PriorityBadge priority={order.priority} /></td>
      <td className="px-2 py-1.5"><StatusBadge status={order.status} /></td>
      <td className="px-2 py-1.5 text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
        {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
      </td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">
        {formatCurrency(order.materialCost || 0)}
      </td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">
        {formatCurrency(order.packagingCost || 0)}
      </td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">
        {formatCurrency(order.laborCost || 0)}
      </td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
        {formatCurrency(order.totalCost || 0)}
      </td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">
        {formatCurrency(unitCost)}
      </td>
    </tr>
  );
});

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function ManufacturingPage() {
  return (
    <Suspense fallback={<ManufacturingShell orders={[]} isLoading />}>
      <ManufacturingContent />
    </Suspense>
  );
}

// ─── Shell (instant render) ──────────────────────────────────────────────────

function ManufacturingShell({
  orders,
  isLoading,
  isRevalidating,
  isLoadingMore,
  error,
  totalOrders = 0,
  hasMore = false,
  sortBy = 'createdAt',
  sortOrder = 'desc' as 'asc' | 'desc',
  search = '',
  onSort,
  onSearch,
  headerPortalTarget,
  router,
  sentinelRef,
}: {
  orders: ManufacturingOrder[];
  isLoading: boolean;
  isRevalidating?: boolean;
  isLoadingMore?: boolean;
  error?: string | null;
  totalOrders?: number;
  hasMore?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  onSort?: (column: string) => void;
  onSearch?: (value: string) => void;
  headerPortalTarget?: HTMLElement | null;
  router?: ReturnType<typeof useRouter>;
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* Header Portal */}
      {headerPortalTarget &&
        createPortal(
          <>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => onSearch?.(e.target.value)}
                className="pl-8 pr-8 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
              />
              {search && (
                <button
                  onClick={() => onSearch?.('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex-1" />

            {/* Count + Syncing */}
            <div className="flex items-center gap-3 mr-3">
              {totalOrders > 0 && (
                <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
                  <span className="text-foreground font-bold">{orders.length}</span>
                  <span className="text-muted-foreground/50"> / </span>
                  <span>{totalOrders}</span>
                </span>
              )}
              {isRevalidating && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Syncing</span>
                </div>
              )}
            </div>

            <button
              onClick={() => router?.push('/warehouse/manufacturing/new')}
              className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Add</span>
            </button>
          </>,
          headerPortalTarget
        )}

      {/* Table */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
            <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10 transition-colors duration-300">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => onSort?.(col.key)}
                    className={cn(
                      'px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/80 transition-colors border-r border-border/50 last:border-0 select-none',
                      col.width,
                      col.align || 'text-left'
                    )}
                  >
                    <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                      <span>{col.label}</span>
                      <ArrowUpDown
                        className={cn(
                          'w-2 h-2 transition-colors',
                          sortBy === col.key ? 'text-foreground' : 'text-muted-foreground/20'
                        )}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Initial loading — skeleton rows */}
              {isLoading && orders.length === 0 ? (
                Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-destructive text-[11px]">{error}</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-16 text-center">
                    <Factory className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-bold">No orders found</p>
                  </td>
                </tr>
              ) : (
                orders.map((order, index) => (
                  <TableRow
                    key={order._id}
                    order={order}
                    index={index}
                    onClick={() => router?.push(`/warehouse/manufacturing/${order._id}`)}
                  />
                ))
              )}

              {/* Loading more skeleton rows at bottom */}
              {isLoadingMore && (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonRow key={`more-${i}`} index={i} />
                  ))}
                </>
              )}
            </tbody>
          </table>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {/* End of list */}
          {!isLoading && !hasMore && orders.length > 0 && (
            <div className="flex items-center justify-center py-4 gap-2">
              <div className="h-px w-12 bg-border" />
              <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-bold">
                {orders.length} orders loaded
              </span>
              <div className="h-px w-12 bg-border" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Content (data fetching with infinite scroll) ────────────────────────────

function ManufacturingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Data state
  const [orders, setOrders] = useState<ManufacturingOrder[]>(cache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!cache.current);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalOrders, setTotalOrders] = useState(cache.current?.total || 0);
  const [hasMore, setHasMore] = useState(cache.current?.hasMore ?? true);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Refs
  const mountedRef = useRef(true);
  const pageRef = useRef(1);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('header-portal-target');
    if (el) setHeaderPortalTarget(el);
  }, []);

  // Mount tracking
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Debounce search — 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Fetch page of data ────────────────────────────────────────────────────

  const fetchPage = useCallback(async (page: number, isBackground = false): Promise<{
    orders: ManufacturingOrder[];
    total: number;
    totalPages: number;
  } | null> => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/manufacturing?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        return {
          orders: data.orders || [],
          total: data.total || 0,
          totalPages: data.totalPages || 1,
        };
      } else {
        if (!isBackground && mountedRef.current) setError(data.error || 'Failed to fetch');
        return null;
      }
    } catch (e: any) {
      if (!isBackground && mountedRef.current) setError(e.message);
      return null;
    }
  }, [debouncedSearch, sortBy, sortOrder]);

  // ─── Initial load (with cache) ─────────────────────────────────────────────

  useEffect(() => {
    const cacheKey = getCacheKey(debouncedSearch, sortBy, sortOrder);

    // Cache hit — show instantly, maybe revalidate
    if (cache.current && cache.current.key === cacheKey) {
      setOrders(cache.current.orders);
      setTotalOrders(cache.current.total);
      setHasMore(cache.current.hasMore);
      setIsLoading(false);
      pageRef.current = Math.ceil(cache.current.orders.length / PAGE_SIZE);

      // Stale? Revalidate in background
      if (Date.now() - cache.current.timestamp > CACHE_TTL) {
        setIsRevalidating(true);
        fetchPage(1, true).then((result) => {
          if (!mountedRef.current || !result) { setIsRevalidating(false); return; }
          const more = result.orders.length >= PAGE_SIZE && result.orders.length < result.total;
          setOrders(result.orders);
          setTotalOrders(result.total);
          setHasMore(more);
          pageRef.current = 1;
          cache.current = {
            orders: result.orders,
            total: result.total,
            hasMore: more,
            timestamp: Date.now(),
            key: cacheKey,
          };
          setIsRevalidating(false);
        });
      }
      return;
    }

    // Cache miss — fresh load
    setIsLoading(true);
    setOrders([]);
    setError(null);
    pageRef.current = 1;

    fetchPage(1).then((result) => {
      if (!mountedRef.current || !result) { setIsLoading(false); return; }
      const more = result.orders.length >= PAGE_SIZE && result.orders.length < result.total;
      setOrders(result.orders);
      setTotalOrders(result.total);
      setHasMore(more);
      setIsLoading(false);

      cache.current = {
        orders: result.orders,
        total: result.total,
        hasMore: more,
        timestamp: Date.now(),
        key: cacheKey,
      };
    });
  }, [debouncedSearch, sortBy, sortOrder, fetchPage]);

  // ─── Load more (infinite scroll) ───────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (fetchingRef.current || !hasMore || isLoading) return;
    fetchingRef.current = true;
    setIsLoadingMore(true);

    const nextPage = pageRef.current + 1;
    const result = await fetchPage(nextPage);

    if (mountedRef.current && result) {
      const newOrders = [...orders, ...result.orders];
      const more = newOrders.length < result.total;

      setOrders(newOrders);
      setTotalOrders(result.total);
      setHasMore(more);
      pageRef.current = nextPage;

      // Update cache
      const cacheKey = getCacheKey(debouncedSearch, sortBy, sortOrder);
      cache.current = {
        orders: newOrders,
        total: result.total,
        hasMore: more,
        timestamp: Date.now(),
        key: cacheKey,
      };
    }

    if (mountedRef.current) setIsLoadingMore(false);
    fetchingRef.current = false;
  }, [hasMore, isLoading, orders, fetchPage, debouncedSearch, sortBy, sortOrder]);

  // ─── Intersection Observer for infinite scroll ─────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          loadMore();
        }
      },
      { rootMargin: '400px' } // Trigger 400px before reaching bottom
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  // ─── Sort handler (resets to fresh load) ───────────────────────────────────

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    // Reset — will trigger fresh load via useEffect
    pageRef.current = 1;
    cache.current = null;
  };

  return (
    <ManufacturingShell
      orders={orders}
      isLoading={isLoading}
      isRevalidating={isRevalidating}
      isLoadingMore={isLoadingMore}
      error={error}
      totalOrders={totalOrders}
      hasMore={hasMore}
      sortBy={sortBy}
      sortOrder={sortOrder}
      search={search}
      onSort={handleSort}
      onSearch={setSearch}
      headerPortalTarget={headerPortalTarget}
      router={router}
      sentinelRef={sentinelRef}
    />
  );
}
