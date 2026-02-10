'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft, 
  Save, 
  Factory, 
  Calendar, 
  Layers, 
  AlertCircle,
  X
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
    const [priority, setPriority] = useState('Normal');
    
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
                    fetch('/api/skus?limit=0&ignoreDate=true&simple=true'),
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
            // Build line items from recipe ingredients
            const selectedRecipe = recipes.find((r: any) => r._id === recipeId);
            const recipeLineItems = selectedRecipe?.lineItems?.map((item: any) => ({
                sku: typeof item.sku === 'object' && item.sku ? item.sku._id : item.sku,
                uom: item.uom || '',
                recipeQty: item.qty || 0,
                recipeId: recipeId || undefined,
            })) || [];

            const payload = {
                sku,
                recipesId: recipeId || undefined,
                qty,
                uom,
                scheduledStart: scheduledStart || undefined,
                scheduledFinish: scheduledFinish || undefined,
                priority,
                status: 'Pending',
                createdBy: (session?.user as any)?.id || session?.user?.email,
                createdAt: new Date().toISOString(),
                lineItems: recipeLineItems,
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

    const handleClose = () => {
        router.push('/warehouse/manufacturing');
    };

    const skuOptions = skus.map(s => ({ value: s._id, label: s.name }));
    const filteredRecipes = recipes.filter(r => r.sku?._id === sku || r.sku === sku);
    const recipeOptions = filteredRecipes.map(r => ({ value: r._id, label: r.name }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={handleClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-2xl mx-4 bg-background border border-border shadow-2xl rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30 shrink-0">
                    <div className="flex items-center space-x-3">
                        <Factory className="w-4 h-4 text-muted-foreground" />
                        <h2 className="text-sm font-bold text-foreground uppercase tracking-tight">Create Manufacturing Order</h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <>
                        {/* Scrollable Form Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-custom">
                            <form id="new-mfg-form" onSubmit={handleSubmit} className="space-y-5">
                                
                                {/* Section: SKU & Recipe */}
                                <div className="bg-secondary/20 border border-border rounded-md p-4 space-y-4">
                                    <div className="flex items-center space-x-2 border-b border-border pb-2 mb-3">
                                        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                        <h3 className="text-[10px] font-black uppercase text-foreground tracking-widest">Product Details</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Target SKU <span className="text-destructive">*</span></label>
                                            <SearchableSelect
                                                options={skuOptions}
                                                value={sku}
                                                onChange={handleSkuChange}
                                                placeholder="Select SKU"
                                                triggerClassName="rounded-md border-border h-9 bg-background"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Manufacturing Recipe</label>
                                            <SearchableSelect
                                                options={recipeOptions}
                                                value={recipeId}
                                                onChange={setRecipeId}
                                                placeholder={sku ? (recipeOptions.length > 0 ? "Select recipe" : "No recipes found") : "Select SKU first"}
                                                triggerClassName="rounded-md border-border h-9 bg-background"
                                            />
                                            {sku && recipeOptions.length === 0 && (
                                                <p className="text-[9px] text-amber-500 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    No recipe found for this SKU. You can still create the order.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Quantity & Identification */}
                                <div className="bg-secondary/20 border border-border rounded-md p-4">
                                    <div className="flex items-center space-x-2 border-b border-border pb-2 mb-3">
                                        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                        <h3 className="text-[10px] font-black uppercase text-foreground tracking-widest">Quantity & Tracking</h3>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Planned Quantity <span className="text-destructive">*</span></label>
                                            <input
                                                type="number"
                                                value={qty || ''}
                                                onChange={e => setQty(parseFloat(e.target.value) || 0)}
                                                className="w-full h-9 px-3 border border-border rounded-md text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                                                placeholder="0.00"
                                                required
                                                min="0.01"
                                                step="any"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">UOM</label>
                                            <input
                                                type="text"
                                                value={uom}
                                                onChange={e => setUom(e.target.value)}
                                                className="w-full h-9 px-3 border border-border rounded-md text-sm bg-secondary text-muted-foreground focus:outline-none"
                                                placeholder="Unit of measure"
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Section: Scheduling & Priority */}
                                <div className="bg-secondary/20 border border-border rounded-md p-4">
                                    <div className="flex items-center space-x-2 border-b border-border pb-2 mb-3">
                                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                                        <h3 className="text-[10px] font-black uppercase text-foreground tracking-widest">Scheduling</h3>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Scheduled Start</label>
                                            <input
                                                type="datetime-local"
                                                value={scheduledStart}
                                                onChange={e => setScheduledStart(e.target.value)}
                                                className="w-full h-9 px-3 border border-border rounded-md text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Scheduled Finish</label>
                                            <input
                                                type="datetime-local"
                                                value={scheduledFinish}
                                                onChange={e => setScheduledFinish(e.target.value)}
                                                className="w-full h-9 px-3 border border-border rounded-md text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Priority</label>
                                            <select
                                                value={priority}
                                                onChange={e => setPriority(e.target.value)}
                                                className="w-full h-9 px-3 border border-border rounded-md text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 appearance-none transition-colors cursor-pointer"
                                            >
                                                <option value="Normal">Normal</option>
                                                <option value="High">High</option>
                                                <option value="Extreme">Extreme</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                            </form>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end space-x-3 px-5 py-3 border-t border-border bg-secondary/30 shrink-0">
                            <button
                                onClick={handleClose}
                                className="px-4 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                form="new-mfg-form"
                                type="submit"
                                disabled={submitting}
                                className={cn(
                                    "flex items-center space-x-2 px-5 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 cursor-pointer",
                                    submitting && "cursor-not-allowed"
                                )}
                            >
                                <Save className="w-3.5 h-3.5" />
                                <span>{submitting ? 'Creating...' : 'Create Order'}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
