'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Globe,
    ExternalLink,
    Package,
    Tag,
    Layers,
    Info,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Eye,
    Hash,
    Briefcase,
    ShoppingBag,
    History,
    Blocks,
    Link2,
    Box
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface WebProduct {
    _id: string;
    webId: number;
    name: string;
    slug: string;
    permalink: string;
    dateCreated?: string;
    dateModified?: string;
    type: string;
    status: string;
    featured?: boolean;
    catalogVisibility?: string;
    description: string;
    shortDescription: string;
    price?: number;
    salePrice: number;
    regularPrice: number;
    onSale?: boolean;
    purchasable?: boolean;
    totalSales?: number;
    virtual?: boolean;
    downloadable?: boolean;
    taxStatus?: string;
    taxClass?: string;
    manageStock?: boolean;
    stockQuantity: number;
    stockStatus: string;
    backorders?: string;
    lowStockAmount?: number;
    soldIndividually?: boolean;
    weight?: string;
    dimensions?: {
        length: string;
        width: string;
        height: string;
    };
    shippingRequired?: boolean;
    shippingTaxable?: boolean;
    shippingClass?: string;
    reviewsAllowed?: boolean;
    averageRating?: string;
    ratingCount?: number;
    upsellIds?: number[];
    crossSellIds?: number[];
    parentId?: number;
    tags?: any[];
    website: string;
    category: string;
    image?: string;
    webCategories: { id?: number; _id?: string; name: string; slug?: string }[];
    webImages: { id: number; src: string; name: string; alt: string; dateCreated?: string; dateModified?: string }[];
    webAttributes: { id: number; name: string; position: number; visible: boolean; variation: boolean; options: string[] }[];
    metaData?: any[];
    variations: any[];
}

export default function WebProductDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [product, setProduct] = useState<WebProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [variationFilter, setVariationFilter] = useState<number | null>(null);

    // SKU Linking State
    const [skuList, setSkuList] = useState<any[]>([]);
    const [linkingSku, setLinkingSku] = useState(false);
    const [linkedSkuId, setLinkedSkuId] = useState<string | null>(null);
    const [refreshLedger, setRefreshLedger] = useState(0);

    const skuOptions = skuList.filter(s => !s.isWebProduct).map(sku => ({
        value: sku._id,
        label: `${sku._id} - ${sku.name}`
    }));

    // Shell Viewport Lock
    useEffect(() => {
        const originalBodyStyle = document.body.style.overflow;
        const originalHtmlStyle = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalBodyStyle;
            document.documentElement.style.overflow = originalHtmlStyle;
        };
    }, []);

    const fetchProduct = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/retail/web-products/${id}`);
            const data = await res.json();
            if (res.ok) {
                setProduct(data);
            } else {
                toast.error(data.error || 'Failed to fetch product');
            }
        } catch (e) {
            toast.error('Connection error');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) fetchProduct();
    }, [id, fetchProduct]);

    // Fetch SKU list for dropdown
    useEffect(() => {
        const fetchSkuList = async () => {
            try {
                const res = await fetch('/api/skus?limit=1000&ignoreDate=true&simple=true');
                const data = await res.json();
                if (res.ok) {
                    setSkuList(data.skus || []);
                }
            } catch (e) {
                console.error('Failed to fetch SKU list:', e);
            }
        };
        fetchSkuList();
    }, []);

    // Set linkedSkuId from product (for simple products)
    useEffect(() => {
        if (product && product.type !== 'variable') {
            setLinkedSkuId((product as any).linkedSkuId || null);
        }
    }, [product]);

    // Handle SKU linking with Optimistic Update
    const handleLinkSku = async (skuId: string, variationId?: string | number) => {
        setLinkingSku(true);
        const toastId = toast.loading(skuId ? 'Linking SKU...' : 'Unlinking SKU...');

        // 1. Optimistic Update
        const previousProduct = JSON.parse(JSON.stringify(product));
        const newProduct = JSON.parse(JSON.stringify(product));
        
        if (variationId) {
             const vIndex = newProduct.variations.findIndex((v: any) => v.id === variationId || v._id === variationId);
             if (vIndex !== -1) {
                 newProduct.variations[vIndex].linkedSkuId = skuId;
             }
        } else {
            newProduct.linkedSkuId = skuId;
            // Also update separate state if used
            setLinkedSkuId(skuId); 
        }
        setProduct(newProduct);

        try {
            const res = await fetch(`/api/retail/web-products/${id}/link-sku`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    skuId, 
                    variationId 
                })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success(skuId ? 'SKU linked successfully' : 'SKU unlinked successfully', { id: toastId });
                // Refresh Ledger data to show linked SKU and suggested lots
                setRefreshLedger(prev => prev + 1);
            } else {
                // Revert on failure
                setProduct(previousProduct);
                if (!variationId && previousProduct.linkedSkuId) setLinkedSkuId(previousProduct.linkedSkuId);
                toast.error(data.error || 'Failed to update SKU link', { id: toastId });
            }
        } catch (error) {
            console.error('Link SKU error:', error);
            // Revert on error
            setProduct(previousProduct);
            if (!variationId && previousProduct.linkedSkuId) setLinkedSkuId(previousProduct.linkedSkuId);
            toast.error('Error updating SKU link', { id: toastId });
        } finally {
            setLinkingSku(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Synchronizing Web Intel...</p>
                </div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-slate-50">
                <Package className="w-12 h-12 text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-400 uppercase">Product not found</p>
                <button onClick={() => router.back()} className="mt-4 text-[10px] font-black uppercase text-blue-600 hover:underline">Go Back</button>
            </div>
        );
    }

    const images = product.webImages && product.webImages.length > 0 
        ? product.webImages 
        : [{ id: 0, src: product.image || '/sku-placeholder.png', name: 'Placeholder', alt: 'Placeholder' }];

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden bg-white">
            {/* Shell Layer 1: Route Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-12 shadow-sm">
                <div className="flex items-center space-x-4">
                    <button onClick={() => router.back()} className="hover:bg-slate-100 transition-colors p-1.5 rounded-full group">
                        <ArrowLeft className="w-4 h-4 text-slate-400 group-hover:text-black" />
                    </button>
                    <div className="flex items-baseline space-x-3">
                        <div className="flex items-center space-x-2">
                             <span className={cn(
                                "flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-black text-white shadow-sm uppercase tracking-widest",
                                product.website?.includes('KING') ? "bg-amber-500" : "bg-emerald-500"
                            )}>{product.website}</span>
                             <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{product.name}</h1>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono italic">WEB-{product.webId}</p>
                    </div>
                </div>
                
                <div className="flex items-center space-x-2">
                    <a 
                        href={product.permalink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 px-3 py-1.5 bg-black text-white rounded text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md group"
                    >
                        <span>Live Preview</span>
                        <ExternalLink className="w-3 h-3 group-hover:scale-110 transition-transform" />
                    </a>
                </div>
            </div>

            {/* Shell Layer 2: Content Split View */}
            <div className="flex-1 flex overflow-hidden min-h-0 bg-white">
                
                {/* Left Column (30%) - Web Identity Sidebar */}
                <aside className="w-[30%] h-full overflow-y-auto border-r border-slate-100 bg-white shrink-0 scrollbar-custom">
                    <div className="p-6">
                        {/* Carousel Section */}
                        <div className="relative aspect-square bg-slate-50 border border-slate-100 border-dashed rounded-xl overflow-hidden group mb-8">
                            <div className="w-full h-full p-4">
                                <img 
                                    src={images[currentImageIndex].src} 
                                    alt={images[currentImageIndex].alt || product.name}
                                    className="w-full h-full object-contain mix-blend-multiply"
                                />
                            </div>
                            
                            {images.length > 1 && (
                                <>
                                    <button 
                                        onClick={() => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/95 text-slate-900 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all border border-slate-100"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setCurrentImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/95 text-slate-900 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all border border-slate-100"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-1.5">
                                        {images.map((_, idx) => (
                                            <div 
                                                key={idx}
                                                className={cn(
                                                    "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                                    idx === currentImageIndex ? "bg-black w-4" : "bg-slate-200"
                                                )}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Financial Header */}
                        <div className="space-y-6 mb-10 pb-10 border-b border-slate-50">
                            <div className="flex flex-col items-center">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Market Placement</label>
                                <div className="flex flex-col items-center">
                                    <span className="text-4xl font-black tracking-tighter text-slate-900">
                                        ${product.salePrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                    {product.regularPrice > product.salePrice && (
                                        <span className="text-[11px] font-mono font-bold text-rose-500 line-through mt-1">
                                            ${product.regularPrice?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* SKU Mapping Section - For Simple Products */}
                        {product.type !== 'variable' && (
                            <div className="mb-10 pb-10 border-b border-slate-50">
                                <section>
                                    <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                        <Link2 className="w-3.5 h-3.5 text-purple-500" />
                                        <span>SKU Mapping</span>
                                    </h3>
                                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100 border-dashed">
                                        <div className="flex flex-col space-y-2">
                                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Link to Physical SKU</label>
                                            <SearchableSelect
                                                options={skuOptions}
                                                value={linkedSkuId || ''}
                                                onChange={(value) => {
                                                    if (value) handleLinkSku(value);
                                                }}
                                                placeholder="Search SKU..."
                                                className="w-full"
                                            />
                                        </div>
                                        {linkedSkuId && (
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">Linked SKU</span>
                                                <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                    {linkedSkuId}
                                                </span>
                                            </div>
                                        )}
                                        {linkingSku && (
                                            <div className="flex items-center justify-center py-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />
                                                <span className="text-[9px] text-blue-500 font-bold uppercase">Linking...</span>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* Detailed Intel Sections */}
                        <div className="space-y-10">
                            {/* Product Variations - Relocated for Priority */}
                            {product.variations && product.variations.length > 0 && (
                                <section>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] flex items-center space-x-2">
                                            <Layers className="w-3.5 h-3.5 text-blue-500" />
                                            <span>Variations</span>
                                        </h3>
                                        {variationFilter && (
                                            <button 
                                                onClick={() => setVariationFilter(null)}
                                                className="text-[8px] font-black text-rose-500 uppercase tracking-widest hover:underline"
                                            >
                                                Clear Filter
                                            </button>
                                        )}
                                    </div>
                                    <div className="border border-slate-100 bg-white rounded-lg shadow-xs overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[500px]">
                                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                                <tr>
                                                    <th className="px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest sticky left-0 bg-slate-50 z-10 w-[120px]">Variation</th>
                                                    <th className="px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest w-[180px]">Linked SKU</th>
                                                    <th className="px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right w-[60px]">Price</th>
                                                    <th className="px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest text-right w-[40px]">Stock</th>
                                                    <th className="px-2 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-widest text-center w-[40px]">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {product.variations.map((v, idx) => (
                                                    <tr 
                                                        key={v._id || v.id || idx} 
                                                        onClick={() => {
                                                            const vid = v.id || v._id;
                                                            setVariationFilter(variationFilter === vid ? null : vid);
                                                        }}
                                                        className={cn(
                                                            "transition-colors cursor-pointer group",
                                                            (variationFilter !== null && variationFilter === (v.id || v._id)) ? "bg-blue-50/50" : "hover:bg-slate-50/50"
                                                        )}
                                                    >
                                                        <td className="px-2 py-1.5 sticky left-0 bg-white group-hover:bg-inherit z-10 shadow-[1px_0_0_0_rgba(241,245,249,1)]">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-6 h-6 rounded border border-slate-100 bg-white overflow-hidden shrink-0">
                                                                    <img src={v.image || '/sku-placeholder.png'} className="w-full h-full object-cover" alt="" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <span className="text-[7px] text-slate-400 font-black font-mono leading-none mb-1">
                                                                        ID-{v.id || v._id?.toString().slice(-5)}
                                                                    </span>
                                                                    <span className={cn(
                                                                        "text-[9px] font-bold uppercase leading-none truncate max-w-[80px]",
                                                                        (variationFilter !== null && variationFilter === (v.id || v._id)) ? "text-blue-600" : "text-slate-700"
                                                                    )}>
                                                                        {v.name.replace(new RegExp(`^${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*`, 'i'), '')}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                                            {v.linkedSkuId ? (
                                                                <div className="flex items-center space-x-2">
                                                                    <button 
                                                                        onClick={() => router.push(`/warehouse/skus/${v.linkedSkuId}`)}
                                                                        className="flex items-center space-x-2 px-2 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors group/sku"
                                                                    >
                                                                        <Package className="w-3 h-3" />
                                                                        <span className="text-[9px] font-bold font-mono">{v.linkedSkuId}</span>
                                                                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/sku:opacity-100 transition-opacity" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => {
                                                                            handleLinkSku('', v.id || v._id);
                                                                        }}
                                                                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                                                                        title="Unlink SKU"
                                                                    >
                                                                        <span className="sr-only">Unlink</span>
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div style={{ width: '100%' }}>
                                                                    <SearchableSelect
                                                                        options={skuOptions}
                                                                        value={v.linkedSkuId || ''}
                                                                        onChange={(value) => {
                                                                            if (value) handleLinkSku(value, v.id || v._id);
                                                                        }}
                                                                        placeholder="Link SKU..."
                                                                        className="w-full text-[9px]"
                                                                    />
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            <span className="text-[9px] font-bold text-slate-900 font-mono">${(v.salePrice || v.price || 0).toLocaleString()}</span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-right">
                                                            <span className={cn(
                                                                "text-[9px] font-bold font-mono",
                                                                (v.stockQuantity || 0) > 0 ? "text-slate-600" : "text-rose-500"
                                                            )}>
                                                                {v.stockQuantity || 0}
                                                            </span>
                                                        </td>
                                                        <td className="px-2 py-1.5 text-center">
                                                            <div className={cn(
                                                                "w-1.5 h-1.5 rounded-full mx-auto",
                                                                v.status === 'publish' ? "bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]" : "bg-slate-300"
                                                            )} title={v.status} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </section>
                            )}
                            {/* Categories */}
                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                    <Tag className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Store Categories</span>
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {product.webCategories?.map((cat, idx) => (
                                        <span key={cat.id || cat._id || idx} className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-[9px] font-black text-slate-600 uppercase tracking-tight shadow-sm">
                                            {typeof cat === 'string' ? cat : (cat.name || 'Unknown')}
                                        </span>
                                    ))}
                                </div>
                            </section>

                            {/* Attributes */}
                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                    <Layers className="w-3.5 h-3.5 text-purple-500" />
                                    <span>Product Variance Specs</span>
                                </h3>
                                <div className="space-y-5 bg-slate-50/50 p-4 rounded-xl border border-slate-100 border-dashed">
                                    {product.webAttributes?.map(attr => (
                                        <div key={attr.id || attr.name} className="space-y-2">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                                <span>{attr.name}</span>
                                                <span className="h-px bg-slate-200 flex-1 ml-4" />
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {attr.options?.map(opt => (
                                                    <span key={opt} className="px-2 py-0.5 bg-white text-slate-900 rounded border border-slate-200 text-[9px] font-bold shadow-xs">
                                                        {opt}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {(!product.webAttributes || product.webAttributes.length === 0) && (
                                        <p className="text-[10px] text-slate-400 italic font-medium">No specialized attributes defined</p>
                                    )}
                                </div>
                            </section>

                            {/* Market & Catalog Intel */}
                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Market Placement</span>
                                </h3>
                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100 border-dashed">
                                    {[
                                        { label: 'Featured', value: product.featured ? 'Yes' : 'No', highlight: product.featured ? 'text-amber-500 font-black' : '' },
                                        { label: 'Visibility', value: product.catalogVisibility },
                                        { label: 'Total Sales', value: product.totalSales || 0 },
                                        { label: 'On Sale', value: product.onSale ? 'Yes' : 'No', highlight: product.onSale ? 'text-rose-500 font-black' : '' },
                                        { label: 'Purchasable', value: product.purchasable ? 'Yes' : 'No' }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[10px]">
                                            <span className="font-bold text-slate-400 uppercase tracking-tighter">{item.label}</span>
                                            <span className={cn("uppercase tracking-tight", item.highlight || "text-slate-900 font-bold")}>
                                                {item.value}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>



                            {/* Logistics & Fulfillment */}
                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                    <Package className="w-3.5 h-3.5 text-orange-500" />
                                    <span>Logistics & Fulfillment</span>
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-[10px] py-1">
                                        <span className="font-bold text-slate-400 uppercase tracking-tighter">Weight</span>
                                        <span className="font-bold text-slate-900 truncate max-w-[100px]">{product.weight || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50">
                                        <span className="font-bold text-slate-400 uppercase tracking-tighter">Dimensions</span>
                                        <span className="font-bold text-slate-900 font-mono">
                                            {product.dimensions?.length || 0}x{product.dimensions?.width || 0}x{product.dimensions?.height || 0}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50">
                                        <span className="font-bold text-slate-400 uppercase tracking-tighter">Shipping Class</span>
                                        <span className="font-bold text-slate-900 uppercase">{product.shippingClass || 'Standard'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] py-1 border-t border-slate-50">
                                        <span className="font-bold text-slate-400 uppercase tracking-tighter">Tax Status</span>
                                        <span className="font-bold text-slate-900 uppercase">{product.taxStatus}</span>
                                    </div>
                                </div>
                            </section>

                            {/* URL Intel */}
                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                    <Globe className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Canonical Intel</span>
                                </h3>
                                <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-100 overflow-hidden">
                                     <p className="text-[9px] font-mono text-blue-600 break-all leading-relaxed uppercase">
                                        {product.permalink}
                                     </p>
                                </div>
                            </section>

                            {/* Short Description */}
                            <section className="space-y-4">
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] flex items-center space-x-2">
                                    <Info className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Editorial Summary</span>
                                </h3>
                                <div 
                                    className="text-[10px] text-slate-500 italic leading-relaxed prose prose-sm prose-slate max-w-none"
                                    dangerouslySetInnerHTML={{ __html: product.shortDescription || 'No summary version available.' }}
                                />
                            </section>

                            {/* Main Description */}
                            <section className="space-y-4">
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] flex items-center space-x-2">
                                    <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Product Documentation</span>
                                </h3>
                                <div 
                                    className="text-[11px] text-slate-700 leading-relaxed prose prose-slate max-w-none prose-p:font-medium prose-p:my-2"
                                    dangerouslySetInnerHTML={{ __html: product.description || 'Global documentation not provided.' }}
                                />
                            </section>

                            {/* Relationships & Clusters */}
                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                    <Blocks className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Product Clusters</span>
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Upsell Cluster</p>
                                        <div className="flex flex-wrap gap-1">
                                            {product.upsellIds?.map(id => (
                                                <span key={id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-bold border border-indigo-100">#{id}</span>
                                            ))}
                                            {(!product.upsellIds || product.upsellIds.length === 0) && <span className="text-[9px] text-slate-300 italic">None defined</span>}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2 mt-3">Tags</p>
                                        <div className="flex flex-wrap gap-1">
                                            {product.tags?.map((tag, idx) => (
                                                <span key={tag.id || tag._id || idx} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-bold border border-slate-200 uppercase tracking-tighter shadow-sm">
                                                    {typeof tag === 'string' ? tag : (tag.name || 'Unknown')}
                                                </span>
                                            ))}
                                            {(!product.tags || product.tags.length === 0) && <span className="text-[9px] text-slate-300 italic">No tags</span>}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.15em] mb-4 flex items-center space-x-2">
                                    <Hash className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Sync Intelligence</span>
                                </h3>
                                <div className="space-y-3 p-3 bg-rose-50/30 rounded-lg border border-rose-100/50">
                                    <div className="flex justify-between text-[9px]">
                                        <span className="font-bold text-slate-400 uppercase">Synced Created</span>
                                        <span className="font-mono text-slate-600 font-medium">
                                            {product.dateCreated ? new Date(product.dateCreated).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[9px] pt-2 border-t border-rose-100/30">
                                        <span className="font-bold text-slate-400 uppercase">Site Modified</span>
                                        <span className="font-mono text-slate-600 font-medium">
                                            {product.dateModified ? new Date(product.dateModified).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </section>

                            <div className="h-20" />
                        </div>
                    </div>
                </aside>

                {/* Right Column: Content Architecture & Descriptions */}
                <main className="flex-1 h-full overflow-y-auto bg-white relative scrollbar-custom">
                    
                    <div className="p-8 max-w-none space-y-12">
                        {/* Related Web Orders */}
                        <RelatedWebOrders productWebId={product.webId} website={product.website} baseProductName={product.name} variationId={variationFilter} refreshLedger={refreshLedger} />
                    </div>
                </main>
            </div>

            {/* Shell Layer 3: Shell Footer */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Global Web Console v3.1</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4 font-mono">
                    <span className="text-[9px] text-slate-300 uppercase tracking-tighter">Instance ID: {product._id}</span>
                </div>
            </div>
        </div>
    );
}

// Related Sale Orders Component - Shows line items from wholesale orders
function RelatedSaleOrders({ skuId }: { skuId: string }) {
    const router = useRouter();
    const [lineItems, setLineItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!skuId) {
            setLoading(false);
            return;
        }

        const fetchLineItems = async () => {
            try {
                const res = await fetch(`/api/sales/orders/by-sku?skuId=${skuId}`);
                const data = await res.json();
                if (res.ok) {
                    setLineItems(data.lineItems || []);
                }
            } catch (e) {
                console.error('Failed to fetch related sale orders:', e);
            } finally {
                setLoading(false);
            }
        };

        fetchLineItems();
    }, [skuId]);

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed': case 'shipped': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'processing': case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'cancelled': return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    if (loading) {
        return (
            <section>
                <div className="flex items-center space-x-4 mb-6">
                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center space-x-2">
                        <Briefcase className="w-4 h-4 text-purple-500" />
                        <span>Related Sales Orders</span>
                    </h3>
                    <div className="h-px bg-slate-100 flex-1" />
                </div>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                </div>
            </section>
        );
    }

    if (lineItems.length === 0) {
        return (
            <section>
                <div className="flex items-center space-x-4 mb-6">
                    <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center space-x-2">
                        <Briefcase className="w-4 h-4 text-purple-500" />
                        <span>Related Sales Orders</span>
                    </h3>
                    <div className="h-px bg-slate-100 flex-1" />
                    <span className="text-[9px] font-bold text-slate-300 uppercase">0 Items</span>
                </div>
                <div className="text-center py-8 text-[10px] text-slate-300 italic">No wholesale orders found for this product</div>
            </section>
        );
    }

    return (
        <section>
            <div className="flex items-center space-x-4 mb-6">
                <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center space-x-2">
                    <Briefcase className="w-4 h-4 text-purple-500" />
                    <span>Related Sales Orders</span>
                </h3>
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-[9px] font-bold text-slate-400 uppercase">{lineItems.length} Items</span>
            </div>
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100">
                        <tr>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Order #</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Date</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Client</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Status</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Lot #</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-center">Qty</th>
                            <th className="px-4 py-3 text-[9px] font-black text-slate-400 uppercase tracking-[0.15em] text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {lineItems.map((item, idx) => (
                            <tr 
                                key={item._id || idx} 
                                className="hover:bg-purple-50/30 transition-colors cursor-pointer group"
                                onClick={() => router.push(`/sales/orders/${item.orderId}`)}
                            >
                                <td className="px-4 py-3">
                                    <span className="text-[11px] font-black text-purple-600 group-hover:text-purple-800">#{item.orderLabel || item.orderId}</span>
                                </td>
                                <td className="px-4 py-3 text-[10px] text-slate-500 font-mono">
                                    {item.orderDate ? new Date(item.orderDate).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-slate-700">
                                            {item.client?.clientName || item.client?.companyName || 'Unknown'}
                                        </span>
                                        {item.client?.email && (
                                            <span className="text-[8px] text-slate-400">{item.client.email}</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                        getStatusColor(item.orderStatus)
                                    )}>
                                        {item.orderStatus || 'Pending'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-[10px] font-mono text-slate-500">{item.lotNumber || '-'}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-[9px] font-black text-purple-700">
                                        {item.qtyShipped || 0}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right text-[11px] font-black text-slate-900 font-mono">
                                    ${(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

// Related Web Orders Component - Shows line items from web orders (Ledger Style)
function RelatedWebOrders({ productWebId, website, baseProductName, variationId, refreshLedger }: { productWebId: number; website: string; baseProductName: string; variationId: number | null; refreshLedger: number }) {
    const router = useRouter();
    const [lineItems, setLineItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [fetchingMore, setFetchingMore] = useState(false);
    const [totalRecords, setTotalRecords] = useState(0);
    const loaderRef = useRef<HTMLTableRowElement>(null);

    // Lot Selection State
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [availableLots, setAvailableLots] = useState<any[]>([]);
    const [loadingLots, setLoadingLots] = useState(false);

    const handleEditLot = async (item: any) => {
        if (!item.linkedSkuId) {
            toast.error('This item has no linked SKU. Please link a SKU in the Variations table above first.');
            return;
        }

        setEditingItem(item);
        setAvailableLots([]);
        setLoadingLots(true);
        setIsLotModalOpen(true);

        try {
            const res = await fetch(`/api/warehouse/skus/${item.linkedSkuId}/lots`);
            if (res.ok) {
                const data = await res.json();
                // Filter lots with > 0 quantity and sort by FIFO (assuming API returns unsorted or we want explicit sort)
                // Actually, API usually returns all lots. Let's show all but highlight available.
                // Sort: Positive qty first, then by date.
                const lots = data.lots || [];
                setAvailableLots(lots);
            } else {
                toast.error('Failed to fetch lots');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error fetching lots');
        } finally {
            setLoadingLots(false);
        }
    };

    const handleSaveLot = async (lotNumber: string) => {
        if (!editingItem) return;

        const notificationId = toast.loading('Updating lot...');
        
        // Optimistic Update
        const previousLineItems = [...lineItems];
        setLineItems(prev => prev.map(item => {
            if (item.lineItemId === editingItem.lineItemId) {
                // We update lotNumber immediately. Cost might need API return unless we have it from lot list.
                // We do have availableLots list, let's try to find cost there for better optimistic UI.
                const selectedLot = availableLots.find(l => l.lotNumber === lotNumber);
                const optimisticCost = selectedLot ? selectedLot.cost : 0;
                
                return { ...item, lotNumber: lotNumber, cost: optimisticCost };
            }
            return item;
        }));

        setIsLotModalOpen(false);
        setEditingItem(null);

        try {
            const res = await fetch(`/api/retail/web-orders/${editingItem.orderId}/line-items/${editingItem.lineItemId}/update-lot`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lotNumber })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('Lot updated successfully', { id: notificationId });
                
                // Update local state with confirmed data (e.g. precise cost from backend logic if different)
                setLineItems(prev => prev.map(item => {
                    if (item.lineItemId === editingItem.lineItemId) {
                        return { ...item, lotNumber: lotNumber, cost: data.cost };
                    }
                    return item;
                }));
            } else {
                // Revert on failure
                setLineItems(previousLineItems);
                toast.error(data.error || 'Failed to update lot', { id: notificationId });
            }
        } catch (error) {
            console.error(error);
            // Revert on error
            setLineItems(previousLineItems);
            toast.error('Error updating lot', { id: notificationId });
        }
    };

    useEffect(() => {
        setPage(1);
        setLineItems([]);
        setHasMore(true);
    }, [productWebId, website, variationId]);

    useEffect(() => {
        if (!productWebId || !hasMore) return;

        const fetchLineItems = async () => {
            if (page === 1) setLoading(true);
            else setFetchingMore(true);

            try {
                const res = await fetch(`/api/retail/web-orders/by-product?productId=${productWebId}&website=${website}&variationId=${variationId || ''}&page=${page}&limit=20`);
                const data = await res.json();
                if (res.ok) {
                    const newItems = data.lineItems || [];
                    setLineItems(prev => page === 1 ? newItems : [...prev, ...newItems]);
                    setHasMore((page * 20) < data.totalOrders);
                    setTotalRecords(data.totalOrders || 0);
                }
            } catch (e) {
                console.error('Failed to fetch related orders:', e);
            } finally {
                setLoading(false);
                setFetchingMore(false);
            }
        };

        fetchLineItems();
    }, [productWebId, website, variationId, page, refreshLedger]);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !fetchingMore && !loading) {
                setPage(prev => prev + 1);
            }
        }, { threshold: 0.1 });

        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }

        return () => observer.disconnect();
    }, [hasMore, fetchingMore, loading]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase">Completed</span>;
            case 'processing': return <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase">Processing</span>;
            case 'on-hold': return <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase">On Hold</span>;
            case 'pending': return <span className="text-yellow-700 bg-yellow-50 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase">Pending</span>;
            case 'cancelled': case 'refunded': case 'failed': return <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase">{status}</span>;
            default: return <span className="text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase">{status || '-'}</span>;
        }
    };

    const filteredItems = lineItems;

    return (
        <section className="-mx-8 -mt-8">
            {/* Toolbar */}
            <div className="sticky top-0 z-[30] bg-white border-b border-slate-100 px-4 h-10 flex items-center justify-between gap-4">
                <div className="flex items-center space-x-2">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Web Orders Ledger</h3>
                    {variationId && (
                        <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest border border-blue-100">
                            Variation Focus
                        </span>
                    )}
                </div>
                <div className="flex items-center space-x-3">
                    {fetchingMore && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {loading && page === 1 ? 'Loading...' : (
                            <>
                                <span className="text-slate-900">{lineItems.length}</span>
                                <span className="mx-1">/</span>
                                <span className="text-slate-900">{totalRecords}</span>
                                <span className="ml-1">Records</span>
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Table Header - Sticky below toolbar */}
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-10 z-[20] bg-slate-50/90 backdrop-blur-sm border-b border-slate-100">
                    <tr>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Date</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Order #</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Variation</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Lot #</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100/50">Customer</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Qty</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Price</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right border-r border-slate-100/50">Total</th>
                        <th className="px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {loading && page === 1 ? (
                        <tr>
                            <td colSpan={9} className="px-3 py-8 text-center">
                                <Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" />
                            </td>
                        </tr>
                    ) : filteredItems.length === 0 ? (
                        <tr>
                            <td colSpan={9} className="px-3 py-8 text-center text-[10px] text-slate-300 italic">
                                {variationId ? 'No orders found for this variation' : 'No web orders found for this product'}
                            </td>
                        </tr>
                    ) : (
                        <>
                            {filteredItems.map((item, idx) => (
                                <tr
                                    key={item._id || idx}
                                    onClick={() => router.push(`/sales/web-orders/${item.orderId}`)}
                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                >
                                    <td className="px-3 py-2 text-[10px] text-slate-500 font-mono">
                                        {item.orderDate ? new Date(item.orderDate).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit', day: '2-digit' }) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 truncate max-w-[80px]">
                                        #{item.orderNumber}
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex flex-col leading-tight">
                                            <span className="text-[9px] text-slate-700 font-bold uppercase tracking-tight line-clamp-2 max-w-[180px]">
                                                {item.productName.replace(new RegExp(`^${baseProductName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*`, 'i'), '')}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center space-x-2">
                                            <span className={cn(
                                                "text-[9px] font-mono px-1.5 py-0.5 rounded-sm line-clamp-1 max-w-[80px]",
                                                item.lotNumber ? "text-emerald-700 bg-emerald-50" : "text-slate-400 bg-slate-50 italic"
                                            )}>
                                                {item.lotNumber || 'N/A'}
                                            </span>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditLot(item);
                                                }}
                                                className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors"
                                                title="Select Lot"
                                            >
                                                <Layers className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 text-[10px] text-slate-600 truncate max-w-[120px]" title={item.customer?.email}>
                                        {item.customer?.name || 'Unknown'}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-sm text-rose-700 bg-rose-50">
                                            -{item.quantity || 0}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-right text-[10px] text-slate-600 font-mono">
                                        ${(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2 text-right text-[10px] font-bold text-slate-900 font-mono">
                                        ${(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-3 py-2">
                                        {getStatusBadge(item.orderStatus)}
                                    </td>
                                </tr>
                            ))}
                            {/* Infinite Scroll Trigger */}
                            <tr ref={loaderRef}>
                                <td colSpan={8} className="py-4 text-center">
                                    {fetchingMore && <Loader2 className="w-4 h-4 animate-spin text-slate-300 mx-auto" />}
                                    {!hasMore && filteredItems.length > 0 && (
                                        <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em]">End of Records</span>
                                    )}
                                </td>
                            </tr>
                        </>
                    )}
                </tbody>
            </table>

            {/* Lot Selection Modal */}
            {editingItem && (
                <LotSelectionModal
                    isOpen={isLotModalOpen}
                    onClose={() => {
                        setIsLotModalOpen(false);
                        setEditingItem(null);
                    }}
                    onSelect={handleSaveLot}
                    skuId={editingItem.linkedSkuId}
                    currentLotNumber={editingItem.lotNumber}
                    title={`Select Lot for Order #${editingItem.orderNumber}`}
                />
            )}
        </section>
    );
}
