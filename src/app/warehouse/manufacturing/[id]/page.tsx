'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Package, Calendar, User, Clock, Tag, Clipboard, Layers, Pencil, Trash2, X, Plus, Copy, Play, Square, MoreVertical } from 'lucide-react';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

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
    const [editingLabor, setEditingLabor] = useState<{ _id?: string; type: string; user: string; duration: string; hourlyRate: number } | null>(null);

    // Users list for Labor dropdown
    const [usersList, setUsersList] = useState<{ _id: string; firstName: string; lastName: string; hourlyRate?: number; email?: string }[]>([]);
    const [allUsersList, setAllUsersList] = useState<{ _id: string; firstName: string; lastName: string; email?: string }[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

    // Active Labor Timer State
    const [activeTimers, setActiveTimers] = useState<Record<string, number>>({});
    const [currentTime, setCurrentTime] = useState(Date.now());

    // SKU List for adding line items
    const [skuList, setSkuList] = useState<{ _id: string; name: string; category?: string; image?: string }[]>([]);
    const [skuSearch, setSkuSearch] = useState('');
    const [isSkuDropdownOpen, setIsSkuDropdownOpen] = useState(false);

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

    // Timer Logic
    // Timer Logic
    useEffect(() => {
        let interval: NodeJS.Timeout;
        // Check if we have any active timers
        if (Object.keys(activeTimers).length > 0) {
            interval = setInterval(() => {
                setCurrentTime(Date.now());
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTimers]);

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

                const cat = (typeof item.sku === 'object' && item.sku.category) ? item.sku.category.toLowerCase() : '';
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
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <LoadingSpinner size="lg" message="Loading Manufacturing Order" />
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <div className="text-sm text-slate-400">Order not found</div>
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

    const skuImage = (typeof order.sku === 'object' && order.sku.image) ? order.sku.image : skuList.find(s => s._id === order.sku)?.image;

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
                    const data = await res.json();
                    // We don't overwrite the whole order here because if user is still typing, 
                    // we might revert their current local changes. 
                    // Instead, just confirm it's synced.
                    // Actually, getting the data back is good for refreshing costs if they changed on server.
                    // But we've already updated costs locally.
                    // Let's just update the order state with data ONLY if it's the latest value.
                } else {
                    toast.error('Failed to sync quantity to database');
                }
            } catch (e) {
                console.error("Sync error", e);
            } finally {
                setIsSubmittingDiff(false);
            }
        }, 1500); // 1.5 second debounce
    };



    const handleEditLot = (itemId: string, skuId: string) => {
        setEditingLotItemId(itemId);
        setEditingSkuId(skuId);
        setIsLotModalOpen(true);
    };

    const handleLotSelect = async (lotNumber: string, cost?: number) => {
        if (!order || !editingLotItemId) return;
        
        try {
            const updatedLineItems = order.lineItems?.map(item => 
                item._id === editingLotItemId ? { ...item, lotNumber, cost: cost || 0 } : item
            ) || [];

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
    
    // Helper to calculate required qty for a line item (for lot suggestion)
    // Using regular function instead of useCallback to avoid hooks order issues
    const getRequiredQtyForItem = (item: LineItem | null): number => {
        if (!item || !order) return 0;
        const bomQty = (item.recipeQty || 0) * (order.qty || 0);
        const saPercent = item.sa || 0;
        const sa = saPercent / 100;
        const qtyExtra = sa > 0 ? (bomQty / sa) - bomQty : 0;
        const qtyScrapped = item.qtyScrapped || 0;
        return bomQty + qtyExtra + qtyScrapped;
    };
    
    // Helper to get current lot for highlighting
    const currentEditingItem = order?.lineItems?.find(i => i._id === editingLotItemId);
    const currentEditingItemRequiredQty = getRequiredQtyForItem(currentEditingItem || null);

    // Edit Item Handlers
    const handleOpenEditModal = (item: LineItem) => {
        setEditingItem({ ...item });
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setEditingItem(null);
    };

    const handleSaveItem = async () => {
        if (!order || !editingItem) return;
        
        try {
            let updatedLineItems;
            if (editingItem._id) {
                // Edit existing item
                updatedLineItems = order.lineItems?.map(item => 
                    item._id === editingItem._id ? editingItem : item
                ) || [];
            } else {
                // Add new item
                const newItem = {
                    ...editingItem,
                    createdAt: new Date().toISOString()
                };
                updatedLineItems = [...(order.lineItems || []), newItem];
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

    const handleDeleteItem = async (itemId: string) => {
        if (!order || !window.confirm('Are you sure you want to delete this item?')) return;
        
        try {
            const updatedLineItems = order.lineItems?.filter(item => item._id !== itemId) || [];
            
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
    };

    // deleted the misplaced memo from here

    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-white overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 h-10 shadow-sm">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={() => router.push('/warehouse/manufacturing')}
                        className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-500" />
                    </button>
                    <div className="flex items-baseline space-x-3">
                        <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Manufacturing Details</h1>
                        <p className="text-[10px] text-slate-400 font-mono uppercase">{order.label || order._id}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <Link 
                        href={`/warehouse/skus/${typeof order.sku === 'object' ? order.sku._id : order.sku}?lot=${encodeURIComponent(order.label || order._id)}`}
                        className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[10px] font-bold uppercase hover:bg-slate-200 transition-colors flex items-center gap-1.5"
                    >
                        <Layers className="w-3 h-3" />
                        <span>View Ledger</span>
                    </Link>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar: Details (30%) */}
                <div className="w-[30%] border-r border-slate-200 bg-slate-50/30 overflow-y-auto p-6 space-y-6 scrollbar-custom">
                    {/* Status & Priority Chips */}
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            "px-2 py-1 text-[9px] font-black uppercase tracking-widest border rounded-none",
                            order.status === 'Completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                            order.status === 'In Progress' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                            {order.status}
                        </div>
                        <div className={cn(
                            "px-2 py-1 text-[9px] font-black uppercase tracking-widest border rounded-none",
                            order.priority === 'High' ? "bg-red-50 text-red-600 border-red-100" :
                            order.priority === 'Medium' ? "bg-orange-50 text-orange-600 border-orange-100" :
                            "bg-slate-100 text-slate-500 border-slate-200"
                        )}>
                            {order.priority}
                        </div>
                    </div>

                    {/* Header Row 2: SKU Name */}
                    <div>
                        <div 
                            className="flex items-center space-x-3 mb-6 cursor-pointer group"
                            onClick={() => {
                                const skuId = typeof order.sku === 'object' ? order.sku._id : order.sku;
                                if (skuId) router.push(`/warehouse/skus/${skuId}`);
                            }}
                        >
                            <div className="w-14 h-14 bg-white border border-slate-200 flex items-center justify-center p-1 shadow-sm shrink-0 group-hover:border-blue-300 transition-colors">
                                {skuImage ? (
                                    <img 
                                        src={skuImage} 
                                        alt={skuName} 
                                        className="max-w-full max-h-full object-contain" 
                                        onError={(e) => {
                                            if (globalSettings?.missingSkuImage) {
                                                (e.target as HTMLImageElement).src = globalSettings.missingSkuImage;
                                            }
                                        }}
                                    />
                                ) : globalSettings?.missingSkuImage ? (
                                    <img src={globalSettings.missingSkuImage} alt="Fallback" className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <Package className="w-6 h-6 text-slate-400" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center space-x-2">
                                    {!!sidebarSkuTier && (
                                        <span className={cn(
                                            "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-black text-white shadow-sm",
                                            sidebarSkuTier === 1 ? "bg-emerald-500" :
                                            sidebarSkuTier === 2 ? "bg-blue-500" :
                                            "bg-orange-500"
                                        )} title={`Tier ${sidebarSkuTier}`}>
                                            {sidebarSkuTier}
                                        </span>
                                    )}
                                    <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none group-hover:text-blue-600 transition-colors">{skuName}</h1>
                                </div>
                            </div>
                        </div>

                        {/* Info Rows */}
                        <div className="space-y-6">
                            {/* Quantity Section */}
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold italic">Ordered Qty</div>
                                        <div className="text-lg font-black text-slate-900">{order.qty} <span className="text-[10px] text-slate-400 font-bold uppercase">{order.uom}</span></div>
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold italic">Adjust Qty</div>
                                            {isSubmittingDiff && (
                                                <div className="text-[8px] text-blue-500 font-bold uppercase animate-pulse">Saving...</div>
                                            )}
                                        </div>
                                        <div className="flex items-center bg-white border border-slate-200 h-8 p-1 focus-within:border-black transition-colors w-24">
                                            <button 
                                                disabled={isSubmittingDiff}
                                                onClick={() => handleUpdateQtyDiff((order.qtyDifference || 0) - 1)}
                                                className="w-6 h-full flex items-center justify-center text-slate-400 hover:text-black transition-all"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                            </button>
                                            <input 
                                                type="number"
                                                value={order.qtyDifference || 0}
                                                onChange={(e) => handleUpdateQtyDiff(parseInt(e.target.value) || 0)}
                                                className="flex-1 text-center text-xs font-bold bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none min-w-0"
                                            />
                                            <button 
                                                disabled={isSubmittingDiff}
                                                onClick={() => handleUpdateQtyDiff((order.qtyDifference || 0) + 1)}
                                                className="w-6 h-full flex items-center justify-center text-slate-400 hover:text-black transition-all"
                                            >
                                                <Plus className="w-3 h-3" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-black/5 p-3 flex justify-between items-center">
                                    <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Quantity Manufactured</div>
                                    <div className="text-lg font-black text-slate-900">{costs.qtyManufactured} <span className="text-[10px] text-slate-400 font-bold uppercase">{order.uom}</span></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                {infoRows.flat().map((item, idx) => (
                                    <div key={idx}>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">{item.label}</div>
                                        <div className="text-xs font-medium text-slate-700 whitespace-nowrap">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Cost Breakdown */}
                    <div>
                        <h3 className="text-xs font-bold uppercase text-slate-900 tracking-widest mb-4 border-b border-slate-200 pb-2">Cost Analysis</h3>
                        <div className="space-y-3">
                             <div className="flex justify-between items-center group">
                                 <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">Material Cost</span>
                                <span className="text-sm font-mono font-medium text-slate-700">${costs.material.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">Packaging Cost</span>
                                <span className="text-sm font-mono font-medium text-slate-700">${costs.packaging.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                            </div>
                            <div className="flex justify-between items-center group">
                                <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">Labor Cost</span>
                                <span className="text-sm font-mono font-medium text-slate-700">${costs.labor.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                            </div>
                            <div className="flex justify-between items-center group pt-1">
                                <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors italic">Cost per Unit</span>
                                <span className="text-sm font-mono font-medium text-slate-600 italic">${costs.perUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                            </div>
                            <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">Total Cost</span>
                                <span className="text-base font-mono font-bold text-emerald-600">${costs.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Content: Tabs (70%) */}
                <div className="w-[70%] bg-white flex flex-col overflow-hidden">
                    {/* Tabs & Actions */}
                    <div className="px-6 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white z-10">
                        <div className="flex space-x-1">
                            {(() => {
                                const tabCounts: Record<string, number> = {
                                    'Items': order.lineItems?.length || 0,
                                    'Labor': order.labor?.length || 0,
                                    'WO Notes': order.notes?.length || 0,
                                    'Recipe Steps': (typeof order.recipesId === 'object' && (order.recipesId as any)?.steps?.length) || 0,
                                    'Recipe Notes': (typeof order.recipesId === 'object' && (order.recipesId as any)?.notes) ? 1 : 0,
                                    'SKU Notes': 0,
                                    'QC': 0,
                                };
                                return TABS.map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={cn(
                                            "px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-colors border-b-2 -mb-px outline-none flex items-center space-x-1.5",
                                            activeTab === tab
                                                ? "text-black border-black"
                                                : "text-slate-400 border-transparent hover:text-slate-600"
                                        )}
                                    >
                                        <span>{tab}</span>
                                        {tabCounts[tab] > 0 && (
                                            <span className={cn(
                                                "px-1.5 py-0.5 rounded-none text-[9px] font-bold",
                                                activeTab === tab ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
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
                                        setSkuSearch('');
                                        setIsEditModalOpen(true);
                                    }}
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-slate-800 transition-colors flex items-center space-x-1 shadow-sm"
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
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-slate-800 transition-colors flex items-center space-x-1 shadow-sm"
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
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-slate-800 transition-colors flex items-center space-x-1 shadow-sm"
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
                            <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
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
                                                "px-3 py-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap",
                                                col.align || "text-left" 
                                            )}
                                        >
                                            {col.hideLabel ? '' : col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(!order.lineItems || order.lineItems.length === 0) ? (
                                    <tr>
                                        <td colSpan={13} className="px-3 py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">No line items</td>
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
                                        <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-1 text-[10px] text-slate-500 font-mono">
                                                {new Date(item.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-slate-700 leading-tight">
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
                                                            const skuId = typeof item.sku === 'object' ? item.sku._id : item.sku;
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
                                                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-slate-500 group relative">
                                                <div className="flex items-center gap-1">
                                                    {item.lotNumber ? (
                                                        <Link 
                                                            href={`/warehouse/skus/${typeof item.sku === 'object' ? item.sku._id : item.sku}?lot=${encodeURIComponent(item.lotNumber)}`}
                                                            className="hover:underline hover:text-blue-600 cursor-pointer text-slate-700 font-mono"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {item.lotNumber}
                                                        </Link>
                                                    ) : (
                                                        <span>-</span>
                                                    )}
                                                    <button 
                                                        onClick={() => item.sku && handleEditLot(item._id, typeof item.sku === 'object' ? item.sku._id : item.sku)}
                                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition-all p-0.5"
                                                        title="Edit Lot #"
                                                    >
                                                        <Pencil className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1 text-[9px] uppercase text-slate-400 text-center">{item.uom || '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-500 font-mono text-right">{item.recipeQty ?? '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-500 font-mono text-right">{bomQty.toLocaleString()}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-500 font-mono text-center">{saPercent > 0 ? `${saPercent}%` : '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-700 font-mono bg-blue-50/20 text-right">{bomQty.toLocaleString()}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-400 font-mono text-right">{qtyExtra > 0 ? qtyExtra.toFixed(2) : '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-red-500/70 font-mono text-right">{qtyScrapped || '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-700 bg-slate-50/30 text-right">
                                                {totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] font-mono text-slate-700 bg-slate-50/10 whitespace-nowrap text-right">
                                                {item.cost !== undefined ? `$${(totalQty * item.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}
                                            </td>
                                            <td className="px-3 py-1 text-center relative group/actions">
                                                <button className="p-1 hover:bg-slate-100 rounded text-slate-400">
                                                    <MoreVertical className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="hidden group-hover/actions:block absolute right-0 top-full mt-1 w-24 bg-white shadow-md border border-slate-100 rounded z-20 py-1">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenEditModal(item);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-[10px] text-slate-600 hover:bg-slate-50 hover:text-blue-600 flex items-center space-x-1"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteItem(item._id);
                                                        }}
                                                        className="w-full text-left px-3 py-1.5 text-[10px] text-slate-600 hover:bg-red-50 hover:text-red-600 flex items-center space-x-1"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                        <span>Delete</span>
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

                {activeTab === 'Labor' && (
                    <div className="animate-in fade-in duration-300">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                <tr>
                                    {['Date', 'Type', 'User', 'Duration', 'Hourly Rate', 'Cost', 'Actions'].map(col => (
                                        <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(!order.labor || order.labor.length === 0) ? (
                                    <tr>
                                        <td colSpan={7} className="px-3 py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">No labor entries found</td>
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
                                        <tr key={entry._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-1 text-[10px] text-slate-500 font-mono">
                                                {new Date(entry.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-slate-700">{entry.type || '-'}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-500 truncate max-w-[120px]">{userName}</td>
                                            <td className="px-3 py-1 text-[10px] text-slate-500 font-mono">
                                                {activeTimers[entry._id] 
                                                    ? formatDuration(Math.floor((currentTime - activeTimers[entry._id]) / 1000))
                                                    : (entry.duration || '-')
                                                }
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-slate-500 font-mono">
                                                {entry.hourlyRate !== undefined ? `$${entry.hourlyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '-'}
                                            </td>
                                            <td className="px-3 py-1 text-[10px] text-slate-700 bg-slate-50/30">
                                                ${cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                                            </td>
                                            <td className="px-3 py-1 text-right">
                                                <div className="flex items-center justify-end space-x-1">
                                                    {activeTimers[entry._id] ? (
                                                        <button 
                                                            onClick={async () => {
                                                                const startTime = activeTimers[entry._id];
                                                                if (!startTime) return;
                                                                const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
                                                                const duration = formatDuration(durationSeconds);
                                                                const updatedLabor = order.labor?.map(l => 
                                                                    l._id === entry._id ? { ...l, duration: duration } : l
                                                                ) || [];
                                                                const newTimers = { ...activeTimers };
                                                                delete newTimers[entry._id];
                                                                setActiveTimers(newTimers);
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
                                                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                                                            title="Stop Timer"
                                                        >
                                                            <Square className="w-3 h-3 fill-current" />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={async () => {
                                                                const userId = typeof entry.user === 'object' ? entry.user._id : entry.user || '';
                                                                const isDurationZero = !entry.duration || entry.duration === '0:00:00' || entry.duration === '0:0:0';
                                                                if (isDurationZero) {
                                                                    setActiveTimers(prev => ({ ...prev, [entry._id]: Date.now() }));
                                                                } else {
                                                                    const newId = generateId();
                                                                    const newLabor = {
                                                                        _id: newId, type: entry.type || 'WO Labor', user: userId,
                                                                        duration: '0:00:00', hourlyRate: entry.hourlyRate || 0,
                                                                        createdAt: new Date().toISOString()
                                                                    };
                                                                    const updatedLabor = [...(order.labor || []), newLabor];
                                                                    setOrder({ ...order, labor: updatedLabor });
                                                                    setActiveTimers(prev => ({ ...prev, [newId]: Date.now() }));
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
                                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
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
                                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Edit Labor"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={async () => {
                                                            if (window.confirm('Are you sure you want to delete this labor entry?')) {
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
                                                                }
                                                            }
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
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
                    <div className="p-6 space-y-4 animate-in fade-in duration-300 overflow-auto max-h-full">
                        {(!order.recipesId || typeof order.recipesId !== 'object' || !order.recipesId.steps || order.recipesId.steps.length === 0) ? (
                            <div className="text-center py-12 text-slate-400 text-sm">
                                <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No recipe steps found
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(order.recipesId.steps as any[]).sort((a: any, b: any) => (parseInt(a.step) || 0) - (parseInt(b.step) || 0)).map((step: any, i: number) => (
                                    <div key={i} className="flex gap-4 p-4 rounded bg-white border border-slate-100 shadow-sm relative group hover:border-slate-200 transition-colors">
                                        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-slate-900 text-white text-[10px] font-bold rounded-full shadow-sm">
                                            {step.step}
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-900 text-[11px] mb-1">{step.description}</div>
                                            <div className="text-[10px] text-slate-500 whitespace-pre-wrap leading-relaxed">{step.details || 'No details provided.'}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'Recipe Notes' && (
                    <div className="p-6 animate-in fade-in duration-300 overflow-auto max-h-full">
                        {(!order.recipesId || typeof order.recipesId !== 'object' || !order.recipesId.notes) ? (
                            <div className="text-center py-12 text-slate-400 text-sm">
                                <Clipboard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                No recipe notes found
                            </div>
                        ) : (
                            <div className="bg-white p-6 rounded border border-slate-100 shadow-sm">
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-4 flex items-center">
                                    <Clipboard className="w-3 h-3 mr-2" />
                                    Recipe Notes
                                </div>
                                <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {order.recipesId.notes}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'SKU Notes' && (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        SKU notes coming soon
                    </div>
                )}

                {activeTab === 'QC' && (
                    <div className="text-center py-12 text-slate-400 text-sm">
                        <Clipboard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        Quality control coming soon
                    </div>
                )}

                {activeTab === 'WO Notes' && (
                    <div className="animate-in fade-in duration-300">
                        <table className="w-full border-collapse text-left">
                            <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                <tr>
                                    {['Note', 'Created By', 'Created At', 'Actions'].map(col => (
                                        <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(!order.notes || order.notes.length === 0) ? (
                                    <tr>
                                        <td colSpan={4} className="px-3 py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">No notes found</td>
                                    </tr>
                                ) : order.notes.map((note, idx) => (
                                    <tr key={note._id || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-3 py-1 text-[10px] text-slate-700 max-w-md">
                                            <p className="line-clamp-2">{note.note}</p>
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-slate-500">
                                            {formatUser(note.createdBy)}
                                        </td>
                                        <td className="px-3 py-1 text-[10px] text-slate-500 font-mono">
                                            {new Date(note.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-3 py-1 text-right">
                                            <div className="flex items-center justify-end space-x-1">
                                                <button 
                                                    onClick={() => {
                                                        setEditingNote({ _id: note._id, note: note.note });
                                                        setIsNoteModalOpen(true);
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Edit Note"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm('Are you sure you want to delete this note?')) {
                                                            const updatedNotes = order.notes?.filter(n => n._id !== note._id) || [];
                                                            fetch(`/api/manufacturing/${order._id}`, {
                                                                method: 'PATCH',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ notes: updatedNotes })
                                                            }).then(res => {
                                                                if (res.ok) {
                                                                    res.json().then(data => setOrder(data));
                                                                    toast.success('Note deleted');
                                                                }
                                                            });
                                                        }
                                                    }}
                                                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                {editingItem._id ? 'Edit Item' : 'Add Line Item'}
                            </h3>
                            <button onClick={handleCloseEditModal} className="p-1 hover:bg-slate-100 rounded transition-colors">
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* SKU - editable if new, read-only if editing */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">SKU</label>
                                {editingItem._id ? (
                                    <div className="text-sm font-medium text-slate-700 bg-slate-50 px-3 py-2 rounded border border-slate-200">
                                        {typeof editingItem.sku === 'object' ? editingItem.sku.name : editingItem.sku || '-'}
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={skuSearch}
                                            onChange={e => {
                                                setSkuSearch(e.target.value);
                                                setIsSkuDropdownOpen(true);
                                            }}
                                            onFocus={() => setIsSkuDropdownOpen(true)}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                            placeholder="Search SKU..."
                                        />
                                        {isSkuDropdownOpen && skuSearch && (
                                            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-auto">
                                                {skuList
                                                    .filter(s => s.name.toLowerCase().includes(skuSearch.toLowerCase()) || s._id.toLowerCase().includes(skuSearch.toLowerCase()))
                                                    .slice(0, 20)
                                                    .map(s => (
                                                        <button
                                                            key={s._id}
                                                            type="button"
                                                            onClick={async () => {
                                                                setEditingItem({ ...editingItem, sku: s._id });
                                                                setSkuSearch(s.name);
                                                                setIsSkuDropdownOpen(false);
                                                                
                                                                // Auto-fetch oldest lot for this SKU
                                                                try {
                                                                    const res = await fetch(`/api/warehouse/skus/${s._id}/lots`);
                                                                    if (res.ok) {
                                                                        const data = await res.json();
                                                                        // Get oldest lot with positive balance (sorted by date ascending)
                                                                        const lotsWithBalance = (data.lots || [])
                                                                            .filter((l: any) => l.balance > 0)
                                                                            .sort((a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
                                                                        if (lotsWithBalance.length > 0) {
                                                                            setEditingItem(prev => prev ? { 
                                                                                ...prev, 
                                                                                sku: s._id, 
                                                                                lotNumber: lotsWithBalance[0].lotNumber,
                                                                                cost: lotsWithBalance[0].cost || 0
                                                                            } : prev);
                                                                        }
                                                                    }
                                                                } catch (e) {
                                                                    // Silently fail - user can still select lot manually
                                                                }
                                                            }}
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                                                        >
                                                            <span className="font-medium">{s.name}</span>
                                                            <span className="text-xs text-slate-400 ml-2">({s._id})</span>
                                                        </button>
                                                    ))}
                                                {skuList.filter(s => s.name.toLowerCase().includes(skuSearch.toLowerCase()) || s._id.toLowerCase().includes(skuSearch.toLowerCase())).length === 0 && (
                                                    <div className="px-3 py-2 text-sm text-slate-400">No SKUs found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            
                            {/* Lot Number */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Lot Number</label>
                                <div className="flex space-x-2">
                                    <input
                                        type="text"
                                        value={editingItem.lotNumber || ''}
                                        onChange={e => setEditingItem({ ...editingItem, lotNumber: e.target.value })}
                                        className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        placeholder="Enter or select lot..."
                                    />
                                    {(editingItem.sku && (typeof editingItem.sku === 'string' ? editingItem.sku : editingItem.sku._id)) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingSkuId(typeof editingItem.sku === 'object' ? editingItem.sku._id : editingItem.sku as string);
                                                setIsAddLotModalOpen(true);
                                            }}
                                            className="px-3 py-2 text-xs font-bold uppercase bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors rounded"
                                        >
                                            Select Lot
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Recipe Qty */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Recipe Qty</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.recipeQty || ''}
                                        onChange={e => setEditingItem({ ...editingItem, recipeQty: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>

                                {/* UOM */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">UOM</label>
                                    <input
                                        type="text"
                                        value={editingItem.uom || ''}
                                        onChange={e => setEditingItem({ ...editingItem, uom: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                {/* Assay (%) */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Assay (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.sa || ''}
                                        onChange={e => setEditingItem({ ...editingItem, sa: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        placeholder="e.g., 55.6"
                                    />
                                </div>

                                {/* Qty Extra (Calculated - Read Only) */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Qty Extra <span className="text-slate-300 normal-case">(calc)</span></label>
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
                                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded bg-slate-50 text-slate-500 cursor-not-allowed"
                                            />
                                        );
                                    })()}
                                </div>

                                {/* Qty Scrapped */}
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Qty Scrapped</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.qtyScrapped || ''}
                                        onChange={e => setEditingItem({ ...editingItem, qtyScrapped: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={handleCloseEditModal}
                                className="px-4 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveItem}
                                className="px-4 py-2 text-xs font-bold uppercase bg-black text-white hover:bg-slate-800 transition-colors rounded"
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                {editingNote._id ? 'Edit Note' : 'Add Note'}
                            </h3>
                            <button onClick={() => setIsNoteModalOpen(false)} className="p-1 hover:bg-slate-100 rounded transition-colors">
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Note</label>
                                <textarea
                                    rows={4}
                                    value={editingNote.note}
                                    onChange={e => setEditingNote({ ...editingNote, note: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10 resize-none"
                                    placeholder="Enter your note..."
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setIsNoteModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 transition-colors"
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
                                className="px-4 py-2 text-xs font-bold uppercase bg-black text-white hover:bg-slate-800 transition-colors rounded"
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
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                                {editingLabor._id ? 'Edit Labor' : 'Add Labor'}
                            </h3>
                            <button onClick={() => setIsLaborModalOpen(false)} className="p-1 hover:bg-slate-100 rounded transition-colors">
                                <X className="w-4 h-4 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Type Dropdown */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Type</label>
                                <select
                                    value={editingLabor.type}
                                    onChange={e => setEditingLabor({ ...editingLabor, type: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10 bg-white"
                                >
                                    <option value="WO Labor">WO Labor</option>
                                    <option value="Maintenance & Preparation">Maintenance & Preparation</option>
                                </select>
                            </div>

                            {/* User Dropdown */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">User</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={userSearch}
                                        onChange={e => {
                                            setUserSearch(e.target.value);
                                            setIsUserDropdownOpen(true);
                                        }}
                                        onFocus={() => setIsUserDropdownOpen(true)}
                                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        placeholder="Search user..."
                                    />
                                    {isUserDropdownOpen && (
                                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-auto">
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
                                                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                                                    >
                                                        <span className="font-medium">{u.firstName} {u.lastName}</span>
                                                    </button>
                                                ))}
                                            {usersList.filter(u => `${u.firstName} ${u.lastName}`.toLowerCase().includes(userSearch.toLowerCase())).length === 0 && (
                                                <div className="px-3 py-2 text-sm text-slate-400">No users found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Duration and Hourly Rate - only show when editing */}
                            {editingLabor._id && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Duration (HH:MM:SS)</label>
                                        <input
                                            type="text"
                                            value={editingLabor.duration}
                                            onChange={e => setEditingLabor({ ...editingLabor, duration: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                            placeholder="0:30:00"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Hourly Rate ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editingLabor.hourlyRate || ''}
                                            onChange={e => setEditingLabor({ ...editingLabor, hourlyRate: parseFloat(e.target.value) || 0 })}
                                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-black/10"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button
                                onClick={() => setIsLaborModalOpen(false)}
                                className="px-4 py-2 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 transition-colors"
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
                                className="px-4 py-2 text-xs font-bold uppercase bg-black text-white hover:bg-slate-800 transition-colors rounded"
                            >
                                {editingLabor._id ? 'Save Changes' : 'Add Labor'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Shell Footer */}
            <div className="h-[24px] border-t border-slate-200 bg-slate-100/50 shrink-0 flex items-center justify-between px-4 z-[50]">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">System Ready</span>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">Manufacturing Shell v2.1</span>
                    <span className="text-[9px] text-slate-400 font-mono uppercase tracking-tighter">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                </div>
            </div>
        </div>
    );
}
