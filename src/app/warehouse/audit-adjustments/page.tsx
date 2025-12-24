'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Search,
    Upload,
    ArrowUpDown,
    Plus,
    Edit,
    Trash2,
    X,
    Save
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { useSession } from 'next-auth/react';
import { SearchableSelect } from '@/components/ui/SearchableSelect'; // Utilizing existing SearchableSelect if available or similar logic

interface AuditAdjustment {
    _id: string;
    sku: { _id: string; name: string; uom: string } | string;
    lotNumber: string;
    qty: number;
    reason: string;
    createdBy: { firstName: string; lastName: string } | string;
    createdAt: string;
}

export default function AuditAdjustmentsPage() {
    const [adjustments, setAdjustments] = useState<AuditAdjustment[]>([]);
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
    const { data: session } = useSession();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AuditAdjustment | null>(null);
    const [skus, setSkus] = useState<{ label: string, value: string }[]>([]);

    useEffect(() => {
        // Fetch SKUs for dropdown
        fetch('/api/skus?limit=1000') // Optimistic fetch of all SKUs, or implement search in select
            .then(res => res.json())
            .then(data => {
                if(data.skus) {
                    setSkus(data.skus.map((s: any) => ({ label: s.name, value: s._id })));
                }
            });
    }, []);

    const importRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch]);

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
                sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
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

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this adjustment? This cannot be undone.')) {
            try {
                const res = await fetch(`/api/warehouse/audit-adjustments/${id}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    toast.success('Adjustment deleted');
                    fetchAdjustments();
                } else {
                    toast.error('Failed to delete');
                }
            } catch (error) {
                toast.error('Error deleting adjustment');
            }
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const totalItems = results.data.length;
                if (totalItems === 0) {
                    toast.error("No data found");
                    if (e.target) e.target.value = '';
                    return;
                }

                const CHUNK_SIZE = 500;
                const chunks = [];
                for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
                    chunks.push(results.data.slice(i, i + CHUNK_SIZE));
                }

                const toastId = toast.loading(`Importing ${totalItems} items... 0%`);
                let processed = 0;
                let successCount = 0;
                let allErrors: string[] = [];

                try {
                    for (const chunk of chunks) {
                        const res = await fetch('/api/warehouse/audit-adjustments/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ items: chunk }) 
                        });

                        const data = await res.json();

                        if (res.ok) {
                            successCount += data.count;
                            if (data.errors) {
                                allErrors = [...allErrors, ...data.errors];
                            }
                        } else {
                            allErrors.push(`Batch failed: ${data.error || 'Unknown error'}`);
                        }

                        processed += chunk.length;
                        const progress = Math.round((processed / totalItems) * 100);
                        toast.loading(`Importing ${totalItems} items... ${progress}%`, { id: toastId });
                    }

                    if (successCount > 0) {
                        toast.success(`Imported ${successCount} items!`, { id: toastId });
                    } else {
                         toast.error("Import failed for all items", { id: toastId });
                    }

                    if (allErrors.length > 0) {
                        setTimeout(() => toast.error(`${allErrors.length} errors/warnings occurred. Check console.`), 2000);
                        console.error(allErrors);
                    }

                    fetchAdjustments();
                } catch (err: any) {
                    toast.error(`Error: ${err.message}`, { id: toastId });
                }
            }
        });
        e.target.value = '';
    };

    const renderSku = (val: any) => {
        if (typeof val === 'object' && val?.name) return val.name;
        if (typeof val === 'string') return val;
        return '-';
    };
    const renderUser = (val: any) => {
        if (typeof val === 'object' && val?.firstName) return `${val.firstName} ${val.lastName}`;
        if (typeof val === 'string') return val;
        return '-';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-4">
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Audit Adjustments</h1>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search SKU, Lot, Reason..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400 rounded-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setIsModalOpen(true);
                        }}
                        className="h-[28px] px-3 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1.5 bg-white"
                        title="Add Adjustment"
                    >
                        <Plus className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Add</span>
                    </button>
                    <input type="file" accept=".csv" className="hidden" ref={importRef} onChange={handleImport} />
                    <button
                        onClick={() => importRef.current?.click()}
                        className="h-[28px] px-3 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1.5 bg-white"
                        title="Import CSV"
                    >
                        <Upload className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Import</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left">
                    <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
                        <tr>
                            {[
                                { key: 'sku', label: 'SKU' },
                                { key: 'lotNumber', label: 'Lot #' },
                                { key: 'qty', label: 'Qty' },
                                { key: 'reason', label: 'Reason' },
                                { key: 'createdBy', label: 'Created By' },
                                { key: 'createdAt', label: 'Date' },
                                { key: '_actions', label: '' }
                            ].map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0"
                                >
                                    <div className="flex items-center space-x-1">
                                        <span>{col.label}</span>
                                        <ArrowUpDown className={cn("w-2 h-2", sortBy === col.key ? "text-black" : "text-slate-200")} />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400">Loading...</td></tr>
                        ) : adjustments.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No records found</td></tr>
                        ) : adjustments.map(item => (
                            <tr key={item._id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-2 py-1.5 text-[10px] font-bold text-slate-900">{renderSku(item.sku)}</td>
                                <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono tracking-tighter">{item.lotNumber}</td>
                                <td className={cn(
                                    "px-2 py-1.5 text-[10px] font-bold font-mono",
                                    item.qty > 0 ? "text-emerald-600" : "text-rose-600"
                                )}>
                                    {item.qty > 0 ? '+' : ''}{item.qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })}
                                </td>
                                <td className="px-2 py-1.5 text-[10px] text-slate-600 max-w-xs truncate" title={item.reason}>{item.reason}</td>
                                <td className="px-2 py-1.5 text-[10px] text-slate-500">{renderUser(item.createdBy)}</td>
                                <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                    <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => {
                                                setEditingItem(item);
                                                setIsModalOpen(true);
                                            }}
                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors rounded hover:bg-slate-200"
                                        >
                                            <Edit className="w-3 h-3" />
                                        </button>
                                        <button 
                                             onClick={() => handleDelete(item._id)}
                                             className="p-1 text-slate-400 hover:text-red-600 transition-colors rounded hover:bg-slate-200"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
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
        sku: initialData?.sku?._id || initialData?.sku || '', // If object, get ID, else string
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900">
                        {initialData ? 'Edit Adjustment' : 'New Adjustment'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">SKU</label>
                        {initialData ? (
                             <input 
                                type="text"
                                value={typeof initialData.sku === 'object' ? initialData.sku.name : initialData.sku}
                                disabled
                                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded text-sm text-slate-500 cursor-not-allowed"
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
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Lot Number</label>
                        <input 
                            type="text"
                            value={formData.lotNumber}
                            onChange={e => setFormData({...formData, lotNumber: e.target.value})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black transition-colors"
                            placeholder="Enter Lot #"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Quantity Adjustment</label>
                        <input 
                            type="number"
                            step="any"
                            value={formData.qty}
                            onChange={e => setFormData({...formData, qty: parseFloat(e.target.value)})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black transition-colors"
                            placeholder="0"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Positive adds stock, negative removes stock.</p>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Reason</label>
                        <textarea 
                            value={formData.reason}
                            onChange={e => setFormData({...formData, reason: e.target.value})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black transition-colors min-h-[80px]"
                            placeholder="Why is this being adjusted?"
                        />
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded mr-2 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || (!initialData && !formData.sku)}
                            className="px-4 py-2 text-sm font-bold text-white bg-black rounded hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {loading && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>}
                            <span>{initialData ? 'Save Changes' : 'Create Adjustment'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
