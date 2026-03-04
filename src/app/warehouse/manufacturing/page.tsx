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
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Table Columns ───────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'label', label: 'WO#', width: 'w-[60px]' },
  { key: 'createdAt', label: 'Date', width: 'w-[80px]' },
  { key: 'sku', label: 'SKU', width: '' },
  { key: 'qty', label: 'Qty', width: 'w-[60px]', align: 'text-right' },
  { key: 'priority', label: 'Priority', width: 'w-[72px]' },
  { key: 'status', label: 'Status', width: 'w-[90px]' },
  { key: 'createdBy', label: 'Created By', width: 'w-[100px]' },
  { key: 'materialCost', label: 'Material', width: 'w-[80px]', align: 'text-right' },
  { key: 'packagingCost', label: 'Pkg', width: 'w-[70px]', align: 'text-right' },
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
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider',
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
      'text-[9px] font-black uppercase tracking-wider',
      priority === 'Extreme' ? 'text-red-500' : 'text-orange-500'
    )}>
      {priority === 'Extreme' ? '⚡ Ext' : '↑ High'}
    </span>
  );
}

function TierBadge({ tier }: { tier: number }) {
  return (
    <span className={cn(
      'flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-black text-white',
      tier === 1 ? 'bg-emerald-500' : tier === 2 ? 'bg-blue-500' : 'bg-orange-500'
    )} title={`Tier ${tier}`}>
      {tier}
    </span>
  );
}

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/30">
      {COLUMNS.map((col) => (
        <td key={col.key} className={cn('px-2 py-2', col.width)}>
          <div
            className={cn(
              'h-3 rounded-sm bg-secondary/80 animate-pulse',
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
  order, onClick
}: {
  order: ManufacturingOrder; onClick: () => void;
}) {
  const unitCost = order.qty > 0 ? (order.totalCost || 0) / order.qty : 0;
  const skuName = getSkuName(order);
  const tier = typeof order.sku === 'object' && order.sku ? order.sku.tier : null;

  return (
    <tr className="group hover:bg-primary/[0.03] transition-colors duration-150 cursor-pointer border-b border-border/30" onClick={onClick}>
      <td className="px-2 py-1.5 w-[60px] text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
        <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all">{order.label || '-'}</span>
      </td>
      <td className="px-2 py-1.5 w-[80px] text-[10px] font-mono text-muted-foreground/70">
        {new Date(order.createdAt).toLocaleDateString()}
      </td>
      <td className="px-2 py-1.5 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
        <div className="flex items-center gap-1.5">
          {tier && <TierBadge tier={tier} />}
          <span className="whitespace-nowrap">{skuName}</span>
        </div>
      </td>
      <td className="px-2 py-1.5 w-[60px] text-[11px] font-mono text-right text-muted-foreground">{order.qty?.toLocaleString() || '-'}</td>
      <td className="px-2 py-1.5 w-[72px]"><PriorityBadge priority={order.priority} /></td>
      <td className="px-2 py-1.5 w-[90px]"><StatusBadge status={order.status} /></td>
      <td className="px-2 py-1.5 w-[100px] text-[10px] text-muted-foreground/70 truncate">{getCreatedByName(order) || '-'}</td>
      <td className="px-2 py-1.5 w-[80px] text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(order.materialCost || 0)}</td>
      <td className="px-2 py-1.5 w-[70px] text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(order.packagingCost || 0)}</td>
      <td className="px-2 py-1.5 w-[70px] text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(order.laborCost || 0)}</td>
      <td className="px-2 py-1.5 w-[80px] text-[10px] font-mono text-right font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{formatCurrency(order.totalCost || 0)}</td>
      <td className="px-2 py-1.5 w-[70px] text-[10px] font-mono text-right text-muted-foreground/70">{formatCurrency(unitCost)}</td>
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

  const [orders, setOrders] = useState<ManufacturingOrder[]>(globalCache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
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

  // ─── Debounced search ────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── Fetch a page ────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (fetchingRef.current) return;
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

      const res = await fetch(`/api/manufacturing?${params}`);
      const data = await res.json();

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
              sortBy, sortOrder, search: debouncedSearch, timestamp: Date.now()
            };
            return merged;
          });
        } else {
          setOrders(newOrders);
          globalCache.current = {
            orders: newOrders, hasMore: newHasMore, page: pageNum,
            sortBy, sortOrder, search: debouncedSearch, timestamp: Date.now()
          };
        }

        setHasMore(newHasMore);
        pageRef.current = pageNum;
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch');
      }
    } catch (e: any) {
      if (mountedRef.current) setError(e.message);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [sortBy, sortOrder, debouncedSearch]);

  // ─── Initial load ────────────────────────────────────────────────────────

  useEffect(() => {
    // Check cache validity
    if (
      globalCache.current &&
      globalCache.current.sortBy === sortBy &&
      globalCache.current.sortOrder === sortOrder &&
      globalCache.current.search === debouncedSearch &&
      Date.now() - globalCache.current.timestamp < CACHE_TTL
    ) {
      setOrders(globalCache.current.orders);
      setHasMore(globalCache.current.hasMore);
      pageRef.current = globalCache.current.page;
      setIsLoading(false);
      return;
    }

    // Fresh fetch
    pageRef.current = 0;
    setOrders([]);
    setHasMore(true);
    fetchPage(1, false);
  }, [sortBy, sortOrder, debouncedSearch, fetchPage]);

  // ─── Scroll to load more ─────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) {
          fetchPage(pageRef.current + 1, true);
        }
      },
      { rootMargin: '400px' }
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
    scrollRef.current?.scrollTo({ top: 0 });
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

            <div className="flex items-center gap-3 mr-3">
              {orders.length > 0 && (
                <span className="text-[9px] text-muted-foreground font-mono tabular-nums">
                  <span className="text-foreground font-bold">{orders.length}</span>
                  <span className="text-muted-foreground/50">{hasMore ? '+' : ''} orders</span>
                </span>
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
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
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
                      <ArrowUpDown className={cn('w-2 h-2 transition-colors', sortBy === col.key ? 'text-foreground' : 'text-muted-foreground/20')} />
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-16 text-center">
                    <Factory className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                      {debouncedSearch ? 'No matching orders' : 'No orders found'}
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <TableRow
                    key={order._id}
                    order={order}
                    onClick={() => router.push(`/warehouse/manufacturing/${order._id}`)}
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
