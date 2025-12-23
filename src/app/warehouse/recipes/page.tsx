'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search,
  Upload,
  ArrowUpDown,
  Plus,
  Filter,
  MoreHorizontal,
  X,
  Trash2,
  Copy,
  Edit2
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface Recipe {
  _id: string;
  name: string;
  sku: { _id: string; name: string } | string;
  qty: number;
  uom: string;
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
  lineItems: any[];
  steps: any[];
}

interface Sku {
  _id: string;
  name: string;
}

export default function RecipesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter State
  const [search, setSearch] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedSkuFilter, setDebouncedSkuFilter] = useState('');
  const [debouncedCreatedByFilter, setDebouncedCreatedByFilter] = useState('');

  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // --- Modal & Actions State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'copy'>('create');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [formData, setFormData] = useState({ name: '', sku: '', qty: 1, uom: 'EA' });

  const [skus, setSkus] = useState<Sku[]>([]);
  const [saving, setSaving] = useState(false);

  // Refs for Import
  const importRecipeRef = useRef<HTMLInputElement>(null);
  const importLineItemsRef = useRef<HTMLInputElement>(null);
  const importStepsRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedSkuFilter(skuFilter);
      setDebouncedCreatedByFilter(createdByFilter);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, skuFilter, createdByFilter]);

  useEffect(() => {
    fetchRecipes();
  }, [page, debouncedSearch, debouncedSkuFilter, debouncedCreatedByFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (isModalOpen) fetchSkus();
  }, [isModalOpen]);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: debouncedSearch,
        sortBy,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
      });
      if (debouncedSkuFilter) params.append('sku', debouncedSkuFilter);
      if (debouncedCreatedByFilter) params.append('createdBy', debouncedCreatedByFilter);

      const res = await fetch(`/api/recipes?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRecipes(data.recipes || []);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      } else {
        toast.error('Failed to fetch recipes');
      }
    } catch (e) {
      toast.error('Error loading recipes');
    } finally {
      setLoading(false);
    }
  };

  const fetchSkus = () => {
    fetch('/api/skus?limit=0')
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

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const openModal = (mode: 'create' | 'edit' | 'copy', recipe?: Recipe) => {
    setModalMode(mode);
    setSelectedRecipe(recipe || null);

    if (mode === 'create') {
      setFormData({ name: '', sku: '', qty: 1, uom: 'EA' });
    } else if (mode === 'edit' && recipe) {
      setFormData({
        name: recipe.name,
        sku: typeof recipe.sku === 'object' ? recipe.sku._id : recipe.sku,
        qty: recipe.qty,
        uom: recipe.uom
      });
    } else if (mode === 'copy' && recipe) {
      setFormData({
        name: recipe.name + ' (Copy)',
        sku: '', // cleared to force selection
        qty: recipe.qty,
        uom: recipe.uom
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveRecipe = async () => {
    if (!formData.name || !formData.sku) {
      return toast.error("Name and SKU are required");
    }
    setSaving(true);
    try {
      let url = '/api/recipes';
      let method = 'POST';
      let payload: any = {
        ...formData,
        createdBy: (session?.user as any)?._id
      };

      if (modalMode === 'edit' && selectedRecipe) {
        url = `/api/recipes/${selectedRecipe._id}`;
        method = 'PUT';
        // Edit only updates header info, doesn't touch items/steps unless passed
        // We pass only header info here. items/steps preserved on backend if not sent?
        // Mongoose Update doesn't clear fields if not sent.
      } else if (modalMode === 'copy' && selectedRecipe) {
        // Copy: Include items/steps from source
        payload.lineItems = selectedRecipe.lineItems;
        payload.steps = selectedRecipe.steps;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(modalMode === 'copy' ? 'Recipe copied!' : modalMode === 'edit' ? 'Recipe updated!' : 'Recipe created!');
        setIsModalOpen(false);
        fetchRecipes();
        if (modalMode !== 'edit') {
          router.push(`/warehouse/recipes/${result._id}`);
        }
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save recipe");
      }
    } catch (e) {
      toast.error("Error saving recipe");
    } finally {
      setSaving(false);
    }
  };

  // --- Delete Recipe ---
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this recipe?")) return;
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success("Recipe deleted");
        fetchRecipes();
      } else {
        toast.error("Failed to delete");
      }
    } catch (e) {
      toast.error("Error deleting recipe");
    }
  };

  // --- Import Logic ---
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, endpoint: string, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const totalItems = results.data.length;
        if (totalItems === 0) {
          toast.error("No data found in file");
          if (e.target) e.target.value = '';
          return;
        }

        const CHUNK_SIZE = 50;
        const toastId = toast.loading(`Preparing to import ${totalItems} items...`);
        let successCount = 0;
        let allErrors: string[] = [];

        try {
          // Process in chunks
          for (let i = 0; i < totalItems; i += CHUNK_SIZE) {
            const chunk = results.data.slice(i, i + CHUNK_SIZE);
            const currentProgress = Math.min(i + CHUNK_SIZE, totalItems);

            toast.loading(`Importing ${label}... ${currentProgress}/${totalItems} (${Math.round((currentProgress / totalItems) * 100)}%)`, {
              id: toastId
            });

            try {
              const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: chunk })
              });

              if (res.ok) {
                const data = await res.json();
                successCount += (data.count || 0);
                if (data.errors && Array.isArray(data.errors)) {
                  allErrors = [...allErrors, ...data.errors];
                }
              } else {
                const err = await res.json();
                allErrors.push(`Chunk ${i / CHUNK_SIZE + 1} failed: ${err.error || res.statusText}`);
              }
            } catch (chunkErr: any) {
              allErrors.push(`Chunk ${i / CHUNK_SIZE + 1} network error: ${chunkErr.message}`);
            }
          }

          // Final Report
          if (allErrors.length > 0) {
            toast.error(`Imported ${successCount} items. ${allErrors.length} errors occurred.`, { id: toastId, duration: 5000 });
            console.error('Import Errors:', allErrors);
            // Show first error in a separate clean toast
            setTimeout(() => toast.error(`Error details: ${allErrors[0]}`), 1000);
          } else {
            toast.success(`Successfully imported all ${successCount} items!`, { id: toastId });
          }

          fetchRecipes();

        } catch (err: any) {
          toast.error(`Import process failed: ${err.message}`, { id: toastId });
        }
      }
    });
    e.target.value = '';
  };

  const renderSku = (val: any) => {
    if (typeof val === 'object' && val?.name) return val.name;
    return val || '-';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Recipes</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400 rounded-sm"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filters */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Filter SKU..."
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="pl-7 pr-3 py-1.5 w-32 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400 rounded-sm"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <input
              type="text"
              placeholder="Filter Creator..."
              value={createdByFilter}
              onChange={(e) => setCreatedByFilter(e.target.value)}
              className="pl-7 pr-3 py-1.5 w-32 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400 rounded-sm"
            />
          </div>

          <div className="w-px h-4 bg-slate-200 mx-1"></div>

          {/* Actions */}
          <input type="file" accept=".csv" className="hidden" ref={importRecipeRef} onChange={(e) => handleImport(e, '/api/recipes/import', 'Recipes')} />
          <input type="file" accept=".csv" className="hidden" ref={importLineItemsRef} onChange={(e) => handleImport(e, '/api/recipes/import-lineitems', 'Line Items')} />
          <input type="file" accept=".csv" className="hidden" ref={importStepsRef} onChange={(e) => handleImport(e, '/api/recipes/import-steps', 'Steps')} />

          <button onClick={() => importRecipeRef.current?.click()} className="h-[28px] px-2 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1 bg-white" title="Import Recipes">
            <Upload className="w-3 h-3" />
            <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-wider">Recipes</span>
          </button>
          <button onClick={() => importLineItemsRef.current?.click()} className="h-[28px] px-2 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1 bg-white" title="Import Line Items">
            <Upload className="w-3 h-3" />
            <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-wider">Items</span>
          </button>
          <button onClick={() => importStepsRef.current?.click()} className="h-[28px] px-2 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1 bg-white" title="Import Steps">
            <Upload className="w-3 h-3" />
            <span className="hidden xl:inline text-[10px] font-bold uppercase tracking-wider">Steps</span>
          </button>

          <button onClick={() => openModal('create')} className="h-[28px] px-3 bg-black text-white hover:bg-slate-800 transition-colors rounded-sm flex items-center space-x-1.5 shadow-sm ml-1">
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider">New</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'name', label: 'Name' },
                { key: 'sku', label: 'SKU' },
                { key: 'qty', label: 'Qty' },
                { key: 'uom', label: 'UOM' },
                { key: 'createdAt', label: 'Created At' },
                { key: 'createdBy', label: 'Created By' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-black" : "text-slate-200")} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Items</th>
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Steps</th>
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400">Loading Recipes...</td></tr>
            ) : recipes.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Recipes found</td></tr>
            ) : recipes.map(recipe => (
              <tr
                key={recipe._id}
                className="hover:bg-slate-50 transition-colors group cursor-pointer"
                onClick={() => router.push(`/warehouse/recipes/${recipe._id}`)}
              >
                <td className="px-4 py-2 text-[11px] font-bold text-slate-900">{recipe.name}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600">{renderSku(recipe.sku)}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600">{recipe.qty}</td>
                <td className="px-4 py-2 text-[10px] text-slate-500 uppercase font-bold">{recipe.uom}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500">{new Date(recipe.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-[11px] text-slate-500">
                  {recipe.createdBy ? `${recipe.createdBy.firstName} ${recipe.createdBy.lastName}` : '-'}
                </td>
                <td className="px-4 py-2 text-center text-[11px] font-bold text-slate-600">{recipe.lineItems?.length || 0}</td>
                <td className="px-4 py-2 text-center text-[11px] font-bold text-slate-600">{recipe.steps?.length || 0}</td>
                <td className="px-4 py-2 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center space-x-1">
                    <button
                      onClick={() => openModal('edit', recipe)}
                      className="p-1.5 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit Details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openModal('copy', recipe)}
                      className="p-1.5 text-slate-300 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="Copy Recipe"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(recipe._id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
        totalItems={totalItems}
        itemsPerPage={20}
        itemName="Recipes"
      />

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-lg">
              <h3 className="font-bold text-sm text-slate-900">
                {modalMode === 'create' ? 'New Recipe' : modalMode === 'edit' ? 'Edit Recipe' : 'Copy Recipe'}
              </h3>
              <button onClick={() => setIsModalOpen(false)}><X className="w-4 h-4 text-slate-400 hover:text-black" /></button>
            </div>
            <div className="p-4 space-y-4">
              {selectedRecipe && (modalMode === 'edit' || modalMode === 'copy') && (
                <div className="bg-slate-50 p-3 rounded-md border border-slate-100 mb-2">
                  <p className="text-xs text-slate-600">
                    {modalMode === 'copy' ? 'Copying' : 'Contains'} <span className="font-bold">{selectedRecipe.lineItems?.length || 0}</span> Line Items and <span className="font-bold">{selectedRecipe.steps?.length || 0}</span> Steps.
                    {modalMode === 'edit' && " (To edit items, click on the recipe row)"}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Recipe Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                  placeholder="e.g. Chocolate Cake"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">product SKU {modalMode === 'copy' && '(Select New)'}</label>
                <SearchableSelect
                  options={skus.map(s => ({ value: s._id, label: s.name }))}
                  value={formData.sku}
                  onChange={(val) => setFormData({ ...formData, sku: val })}
                  placeholder="Search SKU..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Yield Quantity</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                    value={formData.qty}
                    onChange={e => setFormData({ ...formData, qty: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">UOM</label>
                  <select
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:border-black/20"
                    value={formData.uom}
                    onChange={e => setFormData({ ...formData, uom: e.target.value })}
                  >
                    {['EA', 'KG', 'L', 'M', 'G', 'OZ', 'LB'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end rounded-b-lg">
              <button
                onClick={handleSaveRecipe}
                disabled={saving}
                className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : (modalMode === 'create' ? 'Create Recipe' : modalMode === 'edit' ? 'Save Changes' : 'Copy Recipe')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
