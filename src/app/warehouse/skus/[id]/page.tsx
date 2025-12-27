'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    Package,
    Factory,
    ShoppingCart,
    History,
    TrendingUp,
    AlertCircle,
    ClipboardCheck,
    Globe,
    ArrowUpDown,
    Filter,
    Calendar,
    DollarSign,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Sku {
    _id: string;
    name: string;
    description?: string;
    category?: string;
    subCategory?: string;
    uom?: string;
    image?: string;
    salePrice?: number;
    cost?: number;
    reOrderPoint?: number;
    orderUpto?: number;
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

const PAGE_SIZE = 20; // Load 20 rows at a time

export default function SkuDetailsPage() {
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

    const fetchSkuDetails = async () => {
        try {
            setLoading(true);
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
            } else {
                toast.error("Failed to load SKU details");
            }
        } catch (error) {
            console.error(error);
            toast.error("Error loading data");
        } finally {
            setLoading(false);
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

    const displayTransactions = selectedLot === 'All' 
        ? finalTransactions 
        : (() => {
            let runningBal = 0;
            const ascTx = [...finalTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const balanced = ascTx.map(tx => {
                runningBal += tx.quantity;
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
        <div className="flex items-center justify-center h-screen bg-white">
            <LoadingSpinner size="lg" message="Loading SKU Ledger" />
        </div>
    );

    if (!sku) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800">SKU Not Found</h2>
            <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-black text-white rounded text-sm font-medium">Go Back</button>
        </div>
    );

    const currentStock = transactions.length > 0 ? transactions[0].balance : 0;

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden bg-white">
            {/* Shell Layer 1: Route Header (Sticky at top of content band) */}
            <div className="sticky top-0 z-[10] bg-white border-b border-slate-200 px-4 flex items-center space-x-3 shrink-0 h-10 shadow-sm">
                <button onClick={() => router.back()} className="hover:bg-slate-100 transition-colors p-1 rounded-full">
                    <ArrowLeft className="w-4 h-4 text-slate-500" />
                </button>
                <div className="flex items-baseline space-x-3">
                    {sku.tier && (
                        <span className={cn(
                            "flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm",
                            sku.tier === 1 ? "bg-emerald-500" : sku.tier === 2 ? "bg-blue-500" : "bg-orange-500"
                        )}>{sku.tier}</span>
                    )}
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{sku.name}</h1>
                    <p className="text-[10px] text-slate-400 font-mono">{sku._id}</p>
                </div>
            </div>

            {/* Shell Layer 2: Main Middle Content Band (Split view) */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-white">
                {/* Left Column (30%) - Independent Scroll */}
                <aside className="w-[30%] h-full overflow-y-auto border-r border-slate-100 bg-white shrink-0 scrollbar-custom">
                    <div className="p-4">
                        <div className="flex items-center justify-center mb-6 bg-slate-50/50 p-4 h-48 border border-slate-100 border-dashed relative overflow-hidden rounded-lg">
                            <img src={sku.image || fallbackImage} alt={sku.name} className="h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }} />
                        </div>

                        <div className="space-y-6 pt-2 pb-6 flex flex-col items-center border-b border-slate-50">
                            <div className="flex flex-col items-center">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Stock Level</label>
                                <div className="flex items-baseline space-x-2">
                                    <span className={cn(
                                        "text-4xl font-black tracking-tighter",
                                        currentStock > (sku.reOrderPoint || 0) ? "text-slate-900" : "text-orange-600"
                                    )}>
                                        {currentStock.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                                    </span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{sku.uom || 'Unit'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lots Summary Section */}
                    {lots.length > 0 && (
                        <div className="p-4 bg-white border-b border-slate-100">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Lot Inventory</h3>
                            <div className="overflow-hidden">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                                            <th className="pb-2">Lot #</th>
                                            <th className="pb-2">Type</th>
                                            <th className="pb-2">Date</th>
                                            <th className="pb-2 text-right">Cost</th>
                                            <th className="pb-2 text-right">Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {lots.filter(l => l.balance !== 0).map((lot, idx) => (
                                            <tr 
                                                key={lot.lotNumber} 
                                                className={cn(
                                                    "text-[10px] hover:bg-slate-50 cursor-pointer transition-colors",
                                                    selectedLot === lot.lotNumber && "bg-blue-50 hover:bg-blue-100"
                                                )}
                                                onClick={() => setSelectedLot(selectedLot === lot.lotNumber ? 'All' : lot.lotNumber)}
                                            >
                                                <td className="py-1.5 font-mono font-medium text-slate-700 truncate max-w-[80px]" title={lot.lotNumber}>
                                                    {lot.lotNumber.length > 15 ? lot.lotNumber.substring(0, 15) + '...' : lot.lotNumber}
                                                </td>
                                                <td className="py-1.5 text-slate-500 truncate max-w-[60px]" title={lot.source}>
                                                    {lot.source === 'Opening Balance' ? 'OB' : 
                                                     lot.source === 'Manufacturing' ? 'MFG' : 
                                                     lot.source === 'Audit Adjustment' ? 'ADJ' : 
                                                     lot.source.startsWith('PO') ? 'PO' : lot.source.substring(0, 8)}
                                                </td>
                                                <td className="py-1.5 text-slate-400 font-mono">
                                                    {lot.date ? new Date(lot.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '-'}
                                                </td>
                                                <td className="py-1.5 text-right font-mono text-slate-600">
                                                    {lot.cost > 0 ? `$${lot.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}
                                                </td>
                                                <td className={cn(
                                                    "py-1.5 text-right font-mono font-bold",
                                                    lot.balance > 0 ? "text-emerald-600" : lot.balance < 0 ? "text-rose-600" : "text-slate-400"
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

                    {/* Financial Summary */}
                    {financials && (
                        <div className="p-4 bg-white space-y-8">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Financials</h3>
                            
                            {/* Tier 1 & 2: Show Revenue, Cost of Sales, Gross Profit */}
                            {(sku?.tier === 1 || sku?.tier === 2) && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Revenue</span>
                                        <span className="text-sm font-bold text-slate-900">${financials.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cost of Sales</span>
                                        <span className="text-sm font-medium text-slate-600">${financials.costOfSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Profit</span>
                                        <span className={cn("text-sm font-bold", financials.grossProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                            ${financials.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                        </span>
                                    </div>

                                    <div className="mt-8">
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Last 12 Months Turnover</h4>
                                        <div className="flex items-end space-x-1 pt-6 h-32">
                                            {financials.chartData.map((d, i) => {
                                                const maxRev = Math.max(...financials.chartData.map(c => c.revenue), 100); 
                                                const heightPct = (d.revenue / maxRev) * 100;
                                                const monthLabel = d.date ? new Date(d.date + '-01').toLocaleString('en-US', { month: 'short' }) : '';
                                                return (
                                                    <div key={i} className="flex-1 h-full flex flex-col group relative">
                                                        <div className="relative h-full flex flex-col justify-end w-full pb-px px-0.5">
                                                            <div 
                                                                className="bg-slate-800 rounded-t hover:bg-black transition-all w-full relative group" 
                                                                style={{ height: d.revenue > 0 ? `${Math.max(heightPct, 4)}%` : '2px' }}
                                                            >
                                                                {d.revenue > 0 ? (
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex flex-col items-center pointer-events-none w-max z-10 opacity-100 group-hover:scale-110 transition-transform">
                                                                        <span className="text-[9px] font-bold text-slate-800 tracking-tighter">${Math.round(d.revenue).toLocaleString()}</span>
                                                                        <span className="text-[7px] text-slate-400 font-medium uppercase">{d.qty || 0}</span>
                                                                    </div>
                                                                ) : null}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 hidden group-hover:block z-30 bg-black text-white text-[9px] px-2 py-1 rounded whitespace-nowrap shadow-xl">
                                                                    <p className="font-bold border-b border-white/20 mb-1">{d.date}</p>
                                                                    <p>Rev: ${d.revenue.toLocaleString()}</p>
                                                                    <p>Qty: {d.qty} units</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="text-[7px] text-slate-400 font-medium text-center mt-1 uppercase tracking-tight">{monthLabel}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Tier 2: Also show COGM, COGP and Manufacturing Chart */}
                            {sku?.tier === 2 && (
                                <div className="pt-8 border-t border-slate-100 space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COGM</span>
                                        <span className="text-sm font-bold text-slate-900">${(financials.cogm || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COGP</span>
                                        <span className="text-sm font-medium text-slate-600">${(financials.cogp || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>

                                    <div className="mt-8">
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Last 12 Months Manufacturing</h4>
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
                                                        <div className="text-[7px] text-slate-400 font-medium text-center mt-1 uppercase tracking-tight">{monthLabel}</div>
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
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">COGP</span>
                                        <span className="text-sm font-bold text-slate-900">${(financials.cogp || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 italic">Raw material - consumed in manufacturing only</p>
                                </div>
                            )}
                            <div className="h-20" />
                        </div>
                    )}
                </aside>

                {/* Right Column: Ledger Workspace - Independent Scroll */}
                <main className="flex-1 h-full overflow-y-auto bg-white relative scrollbar-custom">
                    {/* Nested Sticky Layer 1: Toolbar */}
                    <div className="sticky top-0 z-[30] bg-white border-b border-slate-100 px-4 h-10 flex items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Transaction Ledger</h3>
                            <div className="relative" ref={filterRef}>
                                <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={cn("flex items-center space-x-1 px-3 py-1 text-[10px] font-bold border rounded transition-all", isFilterOpen ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm")}>
                                    <Filter className="w-3 h-3" />
                                    <span>FILTERS</span>
                                </button>
                                {isFilterOpen && (
                                    <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-2xl z-[100] p-4 animate-in fade-in zoom-in duration-200">
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-2">Date Range</label>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <input type="date" value={filters.fromDate} onChange={(e) => setFilters(prev => ({...prev, fromDate: e.target.value}))} className="w-full text-[10px] border border-slate-200 rounded px-2 py-1" />
                                                    <input type="date" value={filters.toDate} onChange={(e) => setFilters(prev => ({...prev, toDate: e.target.value}))} className="w-full text-[10px] border border-slate-200 rounded px-2 py-1" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-2">Lot Selection</label>
                                                <SearchableSelect options={[{ label: 'All Lots', value: 'All' }, ...uniqueLots.map(l => ({ label: l!, value: l! }))]} value={selectedLot} onChange={(val) => setSelectedLot(val)} placeholder="Select Lot..." triggerClassName="py-1 text-[10px] border-slate-200" />
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-3">Transaction Types</label>
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
                                                                <span className="text-[10px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight">{t.label}</span>
                                                            </div>
                                                            <input 
                                                                type="checkbox" 
                                                                checked={filters[t.key]} 
                                                                onChange={() => setFilters(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                                                                className="w-3 h-3 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-slate-400 uppercase block mb-3">Special Filters</label>
                                                <div className="space-y-2">
                                                    <label className="flex items-center justify-between group cursor-pointer">
                                                        <div className="flex items-center space-x-2">
                                                            <AlertCircle className="w-3 h-3 text-amber-500" />
                                                            <span className="text-[10px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight">No Lot #</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={filters.showOnlyNoLot} 
                                                            onChange={() => setFilters(prev => ({ ...prev, showOnlyNoLot: !prev.showOnlyNoLot }))}
                                                            className="w-3 h-3 rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                                                        />
                                                    </label>
                                                    <label className="flex items-center justify-between group cursor-pointer">
                                                        <div className="flex items-center space-x-2">
                                                            <DollarSign className="w-3 h-3 text-rose-500" />
                                                            <span className="text-[10px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight">No Cost</span>
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={filters.showOnlyNoCost} 
                                                            onChange={() => setFilters(prev => ({ ...prev, showOnlyNoCost: !prev.showOnlyNoCost }))}
                                                            className="w-3 h-3 rounded border-slate-300 text-rose-500 focus:ring-rose-500"
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="pt-2 border-t border-slate-50 flex justify-end">
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
                                                    className="text-[9px] font-bold text-slate-400 hover:text-slate-600 uppercase"
                                                >
                                                    Reset All
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                        </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {paginatedTransactions.length === displayTransactions.length 
                                ? `${displayTransactions.length} Records` 
                                : `${paginatedTransactions.length} of ${displayTransactions.length} Records`}
                        </span>
                    </div>

                    {/* Nested Sticky Layer 2: Table Header (Pinned exactly below toolbar) */}
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-10 z-[20] bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
                            <tr>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Date</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Type</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Reference</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Lot #</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">In/Out</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Balance</th>
                                <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Cost</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {paginatedTransactions.map((tx) => (
                                <tr key={tx._id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => router.push(tx.link)}>
                                    <td className="px-3 py-2 text-[10px] text-slate-500 font-mono">{new Date(tx.date).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' })}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center space-x-2">
                                            {getTypeIcon(tx.type)}
                                            <span className="text-[9px] uppercase font-bold text-slate-500">{tx.type}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 truncate max-w-[120px]">{tx.reference}</td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 font-mono">{tx.lotNumber || '-'}</td>
                                    <td className="px-3 py-2 text-right">
                                        <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm", tx.quantity > 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50")}>{tx.quantity > 0 ? '+' : ''}{tx.quantity}</span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-[10px] font-bold text-slate-900 font-mono">{tx.balance.toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right text-[10px] text-slate-600 font-mono">{tx.cost ? `$${tx.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    {/* Load More Indicator */}
                    <div ref={loadMoreRef} className="h-16 flex items-center justify-center">
                        {hasMore && (
                            <div className="flex items-center space-x-2 text-slate-400">
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

            {/* Shell Layer 3: Shell Footer (Fixed at the bottom of the content band) */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-100/50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System Ready</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">SKU Detail Shell v2.0</span>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                </div>
            </div>
        </div>
    );
}

// ... helper interfaces ...

