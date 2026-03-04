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
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';

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
// Persists across route navigations within the same session.
// Data appears INSTANTLY when returning to this page.

interface CacheEntry {
  orders: ManufacturingOrder[];
  total: number;
  totalPages: number;
  timestamp: number;
  key: string;
}

const cache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000; // 60s — background revalidate after this

function getCacheKey(page: number, search: string, sortBy: string, sortOrder: string) {
  return `${page}|${search}|${sortBy}|${sortOrder}`;
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
    <tr
      className="border-b border-border/30"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {COLUMNS.map((col) => (
        <td key={col.key} className={cn('px-2 py-2', col.width)}>
          <div
            className={cn(
              'h-3 rounded-sm bg-secondary/80 animate-pulse',
              col.key === 'sku' ? 'w-3/4' :
                col.key === 'status' ? 'w-14' :
                  col.key === 'createdBy' ? 'w-20' :
                    col.key === 'label' ? 'w-10' :
                      'w-12'
            )}
            style={{ animationDelay: `${index * 30 + 100}ms` }}
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
        status === 'Fulfilled'
          ? 'bg-emerald-500/10 text-emerald-500'
          : status === 'Processing'
            ? 'bg-blue-500/10 text-blue-500'
            : status === 'Ready to QC'
              ? 'bg-amber-500/10 text-amber-400'
              : status === 'Pending'
                ? 'bg-slate-500/10 text-slate-400'
                : 'bg-muted text-muted-foreground'
      )}
    >
      {status}
    </span>
  );
}

// ─── Priority Badge ──────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'Normal') {
    return <span className="text-[10px] text-muted-foreground/60">—</span>;
  }
  return (
    <span
      className={cn(
        'text-[10px] font-black uppercase tracking-wider',
        priority === 'Extreme'
          ? 'text-red-500'
          : priority === 'High'
            ? 'text-orange-500'
            : 'text-muted-foreground'
      )}
    >
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
        animationDelay: `${Math.min(index * 15, 300)}ms`,
      }}
    >
      {/* WO# */}
      <td className="px-2 py-1.5 text-[11px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">
        <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all">
          {order.label || '-'}
        </span>
      </td>

      {/* Date */}
      <td className="px-2 py-1.5 text-[10px] font-mono text-muted-foreground/70">
        {new Date(order.createdAt).toLocaleDateString()}
      </td>

      {/* SKU */}
      <td className="px-2 py-1.5 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
        <div className="flex items-center gap-1.5">
          {tier && <TierBadge tier={tier} />}
          <span className="truncate max-w-[250px]">{skuName}</span>
        </div>
      </td>

      {/* Qty */}
      <td className="px-2 py-1.5 text-[11px] font-mono text-right text-muted-foreground">
        {order.qty?.toLocaleString() || '-'}
      </td>

      {/* Priority */}
      <td className="px-2 py-1.5">
        <PriorityBadge priority={order.priority} />
      </td>

      {/* Status */}
      <td className="px-2 py-1.5">
        <StatusBadge status={order.status} />
      </td>

      {/* Created By */}
      <td className="px-2 py-1.5 text-[10px] text-muted-foreground/70 truncate max-w-[120px]">
        {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
      </td>

      {/* Material Cost */}
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">
        {formatCurrency(order.materialCost || 0)}
      </td>

      {/* Packaging Cost */}
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">
        {formatCurrency(order.packagingCost || 0)}
      </td>

      {/* Labor Cost */}
      <td className="px-2 py-1.5 text-[10px] font-mono text-right text-muted-foreground/70">
        {formatCurrency(order.laborCost || 0)}
      </td>

      {/* Total Cost */}
      <td className="px-2 py-1.5 text-[10px] font-mono text-right font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
        {formatCurrency(order.totalCost || 0)}
      </td>

      {/* Unit Cost */}
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
  error,
  page = 1,
  totalPages = 1,
  totalOrders = 0,
  sortBy = 'createdAt',
  sortOrder = 'desc' as 'asc' | 'desc',
  search = '',
  onSort,
  onPageChange,
  onSearch,
  headerPortalTarget,
  router,
}: {
  orders: ManufacturingOrder[];
  isLoading: boolean;
  isRevalidating?: boolean;
  error?: string | null;
  page?: number;
  totalPages?: number;
  totalOrders?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  onSort?: (column: string) => void;
  onPageChange?: (page: number) => void;
  onSearch?: (value: string) => void;
  headerPortalTarget?: HTMLElement | null;
  router?: ReturnType<typeof useRouter>;
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

            {/* Revalidating indicator */}
            {isRevalidating && (
              <div className="flex items-center gap-1.5 mr-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[9px] text-blue-400 font-bold uppercase tracking-widest">Syncing</span>
              </div>
            )}

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
              {isLoading && orders.length === 0 ? (
                // Skeleton rows — show structure instantly
                Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-2 py-8 text-center text-destructive text-[11px]">
                    {error}
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-2 py-16 text-center">
                    <Factory className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[11px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                      No orders found
                    </p>
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
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange || (() => { })}
        totalItems={totalOrders}
        itemsPerPage={25}
        itemName="Orders"
      />
    </div>
  );
}

// ─── Content (data fetching with SWR-like pattern) ───────────────────────────

function ManufacturingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';

  const [orders, setOrders] = useState<ManufacturingOrder[]>(cache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!cache.current);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(cache.current?.totalPages || 1);
  const [totalOrders, setTotalOrders] = useState(cache.current?.total || 0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('header-portal-target');
    if (el) setHeaderPortalTarget(el);
  }, []);

  // Debounce search — fast 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Track if component is mounted to prevent stale updates
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchOrders = useCallback(
    async (isBackground = false) => {
      const cacheKey = getCacheKey(page, debouncedSearch, sortBy, sortOrder);

      // Check cache — if fresh data exists, show it instantly
      if (!isBackground && cache.current && cache.current.key === cacheKey) {
        const age = Date.now() - cache.current.timestamp;
        setOrders(cache.current.orders);
        setTotalPages(cache.current.totalPages);
        setTotalOrders(cache.current.total);
        setIsLoading(false);

        // If stale, revalidate in background
        if (age > CACHE_TTL) {
          fetchOrders(true);
        }
        return;
      }

      if (isBackground) {
        setIsRevalidating(true);
      } else if (orders.length === 0) {
        setIsLoading(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '25',
          search: debouncedSearch,
          sortBy,
          sortOrder,
        });

        const res = await fetch(`/api/manufacturing?${params.toString()}`);
        const data = await res.json();

        if (!mountedRef.current) return;

        if (res.ok) {
          const newOrders = data.orders || [];
          setOrders(newOrders);
          setTotalPages(data.totalPages || 1);
          setTotalOrders(data.total || 0);

          // Update cache
          cache.current = {
            orders: newOrders,
            total: data.total || 0,
            totalPages: data.totalPages || 1,
            timestamp: Date.now(),
            key: cacheKey,
          };
        } else {
          setError(data.error || 'Failed to fetch orders');
        }
      } catch (e: any) {
        if (mountedRef.current) setError(e.message);
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
          setIsRevalidating(false);
        }
      }
    },
    [page, debouncedSearch, sortBy, sortOrder]
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <ManufacturingShell
      orders={orders}
      isLoading={isLoading}
      isRevalidating={isRevalidating}
      error={error}
      page={page}
      totalPages={totalPages}
      totalOrders={totalOrders}
      sortBy={sortBy}
      sortOrder={sortOrder}
      search={search}
      onSort={handleSort}
      onPageChange={setPage}
      onSearch={setSearch}
      headerPortalTarget={headerPortalTarget}
      router={router}
    />
  );
}
