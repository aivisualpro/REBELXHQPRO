'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  ArrowUpDown,
  ShoppingCart,
  Trash2,
  X,
  Pencil
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { Package, Globe, Calendar, Filter } from 'lucide-react';
import { Pagination } from '@/components/ui/Pagination';

// ... (keep interface definitions)
interface LineItem {
  _id?: string;
  sku: { _id: string; name: string } | string;
  lotNumber?: string;
  varianceId?: string;
  qty: number;
  total: number;
  website?: string;
}

interface WebOrder {
  _id: string; // The Order Number
  category: string;
  status: string;
  orderAmount: number;
  tax: number;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  postcode: string;
  email: string;
  createdAt: string;
  lineItems: LineItem[];
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
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [selectedWebsites, setSelectedWebsites] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [allSkus, setAllSkus] = useState<{ _id: string; name: string }[]>([]);
  const [allWebsites, setAllWebsites] = useState<string[]>([]);

  const importOrdersRef = useRef<HTMLInputElement>(null);
  const importLineItemsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch SKUs for filter
    fetch('/api/skus?limit=1000&ignoreDate=true')
        .then(res => res.json())
        .then(data => setAllSkus(data.skus || []))
        .catch(err => console.error("Failed to load SKUs", err));

    // Fetch Websites for filter (unique values)
    fetch('/api/retail/web-orders/websites')
        .then(res => res.json())
        .then(data => setAllWebsites(data.websites || []))
        .catch(err => console.error("Failed to load websites", err));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchOrders();
  }, [page, debouncedSearch, sortBy, sortOrder, selectedSkus, selectedWebsites, selectedStatuses, dateRange]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: debouncedSearch,
        sortBy,
        sortOrder,
        sku: selectedSkus.join(','),
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
        toast.error("Failed to load web orders");
      }
    } catch (e) {
      toast.error("Error loading web orders");
    } finally {
      setLoading(false);
    }
  };

  // No need for separate useEffect now, cleaned up in previous chunk


  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, endpoint: string, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const totalRows = results.data.length;
        if (totalRows === 0) {
          toast.error('No data found');
          return;
        }

        const toastId = toast.loading(`Importing ${label} (0%)...`);
        let processed = 0;
        let successCount = 0;
        let errors: string[] = [];

        const CHUNK_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          chunks.push(results.data.slice(i, i + CHUNK_SIZE));
        }

        try {
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: chunk })
            });

            if (res.ok) {
              const data = await res.json();
              successCount += (data.count || 0);
              if (data.errors) errors.push(...data.errors);
            } else {
              const err = await res.json();
              errors.push(`Chunk ${i}: ${err.error || 'Unknown error'}`);
            }

            processed += chunk.length;
            const percent = Math.round((processed / totalRows) * 100);
            toast.loading(`Importing ${label}... ${percent}%`, { id: toastId });
          }

          if (errors.length > 0) {
             toast.error(`Finished with ${errors.length} errors. Success: ${successCount}`, { id: toastId, duration: 5000 });
             console.error(errors);
          } else {
             toast.success(`Imported ${successCount} ${label}!`, { id: toastId });
          }
          fetchOrders();
        } catch (e) {
             toast.error('Import failed', { id: toastId });
        }
      }
    });
  };

  const renderSku = (val: any) => {
      if (typeof val === 'object' && val?.name) return val.name;
      return val || '-';
  };

  const formatCurrency = (val: number) => '$' + (val || 0).toFixed(2);

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Web Orders</h1>
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                type="text"
                placeholder="Search Order#, Name, Email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400 rounded-sm"
                />
            </div>
        </div>

        <div className="flex items-center space-x-2">
           {/* Filters */}
           <MultiSelectFilter
                label="SKU"
                icon={Package}
                options={allSkus.map(s => ({ label: s.name, value: s._id }))}
                selectedValues={selectedSkus}
                onChange={setSelectedSkus}
                className="h-[30px]"
            />
            
            <MultiSelectFilter
                label="Website"
                icon={Globe}
                options={allWebsites.map(w => ({ label: w, value: w }))}
                selectedValues={selectedWebsites}
                onChange={setSelectedWebsites}
                className="h-[30px]"
            />

            <MultiSelectFilter
                label="Status"
                icon={Filter}
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
            ref={importOrdersRef}
            onChange={(e) => handleImport(e, '/api/retail/web-orders/import-orders', 'Orders')}
          />
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={importLineItemsRef}
            onChange={(e) => handleImport(e, '/api/retail/web-orders/import-lineitems', 'Line Items')}
          />

          <button
              onClick={() => importOrdersRef.current?.click()}
              className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-sm"
              title="Import Orders"
          >
              <Upload className="w-4 h-4" />
          </button>
           <button
              onClick={() => importLineItemsRef.current?.click()}
              className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-sm"
              title="Import Line Items"
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
                 { key: '_id', label: 'Order #' },
                 { key: 'firstName', label: 'Customer' },
                 { key: 'email', label: 'Email' },
                 { key: 'status', label: 'Status' },
                 { key: 'createdAt', label: 'Date' },
                 { key: 'city', label: 'Location' },
                 { key: 'orderAmount', label: 'Total' },
               ].map(col => (
                 <th key={col.key} className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100 last:border-0 cursor-pointer" onClick={() => setSortBy(col.key)}>
                   <div className="flex items-center space-x-1.5">
                     <span>{col.label}</span>
                     <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-black" : "text-slate-200")} />
                   </div>
                 </th>
               ))}
               <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Items</th>
               <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100">
             {loading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400">Loading...</td></tr>
             ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Orders Found</td></tr>
             ) : orders.map(order => (
               <tr 
                 key={order._id} 
                 onClick={() => router.push(`/retail/web-orders/${order._id}`)}
                 className="hover:bg-slate-50 transition-colors group cursor-pointer"
               >
                 <td className="px-4 py-2 text-[11px] font-bold text-slate-900 font-mono">{order._id}</td>
                 <td className="px-4 py-2 text-[11px] text-slate-600 font-medium">{order.firstName} {order.lastName}</td>
                 <td className="px-4 py-2 text-[11px] text-slate-500">{order.email}</td>
                 <td className="px-4 py-2">
                    <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                        order.status === 'completed' || order.status === 'Completed' ? "bg-green-100 text-green-700" :
                        order.status === 'processing' ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-600"
                    )}>
                        {order.status}
                    </span>
                 </td>
                 <td className="px-4 py-2 text-[11px] text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</td>
                 <td className="px-4 py-2 text-[11px] text-slate-500">{order.city}, {order.state}</td>
                 <td className="px-4 py-2 text-[11px] font-bold text-slate-900">{formatCurrency(order.orderAmount)}</td>
                 <td className="px-4 py-2 text-center text-[11px] font-bold text-slate-600">{order.lineItems?.length || 0}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         {/* Fallback actions if needed */}
                         <button className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
                    </div>
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
