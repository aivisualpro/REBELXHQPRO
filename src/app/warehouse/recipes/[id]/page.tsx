'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface Recipe {
    _id: string;
    name: string;
    sku: { _id: string; name: string } | string;
    qty: number;
    uom: string;
    lineItems: any[];
    steps: any[];
    notes?: string;
}

interface Sku {
    _id: string;
    name: string;
}

export default function RecipeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [skus, setSkus] = useState<Sku[]>([]);

    // Edit States
    const [isEditingItem, setIsEditingItem] = useState(false);
    const [currentItem, setCurrentItem] = useState<any>(null);
    const [itemMode, setItemMode] = useState<'add' | 'edit'>('add');
    const [itemIndex, setItemIndex] = useState(-1);

    const [isEditingStep, setIsEditingStep] = useState(false);
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepMode, setStepMode] = useState<'add' | 'edit'>('add');
    const [stepIndex, setStepIndex] = useState(-1);

    useEffect(() => {
        if (!params.id) return;
        fetchData();
        fetchSkus();
    }, [params.id]);

    const fetchData = () => {
        setLoading(true);
        fetch(`/api/recipes/${params.id}`)
            .then(res => res.json())
            .then(data => setRecipe(data))
            .catch(e => toast.error("Failed to load recipe"))
            .finally(() => setLoading(false));
    };

    const fetchSkus = () => {
        fetch('/api/skus?limit=0') // Fetch all SKUs
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

    const updateRecipe = async (updatedData: Partial<Recipe>) => {
        if (!recipe) return;

        // Prepare payload: depopulate fields
        const payload = { ...recipe, ...updatedData };

        // Depopulate root SKU if needed (though we likely don't edit root details here, just arrays)
        if (typeof payload.sku === 'object' && payload.sku !== null) {
            payload.sku = (payload.sku as any)._id;
        }

        // Depopulate line items
        payload.lineItems = payload.lineItems.map((item: any) => ({
            ...item,
            sku: typeof item.sku === 'object' && item.sku ? item.sku._id : item.sku
        }));

        try {
            const res = await fetch(`/api/recipes/${recipe._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const saved = await res.json();
                setRecipe(saved);
                toast.success("Updated successfully");
            } else {
                toast.error("Failed to update");
            }
        } catch (e) {
            toast.error("Error updating recipe");
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
            setCurrentItem({ sku: '', qty: 1, uom: 'EA' });
            setItemIndex(-1);
        }
        setIsEditingItem(true);
    };

    const saveItem = () => {
        if (!recipe || !currentItem.sku) return toast.error("SKU is required");

        const newItems = [...recipe.lineItems];
        if (itemMode === 'add') {
            newItems.push(currentItem);
        } else {
            newItems[itemIndex] = currentItem;
        }

        updateRecipe({ lineItems: newItems });
        setIsEditingItem(false);
    };

    const deleteItem = (index: number) => {
        if (!confirm("Remove this ingredient?")) return;
        const newItems = [...(recipe?.lineItems || [])];
        newItems.splice(index, 1);
        updateRecipe({ lineItems: newItems });
    };

    // --- Steps Handlers ---

    const openStepModal = (step?: any, index: number = -1) => {
        if (step) {
            setStepMode('edit');
            setCurrentStep({ ...step });
            setStepIndex(index);
        } else {
            setStepMode('add');
            setCurrentStep({ step: (recipe?.steps?.length || 0) + 1, description: '', details: '' });
            setStepIndex(-1);
        }
        setIsEditingStep(true);
    };

    const saveStep = () => {
        if (!recipe || !currentStep.description) return toast.error("Description is required");

        const newSteps = [...recipe.steps];
        if (stepMode === 'add') {
            newSteps.push(currentStep);
        } else {
            newSteps[stepIndex] = currentStep;
        }

        updateRecipe({ steps: newSteps });
        setIsEditingStep(false);
    };

    const deleteStep = (index: number) => {
        if (!confirm("Remove this step?")) return;
        const newSteps = [...(recipe?.steps || [])];
        newSteps.splice(index, 1);
        updateRecipe({ steps: newSteps });
    };

    const renderSku = (val: any) => (typeof val === 'object' && val?.name ? val.name : val || '-');
    const skuOptions = skus.map(s => ({ value: s._id, label: s.name }));

    if (loading) return <div className="p-8 text-center text-slate-400">Loading...</div>;
    if (!recipe) return <div className="p-8 text-center text-slate-400">Recipe not found</div>;

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-2 text-sm">
                    <button onClick={() => router.push('/warehouse/recipes')} className="text-slate-500 hover:text-black transition-colors">
                        Recipes
                    </button>
                    <span className="text-slate-300">/</span>
                    <span className="font-bold text-slate-900">{recipe.name}</span>
                </div>
                <button onClick={() => router.back()} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold uppercase text-slate-500 hover:text-black hover:bg-slate-100 transition-colors rounded">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                </button>
            </div>

            <div className="p-6 space-y-8 overflow-auto pb-20">
                {/* Info Cards */}
                <div className="grid grid-cols-4 gap-6 p-4 bg-slate-50 rounded border border-slate-100">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Recipe Name</div>
                        <div className="font-bold text-slate-900 text-sm">{recipe.name}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Product SKU</div>
                        <div className="text-sm text-slate-700">{renderSku(recipe.sku)}</div>
                    </div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Yield Qty</div>
                        <div className="text-sm text-slate-700 font-bold">{recipe.qty} <span className="text-xs font-normal text-slate-500">{recipe.uom}</span></div>
                    </div>
                </div>

                {/* Line Items */}
                <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <h3 className="text-sm font-bold uppercase text-slate-900">Ingredients ({recipe.lineItems?.length || 0})</h3>
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
                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">UOM</th>
                                    <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {recipe.lineItems?.length === 0 && (
                                    <tr><td colSpan={4} className="p-4 text-center text-xs text-slate-400">No ingredients added yet.</td></tr>
                                )}
                                {recipe.lineItems?.map((item: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50/50 group">
                                        <td className="px-4 py-2 text-xs font-medium text-slate-700">{renderSku(item.sku)}</td>
                                        <td className="px-4 py-2 text-xs text-slate-600">{item.qty}</td>
                                        <td className="px-4 py-2 text-[10px] font-bold uppercase text-slate-400">{item.uom}</td>
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

                {/* Steps */}
                <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <h3 className="text-sm font-bold uppercase text-slate-900">Process Steps ({recipe.steps?.length || 0})</h3>
                        <button onClick={() => openStepModal()} className="flex items-center space-x-1 px-3 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-wider rounded-sm hover:bg-slate-800 transition-colors">
                            <Plus className="w-3 h-3" />
                            <span>Add Step</span>
                        </button>
                    </div>
                    <div className="space-y-4">
                        {recipe.steps?.length === 0 && (
                            <div className="p-8 text-center border border-dashed border-slate-200 rounded text-xs text-slate-400">No steps defined.</div>
                        )}
                        {recipe.steps?.sort((a: any, b: any) => (parseInt(a.step) || 0) - (parseInt(b.step) || 0)).map((step: any, i: number) => (
                            <div key={i} className="flex gap-4 p-4 rounded bg-white border border-slate-100 shadow-sm relative group hover:border-slate-200 transition-colors">
                                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-900 text-white text-xs font-bold rounded-full shadow-sm">
                                    {step.step}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold text-slate-900 text-sm mb-1">{step.description}</div>
                                    <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">{step.details || 'No details provided.'}</div>
                                </div>
                                <div className="absolute top-3 right-3 flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2">
                                    <button onClick={() => openStepModal(step, i)} className="p-1.5 bg-slate-50 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => deleteStep(i)} className="p-1.5 bg-slate-50 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recipe Notes */}
                <div>
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                        <h3 className="text-sm font-bold uppercase text-slate-900">Recipe Notes</h3>
                    </div>
                    <div className="space-y-4">
                        <textarea
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded text-xs text-slate-600 focus:outline-none focus:bg-white focus:border-black/10 transition-all min-h-[120px] leading-relaxed"
                            placeholder="Add general recipe notes here..."
                            value={recipe.notes || ''}
                            onChange={(e) => setRecipe({ ...recipe, notes: e.target.value })}
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={() => updateRecipe({ notes: recipe.notes })}
                                className="flex items-center space-x-1.5 px-4 py-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-black transition-colors shadow-sm"
                            >
                                <Save className="w-3 h-3" />
                                <span>Save Notes</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Item Modal */}
            {isEditingItem && currentItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-sm text-slate-900">{itemMode === 'add' ? 'Add Ingredient' : 'Edit Ingredient'}</h3>
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Quantity</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                                        value={currentItem.qty}
                                        onChange={e => setCurrentItem({ ...currentItem, qty: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">UOM</label>
                                    <select
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                                        value={currentItem.uom}
                                        onChange={e => setCurrentItem({ ...currentItem, uom: e.target.value })}
                                    >
                                        {['EA', 'KG', 'L', 'M', 'G', 'OZ', 'LB'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
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

            {/* Edit Step Modal */}
            {isEditingStep && currentStep && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="font-bold text-sm text-slate-900">{stepMode === 'add' ? 'Add Step' : 'Edit Step'}</h3>
                            <button onClick={() => setIsEditingStep(false)}><X className="w-4 h-4 text-slate-400 hover:text-black" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Step Number</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                                    value={currentStep.step}
                                    onChange={e => setCurrentStep({ ...currentStep, step: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                                    placeholder="e.g. Mix ingredients..."
                                    value={currentStep.description}
                                    onChange={e => setCurrentStep({ ...currentStep, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Details</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20 min-h-[100px]"
                                    placeholder="Detailed instructions..."
                                    value={currentStep.details}
                                    onChange={e => setCurrentStep({ ...currentStep, details: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button onClick={saveStep} className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-slate-800 transition-colors">
                                Save Step
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

