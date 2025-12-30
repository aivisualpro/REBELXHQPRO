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
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

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
    createdAt?: string;
}

interface ActivityItem {
    _id: string;
    type: 'Call' | 'Text' | 'Email' | 'Visit';
    comments?: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
}

interface OrderItem {
    _id: string;
    label?: string;
    orderStatus?: string;
    lineItems?: { sku: string; qtyShipped: number; price: number; total: number }[];
    shippingCost?: number;
    discount?: number;
    createdAt: string;
}

interface Summary {
    totalOrders: number;
    totalRevenue: number;
    totalItemsSold: number;
    totalActivities: number;
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
    const [activeTab, setActiveTab] = useState<'activities' | 'orders'>('activities');
    
    // Pagination
    const [activitiesPage, setActivitiesPage] = useState(1);
    const [ordersPage, setOrdersPage] = useState(1);
    const [hasMoreActivities, setHasMoreActivities] = useState(false);
    const [hasMoreOrders, setHasMoreOrders] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
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
                    if (activeTab === 'activities') {
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
        if (activeTab === 'activities' && hasMoreActivities && !isLoadingMore) {
            const newPage = activitiesPage + 1;
            setActivitiesPage(newPage);
            fetchClientData(newPage, true);
        } else if (activeTab === 'orders' && hasMoreOrders && !isLoadingMore) {
            const newPage = ordersPage + 1;
            setOrdersPage(newPage);
            fetchClientData(newPage, true);
        }
    };

    // Infinite scroll observer
    useEffect(() => {
        if (!loadMoreRef.current) return;
        const hasMore = activeTab === 'activities' ? hasMoreActivities : hasMoreOrders;
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
        <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden bg-white">
            {/* Shell Layer 1: Route Header */}
            <div className="sticky top-0 z-[10] bg-white border-b border-slate-200 px-4 flex items-center justify-between space-x-3 shrink-0 h-12 shadow-sm">
                <div className="flex items-center space-x-3">
                    <button onClick={() => router.back()} className="hover:bg-slate-100 transition-colors p-1.5">
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                        {client.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold text-slate-900 leading-tight">{client.name}</h1>
                        <p className="text-[10px] text-slate-400 font-mono">{client._id}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {client.contactStatus && (
                        <span className={cn(
                            "text-[9px] font-bold uppercase tracking-widest px-2 py-1",
                            client.contactStatus === 'Active' ? "bg-emerald-100 text-emerald-700" :
                            client.contactStatus === 'Lead' ? "bg-blue-100 text-blue-700" :
                            "bg-slate-100 text-slate-600"
                        )}>
                            {client.contactStatus}
                        </span>
                    )}
                    {client.companyType && (
                        <span className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-purple-100 text-purple-700">
                            {client.companyType}
                        </span>
                    )}
                </div>
            </div>

            {/* Shell Layer 2: Main Content Split */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-white">
                {/* Left Column (30%) - Client Details */}
                <aside className="w-[30%] h-full overflow-y-auto border-r border-slate-100 bg-white shrink-0 scrollbar-custom">
                    <div className="p-4 space-y-6">
                        
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-3">
                                <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Revenue</div>
                                <div className="text-xl font-black text-emerald-700">{formatCurrency(summary?.totalRevenue || 0)}</div>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 p-3">
                                <div className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-1">Orders</div>
                                <div className="text-xl font-black text-blue-700">{summary?.totalOrders || 0}</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 p-3">
                                <div className="text-[9px] font-bold text-purple-600 uppercase tracking-widest mb-1">Activities</div>
                                <div className="text-xl font-black text-purple-700">{summary?.totalActivities || 0}</div>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-3">
                                <div className="text-[9px] font-bold text-orange-600 uppercase tracking-widest mb-1">Items Sold</div>
                                <div className="text-xl font-black text-orange-700">{summary?.totalItemsSold || 0}</div>
                            </div>
                        </div>

                        {/* Activity Health */}
                        <div className="bg-slate-50 border border-slate-100 p-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Engagement Health</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-600">Last Activity</span>
                                    <span className={cn(
                                        "text-xs font-bold",
                                        lastActivityDays === null ? "text-slate-400" :
                                        lastActivityDays <= 30 ? "text-emerald-600" :
                                        lastActivityDays <= 60 ? "text-amber-600" :
                                        "text-red-600"
                                    )}>
                                        {lastActivityDays === null ? 'Never' : lastActivityDays === 0 ? 'Today' : `${lastActivityDays}d ago`}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-600">Last Order</span>
                                    <span className={cn(
                                        "text-xs font-bold",
                                        lastOrderDays === null ? "text-slate-400" :
                                        lastOrderDays <= 30 ? "text-emerald-600" :
                                        lastOrderDays <= 60 ? "text-amber-600" :
                                        "text-red-600"
                                    )}>
                                        {lastOrderDays === null ? 'Never' : lastOrderDays === 0 ? 'Today' : `${lastOrderDays}d ago`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">Contact Information</h3>
                            
                            {/* Phones */}
                            {client.phones && client.phones.length > 0 && (
                                <div className="space-y-2">
                                    {client.phones.map((p, idx) => (
                                        <a key={idx} href={`tel:${p.value}`} className="flex items-center space-x-3 group hover:bg-slate-50 p-2 transition-colors">
                                            <div className="w-8 h-8 bg-blue-100 flex items-center justify-center">
                                                <Phone className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs font-medium text-slate-700 group-hover:text-blue-600">{p.value}</div>
                                                <div className="text-[10px] text-slate-400">{p.label || 'Phone'}{p.isWhatsApp && ' • WhatsApp'}</div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Emails */}
                            {client.emails && client.emails.length > 0 && (
                                <div className="space-y-2">
                                    {client.emails.map((e, idx) => (
                                        <a key={idx} href={`mailto:${e.value}`} className="flex items-center space-x-3 group hover:bg-slate-50 p-2 transition-colors">
                                            <div className="w-8 h-8 bg-purple-100 flex items-center justify-center">
                                                <Mail className="w-4 h-4 text-purple-600" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="text-xs font-medium text-slate-700 group-hover:text-purple-600 truncate">{e.value}</div>
                                                <div className="text-[10px] text-slate-400">{e.label || 'Email'}</div>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            )}

                            {/* Website */}
                            {client.website && (
                                <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-3 group hover:bg-slate-50 p-2 transition-colors">
                                    <div className="w-8 h-8 bg-emerald-100 flex items-center justify-center">
                                        <Globe className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-xs font-medium text-slate-700 group-hover:text-emerald-600 truncate">{client.website}</div>
                                        <div className="text-[10px] text-slate-400">Website</div>
                                    </div>
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                </a>
                            )}
                        </div>

                        {/* Addresses */}
                        {client.addresses && client.addresses.length > 0 && (
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">Addresses</h3>
                                {client.addresses.map((addr, idx) => (
                                    <div key={idx} className="flex items-start space-x-3 p-2">
                                        <div className="w-8 h-8 bg-orange-100 flex items-center justify-center shrink-0">
                                            <MapPin className="w-4 h-4 text-orange-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{addr.label || 'Address'}</div>
                                            <div className="text-xs text-slate-700 leading-relaxed">
                                                {addr.street && <div>{addr.street}</div>}
                                                <div>{[addr.city, addr.state, addr.postalCode].filter(Boolean).join(', ')}</div>
                                                {addr.country && <div>{addr.country}</div>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Sales Rep */}
                        {client.salesRepInfo && (
                            <div className="space-y-2">
                                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">Sales Representative</h3>
                                <div className="flex items-center space-x-3 p-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                        {client.salesRepInfo.firstName?.charAt(0) || '?'}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-800">
                                            {client.salesRepInfo.firstName} {client.salesRepInfo.lastName}
                                        </div>
                                        <div className="text-xs text-slate-400">{client.salesRepInfo.email}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Additional Info */}
                        <div className="space-y-2 pt-4 border-t border-slate-100">
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Industry</span>
                                <span className="text-slate-700 font-medium">{client.industry || '-'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Payment Method</span>
                                <span className="text-slate-700 font-medium">{client.defaultPaymentMethod || '-'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Shipping Terms</span>
                                <span className="text-slate-700 font-medium">{client.defaultShippingTerms || '-'}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-400">Created</span>
                                <span className="text-slate-700 font-medium">{formatDate(client.createdAt || '')}</span>
                            </div>
                        </div>

                        <div className="h-10" />
                    </div>
                </aside>

                {/* Right Column: Activity/Orders Table */}
                <main className="flex-1 h-full overflow-y-auto bg-white relative scrollbar-custom">
                    {/* Toolbar with Tabs */}
                    <div className="sticky top-0 z-[30] bg-white border-b border-slate-100 px-4 h-12 flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={() => setActiveTab('activities')}
                                className={cn(
                                    "flex items-center space-x-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
                                    activeTab === 'activities'
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                )}
                            >
                                <Activity className="w-3.5 h-3.5" />
                                <span>Activities</span>
                                <span className="bg-white/20 px-1.5 py-0.5 text-[10px]">{summary?.totalActivities || 0}</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('orders')}
                                className={cn(
                                    "flex items-center space-x-2 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
                                    activeTab === 'orders'
                                        ? "bg-slate-900 text-white"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                )}
                            >
                                <ShoppingCart className="w-3.5 h-3.5" />
                                <span>Wholesale Orders</span>
                                <span className="bg-white/20 px-1.5 py-0.5 text-[10px]">{summary?.totalOrders || 0}</span>
                            </button>
                        </div>
                        <button className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                            <span>{activeTab === 'activities' ? 'Log Activity' : 'New Order'}</span>
                        </button>
                    </div>

                    {/* Table Content */}
                    {activeTab === 'activities' ? (
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
                                {activities.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-sm">
                                            No activities recorded yet
                                        </td>
                                    </tr>
                                ) : activities.map((act) => (
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
                                        <td className="px-4 py-3 text-xs text-slate-700 max-w-sm truncate">
                                            {act.comments || '-'}
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
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Order #</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Items</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {orders.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-sm">
                                            No wholesale orders yet
                                        </td>
                                    </tr>
                                ) : orders.map((order) => {
                                    const lineTotal = (order.lineItems || []).reduce((s, li) => s + (li.total || 0), 0);
                                    const orderTotal = lineTotal + (order.shippingCost || 0) - (order.discount || 0);
                                    const itemCount = (order.lineItems || []).reduce((s, li) => s + (li.qtyShipped || 0), 0);
                                    
                                    return (
                                        <tr 
                                            key={order._id} 
                                            className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                            onClick={() => router.push(`/sales/wholesale-orders/${order._id}`)}
                                        >
                                            <td className="px-4 py-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                                                {formatDate(order.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-medium text-slate-800">
                                                {order.label || order._id.substring(0, 8)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn(
                                                    "text-[9px] font-bold uppercase tracking-widest px-2 py-1",
                                                    order.orderStatus === 'Completed' || order.orderStatus === 'Shipped' ? "bg-emerald-100 text-emerald-700" :
                                                    order.orderStatus === 'Pending' ? "bg-amber-100 text-amber-700" :
                                                    order.orderStatus === 'Cancelled' ? "bg-red-100 text-red-700" :
                                                    "bg-slate-100 text-slate-600"
                                                )}>
                                                    {order.orderStatus || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-600 text-right font-mono">
                                                {itemCount}
                                            </td>
                                            <td className="px-4 py-3 text-xs font-bold text-slate-900 text-right font-mono">
                                                {formatCurrency(orderTotal)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}

                    {/* Load More Indicator */}
                    <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
                        {((activeTab === 'activities' && hasMoreActivities) || (activeTab === 'orders' && hasMoreOrders)) && (
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
    );
}
