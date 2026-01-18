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
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-secondary/50 transition-colors">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter">Manufacturing</h1>
          <button
            onClick={() => router.push('/warehouse/manufacturing/new')}
            className="h-8 px-3 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors flex items-center gap-1.5 rounded shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search WO# or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
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
            className="h-8"
          />
          <MultiSelectFilter
            label="Creator"
            icon={User}
            options={creatorOptions}
            selectedValues={selectedCreators}
            onChange={setSelectedCreators}
            className="h-8"
          />

          {/* Date Range - Simplified for now */}
          <div className="flex items-center space-x-1 border border-border bg-card px-2 h-8 rounded">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px] bg-transparent text-foreground"
              value={dateRange.from}
              onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
            />
            <span className="text-muted-foreground">-</span>
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px] bg-transparent text-foreground"
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
              className="h-[30px] w-[30px] bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm flex items-center justify-center rounded-none cursor-pointer"
              title="Import Manufacturing Orders"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => liInputRef.current?.click()}
              className="h-[30px] w-[30px] bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm flex items-center justify-center rounded-none cursor-pointer"
              title="Import Line Items"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => laborInputRef.current?.click()}
              className="h-[30px] w-[30px] bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm flex items-center justify-center rounded-none cursor-pointer"
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
            className="h-[30px] w-[30px] bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shadow-sm flex items-center justify-center rounded-none cursor-pointer"
            title="Import Notes"
          >
            <Upload className="w-4 h-4" />
          </button>

        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10 transition-colors duration-300">
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
                  className="px-2 py-1 text-[8px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/80 transition-colors border-r border-border last:border-0"
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2 h-2", sortBy === col.key ? "text-foreground" : "text-muted-foreground/30")} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={13} className="px-2 py-4 text-center text-[10px] text-muted-foreground italic">Loading Orders...</td></tr>
            ) : error ? (
              <tr><td colSpan={13} className="px-2 py-4 text-center text-destructive text-[10px] font-bold">{error}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={13} className="px-2 py-4 text-center text-[10px] text-muted-foreground uppercase font-medium tracking-tighter opacity-50">No Orders found</td></tr>
            ) : orders.map(order => {
              const unitCost = order.qty && order.qty > 0 ? (order.totalCost || 0) / order.qty : 0;
              return (
              <tr
                key={order._id}
                className="hover:bg-primary/5 hover:scale-[1.008] hover:shadow-md transition-all duration-200 group cursor-pointer relative z-0 hover:z-10"
                onClick={() => router.push(`/warehouse/manufacturing/${order._id}`)}
              >
                <td className="px-2 py-1.5 text-[10px] font-bold text-foreground tracking-tight font-mono">{order.label || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
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
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">{order.qty}</td>
                <td className="px-2 py-1.5 text-[8px] uppercase font-bold text-muted-foreground">{order.priority}</td>
                <td className="px-2 py-1.5">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-[2px] text-[8px] font-bold uppercase",
                    order.status === 'Completed' ? "bg-green-500/10 text-green-500" :
                      order.status === 'In Progress' ? "bg-blue-500/10 text-blue-500" :
                        "bg-muted text-muted-foreground"
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                  {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
                </td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">${(order.materialCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">${(order.packagingCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">${(order.laborCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-foreground font-mono font-bold">${(order.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-emerald-500 font-mono font-bold">${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 relative" onClick={(e) => e.stopPropagation()}>
                  <div className="relative" ref={openMenuId === order._id ? menuRef : null}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === order._id ? null : order._id)}
                      className="p-1 hover:bg-secondary rounded transition-colors cursor-pointer"
                    >
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </button>
                    {openMenuId === order._id && (
                      <div className="absolute right-0 top-full mt-1 bg-card border border-border shadow-lg z-50 min-w-[120px] py-1">
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            router.push(`/warehouse/manufacturing/${order._id}`);
                          }}
                          className="w-full px-3 py-1.5 text-left text-[10px] font-medium text-foreground hover:bg-secondary flex items-center gap-2 cursor-pointer transition-colors"
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
                          className="w-full px-3 py-1.5 text-left text-[10px] font-medium text-destructive hover:bg-destructive/10 flex items-center gap-2 cursor-pointer transition-colors"
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
