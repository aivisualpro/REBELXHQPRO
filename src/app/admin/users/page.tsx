'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  ArrowUpDown, Plus, Search, X, Loader2, Mail, Phone, Upload, Edit2, Trash2, Users,
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  email: string;
  phone?: string;
  hourlyRate?: number;
  profileImage?: string;
  status: 'Active' | 'Inactive';
}

const ROLES = ['SuperAdmin', 'Admin', 'Executive Assistant', 'QC', 'Warehouse', 'Sales Director', 'Sales', 'Sales Executive', 'Manager', 'Shipping'];
const DEPARTMENTS = ['Admin', 'Finance', 'Manufacturing', 'Sales', 'Warehouse', 'Marketing'];

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry {
  users: User[]; hasMore: boolean; page: number;
  sortBy: string; sortOrder: string; search: string; status: string; timestamp: number;
}
const globalCache: { current: CacheEntry | null } = { current: null };
const CACHE_TTL = 120_000;
const PAGE_SIZE = 50;

// ─── Columns ─────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'firstName', label: 'Name', width: 'w-[200px]' },
  { key: 'role', label: 'Role', width: 'w-[140px]' },
  { key: 'department', label: 'Department', width: 'w-[120px]' },
  { key: 'email', label: 'Email', width: 'w-[220px]' },
  { key: 'phone', label: 'Phone', width: 'w-[120px]' },
  { key: 'hourlyRate', label: 'Rate', width: 'w-[80px]', align: 'text-right' as const },
  { key: 'status', label: 'Status', width: 'w-[80px]' },
];

// ─── Skeleton Row ────────────────────────────────────────────────────────────

function UserSkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-border/30">
      {COLUMNS.map(col => (
        <td key={col.key} className={cn('px-2.5 py-2.5', col.width)}>
          <div className={cn('h-3.5 rounded-sm bg-secondary/80 animate-pulse',
            col.key === 'firstName' ? 'w-4/5' : col.key === 'email' ? 'w-3/4' : 'w-3/5'
          )} style={{ animationDelay: `${index * 30}ms` }} />
        </td>
      ))}
      <td className="w-[60px] px-2.5 py-2.5"><div className="h-3.5 w-8 mx-auto rounded-sm bg-secondary/80 animate-pulse" style={{ animationDelay: `${index * 30}ms` }} /></td>
    </tr>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────

function UserStatusBadge({ status }: { status: string }) {
  const isActive = status === 'Active';
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30')} />
      <span className={cn('text-[10px] font-black uppercase tracking-tight', isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
        {status}
      </span>
    </div>
  );
}

// ─── Table Row ───────────────────────────────────────────────────────────────

const UserTableRow = React.memo(function UserTableRow({
  user, onClick, onEdit, onDelete, highlight
}: { user: User; onClick: () => void; onEdit: () => void; onDelete: () => void; highlight?: boolean }) {
  return (
    <tr data-user-id={user._id}
      className={cn(
        'group hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer border-b border-border/60',
        highlight && 'animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]'
      )}
      onClick={onClick}>
      {/* Name + Avatar */}
      <td className="px-2.5 py-2.5 w-[200px]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-secondary border border-border rounded flex items-center justify-center overflow-hidden shrink-0">
            {user.profileImage ? (
              <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] font-black text-muted-foreground uppercase">{user.firstName?.[0]}{user.lastName?.[0]}</span>
            )}
          </div>
          <span className="text-[12px] font-semibold text-foreground/90 group-hover:text-foreground transition-colors truncate">
            {user.firstName} {user.lastName}
          </span>
        </div>
      </td>
      <td className="px-2.5 py-2.5 w-[140px] text-[11px] uppercase font-bold text-foreground/60">{user.role}</td>
      <td className="px-2.5 py-2.5 w-[120px] text-[11px] uppercase font-bold text-foreground/50 tracking-tight">{user.department === 'SUPERADMIN' ? 'Admin' : user.department}</td>
      <td className="px-2.5 py-2.5 w-[220px] text-[12px] text-foreground/70 truncate">
        <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-muted-foreground/40 shrink-0" /><span className="truncate">{user.email}</span></div>
      </td>
      <td className="px-2.5 py-2.5 w-[120px] text-[12px] text-foreground/70 font-mono">
        <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground/40 shrink-0" /><span>{user.phone || '—'}</span></div>
      </td>
      <td className="px-2.5 py-2.5 w-[80px] text-[12px] font-mono font-bold text-foreground/90 text-right tabular-nums">
        {user.hourlyRate ? `$${user.hourlyRate}` : <span className="text-muted-foreground/30">—</span>}
      </td>
      <td className="px-2.5 py-2.5 w-[80px]"><UserStatusBadge status={user.status} /></td>
      <td className="px-2.5 py-2.5 w-[60px] text-center">
        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onEdit(); }} className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded cursor-pointer"><Edit2 className="w-3 h-3" /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors rounded cursor-pointer"><Trash2 className="w-3 h-3" /></button>
        </div>
      </td>
    </tr>
  );
});

// ─── Main Component ──────────────────────────────────────────────────────────

function UsersContent() {
  const router = useRouter();
  const { data: session } = useSession();

  const [users, setUsers] = useState<User[]>(globalCache.current?.users || []);
  const [isLoading, setIsLoading] = useState(!globalCache.current);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(globalCache.current?.hasMore ?? true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeStatus, setActiveStatus] = useState<string>('All');

  const pageRef = useRef(globalCache.current?.page || 0);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

  // Scroll-back & highlight
  const [highlightId, setHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const savedId = sessionStorage.getItem('user_scroll_to');
    const savedScroll = sessionStorage.getItem('user_scroll_top');
    if (savedId) {
      sessionStorage.removeItem('user_scroll_to'); sessionStorage.removeItem('user_scroll_top');
      setHighlightId(savedId);
      if (savedScroll && scrollRef.current) scrollRef.current.scrollTop = parseInt(savedScroll, 10);
      const tryScroll = (attempts = 0) => {
        const row = document.querySelector(`[data-user-id="${savedId}"]`);
        if (row) { setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); setTimeout(() => setHighlightId(null), 3000); }
        else if (attempts < 30) setTimeout(() => tryScroll(attempts + 1), 200);
      };
      setTimeout(() => tryScroll(), 100);
    }
  }, []);

  // Status counts
  const STATUS_TABS = ['All', 'Active', 'Inactive'] as const;
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({ All: 0, Active: 0, Inactive: 0 });
  const [countsLoaded, setCountsLoaded] = useState(false);
  const fetchStatusCounts = useCallback(async () => {
    try { const res = await fetch('/api/users/counts'); if (res.ok) { const d = await res.json(); if (d.counts) { setStatusCounts(d.counts); setCountsLoaded(true); } } } catch { }
  }, []);
  useEffect(() => { fetchStatusCounts(); }, [fetchStatusCounts]);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', role: ROLES[3], department: DEPARTMENTS[0], phone: '', hourlyRate: 0, profileImage: '', status: 'Active' as 'Active' | 'Inactive' });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setFormData(prev => ({ ...prev, profileImage: data.url }));
    } catch { toast.error('Failed to upload image'); } finally { setUploading(false); }
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ firstName: user.firstName, lastName: user.lastName, email: user.email, password: '', role: user.role, department: user.department, phone: user.phone || '', hourlyRate: user.hourlyRate || 0, profileImage: user.profileImage || '', status: user.status });
    } else {
      setEditingUser(null);
      setFormData({ firstName: '', lastName: '', email: '', password: '', role: ROLES[3], department: DEPARTMENTS[0], phone: '', hourlyRate: 0, profileImage: '', status: 'Active' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';
      const payload = { ...formData }; if (editingUser && !payload.password) delete (payload as any).password;
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setIsModalOpen(false); refreshUsers(); fetchStatusCounts(); toast.success(editingUser ? 'User updated' : 'User created'); }
      else { const err = await res.json(); toast.error(err.error || 'Error saving user'); }
    } catch { toast.error('Error saving user'); } finally { setIsSubmitting(false); }
  };

  const handleDelete = (id: string) => {
    confirmDeleteToast('Delete this user?', async () => {
      try { const res = await fetch(`/api/users/${id}`, { method: 'DELETE' }); if (res.ok) { refreshUsers(); fetchStatusCounts(); toast.success('User deleted'); } } catch { toast.error('Error deleting user'); }
    });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        try {
          const res = await fetch('/api/users/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: results.data }) });
          if (res.ok) { toast.success('Import successful'); refreshUsers(); fetchStatusCounts(); } else { const err = await res.json(); toast.error('Import failed: ' + err.error); }
        } catch { toast.error('Import error'); }
      },
    });
  };

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (pageNum: number, isAppend: boolean) => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const seq = ++seqRef.current; fetchingRef.current = true;
    if (isAppend) setIsLoadingMore(true); else setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(PAGE_SIZE), sortBy, sortOrder, search: debouncedSearch });
      if (activeStatus !== 'All') params.set('status', activeStatus);
      const res = await fetch(`/api/users?${params}`, { signal: ctrl.signal });
      const data = await res.json();
      if (seq !== seqRef.current || !mountedRef.current) return;
      if (res.ok) {
        const newUsers = data.users || []; const newHasMore = data.hasMore ?? false;
        if (isAppend) {
          setUsers(prev => {
            const ids = new Set(prev.map(u => u._id));
            const merged = [...prev, ...newUsers.filter((u: User) => !ids.has(u._id))];
            globalCache.current = { users: merged, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, timestamp: Date.now() };
            return merged;
          });
        } else {
          setUsers(newUsers);
          globalCache.current = { users: newUsers, hasMore: newHasMore, page: pageNum, sortBy, sortOrder, search: debouncedSearch, status: activeStatus, timestamp: Date.now() };
        }
        setHasMore(newHasMore); pageRef.current = pageNum; setError(null);
      } else { setError(data.error || 'Failed to fetch'); }
    } catch (e: any) { if (e?.name === 'AbortError') return; if (mountedRef.current) setError(e.message); }
    finally { fetchingRef.current = false; if (mountedRef.current) { setIsLoading(false); setIsLoadingMore(false); } }
  }, [sortBy, sortOrder, debouncedSearch, activeStatus]);

  const fetchPageRef = useRef(fetchPage); fetchPageRef.current = fetchPage;
  const isFirstMount = useRef(true);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      const c = globalCache.current;
      if (c && c.users.length > 0 && (Date.now() - c.timestamp) < CACHE_TTL && c.sortBy === sortBy && c.sortOrder === sortOrder && c.search === debouncedSearch && c.status === activeStatus) {
        setUsers(c.users); setHasMore(c.hasMore); pageRef.current = c.page; setIsLoading(false); return;
      }
    }
    globalCache.current = null; pageRef.current = 0; setUsers([]); setHasMore(true);
    fetchPageRef.current(1, false);
  }, [sortBy, sortOrder, debouncedSearch, activeStatus]);

  useEffect(() => {
    const sentinel = sentinelRef.current; const container = scrollRef.current;
    if (!sentinel || !container) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && hasMore && !fetchingRef.current && !isLoading) fetchPage(pageRef.current + 1, true);
    }, { root: container, rootMargin: '600px' });
    obs.observe(sentinel); return () => obs.disconnect();
  }, [hasMore, isLoading, fetchPage]);

  const handleSort = (column: string) => {
    if (sortBy === column) setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortBy(column); setSortOrder('asc'); }
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleTabChange = (tab: string) => { setActiveStatus(tab); scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); };
  const refreshUsers = () => { globalCache.current = null; pageRef.current = 0; setUsers([]); setHasMore(true); fetchPageRef.current(1, false); };

  const statusColors: Record<string, { bg: string; color: string; hoverBg: string }> = {
    'All': { bg: '#fe9900', color: '#ffffff', hoverBg: 'rgba(254,153,0,0.08)' },
    'Active': { bg: '#16a34a', color: '#ffffff', hoverBg: 'rgba(22,163,74,0.08)' },
    'Inactive': { bg: '#dc2626', color: '#ffffff', hoverBg: 'rgba(220,38,38,0.08)' },
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* Header */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-4 py-2.5 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Users className="w-4 h-4 text-primary" />
            <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Users</h1>
          </div>
          <div className="h-5 w-px bg-border shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {STATUS_TABS.map(tab => {
              const sc = statusColors[tab]; const isActive = activeStatus === tab;
              return (
                <button key={tab} onClick={() => handleTabChange(tab)}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all cursor-pointer"
                  style={isActive ? { backgroundColor: sc?.bg, color: sc?.color, boxShadow: '0 1px 4px rgba(0,0,0,0.15)' } : { color: 'inherit', backgroundColor: 'transparent' }}
                  onMouseEnter={e => { if (!isActive && sc) (e.currentTarget as HTMLButtonElement).style.backgroundColor = sc.hoverBg; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}>
                  {tab}
                  <span className="ml-1.5 text-[11px] tabular-nums" style={{ opacity: isActive ? 0.75 : 0.5 }}>
                    {countsLoaded ? statusCounts[tab]?.toLocaleString() || 0 : <span className="inline-block w-4 h-3 rounded-sm bg-muted-foreground/10 animate-pulse align-middle" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-8 h-8 w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded" />
            {search && (<button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer"><X className="h-3 w-3" /></button>)}
          </div>
          {/* Import CSV */}
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <button onClick={() => csvInputRef.current?.click()}
            className="flex items-center space-x-1.5 px-3 h-8 text-[10px] font-bold uppercase tracking-wider rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0">
            <Upload className="w-3.5 h-3.5" /><span>Import</span>
          </button>
          {/* Add */}
          <button onClick={() => openModal()}
            className="h-8 px-3 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer shrink-0">
            <Plus className="w-3.5 h-3.5" /><span className="text-[11px] font-black uppercase tracking-widest">Add</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-auto scrollbar-custom relative">
        <div className="min-w-fit px-2 py-1">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0 table-fixed">
            <thead className="bg-background border-b border-border sticky top-0 z-10 box-border">
              <tr>
                {COLUMNS.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)}
                    className={cn(
                      'px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/60 dark:hover:bg-secondary/50 transition-colors border-r border-border/40 last:border-0 select-none shadow-[0_1px_0_0_hsl(var(--border))]',
                      col.width, col.align || 'text-left'
                    )}>
                    <div className={cn('flex items-center gap-1', col.align === 'text-right' && 'justify-end')}>
                      <span>{col.label}</span>
                      <ArrowUpDown className={cn('w-2.5 h-2.5 transition-colors', sortBy === col.key ? 'text-primary' : 'text-muted-foreground/25')} />
                    </div>
                  </th>
                ))}
                <th className="px-2.5 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest text-center w-[60px] shadow-[0_1px_0_0_hsl(var(--border))]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 25 }).map((_, i) => <UserSkeletonRow key={i} index={i} />)
              ) : error ? (
                <tr><td colSpan={8} className="px-2 py-8 text-center text-destructive text-[12px]">{error}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8} className="px-2 py-16 text-center">
                  <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-[12px] text-muted-foreground/50 uppercase tracking-widest font-bold">
                    {debouncedSearch ? 'No matching users' : activeStatus !== 'All' ? `No ${activeStatus} users` : 'No users found'}
                  </p>
                </td></tr>
              ) : (
                users.map(user => (
                  <UserTableRow key={user._id} user={user} highlight={highlightId === user._id}
                    onClick={() => {
                      sessionStorage.setItem('user_scroll_to', user._id);
                      if (scrollRef.current) sessionStorage.setItem('user_scroll_top', String(scrollRef.current.scrollTop));
                      router.push(`/profile/${user._id}`);
                    }}
                    onEdit={() => openModal(user)}
                    onDelete={() => handleDelete(user._id)} />
                ))
              )}
              {isLoadingMore && Array.from({ length: 8 }).map((_, i) => <UserSkeletonRow key={`m-${i}`} index={i} />)}
            </tbody>
          </table>
          <div ref={sentinelRef} className="h-1" />
          {!isLoading && !hasMore && users.length > 0 && (
            <div className="flex items-center justify-center py-4 gap-2">
              <div className="h-px w-12 bg-border" />
              <span className="text-[12px] text-muted-foreground/40 uppercase tracking-widest font-bold">{users.length} users loaded</span>
              <div className="h-px w-12 bg-border" />
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-background border border-border w-full max-w-lg shadow-2xl rounded-md animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-secondary/20">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{editingUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">First Name <span className="text-red-500">*</span></label>
                  <input required value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 rounded" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Last Name <span className="text-red-500">*</span></label>
                  <input required value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 rounded" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email <span className="text-red-500">*</span></label>
                <input type="email" required disabled={!!editingUser} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 disabled:opacity-50 rounded" placeholder="name@company.com" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Profile Image</label>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary border border-border overflow-hidden shrink-0 rounded">
                    {formData.profileImage ? (<img src={formData.profileImage} alt="" className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-muted-foreground"><Upload className="w-4 h-4" /></div>)}
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading}
                    className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50 file:rounded file:cursor-pointer" />
                </div>
                {uploading && <p className="text-[10px] text-muted-foreground animate-pulse">Uploading...</p>}
              </div>
              {!editingUser && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Password <span className="text-red-500">*</span></label>
                  <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 rounded" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Role</label>
                  <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 rounded">
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Department</label>
                  <select value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 rounded">
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone</label>
                  <input value={formData.phone} onChange={e => {
                    const input = e.target.value.replace(/\D/g, '').slice(0, 10);
                    let fmt = input;
                    if (input.length > 3 && input.length <= 6) fmt = `${input.slice(0, 3)} ${input.slice(3)}`;
                    else if (input.length > 6) fmt = `${input.slice(0, 3)} ${input.slice(3, 6)} ${input.slice(6)}`;
                    setFormData({ ...formData, phone: fmt });
                  }} className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 rounded" placeholder="000 000 0000" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Hourly Rate ($)</label>
                  <input type="number" value={formData.hourlyRate} onChange={e => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                    className="w-full px-3 h-[36px] bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10 rounded" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                <div className="flex items-center gap-4 mt-1">
                  {(['Active', 'Inactive'] as const).map(s => (
                    <label key={s} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="status" value={s} checked={formData.status === s} onChange={() => setFormData({ ...formData, status: s })} className="text-primary focus:ring-primary" />
                      <span className="text-sm font-medium text-foreground">{s}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="pt-4 flex items-center justify-end gap-3 border-t border-border">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting}
                  className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 rounded cursor-pointer">
                  {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{editingUser ? 'Save Changes' : 'Create User'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
        <div className="shrink-0 border-b border-border bg-background px-4 py-2.5 flex items-center gap-4">
          <div className="h-4 w-4 rounded bg-secondary animate-pulse" />
          <div className="h-4 w-24 rounded bg-secondary animate-pulse" />
          <div className="h-5 w-px bg-border" />
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-6 w-16 rounded-lg bg-secondary animate-pulse" />)}
        </div>
        <div className="flex-1 p-2">
          <table className="w-full"><tbody>
            {Array.from({ length: 20 }).map((_, i) => <UserSkeletonRow key={i} index={i} />)}
          </tbody></table>
        </div>
      </div>
    }>
      <UsersContent />
    </Suspense>
  );
}
