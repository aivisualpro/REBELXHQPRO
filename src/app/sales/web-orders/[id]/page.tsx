'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
    ArrowLeft,
    Package,
    Truck,
    Loader2,
    Edit2,
    ExternalLink,
    ChevronDown,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { usePermissions } from '@/hooks/usePermissions';

interface LinkedSkuEntry {
    skuId: string;
    skuName?: string;
    multiplier: number;
    lotNumber?: string;
    cost?: number;
}

interface AvailableVariation {
    id: number;
    _id: string;
    name: string;
    sku: string;
    price?: number;
    attributes?: any[];
}

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
    linkedSkuName?: string;
    variationName?: string;
    lotNumber?: string;
    cost?: number;
    linkedSkus?: LinkedSkuEntry[];
    attributes?: any[];
    metaData?: any[];
    availableVariations?: AvailableVariation[];
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

    const { isFieldVisible } = usePermissions();
    const isFieldVisibleCost = isFieldVisible('cost');

    // Lot Selection State
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [editingLineItemId, setEditingLineItemId] = useState<number | null>(null);
    const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
    const [editingSkuIndex, setEditingSkuIndex] = useState<number>(-1); // index within linkedSkus array
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




    const formatCurrency = (val?: number) => {
        return `$${(val || 0).toFixed(2)}`;
    };

    // Lot Selection Handlers (now supports targeting a specific linkedSkus entry)
    const handleOpenLotModal = (item: LineItem, skuIdx?: number) => {
        // Multi-SKU: open for a specific linked SKU entry
        if (skuIdx != null && item.linkedSkus && item.linkedSkus[skuIdx]) {
            const entry = item.linkedSkus[skuIdx];
            setEditingLineItemId(item.id);
            setEditingSkuId(entry.skuId);
            setEditingSkuIndex(skuIdx);
            setEditingCurrentLot(entry.lotNumber);
            setIsLotModalOpen(true);
            return;
        }
        // Legacy: single linkedSkuId
        if (!item.linkedSkuId) {
            toast.error('No linked SKU for this item');
            return;
        }
        setEditingLineItemId(item.id);
        setEditingSkuId(item.linkedSkuId);
        setEditingSkuIndex(-1);
        setEditingCurrentLot(item.lotNumber);
        setIsLotModalOpen(true);
    };

    const handleLotSelect = async (lotNumber: string, cost?: number) => {
        if (!order || editingLineItemId === null) return;

        try {
            // Optimistic UI: update lot number immediately
            const updatedLineItems = order.lineItems.map(item => {
                if (item.id !== editingLineItemId) return item;
                if (editingSkuIndex >= 0 && item.linkedSkus) {
                    // Multi-SKU: update specific entry
                    return {
                        ...item,
                        linkedSkus: item.linkedSkus.map((ls, idx) =>
                            idx === editingSkuIndex ? { ...ls, lotNumber: lotNumber || undefined } : ls
                        )
                    };
                }
                // Legacy: single linkedSkuId
                return { ...item, lotNumber: lotNumber || undefined };
            });
            setOrder({ ...order, lineItems: updatedLineItems });

            const res = await fetch(`/api/retail/web-orders/${order._id}/line-item`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineItemId: editingLineItemId,
                    skuIndex: editingSkuIndex >= 0 ? editingSkuIndex : undefined,
                    lotNumber: lotNumber || null,
                })
            });

            if (res.ok) {
                toast.success(lotNumber ? `Lot updated to ${lotNumber}` : 'Lot cleared');
                fetchOrder();
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
            setEditingSkuIndex(-1);
            setEditingCurrentLot(undefined);
        }
    };

    // ─── Variation Selection Handler ──────────────────────────────────────
    const handleSelectVariation = async (item: LineItem, variation: AvailableVariation) => {
        if (!order) return;

        // Build a display name from attributes if available
        const varName = variation.attributes && variation.attributes.length > 0
            ? variation.attributes.map((a: any) => a.option || a.name).join(' / ')
            : variation.name;

        // Optimistic UI
        const updatedLineItems = order.lineItems.map(li => {
            if (li.id !== item.id) return li;
            return { ...li, variationId: variation.id, variationName: varName, availableVariations: undefined };
        });
        setOrder({ ...order, lineItems: updatedLineItems });

        try {
            const res = await fetch(`/api/retail/web-orders/${order._id}/line-item`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lineItemId: item.id,
                    variationId: variation.id,
                    variationName: varName,
                })
            });

            if (res.ok) {
                toast.success(`Variant set to: ${varName}`);
                fetchOrder();
            } else {
                fetchOrder();
                toast.error('Failed to update variant');
            }
        } catch (e) {
            fetchOrder();
            toast.error('Error updating variant');
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
    const totalCost = isFieldVisibleCost ? (order.lineItems?.reduce((sum, item) => sum + ((item.cost || 0) * (item.quantity || 0)), 0) || 0) : 0;

    // Tab counts
    const tabCounts: Record<TabType, number> = {
        'Line Items': order.lineItems?.length || 0,
        'Meta Data': order.metaData?.length || 0,
        'Coupons': order.couponLines?.length || 0,
        'Refunds': order.refunds?.length || 0,
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">


            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Details (30%) */}
                <div className="w-[30%] border-r border-border bg-background flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto scrollbar-custom">
                        {/* Hero Bar: Order# | Customer | Status */}
                        <div className="px-4 pt-4 pb-4">
                            <div className="flex items-stretch border border-border overflow-hidden">
                                {/* Order # */}
                                <div className="w-20 bg-amber-500 flex items-center justify-center shrink-0">
                                    <span className="text-sm font-black text-white font-mono">#{order.number}</span>
                                </div>
                                {/* Customer Name */}
                                <div className="flex-1 bg-emerald-500 flex items-center justify-center px-3 min-w-0">
                                    <span className="text-sm font-black text-white leading-tight text-center line-clamp-2">
                                        {order.billing?.firstName} {order.billing?.lastName}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Status Button */}
                        <div className="mx-4 mb-3">
                            <div className={cn(
                                "w-full px-3 py-2.5 text-[12px] font-black uppercase tracking-widest text-center border",
                                order.status === 'completed' ? "bg-emerald-500 text-white border-emerald-600" :
                                    order.status === 'processing' ? "bg-blue-500 text-white border-blue-600" :
                                        order.status === 'on-hold' ? "bg-amber-500 text-white border-amber-600" :
                                            order.status === 'pending' ? "bg-yellow-500 text-white border-yellow-600" :
                                                (order.status === 'cancelled' || order.status === 'refunded' || order.status === 'failed') ? "bg-rose-500 text-white border-rose-600" :
                                                    "bg-secondary text-muted-foreground border-border"
                            )}>
                                {order.status}
                            </div>
                        </div>

                        {/* Website Badge */}
                        <div className="mx-4 mb-4">
                            <div className={cn(
                                "w-full px-3 py-2 text-[10px] font-black uppercase tracking-widest text-center border",
                                order.website?.includes('KING') ? "bg-amber-500/15 text-amber-500 border-amber-500/30" :
                                    order.website?.includes('GRASS') ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" :
                                        order.website?.includes('GRHK') ? "bg-blue-500/15 text-blue-500 border-blue-500/30" :
                                            order.website?.includes('REBEL') ? "bg-purple-500/15 text-purple-500 border-purple-500/30" :
                                                "bg-secondary text-muted-foreground border-border"
                            )}>
                                {order.website}
                            </div>
                        </div>

                        {/* Order Info Grid */}
                        <div className="mx-4 mb-4 border border-border">
                            {[
                                [
                                    { label: 'Date Created', value: formatDate(order.dateCreated) },
                                    { label: 'Date Paid', value: formatDate(order.datePaid) },
                                ],
                                [
                                    { label: 'Date Completed', value: formatDate(order.dateCompleted) },
                                    { label: 'Created Via', value: order.createdVia || '-' },
                                ],
                                [
                                    { label: 'Payment Method', value: order.paymentMethodTitle || order.paymentMethod || '-' },
                                    { label: 'Currency', value: order.currency },
                                ],
                            ].map((row, rowIdx) => (
                                <div key={rowIdx} className={cn(
                                    "grid grid-cols-2 divide-x divide-border",
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
                            {order.transactionId && (
                                <div className="px-4 py-3 flex flex-col gap-0.5 border-t border-border bg-background">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Transaction ID</span>
                                    <span className="text-xs font-bold text-foreground font-mono truncate">{order.transactionId}</span>
                                </div>
                            )}
                        </div>

                        {/* Customer Note */}
                        {order.customerNote && (
                            <div className="mx-4 mb-4 border border-border">
                                <div className="px-4 py-3 bg-secondary/50 flex flex-col gap-0.5">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Customer Note</span>
                                    <span className="text-sm font-medium text-foreground italic">{order.customerNote}</span>
                                </div>
                            </div>
                        )}

                        {/* Billing */}
                        <div className="mx-4 mb-4">
                            <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Billing</div>
                            <div className="border border-border">
                                {[
                                    { label: 'Name', value: `${order.billing?.firstName || ''} ${order.billing?.lastName || ''}`.trim() || '-' },
                                    ...(order.billing?.company ? [{ label: 'Company', value: order.billing.company }] : []),
                                    { label: 'Address', value: [order.billing?.address1, order.billing?.address2].filter(Boolean).join(', ') || '-' },
                                    { label: 'City', value: order.billing?.city || '-' },
                                    { label: 'State', value: order.billing?.state || '-' },
                                    { label: 'Postal Code', value: order.billing?.postcode || '-' },
                                    { label: 'Country', value: order.billing?.country || '-' },
                                    { label: 'Email', value: order.billing?.email || '-' },
                                    { label: 'Phone', value: order.billing?.phone || '-' },
                                ].map((item, idx) => (
                                    <div key={idx} className={cn(
                                        "px-4 py-2.5 flex items-center justify-between",
                                        idx % 2 === 0 ? "bg-background" : "bg-secondary/50",
                                        idx > 0 && "border-t border-border"
                                    )}>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                        <span className="text-sm font-bold text-foreground truncate max-w-[60%] text-right">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Shipping */}
                        <div className="mx-4 mb-4">
                            <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Shipping</div>
                            <div className="border border-border">
                                {[
                                    { label: 'Name', value: `${order.shipping?.firstName || ''} ${order.shipping?.lastName || ''}`.trim() || '-' },
                                    ...(order.shipping?.company ? [{ label: 'Company', value: order.shipping.company }] : []),
                                    { label: 'Address', value: [order.shipping?.address1, order.shipping?.address2].filter(Boolean).join(', ') || '-' },
                                    { label: 'City', value: order.shipping?.city || '-' },
                                    { label: 'State', value: order.shipping?.state || '-' },
                                    { label: 'Postal Code', value: order.shipping?.postcode || '-' },
                                    { label: 'Country', value: order.shipping?.country || '-' },
                                ].map((item, idx) => (
                                    <div key={idx} className={cn(
                                        "px-4 py-2.5 flex items-center justify-between",
                                        idx % 2 === 0 ? "bg-background" : "bg-secondary/50",
                                        idx > 0 && "border-t border-border"
                                    )}>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                        <span className="text-sm font-bold text-foreground truncate max-w-[60%] text-right">{item.value}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Shipping Lines */}
                            {order.shippingLines && order.shippingLines.length > 0 && (
                                <div className="mt-3 border border-border">
                                    <div className="px-4 py-2 bg-secondary/50">
                                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Shipping Methods</span>
                                    </div>
                                    {order.shippingLines.map((line: any, idx: number) => (
                                        <div key={idx} className={cn(
                                            "px-4 py-2.5 flex justify-between items-center border-t border-border",
                                            idx % 2 === 0 ? "bg-background" : "bg-secondary/50"
                                        )}>
                                            <span className="text-sm font-bold text-foreground">{line.method_title || line.methodTitle || 'Shipping'}</span>
                                            <span className="text-sm font-mono font-bold text-foreground">${parseFloat(line.total || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Payment Summary */}
                        <div className="mx-4 mb-4">
                            <div className="text-xs font-black uppercase tracking-widest text-foreground mb-4">Payment Summary</div>
                            <div className="space-y-3">
                                {[
                                    { label: 'Subtotal', value: subtotal, color: null },
                                    { label: 'Shipping', value: order.shippingTotal || 0, color: null },
                                    ...(order.discountTotal > 0 ? [{ label: 'Discount', value: -(order.discountTotal), color: 'text-red-500' }] : []),
                                    { label: 'Tax', value: order.totalTax || 0, color: null },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group">
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors font-medium">{item.label}</span>
                                        <span className={cn("text-sm font-mono font-bold", item.color || "text-foreground")}>
                                            {item.value < 0 ? '-' : ''}{formatCurrency(Math.abs(item.value))}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-4 pt-4 border-t border-border">
                                <div className="flex justify-between items-center px-4 py-3 bg-emerald-600 border border-emerald-700 shadow-sm">
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Order Total</span>
                                    <span className="text-lg font-mono font-black text-white">{formatCurrency(order.total)}</span>
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
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Product</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Variation</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Linked SKU</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Lot #</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">multiX</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Qty</th>
                                            {isFieldVisibleCost && <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Cost</th>}
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Price</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.lineItems?.map((item) => {
                                            const hasMultiSkus = item.linkedSkus && item.linkedSkus.length > 0;
                                            const skuRows = hasMultiSkus ? item.linkedSkus! : (
                                                item.linkedSkuId ? [{ skuId: item.linkedSkuId, skuName: item.linkedSkuName, multiplier: 1, lotNumber: item.lotNumber, cost: item.cost }] : []
                                            );
                                            const rowSpan = Math.max(1, skuRows.length);

                                            return skuRows.length <= 1 ? (
                                                // Single SKU or no SKU — render single row
                                                <tr key={item.id} className="hover:bg-secondary/50 transition-colors">
                                                    <td className="px-3 py-2">
                                                        {(item.webProductId || item.parentProductId) ? (
                                                            <button onClick={(e) => { e.stopPropagation(); router.push(`/warehouse/web-products/${item.webProductId || item.parentProductId}`); }}
                                                                className="text-xs font-bold text-foreground cursor-pointer text-left transition-colors hover:text-blue-500">
                                                                {item.name}
                                                            </button>
                                                        ) : (
                                                            <span className="text-xs font-bold text-foreground">{item.name}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {item.variationId > 0 ? (
                                                            <span className="text-[10px] text-foreground font-bold">{item.variationName || item.variationId}</span>
                                                        ) : item.availableVariations && item.availableVariations.length > 0 ? (
                                                            <div className="relative">
                                                                <select
                                                                    className="appearance-none bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-bold rounded px-2 py-1 pr-6 cursor-pointer hover:bg-amber-500/20 transition-colors outline-none w-full"
                                                                    value=""
                                                                    onChange={(e) => {
                                                                        const v = item.availableVariations!.find(av => String(av.id) === e.target.value);
                                                                        if (v) handleSelectVariation(item, v);
                                                                    }}
                                                                >
                                                                    <option value="" disabled>Select variant...</option>
                                                                    {item.availableVariations.map(v => {
                                                                        const label = v.attributes && v.attributes.length > 0
                                                                            ? v.attributes.map((a: any) => a.option || a.name).join(' / ')
                                                                            : v.name;
                                                                        return <option key={v.id} value={v.id}>{label}</option>;
                                                                    })}
                                                                </select>
                                                                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-amber-500 pointer-events-none" />
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground/50">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        {skuRows.length === 1 ? (
                                                            <button onClick={(e) => { e.stopPropagation(); router.push(`/warehouse/skus/${skuRows[0].skuId}`); }}
                                                                className="flex items-center space-x-1 text-xs font-bold text-foreground cursor-pointer transition-colors group hover:text-blue-500">
                                                                <span>{skuRows[0].skuName || skuRows[0].skuId}</span>
                                                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                            </button>
                                                        ) : <span className="text-[10px] text-muted-foreground/50">-</span>}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-foreground group">
                                                        <div className="flex items-center gap-1">
                                                            {skuRows.length === 1 && skuRows[0].lotNumber ? (
                                                                <span className="text-foreground font-mono font-bold">{skuRows[0].lotNumber}</span>
                                                            ) : <span>-</span>}
                                                            {skuRows.length === 1 && (
                                                                <button onClick={(e) => { e.stopPropagation(); handleOpenLotModal(item, hasMultiSkus ? 0 : undefined); }}
                                                                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500 transition-all p-0.5" title="Edit Lot #">
                                                                    <Edit2 className="w-2.5 h-2.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-xs text-purple-500 font-mono font-bold">{skuRows.length === 1 ? (skuRows[0].multiplier || 1) : 1}</td>
                                                    <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-bold">{item.quantity}</td>
                                                    {isFieldVisibleCost && <td className="px-3 py-2 text-right text-xs text-orange-500 font-mono font-bold whitespace-nowrap">{(skuRows[0]?.cost ?? item.cost ?? 0) > 0 ? formatCurrency(skuRows[0]?.cost ?? item.cost ?? 0) : '-'}</td>}
                                                    <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-bold">{formatCurrency(item.price)}</td>
                                                    <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-black bg-secondary/20">{formatCurrency(item.total)}</td>
                                                </tr>
                                            ) : (
                                                // Multi-SKU — render multiple sub-rows
                                                <React.Fragment key={item.id}>
                                                    {skuRows.map((sku, skuIdx) => (
                                                        <tr key={`${item.id}-sku-${skuIdx}`} className={cn(
                                                            'hover:bg-secondary/50 transition-colors',
                                                            skuIdx > 0 && 'border-t border-dashed border-border/40'
                                                        )}>
                                                            {/* Product/Variation/Qty/Price/Total only on first row */}
                                                            {skuIdx === 0 && (
                                                                <>
                                                                    <td className="px-3 py-2" rowSpan={rowSpan}>
                                                                        {(item.webProductId || item.parentProductId) ? (
                                                                            <button onClick={(e) => { e.stopPropagation(); router.push(`/warehouse/web-products/${item.webProductId || item.parentProductId}`); }}
                                                                                className="text-xs font-bold text-foreground cursor-pointer text-left transition-colors hover:text-blue-500">
                                                                                {item.name}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-xs font-bold text-foreground">{item.name}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-2" rowSpan={rowSpan}>
                                                                        {item.variationId > 0 ? (
                                                                            <span className="text-[10px] text-foreground font-bold">{item.variationName || item.variationId}</span>
                                                                        ) : item.availableVariations && item.availableVariations.length > 0 ? (
                                                                            <div className="relative">
                                                                                <select
                                                                                    className="appearance-none bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-bold rounded px-2 py-1 pr-6 cursor-pointer hover:bg-amber-500/20 transition-colors outline-none w-full"
                                                                                    value=""
                                                                                    onChange={(e) => {
                                                                                        const v = item.availableVariations!.find(av => String(av.id) === e.target.value);
                                                                                        if (v) handleSelectVariation(item, v);
                                                                                    }}
                                                                                >
                                                                                    <option value="" disabled>Select variant...</option>
                                                                                    {item.availableVariations.map(v => {
                                                                                        const label = v.attributes && v.attributes.length > 0
                                                                                            ? v.attributes.map((a: any) => a.option || a.name).join(' / ')
                                                                                            : v.name;
                                                                                        return <option key={v.id} value={v.id}>{label}</option>;
                                                                                    })}
                                                                                </select>
                                                                                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-amber-500 pointer-events-none" />
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-[10px] text-muted-foreground/50">-</span>
                                                                        )}
                                                                    </td>
                                                                </>
                                                            )}
                                                            {/* SKU cell — one per linked SKU */}
                                                            <td className="px-3 py-1.5">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{sku.multiplier}×</span>
                                                                    <button onClick={(e) => { e.stopPropagation(); router.push(`/warehouse/skus/${sku.skuId}`); }}
                                                                        className="flex items-center space-x-1 text-xs font-bold text-foreground cursor-pointer transition-colors group hover:text-blue-500">
                                                                        <span>{sku.skuName || sku.skuId}</span>
                                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            {/* Lot # cell — one per linked SKU */}
                                                            <td className="px-3 py-1.5 text-xs text-foreground group">
                                                                <div className="flex items-center gap-1">
                                                                    {sku.lotNumber ? (
                                                                        <span className="text-foreground font-mono font-bold">{sku.lotNumber}</span>
                                                                    ) : <span>-</span>}
                                                                    <button onClick={(e) => { e.stopPropagation(); handleOpenLotModal(item, skuIdx); }}
                                                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500 transition-all p-0.5" title="Edit Lot #">
                                                                        <Edit2 className="w-2.5 h-2.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            {/* multiX, Qty and Cost on every row; Price/Total only on first row */}
                                                            <td className="px-3 py-1.5 text-right text-xs text-purple-500 font-mono font-bold">{sku.multiplier || 1}</td>
                                                            {skuIdx === 0 && <td className="px-3 py-1.5 text-right text-xs text-foreground font-mono font-bold" rowSpan={rowSpan}>{item.quantity}</td>}
                                                            {isFieldVisibleCost && <td className="px-3 py-1.5 text-right text-xs text-orange-500 font-mono font-bold whitespace-nowrap">{(sku.cost ?? 0) > 0 ? formatCurrency(sku.cost!) : '-'}</td>}
                                                            {skuIdx === 0 && (
                                                                <>
                                                                    <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-bold" rowSpan={rowSpan}>{formatCurrency(item.price)}</td>
                                                                    <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-black bg-secondary/20" rowSpan={rowSpan}>{formatCurrency(item.total)}</td>
                                                                </>
                                                            )}
                                                        </tr>
                                                    ))}
                                                </React.Fragment>
                                            );
                                        })}
                                        {(!order.lineItems || order.lineItems.length === 0) && (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                                    No line items
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    {order.lineItems && order.lineItems.length > 0 && (
                                        <tfoot className="bg-secondary border-t border-border">
                                            <tr>
                                                <td colSpan={5} className="px-3 py-2 text-xs font-black text-muted-foreground uppercase text-right">Subtotal</td>
                                                <td className="px-3 py-2 text-xs font-black text-foreground text-center">
                                                    {order.lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0)}
                                                </td>
                                                {isFieldVisibleCost && <td className="px-3 py-2"></td>}
                                                <td className="px-3 py-2"></td>
                                                <td className="px-3 py-2 text-xs font-black text-foreground">{formatCurrency(subtotal)}</td>
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
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-[60px]">#</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-[200px]">Key</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.metaData?.map((meta: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-secondary/50 transition-colors">
                                                <td className="px-3 py-2 text-xs font-mono text-muted-foreground font-bold">{idx + 1}</td>
                                                <td className="px-3 py-2 text-xs font-mono text-foreground font-bold">{meta.key}</td>
                                                <td className="px-3 py-2 text-xs text-foreground max-w-[400px] truncate font-bold">
                                                    {typeof meta.value === 'object' ? JSON.stringify(meta.value) : String(meta.value)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.metaData || order.metaData.length === 0) && (
                                            <tr>
                                                <td colSpan={3} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-[60px]">#</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Code</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right w-[120px]">Discount</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right w-[120px]">Discount Tax</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.couponLines?.map((coupon: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-secondary/50 transition-colors">
                                                <td className="px-3 py-2 text-xs font-mono text-muted-foreground font-bold">{idx + 1}</td>
                                                <td className="px-3 py-2">
                                                    <span className="px-2 py-0.5 bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs font-bold uppercase">
                                                        {coupon.code}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-xs font-mono font-black text-emerald-500">
                                                    -${parseFloat(coupon.discount || 0).toFixed(2)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-xs font-mono font-bold text-foreground">
                                                    ${parseFloat(coupon.discount_tax || coupon.discountTax || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.couponLines || order.couponLines.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-[80px]">ID</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reason</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest w-[150px]">Date</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right w-[120px]">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {order.refunds?.map((refund: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-rose-500/5 transition-colors">
                                                <td className="px-3 py-2 text-xs font-mono text-foreground font-bold">#{refund.id}</td>
                                                <td className="px-3 py-2 text-xs text-foreground font-bold">{refund.reason || '-'}</td>
                                                <td className="px-3 py-2 text-xs font-mono text-foreground font-bold">
                                                    {refund.date_created ? new Date(refund.date_created).toLocaleString() : '-'}
                                                </td>
                                                <td className="px-3 py-2 text-right text-xs font-mono font-black text-rose-500">
                                                    -${Math.abs(parseFloat(refund.total || 0)).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.refunds || order.refunds.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
