'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
  Search,
  Upload,
  ArrowUpDown,
  ExternalLink,
  Plus,
  Edit2,
  Trash2,
  X,
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';

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

export default function LabResultsPage() {
  const { data: session } = useSession();
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal & CRUD
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LabResult | null>(null);
  const [formData, setFormData] = useState<Partial<LabResult>>({});
  const [saving, setSaving] = useState(false);

  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchResults();
  }, [page, debouncedSearch, sortBy, sortOrder]);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: debouncedSearch,
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const totalItems = results.data.length;
        if (totalItems === 0) {
          toast.error("No data found");
          if (e.target) e.target.value = '';
          return;
        }

        const toastId = toast.loading(`Importing ${totalItems} items...`);
        try {
          const res = await fetch('/api/lab-results/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: results.data })
          });

          const data = await res.json();

          if (res.ok) {
            toast.success(`Imported ${data.count} items!`, { id: toastId });
            if (data.errors && data.errors.length > 0) {
              setTimeout(() => toast.error(`${data.errors.length} errors occurred. Check console.`), 2000);
              console.error(data.errors);
            }
          } else {
            toast.error(data.error || "Import failed", { id: toastId });
          }

          fetchResults();
        } catch (err: any) {
          toast.error(`Error: ${err.message}`, { id: toastId });
        }
      }
    });
    e.target.value = '';
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
      const payload = {
        ...formData,
        // Ensure variations is array if handled as string input locally (though simpler to use helper)
      };

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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this result?')) return;

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
  };

  // Helper to handle comma-separated variations input
  const handleVariationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData({ ...formData, variations: val.split(',').map(s => s.trim()) });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Lab Results</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Name, Brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400 rounded-sm"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => openModal()}
            className="h-[28px] px-3 bg-black text-white hover:bg-slate-800 transition-colors rounded-sm flex items-center space-x-1.5 shadow-sm"
          >
            <Plus className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">New Result</span>
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          <input type="file" accept=".csv" className="hidden" ref={importRef} onChange={handleImport} />
          <button
            onClick={() => importRef.current?.click()}
            className="h-[28px] px-3 border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors rounded-sm flex items-center space-x-1.5 bg-white"
            title="Import CSV"
          >
            <Upload className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Import</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'name', label: 'Name' },
                { key: 'variations', label: 'Variations' },
                { key: 'brand', label: 'Brand' },
                { key: 'labTestStatus', label: 'Status' },
                { key: 'labResultDate', label: 'Date' },
                { key: 'company', label: 'Company' },
                { key: 'link', label: 'Link' },
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
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-400">Loading...</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No records found</td></tr>
            ) : results.map(item => (
              <tr key={item._id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-2 text-[11px] font-bold text-slate-900">{item.name}</td>
                <td className="px-4 py-2 text-[11px] text-slate-600">
                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                    {item.variations.map((v, i) => (
                      <span key={i} className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600">{v}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2 text-[11px] text-slate-600 font-medium">{item.brand}</td>
                <td className="px-4 py-2">
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border",
                    item.labTestStatus === 'PASS' ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                      item.labTestStatus === 'FAIL' ? "bg-red-50 text-red-700 border-red-100" :
                        "bg-slate-50 text-slate-600 border-slate-100"
                  )}>
                    {item.labTestStatus || 'PENDING'}
                  </span>
                </td>
                <td className="px-4 py-2 text-[11px] text-slate-500">
                  {item.labResultDate ? new Date(item.labResultDate).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-2 text-[11px] text-slate-600">{item.company}</td>
                <td className="px-4 py-2 text-[11px]">
                  {item.link ? (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex items-center space-x-1">
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : '-'}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openModal(item)} className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-900 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(item._id)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors">
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-bold uppercase tracking-wider">{editingItem ? 'Edit Result' : 'New Lab Result'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Name</label>
                <input
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Product Name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Brand</label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                    value={formData.brand || ''}
                    onChange={e => setFormData({ ...formData, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Company</label>
                  <input
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                    value={formData.company || ''}
                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Variations</label>
                <input
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                  value={formData.variations?.join(', ') || ''}
                  onChange={handleVariationsChange}
                  placeholder="Comma separated (e.g. 100g, 250g)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Status</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                    value={formData.labTestStatus || 'PENDING'}
                    onChange={e => setFormData({ ...formData, labTestStatus: e.target.value })}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                    value={formData.labResultDate || ''}
                    onChange={e => setFormData({ ...formData, labResultDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Link</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                  value={formData.link || ''}
                  onChange={e => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="flex justify-end pt-4 space-x-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 uppercase hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold text-white bg-black uppercase rounded hover:bg-slate-800 disabled:opacity-50 flex items-center space-x-1"
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
