'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Package, Calendar, DollarSign, Archive, Scale, Pencil, Save, X, List } from 'lucide-react';
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
        uom: '',
        cost: 0,
        expirationDate: ''
    });

    useEffect(() => {
        if (id) {
            fetchDetails();
        }
    }, [id]);

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
                    uom: data.uom || 'pcs',
                    cost: data.cost || 0,
                    expirationDate: data.expirationDate ? new Date(data.expirationDate).toISOString().split('T')[0] : ''
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
                const updated = await res.json();
                setItem(updated);
                setIsEditing(false);
                toast.success('Changes saved', { id: toastId });
            } else {
                toast.error('Failed to save changes', { id: toastId });
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
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-4">
                    <button
                        onClick={() => router.back()}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-500" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">Opening Balance Details</h1>
                        <p className="text-xs text-slate-500 font-mono">{item._id}</p>
                    </div>
                </div>
                <div>
                     {isEditing ? (
                        <div className="flex items-center space-x-2">
                             <button
                                onClick={() => setIsEditing(false)}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                <span>Cancel</span>
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-black text-white rounded text-sm font-medium hover:bg-slate-800 transition-colors"
                            >
                                <Save className="w-4 h-4" />
                                <span>Save Changes</span>
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            <span>Edit Record</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Main Card */}
                    <div className="bg-white shadow-sm border border-slate-200 rounded-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Record Information</h2>
                            <span className="text-xs font-mono text-slate-400">
                                Created: {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                        
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* SKU Info */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Package className="w-3 h-3" /> SKU
                                    </label>
                                    <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                        <p className="font-medium text-slate-900">{typeof item.sku === 'object' ? item.sku.name : 'Unknown SKU'}</p>
                                        <p className="text-xs text-slate-500 font-mono mt-1">{typeof item.sku === 'object' ? item.sku._id : item.sku}</p>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Archive className="w-3 h-3" /> Lot Number
                                    </label>
                                    {isEditing ? (
                                        <div className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={formData.lotNumber}
                                                onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10 font-mono"
                                                placeholder="Enter or select lot..."
                                            />
                                            <button 
                                                onClick={() => setIsLotModalOpen(true)}
                                                className="px-3 py-2 bg-slate-100 border border-slate-200 rounded text-slate-600 hover:bg-slate-200"
                                                title="Select Existing Lot"
                                            >
                                                <List className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ) : (
                                        <p className="text-lg font-mono font-medium text-slate-900 pl-1">{item.lotNumber || 'N/A'}</p>
                                    )}
                                </div>
                            </div>

                            {/* Qty & Cost */}
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <Scale className="w-3 h-3" /> Quantity
                                        </label>
                                        <div className="flex items-baseline gap-2">
                                            {isEditing ? (
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="number" 
                                                        value={formData.qty}
                                                        onChange={e => setFormData({...formData, qty: parseFloat(e.target.value) || 0})}
                                                        className="w-24 px-3 py-1 bg-slate-50 border border-slate-200 rounded text-lg font-bold focus:outline-none focus:ring-1 focus:ring-black/10"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        value={formData.uom}
                                                        onChange={e => setFormData({...formData, uom: e.target.value})}
                                                        className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                                        placeholder="UOM"
                                                    />
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-2xl font-bold text-slate-900">{item.qty}</span>
                                                    <span className="text-sm font-medium text-slate-500">{item.uom}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                            <DollarSign className="w-3 h-3" /> Unit Cost
                                        </label>
                                        {isEditing ? (
                                            <div className="relative">
                                                <span className="absolute left-3 top-2 text-slate-400">$</span>
                                                <input 
                                                    type="number" 
                                                    value={formData.cost}
                                                    onChange={e => setFormData({...formData, cost: parseFloat(e.target.value) || 0})}
                                                    className="w-full pl-6 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-lg font-bold focus:outline-none focus:ring-1 focus:ring-black/10"
                                                    step="0.01"
                                                />
                                            </div>
                                        ) : (
                                            <p className="text-2xl font-bold text-slate-900">${(item.cost || 0).toFixed(2)}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                        <Calendar className="w-3 h-3" /> Expiration Date
                                    </label>
                                    {isEditing ? (
                                        <input 
                                            type="date" 
                                            value={formData.expirationDate}
                                            onChange={e => setFormData({...formData, expirationDate: e.target.value})}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        />
                                    ) : (
                                        <p className="text-sm font-medium text-slate-700 pl-1">
                                            {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : 'N/A'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                     {/* Lot Selection Modal */}
                     {isEditing && (
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
        </div>
    );
}
