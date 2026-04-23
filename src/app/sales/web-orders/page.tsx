'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpDown, Search, Loader2, CreditCard, Truck, X, Download, Upload, ShoppingBag, Globe, ChevronDown, Check, Calendar,
} from 'lucide-react';
import Papa from 'papaparse';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WebOrder {
  _id: string;
  webId: number;
  number: string;
  status: string;
  currency: string;
  dateCreated: string;
  total: number;
  totalTax: number;
  shippingTotal: number;
  discountTotal: number;
  billing: {
    firstName: string; lastName: string; email: string; phone: string;
    city: string; state: string; country: string;
  };
  firstName: string; lastName: string; email: string; phone: string;
  city: string; state: string; country: string;
  paymentMethodTitle: string;
  website: string;
  platform?: string;
  lineItems: any[];
}

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  orders: WebOrder[]; hasMore: boolean; page: number;
  sortBy: string; sortOrder: string; search: string; status: string; websites: string[]; fromDate: string; toDate: string; timestamp: number;
}
const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Columns ─────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'dateCreated', label: 'Date', width: 'w-[90px]' },
  { key: 'number', label: 'Order #', width: 'w-[80px]' },
  { key: 'website', label: 'Website', width: 'w-[160px]' },
  { key: 'billing.firstName', label: 'Customer', width: 'w-[160px]' },
  { key: 'billing.city', label: 'Location', width: 'w-[130px]' },
  { key: 'status', label: 'Status', width: 'w-[95px]' },
  { key: 'total', label: 'Total', width: 'w-[100px]', align: 'text-right' as const },
  { key: 'shippingTotal', label: 'Shipping', width: 'w-[80px]', align: 'text-right' as const },
  { key: 'discountTotal', label: 'Discount', width: 'w-[80px]', align: 'text-right' as const },
  { key: 'totalTax', label: 'Tax', width: 'w-[70px]', align: 'text-right' as const },
  { key: 'paymentMethodTitle', label: 'Payment', width: 'w-[110px]' },
  { key: 'lineItems', label: 'Items', width: 'w-[55px]', align: 'text-right' as const },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v: number) {
  if (!v && v !== 0) return <span className="text-muted-foreground/30">—</span>;
  if (v === 0) return <span className="text-muted-foreground/30">—</span>;
  return <span className="tabular-nums">${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, { bg: string; color: string }> = {
    'completed': { bg: '#059669', color: '#ffffff' },
    'processing': { bg: '#0284c7', color: '#ffffff' },
    'on-hold': { bg: '#d97706', color: '#ffffff' },
    'pending': { bg: '#e2e8f0', color: '#000000' },
    'cancelled': { bg: '#dc2626', color: '#ffffff' },
    'refunded': { bg: '#7c3aed', color: '#ffffff' },
    'failed': { bg: '#991b1b', color: '#ffffff' },
  };
  const s = styleMap[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
      style={s ? { backgroundColor: s.bg, color: s.color, borderRadius: '4px' } : { borderRadius: '4px' }}>
      {status || '—'}
    </span>
  );
}

function WebsiteBadge({ website, platform }: { website: string; platform?: string }) {
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
    <div className="flex items-center gap-2">
      <span
        className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap inline-flex items-center"
        style={{ background: s.bg, color: s.color }}
      >
        {website || 'N/A'}
      </span>
      {platform === 'shopify' ? (
        <img src="/shopify.png" alt="Shopify Order" title="Shopify Order" className="w-5 h-5 object-contain shrink-0" />
      ) : (
        <img src="/woocomerce.png" alt="WooCommerce Order" title="WooCommerce Order" className="w-5 h-5 object-contain shrink-0" />
      )}
    </div>
  );
}

// ─── Skeleton Row ────────────────────────────────────────────────────────────

function WebSkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/30">
      {COLUMNS.map((col) => (
        <td key={col.key} className={cn('px-2 py-2.5', col.width)}>
          <div className={cn('h-3.5 rounded-sm bg-secondary animate-pulse',
            col.key === 'billing.firstName' ? 'w-4/5' : col.key === 'status' ? 'w-14' : col.key === 'number' ? 'w-10' : 'w-8'
          )} style={{ animationDelay: `${index * 30}ms` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

const WebTableRow = React.memo(function WebTableRow({
  order, onClick, highlight
}: { order: WebOrder; onClick: () => void; highlight?: boolean }) {
  return (
    <tr data-order-id={order._id}
      className={cn(
        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
        highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
      )}
      onClick={onClick}>
      <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-foreground/60">
        {order.dateCreated ? formatDate(order.dateCreated) : '-'}
      </td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono font-bold text-foreground/90 group-hover:text-foreground transition-colors">
        <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all">#{order.number}</span>
      </td>
      <td className="px-2.5 py-2.5 w-[160px]"><WebsiteBadge website={order.website} platform={order.platform} /></td>
      <td className="px-2.5 py-2.5 w-[160px] text-[12px] text-foreground/90 group-hover:text-foreground transition-colors font-semibold truncate">
        {order.billing?.firstName} {order.billing?.lastName}
      </td>
      <td className="px-2.5 py-2.5 w-[130px] text-[12px] text-foreground/60 truncate">
        {order.billing?.city}{order.billing?.state ? `, ${order.billing.state}` : ''}
      </td>
      <td className="px-2.5 py-2.5 w-[95px]"><StatusBadge status={order.status} /></td>
      <td className="px-2.5 py-2.5 w-[100px] text-[12px] font-mono text-right font-black text-foreground group-hover:text-foreground transition-colors">{fmtCurrency(order.total)}</td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(order.shippingTotal)}</td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(order.discountTotal)}</td>
      <td className="px-2.5 py-2.5 w-[70px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(order.totalTax)}</td>
      <td className="px-2.5 py-2.5 w-[110px] text-[12px] text-foreground/60 truncate">
        <div className="flex items-center gap-1.5"><CreditCard className="w-3 h-3 opacity-40 shrink-0" /><span className="truncate">{order.paymentMethodTitle || '-'}</span></div>
      </td>
      <td className="px-2.5 py-2.5 w-[55px] text-[12px] font-mono text-right">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-secondary text-[9px] font-black text-foreground/70">{order.lineItems?.length || 0}</span>
      </td>
    </tr>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function WebOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<WebOrder[]>(globalCache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(() => {
    if (!globalCache.current) return true;
    if (!globalCache.current.orders || globalCache.current.orders.length === 0) return true;
    return false;
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'dateCreated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc');
  const [activeStatus, setActiveStatus] = useState<string>(searchParams.get('status') || 'All');
  const [selectedWebsites, setSelectedWebsites] = useState<string[]>(searchParams.get('websites') ? searchParams.get('websites')!.split(',') : []);
  const [availableWebsites, setAvailableWebsites] = useState<string[]>([]);
  const [websiteDropdownOpen, setWebsiteDropdownOpen] = useState(false);
  const websiteDropdownRef = useRef<HTMLDivElement | null>(null);

  // Date Filter
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement | null>(null);
  const [datePreset, setDatePreset] = useState<string>(searchParams.get('datePreset') || 'All Time');
  const [fromDate, setFromDate] = useState<string>(searchParams.get('fromDate') || '');
  const [toDate, setToDate] = useState<string>(searchParams.get('toDate') || '');

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
    } else if (preset === 'All Time') {
      start = '';
      end = '';
    }

    setDatePreset(preset);
    setFromDate(start);
    setToDate(end);
    setDateFilterOpen(false);
  };

  // Product filter (from web-products page link)
  const productIdFilter = searchParams.get('productId') || '';
  const variationIdFilter = searchParams.get('variationId') || '';
  const websiteFilter = searchParams.get('website') || '';

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

  // Fetch available websites
  useEffect(() => {
    fetch('/api/retail/web-orders/websites').then(r => r.json()).then(d => {
      if (d.websites) setAvailableWebsites(d.websites.sort());
    }).catch(() => {});
  }, []);

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (websiteDropdownRef.current && !websiteDropdownRef.current.contains(e.target as Node)) {
        setWebsiteDropdownOpen(false);
      }
      if (dateFilterRef.current && !dateFilterRef.current.contains(e.target as Node)) {
        setDateFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sortBy !== 'dateCreated') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    if (activeStatus !== 'All') params.set('status', activeStatus);
    if (selectedWebsites.length > 0) params.set('websites', selectedWebsites.join(','));
    if (datePreset !== 'All Time') params.set('datePreset', datePreset);
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    if (productIdFilter) params.set('productId', productIdFilter);
    if (variationIdFilter) params.set('variationId', variationIdFilter);
    if (websiteFilter) params.set('website', websiteFilter);

    const qs = params.toString();
    const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}`;
    
    // Only replace if it has actually changed to prevent infinite loops
    const currentQs = window.location.search.replace(/^\?/, '');
    if (currentQs !== qs) {
      router.replace(newUrl, { scroll: false });
    }
  }, [debouncedSearch, sortBy, sortOrder, activeStatus, selectedWebsites, datePreset, fromDate, toDate, productIdFilter, variationIdFilter, websiteFilter, router]);

  // Scroll-back & highlight
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const savedId = sessionStorage.getItem('wo_scroll_to');
    const savedScroll = sessionStorage.getItem('wo_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('wo_scroll_to'); sessionStorage.removeItem('wo_scroll_top');
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
  const STATUS_TABS = ['All', 'processing', 'completed', 'on-hold', 'pending', 'refunded'] as const;
  const STATUS_LABELS: Record<string, string> = { All: 'All', processing: 'Processing', completed: 'Completed', 'on-hold': 'On Hold', pending: 'Pending', cancelled: 'Cancelled', refunded: 'Refunded', failed: 'Failed' };
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ All: 0, processing: 0, completed: 0, 'on-hold': 0, pending: 0, cancelled: 0, refunded: 0, failed: 0 });
  const [countsLoaded, setCountsLoaded] = useState(false);
  const fetchStatusCounts = useCallback(async () => {
    try { const res = await fetch('/api/retail/web-orders/counts'); if (res.ok) { const d = await res.json(); if (d.counts) { setStatusCounts(d.counts); setCountsLoaded(true); } } } catch { }
  }, []);
  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);
  useEffect(() => { if (orders.length > 0) fetchStatusCounts(); }, [orders.length, fetchStatusCounts]);

  // Export/Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExportLineItems = async () => {
    setExporting(true); const toastId = toast.loading('Exporting line items...');
    try {
      const res = await fetch('/api/retail/web-orders/export-lineitems'); const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Export failed');
      const csv = Papa.unparse(json.data); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `web-order-lineitems-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
      toast.success(`Exported ${json.total} line items`, { id: toastId });
    } catch (e: any) { toast.error(e.message || 'Export failed', { id: toastId }); } finally { setExporting(false); }
  };

  const handleImportLineItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); const toastId = toast.loading('Parsing CSV...');
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          const allRows = results.data as any[]; const BATCH = 2000; const totalBatches = Math.ceil(allRows.length / BATCH);
          let totalUpdated = 0, totalSkipped = 0, totalErrors = 0;
          for (let i = 0; i < totalBatches; i++) {
            toast.loading(`Uploading batch ${i + 1}/${totalBatches}...`, { id: toastId });
            const res = await fetch('/api/retail/web-orders/update-lineitems', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: allRows.slice(i * BATCH, (i + 1) * BATCH) }) });
            const json = await res.json(); if (!res.ok) throw new Error(json.error || `Batch ${i + 1} failed`);
            totalUpdated += json.updated || 0; totalSkipped += json.skipped || 0; totalErrors += json.errorCount || 0;
          }
          toast.success(`Done! Updated: ${totalUpdated} | Skipped: ${totalSkipped}${totalErrors ? ` | Errors: ${totalErrors}` : ''}`, { id: toastId, duration: 6000 });
          refreshOrders();
        } catch (err: any) { toast.error(err.message || 'Import failed', { id: toastId }); }
        finally { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
      },
      error: (err) => { toast.error(`CSV parse error: ${err.message}`, { id: toastId }); setImporting(false); }
    });
  };

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const seq = ++seqRef.current; fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true); else setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE), sortBy, sortOrder, search: debouncedSearch });
      if (activeStatus !== 'All') params.set('status', activeStatus);
      if (fromDate) params.set('fromDate', fromDate);
      if (toDate) params.set('toDate', toDate);
      if (productIdFilter) params.set('productId', productIdFilter);
      if (variationIdFilter) params.set('variationId', variationIdFilter);
      // Website filter: URL param takes priority, else use interactive selection
      const effectiveWebsites = websiteFilter || selectedWebsites.join(',');
      if (effectiveWebsites) params.set('website', effectiveWebsites);
      const res = await fetch(`/api/retail/web-orders?${params}`, { signal: ctrl.signal });
      const data = await res.json();
      if (seq !== seqRef.current || !mountedRef.current) return;
      if (res.ok) {
        const newOrders = data.orders || []; const newHasMore = data.hasMore ?? false;
        if (isAppend) {
          setOrders(prev => {
            const ids = new Set(prev.map(o => o._id));
            const merged = [...prev, ...newOrders.filter((o: WebOrder) => !ids.has(o._id))];
            globalCache.current = { orders: merged, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, websites: selectedWebsites, fromDate, toDate, timestamp: Date.now() };
            return merged;
          });
        } else {
          setOrders(newOrders);
          globalCache.current = { orders: newOrders, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, websites: selectedWebsites, fromDate, toDate, timestamp: Date.now() };
        }
        setHasMore(newHasMore); pageRef.current = pageNum; setError(null);
      } else { setError(data.error || 'Failed to fetch'); }
    } catch (e: any) { if (e?.name === 'AbortError') return; if (mountedRef.current) setError(e.message); }
    finally { fetchingRef.current = false; if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); } }
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, productIdFilter, variationIdFilter, websiteFilter, selectedWebsites, fromDate, toDate]);

  const fetchPageRef = useRef(fetchPage); fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      const c = globalCache.current;
      if (c && c.orders.length > 0 && (Date.now() - c.timestamp) < CACHE_TTL && c.sortBy === sortBy && c.sortOrder === sortOrder && c.search === debouncedSearch && c.status === activeStatus && JSON.stringify(c.websites) === JSON.stringify(selectedWebsites) && c.fromDate === fromDate && c.toDate === toDate) {
        setOrders(c.orders); setHasMore(c.hasMore); pageRef.current = c.page; setIsLoading(false); return;
      }
    }
    globalCache.current = null; pageRef.current = 0; setOrders([]); setHasMore(true);
    fetchPageRef.current(1, false);
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, selectedWebsites, fromDate, toDate]);

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
  const refreshOrders = () => { globalCache.current = null; pageRef.current = 0; setOrders([]); setHasMore(true); fetchPageRef.current(1, false); };

  // ─── Status Tab Colors ─────────────────────────────────────────────────────
  const statusColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
    'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
    'processing': { bg: '#0284c7', color: '#ffffff', hoverBg: 'rgba(2,132,199,0.08)' },
    'completed': { bg: '#059669', color: '#ffffff', hoverBg: 'rgba(5,150,105,0.08)' },
    'on-hold': { bg: '#d97706', color: '#ffffff', hoverBg: 'rgba(217,119,6,0.08)' },
    'pending': { bg: '#64748b', color: '#ffffff', hoverBg: 'rgba(100,116,139,0.08)' },
    'cancelled': { bg: '#dc2626', color: '#ffffff', hoverBg: 'rgba(220,38,38,0.08)' },
    'refunded': { bg: '#7c3aed', color: '#ffffff', hoverBg: 'rgba(124,58,237,0.08)' },
    'failed': { bg: '#991b1b', color: '#ffffff', hoverBg: 'rgba(153,27,27,0.08)' },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background">
        {/* Product filter banner */}
        {productIdFilter && (
          <div className="px-4 py-2 bg-primary/5 border-b border-primary/10 flex items-center gap-3">
            <ShoppingBag className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-primary">
              Filtered by Product ID: <span className="font-mono">{productIdFilter}</span>
              {variationIdFilter && <> &middot; Variation: <span className="font-mono">{variationIdFilter}</span></>}
              {websiteFilter && <> &middot; Website: <span className="font-mono">{websiteFilter}</span></>}
            </span>
            <button
              onClick={() => router.push('/sales/web-orders')}
              className="ml-auto text-[10px] font-bold text-primary/70 hover:text-primary px-2 py-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        )}
        <div className="px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Web Orders</h1>
          </div>
          <div className="h-5 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {STATUS_TABS.map((tab) => {
              const sc = statusColors[tab]; const isActive = activeStatus === tab;
              return (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                  style={isActive ? { backgroundColor: sc?.bg, color: sc?.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { color: 'inherit', backgroundColor: 'transparent' }}
                  onMouseEnter={e => { if (!isActive && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                  {STATUS_LABELS[tab]}
                  <span className="ml-1.5 text-[11px] tabular-nums" style={{ opacity: isActive ? 0.75 : 0.5 }}>
                    {countsLoaded ? statusCounts[tab]?.toLocaleString() || 0 : <span className="inline-block w-4 h-3 rounded-sm bg-muted-foreground/10 animate-pulse align-middle" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-5 w-px bg-border shrink-0" />

          {/* Website Filter Dropdown */}
          <div ref={websiteDropdownRef} className="relative shrink-0">
            <button
              onClick={() => setWebsiteDropdownOpen(p => !p)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border',
                selectedWebsites.length > 0
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
              )}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="uppercase tracking-wider">
                {selectedWebsites.length === 0 ? 'All Sites' : selectedWebsites.length === 1 ? selectedWebsites[0] : `${selectedWebsites.length} Sites`}
              </span>
              <ChevronDown className={cn('w-3 h-3 transition-transform', websiteDropdownOpen && 'rotate-180')} />
            </button>

            {websiteDropdownOpen && (
              <div className="absolute top-full mt-1.5 right-0 z-50 bg-background border border-border rounded-xl shadow-2xl min-w-[220px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-border bg-secondary">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Filter by Website</span>
                </div>
                <div className="py-1 max-h-[280px] overflow-y-auto scrollbar-custom">
                  {/* All option */}
                  <button
                    onClick={() => { setSelectedWebsites([]); setWebsiteDropdownOpen(false); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-semibold hover:bg-secondary transition-colors cursor-pointer text-left',
                      selectedWebsites.length === 0 && 'text-primary'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                      selectedWebsites.length === 0 ? 'bg-primary border-primary' : 'border-border'
                    )}>
                      {selectedWebsites.length === 0 && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span>All Websites</span>
                  </button>

                  {availableWebsites.map(ws => {
                    const isSelected = selectedWebsites.includes(ws);
                    return (
                      <button
                        key={ws}
                        onClick={() => {
                          setSelectedWebsites(prev =>
                            isSelected ? prev.filter(w => w !== ws) : [...prev, ws]
                          );
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-semibold hover:bg-secondary transition-colors cursor-pointer text-left"
                      >
                        <div className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                          isSelected ? 'bg-primary border-primary' : 'border-border'
                        )}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <WebsiteBadge website={ws} />
                      </button>
                    );
                  })}
                </div>
                {selectedWebsites.length > 0 && (
                  <div className="px-3 py-2 border-t border-border bg-secondary">
                    <button
                      onClick={() => { setSelectedWebsites([]); setWebsiteDropdownOpen(false); }}
                      className="text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-8 h-8 w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded" />
            {search && (<button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"><X className="h-3 w-3" /></button>)}
          </div>
          {/* Date Filter */}
          <div ref={dateFilterRef} className="relative shrink-0">
            <button
              onClick={() => setDateFilterOpen(p => !p)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-8 rounded-lg border border-border text-[11px] font-semibold transition-all cursor-pointer bg-background hover:bg-secondary',
                (fromDate || toDate)
                  ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="uppercase tracking-wider text-nowrap">
                {datePreset !== 'All Time' ? datePreset : (fromDate || toDate) ? 'Custom' : 'All Time'}
              </span>
              <ChevronDown className={cn('w-3 h-3 transition-transform', dateFilterOpen && 'rotate-180')} />
            </button>
            {dateFilterOpen && (
              <div className="absolute top-full mt-1.5 right-0 z-50 bg-background border border-border rounded-xl shadow-2xl min-w-[280px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-3 py-2 border-b border-border bg-secondary flex justify-between items-center">
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date Filter</span>
                  {(fromDate || toDate || datePreset !== 'All Time') && (
                    <button onClick={() => { setDatePreset('All Time'); setFromDate(''); setToDate(''); setDateFilterOpen(false); }} className="text-[9px] font-bold text-primary hover:underline cursor-pointer">
                      Clear
                    </button>
                  )}
                </div>
                <div className="p-3 bg-background grid gap-1.5 grid-cols-2 text-center pb-3 border-b border-border">
                  {['All Time', 'This Month', 'Last Month', 'This Year', 'Last Year'].map((preset, idx) => (
                    <button
                      key={preset}
                      onClick={() => handleDatePreset(preset)}
                      className={cn(
                        'px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer',
                        preset === 'All Time' && idx === 0 ? 'col-span-2' : '',
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
          {/* Export */}
          <button onClick={handleExportLineItems} disabled={exporting}
            className="flex items-center space-x-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-wider rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50 shrink-0">
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}<span>Export</span>
          </button>
          {/* Import */}
          <button onClick={() => fileInputRef.current?.click()} disabled={importing}
            className="flex items-center space-x-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-wider rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50 shrink-0">
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}<span>Import</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleImportLineItems} className="hidden" />
        </div>
      </div>

      {/* Table */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary dark:hover:bg-secondary transition-colors border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                      col.width, col.align || 'text-left'
                    )}>
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
                Array.from({ length: 25 }).map((_, i) => <WebSkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={12} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={12} className="px-2 py-16 text-center">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                    {debouncedSearch ? 'No matching orders' : activeStatus !== 'All' ? `No ${STATUS_LABELS[activeStatus]} orders` : 'No orders found'}
                  </p>
                </td></tr>
              ) : (
                orders.map(order => (
                  <WebTableRow key={order._id} order={order} highlight={highlightId === order._id}
                    onClick={() => {
                      sessionStorage.setItem('wo_scroll_to', order._id);
                      if (scrollRef.current) sessionStorage.setItem('wo_scroll_top', String(scrollRef.current.scrollTop));
                      router.push(`/sales/web-orders/${order._id}`);
                    }} />
                ))
              )}
              {isLoadingMore && Array.from({ length: 8 }).map((_, i) => <WebSkeletonRow key={`m-${i}`} index={i} />)}
            </tbody>
          </table>
          <div ref={sentinelRef} className="h-1" />
          {!isLoading && !hasMore && orders.length > 0 && (
            <div className="flex items-center justify-center py-4 gap-2">
              <div className="h-px w-12 bg-border" />
              <span className="text-[12px] text-muted-foreground/40 uppercase tracking-widest font-bold">{orders.length} orders loaded</span>
              <div className="h-px w-12 bg-border" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WebOrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
        <div className="shrink-0 border-b border-border bg-background px-4 py-2.5 flex items-center gap-4">
          <div className="h-4 w-4 rounded bg-secondary animate-pulse" />
          <div className="h-4 w-32 rounded bg-secondary animate-pulse" />
          <div className="h-5 w-px bg-border" />
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-6 w-16 rounded-lg bg-secondary animate-pulse" />)}
        </div>
        <div className="flex-1 p-2">
          <table className="w-full"><tbody>
            {Array.from({ length: 20 }).map((_, i) => <WebSkeletonRow key={i} index={i} />)}
          </tbody></table>
        </div>
      </div>
    }>
      <WebOrdersContent />
    </Suspense>
  );
}
