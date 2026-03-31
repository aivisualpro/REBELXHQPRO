'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, 
    Calendar,
    Download,
    RefreshCw,
    Package,
    ChevronDown,
    ChevronRight,
    Layers,
    Filter,
    Box,
    Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';


interface InventoryRecord {
    id: string;
    name: string;
    category: string;
    subCategory: string;
    uom: string;
    availableQty: number;
    avgCost: number;
    totalCost: number;
}

export default function InventoryOnHandPage() {
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
            const res = await fetch(`/api/reports/inventory-on-hand?tillDate=${tillDate}`);
            const json = await res.json();
            if (json.records) {
                setData(json.records);
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

    // Categories Hierarchy
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

    // Summaries based on full data or filtered data? 
    // Usually summaries at the very top (or right side) reflect the overall portfolio up to date, 
    // or we can make them reflect the filtered subset. Let's make them reflect everything to match the screenshot "Inventory Summary".
    const { totalValue, finishedVal, rawVal, packingVal } = useMemo(() => {
        let total = 0;
        let finished = 0;
        let raw = 0;
        let packing = 0;

        data.forEach(item => {
            const v = item.totalCost || 0;
            total += v;
            
            const cat = item.category || '';
            if (cat === 'Finished Goods') finished += v;
            else if (cat === 'Packaging') packing += v;
            else raw += v;
        });

        return {
            totalValue: total,
            finishedVal: finished,
            rawVal: raw,
            packingVal: packing
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
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 rounded-xl">
                        <Box className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight uppercase text-foreground">Inventory On Hand</h1>
                        <p className="text-muted-foreground text-xs">Real-time inventory valuation</p>
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
                            className="bg-secondary/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 transition-colors w-[200px]"
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
                                !selectedCategory ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-secondary"
                            )}
                        >
                            <Box className="w-4 h-4 opacity-70" /> All Inventory
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
                                        selectedCategory === cat && !selectedSubCategory ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-foreground hover:bg-secondary"
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
                                                    selectedSubCategory === sub ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
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
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {/* Mimicking the layout from the screenshot */}
                                <div className="bg-[#a8d3d1]/20 border-2 border-[#a8d3d1] rounded-xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden group">
                                    <div className="absolute inset-y-0 left-0 bg-[#a8d3d1]/40 w-full transition-all duration-500"></div>
                                    <div className="relative z-10 font-bold text-foreground text-sm uppercase tracking-wider">Total Inventory Value</div>
                                    <div className="relative z-10 font-black text-xl text-foreground">{formatCurrency(totalValue)}</div>
                                </div>

                                <div className="bg-[#a8d3d1]/10 border-2 border-[#a8d3d1] rounded-xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden group">
                                    <div className="absolute inset-y-0 left-0 bg-[#a8d3d1]/40 transition-all duration-500" style={{ width: `${totalValue ? (finishedVal / totalValue) * 100 : 0}%` }}></div>
                                    <div className="relative z-10 font-bold text-foreground text-sm uppercase tracking-wider">Finished Inventory {totalValue ? Math.round((finishedVal / totalValue) * 100) : 0}%</div>
                                    <div className="relative z-10 font-black text-xl text-foreground">{formatCurrency(finishedVal)}</div>
                                </div>

                                <div className="bg-[#a8d3d1]/10 border-2 border-[#a8d3d1] rounded-xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden group">
                                    <div className="absolute inset-y-0 left-0 bg-[#a8d3d1]/40 transition-all duration-500" style={{ width: `${totalValue ? (rawVal / totalValue) * 100 : 0}%` }}></div>
                                    <div className="relative z-10 font-bold text-foreground text-sm uppercase tracking-wider">Raw Material {totalValue ? Math.round((rawVal / totalValue) * 100) : 0}%</div>
                                    <div className="relative z-10 font-black text-xl text-foreground">{formatCurrency(rawVal)}</div>
                                </div>

                                <div className="bg-[#a8d3d1]/10 border-2 border-[#a8d3d1] rounded-xl p-4 flex items-center justify-between shadow-sm relative overflow-hidden group">
                                    <div className="absolute inset-y-0 left-0 bg-[#a8d3d1]/40 transition-all duration-500" style={{ width: `${totalValue ? (packingVal / totalValue) * 100 : 0}%` }}></div>
                                    <div className="relative z-10 font-bold text-foreground text-sm uppercase tracking-wider">Packaging {totalValue ? Math.round((packingVal / totalValue) * 100) : 0}%</div>
                                    <div className="relative z-10 font-black text-xl text-foreground">{formatCurrency(packingVal)}</div>
                                </div>
                            </div>
                            
                            {/* Data Table */}
                            <div className="bg-card border border-border rounded-2xl shadow-sm flex flex-col min-h-[500px]">
                                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0 rounded-t-2xl">
                                    <h3 className="font-bold text-foreground flex items-center gap-2">
                                        <Package className="w-5 h-5 text-indigo-500" />
                                        Inventory Item List
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
                                            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                                        </div>
                                    ) : filteredData.length > 0 ? (
                                        <table className="w-full border-collapse">
                                            <thead className="bg-secondary sticky top-0 z-10 border-b border-border box-border">
                                                <tr>
                                                    <th className="px-6 py-4 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">SKU Name</th>
                                                    <th className="px-4 py-4 text-left text-[11px] font-black uppercase text-muted-foreground tracking-widest">Category</th>
                                                    <th className="px-4 py-4 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest min-w-[100px]">Qty Available</th>
                                                    <th className="px-4 py-4 text-center text-[11px] font-black uppercase text-muted-foreground tracking-widest">UOM</th>
                                                    <th className="px-4 py-4 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest min-w-[120px]">Avg Cost</th>
                                                    <th className="px-6 py-4 text-right text-[11px] font-black uppercase text-muted-foreground tracking-widest min-w-[140px]">Total Cost</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40">
                                                {filteredData.map((sku, idx) => (
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
                                                        <td className="px-4 py-3 text-right">
                                                            <span className={cn(
                                                                "text-sm font-black px-2 py-1 rounded-md",
                                                                sku.availableQty <= 0 ? "text-rose-500 bg-rose-500/10" : "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400"
                                                            )}>
                                                                {sku.availableQty.toLocaleString()}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="text-[11px] font-bold text-muted-foreground uppercase">{sku.uom || '-'}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="text-sm font-bold text-foreground">{formatDecimalCurrency(sku.avgCost)}</div>
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            <div className="text-sm font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(sku.totalCost)}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-20 text-muted-foreground">
                                            <Package className="w-12 h-12 mb-4 opacity-20" />
                                            <p className="text-sm font-bold">No inventory records found.</p>
                                            <p className="text-xs">Try adjusting your filters or date range.</p>
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
