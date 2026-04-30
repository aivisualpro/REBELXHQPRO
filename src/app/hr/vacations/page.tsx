'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { CalendarDays, Plus, X, Loader2, Clock, Trash2, ChevronDown, Users, CheckCircle, XCircle, AlertCircle, Palmtree, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { VACATION_TYPES, VACATION_TYPE_CONFIG, getVacationTypeConfig } from '@/constants/vacation-types';

interface User { _id: string; email: string; firstName: string; lastName: string; }
interface VacationEntry {
    _id: string; employee: string; employeeName: string; dateFrom: string; dateTo: string;
    totalDays: number; vacationType: string; reason: string; status: 'Pending' | 'Approved' | 'Rejected';
    reviewedBy: string; reviewedByName: string; reviewNote: string; reviewedAt: string; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
    Pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    Approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
};

const TYPE_BADGE_COLORS: Record<string, string> = {
    'Annual Leave': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    'Sick Leave': 'bg-red-500/10 text-red-400 border-red-500/25',
    'Personal Leave': 'bg-violet-500/10 text-violet-400 border-violet-500/25',
    'Unpaid Leave': 'bg-slate-500/10 text-slate-400 border-slate-500/25',
    'Maternity/Paternity': 'bg-pink-500/10 text-pink-400 border-pink-500/25',
    'Bereavement': 'bg-gray-500/10 text-gray-400 border-gray-500/25',
    'Other': 'bg-amber-500/10 text-amber-400 border-amber-500/25',
};

function calcDays(from: string, to: string): number {
    if (!from || !to) return 0;
    const d1 = new Date(from); const d2 = new Date(to);
    if (d2 < d1) return 0;
    let count = 0;
    const cur = new Date(d1);
    while (cur <= d2) {
        const day = cur.getDay();
        if (day !== 0 && day !== 6) count++; // skip Sun & Sat
        cur.setDate(cur.getDate() + 1);
    }
    return count;
}

function VacationsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const { isFieldVisibleByKey, isSuperAdmin, getSubModuleSetting, canCreate, canDelete, canUpdate } = usePermissions();
    const loggedInEmail = session?.user?.email || '';
    const loggedInName = session?.user?.name || '';

    const visibilitySetting = getSubModuleSetting('vacations', 'visibility');
    const isSelfOnly = visibilitySetting === 'Self' && !isSuperAdmin;

    const [entries, setEntries] = useState<VacationEntry[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [summary, setSummary] = useState({ pending: 0, approved: 0, rejected: 0, totalDaysApproved: 0, totalDaysPending: 0 });
    const [modalOpen, setModalOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState<VacationEntry | null>(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
    const [employeeFilter, setEmployeeFilter] = useState(isSelfOnly ? loggedInEmail : (searchParams.get('employee') || ''));

    const [form, setForm] = useState({ dateFrom: '', dateTo: '', vacationType: 'Annual Leave', reason: '' });

    // Fetch
    const fetchEntries = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' });
            if (employeeFilter) params.set('employee', employeeFilter);
            if (statusFilter) params.set('status', statusFilter);
            const res = await fetch(`/api/hr/vacations?${params}`);
            if (res.ok) {
                const data = await res.json();
                setEntries(data.vacations); setTotal(data.total); setSummary(data.summary);
            }
        } catch { toast.error('Failed to load'); } finally { setLoading(false); }
    }, [page, employeeFilter, statusFilter]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/users?limit=500&status=Active');
            if (res.ok) { const data = await res.json(); setUsers(data.users || []); }
        } catch {}
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => {
        if (isSelfOnly && loggedInEmail && employeeFilter !== loggedInEmail) setEmployeeFilter(loggedInEmail);
    }, [isSelfOnly, loggedInEmail]);
    useEffect(() => { fetchEntries(); }, [fetchEntries]);

    // Check URL for detail view
    useEffect(() => {
        const id = searchParams.get('id');
        if (id && entries.length) {
            const found = entries.find(e => e._id === id);
            if (found) setDetailOpen(found);
        }
    }, [searchParams, entries]);

    const getUserName = (email: string) => {
        const u = users.find(u => u.email === email);
        return u ? `${u.firstName} ${u.lastName}`.trim() : email;
    };

    // Submit
    const handleSubmit = async () => {
        if (!form.dateFrom || !form.dateTo || !form.vacationType) { toast.error('Fill all required fields'); return; }
        const totalDays = calcDays(form.dateFrom, form.dateTo);
        if (totalDays <= 0) { toast.error('Invalid date range'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/hr/vacations', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, totalDays, employee: loggedInEmail, employeeName: loggedInName || loggedInEmail }),
            });
            if (res.ok) {
                toast.success('Vacation request submitted!');
                setModalOpen(false); setForm({ dateFrom: '', dateTo: '', vacationType: 'Annual Leave', reason: '' });
                fetchEntries();
            } else { const d = await res.json(); toast.error(d.error || 'Failed'); }
        } catch { toast.error('Failed to submit'); } finally { setSaving(false); }
    };

    const handleDelete = (id: string) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold">Delete this vacation request?</span>
                <div className="flex gap-2">
                    <button onClick={() => { toast.dismiss(t.id); confirmDelete(id); }} className="px-3 py-1 text-xs font-bold uppercase bg-red-500 text-white rounded hover:bg-red-600 transition-colors">Delete</button>
                    <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1 text-xs font-bold uppercase bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors">Cancel</button>
                </div>
            </div>
        ), { duration: 10000 });
    };

    const confirmDelete = async (id: string) => {
        setDeleting(id);
        try {
            const res = await fetch(`/api/hr/vacations/${id}`, { method: 'DELETE' });
            if (res.ok) { toast.success('Deleted'); setEntries(prev => prev.filter(e => e._id !== id)); } else toast.error('Failed');
        } catch { toast.error('Failed'); } finally { setDeleting(null); }
    };

    const handleReview = async (id: string, action: 'Approved' | 'Rejected', note: string) => {
        try {
            const res = await fetch(`/api/hr/vacations/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action, reviewedBy: loggedInEmail, reviewedByName: loggedInName || loggedInEmail, reviewNote: note, reviewedAt: new Date().toISOString() }),
            });
            if (res.ok) { toast.success(`Request ${action.toLowerCase()}`); setDetailOpen(null); fetchEntries(); } else toast.error('Failed');
        } catch { toast.error('Failed'); }
    };

    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const totalPages = Math.ceil(total / 50);

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background text-foreground">
            {/* Header */}
            <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3">
                <Palmtree className="w-5 h-5 text-primary" />
                <h1 className="text-[13px] font-black uppercase tracking-widest">Vacations</h1>

                {/* Status filter chips */}
                <div className="flex items-center gap-1.5 ml-4">
                    {['', 'Pending', 'Approved', 'Rejected'].map(s => (
                        <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={cn('px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer',
                                statusFilter === s ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-secondary border-border text-muted-foreground hover:bg-secondary/80'
                            )}>
                            {s || 'All'}
                        </button>
                    ))}
                </div>

                {!isSelfOnly && (
                    <div className="relative ml-2">
                        <select value={employeeFilter} onChange={e => { setEmployeeFilter(e.target.value); setPage(1); }}
                            className="h-7 pl-2 pr-6 text-[10px] font-bold bg-secondary border border-border rounded cursor-pointer appearance-none">
                            <option value="">All Employees</option>
                            {users.map(u => <option key={u._id} value={u.email}>{u.firstName} {u.lastName}</option>)}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none text-muted-foreground" />
                    </div>
                )}

                <div className="flex-1" />

                {/* KPI Chips */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
                        <AlertCircle className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] font-bold text-amber-400">{summary.pending} Pending</span>
                        <span className="text-[9px] text-amber-400/70">({summary.totalDaysPending}d)</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-bold text-emerald-400">{summary.approved} Approved</span>
                        <span className="text-[9px] text-emerald-400/70">({summary.totalDaysApproved}d)</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20">
                        <XCircle className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] font-bold text-red-400">{summary.rejected}</span>
                    </div>
                </div>

                <button onClick={() => setModalOpen(true)} className="h-8 px-4 bg-primary text-black rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:opacity-90 transition-all cursor-pointer shadow">
                    <Plus className="w-3.5 h-3.5" /> Request
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <Palmtree className="w-12 h-12 mb-3 opacity-30" /><p className="text-sm font-bold">No vacation requests</p>
                    </div>
                ) : (
                    <table className="w-full text-[12px]">
                        <thead className="sticky top-0 z-10 bg-card border-b border-border">
                            <tr className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                <th className="text-left px-4 py-2.5">Employee</th>
                                <th className="text-left px-4 py-2.5">Type</th>
                                <th className="text-left px-4 py-2.5">From</th>
                                <th className="text-left px-4 py-2.5">To</th>
                                <th className="text-center px-4 py-2.5">Days</th>
                                <th className="text-left px-4 py-2.5">Reason</th>
                                <th className="text-center px-4 py-2.5">Status</th>
                                <th className="text-left px-4 py-2.5">Reviewed By</th>
                                <th className="text-right px-4 py-2.5">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map(e => (
                                <tr key={e._id} onClick={() => setDetailOpen(e)} className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                                    <td className="px-4 py-2.5 font-semibold">{e.employeeName}</td>
                                    <td className="px-4 py-2.5">
                                        <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold', TYPE_BADGE_COLORS[e.vacationType] || TYPE_BADGE_COLORS['Other'])}>{getVacationTypeConfig(e.vacationType).emoji} {e.vacationType}</span>
                                    </td>
                                    <td className="px-4 py-2.5">{formatDate(e.dateFrom)}</td>
                                    <td className="px-4 py-2.5">{formatDate(e.dateTo)}</td>
                                    <td className="px-4 py-2.5 text-center font-bold">{e.totalDays}</td>
                                    <td className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground">{e.reason || '—'}</td>
                                    <td className="px-4 py-2.5 text-center">
                                        <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold', STATUS_COLORS[e.status])}>{e.status}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-muted-foreground">{e.reviewedByName || '—'}</td>
                                    <td className="px-4 py-2.5 text-right" onClick={ev => ev.stopPropagation()}>
                                        {e.status === 'Pending' && (
                                            <button onClick={() => handleDelete(e._id)} disabled={deleting === e._id}
                                                className="p-1 text-red-400 hover:bg-red-500/10 rounded transition-colors cursor-pointer">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="shrink-0 border-t border-border bg-card/80 px-4 py-2 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Page {page} of {totalPages} ({total} entries)</span>
                    <div className="flex gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 rounded hover:bg-secondary disabled:opacity-30 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 rounded hover:bg-secondary disabled:opacity-30 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            )}

            {/* Request Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
                    <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 h-12 flex items-center justify-between shrink-0">
                            <h2 className="text-white font-black text-[13px] uppercase tracking-widest">Request Vacation</h2>
                            <button onClick={() => setModalOpen(false)} className="text-white/60 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Date From *</label>
                                    <input type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))}
                                        style={{ colorScheme: 'dark' }}
                                        className="w-full h-9 px-3 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Date To *</label>
                                    <input type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))}
                                        style={{ colorScheme: 'dark' }}
                                        className="w-full h-9 px-3 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none" />
                                </div>
                            </div>
                            {form.dateFrom && form.dateTo && calcDays(form.dateFrom, form.dateTo) > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg">
                                    <CalendarDays className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-bold text-primary">{calcDays(form.dateFrom, form.dateTo)} business day{calcDays(form.dateFrom, form.dateTo) > 1 ? 's' : ''}</span>
                                    <span className="text-[10px] text-primary/60 ml-1">(excl. weekends)</span>
                                </div>
                            )}
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Vacation Type *</label>
                                <select value={form.vacationType} onChange={e => setForm(f => ({ ...f, vacationType: e.target.value }))}
                                    className="w-full h-9 px-3 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none cursor-pointer">
                                    {VACATION_TYPES.map(t => <option key={t} value={t}>{getVacationTypeConfig(t).emoji} {t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Reason</label>
                                <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} rows={3} placeholder="Brief reason for your leave..."
                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none" />
                            </div>
                        </div>
                        <div className="px-4 h-12 border-t border-border flex items-center justify-end gap-2 shrink-0">
                            <button onClick={() => setModalOpen(false)} className="h-8 px-4 border border-border text-muted-foreground rounded-lg text-[11px] font-bold uppercase cursor-pointer hover:bg-secondary transition-all">Cancel</button>
                            <button onClick={handleSubmit} disabled={saving} className="h-8 px-5 bg-primary text-black rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50 transition-all shadow">
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Submit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail/Review Modal */}
            {detailOpen && (
                <DetailModal entry={detailOpen} onClose={() => { setDetailOpen(null); router.replace('/hr/vacations'); }}
                    onReview={handleReview} isSuperAdmin={isSuperAdmin} loggedInEmail={loggedInEmail} getUserName={getUserName} />
            )}
        </div>
    );
}

function DetailModal({ entry, onClose, onReview, isSuperAdmin, loggedInEmail, getUserName }: {
    entry: VacationEntry; onClose: () => void; onReview: (id: string, action: 'Approved' | 'Rejected', note: string) => void;
    isSuperAdmin: boolean; loggedInEmail: string; getUserName: (e: string) => string;
}) {
    const [reviewNote, setReviewNote] = useState('');
    const canReview = entry.status === 'Pending' && (isSuperAdmin || entry.employee !== loggedInEmail);
    const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 h-12 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <h2 className="text-white font-black text-[13px] uppercase tracking-widest">Vacation Details</h2>
                        <span className="text-white/50 text-[10px]">•</span>
                        <span className="text-white/60 text-[11px] font-semibold">{entry.employeeName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={cn('px-2.5 py-1 rounded border text-[10px] font-bold', STATUS_COLORS[entry.status])}>{entry.status}</span>
                        <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                    </div>
                </div>
                <div className="p-6 space-y-3">
                    <div className="flex justify-between py-2 border-b border-border/50">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Type</span>
                        <span className={cn('px-2 py-0.5 rounded border text-[10px] font-bold', TYPE_BADGE_COLORS[entry.vacationType] || TYPE_BADGE_COLORS['Other'])}>{getVacationTypeConfig(entry.vacationType).emoji} {entry.vacationType}</span>
                    </div>
                    {[
                        ['From', formatDate(entry.dateFrom)],
                        ['To', formatDate(entry.dateTo)],
                        ['Total Days', `${entry.totalDays} day${entry.totalDays > 1 ? 's' : ''}`],
                        ['Reason', entry.reason || 'N/A'],
                        ['Submitted', formatDate(entry.createdAt)],
                    ].map(([l, v]) => (
                        <div key={l as string} className="flex justify-between py-2 border-b border-border/50">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{l}</span>
                            <span className="text-sm font-semibold">{v}</span>
                        </div>
                    ))}
                    {entry.reviewedByName && (
                        <>
                            <div className="flex justify-between py-2 border-b border-border/50">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Reviewed By</span>
                                <span className="text-sm font-semibold">{entry.reviewedByName}</span>
                            </div>
                            {entry.reviewNote && (
                                <div className="flex justify-between py-2 border-b border-border/50">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Note</span>
                                    <span className="text-sm text-muted-foreground max-w-[60%] text-right">{entry.reviewNote}</span>
                                </div>
                            )}
                        </>
                    )}

                    {canReview && (
                        <div className="mt-4 pt-4 border-t border-border space-y-3">
                            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} placeholder="Add a note (optional)..."
                                className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:ring-1 focus:ring-primary/30 focus:outline-none resize-none" />
                            <div className="flex gap-2">
                                <button onClick={() => onReview(entry._id, 'Approved', reviewNote)}
                                    className="flex-1 h-9 bg-emerald-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:bg-emerald-700 transition-colors">
                                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button onClick={() => onReview(entry._id, 'Rejected', reviewNote)}
                                    className="flex-1 h-9 bg-red-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-700 transition-colors">
                                    <XCircle className="w-3.5 h-3.5" /> Reject
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function VacationsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
            <VacationsContent />
        </Suspense>
    );
}
