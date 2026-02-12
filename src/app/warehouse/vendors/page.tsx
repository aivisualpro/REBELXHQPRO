'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  ArrowUpDown,
  Building2,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Plus,
  Pencil,
  Trash2
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';

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

  // Filters
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Filter Options
  const [cityOptions, setCityOptions] = useState<{ label: string; value: string }[]>([]);
  const [stateOptions, setStateOptions] = useState<{ label: string; value: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]);

  const importInputRef = useRef<HTMLInputElement>(null);

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

      if (selectedCities.length) params.append('city', selectedCities.join(','));
      if (selectedStates.length) params.append('state', selectedStates.join(','));
      if (selectedStatuses.length) params.append('status', selectedStatuses.join(','));

      const res = await fetch(`/api/vendors?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setVendors(data.vendors || []);
        setTotalPages(data.totalPages || 1);
        setTotalVendors(data.total || 0);

        // Populate options (simplified extraction)
        const allCities = Array.from(new Set((data.vendors || []).map((v: any) => v.city).filter(Boolean))).map((c: any) => ({ label: c, value: c }));
        setCityOptions(allCities);

        const allStates = Array.from(new Set((data.vendors || []).map((v: any) => v.state).filter(Boolean))).map((s: any) => ({ label: s, value: s }));
        setStateOptions(allStates);

        const allStatuses = Array.from(new Set((data.vendors || []).map((v: any) => v.status).filter(Boolean))).map((s: any) => ({ label: s, value: s }));
        setStatusOptions(allStatuses);
      } else {
        setError(data.error || 'Failed to fetch vendors');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedCities, selectedStates, selectedStatuses]);

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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const loadingToast = toast.loading('Importing vendors...');
          const res = await fetch('/api/vendors/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data })
          });
          toast.dismiss(loadingToast);

          if (res.ok) {
            const data = await res.json();
            toast.success(`Imported/Updated ${data.count} vendors`);
            fetchVendors();
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
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-secondary/50 transition-colors">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter">Vendors</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Name, Email, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="City"
            icon={MapPin}
            options={cityOptions}
            selectedValues={selectedCities}
            onChange={setSelectedCities}
            className="h-8"
          />
          <MultiSelectFilter
            label="State"
            icon={MapPin}
            options={stateOptions}
            selectedValues={selectedStates}
            onChange={setSelectedStates}
            className="h-8"
          />
          <MultiSelectFilter
            label="Status"
            icon={Building2}
            options={statusOptions}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
            className="h-8"
          />

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={importInputRef}
            onChange={handleImport}
          />

          <button
            onClick={() => importInputRef.current?.click()}
            className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded flex items-center space-x-1 border border-border bg-card shadow-sm cursor-pointer"
            title="Import Vendors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Import</span>
          </button>

          <button
            onClick={() => {/* TODO: Add Modal */ }}
            className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md flex items-center justify-center rounded cursor-pointer"
            title="Add Vendor"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

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
               <th className="px-2 py-2 text-[8px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={9} className="px-2 py-4 text-center text-[10px] text-muted-foreground italic tracking-tight">Loading Vendors...</td></tr>
            ) : error ? (
              <tr><td colSpan={9} className="px-2 py-4 text-center text-destructive text-[10px] font-bold">{error}</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan={9} className="px-2 py-4 text-center text-[10px] text-muted-foreground uppercase font-medium tracking-tighter opacity-50">No Vendors found</td></tr>
            ) : vendors.map(vendor => (
              <tr key={vendor._id} className="hover:bg-secondary/40 hover:scale-[1.002] hover:shadow-md transition-all duration-200 group relative z-0 hover:z-10 bg-background">
                <td className="px-2 py-1.5 text-[10px] font-bold text-foreground tracking-tight">
                  <span
                    onClick={() => router.push(`/warehouse/vendors/${vendor._id}`)}
                    className="hover:text-blue-500 hover:underline cursor-pointer transition-colors"
                  >
                    {vendor.name}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground truncate max-w-[200px]" title={vendor.address}>{vendor.address || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono tracking-tighter">{vendor.phone || '-'}</td>
                <td className="px-2 py-1.5 text-[10px] text-muted-foreground truncate max-w-[150px]"><a href={`mailto:${vendor.email}`} className="hover:underline">{vendor.email || '-'}</a></td>
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
                <td className="px-2 py-1.5 text-right">
                  <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
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
