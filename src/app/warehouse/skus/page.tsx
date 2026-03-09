'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpDown, Plus, Search, X, Loader2, Archive, ArchiveRestore } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sku {
  _id: string;
  name: string;
  image?: string;
  category?: string;
  subCategory?: string;
  materialType?: string;
  uom?: string;
  salePrice?: number;
  orderUpto?: number;
  reOrderPoint?: number;
  isLotApplied?: boolean;
  isArchived?: boolean;
  tier?: number;
  createdAt?: string;
}

interface CacheEntry {
  skus: Sku[];
  hasMore: boolean;
  page: number;
  total: number;
  sortBy: string;
  sortOrder: string;
  search: string;
  category: string;
  showArchived: boolean;
  timestamp: number;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Tier Badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: number }) {
  const colors = ['', '#22c55e', '#3b82f6', '#f97316'];
  return (
    <span
      className="flex-shrink-0 w-4 h-4 rounded flex items-center justify-center text-[9px] font-black text-white shadow-sm"
      style={{ backgroundColor: colors[tier] || '#94a3b8' }}
      title={`Tier ${tier}`}
    >
      {tier}
    </span>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'name', label: 'Name / SKU', width: 'w-[280px]' },
  { key: 'category', label: 'Category', width: 'w-[130px]' },
  { key: 'subCategory', label: 'Sub Category', width: 'w-[130px]' },
  { key: 'materialType', label: 'Material', width: 'w-[110px]' },
  { key: 'uom', label: 'UOM', width: 'w-[60px]' },
  { key: 'salePrice', label: 'Sale Price', width: 'w-[90px]', align: 'text-right' },
  { key: 'reOrderPoint', label: 'Re-Order Pt', width: 'w-[90px]', align: 'text-right' },
  { key: 'orderUpto', label: 'Order Upto', width: 'w-[90px]', align: 'text-right' },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const SkeletonRow = React.memo(function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/60" style={{ opacity: 1 - index * 0.035 }}>
      {COLUMNS.map(col => (
        <td key={col.key} className="px-2.5 py-2.5">
          <div className="h-3 rounded bg-muted-foreground/10 animate-pulse" style={{ width: col.key === 'name' ? '75%' : col.key === 'category' ? '60%' : '45%' }} />
        </td>
      ))}
    </tr>
  );
});

// ─── Field Pill Components ────────────────────────────────────────────────────

// Deterministic color palette — same value always gets same color
const PILL_PALETTES = {
  category: [
    { bg: '#7c3aed', color: '#ffffff', border: '#7c3aed' },  // violet
    { bg: '#059669', color: '#ffffff', border: '#059669' },  // emerald
    { bg: '#ea580c', color: '#ffffff', border: '#ea580c' },   // orange
    { bg: '#0891b2', color: '#ffffff', border: '#0891b2' },   // cyan
    { bg: '#db2777', color: '#ffffff', border: '#db2777' },  // pink
    { bg: '#65a30d', color: '#ffffff', border: '#65a30d' },  // lime
    { bg: '#2563eb', color: '#ffffff', border: '#2563eb' },   // blue
  ],
  subCategory: [
    { bg: '#b45309', color: '#ffffff', border: '#b45309' },   // amber
    { bg: '#6366f1', color: '#ffffff', border: '#6366f1' },  // indigo
    { bg: '#0f766e', color: '#ffffff', border: '#0f766e' },  // teal
    { bg: '#dc2626', color: '#ffffff', border: '#dc2626' },   // red
    { bg: '#9333ea', color: '#ffffff', border: '#9333ea' },  // purple
    { bg: '#3b82f6', color: '#ffffff', border: '#3b82f6' },  // blue
    { bg: '#16a34a', color: '#ffffff', border: '#16a34a' },   // green
    { bg: '#ea580c', color: '#ffffff', border: '#ea580c' },  // orange
  ],
  material: [
    { bg: '#64748b', color: '#ffffff', border: '#64748b' }, // slate
    { bg: '#059669', color: '#ffffff', border: '#059669' },  // emerald
    { bg: '#6366f1', color: '#ffffff', border: '#6366f1' }, // indigo
    { bg: '#92400e', color: '#ffffff', border: '#92400e' },   // amber
    { bg: '#dc2626', color: '#ffffff', border: '#dc2626' }, // red
    { bg: '#0891b2', color: '#ffffff', border: '#0891b2' },  // sky
    { bg: '#065f46', color: '#ffffff', border: '#065f46' }, // green
  ],
};

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Fixed overrides for specific values (bypass hash-based palette)
const PILL_OVERRIDES: Record<string, Record<string, { bg: string; border: string }>> = {
  category: {
    'finished goods': { bg: '#FFB33F', border: '#FFB33F' },
    'packaging': { bg: '#7AAACE', border: '#7AAACE' },
    'shipping category': { bg: '#66D0BC', border: '#66D0BC' },
    'shipping': { bg: '#66D0BC', border: '#66D0BC' },
    'part': { bg: '#E57373', border: '#E57373' },
    'lab testing': { bg: '#BA68C8', border: '#BA68C8' },
  },
  material: {
    'tablets': { bg: '#AEB784', border: '#AEB784' },
  },
};

function FieldPill({ value, type }: { value: string; type: 'category' | 'subCategory' | 'material' }) {
  const override = PILL_OVERRIDES[type]?.[value.toLowerCase()];
  const palette = PILL_PALETTES[type];
  const s = override || palette[hashString(value) % palette.length];
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <span
      style={{ backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: '5px', color: isDark ? '#000000' : '#ffffff' }}
      className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap max-w-full truncate"
    >
      {value}
    </span>
  );
}

function UomPill({ value }: { value: string }) {
  return (
    <span
      className="inline-flex items-center text-[10px] font-black font-mono uppercase tracking-widest text-foreground"
    >
      {value}
    </span>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

const SkuRow = React.memo(function SkuRow({
  sku, onClick, highlight, onToggleArchive, showArchived
}: { sku: Sku; onClick: () => void; highlight?: boolean; onToggleArchive?: (skuId: string, isArchived: boolean) => void; showArchived?: boolean }) {
  const fmt = (n?: number) => n != null ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
  return (
    <tr
      data-sku-id={sku._id}
      className={cn(
        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
        highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
      )}
      onClick={onClick}
    >
      <td className="px-2.5 py-2.5 w-[280px] text-[12px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors">
        <div className="flex items-center gap-1.5">
          {sku.tier ? <TierBadge tier={sku.tier} /> : null}
          <span className="truncate">{sku.name}</span>
        </div>
      </td>
      <td className="px-2.5 py-2.5 w-[130px]">{sku.category ? <FieldPill value={sku.category} type="category" /> : <span className="text-muted-foreground/30 text-[11px]">—</span>}</td>
      <td className="px-2.5 py-2.5 w-[130px]">{sku.subCategory ? <FieldPill value={sku.subCategory} type="subCategory" /> : <span className="text-muted-foreground/30 text-[11px]">—</span>}</td>
      <td className="px-2.5 py-2.5 w-[110px]">{sku.materialType ? <FieldPill value={sku.materialType} type="material" /> : <span className="text-muted-foreground/30 text-[11px]">—</span>}</td>
      <td className="px-2.5 py-2.5 w-[60px]">{sku.uom ? <UomPill value={sku.uom} /> : <span className="text-muted-foreground/30 text-[11px]">—</span>}</td>
      <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-right text-foreground/80">{fmt(sku.salePrice)}</td>
      <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-right text-foreground/70">{sku.reOrderPoint?.toLocaleString() || '—'}</td>
      <td className="px-2.5 py-2.5 w-[90px] text-[12px] font-mono text-right text-foreground/70">{sku.orderUpto?.toLocaleString() || '—'}</td>
      {/* Archive action */}
      <td className="px-2.5 py-2.5 w-[70px] text-center">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleArchive?.(sku._id, !!sku.isArchived); }}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer',
            sku.isArchived
              ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border border-emerald-500/20'
              : 'opacity-0 group-hover:opacity-100 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20'
          )}
          title={sku.isArchived ? 'Restore SKU' : 'Archive SKU'}
        >
          {sku.isArchived ? <><ArchiveRestore className="w-3 h-3" /> Restore</> : <><Archive className="w-3 h-3" /> Archive</>}
        </button>
      </td>
    </tr>
  );
});

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

const INITIAL_FORM = { name: '', image: '', category: '', subCategory: '', materialType: '', uom: '', salePrice: 0, orderUpto: 0, reOrderPoint: 0, isLotApplied: false };

function SkuModal({ onClose, onSaved, editing }: { onClose: () => void; onSaved: () => void; editing?: Sku | null }) {
  const [form, setForm] = useState(editing ? { name: editing.name, image: editing.image || '', category: editing.category || '', subCategory: editing.subCategory || '', materialType: editing.materialType || '', uom: editing.uom || '', salePrice: editing.salePrice || 0, orderUpto: editing.orderUpto || 0, reOrderPoint: editing.reOrderPoint || 0, isLotApplied: editing.isLotApplied || false } : INITIAL_FORM);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url = editing ? `/api/skus/${editing._id}` : '/api/skus';
      const res = await fetch(url, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { toast.success(editing ? 'SKU updated' : 'SKU created'); globalCache.current = null; onSaved(); onClose(); }
      else { const e = await res.json(); toast.error(e.error || 'Failed to save'); }
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-2xl mx-4 bg-background border border-border shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-5 h-11 border-b border-border bg-secondary/30 shrink-0">
          <h2 className="text-[11px] font-black uppercase tracking-widest">{editing ? 'Edit SKU' : 'Add New SKU'}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary rounded-full transition-colors cursor-pointer"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 scrollbar-custom">
          <form id="sku-form" onSubmit={handleSubmit} className="space-y-4">
            <Field label="Name *"><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></Field>
            <Field label="Image URL"><input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} placeholder="https://..." className={inp} /></Field>
            <div className="grid grid-cols-3 gap-4">
              <Field label="Category">
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inp}>
                  <option value="">Select...</option>
                  {['Finished Goods', 'Part', 'Packaging', 'Shipping Category', 'Lab Testing'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Sub Category">
                <select value={form.subCategory} onChange={e => setForm({ ...form, subCategory: e.target.value })} className={inp}>
                  <option value="">Select...</option>
                  {['Bags', 'Bottle And Lids', 'Display Boxes', 'Disposable Vape', 'Edibles', 'Flavors', 'Hemp', 'Kava', 'Kratom', 'Kratom Extract', 'Kratom Powder', 'Labels/Shrink-Bands', 'Marketing Material', 'Packagings', 'R&D', 'Raw Ingredients', 'Simple', 'Variable'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Material Type">
                <select value={form.materialType} onChange={e => setForm({ ...form, materialType: e.target.value })} className={inp}>
                  <option value="">Select...</option>
                  {['Bag', 'Bottle', 'Box', 'Capsule', 'Clings', 'Crystal', 'Dropper', 'Edible', 'Extracts', 'Label', 'Lid/Top', 'Liquid', 'Oils', 'Postcards', 'Powder', 'Seal', 'Shipping Boxes', 'Shrinkband', 'Smokables', 'Stickers', 'Tablets', 'Terpenes', 'Topicals'].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Field label="UOM">
                <input list="uom-opts" value={form.uom} onChange={e => setForm({ ...form, uom: e.target.value })} placeholder="EA, G, MG..." className={inp} />
                <datalist id="uom-opts">{['EA', 'G', 'GAL', 'HR', 'KG', 'L', 'LBS', 'MG', 'ML', 'OZ'].map(o => <option key={o} value={o} />)}</datalist>
              </Field>
              <Field label="Sale Price ($)"><input type="number" step="any" value={form.salePrice || ''} onChange={e => setForm({ ...form, salePrice: Number(e.target.value) })} className={inp} /></Field>
              <Field label="Order Upto"><input type="number" step="any" value={form.orderUpto || ''} onChange={e => setForm({ ...form, orderUpto: Number(e.target.value) })} className={inp} /></Field>
              <Field label="Re-Order Point"><input type="number" step="any" value={form.reOrderPoint || ''} onChange={e => setForm({ ...form, reOrderPoint: Number(e.target.value) })} className={inp} /></Field>
            </div>
            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-primary" checked={form.isLotApplied} onChange={e => setForm({ ...form, isLotApplied: e.target.checked })} />
                <span className="text-[11px] font-bold uppercase text-muted-foreground">Lot Applied (Traceability)</span>
              </label>
            </div>
          </form>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 h-11 border-t border-border bg-secondary/30 shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground cursor-pointer">Cancel</button>
          <button type="submit" form="sku-form" disabled={saving} className="px-5 py-1.5 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            <span>{editing ? 'Save Changes' : 'Create SKU'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const inp = 'w-full h-9 px-3 border border-border rounded-lg text-[12px] bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors appearance-none';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</label>{children}</div>;
}

// ─── Category Filter Tabs ─────────────────────────────────────────────────────

const CATEGORY_TABS = ['All', 'Finished Goods', 'Part', 'Packaging', 'Shipping', 'Lab Testing'] as const;
const CATEGORY_COLORS: Record<string, { bg: string; color: string; hoverBg: string }> = {
  'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
  'Finished Goods': { bg: '#FFB33F', color: '#000000', hoverBg: 'rgba(255,179,63,0.08)' },
  'Part': { bg: '#E57373', color: '#000000', hoverBg: 'rgba(229,115,115,0.08)' },
  'Packaging': { bg: '#7AAACE', color: '#000000', hoverBg: 'rgba(122,170,206,0.08)' },
  'Shipping': { bg: '#66D0BC', color: '#000000', hoverBg: 'rgba(102,208,188,0.08)' },
  'Lab Testing': { bg: '#BA68C8', color: '#ffffff', hoverBg: 'rgba(186,104,200,0.08)' },
};

// ─── Main Content ─────────────────────────────────────────────────────────────

function SkusContent() {
  const router = useRouter();

  const [skus, setSkus] = useState<Sku[]>(globalCache.current?.skus || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [total, setTotal] = useState(globalCache.current?.total || 0);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Debounce ───────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // ─── Scroll-back & highlight ─────────────────────────────────────────────

  useEffect(() => {
    const savedId = sessionStorage.getItem('sku_scroll_to');
    const savedScroll = sessionStorage.getItem('sku_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('sku_scroll_to');
      sessionStorage.removeItem('sku_scroll_top');
      setHighlightId(savedId);
      if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-sku-id="${savedId}"]`);
        if (row) {
          setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
          setTimeout(() => setHighlightId(null), 3000);
        } else if (attempts < 30) setTimeout(() => tryScroll(attempts + 1), 200);
      };
      setTimeout(() => tryScroll(), 100);
    }
  }, []);

  // ─── Fetch ──────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const seq = ++reqSeqRef.current;

    fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(PAGE_SIZE),
        sortBy, sortOrder,
        search: debouncedSearch,
        simple: 'true',
        ignoreDate: 'true',
      });
      if (showArchived) params.set('showArchived', 'true');

      if (activeCategory !== 'All') {
        // Map display names to actual DB category values
        const categoryDbMap: Record<string, string> = {
          'Shipping': 'Shipping Category',
        };
        params.set('category', categoryDbMap[activeCategory] || activeCategory);
      }

      const res = await fetch(`/api/skus?${params}`, { signal: controller.signal });
      const data = await res.json();

      if (seq !== reqSeqRef.current) return;
      if (!mountedRef.current) return;

      if (res.ok) {
        const newSkus: Sku[] = data.skus || [];
        const filtered = newSkus;

        const newHasMore = data.hasMore ?? (newSkus.length === PAGE_SIZE);
        const newTotal = data.total || 0;

        if (isAppend) {
          setSkus(prev => {
            const ids = new Set(prev.map(s => s._id));
            const merged = [...prev, ...filtered.filter(s => !ids.has(s._id))];
            globalCache.current = { skus: merged, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, category: activeCategory, showArchived, timestamp: Date.now() };
            return merged;
          });
        } else {
          setSkus(filtered);
          setTotal(newTotal);
          globalCache.current = { skus: filtered, hasMore: newHasMore, page: pageNum, total: newTotal, sortBy, sortOrder, search: debouncedSearch, category: activeCategory, showArchived, timestamp: Date.now() };
        }

        setHasMore(newHasMore);
        pageRef.current = pageNum;
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch');
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      if (mountedRef.current) setError(e.message);
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); }
    }
  }, [sortBy, sortOrder, debouncedSearch, activeCategory, showArchived]);

  // ─── Initial load / filter changes ─────────────────────────────────────

  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);
  const prevFiltersRef = useRef({ sortBy, sortOrder, search: debouncedSearch, category: activeCategory, showArchived });

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const filtersChanged = prev.sortBy !== sortBy || prev.sortOrder !== sortOrder || prev.search !== debouncedSearch || prev.category !== activeCategory || prev.showArchived !== showArchived;
    prevFiltersRef.current = { sortBy, sortOrder, search: debouncedSearch, category: activeCategory, showArchived };

    if (isFirstMount.current) {
      isFirstMount.current = false;
      const cache = globalCache.current;
      if (cache && cache.skus.length > 0 && (Date.now() - cache.timestamp) < CACHE_TTL &&
        cache.sortBy === sortBy && cache.sortOrder === sortOrder && cache.search === debouncedSearch && cache.category === activeCategory && cache.showArchived === showArchived) {
        setSkus(cache.skus); setHasMore(cache.hasMore); setTotal(cache.total); pageRef.current = cache.page; setIsLoading(false); return;
      }
    }

    globalCache.current = null;
    pageRef.current = 0;
    setSkus([]);
    setHasMore(true);
    fetchPageRef.current(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder, debouncedSearch, activeCategory, showArchived]);

  // ─── Archive Toggle ─────────────────────────────────────────────────────

  const handleToggleArchive = async (skuId: string, currentArchived: boolean) => {
    const toastId = toast.loading(currentArchived ? 'Restoring...' : 'Archiving...');
    // Optimistic: remove from list when archiving (on active view) or restoring (on archived view)
    setSkus(prev => prev.filter(s => {
      if (s._id === skuId) {
        // Archiving from active list: remove it
        if (!showArchived && !currentArchived) return false;
        // Restoring from archived list: remove it
        if (showArchived && currentArchived) return false;
      }
      return true;
    }).map(s => {
      if (s._id === skuId) return { ...s, isArchived: !currentArchived };
      return s;
    }));

    try {
      const res = await fetch(`/api/skus/${skuId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !currentArchived })
      });
      if (res.ok) {
        toast.success(currentArchived ? 'Restored' : 'Archived', { id: toastId });
        globalCache.current = null;
      } else {
        toast.error('Failed', { id: toastId });
        globalCache.current = null; fetchPage(1, false);
      }
    } catch {
      toast.error('Failed', { id: toastId });
      globalCache.current = null; fetchPage(1, false);
    }
  };

  // ─── Infinite scroll ─────────────────────────────────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const scrollContainer = scrollRef.current;
    if (!sentinel || !scrollContainer) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPageRef.current(pageRef.current + 1, true); },
      { root: scrollContainer, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortOrder(p => p === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortOrder('asc'); }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">

      {/* ─── Local Header ──────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background px-3 py-2 flex items-center gap-3 overflow-x-auto">

        {/* Title */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-black uppercase tracking-widest text-foreground">SKUS</span>
          <span className="text-[11px] font-bold text-muted-foreground/60 tabular-nums">{total > 0 ? total.toLocaleString() : ''}</span>
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5">
          {CATEGORY_TABS.map(tab => {
            const sc = CATEGORY_COLORS[tab];
            const isActive = activeCategory === tab;
            return (
              <button key={tab} onClick={() => { setActiveCategory(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                style={isActive ? { backgroundColor: sc.bg, color: sc.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { color: 'inherit', backgroundColor: 'transparent' }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
              >{tab}</button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* Search */}
        <div className="relative flex items-center shrink-0">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
          <input
            type="text"
            placeholder="Search SKUs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 h-8 w-56 bg-secondary/60 border border-border text-[12px] rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 text-foreground transition-all"
          />
        </div>

        <div className="flex-1" />

        {/* Show Archived toggle */}
        <button
          onClick={() => setShowArchived(p => !p)}
          className={cn('h-8 px-3 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 text-[11px] font-bold uppercase tracking-widest', showArchived ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60')}
          title={showArchived ? 'Viewing Archived SKUs' : 'Show Archived SKUs'}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Archived</span>
        </button>

        {/* Add Button */}
        <button
          onClick={() => { setEditingSku(null); setModalOpen(true); }}
          className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="text-[11px] font-black uppercase tracking-widest">ADD</span>
        </button>
      </div>

      {/* ─── Table ─────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 transition-colors border-r border-border/40 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                      col.width
                    )}
                  >
                    <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                      <span>{col.label}</span>
                      <ArrowUpDown className={cn('w-2.5 h-2.5', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />
                    </div>
                  </th>
                ))}
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest w-[70px] text-center shadow-[0_1px_0_0_hsl(var(--border))]">
                  <Archive className="w-3 h-3 mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 25 }).map((_, i) => <SkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={COLUMNS.length + 1} className="px-4 py-12 text-center text-[12px] text-destructive">{error}</td></tr>
              ) : skus.length === 0 ? (
                <tr><td colSpan={COLUMNS.length + 1} className="px-4 py-16 text-center text-[12px] text-muted-foreground/50 uppercase tracking-widest">No SKUs found</td></tr>
              ) : skus.map(sku => (
                <SkuRow
                  key={sku._id}
                  sku={sku}
                  highlight={highlightId === sku._id}
                  onToggleArchive={handleToggleArchive}
                  showArchived={showArchived}
                  onClick={() => {
                    sessionStorage.setItem('sku_scroll_to', sku._id);
                    if (scrollRef.current) sessionStorage.setItem('sku_scroll_top', String(scrollRef.current.scrollTop));
                    router.push(`/warehouse/skus/${sku._id}`);
                  }}
                />
              ))}
            </tbody>
          </table>

          <div ref={sentinelRef} className="h-2" />

          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 py-4">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {!hasMore && skus.length > 0 && !isLoading && (
            <div className="text-center py-4 text-[11px] text-muted-foreground/40 uppercase tracking-widest">
              — {skus.length.toLocaleString()} SKUs loaded —
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <SkuModal
          onClose={() => setModalOpen(false)}
          onSaved={() => { globalCache.current = null; fetchPage(1, false); }}
          editing={editingSku}
        />
      )}
    </div>
  );
}

export default function SkusPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <SkusContent />
    </Suspense>
  );
}
