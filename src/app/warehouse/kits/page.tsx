'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ArrowUpDown,
  X,
  Trash2,
  Edit2,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
import { Pagination } from '@/components/ui/Pagination';

interface Kit {
  _id: string;
  legacyId?: string;
  name: string;
  createdBy?: { firstName: string; lastName: string };
  createdAt: string;
  lineItems: any[];
}

function KitsPageContent() {
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal & Actions State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedKit, setSelectedKit] = useState<Kit | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  // Read search from URL (set by main header)
  const search = searchParams.get('search') || '';

  // Listen for createNew param from header Add button
  useEffect(() => {
    if (searchParams.get('createNew') === 'true') {
      setModalMode('create');
      setSelectedKit(null);
      setFormData({ name: '' });
      setIsModalOpen(true);
      // Remove createNew from URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('createNew');
      router.replace(`/warehouse/kits${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    fetchKits();
  }, [page, search, sortBy, sortOrder]);

  const fetchKits = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        sortBy,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
      });

      const res = await fetch(`/api/kits?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setKits(data.kits || []);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      } else {
        toast.error('Failed to fetch kits');
      }
    } catch (e) {
      toast.error('Error loading kits');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const openModal = (mode: 'create' | 'edit', kit?: Kit) => {
    setModalMode(mode);
    setSelectedKit(kit || null);

    if (mode === 'create') {
      setFormData({ name: '' });
    } else if (mode === 'edit' && kit) {
      setFormData({ name: kit.name });
    }
    setIsModalOpen(true);
  };

  const handleSaveKit = async () => {
    if (!formData.name) {
      return toast.error("Name is required");
    }
    setSaving(true);
    try {
      let url = '/api/kits';
      let method = 'POST';
      let payload: any = {
        ...formData,
        createdBy: (session?.user as any)?._id
      };

      if (modalMode === 'edit' && selectedKit) {
        url = `/api/kits/${selectedKit._id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        toast.success(modalMode === 'edit' ? 'Kit updated!' : 'Kit created!');
        setIsModalOpen(false);
        fetchKits();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save kit");
      }
    } catch (e) {
      toast.error("Error saving kit");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    confirmDeleteToast('Delete this kit?', async () => {
      try {
        const res = await fetch(`/api/kits/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success("Kit deleted");
          fetchKits();
        } else {
          toast.error("Failed to delete");
        }
      } catch (e) {
        toast.error("Error deleting kit");
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300 relative">
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
            <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
              <tr>
                {[
                  { key: 'name', label: 'Name' },
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
                <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-background/50">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-slate-400">Loading Kits...</td></tr>
              ) : kits.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Kits found</td></tr>
              ) : kits.map(kit => (
                <tr
                  key={kit._id}
                  className="hover:bg-secondary/40 transition-all duration-200 group relative z-0 hover:z-10 bg-background"
                >
                  <td className="px-4 py-2 text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px] border-r border-border">{kit.name}</td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground font-mono border-r border-border">{new Date(kit.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-[11px] text-muted-foreground border-r border-border">
                    {kit.createdBy ? `${kit.createdBy.firstName} ${kit.createdBy.lastName}` : '-'}
                  </td>
                  <td className="px-4 py-2 text-center text-[11px] text-muted-foreground border-r border-border">{kit.lineItems?.length || 0}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => router.push(`/warehouse/kits/${kit._id}`)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openModal('edit', kit)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(kit._id)}
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
          itemName="Kits"
        />
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-background w-full max-w-md animate-in fade-in zoom-in duration-200 border border-border shadow-2xl rounded overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-secondary/50">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                {modalMode === 'create' ? 'New Kit' : 'Edit Kit'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-2">Kit Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground font-medium"
                  placeholder="e.g. Holiday Gift Set"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="px-6 py-4 bg-secondary/50 border-t border-border flex justify-end">
              <button
                onClick={handleSaveKit}
                disabled={saving}
                className="px-8 h-10 bg-primary text-black text-[11px] font-black uppercase tracking-widest rounded hover:opacity-90 transition-all shadow-md disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Saving...' : (modalMode === 'create' ? 'Create Kit' : 'Save Changes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KitsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><span className="text-xs text-muted-foreground">Loading...</span></div>}>
      <KitsPageContent />
    </Suspense>
  );
}
