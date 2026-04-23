'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import {
    ArrowLeft,
    Package,
    Calendar,
    Archive,
    Scale,
    Pencil,
    Save,
    X,
    List,
    DollarSign,
    Trash2,
    Loader2,
    Plus,
    FileText,
    Clock,
    User,
    StickyNote
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { cn, formatDate, toDateInputValue } from '@/lib/utils';
import { confirmDeleteToast } from '@/lib/confirmToast';
import { usePermissions } from '@/hooks/usePermissions';

interface Note {
    _id: string;
    text: string;
    createdBy: string;
    createdAt: string;
}

const TABS = ['Notes'] as const;
type TabType = typeof TABS[number];

export default function OpeningBalanceDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const { id } = params;

    const [item, setItem] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('Notes');
    const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);
    const [globalSettings, setGlobalSettings] = useState<any>(null);

    const { canDelete } = usePermissions();

    // Notes state
    const [notes, setNotes] = useState<Note[]>([]);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [newNoteText, setNewNoteText] = useState('');

    const [formData, setFormData] = useState({
        lotNumber: '',
        qty: 0,
        cost: 0,
        uom: '',
        expirationDate: '',
        createdAt: ''
    });


    // Client-side SKU fallback
    const [allSkus, setAllSkus] = useState<any[]>([]);

    useEffect(() => {
        // Deferred fetch of all SKUs for name resolution fallback
        fetch('/api/skus?limit=0&ignoreDate=true&simple=true')
            .then(res => res.json())
            .then(data => {
                if (data.skus) setAllSkus(data.skus);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        const el = document.getElementById('header-portal-target');
        if (el) setHeaderPortal(el);
    }, []);

    useEffect(() => {
        if (id) {
            fetchDetails();
        }
    }, [id]);

    useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => setGlobalSettings(data))
            .catch(() => { });
    }, []);

    // Shell Viewport Lock
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    const fetchDetails = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/opening-balances/${id}`);
            if (res.ok) {
                const data = await res.json();
                setItem(data);
                setNotes(data.notes || []);
                setFormData({
                    lotNumber: data.lotNumber || '',
                    qty: data.qty || 0,
                    cost: data.cost || 0,
                    uom: data.uom || '',
                    expirationDate: toDateInputValue(data.expirationDate),
                    createdAt: data.createdAt ? new Date(data.createdAt).toISOString().slice(0, 16) : ''
                });
            } else {
                toast.error('Failed to load opening balance details');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error loading details');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const toastId = toast.loading('Saving changes...');
        try {
            const payload = { ...formData };
            if (payload.createdAt) {
                // Assuming the input value is in local time, we let new Date() handle the conversion to UTC
                payload.createdAt = new Date(payload.createdAt).toISOString();
            }

            const res = await fetch(`/api/opening-balances/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                setItem(data);
                setIsEditing(false);
                toast.success('Changes saved', { id: toastId });
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to save changes', { id: toastId });
            }
        } catch (error) {
            toast.error('Error saving changes', { id: toastId });
        }
    };

    const handleDelete = () => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this opening balance?</p>
                <p className="text-xs text-gray-400">This action cannot be undone.</p>
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={() => toast.dismiss(t.id)}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded border border-gray-600 bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            setIsDeleting(true);
                            try {
                                const res = await fetch(`/api/opening-balances/${id}`, {
                                    method: 'DELETE'
                                });
                                if (res.ok) {
                                    toast.success('Opening balance deleted');
                                    router.push('/warehouse/opening-balances');
                                } else {
                                    const data = await res.json();
                                    toast.error(data.error || 'Failed to delete');
                                }
                            } catch (e) {
                                toast.error('Error deleting record');
                            } finally {
                                setIsDeleting(false);
                            }
                        }}
                        className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
    };

    const handleAddNote = async () => {
        if (!newNoteText.trim()) {
            toast.error('Note cannot be empty');
            return;
        }

        const toastId = toast.loading('Adding note...');
        const newNote: Note = {
            _id: Date.now().toString(),
            text: newNoteText.trim(),
            createdBy: session?.user?.email || 'Unknown',
            createdAt: new Date().toISOString()
        };

        const updatedNotes = [...notes, newNote];

        try {
            const res = await fetch(`/api/opening-balances/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: updatedNotes })
            });

            if (res.ok) {
                setNotes(updatedNotes);
                setNewNoteText('');
                setIsNoteModalOpen(false);
                toast.success('Note added', { id: toastId });
            } else {
                toast.error('Failed to add note', { id: toastId });
            }
        } catch (e) {
            toast.error('Error adding note', { id: toastId });
        }
    };

    const handleDeleteNote = (noteId: string) => {
        confirmDeleteToast('Delete this note?', async () => {
            const updatedNotes = notes.filter(n => n._id !== noteId);
            try {
                const res = await fetch(`/api/opening-balances/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: updatedNotes })
                });
                if (res.ok) {
                    setNotes(updatedNotes);
                    toast.success('Note deleted');
                } else {
                    toast.error('Failed to delete note');
                }
            } catch (e) {
                toast.error('Error deleting note');
            }
        });
    };

    const getSkuName = (val: any) => {
        if (typeof val === 'object' && val?.name) return val.name;
        if (typeof val === 'string') {
            const found = allSkus.find(s => s._id === val);
            if (found) return found.name;
        }
        return val || 'N/A';
    };

    const getSkuImage = (val: any) => {
        if (typeof val === 'object' && val?.image) return val.image;
        if (typeof val === 'string') {
            const found = allSkus.find(s => s._id === val);
            if (found?.image) return found.image;
        }
        return '';
    };

    const getSkuId = (val: any) => (typeof val === 'object' && val?._id ? val._id : val || '');

    const formatDateTime = (dateStr?: string) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${formatDate(dateStr)} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
    };

    const getUserName = (emailOrId: string) => {
        if (!emailOrId) return '-';
        if (emailOrId.includes('@')) {
            return emailOrId.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        return emailOrId;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!item) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-background gap-4">
                <h2 className="text-base font-bold text-foreground">Record Not Found</h2>
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const extendedValue = (item.qty || 0) * (item.cost || 0);

    return (
        <div className="flex flex-col h-[calc(100vh-36px)] bg-background relative">
            {/* Header Portal Content */}
            {headerPortal && createPortal(
                <>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Back</span>
                        </button>
                    </div>
                </>,
                headerPortal
            )}

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Details (30%) */}
                <div className="w-[30%] border-r border-border bg-secondary/30 flex flex-col overflow-hidden relative z-10">

                    {/* SKU Identity Header - Fixed */}
                    <div className="h-16 bg-card border-b border-border shrink-0 flex overflow-hidden">
                        {/* Image */}
                        <div className="w-16 h-full bg-secondary shrink-0 relative">
                            <img
                                src={getSkuImage(item.sku) || globalSettings?.missingSkuImage || '/sku-placeholder.png'}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    const fallback = globalSettings?.missingSkuImage || '/sku-placeholder.png';
                                    if (target.src !== fallback && target.src.indexOf('sku-placeholder.png') === -1) {
                                        target.src = fallback;
                                    }
                                }}
                            />
                        </div>

                        {/* Tier Strip */}
                        <div className="w-12 h-full bg-emerald-500 flex items-center justify-center shrink-0">
                            <span className="text-2xl font-black text-white">
                                {(typeof item.sku === 'object' && (item.sku as any)?.tier) ? (item.sku as any).tier : '1'}
                            </span>
                        </div>

                        {/* Name */}
                        <div className="flex-1 flex items-center px-4 bg-accent/5">
                            <h1 className="text-sm md:text-base font-black text-foreground uppercase leading-tight line-clamp-2">
                                {getSkuName(item.sku)}
                            </h1>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-custom">

                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="border border-border rounded-md p-3 bg-background text-center">
                                <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Quantity</div>
                                {isEditing ? (
                                    <input
                                        type="number"
                                        value={formData.qty}
                                        onChange={e => setFormData({ ...formData, qty: parseFloat(e.target.value) || 0 })}
                                        className="w-full text-center text-lg font-black bg-secondary/50 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary text-foreground"
                                        step="any"
                                    />
                                ) : (
                                    <div className="text-xl font-black text-foreground">{item.qty}</div>
                                )}
                            </div>
                            <div className="border border-border rounded-md p-3 bg-background text-center">
                                <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-1">UOM</div>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={formData.uom}
                                        onChange={e => setFormData({ ...formData, uom: e.target.value })}
                                        className="w-full text-center text-sm font-bold uppercase bg-secondary/50 border border-border rounded px-2 py-1 focus:outline-none focus:border-primary text-foreground"
                                    />
                                ) : (
                                    <div className="text-sm font-bold text-foreground uppercase tracking-wider">{item.uom}</div>
                                )}
                            </div>
                        </div>

                        {/* Extended Value Box */}
                        <div className="border border-border rounded-md p-3 bg-background">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Extended Value</span>
                                <span className="text-base font-black text-foreground font-mono">
                                    ${extendedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* Detail Rows */}
                        <div>
                            <div className="space-y-3">
                                {/* Lot Number */}
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Lot Number</div>
                                    {isEditing ? (
                                        <div className="flex gap-1.5 items-center">
                                            <input
                                                type="text"
                                                value={formData.lotNumber}
                                                onChange={e => setFormData({ ...formData, lotNumber: e.target.value })}
                                                className="w-32 px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono focus:outline-none focus:border-primary text-foreground"
                                                placeholder="Lot #"
                                            />
                                            <button
                                                onClick={() => setIsLotModalOpen(true)}
                                                className="p-1.5 bg-secondary border border-border rounded text-muted-foreground hover:text-primary hover:bg-secondary/80 transition-colors"
                                            >
                                                <List className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-xs font-mono font-bold text-foreground">{item.lotNumber || '-'}</div>
                                    )}
                                </div>

                                {/* Unit Cost */}
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Unit Cost</div>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs font-bold text-muted-foreground">$</span>
                                            <input
                                                type="number"
                                                value={formData.cost}
                                                onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                                                className="w-28 px-2 py-1 bg-secondary/50 border border-border rounded text-xs font-mono focus:outline-none focus:border-primary text-foreground"
                                                step="any"
                                            />
                                        </div>
                                    ) : (
                                        <div className="text-xs font-mono font-medium text-foreground">
                                            ${item.cost?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                        </div>
                                    )}
                                </div>

                                {/* Expiration Date */}
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Expiration</div>
                                    {isEditing ? (
                                        <input
                                            type="date"
                                            value={formData.expirationDate}
                                            onChange={e => setFormData({ ...formData, expirationDate: e.target.value })}
                                            className="px-2 py-1 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary text-foreground"
                                        />
                                    ) : (
                                        <div className="text-xs font-medium text-foreground">{formatDate(item.expirationDate)}</div>
                                    )}
                                </div>

                                {/* Created */}
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Created</div>
                                    {isEditing ? (
                                        <input
                                            type="datetime-local"
                                            value={formData.createdAt}
                                            onChange={e => setFormData({ ...formData, createdAt: e.target.value })}
                                            className="px-2 py-1 bg-secondary/50 border border-border rounded text-xs focus:outline-none focus:border-primary text-foreground"
                                        />
                                    ) : (
                                        <div className="text-xs font-medium text-foreground">{formatDateTime(item.createdAt)}</div>
                                    )}
                                </div>

                                {/* Record ID */}
                                <div className="flex justify-between items-start">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Record ID</div>
                                    <div className="text-[9px] text-muted-foreground font-mono truncate max-w-[140px]">{item._id}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button
                                    onClick={() => {
                                        setIsEditing(false);
                                        // Reset form data
                                        setFormData({
                                            lotNumber: item.lotNumber || '',
                                            qty: item.qty || 0,
                                            cost: item.cost || 0,
                                            uom: item.uom || '',
                                            expirationDate: toDateInputValue(item.expirationDate),
                                            createdAt: item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 16) : ''
                                        });
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Cancel</span>
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    <span>Save</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors cursor-pointer"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                </button>
                                {canDelete() && (
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Right Content: Tabs (70%) */}
                <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                    {/* Tabs & Actions */}
                    <div className="px-4 border-b border-border shrink-0 flex items-center justify-between bg-background z-10 h-9">
                        <div className="flex space-x-1 h-full">
                            {TABS.map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={cn(
                                        "px-4 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5",
                                        activeTab === tab
                                            ? "text-foreground border-foreground"
                                            : "text-muted-foreground border-transparent hover:text-foreground"
                                    )}
                                >
                                    <span>{tab}</span>
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded-none text-[9px] font-bold",
                                        activeTab === tab ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                                    )}>
                                        {tab === 'Notes' ? notes.length : 0}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center space-x-2">
                            {activeTab === 'Notes' && (
                                <button
                                    onClick={() => {
                                        setNewNoteText('');
                                        setIsNoteModalOpen(true);
                                    }}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center space-x-1 shadow-sm"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Note</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {activeTab === 'Notes' && (
                            <div className="animate-in fade-in duration-300 p-4">
                                {notes.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                        <StickyNote className="w-10 h-10 mb-3 opacity-30" />
                                        <p className="text-sm font-bold uppercase tracking-wider opacity-50">No Notes Yet</p>
                                        <p className="text-xs text-muted-foreground mt-1">Add a note to keep track of important details.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {notes.map((note) => (
                                            <div
                                                key={note._id}
                                                className="group border border-border rounded-md bg-secondary/20 hover:bg-secondary/40 transition-colors"
                                            >
                                                <div className="p-3">
                                                    <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">{note.text}</p>
                                                </div>
                                                <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="flex items-center space-x-1.5">
                                                            <User className="w-3 h-3 text-muted-foreground" />
                                                            <span className="text-[10px] font-bold text-muted-foreground">{getUserName(note.createdBy)}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1.5">
                                                            <Clock className="w-3 h-3 text-muted-foreground" />
                                                            <span className="text-[10px] text-muted-foreground">{formatDateTime(note.createdAt)}</span>
                                                        </div>
                                                    </div>
                                                    {canDelete() && (
                                                        <button
                                                            onClick={() => handleDeleteNote(note._id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-all cursor-pointer"
                                                            title="Delete note"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Add Note Modal */}
            {isNoteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-background border border-border w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                                Add Note
                            </h2>
                            <button onClick={() => setIsNoteModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-muted-foreground">Note</label>
                                <textarea
                                    value={newNoteText}
                                    onChange={e => setNewNoteText(e.target.value)}
                                    className="w-full px-3 py-2 bg-secondary/50 border border-border rounded-md text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 transition-colors min-h-[120px] resize-y"
                                    placeholder="Enter your note here..."
                                    autoFocus
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsNoteModalOpen(false)}
                                    className="flex-1 py-3 text-muted-foreground text-xs font-bold uppercase tracking-wider hover:text-foreground hover:bg-secondary transition-colors rounded"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddNote}
                                    className="flex-1 py-3 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors rounded"
                                >
                                    Save Note
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Lot Selection Modal */}
            {isEditing && item.sku && (
                <LotSelectionModal
                    isOpen={isLotModalOpen}
                    onClose={() => setIsLotModalOpen(false)}
                    onSelect={(lotNumber: string, cost?: number) => {
                        setFormData(prev => ({ ...prev, lotNumber, cost: cost ?? prev.cost }));
                        setIsLotModalOpen(false);
                    }}
                    skuId={typeof item.sku === 'object' ? item.sku._id : item.sku}
                    currentLotNumber={formData.lotNumber}
                    title="Select Reference Lot"
                />
            )}
        </div>
    );
}
