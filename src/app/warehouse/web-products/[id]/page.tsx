'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
    Globe,
    ExternalLink,
    Package,
    Tag,
    Layers,
    Info,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Hash,
    Briefcase,
    ShoppingBag,
    Link2,
    Box,
    Blocks,
    Search,
    Pencil
} from 'lucide-react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { cn, formatDate } from '@/lib/utils';
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
    linkedSkuId?: string;
    linkedSkuName?: string;
    multiplier?: number;
    isArchived?: boolean;
}

const TABS = ['Web Orders', 'Variations', 'Gallery'] as const;
type TabType = typeof TABS[number];

export default function WebProductDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [product, setProduct] = useState<WebProduct | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('Web Orders');
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [variationFilter, setVariationFilter] = useState<number | string | null>(null);

    // SKU Linking State
    const [skuList, setSkuList] = useState<any[]>([]);
    const [linkingSku, setLinkingSku] = useState(false);
    const [linkedSkuId, setLinkedSkuId] = useState<string | null>(null);
    const [refreshLedger, setRefreshLedger] = useState(0);

    const skuOptions = skuList.filter(s => !s.isWebProduct).map(sku => ({
        value: sku._id,
        label: `${sku._id} - ${sku.name}`
    }));

    const getSkuName = (skuId: string, skuName?: string | null) => {
        if (skuName) return skuName;
        const sku = skuList.find(s => s._id === skuId);
        return sku ? sku.name : skuId;
    };

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

    useEffect(() => {
        const fetchSkuList = async () => {
            try {
                const res = await fetch('/api/skus?limit=1000&ignoreDate=true&simple=true');
                const data = await res.json();
                if (res.ok) setSkuList(data.skus || []);
            } catch (e) {
                console.error('Failed to fetch SKU list:', e);
            }
        };
        fetchSkuList();
    }, []);

    useEffect(() => {
        if (product && product.type !== 'variable') {
            setLinkedSkuId(product.linkedSkuId || null);
        }
    }, [product]);

    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);
    useEffect(() => {
        const target = document.getElementById('header-portal-target');
        if (target) setHeaderPortal(target);
    }, [loading]);

    const handleLinkSku = async (skuId: string, variationId?: string | number) => {
        setLinkingSku(true);
        const toastId = toast.loading(skuId ? 'Linking SKU...' : 'Unlinking SKU...');

        const previousProduct = JSON.parse(JSON.stringify(product));
        const newProduct = JSON.parse(JSON.stringify(product));

        if (variationId) {
            const vIndex = newProduct.variations.findIndex((v: any) => v.id === variationId || v._id === variationId);
            if (vIndex !== -1) newProduct.variations[vIndex].linkedSkuId = skuId;
        } else {
            newProduct.linkedSkuId = skuId;
            setLinkedSkuId(skuId);
        }
        setProduct(newProduct);

        try {
            const res = await fetch(`/api/retail/web-products/${id}/link-sku`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ skuId, variationId })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(skuId ? 'SKU linked successfully' : 'SKU unlinked successfully', { id: toastId });
                setRefreshLedger(prev => prev + 1);
            } else {
                setProduct(previousProduct);
                if (!variationId && previousProduct.linkedSkuId) setLinkedSkuId(previousProduct.linkedSkuId);
                toast.error(data.error || 'Failed to update SKU link', { id: toastId });
            }
        } catch (error) {
            setProduct(previousProduct);
            if (!variationId && previousProduct.linkedSkuId) setLinkedSkuId(previousProduct.linkedSkuId);
            toast.error('Error updating SKU link', { id: toastId });
        } finally {
            setLinkingSku(false);
        }
    };

    // Tab counts
    const tabCounts = useMemo(() => {
        if (!product) return { 'Web Orders': 0, 'Variations': 0, 'Gallery': 0 };
        return {
            'Web Orders': product.totalSales || 0,
            'Variations': product.variations?.length || 0,
            'Gallery': product.webImages?.length || 0,
        };
    }, [product]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Loading...</div>
            </div>
        );
    }

    if (!product) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Product not found</div>
            </div>
        );
    }

    const images = product.webImages && product.webImages.length > 0
        ? product.webImages
        : [{ id: 0, src: product.image || '/sku-placeholder.png', name: 'Placeholder', alt: 'Placeholder' }];

    const getWebsiteColor = (website: string) => {
        if (website?.includes('KING')) return 'bg-amber-500';
        if (website?.includes('GRASS')) return 'bg-emerald-500';
        if (website?.includes('GRHK')) return 'bg-cyan-500';
        if (website?.includes('REBEL')) return 'bg-violet-500';
        if (website?.includes('GUD')) return 'bg-rose-500';
        return 'bg-secondary';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
            {/* Header Portal Content — no back button */}
            {headerPortal && product && createPortal(
                <><div /></>,
                headerPortal
            )}

            <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <div className="w-full lg:w-[30%] border-b lg:border-b-0 lg:border-r border-border bg-background flex flex-col overflow-hidden max-h-[40vh] lg:max-h-none">
                    <div className="flex-1 overflow-y-auto scrollbar-custom">
                        {/* Hero Bar: Image | Name */}
                        <div className="px-4 pt-4 pb-4">
                            <div className="flex items-stretch border border-border overflow-hidden">
                                <div className="w-16 h-16 bg-secondary flex items-center justify-center shrink-0 border-r border-border overflow-hidden">
                                    <img
                                        src={images[currentImageIndex].src}
                                        alt={product.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).src = '/sku-placeholder.png'; }}
                                    />
                                </div>
                                <a
                                    href={product.permalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn("flex-1 flex items-center justify-center px-3 min-w-0 transition-colors hover:opacity-90", getWebsiteColor(product.website))}
                                >
                                    <span className="text-sm font-black text-white leading-tight text-center line-clamp-2">{product.name}</span>
                                </a>
                            </div>
                        </div>

                        {/* Status Badge */}
                        <div className="mx-4 mb-4">
                            <div className={cn(
                                "w-full px-3 py-2.5 text-[12px] font-black uppercase tracking-widest text-center border",
                                product.status === 'publish'
                                    ? "bg-emerald-500 text-white border-emerald-600"
                                    : product.status === 'draft'
                                        ? "bg-amber-500 text-white border-amber-600"
                                        : "bg-secondary text-muted-foreground border-border"
                            )}>
                                {product.status?.toUpperCase() || 'UNKNOWN'}
                            </div>
                        </div>

                        {/* Product Info Grid */}
                        <div className="mx-4 mb-4 border border-border">
                            {[
                                [
                                    { label: 'Website', value: product.website || '-' },
                                    { label: 'Web ID', value: product.webId?.toString() || '-' },
                                ],
                                [
                                    { label: 'Type', value: product.type?.toUpperCase() || '-' },
                                    { label: 'Stock Status', value: product.stockStatus?.toUpperCase()?.replace('_', ' ') || '-' },
                                ],
                                [
                                    { label: 'Sale Price', value: `$${(product.salePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                                    { label: 'Regular Price', value: `$${(product.regularPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                                ],
                                [
                                    { label: 'Web Stock', value: product.stockQuantity?.toString() || '0' },
                                    { label: 'Total Sales', value: product.totalSales?.toString() || '0' },
                                ],
                                [
                                    { label: 'Weight', value: product.weight || '-' },
                                    { label: 'Shipping Class', value: product.shippingClass || 'Standard' },
                                ],
                            ].map((row, rowIdx) => (
                                <div key={rowIdx} className={cn(
                                    "grid grid-cols-2 divide-x divide-border",
                                    rowIdx % 2 === 0 ? "bg-background" : "bg-secondary",
                                    rowIdx > 0 && "border-t border-border"
                                )}>
                                    {row.map((item, colIdx) => (
                                        <div key={colIdx} className="px-4 py-3 flex flex-col gap-0.5">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                            <span className="text-sm font-bold text-foreground truncate">{item.value}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>

                        {/* SKU Mapping Section - Simple Products */}
                        {product.type !== 'variable' && (
                            <div className="mx-4 mb-4">
                                <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">SKU Mapping</div>
                                <div className="border border-border">
                                    {linkedSkuId ? (
                                        <div className="px-4 py-3 bg-background flex items-center justify-between">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Linked SKU</span>
                                                <span
                                                    className="text-sm font-bold text-emerald-600 hover:text-emerald-500 cursor-pointer transition-colors"
                                                    onClick={() => router.push(`/warehouse/skus/${linkedSkuId}`)}
                                                >
                                                    {getSkuName(linkedSkuId, product?.linkedSkuName)}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleLinkSku('')}
                                                className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                                title="Unlink SKU"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="px-4 py-3 bg-background">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-2">Link to Physical SKU</span>
                                            <SearchableSelect
                                                options={skuOptions}
                                                value=""
                                                onChange={(value) => { if (value) handleLinkSku(value); }}
                                                placeholder="Search SKU..."
                                                className="w-full"
                                            />
                                        </div>
                                    )}
                                </div>
                                {linkingSku && (
                                    <div className="flex items-center justify-center py-2 mt-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-blue-500 mr-2" />
                                        <span className="text-[9px] text-blue-500 font-bold uppercase">Linking...</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Categories */}
                        <div className="mx-4 mb-4">
                            <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Store Categories</div>
                            <div className="border border-border">
                                {product.webCategories?.map((cat, idx) => (
                                    <div key={cat.id || cat._id || idx} className={cn(
                                        "px-4 py-2.5 flex items-center justify-between",
                                        idx % 2 === 0 ? "bg-background" : "bg-secondary",
                                        idx > 0 && "border-t border-border"
                                    )}>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Category</span>
                                        <span className="text-sm font-bold text-foreground">{typeof cat === 'string' ? cat : (cat.name || 'Unknown')}</span>
                                    </div>
                                ))}
                                {(!product.webCategories || product.webCategories.length === 0) && (
                                    <div className="px-4 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">No categories</div>
                                )}
                            </div>
                        </div>

                        {/* Attributes */}
                        {product.webAttributes && product.webAttributes.length > 0 && (
                            <div className="mx-4 mb-4">
                                <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Product Attributes</div>
                                <div className="border border-border">
                                    {product.webAttributes.map((attr, idx) => (
                                        <div key={attr.id || attr.name} className={cn(
                                            "px-4 py-2.5",
                                            idx % 2 === 0 ? "bg-background" : "bg-secondary",
                                            idx > 0 && "border-t border-border"
                                        )}>
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold block mb-1.5">{attr.name}</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {attr.options?.map(opt => (
                                                    <span key={opt} className="px-2 py-0.5 bg-card text-foreground rounded text-[10px] font-bold border border-border">{opt}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Logistics */}
                        <div className="mx-4 mb-4">
                            <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Logistics</div>
                            <div className="border border-border">
                                {[
                                    { label: 'Dimensions', value: product.dimensions ? `${product.dimensions.length || 0}×${product.dimensions.width || 0}×${product.dimensions.height || 0}` : '-' },
                                    { label: 'Tax Status', value: product.taxStatus || '-' },
                                    { label: 'Visibility', value: product.catalogVisibility || '-' },
                                    { label: 'Featured', value: product.featured ? 'Yes' : 'No' },
                                    { label: 'On Sale', value: product.onSale ? 'Yes' : 'No' },
                                ].map((item, idx) => (
                                    <div key={idx} className={cn(
                                        "px-4 py-2.5 flex items-center justify-between",
                                        idx % 2 === 0 ? "bg-background" : "bg-secondary",
                                        idx > 0 && "border-t border-border"
                                    )}>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                        <span className="text-sm font-bold text-foreground">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sync Intelligence */}
                        <div className="mx-4 mb-4">
                            <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Sync Intelligence</div>
                            <div className="border border-border">
                                {[
                                    { label: 'Created', value: product.dateCreated ? formatDate(product.dateCreated) : '-' },
                                    { label: 'Modified', value: product.dateModified ? formatDate(product.dateModified) : '-' },
                                    { label: 'Instance ID', value: product._id },
                                ].map((item, idx) => (
                                    <div key={idx} className={cn(
                                        "px-4 py-2.5 flex items-center justify-between",
                                        idx % 2 === 0 ? "bg-background" : "bg-secondary",
                                        idx > 0 && "border-t border-border"
                                    )}>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                        <span className="text-sm font-bold text-foreground truncate max-w-[160px] font-mono">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tags */}
                        {product.tags && product.tags.length > 0 && (
                            <div className="mx-4 mb-4">
                                <div className="text-xs font-black uppercase tracking-widest text-foreground mb-3">Tags</div>
                                <div className="flex flex-wrap gap-1.5 px-1">
                                    {product.tags.map((tag, idx) => (
                                        <span key={tag.id || tag._id || idx} className="px-2 py-0.5 bg-secondary text-foreground rounded text-[10px] font-bold border border-border uppercase tracking-tighter">{typeof tag === 'string' ? tag : (tag.name || 'Unknown')}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="h-20" />
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        <a
                            href={product.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-[#fe9900] text-black hover:bg-[#d9a318] transition-colors cursor-pointer"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Live Preview</span>
                        </a>
                    </div>
                </div>

                {/* Right Content: Tabs (70%) */}
                <div className="w-full lg:w-[70%] bg-background flex flex-col overflow-hidden flex-1">
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
                                        {tabCounts[tab]}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center space-x-2">
                            {activeTab === 'Variations' && variationFilter && (
                                <button
                                    onClick={() => setVariationFilter(null)}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                    <span>Clear Filter</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {activeTab === 'Web Orders' && (
                            <RelatedWebOrders
                                productWebId={product.webId}
                                website={product.website}
                                baseProductName={product.name}
                                variationId={variationFilter}
                                refreshLedger={refreshLedger}
                            />
                        )}

                        {activeTab === 'Variations' && (
                            <div className="animate-in fade-in duration-300">
                                <table className="w-full border-collapse text-left">
                                    <thead className="bg-secondary border-y border-border sticky top-0 z-20">
                                        <tr>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Variation</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Linked SKU</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Price</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Stock</th>
                                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(!product.variations || product.variations.length === 0) ? (
                                            <tr>
                                                <td colSpan={5} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">No variations</td>
                                            </tr>
                                        ) : product.variations.map((v, idx) => {
                                            const vid = v.id || v._id;
                                            const isActive = variationFilter === vid;
                                            return (
                                                <tr
                                                    key={vid || idx}
                                                    onClick={() => setVariationFilter(isActive ? null : vid)}
                                                    className={cn(
                                                        "hover:bg-secondary transition-colors cursor-pointer group",
                                                        isActive && "bg-blue-500/10"
                                                    )}
                                                >
                                                    <td className="px-3 py-2">
                                                        <div className="flex items-center space-x-2">
                                                            <div className="w-7 h-7 rounded border border-border bg-background overflow-hidden shrink-0">
                                                                <img src={v.image || product.image || '/sku-placeholder.png'} className="w-full h-full object-cover" alt="" />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="text-[9px] text-muted-foreground font-mono font-bold leading-none mb-0.5">ID-{vid}</span>
                                                                <span className={cn("text-xs font-bold uppercase leading-none truncate max-w-[200px]", isActive ? "text-blue-500" : "text-foreground")}>
                                                                    {v.name.replace(new RegExp(`^${product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*`, 'i'), '')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                                                        {v.linkedSkuId ? (
                                                            <div className="flex items-center space-x-2">
                                                                <span
                                                                    className="text-xs font-black text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded cursor-pointer hover:bg-emerald-500/20 transition-colors"
                                                                    onClick={() => router.push(`/warehouse/skus/${v.linkedSkuId}`)}
                                                                >
                                                                    {getSkuName(v.linkedSkuId, v.linkedSkuName)}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleLinkSku('', vid)}
                                                                    className="p-1 text-muted-foreground hover:text-rose-500 transition-colors"
                                                                    title="Unlink SKU"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <SearchableSelect
                                                                options={skuOptions}
                                                                value={v.linkedSkuId || ''}
                                                                onChange={(value) => { if (value) handleLinkSku(value, vid); }}
                                                                placeholder="Link SKU..."
                                                                className="w-full"
                                                                triggerClassName="h-7 text-xs font-bold rounded border border-dashed bg-rose-500/5 border-rose-500/20 text-rose-500 hover:bg-rose-500/10"
                                                            />
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-bold">
                                                        ${(v.salePrice || v.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <span className={cn("text-xs font-bold font-mono", (v.stockQuantity || 0) > 0 ? "text-foreground" : "text-rose-500")}>
                                                            {v.stockQuantity || 0}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className={cn(
                                                            "px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border",
                                                            v.status === 'publish'
                                                                ? "bg-emerald-600/15 text-emerald-600 border-emerald-500/30"
                                                                : "bg-secondary text-muted-foreground border-border"
                                                        )}>
                                                            {v.status || '-'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {activeTab === 'Gallery' && (
                            <div className="animate-in fade-in duration-300">
                                {images.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Package className="w-8 h-8 text-muted-foreground/30 mb-2" />
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No images</p>
                                    </div>
                                ) : (
                                    <div className="p-4">
                                        {/* Main Image */}
                                        <div className="relative aspect-video bg-secondary border border-border rounded overflow-hidden group mb-4">
                                            <div className="w-full h-full p-8">
                                                <img
                                                    src={images[currentImageIndex].src}
                                                    alt={images[currentImageIndex].alt || product.name}
                                                    className="w-full h-full object-contain"
                                                />
                                            </div>
                                            {images.length > 1 && (
                                                <>
                                                    <button
                                                        onClick={() => setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
                                                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-card text-foreground rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all border border-border"
                                                    >
                                                        <ChevronLeft className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setCurrentImageIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-card text-foreground rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all border border-border"
                                                    >
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Thumbnails */}
                                        <table className="w-full border-collapse text-left">
                                            <thead className="bg-secondary border-y border-border sticky top-0 z-20">
                                                <tr>
                                                    <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap w-[60px]">Image</th>
                                                    <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Name</th>
                                                    <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Alt</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {images.map((img, idx) => (
                                                    <tr
                                                        key={img.id || idx}
                                                        className={cn("hover:bg-secondary transition-colors cursor-pointer", currentImageIndex === idx && "bg-primary/5")}
                                                        onClick={() => setCurrentImageIndex(idx)}
                                                    >
                                                        <td className="px-3 py-2">
                                                            <div className="w-10 h-10 rounded border border-border bg-background overflow-hidden">
                                                                <img src={img.src} alt={img.alt || ''} className="w-full h-full object-cover" />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-xs font-bold text-foreground truncate max-w-[200px]">{img.name || '-'}</td>
                                                        <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-[200px]">{img.alt || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}


// ─── Related Web Orders Component ─────────────────────────────────────────────
function RelatedWebOrders({ productWebId, website, baseProductName, variationId, refreshLedger }: {
    productWebId: number;
    website: string;
    baseProductName: string;
    variationId: number | string | null;
    refreshLedger: number;
}) {
    const router = useRouter();
    const [lineItems, setLineItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [fetchingMore, setFetchingMore] = useState(false);
    const [totalRecords, setTotalRecords] = useState(0);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const loaderRef = useRef<HTMLTableRowElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Lot Selection State
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [availableLots, setAvailableLots] = useState<any[]>([]);
    const [loadingLots, setLoadingLots] = useState(false);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 250);
        return () => clearTimeout(t);
    }, [search]);

    const handleEditLot = async (item: any) => {
        if (!item.linkedSkuId) {
            toast.error('Link a SKU first before selecting a lot.');
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
                setAvailableLots(data.lots || []);
            } else {
                toast.error('Failed to fetch lots');
            }
        } catch (error) {
            toast.error('Error fetching lots');
        } finally {
            setLoadingLots(false);
        }
    };

    const handleSaveLot = async (lotNumber: string) => {
        if (!editingItem) return;
        const notificationId = toast.loading('Updating lot...');
        const previousLineItems = [...lineItems];
        setLineItems(prev => prev.map(item => {
            if (item.lineItemId === editingItem.lineItemId) {
                const selectedLot = availableLots.find(l => l.lotNumber === lotNumber);
                return { ...item, lotNumber, cost: selectedLot ? selectedLot.cost : 0, lotIsSuggested: false };
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
                toast.success('Lot updated', { id: notificationId });
                setLineItems(prev => prev.map(item => {
                    if (item.lineItemId === editingItem.lineItemId) {
                        return { ...item, lotNumber, cost: data.cost, lotIsSuggested: false };
                    }
                    return item;
                }));
            } else {
                setLineItems(previousLineItems);
                toast.error(data.error || 'Failed to update lot', { id: notificationId });
            }
        } catch (error) {
            setLineItems(previousLineItems);
            toast.error('Error updating lot', { id: notificationId });
        }
    };

    // Reset on filter change
    useEffect(() => {
        setPage(1);
        setLineItems([]);
        setHasMore(true);
    }, [productWebId, website, variationId, refreshLedger, debouncedSearch]);

    // Fetch data
    useEffect(() => {
        if (!productWebId) return;
        const controller = new AbortController();
        const fetchLineItems = async () => {
            if (page === 1) setLoading(true);
            else setFetchingMore(true);
            try {
                const params = new URLSearchParams({
                    productId: String(productWebId),
                    website,
                    variationId: variationId ? String(variationId) : '',
                    page: String(page),
                    limit: '30',
                });
                if (debouncedSearch) params.set('search', debouncedSearch);
                const res = await fetch(`/api/retail/web-orders/by-product?${params}`, { signal: controller.signal });
                const data = await res.json();
                if (res.ok) {
                    const newItems = data.lineItems || [];
                    setLineItems(prev => page === 1 ? newItems : [...prev, ...newItems]);
                    setHasMore((page * 30) < data.totalOrders);
                    setTotalRecords(data.totalOrders || 0);
                }
            } catch (e: any) {
                if (e.name !== 'AbortError') console.error('Failed to fetch orders:', e);
            } finally {
                setLoading(false);
                setFetchingMore(false);
            }
        };
        fetchLineItems();
        return () => controller.abort();
    }, [productWebId, website, variationId, page, refreshLedger, debouncedSearch]);

    // Infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !fetchingMore && !loading) {
                setPage(prev => prev + 1);
            }
        }, { threshold: 0.1, root: scrollRef.current });
        if (loaderRef.current) observer.observe(loaderRef.current);
        return () => observer.disconnect();
    }, [hasMore, fetchingMore, loading]);

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'completed': 'bg-emerald-600/15 text-emerald-600 border-emerald-500/30',
            'processing': 'bg-sky-500/15 text-sky-600 border-sky-500/30',
            'on-hold': 'bg-amber-500/15 text-amber-600 border-amber-500/30',
            'pending': 'bg-orange-500/15 text-orange-600 border-orange-500/30',
            'cancelled': 'bg-rose-500/15 text-rose-600 border-rose-500/30',
            'refunded': 'bg-rose-500/15 text-rose-600 border-rose-500/30',
            'failed': 'bg-rose-500/15 text-rose-600 border-rose-500/30',
        };
        const s = styles[status?.toLowerCase()] || 'bg-secondary text-muted-foreground border-border';
        return <span className={cn("px-2 py-0.5 text-[9px] font-black uppercase tracking-wider border rounded-none", s)}>{status || '-'}</span>;
    };

    return (
        <div className="animate-in fade-in duration-300 flex flex-col h-full">
            {/* Search Bar Row */}
            <div className="px-3 py-1.5 border-b border-border bg-background flex items-center gap-3 shrink-0">
                <div className="relative flex items-center">
                    <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-8 pr-3 h-7 w-52 bg-secondary border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
                    />
                </div>
                <div className="flex-1" />
                <div className="flex items-center space-x-2">
                    {fetchingMore && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                    {variationId && (
                        <span className="text-[9px] bg-blue-500/10 text-blue-500 px-1.5 py-0.5 font-black uppercase tracking-widest border border-blue-500/20">Variation Focus</span>
                    )}
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {loading && page === 1 ? 'Loading...' : (
                            <>
                                <span className="text-foreground">{lineItems.length}</span>
                                <span className="mx-1">/</span>
                                <span className="text-foreground">{totalRecords}</span>
                                <span className="ml-1">Records</span>
                            </>
                        )}
                    </span>
                </div>
            </div>

            {/* Table */}
            <div ref={scrollRef} className="flex-1 overflow-auto">
                <table className="w-full border-collapse text-left">
                    <thead className="bg-secondary border-y border-border sticky top-0 z-20">
                        <tr>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Date</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Order #</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Variation</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Lot #</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Customer</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Qty</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Price</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap text-right">Total</th>
                            <th className="px-3 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {loading && page === 1 ? (
                            <tr>
                                <td colSpan={9} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">Loading...</td>
                            </tr>
                        ) : lineItems.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-3 py-6 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                    {variationId ? 'No orders found for this variation' : 'No web orders found'}
                                </td>
                            </tr>
                        ) : (
                            <>
                                {lineItems.map((item, idx) => (
                                    <tr
                                        key={item._id || idx}
                                        onClick={() => router.push(`/sales/web-orders/${item.orderId}`)}
                                        className="hover:bg-secondary transition-colors cursor-pointer group"
                                    >
                                        <td className="px-3 py-2 text-xs text-foreground font-mono font-bold whitespace-nowrap">
                                            {item.orderDate ? formatDate(item.orderDate) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-foreground font-bold">
                                            #{item.orderNumber}
                                        </td>
                                        <td className="px-3 py-2 text-xs font-bold text-foreground truncate max-w-[180px]">
                                            {item.productName ? item.productName.replace(new RegExp(`^${baseProductName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*`, 'i'), '') : '-'}
                                        </td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center space-x-1">
                                                {item.lotNumber ? (
                                                    <span className={cn(
                                                        "text-[10px] font-mono font-bold px-1.5 py-0.5",
                                                        item.lotIsSuggested
                                                            ? "text-amber-600 bg-amber-500/10 border border-amber-500/20"
                                                            : "text-emerald-600 bg-emerald-500/10"
                                                    )}>
                                                        {item.lotIsSuggested && <span className="text-[7px] mr-0.5">★</span>}
                                                        {item.lotNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground bg-secondary italic px-1.5 py-0.5">N/A</span>
                                                )}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleEditLot(item); }}
                                                    className={cn(
                                                        "p-0.5 hover:bg-secondary transition-colors",
                                                        item.linkedSkuId ? "text-muted-foreground hover:text-blue-500" : "text-muted-foreground/30"
                                                    )}
                                                    title={item.linkedSkuId ? "Select Lot" : "Link SKU first"}
                                                >
                                                    <Pencil className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-xs text-foreground font-bold truncate max-w-[120px]" title={item.customer?.email}>
                                            {item.customer?.name || 'Unknown'}
                                        </td>
                                        <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-bold">{item.quantity || 0}</td>
                                        <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-bold">
                                            ${(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2 text-right text-xs text-foreground font-mono font-black bg-secondary">
                                            ${(item.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-3 py-2">
                                            {getStatusBadge(item.orderStatus)}
                                        </td>
                                    </tr>
                                ))}
                                {/* Infinite Scroll Trigger */}
                                <tr ref={loaderRef}>
                                    <td colSpan={9} className="py-4 text-center">
                                        {fetchingMore && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50 mx-auto" />}
                                        {!hasMore && lineItems.length > 0 && (
                                            <span className="text-[8px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">End of Records</span>
                                        )}
                                    </td>
                                </tr>
                            </>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Lot Selection Modal */}
            {editingItem && (
                <LotSelectionModal
                    isOpen={isLotModalOpen}
                    onClose={() => { setIsLotModalOpen(false); setEditingItem(null); }}
                    onSelect={handleSaveLot}
                    skuId={editingItem.linkedSkuId}
                    currentLotNumber={editingItem.lotNumber}
                    title={`Select Lot for Order #${editingItem.orderNumber}`}
                />
            )}
        </div>
    );
}
