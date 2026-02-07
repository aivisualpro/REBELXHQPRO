'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search,
  ArrowUpDown,
  Plus,
  Filter,
  MoreHorizontal,
  X,
  Trash2,
  Copy,
  Edit2
} from 'lucide-react';
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


  const renderSku = (val: any) => {
    if (typeof val === 'object' && val?.name) return val.name;
    return val || '-';
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-secondary/50 transition-colors">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter shrink-0">Recipes</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search Recipes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filters */}
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter SKU..."
              value={skuFilter}
              onChange={(e) => setSkuFilter(e.target.value)}
              className="pl-6 pr-3 h-8 w-32 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter Creator..."
              value={createdByFilter}
              onChange={(e) => setCreatedByFilter(e.target.value)}
              className="pl-6 pr-3 h-8 w-32 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
            />
          </div>


          <button onClick={() => openModal('create')} className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded shadow-md flex items-center space-x-1.5 ml-1 cursor-pointer">
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">New</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
            <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
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
                  className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary transition-colors border-r border-border last:border-0"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-foreground" : "text-muted-foreground")} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center border-r border-border min-w-[60px]">Items</th>
               <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center border-r border-border min-w-[60px]">Steps</th>
              <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400">Loading Recipes...</td></tr>
            ) : recipes.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Recipes found</td></tr>
            ) : recipes.map(recipe => (
              <tr
                key={recipe._id}
                className="hover:bg-secondary/40 hover:scale-[1.002] hover:shadow-md transition-all duration-200 group relative z-0 hover:z-10 bg-background cursor-pointer"
                onClick={() => router.push(`/warehouse/recipes/${recipe._id}`)}
              >
                <td className="px-4 py-2 text-[11px] font-bold text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] border-r border-border">{recipe.name}</td>
                <td className="px-4 py-2 text-[11px] text-foreground truncate max-w-[150px] border-r border-border font-medium">{renderSku(recipe.sku)}</td>
                <td className="px-4 py-2 text-[11px] text-foreground font-mono border-r border-border">{recipe.qty}</td>
                <td className="px-4 py-2 text-[10px] text-muted-foreground uppercase font-black tracking-widest border-r border-border">{recipe.uom}</td>
                <td className="px-4 py-2 text-[11px] text-muted-foreground font-mono border-r border-border">{new Date(recipe.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-2 text-[11px] text-foreground border-r border-border">
                  {recipe.createdBy ? `${recipe.createdBy.firstName} ${recipe.createdBy.lastName}` : '-'}
                </td>
                <td className="px-4 py-2 text-center text-[11px] font-bold text-muted-foreground border-r border-border">{recipe.lineItems?.length || 0}</td>
                <td className="px-4 py-2 text-center text-[11px] font-bold text-muted-foreground border-r border-border">{recipe.steps?.length || 0}</td>
                <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openModal('edit', recipe)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                      title="Edit Details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openModal('copy', recipe)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                      title="Copy Recipe"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(recipe._id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
          totalItems={totalItems}
          itemsPerPage={20}
          itemName="Recipes"
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-md animate-in fade-in zoom-in duration-200 border border-border shadow-2xl rounded overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                {modalMode === 'create' ? 'New Recipe' : modalMode === 'edit' ? 'Edit Recipe' : 'Copy Recipe'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {selectedRecipe && (modalMode === 'edit' || modalMode === 'copy') && (
                <div className="bg-secondary/40 p-4 rounded border border-border mb-2">
                  <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                    {modalMode === 'copy' ? 'Copying' : 'Contains'} <span className="text-foreground font-black">{selectedRecipe.lineItems?.length || 0}</span> Line Items and <span className="text-foreground font-black">{selectedRecipe.steps?.length || 0}</span> Steps.
                    {modalMode === 'edit' && " (To edit items, click on the recipe row)"}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Recipe Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground font-medium"
                  placeholder="e.g. Chocolate Cake"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">product SKU {modalMode === 'copy' && '(Select New)'}</label>
                <SearchableSelect
                  options={skus.map(s => ({ value: s._id, label: s.name }))}
                  value={formData.sku}
                  onChange={(val) => setFormData({ ...formData, sku: val })}
                  placeholder="Search SKU..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Yield Quantity</label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground font-mono"
                    value={formData.qty}
                    onChange={e => setFormData({ ...formData, qty: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">UOM</label>
                  <select
                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground uppercase font-black"
                    value={formData.uom}
                    onChange={e => setFormData({ ...formData, uom: e.target.value })}
                  >
                    {['EA', 'KG', 'L', 'M', 'G', 'OZ', 'LB'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-secondary/50 border-t border-border flex justify-end">
              <button
                onClick={handleSaveRecipe}
                disabled={saving}
                className="px-8 h-10 bg-primary text-black text-[11px] font-black uppercase tracking-widest rounded hover:opacity-90 transition-all shadow-md disabled:opacity-50 cursor-pointer"
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
