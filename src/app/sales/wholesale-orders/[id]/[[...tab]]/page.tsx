'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Calendar, CreditCard, Truck, Plus, X, Trash2, Pencil, User, MapPin, DollarSign, List, RefreshCw, MessageSquare, Phone, Mail, Eye, EyeOff, Download, FileText, Loader2, MailPlus } from 'lucide-react';
import { OrderEmailsTab } from '@/components/sales/OrderEmailsTab';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { cn, formatDate, toDateInputValue } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface LineItem {
    _id: string;
    sku: { _id: string; name: string } | string;
    lotNumber: string;
    qtyShipped: number;
    uom: string;
    price: number;
    total: number;
    cost?: number;
    productDescription?: string;
}

interface Payment {
    _id: string;
    orderNumber: string;
    paymentAmount: number;
    createdAt: string;
    createdBy: string;
}

interface Note {
    _id: string;
    legacyId?: string;
    note: string;
    createdBy: string;
    createdAt: string;
}

interface SaleOrder {
    _id: string;
    label: string;
    clientId: {
        _id: string;
        name: string;
        addresses?: { street?: string; city?: string; state?: string; postalCode?: string; country?: string; label?: string }[];
        phones?: { value: string; label?: string }[];
        emails?: { value: string; label?: string }[];
        contacts?: { firstName?: string; lastName?: string; email?: string; phone?: string; role?: string }[];
        salesPerson?: string;
        description?: string;
        website?: string;
        facebookPage?: string;
        industry?: string;
        forecastedAmount?: number;
        defaultPaymentMethod?: string;
        defaultShippingTerms?: string;
        contactStatus?: string;
        contactType?: string;
        billing?: {
            nameOnCard?: string;
            ccNumber?: string;
            expirationDate?: string;
            securityCode?: string;
            zipCode?: string;
        };
    } | string;
    salesRep: string;
    paymentMethod: string;
    orderStatus: string;
    createdAt: string;
    shippedDate?: string;
    shippingMethod?: string;
    trackingNumber?: string;
    shippingCost?: number;
    tax?: number;
    discount?: number;
    shippingAddress?: string;
    city?: string;
    state?: string;
    lineItems?: LineItem[];
    payments?: Payment[];
    notes?: Note[];
}

const PAYMENT_METHODS = [
    { label: 'Cash', value: 'Cash' },
    { label: 'Credit Card', value: 'Credit Card' },
    { label: 'Check By Mail', value: 'Check By Mail' },
    { label: 'ACH', value: 'ACH' },
    { label: 'Nothing Due', value: 'Nothing Due' },
    { label: 'CC#', value: 'CC#' },
    { label: 'Mobile Check Deposit', value: 'Mobile Check Deposit' },
    { label: 'Auth Payment Link', value: 'Auth Payment Link' },
    { label: 'COD Check', value: 'COD Check' },
    { label: 'COD', value: 'COD' },
    { label: 'Consignment', value: 'Consignment' },
    { label: 'Net Terms', value: 'Net Terms' }
];

const SHIPPING_METHODS = [
    { label: 'FedEx', value: 'FedEx' },
    { label: 'UPS', value: 'UPS' },
    { label: 'USPS', value: 'USPS' },
    { label: 'DHL', value: 'DHL' },
    { label: 'Pickup', value: 'Pickup' },
    { label: 'LTL Freight', value: 'LTL Freight' },
    { label: 'Courier', value: 'Courier' }
];

const UOM_OPTIONS = [
    { label: 'Each', value: 'Each' },
    { label: 'Box', value: 'Box' },
    { label: 'Case', value: 'Case' },
    { label: 'Pack', value: 'Pack' },
    { label: 'Pair', value: 'Pair' },
    { label: 'Set', value: 'Set' },
    { label: 'Kg', value: 'Kg' },
    { label: 'Lb', value: 'Lb' },
];

const TABS = ['Line Items', 'Payments', 'Notes', 'Emails'] as const;
type TabType = typeof TABS[number];

// Tab slug <-> display name mapping
const ORDER_TAB_SLUGS: Record<string, TabType> = {
    'line-items': 'Line Items', payments: 'Payments', notes: 'Notes', emails: 'Emails',
};
const ORDER_TAB_TO_SLUG: Record<string, string> = {
    'Line Items': 'line-items', Payments: 'payments', Notes: 'notes', Emails: 'emails',
};

export default function SaleOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();

    // Derive active tab from URL — default to 'Line Items'
    const tabSegment = params.tab;
    const tabSlug = Array.isArray(tabSegment) ? tabSegment[0] : tabSegment;
    const activeTab: TabType = (tabSlug && ORDER_TAB_SLUGS[tabSlug]) || 'Line Items';

    const setActiveTab = (tabId: TabType) => {
        const slug = ORDER_TAB_TO_SLUG[tabId] || 'line-items';
        router.replace(`/sales/wholesale-orders/${params.id}/${slug}`, { scroll: false });
    };

    const [order, setOrder] = useState<SaleOrder | null>(null);
    const [loading, setLoading] = useState(true);

    // Item Modal State
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [allSkus, setAllSkus] = useState<{ _id: string; name: string, salePrice?: number }[]>([]);

    // Lot Selection State
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [editingLotItemId, setEditingLotItemId] = useState<string | null>(null);
    const [editingSkuId, setEditingSkuId] = useState<string | null>(null);

    // Payment Modal State
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<any>(null);

    // Item Lot Selection State (Nested Modal)
    const [isItemLotModalOpen, setIsItemLotModalOpen] = useState(false);

    // Refresh Costs State
    const [isRefreshingCosts, setIsRefreshingCosts] = useState(false);
    const [refreshProgress, setRefreshProgress] = useState('');

    // Edit Header Modal State
    const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
    const [editingHeader, setEditingHeader] = useState<any>(null);

    // Note Modal State
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [newNoteText, setNewNoteText] = useState('');

    // Delete Order State
    const [isDeleting, setIsDeleting] = useState(false);

    // PDF Download State
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    // Status dropdown
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

    // Billing visibility state
    const [showBillingDetails, setShowBillingDetails] = useState(false);
    const [billingPasswordModal, setBillingPasswordModal] = useState(false);
    const [billingPassword, setBillingPassword] = useState('');
    const [billingPasswordError, setBillingPasswordError] = useState('');
    const billingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleDownloadPdf = async () => {
        if (downloadingPdf || !order) return;
        setDownloadingPdf(true);
        try {
            const res = await fetch(`/api/wholesale/orders/${order._id}/pdf`);
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || `Failed (${res.status})`);
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${order.label || 'SaleOrder'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('PDF downloaded');
        } catch (e: any) {
            console.error('PDF download error:', e);
            toast.error(e.message || 'Failed to download PDF');
        } finally {
            setDownloadingPdf(false);
        }
    };

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/wholesale/orders/${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setOrder(data);
            } else {
                toast.error('Failed to fetch order');
            }
        } catch (e) {
            toast.error('Error loading order');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (params.id) fetchOrder();
    }, [params.id]);

    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);
    useEffect(() => {
        // Find the portal target after mount
        const target = document.getElementById('header-portal-target');
        if (target) setHeaderPortal(target);
    }, [loading]); // Retry when loading changes or on mount

    useEffect(() => {
        fetch('/api/skus?limit=5000')
            .then(res => res.json())
            .then(data => setAllSkus(data.skus || []))
            .catch(() => { });
    }, []);

    // Fetch users for name lookup
    const [allUsers, setAllUsers] = useState<{ _id: string; email: string; firstName?: string; lastName?: string }[]>([]);
    useEffect(() => {
        fetch('/api/users?limit=1000')
            .then(res => res.json())
            .then(data => setAllUsers(data.users || []))
            .catch(() => { });
    }, []);

    // Helper to get user name from email
    const getUserName = (emailOrId: string) => {
        if (!emailOrId) return '-';
        const user = allUsers.find(u => u.email === emailOrId || u._id === emailOrId);
        if (user && (user.firstName || user.lastName)) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim();
        }
        return emailOrId;
    };

    // Calculations
    const totalQty = order?.lineItems?.reduce((sum, item) => sum + (item.qtyShipped || 0), 0) || 0;
    const subtotal = order?.lineItems?.reduce((sum, item) => sum + ((item.qtyShipped || 0) * (item.price || 0)), 0) || 0;
    const grandTotal = subtotal + (order?.shippingCost || 0) + (order?.tax || 0) - (order?.discount || 0);
    const totalPayments = order?.payments?.reduce((sum, p) => sum + (p.paymentAmount || 0), 0) || 0;
    const balance = grandTotal - totalPayments;




    const formatCurrency = (val?: number) => {
        if (val === undefined || val === null) return '-';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    };

    const formatCost = (val?: number) => {
        if (val === undefined || val === null) return '-';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const renderClient = (val: any) => {
        if (typeof val === 'object' && val !== null) return val.name;
        return val || '-';
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
                setBillingPasswordModal(false);
                setBillingPassword('');
                setBillingPasswordError('');
                setShowBillingDetails(true);
                toast.success('Verification successful');
                if (billingTimeoutRef.current) {
                    clearTimeout(billingTimeoutRef.current);
                }
                billingTimeoutRef.current = setTimeout(() => {
                    setShowBillingDetails(false);
                    toast('Billing details hidden for security', { icon: '🔒' });
                }, 60000);
            } else {
                const data = await res.json();
                setBillingPasswordError(data.error || 'Invalid password');
            }
        } catch (error) {
            console.error('Password verification error:', error);
            setBillingPasswordError('Failed to verify password');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Completed': return "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30";
            case 'Issued': return "bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/30";
            case 'Pending Payment': return "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30";
            case 'Pending': return "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border-orange-500/30";
            case 'Shipping': return "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border-violet-500/30";
            case 'Picking': return "bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/30";
            default: return "bg-secondary text-muted-foreground border-border";
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;
        // Optimistic: update UI instantly
        const previousOrder = { ...order };
        setOrder({ ...order, orderStatus: newStatus });
        toast.success('Status updated');

        // Background: persist to server
        fetch(`/api/wholesale/orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderStatus: newStatus })
        }).then(res => {
            if (res.ok) {
                res.json().then(data => setOrder(data));
            } else {
                setOrder(previousOrder);
                toast.error('Failed to update status — reverted');
            }
        }).catch(() => {
            setOrder(previousOrder);
            toast.error('Failed to update status — reverted');
        });
    };

    // Item Handlers — Optimistic UI
    const handleSaveItem = async () => {
        if (!order || !editingItem) return;

        const isEdit = !!editingItem._id;
        let updatedItems;
        if (isEdit) {
            updatedItems = order.lineItems?.map(item =>
                item._id === editingItem._id ? editingItem : item
            ) || [];
        } else {
            updatedItems = [...(order.lineItems || []), { ...editingItem, _id: `temp-${Date.now()}` }];
        }

        // Optimistic: update UI and close modal instantly
        const previousOrder = { ...order, lineItems: order.lineItems ? [...order.lineItems] : [] };
        setOrder({ ...order, lineItems: updatedItems });
        setIsItemModalOpen(false);
        toast.success(isEdit ? 'Item updated' : 'Item added');

        // Background: persist to server
        const payload = {
            lineItems: updatedItems.map(i => ({
                ...i,
                sku: (typeof i.sku === 'object' && i.sku !== null) ? i.sku._id : i.sku
            }))
        };

        fetch(`/api/wholesale/orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(res => {
            if (res.ok) {
                res.json().then(data => setOrder(data));
            } else {
                setOrder(previousOrder);
                toast.error('Failed to save item — reverted');
            }
        }).catch(() => {
            setOrder(previousOrder);
            toast.error('Failed to save item — reverted');
        });
    };

    const handleDeleteItem = async (itemId: string) => {
        if (!order) return;
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this item?</p>
                <p className="text-xs text-gray-400">This action cannot be undone.</p>
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            toast.dismiss(t.id);

                            // Optimistic: immediately remove item from UI
                            const previousOrder = { ...order };
                            const optimisticLineItems = order.lineItems?.filter(i => i._id !== itemId) || [];
                            setOrder({ ...order, lineItems: optimisticLineItems });
                            toast.success('Item deleted');

                            // Background: persist to server
                            const updatedItems = optimisticLineItems.map(i => ({
                                ...i,
                                sku: (typeof i.sku === 'object' && i.sku !== null) ? i.sku._id : i.sku
                            }));
                            fetch(`/api/wholesale/orders/${order._id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ lineItems: updatedItems })
                            }).then(res => {
                                if (res.ok) {
                                    res.json().then(data => setOrder(data));
                                } else {
                                    // Revert on failure
                                    setOrder(previousOrder);
                                    toast.error('Failed to delete item — reverted');
                                }
                            }).catch(() => {
                                // Revert on network error
                                setOrder(previousOrder);
                                toast.error('Failed to delete item — reverted');
                            });
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
    };

    // Lot Selection
    const handleEditLot = (itemId: string, skuId: string) => {
        setEditingLotItemId(itemId);
        setEditingSkuId(skuId);
        setIsLotModalOpen(true);
    };

    const handleLotSelect = async (lotNumber: string, cost?: number) => {
        if (!order || !editingLotItemId) return;

        // Optimistic: update in UI with sku objects preserved for display
        const previousOrder = { ...order, lineItems: order.lineItems ? [...order.lineItems] : [] };
        const optimisticItems = order.lineItems?.map(item =>
            item._id === editingLotItemId
                ? { ...item, lotNumber, cost: cost || 0 }
                : item
        ) || [];
        setOrder({ ...order, lineItems: optimisticItems });
        setIsLotModalOpen(false);
        toast.success('Lot updated');

        // Background: persist with flat sku IDs
        const payloadItems = order.lineItems?.map(item =>
            item._id === editingLotItemId
                ? { ...item, lotNumber, cost: cost || 0, sku: (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku }
                : { ...item, sku: (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku }
        ) || [];

        fetch(`/api/wholesale/orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineItems: payloadItems })
        }).then(res => {
            if (res.ok) {
                res.json().then(data => setOrder(data));
            } else {
                setOrder(previousOrder);
                toast.error('Failed to update lot — reverted');
            }
        }).catch(() => {
            setOrder(previousOrder);
            toast.error('Failed to update lot — reverted');
        });
    };

    // Payment Handlers — Optimistic UI
    const handleSavePayment = async () => {
        if (!order || !editingPayment) return;

        const isEdit = !!editingPayment._id;
        let updatedPayments;
        if (isEdit) {
            updatedPayments = order.payments?.map(p => p._id === editingPayment._id ? editingPayment : p) || [];
        } else {
            const newPayment = {
                ...editingPayment,
                _id: `temp-${Date.now()}`,
                orderNumber: order.label,
                createdBy: session?.user?.email || '',
                createdAt: editingPayment.createdAt || new Date().toISOString().split('T')[0]
            };
            updatedPayments = [...(order.payments || []), newPayment];
        }

        // Optimistic: update UI and close modal instantly
        const previousOrder = { ...order, payments: order.payments ? [...order.payments] : [] };
        setOrder({ ...order, payments: updatedPayments });
        setIsPaymentModalOpen(false);
        toast.success(isEdit ? 'Payment updated' : 'Payment added');

        // Background: persist to server
        fetch(`/api/wholesale/orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payments: updatedPayments })
        }).then(res => {
            if (res.ok) {
                res.json().then(data => setOrder(data));
            } else {
                setOrder(previousOrder);
                toast.error('Failed to save payment — reverted');
            }
        }).catch(() => {
            setOrder(previousOrder);
            toast.error('Failed to save payment — reverted');
        });
    };

    const handleDeletePayment = async (paymentId: string) => {
        if (!order) return;
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this payment?</p>
                <p className="text-xs text-gray-400">This action cannot be undone.</p>
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            const updatedPayments = order.payments?.filter(p => p._id !== paymentId) || [];
                            try {
                                const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ payments: updatedPayments })
                                });
                                if (res.ok) {
                                    const data = await res.json();
                                    setOrder(data);
                                    toast.success('Payment deleted');
                                }
                            } catch (e) {
                                toast.error('Failed to delete');
                            }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
    };

    const handleSaveHeader = async () => {
        if (!order || !editingHeader) return;

        // Optimistic: update UI and close modal instantly
        const previousOrder = { ...order };
        setOrder({ ...order, ...editingHeader });
        setIsHeaderModalOpen(false);
        toast.success('Order details updated');

        // Background: persist to server
        fetch(`/api/wholesale/orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingHeader)
        }).then(res => {
            if (res.ok) {
                res.json().then(data => setOrder(data));
            } else {
                setOrder(previousOrder);
                toast.error('Failed to update order — reverted');
            }
        }).catch(() => {
            setOrder(previousOrder);
            toast.error('Failed to update order — reverted');
        });
    };

    const handleRefreshCosts = async () => {
        if (!order || !order.lineItems || order.lineItems.length === 0) return;

        setIsRefreshingCosts(true);
        setRefreshProgress('Preparing...');

        const updatedItems = [...order.lineItems];
        let changedCount = 0;

        for (let i = 0; i < updatedItems.length; i++) {
            const item = updatedItems[i];
            const skuId = (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku;

            if (skuId && item.lotNumber) {
                setRefreshProgress(`Fetching Lot ${item.lotNumber}... ${Math.round(((i + 1) / updatedItems.length) * 100)}%`);
                try {
                    // Use the same API as the Lot Selection Modal to ensure consistency
                    const res = await fetch(`/api/warehouse/skus/${skuId}/lots`);

                    if (res.ok) {
                        const data = await res.json();
                        const matchedLot = data.lots?.find((l: any) => l.lotNumber === item.lotNumber);

                        if (matchedLot && matchedLot.cost !== undefined) {
                            // Update cost. Note: We only update cost, price remains as is unless you want to update price too?
                            // User request: "refresh all costs ... showing what is happening"
                            // Assuming they want to update the internal 'cost' tracking, not necessarily the sales 'price'.
                            // However, the previous logic updated 'cost'.
                            const currentCost = item.cost || 0;
                            if (currentCost !== matchedLot.cost) {
                                updatedItems[i] = { ...item, cost: matchedLot.cost };
                                changedCount++;
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch cost for item", i, error);
                }
            }
        }

        // Save changes to backend
        if (changedCount > 0) {
            setRefreshProgress('Saving changes...');
            try {
                const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lineItems: updatedItems.map(i => ({
                            ...i,
                            sku: (typeof i.sku === 'object' && i.sku !== null) ? i.sku._id : i.sku
                        }))
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    setOrder(data);
                    toast.success(`Updated costs for ${changedCount} items`);
                } else {
                    toast.error("Failed to save updated costs");
                }
            } catch (e) {
                toast.error("Error saving updated costs");
            }
        } else {
            toast('No costs needed updating');
        }

        setIsRefreshingCosts(false);
        setRefreshProgress('');
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Order not found</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
            {/* Header Portal Content */}
            {headerPortal && order && createPortal(
                <>
                    {/* Spacer (no back button) */}
                    <div />
                </>,
                headerPortal
            )}

            {/* Removed inline Header Row */}

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Details (30%) */}
                <div className="w-[30%] border-r border-border bg-background flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto scrollbar-custom">
                        {/* Hero Bar: Order# | Client | Status */}
                        <div className="px-4 pt-4 pb-4">
                            <div className="flex items-stretch border border-border overflow-hidden h-[34px]">
                                {/* Order # */}
                                <div
                                    className="w-20 bg-amber-500 flex items-center justify-center shrink-0 cursor-pointer hover:bg-amber-600 transition-colors"
                                    onClick={handleDownloadPdf}
                                    title="Download PDF Invoice"
                                >
                                    {downloadingPdf ? (
                                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                                    ) : (
                                        <span className="text-sm font-black text-white font-mono">{order.label}</span>
                                    )}
                                </div>
                                {/* Client Name */}
                                <button
                                    onClick={() => {
                                        const clientId = typeof order.clientId === 'object' && order.clientId ? order.clientId._id : null;
                                        if (clientId) router.push(`/crm/clients/${clientId}`);
                                    }}
                                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center px-3 min-w-0 cursor-pointer"
                                >
                                    <span className="text-sm font-black text-white leading-tight text-center line-clamp-2">{renderClient(order.clientId)}</span>
                                </button>
                            </div>
                        </div>

                        {/* Status Button */}
                        <div className="mx-4 mb-4">
                            <div className="relative">
                                <button
                                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                                    className={cn(
                                        "w-full h-[34px] px-3 text-[12px] flex items-center justify-center font-black uppercase tracking-widest cursor-pointer transition-all border",
                                        order.orderStatus === 'Completed' ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600" :
                                            order.orderStatus === 'Issued' ? "bg-sky-500 text-white border-sky-600 hover:bg-sky-600" :
                                                order.orderStatus === 'Pending Payment' ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" :
                                                    order.orderStatus === 'Shipping' ? "bg-violet-500 text-white border-violet-600 hover:bg-violet-600" :
                                                        order.orderStatus === 'Picking' ? "bg-cyan-500 text-white border-cyan-600 hover:bg-cyan-600" :
                                                            order.orderStatus === 'Pending' ? "bg-orange-500 text-white border-orange-600 hover:bg-orange-600" :
                                                                "bg-secondary text-muted-foreground border-border hover:bg-secondary/80"
                                    )}
                                >
                                    {order.orderStatus}
                                </button>
                                {statusDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-xl z-30 overflow-hidden">
                                        {['Pending', 'Picking', 'Shipping', 'Issued', 'Pending Payment', 'Completed'].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => { handleStatusChange(s); setStatusDropdownOpen(false); }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2.5 text-[12px] font-bold uppercase tracking-wider transition-colors flex items-center justify-between cursor-pointer",
                                                    s === 'Completed' ? "text-emerald-500 hover:bg-emerald-500/10" :
                                                        s === 'Issued' ? "text-sky-500 hover:bg-sky-500/10" :
                                                            s === 'Pending Payment' ? "text-amber-500 hover:bg-amber-500/10" :
                                                                s === 'Shipping' ? "text-violet-500 hover:bg-violet-500/10" :
                                                                    s === 'Picking' ? "text-cyan-500 hover:bg-cyan-500/10" :
                                                                        "text-orange-500 hover:bg-secondary",
                                                    order.orderStatus === s && "bg-secondary"
                                                )}
                                            >
                                                <span>{s}</span>
                                                {order.orderStatus === s && <span className="text-[10px]">✓</span>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Info Grid */}
                        <div className="mx-4 mb-4 border border-border">
                            {[
                                [
                                    { label: 'Order Date', value: formatDate(order.createdAt) },
                                    { label: 'Shipped Date', value: formatDate(order.shippedDate) },
                                ],
                                [
                                    { label: 'Payment Method', value: order.paymentMethod || '-' },
                                    { label: 'Ship Via', value: order.shippingMethod || '-' },
                                ],
                                [
                                    { label: 'Sales Rep', value: getUserName(order.salesRep) },
                                ],
                            ].map((row, rowIdx) => (
                                <div key={rowIdx} className={cn(
                                    row.length === 2 ? "grid grid-cols-2 divide-x divide-border" : "",
                                    rowIdx % 2 === 0 ? "bg-background" : "bg-secondary/50",
                                    rowIdx > 0 && "border-t border-border"
                                )}>
                                    {row.map((item, colIdx) => (
                                        <div key={colIdx} className="px-4 py-3 flex flex-col gap-0.5">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                            <span className="text-sm font-bold text-foreground truncate">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* Tracking */}
                        {order.trackingNumber ? (
                            <div className="mx-4 mb-4">
                                <a
                                    href={order.trackingNumber.startsWith('http')
                                        ? order.trackingNumber
                                        : `https://www.ups.com/track?loc=en_US&tracknum=${order.trackingNumber}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group"
                                >
                                    <div className="border border-border bg-secondary/30 p-3 hover:border-amber-500/50 hover:shadow-sm transition-all cursor-pointer">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center space-x-2">
                                                <div className="w-5 h-5 bg-[#FFB500] rounded flex items-center justify-center shrink-0">
                                                    <Truck className="w-3 h-3 text-[#351C15]" />
                                                </div>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">UPS Tracking</span>
                                            </div>
                                            <svg className="w-3 h-3 text-muted-foreground group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                        </div>
                                        <div className="font-mono text-[11px] font-bold text-foreground tracking-wide break-all">
                                            {order.trackingNumber.startsWith('http')
                                                ? (() => { try { return new URL(order.trackingNumber).searchParams.get('tracknum') || order.trackingNumber; } catch { return order.trackingNumber; } })()
                                                : order.trackingNumber}
                                        </div>
                                    </div>
                                </a>
                            </div>
                        ) : null}

                        {/* Shipping Address */}
                        {(order.shippingAddress || order.city || order.state) && (
                            <div className="mx-4 mb-4 border border-border">
                                <div className="px-4 py-3 bg-secondary/50 flex flex-col gap-0.5">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Shipping Address</span>
                                    <span className="text-sm font-bold text-foreground">{order.shippingAddress || '-'}</span>
                                    <span className="text-xs text-muted-foreground">{[order.city, order.state].filter(Boolean).join(', ')}</span>
                                </div>
                            </div>
                        )}

                        {/* Payment Summary */}
                        <div className="mx-4 mb-4">
                            <div className="text-xs font-black uppercase tracking-widest text-foreground mb-4">Payment Summary</div>
                            <div className="space-y-3">
                                {[
                                    { label: 'Subtotal', value: subtotal, color: null },
                                    { label: 'Shipping', value: order.shippingCost || 0, color: null },
                                    { label: 'Discount', value: -(order.discount || 0), color: 'text-red-500' },
                                    { label: 'Tax', value: order.tax || 0, color: null },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group">
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors font-medium">{item.label}</span>
                                        <span className={cn("text-sm font-mono font-bold", item.color || "text-foreground")}>
                                            {item.value < 0 ? '-' : ''}{formatCurrency(Math.abs(item.value))}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 pt-4 border-t border-border space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-foreground font-bold">Order Total</span>
                                    <span className="text-sm font-mono font-bold text-foreground">{formatCurrency(grandTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground font-medium italic">Payments Received</span>
                                    <span className="text-sm font-mono font-bold text-emerald-500 italic">{formatCurrency(totalPayments)}</span>
                                </div>
                                <div className={cn(
                                    "flex justify-between items-center px-4 h-[34px] border shadow-sm",
                                    balance > 0 ? "bg-red-500 border-red-600" : "bg-emerald-600 border-emerald-700"
                                )}>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Balance</span>
                                    <span className="text-lg font-mono font-black text-white">{formatCurrency(balance)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Client Details */}
                        {typeof order.clientId === 'object' && order.clientId && (() => {
                            const c = order.clientId;
                            return (
                                <div className="mx-4 mb-4">
                                    <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Client Info</div>
                                    <div className="border border-border">
                                        {[
                                            { label: 'Name', value: c.name, link: `/crm/clients/${c._id}` },
                                            { label: 'Address', value: c.addresses?.[0]?.street || '-' },
                                            { label: 'City', value: c.addresses?.[0]?.city || '-' },
                                            { label: 'State', value: c.addresses?.[0]?.state || '-' },
                                            { label: 'Postal Code', value: c.addresses?.[0]?.postalCode || '-' },
                                        ].map((item, idx) => (
                                            <div key={idx} className={cn(
                                                "px-4 py-2.5 flex items-center justify-between",
                                                idx % 2 === 0 ? "bg-background" : "bg-secondary/50",
                                                idx > 0 && "border-t border-border"
                                            )}>
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                                {item.link ? (
                                                    <Link href={item.link} className="text-sm font-bold text-foreground hover:text-primary transition-colors">{item.value}</Link>
                                                ) : (
                                                    <span className="text-sm font-bold text-foreground">{item.value}</span>
                                                )}
                                            </div>
                                        ))}
                                        {/* Phone row */}
                                        <div className={cn("px-4 py-2.5 flex items-center justify-between border-t border-border bg-background")}>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Phone</span>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-bold text-foreground">
                                                    {c.phones?.[0]?.value || <span className="text-muted-foreground italic font-normal text-xs">None</span>}
                                                </span>
                                                {c.phones?.[0]?.value && (
                                                    <a href={`tel:${c.phones[0].value}`} className="p-1 rounded hover:bg-blue-500/10 text-blue-500 transition-colors" title="Call">
                                                        <Phone className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        {/* Email row */}
                                        <div className="px-4 py-2.5 flex items-center justify-between border-t border-border bg-secondary/50">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Email</span>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm font-bold text-foreground truncate max-w-[160px]">
                                                    {c.emails?.[0]?.value || <span className="text-muted-foreground italic font-normal text-xs">None</span>}
                                                </span>
                                                {c.emails?.[0]?.value && (
                                                    <a href={`mailto:${c.emails[0].value}`} className="p-1 rounded hover:bg-purple-500/10 text-purple-500 transition-colors" title="Email">
                                                        <Mail className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contacts */}
                                    {c.contacts && c.contacts.length > 0 && (
                                        <div className="mt-4">
                                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 pb-1 border-b border-border">Contacts</div>
                                            <table className="w-full text-[10px]">
                                                <thead>
                                                    <tr className="border-b border-border">
                                                        <th className="text-left py-1.5 px-1 font-bold text-muted-foreground uppercase tracking-wider">Name</th>
                                                        <th className="text-center py-1.5 px-1 font-bold text-muted-foreground uppercase tracking-wider">📞</th>
                                                        <th className="text-center py-1.5 px-1 font-bold text-muted-foreground uppercase tracking-wider">✉️</th>
                                                        <th className="text-left py-1.5 px-1 font-bold text-muted-foreground uppercase tracking-wider">Role</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {c.contacts.map((ct, idx) => (
                                                        <tr key={idx} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                                                            <td className="py-1.5 px-1 text-foreground font-bold whitespace-nowrap">{[ct.firstName, ct.lastName].filter(Boolean).join(' ') || '-'}</td>
                                                            <td className="py-1.5 px-1 text-center">
                                                                {ct.phone ? (
                                                                    <a href={`tel:${ct.phone}`} className="p-0.5 rounded hover:bg-blue-500/10 text-blue-500 transition-colors inline-flex" title={ct.phone}>
                                                                        <Phone className="w-3 h-3" />
                                                                    </a>
                                                                ) : <span className="text-muted-foreground">-</span>}
                                                            </td>
                                                            <td className="py-1.5 px-1 text-center">
                                                                {ct.email ? (
                                                                    <a href={`mailto:${ct.email}`} className="p-0.5 rounded hover:bg-purple-500/10 text-purple-500 transition-colors inline-flex" title={ct.email}>
                                                                        <Mail className="w-3 h-3" />
                                                                    </a>
                                                                ) : <span className="text-muted-foreground">-</span>}
                                                            </td>
                                                            <td className="py-1.5 px-1 text-foreground font-bold whitespace-nowrap">{ct.role || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {/* Business Info */}
                                    <div className="mt-4">
                                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pb-1 border-b border-border mb-1">Business Details</div>
                                        <div className="border border-border mt-2">
                                            {c.description && (
                                                <p className="text-[11px] text-foreground leading-relaxed italic px-4 py-2.5 bg-background border-b border-border">{c.description}</p>
                                            )}
                                            {[
                                                ...(c.website ? [{ label: 'Website', value: c.website, isLink: true }] : []),
                                                { label: 'Industry', value: c.industry || '-' },
                                                { label: 'Payment Terms', value: c.defaultPaymentMethod || '-' },
                                                { label: 'Shipping Terms', value: c.defaultShippingTerms || '-' },
                                            ].map((item, idx) => (
                                                <div key={idx} className={cn(
                                                    "px-4 py-2.5 flex items-center justify-between",
                                                    idx % 2 === 0 ? "bg-secondary/50" : "bg-background",
                                                    idx > 0 && "border-t border-border"
                                                )}>
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                                    {(item as any).isLink ? (
                                                        <a href={(item.value as string).startsWith('http') ? item.value : `https://${item.value}`} target="_blank" className="text-sm font-bold text-blue-500 truncate max-w-[160px] hover:underline">{item.value}</a>
                                                    ) : (
                                                        <span className="text-sm font-bold text-foreground">{item.value}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Credit Card */}
                                    {c.billing && (c.billing.ccNumber || c.billing.nameOnCard) && (() => {
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
                                        const ct = getCardType(c.billing.ccNumber || '');
                                        const theme = getCardTheme(ct);
                                        return (
                                            <div className="mt-4">
                                                <div className={cn("p-4 rounded-sm space-y-3 shadow-inner bg-gradient-to-br transition-all duration-500", theme)}>
                                                    <div className="flex items-center justify-between">
                                                        <div className="w-8 h-5.5 bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 rounded-sm relative overflow-hidden shadow-inner flex shrink-0">
                                                            <div className="absolute inset-0 border-[0.5px] border-black/10"></div>
                                                            <div className="absolute top-1/2 left-0 w-full h-[0.5px] bg-black/20"></div>
                                                            <div className="absolute top-0 left-1/2 w-[0.5px] h-full bg-black/20"></div>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            {ct && (
                                                                <div className="text-[9px] text-white/50 uppercase font-black tracking-widest">{ct}</div>
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
                                                                ? (c.billing.ccNumber || '•••• •••• •••• ••••')
                                                                : '•••• •••• •••• ••••'
                                                            }
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-end">
                                                        <div className="space-y-1">
                                                            <div className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Card Holder</div>
                                                            <div className="text-[9px] text-white font-bold uppercase tracking-wider truncate max-w-[100px]">
                                                                {c.billing.nameOnCard || '-'}
                                                            </div>
                                                        </div>
                                                        <div className="flex space-x-3">
                                                            <div className="space-y-1">
                                                                <div className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Expires</div>
                                                                <div className="text-[9px] text-white font-mono">{c.billing.expirationDate || '••/••'}</div>
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="text-[7px] text-white/40 uppercase font-black tracking-tighter">CVV</div>
                                                                <div className="text-[9px] text-white font-mono">
                                                                    {showBillingDetails
                                                                        ? (c.billing.securityCode || '•••')
                                                                        : '•••'
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        <button
                            onClick={() => {
                                setEditingHeader({
                                    salesRep: typeof order.salesRep === 'object' && order.salesRep ? (order.salesRep as any)._id : order.salesRep,
                                    orderStatus: order.orderStatus,
                                    paymentMethod: order.paymentMethod,
                                    shippingMethod: order.shippingMethod,
                                    trackingNumber: order.trackingNumber,
                                    shippingCost: order.shippingCost,
                                    discount: order.discount,
                                    tax: order.tax,
                                    shippedDate: toDateInputValue(order.shippedDate),
                                    shippingAddress: order.shippingAddress,
                                    city: order.city,
                                    state: order.state
                                });
                                setIsHeaderModalOpen(true);
                            }}
                            className="h-[34px] flex-1 flex items-center justify-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={() => {
                                toast((t) => (
                                    <div className="flex flex-col gap-2">
                                        <p className="text-sm font-bold text-white">Delete this order?</p>
                                        <p className="text-xs text-gray-400">This action cannot be undone.</p>
                                        <div className="flex gap-2 mt-1">
                                            <button
                                                onClick={() => toast.dismiss(t.id)}
                                                className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    toast.dismiss(t.id);
                                                    setIsDeleting(true);
                                                    try {
                                                        const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                                                            method: 'DELETE'
                                                        });
                                                        if (res.ok) {
                                                            toast.success('Order deleted');
                                                            router.push('/sales/wholesale-orders');
                                                        } else {
                                                            const data = await res.json();
                                                            toast.error(data.error || 'Failed to delete order');
                                                        }
                                                    } catch (e) {
                                                        toast.error('Error deleting order');
                                                    } finally {
                                                        setIsDeleting(false);
                                                    }
                                                }}
                                                className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
                            }}
                            disabled={isDeleting}
                            className="h-[34px] flex-1 flex items-center justify-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-widest bg-red-500 text-white border border-red-600 hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                        </button>
                    </div>
                </div>

                {/* Right Content: Tabs (70%) */}
                <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                    {/* Tabs & Actions */}
                    <div className="px-4 border-b border-border shrink-0 flex items-center justify-between bg-background z-10 h-9">
                        <div className="flex space-x-1 h-full">
                            {TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "px-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5",
                                        activeTab === tab
                                            ? "text-foreground border-foreground"
                                            : "text-muted-foreground border-transparent hover:text-foreground"
                                    )}
                                >
                                    <span>{tab}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-none text-[9px] font-bold",
                                        activeTab === tab
                                            ? tab === 'Emails' ? "bg-purple-600 text-white" : "bg-foreground text-background"
                                            : tab === 'Emails' ? "bg-purple-500/10 text-purple-500" : "bg-secondary text-muted-foreground"
                                    )}>
                                        {tab === 'Line Items' ? order.lineItems?.length || 0 : tab === 'Payments' ? order.payments?.length || 0 : tab === 'Emails' ? <Mail className="w-2.5 h-2.5" /> : order.notes?.length || 0}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center space-x-2">
                            {activeTab === 'Line Items' && (
                                <>
                                    <button
                                        onClick={() => {
                                            setEditingItem({ sku: '', lotNumber: '', qtyShipped: 1, price: 0, uom: 'Each' });
                                            setIsItemModalOpen(true);
                                        }}
                                        className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-[#fe9900] text-black hover:bg-[#d9a318] transition-colors flex items-center space-x-1 shadow-sm"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>Add Item</span>
                                    </button>
                                </>
                            )}
                            {activeTab === 'Payments' && (
                                <button
                                    onClick={() => {
                                        setEditingPayment({ paymentAmount: 0, createdAt: new Date().toISOString().split('T')[0], createdBy: '' });
                                        setIsPaymentModalOpen(true);
                                    }}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center space-x-1 shadow-sm"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Payment</span>
                                </button>
                            )}
                            {activeTab === 'Notes' && (
                                <button
                                    onClick={() => {
                                        setNewNoteText('');
                                        setIsNoteModalOpen(true);
                                    }}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center space-x-1 shadow-sm"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Note</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {activeTab === 'Line Items' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            {['SKU', 'Lot #', 'UOM', 'Qty', 'Cost', 'Price', 'Total', 'Actions'].map(col => (
                                                <th key={col} className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(!order.lineItems || order.lineItems.length === 0) ? (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">No line items</td>
                                            </tr>
                                        ) : order.lineItems.map(item => {
                                            const skuNameRaw = typeof item.sku === 'object' ? item.sku?.name : allSkus.find(s => s._id === item.sku)?.name || item.sku;
                                            const skuName = (skuNameRaw && skuNameRaw !== item.sku) ? skuNameRaw : (item.productDescription || skuNameRaw);
                                            const lineTotal = (item.qtyShipped || 0) * (item.price || 0);
                                            const skuId = (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku;

                                            return (
                                                <tr key={item._id} className="hover:bg-secondary/50 transition-colors">
                                                    <td className="px-3 py-2 text-xs font-bold text-foreground">
                                                        <span
                                                            onClick={() => router.push(`/warehouse/skus/${skuId}`)}
                                                            className="hover:text-blue-500 hover:underline cursor-pointer transition-colors"
                                                        >
                                                            {skuName || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-foreground group">
                                                        <div className="flex items-center gap-1">
                                                            {item.lotNumber ? (
                                                                <Link
                                                                    href={`/warehouse/skus/${skuId}?lot=${encodeURIComponent(item.lotNumber)}`}
                                                                    className="text-foreground font-mono font-bold hover:text-blue-500 hover:underline transition-colors"
                                                                >
                                                                    {item.lotNumber}
                                                                </Link>
                                                            ) : (
                                                                <span>-</span>
                                                            )}
                                                            <button
                                                                onClick={() => handleEditLot(item._id, skuId)}
                                                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500 transition-all p-0.5"
                                                                title="Edit Lot #"
                                                            >
                                                                <Pencil className="w-2.5 h-2.5" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-xs uppercase text-foreground font-bold">{item.uom || '-'}</td>
                                                    <td className="px-3 py-2 text-xs text-foreground font-mono font-bold">{item.qtyShipped}</td>
                                                    <td className="px-3 py-2 text-xs text-orange-500 font-mono font-bold whitespace-nowrap">{formatCost(item.cost)}</td>
                                                    <td className="px-3 py-2 text-xs text-foreground font-mono font-bold">{formatCurrency(item.price)}</td>
                                                    <td className="px-3 py-2 text-xs text-foreground font-mono font-black bg-secondary/20">{formatCurrency(lineTotal)}</td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex items-center space-x-1">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingItem({
                                                                        ...item,
                                                                        sku: skuId
                                                                    });
                                                                    setIsItemModalOpen(true);
                                                                }}
                                                                className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteItem(item._id)}
                                                                className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {order.lineItems && order.lineItems.length > 0 && (
                                        <tfoot className="bg-secondary border-t border-border">
                                            <tr>
                                                <td colSpan={3} className="px-3 py-2 text-xs font-black text-muted-foreground uppercase text-right">Subtotal</td>
                                                <td className="px-3 py-2 text-xs font-black text-foreground">{totalQty}</td>
                                                <td className="px-3 py-2"></td>
                                                <td className="px-3 py-2"></td>
                                                <td className="px-3 py-2 text-xs font-black text-foreground">{formatCurrency(subtotal)}</td>
                                                <td className="px-3 py-2"></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}

                        {activeTab === 'Payments' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            {['Date', 'Amount', 'Created By', 'Actions'].map(col => (
                                                <th key={col} className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(!order.payments || order.payments.length === 0) ? (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">No payments recorded</td>
                                            </tr>
                                        ) : order.payments.map(payment => (
                                            <tr key={payment._id} className="hover:bg-secondary/50 transition-colors">
                                                <td className="px-3 py-2 text-xs text-foreground font-mono font-bold">{formatDate(payment.createdAt)}</td>
                                                <td className="px-3 py-2 text-xs text-emerald-500 font-mono font-black">{formatCurrency(payment.paymentAmount)}</td>
                                                <td className="px-3 py-2 text-xs text-foreground font-bold">{getUserName(payment.createdBy)}</td>
                                                <td className="px-3 py-1.5">
                                                    <div className="flex items-center space-x-1">
                                                        <button
                                                            onClick={() => {
                                                                setEditingPayment({
                                                                    ...payment,
                                                                    createdAt: toDateInputValue(payment.createdAt)
                                                                });
                                                                setIsPaymentModalOpen(true);
                                                            }}
                                                            className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePayment(payment._id)}
                                                            className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    {order.payments && order.payments.length > 0 && (
                                        <tfoot className="bg-secondary border-t border-border">
                                            <tr>
                                                <td className="px-3 py-2 text-xs font-black text-muted-foreground uppercase">Total</td>
                                                <td className="px-3 py-2 text-xs font-black text-emerald-500">{formatCurrency(totalPayments)}</td>
                                                <td colSpan={2}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}

                        {activeTab === 'Notes' && (
                            <div className="animate-in fade-in duration-300 p-4 space-y-3">
                                {(!order.notes || order.notes.length === 0) ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No notes yet</p>
                                    </div>
                                ) : (
                                    order.notes.map(note => (
                                        <div key={note._id} className="border border-border rounded-md p-3 bg-secondary/20 hover:bg-secondary/40 transition-colors group">
                                            <div className="flex items-start justify-between">
                                                <p className="text-sm text-foreground whitespace-pre-wrap flex-1 font-medium">{note.note}</p>
                                                <button
                                                    onClick={() => {
                                                        toast((t) => (
                                                            <div className="flex flex-col gap-2">
                                                                <p className="text-sm font-bold text-white">Delete this note?</p>
                                                                <p className="text-xs text-gray-400">This action cannot be undone.</p>
                                                                <div className="flex gap-2 mt-1">
                                                                    <button
                                                                        onClick={() => toast.dismiss(t.id)}
                                                                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        onClick={async () => {
                                                                            toast.dismiss(t.id);
                                                                            try {
                                                                                const updatedNotes = order.notes?.filter(n => n._id !== note._id) || [];
                                                                                const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                                                                                    method: 'PATCH',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ notes: updatedNotes })
                                                                                });
                                                                                if (res.ok) {
                                                                                    const data = await res.json();
                                                                                    setOrder(data);
                                                                                    toast.success('Note deleted');
                                                                                }
                                                                            } catch (e) {
                                                                                toast.error('Failed to delete note');
                                                                            }
                                                                        }}
                                                                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                                                                    >
                                                                        Delete
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
                                                    }}
                                                    className="p-1 text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="flex items-center space-x-3 mt-2 pt-2 border-t border-border/50">
                                                <span className="text-[10px] text-muted-foreground font-mono font-bold">{note.createdAt ? formatDate(note.createdAt) : '-'}</span>
                                                <span className="text-[10px] text-muted-foreground font-bold">{getUserName(note.createdBy)}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'Emails' && (
                            <OrderEmailsTab
                                orderId={order._id}
                                orderLabel={order.label}
                                client={typeof order.clientId === 'object' && order.clientId ? order.clientId as any : null}
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Item Modal */}
            {isItemModalOpen && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-card rounded-lg shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 flex flex-col">
                        {/* Header - matches main header height */}
                        <div className="flex items-center justify-between px-4 h-[48px] border-b border-border bg-secondary/50 shrink-0 rounded-t-lg">
                            <h2 className="text-sm font-bold uppercase text-foreground tracking-wider">{editingItem._id ? 'Edit Item' : 'Add Item'}</h2>
                            <button onClick={() => setIsItemModalOpen(false)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-3">
                            {/* SKU */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">SKU</label>
                                <div className="h-[44px]">
                                    <SearchableSelect
                                        className="h-full"
                                        options={(() => {
                                            const opts = allSkus.map(s => ({ value: s._id, label: s.name }));
                                            if (editingItem.sku && !allSkus.find(s => s._id === editingItem.sku)) {
                                                const label = editingItem.productDescription || editingItem.name || `Legacy: ${editingItem.sku}`;
                                                opts.push({ value: editingItem.sku, label });
                                            }
                                            return opts;
                                        })()}
                                        value={editingItem.sku}
                                        onChange={async (val) => {
                                            const sku = allSkus.find(s => s._id === val);
                                            setEditingItem((prev: any) => ({
                                                ...prev,
                                                sku: val,
                                                price: sku?.salePrice || prev.price,
                                                lotNumber: ''
                                            }));

                                            if (val) {
                                                try {
                                                    const res = await fetch(`/api/warehouse/skus/${val}/lots`);
                                                    if (res.ok) {
                                                        const data = await res.json();
                                                        const lots = data.lots || [];
                                                        const sorted = lots.sort((a: any, b: any) => {
                                                            const dateA = a.date ? new Date(a.date).getTime() : 0;
                                                            const dateB = b.date ? new Date(b.date).getTime() : 0;
                                                            return dateA - dateB;
                                                        });

                                                        const suggested = sorted.find((l: any) => l.balance > 0);

                                                        if (suggested) {
                                                            setEditingItem((prev: any) => ({
                                                                ...prev,
                                                                sku: val,
                                                                lotNumber: suggested.lotNumber,
                                                                cost: suggested.cost || 0
                                                            }));
                                                            toast.success(`Auto-selected Lot: ${suggested.lotNumber}`, { position: 'bottom-center', duration: 2000 });
                                                        }
                                                    }
                                                } catch (e) {
                                                    console.error("Auto-suggest lot failed", e);
                                                }
                                            }
                                        }}
                                        placeholder="Select SKU..."
                                    />
                                </div>
                            </div>

                            {/* Product Description */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Description</label>
                                <input
                                    type="text"
                                    value={editingItem.productDescription || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, productDescription: e.target.value })}
                                    className="w-full h-[44px] px-3 border border-border rounded-md text-sm focus:outline-none bg-background text-foreground"
                                    placeholder="Enter description..."
                                />
                            </div>

                            {/* Nested Lot Selection Modal for Item Modal */}
                            {isItemLotModalOpen && editingItem?.sku && (
                                <LotSelectionModal
                                    isOpen={isItemLotModalOpen}
                                    onClose={() => setIsItemLotModalOpen(false)}
                                    skuId={typeof editingItem.sku === 'object' ? editingItem.sku._id : editingItem.sku}
                                    currentLotNumber={editingItem.lotNumber}
                                    onSelect={(lotNumber, cost) => {
                                        setEditingItem((prev: any) => ({ ...prev, lotNumber, cost: cost || prev.cost }));
                                        setIsItemLotModalOpen(false);
                                    }}
                                    title="Select Lot Number"
                                />
                            )}

                            {/* Lot # */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Lot #</label>
                                <div className="relative h-[44px]">
                                    <input
                                        type="text"
                                        readOnly
                                        value={editingItem.lotNumber || ''}
                                        onClick={() => {
                                            if (editingItem.sku) setIsItemLotModalOpen(true);
                                            else toast.error('Please select a SKU first');
                                        }}
                                        className="w-full h-full px-3 border border-border rounded-md text-sm focus:outline-none cursor-pointer hover:bg-secondary bg-background"
                                        placeholder={editingItem.sku ? "Select Lot..." : "Select SKU first"}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                        <List className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>

                            {/* UOM */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">UOM</label>
                                <div className="h-[44px]">
                                    <SearchableSelect
                                        className="h-full"
                                        options={UOM_OPTIONS}
                                        value={editingItem.uom || 'Each'}
                                        onChange={(val) => setEditingItem({ ...editingItem, uom: val })}
                                        creatable
                                    />
                                </div>
                            </div>

                            {/* Qty + Price side by side */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editingItem.qtyShipped || 1}
                                        onChange={(e) => setEditingItem({ ...editingItem, qtyShipped: parseInt(e.target.value) || 0 })}
                                        className="w-full h-[44px] px-3 border border-border rounded-md text-sm focus:outline-none bg-background"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Price</label>
                                    <div className="relative h-[44px]">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editingItem.price || 0}
                                            onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                                            className="w-full h-full pl-6 pr-3 border border-border rounded-md text-sm focus:outline-none bg-background"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer - matches main header height */}
                        <div className="px-4 h-[48px] border-t border-border flex items-center shrink-0 rounded-b-lg">
                            <button onClick={handleSaveItem} className="w-full h-[36px] bg-foreground text-background text-xs font-bold uppercase tracking-wider rounded-md hover:opacity-90 transition-colors">
                                {editingItem._id ? 'Save Changes' : 'Add Item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {isPaymentModalOpen && editingPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-card rounded-lg shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-emerald-500/10">
                            <h2 className="text-sm font-bold uppercase text-foreground">{editingPayment._id ? 'Edit Payment' : 'Add Payment'}</h2>
                            <button onClick={() => setIsPaymentModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingPayment.paymentAmount || ''}
                                        onChange={(e) => setEditingPayment({ ...editingPayment, paymentAmount: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-7 pr-3 py-2 border border-border rounded text-sm focus:outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Date</label>
                                <input
                                    type="date"
                                    value={toDateInputValue(editingPayment.createdAt)}
                                    onChange={(e) => setEditingPayment({ ...editingPayment, createdAt: e.target.value })}
                                    className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none"
                                />
                            </div>
                            <button onClick={handleSavePayment} className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold uppercase rounded hover:bg-emerald-700 transition-colors">
                                {editingPayment._id ? 'Save Changes' : 'Add Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Header Modal */}
            {isHeaderModalOpen && editingHeader && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-card rounded-none shadow-2xl w-full max-w-4xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-6 border-b border-border bg-muted/50 shrink-0 h-9">
                            <h2 className="text-sm font-bold uppercase text-foreground">Edit Order Details</h2>
                            <button onClick={() => setIsHeaderModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 scrollbar-custom bg-background">
                            <div className="space-y-6">
                                {/* Order Details Section */}
                                <div>
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Order Details</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                                            <input
                                                type="date"
                                                value={toDateInputValue(editingHeader.createdAt)}
                                                onChange={(e) => setEditingHeader({ ...editingHeader, createdAt: e.target.value })}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Order Name/ID</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={order?.label || ''}
                                                className="w-full h-[34px] px-3 border border-border rounded-md text-sm bg-secondary/50 text-muted-foreground focus:outline-none cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Client</label>
                                            <input
                                                type="text"
                                                readOnly
                                                value={typeof order?.clientId === 'object' && order?.clientId ? (order.clientId as any).name : String(order?.clientId || '')}
                                                className="w-full h-[34px] px-3 border border-border rounded-md text-sm bg-secondary/50 text-muted-foreground focus:outline-none cursor-not-allowed"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Rep</label>
                                            <SearchableSelect
                                                options={allUsers.map(u => ({ label: `${u.firstName || ''} ${u.lastName || ''}`.trim(), value: u._id }))}
                                                value={editingHeader.salesRep}
                                                onChange={(val) => setEditingHeader({ ...editingHeader, salesRep: val })}
                                                placeholder="Select Rep..."
                                                className="w-full"
                                                triggerClassName="py-[6px] bg-card"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Method</label>
                                            <SearchableSelect
                                                options={PAYMENT_METHODS}
                                                value={editingHeader.paymentMethod}
                                                onChange={(val) => setEditingHeader({ ...editingHeader, paymentMethod: val })}
                                                placeholder="Select Method..."
                                                className="w-full"
                                                triggerClassName="py-[6px] bg-card"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Shipping Details Section */}
                                <div>
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Shipping Details</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Order Status</label>
                                            <select
                                                value={editingHeader.orderStatus}
                                                onChange={(e) => setEditingHeader({ ...editingHeader, orderStatus: e.target.value })}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="Completed">Completed</option>
                                                <option value="Issued">Issued</option>
                                                <option value="Pending Payment">Pending Payment</option>
                                                <option value="Shipping">Shipping</option>
                                                <option value="Picking">Picking</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipped Date</label>
                                            <input
                                                type="date"
                                                value={toDateInputValue(editingHeader.shippedDate)}
                                                onChange={(e) => setEditingHeader({ ...editingHeader, shippedDate: e.target.value })}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Method</label>
                                            <SearchableSelect
                                                options={SHIPPING_METHODS}
                                                value={editingHeader.shippingMethod}
                                                onChange={(val) => setEditingHeader({ ...editingHeader, shippingMethod: val })}
                                                placeholder="Select Method..."
                                                creatable
                                                className="w-full"
                                                triggerClassName="py-[6px] bg-card"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tracking Number</label>
                                            <input
                                                type="text"
                                                value={editingHeader.trackingNumber}
                                                onChange={(e) => setEditingHeader({ ...editingHeader, trackingNumber: e.target.value })}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                            />
                                        </div>

                                        {/* Address - Full Width */}
                                        <div className="col-span-2 md:col-span-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Address</label>
                                                <input
                                                    type="text"
                                                    value={editingHeader.shippingAddress}
                                                    onChange={(e) => setEditingHeader({ ...editingHeader, shippingAddress: e.target.value })}
                                                    className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                                    placeholder="Street Address, City, State, Zip"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">City</label>
                                                <input
                                                    type="text"
                                                    value={editingHeader.city}
                                                    onChange={(e) => setEditingHeader({ ...editingHeader, city: e.target.value })}
                                                    className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                                    placeholder="City"
                                                />
                                            </div>
                                        </div>
                                        <div className="col-span-1 md:col-span-2">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">State</label>
                                                <input
                                                    type="text"
                                                    value={editingHeader.state}
                                                    onChange={(e) => setEditingHeader({ ...editingHeader, state: e.target.value })}
                                                    className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                                    placeholder="State"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Costs Section */}
                                <div>
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Costs & Settings</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Cost ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editingHeader.shippingCost}
                                                onWheel={(e) => e.currentTarget.blur()}
                                                onChange={(e) => setEditingHeader({ ...editingHeader, shippingCost: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Discount ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editingHeader.discount}
                                                onWheel={(e) => e.currentTarget.blur()}
                                                onChange={(e) => setEditingHeader({ ...editingHeader, discount: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tax ($)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editingHeader.tax}
                                                onWheel={(e) => e.currentTarget.blur()}
                                                onChange={(e) => setEditingHeader({ ...editingHeader, tax: parseFloat(e.target.value) || 0 })}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                            />
                                        </div>
                                        <div className="space-y-1.5 flex flex-col justify-end">
                                            <label className="flex items-center space-x-2 h-[34px] cursor-pointer">
                                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">Lock Price</span>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={editingHeader.lockPrice || false}
                                                    onClick={() => setEditingHeader({ ...editingHeader, lockPrice: !editingHeader.lockPrice })}
                                                    className={`w-9 h-5 rounded-full transition-colors relative shadow-inner ${editingHeader.lockPrice ? 'bg-primary' : 'bg-primary/20'}`}
                                                >
                                                    <span className={`block w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5 left-0.5 shadow ${editingHeader.lockPrice ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-4 border-t border-border bg-muted/20 flex items-center justify-end shrink-0 h-9">
                            <button onClick={handleSaveHeader} className="px-6 py-1.5 bg-[#fe9900] text-black text-xs font-bold uppercase rounded hover:opacity-90 transition-colors shadow-lg">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Note Modal */}
            {isNoteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-card rounded-none shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 flex flex-col border border-border overflow-hidden">
                        <div className="flex items-center justify-between px-6 border-b border-border bg-muted/50 shrink-0 h-9">
                            <h2 className="text-sm font-bold uppercase text-foreground">Add Note</h2>
                            <button onClick={() => setIsNoteModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 bg-background">
                            <textarea
                                value={newNoteText}
                                onChange={(e) => setNewNoteText(e.target.value)}
                                placeholder="Enter note..."
                                rows={5}
                                className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground resize-none"
                            />
                        </div>
                        <div className="px-4 border-t border-border bg-muted/20 flex items-center justify-end shrink-0 h-9">
                            <button
                                onClick={async () => {
                                    if (!order || !newNoteText.trim()) return;
                                    try {
                                        const newNote = {
                                            note: newNoteText.trim(),
                                            createdBy: (session?.user as any)?.id || '',
                                            createdAt: new Date().toISOString()
                                        };
                                        const updatedNotes = [...(order.notes || []), newNote];
                                        const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ notes: updatedNotes })
                                        });
                                        if (res.ok) {
                                            const data = await res.json();
                                            setOrder(data);
                                            setIsNoteModalOpen(false);
                                            setNewNoteText('');
                                            toast.success('Note added');
                                        } else {
                                            toast.error('Failed to add note');
                                        }
                                    } catch (e) {
                                        toast.error('Error adding note');
                                    }
                                }}
                                disabled={!newNoteText.trim()}
                                className="px-6 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase rounded hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save Note
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lot Selection Modal */}
            <LotSelectionModal
                isOpen={isLotModalOpen}
                onClose={() => {
                    setIsLotModalOpen(false);
                    setEditingLotItemId(null);
                    setEditingSkuId(null);
                }}
                onSelect={handleLotSelect}
                skuId={editingSkuId || ''}
                currentLotNumber={order?.lineItems?.find(i => i._id === editingLotItemId)?.lotNumber || ''}
            />

            {/* Password Confirmation Modal for Billing */}
            {billingPasswordModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border rounded-lg shadow-2xl w-[380px] overflow-hidden animate-in zoom-in-95 duration-200">
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
                                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto">
                                    <CreditCard className="w-6 h-6 text-muted-foreground" />
                                </div>
                                <p className="text-sm text-muted-foreground">Enter your password to view sensitive billing information</p>
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
                                            handleVerifyBillingPassword();
                                        }
                                    }}
                                    className="w-full px-4 py-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                                    className="flex-1 px-4 py-2.5 border border-border text-muted-foreground text-[11px] font-bold uppercase tracking-widest rounded hover:bg-secondary transition-colors"
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
                            <p className="text-[10px] text-muted-foreground text-center">
                                Details will auto-hide after 60 seconds
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
