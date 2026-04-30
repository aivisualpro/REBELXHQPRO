'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
    CalendarDays, Plus, Search, X, Loader2, Clock, DollarSign, Trash2, Pencil,
    ChevronLeft, ChevronRight, Download, Calendar, ChevronDown, Users, FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface User {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    hourlyRate?: number;
}

interface TimeSheetEntry {
    _id: string;
    date: string;
    user: string;
    hourlyRate: number;
    timeIn: string;
    timeOut: string;
    createdAt: string;
    createdBy: string;
}

function TimeSheetContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [entries, setEntries] = useState<TimeSheetEntry[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [employeeFilter, setEmployeeFilter] = useState(searchParams.get('employee') || '');
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<TimeSheetEntry | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Field visibility from workspace permissions (always respected, even for admins)
    const { isFieldVisibleByKey, isSuperAdmin, getSubModuleSetting } = usePermissions();
    const { data: session } = useSession();
    const loggedInEmail = session?.user?.email || '';

    const showDate = isFieldVisibleByKey('timesheet', 'date');
    const showUser = isFieldVisibleByKey('timesheet', 'user');
    const showHourlyRate = isFieldVisibleByKey('timesheet', 'hourlyRate');
    const showTimeIn = isFieldVisibleByKey('timesheet', 'timeIn');
    const showTimeOut = isFieldVisibleByKey('timesheet', 'timeOut');

    // Visibility setting: 'Self' locks employee filter to logged-in user
    const visibilitySetting = getSubModuleSetting('timesheet', 'visibility');
    const isSelfOnly = visibilitySetting === 'Self' && !isSuperAdmin;

    const [form, setForm] = useState({
        date: new Date().toISOString().split('T')[0],
        user: '',
        hourlyRate: 0,
        timeIn: '',
        timeOut: '',
        createdBy: '',
    });

    const limit = 50;

    // Date filter state — init from URL or default to This Month
    const formatDateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const now = new Date();
    const defaultFrom = formatDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
    const defaultTo = formatDateStr(new Date(now.getFullYear(), now.getMonth()+1, 0));
    const [datePreset, setDatePreset] = useState(searchParams.get('datePreset') || 'This Month');
    const [fromDate, setFromDate] = useState(searchParams.get('fromDate') || defaultFrom);
    const [toDate, setToDate] = useState(searchParams.get('toDate') || defaultTo);
    const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
    const dateDropdownRef = useRef<HTMLDivElement>(null);

    // Employee filter dropdown
    const [isEmpDropdownOpen, setIsEmpDropdownOpen] = useState(false);
    const [empSearch, setEmpSearch] = useState('');
    const empDropdownRef = useRef<HTMLDivElement>(null);

    // Modal searchable employee select
    const [modalEmpSearch, setModalEmpSearch] = useState('');
    const [isModalEmpOpen, setIsModalEmpOpen] = useState(false);
    const modalEmpRef = useRef<HTMLDivElement>(null);

    const handleDatePreset = (preset: string) => {
        const today = new Date();
        let s = '', e = '';
        if (preset === 'This Month') { s = formatDateStr(new Date(today.getFullYear(), today.getMonth(), 1)); e = formatDateStr(new Date(today.getFullYear(), today.getMonth()+1, 0)); }
        else if (preset === 'Last Month') { s = formatDateStr(new Date(today.getFullYear(), today.getMonth()-1, 1)); e = formatDateStr(new Date(today.getFullYear(), today.getMonth(), 0)); }
        else if (preset === 'This Year') { s = formatDateStr(new Date(today.getFullYear(), 0, 1)); e = formatDateStr(new Date(today.getFullYear(), 11, 31)); }
        else if (preset === 'Last Year') { s = formatDateStr(new Date(today.getFullYear()-1, 0, 1)); e = formatDateStr(new Date(today.getFullYear()-1, 11, 31)); }
        setDatePreset(preset); setFromDate(s); setToDate(e); setIsDateDropdownOpen(false); setPage(1);
    };

    useEffect(() => {
        const handleClick = (ev: MouseEvent) => { if (dateDropdownRef.current && !dateDropdownRef.current.contains(ev.target as Node)) setIsDateDropdownOpen(false); };
        if (isDateDropdownOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isDateDropdownOpen]);

    useEffect(() => {
        const handleClick = (ev: MouseEvent) => { if (empDropdownRef.current && !empDropdownRef.current.contains(ev.target as Node)) { setIsEmpDropdownOpen(false); setEmpSearch(''); } };
        if (isEmpDropdownOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isEmpDropdownOpen]);

    useEffect(() => {
        const handleClick = (ev: MouseEvent) => { if (modalEmpRef.current && !modalEmpRef.current.contains(ev.target as Node)) { setIsModalEmpOpen(false); setModalEmpSearch(''); } };
        if (isModalEmpOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isModalEmpOpen]);

    // Fetch users for dropdown
    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/users?limit=500&status=Active');
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
            }
        } catch (error) {
            console.error('Failed to fetch users', error);
        }
    }, []);

    // Fetch timesheet entries
    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
            });
            if (employeeFilter) params.set('user', employeeFilter);
            if (fromDate) params.set('fromDate', fromDate + 'T00:00:00.000Z');
            if (toDate) params.set('toDate', toDate + 'T23:59:59.999Z');
            const res = await fetch(`/api/hr/timesheets?${params}`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.timesheets || []);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error('Failed to fetch timesheets', error);
        } finally {
            setLoading(false);
        }
    }, [page, employeeFilter, fromDate, toDate]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    // Force employee filter to self when visibility=Self
    useEffect(() => {
        if (isSelfOnly && loggedInEmail && employeeFilter !== loggedInEmail) {
            setEmployeeFilter(loggedInEmail);
        }
    }, [isSelfOnly, loggedInEmail]);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    // Sync filters to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (employeeFilter) params.set('employee', employeeFilter);
        if (datePreset !== 'This Month') params.set('datePreset', datePreset);
        if (fromDate && fromDate !== defaultFrom) params.set('fromDate', fromDate);
        if (toDate && toDate !== defaultTo) params.set('toDate', toDate);
        const qs = params.toString();
        const newUrl = `${window.location.pathname}${qs ? '?' + qs : ''}`;
        const currentQs = window.location.search.replace(/^\?/, '');
        if (currentQs !== qs) router.replace(newUrl, { scroll: false });
    }, [employeeFilter, datePreset, fromDate, toDate, router, defaultFrom, defaultTo]);

    // When user changes in form, auto-populate hourlyRate
    const handleUserChange = (email: string) => {
        const u = users.find(u => u.email === email);
        setForm(prev => ({
            ...prev,
            user: email,
            hourlyRate: u?.hourlyRate || 0,
        }));
    };

    // Open create modal
    const openCreate = () => {
        setEditing(null);
        setForm({
            date: new Date().toISOString().split('T')[0],
            user: '',
            hourlyRate: 0,
            timeIn: '',
            timeOut: '',
            createdBy: '',
        });
        setModalOpen(true);
    };

    // Open edit modal
    const openEdit = (entry: TimeSheetEntry) => {
        setEditing(entry);
        setForm({
            date: entry.date ? new Date(entry.date).toISOString().split('T')[0] : '',
            user: entry.user,
            hourlyRate: entry.hourlyRate,
            timeIn: entry.timeIn,
            timeOut: entry.timeOut,
            createdBy: entry.createdBy,
        });
        setModalOpen(true);
    };

    // Save
    const handleSave = async () => {
        if (!form.user || !form.timeIn || !form.timeOut) {
            toast.error('User, Time In, and Time Out are required');
            return;
        }
        setSaving(true);
        try {
            const url = editing ? `/api/hr/timesheets/${editing._id}` : '/api/hr/timesheets';
            const method = editing ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                toast.success(editing ? 'Entry updated' : 'Entry created');
                setModalOpen(false);
                fetchEntries();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to save');
            }
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // Delete
    const handleDelete = async (id: string) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Delete this timesheet entry?</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => { toast.dismiss(t.id); confirmDelete(id); }}
                        className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                    >
                        Delete
                    </button>
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        ), { duration: 10000 });
    };

    const confirmDelete = async (id: string) => {
        setDeleting(id);
        try {
            const res = await fetch(`/api/hr/timesheets/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Entry deleted');
                setEntries(prev => prev.filter(e => e._id !== id));
            } else {
                toast.error('Failed to delete');
            }
        } catch {
            toast.error('Failed to delete');
        } finally {
            setDeleting(null);
        }
    };

    // Calculate hours worked
    const calcHours = (timeIn: string, timeOut: string): string => {
        try {
            const parseTime = (t: string) => {
                const match = t.match(/^(\d{1,2}):(\d{2}):?(\d{2})?\s*(AM|PM)?$/i);
                if (!match) return null;
                let h = parseInt(match[1]);
                const m = parseInt(match[2]);
                const period = match[4]?.toUpperCase();
                if (period === 'PM' && h !== 12) h += 12;
                if (period === 'AM' && h === 12) h = 0;
                return h * 60 + m;
            };
            const inMins = parseTime(timeIn);
            const outMins = parseTime(timeOut);
            if (inMins === null || outMins === null) return '-';
            const diff = outMins - inMins;
            if (diff <= 0) return '-';
            return (diff / 60).toFixed(2);
        } catch {
            return '-';
        }
    };

    const totalPages = Math.ceil(total / limit);

    // Find user display name (name only)
    const getUserName = (email: string) => {
        const u = users.find(u => u.email === email);
        return u ? `${u.firstName} ${u.lastName}` : email;
    };

    // Resolve createdBy email to name
    const getCreatedByName = (email: string) => {
        if (!email) return '-';
        const u = users.find(u => u.email === email);
        return u ? `${u.firstName} ${u.lastName}` : email;
    };

    // Compute sum of total hours and total amount across current entries
    const totalHours = entries.reduce((sum, entry) => {
        const h = calcHours(entry.timeIn, entry.timeOut);
        return sum + (h !== '-' ? parseFloat(h) : 0);
    }, 0);

    const totalAmount = entries.reduce((sum, entry) => {
        const h = calcHours(entry.timeIn, entry.timeOut);
        return sum + (h !== '-' ? parseFloat(h) * entry.hourlyRate : 0);
    }, 0);

    // CSV Download
    const handleDownloadCSV = () => {
        const rows = [['Date', 'Employee', 'Email', 'Hourly Rate', 'Time In', 'Time Out', 'Hours', 'Total', 'Created By']];
        entries.forEach(entry => {
            const h = calcHours(entry.timeIn, entry.timeOut);
            const cost = h !== '-' ? (parseFloat(h) * entry.hourlyRate).toFixed(2) : '';
            rows.push([
                entry.date ? new Date(entry.date).toLocaleDateString('en-US') : '',
                getUserName(entry.user), entry.user, entry.hourlyRate.toFixed(2),
                entry.timeIn, entry.timeOut, h !== '-' ? h : '', cost, getCreatedByName(entry.createdBy),
            ]);
        });
        rows.push(['', '', '', '', '', '', totalHours.toFixed(2), '', '']);
        const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `timesheet_${fromDate || 'all'}_${toDate || 'all'}.csv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success('CSV downloaded');
    };

    // PDF Download (print-friendly)
    const handleDownloadPDF = () => {
        const title = `TimeSheet Report${employeeFilter ? ' — ' + getUserName(employeeFilter) : ''}${fromDate ? ' | ' + fromDate : ''}${toDate ? ' to ' + toDate : ''}`;
        let html = `<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}h1{font-size:16px;margin-bottom:4px}p{color:#666;font-size:11px;margin-bottom:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f5f5f5;font-size:10px;text-transform:uppercase;font-weight:800}td{font-size:11px}.right{text-align:right}.bold{font-weight:bold}.total-row{background:#f0fdf4;font-weight:bold}@media print{body{padding:0}}</style></head><body>`;
        html += `<h1>${title}</h1><p>${total} entries | Total Hours: ${totalHours.toFixed(2)}</p>`;
        html += '<table><thead><tr><th>Date</th><th>Employee</th><th class="right">Hourly Rate</th><th>Time In</th><th>Time Out</th><th class="right">Hours</th><th class="right">Total</th></tr></thead><tbody>';
        entries.forEach(entry => {
            const h = calcHours(entry.timeIn, entry.timeOut);
            const cost = h !== '-' ? (parseFloat(h) * entry.hourlyRate).toFixed(2) : '-';
            html += `<tr><td>${entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</td><td>${getUserName(entry.user)}</td><td class="right">$${entry.hourlyRate.toFixed(2)}</td><td>${entry.timeIn}</td><td>${entry.timeOut}</td><td class="right bold">${h}</td><td class="right">${cost !== '-' ? '$' + cost : '-'}</td></tr>`;
        });
        html += `<tr class="total-row"><td colspan="5">Total</td><td class="right">${totalHours.toFixed(2)}</td><td class="right">$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td></tr>`;
        html += '</tbody></table></body></html>';
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300); }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="px-4 py-2.5 flex items-center gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-teal-500/15 flex items-center justify-center">
                            <CalendarDays className="w-3.5 h-3.5 text-teal-500" />
                        </div>
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">TimeSheet</h1>
                    </div>

                    <div className="h-5 w-px bg-border shrink-0" />

                    {/* Employee Filter Dropdown — hidden when visibility=Self */}
                    {!isSelfOnly && (<div className="relative shrink-0" ref={empDropdownRef}>
                        <button
                            onClick={() => { setIsEmpDropdownOpen(p => !p); setEmpSearch(''); }}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-8 rounded border text-[11px] font-semibold transition-all cursor-pointer bg-secondary border-border hover:bg-secondary/80',
                                employeeFilter ? 'bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20' : 'text-foreground'
                            )}
                        >
                            <Users className="w-3 h-3" />
                            <span className="uppercase tracking-wider text-nowrap">
                                {employeeFilter ? getUserName(employeeFilter) : 'All Employees'}
                            </span>
                            <ChevronDown className={cn('w-3 h-3 transition-transform', isEmpDropdownOpen && 'rotate-180')} />
                        </button>
                        {isEmpDropdownOpen && (
                            <div className="absolute left-0 top-full mt-1.5 z-50 bg-background border border-border rounded-xl shadow-2xl min-w-[260px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-3 py-2 border-b border-border bg-secondary flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Employee</span>
                                    {employeeFilter && (
                                        <button onClick={() => { setEmployeeFilter(''); setIsEmpDropdownOpen(false); setPage(1); }} className="text-[9px] font-bold text-primary hover:underline cursor-pointer">Clear</button>
                                    )}
                                </div>
                                <div className="p-2 border-b border-border">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                        <input
                                            type="text"
                                            placeholder="Search employees..."
                                            value={empSearch}
                                            onChange={e => setEmpSearch(e.target.value)}
                                            className="w-full pl-7 pr-3 h-7 bg-background border border-border rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/30 text-foreground placeholder:text-muted-foreground"
                                            autoFocus
                                        />
                                    </div>
                                </div>
                                <div className="max-h-[240px] overflow-y-auto">
                                    <button
                                        onClick={() => { setEmployeeFilter(''); setIsEmpDropdownOpen(false); setEmpSearch(''); setPage(1); }}
                                        className={cn('w-full text-left px-3 py-2 text-[11px] font-semibold transition-colors cursor-pointer hover:bg-secondary', !employeeFilter ? 'bg-teal-500/10 text-teal-400' : 'text-foreground')}
                                    >
                                        All Employees
                                    </button>
                                    {users
                                        .filter(u => {
                                            if (!empSearch) return true;
                                            const q = empSearch.toLowerCase();
                                            return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                                        })
                                        .map(u => (
                                        <button
                                            key={u._id}
                                            onClick={() => { setEmployeeFilter(u.email); setIsEmpDropdownOpen(false); setEmpSearch(''); setPage(1); }}
                                            className={cn('w-full text-left px-3 py-2 text-[11px] transition-colors cursor-pointer hover:bg-secondary', employeeFilter === u.email ? 'bg-teal-500/10 text-teal-400 font-bold' : 'text-foreground')}
                                        >
                                            {u.firstName} {u.lastName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    )}

                    {/* Date Filter Dropdown */}
                    <div className="relative shrink-0" ref={dateDropdownRef}>
                        <button
                            onClick={() => setIsDateDropdownOpen(p => !p)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 h-8 rounded border text-[11px] font-semibold transition-all cursor-pointer bg-secondary border-border hover:bg-secondary/80',
                                (fromDate || toDate) ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20' : 'text-foreground'
                            )}
                        >
                            <Calendar className="w-3 h-3" />
                            <span className="uppercase tracking-wider text-nowrap">
                                {datePreset !== 'All Time' ? datePreset : (fromDate || toDate) ? 'Custom' : 'All Time'}
                            </span>
                            <ChevronDown className={cn('w-3 h-3 transition-transform', isDateDropdownOpen && 'rotate-180')} />
                        </button>
                        {isDateDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1.5 z-50 bg-background border border-border rounded-xl shadow-2xl min-w-[280px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-3 py-2 border-b border-border bg-secondary flex justify-between items-center">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date Filter</span>
                                    {(fromDate || toDate || datePreset !== 'All Time') && (
                                        <button onClick={() => { setDatePreset('All Time'); setFromDate(''); setToDate(''); setIsDateDropdownOpen(false); setPage(1); }} className="text-[9px] font-bold text-primary hover:underline cursor-pointer">Clear</button>
                                    )}
                                </div>
                                <div className="p-3 bg-background grid gap-1.5 grid-cols-2 text-center pb-3 border-b border-border">
                                    {['This Month', 'Last Month', 'This Year', 'Last Year'].map(preset => (
                                        <button key={preset} onClick={() => handleDatePreset(preset)} className={cn('px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer', datePreset === preset ? 'bg-primary border-primary text-white' : 'bg-secondary border-border hover:bg-secondary/80 text-foreground')}>{preset}</button>
                                    ))}
                                </div>
                                <div className="p-3 bg-background space-y-2">
                                    <div className="space-y-1 text-left">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">From</label>
                                        <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setDatePreset('Custom'); setPage(1); }} className="w-full bg-background border border-border rounded-lg px-2 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all text-foreground" />
                                    </div>
                                    <div className="space-y-1 text-left">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">To</label>
                                        <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setDatePreset('Custom'); setPage(1); }} className="w-full bg-background border border-border rounded-lg px-2 h-8 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/5 transition-all text-foreground" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex-1" />

                    {/* KPI Chips */}
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/80 border border-border">
                            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{total}</span>
                            <span className="text-[9px] text-muted-foreground/60">entries</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
                            <Clock className="w-3 h-3 text-teal-500" />
                            <span className="text-[10px] font-black text-teal-500 tabular-nums">{totalHours.toFixed(2)}</span>
                            <span className="text-[9px] text-teal-500/60">hrs</span>
                        </div>
                        {showHourlyRate && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <DollarSign className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-500 tabular-nums">{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        )}
                    </div>

                    <div className="h-4 w-px bg-border" />

                    <button
                        onClick={handleDownloadCSV}
                        className="h-8 px-3 border border-border rounded hover:bg-secondary transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Download CSV"
                    >
                        <Download className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">CSV</span>
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        className="h-8 px-3 border border-border rounded hover:bg-secondary transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Download PDF"
                    >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">PDF</span>
                    </button>

                    <button
                        onClick={openCreate}
                        className="h-8 px-4 bg-teal-600 text-white hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-black uppercase tracking-widest">Add Entry</span>
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-24">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading timesheets...</span>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24">
                        <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No timesheet entries found</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Create your first entry or import from CSV</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-card border-b border-border">
                            <tr>
                                {showDate && <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Date</th>}
                                {showUser && <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Employee</th>}
                                {showHourlyRate && <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Hourly Rate</th>}
                                {showTimeIn && <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Time In</th>}
                                {showTimeOut && <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Time Out</th>}
                                {(showTimeIn && showTimeOut) && <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Hours</th>}
                                {(showHourlyRate && showTimeIn && showTimeOut) && <th className="text-right px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Total</th>}
                                <th className="text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-r border-border">Created By</th>
                                <th className="text-center px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, i) => {
                                const hours = calcHours(entry.timeIn, entry.timeOut);
                                const totalCost = hours !== '-' ? (parseFloat(hours) * entry.hourlyRate).toFixed(2) : '-';
                                return (
                                    <tr
                                        key={entry._id}
                                        className={cn(
                                            "border-b border-border hover:bg-secondary/40 transition-colors",
                                            i % 2 === 0 ? "bg-card" : "bg-card/60"
                                        )}
                                    >
                                        {showDate && (
                                        <td className="px-4 py-2.5 text-[12px] text-foreground border-r border-border font-mono">
                                            {entry.date ? new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                                        </td>
                                        )}
                                        {showUser && (
                                        <td className="px-4 py-2.5 text-[12px] text-foreground border-r border-border font-medium">
                                            {getUserName(entry.user)}
                                        </td>
                                        )}
                                        {showHourlyRate && (
                                        <td className="px-4 py-2.5 text-[12px] text-foreground border-r border-border text-right font-mono">
                                            ${entry.hourlyRate.toFixed(2)}
                                        </td>
                                        )}
                                        {showTimeIn && (
                                        <td className="px-4 py-2.5 text-[12px] text-foreground border-r border-border">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 text-teal-500" />
                                                {entry.timeIn}
                                            </div>
                                        </td>
                                        )}
                                        {showTimeOut && (
                                        <td className="px-4 py-2.5 text-[12px] text-foreground border-r border-border">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3 h-3 text-orange-500" />
                                                {entry.timeOut}
                                            </div>
                                        </td>
                                        )}
                                        {(showTimeIn && showTimeOut) && (
                                        <td className="px-4 py-2.5 text-[12px] text-foreground border-r border-border text-right font-mono font-bold">
                                            {hours}
                                        </td>
                                        )}
                                        {(showHourlyRate && showTimeIn && showTimeOut) && (
                                        <td className="px-4 py-2.5 text-[12px] text-foreground border-r border-border text-right font-mono">
                                            <span className={cn(totalCost !== '-' ? "text-emerald-500 font-bold" : "text-muted-foreground")}>
                                                {totalCost !== '-' ? `$${totalCost}` : '-'}
                                            </span>
                                        </td>
                                        )}
                                        <td className="px-4 py-2.5 text-[11px] text-muted-foreground border-r border-border">
                                            {getCreatedByName(entry.createdBy)}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => openEdit(entry)}
                                                    className="p-1.5 rounded hover:bg-secondary transition-colors cursor-pointer"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(entry._id)}
                                                    disabled={deleting === entry._id}
                                                    className="p-1.5 rounded hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    <Trash2 className={cn("w-3.5 h-3.5", deleting === entry._id ? "animate-spin text-muted-foreground" : "text-red-500")} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="shrink-0 border-t border-border bg-card/80 px-4 py-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="h-7 px-3 text-[11px] border border-border rounded hover:bg-secondary transition-colors disabled:opacity-30 cursor-pointer"
                        >
                            <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="h-7 px-3 text-[11px] border border-border rounded hover:bg-secondary transition-colors disabled:opacity-30 cursor-pointer"
                        >
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
                    <div className="relative bg-card rounded-xl shadow-2xl border border-border w-full max-w-lg mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-5 border-b border-border">
                            <div className="flex items-center gap-2">
                                <CalendarDays className="w-4 h-4 text-teal-500" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                                    {editing ? 'Edit Entry' : 'New TimeSheet Entry'}
                                </h2>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="p-1 hover:bg-secondary rounded transition-colors cursor-pointer">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            {/* Date */}
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                                    Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                                />
                            </div>

                            {/* Employee Select (Searchable) */}
                            <div ref={modalEmpRef} className="relative">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                                    Employee <span className="text-red-500">*</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => { setIsModalEmpOpen(p => !p); setModalEmpSearch(''); }}
                                    className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/30 text-left flex items-center justify-between cursor-pointer"
                                >
                                    <span className={form.user ? 'text-foreground' : 'text-muted-foreground'}>
                                        {form.user ? getUserName(form.user) : 'Select Employee'}
                                    </span>
                                    <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', isModalEmpOpen && 'rotate-180')} />
                                </button>
                                {isModalEmpOpen && (
                                    <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-background border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                        <div className="p-2 border-b border-border">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    placeholder="Search employees..."
                                                    value={modalEmpSearch}
                                                    onChange={e => setModalEmpSearch(e.target.value)}
                                                    className="w-full pl-7 pr-3 h-7 bg-background border border-border rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-teal-500/30 text-foreground placeholder:text-muted-foreground"
                                                    autoFocus
                                                />
                                            </div>
                                        </div>
                                        <div className="max-h-[200px] overflow-y-auto">
                                            {users
                                                .filter(u => {
                                                    if (!modalEmpSearch) return true;
                                                    const q = modalEmpSearch.toLowerCase();
                                                    return `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                                                })
                                                .map(u => (
                                                <button
                                                    key={u._id}
                                                    type="button"
                                                    onClick={() => { handleUserChange(u.email); setIsModalEmpOpen(false); setModalEmpSearch(''); }}
                                                    className={cn('w-full text-left px-3 py-2 text-[12px] transition-colors cursor-pointer hover:bg-secondary', form.user === u.email ? 'bg-teal-500/10 text-teal-400 font-bold' : 'text-foreground')}
                                                >
                                                    {u.firstName} {u.lastName}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Hourly Rate */}
                            {showHourlyRate && (
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                                    Hourly Rate
                                </label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={form.hourlyRate}
                                        onChange={e => setForm(prev => ({ ...prev, hourlyRate: parseFloat(e.target.value) || 0 }))}
                                        className="w-full h-9 pl-8 pr-3 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">Auto-populated from user profile. Can be overridden.</p>
                            </div>
                            )}

                            {/* Time In / Time Out */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                                        Time In <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="6:29:00 AM"
                                        value={form.timeIn}
                                        onChange={e => setForm(prev => ({ ...prev, timeIn: e.target.value }))}
                                        className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">
                                        Time Out <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="5:30:00 PM"
                                        value={form.timeOut}
                                        onChange={e => setForm(prev => ({ ...prev, timeOut: e.target.value }))}
                                        className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-teal-500/30"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-border flex items-center justify-end gap-3">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="h-8 px-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground border border-border rounded hover:bg-secondary transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="h-8 px-5 text-[11px] font-black uppercase tracking-widest bg-teal-600 text-white rounded hover:opacity-90 transition-all shadow disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                            >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                {editing ? 'Update' : 'Create'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TimeSheetPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
            <TimeSheetContent />
        </Suspense>
    );
}
