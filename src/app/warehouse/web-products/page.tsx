'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import {
  Loader2,
  ChevronRight,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronsDownUp,
  ChevronsUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import toast from 'react-hot-toast';

interface Variation {
  _id?: string;
  id?: number;
  name: string;
  image?: string;
  price?: number;
  regularPrice?: number;
  salePrice?: number;
  stockQuantity?: number;
  stockStatus?: string;
  linkedSkuId?: string | null;
}

interface WebProduct {
  _id: string;
  name: string;
  image?: string;
  category: string;
  subCategory: string;
  materialType: string;
  uom: string;
  salePrice: number;
  website?: string;
  webId?: number;
  type?: string;
  status?: string;
  stockQuantity?: number;
  stockStatus?: string;
  linkedSkuId?: string | null;
  totalWebOrders?: number;
  variations?: Variation[];
}

interface SkuOption {
  value: string;
  label: string;
}

export default function WebProductsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-36px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <WebProductsPageContent />
    </Suspense>
  );
}

function WebProductsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<WebProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sortBy, setSortBy] = useState('totalWebOrders');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Search
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');

  // Header portal
  const [headerPortalTarget, setHeaderPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const target = document.getElementById('header-portal-target');
    if (target) setHeaderPortalTarget(target);
  }, []);

  // Filters
  const [selectedWebsites, setSelectedWebsites] = useState<string[]>([]);

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // SKU list for linking
  const [skuList, setSkuList] = useState<any[]>([]);

  // Linking state
  const [linkingProductId, setLinkingProductId] = useState<string | null>(null);

  const [globalSettings, setGlobalSettings] = useState<any>(null);

  // Debounce search + sync to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
      const params = new URLSearchParams(searchParams.toString());
      if (search) {
        params.set('search', search);
      } else {
        params.delete('search');
      }
      router.replace(`/warehouse/web-products?${params.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      if (selectedWebsites.length) params.append('website', selectedWebsites.join(','));

      const res = await fetch(`/api/retail/web-products?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setProducts(data.webProducts || []);
        setTotalPages(data.totalPages || 1);
        setTotalProducts(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch web products');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedWebsites]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Fetch Global Settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setGlobalSettings(data))
      .catch(() => {});
  }, []);

  // Fetch SKU list for linking
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

  // SKU options for SearchableSelect — show only name, value is the ID
  const skuOptions: SkuOption[] = useMemo(() => {
    return skuList.map((sku: any) => ({
      value: sku._id,
      label: sku.name || sku._id,
    }));
  }, [skuList]);

  // Helper to resolve a linkedSkuId to SKU name
  const getSkuName = useCallback((skuId: string) => {
    const sku = skuList.find((s: any) => s._id === skuId);
    return sku?.name || skuId;
  }, [skuList]);

  // Sync status (read-only)
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    currentStep: '',
    progress: 0,
    total: 0,
  });

  const pollSyncProgress = useCallback(async () => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/retail/web-products/sync');
        const data = await res.json();
        setSyncStatus(data);

        if (!data.isSyncing && (data.currentStep === 'Complete' || data.currentStep === 'Failed')) {
          clearInterval(timer);
          if (data.currentStep === 'Complete') {
            fetchProducts();
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1000);
  }, [fetchProducts]);

  useEffect(() => {
    fetch('/api/retail/web-products/sync').then(res => res.json()).then(data => {
      if (data.isSyncing) {
        setSyncStatus(data);
        pollSyncProgress();
      }
    }).catch(() => {});
  }, [pollSyncProgress]);

  // Derived filter options
  const websiteOptions = [
    { label: 'KINGKKRATOM', value: 'KINGKKRATOM' },
    { label: 'GRASSROOTSHARVEST', value: 'GRASSROOTSHARVEST' },
    { label: 'GRHKTATOM', value: 'GRHKTATOM' },
    { label: 'REBELXBRANDS', value: 'REBELXBRANDS' },
    { label: 'GUDTONICS', value: 'GUDTONICS' },
  ];

  // Toggle row expansion
  const toggleExpand = (productId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  // Expand all / collapse all
  const expandAll = () => {
    const variableIds = products.filter(p => p.type === 'variable' && p.variations && p.variations.length > 0).map(p => p._id);
    setExpandedRows(new Set(variableIds));
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  // Handle SKU linking
  const handleLinkSku = async (productId: string, skuId: string, variationId?: string | number) => {
    setLinkingProductId(productId + (variationId ? `-${variationId}` : ''));
    const toastId = toast.loading(skuId ? 'Linking SKU & updating orders...' : 'Unlinking SKU...');

    // Optimistic update
    setProducts(prev => prev.map(p => {
      if (p._id !== productId) return p;
      const updated = { ...p };
      if (variationId) {
        updated.variations = updated.variations?.map(v => {
          const vid = v.id || v._id;
          if (vid == variationId) return { ...v, linkedSkuId: skuId || null };
          return v;
        });
      } else {
        updated.linkedSkuId = skuId || null;
      }
      return updated;
    }));

    try {
      const res = await fetch(`/api/retail/web-products/${productId}/link-sku`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuId, variationId })
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(
          skuId
            ? `Linked! ${data.ordersUpdated || 0} orders updated`
            : `Unlinked! ${data.ordersUpdated || 0} orders cleared`,
          { id: toastId }
        );
      } else {
        toast.error(data.error || 'Failed to link SKU', { id: toastId });
        fetchProducts(); // revert
      }
    } catch (error) {
      console.error('Link SKU error:', error);
      toast.error('Error linking SKU', { id: toastId });
      fetchProducts(); // revert
    } finally {
      setLinkingProductId(null);
    }
  };

  // Compute link stats
  const linkStats = useMemo(() => {
    let totalLinkable = 0;
    let totalLinked = 0;

    products.forEach(p => {
      if (p.type === 'variable' && p.variations && p.variations.length > 0) {
        totalLinkable += p.variations.length;
        totalLinked += p.variations.filter(v => v.linkedSkuId).length;
      } else {
        totalLinkable++;
        if (p.linkedSkuId) totalLinked++;
      }
    });

    return { totalLinkable, totalLinked, pct: totalLinkable > 0 ? Math.round((totalLinked / totalLinkable) * 100) : 0 };
  }, [products]);

  // Strip parent product name from variation name for cleaner display
  const getVariationLabel = (product: WebProduct, variation: Variation) => {
    const escaped = product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return variation.name.replace(new RegExp(`^${escaped}\\s*-\\s*`, 'i'), '');
  };

  // Render the linked SKU cell content
  const renderSkuCell = (product: WebProduct, variation?: Variation) => {
    const currentLinkedSkuId = variation ? variation.linkedSkuId : product.linkedSkuId;
    const variationId = variation ? (variation.id || variation._id) : undefined;
    const cellKey = product._id + (variationId ? `-${variationId}` : '');
    const isLinking = linkingProductId === cellKey;

    if (isLinking) {
      return (
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span className="text-[9px] text-primary font-bold uppercase tracking-wider">Linking...</span>
        </div>
      );
    }

    // If linked — show clickable SKU name + unlink button
    if (currentLinkedSkuId) {
      return (
        <div className="flex items-center gap-1.5 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
          <span
            className="flex-1 truncate text-[10px] font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded cursor-pointer hover:bg-emerald-500/20 transition-colors"
            onClick={() => router.push(`/warehouse/skus/${currentLinkedSkuId}`)}
            title={`Go to SKU: ${currentLinkedSkuId}`}
          >
            {getSkuName(currentLinkedSkuId)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLinkSku(product._id, '', variationId);
            }}
            className="p-1 rounded hover:bg-rose-500/10 text-rose-400 hover:text-rose-500 transition-colors shrink-0"
            title="Unlink SKU"
          >
            <Unlink className="w-3 h-3" />
          </button>
        </div>
      );
    }

    // If not linked — show SearchableSelect dropdown
    return (
      <div className="flex items-center gap-1.5 min-w-[180px]" onClick={(e) => e.stopPropagation()}>
        <SearchableSelect
          options={skuOptions}
          value=""
          onChange={(value) => handleLinkSku(product._id, value, variationId)}
          placeholder="Link SKU..."
          className="w-full"
          triggerClassName="h-6 text-[10px] rounded border border-dashed transition-all bg-rose-500/5 border-rose-500/20 text-rose-400 hover:bg-rose-500/10"
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-36px)] bg-background relative transition-colors duration-300">
      {/* Sync Status Bar */}
      {syncStatus.isSyncing && (
        <div className="bg-primary px-4 h-10 flex items-center justify-between text-black animate-in slide-in-from-top duration-300 shadow-md relative z-[60]">
          <div className="flex items-center space-x-3 flex-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">{syncStatus.currentStep}</span>
            {syncStatus.total > 0 && (
              <div className="flex-1 max-w-sm bg-black/10 h-1.5 rounded-full overflow-hidden mx-6">
                <div
                  className="bg-black h-full transition-all duration-500"
                  style={{ width: `${(syncStatus.progress / syncStatus.total) * 100}%` }}
                />
              </div>
            )}
          </div>
          <div className="text-[10px] font-black uppercase tracking-widest ml-4">
            {syncStatus.total > 0 ? `${Math.round((syncStatus.progress / syncStatus.total) * 100)}% (${syncStatus.progress}/${syncStatus.total})` : 'Initializing...'}
          </div>
        </div>
      )}

      {/* Header Portal */}
      {headerPortalTarget && createPortal(
        <>
          <input
            type="text"
            placeholder="Search web products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-3 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
          />

          {/* Link Progress Indicator */}
          <div className="flex items-center gap-3 ml-4">
            <div className="flex items-center gap-1.5">
              <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    linkStats.pct === 100 ? "bg-emerald-500" : linkStats.pct > 50 ? "bg-amber-500" : "bg-rose-500"
                  )}
                  style={{ width: `${linkStats.pct}%` }}
                />
              </div>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-wider",
                linkStats.pct === 100 ? "text-emerald-500" : linkStats.pct > 50 ? "text-amber-500" : "text-rose-500"
              )}>
                {linkStats.totalLinked}/{linkStats.totalLinkable} linked
              </span>
            </div>
          </div>

          <div className="flex-1" />

          {/* Expand / Collapse All */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={expandAll}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              title="Expand All"
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
            <button
              onClick={collapseAll}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
              title="Collapse All"
            >
              <ChevronsDownUp className="w-4 h-4" />
            </button>
          </div>
        </>,
        headerPortalTarget
      )}

      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              {/* Name */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="name"
                  title="Name"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>

              {/* Website */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="website"
                  title="Website"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={websiteOptions}
                  selectedFilters={selectedWebsites}
                  onFilterChange={(_key, values) => setSelectedWebsites(values)}
                  className="text-muted-foreground"
                />
              </th>

              {/* Type */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="type"
                  title="Type"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>

              {/* Sale Price */}
              <th className="border-r border-border">
                <TableColumnHeader column="salePrice" title="Price" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground justify-end" />
              </th>

              {/* Linked SKU */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="linkedSkuId"
                  title="Linked SKU"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>

              {/* Total Web Orders */}
              <th className="border-r border-border">
                <TableColumnHeader column="totalWebOrders" title="Orders" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground justify-end" />
              </th>

              {/* Web ID */}
              <th>
                <TableColumnHeader column="webId" title="Web ID" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground justify-end" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={7} className="px-2 py-12 text-center text-[10px] text-slate-400">Loading Web Products...</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="px-2 py-12 text-center text-red-500 text-[10px] font-bold">{error}</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={7} className="px-2 py-12 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tighter opacity-50">No products found</td></tr>
            ) : products.map(product => {
              const isVariable = product.type === 'variable' && product.variations && product.variations.length > 0;
              const isExpanded = expandedRows.has(product._id);

              // Calculate linking coverage for this product
              let linkedCount = 0;
              let totalCount = 0;
              if (isVariable) {
                totalCount = product.variations!.length;
                linkedCount = product.variations!.filter(v => v.linkedSkuId).length;
              } else {
                totalCount = 1;
                linkedCount = product.linkedSkuId ? 1 : 0;
              }
              const allLinked = linkedCount === totalCount;
              const someLinked = linkedCount > 0 && linkedCount < totalCount;

              return (
                <React.Fragment key={product._id}>
                  {/* Parent Row */}
                  <tr
                    className={cn(
                      "group relative z-0 bg-background transition-colors duration-150 cursor-pointer",
                      isExpanded ? "bg-secondary/20" : "hover:bg-secondary/40",
                      allLinked && "border-l-2 border-l-emerald-500",
                      someLinked && !allLinked && "border-l-2 border-l-amber-500",
                      !someLinked && !allLinked && "border-l-2 border-l-rose-500/40",
                    )}
                    onClick={() => {
                      if (isVariable) {
                        toggleExpand(product._id);
                      } else {
                        router.push(`/warehouse/web-products/${product._id}`);
                      }
                    }}
                  >
                    {/* Name */}
                    <td className="px-2 py-1.5 text-[11px] text-foreground font-medium border-r border-border whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        {/* Expand Chevron for variable products */}
                        {isVariable ? (
                          <ChevronRight className={cn(
                            "w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200",
                            isExpanded && "rotate-90 text-primary"
                          )} />
                        ) : (
                          <div className="w-3.5 shrink-0" />
                        )}
                        <div className="w-6 h-6 rounded bg-secondary overflow-hidden relative border border-border flex-shrink-0">
                          <img
                            src={product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-semibold text-foreground truncate" title={product.name}>{product.name}</span>
                          {isVariable && (
                            <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-wider">
                              {linkedCount}/{totalCount} linked
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Website */}
                    <td className="px-2 py-1.5 border-r border-border whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white shadow-sm",
                        product.website?.includes('KING') ? "bg-gradient-to-r from-amber-600 to-orange-500" :
                        product.website?.includes('GRASS') ? "bg-gradient-to-r from-emerald-600 to-green-500" :
                        product.website?.includes('GRHK') ? "bg-gradient-to-r from-sky-600 to-blue-500" :
                        product.website?.includes('REBEL') ? "bg-gradient-to-r from-violet-600 to-purple-500" :
                        product.website?.includes('GUD') ? "bg-gradient-to-r from-rose-600 to-pink-500" :
                        "bg-zinc-500"
                      )}>
                        {product.website || 'N/A'}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="px-2 py-1.5 border-r border-border whitespace-nowrap">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border",
                        product.type === 'variable'
                          ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          : "bg-secondary text-muted-foreground border-border"
                      )}>
                        {product.type || 'simple'}
                      </span>
                      {isVariable && (
                        <span className="ml-1.5 text-[8px] text-muted-foreground font-bold">
                          ({product.variations!.length})
                        </span>
                      )}
                    </td>

                    {/* Sale Price */}
                    <td className="px-2 py-1.5 text-[11px] text-muted-foreground font-mono border-r border-border text-right">
                      ${(product.salePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Linked SKU */}
                    <td className="px-2 py-1.5 border-r border-border">
                      {isVariable ? (
                        <div className="flex items-center gap-1.5">
                          {allLinked ? (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500 uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3" />
                              All Linked
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-amber-500 uppercase tracking-wider">
                              <AlertCircle className="w-3 h-3" />
                              {linkedCount}/{totalCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        renderSkuCell(product)
                      )}
                    </td>

                    {/* Total Web Orders */}
                    <td className="px-2 py-1.5 text-[11px] font-black text-emerald-600 font-mono border-r border-border text-right">
                      {product.totalWebOrders || 0}
                    </td>

                    {/* Web ID */}
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono text-right">
                      {product.webId || '—'}
                    </td>
                  </tr>

                  {/* Variation Sub-Rows */}
                  {isVariable && isExpanded && product.variations!.map((variation, vIdx) => {
                    const vid = variation.id || variation._id;
                    const vLinked = !!variation.linkedSkuId;

                    return (
                      <tr
                        key={`${product._id}-v-${vid || vIdx}`}
                        className={cn(
                          "group bg-secondary/10 transition-colors duration-150",
                          "hover:bg-secondary/30",
                          "animate-in fade-in slide-in-from-top-1 duration-200",
                          vLinked ? "border-l-2 border-l-emerald-500/50" : "border-l-2 border-l-rose-500/20"
                        )}
                        style={{ animationDelay: `${vIdx * 30}ms` }}
                      >
                        {/* Variation Name - indented */}
                        <td className="px-2 py-1 text-[10px] text-muted-foreground border-r border-border whitespace-nowrap">
                          <div className="flex items-center space-x-1.5 pl-5">
                            {/* Tree connector line */}
                            <div className="flex items-center shrink-0 mr-0.5">
                              <div className="w-3 border-b border-border/50 border-l border-l-border/50 h-2.5 rounded-bl-sm" />
                            </div>
                            <Layers className="w-3 h-3 text-blue-400 shrink-0" />
                            <div className="w-5 h-5 rounded bg-secondary overflow-hidden border border-border flex-shrink-0">
                              <img
                                src={variation.image || product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <span className="font-medium text-foreground/80 truncate" title={variation.name}>
                              {getVariationLabel(product, variation)}
                            </span>
                          </div>
                        </td>

                        {/* Website - empty for variations */}
                        <td className="px-2 py-1 border-r border-border" />

                        {/* Type - empty for variations */}
                        <td className="px-2 py-1 border-r border-border">
                          <span className="text-[8px] text-muted-foreground/50 font-bold uppercase tracking-wider">
                            VAR
                          </span>
                        </td>

                        {/* Variation Price */}
                        <td className="px-2 py-1 text-[10px] text-muted-foreground/80 font-mono border-r border-border text-right">
                          ${((variation.salePrice || variation.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Linked SKU - inline linking for each variation */}
                        <td className="px-2 py-1 border-r border-border">
                          {renderSkuCell(product, variation)}
                        </td>

                        {/* Orders - empty for variations */}
                        <td className="px-2 py-1 border-r border-border text-right" />

                        {/* Variation ID */}
                        <td className="px-2 py-1 text-[9px] text-muted-foreground/60 font-mono text-right">
                          {vid || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

      <div className="border-t border-border bg-background transition-colors duration-300">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalProducts}
          itemsPerPage={25}
          itemName="Products"
        />
      </div>

    </div>
  );
}
