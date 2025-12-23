'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, Calendar, Building2, CreditCard, Truck, Plus, X, Trash2, Pencil, ChevronDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal'; // Import
import { List } from 'lucide-react';

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

interface PurchaseOrder {
    _id: string;
    label: string;
    vendor: { _id: string; name: string } | string;
    paymentTerms: string;
    createdBy?: { _id: string; firstName: string; lastName: string };
    status: string;
    scheduledDelivery: string;
    receivedDate: string;
    createdAt: string;
    lineItems?: LineItem[];
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
    const [order, setOrder] = useState<PurchaseOrder | null>(null);
    const [loading, setLoading] = useState(true);

    // Item Modal State
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [allSkus, setAllSkus] = useState<{ _id: string; name: string }[]>([]);
    const [formData, setFormData] = useState({
        sku: '',
        qtyOrdered: 1,
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

    useEffect(() => {
        if (params.id) {
            fetchOrder();
        }
    }, [params.id]);

    useEffect(() => {
        if (isItemModalOpen && allSkus.length === 0) {
            const fetchSkus = async () => {
                try {
                    const res = await fetch('/api/skus?limit=1000');
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

    const handleOpenAddModal = () => {
        setEditingId(null);
        setFormData({ sku: '', qtyOrdered: 1, cost: 0, uom: '', lotNumber: '' });
        setIsItemModalOpen(true);
    };

    const handleOpenEditModal = (item: LineItem) => {
        setEditingId(item._id);
        setFormData({
            sku: typeof item.sku === 'object' ? item.sku._id : item.sku,
            qtyOrdered: item.qtyOrdered,
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
            sku: typeof item.sku === 'object' ? item.sku._id : item.sku,
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
                sku: typeof item.sku === 'object' ? item.sku._id : item.sku,
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

    const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        if (!order) return;
        const newStatus = e.target.value;

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


    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <div className="text-sm text-slate-400">Loading...</div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <div className="text-sm text-slate-400">Order not found</div>
            </div>
        );
    }

    // Date Format: MM/DD/YYYY
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    };

    const formatCurrency = (val: number, decimals: number = 2) => {
        if (val === undefined || val === null) return '-';
        return '$' + val.toFixed(decimals);
    };

    const renderVendor = (val: { _id: string; name: string } | string) => {
        if (typeof val === 'object' && val !== null) {
            return val.name;
        }
        return val || '-';
    };

    const totalQtyOrdered = order.lineItems?.reduce((sum, item) => sum + (item.qtyOrdered || 0), 0) || 0;
    const totalQtyReceived = order.lineItems?.reduce((sum, item) => sum + (item.qtyReceived || 0), 0) || 0;
    const totalAmount = order.lineItems?.reduce((sum, item) => sum + ((item.qtyOrdered || 0) * (item.cost || 0)), 0) || 0;

    const infoRows = [
        [
            { label: 'Vendor', value: order ? renderVendor(order.vendor) : '-' },
            { label: 'Status', value: order?.status || '-' },
        ],
        [
            { label: 'Payment Terms', value: order.paymentTerms || '-' },
            { label: 'Created By', value: order.createdBy ? `${order.createdBy.firstName} ${order.createdBy.lastName}` : '-' },
        ],
        [
            { label: 'Scheduled Delivery', value: formatDate(order.scheduledDelivery) },
            { label: 'Received Date', value: formatDate(order.receivedDate) },
        ],
        [
            { label: 'Created At', value: formatDate(order.createdAt) },
            { label: 'Total Amount', value: formatCurrency(totalAmount, 2) },
        ],
    ];

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Received': return "bg-green-100 text-green-700";
            case 'Ordered': return "bg-blue-100 text-blue-700";
            case 'Partial': return "bg-yellow-100 text-yellow-700";
            case 'Pending': return "bg-orange-100 text-orange-700";
            default: return "bg-slate-100 text-slate-600";
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-2 text-sm">
                    <button onClick={() => router.push('/warehouse/purchase-orders')} className="text-slate-500 hover:text-black transition-colors">
                        Purchase Orders
                    </button>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">{order.label || order._id}</span>
                </div>
                <button onClick={() => router.back()} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold uppercase text-slate-500 hover:text-black hover:bg-slate-100 transition-colors rounded">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                </button>
            </div>

            <div className="px-6 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center">
                            <Truck className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight">PO #{order.label || order._id}</h1>
                            <p className="text-[11px] text-slate-400 uppercase tracking-widest">{renderVendor(order.vendor)}</p>
                        </div>
                    </div>
                    <div className="relative">
                        <select
                            value={order.status}
                            onChange={handleStatusChange}
                            className={cn(
                                "py-1.5 pl-3 pr-8 rounded text-xs font-bold uppercase cursor-pointer outline-none appearance-none transition-colors border-0",
                                getStatusColor(order.status)
                            )}
                        >
                            <option value="Pending">Pending</option>
                            <option value="Received">Received</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-50" />
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 border-b border-slate-100">
                <div className="grid grid-cols-4 gap-y-3 gap-x-8">
                    {infoRows.map((row, rowIdx) => (
                        <React.Fragment key={rowIdx}>
                            {row.map((item, colIdx) => (
                                <React.Fragment key={colIdx}>
                                    <div className="text-[11px] text-slate-400 uppercase tracking-wider">{item.label}</div>
                                    <div className="text-sm font-medium text-slate-700">{item.value}</div>
                                </React.Fragment>
                            ))}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <h3 className="text-xs font-bold uppercase text-slate-400 tracking-widest">
                            Line Items ({order.lineItems?.length || 0})
                        </h3>
                        <button onClick={handleOpenAddModal} className="flex items-center space-x-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase transition-colors">
                            <Plus className="w-3 h-3" />
                            <span>Add Item</span>
                        </button>
                    </div>
                    {/* Totals block removed here */}
                </div>
                <table className="w-full border-collapse text-left">
                    <thead className="bg-slate-50 border-y border-slate-100">
                        <tr>
                            {['SKU', 'Lot Number', 'UOM', 'Qty Ordered', 'Qty Received', 'Cost', 'Amount'].map(col => (
                                <th key={col} className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                    {col}
                                </th>
                            ))}
                            <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {(!order.lineItems || order.lineItems.length === 0) ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400 uppercase">No line items</td>
                            </tr>
                        ) : order.lineItems.map(item => {
                            const skuName = typeof item.sku === 'object' ? item.sku?.name : item.sku;
                            const amount = (item.qtyOrdered || 0) * (item.cost || 0);

                            return (
                                <tr key={item._id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-4 py-2 text-[11px] font-medium text-slate-700">{skuName || '-'}</td>
                                    <td className="px-4 py-2 text-[11px] text-slate-600">{item.lotNumber || '-'}</td>
                                    <td className="px-4 py-2 text-[10px] uppercase font-bold text-slate-500">{item.uom || '-'}</td>
                                    <td className="px-4 py-2 text-[11px] text-slate-600">{item.qtyOrdered?.toFixed(4) ?? '-'}</td>
                                    <td className="px-4 py-2 text-[11px] text-slate-600">{item.qtyReceived?.toFixed(4) ?? '-'}</td>
                                    <td className="px-4 py-2 text-[11px] text-slate-600">{formatCurrency(item.cost, 8)}</td>
                                    <td className="px-4 py-2 text-[11px] font-bold text-slate-700">{formatCurrency(amount, 2)}</td>
                                    <td className="px-4 py-2 text-center">
                                        <div className="flex items-center justify-center space-x-1 opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenEditModal(item)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors rounded hover:bg-slate-200"
                                                title="Edit"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(item._id)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 transition-colors rounded hover:bg-slate-200"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    {order.lineItems && order.lineItems.length > 0 && (
                        <tfoot className="bg-slate-50 border-t border-slate-200">
                            <tr>
                                <td colSpan={3} className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase text-right">Totals</td>
                                <td className="px-4 py-2 text-[11px] font-bold text-slate-700">{totalQtyOrdered.toFixed(4)}</td>
                                <td className="px-4 py-2 text-[11px] font-bold text-slate-700">{totalQtyReceived.toFixed(4)}</td>
                                <td className="px-4 py-2"></td>
                                <td className="px-4 py-2 text-[11px] font-black text-slate-900">{formatCurrency(totalAmount, 2)}</td>
                                <td className="px-4 py-2"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {isItemModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <h2 className="text-sm font-bold uppercase text-slate-900">{editingId ? 'Edit Line Item' : 'Add Line Item'}</h2>
                            <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-black">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-6 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">SKU</label>
                                <SearchableSelect
                                    options={allSkus
                                        .filter(s => {
                                            const isUsed = order?.lineItems?.some(item => {
                                                if (editingId && item._id === editingId) return false;
                                                const itemId = typeof item.sku === 'object' ? item.sku._id : item.sku;
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
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Lot #</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.lotNumber}
                                        onChange={(e) => setFormData({ ...formData, lotNumber: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none"
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
                                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                        title="Select from Inventory"
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                            </div>
                        </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">UOM</label>
                                    <SearchableSelect
                                        options={UOM_OPTIONS}
                                        value={formData.uom}
                                        onChange={(val) => setFormData({ ...formData, uom: val })}
                                        placeholder="UOM"
                                        creatable
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Qty</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.qtyOrdered}
                                        onChange={(e) => setFormData({ ...formData, qtyOrdered: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Cost</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.00000001"
                                            value={formData.cost}
                                            onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                            className="w-full pl-6 pr-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-black text-white text-xs font-bold uppercase rounded hover:bg-slate-800 transition-colors"
                                >
                                    {editingId ? 'Save Changes' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Confirm Delete</h3>
                            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                                Are you sure you want to delete this line item? This action cannot be undone.
                            </p>
                            <div className="flex items-center justify-center space-x-3">
                                <button
                                    onClick={() => setDeleteConfirm({ isOpen: false, itemId: null })}
                                    className="px-4 py-2 border border-slate-200 rounded text-xs font-bold text-slate-600 uppercase hover:bg-slate-50 transition-colors min-w-[80px]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 bg-red-600 text-white rounded text-xs font-bold uppercase hover:bg-red-700 transition-colors min-w-[80px]"
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
        </div>
    );
}
