'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Upload,
  ArrowUpDown,
  User,
  Briefcase,
  Edit2,
  Trash2,
  Plus,
  X,
  Loader2,
  Check,
  ChevronDown,
  MessageSquare
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { useSession } from 'next-auth/react';

interface Activity {
  _id: string;
  type: string;
  client: { _id: string; name: string } | string;
  comments: string;
  createdBy: { _id: string; firstName: string; lastName: string } | string;
  createdAt: string;
}

interface SMSViewProps {
  clientId?: string;
  clientPhone?: string;
}

export default function SMSView({ clientId, clientPhone }: SMSViewProps) {
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

  const [selectedClients, setSelectedClients] = useState<string[]>(clientId ? [clientId] : []);
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<string[]>([]);

  const [users, setUsers] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);
  const [clientOptions, setClientOptions] = useState<{ _id: string; name: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);

  const { data: session } = useSession();

  const initialFormState = {
    type: 'Text',
    client: clientId || '',
    comments: '',
    createdAt: '',
    createdBy: '' 
  };
  const [formData, setFormData] = useState(initialFormState);


  useEffect(() => {
    // Fetch users for filter
    fetch('/api/users?limit=100').then(res => res.json()).then(data => {
      if (data.users) setUsers(data.users);
    }).catch(e => console.error('Failed to fetch users', e));

    if (!clientId) {
      // Fetch clients for filter
      fetch('/api/clients?limit=10000&sortBy=name').then(res => res.json()).then(data => {
        if (data.clients) setClientOptions(data.clients.map((c: any) => ({ _id: c._id, name: c.name })));
      }).catch(e => console.error('Failed to fetch clients', e));
    }
  }, [clientId]);

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

      // Force type=Text
      params.append('type', 'Text');
      
      if (clientId) {
          params.append('client', clientId);
      } else if (selectedClients.length) {
          params.append('client', selectedClients.join(','));
      }

      if (selectedCreatedBy.length) params.append('createdBy', selectedCreatedBy.join(','));

      const res = await fetch(`/api/activities?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setActivities(data.activities || []);
        setTotalPages(data.totalPages || 1);
        setTotalActivities(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch SMS');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedClients, selectedCreatedBy, clientId]);

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
          const importedData = results.data.map((row: any) => ({
             ...row,
             type: row.type || 'Text'
          }));

            if (clientId) {
              toast.error("Import is not supported in client specific view yet.");
              return; 
            }

          const loadingToast = toast.loading('Importing SMS...');
          const res = await fetch('/api/activities/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activities: importedData })
          });
          toast.dismiss(loadingToast);

          if (res.ok) {
            const data = await res.json();
            toast.success(`Imported ${data.count} SMS`);
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
        type: 'Text',
        client: typeof activity.client === 'object' && activity.client ? activity.client._id : activity.client as string,
        comments: activity.comments,
        createdAt: activity.createdAt ? new Date(activity.createdAt).toISOString().slice(0, 16) : '',
        createdBy: typeof activity.createdBy === 'object' && activity.createdBy ? activity.createdBy._id : activity.createdBy as string
      });
    } else {
      setEditingActivity(null);
      setFormData({
        ...initialFormState,
        client: clientId || '',
        createdAt: new Date().toISOString().slice(0, 16),
        createdBy: (session?.user as any)?.id || ''
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

      const payload = { ...formData, type: 'Text' };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        toast.success(editingActivity ? 'SMS updated' : 'SMS logged');
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
    if (!confirm('Are you sure you want to delete this SMS?')) return;
    try {
      const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('SMS deleted');
        fetchActivities();
      } else {
        toast.error('Failed to delete');
      }
    } catch (e) {
      toast.error('Delete failed');
    }
  };


  return (
    <div className="flex flex-col h-full bg-background transition-colors duration-300">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-secondary/50 transition-colors">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            SMS
          </h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search comments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          
          {!clientId && (
            <MultiSelectFilter
                label="Client"
                icon={Briefcase}
                options={clientOptions.map(c => ({ label: c.name, value: c._id }))}
                selectedValues={selectedClients}
                onChange={setSelectedClients}
                className="h-8"
            />
          )}

          <MultiSelectFilter
            label="Sales Rep"
            icon={User}
            options={users.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id }))}
            selectedValues={selectedCreatedBy}
            onChange={setSelectedCreatedBy}
            className="h-8"
          />

          <div className="w-px h-6 bg-slate-200 mx-2" />

          {!clientId && (
              <>
                <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImport}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded flex items-center space-x-1 border border-border bg-card shadow-sm cursor-pointer"
                    title="Import CSV"
                >
                    <Upload className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Import</span>
                </button>
              </>
          )}

          <button
            onClick={() => {
                if (clientPhone) {
                    const cleanPhone = clientPhone.replace(/\D/g, '');
                    window.open(`https://voice.google.com/u/0/messages?recipient=${cleanPhone}`, '_blank');
                }
                openModal();
            }}
            className="h-8 w-8 flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded shadow-md cursor-pointer"
            title="Log SMS"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/50 z-10 border-b border-border backdrop-blur-sm">
            <tr>
              {[
                // Hide Client column if clientId is provided
                ...(!clientId ? [{ key: 'client', label: 'Client' }] : []),
                { key: 'comments', label: 'Comments' },
                { key: 'createdAt', label: 'Date' },
                { key: 'createdBy', label: 'By' }
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer hover:bg-secondary/80 transition-colors border-r border-border last:border-0"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-foreground" : "text-muted-foreground")} />
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={clientId ? 4 : 5} className="px-4 py-12 text-center text-xs text-muted-foreground italic">Loading SMS...</td></tr>
            ) : error ? (
              <tr><td colSpan={clientId ? 4 : 5} className="px-4 py-12 text-center text-destructive text-xs font-bold">{error}</td></tr>
            ) : activities.length === 0 ? (
              <tr><td colSpan={clientId ? 4 : 5} className="px-4 py-12 text-center text-xs text-muted-foreground uppercase font-medium tracking-tighter opacity-50">No SMS found</td></tr>
            ) : activities.map(activity => (
              <tr key={activity._id} className="hover:bg-secondary/40 hover:scale-[1.002] hover:shadow-md transition-all duration-200 group relative z-0 hover:z-10 bg-background">
                {!clientId && (
                    <td className="px-4 py-1.5 text-[11px] text-foreground font-medium">
                    {typeof activity.client === 'object' && activity.client ? activity.client.name : activity.client}
                    </td>
                )}
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground max-w-md truncate" title={activity.comments}>{activity.comments || '-'}</td>
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground">
                  {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : '-'}
                </td>
                <td className="px-4 py-1.5 text-[11px] text-muted-foreground">
                  {typeof activity.createdBy === 'object' && activity.createdBy ? `${activity.createdBy.firstName} ${activity.createdBy.lastName}` : activity.createdBy || '-'}
                </td>
                <td className="px-4 py-1.5 text-right">
                  <div className="flex items-center justify-end space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openModal(activity)}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(activity._id)}
                      className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
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
    </div>

       <div className="border-t border-border bg-background transition-colors duration-300">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalActivities}
          itemsPerPage={20}
          itemName="SMS"
        />
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-border">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                {editingActivity ? 'Edit SMS' : 'Log New SMS'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <form id="activity-form" onSubmit={handleSubmit} className="space-y-4">
                
                {!clientId && (
                    <SearchableSingleSelect
                    label="Client"
                    options={clientOptions.map(c => ({ label: c.name, value: c._id }))}
                    value={formData.client}
                    onChange={(val) => setFormData({ ...formData, client: val })}
                    required
                    />
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Comments *</label>
                  <textarea
                    className="w-full px-3 py-2 bg-secondary/50 border border-border text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors h-24 resize-none text-foreground placeholder:text-muted-foreground"
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
                  disabled
                />

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Sales Rep</label>
                  <select
                    className="w-full px-3 py-2 bg-secondary/50 border border-border text-sm focus:outline-none focus:border-primary focus:ring-0 transition-colors appearance-none text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    value={formData.createdBy}
                    onChange={(e) => setFormData({ ...formData, createdBy: e.target.value })}
                    disabled
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
            <div className="px-6 py-4 border-t border-border bg-secondary/30 shrink-0 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="activity-form"
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center space-x-2 cursor-pointer"
              >
                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{editingActivity ? 'Save Changes' : 'Log SMS'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Helpers

const FormInput = ({ label, value, onChange, type = "text", required = false, placeholder = "", disabled = false }: { label: string, value: any, onChange: (val: any) => void, type?: string, required?: boolean, placeholder?: string, disabled?: boolean }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-muted-foreground uppercase">{label} {required && <span className="text-destructive">*</span>}</label>
    <input
      type={type}
      required={required}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={cn(
        "w-full px-3 py-2 bg-secondary/50 border border-border text-sm focus:outline-none focus:border-foreground focus:ring-0 transition-colors text-foreground placeholder:text-muted-foreground",
        disabled && "opacity-50 cursor-not-allowed"
      )}
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
      <label className="text-[10px] font-bold text-muted-foreground uppercase">{label} {required && <span className="text-destructive">*</span>}</label>
      <div
        className="w-full px-3 py-2 bg-secondary/50 border border-border text-sm focus-within:border-foreground transition-colors cursor-pointer flex items-center justify-between text-foreground"
        onClick={() => { setIsOpen(!isOpen); if (!isOpen) setSearchTerm(''); }}
      >
        <span className={!selectedLabel ? "text-muted-foreground" : ""}>{selectedLabel || 'Select Client'}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 w-full bg-card border border-border shadow-xl max-h-60 overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-100 mt-1">
          <div className="sticky top-0 bg-card p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                autoFocus
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-secondary/50 border border-border focus:outline-none focus:border-foreground transition-colors text-foreground placeholder:text-muted-foreground"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-xs text-muted-foreground text-center">No results found</div>
            ) : (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className={cn(
                    "px-4 py-2 text-xs cursor-pointer hover:bg-secondary/80 flex items-center justify-between text-foreground",
                    value === opt.value && "bg-secondary/50 font-bold"
                  )}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && <Check className="w-3 h-3 text-primary" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
