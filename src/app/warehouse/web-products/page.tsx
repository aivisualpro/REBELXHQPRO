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
    sku: '',
    name: '',
    image: '',
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
        sku: sku._id, // _id is sku
        name: sku.name,
        image: sku.image || '',
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
      const url = editingSku ? `/api/skus/${editingSku._id}` : '/api/skus';
      const method = editingSku ? 'PATCH' : 'POST';

      const payload = { ...formData, isWebProduct: true };

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/skus/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Product deleted');
        fetchSkus();
      } else {
        toast.error('Failed to delete');
      }
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white">
      {syncStatus.isSyncing && (
        <div className="bg-blue-600 px-4 py-1.5 flex items-center justify-between text-white animate-in slide-in-from-top duration-300">
            <div className="flex items-center space-x-3 flex-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-wider">{syncStatus.currentStep}</span>
                {syncStatus.total > 0 && (
                    <div className="flex-1 max-w-xs bg-blue-400 h-1 rounded-full overflow-hidden mx-4">
                        <div 
                            className="bg-white h-full transition-all duration-500" 
                            style={{ width: `${(syncStatus.progress / syncStatus.total) * 100}%` }}
                        />
                    </div>
                )}
            </div>
            <div className="text-[10px] font-mono font-bold">
                {syncStatus.total > 0 ? `${Math.round((syncStatus.progress / syncStatus.total) * 100)}% (${syncStatus.progress}/${syncStatus.total})` : 'Initializing...'}
            </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Web Products</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
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
              { label: 'REBELXBRANDS', value: 'REBELXBRANDS' }
            ]}
            selectedValues={selectedCategories}
            onChange={setSelectedCategories}
          />

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <button
            onClick={() => handleSync(false)}
            disabled={syncStatus.isSyncing}
            className="p-2 text-slate-600 hover:text-black hover:bg-slate-200 transition-colors rounded-sm flex items-center space-x-1 disabled:opacity-50"
            title="Incremental Sync - Only changed products"
          >
            {syncStatus.isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4 text-blue-500" />}
            <span className="text-[10px] font-bold uppercase">Sync</span>
          </button>
          
          <button
            onClick={() => handleSync(true)}
            disabled={syncStatus.isSyncing}
            className="p-2 text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors rounded-sm flex items-center space-x-1 disabled:opacity-50"
            title="Full Sync - All products from scratch"
          >
            <Globe className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] font-bold uppercase">Full</span>
          </button>

          <button
            onClick={() => openModal()}
            className="px-3 py-1.5 bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center space-x-2 rounded-sm"
            title="Add Product"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Add Product</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest w-10">Img</th>
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
                  className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0 whitespace-nowrap"
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2 h-2", sortBy === col.key ? "text-black" : "text-slate-200")} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={11} className="px-2 py-12 text-center text-[10px] text-slate-400">Loading Web Products...</td></tr>
            ) : error ? (
              <tr><td colSpan={11} className="px-2 py-12 text-center text-red-500 text-[10px] font-bold">{error}</td></tr>
            ) : skus.length === 0 ? (
              <tr><td colSpan={11} className="px-2 py-12 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tighter opacity-50">No products found</td></tr>
            ) : skus.map(product => (
              <tr 
                key={product._id} 
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => router.push(`/warehouse/web-products/${product._id}`)}
              >
                <td className="px-2 py-0.5">
                  <div className="w-6 h-6 rounded bg-slate-100 overflow-hidden relative">
                    <img 
                        src={product.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'} 
                        alt="" 
                        className="w-full h-full object-cover"
                    />
                  </div>
                </td>
                <td className="px-2 py-0.5 text-[9px] text-slate-600 font-mono italic">{product.webId || '-'}</td>
                <td className="px-2 py-0.5 max-w-[200px]">
                  <div className="flex flex-col leading-tight">
                    <span className="text-[9px] text-slate-900 font-bold truncate">{product.name}</span>
                  </div>
                </td>
                <td className="px-2 py-0.5 whitespace-nowrap">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter shadow-sm",
                    product.website?.includes('KING') ? "bg-amber-100 text-amber-700 border border-amber-200" :
                    product.website?.includes('GRASS') ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                    "bg-slate-100 text-slate-500"
                  )}>
                    {product.website || 'N/A'}
                  </span>
                </td>
                <td className="px-2 py-0.5 whitespace-nowrap">
                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[7px] font-black uppercase tracking-widest border border-slate-200">
                        {product.type || 'simple'}
                    </span>
                </td>
                <td className="px-2 py-0.5 text-[10px] text-slate-900 font-bold font-mono whitespace-nowrap">
                    ${(product.salePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-2 py-0.5">
                    <span className={cn(
                        "text-[8px] font-black uppercase tracking-widest",
                        product.status === 'publish' ? "text-emerald-500" : "text-slate-400"
                    )}>
                        {product.status}
                    </span>
                </td>
                <td className="px-2 py-0.5">
                    <span className={cn(
                        "px-1.5 py-0.5 rounded-sm text-[8px] font-bold uppercase whitespace-nowrap",
                        product.stockStatus === 'instock' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                        {product.stockStatus === 'instock' ? 'In Stock' : 'Out of Stock'}
                    </span>
                </td>
                <td className="px-2 py-0.5 text-[10px] font-bold text-slate-700 font-mono text-center">
                    {product.stockQuantity || 0}
                </td>
                <td className="px-2 py-0.5 text-[10px] font-bold text-emerald-600 font-mono text-center">
                    {product.totalWebOrders || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalSkus}
        itemsPerPage={20}
        itemName="Products"
      />

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                {editingSku ? 'Edit Product' : 'Add New Product'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <form id="sku-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <FormInput label="Name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} required />
                </div>

                <FormInput label="Image URL" value={formData.image} onChange={v => setFormData({ ...formData, image: v })} placeholder="https://..." />

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Sub Category</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Material Type</label>
                    <select
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase">UOM</label>
                    <input
                      list="uom-options"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
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
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-black border-slate-300 rounded focus:ring-black"
                      checked={formData.kitApplied}
                      onChange={e => setFormData({ ...formData, kitApplied: e.target.checked })}
                    />
                    <span className="text-xs font-bold uppercase text-slate-600">Kit Applied</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-black border-slate-300 rounded focus:ring-black"
                      checked={formData.isLotApplied}
                      onChange={e => setFormData({ ...formData, isLotApplied: e.target.checked })}
                    />
                    <span className="text-xs font-bold uppercase text-slate-600">Lot Applied (Traceability)</span>
                  </label>
                </div>

              </form>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-black hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="sku-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
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
    <label className="text-[10px] font-bold text-slate-500 uppercase">{label} {required && <span className="text-red-500">*</span>}</label>
    <input
      type={type}
      required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors",
        label.includes('SKU') && required === false && "opacity-50 cursor-not-allowed"
      )}
    />
  </div>
);

