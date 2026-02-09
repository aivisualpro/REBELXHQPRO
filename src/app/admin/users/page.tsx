'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
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
  Mail,
  Phone
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';


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
  const router = useRouter();
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
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background transition-colors duration-300">
      {/* Action Bar */}
      <div className="flex items-center justify-between px-4 h-11 border-b border-border bg-secondary/50 transition-colors">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter">User Management</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 h-8 w-64 bg-background border border-border text-[11px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all placeholder:text-muted-foreground text-foreground rounded"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
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
              className="h-8 px-3 bg-card text-foreground hover:bg-secondary transition-colors border border-border shadow-sm flex items-center space-x-2 rounded cursor-pointer"
              title="Import Users from CSV"
            >
              <Upload className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Import CSV</span>
            </button>
          </>
          
          <button
            onClick={() => openModal()}
            className="h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-md flex items-center space-x-2 rounded cursor-pointer"
            title="Add User"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Add User</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
          <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              {[
                { key: 'firstName', label: 'Name', width: 'w-64' },
                { key: 'role', label: 'Role', width: 'w-48' },
                { key: 'department', label: 'Department', width: 'w-48' },
                { key: 'email', label: 'Email', width: 'w-64' },
                { key: 'phone', label: 'Phone', width: 'w-48' },
                { key: 'hourlyRate', label: 'Rate', width: 'w-24' },
                { key: 'status', label: 'Status', width: 'w-32' },
              ].map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "border-r border-border last:border-0",
                    col.width
                  )}
                >
                  <TableColumnHeader
                    column={col.key}
                    title={col.label}
                    currentSortBy={sortBy}
                    currentSortOrder={sortOrder}
                    onSort={(key: string, dir: "asc" | "desc") => {
                      setSortBy(key);
                      setSortOrder(dir);
                    }}
                    onFilter={(key: string) => {
                        toast(`Filtering by ${key} coming soon`, { icon: '🔍' });
                    }}
                    className={cn(
                        "text-muted-foreground",
                        (col.key === 'hourlyRate') && "justify-end pr-4"
                    )}
                  />
                </th>
              ))}
              <th className="px-4 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-center w-12 border-l border-border">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
            {loading ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-xs text-muted-foreground">Loading users...</td></tr>
            ) : error ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-red-500 text-xs font-bold">{error}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-xs text-muted-foreground uppercase font-bold tracking-tighter opacity-50">No users found</td></tr>
            ) : users.map((user) => (
              <tr 
                key={user._id} 
                className="group relative z-0 bg-background transition-colors duration-150 cursor-pointer hover:bg-secondary/30"
                onClick={() => router.push(`/profile/${user._id}`)}
              >
                {/* 1. Name + Avatar */}
                <td className="px-3 py-1.5 border-r border-border group-hover:border-l-2 group-hover:border-l-primary transition-all">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-secondary border border-border rounded flex items-center justify-center overflow-hidden shrink-0">
                      {user.profileImage ? (
                        <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-black text-muted-foreground uppercase">
                          {user.firstName?.[0]}{user.lastName?.[0]}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-foreground truncate">
                      {user.firstName} {user.lastName}
                    </span>
                  </div>
                </td>

                {/* 2. Role */}
                <td className="px-3 py-1.5 border-r border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        {user.role}
                    </span>
                </td>

                {/* 3. Department */}
                <td className="px-3 py-1.5 border-r border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-tighter">
                        {user.department === 'SUPERADMIN' ? 'Admin' : user.department}
                    </span>
                </td>

                {/* 4. Email */}
                <td className="px-3 py-1.5 border-r border-border">
                    <div className="flex items-center text-[11px] font-medium text-foreground truncate">
                        <Mail className="w-2.5 h-2.5 mr-1.5 text-muted-foreground/50 shrink-0" />
                        {user.email}
                    </div>
                </td>

                {/* 5. Phone */}
                <td className="px-3 py-1.5 border-r border-border whitespace-nowrap">
                    <div className="flex items-center text-[11px] font-medium text-foreground">
                        <Phone className="w-2.5 h-2.5 mr-1.5 text-muted-foreground/50 shrink-0" />
                        {user.phone || '-'}
                    </div>
                </td>

                {/* 6. Rate */}
                <td className="px-3 py-1.5 border-r border-border text-right pr-6">
                     <span className="text-[11px] text-foreground font-bold font-mono tracking-tighter">
                        ${user.hourlyRate || 0}
                     </span>
                </td>

                {/* 7. Status */}
                <td className="px-3 py-1.5 border-r border-border">
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      user.status === 'Active' ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/30"
                    )} />
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-tight",
                      user.status === 'Active' ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                    )}>
                      {user.status}
                    </span>
                  </div>
                </td>

                {/* 8. Actions */}
                <td className="px-3 py-1.5 text-center relative">
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); openModal(user); }}
                      className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(user._id); }}
                      className="p-1 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors rounded"
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
          totalItems={totalUsers}
          itemsPerPage={25}
          itemName="users"
        />
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border w-full max-w-lg shadow-2xl rounded-md animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">First Name</label>
                  <input
                    required
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Last Name</label>
                  <input
                    required
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Email</label>
                <input
                  type="email"
                  required
                  disabled={!!editingUser} // Email is ID, usually shouldn't change
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors disabled:opacity-50 rounded"
                  placeholder="name@company.com"
                />
              </div>

              <label className="text-[10px] font-bold text-muted-foreground uppercase">Profile Image</label>
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-secondary border border-border overflow-hidden flex-shrink-0 rounded">
                  {formData.profileImage ? (
                    <img src={formData.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
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
                    className="block w-full text-xs text-muted-foreground file:mr-4 file:py-2 file:px-4 file:border-0 file:text-xs file:font-bold file:uppercase file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 transition-colors disabled:opacity-50 file:rounded file:cursor-pointer"
                  />
                  {uploading && <p className="text-[10px] text-muted-foreground mt-1 animate-pulse">Uploading...</p>}
                </div>
              </div>

              {!editingUser && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Password</label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Role</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Department</label>
                  <select
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded"
                  >
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Phone</label>
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
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded"
                    placeholder="000 000 0000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Hourly Rate ($)</label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={e => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 bg-secondary border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-0 transition-colors rounded"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Status</label>
                <div className="flex items-center space-x-4 mt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={formData.status === 'Active'}
                      onChange={() => setFormData({ ...formData, status: 'Active' })}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-foreground">Active</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="status"
                      value="Inactive"
                      checked={formData.status === 'Inactive'}
                      onChange={() => setFormData({ ...formData, status: 'Inactive' })}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-medium text-foreground">Inactive</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center space-x-2 rounded"
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
