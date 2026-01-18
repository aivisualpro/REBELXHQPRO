'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, Search, MoreHorizontal, Mail, Phone, MapPin, 
  Calendar, DollarSign, ShoppingBag, ChevronLeft, ChevronRight,
  ArrowUpDown, User, Layers, Briefcase, Map as LucideMap, ChevronDown,
  Truck, Upload, FileText, Activity, CheckCircle2, X,
  List, LayoutGrid, GripVertical, MessageSquare, ExternalLink, Send, Trash2, Paperclip, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';
import { Pagination } from '@/components/ui/Pagination';
import toast from 'react-hot-toast';
import ClientModal from '@/components/crm/ClientModal';

interface Lead {
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
    emailCount?: number;
    callCount?: number;
    smsCount?: number;
    lastActivity?: string;
    companyType: string;
    contactStatus?: string;
}

const PIPELINE_STAGES = [
    { id: 'Initial Contact', label: 'Initial Contact', color: 'text-slate-600', bgColor: 'bg-slate-50 border-slate-200', icon: <User className="w-4 h-4" /> },
    { id: 'Sampling', label: 'Sampling', color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', icon: <Layers className="w-4 h-4" /> },
    { id: 'New Prospect', label: 'New Prospect', color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'Closed won', label: 'Closed Won', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'Closed lost', label: 'Closed Lost', color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', icon: <X className="w-4 h-4" /> },
    { id: 'Uncategorized', label: 'Uncategorized', color: 'text-slate-400', bgColor: 'bg-white border-slate-100', icon: <Calendar className="w-4 h-4" /> },
];

const formatCompactedCurrency = (val: number) => {
    if (val >= 1000) {
        return '$' + (val / 1000).toFixed(1) + 'k';
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
};

const AgingChip = ({ value, label, showSeparator, color }: { value: string | number, label: string, showSeparator: boolean, color: string }) => {
    const isEmpty = Number(value) === 0;
    const displayColor = isEmpty ? "#CBD5E1" : color;

    return (
        <div className="flex items-center">
            <div className="flex flex-col items-center px-1 shrink-0 min-w-[28px]">
                <span className="text-[13px] font-black leading-none" style={{ color: displayColor }}>
                    {value.toString().padStart(2, '0')}
                </span>
                <span className="text-[7px] font-black mt-0.5" style={{ color: displayColor }}>
                    {label}
                </span>
            </div>
            {showSeparator && <div className="h-5 w-[1px] bg-slate-200" />}
        </div>
    );
};

const LeadAgingCounter = ({ lastActivity }: { lastActivity?: string }) => {
    const [duration, setDuration] = useState<{
        years: number;
        months: number;
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
    } | null>(null);

    useEffect(() => {
        if (!lastActivity) return;

        const updateCounter = () => {
            const lastDate = new Date(lastActivity);
            const now = new Date();
            let diff = now.getTime() - lastDate.getTime();

            if (diff < 0) diff = 0;

            const seconds = Math.floor((diff / 1000) % 60);
            const minutes = Math.floor((diff / (1000 * 60)) % 60);
            const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
            
            const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
            const years = Math.floor(totalDays / 365);
            const months = Math.floor((totalDays % 365) / 30);
            const days = Math.floor((totalDays % 365) % 30);

            setDuration({ years, months, days, hours, minutes, seconds });
        };

        updateCounter();
        const interval = setInterval(updateCounter, 1000);
        return () => clearInterval(interval);
    }, [lastActivity]);

    if (!lastActivity || !duration) return <span className="text-slate-300 font-bold">-</span>;

    const parts = [
        { value: duration.years, label: "year", color: "#D25353" },
        { value: duration.months, label: "month", color: "#E9762B" },
        { value: duration.days, label: "Days", color: "#FFD41D" },
        { value: duration.hours, label: "Hrs", color: "#4D2B8C" },
        { value: duration.minutes, label: "Mins", color: "#0C7779" },
        { value: duration.seconds, label: "Secs", color: "#EA7B7B" }
    ];

    return (
        <div className="flex items-center">
            {parts.map((p, i) => (
                <AgingChip 
                    key={`${p.label}-${i}`}
                    value={p.value} 
                    label={p.label} 
                    color={p.color}
                    showSeparator={i !== parts.length - 1} 
                />
            ))}
        </div>
    );
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

export default function LeadsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [minRevenueSlab, setMinRevenueSlab] = useState('20');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table');
  
  // Pipeline Drag State
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Pagination & Sort
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [loadingMore, setLoadingMore] = useState(false);
  const isAppendingRef = useRef(false);
  const [sortBy, setSortBy] = useState('totalRevenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Pipeline Data State (Per Stage)
  const [pipelineData, setPipelineData] = useState<Record<string, { 
    leads: Lead[], 
    page: number, 
    totalPages: number, 
    total: number, 
    loading: boolean 
  }>>(() => {
    const initialState: any = {};
    PIPELINE_STAGES.forEach(s => {
      initialState[s.id] = { leads: [], page: 1, totalPages: 1, total: 0, loading: false };
    });
    return initialState;
  });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [stateOptions] = useState<{ label: string; value: string }[]>([
      { label: 'TX', value: 'TX' }, { label: 'CA', value: 'CA' }, { label: 'NY', value: 'NY' }, 
      { label: 'FL', value: 'FL' }, { label: 'IL', value: 'IL' }
  ]);

  useEffect(() => {
    // Fetch Settings
    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                if (data.crmMinRevenueSlab) {
                    setMinRevenueSlab(data.crmMinRevenueSlab);
                }
            }
        } catch (e) {
            console.error("Failed to load settings");
        } finally {
            setSettingsLoading(false);
        }
    };
    fetchSettings();

    const timer = setTimeout(() => {
        setDebouncedSearch(search);
        setPage(1);
    }, 500); 
    return () => clearTimeout(timer);
  }, [search]);

  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [sendingEmail, setSendingEmail] = useState(false);

  const fetchLeads = useCallback(async (isAppending = false) => {
    if (!isAppending) setLoading(true);
    else setLoadingMore(true);
    
    try {
        const queryParams = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
            search: debouncedSearch,
            sortBy,
            sortOrder,
            maxRevenue: minRevenueSlab,
            contactType_nin: 'Client'
        });

        if (selectedSalesReps.length) queryParams.append('salesPerson', selectedSalesReps.join(','));

        const res = await fetch(`/api/clients?${queryParams}`);
        const data = await res.json();
        
        if (data.clients) {
            if (isAppending) {
                setLeads(prev => {
                    const existingIds = new Set(prev.map(l => l._id));
                    const newLeads = data.clients.filter((l: Lead) => !existingIds.has(l._id));
                    return [...prev, ...newLeads];
                });
            } else {
                setLeads(data.clients);
            }
            setTotalPages(data.totalPages);
            setTotal(data.total);
        }
    } catch (error) {
        console.error('Error fetching leads:', error);
        toast.error('Failed to load leads');
    } finally {
        setLoading(false);
        setLoadingMore(false);
        isAppendingRef.current = false;
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder, selectedSalesReps, minRevenueSlab]);

  const fetchPipelineStage = useCallback(async (stageId: string, pageToFetch: number, isAppending = false) => {
    setPipelineData(prev => ({ 
      ...prev, 
      [stageId]: { ...prev[stageId], loading: true } 
    }));

    try {
        const queryParams = new URLSearchParams({
            page: pageToFetch.toString(),
            limit: '10', // User requested 10 per "load"
            search: debouncedSearch,
            sortBy,
            sortOrder,
            maxRevenue: minRevenueSlab,
            contactType_nin: 'Client'
        });

        if (stageId === 'Uncategorized') {
            const otherStatuses = PIPELINE_STAGES
                .filter(s => s.id !== 'Uncategorized')
                .map(s => s.id)
                .join(',');
            queryParams.append('contactStatus_nin', otherStatuses);
        } else {
            queryParams.append('contactStatus', stageId);
        }

        if (selectedSalesReps.length) queryParams.append('salesPerson', selectedSalesReps.join(','));

        const res = await fetch(`/api/clients?${queryParams}`);
        const data = await res.json();
        
        if (data.clients) {
            setPipelineData(prev => {
                const current = prev[stageId];
                const combined = isAppending ? [...current.leads, ...data.clients] : data.clients;
                
                // De-duplicate by ID
                const map = new Map<string, Lead>();
                combined.forEach((l: Lead) => map.set(l._id, l));
                const uniqueLeads = Array.from(map.values());

                return {
                    ...prev,
                    [stageId]: {
                        leads: uniqueLeads,
                        page: pageToFetch,
                        totalPages: data.totalPages,
                        total: data.total,
                        loading: false
                    }
                };
            });
        }
    } catch (error) {
        console.error(`Error fetching stage ${stageId}:`, error);
        setPipelineData(prev => ({ 
            ...prev, 
            [stageId]: { ...prev[stageId], loading: false } 
        }));
    }
  }, [debouncedSearch, sortBy, sortOrder, selectedSalesReps, minRevenueSlab]);

  // Refresh all pipeline stages when filters change
  useEffect(() => {
    if (viewMode === 'pipeline' && !settingsLoading) {
        PIPELINE_STAGES.forEach(s => fetchPipelineStage(s.id, 1, false));
    }
  }, [viewMode, debouncedSearch, selectedSalesReps, sortBy, sortOrder, settingsLoading, fetchPipelineStage]);

  useEffect(() => {
    if (viewMode === 'table' && !settingsLoading) {
        fetchLeads();
    }
  }, [viewMode, page, fetchLeads, settingsLoading]);

  const handleHeaderSort = (key: string, direction: 'asc' | 'desc') => {
      setSortBy(key);
      setSortOrder(direction);
  };

  const initiateGoogleVoice = async (leadId: string, phoneNumber: string, type: 'calls' | 'messages') => {
    if (!phoneNumber) {
        toast.error('No phone number found');
        return;
    }

    const width = 450;
    const height = 650;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    // Normalization logic matching client detail page
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
    
    // Auto-log confirmation matching client detail page behavior
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
                        clientId: leadId,
                        phoneNumber,
                        type: activityType,
                        notes
                    })
                });
                
                if (res.ok) {
                    toast.success(`${activityType} logged to CRM!`);
                    // Refresh data after logging
                    if (viewMode === 'table') fetchLeads();
                    else {
                        PIPELINE_STAGES.forEach(s => fetchPipelineStage(s.id, 1));
                    }
                }
            } catch (err) {
                toast.error('Failed to log activity');
            }
        }
    }, 3000);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLeadDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedLead || (draggedLead.contactStatus || 'Uncategorized') === targetStatus) {
        setDraggedLead(null);
        return;
    }

    const previousStatus = draggedLead.contactStatus || 'Uncategorized';
    const updatedLead = { ...draggedLead, contactStatus: targetStatus };

    // Update global leads (for table)
    setLeads(prev => prev.map(l => 
        l._id === draggedLead._id ? updatedLead : l
    ));

    // Update pipeline data (for Kanban)
    setPipelineData(prev => {
        const sourceData = prev[previousStatus];
        const targetData = prev[targetStatus];

        if (!sourceData || !targetData) return prev;

        return {
            ...prev,
            [previousStatus]: {
                ...sourceData,
                leads: sourceData.leads.filter(l => l._id !== draggedLead._id),
                total: Math.max(0, sourceData.total - 1)
            },
            [targetStatus]: {
                ...targetData,
                leads: [updatedLead, ...targetData.leads],
                total: targetData.total + 1
            }
        };
    });

    try {
        const res = await fetch(`/api/clients/${draggedLead._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contactStatus: targetStatus })
        });
        if (!res.ok) throw new Error('Failed to update status');
        toast.success(`Lead moved to ${targetStatus}`);
    } catch (error) {
        // Revert on failure
        setLeads(prev => prev.map(l => 
            l._id === draggedLead._id ? { ...l, contactStatus: previousStatus } : l
        ));
        // Re-fetch pipeline stages to ensure consistency
        fetchPipelineStage(previousStatus, 1, false);
        fetchPipelineStage(targetStatus, 1, false);
        toast.error('Failed to update lead status');
    }
    setDraggedLead(null);
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
            fetchLeads();
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
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background text-foreground font-sans transition-colors duration-300">
      
      {/* Header / Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-card sticky top-0 z-20 gap-4 transition-colors duration-300">
        
        {/* Left: Search & View Toggle */}
        <div className="flex items-center space-x-6">
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search leads..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 h-8 w-64 bg-secondary hover:bg-secondary/80 focus:bg-card border border-border focus:border-accent rounded text-sm transition-all focus:outline-none placeholder:text-muted"
                />
            </div>

            <div className="flex items-center bg-secondary p-0.5 rounded border border-border h-8">
                <button 
                    onClick={() => setViewMode('table')}
                    className={cn(
                        "flex items-center space-x-1 px-3 h-full rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                        viewMode === 'table' ? "bg-[#FFEF5F] text-black shadow-sm" : "text-muted hover:text-foreground"
                    )}
                >
                    <List className="w-3.5 h-3.5" />
                    <span>Table</span>
                </button>
                <button 
                    onClick={() => setViewMode('pipeline')}
                    className={cn(
                        "flex items-center space-x-1 px-3 h-full rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                        viewMode === 'pipeline' ? "bg-[#FFEF5F] text-black shadow-sm" : "text-muted hover:text-foreground"
                    )}
                >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Pipeline</span>
                </button>
            </div>
        </div>

        {/* Right: Filters & Actions */}
        <div className="flex items-center space-x-2">
            
            {/* Filter Group */}
            <div className="flex items-center space-x-2 mr-4">
                 <button className="flex items-center space-x-1.5 px-3 h-8 text-[11px] font-bold text-foreground bg-card border border-border rounded hover:bg-secondary transition-all uppercase tracking-wide cursor-pointer text-center">
                    <MapPin className="w-3.5 h-3.5 text-muted" />
                    <span>City</span>
                </button>
                 <button className="flex items-center space-x-1.5 px-3 h-8 text-[11px] font-bold text-foreground bg-card border border-border rounded hover:bg-secondary transition-all uppercase tracking-wide cursor-pointer text-center">
                    <LucideMap className="w-3.5 h-3.5 text-muted" />
                    <span>State</span>
                </button>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="h-8 w-8 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-md rounded"
                    title="Add New Lead"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
      </div>

      <ClientModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={() => {
            if (viewMode === 'table') fetchLeads();
            else PIPELINE_STAGES.forEach(s => fetchPipelineStage(s.id, 1, false));
        }}
        initialType="Lead"
      />

      {/* Main View Area */}
      <div className="flex-1 overflow-auto bg-background transition-colors duration-300">
        {viewMode === 'table' ? (
          <div className="min-h-[600px] flex flex-col">
              <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
                  <div className="min-w-full px-2 py-2">
                      <table className="w-full text-left border-separate border-spacing-0 relative z-0">
                          <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10 transition-colors duration-300">
                              <tr>
                                  {[
                                      { key: 'name', label: 'name' },
                                      { key: 'contact', label: 'Email', align: 'text-center' },
                                      { key: 'phone', label: 'Phone', align: 'text-center' },
                                      { key: 'address', label: 'Address' },
                                      { key: 'salesPerson', label: 'Rep' },
                                      { key: 'status', label: 'Type' },
                                      { key: 'aging', label: 'Lead Aging' },
                                      { key: 'activities', label: 'Activities', align: 'text-center' },
                                  ].map((col: any) => (
                                      <th 
                                          key={col.key} 
                                          className={cn(
                                              "px-1 py-1 border-b border-border",
                                              col.align || "text-left",
                                              (col.key === 'contact' || col.key === 'phone') && "w-16 px-1",
                                              col.key === 'status' && "w-24 px-1"
                                          )}
                                      >
                                          <TableColumnHeader
                                              column={col}
                                              title={col.label}
                                              sortable={col.key !== 'address' && col.key !== 'contact' && col.key !== 'phone'}
                                              currentSortBy={sortBy}
                                              currentSortOrder={sortOrder}
                                              onSort={handleHeaderSort}
                                              className={cn(col.align === 'text-right' && "justify-end", col.align === 'text-center' && "justify-center")}
                                          />
                                      </th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-border transition-colors duration-300">
                              {loading && leads.length === 0 ? (
                                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground italic">Loading leads...</td></tr>
                              ) : leads.length > 0 ? (
                                  leads.map((lead) => (
                                      <tr 
                                          key={lead._id} 
                                          onClick={() => router.push(`/crm/leads/${lead._id}`)}
                                          className="hover:bg-primary/5 hover:scale-[1.008] hover:shadow-md transition-all duration-200 group cursor-pointer relative z-0 hover:z-10"
                                      >
                                          {/* NAME */}
                                          <td className="px-1 py-1">
                                              <div className="flex items-center space-x-3">
                                                  <div className="w-6 h-6 rounded bg-secondary border border-border flex items-center justify-center shrink-0 text-[10px] font-bold text-muted uppercase">
                                                      {lead.name.substring(0, 2)}
                                                  </div>
                                                  <span className="text-[10px] font-medium text-foreground leading-[13.3px] truncate max-w-[200px]">{lead.name}</span>
                                              </div>
                                          </td>
                                          
                                          {/* EMAIL */}
                                          <td className="px-1 py-1">
                                              {lead.emails?.[0]?.value && (
                                                  <button 
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          setComposeData({ to: lead.emails?.[0].value || '', subject: '', body: '' });
                                                          setIsComposeOpen(true);
                                                      }}
                                                      className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-400 hover:text-blue-600 rounded-sm transition-colors group/edit"
                                                  >
                                                      <Mail className="w-3.5 h-3.5 group-hover/edit:scale-110 transition-transform" />
                                                  </button>
                                              )}
                                          </td>

                                          {/* PHONE */}
                                          <td className="px-1 py-1">
                                              {lead.phones?.[0]?.value && (
                                                  <button 
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          initiateGoogleVoice(lead._id, lead.phones?.[0].value || '', 'calls');
                                                      }}
                                                      className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-slate-400 hover:text-emerald-600 rounded-sm transition-colors group/call"
                                                  >
                                                      <Phone className="w-3.5 h-3.5 group-hover/call:scale-110 transition-transform" />
                                                  </button>
                                              )}
                                          </td>

                                          {/* ADDRESS */}
                                          <td className="px-1 py-1">
                                              {lead.addresses?.[0] ? (
                                                  <div className="flex items-center text-[10px] font-medium text-foreground opacity-60 leading-[13.3px]">
                                                      <span className="truncate max-w-[150px]">{lead.addresses[0].city}, {lead.addresses[0].state}</span>
                                                  </div>
                                              ) : (
                                                   <span className="text-[10px] text-muted-foreground/30">-</span>
                                              )}
                                          </td>

                                          {/* SALES REP */}
                                           <td className="px-1 py-1 text-[10px] font-medium text-foreground opacity-60 leading-[13.3px]">
                                              {lead.salesPerson ? (
                                                  <span>{lead.salesPerson.firstName} {lead.salesPerson.lastName}</span>
                                              ) : (
                                                   <span className="text-muted-foreground/40 italic">Unassigned</span>
                                              )}
                                          </td>

                                          {/* COMPANY TYPE (STATUS) */}
                                          <td className="px-1 py-1">
                                              <StatusBadge status={lead.companyType || 'POTENTIAL'} />
                                          </td>

                                          {/* LEAD AGING */}
                                          <td className="p-0">
                                              <LeadAgingCounter lastActivity={lead.lastActivity} />
                                          </td>

                                          {/* ACTIVITIES (Combined) */}
                                          <td className="px-1 py-1 text-center">
                                              <div className="flex items-center justify-center space-x-1">
                                                   <span className={cn(
                                                       "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-sm text-[10px] font-bold transition-all",
                                                       lead.emailCount 
                                                        ? "bg-blue-500 text-white dark:bg-blue-500/80 dark:text-white shadow-sm" 
                                                        : "text-slate-300 dark:text-white/5"
                                                   )} title="Emails">
                                                       {lead.emailCount || 0}
                                                   </span>
                                                   <span className={cn(
                                                       "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-sm text-[10px] font-bold transition-all",
                                                       lead.callCount 
                                                        ? "bg-emerald-500 text-white dark:bg-emerald-500/80 dark:text-white shadow-sm" 
                                                        : "text-slate-300 dark:text-white/5"
                                                   )} title="Calls">
                                                       {lead.callCount || 0}
                                                   </span>
                                                   <span className={cn(
                                                       "inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-sm text-[10px] font-bold transition-all",
                                                       lead.smsCount 
                                                        ? "bg-purple-500 text-white dark:bg-purple-500/80 dark:text-white shadow-sm" 
                                                        : "text-slate-300 dark:text-white/5"
                                                   )} title="SMS">
                                                       {lead.smsCount || 0}
                                                   </span>
                                              </div>
                                          </td>
                                      </tr>
                                  ))
                              ) : (
                                  <tr><td colSpan={8} className="p-12 text-center text-slate-400">No leads found</td></tr>
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
        ) : (
          <PipelineGridView 
            pipelineData={pipelineData}
            onLeadClick={(lead) => router.push(`/crm/leads/${lead._id}`)}
            onLeadDrop={handleLeadDrop}
            draggedLead={draggedLead}
            setDraggedLead={setDraggedLead}
            dragOverStage={dragOverStage}
            setDragOverStage={setDragOverStage}
            onStageScroll={(stageId, e) => {
              const stage = pipelineData[stageId];
              if (!stage || stage.loading || (stage.leads.length >= stage.total && stage.total > 0)) return;
              
              const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
              if (scrollHeight - scrollTop <= clientHeight + 100) {
                fetchPipelineStage(stageId, Math.ceil(stage.leads.length / 10) + 1, true);
              }
            }}
            onInitiateVoice={initiateGoogleVoice}
          />
        )}
      </div>

       {/* Pagination (Only show in table mode) */}
       {viewMode === 'table' && (
           <div className="border-t border-border bg-secondary/30 transition-colors duration-300">
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={total}
                    itemsPerPage={limit}
                    itemName="leads"
                />
           </div>
       )}

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

// Pipeline Components
function PipelineGridView({ 
    pipelineData, 
    onLeadClick, 
    onLeadDrop,
    draggedLead,
    setDraggedLead,
    dragOverStage,
    setDragOverStage,
    onStageScroll,
    onInitiateVoice
}: { 
    pipelineData: Record<string, { leads: Lead[], loading: boolean, total: number }>, 
    onLeadClick: (lead: Lead) => void,
    onLeadDrop: (e: React.DragEvent, status: string) => void,
    draggedLead: Lead | null,
    setDraggedLead: (lead: Lead | null) => void,
    dragOverStage: string | null,
    setDragOverStage: (stage: string | null) => void,
    onStageScroll?: (stageId: string, e: React.UIEvent<HTMLDivElement>) => void,
    onInitiateVoice: (leadId: string, phoneNumber: string, type: 'calls' | 'messages') => void
}) {
    return (
        <div className="h-full bg-slate-50 overflow-x-auto scrollbar-custom">
            <div className="flex space-x-4 h-full min-w-max">
                {PIPELINE_STAGES.map((stage) => {
                    const data = pipelineData[stage.id] || { leads: [], loading: false, total: 0 };
                    return (
                        <div
                            key={stage.id}
                            className={cn(
                                "flex flex-col w-[300px] bg-white border border-slate-200 h-full transition-all group/stage",
                                dragOverStage === stage.id && "ring-2 ring-blue-400 ring-offset-2"
                            )}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverStage(stage.id);
                            }}
                            onDragLeave={() => setDragOverStage(null)}
                            onDrop={(e) => onLeadDrop(e, stage.id)}
                        >
                            {/* Stage Header */}
                            <div className={cn("px-4 py-3 border-b flex items-center justify-between shrink-0", stage.bgColor)}>
                                <div className="flex items-center space-x-2">
                                    <span className={stage.color}>{stage.icon}</span>
                                    <span className={cn("text-[10px] font-black uppercase tracking-wider", stage.color)}>{stage.label}</span>
                                </div>
                                <span className={cn("text-xs font-black", stage.color)}>
                                    {data.total}
                                </span>
                            </div>

                            {/* Stage Content */}
                            <div 
                                className="flex-1 overflow-y-auto p-2.5 space-y-2.5 bg-slate-50/50 scrollbar-custom"
                                onScroll={(e) => onStageScroll?.(stage.id, e)}
                            >
                                {data.leads.length === 0 && !data.loading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 opacity-50">
                                        <p className="text-[10px] font-bold uppercase italic">No leads here</p>
                                    </div>
                                ) : (
                                    <>
                                        {data.leads.map((lead: Lead) => (
                                            <div
                                                key={lead._id}
                                                draggable
                                                onDragStart={(e) => {
                                                    setDraggedLead(lead);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                                onClick={() => onLeadClick(lead)}
                                                className={cn(
                                                    "bg-white border border-slate-200 p-3 flex flex-col space-y-3 cursor-grab active:cursor-grabbing hover:shadow-lg hover:border-blue-200 transition-all group/card",
                                                    draggedLead?._id === lead._id && "opacity-50 scale-95"
                                                )}
                                            >
                                                {/* ROW 1: NAME */}
                                                <div className="flex items-start justify-between">
                                                    <div className="text-[14px] font-black text-slate-800 line-clamp-1 group-hover/card:text-blue-600 transition-colors">
                                                        {lead.name}
                                                    </div>
                                                    <GripVertical className="w-3.5 h-3.5 text-slate-200 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                                                </div>

                                                {/* ROW 2: TYPE & STATUS */}
                                                <div className="flex items-center space-x-2">
                                                    <span className="px-1.5 py-0.5 rounded-sm bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-tight">
                                                        {lead.companyType || 'TYPE'}
                                                    </span>
                                                    <span className="px-1.5 py-0.5 rounded-sm bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-tight border border-slate-100">
                                                        {lead.contactStatus || 'POTENTIAL'}
                                                    </span>
                                                </div>

                                                {/* ROW 3: SALES REP */}
                                                <div className="flex items-center">
                                                    <div className="flex items-center space-x-1.5 px-2 py-1 rounded-full bg-slate-50 border border-slate-100">
                                                        <div className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center">
                                                            <User className="w-2.5 h-2.5 text-slate-500" />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-600">
                                                            {lead.salesPerson ? `${lead.salesPerson.firstName} ${lead.salesPerson.lastName}` : 'Unassigned'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* ROW 4: INTERACTION CHIPS */}
                                                <div className="flex items-center space-x-2">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onInitiateVoice(lead._id, lead.phones?.[0]?.value || '', 'calls');
                                                        }}
                                                        className={cn(
                                                            "flex items-center space-x-1 px-2 py-1 rounded border transition-colors cursor-pointer",
                                                            lead.callCount && lead.callCount > 0 
                                                                ? "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100" 
                                                                : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                                        )}
                                                    >
                                                        <Phone className="w-3 h-3" />
                                                        <span className="text-[9px] font-black">{lead.callCount || 0}</span>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onInitiateVoice(lead._id, lead.phones?.[0]?.value || '', 'messages');
                                                        }}
                                                        className={cn(
                                                            "flex items-center space-x-1 px-2 py-1 rounded border transition-colors cursor-pointer",
                                                            lead.smsCount && lead.smsCount > 0 
                                                                ? "bg-purple-50 border-purple-100 text-purple-600 hover:bg-purple-100" 
                                                                : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                                        )}
                                                    >
                                                        <MessageSquare className="w-3 h-3" />
                                                        <span className="text-[9px] font-black">{lead.smsCount || 0}</span>
                                                    </button>
                                                    <a 
                                                        href={lead.emails?.[0]?.value ? `mailto:${lead.emails[0].value}` : '#'}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className={cn(
                                                            "flex items-center space-x-1 px-2 py-1 rounded border transition-colors cursor-pointer",
                                                            lead.emailCount && lead.emailCount > 0 
                                                                ? "bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100" 
                                                                : "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100"
                                                        )}
                                                    >
                                                        <Mail className="w-3 h-3" />
                                                        <span className="text-[9px] font-black">{lead.emailCount || 0}</span>
                                                    </a>
                                                </div>

                                                {/* ROW 5: AGING */}
                                                <div className="pt-2 border-t border-slate-50">
                                                    <LeadAgingCounter lastActivity={lead.lastActivity} />
                                                </div>
                                            </div>
                                        ))}
                                    </>
                                )}
                            {data.loading && (
                                <div className="flex items-center justify-center py-4">
                                    <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 animate-spin" />
                                </div>
                            )}
                        </div>
                    </div>
                );
              })}
            </div>
        </div>
    );
}

const statusColors = {
    'Potential': 'bg-blue-50 text-blue-600',
    'Active': 'bg-emerald-50 text-emerald-600',
    'Lost': 'bg-red-50 text-red-600',
    'Whitelabel': 'bg-purple-50 text-purple-600',
};
