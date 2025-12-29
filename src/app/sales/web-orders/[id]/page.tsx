'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Package,
    Receipt,
    Truck,
    Calendar,
    CreditCard,
    FileText,
    Tag,
    RotateCcw,
    Loader2,
    ShoppingBag,
    Globe,
    Info,
    Edit2,
    ExternalLink
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
            case 'completed': return 'bg-emerald-500 text-white';
            case 'processing': return 'bg-blue-500 text-white';
            case 'on-hold': return 'bg-amber-500 text-white';
            case 'pending': return 'bg-yellow-500 text-black';
            case 'cancelled': case 'refunded': case 'failed': return 'bg-rose-500 text-white';
            default: return 'bg-slate-500 text-white';
        }
    };

    const getWebsiteColor = (website: string) => {
        if (website?.includes('KING')) return 'bg-amber-500';
        if (website?.includes('GRASS')) return 'bg-emerald-500';
        if (website?.includes('GRHK')) return 'bg-blue-500';
        if (website?.includes('REBEL')) return 'bg-purple-500';
        return 'bg-slate-500';
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
            // Update the line item locally first for instant feedback
            const updatedLineItems = order.lineItems.map(item => 
                item.id === editingLineItemId 
                    ? { ...item, lotNumber: lotNumber || undefined, cost: cost || 0 }
                    : item
            );
            
            // Optimistic update
            setOrder({ ...order, lineItems: updatedLineItems });
            
            // Call API to persist the change
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
                // Revert on error
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
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading Order...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-slate-50">
                <Package className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase">Order not found</p>
                <button onClick={() => router.back()} className="mt-4 text-[10px] font-black uppercase text-blue-600 hover:underline">Go Back</button>
            </div>
        );
    }

    const subtotal = order.lineItems?.reduce((sum, item) => sum + (item.total || 0), 0) || 0;

    // Tab counts
    const tabCounts: Record<TabType, number> = {
        'Line Items': order.lineItems?.length || 0,
        'Meta Data': order.metaData?.length || 0,
        'Coupons': order.couponLines?.length || 0,
        'Refunds': order.refunds?.length || 0,
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden bg-white">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-10 shadow-sm">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => router.push('/sales/web-orders')}
                        className="p-1 hover:bg-slate-100 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="flex items-center space-x-3">
                        <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight">Order #{order.number}</h1>
                        <span className={cn(
                            "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest",
                            getStatusColor(order.status)
                        )}>{order.status}</span>
                        <span className={cn(
                            "px-2 py-0.5 text-[9px] font-black text-white uppercase tracking-widest",
                            getWebsiteColor(order.website)
                        )}>{order.website}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                    <span>WC-{order.webId}</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Order Info */}
                <aside className="w-[340px] h-full overflow-y-auto border-r border-slate-200 bg-slate-50/30 shrink-0 scrollbar-custom p-6 space-y-6">
                    
                    {/* Billing Section */}
                    <section>
                        <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-3 flex items-center space-x-2">
                            <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Billing</span>
                        </h3>
                        <div className="bg-white border border-slate-200 p-4 space-y-2 text-[10px]">
                            <p className="font-bold text-slate-900">{order.billing?.firstName} {order.billing?.lastName}</p>
                            {order.billing?.company && <p className="text-slate-500">{order.billing.company}</p>}
                            <p className="text-slate-600">{order.billing?.address1}</p>
                            {order.billing?.address2 && <p className="text-slate-600">{order.billing.address2}</p>}
                            <p className="text-slate-600">{order.billing?.city}, {order.billing?.state} {order.billing?.postcode}</p>
                            <p className="text-slate-400 uppercase font-bold">{order.billing?.country}</p>
                            <div className="pt-2 border-t border-slate-100 space-y-1">
                                <p className="text-slate-600"><span className="text-slate-400 font-bold uppercase">Email:</span> {order.billing?.email}</p>
                                <p className="text-slate-600"><span className="text-slate-400 font-bold uppercase">Phone:</span> {order.billing?.phone || 'N/A'}</p>
                            </div>
                        </div>
                    </section>

                    {/* Order Details Section */}
                    <section>
                        <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-3 flex items-center space-x-2">
                            <Info className="w-3.5 h-3.5 text-blue-500" />
                            <span>Order Details</span>
                        </h3>
                        <div className="bg-white border border-slate-200 p-4 space-y-2">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 font-bold uppercase">Created Via</span>
                                <span className="text-slate-700 font-medium">{order.createdVia || '-'}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 font-bold uppercase">Currency</span>
                                <span className="text-slate-700 font-medium font-mono">{order.currency}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 font-bold uppercase">Date Created</span>
                                <span className="text-slate-600 font-mono">{order.dateCreated ? new Date(order.dateCreated).toLocaleString() : '-'}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 font-bold uppercase">Date Completed</span>
                                <span className="text-slate-600 font-mono">{order.dateCompleted ? new Date(order.dateCompleted).toLocaleString() : '-'}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 font-bold uppercase">Date Paid</span>
                                <span className="text-slate-600 font-mono">{order.datePaid ? new Date(order.datePaid).toLocaleString() : '-'}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400 font-bold uppercase">Payment Method</span>
                                <span className="text-slate-700 font-medium">{order.paymentMethodTitle || order.paymentMethod || '-'}</span>
                            </div>
                            {order.transactionId && (
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase">Transaction ID</span>
                                    <span className="text-slate-500 font-mono text-[9px]">{order.transactionId}</span>
                                </div>
                            )}
                            {order.customerNote && (
                                <div className="pt-2 border-t border-slate-100">
                                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">Customer Note</span>
                                    <p className="text-slate-600 text-[10px] italic bg-amber-50 p-2 border border-amber-100">{order.customerNote}</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Shipping Section */}
                    <section>
                        <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-3 flex items-center space-x-2">
                            <Truck className="w-3.5 h-3.5 text-orange-500" />
                            <span>Shipping</span>
                        </h3>
                        <div className="bg-white border border-slate-200 p-4 space-y-2 text-[10px]">
                            <p className="font-bold text-slate-900">{order.shipping?.firstName} {order.shipping?.lastName}</p>
                            {order.shipping?.company && <p className="text-slate-500">{order.shipping.company}</p>}
                            <p className="text-slate-600">{order.shipping?.address1}</p>
                            {order.shipping?.address2 && <p className="text-slate-600">{order.shipping.address2}</p>}
                            <p className="text-slate-600">{order.shipping?.city}, {order.shipping?.state} {order.shipping?.postcode}</p>
                            <p className="text-slate-400 uppercase font-bold">{order.shipping?.country}</p>
                            
                            {/* Shipping Lines */}
                            {order.shippingLines && order.shippingLines.length > 0 && (
                                <div className="pt-3 border-t border-slate-100 space-y-2">
                                    <span className="text-slate-400 font-bold uppercase text-[9px]">Shipping Methods</span>
                                    {order.shippingLines.map((line: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center">
                                            <span className="text-slate-600">{line.method_title || line.methodTitle || 'Shipping'}</span>
                                            <span className="font-mono font-medium text-slate-700">${parseFloat(line.total || 0).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Financials Section */}
                    <section>
                        <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-3 flex items-center space-x-2">
                            <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                            <span>Financials</span>
                        </h3>
                        <div className="bg-white border border-slate-200 p-4 space-y-3">
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">Subtotal</span>
                                <span className="font-mono font-medium text-slate-700">${subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">Shipping</span>
                                <span className="font-mono font-medium text-slate-700">${(order.shippingTotal || 0).toFixed(2)}</span>
                            </div>
                            {order.discountTotal > 0 && (
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Discount</span>
                                    <span className="font-mono font-medium text-emerald-600">-${order.discountTotal.toFixed(2)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-[11px]">
                                <span className="text-slate-500">Tax</span>
                                <span className="font-mono font-medium text-slate-700">${(order.totalTax || 0).toFixed(2)}</span>
                            </div>
                            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-sm font-black text-slate-900 uppercase tracking-tight">Total</span>
                                <span className="text-lg font-black font-mono text-slate-900">${(order.total || 0).toFixed(2)}</span>
                            </div>
                            <div className="text-[9px] text-slate-400 uppercase tracking-widest text-right">
                                Currency: {order.currency}
                            </div>
                        </div>
                    </section>

                    <div className="h-6" />
                </aside>

                {/* Right Content: Tabs */}
                <main className="flex-1 h-full bg-white flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="px-6 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white z-10">
                        <div className="flex space-x-1">
                            {TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5",
                                        activeTab === tab
                                            ? "text-black border-black"
                                            : "text-slate-400 border-transparent hover:text-slate-600"
                                    )}
                                >
                                    <span>{tab}</span>
                                    {tabCounts[tab] > 0 && (
                                        <span className={cn(
                                            "px-1.5 py-0.5 text-[9px] font-bold",
                                            activeTab === tab ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                                        )}>
                                            {tabCounts[tab]}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto scrollbar-custom">
                        {/* Line Items Tab */}
                        {activeTab === 'Line Items' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                        <tr>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[50px]">Image</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[80px]">Variation</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[120px]">Linked SKU</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[100px]">Lot #</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[80px]">SKU</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center w-[50px]">Qty</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right w-[70px]">Price</th>
                                            <th className="px-3 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right w-[70px]">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {order.lineItems?.map((item) => (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-slate-50/50 transition-colors"
                                            >
                                                <td className="px-3 py-2">
                                                    <div 
                                                        className={cn(
                                                            "w-9 h-9 border border-slate-100 bg-white overflow-hidden shrink-0",
                                                            item.parentProductId && "cursor-pointer hover:border-blue-300"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (item.parentProductId) router.push(`/warehouse/web-products/${item.parentProductId}`);
                                                        }}
                                                    >
                                                        <img src={item.image || '/sku-placeholder.png'} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {(item.webProductId || item.parentProductId) ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/warehouse/web-products/${item.webProductId || item.parentProductId}`);
                                                            }}
                                                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline line-clamp-2 text-left transition-colors"
                                                        >
                                                            {item.name}
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-800 line-clamp-2">{item.name}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {item.variationId > 0 ? (
                                                        <span className="text-[9px] font-mono text-slate-500">{item.variationId}</span>
                                                    ) : (
                                                        <span className="text-[9px] text-slate-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    {item.linkedSkuId ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                router.push(`/warehouse/skus/${item.linkedSkuId}`);
                                                            }}
                                                            className="flex items-center space-x-1 text-[9px] font-mono text-blue-600 hover:text-blue-800 hover:underline transition-colors group"
                                                        >
                                                            <span className="truncate max-w-[80px]">{item.linkedSkuId}</span>
                                                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </button>
                                                    ) : (
                                                        <span className="text-[9px] text-slate-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center space-x-1">
                                                        {item.lotNumber ? (
                                                            <span className="text-[9px] font-mono text-slate-600">{item.lotNumber}</span>
                                                        ) : (
                                                            <span className="text-[9px] text-slate-300">N/A</span>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenLotModal(item);
                                                            }}
                                                            className="p-0.5 hover:bg-slate-100 transition-colors"
                                                            title="Select Lot"
                                                        >
                                                            <Edit2 className="w-3 h-3 text-slate-400 hover:text-blue-600" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-[9px] font-mono text-slate-500">{item.sku || '-'}</td>
                                                <td className="px-3 py-2 text-center">
                                                    <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-100 text-[9px] font-black text-slate-700">
                                                        {item.quantity}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-right text-[9px] font-mono text-slate-600">${item.price?.toFixed(2)}</td>
                                                <td className="px-3 py-2 text-right text-[10px] font-black font-mono text-slate-900">${item.total?.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {(!order.lineItems || order.lineItems.length === 0) && (
                                            <tr>
                                                <td colSpan={9} className="px-4 py-12 text-center text-[10px] text-slate-400">
                                                    No line items found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Meta Data Tab */}
                        {activeTab === 'Meta Data' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                        <tr>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[60px]">#</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[200px]">Key</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {order.metaData?.map((meta: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-2 text-[10px] font-mono text-slate-400">{idx + 1}</td>
                                                <td className="px-4 py-2 text-[10px] font-mono text-slate-600">{meta.key}</td>
                                                <td className="px-4 py-2 text-[10px] text-slate-700 max-w-[400px] truncate">
                                                    {typeof meta.value === 'object' ? JSON.stringify(meta.value) : String(meta.value)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.metaData || order.metaData.length === 0) && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-12 text-center text-[10px] text-slate-400">
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
                                    <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                        <tr>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[60px]">#</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right w-[120px]">Discount</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right w-[120px]">Discount Tax</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {order.couponLines?.map((coupon: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-2 text-[10px] font-mono text-slate-400">{idx + 1}</td>
                                                <td className="px-4 py-2">
                                                    <span className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 text-[10px] font-bold uppercase">
                                                        {coupon.code}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-right text-[11px] font-mono font-bold text-emerald-600">
                                                    -${parseFloat(coupon.discount || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-2 text-right text-[10px] font-mono text-slate-500">
                                                    ${parseFloat(coupon.discount_tax || coupon.discountTax || 0).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.couponLines || order.couponLines.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-12 text-center text-[10px] text-slate-400">
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
                                    <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                        <tr>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[80px]">ID</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Reason</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest w-[150px]">Date</th>
                                            <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right w-[120px]">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {order.refunds?.map((refund: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-rose-50/50 transition-colors">
                                                <td className="px-4 py-2 text-[10px] font-mono text-slate-600">#{refund.id}</td>
                                                <td className="px-4 py-2 text-[10px] text-slate-600">{refund.reason || '-'}</td>
                                                <td className="px-4 py-2 text-[10px] font-mono text-slate-500">
                                                    {refund.date_created ? new Date(refund.date_created).toLocaleString() : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-right text-[11px] font-mono font-bold text-rose-600">
                                                    -${Math.abs(parseFloat(refund.total || 0)).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(!order.refunds || order.refunds.length === 0) && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-12 text-center text-[10px] text-slate-400">
                                                    No refunds found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Footer */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Web Orders Console v2.0</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4 font-mono">
                    <span className="text-[9px] text-slate-300 uppercase tracking-tighter">Order Key: {order.orderKey}</span>
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
