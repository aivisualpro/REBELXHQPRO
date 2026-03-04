'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  Search,
  Plus,
  X,
  Factory,
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
// Persists across navigations within the session. Stores ALL orders.

interface CacheEntry {
  orders: ManufacturingOrder[];
  timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000; // 2 min

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSkuName(order: ManufacturingOrder): string {
  return typeof order.sku === 'object' && order.sku !== null ? order.sku.name : String(order.sku || '');
}

function getCreatedByName(order: ManufacturingOrder): string {
  return order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '';
}

// Client-side fuzzy search — matches all words in any order
function matchesSearch(order: ManufacturingOrder, terms: string[]): boolean {
  if (terms.length === 0) return true;
  const haystack = [
    order.label || '',
    getSkuName(order),
    getCreatedByName(order),
    order.status,
    order.priority,
  ].join(' ').toLowerCase();

  return terms.every(term => haystack.includes(term));
}

// Client-side sort
function sortOrders(orders: ManufacturingOrder[], sortBy: string, sortOrder: 'asc' | 'desc'): ManufacturingOrder[] {
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...orders].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'label':
        cmp = (parseInt(a.label || '0') || 0) - (parseInt(b.label || '0') || 0);
        break;
      case 'createdAt':
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'sku':
        cmp = getSkuName(a).localeCompare(getSkuName(b));
        break;
      case 'qty':
        cmp = (a.qty || 0) - (b.qty || 0);
        break;
      case 'priority': {
        const p: Record<string, number> = { Extreme: 3, High: 2, Normal: 1 };
        cmp = (p[a.priority] || 0) - (p[b.priority] || 0);
        break;
      }
      case 'status':
        cmp = (a.status || '').localeCompare(b.status || '');
        break;
      case 'createdBy':
        cmp = getCreatedByName(a).localeCompare(getCreatedByName(b));
        break;
      case 'materialCost':
        cmp = (a.materialCost || 0) - (b.materialCost || 0);
        break;
      case 'packagingCost':
        cmp = (a.packagingCost || 0) - (b.packagingCost || 0);
        break;
      case 'laborCost':
        cmp = (a.laborCost || 0) - (b.laborCost || 0);
        break;
      case 'totalCost':
        cmp = (a.totalCost || 0) - (b.totalCost || 0);
        break;
      case 'unitCost': {
        const ucA = a.qty > 0 ? (a.totalCost || 0) / a.qty : 0;
        const ucB = b.qty > 0 ? (b.totalCost || 0) / b.qty : 0;
        cmp = ucA - ucB;
        break;
      }
      default:
        cmp = 0;
    }
    return cmp * dir;
  });
}

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

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 text-[8px] font-black uppercase tracking-wider',
      status === 'Fulfilled' ? 'bg-emerald-500/10 text-emerald-500' :
        status === 'Processing' ? 'bg-blue-500/10 text-blue-500' :
          status === 'Ready to QC' ? 'bg-amber-500/10 text-amber-400' :
            status === 'Pending' ? 'bg-slate-500/10 text-slate-400' :
              'bg-muted text-muted-foreground'
    )}>
      {status}
    </span>
  );
}

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

function TierBadge({ tier }: { tier: number }) {
  return (
    <span className={cn(
      'flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm',
      tier === 1 ? 'bg-emerald-500' : tier === 2 ? 'bg-blue-500' : 'bg-orange-500'
    )} title={`Tier ${tier}`}>
      {tier}
    </span>
  );
}

function formatCurrency(value: number) {
  if (!value) return <span className="text-muted-foreground/30">—</span>;
  return <span className="tabular-nums">${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

// ─── Table Row ───────────────────────────────────────────────────────────────

const TableRow = React.memo(function TableRow({
  order,
  onClick,
}: {
  order: ManufacturingOrder;
  onClick: () => void;
}) {
  const unitCost = order.qty && order.qty > 0 ? (order.totalCost || 0) / order.qty : 0;
  const skuName = getSkuName(order);
  const tier = typeof order.sku === 'object' && order.sku !== null ? order.sku.tier : null;

  return (
    <tr
      className="group hover:bg-primary/[0.03] transition-colors duration-150 cursor-pointer border-b border-border/30"
      onClick={onClick}
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
        {getCreatedByName(order) || '-'}
      </td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(order.materialCost || 0)}</td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(order.packagingCost || 0)}</td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(order.laborCost || 0)}</td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{formatCurrency(order.totalCost || 0)}</td>
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(unitCost)}</td>
    </tr>
  );
});

// ─── Render Chunk Size ───────────────────────────────────────────────────────

const INITIAL_RENDER = 60; // Show 60 rows immediately
const LOAD_MORE_CHUNK = 80; // Then 80 more per scroll

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
      <div className="flex-1 overflow-hidden px-2 py-1">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col) => (
                <th key={col.key} className={cn('px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border/50 last:border-0', col.width)}>
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

  // All data (from API or cache)
  const [allOrders, setAllOrders] = useState<ManufacturingOrder[]>(globalCache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View state (client-side)
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [renderCount, setRenderCount] = useState(INITIAL_RENDER);

  // Refs
  const mountedRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('header-portal-target');
    if (el) setHeaderPortalTarget(el);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Fetch ALL data once ─────────────────────────────────────────────────

  const fetchAllOrders = useCallback(async (isBackground = false) => {
    if (isBackground) setIsRevalidating(true);
    else if (allOrders.length === 0) setIsLoading(true);

    try {
      const res = await fetch('/api/manufacturing?fields=list');
      const data = await res.json();

      if (!mountedRef.current) return;

      if (res.ok) {
        const orders = data.orders || [];
        setAllOrders(orders);
        setError(null);
        globalCache.current = { orders, timestamp: Date.now() };
      } else {
        if (!isBackground) setError(data.error || 'Failed to fetch');
      }
    } catch (e: any) {
      if (!isBackground && mountedRef.current) setError(e.message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRevalidating(false);
      }
    }
  }, []);

  useEffect(() => {
    if (globalCache.current) {
      // Cache hit — show instantly
      setAllOrders(globalCache.current.orders);
      setIsLoading(false);

      // Stale? Background refresh
      if (Date.now() - globalCache.current.timestamp > CACHE_TTL) {
        fetchAllOrders(true);
      }
    } else {
      fetchAllOrders();
    }
  }, [fetchAllOrders]);

  // ─── Client-side search + sort (instant) ─────────────────────────────────

  const searchTerms = useMemo(
    () => search.toLowerCase().split(/\s+/).filter(Boolean),
    [search]
  );

  const processedOrders = useMemo(() => {
    // 1. Filter
    const filtered = searchTerms.length > 0
      ? allOrders.filter(o => matchesSearch(o, searchTerms))
      : allOrders;

    // 2. Sort
    return sortOrders(filtered, sortBy, sortOrder);
  }, [allOrders, searchTerms, sortBy, sortOrder]);

  // Reset render count when filter/sort changes
  useEffect(() => {
    setRenderCount(INITIAL_RENDER);
    // Scroll to top
    scrollRef.current?.scrollTo({ top: 0 });
  }, [search, sortBy, sortOrder]);

  // Visible slice
  const visibleOrders = useMemo(
    () => processedOrders.slice(0, renderCount),
    [processedOrders, renderCount]
  );

  const hasMore = renderCount < processedOrders.length;

  // ─── Infinite scroll (just renders more from already-loaded data) ────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setRenderCount(prev => Math.min(prev + LOAD_MORE_CHUNK, processedOrders.length));
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, processedOrders.length]);

  // ─── Sort handler ────────────────────────────────────────────────────────

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────

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
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
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

            <div className="flex-1" />

            {/* Counter + Status */}
            <div className="flex items-center gap-3 mr-3">
              {allOrders.length > 0 && (
                <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
                  {search ? (
                    <>
                      <span className="text-foreground font-bold">{processedOrders.length}</span>
                      <span className="text-muted-foreground/50"> results</span>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground font-bold">{allOrders.length}</span>
                      <span className="text-muted-foreground/50"> orders</span>
                    </>
                  )}
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
              onClick={() => router.push('/warehouse/manufacturing/new')}
              className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Add</span>
            </button>
          </>,
          headerPortalTarget
        )}

      {/* Table */}
      <div ref={scrollRef} className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
            <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10 transition-colors duration-300">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
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
              {isLoading ? (
                Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-destructive text-[11px]">{error}</td>
                </tr>
              ) : visibleOrders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-16 text-center">
                    <Factory className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                      {search ? 'No matching orders' : 'No orders found'}
                    </p>
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order) => (
                  <TableRow
                    key={order._id}
                    order={order}
                    onClick={() => router.push(`/warehouse/manufacturing/${order._id}`)}
                  />
                ))
              )}
            </tbody>
          </table>

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" />

          {/* End marker */}
          {!isLoading && !hasMore && visibleOrders.length > 0 && (
            <div className="flex items-center justify-center py-4 gap-2">
              <div className="h-px w-12 bg-border" />
              <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest font-bold">
                {processedOrders.length} orders
              </span>
              <div className="h-px w-12 bg-border" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
