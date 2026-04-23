'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ArrowLeft, Package, Calendar, Building2, CreditCard, Truck, Plus, X, Trash2, Pencil, ChevronDown, AlertCircle, StickyNote, Send, Loader2 } from 'lucide-react';
import { cn, formatDate, toDateInputValue } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { CreateVendorModal } from '@/components/warehouse/CreateVendorModal';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { List } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';

interface LineItem {
    _id: string;
    sku: { _id: string; name: string } | string;
    lotNumber: string;
    qtyOrdered: number;
    qtyReceived: number;
    uom: string;
    cost: number;
    createdAt: string;
    createdBy?: { firstName: string; lastName: string } | string;
}

interface Note {
    _id: string;
    note: string;
    createdBy?: { _id: string; firstName: string; lastName: string } | string;
    createdAt: string;
}

interface PurchaseOrder {
    _id: string;
    label: string;
    vendor: { _id: string; name: string } | string;
    paymentTerms: string;
    createdBy?: { _id: string; firstName: string; lastName: string };
    status: string;
    scheduledDelivery: string;
    receivedDate: string;
    shippingCost: number;
    createdAt: string;
    lineItems?: LineItem[];
    notes?: Note[];
}

const UOM_OPTIONS = [
    { label: 'Each', value: 'Each' },
    { label: 'Box', value: 'Box' },
    { label: 'Case', value: 'Case' },
    { label: 'Pack', value: 'Pack' },
    { label: 'Pair', value: 'Pair' },
    { label: 'Set', value: 'Set' },
    { label: 'Roll', value: 'Roll' },
    { label: 'Kg', value: 'Kg' },
    { label: 'Lb', value: 'Lb' },
    { label: 'M', value: 'M' },
    { label: 'Ft', value: 'Ft' },
    { label: 'L', value: 'L' },
    { label: 'Gal', value: 'Gal' }
];

export default function PurchaseOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const highlightSku = searchParams.get('highlightSku');
    
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const { canDelete } = usePermissions();

    // Item Modal State
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [allSkus, setAllSkus] = useState<{ _id: string; name: string }[]>([]);
    const [formData, setFormData] = useState({
        sku: '',
        qtyOrdered: 1,
        qtyReceived: 0,
        cost: 0,
        uom: '',
        lotNumber: ''
    });

    // Lot Selection Modal State
    const [isLotSelectorOpen, setIsLotSelectorOpen] = useState(false);

    // Delete Confirmation State
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; itemId: string | null }>({
        isOpen: false,
        itemId: null
    });

    // Header portal
    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);

    // Edit header modal
    const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
    const [editingHeader, setEditingHeader] = useState<any>(null);
    const [allVendors, setAllVendors] = useState<{ _id: string; name: string }[]>([]);
    const [isCreateVendorOpen, setIsCreateVendorOpen] = useState(false);
    const [vendorSearchVal, setVendorSearchVal] = useState('');

    // Tab state
    const [activeTab, setActiveTab] = useState<'lineItems' | 'notes'>('lineItems');

    // Notes state
    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingNoteText, setEditingNoteText] = useState('');

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/purchase-orders/${params.id}`);
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

    // ─── Notes CRUD ───────────────────────────────────────────────────────

    const handleAddNote = async () => {
        if (!order || !newNote.trim()) return;
        setSavingNote(true);
        try {
            const res = await fetch(`/api/purchase-orders/${order._id}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: newNote.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setNotes(data.notes || []);
                setNewNote('');
                toast.success('Note added');
            } else {
                toast.error('Failed to add note');
            }
        } catch {
            toast.error('Error adding note');
        } finally {
            setSavingNote(false);
        }
    };

    const handleEditNote = async (noteId: string) => {
        if (!order || !editingNoteText.trim()) return;
        try {
            const res = await fetch(`/api/purchase-orders/${order._id}/notes`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteId, note: editingNoteText.trim() }),
            });
            if (res.ok) {
                const data = await res.json();
                setNotes(data.notes || []);
                setEditingNoteId(null);
                setEditingNoteText('');
                toast.success('Note updated');
            } else {
                toast.error('Failed to update note');
            }
        } catch {
            toast.error('Error updating note');
        }
    };

    const handleDeleteNote = async (noteId: string) => {
        if (!order) return;
        try {
            const res = await fetch(`/api/purchase-orders/${order._id}/notes?noteId=${noteId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                const data = await res.json();
                setNotes(data.notes || []);
                toast.success('Note deleted');
            } else {
                toast.error('Failed to delete note');
            }
        } catch {
            toast.error('Error deleting note');
        }
    };

    useEffect(() => {
        if (params.id) {
            fetchOrder();
        }
    }, [params.id]);

    // Sync notes from order
    useEffect(() => {
        if (order?.notes) {
            setNotes(order.notes);
        }
    }, [order]);

    useEffect(() => {
        const target = document.getElementById('header-portal-target');
        if (target) setHeaderPortal(target);
    }, [loading]);

    useEffect(() => {
        if (isItemModalOpen && allSkus.length === 0) {
            const fetchSkus = async () => {
                try {
                    const res = await fetch('/api/skus?limit=0&ignoreDate=true&simple=true');
                    if (res.ok) {
                        const data = await res.json();
                        setAllSkus(data.skus || []);
                    }
                } catch (e) {
                    console.error("Failed to fetch SKUs", e);
                }
            };
            fetchSkus();
        }
    }, [isItemModalOpen, allSkus.length]);

    useEffect(() => {
        if (isHeaderModalOpen && allVendors.length === 0) {
            fetch('/api/vendors?limit=500')
                .then(res => res.json())
                .then(data => setAllVendors(data.vendors || []))
                .catch(() => { });
        }
    }, [isHeaderModalOpen, allVendors.length]);

    const handleOpenAddModal = () => {
        setEditingId(null);
        setFormData({ sku: '', qtyOrdered: 1, qtyReceived: 0, cost: 0, uom: '', lotNumber: '' });
        setIsItemModalOpen(true);
    };

    const handleOpenEditModal = (item: LineItem) => {
        setEditingId(item._id);
        setFormData({
            sku: (typeof item.sku === 'object' && item.sku !== null) ? item.sku._id : (item.sku || ''),
            qtyOrdered: item.qtyOrdered,
            qtyReceived: item.qtyReceived || 0,
            cost: item.cost,
            uom: item.uom || '',
            lotNumber: item.lotNumber || ''
        });
        setIsItemModalOpen(true);
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!order) return;
        if (!formData.sku) {
            toast.error('Please select a SKU');
            return;
        }

        let currentItems = (order.lineItems || []).map(item => ({
            _id: item._id,
            sku: (typeof item.sku === 'object' && item.sku !== null) ? item.sku._id : (item.sku || ''),
            qtyOrdered: item.qtyOrdered,
            cost: item.cost,
            uom: item.uom,
            lotNumber: item.lotNumber,
            qtyReceived: item.qtyReceived
        }));

        if (editingId) {
            currentItems = currentItems.map(item => {
                if (item._id === editingId) {
                    return {
                        ...item,
                        sku: formData.sku,
                        qtyOrdered: formData.qtyOrdered,
                        qtyReceived: formData.qtyReceived,
                        cost: formData.cost,
                        uom: formData.uom,
                        lotNumber: formData.lotNumber
                    };
                }
                return item;
            });
        } else {
            const newItem = {
                sku: formData.sku,
                qtyOrdered: formData.qtyOrdered,
                cost: formData.cost,
                uom: formData.uom,
                qtyReceived: 0,
                lotNumber: formData.lotNumber,
            };
            // @ts-ignore
            currentItems.push(newItem);
        }

        try {
            const res = await fetch(`/api/purchase-orders/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineItems: currentItems })
            });

            if (res.ok) {
                toast.success(editingId ? 'Item updated' : 'Item added');
                setIsItemModalOpen(false);
                fetchOrder();
            } else {
                toast.error('Failed to save item');
            }
        } catch (e) {
            toast.error('Error saving item');
        }
    };

    const handleDeleteClick = (itemId: string) => {
        setDeleteConfirm({ isOpen: true, itemId });
    };

    const confirmDelete = async () => {
        const { itemId } = deleteConfirm;
        if (!itemId || !order) return;

        const updatedItems = (order.lineItems || [])
            .filter(item => item._id !== itemId)
            .map(item => ({
                _id: item._id,
                sku: (typeof item.sku === 'object' && item.sku !== null) ? item.sku._id : (item.sku || ''),
                qtyOrdered: item.qtyOrdered,
                cost: item.cost,
                uom: item.uom,
                lotNumber: item.lotNumber,
                qtyReceived: item.qtyReceived
            }));

        try {
            const res = await fetch(`/api/purchase-orders/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineItems: updatedItems })
            });

            if (res.ok) {
                toast.success('Item deleted');
                fetchOrder();
                setDeleteConfirm({ isOpen: false, itemId: null });
            } else {
                toast.error('Failed to delete item');
            }
        } catch (e) {
            toast.error('Error deleting item');
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!order) return;
        const loadId = toast.loading('Updating status...');

        try {
            const res = await fetch(`/api/purchase-orders/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                toast.success('Status updated', { id: loadId });
                fetchOrder();
            } else {
                toast.error('Failed to update status', { id: loadId });
            }
        } catch (e) {
            toast.error('Error updating status', { id: loadId });
        }
    };

    const handleSaveHeader = async () => {
        if (!order || !editingHeader) return;
        try {
            const res = await fetch(`/api/purchase-orders/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editingHeader)
            });
            if (res.ok) {
                const data = await res.json();
                setOrder(data);
                toast.success('Order details updated');
                setIsHeaderModalOpen(false);
            }
        } catch (e) {
            toast.error('Failed to update order');
        }
    };

    const handleDeleteOrder = () => {
        if (!order) return;
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
                                const res = await fetch(`/api/purchase-orders/${order._id}`, {
                                    method: 'DELETE'
                                });
                                if (res.ok) {
                                    toast.success('Order deleted');
                                    router.push('/warehouse/purchase-orders');
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




    const formatCurrency = (val: number) => {
        if (val === undefined || val === null) return '-';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    };

    const renderVendor = (val: { _id: string; name: string } | string) => {
        if (typeof val === 'object' && val !== null) {
            return (
                <span
                    onClick={() => router.push(`/warehouse/vendors/${val._id}`)}
                    className="hover:text-blue-500 hover:underline cursor-pointer transition-colors"
                >
                    {val.name}
                </span>
            );
        }
        return val || '-';
    };

    const totalQtyOrdered = order.lineItems?.reduce((sum, item) => sum + (item.qtyOrdered || 0), 0) || 0;
    const totalQtyReceived = order.lineItems?.reduce((sum, item) => sum + (item.qtyReceived || 0), 0) || 0;
    const totalAmount = order.lineItems?.reduce((sum, item) => sum + ((item.qtyOrdered || 0) * (item.cost || 0)), 0) || 0;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Received': return "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30";
            case 'Ordered': return "bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/30";
            case 'Partial': return "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30";
            case 'Pending': return "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border-orange-500/30";
            default: return "bg-secondary text-muted-foreground border-border";
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative transition-colors duration-300">
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
                <div className="w-[30%] border-r border-border bg-secondary flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Identity Boxes */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="border border-border rounded-md p-3 bg-background text-center flex items-center justify-center">
                                <div className="text-base font-black text-amber-500 tracking-tight font-mono">{order.label || order._id.slice(-6)}</div>
                            </div>
                            <div className="border border-border rounded-md p-3 bg-background text-center flex items-center justify-center">
                                <div className="text-[11px] font-bold text-foreground break-words">{renderVendor(order.vendor)}</div>
                            </div>
                            <div className={cn(
                                "border rounded-md p-3 text-center flex items-center justify-center transition-colors",
                                getStatusColor(order.status)
                            )}>
                                <select
                                    value={order.status}
                                    onChange={(e) => handleStatusChange(e.target.value)}
                                    className="text-[10px] font-black uppercase tracking-wider cursor-pointer outline-none appearance-none bg-transparent px-1 py-0.5 w-full text-center text-inherit border-none"
                                >
                                    <option value="Draft">Draft</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Ordered">Ordered</option>
                                    <option value="Partial">Partial</option>
                                    <option value="Received">Received</option>
                                </select>
                            </div>
                        </div>

                        {/* Detail Rows */}
                        <div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Payment Terms</div>
                                    <div className="text-xs font-medium text-foreground">{order.paymentTerms || '-'}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Created By</div>
                                    <div className="text-xs font-medium text-foreground">{order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-'}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Created At</div>
                                    <div className="text-xs font-medium text-foreground">{formatDate(order.createdAt)}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Sched. Delivery</div>
                                    <div className="text-xs font-medium text-foreground">{formatDate(order.scheduledDelivery)}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Received Date</div>
                                    <div className="text-xs font-medium text-foreground">{formatDate(order.receivedDate)}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Shipping Cost</div>
                                    <div className="text-xs font-medium text-emerald-500 font-mono">{order.shippingCost ? formatCurrency(order.shippingCost) : '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Order Summary */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-4 border-b border-border pb-2">Order Summary</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Total Items</span>
                                    <span className="text-sm font-mono font-medium text-foreground">{order.lineItems?.length || 0}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Qty Ordered</span>
                                    <span className="text-sm font-mono font-medium text-foreground">{totalQtyOrdered.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Qty Received</span>
                                    <span className="text-sm font-mono font-medium text-emerald-600">{totalQtyReceived.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Subtotal</span>
                                    <span className="text-sm font-mono font-medium text-foreground">{formatCurrency(totalAmount)}</span>
                                </div>
                                {(order.shippingCost || 0) > 0 && (
                                    <div className="flex justify-between items-center group">
                                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Shipping</span>
                                        <span className="text-sm font-mono font-medium text-emerald-500">{formatCurrency(order.shippingCost)}</span>
                                    </div>
                                )}
                                <div className="pt-3 mt-3 border-t border-border flex justify-between items-center">
                                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">Grand Total</span>
                                    <span className="text-base font-mono font-bold text-foreground">
                                        {formatCurrency(totalAmount + (order.shippingCost || 0))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        <button
                            onClick={() => {
                                setEditingHeader({
                                    vendor: typeof order.vendor === 'object' && order.vendor ? order.vendor._id : order.vendor,
                                    paymentTerms: order.paymentTerms || '',
                                    status: order.status,
                                    scheduledDelivery: toDateInputValue(order.scheduledDelivery),
                                    receivedDate: toDateInputValue(order.receivedDate),
                                    shippingCost: order.shippingCost || 0,
                                });
                                setIsHeaderModalOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary transition-colors cursor-pointer"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </button>
                        {canDelete() && (
                            <button
                                onClick={handleDeleteOrder}
                                disabled={isDeleting}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Right Content: Line Items (70%) */}
                <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                    {/* Tab Header & Actions */}
                    <div className="px-4 border-b border-border shrink-0 flex items-center justify-between bg-background z-10 h-9">
                        <div className="flex space-x-1 h-full">
                            <button
                                onClick={() => setActiveTab('lineItems')}
                                className={cn(
                                    'px-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5 cursor-pointer',
                                    activeTab === 'lineItems' ? 'text-foreground border-foreground' : 'text-muted-foreground border-transparent hover:text-foreground/70'
                                )}
                            >
                                <span>Line Items</span>
                                <span className={cn(
                                    'px-1.5 py-0.5 rounded-none text-[9px] font-bold',
                                    activeTab === 'lineItems' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                                )}>
                                    {order.lineItems?.length || 0}
                                </span>
                            </button>
                            <button
                                onClick={() => setActiveTab('notes')}
                                className={cn(
                                    'px-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5 cursor-pointer',
                                    activeTab === 'notes' ? 'text-foreground border-foreground' : 'text-muted-foreground border-transparent hover:text-foreground/70'
                                )}
                            >
                                <StickyNote className="w-3 h-3" />
                                <span>Notes</span>
                                {notes.length > 0 && (
                                    <span className={cn(
                                        'px-1.5 py-0.5 rounded-none text-[9px] font-bold',
                                        activeTab === 'notes' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                                    )}>
                                        {notes.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {activeTab === 'lineItems' && (
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={handleOpenAddModal}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-[#fe9900] text-black hover:bg-[#d9a318] transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Item</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {activeTab === 'lineItems' ? (
                            /* Line Items Table */
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary border-y border-border sticky top-0 z-20">
                                        <tr>
                                            {['SKU', 'Lot #', 'UOM', 'Qty Ordered', 'Qty Received', 'Cost', 'Amount', 'Actions'].map(col => (
                                                <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(!order.lineItems || order.lineItems.length === 0) ? (
                                            <tr>
                                                <td colSpan={8} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No line items</td>
                                            </tr>
                                        ) : order.lineItems.map(item => {
                                            const skuName = (typeof item.sku === 'object' && item.sku !== null) ? item.sku?.name : (item.sku || '-');
                                            const skuId = (typeof item.sku === 'object' && item.sku !== null) ? item.sku._id : item.sku;
                                            const amount = (item.qtyOrdered || 0) * (item.cost || 0);

                                            return (
                                                <tr
                                                    key={item._id}
                                                    className={cn(
                                                        "transition-all duration-700 group",
                                                        highlightSku && skuId === highlightSku 
                                                            ? "bg-indigo-500/20 border-l-4 border-l-indigo-500 hover:bg-indigo-500/30" 
                                                            : "hover:bg-secondary border-l-4 border-l-transparent"
                                                    )}
                                                    ref={(el) => {
                                                        if (el && highlightSku && skuId === highlightSku && !el.dataset.scrolled) {
                                                            el.dataset.scrolled = "true";
                                                            setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                                                        }
                                                    }}
                                                >
                                                    <td className="px-3 py-1.5 text-[10px] text-foreground">
                                                        <span
                                                            onClick={() => router.push(`/warehouse/skus/${skuId}`)}
                                                            className="hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                                                        >
                                                            {skuName || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{item.lotNumber || '-'}</td>
                                                    <td className="px-3 py-1.5 text-[10px] uppercase font-bold text-muted-foreground">{item.uom || '-'}</td>
                                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{item.qtyOrdered?.toFixed(4) ?? '-'}</td>
                                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{item.qtyReceived?.toFixed(4) ?? '-'}</td>
                                                    <td className="px-3 py-1.5 text-[10px] text-emerald-500 font-mono font-bold">{formatCurrency(item.cost)}</td>
                                                    <td className="px-3 py-1.5 text-[10px] font-bold text-foreground font-mono">{formatCurrency(amount)}</td>
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex items-center space-x-1">
                                                            <button
                                                                onClick={() => handleOpenEditModal(item)}
                                                                className="p-1 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors rounded cursor-pointer"
                                                                title="Edit"
                                                            >
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </button>
                                                            {canDelete() && (
                                                                <button
                                                                    onClick={() => handleDeleteClick(item._id)}
                                                                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded cursor-pointer"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {order.lineItems && order.lineItems.length > 0 && (
                                        <tfoot className="bg-secondary border-t border-border">
                                            <tr>
                                                <td colSpan={3} className="px-3 py-1.5 text-[9px] font-bold text-muted-foreground uppercase text-right tracking-wider">Subtotal</td>
                                                <td className="px-3 py-1.5 text-[10px] font-bold text-foreground font-mono">{totalQtyOrdered.toFixed(4)}</td>
                                                <td className="px-3 py-1.5 text-[10px] font-bold text-foreground font-mono">{totalQtyReceived.toFixed(4)}</td>
                                                <td className="px-3 py-1.5"></td>
                                                <td className="px-3 py-1.5 text-[10px] font-black text-foreground font-mono">{formatCurrency(totalAmount)}</td>
                                                <td className="px-3 py-1.5"></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        ) : (
                            /* Notes Panel */
                            <div className="flex flex-col h-full">
                                {/* Notes List */}
                                <div className="flex-1 overflow-auto p-4 space-y-3">
                                    {notes.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/50">
                                            <StickyNote className="w-10 h-10 mb-3 opacity-30" />
                                            <p className="text-[11px] font-bold uppercase tracking-widest">No notes yet</p>
                                            <p className="text-[10px] mt-1">Add a note below to get started</p>
                                        </div>
                                    ) : (
                                        [...notes].reverse().map((n) => {
                                            const author = typeof n.createdBy === 'object' && n.createdBy
                                                ? `${n.createdBy.firstName} ${n.createdBy.lastName}`
                                                : (n.createdBy || 'Unknown');
                                            const initials = typeof n.createdBy === 'object' && n.createdBy
                                                ? `${n.createdBy.firstName?.[0] || ''}${n.createdBy.lastName?.[0] || ''}`
                                                : '??';

                                            return (
                                                <div key={n._id} className="group bg-secondary border border-border/60 rounded-lg p-3 hover:border-border transition-colors">
                                                    <div className="flex items-start gap-3">
                                                        {/* Avatar */}
                                                        <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-black uppercase shrink-0 mt-0.5">
                                                            {initials}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            {/* Author & Time */}
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-bold text-foreground">{author}</span>
                                                                <span className="text-[9px] text-muted-foreground/50">•</span>
                                                                <span className="text-[9px] text-muted-foreground/60">{formatDate(n.createdAt)}</span>
                                                            </div>
                                                            {/* Note Content */}
                                                            {editingNoteId === n._id ? (
                                                                <div className="flex gap-2 mt-1">
                                                                    <input
                                                                        type="text"
                                                                        value={editingNoteText}
                                                                        onChange={(e) => setEditingNoteText(e.target.value)}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') handleEditNote(n._id); if (e.key === 'Escape') { setEditingNoteId(null); setEditingNoteText(''); } }}
                                                                        className="flex-1 px-2 py-1 border border-border rounded text-[11px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                                        autoFocus
                                                                    />
                                                                    <button onClick={() => handleEditNote(n._id)} className="px-2 py-1 text-[9px] font-bold uppercase bg-primary text-black rounded hover:opacity-90 cursor-pointer">Save</button>
                                                                    <button onClick={() => { setEditingNoteId(null); setEditingNoteText(''); }} className="px-2 py-1 text-[9px] font-bold uppercase text-muted-foreground hover:text-foreground border border-border rounded cursor-pointer">Cancel</button>
                                                                </div>
                                                            ) : (
                                                                <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-wrap">{n.note}</p>
                                                            )}
                                                        </div>
                                                        {/* Actions */}
                                                        {editingNoteId !== n._id && (
                                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                <button
                                                                    onClick={() => { setEditingNoteId(n._id); setEditingNoteText(n.note); }}
                                                                    className="p-1 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded transition-colors cursor-pointer"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteNote(n._id)}
                                                                    className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"
                                                                    title="Delete"
                                                                >
                                                                    <Trash2 className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Add Note Input */}
                                <div className="border-t border-border px-4 py-3 bg-secondary shrink-0">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={newNote}
                                            onChange={(e) => setNewNote(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' && newNote.trim()) handleAddNote(); }}
                                            placeholder="Type a note..."
                                            className="flex-1 px-3 h-9 border border-border rounded-lg text-[12px] bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                        />
                                        <button
                                            onClick={handleAddNote}
                                            disabled={!newNote.trim() || savingNote}
                                            className="h-9 px-4 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                                        >
                                            {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                                            <span>Add</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Line Item Modal */}
            {isItemModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-background border border-border rounded shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 h-12 border-b border-border bg-secondary">
                            <h2 className="text-sm font-bold uppercase text-foreground tracking-wider">{editingId ? 'Edit Line Item' : 'Add Line Item'}</h2>
                            <button onClick={() => setIsItemModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-6 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">SKU</label>
                                <SearchableSelect
                                    triggerClassName="h-[38px]"
                                    options={allSkus
                                        .filter(s => {
                                            const isUsed = order?.lineItems?.some(item => {
                                                if (editingId && item._id === editingId) return false;
                                                const itemId = (typeof item.sku === 'object' && item.sku !== null) ? item.sku._id : (item.sku || '');
                                                return itemId === s._id;
                                            });
                                            return !isUsed;
                                        })
                                        .map(s => ({ value: s._id, label: s.name }))
                                    }
                                    value={formData.sku}
                                    onChange={(val) => setFormData({ ...formData, sku: val })}
                                    placeholder="Select SKU..."
                                    className="w-full"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Lot #</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.lotNumber}
                                        onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                                        className="w-full px-3 py-2 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                                        placeholder="Optional"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!formData.sku) {
                                                toast.error('Please select a SKU first');
                                                return;
                                            }
                                            setIsLotSelectorOpen(true);
                                        }}
                                        className="p-2 bg-secondary hover:bg-secondary text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                                        title="Select from Inventory"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">UOM</label>
                                    <SearchableSelect
                                        triggerClassName="h-[38px]"
                                        options={UOM_OPTIONS}
                                        value={formData.uom}
                                        onChange={(val) => setFormData({ ...formData, uom: val })}
                                        placeholder="UOM"
                                        creatable
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.qtyOrdered}
                                        onChange={(e) => setFormData({ ...formData, qtyOrdered: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Received</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.qtyReceived}
                                        onChange={(e) => setFormData({ ...formData, qtyReceived: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Cost</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.00000001"
                                            value={formData.cost}
                                            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-6 pr-3 py-2 border border-border rounded text-sm bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary/20"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase rounded hover:opacity-90 transition-colors cursor-pointer"
                                >
                                    {editingId ? 'Save Changes' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Header Modal */}
            {isHeaderModalOpen && editingHeader && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-background border border-border rounded shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 h-[36px] border-b border-border bg-secondary">
                            <h2 className="text-sm font-black uppercase text-foreground tracking-widest">Edit Order Details</h2>
                            <button onClick={() => setIsHeaderModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Vendor <span className="text-red-500">*</span></label>
                                    <SearchableSelect
                                        triggerClassName="h-[36px]"
                                        options={allVendors.map(v => ({ value: v._id, label: v.name }))}
                                        value={editingHeader.vendor || ''}
                                        onChange={(val) => {
                                            const existing = allVendors.find(v => v._id === val || v.name.toLowerCase() === val.toLowerCase());
                                            if (!existing && val) {
                                                setVendorSearchVal(val);
                                                setIsCreateVendorOpen(true);
                                            } else {
                                                setEditingHeader({ ...editingHeader, vendor: val });
                                            }
                                        }}
                                        placeholder="Select Vendor..."
                                        creatable
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Status</label>
                                    <select
                                        value={editingHeader.status || ''}
                                        onChange={(e) => setEditingHeader({ ...editingHeader, status: e.target.value })}
                                        className="w-full px-3 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Received">Received</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Payment Terms</label>
                                    <SearchableSelect
                                        triggerClassName="h-[36px]"
                                        options={[
                                            { label: 'Net 15', value: 'Net 15' },
                                            { label: 'Net 30', value: 'Net 30' },
                                            { label: 'Net 60', value: 'Net 60' },
                                            { label: 'Due on Receipt', value: 'Due on Receipt' },
                                            { label: 'ACH', value: 'ACH' },
                                            { label: 'CC', value: 'CC' },
                                            { label: 'ACH-Already Paid', value: 'ACH-Already Paid' },
                                            { label: 'Credit Card', value: 'Credit Card' }
                                        ]}
                                        value={editingHeader.paymentTerms || ''}
                                        onChange={(val) => setEditingHeader({ ...editingHeader, paymentTerms: val })}
                                        placeholder="Select Terms..."
                                        creatable
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Sched. Delivery</label>
                                    <input
                                        type="date"
                                        value={editingHeader.scheduledDelivery || ''}
                                        onChange={(e) => setEditingHeader({ ...editingHeader, scheduledDelivery: e.target.value })}
                                        className="w-full px-3 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Received Date</label>
                                    <input
                                        type="date"
                                        value={editingHeader.receivedDate || ''}
                                        onChange={(e) => setEditingHeader({ ...editingHeader, receivedDate: e.target.value })}
                                        className="w-full px-3 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Shipping Cost</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={editingHeader.shippingCost || ''}
                                            onChange={(e) => setEditingHeader({ ...editingHeader, shippingCost: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-6 pr-3 h-[36px] border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 bg-background text-foreground font-mono"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button
                                    onClick={handleSaveHeader}
                                    className="w-full h-[28px] bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded hover:opacity-90 transition-all shadow-md cursor-pointer"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Line Item Confirmation Modal */}
            {deleteConfirm.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-background border border-border rounded shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-5 h-5 text-destructive" />
                            </div>
                            <h3 className="text-sm font-bold text-foreground uppercase mb-2">Confirm Delete</h3>
                            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                                Are you sure you want to delete this line item? This action cannot be undone.
                            </p>
                            <div className="flex items-center justify-center space-x-3">
                                <button
                                    onClick={() => setDeleteConfirm({ isOpen: false, itemId: null })}
                                    className="px-4 py-2 border border-border rounded text-xs font-bold text-muted-foreground uppercase hover:bg-secondary transition-colors min-w-[80px] cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 bg-destructive text-destructive-foreground rounded text-xs font-bold uppercase hover:opacity-90 transition-colors min-w-[80px] cursor-pointer"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <LotSelectionModal
                isOpen={isLotSelectorOpen}
                onClose={() => setIsLotSelectorOpen(false)}
                onSelect={(lot) => {
                    setFormData(prev => ({ ...prev, lotNumber: lot }));
                    setIsLotSelectorOpen(false);
                }}
                skuId={formData.sku}
                currentLotNumber={formData.lotNumber}
            />

            {isCreateVendorOpen && (
                <CreateVendorModal
                    initialName={vendorSearchVal}
                    onClose={() => setIsCreateVendorOpen(false)}
                    onSuccess={(newVendor) => {
                        setAllVendors((prev) => [...prev, newVendor]);
                        setEditingHeader((prev: any) => ({ ...prev, vendor: newVendor._id }));
                    }}
                />
            )}
        </div>
    );
}
