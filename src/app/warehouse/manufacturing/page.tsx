'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  ArrowUpDown,
  Search,
  Plus,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Pagination } from '@/components/ui/Pagination';

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
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background"><div className="text-sm text-muted-foreground">Loading...</div></div>}>
      <ManufacturingContent />
    </Suspense>
  );
}

function ManufacturingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [orders, setOrders] = useState<ManufacturingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const el = document.getElementById('header-portal-target');
    if (el) setHeaderPortalTarget(el);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/manufacturing?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch orders');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder]);



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




  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
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
            onClick={() => router.push('/warehouse/manufacturing/new')}
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
              <tr><td colSpan={12} className="px-2 py-4 text-center text-[11px] text-muted-foreground italic">Loading Orders...</td></tr>
            ) : error ? (
              <tr><td colSpan={12} className="px-2 py-4 text-center text-destructive text-[11px]">{error}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={12} className="px-2 py-4 text-center text-[11px] text-muted-foreground uppercase tracking-tighter opacity-50">No Orders found</td></tr>
            ) : orders.map(order => {
              const unitCost = order.qty && order.qty > 0 ? (order.totalCost || 0) / order.qty : 0;
              return (
              <tr
                key={order._id}
                className="hover:bg-primary/5 transition-all duration-200 group relative z-0 hover:z-10 cursor-pointer"
                onClick={() => router.push(`/warehouse/manufacturing/${order._id}`)}
              >
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground tracking-tight font-mono group-hover:border-l-2 group-hover:border-l-primary transition-all">{order.label || '-'}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                   <div className="flex items-center gap-1.5">
                      {(() => {
                        if (!order.sku || typeof order.sku !== 'object') return null;
                        const tier = (order.sku as any)?.tier;
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
                      <span className="truncate">
                        {typeof order.sku === 'object' && order.sku !== null ? (order.sku as any)?.name : (order.sku || '-')}
                      </span>
                   </div>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono">{order.qty}</td>
                <td className="px-2 py-1.5 text-[11px] uppercase text-muted-foreground">{order.priority}</td>
                <td className="px-2 py-1.5">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-[2px] text-[8px] font-bold uppercase",
                    order.status === 'Fulfilled' ? "bg-green-500/10 text-green-500" :
                      order.status === 'Processing' ? "bg-blue-500/10 text-blue-500" :
                        order.status === 'Ready to QC' ? "bg-amber-500/10 text-amber-500" :
                          "bg-muted text-muted-foreground"
                  )}>
                    {order.status}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground">
                  {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
                </td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono">${(order.materialCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono">${(order.packagingCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono">${(order.laborCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono">${(order.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono">${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
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
        itemsPerPage={25}
        itemName="Orders"
      />
    </div>
  );
}
