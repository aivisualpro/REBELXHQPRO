'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Upload,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Plus,
  X,
  XCircle,
  Loader2,
  Phone,
  Mail,
  MapPin,
  CreditCard
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { User, Tag, Briefcase, Building2, Truck } from 'lucide-react';

interface Client {
  _id: string;
  name: string;
  description?: string;
  salesPerson?: string | { _id: string; firstName: string; lastName: string };
  contactStatus?: string;
  contactType?: string;
  companyType?: string;
  website?: string;
  facebookPage?: string;
  industry?: string;
  forecastedAmount?: number;
  interactionCount?: number;
  notes?: { note: string; createdBy?: string; createdAt?: string }[];
  projectedCloseDate?: string;

  phones: { value: string; label: string; isWhatsApp?: boolean }[];
  emails: { value: string; label: string }[];
  addresses: { street: string; city: string; state: string; postalCode: string; label: string }[];

  billing?: {
    nameOnCard?: string;
    ccNumber?: string;
    expirationDate?: string;
    securityCode?: string;
    zipCode?: string;
  };

  defaultShippingTerms?: string;
  defaultPaymentMethod?: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalClients, setTotalClients] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Filter States
  const [selectedSalesPersons, setSelectedSalesPersons] = useState<string[]>([]);
  const [selectedContactStatuses, setSelectedContactStatuses] = useState<string[]>([]);
  const [selectedContactTypes, setSelectedContactTypes] = useState<string[]>([]);
  const [selectedCompanyTypes, setSelectedCompanyTypes] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedShippingTerms, setSelectedShippingTerms] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const notesFileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);

  // Fetch users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users?limit=100');
        const data = await res.json();
        if (data.users) setUsers(data.users);
      } catch (e) {
        console.error('Failed to fetch users', e);
      }
    };
    fetchUsers();
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'address' | 'billing'>('basic');

  const initialFormState = {
    name: '',
    description: '',
    salesPerson: '',
    contactStatus: '',
    contactType: '',
    companyType: '',
    industry: '',
    website: '',
    facebookPage: '',
    forecastedAmount: 0,
    interactionCount: 0,
    notes: '',
    projectedCloseDate: '',

    // Arrays flattened for easier form handling initially, or just manage arrays
    phone: '', phone2: '', phone3: '', whatsApp: '',
    email: '', email2: '', email3: '',

    address: '', city: '', state: '', postalCode: '',
    address2: '', city2: '', state2: '', postalCode2: '',

    nameOnCard: '', ccNumber: '', expirationDate: '', securityCode: '', zipCode: '',
    defaultShippingTerms: '', defaultPaymentMethod: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      if (selectedSalesPersons.length) params.append('salesPerson', selectedSalesPersons.join(','));
      if (selectedContactStatuses.length) params.append('contactStatus', selectedContactStatuses.join(','));
      if (selectedContactTypes.length) params.append('contactType', selectedContactTypes.join(','));
      if (selectedCompanyTypes.length) params.append('companyType', selectedCompanyTypes.join(','));
      if (selectedCities.length) params.append('city', selectedCities.join(','));
      if (selectedStates.length) params.append('state', selectedStates.join(','));
      if (selectedShippingTerms.length) params.append('defaultShippingTerms', selectedShippingTerms.join(','));

      const res = await fetch(`/api/clients?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setClients(data.clients || []);
        setTotalPages(data.totalPages || 1);
        setTotalClients(data.total || 0);
      } else {
        setError(data.error || 'Failed to fetch clients');
        setClients([]);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        setError(error.message || 'Network error');
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedSalesPersons, selectedContactStatuses, selectedContactTypes, selectedCompanyTypes, selectedCities, selectedStates, selectedShippingTerms]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Client deleted');
        fetchClients();
      } else {
        toast.error('Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
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
          const loadingToast = toast.loading('Importing clients...');
          const res = await fetch('/api/clients/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clients: results.data }),
          });
          toast.dismiss(loadingToast);

          if (res.ok) {
            toast.success('Import successful');
            fetchClients();
          } else {
            const err = await res.json();
            toast.error('Import failed: ' + err.error);
          }
        } catch (error) {
          toast.error('Import error');
          console.error('Import error:', error);
        }
      },
    });
  };

  const handleImportNotes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const loadingToast = toast.loading('Importing notes...');
          const res = await fetch('/api/clients/import-notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: results.data }),
          });
          toast.dismiss(loadingToast);

          if (res.ok) {
            const data = await res.json();
            toast.success(` Imported ${data.updatedCount} notes`);
            fetchClients();
          } else {
            const err = await res.json();
            toast.error('Import failed: ' + err.error);
          }
        } catch (error) {
          toast.error('Import error');
          console.error('Import error:', error);
        }
      },
    });
  };

  const openModal = (client?: Client) => {
    setActiveTab('basic');
    if (client) {
      setEditingClient(client);

      // Map arrays back to form fields
      const mainPhone = client.phones?.find(p => p.label === 'Main')?.value || '';
      const secPhone = client.phones?.find(p => p.label === 'Secondary')?.value || '';
      const otherPhone = client.phones?.find(p => p.label === 'Other')?.value || '';
      const waPhone = client.phones?.find(p => p.label === 'WhatsApp')?.value || '';

      const mainEmail = client.emails?.find(e => e.label === 'Main')?.value || '';
      const secEmail = client.emails?.find(e => e.label === 'Secondary')?.value || '';
      const otherEmail = client.emails?.find(e => e.label === 'Other')?.value || '';

      const mainAddr = client.addresses?.find(a => a.label === 'Main');
      const secAddr = client.addresses?.find(a => a.label === 'Secondary');

      setFormData({
        name: client.name,
        description: client.description || '',
        salesPerson: typeof client.salesPerson === 'object' ? client.salesPerson?._id : client.salesPerson || '',
        contactStatus: client.contactStatus || '',
        contactType: client.contactType || '',
        companyType: client.companyType || '',
        industry: client.industry || '',
        website: client.website || '',
        facebookPage: client.facebookPage || '',
        forecastedAmount: client.forecastedAmount || 0,
        interactionCount: client.interactionCount || 0,
        notes: Array.isArray(client.notes) && client.notes.length > 0 ? client.notes[0].note : (typeof client.notes === 'string' ? client.notes : ''),
        projectedCloseDate: client.projectedCloseDate ? new Date(client.projectedCloseDate).toISOString().split('T')[0] : '',

        phone: mainPhone, phone2: secPhone, phone3: otherPhone, whatsApp: waPhone,
        email: mainEmail, email2: secEmail, email3: otherEmail,

        address: mainAddr?.street || '', city: mainAddr?.city || '', state: mainAddr?.state || '', postalCode: mainAddr?.postalCode || '',
        address2: secAddr?.street || '', city2: secAddr?.city || '', state2: secAddr?.state || '', postalCode2: secAddr?.postalCode || '',

        nameOnCard: client.billing?.nameOnCard || '',
        ccNumber: client.billing?.ccNumber || '',
        expirationDate: client.billing?.expirationDate || '',
        securityCode: client.billing?.securityCode || '',
        zipCode: client.billing?.zipCode || '',
        defaultShippingTerms: client.defaultShippingTerms || '',
        defaultPaymentMethod: client.defaultPaymentMethod || ''
      });
    } else {
      setEditingClient(null);
      setFormData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingClient ? `/api/clients/${editingClient._id}` : '/api/clients';
      const method = editingClient ? 'PATCH' : 'POST';

      // Reconstruct the object structure
      const phones = [];
      if (formData.phone) phones.push({ value: formData.phone, label: 'Main', isWhatsApp: false });
      if (formData.phone2) phones.push({ value: formData.phone2, label: 'Secondary', isWhatsApp: false });
      if (formData.phone3) phones.push({ value: formData.phone3, label: 'Other', isWhatsApp: false });
      if (formData.whatsApp) phones.push({ value: formData.whatsApp, label: 'WhatsApp', isWhatsApp: true });

      const emails = [];
      if (formData.email) emails.push({ value: formData.email, label: 'Main' });
      if (formData.email2) emails.push({ value: formData.email2, label: 'Secondary' });
      if (formData.email3) emails.push({ value: formData.email3, label: 'Other' });

      const addresses = [];
      if (formData.address || formData.city) {
        addresses.push({ street: formData.address, city: formData.city, state: formData.state, postalCode: formData.postalCode, label: 'Main' });
      }
      if (formData.address2 || formData.city2) {
        addresses.push({ street: formData.address2, city: formData.city2, state: formData.state2, postalCode: formData.postalCode2, label: 'Secondary' });
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        salesPerson: formData.salesPerson,
        contactStatus: formData.contactStatus,
        contactType: formData.contactType,
        companyType: formData.companyType,
        website: formData.website,
        facebookPage: formData.facebookPage,
        industry: formData.industry,
        forecastedAmount: Number(formData.forecastedAmount),
        interactionCount: Number(formData.interactionCount),
        notes: formData.notes,
        projectedCloseDate: formData.projectedCloseDate,
        phones,
        emails,
        addresses,
        billing: {
          nameOnCard: formData.nameOnCard,
          ccNumber: formData.ccNumber,
          expirationDate: formData.expirationDate,
          securityCode: formData.securityCode,
          zipCode: formData.zipCode
        },
        defaultShippingTerms: formData.defaultShippingTerms,
        defaultPaymentMethod: formData.defaultPaymentMethod
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchClients();
        toast.success(editingClient ? 'Client updated' : 'Client created');
      } else {
        const err = await res.json();
        toast.error('Error: ' + err.error);
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Client Management</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>



        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="Sales"
            icon={User}
            options={users.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id }))}
            selectedValues={selectedSalesPersons}
            onChange={setSelectedSalesPersons}
          />
          <MultiSelectFilter
            label="Status"
            icon={Tag}
            options={['Sampling', 'New Prospect', 'Uncategorized', 'Closed lost', 'Initial Contact', 'Closed won'].map(s => ({ label: s, value: s }))}
            selectedValues={selectedContactStatuses}
            onChange={setSelectedContactStatuses}
          />
          <MultiSelectFilter
            label="Type"
            icon={Briefcase}
            options={['Potential Customer', 'Current Customer', 'Inactive Customer', 'Uncategorized'].map(s => ({ label: s, value: s }))}
            selectedValues={selectedContactTypes}
            onChange={setSelectedContactTypes}
          />
          <MultiSelectFilter
            label="Company"
            icon={Building2}
            options={['LLC', 'Corporation', 'Sole Proprietorship', 'Partnership'].map(s => ({ label: s, value: s }))}
            selectedValues={selectedCompanyTypes}
            onChange={setSelectedCompanyTypes}
          />
          <MultiSelectFilter
            label="City"
            icon={MapPin}
            options={Array.from(new Set(clients.map(c => c.addresses?.find(a => a.label === 'Main')?.city).filter(Boolean))).map(c => ({ label: c as string, value: c as string }))}
            selectedValues={selectedCities}
            onChange={setSelectedCities}
          />
          <MultiSelectFilter
            label="State"
            icon={MapPin}
            options={Array.from(new Set(clients.map(c => c.addresses?.find(a => a.label === 'Main')?.state).filter(Boolean))).map(s => ({ label: s as string, value: s as string }))}
            selectedValues={selectedStates}
            onChange={setSelectedStates}
          />
          <MultiSelectFilter
            label="Shipping"
            icon={Truck}
            options={['Prepaid', 'Collect', 'Prepaid & Add', 'Third Party'].map(s => ({ label: s, value: s }))}
            selectedValues={selectedShippingTerms}
            onChange={setSelectedShippingTerms}
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
            className="p-2 text-slate-600 hover:text-black hover:bg-slate-200 transition-colors rounded-sm"
            title="Import Clients CSV"
          >
            <Upload className="w-4 h-4" />
          </button>

          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={notesFileInputRef}
            onChange={handleImportNotes}
          />
          <button
            onClick={() => notesFileInputRef.current?.click()}
            className="p-2 text-slate-600 hover:text-black hover:bg-slate-200 transition-colors rounded-sm ml-2 flex items-center space-x-1"
            title="Import Notes CSV"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase">Notes</span>
          </button>
          <button
            onClick={() => openModal()}
            className="p-2 bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center"
            title="Add Client"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div >

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'name', label: 'Name' },
                { key: 'salesPerson', label: 'Sales Person' },
                { key: 'contactType', label: 'Type' },
                { key: 'contactStatus', label: 'Status' },
                // { key: 'phones', label: 'Phone' },
                // { key: 'emails', label: 'Email' },
                { key: 'industry', label: 'Industry' },
              ].map((col) => (
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
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Contact Info</th>
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-xs text-slate-400">Loading clients...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-red-500 text-xs font-bold">{error}</td>
              </tr>
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No clients found</td>
              </tr>
            ) : clients.map((client) => {
              const mainPhone = client.phones?.find(p => p.label === 'Main')?.value;
              const mainEmail = client.emails?.find(e => e.label === 'Main')?.value;
              const city = client.addresses?.find(a => a.label === 'Main')?.city;
              const state = client.addresses?.find(a => a.label === 'Main')?.state;

              return (
                <tr key={client._id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-1.5 text-[11px] font-bold text-slate-900 tracking-tight">{client.name}</td>
                  <td className="px-4 py-1.5 text-[11px] text-slate-500">
                    {typeof client.salesPerson === 'object' && client.salesPerson
                      ? `${client.salesPerson.firstName} ${client.salesPerson.lastName}`
                      : client.salesPerson}
                  </td>
                  <td className="px-4 py-1.5 text-[10px] uppercase font-bold text-slate-500">{client.contactType}</td>
                  <td className="px-4 py-1.5 text-[10px] uppercase font-bold text-slate-500">{client.contactStatus}</td>
                  <td className="px-4 py-1.5 text-[10px] uppercase font-bold text-slate-500">{client.industry}</td>
                  <td className="px-4 py-1.5">
                    <div className="flex flex-col space-y-0.5">
                      {mainPhone && <div className="flex items-center text-[10px] text-slate-600"><Phone className="w-2.5 h-2.5 mr-1 text-slate-400" /> {mainPhone}</div>}
                      {mainEmail && <div className="flex items-center text-[10px] text-slate-600"><Mail className="w-2.5 h-2.5 mr-1 text-slate-400" /> {mainEmail}</div>}
                      {(city || state) && <div className="flex items-center text-[10px] text-slate-500"><MapPin className="w-2.5 h-2.5 mr-1 text-slate-300" /> {city}{city && state ? ', ' : ''}{state}</div>}
                    </div>
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <div className="flex items-center justify-end space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openModal(client)}
                        className="p-1 text-slate-400 hover:text-black hover:bg-slate-200 transition-colors"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(client._id)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalClients}
        itemsPerPage={20}
        itemName="clients"
      />

      {/* Add/Edit Modal */}
      {
        isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-black transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center px-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
                {['basic', 'contact', 'address', 'billing'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={cn(
                      "px-4 py-3 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-colors",
                      activeTab === tab ? "border-black text-black" : "border-transparent text-slate-400 hover:text-slate-600"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Modal Body - Scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <form id="client-form" onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Tab */}
                  {activeTab === 'basic' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Company/Client Name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} required />
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Sales Person</label>
                          <select
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors appearance-none"
                            value={formData.salesPerson}
                            onChange={e => setFormData({ ...formData, salesPerson: e.target.value })}
                          >
                            <option value="">Select Sales Person</option>
                            {users.map(u => (
                              <option key={u._id} value={u._id}>{u.firstName} {u.lastName}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Status</label>
                          <select
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors appearance-none"
                            value={formData.contactStatus}
                            onChange={e => setFormData({ ...formData, contactStatus: e.target.value })}
                          >
                            <option value="">Select Status</option>
                            {['Sampling', 'New Prospect', 'Uncategorized', 'Closed lost', 'Initial Contact', 'Closed won'].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Contact Type</label>
                          <select
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors appearance-none"
                            value={formData.contactType}
                            onChange={e => setFormData({ ...formData, contactType: e.target.value })}
                          >
                            <option value="">Select Type</option>
                            {['Potential Customer', 'Current Customer', 'Inactive Customer', 'Uncategorized'].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Company Type" value={formData.companyType} onChange={v => setFormData({ ...formData, companyType: v })} />
                        <FormInput label="Industry" value={formData.industry} onChange={v => setFormData({ ...formData, industry: v })} />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Forecasted Amount ($)" type="number" value={formData.forecastedAmount} onChange={v => setFormData({ ...formData, forecastedAmount: Number(v) })} />
                        <FormInput label="Projected Close Date" type="date" value={formData.projectedCloseDate} onChange={v => setFormData({ ...formData, projectedCloseDate: v })} />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Description / Notes</label>
                        <textarea
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors h-24 resize-none"
                          value={formData.notes}
                          onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  {/* Contact Tab */}
                  {activeTab === 'contact' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase text-slate-900 border-b border-slate-100 pb-2">Phone Numbers</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormInput label="Phone (Main)" value={formData.phone} onChange={v => setFormData({ ...formData, phone: v })} />
                          <FormInput label="Phone (Secondary)" value={formData.phone2} onChange={v => setFormData({ ...formData, phone2: v })} />
                          <FormInput label="Phone (Other)" value={formData.phone3} onChange={v => setFormData({ ...formData, phone3: v })} />
                          <FormInput label="WhatsApp" value={formData.whatsApp} onChange={v => setFormData({ ...formData, whatsApp: v })} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase text-slate-900 border-b border-slate-100 pb-2">Email Addresses</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormInput label="Email (Main)" type="email" value={formData.email} onChange={v => setFormData({ ...formData, email: v })} />
                          <FormInput label="Email (Secondary)" type="email" value={formData.email2} onChange={v => setFormData({ ...formData, email2: v })} />
                          <FormInput label="Email (Other)" type="email" value={formData.email3} onChange={v => setFormData({ ...formData, email3: v })} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase text-slate-900 border-b border-slate-100 pb-2">Social / Web</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <FormInput label="Website" value={formData.website} onChange={v => setFormData({ ...formData, website: v })} />
                          <FormInput label="Facebook Page" value={formData.facebookPage} onChange={v => setFormData({ ...formData, facebookPage: v })} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Address Tab */}
                  {activeTab === 'address' && (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase text-slate-900 border-b border-slate-100 pb-2 flex items-center"><MapPin className="w-3 h-3 mr-2" /> Main Address</h3>
                        <FormInput label="Street Address" value={formData.address} onChange={v => setFormData({ ...formData, address: v })} />
                        <div className="grid grid-cols-3 gap-4">
                          <FormInput label="City" value={formData.city} onChange={v => setFormData({ ...formData, city: v })} />
                          <FormInput label="State" value={formData.state} onChange={v => setFormData({ ...formData, state: v })} />
                          <FormInput label="Postal Code" value={formData.postalCode} onChange={v => setFormData({ ...formData, postalCode: v })} />
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase text-slate-900 border-b border-slate-100 pb-2 flex items-center"><MapPin className="w-3 h-3 mr-2 text-slate-400" /> Secondary Address</h3>
                        <FormInput label="Street Address" value={formData.address2} onChange={v => setFormData({ ...formData, address2: v })} />
                        <div className="grid grid-cols-3 gap-4">
                          <FormInput label="City" value={formData.city2} onChange={v => setFormData({ ...formData, city2: v })} />
                          <FormInput label="State" value={formData.state2} onChange={v => setFormData({ ...formData, state2: v })} />
                          <FormInput label="Postal Code" value={formData.postalCode2} onChange={v => setFormData({ ...formData, postalCode2: v })} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Billing Tab */}
                  {activeTab === 'billing' && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase text-slate-900 border-b border-slate-100 pb-2 flex items-center"><CreditCard className="w-3 h-3 mr-2" /> Default Billing</h3>
                        <FormInput label="Name on Card" value={formData.nameOnCard} onChange={v => setFormData({ ...formData, nameOnCard: v })} />
                        <FormInput label="Credit Card Number" value={formData.ccNumber} onChange={v => setFormData({ ...formData, ccNumber: v })} placeholder="**** **** **** ****" />
                        <div className="grid grid-cols-3 gap-4">
                          <FormInput label="Expiration Date" value={formData.expirationDate} onChange={v => setFormData({ ...formData, expirationDate: v })} placeholder="MM/YY" />
                          <FormInput label="Security Code" value={formData.securityCode} onChange={v => setFormData({ ...formData, securityCode: v })} type="password" />
                          <FormInput label="Billing Zip" value={formData.zipCode} onChange={v => setFormData({ ...formData, zipCode: v })} />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormInput label="Default Shipping Terms" value={formData.defaultShippingTerms} onChange={v => setFormData({ ...formData, defaultShippingTerms: v })} />
                        <FormInput label="Default Payment Method" value={formData.defaultPaymentMethod} onChange={v => setFormData({ ...formData, defaultPaymentMethod: v })} />
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Modal Footer */}
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
                  form="client-form"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{editingClient ? 'Save Changes' : 'Create Client'}</span>
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

// Helper Component for inputs
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
