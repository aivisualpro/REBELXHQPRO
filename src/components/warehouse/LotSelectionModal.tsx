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
    cost?: number;
}

interface LotSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (lotNumber: string, cost?: number) => void;
    skuId: string;
    currentLotNumber?: string;
    title?: string;
    requiredQty?: number; // Required quantity for suggestion logic
}

export function LotSelectionModal({
    isOpen,
    onClose,
    onSelect,
    skuId,
    currentLotNumber,
    title = "Select Lot Number",
    requiredQty = 0
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

    // Sort lots from oldest to newest by date
    const sortedLots = [...lots].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB; // oldest first
    });

    // Filter: Include if searching OR balance > 0 OR matches currentLotNumber
    // User requested: "show the lot # which is already applied no matter if that lot # value is 0"
    const filteredLots = sortedLots.filter(lot => {
         const matchesSearch = lot.lotNumber.toLowerCase().includes(searchQuery.toLowerCase());
         const isCurrent = lot.lotNumber === currentLotNumber;
         const hasBalance = lot.balance > 0;

         // If searching, show all matches. If not searching, show positive balance OR current.
         if (searchQuery) return matchesSearch;
         return hasBalance || isCurrent;
    });

    // Separate selected lot from others (to show first after None)
    const selectedLot = filteredLots.find(lot => lot.lotNumber === currentLotNumber);
    const otherLots = filteredLots.filter(lot => lot.lotNumber !== currentLotNumber);

    // Format date as mm/dd/yyyy
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    };

    // Suggested lot logic:
    // 1. First, find lots with balance >= requiredQty (if requiredQty specified)
    // 2. Among those, pick the oldest (FIFO)
    // 3. If no lots have sufficient qty, fall back to oldest lot with any balance
    const getSuggestedLot = () => {
        if (otherLots.length === 0) return null;
        
        if (requiredQty > 0) {
            // Find lots with sufficient quantity
            const sufficientLots = otherLots.filter(lot => lot.balance >= requiredQty);
            if (sufficientLots.length > 0) {
                // Return the oldest lot with sufficient qty (already sorted by date)
                return sufficientLots[0].lotNumber;
            }
        }
        
        // Fall back to oldest lot with any positive balance
        const positiveLots = otherLots.filter(lot => lot.balance > 0);
        return positiveLots.length > 0 ? positiveLots[0].lotNumber : otherLots[0].lotNumber;
    };
    
    const suggestedLotNumber = getSuggestedLot();

    // Render a lot item
    const renderLotItem = (lot: Lot, idx: number, isSelected: boolean, isSuggested: boolean = false) => (
        <button
            key={lot.lotNumber}
            onClick={() => onSelect(lot.lotNumber, lot.cost)}
            className={cn(
                "w-full flex items-center justify-between px-6 py-3 transition-colors text-left group hover:bg-slate-50",
                isSelected ? "bg-blue-50/50" : "",
                isSuggested && !isSelected ? "bg-amber-50/50" : ""
            )}
        >
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-8 h-8 flex items-center justify-center text-xs font-bold transition-colors border",
                    isSelected 
                        ? "bg-blue-500 text-white border-blue-500"
                        : isSuggested 
                            ? "bg-amber-500 text-white border-amber-500" 
                            : "bg-white text-slate-500 border-slate-200 group-hover:border-slate-300"
                )}>
                    {isSelected ? <Check className="w-4 h-4" /> : isSuggested ? '★' : `#${idx + 1}`}
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <p className={cn(
                            "text-sm font-bold transition-colors",
                            isSelected ? "text-blue-700" : isSuggested ? "text-amber-700" : "text-slate-900"
                        )}>
                            {lot.lotNumber}
                        </p>
                        {isSelected && (
                            <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200">
                                Selected
                            </span>
                        )}
                        {isSuggested && !isSelected && (
                            <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                                Suggested
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                            "text-[10px] uppercase font-bold tracking-wider",
                            isSelected ? "text-blue-500" : isSuggested ? "text-amber-500" : "text-slate-500"
                        )}>
                            {lot.source || 'Unknown'}
                        </span>
                        {lot.date && (
                            <>
                                <span className="text-[10px] text-slate-300">•</span>
                                <span className={cn(
                                    "text-[10px] font-medium",
                                    isSelected ? "text-blue-400" : isSuggested ? "text-amber-400" : "text-slate-400"
                                )}>
                                    {formatDate(lot.date)}
                                </span>
                            </>
                        )}
                        {lot.cost !== undefined && (
                            <>
                                <span className="text-[10px] text-slate-300">•</span>
                                <span className={cn(
                                    "text-[10px] font-mono font-medium",
                                    isSelected ? "text-blue-500" : isSuggested ? "text-amber-500" : "text-green-600"
                                )}>
                                    ${lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
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
                        : isSuggested
                            ? "bg-amber-100 text-amber-700 border-amber-200" 
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                )}>
                    {lot.balance.toLocaleString()}
                </span>
                <span className={cn(
                    "text-[9px] uppercase font-bold tracking-widest",
                    isSelected ? "text-blue-300" : isSuggested ? "text-amber-300" : "text-slate-300"
                )}>
                    Available
                </span>
            </div>
        </button>
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
                                onClick={() => onSelect('', 0)}
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
                                            (N/A)
                                        </p>
                                        <p className="text-[10px] text-slate-400">Clear selection</p>
                                    </div>
                                </div>
                            </button>

                            {/* Show currently selected lot first (if any) */}
                            {selectedLot && (
                                <div className="border-b border-slate-100">
                                    {renderLotItem(selectedLot, 0, true)}
                                </div>
                            )}

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
                                    {otherLots.map((lot, idx) => renderLotItem(lot, idx + (selectedLot ? 1 : 0), false, lot.lotNumber === suggestedLotNumber))}
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
