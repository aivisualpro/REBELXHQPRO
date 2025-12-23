'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import {
    Search,
    Upload,
    ArrowUpDown,
    Plus,
    Edit2,
    Trash2,
    X,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Pagination } from '@/components/ui/Pagination';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface User {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
}

interface Ticket {
    _id: string;
    date: string;
    requestedBy: string | User;
    subCategory: string;
    issue: string;
    reason: string;
    priority: string;
    deadline?: string;
    description: string;
    department: string;
    document?: string;
    status: string;
    completionNote?: string;
    completedBy?: string | User;
    completedAt?: string;
}

export default function TicketsPage() {
    const { data: session } = useSession();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    // Filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Modal & CRUD
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Ticket | null>(null);
    const [formData, setFormData] = useState<Partial<Ticket>>({});
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
        fetchTickets();
        fetchUsers();
    }, [page, debouncedSearch, sortBy, sortOrder]);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/users?limit=1000&sortBy=firstName'); // Fetch all users for dropdown
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
        }
    };

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                search: debouncedSearch,
                sortBy,
                sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
            });

            const res = await fetch(`/api/tickets?${params.toString()}`);
            const data = await res.json();
            if (res.ok) {
                setTickets(data.tickets || []);
                setTotalPages(data.totalPages || 1);
                setTotalItems(data.total || 0);
            } else {
                toast.error('Failed to fetch tickets');
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

                const toastId = toast.loading(`Importing ${totalItems} tickets...`);
                try {
                    const res = await fetch('/api/tickets/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: results.data })
                    });

                    const data = await res.json();

                    if (res.ok) {
                        toast.success(`Imported ${data.count} tickets!`, { id: toastId });
                        if (data.errors && data.errors.length > 0) {
                            setTimeout(() => toast.error(`${data.errors.length} errors occurred. Check console.`), 2000);
                            console.error(data.errors);
                        }
                    } else {
                        toast.error(data.error || "Import failed", { id: toastId });
                    }

                    fetchTickets();
                } catch (err: any) {
                    toast.error(`Error: ${err.message}`, { id: toastId });
                }
            }
        });
        e.target.value = '';
    };

    const openModal = (item?: Ticket) => {
        setEditingItem(item || null);
        if (item) {
            setFormData({
                ...item,
                // If it's an object (populated), take the _id.
                requestedBy: (typeof item.requestedBy === 'object' && item.requestedBy !== null) ? (item.requestedBy as User)._id : item.requestedBy as string,
                completedBy: (typeof item.completedBy === 'object' && item.completedBy !== null) ? (item.completedBy as User)._id : item.completedBy as string,
                date: item.date ? item.date.split('T')[0] : '',
                deadline: item.deadline ? item.deadline.split('T')[0] : '',
                completedAt: item.completedAt ? item.completedAt.split('T')[0] : ''
            });
        } else {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                priority: 'Medium',
                status: 'Open',
                // Default to current user's email if available, otherwise empty
                requestedBy: session?.user?.email || ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // Handle Dates
            const payload = { ...formData };
            if (!payload.requestedBy) payload.requestedBy = 'Unknown'; // Or handle required validation
            if (!payload.issue) payload.issue = 'No Issue';

            const url = editingItem ? `/api/tickets/${editingItem._id}` : '/api/tickets';
            const method = editingItem ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error('Failed to save');

            toast.success(editingItem ? 'Updated successfully' : 'Created successfully');
            setIsModalOpen(false);
            fetchTickets();
        } catch (error) {
            toast.error('Error saving ticket');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this ticket?')) return;

        try {
            const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Deleted successfully');
                fetchTickets();
            } else {
                toast.error('Failed to delete');
            }
        } catch (error) {
            toast.error('Error deleting ticket');
        }
    };

    const getPriorityColor = (p: string) => {
        switch (p?.toLowerCase()) {
            case 'critical': return 'bg-red-100 text-red-700 border-red-200';
            case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getStatusColor = (s: string) => {
        switch (s?.toLowerCase()) {
            case 'resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'closed': return 'bg-slate-200 text-slate-700 border-slate-300';
            case 'in progress': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-white text-slate-600 border-slate-200';
        }
    };

    const renderUser = (user: string | User | undefined) => {
        if (!user) return '-';
        if (typeof user === 'string') {
            const foundUser = users.find(u => u._id === user);
            return foundUser ? `${foundUser.firstName} ${foundUser.lastName}` : user; // Fallback to ID if not found
        }
        return `${user.firstName} ${user.lastName}`;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center space-x-4">
                    <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Tickets</h1>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search Issue, ID, Requested By..."
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
                        <span className="text-[10px] font-bold uppercase tracking-wider">New Ticket</span>
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
                                // Removed ID column
                                { key: 'priority', label: 'Priority' },
                                { key: 'date', label: 'Date' },
                                { key: 'issue', label: 'Issue' },
                                { key: 'requestedBy', label: 'Requested By' },
                                { key: 'department', label: 'Department' },
                                { key: 'status', label: 'Status' },
                                { key: 'deadline', label: 'Deadline' },
                                { key: 'completedBy', label: 'Completed By' }, // Added Completed By
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
                            <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400">Loading...</td></tr>
                        ) : tickets.length === 0 ? (
                            <tr><td colSpan={9} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No tickets found</td></tr>
                        ) : tickets.map(item => (
                            <tr key={item._id} className="hover:bg-slate-50 transition-colors group">
                                <td className="px-4 py-2">
                                    <span className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border",
                                        getPriorityColor(item.priority)
                                    )}>
                                        {item.priority}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-[11px] text-slate-500">
                                    {item.date ? new Date(item.date).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-2 text-[11px] font-bold text-slate-900 max-w-[200px] truncate" title={item.issue}>
                                    {item.issue}
                                </td>
                                <td className="px-4 py-2 text-[11px] text-slate-600 font-medium">
                                    {renderUser(item.requestedBy)}
                                </td>
                                <td className="px-4 py-2 text-[11px] text-slate-600">{item.department}</td>
                                <td className="px-4 py-2">
                                    <span className={cn(
                                        "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border",
                                        getStatusColor(item.status)
                                    )}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="px-4 py-2 text-[11px] text-slate-500">
                                    {item.deadline ? new Date(item.deadline).toLocaleDateString() : '-'}
                                </td>
                                <td className="px-4 py-2 text-[11px] text-slate-600">
                                    {renderUser(item.completedBy)}
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
                itemName="Tickets"
            />

            {/* CRUD Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h2 className="text-sm font-bold uppercase tracking-wider">{editingItem ? 'Edit Ticket' : 'New Ticket'}</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">

                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requested By</label>
                                    <SearchableSelect
                                        required
                                        options={users.map(u => ({ value: u._id, label: `${u.firstName} ${u.lastName}` }))}
                                        value={typeof formData.requestedBy === 'string' ? formData.requestedBy : formData.requestedBy?._id || ''}
                                        onChange={(val) => setFormData({ ...formData, requestedBy: val })}
                                        placeholder="Select User"
                                        className="bg-slate-50"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        value={formData.date || ''}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Priority</label>
                                    <select
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        value={formData.priority || 'Medium'}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value })}
                                    >
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                        <option value="Critical">Critical</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Issue</label>
                                <input
                                    required
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10 font-medium"
                                    value={formData.issue || ''}
                                    onChange={e => setFormData({ ...formData, issue: e.target.value })}
                                    placeholder="Brief summary of the issue"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10 min-h-[80px]"
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Detailed description..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Category / Sub-Category</label>
                                    <input
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        value={formData.subCategory || ''}
                                        onChange={e => setFormData({ ...formData, subCategory: e.target.value })}
                                        placeholder="e.g. Hardware / Printer"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Department</label>
                                    <input
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        value={formData.department || ''}
                                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reason</label>
                                    <input
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        value={formData.reason || ''}
                                        onChange={e => setFormData({ ...formData, reason: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Deadline</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                        value={formData.deadline || ''}
                                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                    />
                                </div>
                            </div>

                            {editingItem && (
                                <>
                                    <hr className="border-slate-100" />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
                                            <select
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                                value={formData.status || 'Open'}
                                                onChange={e => setFormData({ ...formData, status: e.target.value })}
                                            >
                                                <option value="Open">Open</option>
                                                <option value="In Progress">In Progress</option>
                                                <option value="Resolved">Resolved</option>
                                                <option value="Closed">Closed</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Completed By</label>
                                            <SearchableSelect
                                                options={users.map(u => ({ value: u._id, label: `${u.firstName} ${u.lastName}` }))}
                                                value={typeof formData.completedBy === 'string' ? formData.completedBy : formData.completedBy?._id || ''}
                                                onChange={(val) => setFormData({ ...formData, completedBy: val })}
                                                placeholder="Select User"
                                                className="bg-slate-50"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-1 mt-4">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Document Link</label>
                                <input
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    value={formData.document || ''}
                                    onChange={e => setFormData({ ...formData, document: e.target.value })}
                                    placeholder="URL..."
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
