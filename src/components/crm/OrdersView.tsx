'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown,
  Search,
  Plus,
  X,
  ShoppingCart,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { SaleOrderModal } from '@/components/sales/SaleOrderModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LineItem {
  _id?: string;
  sku: { _id: string; name: string } | string;
  lotNumber?: string;
  qtyShipped: number;
  uom: string;
  price: number;
  total: number;
  cost?: number;
  createdAt: string;
}

interface SaleOrder {
  _id: string;
  label: string;
  clientId: { _id: string; name: string } | string;
  salesRep: { _id: string; firstName: string; lastName: string } | string;
  orderStatus: string;
  paymentMethod: string;
  shippedDate?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  shippingCost?: number;
  tax?: number;
  discount?: number;
  category?: string;
  shippingAddress?: string;
  city?: string;
  state?: string;
  lockPrice?: boolean;
  totalAmount?: number;
  createdAt: string;
  lineItems: LineItem[];
  payments?: { paymentAmount: number }[];
}

interface OrdersViewProps {
  clientId?: string;
}

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  orders: SaleOrder[];
  hasMore: boolean;
  page: number;
  sortBy: string;
  sortOrder: string;
  search: string;
  status: string;
  clientId: string;
  timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Table Columns ───────────────────────────────────────────────────────────

function getColumns(clientId?: string) {
  const cols = [
    { key: 'label', label: 'Order #', width: 'w-[80px]' },
    { key: 'createdAt', label: 'Date', width: 'w-[90px]' },
    ...(!clientId ? [{ key: 'client', label: 'Client', width: 'w-[180px]' }] : []),
    { key: 'totalAmount', label: 'Amount', width: 'w-[100px]', align: 'text-right' as const },
    { key: 'balance', label: 'Balance', width: 'w-[100px]', align: 'text-right' as const },
    { key: 'orderStatus', label: 'Status', width: 'w-[100px]' },
    { key: 'salesRep', label: 'Rep', width: 'w-[120px]' },
  ];
  return cols;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeOrderTotal(order: SaleOrder): number {
  const lineTotal = (order.lineItems || []).reduce((sum, li) => sum + (li.total || 0), 0);
  return lineTotal + (order.shippingCost || 0) + (order.tax || 0) - (order.discount || 0);
}

function computeOrderBalance(order: SaleOrder): number {
  const total = computeOrderTotal(order);
  const paid = (order.payments || []).reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
  return total - paid;
}

function formatCurrency(v: number) {
  if (!v && v !== 0) return <span className="text-muted-foreground/30">—</span>;
  if (v === 0) return <span className="text-muted-foreground/30">—</span>;
  return <span className="tabular-nums">${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, { bg: string; color: string; border?: string; darkBg?: string; darkColor?: string }> = {
    'Completed': { bg: '#000000', color: '#ffffff', darkBg: 'rgba(16,185,129,0.2)', darkColor: '#34d399' },
    'Pending': { bg: '#e2e8f0', color: '#000000', border: '1px solid #cbd5e1', darkBg: 'rgba(100,116,139,0.2)', darkColor: '#cbd5e1' },
    'Processing': { bg: '#2563eb', color: '#ffffff', darkBg: 'rgba(59,130,246,0.2)', darkColor: '#60a5fa' },
    'Shipped': { bg: '#7c3aed', color: '#ffffff', darkBg: 'rgba(124,58,237,0.2)', darkColor: '#a78bfa' },
    'Cancelled': { bg: '#dc2626', color: '#ffffff', darkBg: 'rgba(220,38,38,0.2)', darkColor: '#f87171' },
    'Issued': { bg: '#64748b', color: '#ffffff', darkBg: 'rgba(100,116,139,0.2)', darkColor: '#cbd5e1' },
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

function SkeletonRow({ index, colCount }: { index: number; colCount: number }) {
  return (
    <tr className="border-b border-border/30">
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-2 py-2.5">
          <div
            className={cn(
              'h-3.5 rounded-sm bg-secondary/80 animate-pulse',
              i === 0 ? 'w-10' : i === 2 ? 'w-4/5' : 'w-12'
            )}
            style={{ animationDelay: `${index * 30}ms` }}
          />
        </td>
      ))}
    </tr>
  );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

const OrderTableRow = React.memo(function OrderTableRow({
  order, onClick, highlight, showClient
}: {
  order: SaleOrder; onClick: () => void; highlight?: boolean; showClient?: boolean;
}) {
  const total = computeOrderTotal(order);
  const balance = computeOrderBalance(order);
  const repName = typeof order.salesRep === 'object' && order.salesRep
    ? `${order.salesRep.firstName} ${order.salesRep.lastName}`
    : '';
  const clientName = typeof order.clientId === 'object' && order.clientId
    ? order.clientId.name
    : '';

  return (
    <tr
      data-order-id={order._id}
      className={cn(
        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
        highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
      )}
      onClick={onClick}
    >
      {/* Order # */}
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono font-bold text-foreground/90 group-hover:text-foreground transition-colors">
        <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all">{order.label || '-'}</span>
      </td>

      {/* Date */}
      <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-foreground/60">
        {formatDate(order.createdAt)}
      </td>

      {/* Client (conditional) */}
      {showClient && (
        <td className="px-2.5 py-2.5 w-[180px] text-[12px] text-foreground/90 group-hover:text-foreground transition-colors font-semibold truncate">
          {clientName || '-'}
        </td>
      )}

      {/* Amount */}
      <td className="px-2.5 py-2.5 w-[100px] text-[12px] font-mono text-right font-black text-emerald-500 group-hover:text-emerald-400 transition-colors">
        {formatCurrency(total)}
      </td>

      {/* Balance */}
      <td className={cn("px-2.5 py-2.5 w-[100px] text-[12px] font-mono text-right font-bold",
        balance > 0.01 ? 'text-red-500' : balance < -0.01 ? 'text-blue-500' : 'text-muted-foreground/30'
      )}>
        {Math.abs(balance) > 0.01 ? formatCurrency(balance) : <span className="text-muted-foreground/30">—</span>}
      </td>

      {/* Status */}
      <td className="px-2.5 py-2.5 w-[100px]"><StatusBadge status={order.orderStatus} /></td>

      {/* Rep */}
      <td className="px-2.5 py-2.5 w-[120px] text-[12px] font-medium text-foreground/60 truncate">{repName || '-'}</td>
    </tr>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

export default function OrdersView({ clientId }: OrdersViewProps) {
  const router = useRouter();
  const COLUMNS = getColumns(clientId);

  const [orders, setOrders] = useState<SaleOrder[]>(globalCache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeStatus, setActiveStatus] = useState<string>('All');

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Scroll-back & highlight
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const savedId = sessionStorage.getItem('order_scroll_to');
    const savedScroll = sessionStorage.getItem('order_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('order_scroll_to');
      sessionStorage.removeItem('order_scroll_top');
      setHighlightId(savedId);
      if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-order-id="${savedId}"]`);
        if (row) { setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); setTimeout(() => setHighlightId(null), 3000); }
        else if (attempts < 30) setTimeout(() => tryScroll(attempts + 1), 200);
      };
      setTimeout(() => tryScroll(), 100);
    }
  }, []);

  // Status tabs & counts
  const STATUS_TABS = ['All', 'Completed', 'Pending', 'Processing', 'Shipped', 'Issued', 'Cancelled'] as const;
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [countsLoaded, setCountsLoaded] = useState(false);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (clientId) params.set('client', clientId);
      const res = await fetch(`/api/wholesale/orders/counts?${params}`);
      if (res.ok) { const d = await res.json(); if (d.counts) { setStatusCounts(d.counts); setCountsLoaded(true); } }
    } catch { /* silent */ }
  }, [clientId]);

  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);
  useEffect(() => { if (orders.length > 0) fetchStatusCounts(); }, [orders.length, fetchStatusCounts]);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const seq = ++seqRef.current; fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true); else setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(pageNum), limit: String(PAGE_SIZE), sortBy, sortOrder, search: debouncedSearch,
      });
      if (clientId) params.set('client', clientId);
      if (activeStatus !== 'All') params.set('status', activeStatus);

      const res = await fetch(`/api/wholesale/orders?${params}`, { signal: ctrl.signal });
      const data = await res.json();
      if (seq !== seqRef.current || !mountedRef.current) return;

      if (res.ok) {
        const newOrders = data.orders || []; const newHasMore = data.hasMore ?? false;
        if (isAppend) {
          setOrders(prev => {
            const ids = new Set(prev.map(o => o._id));
            const merged = [...prev, ...newOrders.filter((o: SaleOrder) => !ids.has(o._id))];
            globalCache.current = { orders: merged, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, clientId: clientId || '', timestamp: Date.now() };
            return merged;
          });
        } else {
          setOrders(newOrders);
          globalCache.current = { orders: newOrders, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, clientId: clientId || '', timestamp: Date.now() };
        }
        setHasMore(newHasMore); pageRef.current = pageNum; setError(null);
      } else { setError(data.error || 'Failed to fetch'); }
    } catch (e: any) { if (e?.name === 'AbortError') return; if (mountedRef.current) setError(e.message); }
    finally { fetchingRef.current = false; if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); } }
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, clientId]);

  const fetchPageRef = useRef(fetchPage); fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      const c = globalCache.current;
      if (c && c.orders.length > 0 && (Date.now() - c.timestamp) < CACHE_TTL && c.sortBy === sortBy && c.sortOrder === sortOrder && c.search === debouncedSearch && c.status === activeStatus && c.clientId === (clientId || '')) {
        setOrders(c.orders); setHasMore(c.hasMore); pageRef.current = c.page; setIsLoading(false); return;
      }
    }
    globalCache.current = null; pageRef.current = 0; setOrders([]); setHasMore(true);
    fetchPageRef.current(1, false);
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, clientId]);

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current; const container = scrollRef.current;
    if (!sentinel || !container) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPage(pageRef.current + 1, true);
    }, { root: container, rootMargin: '600px' });
    obs.observe(sentinel); return () => obs.disconnect();
  }, [hasMore, isLoading, fetchPage]);

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(column); setSortOrder('asc'); }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: string) => { setActiveStatus(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); };

  const statusColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
    'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
    'Completed': { bg: '#000000', color: '#ffffff', hoverBg: 'rgba(0,0,0,0.06)' },
    'Pending': { bg: '#64748b', color: '#ffffff', hoverBg: 'rgba(100,116,139,0.08)' },
    'Processing': { bg: '#2563eb', color: '#ffffff', hoverBg: 'rgba(37,99,235,0.08)' },
    'Shipped': { bg: '#7c3aed', color: '#ffffff', hoverBg: 'rgba(124,58,237,0.08)' },
    'Issued': { bg: '#0891b2', color: '#ffffff', hoverBg: 'rgba(8,145,178,0.08)' },
    'Cancelled': { bg: '#dc2626', color: '#ffffff', hoverBg: 'rgba(220,38,38,0.08)' },
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background transition-colors duration-300">
      {/* ─── Page Header with Status Tabs, Search & Actions ──────────── */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-4 py-2.5 flex items-center gap-4">
          {/* Title */}
          <div className="flex items-center gap-2 shrink-0">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Orders</h1>
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {STATUS_TABS.map((tab) => {
              const sc = statusColors[tab]; const isActive = activeStatus === tab;
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
                  <span className="ml-1.5 text-[11px] tabular-nums" style={{ opacity: isActive ? 0.75 : 0.5 }}>
                    {countsLoaded
                      ? statusCounts[tab]?.toLocaleString() || 0
                      : <span className="inline-block w-4 h-3 rounded-sm bg-muted-foreground/10 animate-pulse align-middle" />
                    }
                  </span>
                </button>
              );
            })}
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
            onClick={() => setIsModalOpen(true)}
            className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline text-[12px] font-black uppercase tracking-widest">Add</span>
          </button>
        </div>
      </div>

      <SaleOrderModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { globalCache.current = null; pageRef.current = 0; setOrders([]); setHasMore(true); fetchPageRef.current(1, false); fetchStatusCounts(); }}
        initialClientId={clientId}
      />

      {/* Table */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
              <tr>
                {COLUMNS.map((col: any) => (
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
                Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} colCount={COLUMNS.length} />)
              ) : error ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-2 py-16 text-center">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                    <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                      {debouncedSearch ? 'No matching orders' : activeStatus !== 'All' ? `No ${activeStatus} orders` : 'No orders found'}
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <OrderTableRow
                    key={order._id}
                    order={order}
                    highlight={highlightId === order._id}
                    showClient={!clientId}
                    onClick={() => {
                      sessionStorage.setItem('order_scroll_to', order._id);
                      if (scrollRef.current) sessionStorage.setItem('order_scroll_top', String(scrollRef.current.scrollTop));
                      router.push(`/sales/wholesale-orders/${order._id}`);
                    }}
                  />
                ))
              )}

              {/* Loading more skeleton rows */}
              {isLoadingMore && (
                Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={`loading-${i}`} index={i} colCount={COLUMNS.length} />)
              )}
            </tbody>
          </table>

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />

          {/* End marker */}
          {!isLoading && !hasMore && orders.length > 0 && (
            <div className="flex items-center justify-center py-4 gap-2">
              <div className="h-px w-12 bg-border" />
              <span className="text-[12px] text-muted-foreground/40 uppercase tracking-widest font-bold">
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
