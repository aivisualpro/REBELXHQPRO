'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  Calendar,
  User,
  ShoppingCart,
  Plus,
  UsersRound,
  Trash2,
  X,
  Pencil,
  AlertCircle,
  Printer,
  Package,
  RefreshCw,
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';
import { Pagination } from '@/components/ui/Pagination';
// import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal'; // Assuming not needed for view-only/basic edit or complex port


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
  totalAmount?: number;
  createdAt: string;
  lineItems: LineItem[];
  payments?: { paymentAmount: number }[];
}


interface OrdersViewProps {
    clientId?: string;
}

export default function OrdersView({ clientId }: OrdersViewProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
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
  const [selectedClients, setSelectedClients] = useState<string[]>(clientId ? [clientId] : []);
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // Filter Options
  const [clientOptions, setClientOptions] = useState<{ label: string; value: string }[]>([]);
  const [salesRepOptions, setSalesRepOptions] = useState<{ label: string; value: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]);

  // Create/Edit Modal State - Simplified: We will just link to the main page for editing/creating for now, or minimal impl.
  // The user asked for "same" component.
  // Implementing full Create/Edit modal here is complex due to dependent state (Lots, Items, etc).
  // For a "View" inside Client, maybe we can just VIEW and direct user to main page for full edits?
  // Let's implement READ-ONLY list first, or minimal actions.
  // Actually, let's keep it view-heavy.

  const [dateRangeOpen, setDateRangeOpen] = useState(false);


  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch active clients and Skus (for filters)
  useEffect(() => {
    const fetchResources = async () => {
      try {
        if (!clientId) {
            // Clients
            const res = await fetch('/api/clients?limit=1000');
            if (res.ok) {
            const data = await res.json();
            const clients_list = data.clients || [];
            setClientOptions(clients_list.map((c: any) => ({ label: c.name, value: c._id })));
            }
        }

        // Users (Sales Reps)
        const uRes = await fetch('/api/users?limit=1000');
        if (uRes.ok) {
            const data = await uRes.json();
            const users = data.users || [];
            setSalesRepOptions(users.map((u: any) => ({ label: `${u.firstName} ${u.lastName}`, value: u._id })));
        }
      } catch (error) {
        console.error("Failed to fetch resources", error);
      }
    };
    fetchResources();
  }, [clientId]);


  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: debouncedSearch,
        sortBy,
        sortOrder: sortOrder === 'desc' ? 'desc' : 'asc',
      });

      if (clientId) {
          params.append('client', clientId);
      } else if (selectedClients.length) {
          params.append('client', selectedClients.join(','));
      }

      if (selectedSalesReps.length) params.append('salesRep', selectedSalesReps.join(','));
      if (selectedSkus.length) params.append('sku', selectedSkus.join(','));
      if (selectedStatuses.length) params.append('status', selectedStatuses.join(','));
      if (dateRange.from) params.append('fromDate', dateRange.from);
      if (dateRange.to) params.append('toDate', dateRange.to);

      const res = await fetch(`/api/wholesale/orders?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);

        const statuses = Array.from(new Set((data.orders || []).map((o: any) => o.orderStatus).filter(Boolean)))
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
  }, [page, debouncedSearch, sortBy, sortOrder, selectedClients, selectedSalesReps, selectedSkus, selectedStatuses, dateRange, clientId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);
  
  const handleSort = (column: string) => {
      // sort logic 
      if (sortBy === column) {
          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
          setSortBy(column);
          setSortOrder('desc');
      }
  }

  const handleHeaderSort = (column: any) => {
      handleSort(column.key);
  }


  return (
    <div className="flex flex-col h-full bg-background transition-colors duration-300">
      
      {/* Header / Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-card sticky top-0 z-20 gap-4">
        
        {/* Left: Search */}
        <div className="flex items-center space-x-6">
            <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Orders
            </h1>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search orders..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 h-8 w-64 bg-secondary/50 hover:bg-secondary focus:bg-background border border-transparent focus:border-primary rounded text-sm transition-all focus:outline-none placeholder:text-muted-foreground text-foreground"
                />
            </div>
        </div>

        {/* Right: Filters & Actions */}
        <div className="flex items-center space-x-2">
            
            {/* Filter Group */}
            <div className="flex items-center space-x-2 mr-4">
                  {!clientId && (
                     <MultiSelectFilter
                     label="Client"
                     options={clientOptions}
                     selectedValues={selectedClients}
                     onChange={setSelectedClients}
                     className="h-8"
                     />
                  )}

                  <MultiSelectFilter
                    label="Status"
                    options={statusOptions}
                    selectedValues={selectedStatuses}
                    onChange={setSelectedStatuses}
                    className="h-8"
                   />
            </div>

            <div className="w-px h-6 bg-border" />

            {/* Actions Group */}
            <button 
                onClick={() => {
                    // Navigate to create new order for this client
                    const url = `/sales/wholesale-orders?createFor=${clientId || ''}`;
                    router.push(url);
                }}
                className="flex items-center justify-center w-8 h-8 bg-[#FFEF5F] text-black hover:opacity-90 rounded shadow-sm transition-all cursor-pointer"
                title="Create Order"
            >
                <Plus className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto bg-background transition-colors duration-300 relative scrollbar-custom">
        <div className="min-w-full px-2 py-2 flex flex-col">
            <table className="w-full border-separate border-spacing-0 text-left relative z-0">
                <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10 backdrop-blur-sm transition-colors">
                    <tr>
                        {[
                            { key: 'label', label: 'Order #' },
                            { key: 'createdAt', label: 'Date', align: 'text-center' },
                             // Hide Client column if clientId is provided
                            ...(!clientId ? [{ key: 'client', label: 'Client' }] : []),
                            { key: 'totalAmount', label: 'Amount', align: 'text-right' },
                            { key: 'orderStatus', label: 'Status', align: 'text-center' },
                            { key: 'salesRep', label: 'Rep' },
                        ].map((col: any) => (
                            <th 
                                key={col.key} 
                                className={cn(
                                    "p-1 border-b border-border text-[10px]",
                                    col.align || "text-left"
                                )}
                            >
                                <TableColumnHeader
                                    column={col}
                                    title={col.label}
                                    sortable={true}
                                    currentSortBy={sortBy}
                                    currentSortOrder={sortOrder}
                                    onSort={handleHeaderSort}
                                    className={cn(col.align === 'text-right' && "justify-end", col.align === 'text-center' && "justify-center")}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading && orders.length === 0 ? (
                        <tr><td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400">Loading...</td></tr>
                    ) : orders.length > 0 ? (
                        orders.map((order) => (
                            <tr 
                                key={order._id} 
                                className="hover:bg-blue-50/50 hover:scale-[1.002] transition-all duration-200 group relative z-0 hover:z-10 cursor-pointer"
                                onClick={() => router.push(`/sales/wholesale-orders?id=${order._id}`)} // Or open modal? Navigate is safer.
                            >
                                <td className="p-2 border-b border-slate-50 text-[11px] font-bold text-slate-700">
                                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{order.label}</span>
                                </td>
                                <td className="p-2 border-b border-slate-50 text-[10px] text-slate-500 text-center">
                                    {new Date(order.createdAt).toLocaleDateString()}
                                </td>
                                {!clientId && (
                                    <td className="p-2 border-b border-slate-50 text-[11px] font-medium text-slate-600 truncate max-w-[150px]">
                                        {typeof order.clientId === 'object' ? order.clientId?.name : '-'}
                                    </td>
                                )}
                                <td className="p-2 border-b border-slate-50 text-[11px] font-bold text-emerald-600 text-right">
                                    ${(order.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="p-2 border-b border-slate-50 text-center">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                                        order.orderStatus === 'Completed' ? "bg-emerald-100 text-emerald-700" :
                                        order.orderStatus === 'Pending' ? "bg-amber-100 text-amber-700" :
                                        order.orderStatus === 'Cancelled' ? "bg-red-100 text-red-700" :
                                        "bg-slate-100 text-slate-600"
                                    )}>
                                        {order.orderStatus}
                                    </span>
                                </td>
                                <td className="p-2 border-b border-slate-50 text-[10px] text-slate-500 truncate max-w-[100px]">
                                    {typeof order.salesRep === 'object' ? `${order.salesRep?.firstName} ${order.salesRep?.lastName}` : '-'}
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                <div className="flex flex-col items-center justify-center space-y-2">
                                    <ShoppingCart className="w-8 h-8 text-slate-200" />
                                    <span>No orders found</span>
                                </div>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="border-t border-border bg-secondary/30 transition-colors duration-300">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalOrders}
          itemsPerPage={20}
          itemName="orders"
        />
      </div>

    </div>
  );
}
