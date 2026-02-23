'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
    ArrowLeft,
    Package,
    Truck,
    Loader2,
    Edit2,
    ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';

interface LineItem {
    id: number;
    name: string;
    productId: number;
    variationId: number;
    quantity: number;
    subtotal: number;
    total: number;
    sku: string;
    price: number;
    image?: string;
    parentProductId?: string;
    webProductId?: string;
    linkedSkuId?: string;
    lotNumber?: string;
    cost?: number;
    attributes?: any[];
    metaData?: any[];
}

interface WebOrder {
    _id: string;
    webId: number;
    number: string;
    orderKey: string;
    status: string;
    currency: string;
    createdVia: string;
    dateCreated: string;
    dateModified: string;
    datePaid?: string;
    dateCompleted?: string;
    total: number;
    totalTax: number;
    shippingTotal: number;
    shippingTax: number;
    discountTotal: number;
    discountTax: number;
    cartTax: number;
    customerNote?: string;
    billing: {
        firstName: string;
        lastName: string;
        company?: string;
        address1: string;
        address2?: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
        email: string;
        phone: string;
    };
    shipping: {
        firstName: string;
        lastName: string;
        company?: string;
        address1: string;
        address2?: string;
        city: string;
        state: string;
        postcode: string;
        country: string;
    };
    paymentMethod: string;
    paymentMethodTitle: string;
    transactionId?: string;
    website: string;
    lineItems: LineItem[];
    shippingLines?: any[];
    couponLines?: any[];
    refunds?: any[];
    metaData?: any[];
}

const TABS = ['Line Items', 'Meta Data', 'Coupons', 'Refunds'] as const;
type TabType = typeof TABS[number];

export default function WebOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [order, setOrder] = useState<WebOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('Line Items');
    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);

    // Lot Selection State
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [editingLineItemId, setEditingLineItemId] = useState<number | null>(null);
    const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
    const [editingCurrentLot, setEditingCurrentLot] = useState<string | undefined>(undefined);

    useEffect(() => {
        const originalBodyStyle = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = originalBodyStyle; };
    }, []);

    // Header portal mounting
    useEffect(() => {
        const tryMount = () => {
            const target = document.getElementById('header-portal-target');
            if (target) {
                setHeaderPortal(target);
                return true;
            }
            return false;
        };
        if (!tryMount()) {
            const interval = setInterval(() => {
                if (tryMount()) clearInterval(interval);
            }, 100);
            return () => clearInterval(interval);
        }
    }, []);

    const fetchOrder = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/retail/web-orders/${id}`);
            const data = await res.json();
            if (res.ok) {
                setOrder(data);
            } else {
                toast.error(data.error || 'Failed to fetch order');
            }
        } catch (e) {
            toast.error('Connection error');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) fetchOrder();
    }, [id, fetchOrder]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
            case 'processing': return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
            case 'on-hold': return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
            case 'pending': return 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30';
            case 'cancelled': case 'refunded': case 'failed': return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
            default: return 'bg-secondary text-muted-foreground border-border';
        }
    };

    const getWebsiteColor = (website: string) => {
        if (website?.includes('KING')) return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
        if (website?.includes('GRASS')) return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
        if (website?.includes('GRHK')) return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
        if (website?.includes('REBEL')) return 'bg-purple-500/15 text-purple-500 border-purple-500/30';
        return 'bg-secondary text-muted-foreground border-border';
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatCurrency = (val?: number) => {
        return `$${(val || 0).toFixed(2)}`;
    };

    // Lot Selection Handlers
    const handleOpenLotModal = (item: LineItem) => {
        if (!item.linkedSkuId) {
            toast.error('No linked SKU for this item');
            return;
        }
        setEditingLineItemId(item.id);
        setEditingSkuId(item.linkedSkuId);
        setEditingCurrentLot(item.lotNumber);
        setIsLotModalOpen(true);
    };

    const handleLotSelect = async (lotNumber: string, cost?: number) => {
        if (!order || editingLineItemId === null) return;

        try {
            const updatedLineItems = order.lineItems.map(item =>
                item.id === editingLineItemId
                    ? { ...item, lotNumber: lotNumber || undefined, cost: cost || 0 }
                    : item
            );

            setOrder({ ...order, lineItems: updatedLineItems });

            const res = await fetch(`/api/retail/web-orders/${order._id}/line-item`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineItemId: editingLineItemId,
                    lotNumber: lotNumber || null,
                    cost: cost || 0
                })
            });

            if (res.ok) {
                toast.success(lotNumber ? `Lot updated to ${lotNumber}` : 'Lot cleared');
            } else {
                fetchOrder();
                toast.error('Failed to update lot number');
            }
        } catch (e) {
            fetchOrder();
            toast.error('Error updating lot number');
        } finally {
            setIsLotModalOpen(false);
            setEditingLineItemId(null);
            setEditingSkuId(null);
            setEditingCurrentLot(undefined);
        }
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

    const subtotal = order.lineItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;
    const totalCost = order.lineItems?.reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 0)), 0) || 0;

    // Tab counts
    const tabCounts: Record<TabType, number> = {
        'Line Items': order.lineItems?.length || 0,
        'Meta Data': order.metaData?.length || 0,
        'Coupons': order.couponLines?.length || 0,
        'Refunds': order.refunds?.length || 0,
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
            {/* Header Portal Content */}
            {headerPortal && order && createPortal(
                <>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back</span>
                        </button>
                    </div>
                </>,
                headerPortal
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Details (30%) */}
                <div className="w-[30%] border-r border-border bg-secondary/30 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Identity Boxes */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="border border-border rounded-md p-3 bg-background text-center flex items-center justify-center">
                                <div className="text-base font-black text-amber-500 tracking-tight font-mono">#{order.number}</div>
                            </div>
                            <div className="border border-border rounded-md p-3 bg-background text-center">
                                <div className="text-[11px] font-bold text-foreground break-words">
                                    {order.billing?.firstName} {order.billing?.lastName}
                                </div>
                            </div>
                            <div className={cn(
                                "border rounded-md p-3 text-center flex items-center justify-center transition-colors",
                                getStatusColor(order.status)
                            )}>
                                <div className="text-[10px] font-black uppercase tracking-wider">{order.status}</div>
                            </div>
                        </div>

                        {/* Website Badge */}
                        <div className={cn(
                            "border rounded-md p-2 text-center",
                            getWebsiteColor(order.website)
                        )}>
                            <div className="text-[9px] font-black uppercase tracking-widest">{order.website}</div>
                        </div>

                        {/* Details */}
                        <div>
                            <div className="space-y-6">
                                {/* Order Info */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Date Created</div>
                                        <div className="text-xs font-medium text-foreground">{formatDate(order.dateCreated)}</div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Date Paid</div>
                                        <div className="text-xs font-medium text-foreground">{formatDate(order.datePaid)}</div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Date Completed</div>
                                        <div className="text-xs font-medium text-foreground">{formatDate(order.dateCompleted)}</div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Created Via</div>
                                        <div className="text-xs font-medium text-foreground">{order.createdVia || '-'}</div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Payment Method</div>
                                        <div className="text-xs font-medium text-foreground">{order.paymentMethodTitle || order.paymentMethod || '-'}</div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Currency</div>
                                        <div className="text-xs font-medium text-foreground font-mono">{order.currency}</div>
                                    </div>
                                    {order.transactionId && (
                                        <div className="flex justify-between items-center">
                                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Transaction ID</div>
                                            <div className="text-[9px] font-medium text-muted-foreground font-mono truncate max-w-[120px]">{order.transactionId}</div>
                                        </div>
                                    )}
                                </div>

                                {/* Customer Note */}
                                {order.customerNote && (
                                    <div>
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-bold italic">Customer Note</div>
                                        <div className="text-xs text-foreground italic border border-border rounded-md p-3 bg-background">{order.customerNote}</div>
                                    </div>
                                )}

                                {/* Billing */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-2 border-b border-border pb-2">Billing</h3>
                                    <div className="space-y-0">
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Name</span>
                                            <span className="text-[11px] font-bold text-foreground">{order.billing?.firstName} {order.billing?.lastName}</span>
                                        </div>
                                        {order.billing?.company && (
                                            <div className="flex items-center py-2 border-b border-border/50">
                                                <span className="text-[11px] text-muted-foreground w-28 shrink-0">Company</span>
                                                <span className="text-[11px] text-foreground">{order.billing.company}</span>
                                            </div>
                                        )}
                                        <div className="flex items-start py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0 pt-0.5">Address</span>
                                            <span className="text-[11px] text-foreground leading-relaxed">
                                                {order.billing?.address1 || <span className="text-muted-foreground italic">No address</span>}
                                                {order.billing?.address2 && <><br />{order.billing.address2}</>}
                                            </span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">City</span>
                                            <span className="text-[11px] text-foreground">{order.billing?.city || '-'}</span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">State</span>
                                            <span className="text-[11px] text-foreground">{order.billing?.state || '-'}</span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Postal Code</span>
                                            <span className="text-[11px] text-foreground">{order.billing?.postcode || '-'}</span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Country</span>
                                            <span className="text-[11px] text-foreground uppercase font-bold">{order.billing?.country || '-'}</span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Email</span>
                                            <span className="text-[11px] font-bold text-foreground truncate">{order.billing?.email || <span className="text-muted-foreground italic font-normal">None</span>}</span>
                                        </div>
                                        <div className="flex items-center py-2">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Phone</span>
                                            <span className="text-[11px] font-bold text-foreground">{order.billing?.phone || <span className="text-muted-foreground italic font-normal">None</span>}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Shipping */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-2 border-b border-border pb-2">Shipping</h3>
                                    <div className="space-y-0">
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Name</span>
                                            <span className="text-[11px] font-bold text-foreground">{order.shipping?.firstName} {order.shipping?.lastName}</span>
                                        </div>
                                        {order.shipping?.company && (
                                            <div className="flex items-center py-2 border-b border-border/50">
                                                <span className="text-[11px] text-muted-foreground w-28 shrink-0">Company</span>
                                                <span className="text-[11px] text-foreground">{order.shipping.company}</span>
                                            </div>
                                        )}
                                        <div className="flex items-start py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0 pt-0.5">Address</span>
                                            <span className="text-[11px] text-foreground leading-relaxed">
                                                {order.shipping?.address1 || <span className="text-muted-foreground italic">No address</span>}
                                                {order.shipping?.address2 && <><br />{order.shipping.address2}</>}
                                            </span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">City</span>
                                            <span className="text-[11px] text-foreground">{order.shipping?.city || '-'}</span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">State</span>
                                            <span className="text-[11px] text-foreground">{order.shipping?.state || '-'}</span>
                                        </div>
                                        <div className="flex items-center py-2 border-b border-border/50">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Postal Code</span>
                                            <span className="text-[11px] text-foreground">{order.shipping?.postcode || '-'}</span>
                                        </div>
                                        <div className="flex items-center py-2">
                                            <span className="text-[11px] text-muted-foreground w-28 shrink-0">Country</span>
                                            <span className="text-[11px] text-foreground uppercase font-bold">{order.shipping?.country || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Shipping Lines */}
                                    {order.shippingLines && order.shippingLines.length > 0 && (
                                        <div className="mt-3 pt-2 border-t border-border/50">
                                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Shipping Methods</div>
                                            {order.shippingLines.map((line: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center py-1">
                                                    <span className="text-[11px] text-foreground">{line.method_title || line.methodTitle || 'Shipping'}</span>
                                                    <span className="text-[11px] font-mono font-medium text-foreground">${parseFloat(line.total || 0).toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Payment Summary */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-4 border-b border-border pb-2">Payment Summary</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center group">
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Subtotal</span>
                                            <span className="text-sm font-mono font-medium text-foreground">{formatCurrency(subtotal)}</span>
                                        </div>
                                        <div className="flex justify-between items-center group">
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Shipping</span>
                                            <span className="text-sm font-mono font-medium text-foreground">{formatCurrency(order.shippingTotal || 0)}</span>
                                        </div>
                                        {order.discountTotal > 0 && (
                                            <div className="flex justify-between items-center group">
                                                <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Discount</span>
                                                <span className="text-sm font-mono font-medium text-red-500">-{formatCurrency(order.discountTotal)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center group">
                                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Tax</span>
                                            <span className="text-sm font-mono font-medium text-foreground">{formatCurrency(order.totalTax || 0)}</span>
                                        </div>
                                        <div className="flex justify-between items-center group pt-1 border-t border-border">
                                            <span className="text-sm text-foreground font-bold">Order Total</span>
                                            <span className="text-sm font-mono font-bold text-foreground">{formatCurrency(order.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
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
                                        activeTab === tab ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                                    )}>
                                        {tabCounts[tab]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {/* Line Items Tab */}
                        {activeTab === 'Line Items' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[50px]">Image</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Product</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[80px]">Variation</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[120px]">Linked SKU</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[100px]">Lot #</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[80px]">SKU</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap text-center w-[50px]">Qty</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[70px]">Cost</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[70px]">Price</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[70px]">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.lineItems?.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-secondary/50 transition-colors"
                                            >
                                                <td className="px-3 py-1.5">
                                                    <div
                                                        className={cn(
                                                            "w-9 h-9 border border-border bg-background overflow-hidden shrink-0",
                                                            item.parentProductId && "cursor-pointer hover:border-amber-500/50"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (item.parentProductId) router.push(`/warehouse/web-products/${item.parentProductId}`);
                                                        }}
                                                    >
                                                        <img src={item.image || '/sku-placeholder.png'} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    {(item.webProductId || item.parentProductId) ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/warehouse/web-products/${item.webProductId || item.parentProductId}`);
                                                            }}
                                                            className="text-[10px] font-bold text-foreground hover:text-blue-600 hover:underline line-clamp-2 text-left transition-colors"
                                                        >
                                                            {item.name}
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-foreground line-clamp-2">{item.name}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    {item.variationId > 0 ? (
                                                        <span className="text-[9px] font-mono text-muted-foreground">{item.variationId}</span>
                                                    ) : (
                                                        <span className="text-[9px] text-muted-foreground/50">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    {item.linkedSkuId ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/warehouse/skus/${item.linkedSkuId}`);
                                                            }}
                                                            className="flex items-center space-x-1 text-[9px] font-mono text-foreground hover:text-blue-600 hover:underline transition-colors group"
                                                        >
                                                            <span className="truncate max-w-[80px]">{item.linkedSkuId}</span>
                                                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[9px] text-muted-foreground/50">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-1.5 text-[10px] text-muted-foreground group">
                                                    <div className="flex items-center gap-1">
                                                        {item.lotNumber ? (
                                                            <span className="text-foreground font-mono">{item.lotNumber}</span>
                                                        ) : (
                                                            <span>-</span>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenLotModal(item);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500 transition-all p-0.5"
                                                            title="Edit Lot #"
                                                        >
                                                            <Edit2 className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-[9px] font-mono text-muted-foreground">{item.sku || '-'}</td>
                                                <td className="px-3 py-1.5 text-center text-[10px] text-muted-foreground font-mono">{item.quantity}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-orange-600 font-mono whitespace-nowrap">{item.cost ? formatCurrency(item.cost) : '-'}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{formatCurrency(item.price)}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-foreground font-mono bg-secondary/20">{formatCurrency(item.total)}</td>
                                            </tr>
                                        ))}
                                        {(!order.lineItems || order.lineItems.length === 0) && (
                                            <tr>
                                                <td colSpan={10} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    No line items
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {order.lineItems && order.lineItems.length > 0 && (
                                        <tfoot className="bg-secondary border-t border-border">
                                            <tr>
                                                <td colSpan={6} className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase text-right">Subtotal</td>
                                                <td className="px-3 py-1.5 text-[10px] font-bold text-foreground text-center">
                                                    {order.lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                                                </td>
                                                <td className="px-3 py-1.5"></td>
                                                <td className="px-3 py-1.5"></td>
                                                <td className="px-3 py-1.5 text-[10px] font-black text-foreground">{formatCurrency(subtotal)}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}

                        {/* Meta Data Tab */}
                        {activeTab === 'Meta Data' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest w-[60px]">#</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest w-[200px]">Key</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.metaData?.map((meta: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-secondary/50 transition-colors">
                                                <td className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground">{idx + 1}</td>
                                                <td className="px-3 py-1.5 text-[10px] font-mono text-foreground">{meta.key}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-foreground max-w-[400px] truncate">
                                                    {typeof meta.value === 'object' ? JSON.stringify(meta.value) : String(meta.value)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.metaData || order.metaData.length === 0) && (
                                            <tr>
                                                <td colSpan={3} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    No meta data found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Coupons Tab */}
                        {activeTab === 'Coupons' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest w-[60px]">#</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Code</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest text-right w-[120px]">Discount</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest text-right w-[120px]">Discount Tax</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.couponLines?.map((coupon: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-secondary/50 transition-colors">
                                                <td className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground">{idx + 1}</td>
                                                <td className="px-3 py-1.5">
                                                    <span className="px-2 py-0.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 text-[10px] font-bold uppercase">
                                                        {coupon.code}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-[10px] font-mono font-bold text-emerald-500">
                                                    -${parseFloat(coupon.discount || 0).toFixed(2)}
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-[10px] font-mono text-muted-foreground">
                                                    ${parseFloat(coupon.discount_tax || coupon.discountTax || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.couponLines || order.couponLines.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    No coupons applied
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Refunds Tab */}
                        {activeTab === 'Refunds' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest w-[80px]">ID</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Reason</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest w-[150px]">Date</th>
                                            <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest text-right w-[120px]">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.refunds?.map((refund: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-rose-500/5 transition-colors">
                                                <td className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground">#{refund.id}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-foreground">{refund.reason || '-'}</td>
                                                <td className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground">
                                                    {refund.date_created ? new Date(refund.date_created).toLocaleString() : '-'}
                                                </td>
                                                <td className="px-3 py-1.5 text-right text-[10px] font-mono font-bold text-rose-500">
                                                    -${Math.abs(parseFloat(refund.total || 0)).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.refunds || order.refunds.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    No refunds found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lot Selection Modal */}
            {editingSkuId && (
                <LotSelectionModal
                    isOpen={isLotModalOpen}
                    onClose={() => {
                        setIsLotModalOpen(false);
                        setEditingLineItemId(null);
                        setEditingSkuId(null);
                        setEditingCurrentLot(undefined);
                    }}
                    onSelect={handleLotSelect}
                    skuId={editingSkuId}
                    currentLotNumber={editingCurrentLot}
                    title="Select Lot Number"
                    requiredQty={order.lineItems?.find(i => i.id === editingLineItemId)?.quantity || 0}
                />
            )}
        </div>
    );
}
