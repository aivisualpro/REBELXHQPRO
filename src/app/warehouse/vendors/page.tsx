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
  Plus
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
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Vendors</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name, Email, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
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
          />
          <MultiSelectFilter
            label="State"
            icon={MapPin}
            options={stateOptions}
            selectedValues={selectedStates}
            onChange={setSelectedStates}
          />
          <MultiSelectFilter
            label="Status"
            icon={Building2}
            options={statusOptions}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
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
            className="p-2 text-slate-600 hover:text-black hover:bg-slate-200 transition-colors rounded-sm flex items-center space-x-1"
            title="Import Vendors"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Import</span>
          </button>

          <button
            onClick={() => {/* TODO: Add Modal */ }}
            className="p-2 bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center rounded-sm"
            title="Add Vendor"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
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
                  className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-black" : "text-slate-200")} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400">Loading Vendors...</td></tr>
            ) : error ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-red-500 text-xs font-bold">{error}</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Vendors found</td></tr>
            ) : vendors.map(vendor => (
              <tr key={vendor._id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-2 text-[11px] font-bold text-slate-900 tracking-tight">{vendor.name}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600 truncate max-w-[200px]" title={vendor.address}>{vendor.address || '-'}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600">{vendor.phone || '-'}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600"><a href={`mailto:${vendor.email}`} className="hover:underline">{vendor.email || '-'}</a></td>
                <td className="px-4 py-2 text-[11px] text-slate-600 font-medium">{vendor.contactName || '-'}</td>
                <td className="px-4 py-2 text-[10px] text-slate-500 uppercase">{vendor.paymentTerms || '-'}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600">{vendor.carrierPreference || '-'}</td>
                <td className="px-4 py-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                    vendor.status === 'Active' ? "bg-green-100 text-green-700" :
                      vendor.status === 'Inactive' ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-600"
                  )}>
                    {vendor.status || 'Active'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  {/* Actions placeholder */}
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
        totalItems={totalVendors}
        itemsPerPage={20}
        itemName="Vendors"
      />
    </div>
  );
}
