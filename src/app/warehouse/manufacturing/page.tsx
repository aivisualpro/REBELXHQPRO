'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  ArrowUpDown,
  Filter,
  Calendar,
  User,
  Factory,
  Plus,
  MoreVertical,
  Pencil,
  Trash2
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';

interface LineItem {
  _id: string;
  lotNumber: string;
  recipeId: string;
  sku: string;
  uom: string;
  recipeQty: number;
  sa: number;
  qtyExtra: number;
  qtyScrapped: number;
  createdAt: string;
}

interface ManufacturingOrder {
  _id: string;
  label?: string;
  sku: { _id: string; name: string } | string;
  recipesId: string;
  uom: string;
  qty: number;
  qtyDifference: number;
  scheduledStart: string;
  scheduledFinish: string;
  priority: string;
  status: string;
  createdBy?: { firstName: string, lastName: string };
  finishedBy?: { firstName: string, lastName: string };
  createdAt: string;
  lineItems?: LineItem[];
  // Cost fields
  materialCost?: number;
  packagingCost?: number;
  laborCost?: number;
  totalCost?: number;
}

export default function ManufacturingPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
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
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [selectedCreators, setSelectedCreators] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string, to: string }>({ from: '', to: '' });

  // Filter Options (Populated dynamically from fetched data for simplicity in this iteration)
  const [skuOptions, setSkuOptions] = useState<{ label: string, value: string }[]>([]);
  const [skuList, setSkuList] = useState<any[]>([]);
  const [creatorOptions, setCreatorOptions] = useState<{ label: string, value: string }[]>([]);

  const woInputRef = useRef<HTMLInputElement>(null);
  const liInputRef = useRef<HTMLInputElement>(null);
  const laborInputRef = useRef<HTMLInputElement>(null);
  const notesInputRef = useRef<HTMLInputElement>(null);


  // Action Menu State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

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

      if (selectedSkus.length) params.append('sku', selectedSkus.join(','));
      if (selectedCreators.length) params.append('createdBy', selectedCreators.join(','));
      if (dateRange.from) params.append('fromDate', dateRange.from);
      if (dateRange.to) params.append('toDate', dateRange.to);

      const res = await fetch(`/api/manufacturing?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);

        // Local derivation removed - options are now fetched globally on mount

      } else {
        setError(data.error || 'Failed to fetch orders');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedSkus, selectedCreators, dateRange]);

  // Fetch global filter options on mount
  useEffect(() => {
    // 1. Fetch SKUs
    fetch('/api/reports/cogm/skus')
      .then(res => res.json())
      .then(data => {
        if (data.skus) {
          setSkuList(data.skus);
          setSkuOptions(data.skus.map((s: any) => ({ label: s.name, value: s._id })));
        }
      })
      .catch(err => console.error("Failed to fetch SKU options", err));

    // 2. Fetch Creators (Users)
    fetch('/api/users?limit=0')
      .then(res => {
          if (!res.ok) throw new Error('Failed to fetch users');
          return res.json();
      })
      .then(data => {
        if (data.users) {
          setCreatorOptions(data.users.map((u: any) => ({ label: `${u.firstName} ${u.lastName}`, value: u._id })));
        }
      })
      .catch(err => console.error("Failed to fetch Creator options", err));
  }, []);

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, endpoint: string, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // Keep as strings to avoid parsing issues
      complete: async (results) => {
        try {
          console.log('Parsed CSV data:', results.data); // Debug log
          console.log('First row:', results.data[0]); // Debug log
          
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
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };


  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Manufacturing</h1>
          <button
            onClick={() => router.push('/warehouse/manufacturing/new')}
            className="h-[28px] px-3 bg-black text-white text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors flex items-center gap-1.5 rounded-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search WO# or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="SKU"
            icon={Factory}
            options={skuOptions}
            selectedValues={selectedSkus}
            onChange={setSelectedSkus}
          />
          <MultiSelectFilter
            label="Creator"
            icon={User}
            options={creatorOptions}
            selectedValues={selectedCreators}
            onChange={setSelectedCreators}
          />

          {/* Date Range - Simplified for now */}
          <div className="flex items-center space-x-1 border border-slate-200 bg-white px-2 py-1.5 rounded-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px]"
              value={dateRange.from}
              onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px]"
              value={dateRange.to}
              onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
            />
          </div>

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={woInputRef}
            onChange={(e) => handleImport(e, '/api/manufacturing/import', 'WO Data')}
          />
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={liInputRef}
            onChange={(e) => handleImport(e, '/api/manufacturing/import-lineitems', 'Line Items')}
          />
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={laborInputRef}
            onChange={(e) => handleImport(e, '/api/manufacturing/import-labor', 'Labor')}
          />

          <div className="flex items-center space-x-2">
            <button
              onClick={() => woInputRef.current?.click()}
              className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-none"
              title="Import Manufacturing Orders"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => liInputRef.current?.click()}
              className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-none"
              title="Import Line Items"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => laborInputRef.current?.click()}
              className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-none"
              title="Import Labor"
            >
              <Upload className="w-4 h-4" />
            </button>
          </div>

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={notesInputRef}
            onChange={(e) => handleImport(e, '/api/manufacturing/import-notes', 'Notes')}
          />
          <button
            onClick={() => notesInputRef.current?.click()}
            className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-none"
            title="Import Notes"
          >
            <Upload className="w-4 h-4" />
          </button>

        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'label', label: 'WO#' },
                { key: 'createdAt', label: 'Date' },
                { key: 'sku', label: 'SKU' },
                { key: 'qty', label: 'Qty Mfg.' },
                { key: 'priority', label: 'Priority' },
                { key: 'status', label: 'Status' },
                { key: 'createdBy', label: 'Created By' },
                { key: 'materialCost', label: 'Mat. Cost' },
                { key: 'packagingCost', label: 'Pack. Cost' },
                { key: 'laborCost', label: 'Labor Cost' },
                { key: 'totalCost', label: 'Total Cost' },
                { key: 'unitCost', label: 'Unit Cost' },
                { key: 'actions', label: '' },
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={13} className="px-2 py-4 text-center text-[10px] text-slate-400">Loading Orders...</td></tr>
            ) : error ? (
              <tr><td colSpan={13} className="px-2 py-4 text-center text-red-500 text-[10px] font-bold">{error}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={13} className="px-2 py-4 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Orders found</td></tr>
            ) : orders.map(order => {
              const unitCost = order.qty && order.qty > 0 ? (order.totalCost || 0) / order.qty : 0;
              return (
              <tr
                key={order._id}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => router.push(`/warehouse/manufacturing/${order._id}`)}
              >
                <td className="px-2 py-1.5 text-[10px] font-bold text-slate-900 tracking-tight font-mono">{order.label || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-2 py-1.5 text-[10px] text-slate-600 font-medium whitespace-nowrap">
                   <div className="flex items-center space-x-1.5">
                      {(() => {
                        const skuId = typeof order.sku === 'object' ? order.sku?._id : order.sku;
                        const skuData = (typeof order.sku === 'object' && (order.sku as any).tier) ? order.sku : skuList.find(s => s._id === skuId);
                        const tier = skuData?.tier;
                        if (!tier) return null;
                        return (
                          <span className={cn(
                            "flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black text-white",
                            tier === 1 ? "bg-emerald-500" :
                            tier === 2 ? "bg-blue-500" :
                            "bg-orange-500"
                          )} title={`Tier ${tier}`}>
                            {tier}
                          </span>
                        );
                      })()}
                      <span className="max-w-[150px] overflow-hidden text-ellipsis">
                        {typeof order.sku === 'object' ? order.sku?.name : (skuList.find(s => s._id === order.sku)?.name || order.sku)}
                      </span>
                   </div>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono">{order.qty}</td>
                <td className="px-2 py-1.5 text-[8px] uppercase font-bold text-slate-500">{order.priority}</td>
                <td className="px-2 py-1.5">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-[2px] text-[8px] font-bold uppercase",
                    order.status === 'Completed' ? "bg-green-100 text-green-700" :
                      order.status === 'In Progress' ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-600"
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-slate-600">
                  {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
                </td>
                <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono">${(order.materialCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono">${(order.packagingCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono">${(order.laborCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-slate-700 font-mono font-bold">${(order.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-emerald-600 font-mono font-bold">${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 relative" onClick={(e) => e.stopPropagation()}>
                  <div className="relative" ref={openMenuId === order._id ? menuRef : null}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === order._id ? null : order._id)}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                    {openMenuId === order._id && (
                      <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 shadow-lg z-50 min-w-[120px] py-1">
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            router.push(`/warehouse/manufacturing/${order._id}`);
                          }}
                          className="w-full px-3 py-1.5 text-left text-[10px] font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Are you sure you want to delete this order?')) return;
                            setOpenMenuId(null);
                            try {
                              const res = await fetch(`/api/manufacturing/${order._id}`, { method: 'DELETE' });
                              if (res.ok) {
                                toast.success('Order deleted');
                                fetchOrders();
                              } else {
                                toast.error('Failed to delete order');
                              }
                            } catch (e) {
                              toast.error('Error deleting order');
                            }
                          }}
                          className="w-full px-3 py-1.5 text-left text-[10px] font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

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
