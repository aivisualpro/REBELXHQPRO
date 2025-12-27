'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft, 
  Save, 
  Factory, 
  BookOpen, 
  Calendar, 
  Layers, 
  AlertCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function NewManufacturingOrderPage() {
    const router = useRouter();
    const { data: session } = useSession();
    
    // Form State
    const [sku, setSku] = useState('');
    const [recipeId, setRecipeId] = useState('');
    const [qty, setQty] = useState<number>(0);
    const [uom, setUom] = useState('');
    const [scheduledStart, setScheduledStart] = useState('');
    const [scheduledFinish, setScheduledFinish] = useState('');
    const [priority, setPriority] = useState('Medium');
    const [label, setLabel] = useState('');
    
    // Data Options
    const [skus, setSkus] = useState<any[]>([]);
    const [recipes, setRecipes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [skusRes, recipesRes] = await Promise.all([
                    fetch('/api/skus?limit=0&ignoreDate=true'),
                    fetch('/api/recipes?limit=0')
                ]);
                
                if (!skusRes.ok || !recipesRes.ok) throw new Error('Failed to fetch data');
                
                const skusData = await skusRes.json();
                const recipesData = await recipesRes.json();
                
                setSkus(skusData.skus || []);
                setRecipes(recipesData.recipes || []);
            } catch (error) {
                toast.error('Error loading form data');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Selection Handlers
    const handleSkuChange = (skuId: string) => {
        setSku(skuId);
        const selectedSku = skus.find(s => s._id === skuId);
        if (selectedSku) {
            setUom(selectedSku.uom || 'ea');
        }
        
        // Reset recipe if SKU changes
        const matchingRecipes = recipes.filter(r => r.sku?._id === skuId || r.sku === skuId);
        if (matchingRecipes.length === 0) {
            setRecipeId('');
        } else if (matchingRecipes.length === 1) {
            setRecipeId(matchingRecipes[0]._id);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sku) return toast.error('Please select a SKU');
        if (qty <= 0) return toast.error('Quantity must be greater than 0');

        setSubmitting(true);
        try {
            const payload = {
                sku,
                recipesId: recipeId || undefined,
                qty,
                uom,
                scheduledStart: scheduledStart || undefined,
                scheduledFinish: scheduledFinish || undefined,
                priority,
                label,
                status: 'Draft',
                createdBy: (session?.user as any)?.id || session?.user?.email, // Fallback if id not available
                createdAt: new Date().toISOString(),
                // Initialize empty arrays if needed
                lineItems: [],
                notes: [],
                labor: []
            };

            const res = await fetch('/api/manufacturing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to create order');
            }

            const newOrder = await res.json();
            toast.success('Manufacturing order created');
            router.push(`/warehouse/manufacturing/${newOrder._id}`);
        } catch (error: any) {
            toast.error(error.message || 'Error creating order');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-white"><LoadingSpinner /></div>;

    const skuOptions = skus.map(s => ({ value: s._id, label: s.name }));
    const filteredRecipes = recipes.filter(r => r.sku?._id === sku || r.sku === sku);
    const recipeOptions = filteredRecipes.map(r => ({ value: r._id, label: r.name }));

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-white overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-10 shadow-sm">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => router.push('/warehouse/manufacturing')}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Create Manufacturing Order</h1>
                </div>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => router.push('/warehouse/manufacturing')}
                        className="px-3 py-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        form="new-mfg-form"
                        type="submit"
                        disabled={submitting}
                        className={cn(
                            "flex items-center space-x-2 px-4 py-1.5 bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shadow-sm disabled:bg-slate-300",
                            submitting && "cursor-not-allowed opacity-70"
                        )}
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span>{submitting ? 'Creating...' : 'Create Order'}</span>
                    </button>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-8 scrollbar-custom">
                <div className="max-w-4xl mx-auto">
                    <form id="new-mfg-form" onSubmit={handleSubmit} className="space-y-6">
                        
                        {/* Section: SKU & Recipe */}
                        <div className="bg-white border border-slate-200 p-6 space-y-6">
                            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-6">
                                <Factory className="w-4 h-4 text-slate-400" />
                                <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Product Details</h3>
                            </div>

                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Target SKU <span className="text-red-500">*</span></label>
                                    <SearchableSelect
                                        options={skuOptions}
                                        value={sku}
                                        onChange={handleSkuChange}
                                        placeholder="Select SKU"
                                        triggerClassName="rounded-none border-slate-200 h-10"
                                        required
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Manufacturing Recipe</label>
                                    <SearchableSelect
                                        options={recipeOptions}
                                        value={recipeId}
                                        onChange={setRecipeId}
                                        placeholder={sku ? (recipeOptions.length > 0 ? "Select recipe" : "No recipes found") : "Select SKU first"}
                                        triggerClassName="rounded-none border-slate-200 h-10"
                                    />
                                    {sku && recipeOptions.length === 0 && (
                                        <p className="text-[9px] text-orange-500 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            No recipe found for this SKU. You can still create the order.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Section: Quantity & Identification */}
                        <div className="bg-white border border-slate-200 p-6">
                            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-6">
                                <Layers className="w-4 h-4 text-slate-400" />
                                <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Quantity & Tracking</h3>
                            </div>

                            <div className="grid grid-cols-3 gap-8">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Work Order Label (Optional)</label>
                                    <input
                                        type="text"
                                        value={label}
                                        onChange={e => setLabel(e.target.value)}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-none text-sm focus:outline-none focus:border-black/20"
                                        placeholder="e.g. BATCH-2023-001"
                                    />
                                    <p className="text-[8px] text-slate-400">If blank, an ID will be generated</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Planned Quantity <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        value={qty || ''}
                                        onChange={e => setQty(parseFloat(e.target.value) || 0)}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-none text-sm focus:outline-none focus:border-black/20"
                                        placeholder="0.00"
                                        required
                                        min="0.01"
                                        step="any"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">UOM</label>
                                    <input
                                        type="text"
                                        value={uom}
                                        onChange={e => setUom(e.target.value)}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-none text-sm bg-slate-50 text-slate-500 focus:outline-none"
                                        placeholder="Unit of measure"
                                        readOnly
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section: Scheduling & Priority */}
                        <div className="bg-white border border-slate-200 p-6">
                            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 mb-6">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <h3 className="text-[11px] font-black uppercase text-slate-800 tracking-widest">Scheduling</h3>
                            </div>

                            <div className="grid grid-cols-3 gap-8">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Scheduled Start</label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledStart}
                                        onChange={e => setScheduledStart(e.target.value)}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-none text-xs focus:outline-none focus:border-black/20"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Scheduled Finish</label>
                                    <input
                                        type="datetime-local"
                                        value={scheduledFinish}
                                        onChange={e => setScheduledFinish(e.target.value)}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-none text-xs focus:outline-none focus:border-black/20"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Priority</label>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value)}
                                        className="w-full h-10 px-3 border border-slate-200 rounded-none text-xs focus:outline-none focus:border-black/20 appearance-none bg-white"
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                    </form>
                </div>
            </div>
        </div>
    );
}
