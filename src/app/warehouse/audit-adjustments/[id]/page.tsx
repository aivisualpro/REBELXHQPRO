'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ArrowLeft, Package, Calendar, Archive, Scale, Pencil, Save, X, FileText, User, Fingerprint, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { cn } from '@/lib/utils';

export default function AuditAdjustmentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);
    
    const [formData, setFormData] = useState({
        lotNumber: '',
        qty: 0,
        reason: ''
    });

    useEffect(() => {
        if (id) {
            fetchDetails();
        }
    }, [id]);

    // Header Portal: mount into the main shell's header-actions slot
    useEffect(() => {
        const el = document.getElementById('header-portal-target');
        if (el) setHeaderPortal(el);
    }, []);

    // Shell Viewport Lock: Prevents window-level scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/warehouse/audit-adjustments/${id}`);
            if (res.ok) {
                const data = await res.json();
                const adj = data.adjustment;
                setItem(adj);
                setFormData({
                    lotNumber: adj.lotNumber || '',
                    qty: adj.qty || 0,
                    reason: adj.reason || ''
                });
            } else {
                toast.error('Failed to load adjustment details');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error loading details');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const toastId = toast.loading('Saving changes...');
        try {
            const res = await fetch(`/api/warehouse/audit-adjustments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const data = await res.json();
                setItem(data.adjustment);
                setIsEditing(false);
                toast.success('Changes saved', { id: toastId });
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save changes', { id: toastId });
            }
        } catch (error) {
            toast.error('Error saving changes', { id: toastId });
        }
    };

    const handleDelete = async () => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this adjustment?</p>
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
                                const res = await fetch(`/api/warehouse/audit-adjustments/${id}`, {
                                    method: 'DELETE'
                                });
                                if (res.ok) {
                                    toast.success('Adjustment deleted');
                                    router.push('/warehouse/audit-adjustments');
                                } else {
                                    const data = await res.json();
                                    toast.error(data.error || 'Failed to delete');
                                }
                            } catch (e) {
                                toast.error('Error deleting adjustment');
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

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSkuName = () => {
        if (item?.sku && typeof item.sku === 'object') return item.sku.name;
        return item?.sku || 'N/A';
    };

    const getSkuId = () => {
        if (item?.sku && typeof item.sku === 'object') return item.sku._id;
        return item?.sku || '';
    };

    const getSkuTier = () => {
        if (item?.sku && typeof item.sku === 'object') return (item.sku as any).tier;
        return null;
    };

    const getSkuUom = () => {
        if (item?.sku && typeof item.sku === 'object') return item.sku.uom;
        return item?.uom || '';
    };

    const getSkuImage = () => {
        if (item?.sku && typeof item.sku === 'object') return item.sku.image;
        return '';
    };

    const getCreatedBy = () => {
        if (item?.createdBy && typeof item.createdBy === 'object') {
            return `${item.createdBy.firstName} ${item.createdBy.lastName}`;
        }
        return item?.createdBy || 'System';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Record not found</div>
            </div>
        );
    }

    const skuTier = getSkuTier();

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
            {/* Header Portal Content */}
            {headerPortal && item && createPortal(
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
                        <div className="grid grid-cols-2 gap-2">
                            <div className="border border-border rounded-md p-3 bg-background text-center flex items-center justify-center">
                                <div className="text-[10px] font-mono text-muted-foreground break-all">{item._id?.slice(-8)}</div>
                            </div>
                            <div className={cn(
                                "border rounded-md p-3 text-center flex items-center justify-center",
                                item.qty > 0 
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" 
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-600"
                            )}>
                                <div className="text-base font-black font-mono tracking-tight">
                                    {item.qty > 0 ? '+' : ''}{item.qty}
                                </div>
                            </div>
                        </div>

                        {/* SKU Hero */}
                        <div className="border border-border rounded-md p-3 bg-background">
                            <div className="flex items-center space-x-3">
                                {/* Image */}
                                {getSkuImage() && (
                                    <div className="w-10 h-10 rounded overflow-hidden bg-secondary flex items-center justify-center border border-border shrink-0">
                                        <img src={getSkuImage()} alt="" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                {/* Tier */}
                                {!!skuTier && (
                                    <div className={cn(
                                        "w-6 h-6 rounded flex items-center justify-center shrink-0 shadow-sm",
                                        skuTier === 1 ? "bg-emerald-500" :
                                        skuTier === 2 ? "bg-blue-500" :
                                        "bg-orange-500"
                                    )}>
                                        <span className="text-sm font-black text-white">{skuTier}</span>
                                    </div>
                                )}
                                {/* Name */}
                                <div className="min-w-0 flex-1">
                                    <div 
                                        className="text-[11px] font-bold text-foreground truncate hover:text-primary transition-colors cursor-pointer"
                                        onClick={() => router.push(`/warehouse/skus/${getSkuId()}`)}
                                    >
                                        {getSkuName()}
                                    </div>
                                    <div className="text-[9px] text-muted-foreground font-mono truncate">{getSkuId()}</div>
                                </div>
                            </div>
                        </div>

                        {/* Details */}
                        <div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Date</div>
                                    <div className="text-xs font-medium text-foreground">{formatDate(item.createdAt)}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Lot Number</div>
                                    <div className="text-xs font-medium text-foreground font-mono">{item.lotNumber || '-'}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Quantity</div>
                                    <div className={cn(
                                        "text-xs font-bold font-mono",
                                        item.qty > 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {item.qty > 0 ? '+' : ''}{item.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
                                        {getSkuUom() && <span className="text-muted-foreground ml-1 font-normal">{getSkuUom()}</span>}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Created By</div>
                                    <div className="text-xs font-medium text-foreground">{getCreatedBy()}</div>
                                </div>
                                {item.cost !== undefined && item.cost !== 0 && (
                                    <div className="flex justify-between items-center">
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Cost</div>
                                        <div className="text-xs font-medium text-foreground font-mono">
                                            ${(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Reason */}
                        <div>
                            <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-2 border-b border-border pb-2">Reason</h3>
                            <p className="text-[11px] text-foreground leading-relaxed italic">
                                {item.reason || 'No specific rationale provided.'}
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Cancel</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>Save</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Content (70%) */}
                <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                    {/* Edit Form or Detail View */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {isEditing ? (
                            <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-300">
                                <h3 className="text-xs font-bold uppercase text-foreground tracking-widest border-b border-border pb-2">Edit Adjustment</h3>

                                {/* Lot Number */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Lot Number</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={formData.lotNumber}
                                            onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                                            className="flex-1 h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono transition-colors"
                                            placeholder="Lot #"
                                        />
                                        <button 
                                            onClick={() => setIsLotModalOpen(true)}
                                            className="px-3 py-1.5 bg-secondary border border-border rounded-md text-muted-foreground hover:bg-secondary/80 hover:text-foreground active:scale-95 transition-all cursor-pointer"
                                        >
                                            <Archive className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Quantity */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Quantity Adjustment</label>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={formData.qty}
                                            onChange={e => setFormData({...formData, qty: parseFloat(e.target.value) || 0})}
                                            className="w-40 h-9 px-3 border border-border rounded-md text-sm font-bold bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                                            step="any"
                                        />
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {getSkuUom()}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Positive adds stock, negative removes stock.</p>
                                </div>

                                {/* Reason */}
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Reason</label>
                                    <textarea 
                                        value={formData.reason}
                                        onChange={e => setFormData({...formData, reason: e.target.value})}
                                        className="w-full px-3 py-2 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 min-h-[120px] transition-colors"
                                        placeholder="Reason for adjustment..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
                                {/* Hero Section */}
                                <div className="border border-border rounded-lg p-6 bg-secondary/20">
                                    <div className="flex items-center space-x-4">
                                        {/* SKU Image */}
                                        {getSkuImage() && (
                                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-secondary flex items-center justify-center border border-border shrink-0">
                                                <img src={getSkuImage()} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        )}
                                        {/* Tier Badge */}
                                        {!!skuTier && (
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                                                skuTier === 1 ? "bg-emerald-500" :
                                                skuTier === 2 ? "bg-blue-500" :
                                                "bg-orange-500"
                                            )}>
                                                <span className="text-lg font-black text-white">{skuTier}</span>
                                            </div>
                                        )}
                                        {/* SKU Info */}
                                        <div className="min-w-0 flex-1">
                                            <h2 
                                                className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                                                onClick={() => router.push(`/warehouse/skus/${getSkuId()}`)}
                                            >
                                                {getSkuName()}
                                            </h2>
                                            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{getSkuId()}</p>
                                        </div>
                                        {/* Qty Badge */}
                                        <div className={cn(
                                            "px-4 py-2 rounded-lg",
                                            item.qty > 0 ? "bg-emerald-500/10 border border-emerald-500/30" : "bg-rose-500/10 border border-rose-500/30"
                                        )}>
                                            <span className={cn(
                                                "text-2xl font-black font-mono",
                                                item.qty > 0 ? "text-emerald-600" : "text-rose-600"
                                            )}>
                                                {item.qty > 0 ? '+' : ''}{item.qty}
                                            </span>
                                            <span className="text-xs font-medium text-muted-foreground ml-1 uppercase tracking-widest">{getSkuUom()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detail Grid */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border border-border rounded-lg p-4 bg-background">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <Archive className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Lot Number</span>
                                        </div>
                                        <p className="text-sm font-mono font-medium text-foreground">{item.lotNumber || 'N/A'}</p>
                                    </div>
                                    <div className="border border-border rounded-lg p-4 bg-background">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Date Created</span>
                                        </div>
                                        <p className="text-sm font-medium text-foreground">{formatDate(item.createdAt)}</p>
                                    </div>
                                    <div className="border border-border rounded-lg p-4 bg-background">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Created By</span>
                                        </div>
                                        <p className="text-sm font-medium text-foreground">{getCreatedBy()}</p>
                                    </div>
                                    {item.cost !== undefined && item.cost !== 0 && (
                                        <div className="border border-border rounded-lg p-4 bg-background">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Cost</span>
                                            </div>
                                            <p className="text-sm font-mono font-medium text-foreground">
                                                ${(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Reason Section */}
                                <div className="border border-border rounded-lg p-4 bg-background">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Reason for Adjustment</span>
                                    </div>
                                    <p className="text-sm text-foreground leading-relaxed">
                                        {item.reason || 'No specific rationale provided.'}
                                    </p>
                                </div>

                                {/* Record ID */}
                                <div className="border-t border-border pt-4">
                                    <div className="flex items-center space-x-2">
                                        <Fingerprint className="w-3 h-3 text-muted-foreground" />
                                        <span className="text-[9px] text-muted-foreground font-mono uppercase tracking-tighter">{item._id}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Lot Selection Modal */}
            {isEditing && item.sku && (
                <LotSelectionModal
                    isOpen={isLotModalOpen}
                    onClose={() => setIsLotModalOpen(false)}
                    onSelect={(lot) => {
                        setFormData(prev => ({ ...prev, lotNumber: lot }));
                        setIsLotModalOpen(false);
                    }}
                    skuId={typeof item.sku === 'object' ? item.sku._id : item.sku}
                    currentLotNumber={formData.lotNumber}
                    title="Select Reference Lot"
                />
            )}
        </div>
    );
}
