'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Package,
    Factory,
    ShoppingCart,
    History,
    TrendingUp,
    AlertCircle,
    ClipboardCheck,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { ArrowUpDown } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface Sku {
    _id: string;
    name: string;
    description?: string;
    category?: string;
    subCategory?: string;
    uom?: string;
    image?: string;
    salePrice?: number;
    cost?: number; // Cost might come from somewhere else, but referencing model
    reOrderPoint?: number;
    orderUpto?: number;
    createdAt?: string;
    variances?: {
        _id: string;
        name: string;
        image?: string;
        website?: string;
    }[];
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
    salePrice?: number; // Added Sale Price
}

interface Financials {
    totalRevenue: number;
    costOfSales: number;
    grossProfit: number;
    chartData: { date: string; revenue: number; qty: number }[];
}

export default function SkuDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [sku, setSku] = useState<Sku | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [financials, setFinancials] = useState<Financials | null>(null);
    const [loading, setLoading] = useState(true);
    const [fallbackImage, setFallbackImage] = useState('/sku-placeholder.png');

    // Filters
    const [filters, setFilters] = useState({
        fromDate: '',
        toDate: '',
        showOpeningBalance: true,
        showProduction: true, // Manufacturing Output
        showConsumption: true, // Manufacturing Input
        showPurchaseOrders: true,
        showSaleOrders: true,
        showWebOrders: true,
        showAuditAdjustments: true
    });
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to Newest First
    const [selectedVarianceId, setSelectedVarianceId] = useState<string | null>(null);
    const [selectedLot, setSelectedLot] = useState<string>('All');

    useEffect(() => {
        if (id) {
            fetchSkuDetails();
        }
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
                if (data.settings?.missingSkuImage) {
                    setFallbackImage(data.settings.missingSkuImage);
                }
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
        // Date Filter
        if (filters.fromDate && new Date(tx.date) < new Date(filters.fromDate)) return false;
        if (filters.toDate) {
            const endOfDay = new Date(filters.toDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (new Date(tx.date) > endOfDay) return false;
        }

        // Type Filter
        if (tx.type === 'Opening' && !filters.showOpeningBalance) return false;
        if (tx.type === 'Produced' && !filters.showProduction) return false;
        if (tx.type === 'Consumption' && !filters.showConsumption) return false;
        if (tx.type === 'Purchase Order' && !filters.showPurchaseOrders) return false;
        if (tx.type === 'Purchase Order' && !filters.showPurchaseOrders) return false;
        if (tx.type === 'Orders' && !filters.showSaleOrders) return false;
        if (tx.type === 'Web Order' && !filters.showWebOrders) return false;
        if ((tx.type === 'Audit' || tx.type === 'Audit Adjustment') && !filters.showAuditAdjustments) return false;

        return true;
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    // Derive unique lots
    const uniqueLots = Array.from(new Set(transactions.map(t => t.lotNumber).filter(l => l && l !== '')));

    // Apply Lot Filter & Recalculate Balance
    const finalTransactions = filteredTransactions.filter(tx => {
        if (selectedLot !== 'All' && tx.lotNumber !== selectedLot) return false;
        
        // Filter by selected variance if active
        // User request: "usually it will only show web orders where line item id will be matched"
        // We check against varianceId OR _id as a fallback based on request ambiguity
        if (selectedVarianceId) {
            // Only apply this filter to Web Orders or relevant types that have varianceId
            if (tx.type === 'Web Order') {
                return tx.varianceId === selectedVarianceId || tx._id === selectedVarianceId;
            }
             // Hide non-Web Orders when a variance is specifically selected? 
             // "records those belong to that" implies exclusivity.
             return false; 
        }

        return true;
    });

    // Recalculate balance for the specific view if filtering by lot
    const displayTransactions = selectedLot === 'All' 
        ? finalTransactions 
        : (() => {
            let runningBal = 0;
            // We need to sort by date asc to calc balance correctly, then respect user sort
            // But finalTransactions is already sorted by user preference.
            // If user sorts DESC, we can't calc balance easily top-down.
            // So we take the matching transactions, sort ASC, calc balance, then sort back to user pref.
            
            const ascTx = [...finalTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const balanced = ascTx.map(tx => {
                runningBal += tx.quantity;
                return { ...tx, balance: runningBal };
            });
            
            return sortOrder === 'asc' ? balanced : balanced.reverse();
        })();

    const lotBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        transactions.forEach(tx => {
            const lot = tx.lotNumber && tx.lotNumber !== 'N/A' ? tx.lotNumber : 'Unassigned';
            balances[lot] = (balances[lot] || 0) + tx.quantity;
        });
        return Object.entries(balances)
            .filter(([_, qty]) => qty !== 0)
            .sort((a, b) => b[1] - a[1]);
    }, [transactions]);

    const groupedVariances = useMemo(() => {
        if (!sku?.variances) return {};
        const groups: Record<string, NonNullable<Sku['variances']>> = {};
        sku.variances.forEach(v => {
            const domain = v.website || 'Others';
            if (!groups[domain]) groups[domain] = [];
            groups[domain].push(v);
        });
        return groups;
    }, [sku]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
        );
    }

    if (!sku) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
                <h2 className="text-xl font-bold text-slate-800">SKU Not Found</h2>
                <button
                    onClick={() => router.back()}
                    className="mt-4 px-4 py-2 bg-black text-white rounded text-sm font-medium"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const currentStock = transactions.length > 0 ? transactions[0].balance : 0; // First item has latest balance due to API returning Newest First

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
            {/* Header */}
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center space-x-3 shrink-0 h-12">
                <button
                    onClick={() => router.back()}
                    className="hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 text-slate-500" />
                </button>
                <div className="flex items-baseline space-x-3">
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{sku.name}</h1>
                    <p className="text-[10px] text-slate-400 font-mono">{sku._id}</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden p-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-6 h-full relative">

                    {/* Left Column: Details (30%) - Independent Scroll */}
                    <div className="w-full md:w-[30%] space-y-6 h-full overflow-y-auto pr-2">
                        {/* Info Card */}
                        <div className="bg-white shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center justify-center mb-6 bg-slate-50 p-4 h-48 border border-slate-100 border-dashed relative overflow-hidden">
                                <img 
                                    src={sku.image || fallbackImage} 
                                    alt={sku.name} 
                                    className="h-full object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = fallbackImage;
                                    }}
                                />
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Stock Level</label>
                                    <div className="flex items-baseline space-x-2">
                                        <span className={cn(
                                            "text-3xl font-bold tracking-tight",
                                            currentStock < (sku.reOrderPoint || 0) ? "text-red-600" : "text-slate-900"
                                        )}>
                                            {currentStock.toLocaleString()}
                                        </span>
                                        <span className="text-sm font-medium text-slate-500">{sku.uom || 'Units'}</span>
                                    </div>
                                    {currentStock < (sku.reOrderPoint || 0) && (
                                        <div className="flex items-center space-x-1.5 mt-2 text-red-600 bg-red-50 p-2 text-xs font-medium">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span>Below Re-Order Point ({sku.reOrderPoint})</span>
                                        </div>
                                    )}

                                    {/* Lot Balances */}
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-2">By Lot Number</label>
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {lotBalances.length > 0 ? lotBalances.map(([lot, qty]) => (
                                                <div key={lot} className="flex items-center justify-between text-[11px]">
                                                    <span className="text-slate-600 truncate mr-2 font-medium" title={lot}>{lot}</span>
                                                    <span className={cn("font-bold", qty < 0 ? "text-red-600" : "text-slate-900")}>
                                                        {qty.toLocaleString()}
                                                    </span>
                                                </div>
                                            )) : (
                                                <div className="text-[10px] text-slate-400 italic">No lot information</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Related Variances */}
                                {sku.variances && sku.variances.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Related Variances</label>
                                        <div className="space-y-4">
                                            {Object.entries(groupedVariances).map(([website, items]) => (
                                                <div key={website}>
                                                    <div className="text-[10px] font-bold text-slate-500 mb-2 px-1 uppercase tracking-wider">{website}</div>
                                                    <div className="space-y-2">
                                                        {items.map((variance, idx) => {
                                                            const isSelected = selectedVarianceId === variance._id;
                                                            return (
                                                                <div 
                                                                    key={variance._id || idx} 
                                                                    onClick={() => setSelectedVarianceId(isSelected ? null : variance._id)}
                                                                    className={cn(
                                                                        "flex items-start space-x-3 p-2 transition-all cursor-pointer border",
                                                                        isSelected 
                                                                            ? "bg-blue-50 border-blue-200 ring-1 ring-blue-200" 
                                                                            : "bg-slate-50 border-transparent hover:bg-slate-100 hover:border-slate-200"
                                                                    )}
                                                                >
                                                                    <div className="w-8 h-8 bg-white border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden mt-0.5">
                                                                        <img 
                                                                            src={variance.image || fallbackImage} 
                                                                            alt={variance.name} 
                                                                            className="w-full h-full object-cover"
                                                                            onError={(e) => { (e.target as HTMLImageElement).src = fallbackImage; }}
                                                                        />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className={cn("text-xs font-normal whitespace-normal leading-snug", isSelected ? "text-blue-700" : "text-slate-900")}>
                                                                            {variance.name}
                                                                        </div>
                                                                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                                            {variance._id}
                                                                        </div>
                                                                    </div>
                                                                    {isSelected && <div className="absolute right-2 top-2 w-2 h-2 rounded-full bg-blue-500" />}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Category</label>
                                        <p className="text-sm font-medium text-slate-700">{sku.category || '-'}</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sub-Category</label>
                                        <p className="text-sm font-medium text-slate-700">{sku.subCategory || '-'}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sales Price</label>
                                        <p className="text-sm font-medium text-slate-700">
                                            {sku.salePrice ? `$${sku.salePrice.toFixed(2)}` : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Max Order To</label>
                                        <p className="text-sm font-medium text-slate-700">{sku.orderUpto || '-'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Financials Card */}
                        {financials && (
                            <div className="bg-white shadow-sm border border-slate-200 p-6">
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Financials</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Revenue</span>
                                        <span className="text-sm font-bold text-slate-900">${financials.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cost of Sales</span>
                                        <span className="text-sm font-medium text-slate-600">${financials.costOfSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="flex justify-between items-baseline pt-2 border-t border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gross Profit</span>
                                        <span className={cn(
                                            "text-sm font-bold",
                                            financials.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
                                        )}>
                                            ${financials.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    {/* Turnover Chart */}
                                    {/* Turnover Chart */}
                                    <div className="mt-8">
                                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-4">Last 12 Months Turnover</h4>
                                        <div className="flex items-end space-x-2 pt-6">
                                            {financials.chartData.map((d, i) => {
                                                const maxRev = Math.max(...financials.chartData.map(c => c.revenue), 100); 
                                                const heightPct = (d.revenue / maxRev) * 100;
                                                const [y, m] = d.date.split('-');
                                                const monthLabel = new Date(parseInt(y), parseInt(m) - 1, 2).toLocaleString('default', { month: 'short' });

                                                return (
                                                    <div key={i} className="flex-1 flex flex-col group relative">
                                                        {/* Bar Container */}
                                                        <div className="h-32 flex flex-col justify-end w-full border-b border-slate-100 pb-px">
                                                            <div 
                                                                className="bg-slate-800 rounded-t hover:bg-black transition-all w-full min-w-[12px] relative"
                                                                style={{ height: `${Math.max(heightPct, 2)}%` }}
                                                            >
                                                                {/* Permanent Labels */}
                                                                {d.revenue > 0 && (
                                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex flex-col items-center pointer-events-none w-max z-10">
                                                                        <span className="text-[9px] font-bold text-slate-900 leading-none">${Math.round(d.revenue).toLocaleString()}</span>
                                                                        <span className="text-[8px] text-slate-500 font-medium leading-tight mt-0.5">{d.qty || 0}u</span>
                                                                    </div>
                                                                )}
                                                                
                                                                {/* Tooltip */}
                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 hidden group-hover:block z-20 bg-black text-white text-[9px] px-2 py-1.5 rounded whitespace-nowrap shadow-lg">
                                                                    <div className="font-bold">{monthLabel} {y}</div>
                                                                    <div>Revenue: ${d.revenue.toLocaleString()}</div>
                                                                    <div>Qty: {d.qty || 0} units</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* X-Axis Label */}
                                                        <div className="text-[8px] text-center mt-2 text-slate-400 font-bold uppercase tracking-wider">
                                                            {monthLabel}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Filters Card (Moved Here) */}
                        <div className="bg-white shadow-sm border border-slate-200 p-6">
                            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Ledger Filters</h3>
                            
                            <div className="space-y-4">
                                {/* Date Range */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">From Date</label>
                                        <input 
                                            type="date" 
                                            value={filters.fromDate}
                                            onChange={(e) => setFilters(prev => ({...prev, fromDate: e.target.value}))}
                                            className="w-full text-xs border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:border-black transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">To Date</label>
                                        <input 
                                            type="date" 
                                            value={filters.toDate}
                                            onChange={(e) => setFilters(prev => ({...prev, toDate: e.target.value}))}
                                            className="w-full text-xs border border-slate-200 px-3 py-2 bg-slate-50 focus:outline-none focus:border-black transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Toggles */}
                                <div className="space-y-3 pt-2">
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={filters.showOpeningBalance} 
                                            onChange={e => setFilters(prev => ({...prev, showOpeningBalance: e.target.checked}))}
                                            className="form-checkbox h-4 w-4 text-black border-slate-300 focus:ring-black transition duration-150 ease-in-out"
                                        />
                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Opening Balance</span>
                                    </label>
                                    
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={filters.showProduction} 
                                            onChange={e => setFilters(prev => ({...prev, showProduction: e.target.checked}))}
                                            className="form-checkbox h-4 w-4 text-black border-slate-300 focus:ring-black transition duration-150 ease-in-out"
                                        />
                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Production</span>
                                    </label>
                                    
                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={filters.showConsumption} 
                                            onChange={e => setFilters(prev => ({...prev, showConsumption: e.target.checked}))}
                                            className="form-checkbox h-4 w-4 text-black border-slate-300 focus:ring-black transition duration-150 ease-in-out"
                                        />
                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Consumption</span>
                                    </label>

                                     <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={filters.showPurchaseOrders} 
                                            onChange={e => setFilters(prev => ({...prev, showPurchaseOrders: e.target.checked}))}
                                            className="form-checkbox h-4 w-4 text-black border-slate-300 focus:ring-black transition duration-150 ease-in-out"
                                        />
                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Purchase Orders</span>
                                    </label>

                                     <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox"                                             checked={filters.showSaleOrders} 
                                            onChange={e => setFilters(prev => ({...prev, showSaleOrders: e.target.checked}))}
                                            className="form-checkbox h-4 w-4 text-black border-slate-300 focus:ring-black transition duration-150 ease-in-out"
                                        />
                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Sale Orders</span>
                                    </label>

                                     <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox" 
                                            checked={filters.showWebOrders} 
                                            onChange={e => setFilters(prev => ({...prev, showWebOrders: e.target.checked}))}
                                            className="form-checkbox h-4 w-4 text-black border-slate-300 focus:ring-black transition duration-150 ease-in-out"
                                        />
                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Web Orders</span>
                                    </label>

                                    <label className="flex items-center space-x-3 cursor-pointer group">
                                        <input 
                                            type="checkbox"  
                                            checked={filters.showAuditAdjustments} 
                                            onChange={e => setFilters(prev => ({...prev, showAuditAdjustments: e.target.checked}))}
                                            className="form-checkbox h-4 w-4 text-black border-slate-300 focus:ring-black transition duration-150 ease-in-out"
                                        />
                                        <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">Audit Adjustments</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Ledger Table (70%) - Independent Scroll */}
                    <div className="w-full md:w-[70%] flex flex-col space-y-4 h-full overflow-y-auto pb-2">
                        <div className="bg-white shadow-sm border border-slate-200 flex flex-col h-full min-h-[500px]">
                            <div className="px-4 py-1 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    <h3 className="font-bold text-slate-800">Transaction Ledger</h3>
                                    <div className="w-48">
                                        <SearchableSelect
                                            options={[
                                                { label: 'All Lots', value: 'All' },
                                                ...uniqueLots.map(lot => ({ label: lot!, value: lot! }))
                                            ]}
                                            value={selectedLot}
                                            onChange={(val) => setSelectedLot(val)}
                                            placeholder="Select Lot..."
                                            className="text-[10px]"
                                            triggerClassName="py-1 min-h-[28px] text-[10px]"
                                        />
                                    </div>
                                </div>
                                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1">{displayTransactions.length} Records</span>
                            </div>

                            <div className="overflow-x-auto flex-1">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                                        <tr>
                                            <th 
                                                className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors group border-r border-slate-100"
                                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                            >
                                                <div className="flex items-center space-x-1">
                                                    <span>Date</span>
                                                    <ArrowUpDown className={cn("w-2 h-2 text-slate-300 group-hover:text-slate-500", sortOrder === 'asc' ? "text-black" : "")} />
                                                </div>
                                            </th>
                                            <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Type</th>
                                            <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Reference</th>
                                            <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100">Lot #</th>
                                            <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100">In / Out</th>
                                            <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100">Balance</th>
                                            <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100">Cost</th>
                                            <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest text-right">Sale Price</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {displayTransactions.map((tx) => (
                                            <tr
                                                key={tx._id}
                                                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                                onClick={() => router.push(tx.link)}
                                            >
                                                <td className="px-2 py-1 text-[10px] text-slate-500 font-mono">
                                                    {new Date(tx.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] font-medium text-slate-700">
                                                    <div className="flex items-center space-x-1.5">
                                                        {getTypeIcon(tx.type)}
                                                        <span className="text-[9px] uppercase font-bold text-slate-500">{tx.type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-1 text-[10px] text-slate-600 whitespace-normal break-words max-w-[150px]">
                                                    {tx.reference}
                                                </td>
                                                <td className="px-2 py-1 text-[10px] text-slate-600 font-mono">
                                                    {tx.lotNumber || '-'}
                                                </td>
                                                <td className="px-2 py-1 text-right">
                                                    <span className={cn(
                                                        "text-[9px] font-mono font-bold px-1 py-0.5 rounded-[2px]",
                                                        tx.quantity > 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                                                    )}>
                                                        {tx.quantity > 0 ? '+' : ''}{tx.quantity} {tx.uom}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1 text-right text-[10px] font-bold text-slate-900 font-mono">
                                                    {tx.balance.toLocaleString()}
                                                </td>
                                                <td className="px-2 py-1 text-right text-[10px] text-slate-600 font-mono">
                                                    {tx.cost ? `$${tx.cost.toFixed(2)}` : '-'}
                                                </td>
                                                <td className="px-2 py-1 text-right text-[10px] text-slate-600 font-mono">
                                                    {tx.salePrice ? `$${tx.salePrice.toFixed(2)}` : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                        {displayTransactions.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-[10px] uppercase font-bold tracking-widest opacity-50">
                                                    No transactions found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
