'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Edit2, Save, X, Package, Layers, FileText, Beaker, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface Recipe {
    _id: string;
    name: string;
    sku: { _id: string; name: string } | string;
    qty: number;
    uom: string;
    createdBy?: { firstName: string; lastName: string } | string;
    createdAt?: string;
    lineItems: any[];
    steps: any[];
    notes?: string;
}

interface Sku {
    _id: string;
    name: string;
}

type TabType = 'Ingredients' | 'Steps' | 'Notes';
const TABS: TabType[] = ['Ingredients', 'Steps', 'Notes'];

export default function RecipeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [recipe, setRecipe] = useState<Recipe | null>(null);
    const [loading, setLoading] = useState(true);
    const [skus, setSkus] = useState<Sku[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>('Ingredients');
    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);

    // Edit States
    const [isEditingItem, setIsEditingItem] = useState(false);
    const [currentItem, setCurrentItem] = useState<any>(null);
    const [itemMode, setItemMode] = useState<'add' | 'edit'>('add');
    const [itemIndex, setItemIndex] = useState(-1);

    const [isEditingStep, setIsEditingStep] = useState(false);
    const [currentStep, setCurrentStep] = useState<any>(null);
    const [stepMode, setStepMode] = useState<'add' | 'edit'>('add');
    const [stepIndex, setStepIndex] = useState(-1);

    // Header editing
    const [isHeaderEditing, setIsHeaderEditing] = useState(false);
    const [headerForm, setHeaderForm] = useState({ name: '', sku: '', qty: 1, uom: 'EA' });

    // Copy state
    const [isCopying, setIsCopying] = useState(false);
    const [copyForm, setCopyForm] = useState({ name: '', sku: '' });
    const [copyLoading, setCopyLoading] = useState(false);

    useEffect(() => {
        const target = document.getElementById('header-portal-target');
        if (target) setHeaderPortal(target);
    }, []);

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
        fetch('/api/skus?limit=0&simple=true&ignoreDate=true')
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

        const payload = { ...recipe, ...updatedData };

        if (typeof payload.sku === 'object' && payload.sku !== null) {
            payload.sku = (payload.sku as any)._id;
        }

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
        confirmDeleteToast('Remove this ingredient?', () => {
            const newItems = [...(recipe?.lineItems || [])];
            newItems.splice(index, 1);
            updateRecipe({ lineItems: newItems });
        });
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
        confirmDeleteToast('Remove this step?', () => {
            const newSteps = [...(recipe?.steps || [])];
            newSteps.splice(index, 1);
            updateRecipe({ steps: newSteps });
        });
    };

    const openHeaderEdit = () => {
        if (!recipe) return;
        setHeaderForm({
            name: recipe.name,
            sku: typeof recipe.sku === 'object' ? recipe.sku._id : recipe.sku,
            qty: recipe.qty,
            uom: recipe.uom
        });
        setIsHeaderEditing(true);
    };

    const saveHeaderEdit = () => {
        if (!headerForm.name || !headerForm.sku) return toast.error("Name and SKU are required");
        updateRecipe({ name: headerForm.name, sku: headerForm.sku, qty: headerForm.qty, uom: headerForm.uom });
        setIsHeaderEditing(false);
    };

    const renderSku = (val: any) => (typeof val === 'object' && val?.name ? val.name : val || '-');
    const skuOptions = skus.map(s => ({ value: s._id, label: s.name }));

    const openCopyModal = () => {
        if (!recipe) return;
        setCopyForm({
            name: `Copy of ${recipe.name}`,
            sku: typeof recipe.sku === 'object' ? recipe.sku._id : recipe.sku
        });
        setIsCopying(true);
    };

    const handleCopy = async () => {
        if (!recipe || !copyForm.name || !copyForm.sku) return toast.error('Name and SKU are required');
        setCopyLoading(true);
        try {
            // Build the new recipe payload with all data from the current recipe
            const payload = {
                name: copyForm.name,
                sku: copyForm.sku,
                qty: recipe.qty,
                uom: recipe.uom,
                notes: recipe.notes || '',
                lineItems: recipe.lineItems?.map((item: any) => ({
                    sku: typeof item.sku === 'object' && item.sku ? item.sku._id : item.sku,
                    qty: item.qty,
                    uom: item.uom
                })) || [],
                steps: recipe.steps?.map((step: any) => ({
                    step: step.step,
                    description: step.description,
                    details: step.details
                })) || []
            };

            const res = await fetch('/api/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newRecipe = await res.json();
                toast.success('Recipe copied successfully!');
                setIsCopying(false);
                router.push(`/warehouse/recipes/${newRecipe._id}`);
            } else {
                toast.error('Failed to copy recipe');
            }
        } catch (e) {
            toast.error('Error copying recipe');
        } finally {
            setCopyLoading(false);
        }
    };

    const handleDelete = () => {
        if (!recipe) return;
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this recipe?</p>
                <p className="text-xs text-gray-400">This action cannot be undone.</p>
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            try {
                                const res = await fetch(`/api/recipes/${recipe._id}`, { method: 'DELETE' });
                                if (res.ok) {
                                    toast.success('Recipe deleted');
                                    router.push('/warehouse/recipes');
                                } else {
                                    toast.error('Failed to delete');
                                }
                            } catch (e) {
                                toast.error('Error deleting recipe');
                            }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
    };

    const getTabCount = (tab: TabType) => {
        if (!recipe) return 0;
        if (tab === 'Ingredients') return recipe.lineItems?.length || 0;
        if (tab === 'Steps') return recipe.steps?.length || 0;
        if (tab === 'Notes') return recipe.notes ? 1 : 0;
        return 0;
    };

    if (loading) return (
        <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
            <div className="text-sm text-muted-foreground animate-pulse">Loading recipe...</div>
        </div>
    );
    if (!recipe) return (
        <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
            <div className="text-sm text-muted-foreground">Recipe not found</div>
        </div>
    );

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
            {/* Header Portal Content */}
            {headerPortal && createPortal(
                <>
                    <button
                        onClick={() => router.back()}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                    </button>
                </>,
                headerPortal
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Recipe Info (30%) */}
                <div className="w-[30%] border-r border-border bg-secondary/30 overflow-y-auto p-4 space-y-4">
                    {/* Recipe Name */}
                    <div className="border border-border rounded-md p-4 bg-background">
                        <div className="flex items-center space-x-2 mb-3">
                            <Beaker className="w-4 h-4 text-primary" />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Recipe</span>
                        </div>
                        <div className="text-sm font-black text-muted-foreground leading-snug">{recipe.name}</div>
                    </div>

                    {/* Product SKU */}
                    <div className="border border-border rounded-md p-4 bg-background">
                        <div className="flex items-center space-x-2 mb-3">
                            <Package className="w-4 h-4 text-primary" />
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Product SKU</span>
                        </div>
                        <div className="text-sm font-bold text-muted-foreground">{renderSku(recipe.sku)}</div>
                    </div>

                    {/* Yield Info */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="border border-border rounded-md p-4 bg-background text-center">
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Yield Qty</div>
                            <div className="text-xl font-black text-muted-foreground font-mono">{recipe.qty}</div>
                        </div>
                        <div className="border border-border rounded-md p-4 bg-background text-center">
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">UOM</div>
                            <div className="text-xl font-black text-muted-foreground uppercase">{recipe.uom}</div>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="border border-border rounded-md p-4 bg-background space-y-3">
                        <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Summary</div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Ingredients</span>
                                <span className="text-xs font-bold text-muted-foreground">{recipe.lineItems?.length || 0}</span>
                            </div>
                            <div className="w-full h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Process Steps</span>
                                <span className="text-xs font-bold text-muted-foreground">{recipe.steps?.length || 0}</span>
                            </div>
                            <div className="w-full h-px bg-border" />
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Has Notes</span>
                                <span className="text-xs font-bold text-muted-foreground">{recipe.notes ? 'Yes' : 'No'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Created Info */}
                    {recipe.createdAt && (
                        <div className="border border-border rounded-md p-4 bg-background space-y-2">
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Created</div>
                            <div className="text-xs text-muted-foreground">
                                {new Date(recipe.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                            {recipe.createdBy && typeof recipe.createdBy === 'object' && (
                                <div className="text-xs text-muted-foreground">
                                    by {recipe.createdBy.firstName} {recipe.createdBy.lastName}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={openCopyModal}
                            className="flex-1 flex items-center justify-center space-x-1.5 h-9 text-[10px] font-bold uppercase tracking-widest rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                        </button>
                        <button
                            onClick={openHeaderEdit}
                            className="flex-1 flex items-center justify-center space-x-1.5 h-9 text-[10px] font-bold uppercase tracking-widest rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={handleDelete}
                            className="flex-1 flex items-center justify-center space-x-1.5 h-9 text-[10px] font-bold uppercase tracking-widest rounded-md border border-red-500/30 text-red-500 hover:text-white hover:bg-red-600 transition-all cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>

                {/* Right Side: Tabs (70%) */}
                <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                    {/* Tabs & Actions */}
                    <div className="px-4 border-b border-border shrink-0 flex items-center justify-between bg-background z-10 h-9">
                        <div className="flex space-x-1 h-full">
                            {TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "px-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5 cursor-pointer",
                                        activeTab === tab
                                            ? "text-foreground border-foreground"
                                            : "text-muted-foreground border-transparent hover:text-foreground"
                                    )}
                                >
                                    <span>{tab}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-none text-[9px] font-bold",
                                        activeTab === tab ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                                    )}>
                                        {getTabCount(tab)}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center space-x-2">
                            {activeTab === 'Ingredients' && (
                                <button
                                    onClick={() => openItemModal()}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-primary text-black hover:bg-primary/90 transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Item</span>
                                </button>
                            )}
                            {activeTab === 'Steps' && (
                                <button
                                    onClick={() => openStepModal()}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-primary text-black hover:bg-primary/90 transition-colors flex items-center space-x-1 shadow-sm cursor-pointer"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Step</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {/* Ingredients Tab */}
                        {activeTab === 'Ingredients' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                        <tr>
                                            {['SKU', 'Qty', 'UOM', 'Actions'].map(col => (
                                                <th key={col} className={cn(
                                                    "px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap",
                                                    col === 'Actions' && "text-right"
                                                )}>
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {recipe.lineItems?.length === 0 && (
                                            <tr><td colSpan={4} className="p-8 text-center text-xs text-muted-foreground">No ingredients added yet.</td></tr>
                                        )}
                                        {recipe.lineItems?.map((item: any, i: number) => (
                                            <tr key={i} className="hover:bg-secondary/30 group transition-colors">
                                                <td className="px-3 py-2 text-xs font-medium text-muted-foreground">{renderSku(item.sku)}</td>
                                                <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{item.qty}</td>
                                                <td className="px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground tracking-wider">{item.uom}</td>
                                                <td className="px-3 py-2 text-right">
                                                    <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => openItemModal(item, i)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => deleteItem(i)} className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Steps Tab */}
                        {activeTab === 'Steps' && (
                            <div className="p-4 space-y-3 animate-in fade-in duration-300">
                                {recipe.steps?.length === 0 && (
                                    <div className="p-8 text-center border border-dashed border-border rounded text-xs text-muted-foreground">No steps defined yet.</div>
                                )}
                                {recipe.steps?.sort((a: any, b: any) => (parseInt(a.step) || 0) - (parseInt(b.step) || 0)).map((step: any, i: number) => (
                                    <div key={i} className="flex gap-4 p-4 rounded-md bg-background border border-border relative group hover:border-primary/30 transition-colors">
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-muted-foreground text-background text-xs font-bold rounded-full shadow-sm">
                                            {step.step}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-muted-foreground text-sm mb-1">{step.description}</div>
                                            <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{step.details || 'No details provided.'}</div>
                                        </div>
                                        <div className="absolute top-3 right-3 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openStepModal(step, i)} className="p-1.5 bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                                            <button onClick={() => deleteStep(i)} className="p-1.5 bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Notes Tab */}
                        {activeTab === 'Notes' && (
                            <div className="p-4 space-y-4 animate-in fade-in duration-300">
                                <textarea
                                    className="w-full px-4 py-3 bg-secondary/30 border border-border rounded-md text-xs text-muted-foreground focus:outline-none focus:bg-background focus:border-primary/30 transition-all min-h-[200px] leading-relaxed placeholder:text-muted-foreground/50"
                                    placeholder="Add general recipe notes here..."
                                    value={recipe.notes || ''}
                                    onChange={(e) => setRecipe({ ...recipe, notes: e.target.value })}
                                />
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => updateRecipe({ notes: recipe.notes })}
                                        className="flex items-center space-x-1.5 px-4 py-2 bg-primary text-black text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
                                    >
                                        <Save className="w-3 h-3" />
                                        <span>Save Notes</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Edit Item Modal */}
            {isEditingItem && currentItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingItem(false)} />
                    <div className="relative bg-background border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-md">
                        <div className="px-4 h-10 border-b border-border flex justify-between items-center bg-secondary/50">
                            <h3 className="font-bold text-xs text-foreground uppercase tracking-widest">{itemMode === 'add' ? 'Add Ingredient' : 'Edit Ingredient'}</h3>
                            <button onClick={() => setIsEditingItem(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Item SKU</label>
                                <SearchableSelect
                                    options={skuOptions}
                                    value={currentItem.sku}
                                    onChange={(val) => setCurrentItem({ ...currentItem, sku: val })}
                                    placeholder="Search item..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Quantity</label>
                                    <input
                                        type="number"
                                        className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground font-mono"
                                        value={currentItem.qty}
                                        onChange={e => setCurrentItem({ ...currentItem, qty: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">UOM</label>
                                    <select
                                        className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground uppercase font-bold appearance-none cursor-pointer"
                                        value={currentItem.uom}
                                        onChange={e => setCurrentItem({ ...currentItem, uom: e.target.value })}
                                    >
                                        {['EA', 'G', 'GAL', 'HR', 'KG', 'L', 'LBS', 'MG', 'ML', 'OZ'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="px-4 h-10 bg-secondary/50 border-t border-border flex items-center justify-end">
                            <button onClick={saveItem} className="px-5 py-1.5 bg-primary text-black text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors cursor-pointer">
                                Save Item
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Step Modal */}
            {isEditingStep && currentStep && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditingStep(false)} />
                    <div className="relative bg-background border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-md">
                        <div className="px-4 h-10 border-b border-border flex justify-between items-center bg-secondary/50">
                            <h3 className="font-bold text-xs text-foreground uppercase tracking-widest">{stepMode === 'add' ? 'Add Step' : 'Edit Step'}</h3>
                            <button onClick={() => setIsEditingStep(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Step Number</label>
                                <input
                                    type="number"
                                    className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground font-mono"
                                    value={currentStep.step}
                                    onChange={e => setCurrentStep({ ...currentStep, step: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Description</label>
                                <input
                                    type="text"
                                    className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground"
                                    placeholder="e.g. Mix ingredients..."
                                    value={currentStep.description}
                                    onChange={e => setCurrentStep({ ...currentStep, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Details</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground min-h-[100px] leading-relaxed"
                                    placeholder="Detailed instructions..."
                                    value={currentStep.details}
                                    onChange={e => setCurrentStep({ ...currentStep, details: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="px-4 h-10 bg-secondary/50 border-t border-border flex items-center justify-end">
                            <button onClick={saveStep} className="px-5 py-1.5 bg-primary text-black text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors cursor-pointer">
                                Save Step
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Header Modal */}
            {isHeaderEditing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsHeaderEditing(false)} />
                    <div className="relative bg-background border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-md">
                        <div className="px-4 h-10 border-b border-border flex justify-between items-center bg-secondary/50">
                            <h3 className="font-bold text-xs text-foreground uppercase tracking-widest">Edit Recipe</h3>
                            <button onClick={() => setIsHeaderEditing(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Recipe Name</label>
                                <input
                                    type="text"
                                    className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground font-medium"
                                    value={headerForm.name}
                                    onChange={e => setHeaderForm({ ...headerForm, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Product SKU</label>
                                <SearchableSelect
                                    options={skuOptions}
                                    value={headerForm.sku}
                                    onChange={(val) => setHeaderForm({ ...headerForm, sku: val })}
                                    placeholder="Search SKU..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Yield Quantity</label>
                                    <input
                                        type="number"
                                        className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground font-mono"
                                        value={headerForm.qty}
                                        onChange={e => setHeaderForm({ ...headerForm, qty: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">UOM</label>
                                    <select
                                        className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground uppercase font-bold appearance-none cursor-pointer"
                                        value={headerForm.uom}
                                        onChange={e => setHeaderForm({ ...headerForm, uom: e.target.value })}
                                    >
                                        {['EA', 'G', 'GAL', 'HR', 'KG', 'L', 'LBS', 'MG', 'ML', 'OZ'].map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="px-4 h-10 bg-secondary/50 border-t border-border flex items-center justify-end">
                            <button onClick={saveHeaderEdit} className="px-5 py-1.5 bg-primary text-black text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors cursor-pointer">
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Copy Recipe Modal */}
            {isCopying && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCopying(false)} />
                    <div className="relative bg-background border border-border shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 rounded-md">
                        <div className="px-4 h-10 border-b border-border flex justify-between items-center bg-secondary/50">
                            <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Copy Recipe</h3>
                            <button onClick={() => setIsCopying(false)} className="text-muted-foreground hover:text-foreground cursor-pointer"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">New Recipe Name</label>
                                <input
                                    type="text"
                                    className="w-full h-9 px-3 bg-background border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-muted-foreground font-medium"
                                    value={copyForm.name}
                                    onChange={e => setCopyForm({ ...copyForm, name: e.target.value })}
                                    placeholder="Enter recipe name..."
                                />
                            </div>
                            <div>
                                <label className="block text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Target SKU</label>
                                <SearchableSelect
                                    options={skuOptions}
                                    value={copyForm.sku}
                                    onChange={(val) => setCopyForm({ ...copyForm, sku: val })}
                                    placeholder="Search SKU..."
                                />
                            </div>
                            <div className="text-[10px] text-muted-foreground/60 leading-relaxed">
                                This will create a new recipe with the same ingredients ({recipe?.lineItems?.length || 0} items), steps ({recipe?.steps?.length || 0}), and notes.
                            </div>
                        </div>
                        <div className="px-4 h-10 bg-secondary/50 border-t border-border flex items-center justify-end">
                            <button
                                onClick={handleCopy}
                                disabled={copyLoading}
                                className="px-5 py-1.5 bg-primary text-black text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                {copyLoading ? 'Copying...' : 'Copy Recipe'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
