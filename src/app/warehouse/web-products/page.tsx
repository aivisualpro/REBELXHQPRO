'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  ArrowUpDown,
  Edit2,
  Trash2,
  Plus,
  X,
  Loader2,
  Package,
  Layers,
  Box,
  Globe
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
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

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedMaterialTypes, setSelectedMaterialTypes] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const variancesInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  const initialFormState = {
    _id: '',
    webId: 0,
    sku_code: '',
    name: '',
    image: '',
    website: '',
    category: '',
    subCategory: '',
    materialType: '',
    uom: '',
    salePrice: 0,
    orderUpto: 0,
    reOrderPoint: 0,
    kitApplied: false,
    isLotApplied: false
  };
  const [formData, setFormData] = useState(initialFormState);

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
    logs: [] as string[],
    isFullSync: false,
    currentSite: '',
    currentProductName: '',
    stats: { added: 0, updated: 0, skipped: 0 },
    fetchingPhase: false,
    fetchingPage: 0,
    fetchingFound: 0,
    fetchingSite: '',
    debug: { logsCount: 0, lastLog: null as string | null }
  });

  const handleSync = async (fullSync = false) => {
    try {
      const url = fullSync 
        ? '/api/retail/web-products/sync?full=true' 
        : '/api/retail/web-products/sync';
      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        toast.success(fullSync ? 'Full sync started' : 'Incremental sync started');
        pollSyncProgress();
      } else {
        const err = await res.json();
        toast.error('Failed to start sync: ' + err.error);
      }
    } catch (e) {
      toast.error('Sync start error');
    }
  };

  const pollSyncProgress = useCallback(async () => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/retail/web-products/sync');
        const data = await res.json();
        setSyncStatus(data);

        if (!data.isSyncing && (data.currentStep === 'Complete' || data.currentStep === 'Failed')) {
          clearInterval(timer);
          if (data.currentStep === 'Complete') {
            toast.success('Sync completed successfully');
            fetchSkus();
          } else {
            toast.error('Sync failed. Check details.');
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    }, 1000);
  }, [fetchSkus]);

  // Check initial sync status
  useEffect(() => {
    fetch('/api/retail/web-products/sync').then(res => res.json()).then(data => {
        if (data.isSyncing) {
            setSyncStatus(data);
            pollSyncProgress();
        }
    });
  }, [pollSyncProgress]);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, endpoint = '/api/skus/import', key = 'skus') => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const loadingToast = toast.loading(`Importing ${key}...`);
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: results.data })
          });
          toast.dismiss(loadingToast);

          if (res.ok) {
            const data = await res.json();
            toast.success(`Imported/Updated ${data.count} items`);
            fetchSkus();
          } else {
            const err = await res.json();
            toast.error('Import failed: ' + err.error);
          }
        } catch (e) {
          toast.error('Import error');
          console.error(e);
        }
      }
    });
  };

  const openModal = (sku?: Sku) => {
    if (sku) {
      setEditingSku(sku);
      setFormData({
        _id: sku._id,
        webId: sku.webId || 0,
        sku_code: (sku as any).sku_code || '',
        name: sku.name,
        image: sku.image || '',
        website: sku.website || '',
        category: sku.category || '',
        subCategory: sku.subCategory || '',
        materialType: sku.materialType || '',
        uom: sku.uom || '',
        salePrice: sku.salePrice || 0,
        orderUpto: sku.orderUpto || 0,
        reOrderPoint: sku.reOrderPoint || 0,
        kitApplied: sku.kitApplied || false,
        isLotApplied: sku.isLotApplied || false
      });
    } else {
      setEditingSku(null);
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingSku ? `/api/retail/web-products/${editingSku._id}` : '/api/retail/web-products';
      const method = editingSku ? 'PATCH' : 'POST';

      const payload = { ...formData };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        toast.success(editingSku ? 'Product updated' : 'Product created');
        fetchSkus();
      } else {
        const err = await res.json();
        toast.error('Error: ' + (err.error || err.message));
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    confirmDeleteToast('Delete this product?', async () => {
      try {
        const res = await fetch(`/api/retail/web-products/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success('Product deleted');
          fetchSkus();
        } else {
          toast.error('Failed to delete');
        }
      } catch (e) {
        toast.error('Delete failed');
      }
    });
  };

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

          <div className="w-px h-6 bg-border mx-2" />

          <button
            onClick={() => handleSync(false)}
            disabled={syncStatus.isSyncing}
            className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded flex items-center space-x-1.5 disabled:opacity-50 border border-border bg-card shadow-sm cursor-pointer"
            title="Incremental Sync - Only changed products"
          >
            {syncStatus.isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-blue-500/70" />}
            <span className="text-[10px] font-bold uppercase tracking-wider">Sync</span>
          </button>
          
          <button
            onClick={() => handleSync(true)}
            disabled={syncStatus.isSyncing}
            className="h-8 px-3 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors rounded flex items-center space-x-1.5 disabled:opacity-50 border border-border bg-card shadow-sm cursor-pointer"
            title="Full Sync - All products from scratch"
          >
            <Globe className="w-4 h-4 text-amber-500/70" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Full</span>
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-8 px-3 bg-card text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border shadow-sm flex items-center space-x-2 rounded cursor-pointer"
            title="Import Products from CSV"
          >
            <Upload className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Import CSV</span>
          </button>

          <button
            onClick={() => openModal()}
            className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all shadow-md flex items-center space-x-2 rounded cursor-pointer"
            title="Add Product"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Add Product</span>
          </button>
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded border border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/50 shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                {editingSku ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <form id="sku-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="Name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} required />
                  <FormInput 
                    label="Website" 
                    value={formData.website} 
                    onChange={v => setFormData({ ...formData, website: v })} 
                    placeholder="e.g. KINGKKRATOM"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormInput label="Web ID (WooCommerce)" type="number" value={formData.webId} onChange={v => setFormData({ ...formData, webId: Number(v) })} required />
                  <FormInput label="Linked SKU Code" value={formData.sku_code} onChange={v => setFormData({ ...formData, sku_code: v })} placeholder="Matches internal SKU" />
                </div>

                <FormInput label="Image URL" value={formData.image} onChange={v => setFormData({ ...formData, image: v })} placeholder="https://..." />

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Category</label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="">Select Category</option>
                      {[
                        "Finished Goods", "High Priority", "Lab Testing", "Maintenance",
                        "Packaging", "Part", "Shipping Category"
                      ].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sub Category</label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground"
                      value={formData.subCategory}
                      onChange={e => setFormData({ ...formData, subCategory: e.target.value })}
                    >
                      <option value="">Select Sub-Category</option>
                      {[
                        "Bags", "Bottle and Lids", "Display Boxes", "Disposable Vape", "Edibles", "Flavors", "Hemp",
                        "Kava", "Kratom", "Kratom Extract", "Kratom Powder", "Labels/Shrink-Bands", "Marketing Material",
                        "Packagings", "R&D (Research and Developement)", "Raw Ingredients", "simple", "variable"
                      ].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Material Type</label>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground"
                      value={formData.materialType}
                      onChange={e => setFormData({ ...formData, materialType: e.target.value })}
                    >
                      <option value="">Select Material Type</option>
                      {[
                        "Bag", "Bottle", "Box", "Capsule", "Clings", "Crystal", "Dropper", "Edible", "Extracts",
                        "Label", "Lid/Top", "Liquid", "Oils", "Postcards", "Posters", "Powder", "Sample Boxes",
                        "Seal", "Shipping Boxes", "Shrinkband", "Smokables", "Stickers", "Suppository", "SWAG",
                        "Table Tents", "Tablets", "Terpenes", "Topicals"
                      ].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">UOM</label>
                    <input
                      list="uom-options"
                      className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground"
                      value={formData.uom}
                      onChange={e => setFormData({ ...formData, uom: e.target.value })}
                      placeholder="Select or Type..."
                    />
                    <datalist id="uom-options">
                      {["Bottle", "Box", "Case", "EA", "Grams", "Hour", "Kg", "Kit", "Liter", "Meter", "Pallet", "Roll"].map(opt => (
                        <option key={opt} value={opt} />
                      ))}
                    </datalist>
                  </div>
                  <FormInput label="Sale Price ($)" type="number" value={formData.salePrice} onChange={v => setFormData({ ...formData, salePrice: Number(v) })} />
                  <FormInput label="Order Upto" type="number" value={formData.orderUpto} onChange={v => setFormData({ ...formData, orderUpto: Number(v) })} />
                  <FormInput label="Re-Order Point" type="number" value={formData.reOrderPoint} onChange={v => setFormData({ ...formData, reOrderPoint: Number(v) })} />
                </div>

                <div className="flex items-center space-x-6 pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-border bg-background transition-all checked:bg-primary"
                        checked={formData.kitApplied}
                        onChange={e => setFormData({ ...formData, kitApplied: e.target.checked })}
                      />
                      <svg className="pointer-events-none absolute h-3 w-3 translate-x-[2px] text-black opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Kit Applied</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer group">
                    <div className="relative flex items-center">
                      <input
                        type="checkbox"
                        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-border bg-background transition-all checked:bg-primary"
                        checked={formData.isLotApplied}
                        onChange={e => setFormData({ ...formData, isLotApplied: e.target.checked })}
                      />
                      <svg className="pointer-events-none absolute h-3 w-3 translate-x-[2px] text-black opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Lot Applied (Traceability)</span>
                  </label>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-secondary/50 shrink-0 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 h-10 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="sku-form"
                disabled={isSubmitting}
                className="px-8 h-10 bg-primary text-black text-[11px] font-black uppercase tracking-widest rounded hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center space-x-3 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{editingSku ? 'Save Changes' : 'Create Product'}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// Helpers
const FormInput = ({ label, value, onChange, type = "text", required = false, placeholder = "" }: { label: string, value: any, onChange: (val: any) => void, type?: string, required?: boolean, placeholder?: string }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label} {required && <span className="text-destructive">*</span>}</label>
    <input
      type={type}
      required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium",
        label.includes('SKU') && required === false && "opacity-50 cursor-not-allowed"
      )}
    />
  </div>
);

