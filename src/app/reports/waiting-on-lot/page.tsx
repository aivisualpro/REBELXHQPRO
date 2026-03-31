'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Package,
    Loader2,
    ExternalLink,
    Search,
    AlertTriangle,
    Layers,
    ShoppingCart,
    ChevronRight,
    Hash,
    DollarSign,
    ArrowUpRight,
    Filter,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import toast from 'react-hot-toast';

interface SkuGroupSummary {
    skuId: string;
    name: string;
    category: string;
    uom: string;
    count: number;
    totalQty: number;
    totalValue: number;
}

interface Summary {
    totalSkus: number;
    totalItems: number;
    totalQty: number;
    totalValue: number;
}

interface DetailItem {
    id: string;
    source: 'Web Order' | 'Sale Order';
    orderId: string;
    lineItemId?: number;
    orderNumber: string;
    website?: string;
    status: string;
    date: string;
    quantity: number;
    total: number;
    link: string;
}

type TypeFilter = 'all' | 'Web Order' | 'Sale Order';

const WEBSITE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'KINGKKRATOM': { bg: 'bg-amber-500/15', text: 'text-amber-500', border: 'border-amber-500/30' },
    'GRASSROOTSHARVEST': { bg: 'bg-emerald-500/15', text: 'text-emerald-500', border: 'border-emerald-500/30' },
    'GRHKTATOM': { bg: 'bg-blue-500/15', text: 'text-blue-500', border: 'border-blue-500/30' },
    'GUDTONICS': { bg: 'bg-cyan-500/15', text: 'text-cyan-500', border: 'border-cyan-500/30' },
    'REBELXBRANDS': { bg: 'bg-purple-500/15', text: 'text-purple-500', border: 'border-purple-500/30' },
};

const STATUS_COLORS: Record<string, string> = {
    'completed': 'bg-emerald-500 text-white',
    'Completed': 'bg-emerald-500 text-white',
    'processing': 'bg-blue-500 text-white',
    'Processing': 'bg-blue-500 text-white',
    'pending': 'bg-yellow-500 text-white',
    'Pending': 'bg-yellow-500 text-white',
    'on-hold': 'bg-amber-500 text-white',
    'Picking': 'bg-sky-500 text-white',
    'Shipped': 'bg-indigo-500 text-white',
    'shipped': 'bg-indigo-500 text-white',
};

const formatCurrency = (val: number) => {
    if (!val && val !== 0) return '-';
    return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function WaitingOnLotPage() {
    const router = useRouter();
    const [groups, setGroups] = useState<SkuGroupSummary[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedSkuId, setSelectedSkuId] = useState<string | null>(null);
    const [sidebarSearch, setSidebarSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

    // Detail state (lazy-loaded per SKU)
    const [detailItems, setDetailItems] = useState<DetailItem[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Lot selection modal state
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DetailItem | null>(null);

    // ── Load sidebar summary ──
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const res = await fetch('/api/reports/waiting-on-lot');
                if (res.ok) {
                    const data = await res.json();
                    setGroups(data.groups || []);
                    setSummary(data.summary || null);
                    if (data.groups?.length > 0) {
                        setSelectedSkuId(data.groups[0].skuId);
                    }
                }
            } catch (e) {
                console.error('Failed to fetch waiting-on-lot data:', e);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // ── Load detail items when SKU changes ──
    const loadSkuDetail = useCallback(async (skuId: string) => {
        try {
            setDetailLoading(true);
            setDetailItems([]);
            const res = await fetch(`/api/reports/waiting-on-lot?skuId=${skuId}`);
            if (res.ok) {
                const data = await res.json();
                setDetailItems(data.items || []);
            }
        } catch (e) {
            console.error('Failed to fetch SKU detail:', e);
        } finally {
            setDetailLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedSkuId) {
            setTypeFilter('all');
            loadSkuDetail(selectedSkuId);
        }
    }, [selectedSkuId, loadSkuDetail]);

    // Filter detail items by type
    const filteredDetailItems = useMemo(() => {
        if (typeFilter === 'all') return detailItems;
        return detailItems.filter(i => i.source === typeFilter);
    }, [detailItems, typeFilter]);

    // Filter sidebar by search
    const filteredGroups = useMemo(() => {
        if (!sidebarSearch.trim()) return groups;
        const q = sidebarSearch.toLowerCase();
        return groups.filter(g =>
            g.name.toLowerCase().includes(q) ||
            g.category?.toLowerCase().includes(q)
        );
    }, [groups, sidebarSearch]);

    // Get selected group summary
    const selectedGroupSummary = useMemo(() => {
        if (!selectedSkuId) return null;
        return groups.find(g => g.skuId === selectedSkuId) || null;
    }, [groups, selectedSkuId]);

    // ── Lot Selection Handlers ──
    const openLotSelector = (item: DetailItem) => {
        setEditingItem(item);
        setIsLotModalOpen(true);
    };

    const handleLotSelect = async (lotNumber: string, cost?: number) => {
        if (!editingItem || !selectedSkuId) return;

        // Only web orders supported for now
        if (editingItem.source === 'Web Order' && editingItem.lineItemId != null) {
            try {
                const res = await fetch(`/api/retail/web-orders/${editingItem.orderId}/line-item`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lineItemId: editingItem.lineItemId,
                        lotNumber: lotNumber || null,
                    })
                });

                if (res.ok) {
                    toast.success(lotNumber ? `Lot set to ${lotNumber}` : 'Lot cleared');
                    // Remove from list (it's no longer "waiting")
                    setDetailItems(prev => prev.filter(i => i.id !== editingItem.id));
                    // Update sidebar count
                    setGroups(prev => prev.map(g =>
                        g.skuId === selectedSkuId
                            ? { ...g, count: g.count - 1, totalQty: g.totalQty - editingItem.quantity }
                            : g
                    ).filter(g => g.count > 0));
                    // Update summary
                    setSummary(prev => prev ? {
                        ...prev,
                        totalItems: prev.totalItems - 1,
                        totalQty: prev.totalQty - editingItem.quantity,
                        totalValue: prev.totalValue - editingItem.total,
                    } : null);
                } else {
                    toast.error('Failed to update lot');
                }
            } catch (e) {
                toast.error('Error updating lot');
            }
        } else {
            toast.error('Lot assignment from here is only supported for Web Orders');
        }

        setIsLotModalOpen(false);
        setEditingItem(null);
    };

    // ── Loading State ──
    if (loading) {
        return (
            <div className="flex flex-col h-[calc(100vh-48px)] bg-background items-center justify-center">
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-xl animate-pulse" />
                    <Loader2 className="w-10 h-10 text-amber-500 animate-spin relative z-10" />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
                    Analyzing Lot Assignments...
                </p>
            </div>
        );
    }

    // ── Empty State ──
    if (!groups.length) {
        return (
            <div className="flex flex-col h-[calc(100vh-48px)] bg-background items-center justify-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                    <Package className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-lg font-black text-foreground mb-1">All Clear!</h2>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
                    No transactions waiting on lot assignment
                </p>
            </div>
        );
    }

    // Type filter counts
    const woCount = detailItems.filter(i => i.source === 'Web Order').length;
    const soCount = detailItems.filter(i => i.source === 'Sale Order').length;

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">

            {/* ── Summary Stats Bar ── */}
            <div className="shrink-0 border-b border-border bg-background px-4">
                <div className="flex items-center h-12 gap-6 overflow-x-auto no-scrollbar">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        </div>
                        <h1 className="text-sm font-black uppercase tracking-widest text-foreground">Waiting on Lot</h1>
                    </div>
                    <div className="h-5 w-px bg-border shrink-0" />
                    {summary && (
                        <>
                            <StatChip icon={Layers} label="SKUs" value={summary.totalSkus} color="amber" />
                            <StatChip icon={Hash} label="Records" value={summary.totalItems.toLocaleString()} color="blue" />
                            <StatChip icon={ShoppingCart} label="Total Qty" value={summary.totalQty.toLocaleString()} color="purple" />
                            <StatChip icon={DollarSign} label="Value" value={formatCurrency(summary.totalValue)} color="emerald" />
                        </>
                    )}
                </div>
            </div>

            {/* ── Main Content ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── Left Sidebar: SKU List ── */}
                <div className="w-[280px] border-r border-border bg-background flex flex-col overflow-hidden shrink-0">
                    <div className="p-2 border-b border-border shrink-0">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search SKUs..."
                                value={sidebarSearch}
                                onChange={e => setSidebarSearch(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-md outline-none focus:ring-1 focus:ring-amber-500/30 focus:border-amber-500/50 text-foreground placeholder:text-muted-foreground transition-colors"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-custom">
                        {filteredGroups.map((group, idx) => {
                            const isSelected = selectedSkuId === group.skuId;
                            return (
                                <button
                                    key={group.skuId}
                                    onClick={() => setSelectedSkuId(group.skuId)}
                                    className={cn(
                                        "w-full text-left px-3 py-2.5 border-b border-border transition-all group relative",
                                        isSelected
                                            ? "bg-amber-500/10 border-l-2 border-l-amber-500"
                                            : "hover:bg-secondary border-l-2 border-l-transparent"
                                    )}
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className={cn(
                                            "w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[10px] font-black",
                                            isSelected ? "bg-amber-500 text-white" : "bg-secondary text-muted-foreground"
                                        )}>
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={cn(
                                                "text-xs font-bold leading-tight line-clamp-2 mb-1",
                                                isSelected ? "text-foreground" : "text-foreground/80"
                                            )}>
                                                {group.name}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn(
                                                    "text-[10px] font-black uppercase tracking-wider",
                                                    isSelected ? "text-amber-500" : "text-muted-foreground"
                                                )}>
                                                    {group.count} record{group.count !== 1 ? 's' : ''}
                                                </span>
                                                <span className="text-muted-foreground">·</span>
                                                <span className="text-[10px] font-bold text-muted-foreground">
                                                    {group.totalQty} qty
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className={cn(
                                            "w-3.5 h-3.5 shrink-0 transition-transform mt-1",
                                            isSelected ? "text-amber-500 translate-x-0.5" : "text-muted-foreground/50"
                                        )} />
                                    </div>
                                </button>
                            );
                        })}
                        {filteredGroups.length === 0 && (
                            <div className="p-4 text-center">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">No SKUs found</p>
                            </div>
                        )}
                    </div>
                    <div className="p-2 border-t border-border bg-secondary shrink-0">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                            {filteredGroups.length} of {groups.length} SKUs
                        </div>
                    </div>
                </div>

                {/* ── Right Content: Transaction Ledger ── */}
                <div className="flex-1 bg-background flex flex-col overflow-hidden">
                    {selectedGroupSummary ? (
                        <>
                            {/* SKU Header — SOLID */}
                            <div className="shrink-0 border-b border-border bg-background px-4">
                                <div className="flex items-center justify-between h-12">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                            <Package className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black text-foreground leading-tight line-clamp-1">
                                                {selectedGroupSummary.name}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {selectedGroupSummary.category && (
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                                                        {selectedGroupSummary.category}
                                                    </span>
                                                )}
                                                {selectedGroupSummary.category && <span className="text-[9px] font-bold text-muted-foreground">·</span>}
                                                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                                                    {selectedGroupSummary.count} waiting
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Type Filter */}
                                        <div className="hidden md:flex items-center gap-1 bg-secondary rounded-md p-0.5">
                                            <button
                                                onClick={() => setTypeFilter('all')}
                                                className={cn(
                                                    "px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded transition-colors",
                                                    typeFilter === 'all' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                All ({detailItems.length})
                                            </button>
                                            <button
                                                onClick={() => setTypeFilter('Web Order')}
                                                className={cn(
                                                    "px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded transition-colors",
                                                    typeFilter === 'Web Order' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                Web ({woCount})
                                            </button>
                                            <button
                                                onClick={() => setTypeFilter('Sale Order')}
                                                className={cn(
                                                    "px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded transition-colors",
                                                    typeFilter === 'Sale Order' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                Orders ({soCount})
                                            </button>
                                        </div>
                                        <div className="hidden md:flex items-center gap-3">
                                            <div className="text-right">
                                                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Total Qty</div>
                                                <div className="text-sm font-black text-foreground">{selectedGroupSummary.totalQty}</div>
                                            </div>
                                            <div className="h-6 w-px bg-border" />
                                            <div className="text-right">
                                                <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Value</div>
                                                <div className="text-sm font-black text-emerald-500">{formatCurrency(selectedGroupSummary.totalValue)}</div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => router.push(`/warehouse/skus/${selectedGroupSummary.skuId}`)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary transition-colors text-xs font-bold text-muted-foreground hover:text-foreground"
                                        >
                                            <span>View SKU</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Transaction Table */}
                            <div className="flex-1 overflow-auto">
                                {detailLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                                    </div>
                                ) : (
                                    <table className="w-full border-collapse text-left">
                                        <thead className="bg-secondary border-y border-border sticky top-0 z-20">
                                            <tr>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[110px]">Date</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[90px]">Type</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Reference</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[140px]">Lot #</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-center w-[80px]">Qty</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[90px]">Status</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right w-[100px]">Total</th>
                                                <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[40px]"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {filteredDetailItems.map((item) => {
                                                const websiteColor = item.website ? WEBSITE_COLORS[item.website] : null;
                                                const statusColor = STATUS_COLORS[item.status] || 'bg-secondary text-muted-foreground';

                                                return (
                                                    <tr
                                                        key={item.id}
                                                        className="hover:bg-secondary transition-colors group"
                                                    >
                                                        <td className="px-3 py-2 text-xs font-mono font-bold text-foreground whitespace-nowrap">
                                                            {formatDate(item.date)}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            {item.source === 'Web Order' && websiteColor ? (
                                                                <span className={cn(
                                                                    "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border",
                                                                    websiteColor.bg, websiteColor.text, websiteColor.border
                                                                )}>
                                                                    {item.website}
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-secondary text-muted-foreground border border-border">
                                                                    {item.source === 'Sale Order' ? 'ORDERS' : item.source}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td
                                                            className="px-3 py-2 text-xs font-bold text-foreground cursor-pointer hover:underline"
                                                            onClick={() => router.push(item.link)}
                                                        >
                                                            {item.orderNumber}
                                                        </td>
                                                        {/* Lot # with selector */}
                                                        <td className="px-3 py-2">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); openLotSelector(item); }}
                                                                className={cn(
                                                                    "px-2 py-1 text-[10px] font-black uppercase tracking-wider border rounded transition-colors cursor-pointer",
                                                                    "bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-500/50"
                                                                )}
                                                            >
                                                                ⚠ Assign Lot
                                                            </button>
                                                        </td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className="text-xs font-black text-rose-500">
                                                                -{item.quantity}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <span className={cn(
                                                                "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                                                                statusColor
                                                            )}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs font-black text-foreground">
                                                            {formatCurrency(item.total)}
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <ArrowUpRight
                                                                className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-foreground transition-colors cursor-pointer"
                                                                onClick={() => router.push(item.link)}
                                                            />
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        {filteredDetailItems.length > 0 && (
                                            <tfoot className="border-t-2 border-border bg-secondary sticky bottom-0 z-10">
                                                <tr>
                                                    <td className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground" colSpan={4}>
                                                        Total ({filteredDetailItems.length} records)
                                                    </td>
                                                    <td className="px-3 py-2 text-center text-xs font-black text-rose-500">
                                                        -{filteredDetailItems.reduce((s, i) => s + i.quantity, 0)}
                                                    </td>
                                                    <td className="px-3 py-2"></td>
                                                    <td className="px-3 py-2 text-right text-xs font-black text-foreground">
                                                        {formatCurrency(filteredDetailItems.reduce((s, i) => s + i.total, 0))}
                                                    </td>
                                                    <td className="px-3 py-2"></td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
                                    <Package className="w-7 h-7 text-muted-foreground" />
                                </div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    Select a SKU from the sidebar
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Lot Selection Modal ── */}
            {selectedSkuId && (
                <LotSelectionModal
                    isOpen={isLotModalOpen}
                    onClose={() => { setIsLotModalOpen(false); setEditingItem(null); }}
                    onSelect={handleLotSelect}
                    skuId={selectedSkuId}
                    currentLotNumber=""
                    title="Assign Lot Number"
                    requiredQty={editingItem?.quantity || 0}
                />
            )}
        </div>
    );
}

// ── Stat Chip Component ──
function StatChip({ icon: Icon, label, value, color }: {
    icon: any;
    label: string;
    value: string | number;
    color: 'amber' | 'blue' | 'purple' | 'emerald';
}) {
    const colorMap = {
        amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        purple: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    };

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md border shrink-0",
            colorMap[color]
        )}>
            <Icon className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</span>
            <span className="text-[11px] font-black">{value}</span>
        </div>
    );
}
