'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Search,
  Loader2,
  CreditCard,
  Truck,
  X,
  Download,
  Upload,
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

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



  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('header-portal-target');
    if (el) setHeaderPortalTarget(el);
  }, []);

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
  }, [page, debouncedSearch, sortBy, sortOrder]);

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
    if (website?.includes('KING')) return 'bg-gradient-to-r from-amber-600 to-orange-500';
    if (website?.includes('GRASS')) return 'bg-gradient-to-r from-emerald-600 to-green-500';
    if (website?.includes('GRHK')) return 'bg-gradient-to-r from-sky-600 to-blue-500';
    if (website?.includes('REBEL')) return 'bg-gradient-to-r from-violet-600 to-purple-500';
    if (website?.includes('GUD')) return 'bg-gradient-to-r from-rose-600 to-pink-500';
    return 'bg-zinc-500';
  };

  // === Export / Import ===
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleExportLineItems = async () => {
    setExporting(true);
    const toastId = toast.loading('Exporting line items...');
    try {
      const res = await fetch('/api/retail/web-orders/export-lineitems');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Export failed');

      const csv = Papa.unparse(json.data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `web-order-lineitems-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${json.total} line items`, { id: toastId });
    } catch (e: any) {
      toast.error(e.message || 'Export failed', { id: toastId });
    } finally {
      setExporting(false);
    }
  };

  const handleImportLineItems = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const toastId = toast.loading('Parsing CSV...');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          toast.loading(`Uploading ${results.data.length} rows...`, { id: toastId });
          const res = await fetch('/api/retail/web-orders/update-lineitems', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data })
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Import failed');
          toast.success(
            `Updated: ${json.updated} | Skipped: ${json.skipped}${json.errorCount ? ` | Errors: ${json.errorCount}` : ''}`,
            { id: toastId, duration: 6000 }
          );
          fetchOrders();
        } catch (err: any) {
          toast.error(err.message || 'Import failed', { id: toastId });
        } finally {
          setImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (err) => {
        toast.error(`CSV parse error: ${err.message}`, { id: toastId });
        setImporting(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* Header Portal: search */}
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
            onClick={handleExportLineItems}
            disabled={exporting}
            className="flex items-center space-x-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-wider rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>Export</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center space-x-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-wider rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportLineItems}
            className="hidden"
          />
        </>,
        headerPortalTarget
      )}



      {/* Table */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
            <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              {[
                { key: 'dateCreated', label: 'Date' },
                { key: 'number', label: 'Order #' },
                { key: 'website', label: 'Website' },
                { key: 'billing.firstName', label: 'Customer' },
                { key: 'status', label: 'Status' },
                { key: 'total', label: 'Total' },
                { key: 'paymentMethodTitle', label: 'Payment Type' },
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
              <tr><td colSpan={9} className="px-3 py-12 text-center text-[11px] text-muted-foreground">Loading Web Orders...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-12 text-center text-[11px] text-muted-foreground uppercase tracking-tighter opacity-50">No Orders Found</td></tr>
            ) : orders.map(order => (
              <tr
                key={order._id}
                onClick={() => router.push(`/sales/web-orders/${order._id}`)}
                className="hover:bg-secondary/40 hover:scale-[1.002] hover:shadow-md transition-all duration-200 group relative z-0 hover:z-10 bg-background cursor-pointer"
              >
                {/* Date */}
                <td className="px-3 py-1.5 border-r border-border font-mono text-[11px] text-muted-foreground">
                  {order.dateCreated ? new Date(order.dateCreated).toLocaleDateString() : '-'}
                </td>
                {/* Order # */}
                <td className="px-3 py-1.5 border-r border-border">
                  <span className="text-[11px] text-muted-foreground font-mono tracking-tighter">#{order.number}</span>
                </td>
                {/* Website */}
                <td className="px-3 py-1.5 border-r border-border">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white shadow-sm",
                    getWebsiteColor(order.website)
                  )}>
                    {order.website || 'N/A'}
                  </span>
                </td>
                {/* Customer */}
                <td className="px-3 py-1.5 border-r border-border">
                  <span className="text-[11px] text-muted-foreground truncate">{order.billing?.firstName} {order.billing?.lastName}</span>
                </td>
                {/* Status */}
                <td className="px-3 py-1.5 border-r border-border text-center">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                    getStatusColor(order.status)
                  )}>
                    {order.status}
                  </span>
                </td>
                {/* Total */}
                <td className="px-3 py-1.5 border-r border-border">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground font-mono text-[11px]">${order.total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    {order.shippingTotal > 0 && (
                      <span className="flex items-center space-x-0.5 text-[9px] text-muted-foreground">
                        <Truck className="w-2.5 h-2.5" />
                        <span>+${order.shippingTotal?.toFixed(2)}</span>
                      </span>
                    )}
                  </div>
                </td>
                {/* Payment Type */}
                <td className="px-3 py-1.5 border-r border-border">
                  <div className="flex items-center space-x-1.5 text-[11px] text-muted-foreground">
                    <CreditCard className="w-3 h-3 opacity-50" />
                    <span className="truncate max-w-[80px]">{order.paymentMethodTitle || '-'}</span>
                  </div>
                </td>
                {/* Items */}
                <td className="px-3 py-1.5 border-r border-border text-center">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-secondary text-[9px] font-black text-foreground/70">
                    {order.lineItems?.length || 0}
                  </span>
                </td>
                {/* Location */}
                <td className="px-3 py-1.5 text-[11px] text-muted-foreground truncate max-w-[100px]">
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
