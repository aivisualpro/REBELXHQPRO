'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertCircle, Search, Ban, Clock, Package, TrendingUp, Sparkles } from 'lucide-react';
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
    requiredQty?: number;
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
            const res = await fetch(`/api/warehouse/skus/${skuId}/ledger`);
            if (res.ok) {
                const data = await res.json();
                const txList = data.transactions || [];
                
                // Derive lots from ledger transactions (single source of truth)
                const isPendingProd = (t: any) => t.type === 'Produced' && ['pending', 'processing'].includes((t.status || '').toLowerCase());
                const isUnfulfilledCons = (t: any) => t.type === 'Consumption' && (t.status || '').toLowerCase() !== 'fulfilled';
                
                const lotMap = new Map<string, { balance: number; source: string; date: string; cost: number }>();
                const sorted = [...txList].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
                for (const tx of sorted) {
                    const lot = tx.lotNumber;
                    if (!lot || lot === '' || lot === 'N/A' || lot === '-') continue;
                    if (isPendingProd(tx) || isUnfulfilledCons(tx)) continue;
                    
                    const existing = lotMap.get(lot);
                    const sourceType = 
                        tx.type === 'Opening' ? 'Opening Balance' :
                        tx.type === 'Purchase Order' ? 'Purchase Order' :
                        tx.type === 'Produced' ? 'Manufacturing' :
                        tx.type === 'Audit' ? 'Audit Adjustment' :
                        tx.type;
                    
                    lotMap.set(lot, {
                        balance: (existing?.balance || 0) + (tx.quantity || 0),
                        source: existing?.source || sourceType,
                        date: existing?.date || tx.date,
                        cost: tx.cost > 0 && !existing?.cost ? tx.cost : (existing?.cost || 0),
                    });
                }
                
                const derivedLots = Array.from(lotMap.entries())
                    .map(([lotNumber, d]) => ({ lotNumber, balance: d.balance, source: d.source, date: d.date, cost: d.cost }))
                    .sort((a, b) => {
                        const dateA = a.date ? new Date(a.date).getTime() : 0;
                        const dateB = b.date ? new Date(b.date).getTime() : 0;
                        return dateA - dateB;
                    });
                setLots(derivedLots);
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

    // ── Derived data ──
    const { selectedLot, suggestedLotNumber, displayLots, totalAvailable } = useMemo(() => {
        // Sort lots oldest → newest (FIFO)
        const sorted = [...lots].sort((a, b) => {
            const dateA = a.date ? new Date(a.date).getTime() : 0;
            const dateB = b.date ? new Date(b.date).getTime() : 0;
            return dateA - dateB;
        });

        // Filter: hide zero-balance lots unless it's the currently selected lot
        const filtered = sorted.filter(lot => {
            const matchesSearch = lot.lotNumber.toLowerCase().includes(searchQuery.toLowerCase());
            const isCurrent = lot.lotNumber === currentLotNumber;
            const hasBalance = Math.abs(lot.balance) >= 1;

            if (searchQuery) return matchesSearch && (hasBalance || isCurrent);
            return hasBalance || isCurrent;
        });

        const selected = filtered.find(lot => lot.lotNumber === currentLotNumber) || null;
        const others = filtered.filter(lot => lot.lotNumber !== currentLotNumber);

        // Suggested lot: FIFO — oldest lot with positive balance
        // If requiredQty specified, prefer lots with enough stock
        let suggested: string | null = null;
        if (others.length > 0) {
            if (requiredQty > 0) {
                const sufficient = others.filter(lot => lot.balance >= requiredQty);
                suggested = sufficient.length > 0 ? sufficient[0].lotNumber : null;
            }
            // If no sufficient lot found, pick oldest with any positive balance
            if (!suggested) {
                const positive = others.filter(lot => lot.balance >= 1);
                suggested = positive.length > 0 ? positive[0].lotNumber : null;
            }
        }

        const totalAvail = filtered.reduce((acc, lot) => acc + Math.max(0, lot.balance), 0);

        return {
            selectedLot: selected,
            suggestedLotNumber: suggested,
            displayLots: others,
            totalAvailable: totalAvail
        };
    }, [lots, searchQuery, currentLotNumber, requiredQty]);

    if (!isOpen) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const getRelativeAge = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'today';
        if (diffDays === 1) return '1 day ago';
        if (diffDays < 30) return `${diffDays}d ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
        return `${Math.floor(diffDays / 365)}yr ago`;
    };

    const getSourceAbbreviation = (source?: string) => {
        if (!source) return 'UNK';
        if (source === 'Opening Balance') return 'OB';
        if (source === 'Manufacturing') return 'MFG';
        if (source === 'Audit Adjustment') return 'ADJ';
        if (source.startsWith('PO')) return 'PO';
        return source.substring(0, 4).toUpperCase();
    };

    const getSourceColor = (source?: string) => {
        if (!source) return 'text-muted-foreground';
        if (source === 'Opening Balance') return 'text-purple-400';
        if (source === 'Manufacturing') return 'text-orange-400';
        if (source === 'Audit Adjustment') return 'text-rose-400';
        if (source.startsWith('PO')) return 'text-blue-400';
        return 'text-muted-foreground';
    };

    // Unified lot renderer
    const renderLotItem = (lot: Lot, idx: number, isSelected: boolean, isSuggested: boolean = false) => {
        const isNegative = lot.balance < 0;
        const isZero = lot.balance === 0;

        return (
            <button
                key={lot.lotNumber}
                onClick={() => onSelect(lot.lotNumber, lot.cost)}
                className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 transition-all text-left group relative overflow-hidden",
                    isSelected
                        ? "bg-blue-500/8 hover:bg-blue-500/12"
                        : isSuggested
                            ? "bg-emerald-500/5 hover:bg-emerald-500/10"
                            : "hover:bg-secondary/60",
                )}
            >
                {/* Left accent bar */}
                <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-0.5 transition-all",
                    isSelected ? "bg-blue-500" : isSuggested ? "bg-emerald-500" : "bg-transparent group-hover:bg-border"
                )} />

                {/* Badge / Index */}
                <div className={cn(
                    "w-7 h-7 flex items-center justify-center text-[9px] font-black rounded-md shrink-0 transition-all",
                    isSelected
                        ? "bg-blue-500 text-white shadow-sm shadow-blue-500/30"
                        : isSuggested
                            ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                            : "bg-secondary text-muted-foreground border border-border group-hover:border-muted-foreground/50"
                )}>
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : isSuggested ? <Sparkles className="w-3 h-3" /> : `#${idx + 1}`}
                </div>

                {/* Lot info (center) */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                        <p className={cn(
                            "text-xs font-bold truncate transition-colors",
                            isSelected ? "text-blue-400" : isSuggested ? "text-emerald-400" : "text-foreground"
                        )}>
                            {lot.lotNumber}
                        </p>
                        {isSelected && (
                            <span className="px-1 py-px text-[7px] font-black uppercase tracking-widest bg-blue-500/15 text-blue-400 rounded shrink-0">
                                Current
                            </span>
                        )}
                        {isSuggested && !isSelected && (
                            <span className="px-1 py-px text-[7px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-400 rounded shrink-0">
                                FIFO Pick
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                            "text-[9px] font-bold uppercase tracking-wider",
                            getSourceColor(lot.source)
                        )}>
                            {getSourceAbbreviation(lot.source)}
                        </span>
                        {lot.date && (
                            <>
                                <span className="text-[8px] text-muted-foreground/30">•</span>
                                <span className="text-[9px] text-muted-foreground/70 font-medium">
                                    {formatDate(lot.date)}
                                </span>
                                <span className="text-[8px] text-muted-foreground/30">•</span>
                                <span className={cn(
                                    "text-[9px] font-medium",
                                    isSelected ? "text-blue-400/60" : isSuggested ? "text-emerald-400/60" : "text-muted-foreground/50"
                                )}>
                                    {getRelativeAge(lot.date)}
                                </span>
                            </>
                        )}
                        {lot.cost != null && lot.cost > 0 && (
                            <>
                                <span className="text-[8px] text-muted-foreground/30">•</span>
                                <span className="text-[9px] font-mono font-medium text-foreground/50">
                                    ${lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Balance chip (right) */}
                <div className="shrink-0 text-right">
                    <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold font-mono rounded transition-colors",
                        isNegative
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/15"
                            : isZero
                                ? "bg-muted text-muted-foreground border border-border"
                                : isSelected
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/15"
                                    : isSuggested
                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                                        : "bg-emerald-500/8 text-emerald-500 border border-emerald-500/12"
                    )}>
                        {lot.balance.toLocaleString()}
                    </div>
                    <p className="text-[7px] uppercase tracking-widest text-muted-foreground/40 mt-0.5 font-bold">
                        avail
                    </p>
                </div>
            </button>
        );
    };

    return (
        <div className="fixed inset-0 z-[2001] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-card shadow-2xl max-w-md w-full overflow-hidden border border-border rounded-lg animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-secondary/30">
                    <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">{title}</h3>
                        {requiredQty > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold font-mono bg-primary/10 text-primary border border-primary/20 rounded">
                                × {Math.abs(requiredQty).toLocaleString()} units
                            </span>
                        )}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-muted-foreground hover:text-foreground transition-colors p-1 hover:bg-secondary rounded"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Search */}
                <div className="px-4 py-3 border-b border-border bg-card">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input 
                            type="text"
                            placeholder="Search lot numbers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-4 h-8 border border-border rounded text-[11px] bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="max-h-[400px] overflow-y-auto scrollbar-custom">
                    {loading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin w-5 h-5 border-2 border-border border-t-primary rounded-full mx-auto mb-2"></div>
                            <p className="text-[10px] text-muted-foreground">Loading inventory...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-destructive">
                            <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-medium">{error}</p>
                        </div>
                    ) : (
                        <div>
                            {/* Clear option */}
                            <button
                                onClick={() => onSelect('', 0)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 transition-all text-left group border-b border-border",
                                    !currentLotNumber 
                                        ? "bg-blue-500/8" 
                                        : "hover:bg-secondary/50"
                                )}
                            >
                                <div className={cn(
                                    "w-7 h-7 flex items-center justify-center text-xs transition-colors border rounded-md",
                                    !currentLotNumber 
                                        ? "bg-blue-500 text-white border-blue-500 shadow-sm shadow-blue-500/30" 
                                        : "bg-secondary text-muted-foreground border-border group-hover:border-muted-foreground/50"
                                )}>
                                    {!currentLotNumber ? <Check className="w-3.5 h-3.5" /> : <Ban className="w-3 h-3" />}
                                </div>
                                <div>
                                    <p className={cn(
                                        "text-xs font-bold transition-colors",
                                        !currentLotNumber ? "text-blue-400" : "text-muted-foreground"
                                    )}>
                                        (No Lot)
                                    </p>
                                    <p className="text-[9px] text-muted-foreground/50">Clear lot assignment</p>
                                </div>
                            </button>

                            {/* Currently selected lot */}
                            {selectedLot && (
                                <div className="border-b border-border">
                                    {renderLotItem(selectedLot, 0, true)}
                                </div>
                            )}

                            {/* Suggested lot (if different from selected) */}
                            {suggestedLotNumber && suggestedLotNumber !== currentLotNumber && (
                                <div className="border-b border-border">
                                    {renderLotItem(
                                        displayLots.find(l => l.lotNumber === suggestedLotNumber)!,
                                        0,
                                        false,
                                        true
                                    )}
                                </div>
                            )}

                            {/* Remaining lots */}
                            {displayLots.length === 0 && !selectedLot ? (
                                <div className="text-center py-10">
                                    <Package className="w-6 h-6 mx-auto mb-2 text-muted-foreground/30" />
                                    <p className="text-muted-foreground text-xs font-medium mb-1">No lots with stock</p>
                                    <p className="text-[10px] text-muted-foreground/50">
                                        {searchQuery ? 'Try a different search' : 'All lot balances are zero'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {displayLots
                                        .filter(lot => lot.lotNumber !== suggestedLotNumber) // Already shown above
                                        .map((lot, idx) => renderLotItem(
                                            lot,
                                            idx + (selectedLot ? 1 : 0) + (suggestedLotNumber && suggestedLotNumber !== currentLotNumber ? 1 : 0),
                                            false,
                                            false
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Footer stats */}
                <div className="px-4 py-2 bg-secondary/30 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-muted-foreground/50" />
                        <p className="text-[9px] text-muted-foreground font-medium">
                            FIFO: Oldest lots shown first
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-emerald-500/50" />
                        <p className="text-[9px] text-muted-foreground font-medium">
                            <span className="font-bold text-emerald-500">{totalAvailable.toLocaleString()}</span> total available
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
