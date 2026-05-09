'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    Database,
    Download,
    Copy,
    ExternalLink,
    Loader2,
    Search,
    SlidersHorizontal,
    Filter,
    Plus,
    X,
    ChevronLeft,
    ChevronRight,
    ArrowLeft,
    HardDrive,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────── */

interface BackupResource {
    public_id: string;
    secure_url: string;
    bytes: number;
    created_at: string;
    tags: string[];
    date: string;
    timestamp: string;
}

interface CollectionInfo {
    name: string;
    count: number;
}

interface BackupMetadata {
    dbName: string;
    timestamp: string;
    date: string;
    collectionCount: number;
    totalDocs: number;
    sizeBytes: number;
}

type Operator =
    | 'contains'
    | 'equals'
    | 'starts'
    | 'ends'
    | 'gt'
    | 'lt'
    | 'exists'
    | 'not_exists';

interface FilterRow {
    id: string;
    field: string;
    operator: Operator;
    value: string;
}

const OPERATORS: { value: Operator; label: string }[] = [
    { value: 'contains', label: 'Contains' },
    { value: 'equals', label: 'Equals' },
    { value: 'starts', label: 'Starts with' },
    { value: 'ends', label: 'Ends with' },
    { value: 'gt', label: 'Greater than' },
    { value: 'lt', label: 'Less than' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
];

/* ─── Helpers ────────────────────────────────────────────── */

function formatBytes(bytes: number) {
    if (!bytes && bytes !== 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getValueAtPath(obj: any, path: string): unknown {
    if (!path) return undefined;
    const parts = path.split('.');
    let cur: any = obj;
    for (const p of parts) {
        if (cur == null) return undefined;
        cur = cur[p];
    }
    return cur;
}

function extractFieldPaths(docs: any[]): string[] {
    const set = new Set<string>();
    for (const d of docs) {
        if (!d || typeof d !== 'object') continue;
        for (const k of Object.keys(d)) {
            set.add(k);
            const v = (d as any)[k];
            if (v && typeof v === 'object' && !Array.isArray(v)) {
                for (const k2 of Object.keys(v)) {
                    set.add(`${k}.${k2}`);
                }
            }
        }
    }
    const all = Array.from(set);
    const idFirst = all.includes('_id') ? ['_id'] : [];
    const rest = all.filter(f => f !== '_id').sort((a, b) => a.localeCompare(b));
    return [...idFirst, ...rest];
}

function plainSubstringMatch(doc: any, query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase();
    try {
        return JSON.stringify(doc).toLowerCase().includes(q);
    } catch {
        return false;
    }
}

function applyFilter(doc: any, filter: FilterRow): boolean {
    const v = getValueAtPath(doc, filter.field);
    switch (filter.operator) {
        case 'exists':
            return v !== undefined && v !== null;
        case 'not_exists':
            return v === undefined || v === null;
        case 'gt': {
            const a = Number(v);
            const b = Number(filter.value);
            if (Number.isNaN(a) || Number.isNaN(b)) return false;
            return a > b;
        }
        case 'lt': {
            const a = Number(v);
            const b = Number(filter.value);
            if (Number.isNaN(a) || Number.isNaN(b)) return false;
            return a < b;
        }
        case 'contains':
            return String(v ?? '')
                .toLowerCase()
                .includes(filter.value.toLowerCase());
        case 'equals':
            return String(v ?? '').toLowerCase() === filter.value.toLowerCase();
        case 'starts':
            return String(v ?? '')
                .toLowerCase()
                .startsWith(filter.value.toLowerCase());
        case 'ends':
            return String(v ?? '')
                .toLowerCase()
                .endsWith(filter.value.toLowerCase());
        default:
            return true;
    }
}

/* ─── Page ───────────────────────────────────────────────── */

export default function BackupsPage() {
    const [backups, setBackups] = useState<BackupResource[]>([]);
    const [loadingBackups, setLoadingBackups] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>('');

    const [metadata, setMetadata] = useState<BackupMetadata | null>(null);
    const [collections, setCollections] = useState<CollectionInfo[]>([]);
    const [loadingInspect, setLoadingInspect] = useState(false);

    const [collectionFilter, setCollectionFilter] = useState('');
    const [selectedCollection, setSelectedCollection] = useState<string>('');

    const [docs, setDocs] = useState<any[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const [search, setSearch] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [filters, setFilters] = useState<FilterRow[]>([]);

    const [downloading, setDownloading] = useState(false);

    const selectedBackup = useMemo(
        () => backups.find(b => b.date === selectedDate) || null,
        [backups, selectedDate],
    );

    /* fetch backup list */
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingBackups(true);
            try {
                const res = await fetch('/api/admin/backups', { cache: 'no-store' });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load backups');
                if (cancelled) return;
                setBackups(data.backups || []);
                if ((data.backups || []).length > 0 && !selectedDate) {
                    setSelectedDate(data.backups[0].date);
                }
            } catch (err: any) {
                toast.error(err?.message || 'Failed to load backups');
            } finally {
                if (!cancelled) setLoadingBackups(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* inspect selected backup */
    useEffect(() => {
        if (!selectedBackup) {
            setMetadata(null);
            setCollections([]);
            setSelectedCollection('');
            return;
        }
        let cancelled = false;
        (async () => {
            setLoadingInspect(true);
            setSelectedCollection('');
            setDocs([]);
            try {
                const res = await fetch(
                    `/api/admin/backups/inspect?url=${encodeURIComponent(selectedBackup.secure_url)}`,
                    { cache: 'no-store' },
                );
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to inspect');
                if (cancelled) return;
                setMetadata(data.metadata);
                setCollections(data.collections || []);
            } catch (err: any) {
                toast.error(err?.message || 'Failed to inspect backup');
            } finally {
                if (!cancelled) setLoadingInspect(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selectedBackup]);

    /* fetch documents page */
    const loadDocsPage = useCallback(
        async (collName: string, p: number) => {
            if (!selectedBackup || !collName) return;
            setDocsLoading(true);
            try {
                const res = await fetch(
                    `/api/admin/backups/collection?url=${encodeURIComponent(
                        selectedBackup.secure_url,
                    )}&name=${encodeURIComponent(collName)}&page=${p}&pageSize=${pageSize}`,
                    { cache: 'no-store' },
                );
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load page');
                setDocs(data.documents || []);
                setPage(data.page || 1);
                setTotal(data.total || 0);
                setTotalPages(data.totalPages || 1);
            } catch (err: any) {
                toast.error(err?.message || 'Failed to load page');
            } finally {
                setDocsLoading(false);
            }
        },
        [selectedBackup],
    );

    useEffect(() => {
        if (!selectedCollection) {
            setDocs([]);
            setPage(1);
            setTotal(0);
            setTotalPages(1);
            setSearch('');
            setFilters([]);
            return;
        }
        loadDocsPage(selectedCollection, 1);
    }, [selectedCollection, loadDocsPage]);

    /* derived: filter dropdown options */
    const fieldOptions = useMemo(() => extractFieldPaths(docs), [docs]);

    /* derived: filtered docs (client-side, current page only) */
    const filteredDocs = useMemo(() => {
        let list = docs;
        if (search.trim()) list = list.filter(d => plainSubstringMatch(d, search.trim()));
        if (filters.length > 0) {
            list = list.filter(d => filters.every(f => applyFilter(d, f)));
        }
        return list;
    }, [docs, search, filters]);

    /* dropdown options */
    const dateOptions = useMemo(
        () =>
            backups.map(b => ({
                value: b.date,
                label: `${b.date}  ·  ${formatBytes(b.bytes)}`,
            })),
        [backups],
    );

    const collectionOptions = useMemo(() => {
        const q = collectionFilter.trim().toLowerCase();
        const filtered = q
            ? collections.filter(c => c.name.toLowerCase().includes(q))
            : collections;
        return filtered.map(c => ({
            value: c.name,
            label: `${c.name}  (${c.count.toLocaleString()})`,
        }));
    }, [collections, collectionFilter]);

    const operatorOptions = useMemo(
        () => OPERATORS.map(o => ({ value: o.value, label: o.label })),
        [],
    );

    const fieldDropdownOptions = useMemo(
        () => fieldOptions.map(f => ({ value: f, label: f })),
        [fieldOptions],
    );

    /* actions */
    const onCopyPage = async () => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(filteredDocs, null, 2));
            toast.success(`Copied ${filteredDocs.length} document(s)`);
        } catch {
            toast.error('Could not copy to clipboard');
        }
    };

    const onDownloadAll = async () => {
        if (!selectedBackup || !selectedCollection) return;
        setDownloading(true);
        try {
            const res = await fetch(
                `/api/admin/backups/collection?url=${encodeURIComponent(
                    selectedBackup.secure_url,
                )}&name=${encodeURIComponent(selectedCollection)}&full=true`,
                { cache: 'no-store' },
            );
            const data = await res.json();
            if (!res.ok || !data.ok) throw new Error(data.error || 'Download failed');

            const blob = new Blob([JSON.stringify(data.documents, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedBackup.date}-${selectedCollection}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            toast.success(`Downloaded ${data.count.toLocaleString()} documents`);
        } catch (err: any) {
            toast.error(err?.message || 'Download failed');
        } finally {
            setDownloading(false);
        }
    };

    const addFilter = () => {
        setFilters(prev => [
            ...prev,
            {
                id: Math.random().toString(36).slice(2),
                field: fieldOptions[0] || '_id',
                operator: 'contains',
                value: '',
            },
        ]);
    };
    const removeFilter = (id: string) => setFilters(prev => prev.filter(f => f.id !== id));
    const updateFilter = (id: string, patch: Partial<FilterRow>) =>
        setFilters(prev => prev.map(f => (f.id === id ? { ...f, ...patch } : f)));

    /* ─── Render ──────────────────────────────────────────── */

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            {/* header */}
            <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="px-4 py-2.5 flex items-center gap-3">
                    <Link
                        href="/admin/settings"
                        className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Settings
                    </Link>
                    <span className="text-muted-foreground">/</span>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Database className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">
                            Backups
                        </h1>
                    </div>
                </div>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto p-6 space-y-6">
                    {/* selectors */}
                    <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
                        <div className="flex items-center gap-2">
                            <HardDrive className="w-4 h-4 text-primary" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                                Browse Backups
                            </h2>
                            {loadingBackups && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                            )}
                            <div className="flex-1" />
                            <span className="text-[11px] text-muted-foreground">
                                {backups.length} backup{backups.length === 1 ? '' : 's'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Backup Date
                                </label>
                                <SearchableSelect
                                    options={dateOptions}
                                    value={selectedDate}
                                    onChange={setSelectedDate}
                                    placeholder={
                                        loadingBackups
                                            ? 'Loading…'
                                            : backups.length === 0
                                              ? 'No backups yet'
                                              : 'Select a date'
                                    }
                                />
                                {selectedBackup && (
                                    <a
                                        href={selectedBackup.secure_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Open raw .json.gz
                                    </a>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Collection
                                </label>
                                <input
                                    type="text"
                                    placeholder="Filter collections by name…"
                                    value={collectionFilter}
                                    onChange={e => setCollectionFilter(e.target.value)}
                                    className="w-full h-9 px-3 bg-background border border-border rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground text-foreground"
                                    disabled={!selectedBackup || loadingInspect}
                                />
                                <SearchableSelect
                                    options={collectionOptions}
                                    value={selectedCollection}
                                    onChange={setSelectedCollection}
                                    placeholder={
                                        loadingInspect
                                            ? 'Loading…'
                                            : collections.length === 0
                                              ? 'Pick a date first'
                                              : 'Select a collection'
                                    }
                                />
                            </div>
                        </div>

                        {metadata && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                                <Stat label="DB" value={metadata.dbName} />
                                <Stat
                                    label="Collections"
                                    value={metadata.collectionCount.toLocaleString()}
                                />
                                <Stat label="Documents" value={metadata.totalDocs.toLocaleString()} />
                                <Stat label="Size" value={formatBytes(metadata.sizeBytes)} />
                            </div>
                        )}
                    </div>

                    {/* viewer */}
                    {selectedCollection && (
                        <div className="rounded-lg border border-border bg-card/40 p-4 space-y-4">
                            {/* toolbar */}
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[220px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Quick search across page…"
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="pl-8 pr-3 h-9 w-full bg-background border border-border rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground text-foreground"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFiltersOpen(o => !o)}
                                    className={cn(
                                        'h-9 px-3 rounded border text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer',
                                        filtersOpen
                                            ? 'bg-primary/15 border-primary/40 text-foreground'
                                            : 'bg-background border-border text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    Filters
                                    {filters.length > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 rounded bg-primary text-black text-[10px]">
                                            {filters.length}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={onCopyPage}
                                    className="h-9 px-3 rounded border border-border bg-background hover:bg-secondary/60 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy page
                                </button>
                                <button
                                    type="button"
                                    onClick={onDownloadAll}
                                    disabled={downloading}
                                    className="h-9 px-3 rounded bg-primary text-black hover:opacity-90 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                                >
                                    {downloading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" />
                                    )}
                                    Download all
                                </button>
                            </div>

                            {/* filter panel */}
                            {filtersOpen && (
                                <div className="rounded border border-border bg-background/60 p-3 space-y-2">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Filter className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-[11px] font-black uppercase tracking-widest text-foreground">
                                            Field-level filters
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            (multiple filters AND together; case-insensitive)
                                        </span>
                                    </div>

                                    {filters.length === 0 && (
                                        <p className="text-[11px] text-muted-foreground">
                                            No filters yet. Add one below.
                                        </p>
                                    )}

                                    {filters.map(f => {
                                        const hideValue =
                                            f.operator === 'exists' || f.operator === 'not_exists';
                                        return (
                                            <div
                                                key={f.id}
                                                className="grid grid-cols-12 gap-2 items-center"
                                            >
                                                <div className="col-span-4">
                                                    <SearchableSelect
                                                        options={fieldDropdownOptions}
                                                        value={f.field}
                                                        onChange={v => updateFilter(f.id, { field: v })}
                                                        placeholder="Field"
                                                    />
                                                </div>
                                                <div className="col-span-3">
                                                    <SearchableSelect
                                                        options={operatorOptions}
                                                        value={f.operator}
                                                        onChange={v =>
                                                            updateFilter(f.id, {
                                                                operator: v as Operator,
                                                            })
                                                        }
                                                        placeholder="Operator"
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    {!hideValue && (
                                                        <input
                                                            type="text"
                                                            value={f.value}
                                                            onChange={e =>
                                                                updateFilter(f.id, {
                                                                    value: e.target.value,
                                                                })
                                                            }
                                                            placeholder="Value"
                                                            className="w-full h-9 px-3 bg-background border border-border rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/30 placeholder:text-muted-foreground text-foreground"
                                                        />
                                                    )}
                                                </div>
                                                <div className="col-span-1 flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFilter(f.id)}
                                                        className="h-9 w-9 rounded border border-border hover:bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
                                                        aria-label="Remove filter"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <button
                                        type="button"
                                        onClick={addFilter}
                                        className="h-8 px-3 rounded border border-dashed border-border hover:border-primary/40 text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Add filter
                                    </button>
                                </div>
                            )}

                            {/* pagination row */}
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <div>
                                    {docsLoading ? (
                                        <span className="flex items-center gap-1.5">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Loading…
                                        </span>
                                    ) : (
                                        <>
                                            <span className="text-foreground font-semibold">
                                                {filteredDocs.length}
                                            </span>{' '}
                                            of{' '}
                                            <span className="text-foreground font-semibold">
                                                {docs.length}
                                            </span>{' '}
                                            on this page · {total.toLocaleString()} total
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={page <= 1 || docsLoading}
                                        onClick={() =>
                                            loadDocsPage(selectedCollection, Math.max(1, page - 1))
                                        }
                                        className="h-7 w-7 rounded border border-border hover:bg-secondary/60 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                                        aria-label="Previous page"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="px-2">
                                        Page {page} of {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={page >= totalPages || docsLoading}
                                        onClick={() =>
                                            loadDocsPage(
                                                selectedCollection,
                                                Math.min(totalPages, page + 1),
                                            )
                                        }
                                        className="h-7 w-7 rounded border border-border hover:bg-secondary/60 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                                        aria-label="Next page"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            {/* json viewer */}
                            <pre className="bg-background border border-border rounded p-3 text-[11px] leading-relaxed overflow-auto max-h-[60vh] text-foreground">
                                {filteredDocs.length === 0
                                    ? '// no documents match'
                                    : JSON.stringify(filteredDocs, null, 2)}
                            </pre>
                        </div>
                    )}

                    {!selectedCollection && selectedBackup && !loadingInspect && (
                        <div className="rounded-lg border border-dashed border-border bg-card/20 p-8 text-center text-[12px] text-muted-foreground">
                            Pick a collection to view its documents.
                        </div>
                    )}

                    {!selectedBackup && !loadingBackups && (
                        <div className="rounded-lg border border-dashed border-border bg-card/20 p-8 text-center text-[12px] text-muted-foreground">
                            No backup selected. {backups.length === 0 && 'Run `npm run backup` to create your first one.'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded border border-border bg-background/60 px-3 py-2">
            <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                {label}
            </div>
            <div className="text-[12px] font-bold text-foreground truncate">{value}</div>
        </div>
    );
}
