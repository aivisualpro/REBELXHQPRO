'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    ExternalLink,
    Package,
    User,
    MapPin,
    CreditCard,
    Truck,
    Calendar,
    Clock,
    Hash,
    Mail,
    Phone,
    Receipt,
    Tag,
    Loader2,
    ShoppingBag,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

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
    attributes?: any[];
}

interface WebOrder {
    _id: string;
    webId: number;
    number: string;
    orderKey: string;
    status: string;
    currency: string;
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
    customerNote?: string;
    website: string;
    lineItems: LineItem[];
    shippingLines?: any[];
    couponLines?: any[];
    refunds?: any[];
}

export default function WebOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [order, setOrder] = useState<WebOrder | null>(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden bg-white">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-14 shadow-sm">
                <div className="flex items-center space-x-4">
                    <button onClick={() => router.back()} className="hover:bg-slate-100 transition-colors p-1.5 rounded-full group">
                        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-black" />
                    </button>
                    <div className="flex items-center space-x-3">
                        <span className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-widest shadow-sm",
                            getWebsiteColor(order.website)
                        )}>{order.website}</span>
                        <h1 className="text-base font-black text-slate-900 tracking-tight">Order #{order.number}</h1>
                        <span className={cn(
                            "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm",
                            getStatusColor(order.status)
                        )}>{order.status}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                    <span>WC-{order.webId}</span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left: Order Info */}
                <aside className="w-[340px] h-full overflow-y-auto border-r border-slate-100 bg-white shrink-0 scrollbar-custom">
                    <div className="p-6 space-y-8">
                        {/* Customer */}
                        <section>
                            <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                <User className="w-3.5 h-3.5 text-blue-500" />
                                <span>Customer</span>
                            </h3>
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
                                        <User className="w-5 h-5 text-slate-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">{order.billing?.firstName} {order.billing?.lastName}</p>
                                        {order.billing?.company && <p className="text-[10px] text-slate-500">{order.billing.company}</p>}
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-100 space-y-2">
                                    <div className="flex items-center space-x-2 text-[10px] text-slate-600">
                                        <Mail className="w-3 h-3 text-slate-400" />
                                        <span>{order.billing?.email}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-[10px] text-slate-600">
                                        <Phone className="w-3 h-3 text-slate-400" />
                                        <span>{order.billing?.phone || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Billing */}
                        <section>
                            <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                <Receipt className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Billing Address</span>
                            </h3>
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-[10px] text-slate-600 space-y-1">
                                <p className="font-bold text-slate-800">{order.billing?.firstName} {order.billing?.lastName}</p>
                                <p>{order.billing?.address1}</p>
                                {order.billing?.address2 && <p>{order.billing.address2}</p>}
                                <p>{order.billing?.city}, {order.billing?.state} {order.billing?.postcode}</p>
                                <p className="uppercase font-bold text-slate-400">{order.billing?.country}</p>
                            </div>
                        </section>

                        {/* Shipping */}
                        <section>
                            <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                <Truck className="w-3.5 h-3.5 text-orange-500" />
                                <span>Shipping Address</span>
                            </h3>
                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-[10px] text-slate-600 space-y-1">
                                <p className="font-bold text-slate-800">{order.shipping?.firstName} {order.shipping?.lastName}</p>
                                <p>{order.shipping?.address1}</p>
                                {order.shipping?.address2 && <p>{order.shipping.address2}</p>}
                                <p>{order.shipping?.city}, {order.shipping?.state} {order.shipping?.postcode}</p>
                                <p className="uppercase font-bold text-slate-400">{order.shipping?.country}</p>
                            </div>
                        </section>

                        {/* Payment */}
                        <section>
                            <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                                <span>Payment</span>
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase">Method</span>
                                    <span className="text-slate-900 font-bold">{order.paymentMethodTitle || order.paymentMethod}</span>
                                </div>
                                {order.transactionId && (
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-400 font-bold uppercase">Transaction ID</span>
                                        <span className="text-slate-600 font-mono">{order.transactionId}</span>
                                    </div>
                                )}
                                {order.datePaid && (
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-400 font-bold uppercase">Paid</span>
                                        <span className="text-slate-600 font-mono">{new Date(order.datePaid).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Dates */}
                        <section>
                            <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                <Calendar className="w-3.5 h-3.5 text-rose-500" />
                                <span>Timeline</span>
                            </h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase">Created</span>
                                    <span className="text-slate-600 font-mono">{order.dateCreated ? new Date(order.dateCreated).toLocaleString() : '-'}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase">Modified</span>
                                    <span className="text-slate-600 font-mono">{order.dateModified ? new Date(order.dateModified).toLocaleString() : '-'}</span>
                                </div>
                                {order.dateCompleted && (
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-slate-400 font-bold uppercase">Completed</span>
                                        <span className="text-slate-600 font-mono">{new Date(order.dateCompleted).toLocaleString()}</span>
                                    </div>
                                )}
                            </div>
                        </section>

                        {order.customerNote && (
                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-2">Customer Note</h3>
                                <p className="text-[10px] text-slate-600 italic bg-amber-50 p-3 rounded border border-amber-100">{order.customerNote}</p>
                            </section>
                        )}

                        <div className="h-10" />
                    </div>
                </aside>

                {/* Right: Line Items & Summary */}
                <main className="flex-1 h-full overflow-y-auto bg-white scrollbar-custom">
                    {/* Sticky Header */}
                    <div className="sticky top-0 z-[30] bg-white border-b border-slate-100 px-6 h-12 flex items-center justify-between shadow-sm">
                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center space-x-2">
                            <ShoppingBag className="w-4 h-4 text-blue-500" />
                            <span>Order Items</span>
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{order.lineItems?.length || 0} Items</span>
                    </div>

                    <div className="p-6 space-y-8">
                        {/* Line Items Table */}
                        <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">Product</th>
                                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest">SKU</th>
                                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Price</th>
                                        <th className="px-4 py-3 text-[8px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {order.lineItems?.map((item) => (
                                        <tr
                                            key={item.id}
                                            className={cn(
                                                "hover:bg-slate-50/50 transition-colors",
                                                item.parentProductId && "cursor-pointer"
                                            )}
                                            onClick={() => item.parentProductId && router.push(`/warehouse/web-products/${item.parentProductId}`)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 rounded border border-slate-100 bg-white overflow-hidden shrink-0">
                                                        <img src={item.image || '/sku-placeholder.png'} className="w-full h-full object-cover" alt="" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-slate-800">{item.name}</span>
                                                        {item.variationId > 0 && (
                                                            <span className="text-[8px] text-slate-400">Variation ID: {item.variationId}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[10px] font-mono text-slate-500">{item.sku || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-[10px] font-black text-slate-700">
                                                    {item.quantity}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-[10px] font-mono text-slate-600">${item.price?.toFixed(2)}</td>
                                            <td className="px-4 py-3 text-right text-[11px] font-black font-mono text-slate-900">${item.total?.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Order Summary */}
                        <div className="max-w-md ml-auto">
                            <div className="bg-slate-50 rounded-xl border border-slate-100 p-6 space-y-4">
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b border-slate-200 pb-3 mb-4">Order Summary</h4>
                                
                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Subtotal</span>
                                    <span className="font-bold text-slate-700 font-mono">${subtotal.toFixed(2)}</span>
                                </div>

                                {order.discountTotal > 0 && (
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-slate-500">Discount</span>
                                        <span className="font-bold text-emerald-600 font-mono">-${order.discountTotal.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Shipping</span>
                                    <span className="font-bold text-slate-700 font-mono">${order.shippingTotal?.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between text-[11px]">
                                    <span className="text-slate-500">Tax</span>
                                    <span className="font-bold text-slate-700 font-mono">${order.totalTax?.toFixed(2)}</span>
                                </div>

                                <div className="flex justify-between text-sm pt-4 border-t border-slate-200">
                                    <span className="font-black text-slate-900 uppercase tracking-tight">Total</span>
                                    <span className="font-black text-slate-900 text-lg font-mono">${order.total?.toFixed(2)}</span>
                                </div>

                                <div className="text-[9px] text-slate-400 uppercase tracking-widest text-right pt-2">
                                    Currency: {order.currency}
                                </div>
                            </div>
                        </div>

                        {/* Coupons */}
                        {order.couponLines && order.couponLines.length > 0 && (
                            <section>
                                <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center space-x-2">
                                    <Tag className="w-3.5 h-3.5 text-purple-500" />
                                    <span>Coupons Applied</span>
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {order.couponLines.map((coupon: any, idx: number) => (
                                        <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded text-[9px] font-bold uppercase">
                                            {coupon.code} (-${parseFloat(coupon.discount || 0).toFixed(2)})
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Refunds */}
                        {order.refunds && order.refunds.length > 0 && (
                            <section>
                                <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-3">Refunds</h4>
                                <div className="space-y-2">
                                    {order.refunds.map((refund: any, idx: number) => (
                                        <div key={idx} className="flex justify-between text-[10px] bg-rose-50 p-3 rounded border border-rose-100">
                                            <span className="text-rose-700">Refund #{refund.id}</span>
                                            <span className="font-bold text-rose-700">-${Math.abs(parseFloat(refund.total || 0)).toFixed(2)}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </main>
            </div>

            {/* Footer */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Web Orders Console v2.0</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4 font-mono">
                    <span className="text-[9px] text-slate-300 uppercase tracking-tighter">Order Key: {order.orderKey}</span>
                </div>
            </div>
        </div>
    );
}
