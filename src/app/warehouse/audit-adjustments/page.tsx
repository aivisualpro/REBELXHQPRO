'use client';

import React, { useState, useEffect } from 'react';
import {
    ArrowUpDown,
    X,
    Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Suspense } from 'react';

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
        <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><span className="text-xs text-muted-foreground">Loading...</span></div>}>
            <AuditAdjustmentsPage />
        </Suspense>
    );
}

function AuditAdjustmentsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [adjustments, setAdjustments] = useState<AuditAdjustment[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Search from URL params (main header)
    const search = searchParams.get('search') || '';
    const [debouncedSearch, setDebouncedSearch] = useState(search);
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
        fetch('/api/skus?limit=1000')
            .then(res => res.json())
            .then(data => {
                if(data.skus) {
                    setSkus(data.skus.map((s: any) => ({ label: s.name, value: s._id })));
                }
            });
    }, []);

    // Debounce search from URL
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

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
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
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-secondary/50 z-10 border-b border-border">
                        <tr>
                            <th className="px-2 py-1 text-[8px] font-medium text-muted-foreground uppercase tracking-widest w-8 border-r border-border">Img</th>
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
                                    onClick={() => handleSort(col.key)}
                                    className="px-2 py-1 text-[8px] font-medium text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary transition-colors border-r border-border"
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{col.label}</span>
                                        <ArrowUpDown className={cn("w-2 h-2", sortBy === col.key ? "text-foreground" : "text-muted-foreground/30")} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-muted-foreground">Loading...</td></tr>
                        ) : adjustments.length === 0 ? (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-muted-foreground uppercase tracking-tighter opacity-50">No records found</td></tr>
                        ) : adjustments.map(item => {
                            const skuData = getSkuData(item.sku);
                            const imgSrc = skuData.image || missingImg || '';
                            const skuTier = typeof item.sku === 'object' && item.sku !== null ? (item.sku as any).tier : undefined;
                            return (
                                <tr
                                    key={item._id}
                                    className="hover:bg-secondary/30 transition-colors group cursor-pointer"
                                    onClick={() => router.push(`/warehouse/audit-adjustments/${item._id}`)}
                                >
                                    {/* Image */}
                                    <td className="px-1 py-0.5 w-8 border-r border-border">
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
                                    <td className="px-2 py-1.5 text-[10px] text-foreground border-r border-border">
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
                                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono tracking-tighter border-r border-border">{item.lotNumber}</td>
                                    <td className={cn(
                                        "px-2 py-1.5 text-[10px] font-mono border-r border-border",
                                        item.qty > 0 ? "text-emerald-600" : "text-rose-600"
                                    )}>
                                        {item.qty > 0 ? '+' : ''}{item.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
                                    </td>
                                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground max-w-xs truncate border-r border-border" title={item.reason}>{item.reason}</td>
                                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground border-r border-border">{renderUser(item.createdBy)}</td>
                                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono border-r border-border">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={totalItems}
                itemsPerPage={20}
                itemName="Items"
            />
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-background rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 border border-border">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-foreground">
                        {initialData ? 'Edit Adjustment' : 'New Adjustment'}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">SKU</label>
                        {initialData ? (
                             <input 
                                type="text"
                                value={typeof initialData.sku === 'object' ? initialData.sku.name : initialData.sku}
                                disabled
                                className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm text-muted-foreground cursor-not-allowed"
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

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Lot Number</label>
                        <input 
                            type="text"
                            value={formData.lotNumber}
                            onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                            className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:border-primary transition-colors"
                            placeholder="Enter Lot #"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Quantity Adjustment</label>
                        <input 
                            type="number"
                            step="any"
                            value={formData.qty}
                            onChange={e => setFormData({...formData, qty: parseFloat(e.target.value)})}
                            className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:border-primary transition-colors"
                            placeholder="0"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">Positive adds stock, negative removes stock.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Reason</label>
                        <textarea 
                            value={formData.reason}
                            onChange={e => setFormData({...formData, reason: e.target.value})}
                            className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:border-primary transition-colors min-h-[80px]"
                            placeholder="Why is this being adjusted?"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary rounded mr-2 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (!initialData && !formData.sku)}
                            className="px-4 py-2 text-sm font-bold text-primary-foreground bg-primary rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {loading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground"></div>}
                            <span>{initialData ? 'Save Changes' : 'Create Adjustment'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
