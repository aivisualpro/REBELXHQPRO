'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    User,
    Phone,
    Mail,
    MapPin,
    Building2,
    Calendar,
    DollarSign,
    ShoppingCart,
    MessageSquare,
    Activity,
    TrendingUp,
    Clock,
    Globe,
    ChevronRight,
    Loader2,
    PhoneCall,
    MessageCircle,
    Mail as MailIcon,
    MapPinned,
    Plus,
    MoreVertical,
    ExternalLink,
    CreditCard,
    Search,
    Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ClientModal from '@/components/crm/ClientModal';

interface Client {
    _id: string;
    name: string;
    description?: string;
    salesPerson?: string;
    salesRepInfo?: { firstName: string; lastName: string; email: string };
    contactStatus?: string;
    contactType?: string;
    companyType?: string;
    website?: string;
    facebookPage?: string;
    industry?: string;
    forecastedAmount?: number;
    phones?: { value: string; label: string; isWhatsApp?: boolean }[];
    emails?: { value: string; label: string }[];
    addresses?: { street: string; city: string; state: string; postalCode: string; country: string; label: string }[];
    defaultShippingTerms?: string;
    defaultPaymentMethod?: string;
    billing?: {
        nameOnCard?: string;
        ccNumber?: string;
        expirationDate?: string;
        securityCode?: string;
        zipCode?: string;
    };
    createdAt?: string;
}

interface ActivityItem {
    _id: string;
    type: 'Call' | 'Text' | 'Email' | 'Visit';
    comments?: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
    metadata?: {
        phoneNumber?: string;
        duration?: string;
        googleVoiceLink?: string;
        recordingAvailable?: boolean;
    };
}

interface OrderItem {
    _id: string;
    label?: string;
    orderStatus?: string;
    salesRep?: { firstName: string; lastName: string } | string;
    paymentMethod?: string;
    lineItems?: { sku: string; qtyShipped: number; price: number; total: number; cost?: number }[];
    shippingCost?: number;
    discount?: number;
    tax?: number;
    createdAt: string;
}

interface Summary {
    totalOrders: number;
    totalRevenue: number;
    totalBalance: number;
    totalActivities: number;
    totalEmails?: number;
    totalCalls?: number;
    totalSMS?: number;
    lastActivityDate: string | null;
    lastOrderDate: string | null;
}

const PAGE_SIZE = 20;

export default function ClientDashboardPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [client, setClient] = useState<Client | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'Emails' | 'Calls' | 'SMS' | 'Orders'>('Emails');
    
    // Pagination
    const [activitiesPage, setActivitiesPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [hasMoreActivities, setHasMoreActivities] = useState(false);
    const [hasMoreOrders, setHasMoreOrders] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (id) fetchClientData();
    }, [id]);

    const fetchClientData = async (page = 1, append = false) => {
        try {
            if (!append) setLoading(true);
            else setIsLoadingMore(true);

            const res = await fetch(`/api/clients/${id}/dashboard?page=${page}&limit=${PAGE_SIZE}`);
            if (res.ok) {
                const data = await res.json();
                setClient(data.client);
                setSummary(data.summary);
                
                if (append) {
                    if (activeTab !== 'Orders') {
                        setActivities(prev => [...prev, ...data.activities]);
                    } else {
                        setOrders(prev => [...prev, ...data.orders]);
                    }
                } else {
                    setActivities(data.activities);
                    setOrders(data.orders);
                }
                
                setHasMoreActivities(data.pagination.hasMoreActivities);
                setHasMoreOrders(data.pagination.hasMoreOrders);
            } else {
                toast.error("Failed to load client");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error loading data");
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    };

    const loadMore = () => {
        if (activeTab !== 'Orders' && hasMoreActivities && !isLoadingMore) {
            const newPage = activitiesPage + 1;
            setActivitiesPage(newPage);
            fetchClientData(newPage, true);
        } else if (activeTab === 'Orders' && hasMoreOrders && !isLoadingMore) {
            const newPage = ordersPage + 1;
            setOrdersPage(newPage);
            fetchClientData(newPage, true);
        }
    };

    // Infinite scroll observer
    useEffect(() => {
        if (!loadMoreRef.current) return;
        const hasMore = activeTab !== 'Orders' ? hasMoreActivities : hasMoreOrders;
        if (!hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoadingMore) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMoreActivities, hasMoreOrders, isLoadingMore, activeTab]);

    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'Call': return <PhoneCall className="w-3.5 h-3.5 text-blue-500" />;
            case 'Text': return <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />;
            case 'Email': return <MailIcon className="w-3.5 h-3.5 text-purple-500" />;
            case 'Visit': return <MapPinned className="w-3.5 h-3.5 text-orange-500" />;
            default: return <Activity className="w-3.5 h-3.5 text-slate-500" />;
        }
    };

    const formatCurrency = (val: number) => {
        if (!val) return '$0';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', { 
            year: '2-digit', 
            month: '2-digit', 
            day: '2-digit' 
        });
    };

    const daysSince = (dateStr: string | null) => {
        if (!dateStr) return null;
        const diff = Date.now() - new Date(dateStr).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-white">
            <LoadingSpinner size="lg" message="Loading Client Dashboard" />
        </div>
    );

    if (!client) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800">Client Not Found</h2>
            <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-black text-white text-sm font-medium">Go Back</button>
        </div>
    );

    const lastActivityDays = daysSince(summary?.lastActivityDate || null);
    const lastOrderDays = daysSince(summary?.lastOrderDate || null);

    return (
        <>
            <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden bg-white">
            {/* Shell Layer 1: Route Header */}
            <div className="sticky top-0 z-[50] bg-white border-b border-slate-200 px-4 flex items-center space-x-2 shrink-0 h-14 shadow-sm">
                <button 
                    onClick={() => router.back()} 
                    className="w-9 h-9 bg-black flex items-center justify-center text-white hover:bg-slate-800 transition-colors shrink-0"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>

                <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="w-9 h-9 bg-black flex items-center justify-center text-white hover:bg-slate-800 transition-colors shrink-0"
                >
                    <Edit className="w-4 h-4" />
                </button>

                <div className="flex-1 max-w-sm relative group h-9">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder={`Search ${activeTab.toLowerCase()}...`}
                        className="w-full h-full pl-9 pr-4 bg-slate-50 border border-slate-100 text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all rounded-sm placeholder:text-slate-400 font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center space-x-1 h-9 ml-4">
                    {[
                        { id: 'Emails', icon: Mail, count: summary?.totalEmails },
                        { id: 'Calls', icon: Phone, count: summary?.totalCalls },
                        { id: 'SMS', icon: MessageSquare, count: summary?.totalSMS },
                        { id: 'Orders', icon: ShoppingCart, count: summary?.totalOrders }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                setSearchQuery(''); // Clear search when switching tabs
                            }}
                            className={cn(
                                "flex items-center space-x-2 px-4 h-full text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm",
                                activeTab === tab.id
                                    ? "bg-slate-100 text-slate-900 shadow-sm"
                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            <span>{tab.id}</span>
                            {tab.count !== undefined && (
                                <span className={cn(
                                    "px-1.5 py-0.5 text-[9px] rounded-sm font-mono",
                                    activeTab === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Shell Layer 2: Main Content Split */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-white">
                {/* Left Column (30%) - Client Details */}
                <aside className="w-[30%] h-full overflow-y-auto border-r border-slate-100 bg-white shrink-0 scrollbar-custom">
                    <div className="p-6 space-y-8">
                        
                        {/* Profile Header */}
                        <div className="flex flex-col items-center text-center space-y-3">
                            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                                {client.name?.charAt(0) || '?'}
                            </div>
                            <div className="space-y-1">
                                <h1 className="text-lg font-black text-slate-900 leading-tight">{client.name}</h1>
                                <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{client._id}</p>
                            </div>
                        </div>

                        {/* Primary Address */}
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                                <MapPin className="w-3 h-3" />
                                <span>Address</span>
                            </div>
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-sm">
                                {client.addresses && client.addresses.length > 0 ? (
                                    <div className="text-xs text-slate-700 leading-relaxed">
                                        <div className="font-bold text-slate-900 mb-1">{client.addresses[0].label || 'Primary'}</div>
                                        <div>{client.addresses[0].street}</div>
                                        <div>{[client.addresses[0].city, client.addresses[0].state, client.addresses[0].postalCode].filter(Boolean).join(', ')}</div>
                                        {client.addresses[0].country && <div>{client.addresses[0].country}</div>}
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">No address provided</span>
                                )}
                            </div>
                        </div>

                        {/* Sales Rep */}
                        <div className="space-y-2">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                                <User className="w-3 h-3" />
                                <span>Sales Representative</span>
                            </div>
                            <div className="flex items-center space-x-3 p-3 bg-blue-50/50 border border-blue-100/50 rounded-sm">
                                <div className="w-10 h-10 bg-blue-600 flex items-center justify-center text-white font-bold text-sm rounded-sm">
                                    {client.salesRepInfo?.firstName?.charAt(0) || '?'}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">
                                        {client.salesRepInfo ? `${client.salesRepInfo.firstName} ${client.salesRepInfo.lastName}` : 'Unassigned'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-medium">{client.salesRepInfo?.email || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Contact Channels (2 Columns) */}
                        <div className="grid grid-cols-2 gap-6">
                            {/* Phones Column */}
                            <div className="space-y-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                                    <Phone className="w-3 h-3" />
                                    <span>Phones</span>
                                </div>
                                <div className="space-y-2">
                                    {client.phones?.map((p, idx) => (
                                        <div key={idx} className="group flex flex-col">
                                            <a href={`tel:${p.value}`} className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors truncate">
                                                {p.value}
                                            </a>
                                            <span className="text-[9px] text-slate-400 font-medium uppercase">{p.label || 'Phone'}</span>
                                        </div>
                                    )) || <span className="text-[10px] text-slate-400 italic">None</span>}
                                </div>
                            </div>

                            {/* Emails Column */}
                            <div className="space-y-3">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                                    <Mail className="w-3 h-3" />
                                    <span>Emails</span>
                                </div>
                                <div className="space-y-2">
                                    {client.emails?.map((e, idx) => (
                                        <div key={idx} className="flex flex-col">
                                            <a href={`mailto:${e.value}`} className="text-xs font-bold text-slate-700 hover:text-purple-600 transition-colors truncate">
                                                {e.value}
                                            </a>
                                            <span className="text-[9px] text-slate-400 font-medium uppercase">{e.label || 'Email'}</span>
                                        </div>
                                    )) || <span className="text-[10px] text-slate-400 italic">None</span>}
                                </div>
                            </div>
                        </div>

                        {/* Billing Section (Object) */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-2">
                                <CreditCard className="w-3 h-3" />
                                <span>Billing Information</span>
                            </div>
                            <div className="bg-slate-900 p-4 rounded-sm space-y-3 shadow-inner">
                                <div className="flex items-center justify-between">
                                    <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Credit Card</div>
                                    <div className="flex space-x-1">
                                        <div className="w-4 h-2.5 bg-white/20 rounded-sm" />
                                        <div className="w-4 h-2.5 bg-white/20 rounded-sm" />
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <div className="text-[13px] font-mono text-white tracking-[0.2em]">
                                        {client.billing?.ccNumber || '•••• •••• •••• ••••'}
                                    </div>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <div className="text-[8px] text-slate-500 uppercase font-bold">Card Holder</div>
                                        <div className="text-[10px] text-white font-medium uppercase tracking-wider">
                                            {client.billing?.nameOnCard || '-'}
                                        </div>
                                    </div>
                                    <div className="flex space-x-4">
                                        <div className="space-y-1">
                                            <div className="text-[8px] text-slate-500 uppercase font-bold">Expires</div>
                                            <div className="text-[10px] text-white font-mono">{client.billing?.expirationDate || '••/••'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[8px] text-slate-500 uppercase font-bold">CVV</div>
                                            <div className="text-[10px] text-white font-mono">{client.billing?.securityCode || '•••'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rest of the Information */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata</div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Contact Status</span>
                                    <span className="font-bold text-slate-800">{client.contactStatus || '-'}</span>
                                </div>
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Company Type</span>
                                    <span className="font-bold text-slate-800">{client.companyType || '-'}</span>
                                </div>
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Industry</span>
                                    <span className="font-bold text-slate-800">{client.industry || '-'}</span>
                                </div>
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Payment Terms</span>
                                    <span className="font-bold text-slate-800">{client.defaultPaymentMethod || '-'}</span>
                                </div>
                                {client.website && (
                                    <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                        <span className="text-slate-500">Website</span>
                                        <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" className="text-blue-600 font-bold truncate max-w-[150px]">{client.website}</a>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Created At</span>
                                    <span className="font-medium text-slate-600">{formatDate(client.createdAt || '')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-10" />
                    </div>
                </aside>

                {/* Right Column: Activity/Orders Table */}
                <main className="flex-1 h-full overflow-y-auto bg-white relative scrollbar-custom">


                    {/* Table Content */}
                    {activeTab !== 'Orders' ? (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-12 z-[20] bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Comments</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {activities.filter(a => {
                                    if (activeTab === 'Emails') return a.type === 'Email';
                                    if (activeTab === 'Calls') return a.type === 'Call';
                                    if (activeTab === 'SMS') return a.type === 'Text';
                                    return false;
                                }).length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm italic">
                                            No {activeTab.toLowerCase()} recorded yet
                                        </td>
                                    </tr>
                                ) : activities.filter(a => {
                                    if (activeTab === 'Emails') return a.type === 'Email';
                                    if (activeTab === 'Calls') return a.type === 'Call';
                                    if (activeTab === 'SMS') return a.type === 'Text';
                                    return false;
                                }).map((act) => (
                                    <tr key={act._id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-4 py-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                                            {formatDate(act.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center space-x-2">
                                                {getActivityIcon(act.type)}
                                                <span className="text-[10px] uppercase font-bold text-slate-600">{act.type}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-slate-700 max-w-sm">
                                            <div className="space-y-1">
                                                <div className="truncate">{act.comments || '-'}</div>
                                                {act.metadata?.duration && (
                                                    <div className="text-[10px] text-emerald-600 font-medium">
                                                        Duration: {act.metadata.duration}
                                                    </div>
                                                )}
                                                {act.metadata?.googleVoiceLink && (
                                                    <a 
                                                        href={act.metadata.googleVoiceLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <span>View in Google Voice</span>
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-[11px] text-slate-500">
                                            {act.createdByName || 'Unknown'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-12 z-[20] bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
                                <tr>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Order #</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Date</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Sales Rep</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Method</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Status</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100">Subtotal</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100">Shipping</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100">Discount</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100 bg-slate-50">Grand Total</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100">Cost</th>
                                    <th className="px-2 py-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-12 text-center text-slate-400 text-sm">
                                            No wholesale orders yet
                                        </td>
                                    </tr>
                                ) : orders.map((order) => {
                                    const lineTotal = (order.lineItems || []).reduce((s, li) => s + ((li.qtyShipped || 0) * (li.price || 0)), 0);
                                    const grandTotal = lineTotal + (order.shippingCost || 0) + (order.tax || 0) - (order.discount || 0);
                                    const cost = (order.lineItems || []).reduce((s, li) => s + ((li.qtyShipped || 0) * (li.cost || 0)), 0);
                                    const margin = grandTotal - cost;
                                    
                                    return (
                                        <tr 
                                            key={order._id} 
                                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                            onClick={() => router.push(`/sales/wholesale-orders/${order._id}`)}
                                        >
                                            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-900 tracking-tight font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px] border-r border-slate-50">
                                                {order.label || order._id.substring(0, 8)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono whitespace-nowrap border-r border-slate-50">
                                                {formatDate(order.createdAt)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] border-r border-slate-50">
                                                {typeof order.salesRep === 'object' && order.salesRep !== null 
                                                    ? `${(order.salesRep as any).firstName} ${(order.salesRep as any).lastName}` 
                                                    : (order.salesRep || '-')}
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] text-slate-500 border-r border-slate-50">
                                                {order.paymentMethod || '-'}
                                            </td>
                                            <td className="px-2 py-1.5 border-r border-slate-50">
                                                <span className={cn(
                                                    "px-1.5 py-0.5 text-[8px] font-bold uppercase",
                                                    order.orderStatus === 'Shipped' ? "bg-green-100 text-green-700" :
                                                    order.orderStatus === 'Completed' ? "bg-blue-100 text-blue-700" :
                                                    order.orderStatus === 'Processing' ? "bg-orange-100 text-orange-700" :
                                                    order.orderStatus === 'Pending' ? "bg-amber-100 text-amber-700" :
                                                    order.orderStatus === 'Cancelled' ? "bg-red-100 text-red-700" :
                                                    "bg-slate-100 text-slate-600"
                                                )}>
                                                    {order.orderStatus || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] font-bold text-slate-900 font-mono text-right border-r border-slate-50">
                                                {formatCurrency(lineTotal)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono text-right border-r border-slate-50">
                                                {formatCurrency(order.shippingCost || 0)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono text-right border-r border-slate-50">
                                                {formatCurrency(order.discount || 0)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] font-black text-slate-900 bg-slate-50 font-mono text-right border-r border-slate-50">
                                                {formatCurrency(grandTotal)}
                                            </td>
                                            <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono text-right border-r border-slate-50">
                                                {formatCurrency(cost)}
                                            </td>
                                            <td className={cn("px-2 py-1.5 text-[10px] font-bold font-mono text-right", margin < 0 ? "text-red-500" : "text-green-600")}>
                                                {formatCurrency(margin)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Load More Indicator */}
                    <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
                        {((activeTab !== 'Orders' && hasMoreActivities) || (activeTab === 'Orders' && hasMoreOrders)) && (
                            <div className="flex items-center space-x-2 text-slate-400">
                                {isLoadingMore ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-[10px] font-medium">Loading more...</span>
                                    </>
                                ) : (
                                    <span className="text-[10px] font-medium">Scroll for more</span>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Shell Layer 3: Footer */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-100/50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System Ready</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">Client Dashboard v1.0</span>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                    </span>
                </div>
            </div>
        </div>

            <ClientModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSuccess={() => {
                    fetchClientData();
                    toast.success('Client updated successfully');
                }}
                initialData={client}
            />
        </>
    );
}
