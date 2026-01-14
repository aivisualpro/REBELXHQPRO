'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    User,
    Phone,
    Mail,
    MapPin,
    DollarSign,
    ShoppingCart,
    MessageSquare,
    Facebook,
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
    Edit,
    Inbox,
    Send,
    Star,
    Paperclip,
    X,
    Trash2,
    Reply,
    Forward,
    Eye,
    EyeOff
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
    salesRepInfo?: { firstName: string; lastName: string; email: string; image?: string };
    contactStatus?: string;
    contactType?: string;
    companyType?: string;
    website?: string;
    facebookPage?: string;
    industry?: string;
    forecastedAmount?: number;
    projectedCloseDate?: string;
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
    const [gmailEmails, setGmailEmails] = useState<any[]>([]);
    const [loadingGmail, setLoadingGmail] = useState(false);
    const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
    const [sendingEmail, setSendingEmail] = useState(false);
    
    // Billing visibility state
    const [showBillingDetails, setShowBillingDetails] = useState(false);
    const [billingPasswordModal, setBillingPasswordModal] = useState(false);
    const [billingPassword, setBillingPassword] = useState('');
    const [billingPasswordError, setBillingPasswordError] = useState('');
    const billingTimeoutRef = useRef<NodeJS.Timeout | null>(null);


    const filteredEmails = useMemo(() => {
        if (!searchQuery) return gmailEmails;
        const q = searchQuery.toLowerCase();
        return gmailEmails.filter(e => 
            e.subject?.toLowerCase().includes(q) || 
            e.sender?.toLowerCase().includes(q) || 
            e.snippet?.toLowerCase().includes(q) ||
            e.body?.toLowerCase().includes(q)
        );
    }, [gmailEmails, searchQuery]);

    const handleGmailAction = async (messageId: string, action: 'READ' | 'UNREAD' | 'STAR' | 'UNSTAR' | 'TRASH') => {
        try {
            const res = await fetch('/api/gmail', {
                method: 'PATCH',
                body: JSON.stringify({ messageId, action })
            });
            if (res.ok) {
                if (action === 'TRASH') {
                    setGmailEmails(prev => prev.filter(e => e.id !== messageId));
                    toast.success('Email moved to trash');
                } else {
                    setGmailEmails(prev => prev.map(e => {
                        if (e.id === messageId) {
                            if (action === 'READ') return { ...e, isRead: true };
                            if (action === 'UNREAD') return { ...e, isRead: false };
                            if (action === 'STAR') return { ...e, isStarred: true };
                            if (action === 'UNSTAR') return { ...e, isStarred: false };
                        }
                        return e;
                    }));
                }
            }
        } catch (error) {
            console.error('Gmail action error:', error);
            toast.error('Failed to update email status');
        }
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
                body: JSON.stringify(composeData)
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Email sent successfully!');
                setIsComposeOpen(false);
                setComposeData({ to: '', subject: '', body: '' });
                // Refresh emails to show the sent email
                if (client?.emails?.length) {
                    fetchGmailEmails(client.emails);
                }
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

    const handleVerifyBillingPassword = async () => {
        if (!billingPassword) {
            setBillingPasswordError('Please enter your password');
            return;
        }
        
        try {
            const res = await fetch('/api/auth/verify-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: billingPassword })
            });
            
            if (res.ok) {
                // Password verified successfully
                setBillingPasswordModal(false);
                setBillingPassword('');
                setBillingPasswordError('');
                setShowBillingDetails(true);
                toast.success('Verification successful');
                
                // Auto-hide after 60 seconds
                if (billingTimeoutRef.current) {
                    clearTimeout(billingTimeoutRef.current);
                }
                billingTimeoutRef.current = setTimeout(() => {
                    setShowBillingDetails(false);
                    toast('Billing details hidden for security', { icon: '🔒' });
                }, 60000); // 60 seconds
            } else {
                const data = await res.json();
                setBillingPasswordError(data.error || 'Invalid password');
            }
        } catch (error) {
            console.error('Password verification error:', error);
            setBillingPasswordError('Failed to verify password');
        }
    };

    const getCardType = (number: string) => {
        const n = number?.replace(/\D/g, '') || '';
        if (n.startsWith('4')) return 'Visa';
        if (/^5[1-5]/.test(n) || /^2(2\d{2}|[3-6]\d{2}|7[0-1]\d|720)/.test(n)) return 'MasterCard';
        if (/^3[47]/.test(n)) return 'Amex';
        if (/^6(?:011|5|4[4-9]|22)/.test(n)) return 'Discover';
        return '';
    };

    const getCardTheme = (type: string) => {
        switch (type.toLowerCase()) {
            case 'visa': return 'from-[#1a1f71] to-[#00579f]';
            case 'mastercard': return 'from-[#232323] to-[#4b4b4b]';
            case 'amex': return 'from-[#007bc1] to-[#00a3e0]';
            case 'discover': return 'from-[#f68121] to-[#ff9d4d]';
            default: return 'from-slate-900 to-slate-800';
        }
    };

    const cardType = getCardType(client?.billing?.ccNumber || '');
    const cardTheme = getCardTheme(cardType);

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
                    if (activeTab !== 'Orders' && activeTab !== 'Emails') {
                        setActivities(prev => [...prev, ...data.activities]);
                    } else if (activeTab === 'Orders') {
                        setOrders(prev => [...prev, ...data.orders]);
                    }
                } else {
                    setActivities(data.activities);
                    setOrders(data.orders);
                    
                    // Trigger Gmail fetch if client data is now available
                    if (data.client?.emails?.length) {
                        fetchGmailEmails(data.client.emails);
                    }
                    
                    if (summary?.totalEmails === undefined) {
                        setSummary(prev => ({ ...prev!, totalEmails: data.summary.totalEmails }));
                    }
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

    const fetchGmailEmails = async (providedEmails?: any[]) => {
        const emailsToSearch = providedEmails || client?.emails;
        if (!emailsToSearch?.length) return;
        
        setLoadingGmail(true);
        try {
            const q = emailsToSearch.map((e: any) => e.value).join(' OR ');
            console.log('Fetching Gmail with query:', q);
            const res = await fetch(`/api/gmail?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                console.log('Gmail Emails Loaded Successfully:', data.emails?.length);
                setGmailEmails(data.emails || []);
                if (data.resultSizeEstimate !== undefined) {
                    setSummary(prev => prev ? { ...prev, totalEmails: data.resultSizeEstimate } : null);
                }
            } else {
                console.error('Gmail API Error:', await res.text());
            }
        } catch (error) {
            console.error('Failed to fetch Gmail emails:', error);
        } finally {
            setLoadingGmail(false);
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

    useEffect(() => {
        if (activeTab === 'Emails' && client?.emails?.length) {
            fetchGmailEmails();
        }
    }, [activeTab, client?.emails]);

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
                                <div className="w-10 h-10 bg-blue-600 flex items-center justify-center text-white font-bold text-sm rounded-sm overflow-hidden shrink-0">
                                    {client.salesRepInfo?.image ? (
                                        <img src={client.salesRepInfo.image} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{client.salesRepInfo?.firstName?.charAt(0) || '?'}</span>
                                    )}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">
                                        {client.salesRepInfo ? `${client.salesRepInfo.firstName} ${client.salesRepInfo.lastName}` : 'Unassigned'}
                                    </div>
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
                                            <a 
                                                href={`https://voice.google.com/u/0/calls?number=${p.value.replace(/\D/g, '')}&action=dial`} 
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors truncate"
                                            >
                                                {p.value}
                                            </a>
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
                                        </div>
                                    )) || <span className="text-[10px] text-slate-400 italic">None</span>}
                                </div>
                            </div>
                        </div>

                        {/* Billing Section (Object) */}
                        <div className="space-y-3 pt-4 border-t border-slate-100">
                            <div className={cn("p-4 rounded-sm space-y-3 shadow-inner bg-gradient-to-br transition-all duration-500", cardTheme)}>
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-5.5 bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 rounded-sm relative overflow-hidden shadow-inner flex shrink-0">
                                        <div className="absolute inset-0 border-[0.5px] border-black/10"></div>
                                        <div className="absolute top-1/2 left-0 w-full h-[0.5px] bg-black/20"></div>
                                        <div className="absolute top-0 left-1/2 w-[0.5px] h-full bg-black/20"></div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {cardType && (
                                            <div className="text-[9px] text-white/50 uppercase font-black tracking-widest">{cardType}</div>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (showBillingDetails) {
                                                    setShowBillingDetails(false);
                                                    if (billingTimeoutRef.current) {
                                                        clearTimeout(billingTimeoutRef.current);
                                                    }
                                                } else {
                                                    setBillingPasswordModal(true);
                                                }
                                            }}
                                            className="p-1 hover:bg-white/10 rounded transition-colors"
                                            title={showBillingDetails ? "Hide details" : "View details"}
                                        >
                                            {showBillingDetails ? (
                                                <EyeOff className="w-3.5 h-3.5 text-white/60" />
                                            ) : (
                                                <Eye className="w-3.5 h-3.5 text-white/60" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="space-y-1">
                                    <div className="text-[12px] font-mono text-white tracking-[0.2em] truncate">
                                        {showBillingDetails 
                                            ? (client.billing?.ccNumber || '•••• •••• •••• ••••')
                                            : '•••• •••• •••• ••••'
                                        }
                                    </div>
                                </div>

                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <div className="text-[7px] text-white/40 uppercase font-black tracking-tighter transition-colors">Card Holder</div>
                                        <div className="text-[9px] text-white font-bold uppercase tracking-wider truncate max-w-[100px]">
                                            {client.billing?.nameOnCard || '-'}
                                        </div>
                                    </div>
                                    <div className="flex space-x-3">
                                        <div className="space-y-1">
                                            <div className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Expires</div>
                                            <div className="text-[9px] text-white font-mono">{client.billing?.expirationDate || '••/••'}</div>
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-[7px] text-white/40 uppercase font-black tracking-tighter">CVV</div>
                                            <div className="text-[9px] text-white font-mono">
                                                {showBillingDetails 
                                                    ? (client.billing?.securityCode || '•••')
                                                    : '•••'
                                                }
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rest of the Information */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Metadata</div>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex flex-col text-xs py-2 border-b border-slate-50">
                                    <span className="text-slate-500 mb-1">Business Description</span>
                                    <span className="text-slate-700 leading-relaxed italic">{client.description || 'No description provided'}</span>
                                </div>
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
                                {client.website && (
                                    <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                        <span className="text-slate-500 uppercase font-black text-[8px] tracking-widest text-slate-400">Website</span>
                                        <div className="flex items-center space-x-1 justify-end">
                                            <Globe className="w-2.5 h-2.5 text-blue-500" />
                                            <a href={client.website.startsWith('http') ? client.website : `https://${client.website}`} target="_blank" className="text-blue-600 font-bold truncate max-w-[150px]">{client.website}</a>
                                        </div>
                                    </div>
                                )}
                                {client.facebookPage && (
                                    <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                         <span className="text-slate-500 uppercase font-black text-[8px] tracking-widest text-slate-400">Facebook</span>
                                        <div className="flex items-center space-x-1 justify-end">
                                            <Facebook className="w-2.5 h-2.5 text-blue-600" />
                                            <a href={client.facebookPage.startsWith('http') ? client.facebookPage : `https://${client.facebookPage}`} target="_blank" className="text-blue-600 font-bold truncate max-w-[150px]">{client.facebookPage}</a>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Forecasted</span>
                                    <span className="font-bold text-slate-900">{formatCurrency(client.forecastedAmount || 0)}</span>
                                </div>
                                {client.projectedCloseDate && (
                                    <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                        <span className="text-slate-500">Projected Close</span>
                                        <span className="font-bold text-emerald-600">{formatDate(client.projectedCloseDate)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Payment Terms</span>
                                    <span className="font-bold text-slate-800">{client.defaultPaymentMethod || '-'}</span>
                                </div>
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500">Shipping Terms</span>
                                    <span className="font-bold text-slate-800">{client.defaultShippingTerms || '-'}</span>
                                </div>
                                <div className="flex justify-between text-xs py-1 border-b border-slate-50">
                                    <span className="text-slate-500 uppercase font-black text-[8px] tracking-widest text-slate-400">Created At</span>
                                    <span className="font-medium text-slate-600">{formatDate(client.createdAt || '')}</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-10" />
                    </div>
                </aside>

                {/* Right Column: Activity/Orders Table */}
                <main className="flex-1 h-full overflow-y-auto bg-white relative scrollbar-custom">

                    {/* Floating Compose Button for Emails Tab */}
                    {activeTab === 'Emails' && (
                        <button 
                            onClick={() => {
                                if (!client?.emails?.length) {
                                    toast.error("No email addresses found for this client");
                                    return;
                                }
                                setComposeData({ to: client.emails[0].value, subject: '', body: '' });
                                setIsComposeOpen(true);
                            }}
                            className="fixed bottom-8 right-8 z-[60] w-14 h-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-blue-700 hover:scale-110 transition-all group"
                            title="Compose Email"
                        >
                            <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                        </button>
                    )}

                    {/* Floating Create Order Button for Orders Tab */}
                    {activeTab === 'Orders' && (
                        <button 
                            onClick={() => router.push(`/sales/wholesale-orders?createFor=${id}`)}
                            className="fixed bottom-6 right-6 z-[60] w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-700 hover:scale-110 transition-all group"
                            title="Create New Order"
                        >
                            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        </button>
                    )}


                    {/* Table Content */}
                    {activeTab !== 'Orders' ? (
                    <table className="w-full text-left border-collapse">
                        <thead className={cn(
                            "sticky top-0 z-[20] bg-slate-50/90 backdrop-blur-sm border-b border-slate-100",
                            activeTab === 'Emails' && "hidden"
                        )}>
                            {activeTab === 'Emails' ? (
                                <tr></tr>
                            ) : (
                                <tr>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Type</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Comments</th>
                                    <th className="px-4 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">By</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {activeTab === 'Emails' ? (
                                loadingGmail ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center text-slate-400 text-xs">
                                            <div className="flex flex-col items-center space-y-3">
                                                <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                                <span className="font-medium tracking-wide">Syncing Workspace Correspondence...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : gmailEmails.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-16 text-center text-slate-400 text-sm">
                                            <div className="flex flex-col items-center space-y-2 italic">
                                                <span>No external correspondence matched</span>
                                                <span className="text-[10px] text-slate-300 font-normal">Checked for: {client.emails?.map(e => e.value).join(', ')}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredEmails.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-16 text-center text-slate-400 text-sm">
                                            <div className="flex flex-col items-center space-y-2 italic">
                                                <span>No results match your search</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredEmails.map((email) => {
                                    const isSent = email.labelIds?.includes('SENT');
                                    const isUnread = !email.isRead && !isSent;
                                    
                                    // Extract recipient name from "Name <email>" format
                                    const getRecipientName = (recipient: string) => {
                                        if (!recipient) return 'Unknown';
                                        const namePart = recipient.split('<')[0].trim().replace(/"/g, '');
                                        // If no name part (just email), try to get name from email
                                        if (!namePart || namePart === recipient) {
                                            const emailMatch = recipient.match(/<([^>]+)>/) || [null, recipient];
                                            const emailAddr = emailMatch[1] || recipient;
                                            // Return first part of email as fallback name
                                            return emailAddr.split('@')[0];
                                        }
                                        return namePart;
                                    };
                                    
                                    return (
                                        <React.Fragment key={email.id}>
                                            <tr 
                                                className={cn(
                                                    "hover:bg-slate-50 transition-colors group cursor-pointer border-l-2",
                                                    isUnread ? "bg-white border-l-blue-600 shadow-sm" : "bg-slate-50/10 border-l-transparent",
                                                    expandedEmailId === email.id && "bg-blue-50/30"
                                                )}
                                                onClick={(e) => {
                                                    // Don't trigger if clicking star or trash
                                                    const target = e.target as HTMLElement;
                                                    if (target.closest('.action-btn')) return;
                                                    
                                                    setExpandedEmailId(expandedEmailId === email.id ? null : email.id);
                                                    if (isUnread) handleGmailAction(email.id, 'READ');
                                                }}
                                            >
                                                <td className="px-4 py-3 w-10">
                                                    <div className="flex items-center space-x-2">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleGmailAction(email.id, email.isStarred ? 'UNSTAR' : 'STAR');
                                                            }}
                                                            className="action-btn"
                                                        >
                                                            <Star className={cn(
                                                                "w-3.5 h-3.5 transition-colors",
                                                                email.isStarred ? "text-yellow-400 fill-yellow-400" : "text-slate-300 hover:text-yellow-400"
                                                            )} />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center space-x-2 min-w-[140px]">
                                                        {isSent ? <Send className="w-3 h-3 text-blue-500/50" /> : <Inbox className="w-3 h-3 text-purple-500/50" />}
                                                        <span className={cn(
                                                            "text-xs truncate max-w-[140px]",
                                                            isUnread ? "font-black text-slate-900" : "font-medium text-slate-600"
                                                        )}>
                                                            {isSent ? getRecipientName(email.recipient) : email.sender}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center space-x-2 text-xs">
                                                        <span className={cn(
                                                            "truncate max-w-[300px]",
                                                            isUnread ? "font-bold text-slate-900" : "font-medium text-slate-700"
                                                        )}>
                                                            {email.subject}
                                                        </span>
                                                        <span className="text-slate-400 font-normal truncate max-w-[200px]">
                                                            - {email.snippet}
                                                        </span>
                                                        {email.hasAttachments && (
                                                            <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex items-center justify-end space-x-3">
                                                        <span className={cn(
                                                            "text-[9px] whitespace-nowrap uppercase tracking-tighter",
                                                            isUnread ? "font-bold text-blue-600" : "font-medium text-slate-400"
                                                        )}>
                                                            {email.date}
                                                        </span>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleGmailAction(email.id, 'TRASH');
                                                            }}
                                                            className="action-btn opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-all"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            
                                            {/* Expanded Email Content */}
                                            {expandedEmailId === email.id && (
                                                <tr>
                                                    <td colSpan={4} className="p-0">
                                                        <div className="px-16 py-8 bg-white border-y border-slate-100 animate-in slide-in-from-top-2 duration-200">
                                                            <div className="flex items-center justify-between mb-8">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                                                                        <User className="w-5 h-5 text-slate-400" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="text-sm font-black text-slate-900">{email.sender}</span>
                                                                            <span className="text-xs text-slate-400 font-medium tracking-wider">&lt;{email.senderEmail || ''}&gt;</span>
                                                                        </div>
                                                                        <div className="flex items-center space-x-2 mt-0.5">
                                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">to {isSent ? getRecipientName(email.recipient) : 'me'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{email.date} ({email.time})</span>
                                                            </div>
                                                            <div className="space-y-6">
                                                                <h3 className="text-lg font-black text-slate-900">{email.subject}</h3>
                                                                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                                                                    {email.body || <span className="text-slate-400 italic">No plain text content available</span>}
                                                                </div>

                                                                {email.attachments?.length > 0 && (
                                                                    <div className="pt-8 border-t border-slate-50">
                                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Attachments ({email.attachments.length})</p>
                                                                        <div className="flex flex-wrap gap-3">
                                                                            {email.attachments.map((att: any) => (
                                                                                <div 
                                                                                    key={att.id} 
                                                                                    className="group relative flex items-center space-x-3 p-3 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100 min-w-[200px] cursor-pointer"
                                                                                >
                                                                                    <div className="p-2 bg-white border border-slate-200">
                                                                                        <Paperclip className="w-4 h-4 text-slate-400" />
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="text-[11px] font-black text-slate-900 truncate">{att.filename}</p>
                                                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{(att.size / 1024).toFixed(1)} KB</p>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}


                                                                {/* Reply & Forward Actions */}
                                                                <div className="pt-6 border-t border-slate-100 flex items-center space-x-3">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const replyTo = isSent ? email.recipient : (email.senderEmail || email.sender);
                                                                            const quotedBody = "\n\n---------- Original Message ----------\nFrom: " + email.sender + " <" + (email.senderEmail || '') + ">\nDate: " + email.date + " " + email.time + "\nSubject: " + email.subject + "\nTo: " + email.recipient + "\n\n" + (email.body || '');
                                                                            setComposeData({
                                                                                to: replyTo,
                                                                                subject: email.subject?.startsWith('Re:') ? email.subject : 'Re: ' + email.subject,
                                                                                body: quotedBody
                                                                            });
                                                                            setIsComposeOpen(true);
                                                                        }}
                                                                        className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm"
                                                                    >
                                                                        <Reply className="w-3.5 h-3.5" />
                                                                        <span>Reply</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const forwardBody = "\n\n---------- Forwarded Message ----------\nFrom: " + email.sender + " <" + (email.senderEmail || '') + ">\nDate: " + email.date + " " + email.time + "\nSubject: " + email.subject + "\nTo: " + email.recipient + "\n\n" + (email.body || '');
                                                                            setComposeData({
                                                                                to: '',
                                                                                subject: email.subject?.startsWith('Fwd:') ? email.subject : 'Fwd: ' + email.subject,
                                                                                body: forwardBody
                                                                            });
                                                                            setIsComposeOpen(true);
                                                                        }}
                                                                        className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm"
                                                                    >
                                                                        <Forward className="w-3.5 h-3.5" />
                                                                        <span>Forward</span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })

                            ) : (
                                activities.filter(a => {
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
                                ))
                            )}
                        </tbody>
                    </table>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-[20] bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
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
                }}
                initialData={client}
            />

            {/* Compose Email Modal */}
            {isComposeOpen && (
                <div className="fixed bottom-0 right-12 w-[540px] bg-white border border-slate-200 shadow-2xl z-[1001] animate-in slide-in-from-bottom-5 duration-300 rounded-t-lg overflow-hidden">
                    <div className="bg-[#1A1A1A] text-white px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">New message</span>
                        <button onClick={() => setIsComposeOpen(false)} className="hover:text-slate-300 transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-0">
                        <div className="px-4 border-b border-slate-100">
                            <input 
                                type="text" 
                                placeholder="Recipients" 
                                className="w-full text-sm py-3 focus:outline-none placeholder:text-slate-400 font-medium" 
                                value={composeData.to} 
                                onChange={(e) => setComposeData({...composeData, to: e.target.value})} 
                            />
                        </div>
                        <div className="px-4 border-b border-slate-100">
                            <input 
                                type="text" 
                                placeholder="Subject" 
                                className="w-full text-sm py-3 focus:outline-none placeholder:text-slate-400 font-medium" 
                                value={composeData.subject} 
                                onChange={(e) => setComposeData({...composeData, subject: e.target.value})} 
                            />
                        </div>
                        <div className="px-4">
                            <textarea 
                                placeholder="Message" 
                                rows={12} 
                                className="w-full text-sm py-4 focus:outline-none resize-none placeholder:text-slate-400 font-medium leading-relaxed" 
                                value={composeData.body} 
                                onChange={(e) => setComposeData({...composeData, body: e.target.value})} 
                            />
                        </div>
                        
                        {/* Toolbar & Send */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white">
                            <div className="flex items-center space-x-1">
                                <button 
                                    onClick={handleSendEmail}
                                    disabled={sendingEmail}
                                    className="flex items-center space-x-3 px-8 py-2.5 bg-black text-white text-[11px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 transition-all mr-4 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sendingEmail ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
                                    <button className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm" title="Attach files">
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
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-sm"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Confirmation Modal for Billing */}
            {billingPasswordModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg shadow-2xl w-[380px] overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
                            <span className="text-[11px] font-black uppercase tracking-[0.15em]">Security Verification</span>
                            <button 
                                onClick={() => {
                                    setBillingPasswordModal(false);
                                    setBillingPassword('');
                                    setBillingPasswordError('');
                                }}
                                className="hover:text-slate-300 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="text-center space-y-2">
                                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto">
                                    <CreditCard className="w-6 h-6 text-slate-500" />
                                </div>
                                <p className="text-sm text-slate-600">Enter your password to view sensitive billing information</p>
                            </div>
                            <div className="space-y-2">
                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    value={billingPassword}
                                    onChange={(e) => {
                                        setBillingPassword(e.target.value);
                                        setBillingPasswordError('');
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            // Verify password
                                            handleVerifyBillingPassword();
                                        }
                                    }}
                                    className="w-full px-4 py-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    autoFocus
                                />
                                {billingPasswordError && (
                                    <p className="text-xs text-red-500 font-medium">{billingPasswordError}</p>
                                )}
                            </div>
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => {
                                        setBillingPasswordModal(false);
                                        setBillingPassword('');
                                        setBillingPasswordError('');
                                    }}
                                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-widest rounded hover:bg-slate-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleVerifyBillingPassword}
                                    className="flex-1 px-4 py-2.5 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest rounded hover:bg-slate-800 transition-colors"
                                >
                                    Verify
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-400 text-center">
                                Details will auto-hide after 60 seconds
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>

    );
}
