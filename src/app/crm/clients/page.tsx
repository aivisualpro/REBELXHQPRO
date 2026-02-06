'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { 
  Search, MoreHorizontal, Mail, Phone, MapPin, 
  Calendar, DollarSign, ShoppingBag, ChevronLeft, ChevronRight,
  ArrowUpDown, User, Layers, Briefcase, Map as LucideMap, ChevronDown,
  Truck, Upload, FileText, UserSquare2, SlidersHorizontal, 
  Send, X, Trash2, Paperclip, Loader2,
  Eye, Pencil
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
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
    let colorClass = "text-slate-400 dark:text-slate-600 border-slate-200 dark:border-white/5"; 
    const s = status?.toLowerCase() || '';
    
    if (s.includes('won') || s.includes('active')) colorClass = "text-emerald-600 dark:text-emerald-400/80 border-emerald-100 dark:border-emerald-400/20";
    else if (s.includes('potential') || s.includes('lead')) colorClass = "text-blue-600 dark:text-blue-400/80 border-blue-100 dark:border-blue-400/20";
    else if (s.includes('lost')) colorClass = "text-red-600 dark:text-red-400/80 border-red-100 dark:border-red-400/20";
    else if (s.includes('whitelabel')) colorClass = "text-purple-600 dark:text-purple-400/80 border-purple-100 dark:border-purple-400/20";
    
    return (
        <span className={cn("px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-wider border bg-transparent inline-block", colorClass)}>
            {status || 'UNKNOWN'}
        </span>
    );
};

export default function ClientsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading...</div>}>
      <ClientsPageContent />
    </Suspense>
  );
}

function ClientsPageContent() {
  const router = useRouter();
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
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState(urlSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(urlSearch);
  
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>([]);
  
  // Numeric Filters
  const [minRev, setMinRev] = useState('');
  const [maxRev, setMaxRev] = useState('');
  const [minBal, setMinBal] = useState('');
  const [maxBal, setMaxBal] = useState('');

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // Sync when URL search param changes (from header search bar)
  useEffect(() => {
    if (urlSearch !== search) {
      setSearch(urlSearch);
      setDebouncedSearch(urlSearch);
      setPage(1);
    }
  }, [urlSearch]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
        const queryParams = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            search: debouncedSearch,
            sortBy,
            sortOrder,
            minRevenue: minRev || minRevenueSlab,
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
  }, [page, limit, debouncedSearch, sortBy, sortOrder, selectedSalesReps, selectedStates, selectedCompanyTypes, minRev, maxRev, minBal, maxBal, minRevenueSlab]);

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

  const initiateGoogleVoice = async (clientId: string, phoneNumber: string, type: 'calls' | 'messages') => {
    if (!phoneNumber) {
        toast.error('No phone number found');
        return;
    }

    const width = 450;
    const height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    let e164;
    if (phoneNumber.includes('+')) {
        e164 = digitsOnly;
    } else if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
        e164 = digitsOnly;
    } else if (digitsOnly.length === 10) {
        e164 = '1' + digitsOnly;
    } else {
        e164 = digitsOnly;
    }
    
    const url = type === 'calls' 
        ? `https://voice.google.com/u/0/calls?a=nc,%2B${e164}`
        : `https://voice.google.com/u/0/messages?number=%2B${e164}`;
    
    window.open(
        url, 
        'GoogleVoiceWindow', 
        `width=${width},height=${height},left=${left},top=${top},menubar=no,status=no,toolbar=no`
    );
    
    setTimeout(async () => {
        const activityType = type === 'calls' ? 'Call' : 'Text';
        const shouldLog = confirm(`Log this ${activityType} to CRM?\n\nClick OK to log, or Cancel to skip.`);
        
        if (shouldLog) {
            const notes = prompt(`Any notes for this ${activityType}? (optional):`) || '';
            try {
                const res = await fetch('/api/crm/log-call', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        clientId,
                        phoneNumber,
                        type: activityType,
                        notes
                    })
                });
                
                if (res.ok) {
                    toast.success(`${activityType} logged to CRM!`);
                    fetchClients();
                }
            } catch (err) {
                toast.error('Failed to log activity');
            }
        }
    }, 3000);
  };

  const handleSendEmail = async () => {
    if (!composeData.to || !composeData.subject) {
        toast.error('Please fill in recipient and subject');
        return;
    }
    setSendingEmail(true);
    try {
        const res = await fetch('/api/gmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(composeData)
        });
        const data = await res.json();
        if (res.ok) {
            toast.success('Email sent successfully!');
            setIsComposeOpen(false);
            setComposeData({ to: '', subject: '', body: '' });
            fetchClients();
        } else {
            toast.error(data.error || 'Failed to send email');
        }
    } catch (error) {
        console.error('Send email error:', error);
        toast.error('Failed to send email');
    } finally {
        setSendingEmail(false);
    }
  };



  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background text-foreground font-sans">


      {/* Table Content */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
            <table className="w-full border-separate border-spacing-0 text-left relative z-0">
                <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ].map((col: any) => (
                            <th 
                                key={col.key} 
                                className={cn(
                                    "p-1 border-b border-border text-[10px]",
                                    col.align || "text-left",
                                    (col.key === 'contact' || col.key === 'phone') && "w-16 px-2",
                                    col.key === 'companyType' && "w-24 px-1"
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
                <tbody className="divide-y divide-border bg-background/50">
                    {loading && clients.length === 0 ? (
                        <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400">Loading Clients...</td></tr>
                    ) : clients.length > 0 ? (
                        clients.map((client) => (
                            <tr 
                                key={client._id} 
                                className="group relative z-0 bg-background transition-colors duration-150"
                            >
                                {/* NAME */}
                                <td className="p-1 border-r border-border group-hover:border-l-2 group-hover:border-l-primary transition-all">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-5 h-5 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-[8px] font-bold text-slate-500 uppercase">
                                            {client.name.substring(0, 2)}
                                        </div>
                                        <span className="text-[10px] font-medium text-foreground leading-tight truncate max-w-[180px]">{client.name}</span>
                                        <div className="flex items-center space-x-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                                onClick={() => window.location.href = `/crm/clients/${client._id}`}
                                                className="p-0.5 text-muted-foreground hover:text-blue-600 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                                                title="View"
                                            >
                                                <Eye className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => window.location.href = `/crm/clients/${client._id}`}
                                                className="p-0.5 text-muted-foreground hover:text-amber-600 hover:bg-amber-100 rounded transition-colors cursor-pointer"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => { /* future delete */ }}
                                                className="p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </td>
                                
                                  {/* EMAIL */}
                                  <td className="p-1">
                                      {client.emails?.[0]?.value && (
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setComposeData({ to: client.emails[0].value || '', subject: '', body: '' });
                                                  setIsComposeOpen(true);
                                              }}
                                              className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600 rounded-sm transition-colors group/edit"
                                          >
                                              <Mail className="w-3.5 h-3.5 group-hover/edit:scale-110 transition-transform" />
                                          </button>
                                      )}
                                  </td>

                                  {/* PHONE */}
                                  <td className="p-1">
                                      {client.phones?.[0]?.value && (
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  initiateGoogleVoice(client._id, client.phones[0].value || '', 'calls');
                                              }}
                                              className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-slate-400 hover:text-emerald-600 rounded-sm transition-colors group/call"
                                          >
                                              <Phone className="w-3.5 h-3.5 group-hover/call:scale-110 transition-transform" />
                                          </button>
                                      )}
                                  </td>

                                {/* ADDRESS */}
                                <td className="p-1">
                                    {client.addresses?.[0] ? (
                                        <div className="flex items-center text-[10px] font-medium text-foreground opacity-60">
                                            <span className="truncate max-w-[150px]">{client.addresses[0].city}, {client.addresses[0].state}</span>
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-muted-foreground/30">-</span>
                                    )}
                                </td>

                                {/* SALES REP */}
                                <td className="p-1 text-[10px] font-medium text-foreground opacity-60">
                                    {client.salesPerson ? (
                                        <span className="truncate block max-w-[100px]">{client.salesPerson.firstName} {client.salesPerson.lastName}</span>
                                    ) : (
                                        <span className="text-muted-foreground/40 italic">Unassigned</span>
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
                                        client.totalRevenue > 0 ? "text-foreground font-bold" : "text-muted-foreground/40"
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
                                             "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-sm text-[10px] font-bold transition-all",
                                             client.emailCount 
                                                ? "bg-blue-500 text-white dark:bg-blue-500/80 dark:text-white shadow-sm" 
                                                : "text-slate-300 dark:text-white/5"
                                         )} title="Emails">
                                             {client.emailCount || 0}
                                         </span>
                                         <span className={cn(
                                             "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-sm text-[10px] font-bold transition-all",
                                             client.callCount 
                                                ? "bg-emerald-500 text-white dark:bg-emerald-500/80 dark:text-white shadow-sm" 
                                                : "text-slate-300 dark:text-white/5"
                                         )} title="Calls">
                                             {client.callCount || 0}
                                         </span>
                                         <span className={cn(
                                             "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-sm text-[10px] font-bold transition-all",
                                             client.smsCount 
                                                ? "bg-purple-500 text-white dark:bg-purple-500/80 dark:text-white shadow-sm" 
                                                : "text-slate-300 dark:text-white/5"
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
       <div className="border-t border-border bg-secondary/30 transition-colors duration-300">
            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={total}
                itemsPerPage={limit}
                itemName="clients"
            />
       </div>

      {/* Compose Email Modal */}
      {isComposeOpen && (
                <div className="fixed bottom-0 right-12 w-[540px] bg-card border border-border shadow-2xl z-[1001] animate-in slide-in-from-bottom-5 duration-300 rounded-t-lg overflow-hidden">
                    <div className="bg-[#1A1A1A] text-white px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">New message</span>
                        <button onClick={() => setIsComposeOpen(false)} className="hover:text-slate-300 transition-colors cursor-pointer">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-0">
                        <div className="px-4 border-b border-border">
                            <input 
                                type="text" 
                                placeholder="Recipients" 
                                className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground" 
                                value={composeData.to} 
                                onChange={(e) => setComposeData({...composeData, to: e.target.value})} 
                            />
                        </div>
                        <div className="px-4 border-b border-border">
                            <input 
                                type="text" 
                                placeholder="Subject" 
                                className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground" 
                                value={composeData.subject} 
                                onChange={(e) => setComposeData({...composeData, subject: e.target.value})} 
                            />
                        </div>
                        <div className="px-4">
                            <textarea 
                                placeholder="Message" 
                                rows={12} 
                                className="w-full text-sm py-4 bg-transparent focus:outline-none resize-none placeholder:text-muted font-medium text-foreground leading-relaxed" 
                                value={composeData.body} 
                                onChange={(e) => setComposeData({...composeData, body: e.target.value})} 
                            />
                        </div>
                        
                        {/* Toolbar & Send */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                            <div className="flex items-center space-x-1">
                                <button 
                                    onClick={handleSendEmail}
                                    disabled={sendingEmail}
                                    className="flex items-center space-x-3 px-8 py-2.5 bg-[#F9E137] text-black text-[11px] font-black uppercase tracking-[0.15em] hover:bg-[#EBD000] transition-all mr-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    {sendingEmail ? (
                                        <>
                                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent animate-spin rounded-full" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Send</span>
                                            <Send className="w-3.5 h-3.5" />
                                        </>
                                    )}
                                </button>
                                
                                <div className="flex items-center space-x-0.5 text-slate-500">
                                    <button className="p-2 hover:bg-secondary/50 hover:text-foreground transition-all rounded-sm cursor-pointer" title="Attach files">
                                        <Paperclip className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                                <button 
                                    onClick={() => { 
                                        setIsComposeOpen(false); 
                                        setComposeData({ to: '', subject: '', body: '' }); 
                                    }} 
                                    className="p-2 text-muted hover:text-red-500 hover:bg-red-500/10 transition-all rounded-sm cursor-pointer"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

    </div>
  );
}
