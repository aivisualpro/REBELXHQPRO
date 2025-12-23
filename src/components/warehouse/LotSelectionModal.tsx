'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, Search, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Lot {
    lotNumber: string;
    balance: number;
    source?: string;
    date?: string;
}

interface LotSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (lotNumber: string) => void;
    skuId: string;
    currentLotNumber?: string;
    title?: string;
}

export function LotSelectionModal({
    isOpen,
    onClose,
    onSelect,
    skuId,
    currentLotNumber,
    title = "Select Lot Number"
}: LotSelectionModalProps) {
    const [lots, setLots] = useState<Lot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (isOpen && skuId) {
            fetchLots();
            setSearchQuery('');
        }
    }, [isOpen, skuId]);

    const fetchLots = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/warehouse/skus/${skuId}/lots`);
            if (res.ok) {
                const data = await res.json();
                setLots(data.lots || []);
            } else {
                setError('Failed to fetch lots');
                toast.error('Failed to fetch available lots');
            }
        } catch (e) {
            setError('Error loading lots');
            toast.error('Error fetching lots');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const filteredLots = lots.filter(lot => 
        lot.lotNumber.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white shadow-2xl max-w-md w-full overflow-hidden scale-100 transition-transform">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h3 className="font-bold text-slate-900">{title}</h3>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-black transition-colors p-1 hover:bg-slate-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text"
                            placeholder="Search lot numbers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 text-sm focus:outline-none focus:border-black transition-colors"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="max-h-[400px] overflow-y-auto">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full mx-auto mb-2"></div>
                            <p className="text-xs text-slate-400">Loading inventory...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-500">
                            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    ) : (
                        <div>
                            {/* Option to clear/select no lot */}
                            <button
                                onClick={() => onSelect('')}
                                className={cn(
                                    "w-full flex items-center justify-between px-6 py-3 transition-colors text-left group border-b border-slate-50",
                                    !currentLotNumber 
                                        ? "bg-blue-50 border-blue-100" 
                                        : "hover:bg-slate-50"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-8 h-8 flex items-center justify-center text-xs font-bold transition-colors border",
                                        !currentLotNumber 
                                            ? "bg-blue-500 text-white border-blue-500" 
                                            : "bg-white text-slate-400 border-slate-200 group-hover:border-slate-300"
                                    )}>
                                        {!currentLotNumber ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <p className={cn(
                                            "text-sm font-bold transition-colors",
                                            !currentLotNumber ? "text-blue-700" : "text-slate-600"
                                        )}>
                                            No Lot / Clear Selection
                                        </p>
                                        <p className="text-[10px] text-slate-400">Set lot number to empty</p>
                                    </div>
                                </div>
                            </button>

                            {filteredLots.length === 0 ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-500 text-sm mb-2 font-medium">No results found</p>
                                    {searchQuery ? (
                                        <p className="text-[10px] text-slate-400">Try a different search term</p>
                                    ) : (
                                        <p className="text-[10px] text-slate-400">Inventory might be 0 for this SKU</p>
                                    )}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {filteredLots.map((lot, idx) => {
                                        const isSelected = currentLotNumber === lot.lotNumber;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => onSelect(lot.lotNumber)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-6 py-3 transition-colors text-left group hover:bg-slate-50",
                                                    isSelected ? "bg-blue-50/50" : ""
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-8 h-8 flex items-center justify-center text-xs font-bold transition-colors border",
                                                        isSelected 
                                                            ? "bg-blue-500 text-white border-blue-500" 
                                                            : "bg-white text-slate-500 border-slate-200 group-hover:border-slate-300"
                                                    )}>
                                                        {isSelected ? <Check className="w-4 h-4" /> : `#${idx + 1}`}
                                                    </div>
                                                    <div>
                                                        <p className={cn(
                                                            "text-sm font-bold transition-colors",
                                                            isSelected ? "text-blue-700" : "text-slate-900"
                                                        )}>
                                                            {lot.lotNumber}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className={cn(
                                                                "text-[10px] uppercase font-bold tracking-wider",
                                                                isSelected ? "text-blue-500" : "text-slate-500"
                                                            )}>
                                                                {lot.source || 'Unknown'}
                                                            </span>
                                                            {lot.date && (
                                                                <>
                                                                    <span className="text-[10px] text-slate-300">•</span>
                                                                    <span className={cn(
                                                                        "text-[10px] font-medium",
                                                                        isSelected ? "text-blue-400" : "text-slate-400"
                                                                    )}>
                                                                        {new Date(lot.date).toLocaleDateString()}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={cn(
                                                        "block px-2.5 py-1 text-xs font-bold border transition-colors mb-1",
                                                        isSelected 
                                                            ? "bg-blue-100 text-blue-700 border-blue-200" 
                                                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                    )}>
                                                        {lot.balance.toLocaleString()}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[9px] uppercase font-bold tracking-widest",
                                                        isSelected ? "text-blue-300" : "text-slate-300"
                                                    )}>
                                                        Available
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-center flex items-center justify-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <p className="text-[10px] text-slate-400 font-medium">
                        Showing lots with positive inventory balance
                    </p>
                </div>
            </div>
        </div>
    );
}
