'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import {
  ArrowUpDown,
  ExternalLink,
  Edit2,
  Trash2,
  X,
  Loader2,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
import { Pagination } from '@/components/ui/Pagination';
import { useRouter, useSearchParams } from 'next/navigation';

interface LabResult {
  _id: string;
  name: string;
  variations: string[];
  brand: string;
  labTestStatus: string;
  labResultDate?: string;
  company: string;
  link: string;
}

function LabResultsPageContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Sorting
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal & CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LabResult | null>(null);
  const [formData, setFormData] = useState<Partial<LabResult>>({});
  const [saving, setSaving] = useState(false);

  // Read search from URL (set by main header)
  const search = searchParams.get('search') || '';

  // Listen for createNew param from header Add button
  useEffect(() => {
    if (searchParams.get('createNew') === 'true') {
      setEditingItem(null);
      setFormData({
        name: '',
        variations: [],
        brand: '',
        labTestStatus: 'PENDING',
        company: '',
        link: '',
        labResultDate: new Date().toISOString().split('T')[0]
      });
      setIsModalOpen(true);
      // Remove createNew from URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete('createNew');
      router.replace(`/warehouse/lab-results${params.toString() ? '?' + params.toString() : ''}`, { scroll: false });
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    fetchResults();
  }, [page, search, sortBy, sortOrder]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search,
        sortBy,
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
      });

      const res = await fetch(`/api/lab-results?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data.labResults || []);
        setTotalPages(data.totalPages || 1);
        setTotalItems(data.total || 0);
      } else {
        toast.error('Failed to fetch data');
      }
    } catch (error) {
      toast.error('Error loading data');
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

  const openModal = (item?: LabResult) => {
    setEditingItem(item || null);
    if (item) {
      setFormData({
        ...item,
        labResultDate: item.labResultDate ? item.labResultDate.split('T')[0] : ''
      });
    } else {
      setFormData({
        name: '',
        variations: [],
        brand: '',
        labTestStatus: 'PENDING',
        company: '',
        link: '',
        labResultDate: new Date().toISOString().split('T')[0]
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      const url = editingItem ? `/api/lab-results/${editingItem._id}` : '/api/lab-results';
      const method = editingItem ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success(editingItem ? 'Updated successfully' : 'Created successfully');
      setIsModalOpen(false);
      fetchResults();
    } catch (error) {
      toast.error('Error saving lab result');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    confirmDeleteToast('Delete this result?', async () => {
      try {
        const res = await fetch(`/api/lab-results/${id}`, { method: 'DELETE' });
        if (res.ok) {
          toast.success('Deleted successfully');
          fetchResults();
        } else {
          toast.error('Failed to delete');
        }
      } catch (error) {
        toast.error('Error deleting item');
      }
    });
  };

  // Helper to handle comma-separated variations input
  const handleVariationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, variations: val.split(',').map(s => s.trim()) });
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'variations', label: 'Variations' },
    { key: 'brand', label: 'Brand' },
    { key: 'labTestStatus', label: 'Status' },
    { key: 'labResultDate', label: 'Date' },
    { key: 'company', label: 'Company' },
    { key: 'link', label: 'Link' },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-secondary/50 z-10 border-b border-border">
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary transition-colors border-r border-border last:border-r-0"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-foreground" : "text-muted-foreground/30")} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-muted-foreground">Loading...</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-muted-foreground uppercase font-bold tracking-tighter opacity-50">No records found</td></tr>
            ) : results.map(item => (
              <tr key={item._id} className="hover:bg-secondary/30 transition-colors group">
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground border-r border-border">{item.name}</td>
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground border-r border-border">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {item.variations?.map((v, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 bg-secondary rounded text-[9px] text-muted-foreground">{v}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground border-r border-border">{item.brand}</td>
                <td className="px-4 py-1.5 border-r border-border">
                  <span className={cn(
                    "px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border",
                    item.labTestStatus === 'PASS' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      item.labTestStatus === 'FAIL' ? "bg-red-50 text-red-700 border-red-100" :
                        "bg-secondary text-muted-foreground border-border"
                  )}>
                    {item.labTestStatus || 'PENDING'}
                  </span>
                </td>
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground border-r border-border">
                  {item.labResultDate ? new Date(item.labResultDate).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground border-r border-border">{item.company}</td>
                <td className="px-4 py-1.5 text-[11px] border-r border-border">
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : '-'}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openModal(item)} className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item._id)} className="p-1 hover:bg-red-50 rounded text-muted-foreground hover:text-red-600 transition-colors" title="Delete">
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
        itemName="Items"
      />

      {/* CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200 border border-border">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">{editingItem ? 'Edit Result' : 'New Lab Result'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Name</label>
                <input
                  required
                  className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Product Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Brand</label>
                  <input
                    className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground"
                    value={formData.brand || ''}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Company</label>
                  <input
                    className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground"
                    value={formData.company || ''}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Variations</label>
                <input
                  className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground"
                  value={formData.variations?.join(', ') || ''}
                  onChange={handleVariationsChange}
                  placeholder="Comma separated (e.g. 100g, 250g)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Status</label>
                  <select
                    className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground"
                    value={formData.labTestStatus || 'PENDING'}
                    onChange={e => setFormData({ ...formData, labTestStatus: e.target.value })}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground"
                    value={formData.labResultDate || ''}
                    onChange={e => setFormData({ ...formData, labResultDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Link</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 bg-secondary border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 text-foreground"
                  value={formData.link || ''}
                  onChange={e => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end pt-4 space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground uppercase hover:bg-secondary rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-foreground uppercase rounded hover:opacity-80 disabled:opacity-50 flex items-center space-x-1"
                >
                  {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{editingItem ? 'Update' : 'Create'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LabResultsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-48px)]"><span className="text-xs text-muted-foreground">Loading...</span></div>}>
      <LabResultsPageContent />
    </Suspense>
  );
}
