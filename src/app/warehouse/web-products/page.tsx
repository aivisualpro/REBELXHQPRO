'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  ArrowUpDown,
  Loader2,
  Package
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';

interface Sku {
  _id: string; // SKU
  name: string;
  image?: string;
  category: string;
  subCategory: string;
  materialType: string;
  uom: string;
  salePrice: number;
  orderUpto: number;
  reOrderPoint: number;
  kitApplied: boolean;
  isLotApplied: boolean;
  isWebProduct: boolean;
  website?: string;
  webId?: number;
  slug?: string;
  permalink?: string;
  type?: string;
  status?: string;
  description?: string;
  shortDescription?: string;
  regularPrice?: number;
  stockQuantity?: number;
  stockStatus?: string;
  webCategories?: any[];
  webImages?: any[];
  webAttributes?: any[];
  variances?: any[];
  currentStock?: number;
  avgCost?: number;
  revenue?: number;
  cogs?: number;
  cogm?: number;
  grossProfit?: number;
  tier?: number;
  totalWebOrders?: number;
}

export default function WebProductsPage() {
  const router = useRouter();
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSkus, setTotalSkus] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('totalWebOrders');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);



  const [globalSettings, setGlobalSettings] = useState<any>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchSkus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search: debouncedSearch,
        sortBy,
        sortOrder
      });

      if (selectedCategories.length) params.append('website', selectedCategories.join(','));

      const res = await fetch(`/api/retail/web-products?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setSkus(data.webProducts || []);
        setTotalPages(data.totalPages || 1);
        setTotalSkus(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch web products');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedCategories]);

  useEffect(() => {
    fetchSkus();
  }, [fetchSkus]);

  // Fetch Global Settings
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setGlobalSettings(data))
      .catch(() => {});
  }, []);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

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
            fetchSkus();
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1000);
  }, [fetchSkus]);

  // Check initial sync status (read-only)
  useEffect(() => {
    fetch('/api/retail/web-products/sync').then(res => res.json()).then(data => {
        if (data.isSyncing) {
            setSyncStatus(data);
            pollSyncProgress();
        }
    }).catch(() => {});
  }, [pollSyncProgress]);



  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300 relative">
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

      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-secondary/50 transition-colors">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter shrink-0">Web Products</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="Category"
            icon={Package}
            options={[
              { label: 'KINGKKRATOM', value: 'KINGKKRATOM' },
              { label: 'GRASSROOTSHARVEST', value: 'GRASSROOTSHARVEST' },
              { label: 'GRHKTATOM', value: 'GRHKTATOM' },
              { label: 'REBELXBRANDS', value: 'REBELXBRANDS' },
              { label: 'GUDTONICS', value: 'GUDTONICS' }
            ]}
            selectedValues={selectedCategories}
            onChange={setSelectedCategories}
            className="h-8"
          />


        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
            <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest w-12 border-r border-border">Img</th>
              {[
                { key: 'webId', label: 'Web ID' },
                { key: '_id', label: 'SKU' },
                { key: 'category', label: 'Website' },
                { key: 'type', label: 'Type' },
                { key: 'salePrice', label: 'Sale Price' },
                { key: 'status', label: 'Status' },
                { key: 'stockStatus', label: 'Stock Status' },
                { key: 'stockQuantity', label: 'Web Stock' },
                { key: 'totalWebOrders', label: 'Total Web Orders' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary transition-colors border-r border-border last:border-0 whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-foreground" : "text-muted-foreground")} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={11} className="px-2 py-12 text-center text-[10px] text-slate-400">Loading Web Products...</td></tr>
            ) : error ? (
              <tr><td colSpan={11} className="px-2 py-12 text-center text-red-500 text-[10px] font-bold">{error}</td></tr>
            ) : skus.length === 0 ? (
              <tr><td colSpan={11} className="px-2 py-12 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tighter opacity-50">No products found</td></tr>
            ) : skus.map(product => (
              <tr 
                key={product._id} 
                className="hover:bg-secondary/40 hover:scale-[1.002] hover:shadow-md transition-all duration-200 group relative z-0 hover:z-10 bg-background cursor-pointer"
                onClick={() => router.push(`/warehouse/web-products/${product._id}`)}
              >
                <td className="px-4 py-1.5 border-r border-border">
                  <div className="w-7 h-7 rounded bg-secondary overflow-hidden relative border border-border">
                    <img 
                        src={product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'} 
                        alt="" 
                        className="w-full h-full object-cover"
                    />
                  </div>
                </td>
                <td className="px-4 py-1.5 text-[9px] text-muted-foreground font-mono italic border-r border-border">{product.webId || '-'}</td>
                <td className="px-4 py-1.5 max-w-[200px] border-r border-border">
                  <div className="flex flex-col leading-tight">
                    <span className="text-[10px] text-foreground font-bold truncate">{product.name}</span>
                  </div>
                </td>
                <td className="px-4 py-1.5 whitespace-nowrap border-r border-border">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm",
                    product.website?.includes('KING') ? "bg-orange-500/10 text-orange-500 border border-orange-500/20" :
                    product.website?.includes('GRASS') ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
                    product.website?.includes('GRHK') ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
                    product.website?.includes('REBEL') ? "bg-purple-500/10 text-purple-500 border border-purple-500/20" :
                    product.website?.includes('GUD') ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {product.website || 'N/A'}
                  </span>
                </td>
                <td className="px-4 py-1.5 whitespace-nowrap border-r border-border">
                    <span className="px-1.5 py-0.5 bg-secondary text-muted-foreground rounded text-[7px] font-black uppercase tracking-widest border border-border">
                        {product.type || 'simple'}
                    </span>
                </td>
                <td className="px-4 py-1.5 text-[11px] text-foreground font-bold font-mono whitespace-nowrap border-r border-border">
                    ${(product.salePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-1.5 border-r border-border">
                    <span className={cn(
                        "text-[9px] font-black uppercase tracking-widest",
                        product.status === 'publish' ? "text-emerald-500" : "text-muted-foreground"
                    )}>
                        {product.status}
                    </span>
                </td>
                <td className="px-4 py-1.5 border-r border-border">
                    <span className={cn(
                        "px-1.5 py-0.5 rounded-sm text-[8px] font-black uppercase whitespace-nowrap tracking-widest",
                        product.stockStatus === 'instock' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-destructive/10 text-destructive border border-destructive/20"
                    )}>
                        {product.stockStatus === 'instock' ? 'In Stock' : 'Out of Stock'}
                    </span>
                </td>
                <td className="px-4 py-1.5 text-[11px] font-bold text-foreground font-mono text-center border-r border-border">
                    {product.stockQuantity || 0}
                </td>
                <td className="px-4 py-1.5 text-[11px] font-bold text-emerald-500 font-mono text-center">
                    {product.totalWebOrders || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

      <div className="border-t border-border bg-background transition-colors duration-300">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalSkus}
          itemsPerPage={20}
          itemName="Products"
        />
      </div>

    </div>
  );
}

