'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
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
  Loader2
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';


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

export default function UsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('firstName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: ROLES[3],
    department: DEPARTMENTS[0],
    phone: '',
    hourlyRate: 0,
    profileImage: '',
    status: 'Active' as 'Active' | 'Inactive'
  });
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const data = await res.json();
      setFormData(prev => ({ ...prev, profileImage: data.url }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users?page=${page}&search=${debouncedSearch}&sortBy=${sortBy}&sortOrder=${sortOrder}`);
      const data = await res.json();

      if (res.ok) {
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
        setTotalUsers(data.total || 0);
      } else {
        console.error('API Error:', data.error);
        setError(data.error || 'Failed to fetch users');
        setUsers([]);
      }
    } catch (error: any) {
      // Ignore abort errors if we implement cancellation later
      if (error.name !== 'AbortError') {
        console.error('Error fetching users:', error);
        setError(error.message || 'Network error');
      }
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder]);

  // Initial fetch and re-fetch on dependency change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
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
          const res = await fetch('/api/users/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ users: results.data }),
          });
          if (res.ok) {
            alert('Import successful');
            fetchUsers();
          } else {
            const err = await res.json();
            alert('Import failed: ' + err.error);
          }
        } catch (error) {
          console.error('Import error:', error);
        }
      },
    });
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        password: '', // Password not editable directly here usually, but keeping empty
        role: user.role,
        department: user.department,
        phone: user.phone || '',
        hourlyRate: user.hourlyRate || 0,
        profileImage: user.profileImage || '',
        status: user.status
      });
    } else {
      setEditingUser(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: ROLES[3],
        department: DEPARTMENTS[0],
        phone: '',
        hourlyRate: 0,
        profileImage: '',
        status: 'Active'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';

      const payload = { ...formData };
      if (editingUser && !payload.password) delete (payload as any).password; // Don't send empty password on update

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const err = await res.json();
        alert('Error: ' + err.error);
      }
    } catch (error) {
      console.error('Submit error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">User Management</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-600 hover:text-black hover:bg-slate-200 transition-colors"
            title="Import CSV"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={() => openModal()}
            className="p-2 bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center"
            title="Add User"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'profileImage', label: '' },
                { key: 'firstName', label: 'First Name' },
                { key: 'lastName', label: 'Last Name' },
                { key: 'role', label: 'Role' },
                { key: 'department', label: 'Department' },
                { key: 'email', label: 'Email' },
                { key: 'phone', label: 'Phone' },
                { key: 'hourlyRate', label: 'Rate' },
                { key: 'status', label: 'Status' },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.key !== 'profileImage' && handleSort(col.key)}
                  className={cn(
                    "px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0",
                    col.key === 'profileImage' && "w-10 cursor-default hover:bg-transparent"
                  )}
                >
                  <div className="flex items-center space-x-1.5">
                    <span>{col.label}</span>
                    {col.key !== 'profileImage' && <ArrowUpDown className={cn("w-2.5 h-2.5", sortBy === col.key ? "text-black" : "text-slate-200")} />}
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-xs text-slate-400">Loading users...</td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <XCircle className="w-8 h-8 text-red-500" />
                    <p className="text-sm font-bold text-red-600 uppercase tracking-wide">Database Connection Error</p>
                    <p className="text-xs text-slate-500 max-w-md text-center">
                      Could not connect to MongoDB. Please check your credentials in .env.local or your IP whitelist in MongoDB Atlas. <br />
                      <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-red-500 mt-2 block">{error}</span>
                    </p>
                  </div>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">Empty Database</td>
              </tr>
            ) : users.map((user) => (
              <tr key={user._id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-1.5">
                  {/* Profile Image - keeping somewhat round as standard but simpler */}
                  <div className="w-6 h-6 bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">{user.firstName[0]}{user.lastName[0]}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-1.5 text-[11px] font-bold text-slate-900 tracking-tight">{user.firstName}</td>
                <td className="px-4 py-1.5 text-[11px] font-bold text-slate-900 tracking-tight">{user.lastName}</td>
                <td className="px-4 py-1.5 text-[10px] uppercase font-bold text-slate-500">{user.role}</td>
                <td className="px-4 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-tighter">{user.department}</td>
                <td className="px-4 py-1.5 text-[11px] text-slate-500 font-medium">{user.email}</td>
                <td className="px-4 py-1.5 text-[11px] text-slate-500 font-medium">{user.phone || '-'}</td>
                <td className="px-4 py-1.5 text-[11px] text-slate-900 font-black tracking-tighter">${user.hourlyRate || 0}</td>
                <td className="px-4 py-1.5">
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shadow-sm",
                      user.status === 'Active' ? "bg-green-500 animate-pulse" : "bg-slate-300"
                    )} />
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-tight",
                      user.status === 'Active' ? "text-green-600" : "text-slate-400"
                    )}>
                      {user.status}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-1.5 text-right">
                  <div className="flex items-center justify-end space-x-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openModal(user)}
                      className="p-1 text-slate-400 hover:text-black hover:bg-slate-200 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(user._id)}
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
        totalItems={totalUsers}
        itemsPerPage={20}
        itemName="users"
      />

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">First Name</label>
                  <input
                    required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Last Name</label>
                  <input
                    required
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser} // Email is ID, usually shouldn't change
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors disabled:opacity-50"
                  placeholder="name@company.com"
                />
              </div>

              <label className="text-[10px] font-bold text-slate-500 uppercase">Profile Image</label>
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Upload className="w-4 h-4" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploading}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-black file:text-white hover:file:bg-slate-800 transition-colors disabled:opacity-50"
                  />
                  {uploading && <p className="text-[10px] text-slate-400 mt-1 animate-pulse">Uploading...</p>}
                </div>
              </div>

              {!editingUser && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Password</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                  <input
                    value={formData.phone}
                    onChange={e => {
                      const input = e.target.value.replace(/\D/g, '').slice(0, 10);
                      let formatted = input;
                      if (input.length > 3 && input.length <= 6) {
                        formatted = `${input.slice(0, 3)} ${input.slice(3)}`;
                      } else if (input.length > 6) {
                        formatted = `${input.slice(0, 3)} ${input.slice(3, 6)} ${input.slice(6)}`;
                      }
                      setFormData({ ...formData, phone: formatted });
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
                    placeholder="000 000 0000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={e => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-black focus:ring-0 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={formData.status === 'Active'}
                      onChange={() => setFormData({ ...formData, status: 'Active' })}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-sm font-medium">Active</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Inactive"
                      checked={formData.status === 'Inactive'}
                      onChange={() => setFormData({ ...formData, status: 'Inactive' })}
                      className="text-black focus:ring-black"
                    />
                    <span className="text-sm font-medium">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-black hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
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
