'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Package, Calendar, User, Clock, Tag, Clipboard, Layers, Pencil, Trash2, X, Plus, Copy, Play, Square, MoreVertical } from 'lucide-react';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { confirmDeleteToast } from '@/lib/confirmToast';
import { useTimers } from '@/components/TimerContext';

interface LineItem {
    _id: string;
    lotNumber: string;
    label?: string;
    recipeId: string;
    sku: { _id: string; name: string; category?: string } | string; // Can be populated or string
    uom: string;
    recipeQty: number;
    sa: number;
    qtyExtra: number;
    qtyScrapped: number;
    createdAt: string;
    cost?: number;
}

interface LaborEntry {
    _id: string;
    type: string;
    user: { _id: string; firstName: string; lastName: string } | string;
    duration: string;
    hourlyRate: number;
    createdAt: string;
}

interface ManufacturingOrder {
    _id: string;
    label?: string;
    sku: { _id: string; name: string; image?: string } | string;
    recipesId: { _id: string; name: string; steps?: any[]; notes?: string } | string;
    uom: string;
    qty: number;
    qtyDifference: number;
    scheduledStart: string;
    scheduledFinish: string;
    priority: string;
    status: string;
    createdBy?: { _id: string; firstName: string; lastName: string };
    finishedBy?: { _id: string; firstName: string; lastName: string };
    createdAt: string;
    lineItems?: LineItem[];
    labor?: LaborEntry[];
    notes?: { _id: string; note: string; createdBy?: { _id: string; firstName: string; lastName: string } | string; createdAt: string }[];
    qualityCheck?: {
        _id: string;
        checkedBy?: { _id: string; firstName: string; lastName: string } | string;
        packagedBy?: { _id: string; firstName: string; lastName: string } | string;
        label?: boolean;
        lot?: boolean;
        seal?: boolean;
        packageQuality?: boolean;
        repackaged?: boolean;
        weight?: number;
        target?: number;
        actualWeight?: number;
        qualityCheckedBy?: { _id: string; firstName: string; lastName: string } | string;
        createdAt?: string;
    }[];
}

const TABS = ['Items', 'Labor', 'WO Notes', 'Recipe Steps', 'Recipe Notes', 'SKU Notes', 'QC'] as const;
type TabType = typeof TABS[number];

export default function ManufacturingDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { data: session } = useSession();
    const [order, setOrder] = useState<ManufacturingOrder | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('Items');
    
    // Lot Editing State
    const [editingLotItemId, setEditingLotItemId] = useState<string | null>(null);
    const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    
    // Edit Item Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<LineItem | null>(null);

    // Note Modal State
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<{ _id?: string; note: string } | null>(null);

    // Labor Modal State
    const [isLaborModalOpen, setIsLaborModalOpen] = useState(false);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
    const [editingLabor, setEditingLabor] = useState<{ _id?: string; type: string; user: string; duration: string; hourlyRate: number } | null>(null);

    // Users list for Labor dropdown
    const [usersList, setUsersList] = useState<{ _id: string; firstName: string; lastName: string; hourlyRate?: number; email?: string }[]>([]);
    const [allUsersList, setAllUsersList] = useState<{ _id: string; firstName: string; lastName: string; email?: string }[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

    // Active Labor Timer (Global Context)
    const { timers: globalTimers, currentTime, startTimer: globalStartTimer, stopTimer: globalStopTimer, isTimerRunning, getTimer, formatDuration: globalFormatDuration } = useTimers();

    // SKU List for adding line items
    const [skuList, setSkuList] = useState<{ _id: string; name: string; category?: string; image?: string }[]>([]);

    // Line Item Actions Menu State
    const [openActionMenu, setOpenActionMenu] = useState<{ id: string; x: number; y: number } | null>(null);


    // Shell Viewport Lock: Prevents window-level scrolling
    useEffect(() => {
        const originalBodyStyle = document.body.style.overflow;
        const originalHtmlStyle = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalBodyStyle;
            document.documentElement.style.overflow = originalHtmlStyle;
        };
    }, []);

    // Close action menu on outside click or scroll
    useEffect(() => {
        if (!openActionMenu) return;
        const close = () => setOpenActionMenu(null);
        document.addEventListener('click', close);
        document.addEventListener('scroll', close, true);
        return () => {
            document.removeEventListener('click', close);
            document.removeEventListener('scroll', close, true);
        };
    }, [openActionMenu]);

    // Qty Difference update state
    const [isSubmittingDiff, setIsSubmittingDiff] = useState(false);

    // Global Settings for fallbacks
    const [globalSettings, setGlobalSettings] = useState<any>(null);

    // For lot selection in add modal
    const [isAddLotModalOpen, setIsAddLotModalOpen] = useState(false);

    // Debounce Ref for Qty Difference
    const qtyTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/manufacturing/${params.id}`);
            if (res.ok) {
                const data = await res.json();
                setOrder(data);
            } else {
                toast.error('Failed to fetch order');
            }
        } catch (e) {
            toast.error('Error loading order');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (params.id) {
            fetchOrder();
        }
    }, [params.id]);

    // Shell Viewport Lock: Prevents window-level scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    // Deferred fetches - only load after main order is displayed for faster initial render
    useEffect(() => {
        if (loading) return; // Wait until order is loaded
        
        // Fetch SKU list for Add Line Item dropdown (deferred)
        fetch('/api/skus?limit=0&ignoreDate=true')
            .then(res => res.json())
            .then(data => {
                if (data.skus) {
                    setSkuList(data.skus.map((s: any) => ({ _id: s._id, name: s.name, category: s.category, image: s.image })));
                }
            })
            .catch(() => {});
        
        // Fetch users list for Labor dropdown (deferred)
        fetch('/api/users?limit=1000')
            .then(res => res.json())
            .then(data => {
                if (data.users && Array.isArray(data.users)) {
                    // Store all users for name lookup
                    const allUsers = data.users.map((u: any) => ({
                        _id: u._id,
                        firstName: u.firstName || '',
                        lastName: u.lastName || '',
                        email: u.email
                    }));
                    setAllUsersList(allUsers);

                    // Filter for labor dropdown (must have hourly rate)
                    const validUsers = data.users
                        .filter((u: any) => u.hourlyRate != null)
                        .map((u: any) => ({ 
                            _id: u._id, 
                            firstName: u.firstName || '', 
                            lastName: u.lastName || '',
                            hourlyRate: u.hourlyRate,
                            email: u.email
                        }));
                    setUsersList(validUsers);
                }
            })
            .catch(() => {});
        
        // Fetch Global Settings (deferred)
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => setGlobalSettings(data))
            .catch(() => {});
    }, [loading]);

    // Timer logic handled by global TimerContext (persists across route changes)

    const formatDuration = (seconds: number) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const generateId = () => {
        return Math.floor(Date.now() / 1000).toString(16) + 'xxxxxxxxxxxxxxxx'.replace(/[x]/g, () => (Math.random() * 16 | 0).toString(16)).toLowerCase();
    };

    const costs = React.useMemo(() => {
        let material = 0;
        let packaging = 0;
        let labor = 0;

        if (order) {
            order.lineItems?.forEach(item => {
                const bomQty = (item.recipeQty || 0) * (order.qty || 0);
                const saPercent = item.sa || 0; // SA is stored as percentage (e.g., 55.6 for 55.6%)
                const sa = saPercent / 100; // Convert to decimal (e.g., 0.556)
                // qtyExtra only calculated if sa > 0
                const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                const qtyScrapped = item.qtyScrapped || 0;
                // Simple formula: totalQty = bomQty + qtyScrapped + qtyExtra
                const totalQty = bomQty + qtyScrapped + qtyExtra;
                const cost = totalQty * (item.cost || 0);

                const cat = (typeof item.sku === 'object' && item.sku !== null && item.sku.category) ? item.sku.category.toLowerCase() : '';
                if (cat.includes('packaging')) {
                    packaging += cost;
                } else {
                    material += cost;
                }
            });

            order.labor?.forEach(entry => {
                const durationParts = (entry.duration || '0:0:0').split(':');
                const hours = parseInt(durationParts[0] || '0') + 
                             parseInt(durationParts[1] || '0') / 60 + 
                             parseInt(durationParts[2] || '0') / 3600;
                labor += hours * (entry.hourlyRate || 0);
            });
        }

        const total = material + packaging + labor;
        const qtyManufactured = (order && ((order.qty || 0) + (order.qtyDifference || 0))) || 0;
        const perUnit = (qtyManufactured > 0) ? total / qtyManufactured : 0;

        return { material, packaging, labor, total, perUnit, qtyManufactured };
    }, [order]);

    const sidebarSkuTier = React.useMemo(() => {
        if (order?.sku && typeof order.sku === 'object' && (order.sku as any).tier) {
            return (order.sku as any).tier;
        }
        const skuId = typeof order?.sku === 'object' ? order?.sku?._id : order?.sku;
        const found = skuList.find(s => s._id === skuId);
        return found ? (found as any).tier : null;
    }, [order?.sku, skuList]);

    const skuName = React.useMemo(() => {
        if (!order?.sku) return '-';
        if (typeof order.sku === 'object') return (order.sku as any).name || (order.sku as any)._id || '-';
        
        // Lookup in skuList
        const found = skuList.find(s => s._id === order.sku);
        if (found) return found.name;
        
        return order.sku;
    }, [order?.sku, skuList]);

    const formatUser = (u: any) => {
        if (!u) return '-';
        
        // If it's the populated object
        if (typeof u === 'object') {
            const first = u.firstName || '';
            const last = u.lastName || '';
            if (first || last) return `${first} ${last}`.trim();
            return u.email || '-';
        }
        
        // If it's a string (email/ID), look it up in the list
        if (typeof u === 'string') {
            const found = allUsersList.find(user => user._id === u || user.email === u);
            if (found) return `${found.firstName} ${found.lastName}`.trim();
            return u; // Fallback to email
        }
        
        return '-';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <LoadingSpinner size="lg" message="Loading Manufacturing Order" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
                <div className="text-sm text-muted-foreground">Order not found</div>
            </div>
        );
    }


    // Info rows for the detail table

    const infoRows = [
        [
            { label: 'Scheduled Start', value: order.scheduledStart ? new Date(order.scheduledStart).toLocaleDateString() : '-' },
            { label: 'Scheduled Finish', value: order.scheduledFinish ? new Date(order.scheduledFinish).toLocaleDateString() : '-' },
        ],
        [
            { label: 'Created By', value: formatUser(order.createdBy) },
            { label: 'Finished By', value: formatUser(order.finishedBy) },
        ],
        [
            { label: 'Created At', value: new Date(order.createdAt).toLocaleDateString() },
            { 
                label: 'Recipe', 
                value: (typeof order.recipesId === 'object' && order.recipesId) ? order.recipesId.name : (order.recipesId || '-') 
            },
        ],
    ];

    const skuImage = (typeof order.sku === 'object' && order.sku !== null && order.sku.image) ? order.sku.image : skuList.find(s => s._id === (typeof order.sku === 'string' ? order.sku : (order.sku as any)?._id))?.image;

    const STATUSES = ['Pending', 'Processing', 'Ready to QC', 'Fulfilled'];
    const PRIORITIES = ['Normal', 'High', 'Extreme'];

    const handleStatusChange = async (newStatus: string) => {
        try {
            const res = await fetch(`/api/manufacturing/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const updated = await res.json();
                setOrder(updated);
                toast.success(`Status → ${newStatus}`);
            }
        } catch (e) { toast.error('Failed to update status'); }
    };

    const handlePriorityChange = async (newPriority: string) => {
        try {
            const res = await fetch(`/api/manufacturing/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priority: newPriority })
            });
            if (res.ok) {
                const updated = await res.json();
                setOrder(updated);
                toast.success(`Priority → ${newPriority}`);
            }
        } catch (e) { toast.error('Failed to update priority'); }
    };

    const handleDeleteOrder = () => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this manufacturing order?</p>
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
                            try {
                                const res = await fetch(`/api/manufacturing/${order._id}`, { method: 'DELETE' });
                                if (res.ok) {
                                    toast.success('Order deleted');
                                    router.push('/warehouse/manufacturing');
                                } else {
                                    toast.error('Failed to delete');
                                }
                            } catch (e) {
                                toast.error('Error deleting order');
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

    const handleUpdateQtyDiff = (diffValue: number) => {
        if (!order) return;
        
        // 1. Update UI Instantly
        setOrder({ ...order, qtyDifference: diffValue });

        // 2. Debounce API Sync
        if (qtyTimerRef.current) clearTimeout(qtyTimerRef.current);
        
        qtyTimerRef.current = setTimeout(async () => {
            setIsSubmittingDiff(true);
            try {
                const res = await fetch(`/api/manufacturing/${order._id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ qtyDifference: diffValue })
                });
                if (res.ok) {
                    // synced
                } else {
                    toast.error('Failed to sync quantity to database');
                }
            } catch (e) {
                console.error("Sync error", e);
            } finally {
                setIsSubmittingDiff(false);
            }
        }, 1500);
    };

    const handleEditLot = (itemId: string, skuId: string) => {
        setEditingLotItemId(itemId);
        setEditingSkuId(skuId);
        setIsLotModalOpen(true);
    };

    const handleLotSelect = async (lotNumber: string, cost?: number) => {
        if (!order || !editingLotItemId) return;
        
        try {
            const updatedLineItems = (order.lineItems?.map(item => 
                item._id === editingLotItemId ? { ...item, lotNumber, cost: cost || 0 } : item
            ) || []).map(sanitizeLineItem);

            const res = await fetch(`/api/manufacturing/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineItems: updatedLineItems })
            });

            if (res.ok) {
                const updatedOrder = await res.json();
                setOrder(updatedOrder);
                toast.success('Lot number updated');
                setIsLotModalOpen(false);
                setEditingLotItemId(null);
                setEditingSkuId(null);
            } else {
                toast.error('Failed to update lot number');
            }
        } catch (e) {
            toast.error('Error updating lot number');
        }
    };
    
    const getRequiredQtyForItem = (item: LineItem | null): number => {
        if (!item || !order) return 0;
        const bomQty = (item.recipeQty || 0) * (order.qty || 0);
        const saPercent = item.sa || 0;
        const sa = saPercent / 100;
        const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
        const qtyScrapped = item.qtyScrapped || 0;
        return bomQty + qtyExtra + qtyScrapped;
    };
    
    const currentEditingItem = order?.lineItems?.find(i => i._id === editingLotItemId);
    const currentEditingItemRequiredQty = getRequiredQtyForItem(currentEditingItem || null);

    const handleOpenEditModal = (item: LineItem) => {
        setEditingItem({ ...item });
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingItem(null);
    };

    // Sanitize a line item for API: extract SKU ID string from populated objects, strip empty _id
    const sanitizeLineItem = (item: any) => {
        const skuId = typeof item.sku === 'object' && item.sku !== null ? item.sku._id : item.sku;
        const cleaned: any = { ...item, sku: skuId };
        if (!cleaned._id) delete cleaned._id;
        return cleaned;
    };

    const handleSaveItem = async () => {
        if (!order || !editingItem) return;
        
        try {
            let updatedLineItems;
            if (editingItem._id) {
                updatedLineItems = order.lineItems?.map(item => 
                    item._id === editingItem._id ? sanitizeLineItem(editingItem) : sanitizeLineItem(item)
                ) || [];
            } else {
                const newItem = sanitizeLineItem({
                    ...editingItem,
                    createdAt: new Date().toISOString()
                });
                updatedLineItems = [...(order.lineItems || []).map(sanitizeLineItem), newItem];
            }

            const res = await fetch(`/api/manufacturing/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineItems: updatedLineItems })
            });

            if (res.ok) {
                const updatedOrder = await res.json();
                setOrder(updatedOrder);
                toast.success(editingItem._id ? 'Item updated successfully' : 'Item added successfully');
                handleCloseEditModal();
            } else {
                toast.error(editingItem._id ? 'Failed to update item' : 'Failed to add item');
            }
        } catch (e) {
            toast.error('Error saving item');
        }
    };

    const handleCopyItem = async (sourceItem: LineItem) => {
        if (!order) return;
        try {
            const copiedItem = sanitizeLineItem({
                ...sourceItem,
                _id: undefined,
                createdAt: new Date().toISOString()
            });
            const updatedLineItems = [...(order.lineItems || []).map(sanitizeLineItem), copiedItem];
            const res = await fetch(`/api/manufacturing/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lineItems: updatedLineItems })
            });
            if (res.ok) {
                const updatedOrder = await res.json();
                setOrder(updatedOrder);
                toast.success('Item duplicated successfully');
            } else {
                toast.error('Failed to duplicate item');
            }
        } catch (e) {
            toast.error('Error duplicating item');
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        toast((t) => (
            <div className="flex flex-col gap-2">
                <p className="text-sm font-bold text-white">Delete this line item?</p>
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
                            if (!order) return;
                            try {
                                const updatedLineItems = (order.lineItems?.filter(item => item._id !== itemId) || []).map(sanitizeLineItem);
                                const res = await fetch(`/api/manufacturing/${order._id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ lineItems: updatedLineItems })
                                });
                                if (res.ok) {
                                    const updatedOrder = await res.json();
                                    setOrder(updatedOrder);
                                    toast.success('Item deleted successfully');
                                } else {
                                    toast.error('Failed to delete item');
                                }
                            } catch (e) {
                                toast.error('Error deleting item');
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

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background overflow-hidden relative">

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Details (30%) */}
                <div className="w-[30%] border-r border-border bg-background overflow-y-auto scrollbar-custom flex flex-col">
                    {/* Back + Actions Bar */}
                    <div className="flex items-center justify-between px-4 h-9 border-b border-border shrink-0">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/warehouse/manufacturing')}
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 px-2.5 py-1 border border-border transition-colors"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Back</span>
                            </button>
                            {order.label && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">WO #</span>
                                    <span className="text-xs font-mono font-black text-foreground">{order.label}</span>
                                </div>
                            )}
                        </div>
                        <Link 
                            href={`/warehouse/skus/${typeof order.sku === 'object' && order.sku !== null ? (order.sku as any)._id : order.sku}?lot=${encodeURIComponent(order.label || order._id)}`}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 px-2.5 py-1 border border-border transition-colors"
                        >
                            <Layers className="w-3 h-3" />
                            <span>Ledger</span>
                        </Link>
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-custom">
                    {/* SKU Hero Section - 3 Column: Image | Tier | Name */}
                    <div className="px-4 pt-4 pb-4">
                        <div className="flex items-stretch border border-border overflow-hidden">
                            {/* Column 1: Image */}
                            <div className="w-16 h-16 bg-secondary flex items-center justify-center shrink-0 border-r border-border overflow-hidden">
                                {skuImage ? (
                                    <img 
                                        src={skuImage} 
                                        alt={skuName} 
                                        className="w-full h-full object-cover" 
                                        onError={(e) => {
                                            if (globalSettings?.missingSkuImage) {
                                                (e.target as HTMLImageElement).src = globalSettings.missingSkuImage;
                                            }
                                        }}
                                    />
                                ) : globalSettings?.missingSkuImage ? (
                                    <img src={globalSettings.missingSkuImage} alt="Fallback" className="w-full h-full object-cover" />
                                ) : (
                                    <Package className="w-6 h-6 text-muted-foreground" />
                                )}
                            </div>
                            {/* Column 2: Tier */}
                            {!!sidebarSkuTier && (
                                <div className={cn(
                                    "w-10 flex items-center justify-center shrink-0 border-r border-border",
                                    sidebarSkuTier === 1 ? "bg-emerald-500" :
                                    sidebarSkuTier === 2 ? "bg-blue-500" :
                                    "bg-orange-500"
                                )}>
                                    <span className="text-sm font-black text-white">{sidebarSkuTier}</span>
                                </div>
                            )}
                            {/* Column 3: Name (clickable) */}
                            <button
                                onClick={() => {
                                    const skuId = typeof order.sku === 'object' && order.sku !== null ? (order.sku as any)._id : order.sku;
                                    if (skuId) router.push(`/warehouse/skus/${skuId}`);
                                }}
                                className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex items-center justify-center px-3 min-w-0 cursor-pointer"
                            >
                                <h1 className="text-sm font-black text-foreground leading-tight text-center line-clamp-2">{skuName}</h1>
                            </button>
                        </div>
                    </div>

                    {/* Status & Priority Buttons */}
                    <div className="mx-4 mb-3 flex items-center gap-2">
                        <div className="relative flex-1">
                            <button 
                                onClick={() => { setStatusDropdownOpen(!statusDropdownOpen); setPriorityDropdownOpen(false); }}
                                className={cn(
                                    "w-full px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer transition-all",
                                    order.status === 'Fulfilled' ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25" :
                                    order.status === 'Processing' ? "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25" :
                                    order.status === 'Ready to QC' ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25" :
                                    "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                )}
                            >
                                {order.status}
                            </button>
                            {statusDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-0.5 bg-[#1a1a1a] border border-border shadow-xl z-30">
                                    {STATUSES.map(s => (
                                        <button
                                            key={s}
                                            onClick={() => { handleStatusChange(s); setStatusDropdownOpen(false); }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                                                s === 'Fulfilled' ? "text-emerald-400 hover:bg-emerald-500/15" :
                                                s === 'Processing' ? "text-blue-400 hover:bg-blue-500/15" :
                                                s === 'Ready to QC' ? "text-amber-400 hover:bg-amber-500/15" :
                                                "text-muted-foreground hover:bg-secondary",
                                                order.status === s && "bg-secondary/80"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="relative flex-1">
                            <button 
                                onClick={() => { setPriorityDropdownOpen(!priorityDropdownOpen); setStatusDropdownOpen(false); }}
                                className={cn(
                                    "w-full px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-center cursor-pointer transition-all",
                                    order.priority === 'Extreme' ? "bg-red-500/15 text-red-400 hover:bg-red-500/25" :
                                    order.priority === 'High' ? "bg-orange-500/15 text-orange-400 hover:bg-orange-500/25" :
                                    "bg-secondary text-muted-foreground hover:bg-secondary/80"
                                )}
                            >
                                {order.priority}
                            </button>
                            {priorityDropdownOpen && (
                                <div className="absolute top-full left-0 right-0 mt-0.5 bg-[#1a1a1a] border border-border shadow-xl z-30">
                                    {PRIORITIES.map(p => (
                                        <button
                                            key={p}
                                            onClick={() => { handlePriorityChange(p); setPriorityDropdownOpen(false); }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
                                                p === 'Extreme' ? "text-red-400 hover:bg-red-500/15" :
                                                p === 'High' ? "text-orange-400 hover:bg-orange-500/15" :
                                                "text-muted-foreground hover:bg-secondary",
                                                order.priority === p && "bg-secondary/80"
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Quantity Section */}
                    <div className="mx-4 mb-4">
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <div className="bg-secondary border border-border p-3">
                                <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Ordered</div>
                                <div className="text-xl font-black text-foreground leading-none">{order.qty}</div>
                                <div className="text-[9px] text-muted-foreground font-bold uppercase mt-0.5">{order.uom}</div>
                            </div>
                            <div className="bg-secondary border border-border p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-[8px] text-muted-foreground uppercase tracking-widest font-bold">Adjust</div>
                                    {isSubmittingDiff && (
                                        <div className="text-[7px] text-blue-500 font-bold uppercase animate-pulse">Saving</div>
                                    )}
                                </div>
                                <div className="flex items-center bg-background border border-border h-7 focus-within:border-foreground transition-colors">
                                    <button 
                                        disabled={isSubmittingDiff}
                                        onClick={() => handleUpdateQtyDiff((order.qtyDifference || 0) - 1)}
                                        className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all border-r border-border"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    </button>
                                    <input 
                                        type="number"
                                        value={order.qtyDifference || 0}
                                        onChange={(e) => handleUpdateQtyDiff(parseInt(e.target.value) || 0)}
                                        className="flex-1 text-center text-xs font-bold bg-transparent text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                    />
                                    <button 
                                        disabled={isSubmittingDiff}
                                        onClick={() => handleUpdateQtyDiff((order.qtyDifference || 0) + 1)}
                                        className="w-7 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-all border-l border-border"
                                    >
                                        <Plus className="w-2.5 h-2.5" strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 flex justify-between items-center">
                            <div className="text-[9px] uppercase tracking-widest font-bold text-emerald-400">Qty Manufactured</div>
                            <div className="text-lg font-black text-emerald-400">{costs.qtyManufactured} <span className="text-[9px] text-emerald-400/60 font-bold uppercase">{order.uom}</span></div>
                        </div>
                    </div>

                    {/* Metadata Grid */}
                    <div className="mx-4 mb-4 border border-border">
                        {(() => {
                            const lastQc = order.qualityCheck?.length ? order.qualityCheck[order.qualityCheck.length - 1] : null;
                            return [
                                { label: 'Scheduled Start', value: order.scheduledStart ? new Date(order.scheduledStart).toLocaleDateString() : '-' },
                                { label: 'Scheduled Finish', value: order.scheduledFinish ? new Date(order.scheduledFinish).toLocaleDateString() : '-' },
                                { label: 'Created By', value: formatUser(order.createdBy) },
                                { label: 'Finished By', value: formatUser(order.finishedBy) },
                                { label: 'Checked By', value: lastQc ? formatUser(lastQc.checkedBy) : '-' },
                                { label: 'Packaged By', value: lastQc ? formatUser(lastQc.packagedBy) : '-' },
                                { label: 'Created At', value: new Date(order.createdAt).toLocaleDateString() },
                                { label: 'Recipe', value: (typeof order.recipesId === 'object' && order.recipesId) ? order.recipesId.name : (order.recipesId || '-'), recipeId: (typeof order.recipesId === 'object' && order.recipesId) ? order.recipesId._id : (order.recipesId || null) },
                            ] as { label: string; value: string; recipeId?: string | null }[];
                        })().map((item, idx) => (
                            <div key={idx} className={cn(
                                "flex items-center justify-between px-3 py-2",
                                idx % 2 === 0 ? "bg-background" : "bg-secondary/50"
                            )}>
                                <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">{item.label}</span>
                                {item.recipeId ? (
                                    <span 
                                        className="text-[11px] font-medium text-muted-foreground text-right max-w-[55%] truncate hover:text-blue-500 hover:underline cursor-pointer transition-colors"
                                        onClick={() => router.push(`/warehouse/recipes/${item.recipeId}`)}
                                    >
                                        {item.value}
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-medium text-muted-foreground text-right max-w-[55%] truncate">{item.value}</span>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Cost Analysis */}
                    <div className="mx-4 mb-4">
                        <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-3">Cost Breakdown</div>
                        <div className="space-y-2">
                            {[
                                { label: 'Material', value: costs.material, color: 'bg-blue-500' },
                                { label: 'Packaging', value: costs.packaging, color: 'bg-violet-500' },
                                { label: 'Labor', value: costs.labor, color: 'bg-amber-500' },
                            ].map((item, idx) => (
                                <div key={idx} className="group">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors font-medium">{item.label}</span>
                                        <span className="text-[11px] font-mono font-semibold text-muted-foreground">${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                                        <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${costs.total > 0 ? (item.value / costs.total * 100) : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-muted-foreground font-medium italic">Per Unit</span>
                                <span className="text-[11px] font-mono font-medium text-muted-foreground italic">${costs.perUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</span>
                            </div>
                            <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Total Cost</span>
                                <span className="text-base font-mono font-black text-emerald-400">${costs.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                        </div>
                    </div>
                    </div>

                    {/* Action Buttons at bottom */}
                    <div className="border-t border-border px-4 py-4 shrink-0 flex items-center gap-2">
                        <button
                            onClick={() => router.push(`/warehouse/manufacturing/${order._id}/edit`)}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
                        >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                        </button>
                        <button
                            onClick={handleDeleteOrder}
                            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                        </button>
                    </div>
                </div>

                {/* Right Content: Tabs (70%) */}
                <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                    {/* Tabs & Actions */}
                    <div className="px-4 border-b border-border shrink-0 flex items-center justify-between bg-background z-10 h-9">
                        <div className="flex space-x-1">
                            {(() => {
                                const tabCounts: Record<string, number> = {
                                    'Items': order.lineItems?.length || 0,
                                    'Labor': order.labor?.length || 0,
                                    'WO Notes': order.notes?.length || 0,
                                    'Recipe Steps': (typeof order.recipesId === 'object' && (order.recipesId as any)?.steps?.length) || 0,
                                    'Recipe Notes': (typeof order.recipesId === 'object' && (order.recipesId as any)?.notes) ? 1 : 0,
                                    'SKU Notes': 0,
                                    'QC': order.qualityCheck?.length || 0,
                                };
                                return TABS.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5",
                                            activeTab === tab
                                                ? "text-foreground border-foreground"
                                                : "text-muted-foreground border-transparent hover:text-foreground/70"
                                        )}
                                    >
                                        <span>{tab}</span>
                                        {tabCounts[tab] > 0 && (
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded-none text-[9px] font-bold",
                                                activeTab === tab ? "bg-foreground text-background" : "bg-secondary text-muted-foreground"
                                            )}>
                                                {tabCounts[tab]}
                                            </span>
                                        )}
                                    </button>
                                ));
                            })()}
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center space-x-2">
                            {activeTab === 'Items' && (
                                <button
                                    onClick={() => {
                                        setEditingItem({
                                            _id: '', lotNumber: '', recipeId: '', sku: '', uom: 'g',
                                            recipeQty: 0, sa: 0, qtyExtra: 0, qtyScrapped: 0,
                                            createdAt: new Date().toISOString()
                                        });
                                        setIsEditModalOpen(true);
                                    }}
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center space-x-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Item</span>
                                </button>
                            )}
                            {activeTab === 'Labor' && (
                                <button
                                    onClick={() => {
                                        setEditingLabor({ _id: '', type: 'WO Labor', user: '', duration: '0:00:00', hourlyRate: 0 });
                                        setUserSearch('');
                                        setIsLaborModalOpen(true);
                                    }}
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center space-x-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Labor</span>
                                </button>
                            )}
                            {activeTab === 'WO Notes' && (
                                <button
                                    onClick={() => {
                                        setEditingNote({ note: '' });
                                        setIsNoteModalOpen(true);
                                    }}
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center space-x-1"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Note</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto scrollbar-custom">
                        {activeTab === 'Items' && (
                    <div className="animate-in fade-in duration-300">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                <tr>
                                    {[
                                        { label: 'Date', width: 'w-[80px]' },
                                        { label: 'SKU', width: 'w-[200px]' },
                                        { label: 'Cat', key: 'categoryDesc', width: 'w-[40px]', hideLabel: true, align: 'text-center' }, 
                                        { label: 'Lot #', width: 'w-[100px]' },
                                        { label: 'UOM', width: 'w-[50px]', align: 'text-center' },
                                        { label: 'Recipe Qty', width: 'w-[70px]', align: 'text-right' },
                                        { label: 'BOM Qty', width: 'w-[70px]', align: 'text-right' },
                                        { label: 'Assay', width: 'w-[50px]', align: 'text-center' },
                                        { label: 'Consm', width: 'w-[80px]', align: 'text-right' },
                                        { label: 'Extra', width: 'w-[60px]', align: 'text-right' },
                                        { label: 'Scrapped', width: 'w-[70px]', align: 'text-right' },
                                        { label: 'Total', width: 'w-[80px]', align: 'text-right' },
                                        { label: 'Total Cost', width: 'w-[90px]', align: 'text-right' },
                                        { label: 'Act', key: 'actionsDesc', width: 'w-[40px]', hideLabel: true, align: 'text-center' } 
                                    ].map(col => (
                                        <th 
                                            key={col.key || col.label} 
                                            className={cn(
                                                "px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap",
                                                col.width,
                                                col.align || "text-left" 
                                            )}
                                        >
                                            {col.hideLabel ? '' : col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(!order.lineItems || order.lineItems.length === 0) ? (
                                    <tr>
                                        <td colSpan={13} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No line items</td>
                                    </tr>
                                ) : order.lineItems.map(item => {
                                    const bomQty = (item.recipeQty || 0) * (order.qty || 0);
                                    const saPercent = item.sa || 0; // SA is stored as percentage (e.g., 55.6%)
                                    const sa = saPercent / 100; // Convert to decimal (e.g., 0.556)
                                    // qtyExtra only calculated if sa > 0
                                    const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                                    const qtyScrapped = item.qtyScrapped || 0;
                                    // Simple formula: totalQty = bomQty + qtyScrapped + qtyExtra
                                    const totalQty = bomQty + qtyScrapped + qtyExtra;

                                    const skuObj = typeof item.sku === 'object' ? item.sku : null;
                                    const skuId = skuObj ? (skuObj as any)._id : item.sku;
                                    
                                    // Robust lookup for name, category and tier
                                    let displayName = skuObj ? (skuObj as any).name : '-';
                                    let displayCategory = skuObj ? (skuObj as any).category : '-';
                                    let displayTier = skuObj ? (skuObj as any).tier : null;
                                    
                                    if (displayName === '-' || !displayCategory || displayCategory === '-' || !displayTier) {
                                        const found = skuList.find(s => s._id === skuId);
                                        if (found) {
                                            if (displayName === '-') displayName = found.name;
                                            if (!displayCategory || displayCategory === '-') displayCategory = found.category || '-';
                                            if (!displayTier) displayTier = (found as any).tier;
                                        }
                                    }

                                    return (
                                        <tr key={item._id} className="hover:bg-secondary/30 transition-colors">
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono">
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-foreground/80 leading-tight min-w-[200px]">
                                                <div className="flex items-center space-x-1.5">
                                                    {!!displayTier && (
                                                        <span className={cn(
                                                            "flex-shrink-0 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black text-white",
                                                            displayTier === 1 ? "bg-emerald-500" :
                                                            displayTier === 2 ? "bg-blue-500" :
                                                            "bg-orange-500"
                                                        )} title={`Tier ${displayTier}`}>
                                                            {displayTier}
                                                        </span>
                                                    )}
                                                    <span 
                                                        className="hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                                                        onClick={() => {
                                                            const skuId = typeof item.sku === 'object' && item.sku !== null ? (item.sku as any)._id : item.sku;
                                                            if (skuId) router.push(`/warehouse/skus/${skuId}`);
                                                        }}
                                                    >
                                                        {displayName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1 flex justify-center">
                                                {displayCategory?.toLowerCase().includes('part') ? (
                                                    <div title={displayCategory}>
                                                        <Package className="w-3.5 h-3.5 text-blue-400" />
                                                    </div>
                                                ) : displayCategory?.toLowerCase().includes('finished') ? (
                                                    <div title={displayCategory}>
                                                        <Tag className="w-3.5 h-3.5 text-green-500" />
                                                    </div>
                                                ) : (
                                                    <div title={displayCategory}>
                                                        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground group relative">
                                                <div className="flex items-center gap-1">
                                                    {item.lotNumber ? (
                                                        <Link 
                                                            href={`/warehouse/skus/${typeof item.sku === 'object' && item.sku !== null ? (item.sku as any)._id : item.sku}?lot=${encodeURIComponent(item.lotNumber)}`}
                                                            className="hover:underline hover:text-blue-600 cursor-pointer text-foreground/80 font-mono"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {item.lotNumber}
                                                        </Link>
                                                    ) : (
                                                        <span>-</span>
                                                    )}
                                                    <button 
                                                        onClick={() => item.sku && handleEditLot(item._id, typeof item.sku === 'object' && item.sku !== null ? (item.sku as any)._id : item.sku)}
                                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500 transition-all p-0.5"
                                                        title="Edit Lot #"
                                                    >
                                                        <Pencil className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1 text-[9px] uppercase text-muted-foreground text-center">{item.uom || '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono text-right">{item.recipeQty ?? '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono text-right">{bomQty.toLocaleString()}</td>
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono text-center">{saPercent > 0 ? `${saPercent}%` : '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-foreground/80 font-mono bg-blue-50/20 text-right">{bomQty.toLocaleString()}</td>
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono text-right">{qtyExtra > 0 ? qtyExtra.toFixed(2) : '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-red-500/70 font-mono text-right">{qtyScrapped || '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-foreground/80 bg-secondary/30 text-right">
                                                {totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] font-mono text-foreground/80 bg-secondary/10 whitespace-nowrap text-right">
                                                {item.cost !== undefined ? `$${(totalQty * item.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}
                                            </td>
                                            <td className="px-3 py-1 text-center">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (openActionMenu?.id === item._id) {
                                                            setOpenActionMenu(null);
                                                        } else {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setOpenActionMenu({ id: item._id, x: rect.right, y: rect.bottom + 4 });
                                                        }
                                                    }}
                                                    className="p-1 hover:bg-secondary rounded text-muted-foreground"
                                                >
                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'Labor' && (
                    <div className="animate-in fade-in duration-300">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                <tr>
                                    {['Date', 'Type', 'User', 'Duration', 'Actions'].map(col => (
                                        <th key={col} className={`px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap ${col === 'Actions' ? 'text-right' : ''}`}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(!order.labor || order.labor.length === 0) ? (
                                    <tr>
                                        <td colSpan={5} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No labor entries found</td>
                                    </tr>
                                ) : order.labor.map(entry => {
                                    // Parse duration (HH:MM:SS) to hours for cost calculation
                                    const durationParts = (entry.duration || '0:0:0').split(':');
                                    const hours = parseInt(durationParts[0] || '0') + 
                                                 parseInt(durationParts[1] || '0') / 60 + 
                                                 parseInt(durationParts[2] || '0') / 3600;
                                    const cost = hours * (entry.hourlyRate || 0);
                                    
                                    const userName = formatUser(entry.user);

                                    return (
                                        <tr key={entry._id} className="hover:bg-secondary/30 transition-colors">
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono">
                                                {new Date(entry.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-foreground/80">{entry.type || '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-muted-foreground truncate max-w-[120px]">{userName}</td>
                                            <td className="px-3 py-1">
                                                {isTimerRunning(entry._id) 
                                                    ? (
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span className="relative flex h-2 w-2">
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                                                            </span>
                                                            <span className="text-sm font-black font-mono text-red-500 tabular-nums">
                                                                {formatDuration(Math.floor((currentTime - (getTimer(entry._id)?.startedAt || Date.now())) / 1000))}
                                                            </span>
                                                        </span>
                                                    )
                                                    : <span className="text-[10px] text-muted-foreground font-mono">{entry.duration || '-'}</span>
                                                }
                                            </td>

                                            <td className="px-3 py-1 text-right">
                                                <div className="flex items-center justify-end space-x-1">
                                                    {isTimerRunning(entry._id) ? (
                                                        <button 
                                                            onClick={async () => {
                                                                const result = globalStopTimer(entry._id);
                                                                if (!result) return;
                                                                const updatedLabor = order.labor?.map(l => 
                                                                    l._id === entry._id ? { ...l, duration: result.duration } : l
                                                                ) || [];
                                                                setOrder({ ...order, labor: updatedLabor });
                                                                try {
                                                                    await fetch(`/api/manufacturing/${order._id}`, {
                                                                        method: 'PATCH',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ labor: updatedLabor })
                                                                    });
                                                                    toast.success('Labor logged');
                                                                } catch (e) {
                                                                    toast.error('Failed to save labor');
                                                                }
                                                            }}
                                                            className="p-1.5 bg-red-500 hover:bg-red-600 text-white transition-colors"
                                                            title="Stop Timer"
                                                        >
                                                            <Square className="w-3 h-3 fill-current" />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={async () => {
                                                                const userId = typeof entry.user === 'object' ? entry.user._id : entry.user || '';
                                                                const isDurationZero = !entry.duration || entry.duration === '0:00:00' || entry.duration === '0:0:0';
                                                                const orderLabel = order.label || '';
                                                                const orderSkuName = typeof order.sku === 'object' && order.sku !== null ? (order.sku as any).name : '';
                                                                if (isDurationZero) {
                                                                    globalStartTimer({
                                                                        laborId: entry._id,
                                                                        orderId: order._id,
                                                                        orderLabel,
                                                                        skuName: orderSkuName,
                                                                        userName: formatUser(entry.user),
                                                                        laborType: entry.type || 'WO Labor',
                                                                        startedAt: Date.now(),
                                                                        hourlyRate: entry.hourlyRate || 0,
                                                                    });
                                                                } else {
                                                                    const newId = generateId();
                                                                    const newLabor = {
                                                                        _id: newId, type: entry.type || 'WO Labor', user: userId,
                                                                        duration: '0:00:00', hourlyRate: entry.hourlyRate || 0,
                                                                        createdAt: new Date().toISOString()
                                                                    };
                                                                    const updatedLabor = [...(order.labor || []), newLabor];
                                                                    setOrder({ ...order, labor: updatedLabor });
                                                                    globalStartTimer({
                                                                        laborId: newId,
                                                                        orderId: order._id,
                                                                        orderLabel,
                                                                        skuName: orderSkuName,
                                                                        userName: formatUser(entry.user),
                                                                        laborType: entry.type || 'WO Labor',
                                                                        startedAt: Date.now(),
                                                                        hourlyRate: entry.hourlyRate || 0,
                                                                    });
                                                                    try {
                                                                        await fetch(`/api/manufacturing/${order._id}`, {
                                                                            method: 'PATCH',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ labor: updatedLabor })
                                                                        });
                                                                    } catch (e) {
                                                                        toast.error('Failed to sync new labor line');
                                                                    }
                                                                }
                                                            }}
                                                            className="p-1 text-muted-foreground hover:text-emerald-500 transition-colors"
                                                            title="Start Timer"
                                                        >
                                                            <Play className="w-3 h-3 fill-current" />
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => {
                                                            const userId = typeof entry.user === 'object' ? entry.user._id : entry.user || '';
                                                            const userName = typeof entry.user === 'object' ? `${entry.user.firstName} ${entry.user.lastName}` : '';
                                                            setEditingLabor({ _id: entry._id, type: entry.type || '', user: userId, duration: entry.duration || '0:00:00', hourlyRate: entry.hourlyRate || 0 });
                                                            setUserSearch(userName);
                                                            setIsLaborModalOpen(true);
                                                        }}
                                                        className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                                                        title="Edit Labor"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            toast((t) => (
                                                                <div className="flex flex-col gap-2">
                                                                    <p className="text-sm font-bold text-white">Delete this labor entry?</p>
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
                                                                                const updatedLabor = order.labor?.filter(l => l._id !== entry._id) || [];
                                                                                const res = await fetch(`/api/manufacturing/${order._id}`, {
                                                                                    method: 'PATCH',
                                                                                    headers: { 'Content-Type': 'application/json' },
                                                                                    body: JSON.stringify({ labor: updatedLabor })
                                                                                });
                                                                                if (res.ok) {
                                                                                    const data = await res.json();
                                                                                    setOrder(data);
                                                                                    toast.success('Labor entry deleted');
                                                                                } else {
                                                                                    toast.error('Failed to delete labor');
                                                                                }
                                                                            }}
                                                                            className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
                                                        }}
                                                        className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                                                        title="Delete Labor"
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
                )}

                {activeTab === 'Recipe Steps' && (
                    <div className="animate-in fade-in duration-300 overflow-auto max-h-full">
                        {(!order.recipesId || typeof order.recipesId !== 'object' || !order.recipesId.steps || order.recipesId.steps.length === 0) ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                <Layers className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                                No recipe steps found
                            </div>
                        ) : (
                            <table className="w-full border-collapse text-left">
                                <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                    <tr>
                                        <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap w-16">Step</th>
                                        <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(order.recipesId.steps as any[]).sort((a: any, b: any) => (parseInt(a.step) || 0) - (parseInt(b.step) || 0)).map((step: any, i: number) => (
                                        <tr key={i} className="border-b border-border hover:bg-secondary/30 transition-colors">
                                            <td className="px-3 py-2 text-xs font-bold text-foreground whitespace-nowrap align-top text-center">
                                                {step.step}
                                            </td>
                                            <td className="px-3 py-2 align-top">
                                                <div className="font-bold text-foreground text-[11px]">{step.description}</div>
                                                {step.details && <div className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-relaxed mt-0.5">{step.details}</div>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'Recipe Notes' && (
                    <div className="animate-in fade-in duration-300 overflow-auto max-h-full">
                        {(!order.recipesId || typeof order.recipesId !== 'object' || !order.recipesId.notes) ? (
                            <div className="text-center py-12 text-muted-foreground text-sm">
                                <Clipboard className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                                No recipe notes found
                            </div>
                        ) : (
                            <table className="w-full border-collapse text-left">
                                <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                    <tr>
                                        <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Recipe</th>
                                        <th className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
                                        <td className="px-3 py-2 text-xs font-medium text-foreground whitespace-nowrap align-top">
                                            {typeof order.recipesId === 'object' ? order.recipesId.name : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                            {order.recipesId.notes}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                )}

                {activeTab === 'SKU Notes' && (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        <Tag className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                        SKU notes coming soon
                    </div>
                )}

                {activeTab === 'QC' && (
                    <div className="animate-in fade-in duration-300">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                <tr>
                                    {['Checked By', 'Packaged By', 'Label', 'Lot', 'Seal', 'Pkg Qty', 'Repackaged', 'Weight', 'Target', 'Actual Wt', 'QC By', 'Date'].map(col => (
                                        <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(!order.qualityCheck || order.qualityCheck.length === 0) ? (
                                    <tr>
                                        <td colSpan={12} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No quality checks found</td>
                                    </tr>
                                ) : order.qualityCheck.map((qc, idx) => (
                                    <tr key={qc._id || idx} className="hover:bg-secondary/30 transition-colors">
                                        <td className="px-3 py-1 text-[10px] text-foreground/80">{formatUser(qc.checkedBy)}</td>
                                        <td className="px-3 py-1 text-[10px] text-foreground/80">{formatUser(qc.packagedBy)}</td>
                                        <td className="px-3 py-1 text-[10px] text-center">
                                            {qc.label ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-center">
                                            {qc.lot ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-center">
                                            {qc.seal ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-center">
                                            {qc.packageQuality ? <span className="text-emerald-500 font-bold">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-center">
                                            {qc.repackaged ? <span className="text-amber-500 font-bold">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-foreground/80 font-mono">{qc.weight ?? 0}</td>
                                        <td className="px-3 py-1 text-[10px] text-foreground/80 font-mono">{qc.target ?? 0}</td>
                                        <td className="px-3 py-1 text-[10px] text-foreground/80 font-mono">{qc.actualWeight ?? 0}</td>
                                        <td className="px-3 py-1 text-[10px] text-foreground/80">{formatUser(qc.qualityCheckedBy)}</td>
                                        <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono">
                                            {qc.createdAt ? new Date(qc.createdAt).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'WO Notes' && (
                    <div className="animate-in fade-in duration-300">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                <tr>
                                    {['Note', 'Created By', 'Created At', 'Actions'].map(col => (
                                        <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(!order.notes || order.notes.length === 0) ? (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No notes found</td>
                                    </tr>
                                ) : order.notes.map((note, idx) => (
                                    <tr key={note._id || idx} className="hover:bg-secondary/30 transition-colors">
                                        <td className="px-3 py-1 text-[10px] text-foreground/80 max-w-md">
                                            <p className="line-clamp-2">{note.note}</p>
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-muted-foreground">
                                            {formatUser(note.createdBy)}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-muted-foreground font-mono">
                                            {new Date(note.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                            <div className="flex items-center justify-end space-x-1">
                                                <button 
                                                    onClick={() => {
                                                        setEditingNote({ _id: note._id, note: note.note });
                                                        setIsNoteModalOpen(true);
                                                    }}
                                                    className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                                                    title="Edit Note"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        confirmDeleteToast('Delete this note?', async () => {
                                                            const updatedNotes = order.notes?.filter(n => n._id !== note._id) || [];
                                                            const res = await fetch(`/api/manufacturing/${order._id}`, {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ notes: updatedNotes })
                                                            });
                                                            if (res.ok) {
                                                                const data = await res.json();
                                                                setOrder(data);
                                                                toast.success('Note deleted');
                                                            }
                                                        });
                                                    }}
                                                    className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                                                    title="Delete Note"
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
                )}
                </div>
            </div>
        </div>

            {/* Fixed-position Line Item Actions Dropdown */}
            {openActionMenu && order && (() => {
                const targetItem = order.lineItems?.find(i => i._id === openActionMenu.id);
                if (!targetItem) return null;
                return (
                    <div 
                        className="fixed w-28 bg-background shadow-[0_4px_20px_rgba(0,0,0,0.3)] border border-border rounded z-[9999] py-1"
                        style={{ top: openActionMenu.y, left: openActionMenu.x - 112 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenu(null);
                                handleOpenEditModal(targetItem);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] text-foreground/70 hover:bg-secondary hover:text-blue-500 flex items-center space-x-1.5 transition-colors"
                        >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenu(null);
                                handleCopyItem(targetItem);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] text-foreground/70 hover:bg-secondary hover:text-emerald-500 flex items-center space-x-1.5 transition-colors"
                        >
                            <Copy className="w-3 h-3" />
                            <span>Duplicate</span>
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenu(null);
                                handleDeleteItem(targetItem._id);
                            }}
                            className="w-full text-left px-3 py-2 text-[10px] text-foreground/70 hover:bg-red-500/10 hover:text-red-500 flex items-center space-x-1.5 transition-colors"
                        >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                        </button>
                    </div>
                );
            })()}



            {/* Lot Selection Modal */}
            <LotSelectionModal
                isOpen={isLotModalOpen}
                onClose={() => setIsLotModalOpen(false)}
                onSelect={handleLotSelect}
                skuId={editingSkuId || ''}
                currentLotNumber={currentEditingItem?.lotNumber}
                requiredQty={currentEditingItemRequiredQty}
            />

            {/* Lot Selection Modal for Add Line Item */}
            <LotSelectionModal
                isOpen={isAddLotModalOpen}
                onClose={() => setIsAddLotModalOpen(false)}
                onSelect={(lotNumber, cost) => {
                    if (editingItem) {
                        setEditingItem({ ...editingItem, lotNumber, cost: cost || 0 });
                    }
                    setIsAddLotModalOpen(false);
                }}
                skuId={editingSkuId || ''}
                currentLotNumber={editingItem?.lotNumber}
                requiredQty={getRequiredQtyForItem(editingItem)}
            />

            {/* Edit Item Modal */}
            {isEditModalOpen && editingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseEditModal}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                                {editingItem._id ? 'Edit Item' : 'Add Line Item'}
                            </h3>
                            <button onClick={handleCloseEditModal} className="p-1 hover:bg-secondary rounded transition-colors">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* SKU - always editable */}
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">SKU</label>
                                <SearchableSelect
                                    options={skuList.map(s => ({ value: s._id, label: s.name }))}
                                    value={typeof editingItem.sku === 'string' ? editingItem.sku : (editingItem.sku as any)?._id || ''}
                                    onChange={async (skuId: string) => {
                                        setEditingItem({ ...editingItem, sku: skuId });
                                        
                                        // Auto-fetch oldest lot for this SKU
                                        try {
                                            const res = await fetch(`/api/warehouse/skus/${skuId}/lots`);
                                            if (res.ok) {
                                                const data = await res.json();
                                                const lotsWithBalance = (data.lots || [])
                                                    .filter((l: any) => l.balance > 0)
                                                    .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
                                                if (lotsWithBalance.length > 0) {
                                                    setEditingItem(prev => prev ? { 
                                                        ...prev, 
                                                        sku: skuId, 
                                                        lotNumber: lotsWithBalance[0].lotNumber,
                                                        cost: lotsWithBalance[0].cost || 0
                                                    } : prev);
                                                }
                                            }
                                        } catch (e) {
                                            // Silently fail - user can still select lot manually
                                        }
                                    }}
                                    placeholder="Search SKU..."
                                    triggerClassName="rounded border-border h-9 bg-background"
                                />
                            </div>
                            
                            {/* Lot Number */}
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Lot Number</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        value={editingItem.lotNumber || ''}
                                        onChange={e => setEditingItem({ ...editingItem, lotNumber: e.target.value })}
                                        className="flex-1 px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        placeholder="Enter or select lot..."
                                    />
                                    {(editingItem.sku && (typeof editingItem.sku === 'string' ? editingItem.sku : editingItem.sku._id)) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingSkuId(typeof editingItem.sku === 'object' ? editingItem.sku._id : editingItem.sku as string);
                                                setIsAddLotModalOpen(true);
                                            }}
                                            className="px-3 py-2 text-xs font-bold uppercase bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors rounded"
                                        >
                                            Select Lot
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Recipe Qty */}
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Recipe Qty</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.recipeQty || ''}
                                        onChange={e => setEditingItem({ ...editingItem, recipeQty: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>

                                {/* UOM */}
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">UOM</label>
                                    <select
                                        value={editingItem.uom || ''}
                                        onChange={e => setEditingItem({ ...editingItem, uom: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10 bg-background"
                                    >
                                        <option value="">Select...</option>
                                        {['g', 'kg', 'oz', 'lb', 'ml', 'L', 'unit', 'each', 'ct', 'capsule', 'tablet'].map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {/* Assay (%) */}
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Assay (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.sa || ''}
                                        onChange={e => setEditingItem({ ...editingItem, sa: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        placeholder="e.g., 55.6"
                                    />
                                </div>

                                {/* Qty Extra (Calculated - Read Only) */}
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Qty Extra <span className="text-muted-foreground/40 normal-case">(calc)</span></label>
                                    {(() => {
                                        const bomQty = (editingItem.recipeQty || 0) * (order?.qty || 0);
                                        const saPercent = editingItem.sa || 0;
                                        const sa = saPercent / 100;
                                        const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
                                        return (
                                            <input
                                                type="text"
                                                value={qtyExtra > 0 ? qtyExtra.toFixed(2) : '-'}
                                                disabled
                                                className="w-full px-3 py-2 text-sm border border-border rounded bg-secondary text-muted-foreground cursor-not-allowed"
                                            />
                                        );
                                    })()}
                                </div>

                                {/* Qty Scrapped */}
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Qty Scrapped</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.qtyScrapped || ''}
                                        onChange={e => setEditingItem({ ...editingItem, qtyScrapped: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-border bg-secondary/50">
                            <button
                                onClick={handleCloseEditModal}
                                className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground hover:text-foreground/80 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveItem}
                                className="px-4 py-2 text-xs font-bold uppercase bg-foreground text-background hover:bg-foreground/80 transition-colors rounded"
                            >
                                {editingItem._id ? 'Save Changes' : 'Add Item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Note Modal */}
            {isNoteModalOpen && editingNote && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsNoteModalOpen(false)}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                                {editingNote._id ? 'Edit Note' : 'Add Note'}
                            </h3>
                            <button onClick={() => setIsNoteModalOpen(false)} className="p-1 hover:bg-secondary rounded transition-colors">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Note</label>
                                <textarea
                                    rows={4}
                                    value={editingNote.note}
                                    onChange={e => setEditingNote({ ...editingNote, note: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10 resize-none"
                                    placeholder="Enter your note..."
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-border bg-secondary/50">
                            <button
                                onClick={() => setIsNoteModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground hover:text-foreground/80 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!editingNote.note.trim() || !order) return;
                                    
                                    try {
                                        let updatedNotes;
                                        if (editingNote._id) {
                                            // Edit existing
                                            updatedNotes = order.notes?.map(n => 
                                                n._id === editingNote._id ? { ...n, note: editingNote.note.trim() } : n
                                            ) || [];
                                        } else {
                                            // Add new
                                            const newNote = {
                                                note: editingNote.note.trim(),
                                                createdBy: session?.user?.email || '',
                                                createdAt: new Date().toISOString()
                                            };
                                            updatedNotes = [...(order.notes || []), newNote];
                                        }
                                        
                                        const res = await fetch(`/api/manufacturing/${order._id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ notes: updatedNotes })
                                        });
                                        
                                        if (res.ok) {
                                            const data = await res.json();
                                            setOrder(data);
                                            toast.success(editingNote._id ? 'Note updated' : 'Note added');
                                            setIsNoteModalOpen(false);
                                            setEditingNote(null);
                                        } else {
                                            toast.error('Failed to save note');
                                        }
                                    } catch (e) {
                                        toast.error('Error saving note');
                                    }
                                }}
                                className="px-4 py-2 text-xs font-bold uppercase bg-foreground text-background hover:bg-foreground/80 transition-colors rounded"
                            >
                                {editingNote._id ? 'Save Changes' : 'Add Note'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Labor Modal */}
            {isLaborModalOpen && editingLabor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsLaborModalOpen(false)}>
                    <div className="bg-background rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                                {editingLabor._id ? 'Edit Labor' : 'Add Labor'}
                            </h3>
                            <button onClick={() => setIsLaborModalOpen(false)} className="p-1 hover:bg-secondary rounded transition-colors">
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Type Dropdown */}
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Type</label>
                                <select
                                    value={editingLabor.type}
                                    onChange={e => setEditingLabor({ ...editingLabor, type: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10 bg-background"
                                >
                                    <option value="WO Labor">WO Labor</option>
                                    <option value="Maintenance & Preparation">Maintenance & Preparation</option>
                                </select>
                            </div>

                            {/* User Dropdown */}
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">User</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={e => {
                                            setUserSearch(e.target.value);
                                            setIsUserDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsUserDropdownOpen(true)}
                                        className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        placeholder="Search user..."
                                    />
                                    {isUserDropdownOpen && (
                                        <div className="absolute z-20 w-full mt-1 bg-background border border-border rounded shadow-lg max-h-48 overflow-auto">
                                            {usersList
                                                .filter(u => {
                                                    // Filter by search
                                                    const matchesSearch = `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase());
                                                    
                                                    // Filter out users already in labor list (ONLY for new entries)
                                                    // If editing, we allow the current user to be displayed, but typically user doesn't change when editing
                                                    // User requested "when adding new labor it will give me only options of users which is not in the related list already"
                                                    // So we only filter if !editingLabor._id
                                                    let isAlreadyAdded = false;
                                                    if (!editingLabor._id && order && order.labor) {
                                                        isAlreadyAdded = order.labor.some(l => {
                                                            const lUserId = typeof l.user === 'object' ? (l.user as any)._id : l.user;
                                                            return lUserId === u._id;
                                                        });
                                                    }
                                                    
                                                    return matchesSearch && !isAlreadyAdded;
                                                })
                                                .slice(0, 20)
                                                .map(u => (
                                                    <button
                                                        key={u._id}
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingLabor({ ...editingLabor, user: u._id, hourlyRate: u.hourlyRate || 0 });
                                                            setUserSearch(`${u.firstName} ${u.lastName}`);
                                                            setIsUserDropdownOpen(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
                                                    >
                                                        <span className="font-medium">{u.firstName} {u.lastName}</span>
                                                    </button>
                                                ))}
                                            {usersList.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                                                <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Duration - only show when editing */}
                            {editingLabor._id && (
                                <div>
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1">Duration (HH:MM:SS)</label>
                                    <input
                                        type="text"
                                        value={editingLabor.duration}
                                        onChange={e => setEditingLabor({ ...editingLabor, duration: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        placeholder="0:30:00"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-border bg-secondary/50">
                            <button
                                onClick={() => setIsLaborModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold uppercase text-muted-foreground hover:text-foreground/80 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!order) return;
                                    
                                    try {
                                        let updatedLabor;
                                        if (editingLabor._id) {
                                            // Edit existing
                                            updatedLabor = order.labor?.map(l => 
                                                l._id === editingLabor._id ? { ...l, type: editingLabor.type, user: editingLabor.user, duration: editingLabor.duration, hourlyRate: editingLabor.hourlyRate } : l
                                            ) || [];
                                        } else {
                                            // Add new
                                            const newLabor = {
                                                type: editingLabor.type,
                                                user: editingLabor.user,
                                                duration: '0:00:00',
                                                hourlyRate: editingLabor.hourlyRate,
                                                createdAt: new Date().toISOString()
                                            };
                                            updatedLabor = [...(order.labor || []), newLabor];
                                        }
                                        
                                        const res = await fetch(`/api/manufacturing/${order._id}`, {
                                            method: 'PATCH',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ labor: updatedLabor })
                                        });
                                        
                                        if (res.ok) {
                                            const data = await res.json();
                                            setOrder(data);
                                            toast.success(editingLabor._id ? 'Labor updated' : 'Labor added');
                                            setIsLaborModalOpen(false);
                                            setEditingLabor(null);
                                        } else {
                                            toast.error('Failed to save labor');
                                        }
                                    } catch (e) {
                                        toast.error('Error saving labor');
                                    }
                                }}
                                className="px-4 py-2 text-xs font-bold uppercase bg-foreground text-background hover:bg-foreground/80 transition-colors rounded"
                            >
                                {editingLabor._id ? 'Save Changes' : 'Add Labor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
