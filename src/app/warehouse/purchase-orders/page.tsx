'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Search,
  Upload,
  ArrowUpDown,
  Calendar,
  User,
  ShoppingCart,
  Plus,
  Building2,
  Trash2,
  X,
  Pencil,
  AlertCircle,
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';

interface LineItem {
  _id: string;
  sku: { _id: string; name: string } | string;
  lotNumber: string;
  qtyOrdered: number;
  qtyReceived: number;
  uom: string;
  cost: number;
  createdAt: string;
  createdBy?: string;
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
  createdAt: string;
  lineItems?: LineItem[];
}

interface NewLineItem {
  id: string; // temp id for UI
  sku: string;
  qtyOrdered: number;
  cost: number;
  uom: string;
  lotNumber?: string;
  qtyReceived?: number;
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

function PurchaseOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search 
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('header-portal-target');
    if (el) setHeaderPortalTarget(el);
  }, []);

  // Filters
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // Filter Options
  const [vendorOptions, setVendorOptions] = useState<{ label: string; value: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]);

  // Create/Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [allVendors, setAllVendors] = useState<{ _id: string; name: string }[]>([]);
  const [allSkus, setAllSkus] = useState<{ _id: string; name: string; cost?: number }[]>([]);
  const [newOrder, setNewOrder] = useState({
    label: '',
    vendor: '',
    paymentTerms: '',
    status: 'Pending',
    scheduledDelivery: ''
  });
  const [newLineItems, setNewLineItems] = useState<NewLineItem[]>([]);

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; orderId: string | null }>({
    isOpen: false,
    orderId: null
  });

  const poInputRef = useRef<HTMLInputElement>(null);
  const liInputRef = useRef<HTMLInputElement>(null);

  // Debounce search from URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Open create modal from URL param (?createNew=true)
  useEffect(() => {
    if (searchParams.get('createNew') === 'true') {
      openCreateModal();
      // Clear the param from URL
      router.replace('/warehouse/purchase-orders', { scroll: false });
    }
  }, [searchParams]);

  // Fetch active vendors and Skus for Filters and Create Modal
  useEffect(() => {
    const fetchResources = async () => {
      try {
        // Vendors
        const res = await fetch('/api/vendors?limit=1000&status=Active');
        if (res.ok) {
          const data = await res.json();
          const vendors_list = data.vendors || [];
          setAllVendors(vendors_list);
          setVendorOptions(vendors_list.map((v: any) => ({ label: v.name, value: v._id })));
        }

        // Skus
        const sRes = await fetch('/api/skus?limit=0&ignoreDate=true&simple=true');
        if (sRes.ok) {
          const data = await sRes.json();
          setAllSkus(data.skus || []);
        }
      } catch (error) {
        console.error("Failed to fetch resources", error);
      }
    };
    fetchResources();
  }, []);

  // Generate Label when opening Create Modal (Only if NOT editing)
  useEffect(() => {
    if (isCreateModalOpen && !editingOrderId) {
      const generateLabel = async () => {
        try {
          const oRes = await fetch('/api/purchase-orders?limit=1&sortBy=createdAt&sortOrder=desc');
          if (oRes.ok) {
            const data = await oRes.json();
            const lastOrder = data.orders?.[0];
            if (lastOrder && lastOrder.label) {
              const match = lastOrder.label.match(/(\d+)$/);
              if (match) {
                const numStr = match[0];
                const num = parseInt(numStr, 10) + 1;
                const prefix = lastOrder.label.substring(0, lastOrder.label.lastIndexOf(numStr));
                const padded = num.toString().padStart(numStr.length, '0');
                setNewOrder(prev => ({ ...prev, label: prefix + padded }));
              } else {
                setNewOrder(prev => ({ ...prev, label: lastOrder.label + '-1' }));
              }
            } else {
              setNewOrder(prev => ({ ...prev, label: `PO-${new Date().getFullYear()}-001` }));
            }
          }
        } catch (e) {
          console.error(e);
          setNewOrder(prev => ({ ...prev, label: `PO-${new Date().getFullYear()}-001` }));
        }
      };
      generateLabel();
    }
  }, [isCreateModalOpen, editingOrderId]);


  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      if (selectedVendors.length) params.append('vendor', selectedVendors.join(','));
      if (selectedStatuses.length) params.append('status', selectedStatuses.join(','));
      if (dateRange.from) params.append('fromDate', dateRange.from);
      if (dateRange.to) params.append('toDate', dateRange.to);

      const res = await fetch(`/api/purchase-orders?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);

        const statuses = Array.from(new Set((data.orders || []).map((o: any) => o.status).filter(Boolean)))
          .map((s: any) => ({ label: s, value: s }));
        setStatusOptions(statuses);
      } else {
        setError(data.error || 'Failed to fetch orders');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedVendors, selectedStatuses, dateRange]);

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

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, orderId: id });
  };

  const confirmDelete = async () => {
    const { orderId } = deleteConfirm;
    if (!orderId) return;

    try {
      const res = await fetch(`/api/purchase-orders/${orderId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Order deleted');
        fetchOrders();
        setDeleteConfirm({ isOpen: false, orderId: null });
      } else {
        toast.error('Failed to delete');
      }
    } catch (e) {
      toast.error('Error deleting order');
    }
  };

  const handleEditClick = (e: React.MouseEvent, order: PurchaseOrder) => {
    e.stopPropagation();
    setEditingOrderId(order._id);

    // Populate form
    setNewOrder({
      label: order.label,
      vendor: typeof order.vendor === 'object' && order.vendor ? order.vendor._id : String(order.vendor || ''),
      paymentTerms: order.paymentTerms || '',
      status: order.status,
      scheduledDelivery: order.scheduledDelivery ? new Date(order.scheduledDelivery).toISOString().split('T')[0] : ''
    });

    // Populate line items
    // Using a simple ID generator for the temp IDs
    const items: NewLineItem[] = (order.lineItems || []).map(item => ({
      id: Math.random().toString(),
      sku: typeof item.sku === 'object' && item.sku ? item.sku._id : String(item.sku),
      qtyOrdered: item.qtyOrdered,
      cost: item.cost,
      uom: item.uom || '',
      lotNumber: item.lotNumber,
      qtyReceived: item.qtyReceived
    }));
    setNewLineItems(items);

    setIsCreateModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingOrderId(null);
    setNewOrder({ label: '', vendor: '', paymentTerms: '', status: 'Pending', scheduledDelivery: '' });
    setNewLineItems([]);
    setIsCreateModalOpen(true);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.vendor) {
      toast.error('Please select a vendor');
      return;
    }

    const payload = {
      ...newOrder,
      lineItems: newLineItems.map(item => ({
        sku: item.sku,
        qtyOrdered: item.qtyOrdered,
        cost: item.cost,
        uom: item.uom,
        qtyReceived: item.qtyReceived || 0,
        lotNumber: item.lotNumber || ''
      }))
    };

    try {
      let res;
      if (editingOrderId) {
        res = await fetch(`/api/purchase-orders/${editingOrderId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        res = await fetch('/api/purchase-orders', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (res.ok) {
        toast.success(editingOrderId ? 'Order updated' : 'Order created');
        setIsCreateModalOpen(false);
        setEditingOrderId(null);
        setNewOrder({ label: '', vendor: '', paymentTerms: '', status: 'Pending', scheduledDelivery: '' });
        setNewLineItems([]);
        fetchOrders();
      } else {
        toast.error('Failed to save order');
      }
    } catch (e) {
      toast.error('Error saving order');
    }
  };

  const addLineItem = () => {
    setNewLineItems([...newLineItems, { id: Math.random().toString(), sku: '', qtyOrdered: 1, cost: 0, uom: '', qtyReceived: 0, lotNumber: '' }]);
  };

  const removeLineItem = (id: string) => {
    setNewLineItems(newLineItems.filter(i => i.id !== id));
  };

  const updateLineItem = (id: string, field: keyof NewLineItem, value: any) => {
    setNewLineItems(newLineItems.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        return updated;
      }
      return item;
    }));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, endpoint: string, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const loadingToast = toast.loading(`Importing ${label}...`);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data })
          });
          toast.dismiss(loadingToast);

          if (res.ok) {
            const data = await res.json();
            toast.success(`Imported/Updated ${data.count} items`);
            fetchOrders();
          } else {
            const err = await res.json();
            toast.error('Import failed: ' + err.error);
          }
        } catch (e) {
          toast.error('Import error');
          console.error(e);
        }
      }
    });
    // Reset input
    e.target.value = '';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const renderVendor = (order: PurchaseOrder) => {
    if (typeof order.vendor === 'object' && order.vendor !== null) {
      return order.vendor.name;
    }
    return order.vendor || '-';
  };

  const calculateTotal = (order: PurchaseOrder) => {
    return order.lineItems?.reduce((sum, item) => sum + ((item.qtyOrdered || 0) * (item.cost || 0)), 0) || 0;
  };

  const formatCurrency = (val: number) => {
    return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-36px)] bg-background relative transition-colors duration-300">
      {/* Header Portal: search + Add button */}
      {headerPortalTarget && createPortal(
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
          <button
            onClick={() => openCreateModal()}
            className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Add</span>
          </button>
        </>,
        headerPortalTarget
      )}

      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
            <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              {/* PO # - Text search */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="label"
                  title="PO #"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  textFilter={search}
                  onTextFilterChange={(_key, value) => {
                    const url = new URL(window.location.href);
                    if (value) url.searchParams.set('search', value);
                    else url.searchParams.delete('search');
                    router.replace(url.pathname + url.search, { scroll: false });
                  }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Vendor - Multi-select */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="vendor"
                  title="Vendor"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={vendorOptions}
                  selectedFilters={selectedVendors}
                  onFilterChange={(_key, values) => setSelectedVendors(values)}
                  className="text-muted-foreground"
                />
              </th>
              {/* Payment Terms */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="paymentTerms"
                  title="Payment Terms"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Status - Multi-select */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="status"
                  title="Status"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={statusOptions}
                  selectedFilters={selectedStatuses}
                  onFilterChange={(_key, values) => setSelectedStatuses(values)}
                  className="text-muted-foreground"
                />
              </th>
              {/* Sched. Delivery - Date range */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="scheduledDelivery"
                  title="Sched. Delivery"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  isDate
                  dateFrom={dateRange.from}
                  dateTo={dateRange.to}
                  onDateFilterChange={(_key, from, to) => setDateRange({ from, to })}
                  className="text-muted-foreground"
                />
              </th>
              {/* Received */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="receivedDate"
                  title="Received"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Created At */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="createdAt"
                  title="Created At"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Created By */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="createdBy"
                  title="Created By"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Total Amount */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="totalAmount"
                  title="Total Amount"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Items */}
              <th className="border-r border-border last:border-0">
                <TableColumnHeader
                  column="itemCount"
                  title="Items"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-[11px] text-muted-foreground">Loading Orders...</td></tr>
            ) : error ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-red-500 text-xs font-bold">{error}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-[11px] text-muted-foreground uppercase tracking-tighter opacity-50">No Orders found</td></tr>
            ) : orders.map(order => (
              <tr
                key={order._id}
                onClick={() => router.push(`/warehouse/purchase-orders/${order._id}`)}
                className="group relative z-0 bg-background transition-colors duration-150 cursor-pointer hover:bg-secondary/30"
              >
                <td className="px-2 py-1.5 border-r border-border group-hover:border-l-2 group-hover:border-l-primary transition-all">
                  <span className="text-[11px] text-muted-foreground tracking-tight font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{order.label || '-'}</span>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] border-r border-border">{renderVendor(order)}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground border-r border-border">{order.paymentTerms || '-'}</td>
                <td className="px-2 py-1.5 border-r border-border text-center">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                    order.status === 'Received' ? "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30" :
                    order.status === 'Ordered' ? "bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/30" :
                    order.status === 'Partial' ? "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30" :
                    order.status === 'Pending' ? "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-500/30" :
                    "bg-muted text-muted-foreground border border-border"
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono border-r border-border">{formatDate(order.scheduledDelivery)}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono border-r border-border">{formatDate(order.receivedDate)}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono border-r border-border">{formatDate(order.createdAt)}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] border-r border-border">
                  {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono text-right border-r border-border">
                  {formatCurrency(calculateTotal(order))}
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground text-center">
                  {order.lineItems?.length || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      {/* Create / Edit Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-border flex flex-col max-h-[90vh] rounded shadow-2xl">
            <div className="flex items-center justify-between px-6 h-[36px] border-b border-border bg-secondary/50 shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{editingOrderId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <form id="create-po-form" onSubmit={handleCreateOrUpdate} className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">PO Label <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      disabled
                      value={newOrder.label}
                      onChange={e => setNewOrder({ ...newOrder, label: e.target.value })}
                      className="w-full px-3 h-[36px] border border-border rounded text-sm bg-secondary text-muted-foreground cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Vendor <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      triggerClassName="h-[36px]"
                      options={allVendors.map(v => ({ value: v._id, label: v.name }))}
                      value={newOrder.vendor}
                      onChange={(val) => setNewOrder({ ...newOrder, vendor: val })}
                      placeholder="Select Vendor..."
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Status</label>
                    <select
                      value={newOrder.status}
                      onChange={e => setNewOrder({ ...newOrder, status: e.target.value })}
                      className="w-full px-3 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Received">Received</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Payment Terms</label>
                    <SearchableSelect
                      triggerClassName="h-[36px]"
                      options={[
                        { label: 'Net 15', value: 'Net 15' },
                        { label: 'Net 30', value: 'Net 30' },
                        { label: 'Net 60', value: 'Net 60' },
                        { label: 'Due on Receipt', value: 'Due on Receipt' },
                        { label: 'ACH', value: 'ACH' },
                        { label: 'CC', value: 'CC' },
                        { label: 'ACH-Already Paid', value: 'ACH-Already Paid' },
                        { label: 'Credit Card', value: 'Credit Card' }
                      ]}
                      value={newOrder.paymentTerms}
                      onChange={(val) => setNewOrder({ ...newOrder, paymentTerms: val })}
                      placeholder="Select Terms..."
                      creatable
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Scheduled Delivery</label>
                    <input
                      type="date"
                      value={newOrder.scheduledDelivery}
                      onChange={e => setNewOrder({ ...newOrder, scheduledDelivery: e.target.value })}
            className="w-full px-3 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest">Line Items</h3>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="flex items-center space-x-1 px-3 h-8 bg-secondary hover:bg-secondary/80 text-foreground rounded text-[10px] font-bold uppercase transition-colors shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  {newLineItems.length === 0 ? (
                    <div className="text-center py-12 bg-secondary/20 rounded border border-dashed border-border text-muted-foreground text-[11px] font-bold uppercase tracking-widest">
                      No items added. Click "Add Item" to start.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[9px] uppercase font-black text-muted-foreground tracking-widest px-2">
                        <div className="col-span-4">product / sku</div>
                        <div className="col-span-2">UOM</div>
                        <div className="col-span-2">Qty</div>
                        <div className="col-span-3">Unit Cost</div>
                        <div className="col-span-1 text-right">Action</div>
                      </div>
                      {newLineItems.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-start bg-secondary/20 p-2 rounded border border-border">
                          <div className="col-span-4">
                            <SearchableSelect
                              triggerClassName="h-[36px]"
                              options={allSkus
                                .filter(s => !newLineItems.some(i => i.id !== item.id && i.sku === s._id))
                                .map(s => ({ value: s._id, label: s.name }))
                              }
                              value={item.sku}
                              onChange={(val) => updateLineItem(item.id, 'sku', val)}
                              placeholder="Select SKU..."
                              className="w-full"
                            />
                          </div>
                          <div className="col-span-2">
                            <SearchableSelect
                              triggerClassName="h-[36px]"
                              options={UOM_OPTIONS}
                              value={item.uom}
                              onChange={(val) => updateLineItem(item.id, 'uom', val)}
                              placeholder="UOM"
                              creatable
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              min="1"
                              value={item.qtyOrdered}
                              onChange={(e) => updateLineItem(item.id, 'qtyOrdered', parseInt(e.target.value) || 0)}
                              className="w-full px-2 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground"
                            />
                          </div>
                          <div className="col-span-3">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.00000001"
                                value={item.cost}
                                onChange={(e) => updateLineItem(item.id, 'cost', parseFloat(e.target.value) || 0)}
                                className="w-full pl-5 pr-2 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground font-mono"
                              />
                            </div>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeLineItem(item.id)}
                              className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="px-6 h-[36px] border-t border-border bg-secondary/50 flex items-center justify-end shrink-0">
              <button
                type="submit"
                form="create-po-form"
                className="px-8 h-[28px] bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded hover:opacity-90 transition-all shadow-md cursor-pointer"
              >
                {editingOrderId ? 'Save Changes' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-10 h-10 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-foreground uppercase mb-2">Confirm Delete</h3>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                Are you sure you want to delete this order? This action cannot be undone.
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setDeleteConfirm({ isOpen: false, orderId: null })}
                  className="px-4 py-2 border border-border rounded text-xs font-bold text-muted-foreground uppercase hover:bg-secondary/50 transition-colors min-w-[80px]"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase hover:bg-red-700 transition-colors min-w-[80px]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-border bg-background transition-colors duration-300">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalOrders}
          itemsPerPage={25}
          itemName="Orders"
        />
      </div>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading...</div>}>
      <PurchaseOrdersContent />
    </Suspense>
  );
}
