'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowUpDown,
  Globe,
  Loader2,
  Calendar,
  ShoppingBag,
  Package,
  CreditCard,
  Truck,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { Pagination } from '@/components/ui/Pagination';

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
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    city: string;
    state: string;
    country: string;
  };
  paymentMethodTitle: string;
  website: string;
  lineItems: any[];
}

export default function WebOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('dateCreated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedWebsites, setSelectedWebsites] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    currentStep: '',
    progress: 0,
    total: 0,
    logs: [] as string[],
    currentOrderNumber: '',
    currentOrderDate: '',
    currentOrderTotal: 0,
    currentOrderCustomer: '',
    currentSite: '',
    fetchingPhase: false,
    fetchingPage: 0,
    fetchingFound: 0,
    fetchingSite: '',
    isFullSync: false,
    stats: { added: 0, updated: 0, skipped: 0 },
    debug: { logsCount: 0, lastLog: null as string | null }
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: debouncedSearch,
        sortBy,
        sortOrder,
        website: selectedWebsites.join(','),
        status: selectedStatuses.join(','),
        fromDate: dateRange.from,
        toDate: dateRange.to
      });

      const res = await fetch(`/api/retail/web-orders?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);
      } else {
        toast.error('Failed to load orders');
      }
    } catch (e) {
      toast.error('Error loading orders');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedWebsites, selectedStatuses, dateRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSync = async (fullSync = false) => {
    try {
      const url = fullSync 
        ? '/api/retail/web-orders/sync?full=true' 
        : '/api/retail/web-orders/sync';
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        toast.success(fullSync ? 'Full sync started' : 'Incremental sync started');
        pollSyncProgress();
      } else {
        const err = await res.json();
        toast.error('Failed: ' + err.error);
      }
    } catch (e) {
      toast.error('Sync error');
    }
  };

  const pollSyncProgress = useCallback(async () => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/retail/web-orders/sync');
        const data = await res.json();
        setSyncStatus(data);

        if (!data.isSyncing && (data.currentStep === 'Complete' || data.currentStep === 'Failed')) {
          clearInterval(timer);
          if (data.currentStep === 'Complete') {
            toast.success('Orders synced!');
            fetchOrders();
          } else {
            toast.error('Sync failed');
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1000);
  }, [fetchOrders]);

  useEffect(() => {
    fetch('/api/retail/web-orders/sync').then(res => res.json()).then(data => {
      if (data.isSyncing) {
        setSyncStatus(data);
        pollSyncProgress();
      }
    });
  }, [pollSyncProgress]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'on-hold': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'cancelled': case 'refunded': case 'failed': return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  const getWebsiteColor = (website: string) => {
    if (website?.includes('KING')) return 'bg-amber-500';
    if (website?.includes('GRASS')) return 'bg-emerald-500';
    if (website?.includes('GRHK')) return 'bg-blue-500';
    if (website?.includes('REBEL')) return 'bg-purple-500';
    return 'bg-slate-500';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white">
      {syncStatus.isSyncing && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 flex items-center justify-between text-white animate-in slide-in-from-top duration-300 shadow-lg">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            
            {/* Fetching Phase Display */}
            {syncStatus.fetchingPhase ? (
              <>
                <div className="bg-amber-500/80 px-2.5 py-0.5 rounded-full shrink-0">
                  <span className="text-[10px] font-black uppercase tracking-wider">Fetching</span>
                </div>
                <div className="h-4 w-px bg-blue-400/50 shrink-0" />
                <div className="flex items-center space-x-3 min-w-0">
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-black uppercase tracking-wider shrink-0">
                    {syncStatus.fetchingSite}
                  </span>
                  <span className="text-[10px] font-bold shrink-0">
                    Page {syncStatus.fetchingPage}
                  </span>
                  <div className="h-4 w-px bg-blue-400/50 shrink-0" />
                  <span className="text-[11px] font-black font-mono bg-emerald-500/80 px-2 py-0.5 rounded shrink-0">
                    {syncStatus.fetchingFound} orders found
                  </span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Syncing Phase - Progress percentage */}
                <div className="bg-blue-500/50 px-2 py-0.5 rounded-full shrink-0">
                  <span className="text-[11px] font-black font-mono">
                    {syncStatus.total > 0 ? `${Math.round((syncStatus.progress / syncStatus.total) * 100)}%` : '0%'}
                  </span>
                </div>
                
                {/* Current order details */}
                {syncStatus.currentOrderNumber ? (
                  <>
                    <div className="h-4 w-px bg-blue-400/50 shrink-0" />
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider shrink-0">Order #{syncStatus.currentOrderNumber}</span>
                      <span className="text-[9px] text-blue-200 font-medium truncate max-w-[100px]">{syncStatus.currentOrderCustomer}</span>
                      <span className="text-[9px] text-blue-300 font-mono shrink-0">
                        {syncStatus.currentOrderDate ? new Date(syncStatus.currentOrderDate).toLocaleDateString() : ''}
                      </span>
                      <span className="text-[10px] font-black font-mono bg-white/20 px-1.5 py-0.5 rounded shrink-0">
                        ${syncStatus.currentOrderTotal?.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-4 w-px bg-blue-400/50 shrink-0" />
                    <span className="px-2 py-0.5 bg-blue-500/40 rounded text-[8px] font-black uppercase tracking-widest shrink-0">
                      {syncStatus.currentSite}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-bold text-blue-100 truncate">
                    {syncStatus.currentStep || syncStatus.debug?.lastLog || 'Initializing...'}
                  </span>
                )}
                
                {/* Progress bar */}
                {syncStatus.total > 0 && (
                  <div className="flex-1 max-w-[200px] bg-blue-400/30 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-white h-full transition-all duration-300 rounded-full" 
                      style={{ width: `${(syncStatus.progress / syncStatus.total) * 100}%` }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Counter */}
          <div className="text-[10px] font-mono font-bold bg-blue-500/30 px-2 py-1 rounded shrink-0">
            {syncStatus.fetchingPhase 
              ? `Scanning ${syncStatus.fetchingSite}...`
              : `${syncStatus.progress} / ${syncStatus.total}`
            }
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter flex items-center space-x-2">
            <ShoppingBag className="w-4 h-4" />
            <span>Web Orders</span>
          </h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Order#, Customer, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-72 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="Website"
            icon={Globe}
            options={[
              { label: 'KINGKKRATOM', value: 'KINGKKRATOM' },
              { label: 'GRASSROOTSHARVEST', value: 'GRASSROOTSHARVEST' },
              { label: 'GRHKTATOM', value: 'GRHKTATOM' },
              { label: 'REBELXBRANDS', value: 'REBELXBRANDS' }
            ]}
            selectedValues={selectedWebsites}
            onChange={setSelectedWebsites}
          />

          <MultiSelectFilter
            label="Status"
            icon={Package}
            options={[
              { label: 'Completed', value: 'completed' },
              { label: 'Processing', value: 'processing' },
              { label: 'Pending', value: 'pending' },
              { label: 'On Hold', value: 'on-hold' },
              { label: 'Cancelled', value: 'cancelled' },
              { label: 'Refunded', value: 'refunded' },
              { label: 'Failed', value: 'failed' }
            ]}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
          />

          <div className="flex items-center space-x-1 border border-slate-200 bg-white px-3 h-[30px] rounded-sm">
            <Calendar className="w-3 h-3 text-slate-400" />
            <input
              type="date"
              className="text-[10px] outline-none max-w-[90px] bg-transparent"
              value={dateRange.from}
              onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              className="text-[10px] outline-none max-w-[90px] bg-transparent"
              value={dateRange.to}
              onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
            />
          </div>

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <button
            onClick={() => handleSync(false)}
            disabled={syncStatus.isSyncing}
            className="px-3 py-1.5 bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center space-x-2 rounded-sm disabled:opacity-50"
            title="Incremental Sync - Only changed orders"
          >
            {syncStatus.isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">Sync</span>
          </button>
          
          <button
            onClick={() => handleSync(true)}
            disabled={syncStatus.isSyncing}
            className="px-3 py-1.5 bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm flex items-center space-x-2 rounded-sm disabled:opacity-50"
            title="Full Sync - All orders from scratch"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Full</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'number', label: 'Order #' },
                { key: 'website', label: 'Source' },
                { key: 'billing.firstName', label: 'Customer' },
                { key: 'status', label: 'Status' },
                { key: 'dateCreated', label: 'Date' },
                { key: 'total', label: 'Total' },
                { key: 'paymentMethodTitle', label: 'Payment' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0 whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-black" : "text-slate-200")} />
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-center">Items</th>
              <th className="px-3 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-[10px] text-slate-400">Loading Web Orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Orders Found</td></tr>
            ) : orders.map(order => (
              <tr
                key={order._id}
                onClick={() => router.push(`/sales/web-orders/${order._id}`)}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
              >
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-slate-900 font-mono tracking-tighter">#{order.number}</span>
                    <span className="text-[8px] text-slate-400 font-mono">WC-{order.webId}</span>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black text-white uppercase tracking-widest shadow-sm",
                    getWebsiteColor(order.website)
                  )}>
                    {order.website}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-slate-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-700">{order.billing?.firstName} {order.billing?.lastName}</span>
                      <span className="text-[8px] text-slate-400 truncate max-w-[120px]">{order.billing?.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded-[3px] text-[8px] font-black uppercase tracking-wider border",
                    getStatusColor(order.status)
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-[10px] text-slate-500 font-mono">
                  {order.dateCreated ? new Date(order.dateCreated).toLocaleDateString() : '-'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-slate-900 font-mono">${order.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {order.shippingTotal > 0 && (
                      <span className="text-[8px] text-slate-400 flex items-center space-x-0.5">
                        <Truck className="w-2.5 h-2.5" />
                        <span>+${order.shippingTotal?.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center space-x-1.5">
                    <CreditCard className="w-3 h-3 text-slate-300" />
                    <span className="text-[9px] text-slate-500 truncate max-w-[80px]">{order.paymentMethodTitle || '-'}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[9px] font-black text-slate-600">
                    {order.lineItems?.length || 0}
                  </span>
                </td>
                <td className="px-3 py-2 text-[9px] text-slate-500 truncate max-w-[100px]">
                  {order.billing?.city}, {order.billing?.state}
                </td>
              </tr>
            ))}
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
