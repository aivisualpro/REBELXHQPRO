'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  ArrowUpDown,
  Edit2,
  Trash2,
  Plus,
  X,
  Loader2,
  Package,
  Layers,
  Box,
  Eye,
  Pencil
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';

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
  variances?: any[];
  currentStock?: number;
  avgCost?: number;
  revenue?: number;
  cogs?: number;
  cogm?: number;
  grossProfit?: number;
  tier?: number;
}

export default function SkusPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-36px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <SkusPageContent />
    </Suspense>
  );
}

function SkusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [skus, setSkus] = useState<Sku[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSkus, setTotalSkus] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filters
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubCategories, setSelectedSubCategories] = useState<string[]>([]);
  const [selectedMaterialTypes, setSelectedMaterialTypes] = useState<string[]>([]);



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
        sortOrder,
      });

      if (selectedCategories.length) params.append('category', selectedCategories.join(','));
      if (selectedSubCategories.length) params.append('subCategory', selectedSubCategories.join(','));
      if (selectedMaterialTypes.length) params.append('materialType', selectedMaterialTypes.join(','));

      const res = await fetch(`/api/skus?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setSkus(data.skus || []);
        setTotalPages(data.totalPages || 1);
        setTotalSkus(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch SKUs');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedCategories, selectedSubCategories, selectedMaterialTypes]);

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

  // Handle createNew URL param
  useEffect(() => {
    if (searchParams.get('createNew') === 'true') {
        openModal();
        // Remove param
        const params = new URLSearchParams(searchParams.toString());
        params.delete('createNew');
        window.history.replaceState(null, '', `?${params.toString()}`);
    }
  }, [searchParams]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
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

      const payload = { ...formData };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        toast.success(editingSku ? 'SKU updated' : 'SKU created');
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
    if (!confirm('Are you sure you want to delete this SKU?')) return;
    try {
      const res = await fetch(`/api/skus/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('SKU deleted');
        fetchSkus();
      } else {
        toast.error('Failed to delete');
      }
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  // Derived options for filters based on current data
  const categoryOptions = Array.from(new Set(skus.map(s => s.category).filter(Boolean))).map(c => ({ label: c, value: c }));
  const subCategoryOptions = Array.from(new Set(skus.map(s => s.subCategory).filter(Boolean))).map(c => ({ label: c, value: c }));
  const materialOptions = Array.from(new Set(skus.map(s => s.materialType).filter(Boolean))).map(c => ({ label: c, value: c }));

  return (
    <div className="flex flex-col h-[calc(100vh-36px)] bg-background relative transition-colors duration-300">
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              {/* Image */}
              <th className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest w-10 border-r border-border">Img</th>
              
              {/* Name + Search + Actions */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="name"
                  title="Name"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  textFilter={search}
                  onTextFilterChange={(_key, value) => { setSearch(value); }}
                  className="text-muted-foreground"
                />
              </th>

              {/* Category */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="category"
                  title="Category"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={categoryOptions}
                  selectedFilters={selectedCategories}
                  onFilterChange={(_key, values) => setSelectedCategories(values)}
                  className="text-muted-foreground"
                />
              </th>

              {/* Sub Category */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="subCategory"
                  title="Sub Cat"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={subCategoryOptions}
                  selectedFilters={selectedSubCategories}
                  onFilterChange={(_key, values) => setSelectedSubCategories(values)}
                  className="text-muted-foreground"
                />
              </th>

              {/* Material */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="materialType"
                  title="Material"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={materialOptions}
                  selectedFilters={selectedMaterialTypes}
                  onFilterChange={(_key, values) => setSelectedMaterialTypes(values)}
                  className="text-muted-foreground"
                />
              </th>

              {/* Sale Price */}
              <th className="border-r border-border">
                <TableColumnHeader column="salePrice" title="Sale Price" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* Cost */}
              <th className="border-r border-border">
                <TableColumnHeader column="avgCost" title="Cost (Avg)" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* Avb Qty */}
              <th className="border-r border-border">
                <TableColumnHeader column="currentStock" title="Avb Qty" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* Re-Ord */}
              <th className="border-r border-border">
                <TableColumnHeader column="reOrderPoint" title="Re-Ord" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* Order Up to */}
              <th className="border-r border-border">
                <TableColumnHeader column="orderUpto" title="Order Up to" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* Revenue */}
              <th className="border-r border-border">
                <TableColumnHeader column="revenue" title="Revenue" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* COGS */}
              <th className="border-r border-border">
                <TableColumnHeader column="cogs" title="COGS" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* COGM */}
              <th className="border-r border-border">
                <TableColumnHeader column="cogm" title="COGM" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>

              {/* Gross Profit */}
              <th className="border-r border-border last:border-0">
                <TableColumnHeader column="grossProfit" title="Gross Profit" currentSortBy={sortBy} currentSortOrder={sortOrder} onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }} className="text-muted-foreground" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={14} className="px-2 py-12 text-center text-[10px] text-slate-400">Loading SKUs...</td></tr>
            ) : error ? (
              <tr><td colSpan={14} className="px-2 py-12 text-center text-red-500 text-[10px] font-bold">{error}</td></tr>
            ) : skus.length === 0 ? (
              <tr><td colSpan={14} className="px-2 py-12 text-center text-[10px] text-slate-400 uppercase font-bold tracking-tighter opacity-50">No SKUs found</td></tr>
            ) : skus.map(sku => (
              <tr 
                key={sku._id} 
                className="group relative z-0 bg-background hover:bg-secondary/40 transition-colors duration-150"
              >
                <td className="px-2 py-1 border-r border-border group-hover:border-l-2 group-hover:border-l-primary transition-all">
                  <div className="w-6 h-6 rounded bg-secondary overflow-hidden relative border border-border">
                    <img 
                        src={sku.image || globalSettings?.missingSkuImage || '/sku-placeholder.png'} 
                        alt="" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            const fallback = globalSettings?.missingSkuImage || '/sku-placeholder.png';
                            if (target.src !== fallback && target.src.indexOf('sku-placeholder.png') === -1) {
                                target.src = fallback;
                            }
                        }} 
                    />
                  </div>
                </td>
                <td className="px-2 py-1 text-[9px] text-foreground font-medium border-r border-border whitespace-nowrap">
                  <div className="flex items-center space-x-1.5">
                    {sku.tier ? (
                      <span className={cn(
                        "flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white shadow-sm",
                        sku.tier === 1 ? "bg-emerald-500" :
                        sku.tier === 2 ? "bg-blue-500" :
                        "bg-orange-500"
                      )} title={`Tier ${sku.tier}`}>
                        {sku.tier}
                      </span>
                    ) : null}
                    <span className="truncate max-w-[180px]" title={sku.name}>{sku.name}</span>
                    
                    {/* Hover Actions */}
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => router.push(`/warehouse/skus/${sku._id}`)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary rounded transition-colors cursor-pointer"
                          title="View SKU"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => openModal(sku)}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary rounded transition-colors cursor-pointer"
                          title="Edit SKU"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-1 text-[8px] uppercase font-bold text-muted-foreground border-r border-border">{sku.category}</td>
                <td className="px-2 py-1 text-[8px] uppercase font-bold text-muted-foreground border-r border-border">{sku.subCategory}</td>
                <td className="px-2 py-1 text-[8px] uppercase font-bold text-muted-foreground border-r border-border">{sku.materialType}</td>
                <td className="px-2 py-1 text-[9px] text-muted-foreground font-mono border-r border-border text-right">${(sku.salePrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-2 py-1 text-[9px] text-muted-foreground font-mono border-r border-border text-right">${(sku.avgCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-2 py-1 text-[9px] font-bold text-foreground border-r border-border text-center">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold",
                    (sku.currentStock || 0) <= (sku.reOrderPoint || 0) ? "bg-destructive/10 text-destructive border border-destructive/20" : "text-foreground"
                  )}>
                    {Math.round(sku.currentStock || 0)}
                  </span>
                </td>
                <td className="px-2 py-1 text-[9px] text-muted-foreground border-r border-border text-center">{sku.reOrderPoint}</td>
                <td className="px-2 py-1 text-[9px] text-muted-foreground border-r border-border text-center">{sku.orderUpto}</td>
                <td className="px-2 py-1 text-[9px] text-emerald-600 font-mono border-r border-border text-right">${(sku.revenue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-2 py-1 text-[9px] text-muted-foreground font-mono border-r border-border text-right">${(sku.cogs || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-2 py-1 text-[9px] text-muted-foreground font-mono border-r border-border text-right">${(sku.cogm || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className="px-2 py-1 text-[9px] font-black text-foreground font-mono text-right border-r border-border last:border-0">${(sku.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
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
          itemName="SKUs"
        />
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                {editingSku ? 'Edit SKU' : 'Add New SKU'}
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
                className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{editingSku ? 'Save Changes' : 'Create SKU'}</span>
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
      readOnly={label.includes('SKU') && required === false} // Make SKU readonly in edit mode if required is false (logic in parent)
      className={cn(
        "w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors",
        label.includes('SKU') && required === false && "opacity-50 cursor-not-allowed"
      )}
    />
  </div>
);
