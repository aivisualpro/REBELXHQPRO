'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Calendar,
    Download,
    RefreshCw,
    AlertCircle,
    ChevronRight,
    Layers,
    Box,
    ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryRecord {
    id: string;
    name: string;
    category: string;
    subCategory: string;
    uom: string;
    availableQty: number;
    reOrderPoint: number;
    orderUpto: number;
    avgCost: number;
    totalCost: number;
}

export default function ReOrderReportPage() {
    const [tillDate, setTillDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    
    const [searchSku, setSearchSku] = useState('');
    const [data, setData] = useState<InventoryRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    const fetchData = async () => {
        setLoading(true);
        try {
            // we pass showAll=true because an item with 0 stock MUST show up in a Re-Order report!
            const res = await fetch(`/api/reports/inventory-on-hand?tillDate=${tillDate}&showAll=true`);
            const json = await res.json();
            if (json.records) {
                // Instantly filter out only those below re-order point
                const lowStockRecords = json.records.filter((r: InventoryRecord) => r.availableQty < r.reOrderPoint);
                setData(lowStockRecords);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tillDate]);

    // Categories Hierarchy for Low Stock items
    const hierarchy = useMemo(() => {
        const tree: Record<string, Set<string>> = {};
        data.forEach(item => {
            const cat = item.category || 'Uncategorized';
            const sub = item.subCategory || 'Uncategorized';
            if (!tree[cat]) tree[cat] = new Set();
            tree[cat].add(sub);
        });
        return tree;
    }, [data]);

    // Filtered Data
    const filteredData = useMemo(() => {
        return data.filter(item => {
            if (searchSku && !item.name.toLowerCase().includes(searchSku.toLowerCase()) && !item.id.toLowerCase().includes(searchSku.toLowerCase())) return false;
            if (selectedCategory && item.category !== selectedCategory) return false;
            if (selectedSubCategory && item.subCategory !== selectedSubCategory) return false;
            return true;
        });
    }, [data, searchSku, selectedCategory, selectedSubCategory]);

    // Re-Order Summaries
    const { totalLowItems, totalMissingQty, estReorderCost } = useMemo(() => {
        let itemsCount = 0;
        let missingQty = 0;
        let reorderCost = 0;

        data.forEach(item => {
            itemsCount++;
            // The qty needed to reach 'orderUpto'
            const requiredQty = Math.max(0, (item.orderUpto || 0) - item.availableQty);
            missingQty += requiredQty;
            reorderCost += requiredQty * (item.avgCost || 0);
        });

        return {
            totalLowItems: itemsCount,
            totalMissingQty: missingQty,
            estReorderCost: reorderCost
        };
    }, [data]);

    const formatCurrency = (val: number) => {
        if (!val) return '$0';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const formatDecimalCurrency = (val: number) => {
        if (!val) return '$0.00';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const toggleCat = (cat: string) => {
        setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-background text-foreground overflow-hidden">
            {/* Header */}
            <div className="shrink-0 bg-background border-b border-border px-6 py-4 z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30 rounded-xl">
                        <AlertCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight uppercase text-foreground">Re-Order Report</h1>
                        <p className="text-muted-foreground text-xs">SKUs currently below safety thresholds</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* SKU Search */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input 
                            type="text"
                            placeholder="Search SKU..."
                            value={searchSku}
                            onChange={(e) => setSearchSku(e.target.value)}
                            className="bg-secondary/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-orange-500 transition-colors w-[200px]"
                        />
                    </div>

                    {/* Till Date Filter */}
                    <div className="relative flex items-center bg-secondary/50 border border-border rounded-lg px-3 py-2">
                        <Calendar className="w-4 h-4 text-muted-foreground mr-2" />
                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider mr-2 hidden sm:inline">Valuation Date:</span>
                        <input 
                            type="date"
                            value={tillDate}
                            onChange={(e) => setTillDate(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-foreground cursor-pointer"
                        />
                    </div>

                    <button className="flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground px-4 py-2 rounded-lg text-sm font-bold transition-all h-full">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Left Sidebar Layout */}
                <div className="w-[280px] shrink-0 border-r border-border bg-card/30 flex flex-col h-full overflow-hidden hidden md:flex">
                    <div className="p-4 border-b border-border bg-card/50">
                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                            <Layers className="w-3.5 h-3.5" /> Classification
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 scrollbar-custom">
                        <button 
                            onClick={() => { setSelectedCategory(null); setSelectedSubCategory(null); }}
                            className={cn(
                                "w-full text-left px-3 py-2 text-sm font-bold rounded-md transition-colors flex items-center gap-2 mb-1",
                                !selectedCategory ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "text-foreground hover:bg-secondary"
                            )}
                        >
                            <Box className="w-4 h-4 opacity-70" /> All Shortages
                        </button>

                        {Object.entries(hierarchy).map(([cat, subs]) => (
                            <div key={cat} className="mb-1">
                                <button 
                                    onClick={() => {
                                        toggleCat(cat);
                                        if (selectedCategory !== cat) {
                                            setSelectedCategory(cat);
                                            setSelectedSubCategory(null);
                                        }
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-sm font-bold rounded-md transition-colors flex items-center justify-between group",
                                        selectedCategory === cat && !selectedSubCategory ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "text-foreground hover:bg-secondary"
                                    )}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", expandedCategories[cat] && "rotate-90")} />
                                        <span className="truncate">{cat}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-muted-foreground/50 group-hover:text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded-sm">{Array.from(subs).length}</span>
                                </button>
                                
                                {expandedCategories[cat] && (
                                    <div className="pl-8 pr-2 py-1 space-y-1 border-l-2 border-border/50 ml-4 my-1">
                                        {Array.from(subs).map(sub => (
                                            <button
                                                key={sub}
                                                onClick={() => {
                                                    setSelectedCategory(cat);
                                                    setSelectedSubCategory(sub);
                                                }}
                                                className={cn(
                                                    "w-full text-left px-3 py-1.5 text-xs font-semibold rounded-md transition-colors truncate",
                                                    selectedSubCategory === sub ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                                )}
                                                title={sub}
                                            >
                                                {sub}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-h-0 bg-secondary/10 overflow-hidden relative">
                    <div className="flex-1 overflow-y-auto scrollbar-custom p-6">
                        <div className="max-w-[1600px] mx-auto space-y-6">
                            
                            {/* Top Summary Widgets Area */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden group">
                                    <div className="relative z-10 font-bold text-rose-600/70 dark:text-rose-400 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> SKUs Below Threshold
                                    </div>
                                    <div className="relative z-10 font-black text-3xl text-rose-600 dark:text-rose-500">{totalLowItems}</div>
                                </div>

                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden group">
                                    <div className="relative z-10 font-bold text-orange-600/70 dark:text-orange-400 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <Box className="w-4 h-4" /> Total Units Missing
                                    </div>
                                    <div className="relative z-10 font-black text-3xl text-orange-600 dark:text-orange-500">{totalMissingQty.toLocaleString()}</div>
                                </div>

                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-6 flex flex-col justify-center shadow-sm relative overflow-hidden group">
                                    <div className="relative z-10 font-bold text-amber-600/70 dark:text-amber-400 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                                        <ShoppingCart className="w-4 h-4" /> Est. Reorder Value
                                    </div>
                                    <div className="relative z-10 font-black text-3xl text-amber-600 dark:text-amber-500">{formatCurrency(estReorderCost)}</div>
                                </div>
                            </div>
                            
                            {/* Data Table */}
                            <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col min-h-[500px]">
                                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0 rounded-t-2xl">
                                    <h3 className="font-bold text-foreground flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5 text-orange-500" />
                                        Critically Low Items
                                        {selectedCategory && (
                                            <span className="ml-2 px-2.5 py-1 bg-secondary text-muted-foreground text-[10px] rounded-full font-black uppercase tracking-widest">
                                                {selectedCategory} {selectedSubCategory ? `> ${selectedSubCategory}` : ''}
                                            </span>
                                        )}
                                    </h3>
                                    <div className="text-sm font-bold text-muted-foreground">
                                        {filteredData.length} items
                                    </div>
                                </div>
                                <div className="flex-1 overflow-auto scrollbar-custom w-full max-h-[600px]">
                                    {loading ? (
                                        <div className="flex items-center justify-center h-full p-20">
                                            <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                                        </div>
                                    ) : filteredData.length > 0 ? (
                                        <table className="w-full border-collapse">
                                            <thead className="bg-secondary sticky top-0 z-10 border-b border-border box-border">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">SKU Name</th>
                                                    <th className="px-4 py-4 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">Category</th>
                                                    <th className="px-4 py-4 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest min-w-[100px]">Current Qty</th>
                                                    <th className="px-4 py-4 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest min-w-[100px] border-l border-border/50">Reorder Pt.</th>
                                                    <th className="px-4 py-4 text-center text-[11px] font-black text-indigo-500 tracking-widest min-w-[100px] bg-indigo-500/5">Order Upto</th>
                                                    <th className="px-4 py-4 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest min-w-[100px] border-l border-border/50">Missing Qty</th>
                                                    <th className="px-6 py-4 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest min-w-[140px]">Est. Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40">
                                                {filteredData.map((sku, idx) => {
                                                    const requiredQty = Math.max(0, (sku.orderUpto || 0) - sku.availableQty);
                                                    const estCost = requiredQty * (sku.avgCost || 0);

                                                    return (
                                                        <tr key={sku.id + idx} className="hover:bg-secondary/40 transition-colors group">
                                                            <td className="px-6 py-3">
                                                                <div className="text-sm font-bold text-foreground">{sku.name}</div>
                                                                <div className="text-[10px] text-muted-foreground truncate max-w-[200px] mt-0.5" title={sku.id}>ID: <span className="font-mono">{sku.id}</span></div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="inline-flex items-center gap-1.5 bg-secondary/80 border border-border px-2 py-0.5 rounded-md">
                                                                    <span className="text-[10px] font-bold text-foreground">{sku.category}</span>
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground mt-1 truncate max-w-[150px]">{sku.subCategory}</div>
                                                            </td>

                                                            <td className="px-4 py-3 text-center">
                                                                <span className={cn(
                                                                    "text-sm font-black px-2 py-1 flex justify-center items-center w-max mx-auto rounded-md",
                                                                    sku.availableQty <= 0 ? "text-rose-500 bg-rose-500/10" : "text-amber-500 bg-amber-500/10"
                                                                )}>
                                                                    {sku.availableQty.toLocaleString()} <span className="text-[9px] ml-1 opacity-70 uppercase">{sku.uom || ''}</span>
                                                                </span>
                                                            </td>

                                                            <td className="px-4 py-3 text-center border-l border-border/50">
                                                                <div className="text-sm font-bold text-foreground">{sku.reOrderPoint || 0}</div>
                                                            </td>

                                                            <td className="px-4 py-3 text-center bg-indigo-500/5">
                                                                <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">{sku.orderUpto || 0}</div>
                                                            </td>

                                                            <td className="px-4 py-3 text-center border-l border-border/50">
                                                                <div className="text-sm font-bold text-orange-500">
                                                                    +{requiredQty.toLocaleString()} 
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3 text-right">
                                                                <div className="text-sm font-black text-foreground">{formatCurrency(estCost)}</div>
                                                                {sku.avgCost > 0 && (
                                                                    <div className="text-[9px] text-muted-foreground mt-0.5 font-bold">@ {formatDecimalCurrency(sku.avgCost)}/ea</div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                                            <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-sm font-bold">No SKUs below the threshold!</p>
                                            <p className="text-xs">Your inventory levels look perfectly healthy here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
