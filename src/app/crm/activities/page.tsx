'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Upload,
  ArrowUpDown,
  Activity as ActivityIcon,
  User,
  Briefcase,
  Edit2,
  Trash2,
  Plus,
  X,
  Loader2,
  Check,
  ChevronDown
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';

interface Activity {
  _id: string;
  type: string;
  client: { _id: string; name: string } | string;
  comments: string;
  createdBy: { _id: string; firstName: string; lastName: string } | string;
  createdAt: string;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalActivities, setTotalActivities] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<string[]>([]);

  const [users, setUsers] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);
  const [clientOptions, setClientOptions] = useState<{ _id: string; name: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const initialFormState = {
    type: '',
    client: '',
    comments: '',
    createdAt: '',
    createdBy: '' // In meaningful app, this might be auto-set to current user, but for now we allow selection or default
  };
  const [formData, setFormData] = useState(initialFormState);


  useEffect(() => {
    // Fetch users for filter
    fetch('/api/users?limit=100').then(res => res.json()).then(data => {
      if (data.users) setUsers(data.users);
    }).catch(e => console.error('Failed to fetch users', e));

    // Fetch clients for filter
    fetch('/api/clients?limit=10000&sortBy=name').then(res => res.json()).then(data => {
      if (data.clients) setClientOptions(data.clients.map((c: any) => ({ _id: c._id, name: c.name })));
    }).catch(e => console.error('Failed to fetch clients', e));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      if (selectedTypes.length) params.append('type', selectedTypes.join(','));
      if (selectedClients.length) params.append('client', selectedClients.join(','));
      if (selectedCreatedBy.length) params.append('createdBy', selectedCreatedBy.join(','));

      const res = await fetch(`/api/activities?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setActivities(data.activities || []);
        setTotalPages(data.totalPages || 1);
        setTotalActivities(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch activities');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedTypes, selectedClients, selectedCreatedBy]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

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
        try {
          const loadingToast = toast.loading('Importing activities...');
          const res = await fetch('/api/activities/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activities: results.data })
          });
          toast.dismiss(loadingToast);

          if (res.ok) {
            const data = await res.json();
            toast.success(`Imported ${data.count} activities`);
            fetchActivities();
          } else {
            const err = await res.json();
            toast.error('Import failed: ' + err.error);
          }
        } catch (e) {
          toast.error('Import error');
          console.error(e);
        }
      }
    });
  };

  const openModal = (activity?: Activity) => {
    if (activity) {
      setEditingActivity(activity);
      setFormData({
        type: activity.type,
        client: typeof activity.client === 'object' && activity.client ? activity.client._id : activity.client as string,
        comments: activity.comments,
        // Format date strictly for input type="datetime-local" if needed, or just date
        // HTML date input expects YYYY-MM-DD
        createdAt: activity.createdAt ? new Date(activity.createdAt).toISOString().slice(0, 16) : '',
        createdBy: typeof activity.createdBy === 'object' && activity.createdBy ? activity.createdBy._id : activity.createdBy as string
      });
    } else {
      setEditingActivity(null);
      setFormData({
        ...initialFormState,
        createdAt: new Date().toISOString().slice(0, 16) // Default to now
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingActivity ? `/api/activities/${editingActivity._id}` : '/api/activities';
      const method = editingActivity ? 'PATCH' : 'POST';

      const payload = { ...formData };
      // If createdBy is empty (not selected), maybe we don't send it? or send null?
      // For now let's assume if it's new and empty, backend handles it or we force select. 

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        toast.success(editingActivity ? 'Activity updated' : 'Activity created');
        fetchActivities();
      } else {
        const err = await res.json();
        toast.error('Error: ' + err.message || err.error);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Activity deleted');
        fetchActivities();
      } else {
        toast.error('Failed to delete');
      }
    } catch (e) {
      toast.error('Delete failed');
    }
  };


  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Activities</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search comments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="Type"
            icon={ActivityIcon}
            options={['Call', 'Text', 'Email', 'Visit'].map(t => ({ label: t, value: t }))}
            selectedValues={selectedTypes}
            onChange={setSelectedTypes}
          />
          <MultiSelectFilter
            label="Client"
            icon={Briefcase}
            options={clientOptions.map(c => ({ label: c.name, value: c._id }))}
            selectedValues={selectedClients}
            onChange={setSelectedClients}
          />
          <MultiSelectFilter
            label="Sales Rep"
            icon={User}
            options={users.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id }))}
            selectedValues={selectedCreatedBy}
            onChange={setSelectedCreatedBy}
          />

          <div className="w-px h-6 bg-slate-200 mx-2" />

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-600 hover:text-black hover:bg-slate-200 transition-colors rounded-sm flex items-center space-x-1"
            title="Import CSV"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Import</span>
          </button>

          <button
            onClick={() => openModal()}
            className="p-2 bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center rounded-sm"
            title="Add Activity"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'type', label: 'Type' },
                { key: 'client', label: 'Client' },
                { key: 'comments', label: 'Comments' },
                { key: 'createdAt', label: 'Date' },
                { key: 'createdBy', label: 'By' }
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0"
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
              <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-400">Loading activities...</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-red-500 text-xs font-bold">{error}</td></tr>
            ) : activities.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No activities found</td></tr>
            ) : activities.map(activity => (
              <tr key={activity._id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-1.5 text-[11px] font-bold text-slate-900 tracking-tight">{activity.type}</td>
                <td className="px-4 py-1.5 text-[11px] text-slate-600">
                  {typeof activity.client === 'object' && activity.client ? activity.client.name : activity.client}
                </td>
                <td className="px-4 py-1.5 text-[11px] text-slate-500 max-w-md truncate" title={activity.comments}>{activity.comments || '-'}</td>
                <td className="px-4 py-1.5 text-[11px] text-slate-500">
                  {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : '-'}
                </td>
                <td className="px-4 py-1.5 text-[11px] text-slate-500">
                  {typeof activity.createdBy === 'object' && activity.createdBy ? `${activity.createdBy.firstName} ${activity.createdBy.lastName}` : activity.createdBy || '-'}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <div className="flex items-center justify-end space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openModal(activity)}
                      className="p-1 text-slate-400 hover:text-black hover:bg-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(activity._id)}
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
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
        totalItems={totalActivities}
        itemsPerPage={20}
        itemName="activities"
      />

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                {editingActivity ? 'Edit Activity' : 'Add Activity'}
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
              <form id="activity-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Type *</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors appearance-none"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    <option value="">Select Type</option>
                    {['Call', 'Text', 'Email', 'Visit'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <SearchableSingleSelect
                  label="Client"
                  options={clientOptions.map(c => ({ label: c.name, value: c._id }))}
                  value={formData.client}
                  onChange={(val) => setFormData({ ...formData, client: val })}
                  required
                />

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Comments *</label>
                  <textarea
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors h-24 resize-none"
                    value={formData.comments}
                    onChange={e => setFormData({ ...formData, comments: e.target.value })}
                    required
                  />
                </div>

                <FormInput
                  label="Date & Time"
                  type="datetime-local"
                  value={formData.createdAt}
                  onChange={(v) => setFormData({ ...formData, createdAt: v })}
                />

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Sales Rep</label>
                  <select
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors appearance-none"
                    value={formData.createdBy}
                    onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                  >
                    <option value="">Select Sales Person</option>
                    {users.map(u => (
                      <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                    ))}
                  </select>
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
                form="activity-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{editingActivity ? 'Save Changes' : 'Add Activity'}</span>
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
      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
    />
  </div>
);

const SearchableSingleSelect = ({ label, options, value, onChange, required }: { label: string, options: { label: string, value: string }[], value: string, onChange: (val: string) => void, required?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));

  // Find selected label
  const selectedLabel = options.find(opt => opt.value === value)?.label || '';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div className="space-y-1 relative" ref={wrapperRef}>
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label} {required && <span className="text-red-500">*</span>}</label>
      <div
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus-within:border-black transition-colors cursor-pointer flex items-center justify-between"
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setSearchTerm(''); }}
      >
        <span className={!selectedLabel ? "text-gray-400" : ""}>{selectedLabel || 'Select Client'}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-white border border-slate-200 shadow-xl max-h-60 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-100 mt-1">
          <div className="sticky top-0 bg-white p-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 focus:outline-none focus:border-black transition-colors"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-400 text-center">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={cn(
                    "px-4 py-2 text-xs cursor-pointer hover:bg-slate-50 flex items-center justify-between",
                    value === opt.value && "bg-slate-50 font-bold"
                  )}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && <Check className="w-3 h-3 text-black" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
