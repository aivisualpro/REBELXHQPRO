'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowUpDown,
  MoreVertical,
  Eye,
  Pencil,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
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
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // SKU list for name display
  const [skuList, setSkuList] = useState<any[]>([]);




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

  // Sync search from URL params
  useEffect(() => {
    setDebouncedSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);

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

  // Fetch SKU list for name display
  useEffect(() => {
    fetch('/api/skus?limit=0&ignoreDate=true')
      .then(res => res.json())
      .then(data => {
        if (data.skus) {
          setSkuList(data.skus.map((s: any) => ({ _id: s._id, name: s.name, legacyId: s.legacyId })));
        }
      })
      .catch(err => console.error("Failed to fetch SKU list", err));
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




  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

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
                className="hover:bg-primary/5 transition-all duration-200 group relative z-0 hover:z-10"
              >
                <td className="px-2 py-1.5 text-[10px] font-bold text-foreground tracking-tight font-mono">{order.label || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                   <div className="flex items-center space-x-1.5">
                      {(() => {
                        if (!order.sku) return null;
                        const skuId = typeof order.sku === 'object' ? (order.sku as any)?._id : order.sku;
                        const skuData = (typeof order.sku === 'object' && order.sku !== null && (order.sku as any).tier) ? order.sku : skuList.find(s => s._id === skuId);
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
                        {typeof order.sku === 'object' && order.sku !== null ? (order.sku as any)?.name : (skuList.find(s => s._id === order.sku || s.legacyId === order.sku)?.name || order.sku || '-')}
                      </span>
                   </div>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">{order.qty}</td>
                <td className="px-2 py-1.5 text-[8px] uppercase font-bold text-muted-foreground">{order.priority}</td>
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
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
                  {order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}
                </td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">${(order.materialCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">${(order.packagingCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono">${(order.laborCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-foreground font-mono font-bold">${(order.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 text-[10px] text-emerald-500 font-mono font-bold">${unitCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1.5 relative">
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
                          <Eye className="w-3 h-3" />
                          View
                        </button>
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
