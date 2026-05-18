'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, AlertCircle, Search, Ban, Clock, Package, TrendingUp, Sparkles } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Lot {
    lotNumber: string;
    displayLotNumber?: string;
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
            const res = await fetch(`/api/warehouse/skus/${skuId}/ledger?lotsOnly=1`);
            if (res.ok) {
                const data = await res.json();
                const txList = data.transactions || [];

                // Derive lots from ledger transactions (single source of truth)
                const isPendingProd = (t: any) => t.type === 'Produced' && ['pending', 'processing'].includes((t.status || '').toLowerCase());
                const isUnfulfilledCons = (t: any) => t.type === 'Consumption' && (t.status || '').toLowerCase() !== 'fulfilled';
                const isTrashedMfg = (t: any) => (t.type === 'Produced' || t.type === 'Consumption') && (t.status || '').toLowerCase() === 'trash';
                const isPendingWebOrder = (t: any) => t.type === 'Web Order' && (t.status || '').toLowerCase() !== 'completed';
                // Wholesale Orders only count when Shipped, Completed, or Pending Payment
                const isPendingOrder = (t: any) => t.type === 'Orders' && !['shipped', 'completed', 'pending payment'].includes((t.status || '').toLowerCase());

                const lotMap = new Map<string, { balance: number; source: string; date: string; cost: number; hasSource?: boolean }>();
                const tp: Record<string, number> = { 'Opening': 0, 'Audit': 1, 'Purchase Order': 2, 'Produced': 3, 'Consumption': 4, 'Orders': 5, 'Web Order': 6 };
                const sorted = [...txList].sort((a: any, b: any) => {
                    const dayA = new Date(new Date(a.date).toDateString()).getTime();
                    const dayB = new Date(new Date(b.date).toDateString()).getTime();
                    if (dayA !== dayB) return dayA - dayB;
                    const aPf = a.quantity > 0 ? 0 : 1;
                    const bPf = b.quantity > 0 ? 0 : 1;
                    if (aPf !== bPf) return aPf - bPf;
                    return (tp[a.type] ?? 9) - (tp[b.type] ?? 9);
                });

                const SOURCE_TYPES = new Set(['Opening', 'Purchase Order', 'Produced', 'Audit']);

                const NO_LOT_KEY = '__no_lot__'; // Internal key for no-lot transactions
                for (const tx of sorted) {
                    const rawLot = tx.lotNumber;
                    // Normalize: empty, N/A, - all map to the no-lot bucket
                    const lot = (!rawLot || rawLot === '' || rawLot === 'N/A' || rawLot === '-') ? NO_LOT_KEY : rawLot;
                    if (isPendingProd(tx) || isUnfulfilledCons(tx) || isTrashedMfg(tx) || isPendingWebOrder(tx) || isPendingOrder(tx)) continue;

                    const existing = lotMap.get(lot);
                    const isSourceType = SOURCE_TYPES.has(tx.type);
                    const sourceType = isSourceType ? (
                        tx.type === 'Opening' ? 'Opening Balance' :
                            tx.type === 'Purchase Order' ? 'Purchase Order' :
                                tx.type === 'Produced' ? 'Manufacturing' :
                                    tx.type === 'Audit' ? 'Audit Adjustment' :
                                        tx.type
                    ) : null;

                    const newHasSource = existing?.hasSource || isSourceType;
                    const newSource = existing?.hasSource ? existing.source : (sourceType || 'Unknown');
                    const newDate = (isSourceType && !existing?.hasSource) ? tx.date : (existing?.date || tx.date);

                    lotMap.set(lot, {
                        balance: (existing?.balance || 0) + (tx.quantity || 0),
                        source: newSource,
                        date: newDate,
                        cost: tx.cost > 0 && !existing?.cost ? tx.cost : (existing?.cost || 0),
                        hasSource: newHasSource,
                    });
                }

                const derivedLots = Array.from(lotMap.entries())
                    .map(([lotNumber, d]) => ({
                        lotNumber: lotNumber === NO_LOT_KEY ? '' : lotNumber,
                        displayLotNumber: lotNumber === NO_LOT_KEY ? 'No Lot' : lotNumber,
                        balance: d.balance,
                        source: d.source,
                        date: d.date,
                        cost: d.cost
                    }))
                    .sort((a, b) => {
                        if (a.lotNumber === '') return 1;
                        if (b.lotNumber === '') return -1;
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

        // Filter: hide zero-and-negative-balance lots unless it's the currently selected lot
        // Always exclude the no-lot bucket (lotNumber === '') — the "(No Lot)" clear button at top covers it
        const filtered = sorted.filter(lot => {
            if (lot.lotNumber === '') return false; // represented by the clear button
            const label = lot.displayLotNumber || lot.lotNumber;
            const matchesSearch = label.toLowerCase().includes(searchQuery.toLowerCase());
            const isCurrent = lot.lotNumber === currentLotNumber;
            const hasPositiveBalance = lot.balance >= 1;

            if (searchQuery) return matchesSearch && (hasPositiveBalance || isCurrent);
            return hasPositiveBalance || isCurrent;
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
                    "w-full flex items-center gap-4 px-5 py-4 transition-all text-left outline-none",
                    isSelected
                        ? "bg-blue-600 hover:bg-blue-700 shadow-md ring-2 ring-blue-500 ring-offset-1 ring-offset-background z-10"
                        : isSuggested
                            ? "bg-emerald-600 hover:bg-emerald-700 shadow-md ring-2 ring-emerald-500 ring-offset-1 ring-offset-background z-10"
                            : "hover:bg-secondary/80 group border-border/50",
                )}
            >
                {/* Badge / Index */}
                <div className={cn(
                    "w-8 h-8 flex items-center justify-center text-xs font-black rounded-md shrink-0 transition-all shadow-sm border",
                    isSelected || isSuggested
                        ? "bg-white/20 text-white border-white/20"
                        : "bg-background text-foreground border-border group-hover:border-foreground/30"
                )}>
                    {isSelected ? <Check className="w-4 h-4" /> : isSuggested ? <Sparkles className="w-4 h-4" /> : `#${idx + 1}`}
                </div>

                {/* Lot info (center) */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <p className={cn(
                            "text-sm font-black truncate transition-colors",
                            isSelected || isSuggested ? "text-white" : lot.lotNumber === '' ? "text-muted-foreground italic" : "text-foreground"
                        )}>
                            {lot.displayLotNumber || lot.lotNumber}
                        </p>
                        {isSelected && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-black/20 text-blue-100 rounded shrink-0">
                                Current
                            </span>
                        )}
                        {isSuggested && !isSelected && (
                            <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest bg-black/20 text-emerald-100 rounded shrink-0">
                                FIFO Pick
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={cn(
                            "text-[10px] sm:text-[11px] font-bold uppercase tracking-wider",
                            isSelected || isSuggested ? "text-white/90" : getSourceColor(lot.source)
                        )}>
                            {getSourceAbbreviation(lot.source)}
                        </span>
                        {lot.date && (
                            <>
                                <span className={cn("text-[10px]", isSelected || isSuggested ? "text-white/30" : "text-muted-foreground/30")}>•</span>
                                <span className={cn("text-xs font-medium", isSelected || isSuggested ? "text-white/80" : "text-muted-foreground/70")}>
                                    {formatDate(lot.date)}
                                </span>
                                <span className={cn("text-[10px]", isSelected || isSuggested ? "text-white/30" : "text-muted-foreground/30")}>•</span>
                                <span className={cn(
                                    "text-xs font-medium",
                                    isSelected || isSuggested ? "text-white/80" : "text-muted-foreground/50"
                                )}>
                                    {getRelativeAge(lot.date)}
                                </span>
                            </>
                        )}
                        {lot.cost != null && lot.cost > 0 && (
                            <>
                                <span className={cn("text-[10px]", isSelected || isSuggested ? "text-white/30" : "text-muted-foreground/30")}>•</span>
                                <span className={cn("text-xs font-mono font-bold", isSelected || isSuggested ? "text-white/70" : "text-foreground/60")}>
                                    ${lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Balance chip (right) */}
                <div className="shrink-0 text-right">
                    <div className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 text-sm font-black font-mono rounded shadow-sm transition-colors border",
                        isSelected || isSuggested
                            ? "bg-black/20 text-white border-transparent"
                            : isNegative
                                ? "bg-rose-600 text-white border-rose-700"
                                : isZero
                                    ? "bg-muted text-muted-foreground border-border"
                                    : "bg-emerald-600 text-white border-emerald-700"
                    )}>
                        {lot.balance.toLocaleString()}
                    </div>
                    <p className={cn("text-[10px] uppercase tracking-widest mt-1 font-bold", isSelected || isSuggested ? "text-white/60" : "text-muted-foreground/50")}>
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
                <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-zinc-950 dark:bg-background">
                    <div className="flex items-center gap-3">
                        <Package className="w-5 h-5 text-primary" />
                        <h3 className="text-base font-black text-white dark:text-foreground">{title}</h3>
                        {requiredQty > 0 && (
                            <span className="px-2 py-0.5 text-xs font-black font-mono bg-primary/20 text-primary border border-primary/30 rounded">
                                × {Math.abs(requiredQty).toLocaleString()} units
                            </span>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/60 hover:text-white dark:text-muted-foreground dark:hover:text-foreground transition-colors p-1 hover:bg-white/10 dark:hover:bg-secondary rounded"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 py-4 border-b border-border bg-card">
                    <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search lot numbers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 h-11 border-2 border-border rounded-lg text-sm font-bold bg-background text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50 transition-colors shadow-sm"
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
                                    "w-full flex items-center gap-4 px-5 py-4 transition-all text-left outline-none border-b border-border group",
                                    !currentLotNumber
                                        ? "bg-blue-600 shadow-md ring-2 ring-blue-500 ring-offset-1 ring-offset-background z-10"
                                        : "hover:bg-secondary/80"
                                )}
                            >
                                <div className={cn(
                                    "w-8 h-8 flex items-center justify-center text-xs font-black transition-colors rounded-md shadow-sm border",
                                    !currentLotNumber
                                        ? "bg-white/20 text-white border-white/20"
                                        : "bg-background text-foreground border-border group-hover:border-foreground/30"
                                )}>
                                    {!currentLotNumber ? <Check className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                </div>
                                <div className="flex-1">
                                    <p className={cn(
                                        "text-sm font-black transition-colors",
                                        !currentLotNumber ? "text-white" : "text-foreground"
                                    )}>
                                        (No Lot)
                                    </p>
                                    <p className={cn("text-xs font-medium mt-1", !currentLotNumber ? "text-white/80" : "text-muted-foreground/70")}>Clear lot assignment</p>
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
                <div className="px-5 py-4 bg-card border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground font-bold">
                            FIFO: Oldest lots shown first
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <p className="text-xs text-muted-foreground font-bold">
                            <span className="font-black text-emerald-600 dark:text-emerald-500">{totalAvailable.toLocaleString()}</span> total available
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
