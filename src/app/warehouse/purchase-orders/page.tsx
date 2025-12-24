'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  AlertCircle
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

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

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

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
        const sRes = await fetch('/api/skus?limit=1000');
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
    return '$' + val.toFixed(2);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Purchase Orders</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search PO# or Vendor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="Vendor"
            icon={Building2}
            options={vendorOptions}
            selectedValues={selectedVendors}
            onChange={setSelectedVendors}
            className="h-[30px]"
          />
          <MultiSelectFilter
            label="Status"
            icon={ShoppingCart}
            options={statusOptions}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
            className="h-[30px]"
          />

          <div className="flex items-center space-x-1 border border-slate-200 bg-white px-3 h-[30px] rounded-sm">
            <Calendar className="w-3 h-3 text-slate-400" />
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px] bg-transparent"
              value={dateRange.from}
              onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px] bg-transparent"
              value={dateRange.to}
              onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
            />
          </div>

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={poInputRef}
            onChange={(e) => handleImport(e, '/api/purchase-orders/import', 'PO Data')}
          />
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={liInputRef}
            onChange={(e) => handleImport(e, '/api/purchase-orders/import-lineitems', 'Line Items')}
          />

          <button
            onClick={() => poInputRef.current?.click()}
            className="h-[30px] px-3 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1.5"
            title="Import Purchase Orders"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Import PO</span>
          </button>

          <button
            onClick={() => liInputRef.current?.click()}
            className="h-[30px] px-3 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1.5"
            title="Import Line Items"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Import Line Items</span>
          </button>

          <button
            onClick={openCreateModal}
            className="h-[30px] w-[30px] bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center rounded-sm"
            title="Add PO"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'label', label: 'PO #' },
                { key: 'vendor', label: 'Vendor' },
                { key: 'paymentTerms', label: 'Payment Terms' },
                { key: 'status', label: 'Status' },
                { key: 'scheduledDelivery', label: 'Sched. Delivery' },
                { key: 'receivedDate', label: 'Received' },
                { key: 'createdAt', label: 'Created At' },
                { key: 'createdBy', label: 'Created By' },
                { key: 'totalAmount', label: 'Total Amount' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0"
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2 h-2", sortBy === col.key ? "text-black" : "text-slate-200")} />
                  </div>
                </th>
              ))}
              <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center border-l border-slate-100">Items</th>
              <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-xs text-slate-400">Loading Orders...</td></tr>
            ) : error ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-red-500 text-xs font-bold">{error}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Orders found</td></tr>
            ) : orders.map(order => (
              <tr
                key={order._id}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => router.push(`/warehouse/purchase-orders/${order._id}`)}
              >
                <td className="px-4 py-2 text-[11px] font-bold text-slate-900 tracking-tight">{order.label || '-'}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600 font-medium">{renderVendor(order)}</td>
                <td className="px-4 py-2 text-[10px] text-slate-500">{order.paymentTerms || '-'}</td>
                <td className="px-4 py-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    order.status === 'Received' ? "bg-green-100 text-green-700" :
                      order.status === 'Ordered' ? "bg-blue-100 text-blue-700" :
                        order.status === 'Partial' ? "bg-yellow-100 text-yellow-700" :
                          "bg-slate-100 text-slate-600"
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{formatDate(order.scheduledDelivery)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{formatDate(order.receivedDate)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{formatDate(order.createdAt)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600">
                  {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
                </td>
                <td className="px-4 py-2 text-[11px] font-bold text-slate-900">
                  {formatCurrency(calculateTotal(order))}
                </td>
                <td className="px-4 py-2 text-center text-[11px] font-bold text-slate-600 border-l border-slate-50">
                  {order.lineItems?.length || 0}
                </td>
                <td className="px-4 py-2 text-center border-l border-slate-50">
                  <div className="flex items-center justify-center space-x-1">
                    <button
                      onClick={(e) => handleEditClick(e, order)}
                      className="p-1 text-slate-400 hover:text-blue-600 transition-colors relative z-20"
                      title="Edit Order"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteClick(e, order._id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors relative z-20"
                      title="Delete Order"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h2 className="text-sm font-bold uppercase text-slate-900">{editingOrderId ? 'Edit Purchase Order' : 'Create Purchase Order'}</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <form id="create-po-form" onSubmit={handleCreateOrUpdate} className="space-y-6">
                {/* Header Info */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">PO Label <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      disabled
                      value={newOrder.label}
                      onChange={e => setNewOrder({ ...newOrder, label: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-slate-100 text-slate-500 cursor-not-allowed focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Vendor <span className="text-red-500">*</span></label>
                    <SearchableSelect
                      options={allVendors.map(v => ({ value: v._id, label: v.name }))}
                      value={newOrder.vendor}
                      onChange={(val) => setNewOrder({ ...newOrder, vendor: val })}
                      placeholder="Select Vendor..."
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Status</label>
                    <select
                      value={newOrder.status}
                      onChange={e => setNewOrder({ ...newOrder, status: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10 bg-white"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Received">Received</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Payment Terms</label>
                    <input
                      type="text"
                      value={newOrder.paymentTerms}
                      onChange={e => setNewOrder({ ...newOrder, paymentTerms: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                      placeholder="e.g. Net 30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Scheduled Delivery</label>
                    <input
                      type="date"
                      value={newOrder.scheduledDelivery}
                      onChange={e => setNewOrder({ ...newOrder, scheduledDelivery: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Line Items</h3>
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold uppercase transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>

                  {newLineItems.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded border border-dashed border-slate-200 text-slate-400 text-xs">
                      No items added. Click "Add Item" to start.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-slate-400 px-2">
                        <div className="col-span-4">product / sku</div>
                        <div className="col-span-2">UOM</div>
                        <div className="col-span-2">Qty</div>
                        <div className="col-span-3">Unit Cost</div>
                        <div className="col-span-1"></div>
                      </div>
                      {newLineItems.map((item, index) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-start bg-slate-50/50 p-2 rounded border border-slate-100">
                          <div className="col-span-4">
                            <SearchableSelect
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
                              className="w-full px-2 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                            />
                          </div>
                          <div className="col-span-3">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.00000001"
                                value={item.cost}
                                onChange={(e) => updateLineItem(item.id, 'cost', parseFloat(e.target.value) || 0)}
                                className="w-full pl-5 pr-2 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                              />
                            </div>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => removeLineItem(item.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
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

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                type="submit"
                form="create-po-form"
                className="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase rounded hover:bg-slate-800 transition-colors"
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
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Confirm Delete</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Are you sure you want to delete this order? This action cannot be undone.
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setDeleteConfirm({ isOpen: false, orderId: null })}
                  className="px-4 py-2 border border-slate-200 rounded text-xs font-bold text-slate-600 uppercase hover:bg-slate-50 transition-colors min-w-[80px]"
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

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalOrders}
        itemsPerPage={20}
        itemName="Orders"
      />
    </div>
  );
}
