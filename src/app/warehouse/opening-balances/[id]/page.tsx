'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, Calendar, Archive, Scale, Pencil, Save, X, FileText, List, User, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { cn } from '@/lib/utils';

export default function OpeningBalanceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({
        lotNumber: '',
        qty: 0,
        cost: 0,
        uom: ''
    });

    useEffect(() => {
        if (id) {
            fetchDetails();
        }
    }, [id]);

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
            const res = await fetch(`/api/opening-balances/${id}`);
            if (res.ok) {
                const data = await res.json();
                setItem(data);
                setFormData({
                    lotNumber: data.lotNumber || '',
                    qty: data.qty || 0,
                    cost: data.cost || 0,
                    uom: data.uom || ''
                });
            } else {
                toast.error('Failed to load opening balance details');
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
            const res = await fetch(`/api/opening-balances/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                const data = await res.json();
                setItem(data);
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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800">Record Not Found</h2>
                <button
                    onClick={() => router.back()}
                    className="mt-4 px-4 py-2 bg-black text-white rounded text-sm font-medium"
                >
                    Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-white overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-10 shadow-sm">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => router.back()}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="flex items-baseline space-x-3">
                        <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Opening Balance Details</h1>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{item._id}</p>
                    </div>
                </div>
                <div>
                     {isEditing ? (
                        <div className="flex items-center space-x-2">
                             <button
                                 onClick={() => setIsEditing(false)}
                                 className="flex items-center space-x-2 px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors"
                             >
                                 <X className="w-3 h-3" />
                                 <span>Cancel</span>
                             </button>
                             <button
                                 onClick={handleSave}
                                 className="flex items-center space-x-2 px-3 py-1 bg-black text-white rounded text-[10px] font-bold uppercase hover:bg-slate-800 transition-colors"
                             >
                                 <Save className="w-3 h-3" />
                                 <span>Save</span>
                             </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center space-x-2 px-3 py-1 bg-white border border-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors"
                        >
                            <Pencil className="w-3 h-3" />
                            <span>Edit Record</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 scrollbar-custom">
                <div className="max-w-4xl mx-auto">
                    {/* Main Detail Card */}
                    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
                        <div className="p-6 divide-y divide-slate-100">
                            {/* SKU Name Row */}
                            <div className="flex items-start py-4 group">
                                <div className="w-32 flex items-center space-x-2 shrink-0 pt-0.5">
                                    <Package className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">SKU:</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-baseline gap-3">
                                        <p className="font-bold text-slate-900 text-base">
                                            {item.sku && typeof item.sku === 'object' ? item.sku.name : (item.sku || 'N/A')}
                                        </p>
                                        <span className="text-slate-300">|</span>
                                        <p className="text-xs text-slate-500 font-mono">
                                            {item.sku && typeof item.sku === 'object' ? item.sku._id : item.sku}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Date Row */}
                            <div className="flex items-center py-4 group">
                                <div className="w-32 flex items-center space-x-2 shrink-0">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Created:</span>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-slate-700">
                                        {new Date(item.createdAt).toLocaleDateString('en-US', { 
                                            month: 'long', 
                                            day: 'numeric', 
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>

                            {/* Lot Row */}
                            <div className="flex items-center py-4 group">
                                <div className="w-32 flex items-center space-x-2 shrink-0">
                                    <Archive className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lot #:</span>
                                </div>
                                <div className="flex-1">
                                    {isEditing ? (
                                        <div className="flex gap-2 max-w-sm">
                                            <input 
                                                type="text" 
                                                value={formData.lotNumber}
                                                onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                                                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10 font-mono"
                                                placeholder="Lot #"
                                            />
                                            <button 
                                                onClick={() => setIsLotModalOpen(true)}
                                                className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-slate-600 hover:bg-slate-200 active:scale-95 transition-all"
                                            >
                                                <List className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-lg font-mono font-bold text-slate-900 leading-none">
                                            {item.lotNumber || 'N/A'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Qty Row */}
                            <div className="flex items-center py-4 group">
                                <div className="w-32 flex items-center space-x-2 shrink-0">
                                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quantity:</span>
                                </div>
                                <div className="flex-1 flex items-baseline gap-2">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={formData.qty}
                                                onChange={e => setFormData({...formData, qty: parseFloat(e.target.value) || 0})}
                                                className="w-32 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-lg font-bold focus:outline-none focus:ring-1 focus:ring-black/10"
                                                step="any"
                                            />
                                            <input 
                                                type="text" 
                                                value={formData.uom}
                                                onChange={e => setFormData({...formData, uom: e.target.value})}
                                                className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-black/10 uppercase font-bold"
                                                placeholder="UOM"
                                            />
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-2xl font-black text-slate-900">
                                                {item.qty}
                                            </span>
                                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none">
                                                {item.uom || (item.sku && typeof item.sku === 'object' ? item.sku.uom : '')}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Cost Row */}
                            <div className="flex items-center py-4 group">
                                <div className="w-32 flex items-center space-x-2 shrink-0">
                                    <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Unit Cost:</span>
                                </div>
                                <div className="flex-1">
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm font-bold text-slate-400">$</span>
                                            <input 
                                                type="number" 
                                                value={formData.cost}
                                                onChange={e => setFormData({...formData, cost: parseFloat(e.target.value) || 0})}
                                                className="w-48 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-black/10"
                                                step="any"
                                            />
                                        </div>
                                    ) : (
                                        <p className="text-sm font-mono font-bold text-slate-700">
                                            ${item.cost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                        </p>
                                    )}
                                </div>
                            </div>

                             {/* Totals Row */}
                             {!isEditing && (
                                <div className="flex items-center py-4 group bg-slate-50/50 -mx-6 px-6">
                                    <div className="w-32 flex items-center space-x-2 shrink-0">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Extended Value:</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xl font-black text-slate-900">
                                            ${(item.qty * (item.cost || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                        </p>
                                    </div>
                                </div>
                            )}
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
            </div>

            {/* Shell Footer */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-100/50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System Ready</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">Record Detail Shell v2.0</span>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                </div>
            </div>
        </div>
    );
}
