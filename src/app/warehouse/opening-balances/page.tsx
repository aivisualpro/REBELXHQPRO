'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
    Search,
    Upload,
    ArrowUpDown,
    Filter,
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { List, Plus, Pencil, Trash, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';

interface OpeningBalance {
    _id: string;
    sku: { _id: string; name: string } | string;
    lotNumber: string;
    qty: number;
    uom: string;
    cost: number;
    expirationDate?: string;
    createdAt: string;
}

export default function OpeningBalancesPage() {
    const { data: session } = useSession();
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
    
    // Lot Selection
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

    const importRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchSkus();
    }, []);

    const fetchSkus = async () => {
        try {
            const res = await fetch('/api/skus?limit=1000'); // Fetch all for dropdown
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

    // Reset page when search changes
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

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
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

                const toastId = toast.loading(`Importing ${totalItems} items...`);
                try {
                    const res = await fetch('/api/opening-balances/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: results.data })
                    });

                    const data = await res.json();

                    if (res.ok) {
                        toast.success(`Imported ${data.count} items!`, { id: toastId });
                        if (data.errors && data.errors.length > 0) {
                            setTimeout(() => toast.error(`${data.errors.length} errors occurred. Check console.`), 2000);
                            console.error(data.errors);
                        }
                    } else {
                        toast.error(data.error || "Import failed", { id: toastId });
                    }

                    fetchBalances();
                } catch (err: any) {
                    toast.error(`Error: ${err.message}`, { id: toastId });
                }
            }
        });
        e.target.value = '';
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

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this opening balance?')) return;
        
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

    const renderSku = (val: any) => (typeof val === 'object' && val?.name ? val.name : val || '-');

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-4">
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Opening Balances</h1>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search Lot #..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400 rounded-sm"
                        />
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleOpenAdd}
                        className="h-[28px] px-3 border border-slate-900 bg-slate-900 text-white hover:bg-slate-800 transition-colors rounded-sm flex items-center space-x-1.5"
                    >
                        <Plus className="w-3 h-3" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Add New</span>
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
                                { key: 'lotNumber', label: 'Lot Number' },
                                { key: 'qty', label: 'Qty' },
                                { key: 'uom', label: 'UOM' },
                                { key: 'cost', label: 'Cost ($)' },
                                { key: 'expirationDate', label: 'Expires' },
                                { key: 'createdAt', label: 'Created At' },
                            ].map(col => (
                                <th
                                    key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                                >
                                    <div className="flex items-center space-x-1.5">
                                        <span>{col.label}</span>
                                        <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-black" : "text-slate-200")} />
                                    </div>
                                </th>
                            ))}
                            <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400">Loading...</td></tr>
                        ) : balances.length === 0 ? (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No records found</td></tr>
                        ) : balances.map(item => (
                            <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-2 text-[11px] font-bold text-slate-900">{renderSku(item.sku)}</td>
                                <td className="px-4 py-2 text-[11px] text-slate-600 font-mono group">
                                    <div className="flex items-center gap-2">
                                        <span>{item.lotNumber}</span>
                                        <button 
                                            onClick={() => {
                                                const skuId = typeof item.sku === 'object' ? item.sku._id : item.sku;
                                                setLotSelector({
                                                    isOpen: true,
                                                    mode: 'row',
                                                    itemId: item._id,
                                                    skuId: skuId,
                                                    currentLot: item.lotNumber
                                                });
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-all"
                                            title="Change Lot Number"
                                        >
                                            <List className="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-[11px] text-slate-600">{item.qty}</td>
                                <td className="px-4 py-2 text-[10px] text-slate-500 uppercase font-bold">{item.uom}</td>
                                <td className="px-4 py-2 text-[11px] text-slate-600">${item.cost.toFixed(8)}</td>
                                <td className="px-4 py-2 text-[11px] text-slate-500">
                                    {item.expirationDate ? new Date(item.expirationDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-2 text-[11px] text-slate-500">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => handleOpenEdit(item)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors">
                                            <Pencil className="w-3.5 h-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(item._id)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600 transition-colors">
                                            <Trash className="w-3.5 h-3.5" />
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

            {/* Add/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md shadow-2xl overflow-hidden scale-100 transition-transform">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900">{editingId ? 'Edit Opening Balance' : 'Add Opening Balance'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-black transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-slate-500">SKU</label>
                                <SearchableSelect
                                    placeholder="Select SKU"
                                    options={allSkus.map(s => ({ value: s._id, label: s.name }))}
                                    value={formData.sku}
                                    onChange={(val) => setFormData({ ...formData, sku: val })}
                                    className="w-full"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Lot Number</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={formData.lotNumber} 
                                            onChange={e => setFormData({...formData, lotNumber: e.target.value})} 
                                            className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-black transition-colors"
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
                                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                            title="Select Existing Lot"
                                        >
                                            <List className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Quantity</label>
                                    <input type="number" step="0.01" value={formData.qty} onChange={e => setFormData({...formData, qty: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-black transition-colors" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">UOM</label>
                                    <input type="text" value={formData.uom} onChange={e => setFormData({...formData, uom: e.target.value})} className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-black transition-colors" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase text-slate-500">Cost ($)</label>
                                    <input type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-black transition-colors" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Expiration Date (Optional)</label>
                                <input type="date" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-black transition-colors" />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors">Save</button>
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
