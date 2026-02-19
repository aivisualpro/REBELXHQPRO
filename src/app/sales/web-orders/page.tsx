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
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';

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
        limit: '25',
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
    if (website?.includes('GUD')) return 'bg-orange-500';
    return 'bg-slate-500';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-secondary/50 transition-colors">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter flex items-center space-x-2">
            <ShoppingBag className="w-4 h-4 text-primary" />
            <span>Web Orders</span>
          </h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Order#, Customer, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-72 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
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
              { label: 'REBELXBRANDS', value: 'REBELXBRANDS' },
              { label: 'GUDTONICS', value: 'GUDTONICS' }
            ]}
            selectedValues={selectedWebsites}
            onChange={setSelectedWebsites}
            className="h-8"
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
            className="h-8"
          />

          <div className="flex items-center space-x-1 border border-border bg-card px-3 h-8 rounded">
            <Calendar className="w-3 h-3 text-muted-foreground" />
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
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
            <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
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
                  className="border-r border-border last:border-0"
                >
                  <TableColumnHeader
                    column={col}
                    title={col.label}
                    currentSortBy={sortBy}
                    currentSortOrder={sortOrder}
                    onSort={(key, dir) => {
                      setSortBy(key);
                      setSortOrder(dir);
                    }}
                    onFilter={(key) => {
                      toast(`Filtering by ${col.label} implementation pending`);
                    }}
                    className="text-muted-foreground"
                  />
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center border-r border-border">Items</th>
               <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-[10px] text-slate-400">Loading Web Orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Orders Found</td></tr>
            ) : orders.map(order => (
              <tr
                key={order._id}
                onClick={() => router.push(`/sales/web-orders/${order._id}`)}
                className="hover:bg-secondary/40 hover:scale-[1.002] hover:shadow-md transition-all duration-200 group relative z-0 hover:z-10 bg-background cursor-pointer"
              >
                <td className="px-3 py-1.5 border-r border-border">
                  <div className="flex flex-col">
                    <span className="font-black text-foreground font-mono tracking-tighter">#{order.number}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">WC-{order.webId}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 border-r border-border text-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-sm border border-black/5",
                    getWebsiteColor(order.website)
                  )}>
                    {order.website}
                  </span>
                </td>
                <td className="px-3 py-1.5 border-r border-border">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded bg-secondary flex items-center justify-center shrink-0">
                      <User className="w-2.5 h-2.5 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-foreground text-[10px] truncate">{order.billing?.firstName} {order.billing?.lastName}</span>
                      <span className="truncate max-w-[120px] text-[9px] text-muted-foreground">{order.billing?.email}</span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-1.5 border-r border-border text-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                    getStatusColor(order.status).replace('bg-', 'bg-').replace('text-', 'text-')
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-3 py-1.5 border-r border-border font-mono text-[10px] text-muted-foreground">
                  {order.dateCreated ? new Date(order.dateCreated).toLocaleDateString() : '-'}
                </td>
                <td className="px-3 py-1.5 border-r border-border">
                  <div className="flex flex-col">
                    <span className="font-black text-foreground font-mono text-[10px]">${order.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {order.shippingTotal > 0 && (
                      <span className="flex items-center space-x-0.5 text-[9px] text-muted-foreground">
                        <Truck className="w-2.5 h-2.5" />
                        <span>+${order.shippingTotal?.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-1.5 border-r border-border">
                  <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground">
                    <CreditCard className="w-3 h-3 opacity-50" />
                    <span className="truncate max-w-[80px]">{order.paymentMethodTitle || '-'}</span>
                  </div>
                </td>
                <td className="px-3 py-1.5 border-r border-border text-center">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-secondary text-[9px] font-black text-foreground/70">
                    {order.lineItems?.length || 0}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-[9px] text-muted-foreground truncate max-w-[100px]">
                  {order.billing?.city}, {order.billing?.state}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

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
