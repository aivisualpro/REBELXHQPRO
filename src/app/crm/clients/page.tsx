'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Search, MoreHorizontal, Mail, Phone, MapPin, 
  Calendar, DollarSign, ShoppingBag, ChevronLeft, ChevronRight,
  ArrowUpDown, User, Layers, Briefcase, Map as LucideMap, ChevronDown,
  Truck, Upload, FileText, UserSquare2, SlidersHorizontal
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter, MultiSelectFilterRef } from '@/components/ui/filters/MultiSelectFilter';
import toast from 'react-hot-toast';

interface Client {
    _id: string;
    name: string;
    contactPerson?: string;
    emails: { value: string; label?: string }[];
    phones: { value: string; label?: string }[];
    addresses: { city: string; state: string }[];
    salesPerson?: { firstName: string; lastName: string };
    totalRevenue: number;
    balance: number;
    orderCount: number;
    activityCount?: number;
    emailCount?: number;
    callCount?: number;
    smsCount?: number;
    companyType: string;
}

const formatCompactedCurrency = (val: number) => {
    if (val >= 1000) {
        return '$' + (val / 1000).toFixed(1) + 'k';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const StatusBadge = ({ status }: { status: string }) => {
    let colorClass = "bg-slate-100 text-slate-500"; // Default/Unknown
    const s = status?.toLowerCase() || '';
    
    if (s.includes('won') || s.includes('active')) colorClass = "bg-emerald-100 text-emerald-700";
    else if (s.includes('potential') || s.includes('lead')) colorClass = "bg-blue-50 text-blue-600";
    else if (s.includes('lost')) colorClass = "bg-red-50 text-red-600";
    else if (s.includes('whitelabel')) colorClass = "bg-purple-50 text-purple-600";
    
    return (
        <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider", colorClass)}>
            {status || 'UNKNOWN'}
        </span>
    );
};

export default function ClientsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [minRevenueSlab, setMinRevenueSlab] = useState('20');
  const [settingsLoading, setSettingsLoading] = useState(true);
  
  // Pagination & Sort
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [sortBy, setSortBy] = useState('totalRevenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>([]);
  
  // Numeric Filters
  const [minRev, setMinRev] = useState('');
  const [maxRev, setMaxRev] = useState('');
  const [minBal, setMinBal] = useState('');
  const [maxBal, setMaxBal] = useState('');
  
  // Refs for remote opening filters from header
  const repFilterRef = useRef<MultiSelectFilterRef>(null);
  const typeFilterRef = useRef<MultiSelectFilterRef>(null);
  
  // Options for Filters
  const [salesRepOptions, setSalesRepOptions] = useState<{ label: string; value: string }[]>([]);
  const [stateOptions, setStateOptions] = useState<{ label: string; value: string }[]>([
      { label: 'TX', value: 'TX' }, { label: 'CA', value: 'CA' }, { label: 'NY', value: 'NY' }, 
      { label: 'FL', value: 'FL' }, { label: 'IL', value: 'IL' }
  ]);
  const [companyTypeOptions] = useState([
      { label: 'Shop', value: 'SHOP' },
      { label: 'Distro', value: 'DISTRO' },
      { label: 'Vape Store', value: 'VAPE STORE' },
      { label: 'Potential', value: 'POTENTIAL' },
      { label: 'WHL', value: 'WHL' },
      { label: 'Master Distro', value: 'MASTER DISTRO' }
  ]);

  useEffect(() => {
    // Fetch Filter Options
    const fetchOptions = async () => {
        try {
            const [uRes, sRes] = await Promise.all([
                fetch('/api/users?limit=100'),
                fetch('/api/settings')
            ]);
            
            const uData = await uRes.json();
            if (uData.users) {
                setSalesRepOptions(uData.users.map((u: any) => ({ label: `${u.firstName} ${u.lastName}`, value: u._id })));
            }
            
            if (sRes.ok) {
                const sData = await sRes.json();
                if (sData.crmMinRevenueSlab) {
                    setMinRevenueSlab(sData.crmMinRevenueSlab);
                }
            }
        } catch (e) {
            console.error("Failed to load options/settings");
        } finally {
            setSettingsLoading(false);
        }
    };
    fetchOptions();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
        setDebouncedSearch(search);
        setPage(1);
    }, 500); 
    return () => clearTimeout(timer);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
        const queryParams = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            search: debouncedSearch,
            sortBy,
            sortOrder,
            minRevenue: minRev || '',
            maxRevenue: maxRev || '',
            minBalance: minBal || '',
            maxBalance: maxBal || ''
        });

        if (selectedSalesReps.length) queryParams.append('salesPerson', selectedSalesReps.join(','));
        if (selectedStates.length) queryParams.append('state', selectedStates.join(','));
        if (selectedCompanyTypes.length) queryParams.append('companyType', selectedCompanyTypes.join(','));

        const res = await fetch(`/api/clients?${queryParams}`);
        const data = await res.json();
        
        if (data.clients) {
            setClients(data.clients);
            setTotalPages(data.totalPages);
            setTotal(data.total);
        }
    } catch (error) {
        console.error('Error fetching clients:', error);
        toast.error('Failed to load clients');
    } finally {
        setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder, selectedSalesReps, selectedStates, minRev, maxRev, minBal, maxBal]);

  useEffect(() => {
    if (!settingsLoading) {
        fetchClients();
    }
  }, [fetchClients, settingsLoading]);

  const handleHeaderSort = (key: string, direction: 'asc' | 'desc') => {
      setSortBy(key);
      setSortOrder(direction);
  };

  const handleHeaderFilter = (key: string) => {
      if (key === 'salesPerson') {
          repFilterRef.current?.open();
      } else if (key === 'companyType') {
          typeFilterRef.current?.open();
      }
  };

  const handleNumericFilter = (key: string, min: string, max: string) => {
      if (key === 'totalRevenue') {
          setMinRev(min);
          setMaxRev(max);
      } else if (key === 'balance') {
          setMinBal(min);
          setMaxBal(max);
      }
      setPage(1);
  };

  const handleSort = (key: string) => {
    // Basic toggle sort for the column headers
    if (sortBy === key) {
        setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
        setSortBy(key);
        setSortOrder('desc');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Placeholder for import logic
      const file = e.target.files?.[0];
      if (file) {
          toast.success("Import feature ready (Backend needed)");
      }
      // Reset
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-slate-50/30 text-slate-600 font-sans">
      
      {/* Header / Action Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-100 bg-white sticky top-0 z-20 gap-4">
        
        {/* Left: Search (Title Removed) */}
        <div className="flex items-center space-x-6">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search clients..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-1.5 w-64 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded text-sm transition-all focus:outline-none placeholder:text-slate-400"
                />
            </div>
        </div>

        {/* Right: Filters & Actions */}
        <div className="flex items-center space-x-2">
            
            {/* Filter Group */}
            <div className="flex items-center space-x-2 mr-4">
                 <button className="flex items-center space-x-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-300 transition-all uppercase tracking-wide">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>City</span>
                </button>
                 <button className="flex items-center space-x-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-300 transition-all uppercase tracking-wide">
                    <LucideMap className="w-3.5 h-3.5 text-slate-400" />
                    <span>State</span>
                </button>
                 <button className="flex items-center space-x-1.5 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 hover:border-slate-300 transition-all uppercase tracking-wide">
                    <Truck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Shipping</span>
                </button>
            </div>

            {/* Fixed Filter Anchors (Ensures dropdowns float over everything) */}
            <div className="fixed top-12 right-4 z-[100] pointer-events-none">
                <div className="pointer-events-auto">
                    <MultiSelectFilter
                        ref={repFilterRef}
                        label="Rep"
                        options={salesRepOptions}
                        selectedValues={selectedSalesReps}
                        onChange={setSelectedSalesReps}
                        className="hidden"
                    />
                    <MultiSelectFilter
                        ref={typeFilterRef}
                        label="Type"
                        options={companyTypeOptions}
                        selectedValues={selectedCompanyTypes}
                        onChange={setSelectedCompanyTypes}
                        className="hidden"
                    />
                </div>
            </div>

            <div className="w-px h-6 bg-slate-200" />

            {/* Actions Group */}
            <input
                type="file"
                accept=".csv"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImport}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-blue-600 bg-blue-50 border border-blue-100 rounded hover:bg-blue-100 transition-all shadow-sm"
                title="Import CSV"
            >
                <Upload className="w-4 h-4" />
            </button>

            <button 
                className="p-2 text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-all shadow-sm"
                title="Notes"
            >
                <FileText className="w-4 h-4 text-slate-400" />
            </button>

            <button className="flex items-center justify-center w-8 h-8 bg-black text-white hover:bg-slate-800 rounded shadow-sm transition-all">
                <Plus className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto bg-white">
        <div className="min-h-[600px] flex flex-col">
            <table className="w-full border-collapse text-left">
                <thead className="bg-[#FAFAFA] border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                        {[
                            { key: 'name', label: 'name' },
                            { key: 'contact', label: 'Email', align: 'text-center' },
                            { key: 'phone', label: 'Phone', align: 'text-center' },
                             { key: 'address', label: 'Address' },
                            { key: 'salesPerson', label: 'Rep' },
                            { key: 'companyType', label: 'Type' },
                            { key: 'totalRevenue', label: '$ Revenue', align: 'text-right' },
                            { key: 'balance', label: '$ Balance', align: 'text-right' },
                            { key: 'emailCount', label: 'Activities', align: 'text-center' },
                        ].map((col: any) => (
                            <th 
                                key={col.key} 
                                className={cn(
                                    "p-1 border-b border-slate-200 text-[10px]",
                                    col.align || "text-left",
                                    (col.key === 'contact' || col.key === 'phone') && "w-16 px-2"
                                )}
                            >
                                <TableColumnHeader
                                    column={col}
                                    title={col.label}
                                    sortable={col.key !== 'address' && col.key !== 'contact' && col.key !== 'phone'}
                                    currentSortBy={sortBy}
                                    currentSortOrder={sortOrder}
                                    onSort={handleHeaderSort}
                                    onFilter={col.key === 'salesPerson' || col.key === 'companyType' ? handleHeaderFilter : undefined}
                                    onNumericFilter={col.key === 'totalRevenue' || col.key === 'balance' ? handleNumericFilter : undefined}
                                    isNumeric={col.key === 'totalRevenue' || col.key === 'balance'}
                                    currentMin={col.key === 'totalRevenue' ? minRev : minBal}
                                    currentMax={col.key === 'totalRevenue' ? maxRev : maxBal}
                                    className={cn(col.align === 'text-right' && "justify-end", col.align === 'text-center' && "justify-center")}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {loading && clients.length === 0 ? (
                        <tr><td colSpan={11} className="px-6 py-12 text-center text-sm text-slate-400">Loading...</td></tr>
                    ) : clients.length > 0 ? (
                        clients.map((client) => (
                            <tr 
                                key={client._id} 
                                onClick={() => router.push(`/crm/clients/${client._id}`)}
                                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                            >
                                {/* NAME */}
                                <td className="p-1">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[8px] font-bold text-slate-500 uppercase">
                                            {client.name.substring(0, 2)}
                                        </div>
                                        <span className="text-[10px] font-medium text-[#2E2E2E] leading-tight truncate max-w-[180px]">{client.name}</span>
                                    </div>
                                </td>
                                
                                {/* EMAIL (ICON ONLY) */}
                                <td className="p-1 text-center">
                                    {client.emails?.[0]?.value ? (
                                         <div className="flex justify-center group-hover:text-blue-600 transition-colors" title={client.emails[0].value}>
                                            <Mail className="w-3.5 h-3.5 text-slate-300" />
                                         </div>
                                    ) : (
                                         <div className="flex justify-center">
                                            <Mail className="w-3.5 h-3.5 text-slate-100" />
                                         </div>
                                    )}
                                </td>

                                {/* PHONE (ICON ONLY) */}
                                <td className="p-1 text-center">
                                    {client.phones?.[0]?.value ? (
                                         <div className="flex justify-center text-slate-300" title={client.phones[0].value}>
                                            <Phone className="w-3.5 h-3.5" />
                                         </div>
                                    ) : (
                                         <div className="flex justify-center text-slate-100">
                                            <Phone className="w-3.5 h-3.5" />
                                         </div>
                                    )}
                                </td>

                                {/* ADDRESS */}
                                <td className="p-1">
                                    {client.addresses?.[0] ? (
                                        <div className="flex items-center text-[10px] font-medium text-[#2E2E2E]">
                                            <span className="truncate max-w-[150px]">{client.addresses[0].city}, {client.addresses[0].state}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-300">-</span>
                                    )}
                                </td>

                                {/* SALES REP */}
                                <td className="p-1 text-[10px] font-medium text-[#2E2E2E]">
                                    {client.salesPerson ? (
                                        <span className="truncate block max-w-[100px]">{client.salesPerson.firstName} {client.salesPerson.lastName}</span>
                                    ) : (
                                        <span className="text-slate-300 italic">Unassigned</span>
                                    )}
                                </td>

                                {/* COMPANY TYPE (STATUS) */}
                                <td className="p-1">
                                    <StatusBadge status={client.companyType || 'POTENTIAL'} />
                                </td>

                                {/* REVENUE */}
                                <td className="p-1 text-right">
                                    <span className={cn(
                                        "text-[10px] font-medium",
                                        client.totalRevenue > 0 ? "text-[#2E2E2E]" : "text-slate-300"
                                    )}>
                                        {formatCompactedCurrency(client.totalRevenue)}
                                    </span>
                                </td>

                                {/* BALANCE */}
                                <td className="p-1 text-right">
                                    <span className={cn(
                                        "text-[10px] font-medium",
                                        client.balance > 0 ? "text-red-500" : "text-emerald-500"
                                    )}>
                                        {formatCompactedCurrency(client.balance)}
                                    </span>
                                </td>

                                {/* ACTIVITIES (Combined) */}
                                <td className="p-1 text-center">
                                    <div className="flex items-center justify-center space-x-1">
                                        <span className={cn(
                                            "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                                            client.emailCount ? "bg-blue-50 text-blue-600" : "bg-slate-50 text-slate-300"
                                        )} title="Emails">
                                            {client.emailCount || 0}
                                        </span>
                                        <span className={cn(
                                            "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                                            client.callCount ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-300"
                                        )} title="Calls">
                                            {client.callCount || 0}
                                        </span>
                                        <span className={cn(
                                            "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded text-[9px] font-black",
                                            client.smsCount ? "bg-purple-50 text-purple-600" : "bg-slate-50 text-slate-300"
                                        )} title="SMS">
                                            {client.smsCount || 0}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr><td colSpan={9} className="p-12 text-center text-slate-400">No clients found</td></tr>
                    )}
                </tbody>
            </table>
            <div className="flex-1"></div>

        </div>
      </div>

       {/* Pagination */}
       <div className="px-4 py-1.5 border-t border-slate-200 bg-white">
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={total}
                itemsPerPage={limit}
                itemName="clients"
            />
       </div>

    </div>
  );
}
