'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search, ArrowUpDown, Plus, Trash2, X, Loader2,
} from 'lucide-react';
import Papa from 'papaparse';
import { cn, formatDate, toDateInputValue } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { CreateVendorModal } from '@/components/warehouse/CreateVendorModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  _id: string;
  sku: { _id: string; name: string } | string;
  lotNumber: string;
  qtyOrdered: number;
  qtyReceived: number;
  uom: string;
  cost: number;
}

interface PurchaseOrder {
  _id: string;
  label: string;
  vendor: { _id: string; name: string } | string;
  paymentTerms: string;
  createdBy?: { _id: string; firstName: string; lastName: string };
  status: string;
  scheduledDelivery: string;
  receivedDate: string;
  shippingCost: number;
  createdAt: string;
  lineItems?: LineItem[];
}

interface NewLineItem {
  id: string;
  sku: string;
  qtyOrdered: number;
  cost: number;
  uom: string;
  lotNumber?: string;
  qtyReceived?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UOM_OPTIONS = [
  { label: 'Each', value: 'Each' }, { label: 'Box', value: 'Box' },
  { label: 'Case', value: 'Case' }, { label: 'Pack', value: 'Pack' },
  { label: 'Pair', value: 'Pair' }, { label: 'Set', value: 'Set' },
  { label: 'Roll', value: 'Roll' }, { label: 'Kg', value: 'Kg' },
  { label: 'Lb', value: 'Lb' }, { label: 'M', value: 'M' },
  { label: 'Ft', value: 'Ft' }, { label: 'L', value: 'L' },
  { label: 'Gal', value: 'Gal' },
];

const PAYMENT_TERMS_OPTIONS = [
  { label: 'Net 15', value: 'Net 15' }, { label: 'Net 30', value: 'Net 30' },
  { label: 'Net 60', value: 'Net 60' }, { label: 'Due on Receipt', value: 'Due on Receipt' },
  { label: 'ACH', value: 'ACH' }, { label: 'CC', value: 'CC' },
  { label: 'ACH-Already Paid', value: 'ACH-Already Paid' },
  { label: 'Credit Card', value: 'Credit Card' },
];

// ─── Module-level cache ───────────────────────────────────────────────────────

interface CacheEntry {
  orders: PurchaseOrder[]; hasMore: boolean; page: number; total: number;
  sortBy: string; sortOrder: string; search: string;
  statuses: string[]; vendors: string[]; timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000;
const PAGE_SIZE = 50;

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, { bg: string; color: string; border: string }> = {
    Received: { bg: 'rgba(22,163,74,0.1)', color: '#16a34a', border: 'rgba(22,163,74,0.3)' },
    Ordered: { bg: 'rgba(14,165,233,0.1)', color: '#0284c7', border: 'rgba(14,165,233,0.3)' },
    Partial: { bg: 'rgba(217,119,6,0.1)', color: '#d97706', border: 'rgba(217,119,6,0.3)' },
    Pending: { bg: 'rgba(234,88,12,0.1)', color: '#ea580c', border: 'rgba(234,88,12,0.3)' },
  };
  const s = styleMap[status] || { bg: 'rgba(100,116,139,0.1)', color: '#64748b', border: 'rgba(100,116,139,0.3)' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest whitespace-nowrap"
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >{status}</span>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = React.memo(function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/60" style={{ opacity: 1 - index * 0.04 }}>
      {[12, 18, 14, 10, 12, 12, 12, 14, 10, 10, 10, 8].map((w, i) => (
        <td key={i} className="px-2.5 py-2.5">
          <div className="h-3 rounded bg-muted-foreground/10 animate-pulse" style={{ width: `${w * 5}px` }} />
        </td>
      ))}
    </tr>
  );
});

// ─── Status Filter Tabs ───────────────────────────────────────────────────────

const STATUS_TABS = ['All', 'Pending', 'Ordered', 'Partial', 'Received'];
const TAB_COLORS: Record<string, { bg: string; color: string; hoverBg: string }> = {
  All: { bg: '#fe9900', color: '#fff', hoverBg: 'rgba(254,153,0,0.08)' },
  Pending: { bg: '#ea580c', color: '#fff', hoverBg: 'rgba(234,88,12,0.08)' },
  Ordered: { bg: '#0284c7', color: '#fff', hoverBg: 'rgba(2,132,199,0.08)' },
  Partial: { bg: '#d97706', color: '#fff', hoverBg: 'rgba(217,119,6,0.08)' },
  Received: { bg: '#16a34a', color: '#fff', hoverBg: 'rgba(22,163,74,0.08)' },
};

// ─── PO Create / Edit Modal ───────────────────────────────────────────────────

function POModal({ editingOrderId, newOrder, setNewOrder, newLineItems, setNewLineItems, allVendors, setAllVendors, allSkus, onClose, onSuccess }: {
  editingOrderId: string | null;
  newOrder: any; setNewOrder: any;
  newLineItems: NewLineItem[]; setNewLineItems: any;
  allVendors: { _id: string; name: string }[];
  setAllVendors: any;
  allSkus: { _id: string; name: string; cost?: number }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [isCreateVendorOpen, setIsCreateVendorOpen] = useState(false);
  const [vendorSearchVal, setVendorSearchVal] = useState('');

  const addLineItem = () => setNewLineItems((p: NewLineItem[]) => [...p, { id: Math.random().toString(), sku: '', qtyOrdered: 1, cost: 0, uom: '', qtyReceived: 0, lotNumber: '' }]);
  const removeLineItem = (id: string) => setNewLineItems((p: NewLineItem[]) => p.filter((i: NewLineItem) => i.id !== id));
  const updateLineItem = (id: string, field: keyof NewLineItem, value: any) =>
    setNewLineItems((p: NewLineItem[]) => p.map((item: NewLineItem) => item.id === id ? { ...item, [field]: value } : item));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.vendor) { toast.error('Please select a vendor'); return; }
    setSaving(true);
    try {
      const payload = {
        ...newOrder,
        shippingCost: parseFloat(newOrder.shippingCost) || 0,
        lineItems: newLineItems.map((item: NewLineItem) => ({ sku: item.sku, qtyOrdered: item.qtyOrdered, cost: item.cost, uom: item.uom, qtyReceived: item.qtyReceived || 0, lotNumber: item.lotNumber || '' }))
      };
      const res = await fetch(editingOrderId ? `/api/purchase-orders/${editingOrderId}` : '/api/purchase-orders', {
        method: editingOrderId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(editingOrderId ? 'Order updated' : 'Order created');
        globalCache.current = null;
        onSuccess();
        onClose();
      } else { toast.error('Failed to save order'); }
    } catch { toast.error('Error saving order'); }
    finally { setSaving(false); }
  };

  const subTotalCost = newLineItems.reduce((s: number, i: NewLineItem) => s + (i.qtyOrdered * i.cost), 0);
  const shippingCostNum = parseFloat(newOrder.shippingCost) || 0;
  const totalCost = subTotalCost + shippingCostNum;

  const inp = 'w-full px-3 h-9 border border-border rounded-lg text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-border flex flex-col max-h-[92vh] rounded-xl shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 h-12 border-b border-border bg-secondary/40 shrink-0 rounded-t-xl">
          <h2 className="text-[11px] font-black uppercase tracking-widest">{editingOrderId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
          <div className="flex items-center gap-3">
            {totalCost > 0 && <span className="text-[10px] font-black text-primary font-mono">Sub: ${subTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + Ship: ${shippingCostNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
            <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer"><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-6 scrollbar-custom">
          <form id="create-po-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Order Details Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">PO Label *</label>
                <input type="text" required disabled value={newOrder.label} onChange={e => setNewOrder((p: any) => ({ ...p, label: e.target.value }))}
                  className="w-full px-3 h-9 border border-border rounded-lg text-[12px] bg-secondary text-muted-foreground cursor-not-allowed" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Vendor *</label>
                <SearchableSelect triggerClassName="h-9 rounded-lg text-[12px]" options={allVendors.map(v => ({ value: v._id, label: v.name }))}
                  value={newOrder.vendor} onChange={val => {
                    const existing = allVendors.find(v => v._id === val || v.name.toLowerCase() === val.toLowerCase());
                    if (!existing && val) {
                      setVendorSearchVal(val);
                      setIsCreateVendorOpen(true);
                    } else {
                      setNewOrder((p: any) => ({ ...p, vendor: val }));
                    }
                  }} placeholder="Select Vendor..." required creatable />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Status</label>
                <select value={newOrder.status} onChange={e => setNewOrder((p: any) => ({ ...p, status: e.target.value }))}
                  className={inp}>
                  <option value="Pending">Pending</option><option value="Ordered">Ordered</option>
                  <option value="Partial">Partial</option><option value="Received">Received</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Payment Terms</label>
                <SearchableSelect triggerClassName="h-9 rounded-lg text-[12px]" options={PAYMENT_TERMS_OPTIONS}
                  value={newOrder.paymentTerms} onChange={val => setNewOrder((p: any) => ({ ...p, paymentTerms: val }))}
                  placeholder="Select Terms..." creatable />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Scheduled Delivery</label>
                <input type="date" value={newOrder.scheduledDelivery} onChange={e => setNewOrder((p: any) => ({ ...p, scheduledDelivery: e.target.value }))} className={inp} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Shipping Cost</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[12px]">$</span>
                  <input type="number" min="0" step="0.01" value={newOrder.shippingCost || ''}
                    onChange={e => setNewOrder((p: any) => ({ ...p, shippingCost: e.target.value }))}
                    className={cn(inp, 'pl-6 font-mono')} placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="border-t border-border pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground">Line Items ({newLineItems.length})</h3>
                <button type="button" onClick={addLineItem}
                  className="flex items-center gap-1.5 px-3 h-8 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /><span>Add Item</span>
                </button>
              </div>
              {newLineItems.length === 0 ? (
                <div className="text-center py-10 bg-secondary/20 rounded-xl border border-dashed border-border text-muted-foreground/50 text-[11px] font-bold uppercase tracking-widest">
                  No items. Click "Add Item" to start.
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-[9px] uppercase font-black text-muted-foreground tracking-widest px-2">
                    <div className="col-span-4">Product / SKU</div>
                    <div className="col-span-2">UOM</div>
                    <div className="col-span-2">Qty</div>
                    <div className="col-span-3">Unit Cost</div>
                    <div className="col-span-1 text-right">Del</div>
                  </div>
                  {newLineItems.map((item: NewLineItem) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-start bg-secondary/20 p-2 rounded-lg border border-border/60">
                      <div className="col-span-4">
                        <SearchableSelect triggerClassName="h-9 rounded-lg text-[12px]"
                          options={allSkus.filter(s => !newLineItems.some((i: NewLineItem) => i.id !== item.id && i.sku === s._id)).map(s => ({ value: s._id, label: s.name }))}
                          value={item.sku} onChange={val => updateLineItem(item.id, 'sku', val)} placeholder="Select SKU..." className="w-full" />
                      </div>
                      <div className="col-span-2">
                        <SearchableSelect triggerClassName="h-9 rounded-lg text-[12px]" options={UOM_OPTIONS}
                          value={item.uom} onChange={val => updateLineItem(item.id, 'uom', val)} placeholder="UOM" creatable />
                      </div>
                      <div className="col-span-2">
                        <input type="number" min="1" value={item.qtyOrdered}
                          onChange={e => updateLineItem(item.id, 'qtyOrdered', parseInt(e.target.value) || 0)}
                          className="w-full px-2 h-9 border border-border rounded-lg text-[12px] focus:outline-none bg-background text-foreground" />
                      </div>
                      <div className="col-span-3">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[12px]">$</span>
                          <input type="number" min="0" step="0.00000001" value={item.cost}
                            onChange={e => updateLineItem(item.id, 'cost', parseFloat(e.target.value) || 0)}
                            className="w-full pl-6 pr-2 h-9 border border-border rounded-lg text-[12px] focus:outline-none bg-background text-foreground font-mono" />
                        </div>
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button type="button" onClick={() => removeLineItem(item.id)}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 h-12 border-t border-border bg-secondary/30 flex items-center justify-end gap-3 shrink-0 rounded-b-xl">
          <button type="button" onClick={onClose}
            className="px-4 h-8 rounded-lg border border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:bg-secondary/60 transition-colors cursor-pointer">
            Cancel
          </button>
          <button type="submit" form="create-po-form" disabled={saving}
            className="px-6 h-8 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all shadow cursor-pointer disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {editingOrderId ? 'Save Changes' : 'Create Order'}
          </button>
        </div>
      </div>

      {isCreateVendorOpen && (
        <CreateVendorModal
          initialName={vendorSearchVal}
          onClose={() => setIsCreateVendorOpen(false)}
          onSuccess={(newVendor) => {
            setAllVendors((prev: any) => [...prev, newVendor]);
            setNewOrder((p: any) => ({ ...p, vendor: newVendor._id }));
          }}
        />
      )}
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirm({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 text-center">
          <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <h3 className="text-[12px] font-black uppercase tracking-widest text-foreground mb-2">Confirm Delete</h3>
          <p className="text-[11px] text-muted-foreground mb-6 leading-relaxed">Are you sure you want to delete this order? This cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 py-2 border border-border rounded-lg text-[10px] font-bold text-muted-foreground uppercase hover:bg-secondary/50 transition-colors cursor-pointer">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2 bg-destructive text-white rounded-lg text-[10px] font-black uppercase hover:opacity-90 transition-colors cursor-pointer">Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

function PurchaseOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<PurchaseOrder[]>(globalCache.current?.orders || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [total, setTotal] = useState(globalCache.current?.total || 0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeStatus, setActiveStatus] = useState('All');
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [allVendors, setAllVendors] = useState<{ _id: string; name: string }[]>([]);
  const [allSkus, setAllSkus] = useState<{ _id: string; name: string }[]>([]);
  const [newOrder, setNewOrder] = useState({ label: '', vendor: '', paymentTerms: '', status: 'Pending', scheduledDelivery: '', shippingCost: '' });
  const [newLineItems, setNewLineItems] = useState<NewLineItem[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; orderId: string | null }>({ isOpen: false, orderId: null });
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef(0);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ─── Side data ──────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/vendors?limit=1000&status=Active').then(r => r.json()).then(d => { setAllVendors(d.vendors || []); }).catch(() => { });
    fetch('/api/skus?limit=0&ignoreDate=true&simple=true').then(r => r.json()).then(d => setAllSkus(d.skus || [])).catch(() => { });
  }, []);

  // createNew URL param
  useEffect(() => {
    if (searchParams.get('createNew') === 'true') {
      openCreateModal();
      router.replace('/warehouse/purchase-orders', { scroll: false });
    }
  }, [searchParams]);

  // Auto-generate PO label when opening create modal
  useEffect(() => {
    if (isModalOpen && !editingOrderId) {
      fetch('/api/purchase-orders?limit=1&sortBy=createdAt&sortOrder=desc').then(r => r.json()).then(data => {
        const lastOrder = data.orders?.[0];
        if (lastOrder?.label) {
          const match = lastOrder.label.match(/(\d+)$/);
          if (match) {
            const numStr = match[0];
            const num = parseInt(numStr, 10) + 1;
            const prefix = lastOrder.label.substring(0, lastOrder.label.lastIndexOf(numStr));
            setNewOrder((p: any) => ({ ...p, label: prefix + num.toString().padStart(numStr.length, '0') }));
          } else {
            setNewOrder((p: any) => ({ ...p, label: lastOrder.label + '-1' }));
          }
        } else {
          setNewOrder((p: any) => ({ ...p, label: `PO-${new Date().getFullYear()}-001` }));
        }
      }).catch(() => setNewOrder((p: any) => ({ ...p, label: `PO-${new Date().getFullYear()}-001` })));
    }
  }, [isModalOpen, editingOrderId]);

  // ─── Debounce ────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Scroll-back highlight ───────────────────────────────────────────────

  useEffect(() => {
    const savedId = sessionStorage.getItem('po_scroll_to');
    const savedScroll = sessionStorage.getItem('po_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('po_scroll_to'); sessionStorage.removeItem('po_scroll_top');
      setHighlightId(savedId);
      if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-po-id="${savedId}"]`);
        if (row) { setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); setTimeout(() => setHighlightId(null), 3000); }
        else if (attempts < 30) setTimeout(() => tryScroll(attempts + 1), 200);
      };
      setTimeout(() => tryScroll(), 100);
    }
  }, []);

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++reqSeqRef.current;

    fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true); else setIsLoading(true);

    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE), search: debouncedSearch, sortBy, sortOrder });
      if (activeStatus !== 'All') params.set('status', activeStatus);
      if (selectedVendors.length) params.set('vendor', selectedVendors.join(','));

      const res = await fetch(`/api/purchase-orders?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (seq !== reqSeqRef.current || !mountedRef.current) return;

      if (res.ok) {
        const newOrders: PurchaseOrder[] = data.orders || [];
        const newHasMore = data.hasMore ?? false;
        const newTotal = data.total || 0;

        if (isAppend) {
          setOrders(prev => {
            const ids = new Set(prev.map(o => o._id));
            const merged = [...prev, ...newOrders.filter(o => !ids.has(o._id))];
            globalCache.current = { orders: merged, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, statuses: [activeStatus], vendors: selectedVendors, timestamp: Date.now() };
            return merged;
          });
        } else {
          setOrders(newOrders);
          setTotal(newTotal);
          globalCache.current = { orders: newOrders, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, statuses: [activeStatus], vendors: selectedVendors, timestamp: Date.now() };
        }
        setHasMore(newHasMore);
        pageRef.current = pageNum;
        setError(null);
      } else { setError(data.error || 'Failed to fetch'); }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (mountedRef.current) setError(e.message);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); }
    }
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, selectedVendors]);

  // ─── Initial load / filter changes ──────────────────────────────────────

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.orders.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch &&
        JSON.stringify(cache.statuses) === JSON.stringify([activeStatus])) {
        setOrders(cache.orders); setHasMore(cache.hasMore); setTotal(cache.total);
        pageRef.current = cache.page; setIsLoading(false); return;
      }
    }
    globalCache.current = null; pageRef.current = 0; setOrders([]); setHasMore(true);
    fetchPageRef.current(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, debouncedSearch, activeStatus, selectedVendors]);

  // ─── Infinite scroll ────────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPageRef.current(pageRef.current + 1, true); },
      { root: container, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortOrder('asc'); }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openCreateModal = () => {
    setEditingOrderId(null);
    setNewOrder({ label: '', vendor: '', paymentTerms: '', status: 'Pending', scheduledDelivery: '', shippingCost: '' });
    setNewLineItems([]);
    setIsModalOpen(true);
  };

  const handleEditClick = (e: React.MouseEvent, order: PurchaseOrder) => {
    e.stopPropagation();
    setEditingOrderId(order._id);
    setNewOrder({
      label: order.label,
      vendor: typeof order.vendor === 'object' && order.vendor ? order.vendor._id : String(order.vendor || ''),
      paymentTerms: order.paymentTerms || '',
      status: order.status,
      scheduledDelivery: toDateInputValue(order.scheduledDelivery),
      shippingCost: String(order.shippingCost || '')
    });
    setNewLineItems((order.lineItems || []).map(item => ({
      id: Math.random().toString(),
      sku: typeof item.sku === 'object' && item.sku ? item.sku._id : String(item.sku),
      qtyOrdered: item.qtyOrdered, cost: item.cost, uom: item.uom || '',
      lotNumber: item.lotNumber, qtyReceived: item.qtyReceived
    })));
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    const { orderId } = deleteConfirm;
    if (!orderId) return;
    try {
      const res = await fetch(`/api/purchase-orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) { toast.success('Order deleted'); globalCache.current = null; pageRef.current = 0; fetchPageRef.current(1, false); setDeleteConfirm({ isOpen: false, orderId: null }); }
      else toast.error('Failed to delete');
    } catch { toast.error('Error deleting order'); }
  };

  const renderVendor = (order: PurchaseOrder) => (typeof order.vendor === 'object' && order.vendor ? order.vendor.name : order.vendor || '-');
  const calcSubTotal = (order: PurchaseOrder) => order.lineItems?.reduce((s, i) => s + ((i.qtyOrdered || 0) * (i.cost || 0)), 0) || 0;
  const calcTotal = (order: PurchaseOrder) => calcSubTotal(order) + (order.shippingCost || 0);
  const fmtDate = (d: string) => d ? formatDate(d) : '—';
  const fmtCurrency = (v: number) => '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const COLS = [
    { key: 'label', label: 'PO #', sortable: true, width: 'w-[120px]' },
    { key: 'vendor', label: 'Vendor', sortable: true, width: 'w-[160px]' },
    { key: 'paymentTerms', label: 'Payment Terms', sortable: true, width: 'w-[130px]' },
    { key: 'status', label: 'Status', sortable: true, width: 'w-[100px]' },
    { key: 'scheduledDelivery', label: 'Sched. Delivery', sortable: true, width: 'w-[120px]' },
    { key: 'receivedDate', label: 'Received', sortable: true, width: 'w-[100px]' },
    { key: 'createdAt', label: 'Created', sortable: true, width: 'w-[100px]' },
    { key: 'createdBy', label: 'Created By', sortable: false, width: 'w-[130px]' },
    { key: 'subTotal', label: 'Sub Total', sortable: false, width: 'w-[110px]', align: 'text-right' },
    { key: 'shippingCost', label: 'Shipping', sortable: true, width: 'w-[100px]', align: 'text-right' },
    { key: 'totalAmount', label: 'Total', sortable: false, width: 'w-[110px]', align: 'text-right' },
    { key: 'itemCount', label: 'Items', sortable: false, width: 'w-[60px]', align: 'text-center' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

      {/* ─── Local Page Header ───────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex items-center gap-3 overflow-x-auto">

        {/* Title + count */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">PURCHASE ORDERS</span>
          <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">{total > 0 ? total.toLocaleString() : ''}</span>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin shrink-0">
          {STATUS_TABS.map(tab => {
            const sc = TAB_COLORS[tab];
            const isActive = activeStatus === tab;
            return (
              <button key={tab} onClick={() => { setActiveStatus(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                style={isActive ? { backgroundColor: sc.bg, color: sc.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { backgroundColor: 'transparent' }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >{tab}</button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Search */}
        <div className="relative flex items-center shrink-0">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search PO, vendor, lot..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-8 h-8 w-60 bg-secondary/60 border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* ADD button */}
        <button onClick={() => openCreateModal()}
          className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black uppercase tracking-widest">ADD</span>
        </button>
      </div>

      {/* ─── Table ──────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10">
              <tr>
                {COLS.map(col => (
                  <th key={col.key}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                      col.width,
                      col.sortable && 'cursor-pointer hover:bg-secondary/60 transition-colors',
                    )}>
                    <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end', col.align === 'text-center' && 'justify-center')}>
                      <span>{col.label}</span>
                      {col.sortable && <ArrowUpDown className={cn('w-2.5 h-2.5 flex-shrink-0', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={12} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No orders found</td></tr>
              ) : orders.map(order => (
                <tr
                  key={order._id}
                  data-po-id={order._id}
                  className={cn(
                    'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
                    highlightId === order._id && 'ring-1 ring-primary/40 bg-primary/[0.06]'
                  )}
                  onClick={() => {
                    sessionStorage.setItem('po_scroll_to', order._id);
                    if (scrollRef.current) sessionStorage.setItem('po_scroll_top', String(scrollRef.current.scrollTop));
                    router.push(`/warehouse/purchase-orders/${order._id}`);
                  }}
                >
                  {/* PO # */}
                  <td className="px-2.5 py-2.5 w-[120px] border-r border-border/40">
                    <span className="text-[11px] font-mono font-bold text-primary/80 tracking-tight">{order.label || '—'}</span>
                  </td>

                  {/* Vendor */}
                  <td className="px-2.5 py-2.5 w-[160px] text-[12px] font-medium text-foreground/80 truncate group-hover:text-foreground transition-colors border-r border-border/40">
                    {renderVendor(order)}
                  </td>

                  {/* Payment Terms */}
                  <td className="px-2.5 py-2.5 w-[130px] text-[11px] text-foreground/60 border-r border-border/40">
                    {order.paymentTerms || <span className="text-muted-foreground/30">—</span>}
                  </td>

                  {/* Status */}
                  <td className="px-2.5 py-2.5 w-[100px] border-r border-border/40">
                    <StatusBadge status={order.status} />
                  </td>

                  {/* Sched Delivery */}
                  <td className="px-2.5 py-2.5 w-[120px] text-[11px] font-mono text-foreground/60 border-r border-border/40">
                    {fmtDate(order.scheduledDelivery)}
                  </td>

                  {/* Received */}
                  <td className="px-2.5 py-2.5 w-[100px] text-[11px] font-mono text-foreground/60 border-r border-border/40">
                    {fmtDate(order.receivedDate)}
                  </td>

                  {/* Created At */}
                  <td className="px-2.5 py-2.5 w-[100px] text-[11px] font-mono text-foreground/60 border-r border-border/40">
                    {fmtDate(order.createdAt)}
                  </td>

                  {/* Created By */}
                  <td className="px-2.5 py-2.5 w-[130px] text-[11px] text-foreground/60 truncate border-r border-border/40">
                    {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '—'}
                  </td>

                  {/* Sub Total */}
                  <td className="px-2.5 py-2.5 w-[110px] text-[11px] font-mono text-foreground/60 text-right border-r border-border/40">
                    {fmtCurrency(calcSubTotal(order))}
                  </td>

                  {/* Shipping Cost */}
                  <td className="px-2.5 py-2.5 w-[100px] text-[11px] font-mono text-foreground/60 text-right border-r border-border/40">
                    {fmtCurrency(order.shippingCost || 0)}
                  </td>

                  {/* Total (SubTotal + Shipping) */}
                  <td className="px-2.5 py-2.5 w-[110px] text-[11px] font-mono font-bold text-foreground/80 text-right border-r border-border/40">
                    {fmtCurrency(calcTotal(order))}
                  </td>

                  {/* Items */}
                  <td className="px-2.5 py-2.5 w-[60px] text-center">
                    <span
                      className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black"
                      style={{ backgroundColor: 'rgba(254,153,0,0.12)', color: '#b45309', border: '1px solid rgba(254,153,0,0.25)' }}
                    >
                      {order.lineItems?.length || 0}
                    </span>
                  </td>
                </tr>
              ))}
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

          {!hasMore && orders.length > 0 && !isLoading && (
            <div className="text-center py-4 text-[11px] text-muted-foreground/40 uppercase tracking-widest">
              — {orders.length.toLocaleString()} orders loaded —
            </div>
          )}
        </div>
      </div>

      {/* ─── Create/Edit Modal ───────────────────────────────────────── */}
      {isModalOpen && (
        <POModal
          editingOrderId={editingOrderId}
          newOrder={newOrder} setNewOrder={setNewOrder}
          newLineItems={newLineItems} setNewLineItems={setNewLineItems}
          allVendors={allVendors} setAllVendors={setAllVendors} allSkus={allSkus}
          onClose={() => { setIsModalOpen(false); setEditingOrderId(null); }}
          onSuccess={() => { pageRef.current = 0; fetchPageRef.current(1, false); }}
        />
      )}

      {/* ─── Delete Confirmation ─────────────────────────────────────── */}
      {deleteConfirm.isOpen && (
        <DeleteConfirm
          onCancel={() => setDeleteConfirm({ isOpen: false, orderId: null })}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <PurchaseOrdersContent />
    </Suspense>
  );
}
