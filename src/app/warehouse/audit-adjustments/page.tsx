'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    ArrowUpDown,
    X,
    Save,
    Search,
    Loader2,
    Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Suspense } from 'react';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';

interface AuditAdjustment {
    _id: string;
    sku: { _id: string; name: string; uom: string; image?: string; tier?: number } | string;
    lotNumber: string;
    qty: number;
    reason: string;
    createdBy: { firstName: string; lastName: string } | string;
    createdAt: string;
}

export default function AuditAdjustmentsPageWrapper() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
            <AuditAdjustmentsPage />
        </Suspense>
    );
}

function AuditAdjustmentsPage() {
    const router = useRouter();
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

    const [adjustments, setAdjustments] = useState<AuditAdjustment[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Search - local state with debounce
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // CRUD State
    const { data: session } = useSession();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AuditAdjustment | null>(null);
    const [skus, setSkus] = useState<{ label: string, value: string }[]>([]);
    const [globalSettings, setGlobalSettings] = useState<any>(null);

    // Load settings for missing SKU image fallback
    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => setGlobalSettings(data))
            .catch(() => {});
    }, []);

    // Check for createNew param from header
    useEffect(() => {
        if (searchParams.get('createNew') === 'true') {
            setEditingItem(null);
            setIsModalOpen(true);
            // Remove the param from URL
            const params = new URLSearchParams(searchParams.toString());
            params.delete('createNew');
            router.replace(`/warehouse/audit-adjustments${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
        }
    }, [searchParams]);

    useEffect(() => {
        fetch('/api/skus?limit=0&ignoreDate=true&simple=true')
            .then(res => res.json())
            .then(data => {
                if(data.skus) {
                    setSkus(data.skus.map((s: any) => ({ label: s.name, value: s._id })));
                }
            });
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setPage(1);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchAdjustments();
    }, [page, debouncedSearch, sortBy, sortOrder]);

    const fetchAdjustments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                search: debouncedSearch,
                sortBy,
                sortOrder
            });

            const res = await fetch(`/api/warehouse/audit-adjustments?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setAdjustments(data.adjustments || []);
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
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const getSkuData = (val: any) => {
        if (typeof val === 'object' && val?.name) return val;
        return { _id: '', name: typeof val === 'string' ? val : '-', uom: '', image: '' };
    };

    const renderUser = (val: any) => {
        if (typeof val === 'object' && val?.firstName) return `${val.firstName} ${val.lastName}`;
        if (typeof val === 'string') return val;
        return '-';
    };

    const missingImg = globalSettings?.missingSkuImage || '';

    return (
        <div className="flex flex-col h-[calc(100vh-36px)] bg-background relative transition-colors duration-300">
            {/* Portal search + title + Add button into the header */}
            {portalTarget && createPortal(
                <div className="flex items-center justify-between w-full h-full">
                    <div className="flex items-center gap-3">
                        <h1 className="text-sm font-bold text-foreground uppercase tracking-tight whitespace-nowrap">Audit Adjustments</h1>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search SKU, lot, reason..."
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

            {/* Table */}
            <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
                <div className="min-w-full px-2 py-2">
                <table className="w-full text-left border-separate border-spacing-0 relative z-0">
                    <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
                        <tr>
                            <th className="px-2 py-1 text-[8px] font-bold text-muted-foreground uppercase tracking-widest w-8 border-r border-border">Img</th>
                            {[
                                { key: 'sku', label: 'SKU' },
                                { key: 'lotNumber', label: 'Lot #' },
                                { key: 'qty', label: 'Qty' },
                                { key: 'reason', label: 'Reason' },
                                { key: 'createdBy', label: 'Created By' },
                                { key: 'createdAt', label: 'Date' },
                            ].map(col => (
                                <th
                                    key={col.key}
                                    className="border-r border-border last:border-0"
                                >
                                    <TableColumnHeader
                                        column={col.key}
                                        title={col.label}
                                        currentSortBy={sortBy}
                                        currentSortOrder={sortOrder}
                                        onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                                        className="text-muted-foreground"
                                    />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background/50">
                        {loading ? (
                            <tr><td colSpan={8} className="px-2 py-12 text-center text-[11px] text-muted-foreground">Loading...</td></tr>
                        ) : adjustments.length === 0 ? (
                            <tr><td colSpan={8} className="px-2 py-12 text-center text-[11px] text-muted-foreground uppercase tracking-tighter opacity-50">No records found</td></tr>
                        ) : adjustments.map(item => {
                            const skuData = getSkuData(item.sku);
                            const imgSrc = skuData.image || missingImg || '';
                            const skuTier = typeof item.sku === 'object' && item.sku !== null ? (item.sku as any).tier : undefined;
                            return (
                                <tr
                                    key={item._id}
                                    className="group relative z-0 bg-background hover:bg-secondary/40 transition-colors duration-150 cursor-pointer"
                                    onClick={() => router.push(`/warehouse/audit-adjustments/${item._id}`)}
                                >
                                    {/* Image */}
                                    <td className="px-2 py-1 border-r border-border group-hover:border-l-2 group-hover:border-l-primary transition-all">
                                        <div className="w-6 h-6 rounded overflow-hidden bg-secondary flex items-center justify-center border border-border">
                                            <img
                                                src={imgSrc || missingImg || '/sku-placeholder.png'}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    const fallback = missingImg || '/sku-placeholder.png';
                                                    if (target.src !== fallback && target.src.indexOf('sku-placeholder.png') === -1) {
                                                        target.src = fallback;
                                                    }
                                                }}
                                            />
                                        </div>
                                    </td>
                                    {/* SKU Name with Tier */}
                                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground border-r border-border">
                                        <div className="flex items-center space-x-1.5">
                                            {skuTier ? (
                                                <span className={cn(
                                                    "flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white shadow-sm",
                                                    skuTier === 1 ? "bg-emerald-500" :
                                                    skuTier === 2 ? "bg-blue-500" :
                                                    "bg-orange-500"
                                                )} title={`Tier ${skuTier}`}>
                                                    {skuTier}
                                                </span>
                                            ) : null}
                                            <span className="truncate max-w-[200px]" title={skuData.name}>{skuData.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono tracking-tighter border-r border-border">{item.lotNumber}</td>
                                    <td className={cn(
                                        "px-2 py-1.5 text-[11px] font-mono border-r border-border",
                                        item.qty > 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {item.qty > 0 ? '+' : ''}{item.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
                                    </td>
                                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground max-w-xs truncate border-r border-border" title={item.reason}>{item.reason}</td>
                                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground border-r border-border">{renderUser(item.createdBy)}</td>
                                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono border-r border-border last:border-0">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            );
                        })}
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
            {isModalOpen && (
                <AdjustmentModal 
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    initialData={editingItem}
                    skus={skus}
                    sessionUser={session?.user}
                    onSuccess={() => {
                        setIsModalOpen(false);
                        fetchAdjustments();
                    }}
                />
            )}
        </div>
    );
}

function AdjustmentModal({ isOpen, onClose, initialData, skus, sessionUser, onSuccess }: any) {
    const [formData, setFormData] = useState({
        sku: initialData?.sku?._id || initialData?.sku || '',
        lotNumber: initialData?.lotNumber || '',
        qty: initialData?.qty || 0,
        reason: initialData?.reason || '',
    });
    const [loading, setLoading] = useState(false);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const url = initialData ? `/api/warehouse/audit-adjustments/${initialData._id}` : '/api/warehouse/audit-adjustments';
            const method = initialData ? 'PUT' : 'POST';
            
            const payload = {
                ...formData,
                createdBy: initialData ? undefined : (sessionUser?.id || sessionUser?.name || 'Unknown') 
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(initialData ? 'Adjustment updated' : 'Adjustment created');
                onSuccess();
            } else {
                toast.error('Operation failed');
            }
        } catch (error) {
            toast.error('Error saving data');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-background border border-border w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded-md">
                <div className="flex items-center justify-between px-4 h-9 border-b border-border shrink-0 bg-background">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-foreground">
                        {initialData ? 'Edit Adjustment' : 'New Adjustment'}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">SKU</label>
                        {initialData ? (
                             <input 
                                type="text"
                                value={typeof initialData.sku === 'object' ? initialData.sku.name : initialData.sku}
                                disabled
                                className="w-full px-3 h-9 bg-secondary border border-border rounded text-[11px] text-muted-foreground cursor-not-allowed"
                             />
                        ) : (
                            <SearchableSelect 
                                options={skus}
                                value={formData.sku}
                                onChange={(val) => setFormData({...formData, sku: val})}
                                placeholder="Select SKU..."
                                className="w-full"
                            />
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Lot Number</label>
                            <div className="flex gap-1.5">
                                <input 
                                    type="text"
                                    value={formData.lotNumber}
                                    onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                                    className="flex-1 px-3 h-9 bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors"
                                    placeholder="Enter Lot #"
                                />
                                {formData.sku && (
                                    <button
                                        type="button"
                                        onClick={() => setIsLotModalOpen(true)}
                                        className="px-2 h-9 bg-primary/10 border border-primary/30 rounded text-[9px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                                    >
                                        Pick
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Quantity</label>
                            <input 
                                type="number"
                                step="any"
                                value={formData.qty}
                                onChange={e => setFormData({...formData, qty: parseFloat(e.target.value)})}
                                className="w-full px-3 h-9 bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors"
                                placeholder="0"
                            />
                            <p className="text-[10px] text-muted-foreground">Positive adds, negative removes.</p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Reason</label>
                        <textarea 
                            value={formData.reason}
                            onChange={e => setFormData({...formData, reason: e.target.value})}
                            className="w-full px-3 py-2 bg-secondary/50 border border-border rounded text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors min-h-[80px]"
                            placeholder="Why is this being adjusted?"
                        />
                    </div>

                    <div className="h-10 pt-1 flex gap-2 border-t border-border mt-2">
                        <button type="button" onClick={onClose} className="flex-1 flex items-center justify-center bg-secondary text-muted-foreground hover:text-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/80 transition-colors rounded-sm">Cancel</button>
                        <button
                            type="submit"
                            disabled={loading || (!initialData && !formData.sku)}
                            className="flex-1 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />}
                            <span>{initialData ? 'Save Changes' : 'Create'}</span>
                        </button>
                    </div>
                </form>

                {isLotModalOpen && formData.sku && (
                    <LotSelectionModal
                        isOpen={isLotModalOpen}
                        onClose={() => setIsLotModalOpen(false)}
                        onSelect={(lotNumber) => {
                            setFormData({...formData, lotNumber});
                            setIsLotModalOpen(false);
                        }}
                        skuId={formData.sku}
                        currentLotNumber={formData.lotNumber}
                        title="Select Lot"
                    />
                )}
            </div>
        </div>
    );
}
