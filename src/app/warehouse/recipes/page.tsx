'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Search, ArrowUpDown, Plus, X, Loader2, Copy, Pencil, Trash2 } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Sku { _id: string; name: string; }

// ─── Module-level cache ───────────────────────────────────────────────────────

interface CacheEntry {
  recipes: Recipe[]; hasMore: boolean; page: number; total: number;
  sortBy: string; sortOrder: string; search: string; timestamp: number;
}

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 60_000;
const PAGE_SIZE = 50;

// ─── UOM Pill ─────────────────────────────────────────────────────────────────

function UomPill({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-black font-mono uppercase tracking-widest rounded-md"
      style={{ backgroundColor: 'rgba(254,153,0,0.12)', color: '#b45309', border: '1px solid rgba(254,153,0,0.25)' }}>
      {value}
    </span>
  );
}

// ─── Count Pill ───────────────────────────────────────────────────────────────

function CountPill({ value, color = 'amber' }: { value: number; color?: 'amber' | 'blue' }) {
  const styles = {
    amber: { backgroundColor: 'rgba(254,153,0,0.12)', color: '#b45309', border: '1px solid rgba(254,153,0,0.25)' },
    blue: { backgroundColor: 'rgba(14,165,233,0.12)', color: '#0284c7', border: '1px solid rgba(14,165,233,0.25)' },
  };
  return (
    <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full text-[10px] font-black" style={styles[color]}>
      {value}
    </span>
  );
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────

const SkeletonRow = React.memo(function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/60" style={{ opacity: 1 - index * 0.04 }}>
      {[30, 25, 8, 8, 12, 15, 6, 6].map((w, i) => (
        <td key={i} className="px-2.5 py-2.5">
          <div className="h-3 rounded bg-muted-foreground/10 animate-pulse" style={{ width: `${w * 4}px` }} />
        </td>
      ))}
    </tr>
  );
});

// ─── Recipe Modal ─────────────────────────────────────────────────────────────

function RecipeModal({ mode, recipe, skus, session, onClose, onSaved }: {
  mode: 'create' | 'edit' | 'copy';
  recipe: Recipe | null;
  skus: Sku[];
  session: any;
  onClose: () => void;
  onSaved: (newId?: string, isEdit?: boolean) => void;
}) {
  const [formData, setFormData] = useState(() => {
    if (mode === 'create') return { name: '', sku: '', qty: 1, uom: 'EA' };
    if (mode === 'edit' && recipe) return { name: recipe.name, sku: typeof recipe.sku === 'object' ? recipe.sku._id : recipe.sku, qty: recipe.qty, uom: recipe.uom };
    if (mode === 'copy' && recipe) return { name: recipe.name + ' (Copy)', sku: '', qty: recipe.qty, uom: recipe.uom };
    return { name: '', sku: '', qty: 1, uom: 'EA' };
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formData.name || !formData.sku) { toast.error('Name and SKU are required'); return; }
    setSaving(true);
    try {
      const url = mode === 'edit' && recipe ? `/api/recipes/${recipe._id}` : '/api/recipes';
      const method = mode === 'edit' ? 'PUT' : 'POST';
      const payload: any = { ...formData, createdBy: (session?.user as any)?._id };
      if (mode === 'copy' && recipe) { payload.lineItems = recipe.lineItems; payload.steps = recipe.steps; }

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) {
        const result = await res.json();
        toast.success(mode === 'copy' ? 'Recipe copied!' : mode === 'edit' ? 'Recipe updated!' : 'Recipe created!');
        globalCache.current = null;
        onSaved(result._id, mode === 'edit');
        onClose();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save recipe');
      }
    } catch { toast.error('Error saving recipe'); }
    finally { setSaving(false); }
  };

  const inp = 'w-full px-3 h-9 bg-secondary/50 border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/50 transition-colors';

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-md animate-in fade-in zoom-in duration-200 border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-11 border-b border-border shrink-0 bg-secondary/30 rounded-t-xl">
          <h3 className="text-[10px] font-black uppercase tracking-widest">
            {mode === 'create' ? 'New Recipe' : mode === 'edit' ? 'Edit Recipe' : 'Copy Recipe'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto scrollbar-custom">
          {/* Info banner for edit/copy */}
          {recipe && (mode === 'edit' || mode === 'copy') && (
            <div className="bg-secondary/40 px-4 py-3 rounded-lg border border-border">
              <p className="text-[11px] text-muted-foreground">
                {mode === 'copy' ? 'Copying' : 'Contains'}{' '}
                <span className="text-foreground font-black">{recipe.lineItems?.length || 0}</span> Line Items and{' '}
                <span className="text-foreground font-black">{recipe.steps?.length || 0}</span> Steps.
                {mode === 'edit' && <span className="text-muted-foreground/60"> (Edit items by opening the recipe)</span>}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Recipe Name</label>
            <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={inp} placeholder="e.g. Chocolate Cake" />
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">
              Product SKU {mode === 'copy' && '(Select New)'}
            </label>
            <SearchableSelect
              options={skus.map(s => ({ value: s._id, label: s.name }))}
              value={formData.sku}
              onChange={val => setFormData({ ...formData, sku: val })}
              placeholder="Search SKU..."
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">Yield Quantity</label>
              <input type="number" value={formData.qty} onChange={e => setFormData({ ...formData, qty: parseFloat(e.target.value) })}
                className={inp} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider">UOM</label>
              <select value={formData.uom} onChange={e => setFormData({ ...formData, uom: e.target.value })}
                className="w-full px-3 h-9 bg-secondary/50 border border-border rounded-lg text-[12px] outline-none focus:border-primary text-foreground font-black uppercase transition-colors">
                {['EA', 'KG', 'L', 'M', 'G', 'OZ', 'LB'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 h-12 border-t border-border bg-secondary/20 flex items-center justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 h-8 rounded-lg border border-border text-[10px] font-bold uppercase text-muted-foreground hover:bg-secondary/60 transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 h-8 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {mode === 'create' ? 'Create Recipe' : mode === 'edit' ? 'Save Changes' : 'Copy Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function RecipesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  const [recipes, setRecipes] = useState<Recipe[]>(globalCache.current?.recipes || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [total, setTotal] = useState(globalCache.current?.total || 0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'copy'>('create');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const { canDelete } = usePermissions();

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef(0);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  // ─── SKUs for modal ──────────────────────────────────────────────────────

  useEffect(() => {
    if (isModalOpen && skus.length === 0) {
      fetch('/api/skus?limit=0&simple=true&ignoreDate=true')
        .then(r => r.json()).then(d => { if (d.skus) setSkus(d.skus); }).catch(() => { });
    }
  }, [isModalOpen]);

  // ─── Debounce ────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Scroll-back highlight ───────────────────────────────────────────────

  useEffect(() => {
    const savedId = sessionStorage.getItem('rec_scroll_to');
    const savedScroll = sessionStorage.getItem('rec_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('rec_scroll_to'); sessionStorage.removeItem('rec_scroll_top');
      setHighlightId(savedId);
      if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-rec-id="${savedId}"]`);
        if (row) { setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); setTimeout(() => setHighlightId(null), 3000); }
        else if (attempts < 30) setTimeout(() => tryScroll(attempts + 1), 200);
      };
      setTimeout(() => tryScroll(), 100);
    }
  }, []);

  // ─── Fetch ───────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++reqSeqRef.current;

    fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true); else setIsLoading(true);

    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE), search: debouncedSearch, sortBy, sortOrder });
      const res = await fetch(`/api/recipes?${params}`, { signal: controller.signal });
      const data = await res.json();
      if (seq !== reqSeqRef.current || !mountedRef.current) return;

      if (res.ok) {
        const newRecipes: Recipe[] = data.recipes || [];
        const newHasMore = data.hasMore ?? false;
        const newTotal = data.total || 0;

        if (isAppend) {
          setRecipes(prev => {
            const ids = new Set(prev.map(r => r._id));
            const merged = [...prev, ...newRecipes.filter(r => !ids.has(r._id))];
            globalCache.current = { recipes: merged, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, timestamp: Date.now() };
            return merged;
          });
        } else {
          setRecipes(newRecipes);
          setTotal(newTotal);
          globalCache.current = { recipes: newRecipes, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, timestamp: Date.now() };
        }
        setHasMore(newHasMore);
        pageRef.current = pageNum;
        setError(null);
      } else { setError(data.error || 'Failed to fetch'); }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (mountedRef.current) setError(e.message);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); }
    }
  }, [sortBy, sortOrder, debouncedSearch]);

  // ─── Initial load / filter changes ──────────────────────────────────────

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.recipes.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch) {
        setRecipes(cache.recipes); setHasMore(cache.hasMore); setTotal(cache.total);
        pageRef.current = cache.page; setIsLoading(false); return;
      }
    }
    globalCache.current = null; pageRef.current = 0; setRecipes([]); setHasMore(true);
    fetchPageRef.current(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, debouncedSearch]);

  // ─── Infinite scroll ────────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollRef.current;
    if (!sentinel || !container) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPageRef.current(pageRef.current + 1, true); },
      { root: container, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortOrder('asc'); }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openModal = (mode: 'create' | 'edit' | 'copy', recipe?: Recipe) => {
    setModalMode(mode); setSelectedRecipe(recipe || null); setIsModalOpen(true);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    confirmDeleteToast('Delete this recipe?', async () => {
      try {
        const res = await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
        if (res.ok) { toast.success('Recipe deleted'); globalCache.current = null; pageRef.current = 0; fetchPageRef.current(1, false); }
        else toast.error('Failed to delete');
      } catch { toast.error('Error deleting recipe'); }
    });
  };

  const renderSku = (val: any) => (typeof val === 'object' && val?.name ? val.name : val || '—');

  const COLS = [
    { key: 'name', label: 'Name', sortable: true, width: 'w-[220px]', align: 'left' },
    { key: 'sku', label: 'SKU', sortable: true, width: 'w-[200px]', align: 'left' },
    { key: 'qty', label: 'Qty', sortable: true, width: 'w-[80px]', align: 'right' },
    { key: 'uom', label: 'UOM', sortable: true, width: 'w-[80px]', align: 'left' },
    { key: 'createdAt', label: 'Created', sortable: true, width: 'w-[100px]', align: 'left' },
    { key: 'createdBy', label: 'Created By', sortable: false, width: 'w-[140px]', align: 'left' },
    { key: 'itemCount', label: 'Items', sortable: false, width: 'w-[70px]', align: 'right' },
    { key: 'stepCount', label: 'Steps', sortable: false, width: 'w-[70px]', align: 'right' },
    { key: 'actions', label: '', sortable: false, width: 'w-[70px]', align: 'right' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

      {/* ─── Local Page Header ───────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex items-center gap-3 overflow-x-auto">

        {/* Title + count */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">RECIPES</span>
          <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">{total > 0 ? total.toLocaleString() : ''}</span>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Search */}
        <div className="relative flex items-center shrink-0">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search recipes or SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-8 h-8 w-64 bg-secondary/60 border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* ADD button */}
        <button onClick={() => openModal('create')}
          className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer shrink-0">
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black uppercase tracking-widest">NEW</span>
        </button>
      </div>

      {/* ─── Table ──────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10">
              <tr>
                {COLS.map(col => (
                  <th key={col.key}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                      col.width,
                      col.sortable && 'cursor-pointer hover:bg-secondary/60 transition-colors',
                    )}>
                    <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                      {col.align === 'right' && col.sortable && <ArrowUpDown className={cn('w-2.5 h-2.5 flex-shrink-0', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                      <span>{col.label}</span>
                      {col.align !== 'right' && col.sortable && <ArrowUpDown className={cn('w-2.5 h-2.5 flex-shrink-0', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
              ) : recipes.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No recipes found</td></tr>
              ) : recipes.map(recipe => (
                <tr
                  key={recipe._id}
                  data-rec-id={recipe._id}
                  className={cn(
                    'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
                    highlightId === recipe._id && 'ring-1 ring-primary/40 bg-primary/[0.06]'
                  )}
                  onClick={() => {
                    sessionStorage.setItem('rec_scroll_to', recipe._id);
                    if (scrollRef.current) sessionStorage.setItem('rec_scroll_top', String(scrollRef.current.scrollTop));
                    router.push(`/warehouse/recipes/${recipe._id}`);
                  }}
                >
                  {/* Name */}
                  <td className="px-2.5 py-2.5 w-[220px] border-r border-border/40">
                    <span className="text-[12px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors truncate block max-w-[200px]" title={recipe.name}>
                      {recipe.name}
                    </span>
                  </td>

                  {/* SKU */}
                  <td className="px-2.5 py-2.5 w-[200px] text-[11px] text-foreground/60 truncate border-r border-border/40" title={renderSku(recipe.sku)}>
                    {renderSku(recipe.sku)}
                  </td>

                  {/* Qty — right aligned */}
                  <td className="px-2.5 py-2.5 w-[80px] text-right border-r border-border/40">
                    <span className="text-[12px] font-mono font-bold text-foreground/80">{recipe.qty}</span>
                  </td>

                  {/* UOM */}
                  <td className="px-2.5 py-2.5 w-[80px] border-r border-border/40">
                    <UomPill value={recipe.uom} />
                  </td>

                  {/* Created At */}
                  <td className="px-2.5 py-2.5 w-[100px] text-[11px] font-mono text-foreground/50 border-r border-border/40">
                    {formatDate(recipe.createdAt)}
                  </td>

                  {/* Created By */}
                  <td className="px-2.5 py-2.5 w-[140px] text-[11px] text-foreground/60 truncate border-r border-border/40">
                    {recipe.createdBy ? `${recipe.createdBy.firstName} ${recipe.createdBy.lastName}` : '—'}
                  </td>

                  {/* Items — right aligned */}
                  <td className="px-2.5 py-2.5 w-[70px] text-right border-r border-border/40">
                    <CountPill value={recipe.lineItems?.length || 0} color="amber" />
                  </td>

                  {/* Steps — right aligned */}
                  <td className="px-2.5 py-2.5 w-[70px] text-right border-r border-border/40">
                    <CountPill value={recipe.steps?.length || 0} color="blue" />
                  </td>

                  {/* Actions */}
                  <td className="px-2.5 py-2.5 w-[70px]" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={e => { e.stopPropagation(); openModal('edit', recipe); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer" title="Edit">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={e => { e.stopPropagation(); openModal('copy', recipe); }}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors cursor-pointer" title="Copy">
                        <Copy className="w-3 h-3" />
                      </button>
                      {canDelete() && (
                        <button onClick={e => handleDelete(e, recipe._id)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer" title="Delete">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Sentinel */}
          <div ref={sentinelRef} className="h-2" />

          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {!hasMore && recipes.length > 0 && !isLoading && (
            <div className="text-center py-4 text-[11px] text-muted-foreground/40 uppercase tracking-widest">
              — {recipes.length.toLocaleString()} recipes loaded —
            </div>
          )}
        </div>
      </div>

      {/* ─── Modal ──────────────────────────────────────────────────── */}
      {isModalOpen && (
        <RecipeModal
          mode={modalMode}
          recipe={selectedRecipe}
          skus={skus}
          session={session}
          onClose={() => setIsModalOpen(false)}
          onSaved={(newId, isEdit) => {
            if (newId && !isEdit) router.push(`/warehouse/recipes/${newId}`);
            else { pageRef.current = 0; fetchPageRef.current(1, false); }
          }}
        />
      )}
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <RecipesContent />
    </Suspense>
  );
}
