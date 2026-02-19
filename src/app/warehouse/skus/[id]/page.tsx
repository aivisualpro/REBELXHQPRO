'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    Package,
    Factory,
    ShoppingCart,
    History,
    TrendingUp,
    AlertCircle,
    AlertTriangle,
    ClipboardCheck,
    Globe,
    ArrowUpDown,
    Filter,
    Calendar,
    DollarSign,
    Loader2,
    Pencil,
    Trash2,
    X,
    Save,
    ExternalLink,
    Link
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';

interface Sku {
    _id: string;
    name: string;
    description?: string;
    category?: string;
    subCategory?: string;
    materialType?: string;
    uom?: string;
    image?: string;
    salePrice?: number;
    cost?: number;
    reOrderPoint?: number;
    orderUpto?: number;
    kitApplied?: boolean;
    isLotApplied?: boolean;
    createdAt?: string;
    variances?: {
        _id: string;
        name: string;
        image?: string;
        website?: string;
    }[];
    tier?: number;
}

interface Transaction {
    _id: string;
    date: string;
    type: string;
    reference: string;
    lotNumber?: string;
    quantity: number;
    uom: string;
    balance: number;
    docId: string;
    varianceId?: string;
    link: string;
    cost?: number;
    salePrice?: number;
    status?: string;
}

interface Financials {
    totalRevenue: number;
    costOfSales: number;
    grossProfit: number;
    cogm?: number;
    cogp?: number;
    chartData: { 
        date: string; 
        revenue: number; 
        qty: number;
        productionQty?: number;
        productionCost?: number;
    }[];
}

interface LinkedWebProduct {
    _id: string;
    name: string;
    image?: string;
    website?: string;
    webId?: number;
    type?: string;
    status?: string;
    permalink?: string;
    price?: number;
    salePrice?: number;
    totalWebOrders: number;
    isDirectLink: boolean;
    linkedVariations: {
        _id: string;
        id?: number;
        name?: string;
        sku?: string;
        price?: number;
        image?: string;
    }[];
}

const PAGE_SIZE = 20; // Load 20 rows at a time

function SkuDetailsPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { id } = params;

    const [sku, setSku] = useState<Sku | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [financials, setFinancials] = useState<Financials | null>(null);
    const [lots, setLots] = useState<{ lotNumber: string; source: string; date: string | null; cost: number; balance: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [fallbackImage, setFallbackImage] = useState('/sku-placeholder.png');
    
    // Pagination state for infinite scroll
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const tableContainerRef = useRef<HTMLElement>(null);

    const [filters, setFilters] = useState({
        fromDate: '',
        toDate: '',
        showOpeningBalance: true,
        showProduction: true,
        showConsumption: true,
        showPurchaseOrders: true,
        showSaleOrders: true,
        showWebOrders: true,
        showAuditAdjustments: true,
        showOnlyNoLot: false,
        showOnlyNoCost: false
    });
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedVarianceId, setSelectedVarianceId] = useState<string | null>(null);
    const [selectedLot, setSelectedLot] = useState<string>('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Edit/Delete state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<any>(null);
    const [isEditSaving, setIsEditSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Linked web products
    const [linkedWebProducts, setLinkedWebProducts] = useState<LinkedWebProduct[]>([]);
    const [loadingLinkedProducts, setLoadingLinkedProducts] = useState(false);

    // Warning click -> highlight ledger rows
    const [highlightedTxIds, setHighlightedTxIds] = useState<Set<string>>(new Set());
    const mainScrollRef = useRef<HTMLElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        }
        if (isFilterOpen) document.addEventListener("mousedown", handleClickOutside);
        else document.removeEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isFilterOpen]);

    useEffect(() => {
        const lotParam = searchParams.get('lot');
        if (lotParam) setSelectedLot(lotParam);
    }, [searchParams]);

    // Shell Viewport Lock: Prevents window-level scrolling for the industrial shell
    useEffect(() => {
        const originalBodyStyle = document.body.style.overflow;
        const originalHtmlStyle = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalBodyStyle;
            document.documentElement.style.overflow = originalHtmlStyle;
        };
    }, []);

    // Filter Persistence: Load from localStorage on mount
    useEffect(() => {
        if (!id) return;
        const savedFilters = localStorage.getItem(`sku_filters_${id}`);
        const savedLot = localStorage.getItem(`sku_lot_${id}`);
        
        if (savedFilters) {
            try {
                setFilters(JSON.parse(savedFilters));
            } catch (e) { console.error("Error parsing saved filters", e); }
        }
        if (savedLot) {
            setSelectedLot(savedLot);
        }
    }, [id]);

    // Filter Persistence: Save to localStorage on change
    useEffect(() => {
        if (!id || loading) return; // Don't save if loading or no ID
        localStorage.setItem(`sku_filters_${id}`, JSON.stringify(filters));
    }, [filters, id, loading]);

    useEffect(() => {
        if (!id || loading) return;
        localStorage.setItem(`sku_lot_${id}`, selectedLot);
    }, [selectedLot, id, loading]);

    useEffect(() => {
        if (id) fetchSkuDetails();
    }, [id]);

    const fetchSkuDetails = async (background = false) => {
        try {
            if (!background) setLoading(true);
            const res = await fetch(`/api/warehouse/skus/${id}/ledger`);
            if (res.ok) {
                const data = await res.json();
                setSku(data.sku);
                setTransactions(data.transactions || []);
                setFinancials(data.financials || null);
                if (data.settings?.missingSkuImage) setFallbackImage(data.settings.missingSkuImage);
                
                // Fetch lots data after main data loads
                fetch(`/api/warehouse/skus/${id}/lots`)
                    .then(r => r.json())
                    .then(lotsData => setLots(lotsData.lots || []))
                    .catch(() => {}); // Silently fail if lots fetch fails

                // Fetch linked web products
                setLoadingLinkedProducts(true);
                fetch(`/api/warehouse/skus/${id}/linked-web-products`)
                    .then(r => r.json())
                    .then(wpData => setLinkedWebProducts(wpData.linkedProducts || []))
                    .catch(() => {})
                    .finally(() => setLoadingLinkedProducts(false));
            } else {
                if (!background) toast.error("Failed to load SKU details");
            }
        } catch (error) {
            console.error(error);
            if (!background) toast.error("Error loading data");
        } finally {
            if (!background) setLoading(false);
        }
    };

    const handleSaveLotUpdate = async (newLotNumber: string) => {
        if (!editingTx || !sku) return;
        
        // 1. Optimistic Update (Immediate Feedback)
        setIsLotModalOpen(false);
        const originalTx = editingTx;
        const originalTransactions = [...transactions];
        
        // Optimistically update the transaction in the list
        setTransactions(prev => prev.map(t => 
            t._id === originalTx._id ? { ...t, lotNumber: newLotNumber } : t
        ));
        
        setEditingTx(null);

        try {
            setIsSaving(true);
            
            // 2. Background Update
            const res = await fetch(`/api/warehouse/skus/${sku._id}/transaction-update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: originalTx.type,
                    docId: originalTx.docId,
                    lineItemId: originalTx._id, 
                    newLotNumber: newLotNumber,
                    skuId: sku._id
                })
            });

            if (res.ok) {
                // 3. Silent Refresh to match backend (balances, lot inventory sidebar)
                // We wait a tiny bit to ensure DB consistency if needed, generally standard API is fast enough.
                fetchSkuDetails(true);
            } else {
                // Revert on failure
                setTransactions(originalTransactions);
                const data = await res.json();
                toast.error(data.error || "Failed to save lot update");
            }
        } catch (error) {
            console.error(error);
            setTransactions(originalTransactions);
            toast.error("Error updating lot");
        } finally {
            setIsSaving(false);
            setIsUpdating(false);
        }
    };

    const getTypeIcon = (type: string) => {
        if (type.includes('Opening')) return <History className="w-3.5 h-3.5 text-purple-500" />;
        if (type.includes('Purchase')) return <ShoppingCart className="w-3.5 h-3.5 text-blue-500" />;
        if (type === 'Orders' || type.includes('Sale')) return <ShoppingCart className="w-3.5 h-3.5 text-emerald-500" />;
        if (type === 'Produced' || type.includes('Manufacturing')) return <Factory className="w-3.5 h-3.5 text-orange-500" />;
        if (type === 'Web Order') return <Globe className="w-3.5 h-3.5 text-indigo-500" />;
        if (type === 'Audit' || type === 'Audit Adjustment') return <ClipboardCheck className="w-3.5 h-3.5 text-red-500" />;
        return <TrendingUp className="w-3.5 h-3.5 text-slate-500" />;
    };

    const filteredTransactions = transactions.filter(tx => {
        if (filters.fromDate && new Date(tx.date) < new Date(filters.fromDate)) return false;
        if (filters.toDate) {
            const endOfDay = new Date(filters.toDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (new Date(tx.date) > endOfDay) return false;
        }
        if (tx.type === 'Opening' && !filters.showOpeningBalance) return false;
        if (tx.type === 'Produced' && !filters.showProduction) return false;
        if (tx.type === 'Consumption' && !filters.showConsumption) return false;
        if (tx.type === 'Purchase Order' && !filters.showPurchaseOrders) return false;
        if (tx.type === 'Orders' && !filters.showSaleOrders) return false;
        if (tx.type === 'Web Order' && !filters.showWebOrders) return false;
        if ((tx.type === 'Audit' || tx.type === 'Audit Adjustment') && !filters.showAuditAdjustments) return false;
        // New filters: show only records missing lot or cost
        if (filters.showOnlyNoLot && tx.lotNumber && tx.lotNumber !== '' && tx.lotNumber !== 'N/A' && tx.lotNumber !== '-') return false;
        if (filters.showOnlyNoCost && tx.cost && tx.cost > 0) return false;
        return true;
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    const uniqueLots = Array.from(new Set(transactions.map(t => t.lotNumber).filter(l => l && l !== '')));

    const finalTransactions = filteredTransactions.filter(tx => {
        if (selectedLot !== 'All' && tx.lotNumber !== selectedLot) return false;
        if (selectedVarianceId) {
            if (tx.type === 'Web Order') return tx.varianceId === selectedVarianceId || tx._id === selectedVarianceId;
            return false;
        }
        return true;
    });

    const isPendingProduction = (tx: Transaction) => tx.type === 'Produced' && (tx.status === 'Pending' || tx.status === 'Processing');
    const isUnfulfilledConsumption = (tx: Transaction) => tx.type === 'Consumption' && tx.status !== 'Fulfilled';

    const displayTransactions = selectedLot === 'All' 
        ? finalTransactions 
        : (() => {
            let runningBal = 0;
            const ascTx = [...finalTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const balanced = ascTx.map(tx => {
                if (!isPendingProduction(tx) && !isUnfulfilledConsumption(tx)) {
                    runningBal += tx.quantity;
                }
                return { ...tx, balance: runningBal };
            });
            return sortOrder === 'asc' ? balanced : balanced.reverse();
        })();

    // Paginated transactions for infinite scroll (only show visibleCount rows)
    const paginatedTransactions = useMemo(() => 
        displayTransactions.slice(0, visibleCount), 
        [displayTransactions, visibleCount]
    );

    const hasMore = visibleCount < displayTransactions.length;

    // Reset visible count when filters/sort/lot changes
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [filters, sortOrder, selectedLot, selectedVarianceId]);

    // Infinite scroll: load more when bottom is reached
    useEffect(() => {
        if (!loadMoreRef.current || !hasMore) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
                    setIsLoadingMore(true);
                    // Simulate slight delay for smooth UX, then load more
                    setTimeout(() => {
                        setVisibleCount(prev => Math.min(prev + PAGE_SIZE, displayTransactions.length));
                        setIsLoadingMore(false);
                    }, 100);
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, displayTransactions.length]);

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-background">
            <LoadingSpinner size="lg" message="Loading SKU Ledger" />
        </div>
    );

    if (!sku) return (
        <div className="flex flex-col items-center justify-center h-screen bg-background">
            <h2 className="text-xl font-bold text-foreground">SKU Not Found</h2>
            <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-foreground text-background rounded text-sm font-medium">Go Back</button>
        </div>
    );

    const currentStock = transactions.length > 0 ? transactions[0].balance : 0;

    const handleEditSku = () => {
        setEditForm({
            name: sku.name || '',
            image: sku.image || '',
            category: sku.category || '',
            subCategory: sku.subCategory || '',
            materialType: sku.materialType || '',
            uom: sku.uom || '',
            salePrice: sku.salePrice || 0,
            orderUpto: sku.orderUpto || 0,
            reOrderPoint: sku.reOrderPoint || 0,
            kitApplied: sku.kitApplied || false,
            isLotApplied: sku.isLotApplied || false,
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editForm?.name) return toast.error('Name is required');
        setIsEditSaving(true);
        try {
            const res = await fetch(`/api/skus/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                toast.success('SKU updated');
                setIsEditModalOpen(false);
                fetchSkuDetails(true);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to update SKU');
            }
        } catch (e) {
            toast.error('Error updating SKU');
        } finally {
            setIsEditSaving(false);
        }
    };

    const handleDeleteSku = () => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this SKU?</p>
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
                                const res = await fetch(`/api/skus/${id}`, { method: 'DELETE' });
                                if (res.ok) {
                                    toast.success('SKU deleted');
                                    router.push('/warehouse/skus');
                                } else {
                                    const data = await res.json();
                                    toast.error(data.error || 'Failed to delete SKU');
                                }
                            } catch (e) {
                                toast.error('Error deleting SKU');
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

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden bg-background">
            {/* Main Content Band (Split view) */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-background">
                {/* Left Column (30%) - Independent Scroll */}
                <aside className="w-[30%] h-full border-r border-border bg-background shrink-0 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto scrollbar-custom">
                    {/* SKU Hero Section - 3 Column: Image | Tier | Name */}
                    <div className="px-4 pt-4 pb-4">
                        <div className="flex items-stretch border border-border overflow-hidden">
                            {/* Column 1: Image */}
                            <div className="w-16 h-16 bg-secondary flex items-center justify-center shrink-0 border-r border-border overflow-hidden">
                                {sku.image ? (
                                    <img 
                                        src={sku.image} 
                                        alt={sku.name} 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
                                    />
                                ) : (
                                    <img src={fallbackImage} alt="Fallback" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                )}
                            </div>
                            {/* Column 2: Tier */}
                            {!!sku.tier && (
                                <div className={cn(
                                    "w-10 flex items-center justify-center shrink-0 border-r border-border",
                                    sku.tier === 1 ? "bg-emerald-500" :
                                    sku.tier === 2 ? "bg-blue-500" :
                                    "bg-orange-500"
                                )}>
                                    <span className="text-sm font-black text-white">{sku.tier}</span>
                                </div>
                            )}
                            {/* Column 3: Name */}
                            <div className="flex-1 bg-emerald-950/50 flex items-center justify-center px-3 min-w-0">
                                <h1 className="text-sm font-black text-foreground leading-tight text-center line-clamp-2">{sku.name}</h1>
                            </div>
                        </div>
                    </div>

                    {/* Stock Level - Premium */}
                    <div className="px-4 pb-4 border-b border-border">
                        <div className={cn(
                            "relative rounded-lg px-4 py-5 flex flex-col items-center overflow-hidden",
                            currentStock > (sku.reOrderPoint || 0)
                                ? "bg-gradient-to-b from-emerald-950/40 to-emerald-950/10 border border-emerald-500/20"
                                : "bg-gradient-to-b from-orange-950/40 to-orange-950/10 border border-orange-500/20"
                        )}>
                            {/* Subtle glow behind number */}
                            <div className={cn(
                                "absolute inset-0 opacity-20 blur-2xl",
                                currentStock > (sku.reOrderPoint || 0)
                                    ? "bg-emerald-500/30"
                                    : "bg-orange-500/30"
                            )} />
                            <div className="relative flex items-center gap-2 mb-2">
                                <div className={cn(
                                    "w-2 h-2 rounded-full animate-pulse",
                                    currentStock > (sku.reOrderPoint || 0) ? "bg-emerald-400" : "bg-orange-400"
                                )} />
                                <label className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.25em]">Stock Level</label>
                            </div>
                            <div className="relative flex items-baseline space-x-2">
                                <span className={cn(
                                    "text-4xl font-black tracking-tighter",
                                    currentStock > (sku.reOrderPoint || 0) ? "text-emerald-400" : "text-orange-400"
                                )}>
                                    {currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                </span>
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{sku.uom || 'Unit'}</span>
                            </div>
                            {sku.reOrderPoint != null && sku.reOrderPoint > 0 && (
                                <p className={cn(
                                    "relative text-[9px] font-medium mt-2 uppercase tracking-wider",
                                    currentStock > sku.reOrderPoint ? "text-emerald-500/60" : "text-orange-500/60"
                                )}>
                                    {currentStock > sku.reOrderPoint ? '✓ Above' : '⚠ Below'} reorder point ({sku.reOrderPoint.toLocaleString()})
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Warnings Section - stacked flush */}
                    {(() => {
                        const pendingTxs = transactions.filter(tx => tx.type === 'Produced' && (tx.status === 'Pending' || tx.status === 'Processing'));
                        const unfulfilledTxs = transactions.filter(tx => tx.type === 'Consumption' && tx.status !== 'Fulfilled');
                        if (pendingTxs.length === 0 && unfulfilledTxs.length === 0) return null;
                        const pendingQty = pendingTxs.reduce((acc, tx) => acc + tx.quantity, 0);
                        const unfulfilledQty = unfulfilledTxs.reduce((acc, tx) => acc + Math.abs(tx.quantity), 0);
                        return (
                            <div className="px-4 py-2">
                                {pendingTxs.length > 0 && (
                                    <div
                                        className="w-full bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 cursor-pointer hover:bg-red-500/20 transition-colors"
                                        onClick={() => {
                                            const ids = new Set(pendingTxs.map(tx => tx._id));
                                            setHighlightedTxIds(ids);
                                            // Ensure all are loaded
                                            const maxIdx = Math.max(...pendingTxs.map(tx => displayTransactions.findIndex(d => d._id === tx._id)));
                                            if (maxIdx >= visibleCount) setVisibleCount(maxIdx + 5);
                                            // Scroll to first match after render
                                            setTimeout(() => {
                                                const el = document.querySelector(`[data-tx-id="${pendingTxs[0]._id}"]`);
                                                if (el && mainScrollRef.current) {
                                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }
                                            }, 100);
                                            // Clear highlight after 3s
                                            setTimeout(() => setHighlightedTxIds(new Set()), 3000);
                                        }}
                                    >
                                        <div className="flex items-start space-x-2">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                                                    {pendingTxs.length} Pending/Processing Production{pendingTxs.length > 1 ? 's' : ''}
                                                </p>
                                                <p className="text-[9px] text-red-400/70 mt-0.5">
                                                    <span className="font-mono font-bold">+{pendingQty.toLocaleString()}</span> units not counted until fulfilled
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {unfulfilledTxs.length > 0 && (
                                    <div
                                        className="w-full bg-red-500/10 border-b border-red-500/20 px-4 py-2.5 cursor-pointer hover:bg-red-500/20 transition-colors"
                                        onClick={() => {
                                            const ids = new Set(unfulfilledTxs.map(tx => tx._id));
                                            setHighlightedTxIds(ids);
                                            const maxIdx = Math.max(...unfulfilledTxs.map(tx => displayTransactions.findIndex(d => d._id === tx._id)));
                                            if (maxIdx >= visibleCount) setVisibleCount(maxIdx + 5);
                                            setTimeout(() => {
                                                const el = document.querySelector(`[data-tx-id="${unfulfilledTxs[0]._id}"]`);
                                                if (el && mainScrollRef.current) {
                                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                }
                                            }, 100);
                                            setTimeout(() => setHighlightedTxIds(new Set()), 3000);
                                        }}
                                    >
                                        <div className="flex items-start space-x-2">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">
                                                    {unfulfilledTxs.length} Unfulfilled Consumption{unfulfilledTxs.length > 1 ? 's' : ''}
                                                </p>
                                                <p className="text-[9px] text-red-400/70 mt-0.5">
                                                    <span className="font-mono font-bold">{unfulfilledQty.toLocaleString()}</span> units not counted until fulfilled
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Lots Summary Section */}
                    {lots.length > 0 && (
                        <div className="p-4 bg-background border-b border-border">
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 border-b border-border pb-2">Lot Inventory</h3>
                            <div className="overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                                            <th className="pb-2">Lot #</th>
                                            <th className="pb-2">Type</th>
                                            <th className="pb-2">Date</th>
                                            <th className="pb-2 text-right">Cost</th>
                                            <th className="pb-2 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {lots.filter(l => Math.abs(l.balance) >= 1).map((lot, idx) => (
                                            <tr 
                                                key={lot.lotNumber} 
                                                className={cn(
                                                    "text-[11px] hover:bg-secondary/50 cursor-pointer transition-colors",
                                                    selectedLot === lot.lotNumber && "bg-primary/10 hover:bg-primary/15"
                                                )}
                                                onClick={() => setSelectedLot(selectedLot === lot.lotNumber ? 'All' : lot.lotNumber)}
                                            >
                                                <td className="py-1.5 font-mono font-medium text-foreground truncate max-w-[80px]" title={lot.lotNumber}>
                                                    {lot.lotNumber.length > 15 ? lot.lotNumber.substring(0, 15) + '...' : lot.lotNumber}
                                                </td>
                                                <td className="py-1.5 text-muted-foreground truncate max-w-[60px]" title={lot.source}>
                                                    {lot.source === 'Opening Balance' ? 'OB' : 
                                                     lot.source === 'Manufacturing' ? 'MFG' : 
                                                     lot.source === 'Audit Adjustment' ? 'ADJ' : 
                                                     lot.source.startsWith('PO') ? 'PO' : lot.source.substring(0, 8)}
                                                </td>
                                                <td className="py-1.5 text-muted-foreground font-mono">
                                                    {lot.date ? new Date(lot.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '-'}
                                                </td>
                                                <td className="py-1.5 text-right font-mono text-muted-foreground">
                                                    {lot.cost > 0 ? `$${lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}
                                                </td>
                                                <td className={cn(
                                                    "py-1.5 text-right font-mono font-bold",
                                                    lot.balance > 0 ? "text-emerald-500" : lot.balance < 0 ? "text-rose-500" : "text-muted-foreground"
                                                )}>
                                                    {lot.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Linked Web Products Section */}
                    {(linkedWebProducts.length > 0 || loadingLinkedProducts) && (
                        <div className="p-4 bg-background border-b border-border">
                            <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Link className="w-3.5 h-3.5 text-indigo-400" />
                                    Web Products
                                    <span className="text-[9px] font-medium text-muted-foreground/60 normal-case tracking-normal">
                                        ({linkedWebProducts.length})
                                    </span>
                                </h3>
                            </div>
                            {loadingLinkedProducts ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    <span className="text-[10px] text-muted-foreground ml-2">Loading…</span>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {linkedWebProducts.map((wp) => (
                                        <div
                                            key={wp._id}
                                            className="group flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 transition-all cursor-pointer relative"
                                            onClick={() => router.push(`/warehouse/web-products?search=${encodeURIComponent(wp.name)}`)}
                                        >
                                            {/* Image */}
                                            {wp.image ? (
                                                <img
                                                    src={wp.image}
                                                    alt=""
                                                    className="w-7 h-7 rounded object-cover border border-border shrink-0"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className="w-7 h-7 rounded bg-secondary flex items-center justify-center shrink-0 border border-border">
                                                    <Globe className="w-3 h-3 text-muted-foreground/50" />
                                                </div>
                                            )}

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    {/* Website badge */}
                                                    {wp.website && (
                                                        <span className="text-[7px] font-black uppercase tracking-wider px-1 py-px rounded bg-indigo-500/10 text-indigo-400/80 border border-indigo-500/15 shrink-0">
                                                            {wp.website.length > 12 ? wp.website.substring(0, 12) : wp.website}
                                                        </span>
                                                    )}
                                                    <p className="text-[9px] font-bold text-foreground truncate leading-none" title={wp.name}>
                                                        {wp.name}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {/* Status */}
                                                    <span className={cn(
                                                        "text-[7px] font-bold uppercase tracking-wider px-1 py-px rounded shrink-0",
                                                        wp.status === 'publish' ? 'bg-emerald-500/10 text-emerald-500/80' :
                                                        wp.status === 'draft' ? 'bg-amber-500/10 text-amber-500/80' :
                                                        'bg-secondary text-muted-foreground/60'
                                                    )}>
                                                        {wp.status || '?'}
                                                    </span>
                                                    {/* Type */}
                                                    <span className={cn(
                                                        "text-[7px] font-bold uppercase tracking-wider px-1 py-px rounded shrink-0",
                                                        wp.type === 'variable' ? 'bg-purple-500/10 text-purple-400/80' : 'bg-blue-500/10 text-blue-400/80'
                                                    )}>
                                                        {wp.type || 'simple'}
                                                    </span>
                                                    {/* Linked variations inline */}
                                                    {wp.linkedVariations.length > 0 && (
                                                        <>
                                                            <span className="text-[7px] text-muted-foreground/30">→</span>
                                                            {wp.linkedVariations.slice(0, 2).map((v) => (
                                                                <span key={v._id} className="text-[8px] text-muted-foreground/60 truncate max-w-[60px]" title={v.name || v.sku}>
                                                                    {v.name || v.sku || `#${v.id}`}
                                                                </span>
                                                            ))}
                                                            {wp.linkedVariations.length > 2 && (
                                                                <span className="text-[8px] text-muted-foreground/40">+{wp.linkedVariations.length - 2}</span>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Price + Orders */}
                                            <div className="shrink-0 text-right">
                                                <p className="text-[10px] font-bold text-foreground font-mono leading-none">
                                                    {wp.price != null ? `$${wp.price.toFixed(2)}` : '-'}
                                                </p>
                                                <p className="text-[8px] text-muted-foreground/50 font-mono mt-0.5">
                                                    {wp.totalWebOrders || 0} ord
                                                </p>
                                            </div>

                                            {/* External link */}
                                            {wp.permalink && (
                                                <a
                                                    href={wp.permalink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-0.5 hover:bg-secondary rounded transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                                    title="Open in store"
                                                >
                                                    <ExternalLink className="w-2.5 h-2.5 text-muted-foreground hover:text-indigo-400" />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Financial Summary */}
                    {financials && (
                        <div className="p-4 bg-background space-y-8">
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider mb-4 border-b border-border pb-2">Financials</h3>
                            
                            {/* Tier 1 & 2: Show Revenue, Cost of Sales, Gross Profit */}
                            {(sku?.tier === 1 || sku?.tier === 2) && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Revenue</span>
                                        <span className="text-sm font-bold text-foreground">${financials.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cost of Sales</span>
                                        <span className="text-sm font-medium text-muted-foreground">${financials.costOfSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline pt-2 border-t border-border">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Gross Profit</span>
                                        <span className={cn("text-sm font-bold", financials.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                            ${financials.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                        </span>
                                    </div>

                                    <div className="mt-8">
                                        <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Last 12 Months Turnover</h4>
                                        <div className="flex items-end space-x-1 pt-6 h-32">
                                            {financials.chartData.map((d, i) => {
                                                const maxRev = Math.max(...financials.chartData.map(c => c.revenue), 100); 
                                                const heightPct = (d.revenue / maxRev) * 100;
                                                const monthLabel = d.date ? new Date(d.date + '-01').toLocaleString('en-US', { month: 'short' }) : '';
                                                return (
                                                    <div key={i} className="flex-1 h-full flex flex-col group relative">
                                                        <div className="relative h-full flex flex-col justify-end w-full pb-px px-0.5">
                                                            <div 
                                                                className="bg-foreground/80 rounded-t hover:bg-foreground transition-all w-full relative group" 
                                                                style={{ height: d.revenue > 0 ? `${Math.max(heightPct, 4)}%` : '2px' }}
                                                            >
                                                                {d.revenue > 0 ? (
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex flex-col items-center pointer-events-none w-max z-10 opacity-100 group-hover:scale-110 transition-transform">
                                                                        <span className="text-[9px] font-bold text-foreground tracking-tighter">${Math.round(d.revenue).toLocaleString()}</span>
                                                                        <span className="text-[7px] text-muted-foreground font-medium uppercase">{d.qty || 0}</span>
                                                                    </div>
                                                                ) : null}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 hidden group-hover:block z-30 bg-black text-white text-[9px] px-2 py-1 rounded whitespace-nowrap shadow-xl">
                                                                    <p className="font-bold border-b border-white/20 mb-1">{d.date}</p>
                                                                    <p>Rev: ${d.revenue.toLocaleString()}</p>
                                                                    <p>Qty: {d.qty} units</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-[7px] text-muted-foreground font-medium text-center mt-1 uppercase tracking-tight">{monthLabel}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tier 2: Also show COGM, COGP and Manufacturing Chart */}
                            {sku?.tier === 2 && (
                                <div className="pt-8 border-t border-border space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">COGM</span>
                                        <span className="text-sm font-bold text-foreground">${(financials.cogm || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">COGP</span>
                                        <span className="text-sm font-medium text-muted-foreground">${(financials.cogp || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>

                                    <div className="mt-8">
                                        <h4 className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Last 12 Months Manufacturing</h4>
                                        <div className="flex items-end space-x-1 pt-6 h-32">
                                            {financials.chartData.map((d, i) => {
                                                const maxQty = Math.max(...financials.chartData.map(c => c.productionQty || 0), 10); 
                                                const heightPct = ((d.productionQty || 0) / maxQty) * 100;
                                                const monthLabel = d.date ? new Date(d.date + '-01').toLocaleString('en-US', { month: 'short' }) : '';
                                                return (
                                                    <div key={i} className="flex-1 h-full flex flex-col group relative">
                                                        <div className="relative h-full flex flex-col justify-end w-full pb-px px-0.5">
                                                            <div 
                                                                className="bg-orange-500 rounded-t hover:bg-orange-600 transition-all w-full relative group" 
                                                                style={{ height: d.productionQty && d.productionQty > 0 ? `${Math.max(heightPct, 4)}%` : '2px' }}
                                                            >
                                                                {d.productionQty && d.productionQty > 0 ? (
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex flex-col items-center pointer-events-none w-max z-10 opacity-100 group-hover:scale-110 transition-transform">
                                                                        <span className="text-[9px] font-bold text-orange-700 tracking-tighter">{d.productionQty.toLocaleString()}</span>
                                                                    </div>
                                                                ) : null}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 hidden group-hover:block z-30 bg-black text-white text-[9px] px-2 py-1 rounded whitespace-nowrap shadow-xl">
                                                                    <p className="font-bold border-b border-white/20 mb-1">{d.date}</p>
                                                                    <p>Prod: {d.productionQty?.toLocaleString()} units</p>
                                                                    <p>Cost: ${d.productionCost?.toLocaleString()}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-[7px] text-muted-foreground font-medium text-center mt-1 uppercase tracking-tight">{monthLabel}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tier 3: Show COGP (Raw Materials are purchased) */}
                            {sku?.tier === 3 && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">COGP</span>
                                        <span className="text-sm font-bold text-foreground">${(financials.cogp || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground italic">Raw material - consumed in manufacturing only</p>
                                </div>
                            )}
                            <div className="h-4" />
                        </div>
                    )}
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        <button
                            onClick={handleEditSku}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={handleDeleteSku}
                            disabled={isDeleting}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                        </button>
                    </div>
                </aside>

                {/* Right Column: Ledger Workspace - Independent Scroll */}
                <main ref={mainScrollRef} className="flex-1 h-full overflow-y-auto bg-background relative scrollbar-custom">
                    {/* Nested Sticky Layer 1: Toolbar */}
                    <div className="sticky top-0 z-[30] bg-background border-b border-border px-4 h-10 flex items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Transaction Ledger</h3>
                            {isSaving && (
                                <span className="text-[10px] font-bold text-blue-500 animate-pulse">Saving changes...</span>
                            )}
                            <div className="relative" ref={filterRef}>
                                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={cn("flex items-center space-x-1 px-3 py-1 text-[10px] font-bold border rounded transition-all", isFilterOpen ? "bg-foreground border-foreground text-background" : "bg-background border-border text-muted-foreground hover:bg-secondary shadow-sm")}>
                                    <Filter className="w-3 h-3" />
                                    <span>FILTERS</span>
                                </button>
                                {isFilterOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-64 bg-card border border-border rounded-lg shadow-2xl z-[100] p-4 animate-in fade-in zoom-in duration-200">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-2">Date Range</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input type="date" value={filters.fromDate} onChange={(e) => setFilters(prev => ({...prev, fromDate: e.target.value}))} className="w-full text-[10px] border border-border rounded px-2 py-1 bg-background text-foreground" />
                                                    <input type="date" value={filters.toDate} onChange={(e) => setFilters(prev => ({...prev, toDate: e.target.value}))} className="w-full text-[10px] border border-border rounded px-2 py-1 bg-background text-foreground" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-2">Lot Selection</label>
                                                <SearchableSelect options={[{ label: 'All Lots', value: 'All' }, ...uniqueLots.map(l => ({ label: l!, value: l! }))]} value={selectedLot} onChange={(val) => setSelectedLot(val)} placeholder="Select Lot..." triggerClassName="py-1 text-[10px] border-slate-200" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-3">Transaction Types</label>
                                                <div className="space-y-2">
                                                    {[
                                                        { label: 'Opening Bal.', key: 'showOpeningBalance' as const, icon: <History className="w-3 h-3 text-purple-500" /> },
                                                        { label: 'Purchase Ord.', key: 'showPurchaseOrders' as const, icon: <ShoppingCart className="w-3 h-3 text-blue-500" /> },
                                                        { label: 'Wholesale Ord.', key: 'showSaleOrders' as const, icon: <ShoppingCart className="w-3 h-3 text-emerald-500" /> },
                                                        { label: 'Web Orders', key: 'showWebOrders' as const, icon: <Globe className="w-3 h-3 text-indigo-500" /> },
                                                        { label: 'Produced', key: 'showProduction' as const, icon: <Factory className="w-3 h-3 text-orange-500" /> },
                                                        { label: 'Consumed', key: 'showConsumption' as const, icon: <TrendingUp className="w-3 h-3 text-slate-400" /> },
                                                        { label: 'Adjustments', key: 'showAuditAdjustments' as const, icon: <ClipboardCheck className="w-3 h-3 text-red-500" /> },
                                                    ].map((t) => (
                                                        <label key={t.key} className="flex items-center justify-between group cursor-pointer">
                                                            <div className="flex items-center space-x-2">
                                                                {t.icon}
                                                                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">{t.label}</span>
                                                            </div>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={filters[t.key]} 
                                                                onChange={() => setFilters(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                                                                className="w-3 h-3 rounded border-border text-foreground focus:ring-primary"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-muted-foreground uppercase block mb-3">Special Filters</label>
                                                <div className="space-y-2">
                                                    <label className="flex items-center justify-between group cursor-pointer">
                                                        <div className="flex items-center space-x-2">
                                                            <AlertCircle className="w-3 h-3 text-amber-500" />
                                                            <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">No Lot #</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={filters.showOnlyNoLot} 
                                                            onChange={() => setFilters(prev => ({ ...prev, showOnlyNoLot: !prev.showOnlyNoLot }))}
                                                            className="w-3 h-3 rounded border-border text-amber-500 focus:ring-amber-500"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between group cursor-pointer">
                                                        <div className="flex items-center space-x-2">
                                                            <DollarSign className="w-3 h-3 text-rose-500" />
                                                            <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">No Cost</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={filters.showOnlyNoCost} 
                                                            onChange={() => setFilters(prev => ({ ...prev, showOnlyNoCost: !prev.showOnlyNoCost }))}
                                                            className="w-3 h-3 rounded border-border text-rose-500 focus:ring-rose-500"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-border flex justify-end">
                                                <button 
                                                    onClick={() => {
                                                        const defaultFilters = {
                                                            fromDate: '', toDate: '', 
                                                            showOpeningBalance: true, showProduction: true, showConsumption: true,
                                                            showPurchaseOrders: true, showSaleOrders: true, showWebOrders: true, showAuditAdjustments: true,
                                                            showOnlyNoLot: false, showOnlyNoCost: false
                                                        };
                                                        setFilters(defaultFilters);
                                                        setSelectedLot('All');
                                                        localStorage.removeItem(`sku_filters_${id}`);
                                                        localStorage.removeItem(`sku_lot_${id}`);
                                                    }}
                                                    className="text-[9px] font-bold text-muted-foreground hover:text-foreground uppercase"
                                                >
                                                    Reset All
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                        </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {(() => {
                                const countable = displayTransactions.filter(tx => !isPendingProduction(tx) && !isUnfulfilledConsumption(tx));
                                const totalQty = countable.reduce((acc, tx) => acc + tx.quantity, 0);
                                return (
                                    <>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {paginatedTransactions.length === displayTransactions.length 
                                                ? `${countable.length} Records` 
                                                : `${Math.min(paginatedTransactions.length, countable.length)} of ${countable.length} Records`}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/50">|</span>
                                        <span className={cn(
                                            "text-[10px] font-bold font-mono",
                                            totalQty > 0 ? "text-emerald-600" : "text-rose-600"
                                        )}>
                                            {totalQty > 0 ? '+' : ''}
                                            {totalQty.toLocaleString()} Qty
                                        </span>
                                    </>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Nested Sticky Layer 2: Table Header (Pinned exactly below toolbar) */}
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-10 z-[20] bg-secondary/90 backdrop-blur-sm border-b border-border">
                            <tr>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border">Date</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border">Type</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border">Reference</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border">Lot #</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right border-r border-border">In/Out</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border">Status</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right border-r border-border">Balance</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedTransactions.map((tx) => (
                                <tr key={tx._id} data-tx-id={tx._id} className={cn("hover:bg-secondary/50 transition-colors group cursor-pointer", (isPendingProduction(tx) || isUnfulfilledConsumption(tx)) && "!bg-rose-950/20 hover:!bg-rose-950/30 border-l-2 border-l-rose-400", highlightedTxIds.has(tx._id) && "ledger-row-flash")} onClick={() => router.push(tx.link)}>
                                    <td className="px-3 py-2 text-[10px] text-muted-foreground font-mono">{new Date(tx.date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' })}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center space-x-2">
                                            {getTypeIcon(tx.type)}
                                            <span className="text-[9px] uppercase font-bold text-muted-foreground">{tx.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-muted-foreground truncate max-w-[120px]">{tx.reference}</td>
                                    <td className="px-3 py-2 text-[10px] text-muted-foreground font-mono group/cell relative">
                                        <div className="flex items-center justify-between">
                                            <span>{tx.lotNumber || '-'}</span>
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setEditingTx(tx); 
                                                    setIsLotModalOpen(true);
                                                }}
                                                className="opacity-0 group-hover/cell:opacity-100 p-1 hover:bg-secondary rounded transition-opacity"
                                                title="Edit Lot Number"
                                            >
                                                <Pencil className="w-3 h-3 text-muted-foreground" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <span className={cn(
                                            "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm",
                                            (isPendingProduction(tx) || isUnfulfilledConsumption(tx)) ? "text-amber-500/70 bg-amber-500/10 line-through" :
                                            tx.quantity > 0 ? "text-emerald-500 bg-emerald-500/10" : "text-rose-500 bg-rose-500/10"
                                        )}>{tx.quantity > 0 ? '+' : ''}{tx.quantity}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {tx.status ? (
                                            <span className={cn(
                                                "text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-sm",
                                                tx.status === 'Completed' || tx.status === 'Delivered' || tx.status === 'Shipped' || tx.status === 'Fulfilled' ? 'text-emerald-500 bg-emerald-500/10' :
                                                tx.status === 'In Progress' || tx.status === 'Processing' || tx.status === 'Ready to QC' ? 'text-blue-500 bg-blue-500/10' :
                                                tx.status === 'Cancelled' || tx.status === 'Rejected' ? 'text-rose-500 bg-rose-500/10' :
                                                tx.status === 'Pending' || tx.status === 'Draft' ? 'text-amber-500 bg-amber-500/10' :
                                                'text-muted-foreground bg-secondary'
                                            )}>{tx.status}</span>
                                        ) : <span className="text-[10px] text-muted-foreground/50">-</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right text-[10px] font-bold text-foreground font-mono">
                                        {(isPendingProduction(tx) || isUnfulfilledConsumption(tx)) ? <span className="text-muted-foreground/50">-</span> : tx.balance.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right text-[10px] text-muted-foreground font-mono">
                                        {(isPendingProduction(tx) || isUnfulfilledConsumption(tx)) ? <span className="text-muted-foreground/50">-</span> : (tx.cost ? `$${tx.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Load More Indicator */}
                    <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
                        {hasMore && (
                            <div className="flex items-center space-x-2 text-muted-foreground">
                                {isLoadingMore ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-[10px] font-medium">Loading more...</span>
                                    </>
                                ) : (
                                    <span className="text-[10px] font-medium">Scroll for more</span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="h-4" />
                </main>
            </div>


            {/* Standard Lot Selection Modal */}
            {editingTx && sku && (
                <LotSelectionModal
                    isOpen={isLotModalOpen}
                    onClose={() => {
                        setIsLotModalOpen(false);
                        setEditingTx(null);
                    }}
                    onSelect={(lotNumber) => handleSaveLotUpdate(lotNumber)}
                    skuId={sku._id}
                    currentLotNumber={editingTx.lotNumber}
                    title={`Update Lot for ${editingTx.type} #${editingTx.reference}`}
                    requiredQty={Math.abs(editingTx.quantity)}
                />
            )}

            {/* Edit SKU Modal */}
            {isEditModalOpen && editForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
                    <div className="relative z-10 w-full max-w-2xl mx-4 bg-background border border-border shadow-2xl rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 h-10 border-b border-border bg-secondary/30 shrink-0">
                            <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">Edit SKU</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-5 scrollbar-custom">
                            <form id="edit-sku-form" onSubmit={handleSaveEdit} className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Name <span className="text-destructive">*</span></label>
                                    <input
                                        type="text"
                                        required
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Image URL</label>
                                    <input
                                        type="text"
                                        value={editForm.image}
                                        onChange={e => setEditForm({ ...editForm, image: e.target.value })}
                                        className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Category</label>
                                        <select
                                            className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors appearance-none cursor-pointer"
                                            value={editForm.category}
                                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                        >
                                            <option value="">Select</option>
                                            {["Finished Goods", "High Priority", "Lab Testing", "Maintenance", "Packaging", "Part", "Shipping Category"].map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sub Category</label>
                                        <select
                                            className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors appearance-none cursor-pointer"
                                            value={editForm.subCategory}
                                            onChange={e => setEditForm({ ...editForm, subCategory: e.target.value })}
                                        >
                                            <option value="">Select</option>
                                            {["Bags", "Bottle And Lids", "Display Boxes", "Disposable Vape", "Edibles", "Flavors", "Hemp", "Kava", "Kratom", "Kratom Extract", "Kratom Powder", "Labels/Shrink-Bands", "Marketing Material", "Packagings", "R&D (Research And Developement)", "Raw Ingredients", "Simple", "Variable"].map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Material Type</label>
                                        <select
                                            className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors appearance-none cursor-pointer"
                                            value={editForm.materialType}
                                            onChange={e => setEditForm({ ...editForm, materialType: e.target.value })}
                                        >
                                            <option value="">Select</option>
                                            {["Bag", "Bottle", "Box", "Capsule", "Clings", "Crystal", "Dropper", "Edible", "Extracts", "Label", "Lid/Top", "Liquid", "Oils", "Postcards", "Posters", "Powder", "Sample Boxes", "Seal", "Shipping Boxes", "Shrinkband", "Smokables", "Stickers", "Suppository", "SWAG", "Table Tents", "Tablets", "Terpenes", "Topicals"].map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">UOM</label>
                                        <input
                                            list="edit-uom-options"
                                            className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                                            value={editForm.uom}
                                            onChange={e => setEditForm({ ...editForm, uom: e.target.value })}
                                            placeholder="Select or Type..."
                                        />
                                        <datalist id="edit-uom-options">
                                            {["EA", "G", "GAL", "HR", "KG", "L", "LBS", "MG", "ML", "OZ"].map(o => <option key={o} value={o} />)}
                                        </datalist>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sale Price ($)</label>
                                        <input type="number" step="any" value={editForm.salePrice || ''} onChange={e => setEditForm({ ...editForm, salePrice: parseFloat(e.target.value) || 0 })} className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Order Upto</label>
                                        <input type="number" step="any" value={editForm.orderUpto || ''} onChange={e => setEditForm({ ...editForm, orderUpto: parseFloat(e.target.value) || 0 })} className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Re-Order Point</label>
                                        <input type="number" step="any" value={editForm.reOrderPoint || ''} onChange={e => setEditForm({ ...editForm, reOrderPoint: parseFloat(e.target.value) || 0 })} className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors" />
                                    </div>
                                </div>

                                <div className="flex items-center space-x-6 pt-2">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 accent-primary" checked={editForm.kitApplied} onChange={e => setEditForm({ ...editForm, kitApplied: e.target.checked })} />
                                        <span className="text-xs font-bold uppercase text-muted-foreground">Kit Applied</span>
                                    </label>
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" className="w-4 h-4 accent-primary" checked={editForm.isLotApplied} onChange={e => setEditForm({ ...editForm, isLotApplied: e.target.checked })} />
                                        <span className="text-xs font-bold uppercase text-muted-foreground">Lot Applied (Traceability)</span>
                                    </label>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end space-x-3 px-5 h-10 border-t border-border bg-secondary/30 shrink-0">
                            <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors cursor-pointer">Cancel</button>
                            <button
                                form="edit-sku-form"
                                type="submit"
                                disabled={isEditSaving}
                                className={cn(
                                    "flex items-center space-x-2 px-5 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer",
                                    isEditSaving && "cursor-not-allowed"
                                )}
                            >
                                <Save className="w-3.5 h-3.5" />
                                <span>{isEditSaving ? 'Saving...' : 'Save Changes'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ... helper interfaces ...

// Default export with Suspense wrapper to fix build error with useSearchParams
export default function SkuDetailsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen bg-background">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        }>
            <SkuDetailsPageContent />
        </Suspense>
    );
}
