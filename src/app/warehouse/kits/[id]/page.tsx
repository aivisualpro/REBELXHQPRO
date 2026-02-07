'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface Kit {
    _id: string;
    name: string;
    lineItems: any[];
}

interface Sku {
    _id: string;
    name: string;
}

export default function KitDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [kit, setKit] = useState<Kit | null>(null);
    const [loading, setLoading] = useState(true);
    const [skus, setSkus] = useState<Sku[]>([]);

    // Edit States
    const [isEditingItem, setIsEditingItem] = useState(false);
    const [currentItem, setCurrentItem] = useState<any>(null);
    const [itemMode, setItemMode] = useState<'add' | 'edit'>('add');
    const [itemIndex, setItemIndex] = useState(-1);

    useEffect(() => {
        if (!params.id) return;
        fetchData();
        fetchSkus();
    }, [params.id]);

    const fetchData = () => {
        setLoading(true);
        fetch(`/api/kits/${params.id}`)
            .then(res => res.json())
            .then(data => setKit(data))
            .catch(() => toast.error("Failed to load kit"))
            .finally(() => setLoading(false));
    };

    const fetchSkus = () => {
        fetch('/api/skus?limit=0')
            .then(res => res.json())
            .then(data => {
                if (data && Array.isArray(data.skus)) {
                    setSkus(data.skus);
                } else if (Array.isArray(data)) {
                    setSkus(data);
                }
            })
            .catch(() => { });
    };

    const updateKit = async (updatedData: Partial<Kit>) => {
        if (!kit) return;

        const payload = { ...kit, ...updatedData };

        // Depopulate line items
        payload.lineItems = payload.lineItems.map((item: any) => ({
            ...item,
            sku: typeof item.sku === 'object' && item.sku ? item.sku._id : item.sku
        }));

        try {
            const res = await fetch(`/api/kits/${kit._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const saved = await res.json();
                setKit(saved);
                toast.success("Updated successfully");
            } else {
                toast.error("Failed to update");
            }
        } catch (e) {
            toast.error("Error updating kit");
        }
    };

    // --- Line Items Handlers ---

    const openItemModal = (item?: any, index: number = -1) => {
        if (item) {
            setItemMode('edit');
            setCurrentItem({ ...item, sku: typeof item.sku === 'object' ? item.sku._id : item.sku });
            setItemIndex(index);
        } else {
            setItemMode('add');
            setCurrentItem({ sku: '', qty: 1 });
            setItemIndex(-1);
        }
        setIsEditingItem(true);
    };

    const saveItem = () => {
        if (!kit || !currentItem.sku) return toast.error("SKU is required");

        const newItems = [...kit.lineItems];
        if (itemMode === 'add') {
            newItems.push(currentItem);
        } else {
            newItems[itemIndex] = currentItem;
        }

        updateKit({ lineItems: newItems });
        setIsEditingItem(false);
    };

    const deleteItem = (index: number) => {
        if (!confirm("Remove this item?")) return;
        const newItems = [...(kit?.lineItems || [])];
        newItems.splice(index, 1);
        updateKit({ lineItems: newItems });
    };

    const renderSku = (val: any) => (typeof val === 'object' && val?.name ? val.name : val || '-');
    const skuOptions = skus.map(s => ({ value: s._id, label: s.name }));

    if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
    if (!kit) return <div className="p-8 text-center text-slate-400">Kit not found</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-2 text-sm">
                    <button onClick={() => router.push('/warehouse/kits')} className="text-slate-500 hover:text-black transition-colors">
                        Product Kits
                    </button>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">{kit.name}</span>
                </div>
                <button onClick={() => router.back()} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold uppercase text-slate-500 hover:text-black hover:bg-slate-100 transition-colors rounded">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                </button>
            </div>

            <div className="p-6 space-y-8 overflow-auto pb-20">
                {/* Info Cards */}
                <div className="grid grid-cols-3 gap-6 p-4 bg-slate-50 rounded border border-slate-100">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Kit Name</div>
                        <div className="font-bold text-slate-900 text-sm">{kit.name}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Total Items</div>
                        <div className="font-bold text-slate-900 text-sm">{kit.lineItems?.length || 0}</div>
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <h3 className="text-sm font-bold uppercase text-slate-900">Kit Items ({kit.lineItems?.length || 0})</h3>
                        <button onClick={() => openItemModal()} className="flex items-center space-x-1 px-3 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-slate-800 transition-colors">
                            <Plus className="w-3 h-3" />
                            <span>Add Item</span>
                        </button>
                    </div>
                    <div className="border border-slate-100 rounded overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">SKU</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Qty</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {kit.lineItems?.length === 0 && (
                                    <tr><td colSpan={3} className="p-4 text-center text-xs text-slate-400">No items added yet.</td></tr>
                                )}
                                {kit.lineItems?.map((item: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50/50 group">
                                        <td className="px-4 py-2 text-xs font-medium text-slate-700">{renderSku(item.sku)}</td>
                                        <td className="px-4 py-2 text-xs text-slate-600">{item.qty}</td>
                                        <td className="px-4 py-2 text-right">
                                            <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => openItemModal(item, i)} className="p-1 text-slate-400 hover:text-blue-600 transition-colors"><Edit2 className="w-3 h-3" /></button>
                                                <button onClick={() => deleteItem(i)} className="p-1 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Edit Item Modal */}
            {isEditingItem && currentItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-sm text-slate-900">{itemMode === 'add' ? 'Add Kit Item' : 'Edit Kit Item'}</h3>
                            <button onClick={() => setIsEditingItem(false)}><X className="w-4 h-4 text-slate-400 hover:text-black" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Item SKU</label>
                                <SearchableSelect
                                    options={skuOptions}
                                    value={currentItem.sku}
                                    onChange={(val) => setCurrentItem({ ...currentItem, sku: val })}
                                    placeholder="Search item..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                                    value={currentItem.qty}
                                    onChange={e => setCurrentItem({ ...currentItem, qty: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={saveItem} className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-slate-800 transition-colors">
                                Save Item
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
