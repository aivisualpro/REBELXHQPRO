'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowUpDown,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';

interface Vendor {
  _id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  status?: string;
  paymentTerms?: string;
  carrierPreference?: string;
  createdAt: string;
}

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVendors, setTotalVendors] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');


  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const target = document.getElementById('header-portal-target');
    if (target) setHeaderPortalTarget(target);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      const res = await fetch(`/api/vendors?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setVendors(data.vendors || []);
        setTotalPages(data.totalPages || 1);
        setTotalVendors(data.total || 0);

      } else {
        setError(data.error || 'Failed to fetch vendors');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

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
      {/* Header Portal */}
      {headerPortalTarget && createPortal(
        <>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
            />
          </div>
          <div className="flex-1" />
          <button
            onClick={() => {/* TODO: Add Modal */ }}
            className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">New</span>
          </button>
        </>,
        headerPortalTarget
      )}



      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              {[
                { key: 'name', label: 'Company Name' },
                { key: 'address', label: 'Address' },
                { key: 'phone', label: 'Phone' },
                { key: 'email', label: 'Email' },
                { key: 'contactName', label: 'Contact' },
                { key: 'paymentTerms', label: 'Pay Terms' },
                { key: 'carrierPreference', label: 'Carrier Pref.' },
                { key: 'status', label: 'Status' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-2 text-[8px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary transition-colors border-r border-border last:border-0"
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2 h-2", sortBy === col.key ? "text-foreground" : "text-muted-foreground/30")} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={8} className="px-2 py-4 text-center text-[10px] text-muted-foreground italic tracking-tight">Loading Vendors...</td></tr>
            ) : error ? (
              <tr><td colSpan={8} className="px-2 py-4 text-center text-destructive text-[10px] font-bold">{error}</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan={8} className="px-2 py-4 text-center text-[10px] text-muted-foreground uppercase font-medium tracking-tighter opacity-50">No Vendors found</td></tr>
            ) : vendors.map(vendor => (
              <tr
                key={vendor._id}
                onClick={() => router.push(`/warehouse/vendors/${vendor._id}`)}
                className="hover:bg-secondary/40 hover:scale-[1.002] hover:shadow-md transition-all duration-200 group relative z-0 hover:z-10 bg-background cursor-pointer"
              >
                <td className="px-2 py-1.5 text-[10px] font-bold text-foreground tracking-tight">{vendor.name}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground truncate max-w-[200px]" title={vendor.address}>{vendor.address || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono tracking-tighter">{vendor.phone || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground truncate max-w-[150px]">{vendor.email || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{vendor.contactName || '-'}</td>
                <td className="px-2 py-1.5 text-[8px] text-muted-foreground uppercase font-bold">{vendor.paymentTerms || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground truncate max-w-[100px]">{vendor.carrierPreference || '-'}</td>
                <td className="px-2 py-1.5">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                    vendor.status === 'Active' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                    vendor.status === 'Inactive' ? "bg-destructive/10 text-destructive border border-destructive/20" :
                    "bg-muted text-muted-foreground border border-border"
                  )}>
                    {vendor.status || 'Active'}
                  </span>
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
            totalItems={totalVendors}
            itemsPerPage={20}
            itemName="Vendors"
        />
      </div>
    </div>
  );
}
