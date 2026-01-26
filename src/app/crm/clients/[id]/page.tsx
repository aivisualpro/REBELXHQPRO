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
    EyeOff,
    StickyNote
} from 'lucide-react';
import Link from 'next/link';
import { GmailEmailView } from '@/components/crm/GmailEmailView';
import CallsView from '@/components/crm/CallsView';
import SMSView from '@/components/crm/SMSView';
import NotesView from '@/components/crm/NotesView';
import OrdersView from '@/components/crm/OrdersView';
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
    const [activeTab, setActiveTab] = useState<'Emails' | 'Calls' | 'SMS' | 'Notes' | 'Orders'>('Emails');
    
    // Notes state
    const [clientNotes, setClientNotes] = useState<{ _id: string; note: string; createdAt: string; createdBy: string }[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    
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
                        // Refresh data
                        fetchClientData(1, false);
                    }
                } catch (err) {
                    toast.error('Failed to log activity');
                }
            }
        }, 3000);
    };

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
                    fetchGmailEmails(data.client.emails);
                    
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
        if (!emailsToSearch?.length) {
            setGmailEmails([]);
            setSummary(prev => prev ? { ...prev, totalEmails: 0 } : null);
            return;
        }
        
        setLoadingGmail(true);
        try {
            const q = 'in:inbox (' + emailsToSearch.map((e: any) => {
                const email = e.value;
                return `to:${email} OR cc:${email} OR bcc:${email}`;
            }).join(' OR ') + ')';
            console.log('Fetching Gmail with query:', q);
            const res = await fetch(`/api/gmail?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const data = await res.json();
                console.log('Gmail Emails Loaded Successfully:', data.emails?.length);
                setGmailEmails(data.emails || []);
                if (data.emails !== undefined) {
                    setSummary(prev => prev ? { ...prev, totalEmails: data.emails?.length || 0 } : null);
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

    // Fetch notes when Notes tab is active
    const fetchClientNotes = async () => {
        if (!id) return;
        setLoadingNotes(true);
        try {
            const res = await fetch(`/api/clients/${id}`);
            if (res.ok) {
                const data = await res.json();
                setClientNotes(data.client?.notes || []);
            }
        } catch (error) {
            console.error('Failed to fetch notes:', error);
        } finally {
            setLoadingNotes(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'Notes' && id) {
            fetchClientNotes();
        }
    }, [activeTab, id]);

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
        <div className="flex items-center justify-center h-screen bg-background">
            <LoadingSpinner size="lg" message="Loading Client Dashboard" />
        </div>
    );

    if (!client) return (
        <div className="flex flex-col items-center justify-center h-screen bg-background">
            <h2 className="text-xl font-bold text-foreground">Client Not Found</h2>
            <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded">Go Back</button>
        </div>
    );

    const lastActivityDays = daysSince(summary?.lastActivityDate || null);
    const lastOrderDays = daysSince(summary?.lastOrderDate || null);

    return (
        <>
            <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden bg-background">
            {/* Shell Layer 1: Route Header */}
            <div className="sticky top-0 z-[50] bg-card border-b border-border px-4 flex items-center space-x-2 shrink-0 h-11 shadow-sm">
                <button 
                    onClick={() => router.back()} 
                    className="w-9 h-9 bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 rounded"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>

                <button 
                    onClick={() => setIsEditModalOpen(true)}
                    className="w-9 h-9 bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition-colors shrink-0 rounded"
                >
                    <Edit className="w-4 h-4" />
                </button>

                <div className="flex-1 max-w-sm relative group h-9">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
                    <input 
                        type="text" 
                        placeholder={`Search ${activeTab.toLowerCase()}...`}
                        className="w-full h-full pl-9 pr-4 bg-secondary/50 border border-transparent text-[11px] focus:outline-none focus:ring-1 focus:ring-ring focus:bg-background focus:border-ring transition-all rounded-md placeholder:text-muted-foreground font-medium text-foreground"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center space-x-1 h-9 ml-4">
                    {[
                        { id: 'Emails', icon: Mail, count: summary?.totalEmails },
                        { id: 'Calls', icon: Phone, count: summary?.totalCalls },
                        { id: 'SMS', icon: MessageSquare, count: summary?.totalSMS },
                        { id: 'Notes', icon: StickyNote, count: clientNotes?.length },
                        { id: 'Orders', icon: ShoppingCart, count: summary?.totalOrders }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                setSearchQuery(''); // Clear search when switching tabs
                            }}
                            className={cn(
                                "flex items-center space-x-2 px-4 h-full text-[10px] font-bold uppercase tracking-widest transition-all rounded-md",
                                activeTab === tab.id
                                    ? "bg-[#FFEF5F] text-black shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                            )}
                        >
                            <tab.icon className="w-3.5 h-3.5" />
                            <span>{tab.id}</span>
                            {tab.count !== undefined && (
                                <span className={cn(
                                    "px-1.5 py-0.5 text-[9px] rounded-sm font-mono",
                                    activeTab === tab.id ? "bg-black text-white" : "bg-secondary text-muted-foreground"
                                )}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Shell Layer 2: Main Content Split */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
                {/* Left Column (30%) - Client Details */}
                <aside className="w-[30%] h-full overflow-y-auto border-r border-border bg-card shrink-0 scrollbar-custom">
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
                                        <div key={idx} className="group flex items-center justify-between">
                                            <a 
                                                href={`https://voice.google.com/u/0/calls?number=${p.value.replace(/\D/g, '')}&action=dial`} 
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    initiateGoogleVoice(client._id, p.value, 'calls');
                                                }}
                                                className="text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors truncate"
                                            >
                                                {p.value}
                                            </a>
                                            <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => initiateGoogleVoice(client._id, p.value, 'calls')} 
                                                    className="p-1 hover:text-blue-600 cursor-pointer text-slate-400"
                                                    title="Call"
                                                >
                                                    <Phone className="w-3 h-3" />
                                                </button>
                                                <button 
                                                    onClick={() => initiateGoogleVoice(client._id, p.value, 'messages')}
                                                    className="p-1 hover:text-emerald-600 cursor-pointer text-slate-400"
                                                    title="SMS"
                                                >
                                                    <MessageSquare className="w-3 h-3" />
                                                </button>
                                            </div>
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
                                            <a 
                                                href="#" 
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setComposeData(prev => ({ ...prev, to: e.value }));
                                                    setIsComposeOpen(true);
                                                }}
                                                className="text-xs font-bold text-slate-700 hover:text-purple-600 transition-colors truncate"
                                            >
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
                <main className="flex-1 h-full overflow-hidden bg-background relative flex flex-col">
                    <div className="flex-1 h-full relative">
                        {activeTab === 'Emails' && (
                            <div className="h-full">
                                <GmailEmailView 
                                    initialLabel="INBOX" 
                                    forcedClientEmails={client?.emails?.map(e => e.value) || []} 
                                />
                            </div>
                        )}
                         {activeTab === 'Calls' && id && (
                             <CallsView 
                                clientId={id as string} 
                                clientPhone={client.phones?.[0]?.value}
                                onInitiateCall={() => initiateGoogleVoice(id as string, client.phones?.[0]?.value || '', 'calls')}
                             />
                         )}
                        {activeTab === 'SMS' && id && (
                             <SMSView 
                                clientId={id as string} 
                                clientPhone={client.phones?.[0]?.value}
                                onInitiateSMS={() => initiateGoogleVoice(id as string, client.phones?.[0]?.value || '', 'messages')}
                             />
                         )}
                        {activeTab === 'Notes' && id && (
                            <NotesView clientId={id as string} />
                        )}
                        {activeTab === 'Orders' && id && (
                            <OrdersView clientId={id as string} />
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
