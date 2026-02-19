'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Search,
    ArrowUpDown,
    Loader2,
    List,
    Plus,
    X
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
import { Pagination } from '@/components/ui/Pagination';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';

interface OpeningBalance {
    _id: string;
    sku: { _id: string; name: string; image?: string } | string;
    lotNumber: string;
    qty: number;
    uom: string;
    cost: number;
    expirationDate?: string;
    createdAt: string;
}

export default function OpeningBalancesPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-36px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <OpeningBalancesContent />
        </Suspense>
    );
}

function OpeningBalancesContent() {
    const router = useRouter();
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const checkTarget = () => {
             const el = document.getElementById('header-portal-target');
             if (el) {
                 setPortalTarget(el);
             }
        };
        
        checkTarget();
        const interval = setInterval(checkTarget, 50);
        const timeout = setTimeout(() => clearInterval(interval), 1000);

        return () => {
            clearInterval(interval);
            clearTimeout(timeout);
        };
    }, []);
    const [balances, setBalances] = useState<OpeningBalance[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // CRUD State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        sku: '',
        lotNumber: '',
        qty: 0,
        uom: 'pcs',
        cost: 0,
        expirationDate: ''
    });
    const [allSkus, setAllSkus] = useState<{ _id: string; name: string }[]>([]);
    const [globalSettings, setGlobalSettings] = useState<any>(null);
    
    // Lot Selection State
    const [lotSelector, setLotSelector] = useState<{
        isOpen: boolean;
        mode: 'form' | 'row';
        itemId?: string;
        skuId: string;
        currentLot: string;
    }>({
        isOpen: false,
        mode: 'form',
        skuId: '',
        currentLot: ''
    });

    const handleLotSelect = async (lot: string) => {
        if (lotSelector.mode === 'form') {
            setFormData(prev => ({ ...prev, lotNumber: lot }));
            setLotSelector(prev => ({ ...prev, isOpen: false }));
        } else if (lotSelector.mode === 'row' && lotSelector.itemId) {
            try {
                const toastId = toast.loading('Updating lot number...');
                const res = await fetch(`/api/opening-balances/${lotSelector.itemId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lotNumber: lot })
                });
                if (res.ok) {
                    toast.success('Lot number updated', { id: toastId });
                    fetchBalances();
                } else {
                    toast.error('Failed to update', { id: toastId });
                }
            } catch (e) {
                toast.error('Error updating lot');
            }
            setLotSelector(prev => ({ ...prev, isOpen: false }));
        }
    };

    useEffect(() => {
        fetchSkus();
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => setGlobalSettings(data))
            .catch(() => {});
    }, []);

    // Handle createNew URL param from header Add button
    useEffect(() => {
        if (searchParams.get('createNew') === 'true') {
            handleOpenAdd();
            const params = new URLSearchParams(searchParams.toString());
            params.delete('createNew');
            window.history.replaceState(null, '', `?${params.toString()}`);
        }
    }, [searchParams]);

    const fetchSkus = async () => {
        try {
            const res = await fetch('/api/skus?limit=0&ignoreDate=true&simple=true');
            if (res.ok) {
                const data = await res.json();
                setAllSkus(data.skus || []);
            }
        } catch (error) {
            console.error("Error fetching SKUs");
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

    useEffect(() => {
        fetchBalances();
    }, [page, debouncedSearch, sortBy, sortOrder]);

    const fetchBalances = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                search: debouncedSearch,
                sortBy,
                sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
            });

            const res = await fetch(`/api/opening-balances?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setBalances(data.openingBalances || []);
                setTotalPages(data.totalPages || 1);
                setTotalItems(data.total || 0);
            } else {
                toast.error('Failed to fetch data');
            }
        } catch (error) {
            toast.error('Error loading data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenAdd = () => {
        setEditingId(null);
        setFormData({
            sku: '',
            lotNumber: '',
            qty: 0,
            uom: 'pcs',
            cost: 0,
            expirationDate: ''
        });
        setIsModalOpen(true);
    };

    const handleOpenEdit = (item: OpeningBalance) => {
        setEditingId(item._id);
        setFormData({
            sku: typeof item.sku === 'object' ? item.sku._id : item.sku,
            lotNumber: item.lotNumber || '',
            qty: item.qty || 0,
            uom: item.uom || 'pcs',
            cost: item.cost || 0,
            expirationDate: item.expirationDate ? new Date(item.expirationDate).toISOString().split('T')[0] : ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = (id: string) => {
        confirmDeleteToast('Delete this opening balance?', async () => {
        
            try {
                const res = await fetch(`/api/opening-balances/${id}`, { method: 'DELETE' });
                if (res.ok) {
                     toast.success('Deleted successfully');
                     fetchBalances();
                } else {
                     toast.error('Failed to delete');
                }
            } catch (e) {
                toast.error('Error deleting item');
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.sku) {
            toast.error('Please select a SKU');
            return;
        }

        try {
            const url = editingId 
                ? `/api/opening-balances/${editingId}` 
                : '/api/opening-balances';
            
            const method = editingId ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(editingId ? 'Updated successfully' : 'Created successfully');
                setIsModalOpen(false);
                fetchBalances();
            } else {
                toast.error('Failed to save');
            }
        } catch (e) {
            toast.error('Error saving item');
        }
    };

    const getSkuName = (val: any) => (typeof val === 'object' && val?.name ? val.name : val || '-');
    const getSkuImage = (val: any) => (typeof val === 'object' && val?.image ? val.image : '');

    return (
        <div className="flex flex-col h-[calc(100vh-36px)] bg-background relative transition-colors duration-300">
            {/* Portal search + title + Add button into the header */}
            {portalTarget && createPortal(
                <div className="flex items-center justify-between w-full h-full">
                    <div className="flex items-center gap-3">
                        <h1 className="text-sm font-bold text-foreground uppercase tracking-tight whitespace-nowrap">Opening Balances</h1>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search SKU or lot..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-8 pr-8 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
                            />
                            {search && (
                                <button 
                                    onClick={() => setSearch('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAdd();
                        }}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all cursor-pointer relative z-50 pointer-events-auto"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                    </button>
                </div>,
                portalTarget
            )}

            <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
                <div className="min-w-full px-2 py-2">

                    <table className="w-full text-left border-separate border-spacing-0 relative z-0">
                        <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
                            <tr>
                                {/* Image */}
                                <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest w-10 border-r border-border">Img</th>
                                
                                {/* SKU Name */}
                                <th className="border-r border-border">
                                    <TableColumnHeader
                                        column="sku"
                                        title="SKU"
                                        currentSortBy={sortBy}
                                        currentSortOrder={sortOrder}
                                        onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                                        className="text-muted-foreground"
                                    />
                                </th>

                                {/* Lot Number */}
                                <th className="border-r border-border">
                                    <TableColumnHeader column="lotNumber" title="Lot Number" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
                                </th>

                                {/* Qty */}
                                <th className="border-r border-border">
                                    <TableColumnHeader column="qty" title="Qty" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
                                </th>

                                {/* UOM */}
                                <th className="border-r border-border">
                                    <TableColumnHeader column="uom" title="UOM" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
                                </th>

                                {/* Cost */}
                                <th className="border-r border-border">
                                    <TableColumnHeader column="cost" title="Cost ($)" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
                                </th>

                                {/* Expires */}
                                <th className="border-r border-border">
                                    <TableColumnHeader column="expirationDate" title="Expires" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
                                </th>

                                {/* Created At */}
                                <th className="border-r border-border last:border-0">
                                    <TableColumnHeader column="createdAt" title="Created At" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-background/50">
                            {loading ? (
                                <tr><td colSpan={8} className="px-2 py-12 text-center text-[11px] text-muted-foreground">Loading...</td></tr>
                            ) : balances.length === 0 ? (
                                <tr><td colSpan={8} className="px-2 py-12 text-center text-[11px] text-muted-foreground uppercase tracking-tighter opacity-50">No records found</td></tr>
                            ) : balances.map(item => (
                                <tr 
                                    key={item._id} 
                                    className="group relative z-0 bg-background hover:bg-secondary/40 transition-colors duration-150 cursor-pointer"
                                    onClick={() => router.push(`/warehouse/opening-balances/${item._id}`)}
                                >
                                    {/* Image */}
                                    <td className="px-2 py-1 border-r border-border group-hover:border-l-2 group-hover:border-l-primary transition-all">
                                        <div className="w-6 h-6 rounded bg-secondary overflow-hidden relative border border-border">
                                            <img 
                                                src={getSkuImage(item.sku) || globalSettings?.missingSkuImage || '/sku-placeholder.png'} 
                                                alt="" 
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    const fallback = globalSettings?.missingSkuImage || '/sku-placeholder.png';
                                                    if (target.src !== fallback && target.src.indexOf('sku-placeholder.png') === -1) {
                                                        target.src = fallback;
                                                    }
                                                }} 
                                            />
                                        </div>
                                    </td>

                                    {/* SKU Name */}
                                    <td className="px-2 py-1 text-[11px] text-muted-foreground border-r border-border whitespace-nowrap">
                                        <span className="truncate max-w-[200px]" title={getSkuName(item.sku)}>{getSkuName(item.sku)}</span>
                                    </td>

                                    {/* Lot Number */}
                                    <td className="px-2 py-1 text-[11px] text-muted-foreground font-mono border-r border-border">
                                        <div className="flex items-center gap-2">
                                            <span className="tracking-tighter">{item.lotNumber}</span>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const skuId = typeof item.sku === 'object' ? item.sku._id : item.sku;
                                                    setLotSelector({
                                                        isOpen: true,
                                                        mode: 'row',
                                                        itemId: item._id,
                                                        skuId: skuId,
                                                        currentLot: item.lotNumber
                                                    });
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-all"
                                                title="Change Lot Number"
                                            >
                                                <List className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    </td>

                                    {/* Qty */}
                                    <td className="px-2 py-1 text-[11px] text-muted-foreground border-r border-border text-center">{item.qty}</td>

                                    {/* UOM */}
                                    <td className="px-2 py-1 text-[11px] uppercase text-muted-foreground border-r border-border">{item.uom}</td>

                                    {/* Cost */}
                                    <td className="px-2 py-1 text-[11px] text-muted-foreground font-mono border-r border-border text-right">
                                        ${(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                    </td>

                                    {/* Expires */}
                                    <td className="px-2 py-1 text-[11px] text-muted-foreground font-mono border-r border-border">
                                        {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : '-'}
                                    </td>

                                    {/* Created At */}
                                    <td className="px-2 py-1 text-[11px] text-muted-foreground font-mono border-r border-border last:border-0">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="border-t border-border bg-background transition-colors duration-300">
                <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={totalItems}
                    itemsPerPage={20}
                    itemName="Items"
                />
            </div>

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-background border border-border w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded-md">
                        <div className="flex items-center justify-between px-4 h-9 border-b border-border shrink-0 bg-background">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground">
                                {editingId ? 'Edit Opening Balance' : 'Add Opening Balance'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">SKU</label>
                                <SearchableSelect
                                    placeholder="Select SKU"
                                    options={allSkus.map(s => ({ value: s._id, label: s.name }))}
                                    value={formData.sku}
                                    onChange={(val) => setFormData({ ...formData, sku: val })}
                                    className="w-full text-[11px]"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Lot Number</label>
                                    <div className="flex gap-2 h-9">
                                        <input 
                                            type="text" 
                                            value={formData.lotNumber} 
                                            onChange={e => setFormData({...formData, lotNumber: e.target.value})} 
                                            className="flex-1 px-3 h-full bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors"
                                            placeholder="Enter Lot #"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!formData.sku) {
                                                    toast.error('Please select a SKU first');
                                                    return;
                                                }
                                                setLotSelector({
                                                    isOpen: true,
                                                    mode: 'form',
                                                    skuId: formData.sku,
                                                    currentLot: formData.lotNumber
                                                });
                                            }}
                                            className="px-3 h-full bg-secondary border border-border rounded text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                                            title="Select Existing Lot"
                                        >
                                            <List className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Quantity</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={formData.qty} 
                                        onChange={e => setFormData({...formData, qty: parseFloat(e.target.value)})} 
                                        className="w-full px-3 h-9 bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors" 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">UOM</label>
                                    <input 
                                        type="text" 
                                        value={formData.uom} 
                                        onChange={e => setFormData({...formData, uom: e.target.value})} 
                                        className="w-full px-3 h-9 bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors" 
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Cost ($)</label>
                                    <input 
                                        type="number" 
                                        step="0.01" 
                                        value={formData.cost} 
                                        onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} 
                                        className="w-full px-3 h-9 bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Expiration Date (Optional)</label>
                                <input 
                                    type="date" 
                                    value={formData.expirationDate} 
                                    onChange={e => setFormData({...formData, expirationDate: e.target.value})} 
                                    className="w-full px-3 h-9 bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors" 
                                />
                            </div>

                            <div className="h-10 pt-1 flex gap-2 border-t border-border mt-2">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/80 transition-colors rounded-sm">Cancel</button>
                                <button type="submit" className="flex-1 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors rounded-sm">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <LotSelectionModal 
                isOpen={lotSelector.isOpen}
                onClose={() => setLotSelector(prev => ({ ...prev, isOpen: false }))}
                onSelect={handleLotSelect}
                skuId={lotSelector.skuId}
                currentLotNumber={lotSelector.currentLot}
                title={lotSelector.mode === 'row' ? 'Change Lot Number' : 'Select Reference Lot'}
            />
        </div>
    );
}
