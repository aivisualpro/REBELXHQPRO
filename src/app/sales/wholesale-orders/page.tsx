'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpDown,
  Plus,
  Trash2,
  X,
  Pencil,
  AlertCircle,
  Printer,
  RefreshCw,
  Loader2,
  Package,
  Search,
  ShoppingCart,
  Save,
  Check,
  SquarePen
} from 'lucide-react';
import { cn, formatDate, toDateInputValue } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';


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

interface ItemForm {
  id: string;
  sku: string;
  qtyShipped: number;
  price: number;
  uom: string;
  lotNumber: string;
  cost: number;
  productDescription?: string;
  _originalSkuLabel?: string; // To handle legacy display
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
  totalAmount?: number; // Calculated on frontend or populated
  createdAt: string;
  lineItems: LineItem[];
  payments?: { paymentAmount: number }[];
}

const UOM_OPTIONS = [
  { label: 'Each', value: 'Each' },
  { label: 'Box', value: 'Box' },
  { label: 'Case', value: 'Case' },
  { label: 'Pack', value: 'Pack' },
  { label: 'Pair', value: 'Pair' },
  { label: 'Set', value: 'Set' },
  { label: 'Roll', value: 'Roll' },
  { label: 'Kg', value: 'Kg' },
  { label: 'Lb', value: 'Lb' },
  { label: 'M', value: 'M' },
  { label: 'Ft', value: 'Ft' },
  { label: 'L', value: 'L' },
  { label: 'Gal', value: 'Gal' }
];

const PAYMENT_METHODS = [
  { label: 'Cash', value: 'Cash' },
  { label: 'Credit Card', value: 'Credit Card' },
  { label: 'Check By Mail', value: 'Check By Mail' },
  { label: 'ACH', value: 'ACH' },
  { label: 'Nothing Due', value: 'Nothing Due' },
  { label: 'CC#', value: 'CC#' },
  { label: 'Mobile Check Deposit', value: 'Mobile Check Deposit' },
  { label: 'Auth Payment Link', value: 'Auth Payment Link' },
  { label: 'COD Check', value: 'COD Check' },
  { label: 'COD', value: 'COD' },
  { label: 'Consignment', value: 'Consignment' },
  { label: 'Net Terms', value: 'Net Terms' }
];

const SHIPPING_METHODS = [
  { label: 'FedEx', value: 'FedEx' },
  { label: 'UPS', value: 'UPS' },
  { label: 'USPS', value: 'USPS' },
  { label: 'DHL', value: 'DHL' },
  { label: 'Pickup', value: 'Pickup' },
  { label: 'LTL Freight', value: 'LTL Freight' },
  { label: 'Courier', value: 'Courier' }
];

// ─── In-Memory Cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  orders: SaleOrder[];
  hasMore: boolean;
  page: number;
  sortBy: string;
  sortOrder: string;
  search: string;
  status: string;
  timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Table Columns ───────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'label', label: 'Order#', width: 'w-[70px]' },
  { key: 'createdAt', label: 'Date', width: 'w-[85px]' },
  { key: 'clientId', label: 'Client', width: 'w-[160px]' },
  { key: 'salesRep', label: 'Sales Rep', width: 'w-[110px]' },
  { key: 'paymentMethod', label: 'Payment', width: 'w-[100px]' },
  { key: 'orderStatus', label: 'Status', width: 'w-[95px]' },
  { key: 'subtotal', label: 'Subtotal', width: 'w-[90px]', align: 'text-right' as const },
  { key: 'shippingCost', label: 'Shipping', width: 'w-[75px]', align: 'text-right' as const },
  { key: 'discount', label: 'Discount', width: 'w-[75px]', align: 'text-right' as const },
  { key: 'tax', label: 'Tax', width: 'w-[65px]', align: 'text-right' as const },
  { key: 'grandTotal', label: 'Total', width: 'w-[90px]', align: 'text-right' as const },
  { key: 'balance', label: 'Balance', width: 'w-[85px]', align: 'text-right' as const },
  { key: 'cost', label: 'Cost', width: 'w-[80px]', align: 'text-right' as const },
  { key: 'margin', label: 'Margin', width: 'w-[80px]', align: 'text-right' as const },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClientName(o: SaleOrder) {
  return typeof o.clientId === 'object' && o.clientId !== null ? o.clientId.name : String(o.clientId || '');
}

function getSalesRepName(o: SaleOrder) {
  return typeof o.salesRep === 'object' && o.salesRep !== null
    ? `${o.salesRep.firstName} ${o.salesRep.lastName}` : String(o.salesRep || '');
}

function fmtCurrency(v: number) {
  if (!v && v !== 0) return <span className="text-muted-foreground/30">—</span>;
  if (v === 0) return <span className="text-muted-foreground/30">—</span>;
  return <span className="tabular-nums">${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

function calcSubtotal(o: SaleOrder) {
  return o.lineItems?.reduce((s, i) => s + ((i.qtyShipped || 0) * (i.price || 0)), 0) || 0;
}
function calcCost(o: SaleOrder) {
  return o.lineItems?.reduce((s, i) => s + ((i.qtyShipped || 0) * (i.cost || 0)), 0) || 0;
}
function calcGrandTotal(o: SaleOrder) {
  return calcSubtotal(o) + (o.shippingCost || 0) + (o.tax || 0) - (o.discount || 0);
}
function calcBalance(o: SaleOrder) {
  const orderPaid = (o.payments || []).reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
  return calcGrandTotal(o) - orderPaid;
}
function calcMargin(o: SaleOrder) {
  return calcGrandTotal(o) - calcCost(o);
}

// Columns that are computed on the frontend and must be sorted client-side
const COMPUTED_SORT_COLUMNS = new Set(['subtotal', 'grandTotal', 'balance', 'cost', 'margin']);

// ─── Sub-components ──────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, { bg: string; color: string; border?: string; darkBg?: string; darkColor?: string }> = {
    'Completed': { bg: '#059669', color: '#ffffff', darkBg: 'rgba(16,185,129,0.2)', darkColor: '#34d399' },
    'Issued': { bg: '#0284c7', color: '#ffffff', darkBg: 'rgba(59,130,246,0.2)', darkColor: '#60a5fa' },
    'Pending Payment': { bg: '#d97706', color: '#ffffff', darkBg: 'rgba(245,158,11,0.2)', darkColor: '#fbbf24' },
    'Shipping': { bg: '#7c3aed', color: '#ffffff', darkBg: 'rgba(124,58,237,0.2)', darkColor: '#a78bfa' },
    'Picking': { bg: '#0891b2', color: '#ffffff', darkBg: 'rgba(8,145,178,0.2)', darkColor: '#22d3ee' },
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

function WholesaleSkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/30">
      {COLUMNS.map((col) => (
        <td key={col.key} className={cn('px-2 py-2.5', col.width)}>
          <div
            className={cn(
              'h-3.5 rounded-sm bg-secondary/80 animate-pulse',
              col.key === 'clientId' ? 'w-4/5' :
                col.key === 'orderStatus' ? 'w-14' :
                  col.key === 'salesRep' ? 'w-16' :
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

interface QuickEditValues {
  shippingCost: string;
  discount: string;
  tax: string;
}

const WholesaleTableRow = React.memo(function WholesaleTableRow({
  order, onClick, highlight, isQuickEdit, quickEditValues, onQuickEditChange
}: {
  order: SaleOrder; onClick: () => void; highlight?: boolean;
  isQuickEdit?: boolean;
  quickEditValues?: QuickEditValues;
  onQuickEditChange?: (orderId: string, field: keyof QuickEditValues, value: string) => void;
}) {
  const subtotal = calcSubtotal(order);
  const shipping = quickEditValues ? (parseFloat(quickEditValues.shippingCost) || 0) : (order.shippingCost ?? 0);
  const discount = quickEditValues ? (parseFloat(quickEditValues.discount) || 0) : (order.discount ?? 0);
  const tax = quickEditValues ? (parseFloat(quickEditValues.tax) || 0) : (order.tax ?? 0);
  const grandTotal = subtotal + shipping + tax - discount;
  const cost = calcCost(order);
  const margin = grandTotal - cost;
  const orderPaid = (order.payments || []).reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
  const balance = grandTotal - orderPaid;

  const isModified = quickEditValues && (
    (parseFloat(quickEditValues.shippingCost) || 0) !== (order.shippingCost || 0) ||
    (parseFloat(quickEditValues.discount) || 0) !== (order.discount || 0) ||
    (parseFloat(quickEditValues.tax) || 0) !== (order.tax || 0)
  );

  const handleInputChange = (field: keyof QuickEditValues, rawValue: string) => {
    if (!onQuickEditChange) return;
    const cleaned = rawValue.replace(/[^0-9.]/g, '');
    onQuickEditChange(order._id, field, cleaned);
  };

  return (
    <tr
      data-order-id={order._id}
      className={cn(
        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
        highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]',
        isModified && 'bg-amber-500/[0.06] dark:bg-amber-500/[0.04] border-l-2 border-l-amber-500'
      )}
      onClick={isQuickEdit ? undefined : onClick}
    >
      <td className="px-2.5 py-2.5 w-[70px] text-[12px] font-mono font-bold text-foreground/90 group-hover:text-foreground transition-colors">
        <span className="group-hover:border-l-2 group-hover:border-l-primary group-hover:pl-1.5 transition-all">{order.label || '-'}</span>
      </td>
      <td className="px-2.5 py-2.5 w-[85px] text-[12px] font-mono text-foreground/60">
        {formatDate(order.createdAt)}
      </td>
      <td className="px-2.5 py-2.5 w-[160px] text-[12px] text-foreground/90 group-hover:text-foreground transition-colors font-semibold truncate">
        {getClientName(order) || '-'}
      </td>
      <td className="px-2.5 py-2.5 w-[110px] text-[12px] font-medium text-foreground/60 truncate">{getSalesRepName(order) || '-'}</td>
      <td className="px-2.5 py-2.5 w-[100px] text-[12px] text-foreground/60">{order.paymentMethod || '-'}</td>
      <td className="px-2.5 py-2.5 w-[95px]"><OrderStatusBadge status={order.orderStatus} /></td>
      <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(subtotal)}</td>
      {isQuickEdit ? (
        <>
          <td className="px-1 py-1 w-[75px]">
            <input
              type="text"
              value={quickEditValues?.shippingCost || ''}
              onChange={(e) => handleInputChange('shippingCost', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="0.00"
              className="w-full h-7 px-1.5 text-[12px] font-mono text-right bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all"
            />
          </td>
          <td className="px-1 py-1 w-[75px]">
            <input
              type="text"
              value={quickEditValues?.discount || ''}
              onChange={(e) => handleInputChange('discount', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="0.00"
              className="w-full h-7 px-1.5 text-[12px] font-mono text-right bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all"
            />
          </td>
          <td className="px-1 py-1 w-[65px]">
            <input
              type="text"
              value={quickEditValues?.tax || ''}
              onChange={(e) => handleInputChange('tax', e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="0.00"
              className="w-full h-7 px-1.5 text-[12px] font-mono text-right bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-foreground transition-all"
            />
          </td>
        </>
      ) : (
        <>
          <td className="px-2.5 py-2.5 w-[75px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(shipping)}</td>
          <td className="px-2.5 py-2.5 w-[75px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(discount)}</td>
          <td className="px-2.5 py-2.5 w-[65px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(tax)}</td>
        </>
      )}
      <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-right font-black text-foreground group-hover:text-foreground transition-colors">{fmtCurrency(grandTotal)}</td>
      <td className={cn('px-2.5 py-2.5 w-[85px] text-[12px] font-mono text-right font-bold', balance > 0.01 ? 'text-red-500' : 'text-emerald-500')}>{fmtCurrency(balance)}</td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-right text-foreground/70">{fmtCurrency(cost)}</td>
      <td className={cn('px-2.5 py-2.5 w-[80px] text-[12px] font-mono text-right font-bold', margin < 0 ? 'text-red-500' : 'text-emerald-500')}>{fmtCurrency(margin)}</td>
    </tr>
  );
});

function SaleOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<SaleOrder[]>(globalCache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeStatus, setActiveStatus] = useState<string>('All');

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Sync search to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (debouncedSearch) {
      params.set('search', debouncedSearch);
    } else {
      params.delete('search');
    }
    const newUrl = params.toString() ? `/sales/wholesale-orders?${params.toString()}` : '/sales/wholesale-orders';
    router.replace(newUrl, { scroll: false });
  }, [debouncedSearch]);

  // Scroll-back & highlight on return from detail
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const savedId = sessionStorage.getItem('ws_scroll_to');
    const savedScroll = sessionStorage.getItem('ws_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('ws_scroll_to');
      sessionStorage.removeItem('ws_scroll_top');
      setHighlightId(savedId);
      if (savedScroll && scrollRef.current) {
        scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      }
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-order-id="${savedId}"]`);
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

  // Status tabs & counts
  const STATUS_TABS = ['All', 'Pending', 'Picking', 'Shipping', 'Pending Payment', 'Issued', 'Completed'] as const;
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    All: 0, Pending: 0, Picking: 0, Shipping: 0, 'Pending Payment': 0, Issued: 0, Completed: 0
  });
  const [countsLoaded, setCountsLoaded] = useState(false);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/wholesale/orders/counts');
      if (res.ok) {
        const data = await res.json();
        if (data.counts) { setStatusCounts(data.counts); setCountsLoaded(true); }
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);
  useEffect(() => { if (orders.length > 0) fetchStatusCounts(); }, [orders.length, fetchStatusCounts]);

  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('header-portal-target');
    if (el) setHeaderPortalTarget(el);
  }, []);

  // Filter Options (for modal)
  const [clientOptions, setClientOptions] = useState<{ label: string; value: string }[]>([]);
  const [salesRepOptions, setSalesRepOptions] = useState<{ label: string; value: string }[]>([]);

  // Create/Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [allClients, setAllClients] = useState<{ _id: string; name: string; salesPerson?: { _id: string; firstName: string; lastName: string } | string | null; addresses?: { street: string; city: string; state: string }[] }[]>([]);
  const [allUsers, setAllUsers] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);
  const [allSkus, setAllSkus] = useState<{ _id: string; name: string; salePrice?: number }[]>([]);

  const [newOrder, setNewOrder] = useState<{
    label: string;
    clientId: string;
    salesRep: string;
    paymentMethod: string;
    orderStatus: string;
    shippedDate: string;
    shippingMethod: string;
    trackingNumber: string;
    shippingCost: number | string;
    discount: number | string;
    tax: number | string;
    category: string;
    shippingAddress: string;
    city: string;
    state: string;
    lockPrice: boolean;
  }>({
    label: '',
    clientId: '',
    salesRep: '',
    paymentMethod: '',
    orderStatus: 'Picking',
    shippedDate: '',
    shippingMethod: '',
    trackingNumber: '',
    shippingCost: '',
    discount: '',
    tax: '',
    category: '',
    shippingAddress: '',
    city: '',
    state: '',
    lockPrice: false
  });
  const [newLineItems, setNewLineItems] = useState<ItemForm[]>([]);
  const [isRefreshingCosts, setIsRefreshingCosts] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');

  // ─── Quick Edit Mode ──────────────────────────────────────────────────────
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [quickEditData, setQuickEditData] = useState<Record<string, QuickEditValues>>({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  const handleQuickEditChange = useCallback((orderId: string, field: keyof QuickEditValues, value: string) => {
    setQuickEditData(prev => {
      const existing = prev[orderId];
      const order = orders.find(o => o._id === orderId);
      if (!order) return prev;
      const current = existing || {
        shippingCost: String(order.shippingCost || 0),
        discount: String(order.discount || 0),
        tax: String(order.tax || 0),
      };
      return { ...prev, [orderId]: { ...current, [field]: value } };
    });
  }, [orders]);

  const getModifiedOrders = useCallback(() => {
    return Object.entries(quickEditData).filter(([orderId, values]) => {
      const order = orders.find(o => o._id === orderId);
      if (!order) return false;
      return (
        (parseFloat(values.shippingCost) || 0) !== (order.shippingCost || 0) ||
        (parseFloat(values.discount) || 0) !== (order.discount || 0) ||
        (parseFloat(values.tax) || 0) !== (order.tax || 0)
      );
    });
  }, [quickEditData, orders]);

  const modifiedCount = getModifiedOrders().length;

  const handleBulkSave = async () => {
    const modified = getModifiedOrders();
    if (modified.length === 0) return;

    setIsBulkSaving(true);
    try {
      const updates = modified.map(([orderId, values]) => ({
        _id: orderId,
        shippingCost: parseFloat(values.shippingCost) || 0,
        discount: parseFloat(values.discount) || 0,
        tax: parseFloat(values.tax) || 0,
      }));

      const res = await fetch('/api/wholesale/orders/bulk-update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(`Updated ${data.count} order${data.count !== 1 ? 's' : ''}`);
        // Update local orders state optimistically
        setOrders(prev => prev.map(o => {
          const edit = quickEditData[o._id];
          if (edit && modified.some(([id]) => id === o._id)) {
            return { ...o, shippingCost: parseFloat(edit.shippingCost) || 0, discount: parseFloat(edit.discount) || 0, tax: parseFloat(edit.tax) || 0 };
          }
          return o;
        }));
        setQuickEditData({});
        // Also invalidate cache
        globalCache.current = null;
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save changes');
      }
    } catch (e) {
      toast.error('Error saving changes');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const toggleQuickEdit = () => {
    if (isQuickEditMode) {
      // Exiting: clear edits
      setQuickEditData({});
    } else {
      // Entering: pre-fill current values for all visible orders
      const initial: Record<string, QuickEditValues> = {};
      orders.forEach(o => {
        initial[o._id] = {
          shippingCost: String(o.shippingCost || 0),
          discount: String(o.discount || 0),
          tax: String(o.tax || 0),
        };
      });
      setQuickEditData(initial);
    }
    setIsQuickEditMode(!isQuickEditMode);
  };



  // Lot Selection Modal State
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [editingLotItemId, setEditingLotItemId] = useState<string | null>(null);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; orderId: string | null }>({
    isOpen: false,
    orderId: null
  });

  // Debounce search (old one removed, using the one in state section above)

  // Fetch active clients and Skus
  useEffect(() => {
    const fetchResources = async () => {
      try {
        const res = await fetch('/api/clients?limit=5000');
        if (res.ok) {
          const data = await res.json();
          const clients_list = data.clients || [];
          setAllClients(clients_list);
          setClientOptions(clients_list.map((c: any) => ({ label: c.name, value: c._id })));
        }
        const sRes = await fetch('/api/skus?limit=5000');
        if (sRes.ok) {
          const data = await sRes.json();
          setAllSkus(data.skus || []);
        }
        const uRes = await fetch('/api/users?limit=1000');
        if (uRes.ok) {
          const data = await uRes.json();
          const users = data.users || [];
          setAllUsers(users);
          setSalesRepOptions(users.map((u: any) => ({ label: `${u.firstName} ${u.lastName}`, value: u._id })));
        }
      } catch (error) {
        console.error("Failed to fetch resources", error);
      }
    };
    fetchResources();
  }, []);

  // Handle createFor URL parameter (auto-open modal with client pre-selected)
  useEffect(() => {
    const createForClientId = searchParams.get('createFor');
    if (createForClientId) {
      const initializeForClient = (client: any) => {
        let salesRepId = '';
        if (client.salesPerson) {
          if (typeof client.salesPerson === 'object' && client.salesPerson._id) {
            salesRepId = client.salesPerson._id;
          } else if (typeof client.salesPerson === 'string') {
            salesRepId = client.salesPerson;
          }
        }
        const mainAddress = client.addresses && client.addresses.length > 0
          ? client.addresses[0] : { street: '', city: '', state: '' };
        setNewOrder(prev => ({
          ...prev, clientId: client._id, salesRep: salesRepId,
          shippingAddress: mainAddress.street || '', city: mainAddress.city || '', state: mainAddress.state || ''
        }));
        setNewLineItems([]);
        setEditingOrderId(null);
        setIsCreateModalOpen(true);
        router.replace('/sales/wholesale-orders', { scroll: false });
      };
      const found = allClients.find(c => c._id === createForClientId);
      if (found) { initializeForClient(found); }
      else {
        fetch(`/api/clients/${createForClientId}`).then(res => res.json()).then(data => {
          if (data && data._id) initializeForClient(data);
        }).catch(err => console.error("Failed to fetch client for creation", err));
      }
    }
  }, [searchParams, allClients, router]);

  // Handle createNew URL parameter
  useEffect(() => {
    const createNew = searchParams.get('createNew');
    if (createNew === 'true') {
      openCreateModal();
      router.replace('/sales/wholesale-orders', { scroll: false });
    }
  }, [searchParams, router]);

  // Generate Label
  useEffect(() => {
    if (isCreateModalOpen && !editingOrderId) {
      const generateNextLabel = async () => {
        try {
          const res = await fetch('/api/wholesale/orders?limit=1&sortBy=createdAt&sortOrder=desc');
          if (res.ok) {
            const data = await res.json();
            if (data.orders && data.orders.length > 0) {
              const match = data.orders[0].label.match(/(\d+)/);
              if (match) { setNewOrder(prev => ({ ...prev, label: String(parseInt(match[0]) + 1) })); return; }
            }
          }
          setNewOrder(prev => ({ ...prev, label: '53002' }));
        } catch (e) { setNewOrder(prev => ({ ...prev, label: '53002' })); }
      };
      generateNextLabel();
    }
  }, [isCreateModalOpen, editingOrderId]);

  // ─── Fetch a page (manufacturing-style) ──────────────────────────────────
  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef(0);

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++reqSeqRef.current;
    fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true); else setIsLoading(true);

    try {
      const apiSortBy = COMPUTED_SORT_COLUMNS.has(sortBy) ? 'createdAt' : sortBy;
      const params = new URLSearchParams({
        page: String(pageNum), limit: String(PAGE_SIZE), sortBy: apiSortBy, sortOrder, search: debouncedSearch,
      });
      if (activeStatus !== 'All') params.set('status', activeStatus);

      const res = await fetch(`/api/wholesale/orders?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (seq !== reqSeqRef.current) return;
      if (!mountedRef.current) return;

      if (res.ok) {
        const newOrders = data.orders || [];
        const newHasMore = data.hasMore ?? false;
        if (isAppend) {
          setOrders(prev => {
            const existingIds = new Set(prev.map(o => o._id));
            const filtered = newOrders.filter((o: SaleOrder) => !existingIds.has(o._id));
            const merged = [...prev, ...filtered];
            globalCache.current = { orders: merged, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, timestamp: Date.now() };
            return merged;
          });
        } else {
          setOrders(newOrders);
          globalCache.current = { orders: newOrders, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, timestamp: Date.now() };
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

  // ─── Initial load & filter changes ────────────────────────────────────────
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);
  const prevFiltersRef = useRef({ sortBy, sortOrder, search: debouncedSearch, status: activeStatus });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const sortChanged = prev.sortBy !== sortBy || prev.sortOrder !== sortOrder;
    const otherFiltersChanged = prev.search !== debouncedSearch || prev.status !== activeStatus;
    prevFiltersRef.current = { sortBy, sortOrder, search: debouncedSearch, status: activeStatus };

    // If only sort changed and we're now sorting by a computed column, skip API re-fetch
    // (client-side sort via useMemo handles it)
    if (sortChanged && !otherFiltersChanged && COMPUTED_SORT_COLUMNS.has(sortBy)) {
      return;
    }
    // If sort changed from one computed to another computed, also skip
    if (sortChanged && !otherFiltersChanged && COMPUTED_SORT_COLUMNS.has(prev.sortBy) && COMPUTED_SORT_COLUMNS.has(sortBy)) {
      return;
    }

    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.orders.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch && cache.status === activeStatus) {
        setOrders(cache.orders); setHasMore(cache.hasMore); pageRef.current = cache.page; setIsLoading(false);
        return;
      }
    }
    globalCache.current = null; pageRef.current = 0; setOrders([]); setHasMore(true);
    fetchPageRef.current(1, false);
  }, [sortBy, sortOrder, debouncedSearch, activeStatus]);

  // ─── Scroll to load more ──────────────────────────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    if (!sentinel || !scrollContainer) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) {
        fetchPage(pageRef.current + 1, true);
      }
    }, { root: scrollContainer, rootMargin: '600px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, fetchPage]);

  // ─── Sort handler ─────────────────────────────────────────────────────────
  const handleSort = (column: string) => {
    if (sortBy === column) { setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(column); setSortOrder('asc'); }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Client-side sort for computed columns
  const sortedOrders = React.useMemo(() => {
    if (!COMPUTED_SORT_COLUMNS.has(sortBy)) return orders;
    const computeValue = (o: SaleOrder): number => {
      switch (sortBy) {
        case 'subtotal': return calcSubtotal(o);
        case 'grandTotal': return calcGrandTotal(o);
        case 'balance': return calcBalance(o);
        case 'cost': return calcCost(o);
        case 'margin': return calcMargin(o);
        default: return 0;
      }
    };
    const sorted = [...orders].sort((a, b) => {
      const aVal = computeValue(a);
      const bVal = computeValue(b);
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [orders, sortBy, sortOrder]);

  const handleTabChange = (tab: string) => {
    setActiveStatus(tab);
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Refresh orders (used after create/edit/delete)
  const refreshOrders = () => {
    globalCache.current = null; pageRef.current = 0; setOrders([]); setHasMore(true);
    fetchPageRef.current(1, false);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, orderId: id });
  };


  const confirmDelete = async () => {
    const { orderId } = deleteConfirm;
    if (!orderId) return;

    try {
      const res = await fetch(`/api/wholesale/orders/${orderId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Order deleted successfully');
        setDeleteConfirm({ isOpen: false, orderId: null });
        refreshOrders();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete order');
      }
    } catch (e) {
      toast.error('Error deleting order');
    }
  };


  const handleEditClick = (e: React.MouseEvent, order: SaleOrder) => {
    e.stopPropagation();
    setEditingOrderId(order._id);

    setNewOrder({
      label: order.label,
      clientId: typeof order.clientId === 'object' && order.clientId ? order.clientId._id : String(order.clientId || ''),
      salesRep: typeof order.salesRep === 'object' && order.salesRep ? order.salesRep._id : String(order.salesRep || ''),
      paymentMethod: order.paymentMethod || '',
      orderStatus: order.orderStatus,
      shippedDate: order.shippedDate || '',
      shippingMethod: (order as any).shippingMethod || '',
      trackingNumber: (order as any).trackingNumber || '',
      shippingCost: (order as any).shippingCost || '',
      discount: (order as any).discount || '',
      tax: (order as any).tax || '',
      category: (order as any).category || '',
      shippingAddress: (order as any).shippingAddress || '',
      city: (order as any).city || '',
      state: (order as any).state || '',
      lockPrice: (order as any).lockPrice || false
    });

    const items: ItemForm[] = (order.lineItems || []).map(item => ({
      id: Math.random().toString(),
      sku: typeof item.sku === 'object' && item.sku ? item.sku._id : (item.sku ? String(item.sku) : ''),
      qtyShipped: item.qtyShipped,
      price: item.price,
      cost: (item as any).cost || 0,
      uom: item.uom || 'Each',
      lotNumber: item.lotNumber || '',
      productDescription: (item as any).productDescription,
      _originalSkuLabel: typeof item.sku === 'object' && item.sku ? item.sku.name : ((item as any).productDescription || (item.sku ? String(item.sku) : ''))
    }));
    setNewLineItems(items);

    setIsCreateModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingOrderId(null);
    setNewOrder({
      label: '',
      clientId: '',
      salesRep: '',
      paymentMethod: '',
      orderStatus: 'Picking',
      shippedDate: '',
      shippingMethod: '',
      trackingNumber: '',
      shippingCost: '',
      discount: '',
      tax: '',
      category: '',
      shippingAddress: '',
      city: '',
      state: '',
      lockPrice: false
    });
    // Initialize with 3 empty items
    setNewLineItems([
      { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' },
      { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' },
      { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' }
    ]);
    setIsCreateModalOpen(true);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!newOrder.clientId) {
      toast.error('Please select a client');
      return;
    }
    if (!newOrder.salesRep) {
      toast.error('Sales Rep is required');
      return;
    }
    if (!newOrder.shippingAddress) {
      toast.error('Address is required');
      return;
    }

    if (newLineItems.length === 0) {
      toast.error('At least 1 line item is required');
      return;
    }
    // Validate each line item has a SKU
    const invalidItems = newLineItems.filter(item => !item.sku);
    if (invalidItems.length > 0) {
      toast.error('All line items must have a SKU selected');
      return;
    }

    const payload = {
      ...newOrder,
      shippingCost: Number(newOrder.shippingCost) || 0,
      discount: Number(newOrder.discount) || 0,
      tax: Number(newOrder.tax) || 0,
      lineItems: newLineItems.map(item => ({
        sku: item.sku,
        qtyShipped: item.qtyShipped,
        price: item.price,
        uom: item.uom,
        lotNumber: item.lotNumber,
        cost: item.cost,
        total: (item.qtyShipped || 0) * (item.price || 0)
      }))
    };

    try {
      let res;
      if (editingOrderId) {
        res = await fetch(`/api/wholesale/orders/${editingOrderId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        res = await fetch('/api/wholesale/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (res && res.ok) {
        toast.success(editingOrderId ? 'Order updated' : 'Order created');
        setIsCreateModalOpen(false);
        setEditingOrderId(null);
        refreshOrders();
      } else {
        toast.error('Failed to save order');
      }
    } catch (e) {
      toast.error('Error saving order');
    }
  };

  const addLineItem = () => {
    setNewLineItems([...newLineItems, { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' }]);
  };

  const removeLineItem = (id: string) => {
    setNewLineItems(newLineItems.filter(i => i.id !== id));
  };

  const updateLineItem = async (id: string, field: keyof ItemForm, value: any) => {
    setNewLineItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));

    // Async updates for Side Effects (Price & Lot Auto-Suggest)
    if (field === 'sku') {
      const skuObj = allSkus.find(s => s._id === value);
      let newPrice = 0;
      let newLot = '';
      let newCost = 0;

      if (skuObj && skuObj.salePrice) {
        newPrice = skuObj.salePrice;
      }

      // Auto-Suggest Lot (FIFO)
      try {
        const res = await fetch(`/api/warehouse/skus/${value}/lots`);
        if (res.ok) {
          const data = await res.json();
          const lots = data.lots || [];
          // Sort Oldest First
          const sorted = lots.sort((a: any, b: any) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateA - dateB;
          });
          const suggested = sorted.find((l: any) => l.balance > 0);
          if (suggested) {
            newLot = suggested.lotNumber;
            newCost = suggested.cost || 0;
          }
        }
      } catch (e) {
        console.error("Failed to auto-suggest lot", e);
      }

      setNewLineItems(prev => prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            price: newPrice || item.price,
            lotNumber: newLot,
            cost: newCost
          };
        }
        return item;
      }));
    }
  };

  const handleRefreshCosts = async () => {
    if (newLineItems.length === 0) return;

    setIsRefreshingCosts(true);
    setRefreshProgress('Preparing...');

    // We will update items one by one or in parallel? One by one to show progress clearly as requested.
    const total = newLineItems.length;
    const updatedItems = [...newLineItems];
    let changedCount = 0;

    for (let i = 0; i < total; i++) {
      const item = updatedItems[i];
      if (item.sku && item.lotNumber) {
        setRefreshProgress(`Fetching Lot ${item.lotNumber}... ${Math.round(((i + 1) / total) * 100)}%`);
        try {
          const res = await fetch(`/api/warehouse/skus/${item.sku}/lots`);

          if (res.ok) {
            const data = await res.json();
            const matchedLot = data.lots?.find((l: any) => l.lotNumber === item.lotNumber);

            if (matchedLot && matchedLot.cost !== undefined) {
              // On the Create Page, we currently map 'price' to the input. 
              // If the user wants to set the Price to the Lot's Cost (e.g. for reference or cost-plus), we do this:
              updatedItems[i] = { ...item, price: matchedLot.cost };
              changedCount++;
            }
          }
        } catch (error) {
          console.error("Failed to fetch cost for item", i, error);
        }
      }
    }

    setNewLineItems(updatedItems);
    setRefreshProgress(`Updated ${changedCount} items`);

    setTimeout(() => {
      setIsRefreshingCosts(false);
      setRefreshProgress('');
    }, 2000);
  };



  const formatCurrency = (val: number) => {
    return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleClientChange = (clientId: string) => {
    const client: any = allClients.find((c: any) => c._id === clientId);
    if (client) {
      // Use 'addresses' array from Client Schema (default to first one)
      const mainAddress = client.addresses && client.addresses.length > 0
        ? client.addresses[0]
        : { street: '', city: '', state: '' };

      // Get sales rep from client - handle both object and string formats
      // API returns populated object { _id, firstName, lastName } or null
      let salesRepId = '';
      if (client.salesPerson) {
        if (typeof client.salesPerson === 'object' && client.salesPerson._id) {
          salesRepId = client.salesPerson._id;
        } else if (typeof client.salesPerson === 'string') {
          salesRepId = client.salesPerson;
        }
      }

      setNewOrder(prev => ({
        ...prev,
        clientId,
        salesRep: salesRepId || prev.salesRep,
        shippingAddress: mainAddress.street || prev.shippingAddress,
        city: mainAddress.city || prev.city,
        state: mainAddress.state || prev.state
      }));
    } else {
      setNewOrder(prev => ({ ...prev, clientId }));
    }
  };

  const handleLotSelect = (lotNumber: string, cost?: number) => {
    if (!editingLotItemId) return;
    setNewLineItems(prev => prev.map(item => {
      if (item.id === editingLotItemId) {
        return { ...item, lotNumber, cost: cost || 0 };
      }
      return item;
    }));
    setIsLotModalOpen(false);
    setEditingLotItemId(null);
  };

  // ─── Status Tab Colors ───────────────────────────────────────────────────
  const statusColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
    'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
    'Completed': { bg: '#059669', color: '#ffffff', hoverBg: 'rgba(5,150,105,0.08)' },
    'Issued': { bg: '#0284c7', color: '#ffffff', hoverBg: 'rgba(2,132,199,0.08)' },
    'Pending Payment': { bg: '#d97706', color: '#ffffff', hoverBg: 'rgba(217,119,6,0.08)' },
    'Shipping': { bg: '#7c3aed', color: '#ffffff', hoverBg: 'rgba(124,58,237,0.08)' },
    'Picking': { bg: '#0891b2', color: '#ffffff', hoverBg: 'rgba(8,145,178,0.08)' },
    'Pending': { bg: '#64748b', color: '#ffffff', hoverBg: 'rgba(100,116,139,0.08)' },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* ─── Page Header with Status Tabs, Search & Actions ──────────── */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <ShoppingCart className="w-4 h-4 text-primary" />
            <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Wholesale Orders</h1>
          </div>
          <div className="h-5 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {STATUS_TABS.map((tab) => {
              const sc = statusColors[tab];
              const isActive = activeStatus === tab;
              return (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                  style={isActive ? { backgroundColor: sc?.bg, color: sc?.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { color: 'inherit', backgroundColor: 'transparent' }}
                  onMouseEnter={e => { if (!isActive && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  {tab}
                  <span className="ml-1.5 text-[11px] tabular-nums" style={{ opacity: isActive ? 0.75 : 0.5 }}>
                    {countsLoaded ? statusCounts[tab]?.toLocaleString() || 0 : <span className="inline-block w-4 h-3 rounded-sm bg-muted-foreground/10 animate-pulse align-middle" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-8 h-8 w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <button onClick={toggleQuickEdit}
            className={cn(
              'h-8 px-3 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0 border',
              isQuickEditMode
                ? 'bg-amber-500 text-black border-amber-600 hover:bg-amber-400'
                : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
            )}>
            <SquarePen className="w-3 h-3" />
            <span className="hidden sm:inline text-[12px] font-black uppercase tracking-widest">
              {isQuickEditMode ? 'Exit Edit' : 'Quick Edit'}
            </span>
          </button>
          <button onClick={() => { setEditingOrderId(null); openCreateModal(); }}
            className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer shrink-0">
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
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 dark:hover:bg-secondary/50 transition-colors border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
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
                Array.from({ length: 25 }).map((_, i) => <WholesaleSkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={14} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={14} className="px-2 py-16 text-center">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                    {debouncedSearch ? 'No matching orders' : activeStatus !== 'All' ? `No ${activeStatus} orders` : 'No orders found'}
                  </p>
                </td></tr>
              ) : (
                sortedOrders.map((order) => (
                  <WholesaleTableRow key={order._id} order={order} highlight={highlightId === order._id}
                    isQuickEdit={isQuickEditMode}
                    quickEditValues={quickEditData[order._id]}
                    onQuickEditChange={handleQuickEditChange}
                    onClick={() => {
                      sessionStorage.setItem('ws_scroll_to', order._id);
                      if (scrollRef.current) sessionStorage.setItem('ws_scroll_top', String(scrollRef.current.scrollTop));
                      router.push(`/sales/wholesale-orders/${order._id}`);
                    }} />
                ))
              )}
              {isLoadingMore && Array.from({ length: 8 }).map((_, i) => <WholesaleSkeletonRow key={`loading-${i}`} index={i} />)}
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

        {/* Quick Edit Floating Save Bar */}
        {isQuickEditMode && (
          <div className="sticky bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SquarePen className="w-4 h-4 text-amber-500" />
                <span className="text-[12px] font-bold uppercase tracking-widest text-foreground">
                  Quick Edit Mode
                </span>
                {modifiedCount > 0 && (
                  <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 tabular-nums">
                    {modifiedCount} modified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setQuickEditData({}); setIsQuickEditMode(false); }}
                  className="h-8 px-4 text-[11px] font-bold uppercase tracking-widest border border-border rounded hover:bg-secondary transition-colors cursor-pointer text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkSave}
                  disabled={modifiedCount === 0 || isBulkSaving}
                  className={cn(
                    'h-8 px-5 text-[11px] font-black uppercase tracking-widest rounded shadow-md flex items-center gap-1.5 cursor-pointer transition-all',
                    modifiedCount > 0
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-secondary text-muted-foreground/50 cursor-not-allowed'
                  )}
                >
                  {isBulkSaving ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-3 h-3" /> Save All ({modifiedCount})</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background rounded-lg shadow-2xl w-full max-w-7xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh] border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/20 shrink-0">
              <h2 className="text-sm font-bold uppercase text-foreground tracking-wider flex items-center gap-2">
                {editingOrderId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingOrderId ? 'Edit Sale Order' : 'Create Sale Order'}
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="create-so-form" onSubmit={handleCreateOrUpdate} className="space-y-8">
                {/* Header Info */}
                <div className="grid grid-cols-12 gap-6">
                  {/* Left Column */}
                  <div className="col-span-8 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Client <span className="text-destructive">*</span></label>
                        <SearchableSelect
                          options={allClients.map(c => ({ value: c._id, label: c.name }))}
                          value={newOrder.clientId}
                          onChange={handleClientChange}
                          placeholder="Select Client..."
                          className="w-full h-9 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Rep <span className="text-destructive">*</span></label>
                        <SearchableSelect
                          options={allUsers.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id }))}
                          value={newOrder.salesRep}
                          onChange={(val) => setNewOrder({ ...newOrder, salesRep: val })}
                          placeholder="Select Rep..."
                          className="w-full h-9 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Method</label>
                        <SearchableSelect
                          options={PAYMENT_METHODS}
                          value={newOrder.paymentMethod}
                          onChange={(val) => setNewOrder({ ...newOrder, paymentMethod: val })}
                          placeholder="Select Method..."
                          className="w-full h-9 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Order Status</label>
                        <SearchableSelect
                          options={[
                            { label: 'Pending', value: 'Pending' },
                            { label: 'Picking', value: 'Picking' },
                            { label: 'Shipping', value: 'Shipping' },
                            { label: 'Pending Payment', value: 'Pending Payment' },
                            { label: 'Issued', value: 'Issued' },
                            { label: 'Completed', value: 'Completed' }
                          ]}
                          value={newOrder.orderStatus}
                          onChange={(val) => setNewOrder({ ...newOrder, orderStatus: val })}
                          className="w-full h-9 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                        <input
                          type="date"
                          disabled
                          className="w-full h-9 px-3 bg-secondary/30 border border-border rounded text-xs text-muted-foreground cursor-not-allowed"
                          value={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column (Label/Meta) */}
                  <div className="col-span-4 bg-secondary/10 border border-border rounded p-4 space-y-4">
                    <div className="flex flex-col items-center justify-center h-full space-y-2">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Order Number (Auto)</div>
                      <div className="text-3xl font-black text-primary">{newOrder.label || '---'}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className={cn("px-2 py-0.5 text-[10px] uppercase font-bold rounded border",
                          newOrder.orderStatus === 'Completed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                            newOrder.orderStatus === 'Pending Payment' ? "bg-amber-500/10 text-amber-500 border-amber-500/30" :
                              "bg-secondary text-muted-foreground border-border"
                        )}>
                          {newOrder.orderStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Shipping Details */}
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Shipping Details</h4>
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Method</label>
                      <SearchableSelect
                        options={SHIPPING_METHODS}
                        value={newOrder.shippingMethod}
                        onChange={(val) => setNewOrder({ ...newOrder, shippingMethod: val })}
                        creatable
                        placeholder="Select Method..."
                        className="w-full h-9 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tracking #</label>
                      <input
                        type="text"
                        value={newOrder.trackingNumber}
                        onChange={e => setNewOrder({ ...newOrder, trackingNumber: e.target.value })}
                        className="w-full h-9 px-3 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipped Date</label>
                      <input
                        type="date"
                        value={toDateInputValue(newOrder.shippedDate)}
                        onChange={e => setNewOrder({ ...newOrder, shippedDate: e.target.value })}
                        className="w-full h-9 px-3 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                      />
                    </div>
                    <div className="col-span-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Address <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          value={newOrder.shippingAddress}
                          onChange={e => setNewOrder({ ...newOrder, shippingAddress: e.target.value })}
                          className="w-full h-9 px-3 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                          placeholder="Street Address, City, State, Zip"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financials */}
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Financials</h4>
                  <div className="grid grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Cost</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newOrder.shippingCost}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={e => setNewOrder({ ...newOrder, shippingCost: e.target.value })}
                          className="w-full h-9 pl-5 pr-2 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Discount</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newOrder.discount}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={e => setNewOrder({ ...newOrder, discount: e.target.value })}
                          className="w-full h-9 pl-5 pr-2 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tax</label>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={newOrder.tax}
                          onWheel={(e) => e.currentTarget.blur()}
                          onChange={e => setNewOrder({ ...newOrder, tax: e.target.value })}
                          className="w-full h-9 pl-5 pr-2 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 pb-2">
                      <div className="flex items-center space-x-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Lock Price</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={newOrder.lockPrice}
                            onChange={e => setNewOrder({ ...newOrder, lockPrice: e.target.checked })}
                          />
                          <div className="w-9 h-5 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-muted peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Line Items <span className="text-destructive">*</span></h3>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-none text-[10px] font-bold uppercase transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Item</span>
                      </button>
                    </div>
                  </div>

                  {newLineItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-secondary/10 rounded-none border border-dashed border-border text-muted-foreground">
                      <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center shadow-sm mb-3">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium">No items added yet</p>
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="mt-3 text-xs font-bold text-primary hover:underline"
                      >
                        Add your first item
                      </button>
                    </div>
                  ) : (
                    <div className="border border-border rounded-none">
                      <table className="w-full text-left border-collapse border-b border-border">
                        <thead className="bg-secondary/50 text-muted-foreground">
                          <tr>
                            <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[25%] border-r border-border">Item / SKU</th>
                            <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[20%] border-r border-border">Description</th>
                            <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[12%] border-r border-border">Lot #</th>
                            <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[8%] border-r border-border">UOM</th>
                            <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[8%] border-r border-border">Qty</th>
                            <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[12%] border-r border-border">Price</th>
                            <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[10%] text-right border-r border-border">Total</th>
                            <th className="px-2 py-2 w-[5%] bg-card"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                          {newLineItems.map((item, index) => (
                            <tr key={item.id} className="group">
                              <td className="p-0 border-r border-border text-foreground">
                                <div className="w-full h-full">
                                  <SearchableSelect
                                    options={(() => {
                                      const available = allSkus.filter(s => !newLineItems.some(i => i.id !== item.id && i.sku === s._id));
                                      const opts = available.map(s => ({ value: s._id, label: s.name }));
                                      const isMissing = item.sku && !allSkus.find(s => s._id === item.sku);
                                      const isLegacyDisplay = !item.sku && item._originalSkuLabel;

                                      if (isMissing) {
                                        opts.push({
                                          value: item.sku,
                                          label: item._originalSkuLabel || `Legacy: ${item.sku}`
                                        });
                                      } else if (isLegacyDisplay) {
                                        opts.push({
                                          value: '',
                                          label: item._originalSkuLabel || 'Unknown Item'
                                        });
                                      }

                                      return opts;
                                    })()}
                                    value={item.sku}
                                    onChange={(val) => updateLineItem(item.id, 'sku', val)}
                                    placeholder={item._originalSkuLabel || "Select SKU"}
                                    className="w-full rounded-none border-none text-xs focus:ring-0 bg-transparent text-foreground h-[32px]"
                                  />
                                </div>
                              </td>
                              <td className="p-0 border-r border-border">
                                <input
                                  type="text"
                                  value={item.productDescription || ''}
                                  onChange={(e) => updateLineItem(item.id, 'productDescription', e.target.value)}
                                  className="w-full h-[32px] px-2 text-xs focus:outline-none focus:bg-primary/5 transition-colors rounded-none bg-transparent text-foreground"
                                  placeholder="Description..."
                                />
                              </td>
                              <td className="p-0 border-r border-border">
                                <div
                                  className="w-full h-[32px] px-2 flex items-center cursor-pointer hover:bg-secondary/30 transition-colors"
                                  onClick={() => {
                                    // Allow lot selection if SKU is set (valid ObjectId or string)
                                    if (!item.sku) {
                                      toast.error("Select SKU first");
                                      return;
                                    }
                                    setEditingLotItemId(item.id);
                                    setEditingSkuId(item.sku);
                                    setIsLotModalOpen(true);
                                  }}
                                >
                                  <span className={cn("text-xs truncate block w-full", !item.lotNumber ? "text-muted-foreground italic" : "text-foreground font-mono")}>
                                    {item.lotNumber || "Select"}
                                  </span>
                                </div>
                              </td>
                              <td className="p-0 border-r border-border text-foreground">
                                <SearchableSelect
                                  options={UOM_OPTIONS}
                                  value={item.uom}
                                  onChange={(val) => updateLineItem(item.id, 'uom', val)}
                                  placeholder="UOM"
                                  creatable
                                  className="w-full rounded-none border-none focus:ring-0 bg-transparent text-foreground h-[32px] text-xs"
                                />
                              </td>
                              <td className="p-0 border-r border-border">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.qtyShipped}
                                  onWheel={(e) => e.currentTarget.blur()}
                                  onChange={(e) => updateLineItem(item.id, 'qtyShipped', parseInt(e.target.value) || 0)}
                                  className="w-full h-[32px] px-2 text-xs focus:outline-none focus:bg-primary/5 transition-colors font-mono rounded-none bg-transparent text-foreground"
                                />
                              </td>
                              <td className="p-0 border-r border-border">
                                <div className="relative h-full w-full">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.price}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={(e) => updateLineItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                    className="w-full h-[32px] pl-5 pr-2 text-xs focus:outline-none focus:bg-primary/5 transition-colors font-mono text-right rounded-none bg-transparent text-foreground"
                                  />
                                </div>
                              </td>
                              <td className="px-2 py-0 align-middle text-right border-r border-border bg-secondary/10">
                                <span className="text-xs font-bold text-foreground font-mono">
                                  {formatCurrency((item.qtyShipped || 0) * (item.price || 0))}
                                </span>
                              </td>
                              <td className="p-0 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => removeLineItem(item.id)}
                                  className="w-full h-[32px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  title="Remove Item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-secondary/50">
                          <tr>
                            <td colSpan={6} className="px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase text-right tracking-wider border-r border-border">Subtotal</td>
                            <td className="px-2 py-2 text-xs font-black text-foreground font-mono text-right border-r border-border">
                              {formatCurrency(newLineItems.reduce((sum, item) => sum + ((item.qtyShipped || 0) * (item.price || 0)), 0))}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-border bg-secondary/30 flex justify-end shrink-0">
              <button
                type="submit"
                form="create-so-form"
                className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase rounded hover:bg-primary/90 transition-colors"
              >
                {editingOrderId ? 'Save Changes' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )
      }

      {/* Lot Selection Modal */}
      <LotSelectionModal
        isOpen={isLotModalOpen}
        onClose={() => {
          setIsLotModalOpen(false);
          setEditingLotItemId(null);
          setEditingSkuId(null);
        }}
        onSelect={handleLotSelect}
        skuId={editingSkuId || ''}
        currentLotNumber={newLineItems.find(i => i.id === editingLotItemId)?.lotNumber || ''}
      />

      {/* Delete Confirmation Modal */}
      {
        deleteConfirm.isOpen && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200 border border-border">
              <div className="p-6 text-center">
                <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-sm font-bold text-foreground uppercase mb-2">Confirm Delete</h3>
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Are you sure you want to delete this order? This action cannot be undone.
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setDeleteConfirm({ isOpen: false, orderId: null })}
                    className="flex-1 px-4 py-2 bg-secondary text-foreground text-xs font-bold uppercase rounded hover:bg-secondary/80 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700 transition-colors"
                  >
                    Delete Only
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

export default function SaleOrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
        <div className="shrink-0 border-b border-border bg-background px-4 py-2.5 flex items-center gap-4">
          <div className="h-4 w-4 rounded bg-secondary animate-pulse" />
          <div className="h-4 w-40 rounded bg-secondary animate-pulse" />
          <div className="h-5 w-px bg-border" />
          {Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-6 w-16 rounded-lg bg-secondary animate-pulse" />)}
        </div>
        <div className="flex-1 p-2">
          <table className="w-full"><tbody>
            {Array.from({ length: 20 }).map((_, i) => <WholesaleSkeletonRow key={i} index={i} />)}
          </tbody></table>
        </div>
      </div>
    }>
      <SaleOrdersContent />
    </Suspense>
  );
}
