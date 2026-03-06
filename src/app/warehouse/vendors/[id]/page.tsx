'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
    ArrowLeft,
    Building2,
    Mail,
    Phone,
    MapPin,
    Globe,
    CreditCard,
    Pencil,
    Trash2,
    X,
    Plus,
    FileText,
    Package,
    DollarSign,
    MessageSquare,
    Send,
    ExternalLink,
    Calendar,
    User
} from 'lucide-react';

const CITY_OPTIONS = ['Ann Arbor', 'Detroit', 'Grand Rapids', 'Lansing', 'Kalamazoo', 'Flint', 'Traverse City', 'Saginaw', 'Battle Creek', 'Holland', 'Pontiac', 'Dearborn', 'Troy', 'Novi', 'Other'];
const STATE_OPTIONS = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
const COUNTRY_OPTIONS = ['United States', 'Canada', 'Mexico', 'China', 'Germany', 'United Kingdom', 'Brazil', 'India', 'Other'];
const PAYMENT_TERMS_OPTIONS = ['Net 10', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'COD', 'Due on Receipt', 'Prepaid', '2/10 Net 30', 'Other'];
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface VendorNote {
    _id?: string;
    note: string;
    createdBy: string;
    createdAt: string;
}

interface Vendor {
    _id: string;
    name: string;
    legacyId?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    website?: string;
    paymentTerms?: string;
    carrierPreference?: string;
    status?: string;
    notes?: VendorNote[];
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

interface PurchaseOrder {
    _id: string;
    label: string;
    vendor: { _id: string; name: string } | string;
    status: string;
    paymentTerms?: string;
    scheduledDelivery?: string;
    receivedDate?: string;
    createdAt: string;
    createdBy?: { firstName: string; lastName: string };
    lineItems?: {
        _id: string;
        sku: { _id: string; name: string } | string;
        qtyOrdered: number;
        qtyReceived: number;
        cost: number;
        uom: string;
    }[];
}

type Tab = 'pos' | 'notes' | 'payments';

export default function VendorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const isNew = params.id === 'new';

    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(!isNew);
    const [activeTab, setActiveTab] = useState<Tab>('pos');

    // Header portal
    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);

    // POs
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [posLoading, setPosLoading] = useState(false);
    const [posTotal, setPosTotal] = useState(0);

    // Notes
    const [newNote, setNewNote] = useState('');
    const [addingNote, setAddingNote] = useState(false);

    // Edit / Create vendor modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Vendor>>({});
    const [isSaving, setIsSaving] = useState(false);

    const fetchVendor = useCallback(async () => {
        try {
            const res = await fetch(`/api/vendors/${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setVendor(data);
            } else {
                toast.error('Vendor not found');
            }
        } catch {
            toast.error('Error loading vendor');
        } finally {
            setLoading(false);
        }
    }, [params.id]);

    const fetchPurchaseOrders = useCallback(async () => {
        if (!params.id) return;
        setPosLoading(true);
        try {
            const res = await fetch(`/api/purchase-orders?vendor=${params.id}&limit=100&sortBy=createdAt&sortOrder=desc`);
            if (res.ok) {
                const data = await res.json();
                setPurchaseOrders(data.orders || []);
                setPosTotal(data.total || 0);
            }
        } catch {
            console.error('Failed to fetch POs');
        } finally {
            setPosLoading(false);
        }
    }, [params.id]);

    useEffect(() => {
        if (isNew) {
            // Open create modal immediately for new vendor
            setEditForm({ name: '', contactName: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', country: '', website: '', paymentTerms: '', status: 'Active' });
            setIsEditModalOpen(true);
            return;
        }
        if (params.id) {
            fetchVendor();
            fetchPurchaseOrders();
        }
    }, [params.id, isNew, fetchVendor, fetchPurchaseOrders]);

    useEffect(() => {
        const target = document.getElementById('header-portal-target');
        if (target) setHeaderPortal(target);
    }, [loading]);

    const handleAddNote = async () => {
        if (!newNote.trim() || !vendor) return;
        setAddingNote(true);
        try {
            const updatedNotes = [
                ...(vendor.notes || []),
                { note: newNote.trim(), createdBy: 'Admin', createdAt: new Date().toISOString() }
            ];
            const res = await fetch(`/api/vendors/${vendor._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: updatedNotes })
            });
            if (res.ok) {
                const updated = await res.json();
                setVendor(updated);
                setNewNote('');
                toast.success('Note added');
            } else {
                toast.error('Failed to add note');
            }
        } catch {
            toast.error('Error adding note');
        } finally {
            setAddingNote(false);
        }
    };

    const handleDeleteNote = async (index: number) => {
        if (!vendor) return;
        const updatedNotes = (vendor.notes || []).filter((_, i) => i !== index);
        try {
            const res = await fetch(`/api/vendors/${vendor._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: updatedNotes })
            });
            if (res.ok) {
                const updated = await res.json();
                setVendor(updated);
                toast.success('Note deleted');
            }
        } catch {
            toast.error('Error deleting note');
        }
    };

    const handleSaveEdit = async () => {
        if (!editForm.name?.trim()) {
            toast.error('Vendor name is required');
            return;
        }
        setIsSaving(true);
        try {
            if (isNew || !vendor) {
                // CREATE
                const res = await fetch('/api/vendors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                });
                if (res.ok) {
                    const created = await res.json();
                    toast.success('Vendor created');
                    router.replace(`/warehouse/vendors/${created._id}`);
                } else {
                    const err = await res.json();
                    toast.error(err.error || 'Failed to create vendor');
                }
            } else {
                // UPDATE
                const res = await fetch(`/api/vendors/${vendor._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(editForm)
                });
                if (res.ok) {
                    const updated = await res.json();
                    setVendor(updated);
                    setIsEditModalOpen(false);
                    toast.success('Vendor updated');
                } else {
                    toast.error('Failed to update vendor');
                }
            }
        } catch {
            toast.error(isNew ? 'Error creating vendor' : 'Error updating vendor');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteVendor = () => {
        if (!vendor) return;
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this vendor?</p>
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
                                const res = await fetch(`/api/vendors/${vendor._id}`, { method: 'DELETE' });
                                if (res.ok) {
                                    toast.success('Vendor deleted');
                                    router.push('/warehouse/vendors');
                                } else {
                                    toast.error('Failed to delete vendor');
                                }
                            } catch {
                                toast.error('Error deleting vendor');
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

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: '2-digit', day: '2-digit', year: 'numeric'
        });
    };

    const formatCurrency = (val: number) => {
        if (val === undefined || val === null) return '-';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'Active': return "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30";
            case 'Inactive': return "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400 border-red-500/30";
            default: return "bg-secondary text-muted-foreground border-border";
        }
    };

    const getPOStatusColor = (status: string) => {
        switch (status) {
            case 'Received': return "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30";
            case 'Ordered': return "bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/30";
            case 'Partial': return "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30";
            case 'Pending': return "bg-orange-500/15 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400 border-orange-500/30";
            default: return "bg-secondary text-muted-foreground border-border";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Loading vendor...</div>
            </div>
        );
    }

    // For /new route — render the modal over a placeholder
    if (isNew) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                {isEditModalOpen && renderEditModal()}
            </div>
        );
    }

    if (!vendor) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Vendor not found</div>
            </div>
        );
    }

    // Calculate PO summary
    const totalPOAmount = purchaseOrders.reduce((sum, po) => {
        const poTotal = (po.lineItems || []).reduce((s, item) => s + ((item.qtyOrdered || 0) * (item.cost || 0)), 0);
        return sum + poTotal;
    }, 0);
    const receivedCount = purchaseOrders.filter(po => po.status === 'Received').length;
    const pendingCount = purchaseOrders.filter(po => po.status !== 'Received').length;

    const tabs = [
        { id: 'pos' as Tab, label: 'Purchase Orders', icon: Package, count: posTotal },
        { id: 'notes' as Tab, label: 'Notes', icon: MessageSquare, count: vendor.notes?.length || 0 },
        { id: 'payments' as Tab, label: 'Payments', icon: DollarSign, count: 0 },
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative transition-colors duration-300">

            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel (30%) - Vendor Details */}
                <div className="w-[30%] border-r border-border bg-secondary/30 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Identity Section */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="border border-sky-500/30 rounded-md p-3 bg-sky-500/10 text-center flex items-center justify-center">
                                <div className="text-sm font-bold text-sky-400 break-words">{vendor.name}</div>
                            </div>
                            <div className={cn(
                                "border rounded-md p-3 text-center flex flex-col items-center justify-center transition-colors",
                                getStatusColor(vendor.status)
                            )}>
                                <div className="text-[9px] font-bold uppercase tracking-wider mb-1 opacity-70">Status</div>
                                <div className="text-sm font-black uppercase tracking-wider">{vendor.status || 'Active'}</div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-3 border-b border-border pb-2">Contact Information</h3>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Contact Name</span>
                                    </div>
                                    <span className="text-xs font-medium text-foreground">{vendor.contactName || '-'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Email</span>
                                    </div>
                                    {vendor.email ? (
                                        <a href={`mailto:${vendor.email}`} className="text-xs font-medium text-blue-500 hover:underline">{vendor.email}</a>
                                    ) : (
                                        <span className="text-xs font-medium text-foreground">-</span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Phone</span>
                                    </div>
                                    <span className="text-xs font-medium text-foreground">{vendor.phone || '-'}</span>
                                </div>
                                {vendor.website && (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Website</span>
                                        </div>
                                        <a href={vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-500 hover:underline flex items-center space-x-1">
                                            <span>{vendor.website}</span>
                                            <ExternalLink className="w-2.5 h-2.5" />
                                        </a>
                                    </div>
                                )}
                                {/* Address */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Address</span>
                                    </div>
                                    <span className="text-xs font-medium text-foreground text-right">
                                        {[vendor.address, vendor.city, vendor.state, vendor.zipCode, vendor.country].filter(Boolean).join(', ') || '-'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Business Details */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-3 border-b border-border pb-2">Business Details</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center space-x-2">
                                        <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Payment Terms</span>
                                    </div>
                                    <span className="text-xs font-medium text-foreground">{vendor.paymentTerms || '-'}</span>
                                </div>
                            </div>
                        </div>

                        {/* PO Summary */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-3 border-b border-border pb-2">PO Summary</h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Total POs</span>
                                    <span className="text-sm font-mono font-medium text-foreground">{posTotal}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Received</span>
                                    <span className="text-sm font-mono font-medium text-emerald-600">{receivedCount}</span>
                                </div>
                                <div className="flex justify-between items-center group">
                                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Pending</span>
                                    <span className="text-sm font-mono font-medium text-amber-500">{pendingCount}</span>
                                </div>
                                <div className="pt-3 mt-3 border-t border-border flex justify-between items-center">
                                    <span className="text-sm font-bold text-foreground uppercase tracking-wider">Total Amount</span>
                                    <span className="text-base font-mono font-bold text-foreground">
                                        {formatCurrency(totalPOAmount)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Timestamps */}
                        <div className="space-y-2 text-[10px] text-muted-foreground pt-2 border-t border-border">
                            <div className="flex justify-between">
                                <span className="uppercase tracking-widest font-bold">Created</span>
                                <span>{formatDate(vendor.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="uppercase tracking-widest font-bold">Updated</span>
                                <span>{formatDate(vendor.updatedAt)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        <button
                            onClick={() => {
                                setEditForm({
                                    name: vendor.name,
                                    contactName: vendor.contactName || '',
                                    email: vendor.email || '',
                                    phone: vendor.phone || '',
                                    address: vendor.address || '',
                                    city: vendor.city || '',
                                    state: vendor.state || '',
                                    zipCode: vendor.zipCode || '',
                                    country: vendor.country || '',
                                    website: vendor.website || '',
                                    paymentTerms: vendor.paymentTerms || '',
                                    status: vendor.status || 'Active',
                                });
                                setIsEditModalOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={handleDeleteVendor}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>

                {/* Right Panel (70%) - Tabs */}
                <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                    {/* Tab Header */}
                    <div className="px-4 border-b border-border shrink-0 flex items-center justify-between bg-background z-10 h-9">
                        <div className="flex space-x-1 h-full">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "px-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5 cursor-pointer",
                                            activeTab === tab.id
                                                ? "text-foreground border-foreground"
                                                : "text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30"
                                        )}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{tab.label}</span>
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded-none text-[9px] font-bold",
                                            activeTab === tab.id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                                        )}>
                                            {tab.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {/* Purchase Orders Tab */}
                        {activeTab === 'pos' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            {['PO #', 'Status', 'Items', 'Qty Ordered', 'Total', 'Payment Terms', 'Sched. Delivery', 'Created'].map(col => (
                                                <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {posLoading ? (
                                            <tr><td colSpan={8} className="px-3 py-6 text-center text-[10px] text-muted-foreground italic">Loading purchase orders...</td></tr>
                                        ) : purchaseOrders.length === 0 ? (
                                            <tr><td colSpan={8} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No purchase orders found</td></tr>
                                        ) : purchaseOrders.map(po => {
                                            const poQty = (po.lineItems || []).reduce((s, i) => s + (i.qtyOrdered || 0), 0);
                                            const poTotal = (po.lineItems || []).reduce((s, i) => s + ((i.qtyOrdered || 0) * (i.cost || 0)), 0);
                                            return (
                                                <tr key={po._id} className="hover:bg-secondary/50 transition-colors group">
                                                    <td className="px-3 py-1.5 text-[10px] font-bold text-foreground">
                                                        <span
                                                            onClick={() => router.push(`/warehouse/purchase-orders/${po._id}`)}
                                                            className="hover:text-blue-500 hover:underline cursor-pointer transition-colors"
                                                        >
                                                            {po.label || po._id.slice(-6)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <span className={cn(
                                                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                                                            getPOStatusColor(po.status)
                                                        )}>
                                                            {po.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{po.lineItems?.length || 0}</td>
                                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{poQty.toFixed(2)}</td>
                                                    <td className="px-3 py-1.5 text-[10px] font-bold text-foreground font-mono">{formatCurrency(poTotal)}</td>
                                                    <td className="px-3 py-1.5 text-[8px] text-muted-foreground uppercase font-bold">{po.paymentTerms || '-'}</td>
                                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{formatDate(po.scheduledDelivery)}</td>
                                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{formatDate(po.createdAt)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    {purchaseOrders.length > 0 && (
                                        <tfoot className="bg-secondary/50 border-t border-border">
                                            <tr>
                                                <td colSpan={2} className="px-3 py-1.5 text-[9px] font-bold text-muted-foreground uppercase text-right tracking-wider">Totals</td>
                                                <td className="px-3 py-1.5 text-[10px] font-bold text-foreground font-mono">{purchaseOrders.reduce((s, po) => s + (po.lineItems?.length || 0), 0)}</td>
                                                <td className="px-3 py-1.5 text-[10px] font-bold text-foreground font-mono">
                                                    {purchaseOrders.reduce((s, po) => s + (po.lineItems || []).reduce((ss, i) => ss + (i.qtyOrdered || 0), 0), 0).toFixed(2)}
                                                </td>
                                                <td className="px-3 py-1.5 text-[10px] font-black text-foreground font-mono">{formatCurrency(totalPOAmount)}</td>
                                                <td colSpan={3}></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        )}

                        {/* Notes Tab */}
                        {activeTab === 'notes' && (
                            <div className="animate-in fade-in duration-300 p-4 space-y-4">
                                {/* Add Note */}
                                <div className="flex items-start space-x-3">
                                    <div className="flex-1">
                                        <textarea
                                            value={newNote}
                                            onChange={e => setNewNote(e.target.value)}
                                            placeholder="Add a note..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none placeholder:text-muted-foreground"
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddNote}
                                        disabled={!newNote.trim() || addingNote}
                                        className="px-4 py-2 bg-foreground text-background rounded text-xs font-bold uppercase tracking-wider hover:bg-foreground/90 transition-colors disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>{addingNote ? 'Adding...' : 'Add'}</span>
                                    </button>
                                </div>

                                {/* Notes List */}
                                <div className="space-y-3">
                                    {(!vendor.notes || vendor.notes.length === 0) ? (
                                        <div className="text-center py-8 text-[10px] text-muted-foreground uppercase tracking-wider font-bold">No notes yet</div>
                                    ) : [...vendor.notes].reverse().map((note, reversedIndex) => {
                                        const originalIndex = vendor.notes!.length - 1 - reversedIndex;
                                        return (
                                            <div key={reversedIndex} className="border border-border rounded-md p-4 bg-secondary/30 hover:bg-secondary/50 transition-colors group">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <p className="text-sm text-foreground whitespace-pre-wrap">{note.note}</p>
                                                        <div className="flex items-center space-x-3 mt-2">
                                                            <span className="text-[10px] text-muted-foreground font-bold">{note.createdBy || 'Unknown'}</span>
                                                            <span className="text-[10px] text-muted-foreground">{formatDate(note.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteNote(originalIndex)}
                                                        className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded opacity-0 group-hover:opacity-100 cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Payments Tab */}
                        {activeTab === 'payments' && (
                            <div className="animate-in fade-in duration-300">
                                <div className="flex items-center justify-center py-16">
                                    <div className="text-center space-y-3">
                                        <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto" />
                                        <p className="text-sm text-muted-foreground font-bold">No payments recorded</p>
                                        <p className="text-[10px] text-muted-foreground">Vendor payments will appear here once recorded</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit/Create Vendor Modal */}
            {isEditModalOpen && renderEditModal()}
        </div>
    );

    function renderEditModal() {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="bg-background border border-border rounded shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between px-6 h-[36px] border-b border-border bg-secondary/50">
                        <h2 className="text-sm font-black uppercase text-foreground tracking-widest">{isNew ? 'Create Vendor' : 'Edit Vendor'}</h2>
                        <button onClick={() => { setIsEditModalOpen(false); if (isNew) router.push('/warehouse/vendors'); }} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Name <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={editForm.name || ''}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Contact Name</label>
                                <input
                                    type="text"
                                    value={editForm.contactName || ''}
                                    onChange={e => setEditForm({ ...editForm, contactName: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Email</label>
                                <input
                                    type="email"
                                    value={editForm.email || ''}
                                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Phone</label>
                                <input
                                    type="text"
                                    value={editForm.phone || ''}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                                        let fmt = raw;
                                        if (raw.length > 6) fmt = `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
                                        else if (raw.length > 3) fmt = `(${raw.slice(0, 3)}) ${raw.slice(3)}`;
                                        else if (raw.length > 0) fmt = `(${raw}`;
                                        setEditForm({ ...editForm, phone: fmt });
                                    }}
                                    placeholder="(000) 000-0000"
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Website</label>
                                <input
                                    type="text"
                                    value={editForm.website || ''}
                                    onChange={e => setEditForm({ ...editForm, website: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Address</label>
                                <input
                                    type="text"
                                    value={editForm.address || ''}
                                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">City</label>
                                <select
                                    value={editForm.city || ''}
                                    onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                >
                                    <option value="">Select City</option>
                                    {CITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">State</label>
                                <select
                                    value={editForm.state || ''}
                                    onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                >
                                    <option value="">Select State</option>
                                    {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Zip Code</label>
                                <input
                                    type="text"
                                    value={editForm.zipCode || ''}
                                    onChange={e => setEditForm({ ...editForm, zipCode: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Country</label>
                                <select
                                    value={editForm.country || ''}
                                    onChange={e => setEditForm({ ...editForm, country: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                >
                                    <option value="">Select Country</option>
                                    {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Payment Terms</label>
                                <select
                                    value={editForm.paymentTerms || ''}
                                    onChange={e => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                >
                                    <option value="">Select Payment Terms</option>
                                    {PAYMENT_TERMS_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Status</label>
                                <select
                                    value={editForm.status || 'Active'}
                                    onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                    className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        <div className="pt-2 flex gap-3">
                            <button
                                onClick={() => { setIsEditModalOpen(false); if (isNew) router.push('/warehouse/vendors'); }}
                                className="flex-1 py-2.5 bg-secondary text-foreground text-xs font-bold uppercase rounded hover:bg-secondary/80 transition-colors cursor-pointer border border-border"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isSaving}
                                className="flex-1 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase rounded hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {isSaving ? 'Saving...' : isNew ? 'Create Vendor' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}
