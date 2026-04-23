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
    Link,
    Search,
    Archive,
    ArchiveRestore
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { usePermissions } from '@/hooks/usePermissions';

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
    isLotApplied?: boolean;
    isArchived?: boolean;
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

// Website color map — matches web products page WebsiteBadge exactly
const WEBSITE_STYLE_MAP: Record<string, { bg: string; color: string }> = {
    'KING': { bg: '#d97706', color: '#fff' },
    'GRASS': { bg: '#16a34a', color: '#fff' },
    'GRHK': { bg: '#0891b2', color: '#fff' },
    'REBEL': { bg: '#7c3aed', color: '#fff' },
    'GUD': { bg: '#e11d48', color: '#fff' },
};
const getWebsiteStyle = (name: string) => {
    const key = Object.keys(WEBSITE_STYLE_MAP).find(k => name?.toUpperCase().includes(k));
    return key ? WEBSITE_STYLE_MAP[key] : { bg: '#64748b', color: '#fff' };
};

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
    
    const { canDelete } = usePermissions();

    // Only treat http(s) URLs as valid images; relative paths (e.g. "SKUs_Images/...") cause 404s
    const isValidImageUrl = (url?: string) => !!url && (url.startsWith('http://') || url.startsWith('https://'));

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
    const [referenceSearch, setReferenceSearch] = useState('');
    const [lotSearch, setLotSearch] = useState('');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedVarianceId, setSelectedVarianceId] = useState<string | null>(null);
    const [selectedLot, setSelectedLot] = useState<string>('All');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);
    const [editingTx, setEditingTx] = useState<Transaction | null>(null);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<any>(null);
    const [isEditSaving, setIsEditSaving] = useState(false);

    // Linked web products
    const [linkedWebProducts, setLinkedWebProducts] = useState<LinkedWebProduct[]>([]);
    const [loadingLinkedProducts, setLoadingLinkedProducts] = useState(false);

    // Warning click -> filter ledger
    const [warningFilter, setWarningFilter] = useState<'pending' | 'unfulfilled' | null>(null);
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

    // Note: URL ?lot= param is now handled in the localStorage persistence effect below,
    // which gives URL params priority over saved localStorage values.

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

    // Filter Persistence: Load from localStorage on mount (URL param takes priority for lot)
    useEffect(() => {
        if (!id) return;
        const savedFilters = localStorage.getItem(`sku_filters_${id}`);
        const savedLot = localStorage.getItem(`sku_lot_${id}`);

        if (savedFilters) {
            try {
                setFilters(JSON.parse(savedFilters));
            } catch (e) { console.error("Error parsing saved filters", e); }
        }
        // URL ?lot= param takes priority over localStorage
        const lotParam = searchParams.get('lot');
        if (lotParam) {
            setSelectedLot(lotParam);
        } else if (savedLot) {
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
            if (!background) setLoadingLinkedProducts(true);

            // ⚡ Fire BOTH requests in parallel
            // When called after mutation (background=true), bust the server cache
            const cacheBust = background ? '?bust=1' : '';
            const [ledgerRes, wpRes] = await Promise.all([
                fetch(`/api/warehouse/skus/${id}/ledger${cacheBust}`),
                fetch(`/api/warehouse/skus/${id}/linked-web-products`),
            ]);

            // Process linked web products (independent)
            if (wpRes.ok) {
                const wpData = await wpRes.json();
                setLinkedWebProducts(wpData.linkedProducts || []);
            }
            setLoadingLinkedProducts(false);

            // Process ledger data
            if (ledgerRes.ok) {
                const data = await ledgerRes.json();
                setSku(data.sku);
                setTransactions(data.transactions || []);
                setFinancials(data.financials || null);
                if (data.settings?.missingSkuImage) setFallbackImage(data.settings.missingSkuImage);

                // Derive lots from ledger transactions (single source of truth)
                const txList = data.transactions || [];
                const lotMap = new Map<string, { balance: number; source: string; date: string | null; cost: number; hasSource?: boolean }>();
                const isPendingProd = (t: any) => t.type === 'Produced' && ['pending', 'processing'].includes((t.status || '').toLowerCase());
                const isUnfulfilledCons = (t: any) => t.type === 'Consumption' && (t.status || '').toLowerCase() !== 'fulfilled';

                // Sort oldest first for proper source/date attribution
                // When dates are equal, source (positive) records come first
                const lotTypePriority: Record<string, number> = {
                    'Opening': 0, 'Audit': 1, 'Purchase Order': 2, 'Produced': 3,
                    'Consumption': 4, 'Orders': 5, 'Web Order': 6,
                };
                const sorted = [...txList].sort((a: any, b: any) => {
                    const dayA = new Date(new Date(a.date).toDateString()).getTime();
                    const dayB = new Date(new Date(b.date).toDateString()).getTime();
                    if (dayA !== dayB) return dayA - dayB;
                    // Same day: positive records first
                    const aPosFlag = a.quantity > 0 ? 0 : 1;
                    const bPosFlag = b.quantity > 0 ? 0 : 1;
                    if (aPosFlag !== bPosFlag) return aPosFlag - bPosFlag;
                    return (lotTypePriority[a.type] ?? 9) - (lotTypePriority[b.type] ?? 9);
                });

                // Only these types can CREATE a lot (source types)
                const SOURCE_TYPES = new Set(['Opening', 'Purchase Order', 'Produced', 'Audit']);

                for (const tx of sorted) {
                    const lot = tx.lotNumber;
                    if (!lot || lot === '' || lot === 'N/A' || lot === '-') continue;
                    // Skip pending/processing and unfulfilled — same as ledger balance logic
                    if (isPendingProd(tx) || isUnfulfilledCons(tx)) continue;

                    const existing = lotMap.get(lot);

                    // Only derive source label from creation-type transactions
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
                        hasSource: newHasSource
                    });
                }

                const derivedLots = Array.from(lotMap.entries())
                    .map(([lotNumber, data]) => ({ lotNumber, ...data }))
                    .sort((a, b) => {
                        const dateA = a.date ? new Date(a.date).getTime() : 0;
                        const dateB = b.date ? new Date(b.date).getTime() : 0;
                        return dateA - dateB;
                    });
                setLots(derivedLots);
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
        // Reference search filter — search across reference, type, lotNumber, status, website
        if (referenceSearch) {
            const q = referenceSearch.toLowerCase().trim();
            const matchesRef = tx.reference?.toLowerCase().includes(q);
            const matchesType = tx.type?.toLowerCase().includes(q);
            const matchesLot = tx.lotNumber?.toLowerCase().includes(q);
            const matchesStatus = tx.status?.toLowerCase().includes(q);
            const matchesWebsite = (tx as any).website?.toLowerCase().includes(q);
            if (!matchesRef && !matchesType && !matchesLot && !matchesStatus && !matchesWebsite) return false;
        }
        return true;
    }).sort((a, b) => {
        const dayA = new Date(new Date(a.date).toDateString()).getTime();
        const dayB = new Date(new Date(b.date).toDateString()).getTime();
        const dir = sortOrder === 'asc' ? 1 : -1;
        if (dayA !== dayB) return (dayA - dayB) * dir;
        // Same day: positive (source) first, then by type
        const aPf = a.quantity > 0 ? 0 : 1;
        const bPf = b.quantity > 0 ? 0 : 1;
        if (aPf !== bPf) return (aPf - bPf) * dir;
        const tp: Record<string, number> = { 'Opening': 0, 'Audit': 1, 'Purchase Order': 2, 'Produced': 3, 'Consumption': 4, 'Orders': 5, 'Web Order': 6 };
        const tDiff = (tp[a.type] ?? 9) - (tp[b.type] ?? 9);
        if (tDiff !== 0) return tDiff * dir;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
    });

    const uniqueLots = Array.from(new Set(transactions.map(t => t.lotNumber).filter(l => l && l !== '')));

    const isPendingProduction = (tx: Transaction) => tx.type === 'Produced' && ['pending', 'processing'].includes((tx.status || '').toLowerCase());
    const isUnfulfilledConsumption = (tx: Transaction) => tx.type === 'Consumption' && (tx.status || '').toLowerCase() !== 'fulfilled';

    const finalTransactions = filteredTransactions.filter(tx => {
        // When reference search is active, bypass lot/variance/warning filters
        // so the search covers ALL data, not just the current filtered view
        if (referenceSearch && referenceSearch.trim()) return true;
        if (selectedLot !== 'All' && tx.lotNumber !== selectedLot) return false;
        if (selectedVarianceId) {
            if (tx.type === 'Web Order') return tx.varianceId === selectedVarianceId || tx._id === selectedVarianceId;
            return false;
        }
        // Warning filter
        if (warningFilter === 'pending') return isPendingProduction(tx);
        if (warningFilter === 'unfulfilled') return isUnfulfilledConsumption(tx);
        return true;
    });

    const displayTransactions = selectedLot === 'All'
        ? finalTransactions
        : (() => {
            const tpLot: Record<string, number> = { 'Opening': 0, 'Audit': 1, 'Purchase Order': 2, 'Produced': 3, 'Consumption': 4, 'Orders': 5, 'Web Order': 6 };
            let runningBal = 0;
            const ascTx = [...finalTransactions].sort((a, b) => {
                const dayA = new Date(new Date(a.date).toDateString()).getTime();
                const dayB = new Date(new Date(b.date).toDateString()).getTime();
                if (dayA !== dayB) return dayA - dayB;
                // Same day: positive first
                const aPf = a.quantity > 0 ? 0 : 1;
                const bPf = b.quantity > 0 ? 0 : 1;
                if (aPf !== bPf) return aPf - bPf;
                return (tpLot[a.type] ?? 9) - (tpLot[b.type] ?? 9);
            });
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, sortOrder, selectedLot, selectedVarianceId, referenceSearch]);

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
                                    {isValidImageUrl(sku.image) ? (
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
                                <div className="flex-1 bg-foreground flex items-center justify-center px-4 min-w-0">
                                    <h1 className="text-base font-black text-background leading-tight text-center line-clamp-2">{sku.name}</h1>
                                </div>
                            </div>
                        </div>

                        {/* Stock Level - Premium */}
                        <div className="px-4 pb-4 border-b border-border">
                            <div className={cn(
                                "relative rounded-lg px-4 py-5 flex flex-col items-center overflow-hidden border",
                                currentStock > (sku.reOrderPoint || 0)
                                    ? "bg-secondary border-emerald-900/40"
                                    : "bg-secondary border-orange-900/40"
                            )}>
                                {/* Subtle glow behind number */}
                                <div className={cn(
                                    "absolute inset-0 opacity-[0.03]",
                                    currentStock > (sku.reOrderPoint || 0)
                                        ? "bg-emerald-500"
                                        : "bg-orange-500"
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
                                        "text-5xl font-black tracking-tighter",
                                        currentStock > (sku.reOrderPoint || 0) ? "text-emerald-400" : "text-orange-400"
                                    )}>
                                        {currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                    </span>
                                    <span className="text-[13px] font-bold text-muted-foreground uppercase tracking-widest">{sku.uom || 'Unit'}</span>
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
                            const pendingTxs = transactions.filter(tx => isPendingProduction(tx));
                            const unfulfilledTxs = transactions.filter(tx => isUnfulfilledConsumption(tx));
                            if (pendingTxs.length === 0 && unfulfilledTxs.length === 0) return null;
                            const pendingQty = pendingTxs.reduce((acc, tx) => acc + tx.quantity, 0);
                            const unfulfilledQty = unfulfilledTxs.reduce((acc, tx) => acc + Math.abs(tx.quantity), 0);
                            return (
                                <div className="px-4 py-2">
                                    {pendingTxs.length > 0 && (
                                        <div
                                            className={cn(
                                                "w-full border px-5 py-4 cursor-pointer transition-all rounded-md mb-3 shadow-md",
                                                warningFilter === 'pending' ? "bg-rose-600 border-rose-500 ring-2 ring-rose-500 ring-offset-1 ring-offset-background" : "bg-rose-500 border-rose-600 hover:bg-rose-600"
                                            )}
                                            onClick={() => setWarningFilter(warningFilter === 'pending' ? null : 'pending')}
                                        >
                                            <div className="flex items-start space-x-3">
                                                <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-black text-white uppercase tracking-wide">
                                                        {pendingTxs.length} Pending/Processing Production{pendingTxs.length > 1 ? 's' : ''}
                                                    </p>
                                                    <p className="text-xs text-rose-100 mt-1 font-medium">
                                                        <span className="font-mono font-bold">+{pendingQty.toLocaleString()}</span> units not counted until fulfilled
                                                    </p>
                                                </div>
                                                {warningFilter === 'pending' && (
                                                    <span className="text-[10px] text-white uppercase tracking-wider font-extrabold self-center bg-black/20 px-2 py-0.5 rounded">Filtered</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {unfulfilledTxs.length > 0 && (
                                        <div
                                            className={cn(
                                                "w-full border px-5 py-4 cursor-pointer transition-all rounded-md mb-3 shadow-md",
                                                warningFilter === 'unfulfilled' ? "bg-rose-600 border-rose-500 ring-2 ring-rose-500 ring-offset-1 ring-offset-background" : "bg-rose-500 border-rose-600 hover:bg-rose-600"
                                            )}
                                            onClick={() => setWarningFilter(warningFilter === 'unfulfilled' ? null : 'unfulfilled')}
                                        >
                                            <div className="flex items-start space-x-3">
                                                <AlertTriangle className="w-5 h-5 text-white shrink-0" />
                                                <div className="flex-1">
                                                    <p className="text-sm font-black text-white uppercase tracking-wide">
                                                        {unfulfilledTxs.length} Unfulfilled Consumption{unfulfilledTxs.length > 1 ? 's' : ''}
                                                    </p>
                                                    <p className="text-xs text-rose-100 mt-1 font-medium">
                                                        <span className="font-mono font-bold">{unfulfilledQty.toLocaleString()}</span> units not counted until fulfilled
                                                    </p>
                                                </div>
                                                {warningFilter === 'unfulfilled' && (
                                                    <span className="text-[10px] text-white uppercase tracking-wider font-extrabold self-center bg-black/20 px-2 py-0.5 rounded">Filtered</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        {/* Lots Summary Section */}
                        {lots.length > 0 && (
                            <div className="bg-background border-b border-border">
                                <div className="px-4 pt-4 pb-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Lot Inventory</h3>
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                            {lots.filter(l => Math.abs(l.balance) >= 1).length} lots
                                        </span>
                                    </div>
                                </div>
                                <div className="overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-secondary border-y border-border">
                                            <tr>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Lot #</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Type</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Date</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Cost</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {lots.filter(l => Math.abs(l.balance) >= 1).map((lot, idx) => (
                                                <tr
                                                    key={lot.lotNumber}
                                                    className={cn(
                                                        "hover:bg-secondary cursor-pointer transition-colors",
                                                        selectedLot === lot.lotNumber && "bg-primary/10 hover:bg-primary/15"
                                                    )}
                                                    onClick={() => setSelectedLot(selectedLot === lot.lotNumber ? 'All' : lot.lotNumber)}
                                                >
                                                    <td className="px-3 py-2.5 text-xs font-mono font-bold text-foreground truncate max-w-[160px]" title={lot.lotNumber}>
                                                        {lot.lotNumber}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-none",
                                                            lot.source === 'Opening Balance' ? 'bg-purple-600 text-white' :
                                                                lot.source === 'Manufacturing' ? 'bg-orange-500 text-white' :
                                                                    lot.source === 'Purchase Order' ? 'bg-blue-600 text-white' :
                                                                        lot.source === 'Audit Adjustment' ? 'bg-red-600 text-white' :
                                                                            'bg-secondary text-muted-foreground'
                                                        )}>
                                                            {lot.source === 'Opening Balance' ? 'OB' :
                                                                lot.source === 'Manufacturing' ? 'MFG' :
                                                                    lot.source === 'Audit Adjustment' ? 'ADJ' :
                                                                        lot.source.startsWith('PO') ? 'PO' : lot.source.substring(0, 8)}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-xs text-muted-foreground font-mono font-bold">
                                                        {lot.date ? formatDate(lot.date) : '-'}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-right text-xs font-mono font-bold text-muted-foreground">
                                                        {lot.cost > 0 ? `$${lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                                    </td>
                                                    <td className={cn(
                                                        "px-3 py-2.5 text-right text-sm font-mono font-black",
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
                            <div className="bg-background border-b border-border">
                                <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                                    <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                        <Link className="w-4 h-4 text-indigo-400" />
                                        Web Products
                                    </h3>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                        {linkedWebProducts.length}
                                    </span>
                                </div>
                                {loadingLinkedProducts ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        <span className="text-[10px] text-muted-foreground ml-2">Loading…</span>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden">
                                        <table className="w-full text-left border-collapse">
                                            <thead className="bg-secondary border-y border-border">
                                                <tr>
                                                    <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[40px]"></th>
                                                    <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Website</th>
                                                    <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Web Product</th>
                                                    <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Variance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {linkedWebProducts.map((wp) => (
                                                    <tr
                                                        key={wp._id}
                                                        className="hover:bg-secondary cursor-pointer transition-colors group"
                                                        onClick={() => router.push(`/warehouse/web-products?search=${encodeURIComponent(wp.name)}`)}
                                                    >
                                                        <td className="px-3 py-2">
                                                            {wp.image ? (
                                                                <img
                                                                    src={wp.image}
                                                                    alt=""
                                                                    className="w-7 h-7 object-cover border border-border shrink-0"
                                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                />
                                                            ) : (
                                                                <div className="w-7 h-7 bg-secondary flex items-center justify-center shrink-0 border border-border">
                                                                    <Globe className="w-3 h-3 text-muted-foreground/50" />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {wp.website ? (() => {
                                                                const ws = getWebsiteStyle(wp.website);
                                                                return (
                                                                    <span
                                                                        className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap"
                                                                        style={{ background: ws.bg, color: ws.color }}
                                                                    >
                                                                        {wp.website}
                                                                    </span>
                                                                );
                                                            })() : (
                                                                <span className="text-[10px] text-muted-foreground/50">-</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span className="text-xs font-bold text-foreground group-hover:text-blue-500 transition-colors" title={wp.name}>
                                                                {wp.name}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {wp.linkedVariations.length > 0 ? (
                                                                <div className="flex flex-wrap gap-1">
                                                                    {wp.linkedVariations.map((v) => (
                                                                        <span key={v._id} className="text-[9px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 border border-border" title={v.name || v.sku}>
                                                                            {v.name || v.sku || `#${v.id}`}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[10px] text-muted-foreground/50">-</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Financial Summary */}
                        {financials && (
                            <div className="bg-background border-b border-border">
                                <div className="px-4 pt-4 pb-3">
                                    <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Financials</h3>
                                </div>
                                <div className="px-4 pb-6 space-y-8">

                                    {/* Tier 1 & 2: Show Revenue, Cost of Sales, Gross Profit */}
                                    {(sku?.tier === 1 || sku?.tier === 2) && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Total Revenue</span>
                                                <span className="text-base font-black text-foreground">${financials.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Cost of Sales</span>
                                                <span className="text-base font-medium text-muted-foreground">${financials.costOfSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline pt-2 border-t border-border">
                                                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Gross Profit</span>
                                                <span className={cn("text-base font-black", financials.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                    ${financials.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">COGM</span>
                                                <span className="text-base font-black text-foreground">${(financials.cogm || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">COGP</span>
                                                <span className="text-base font-medium text-muted-foreground">${(financials.cogp || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
                                                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">COGP</span>
                                                <span className="text-base font-black text-foreground">${(financials.cogp || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <p className="text-[10px] text-muted-foreground italic">Raw material - consumed in manufacturing only</p>
                                        </div>
                                    )}
                                    <div className="h-4" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        <button
                            onClick={handleEditSku}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-foreground transition-colors cursor-pointer rounded bg-secondary hover:bg-secondary border border-border shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={async () => {
                                const isArchived = (sku as any).isArchived;
                                const toastId = toast.loading(isArchived ? 'Restoring...' : 'Archiving...');
                                try {
                                    const res = await fetch(`/api/skus/${id}`, {
                                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ isArchived: !isArchived })
                                    });
                                    if (res.ok) {
                                        toast.success(isArchived ? 'Restored' : 'Archived', { id: toastId });
                                        fetchSkuDetails(true);
                                    } else {
                                        toast.error('Failed', { id: toastId });
                                    }
                                } catch {
                                    toast.error('Failed', { id: toastId });
                                }
                            }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded transition-colors cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.15)]",
                                (sku as any).isArchived
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20"
                            )}
                        >
                            {(sku as any).isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                            <span>{(sku as any).isArchived ? 'Restore' : 'Archive'}</span>
                        </button>
                        <button
                            onClick={async () => {
                                const isNoCost = (sku as any).noCost;
                                // Optimistic update — flip immediately
                                setSku((prev: any) => prev ? { ...prev, noCost: !isNoCost } : prev);
                                const toastId = toast.loading(isNoCost ? 'Enabling cost tracking...' : 'Disabling cost tracking...');
                                try {
                                    const res = await fetch(`/api/skus/${id}`, {
                                        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ noCost: !isNoCost })
                                    });
                                    if (res.ok) {
                                        toast.success(isNoCost ? 'Cost Tracking Enabled' : 'No Cost Applied', { id: toastId });
                                        fetchSkuDetails(true);
                                    } else {
                                        // Revert on failure
                                        setSku((prev: any) => prev ? { ...prev, noCost: isNoCost } : prev);
                                        toast.error('Failed', { id: toastId });
                                    }
                                } catch {
                                    setSku((prev: any) => prev ? { ...prev, noCost: isNoCost } : prev);
                                    toast.error('Failed', { id: toastId });
                                }
                            }}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded transition-colors cursor-pointer shadow-[0_1px_4px_rgba(0,0,0,0.15)]",
                                (sku as any).noCost
                                    ? "bg-amber-600 text-white hover:bg-amber-700"
                                    : "bg-secondary hover:bg-secondary border border-border text-foreground"
                            )}
                        >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>{(sku as any).noCost ? 'Cost Excluded' : 'No Cost'}</span>
                        </button>
                    </div>
                </aside>

                {/* Right Column: Ledger Workspace - Independent Scroll */}
                <main ref={mainScrollRef} className="flex-1 h-full overflow-y-auto bg-background relative scrollbar-custom">
                    {/* Nested Sticky Layer 1: Toolbar */}
                    <div className="sticky top-0 z-[30] bg-background border-b border-border px-4 h-10 flex items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Transaction Ledger</h3>
                            {isSaving && (
                                <span className="text-[10px] font-bold text-blue-500 animate-pulse">Saving changes...</span>
                            )}
                            {warningFilter && (
                                <button
                                    onClick={() => setWarningFilter(null)}
                                    className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-red-500/15 text-red-400 rounded border border-red-500/25 hover:bg-red-500/25 transition-colors"
                                >
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    {warningFilter === 'pending' ? 'Pending/Processing' : 'Unfulfilled'}
                                    <X className="w-2.5 h-2.5 ml-0.5" />
                                </button>
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
                                                <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Date Range</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input type="date" value={filters.fromDate} onChange={(e) => setFilters(prev => ({ ...prev, fromDate: e.target.value }))} className="w-full text-xs font-medium border border-border rounded px-2 py-1.5 bg-background text-foreground" />
                                                    <input type="date" value={filters.toDate} onChange={(e) => setFilters(prev => ({ ...prev, toDate: e.target.value }))} className="w-full text-xs font-medium border border-border rounded px-2 py-1.5 bg-background text-foreground" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Lot Selection</label>
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search lots..."
                                                        value={lotSearch}
                                                        onChange={e => setLotSearch(e.target.value)}
                                                        className="w-full pl-7 pr-3 h-8 border border-border rounded text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                                                    />
                                                </div>
                                                <div className="mt-1.5 max-h-40 overflow-y-auto border border-border rounded bg-background custom-scrollbar">
                                                    {[{ label: 'All Lots', value: 'All' }, ...uniqueLots.map(l => ({ label: l!, value: l! }))]
                                                        .filter(opt => !lotSearch || opt.label.toLowerCase().includes(lotSearch.toLowerCase()))
                                                        .map(opt => (
                                                            <button
                                                                key={opt.value}
                                                                onClick={() => { setSelectedLot(opt.value); setLotSearch(''); }}
                                                                className={cn(
                                                                    'w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-secondary transition-colors cursor-pointer',
                                                                    selectedLot === opt.value ? 'bg-primary/10 text-primary font-bold' : 'text-foreground'
                                                                )}
                                                            >
                                                                {opt.label}
                                                            </button>
                                                        ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-muted-foreground uppercase block mb-2">Search</label>
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground/50 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        placeholder="Search reference, type, lot..."
                                                        value={referenceSearch}
                                                        onChange={e => setReferenceSearch(e.target.value)}
                                                        className="w-full pl-7 pr-3 h-8 border border-border rounded text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground/50"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-muted-foreground uppercase block mb-3">Transaction Types</label>
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
                                                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">{t.label}</span>
                                                            </div>
                                                            <input
                                                                type="checkbox"
                                                                checked={filters[t.key]}
                                                                onChange={() => setFilters(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                                                                className="w-4 h-4 rounded border-border text-foreground focus:ring-primary"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-muted-foreground uppercase block mb-3">Special Filters</label>
                                                <div className="space-y-2">
                                                    <label className="flex items-center justify-between group cursor-pointer">
                                                        <div className="flex items-center space-x-2">
                                                            <AlertCircle className="w-4 h-4 text-amber-500" />
                                                            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">No Lot #</span>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.showOnlyNoLot}
                                                            onChange={() => setFilters(prev => ({ ...prev, showOnlyNoLot: !prev.showOnlyNoLot }))}
                                                            className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between group cursor-pointer">
                                                        <div className="flex items-center space-x-2">
                                                            <DollarSign className="w-4 h-4 text-rose-500" />
                                                            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-tight">No Cost</span>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={filters.showOnlyNoCost}
                                                            onChange={() => setFilters(prev => ({ ...prev, showOnlyNoCost: !prev.showOnlyNoCost }))}
                                                            className="w-4 h-4 rounded border-border text-rose-500 focus:ring-rose-500"
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
                                                        setReferenceSearch('');
                                                        setLotSearch('');
                                                        setSelectedLot('All');
                                                        localStorage.removeItem(`sku_filters_${id}`);
                                                        localStorage.removeItem(`sku_lot_${id}`);
                                                    }}
                                                    className="text-xs font-bold text-muted-foreground hover:text-foreground uppercase"
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
                                        <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">
                                            {paginatedTransactions.length === displayTransactions.length
                                                ? `${countable.length} Records`
                                                : `${Math.min(paginatedTransactions.length, countable.length)} of ${countable.length} Records`}
                                        </span>
                                        <span className="text-sm text-muted-foreground/50">|</span>
                                        <span className={cn(
                                            "text-sm font-bold font-mono",
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
                        <thead className="sticky top-10 z-[20] bg-secondary border-y border-border">
                            <tr>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border">Date</th>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border">Type</th>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border">Reference</th>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border">Lot #</th>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right border-r border-border">In/Out</th>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest border-r border-border">Status</th>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right border-r border-border">Balance</th>
                                <th className="px-3 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {paginatedTransactions.map((tx) => (
                                <tr key={tx._id} data-tx-id={tx._id} className={cn("hover:bg-secondary transition-colors group cursor-pointer", (isPendingProduction(tx) || isUnfulfilledConsumption(tx)) && "!bg-red-500/10 hover:!bg-red-500/15 border-l-2 border-l-red-500", highlightedTxIds.has(tx._id) && "ledger-row-flash")} onClick={() => router.push(tx.link)}>
                                    <td className="px-3 py-3 text-xs text-foreground/80 font-mono font-medium">{formatDate(tx.date)}</td>
                                    <td className="px-3 py-3">
                                        {tx.type === 'Web Order' && tx.reference ? (() => {
                                            // Parse WC-WEBSITENAME-ORDERNUM format
                                            const parts = tx.reference.split('-');
                                            if (parts.length >= 3) {
                                                const website = parts.slice(1, -1).join('-');
                                                const ws = getWebsiteStyle(website);
                                                return (
                                                    <div className="flex items-center space-x-2">
                                                        {getTypeIcon(tx.type)}
                                                        <span
                                                            className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap"
                                                            style={{ background: ws.bg, color: ws.color }}
                                                        >
                                                            {website}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="flex items-center space-x-2">
                                                    {getTypeIcon(tx.type)}
                                                    <span className="text-[11px] uppercase font-black text-muted-foreground">{tx.type}</span>
                                                </div>
                                            );
                                        })() : (
                                            <div className="flex items-center space-x-2">
                                                {getTypeIcon(tx.type)}
                                                <span className="text-[11px] uppercase font-black text-muted-foreground">{tx.type}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-foreground/80 font-medium">
                                        {tx.type === 'Web Order' && tx.reference ? (() => {
                                            const parts = tx.reference.split('-');
                                            if (parts.length >= 3) {
                                                const orderNum = parts[parts.length - 1];
                                                return <span className="text-xs font-bold font-mono text-foreground">{orderNum}</span>;
                                            }
                                            return <span className="truncate max-w-[150px]">{tx.reference}</span>;
                                        })() : (
                                            <span className="truncate max-w-[150px] block">{tx.reference}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-3 text-sm text-foreground/80 font-mono group/cell relative">
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
                                    <td className="px-3 py-3 text-right">
                                        <span className={cn(
                                            "text-xs font-mono font-black px-2 py-0.5 rounded",
                                            (isPendingProduction(tx) || isUnfulfilledConsumption(tx)) ? "text-white bg-amber-600 dark:bg-amber-700 line-through" :
                                                tx.quantity > 0 ? "text-white bg-emerald-600 dark:bg-emerald-700" : "text-white bg-rose-600 dark:bg-rose-700"
                                        )}>{tx.quantity > 0 ? '+' : ''}{tx.quantity}</span>
                                    </td>
                                    <td className="px-3 py-3">
                                        {tx.status ? (() => {
                                            const s = tx.status.toLowerCase();
                                            const sNormalized =
                                                s === 'fulfilled' ? 'Fulfilled' :
                                                    ['completed', 'delivered', 'shipped', 'received'].includes(s) ? 'Completed' :
                                                        ['in progress', 'processing', 'picking'].includes(s) ? 'Processing' :
                                                            s === 'ready to qc' ? 'Ready to QC' :
                                                                ['pending', 'draft', 'on-hold', 'on hold'].includes(s) ? 'Pending' :
                                                                    s;

                                            const styleMap: Record<string, { bg: string; color: string; border?: string; darkBg?: string; darkColor?: string }> = {
                                                'Fulfilled': { bg: '#059669', color: '#ffffff', darkBg: 'rgba(5,150,105,0.2)', darkColor: '#34d399' },
                                                'Completed': { bg: '#059669', color: '#ffffff', darkBg: 'rgba(5,150,105,0.2)', darkColor: '#34d399' },
                                                'Processing': { bg: '#2563eb', color: '#ffffff', darkBg: 'rgba(59,130,246,0.2)', darkColor: '#60a5fa' },
                                                'Ready to QC': { bg: '#d97706', color: '#ffffff', darkBg: 'rgba(245,158,11,0.2)', darkColor: '#fbbf24' },
                                                'Pending': { bg: '#e2e8f0', color: '#000000', border: '1px solid #cbd5e1', darkBg: 'rgba(100,116,139,0.2)', darkColor: '#cbd5e1' },
                                            };

                                            // Fallbacks for unmapped
                                            const defaultStyle = ['cancelled', 'rejected', 'failed'].includes(s) ?
                                                { bg: '#e11d48', color: '#fff' } :
                                                { bg: '#f1f5f9', color: '#64748b' };

                                            const styleColor = styleMap[sNormalized] || defaultStyle;

                                            return (
                                                <span
                                                    className="inline-flex items-center px-2 py-0.5 text-xs font-black uppercase tracking-wider status-badge"
                                                    style={{ backgroundColor: styleColor.bg, color: styleColor.color, border: styleColor.border, borderRadius: '4px' }}
                                                >
                                                    {tx.status}
                                                </span>
                                            );
                                        })() : <span className="text-xs text-muted-foreground/50">-</span>}
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm font-bold text-foreground font-mono">
                                        {(isPendingProduction(tx) || isUnfulfilledConsumption(tx)) ? <span className="text-muted-foreground/50">-</span> : tx.balance.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-3 text-right text-sm text-muted-foreground font-medium font-mono">
                                        {(isPendingProduction(tx) || isUnfulfilledConsumption(tx)) ? <span className="text-muted-foreground/50">-</span> : (tx.cost ? `$${tx.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-')}
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
                        <div className="flex items-center justify-between px-5 h-10 border-b border-border bg-secondary shrink-0">
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
                                            {["Finished Goods", "Part", "Packaging", "Shipping", "Lab Testing"].map(o => <option key={o} value={o}>{o}</option>)}
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
                                        <input type="checkbox" className="w-4 h-4 accent-primary" checked={editForm.isLotApplied} onChange={e => setEditForm({ ...editForm, isLotApplied: e.target.checked })} />
                                        <span className="text-xs font-bold uppercase text-muted-foreground">Lot Applied (Traceability)</span>
                                    </label>
                                </div>
                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end space-x-3 px-5 h-10 border-t border-border bg-secondary shrink-0">
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
