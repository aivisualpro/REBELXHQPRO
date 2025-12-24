'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Package, Calendar, CreditCard, Truck, Plus, X, Trash2, Pencil, User, MapPin, DollarSign, List, RefreshCw } from 'lucide-react';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';

interface LineItem {
  _id: string;
  sku: { _id: string; name: string } | string;
  lotNumber: string;
  qtyShipped: number;
  uom: string;
  price: number;
  total: number;
  cost?: number;
}

interface Payment {
  _id: string;
  orderNumber: string;
  paymentAmount: number;
  createdAt: string;
  createdBy: string;
}

interface SaleOrder {
  _id: string;
  label: string;
  clientId: { _id: string; name: string } | string;
  salesRep: string;
  paymentMethod: string;
  orderStatus: string;
  createdAt: string;
  shippedDate?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  shippingCost?: number;
  tax?: number;
  discount?: number;
  shippingAddress?: string;
  city?: string;
  state?: string;
  lineItems?: LineItem[];
  payments?: Payment[];
}

const UOM_OPTIONS = [
    { label: 'Each', value: 'Each' },
    { label: 'Box', value: 'Box' },
    { label: 'Case', value: 'Case' },
    { label: 'Pack', value: 'Pack' },
    { label: 'Pair', value: 'Pair' },
    { label: 'Set', value: 'Set' },
    { label: 'Kg', value: 'Kg' },
    { label: 'Lb', value: 'Lb' },
];

const TABS = ['Line Items', 'Payments'] as const;
type TabType = typeof TABS[number];

export default function SaleOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [order, setOrder] = useState<SaleOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('Line Items');

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [allSkus, setAllSkus] = useState<{ _id: string; name: string, salePrice?: number }[]>([]);

  // Lot Selection State
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [editingLotItemId, setEditingLotItemId] = useState<string | null>(null);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<any>(null);

  // Item Lot Selection State (Nested Modal)
  const [isItemLotModalOpen, setIsItemLotModalOpen] = useState(false);

  // Refresh Costs State
  const [isRefreshingCosts, setIsRefreshingCosts] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');

  const fetchOrder = async () => {
      try {
          const res = await fetch(`/api/wholesale/orders/${params.id}`);
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
      if (params.id) fetchOrder();
  }, [params.id]);

  useEffect(() => {
      fetch('/api/skus?limit=1000')
          .then(res => res.json())
          .then(data => setAllSkus(data.skus || []))
          .catch(() => {});
  }, []);

  // Fetch users for name lookup
  const [allUsers, setAllUsers] = useState<{ _id: string; email: string; firstName?: string; lastName?: string }[]>([]);
  useEffect(() => {
      fetch('/api/users?limit=1000')
          .then(res => res.json())
          .then(data => setAllUsers(data.users || []))
          .catch(() => {});
  }, []);

  // Helper to get user name from email
  const getUserName = (emailOrId: string) => {
      if (!emailOrId) return '-';
      const user = allUsers.find(u => u.email === emailOrId || u._id === emailOrId);
      if (user && (user.firstName || user.lastName)) {
          return `${user.firstName || ''} ${user.lastName || ''}`.trim();
      }
      return emailOrId;
  };

  // Calculations
  const totalQty = order?.lineItems?.reduce((sum, item) => sum + (item.qtyShipped || 0), 0) || 0;
  const subtotal = order?.lineItems?.reduce((sum, item) => sum + ((item.qtyShipped || 0) * (item.price || 0)), 0) || 0;
  const grandTotal = subtotal + (order?.shippingCost || 0) - (order?.discount || 0);
  const totalPayments = order?.payments?.reduce((sum, p) => sum + (p.paymentAmount || 0), 0) || 0;
  const balance = grandTotal - totalPayments;

  const formatDate = (dateStr?: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const formatCurrency = (val?: number) => {
      if (val === undefined || val === null) return '-';
      return '$' + val.toFixed(2);
  };

  const renderClient = (val: any) => {
      if (typeof val === 'object' && val !== null) return val.name;
      return val || '-';
  };

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'Completed': return "bg-emerald-50 text-emerald-600 border-emerald-100";
          case 'Shipped': return "bg-blue-50 text-blue-600 border-blue-100";
          case 'Processing': return "bg-orange-50 text-orange-600 border-orange-100";
          case 'Cancelled': return "bg-red-50 text-red-600 border-red-100";
          default: return "bg-slate-100 text-slate-500 border-slate-200";
      }
  };

  const handleStatusChange = async (newStatus: string) => {
      if (!order) return;
      try {
          const res = await fetch(`/api/wholesale/orders/${order._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderStatus: newStatus })
          });
          if (res.ok) {
              const data = await res.json();
              setOrder(data);
              toast.success('Status updated');
          }
      } catch (e) {
          toast.error('Failed to update status');
      }
  };

  // Item Handlers
  const handleSaveItem = async () => {
      if (!order || !editingItem) return;
      
      let updatedItems;
      if (editingItem._id) {
          updatedItems = order.lineItems?.map(item => 
              item._id === editingItem._id ? editingItem : item
          ) || [];
      } else {
          updatedItems = [...(order.lineItems || []), { ...editingItem, _id: Date.now().toString() }];
      }

      try {
          const res = await fetch(`/api/wholesale/orders/${order._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineItems: updatedItems.map(i => ({
                  ...i,
                  sku: typeof i.sku === 'object' ? i.sku._id : i.sku
              })) })
          });
          if (res.ok) {
              const data = await res.json();
              setOrder(data);
              toast.success(editingItem._id ? 'Item updated' : 'Item added');
              setIsItemModalOpen(false);
          }
      } catch (e) {
          toast.error('Failed to save item');
      }
  };

  const handleDeleteItem = async (itemId: string) => {
      if (!order || !window.confirm('Delete this item?')) return;
      const updatedItems = order.lineItems?.filter(i => i._id !== itemId).map(i => ({
          ...i,
          sku: typeof i.sku === 'object' ? i.sku._id : i.sku
      })) || [];

      try {
          const res = await fetch(`/api/wholesale/orders/${order._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineItems: updatedItems })
          });
          if (res.ok) {
              const data = await res.json();
              setOrder(data);
              toast.success('Item deleted');
          }
      } catch (e) {
          toast.error('Failed to delete');
      }
  };

  // Lot Selection
  const handleEditLot = (itemId: string, skuId: string) => {
      setEditingLotItemId(itemId);
      setEditingSkuId(skuId);
      setIsLotModalOpen(true);
  };

  const handleLotSelect = async (lotNumber: string, cost?: number) => {
      if (!order || !editingLotItemId) return;
      const updatedItems = order.lineItems?.map(item => 
          item._id === editingLotItemId 
              ? { ...item, lotNumber, cost: cost || 0, sku: typeof item.sku === 'object' ? item.sku._id : item.sku } 
              : { ...item, sku: typeof item.sku === 'object' ? item.sku._id : item.sku }
      ) || [];

      try {
          const res = await fetch(`/api/wholesale/orders/${order._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineItems: updatedItems })
          });
          if (res.ok) {
              const data = await res.json();
              setOrder(data);
              toast.success('Lot updated');
              setIsLotModalOpen(false);
          }
      } catch (e) {
          toast.error('Failed to update lot');
      }
  };

  // Payment Handlers
  const handleSavePayment = async () => {
      if (!order || !editingPayment) return;
      
      let updatedPayments;
      if (editingPayment._id) {
          updatedPayments = order.payments?.map(p => p._id === editingPayment._id ? editingPayment : p) || [];
      } else {
          // Auto-set createdBy from session and createdAt if not set
          const newPayment = {
              ...editingPayment,
              _id: Date.now().toString(),
              orderNumber: order.label,
              createdBy: session?.user?.email || '',
              createdAt: editingPayment.createdAt || new Date().toISOString().split('T')[0]
          };
          updatedPayments = [...(order.payments || []), newPayment];
      }

      try {
          const res = await fetch(`/api/wholesale/orders/${order._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payments: updatedPayments })
          });
          if (res.ok) {
              const data = await res.json();
              setOrder(data);
              toast.success(editingPayment._id ? 'Payment updated' : 'Payment added');
              setIsPaymentModalOpen(false);
          }
      } catch (e) {
          toast.error('Failed to save payment');
      }
  };

  const handleDeletePayment = async (paymentId: string) => {
      if (!order || !window.confirm('Delete this payment?')) return;
      const updatedPayments = order.payments?.filter(p => p._id !== paymentId) || [];

      try {
          const res = await fetch(`/api/wholesale/orders/${order._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ payments: updatedPayments })
          });
          if (res.ok) {
              const data = await res.json();
              setOrder(data);
              toast.success('Payment deleted');
          }
      } catch (e) {
          toast.error('Failed to delete');
      }
  };

  const handleRefreshCosts = async () => {
    if (!order || !order.lineItems || order.lineItems.length === 0) return;
    
    setIsRefreshingCosts(true);
    setRefreshProgress('Preparing...');
    
    const updatedItems = [...order.lineItems];
    let changedCount = 0;

    for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        const skuId = typeof item.sku === 'object' ? item.sku._id : item.sku;
        
        if (skuId && item.lotNumber) {
            setRefreshProgress(`Fetching Lot ${item.lotNumber}... ${Math.round(((i + 1) / updatedItems.length) * 100)}%`);
            try {
                // Use the same API as the Lot Selection Modal to ensure consistency
                const res = await fetch(`/api/warehouse/skus/${skuId}/lots`);

                if (res.ok) {
                    const data = await res.json();
                    const matchedLot = data.lots?.find((l: any) => l.lotNumber === item.lotNumber);
                    
                    if (matchedLot && matchedLot.cost !== undefined) {
                        // Update cost. Note: We only update cost, price remains as is unless you want to update price too?
                        // User request: "refresh all costs ... showing what is happening"
                        // Assuming they want to update the internal 'cost' tracking, not necessarily the sales 'price'.
                        // However, the previous logic updated 'cost'.
                        const currentCost = item.cost || 0;
                        if (currentCost !== matchedLot.cost) {
                            updatedItems[i] = { ...item, cost: matchedLot.cost };
                            changedCount++;
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch cost for item", i, error);
            }
        }
    }

    // Save changes to backend
    if (changedCount > 0) {
        setRefreshProgress('Saving changes...');
        try {
            const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    lineItems: updatedItems.map(i => ({
                        ...i,
                        sku: typeof i.sku === 'object' ? i.sku._id : i.sku
                    })) 
                })
            });
            if (res.ok) {
                const data = await res.json();
                setOrder(data);
                toast.success(`Updated costs for ${changedCount} items`);
            } else {
                toast.error("Failed to save updated costs");
            }
        } catch(e) {
            toast.error("Error saving updated costs");
        }
    } else {
        toast('No costs needed updating');
    }
    
    setIsRefreshingCosts(false);
    setRefreshProgress('');
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
              <div className="text-sm text-slate-400">Loading...</div>
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

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
        {/* Header Row: Breadcrumb + Back */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
            <div className="flex items-center space-x-2 text-sm">
                <button onClick={() => router.push('/sales/wholesale-orders')} className="text-slate-500 hover:text-black transition-colors">
                    Wholesale Orders
                </button>
                <span className="text-slate-300">/</span>
                <span className="font-bold text-slate-900">{order.label || order._id}</span>
            </div>
            <button onClick={() => router.back()} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold uppercase text-slate-500 hover:text-black hover:bg-slate-100 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
            </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar: Details (30%) */}
            <div className="w-[30%] border-r border-slate-200 bg-slate-50/30 overflow-y-auto p-6 space-y-6">
                {/* Status Chip */}
                <div className="flex items-center gap-2">
                    <select
                        value={order.orderStatus}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className={cn(
                            "px-2 py-1 text-[9px] font-black uppercase tracking-widest border rounded-none cursor-pointer outline-none appearance-none",
                            getStatusColor(order.orderStatus)
                        )}
                    >
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                    </select>
                </div>

                {/* Order Header */}
                <div>
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="w-14 h-14 bg-white border border-slate-200 flex items-center justify-center p-1 shadow-sm shrink-0">
                            <Package className="w-6 h-6 text-slate-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">Order #{order.label}</h1>
                            <p className="text-[11px] text-slate-400 uppercase tracking-widest mt-1">{renderClient(order.clientId)}</p>
                        </div>
                    </div>

                    {/* Info Rows */}
                    <div className="space-y-6">
                        {/* Quantity Section */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold italic">Total Qty</div>
                                    <div className="text-lg font-black text-slate-900">{totalQty} <span className="text-[10px] text-slate-400 font-bold uppercase">Items</span></div>
                                </div>
                                <div>
                                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1 font-bold italic">Order Total</div>
                                    <div className="text-lg font-black text-slate-900">{formatCurrency(grandTotal)}</div>
                                </div>
                            </div>
                            <div className="bg-black/5 p-3 flex justify-between items-center">
                                <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Balance Due</div>
                                <div className={cn("text-lg font-black", balance > 0 ? "text-red-600" : "text-emerald-600")}>
                                    {formatCurrency(balance)}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Order Date</div>
                                <div className="text-xs font-medium text-slate-700">{formatDate(order.createdAt)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Shipped Date</div>
                                <div className="text-xs font-medium text-slate-700">{formatDate(order.shippedDate)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Payment Method</div>
                                <div className="text-xs font-medium text-slate-700">{order.paymentMethod || '-'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Ship Via</div>
                                <div className="text-xs font-medium text-slate-700">{order.shippingMethod || '-'}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Sales Rep</div>
                                <div className="text-xs font-medium text-slate-700">{getUserName(order.salesRep)}</div>
                            </div>
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Tracking</div>
                                <div className="text-xs font-medium text-slate-700">{order.trackingNumber || '-'}</div>
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5 font-bold italic">Shipping Address</div>
                            <div className="text-xs font-medium text-slate-700">{order.shippingAddress || '-'}</div>
                            <div className="text-xs text-slate-500">{order.city}, {order.state}</div>
                        </div>
                    </div>
                </div>

                {/* Payment Summary */}
                <div>
                    <h3 className="text-xs font-bold uppercase text-slate-900 tracking-widest mb-4 border-b border-slate-200 pb-2">Payment Summary</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">Subtotal</span>
                            <span className="text-sm font-mono font-medium text-slate-700">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">Shipping</span>
                            <span className="text-sm font-mono font-medium text-slate-700">{formatCurrency(order.shippingCost || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">Discount</span>
                            <span className="text-sm font-mono font-medium text-red-500">-{formatCurrency(order.discount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center group pt-1 border-t border-slate-100">
                            <span className="text-sm text-slate-700 font-bold">Order Total</span>
                            <span className="text-sm font-mono font-bold text-slate-900">{formatCurrency(grandTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-slate-500 group-hover:text-slate-900 transition-colors">Payments Received</span>
                            <span className="text-sm font-mono font-medium text-emerald-600">{formatCurrency(totalPayments)}</span>
                        </div>
                        <div className="pt-3 mt-3 border-t border-slate-200 flex justify-between items-center">
                            <span className="text-sm font-bold text-slate-900 uppercase tracking-wider">Balance</span>
                            <span className={cn("text-base font-mono font-bold", balance > 0 ? "text-red-600" : "text-emerald-600")}>
                                {formatCurrency(balance)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Content: Tabs (70%) */}
            <div className="w-[70%] bg-white flex flex-col overflow-hidden">
                {/* Tabs & Actions */}
                <div className="px-6 border-b border-slate-100 shrink-0 flex items-center justify-between bg-white z-10">
                    <div className="flex space-x-1">
                        {TABS.map(tab => (
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
                                <span className={cn(
                                    "px-1.5 py-0.5 rounded-none text-[9px] font-bold",
                                    activeTab === tab ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"
                                )}>
                                    {tab === 'Line Items' ? order.lineItems?.length || 0 : order.payments?.length || 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Inline Actions */}
                    <div className="flex items-center space-x-2">
                        {activeTab === 'Line Items' && (
                            <>
                                {isRefreshingCosts && (
                                    <span className="text-[10px] text-blue-600 font-mono animate-pulse font-bold">{refreshProgress}</span>
                                )}
                                <button
                                    onClick={handleRefreshCosts}
                                    disabled={isRefreshingCosts || !order || !order.lineItems || order.lineItems.length === 0}
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100 hover:text-black transition-colors flex items-center space-x-1 shadow-sm disabled:opacity-50"
                                    title="Refresh Costs from Lot #"
                                >
                                    <RefreshCw className={cn("w-3 h-3", isRefreshingCosts && "animate-spin")} />
                                    <span className="hidden sm:inline">Sync</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingItem({ sku: '', lotNumber: '', qtyShipped: 1, price: 0, uom: 'Each' });
                                        setIsItemModalOpen(true);
                                    }}
                                    className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-black text-white hover:bg-slate-800 transition-colors flex items-center space-x-1 shadow-sm"
                                >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Item</span>
                                </button>
                            </>
                        )}
                        {activeTab === 'Payments' && (
                            <button
                                onClick={() => {
                                    setEditingPayment({ paymentAmount: 0, createdAt: new Date().toISOString().split('T')[0], createdBy: '' });
                                    setIsPaymentModalOpen(true);
                                }}
                                className="px-2 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center space-x-1 shadow-sm"
                            >
                                <Plus className="w-3 h-3" />
                                <span>Add Payment</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto">
                    {activeTab === 'Line Items' && (
                        <div className="animate-in fade-in duration-300">
                            <table className="w-full border-collapse text-left">
                                <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                    <tr>
                                        {['SKU', 'Lot #', 'UOM', 'Qty', 'Cost', 'Price', 'Total', 'Actions'].map(col => (
                                            <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(!order.lineItems || order.lineItems.length === 0) ? (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">No line items</td>
                                        </tr>
                                    ) : order.lineItems.map(item => {
                                        const skuName = typeof item.sku === 'object' ? item.sku?.name : allSkus.find(s => s._id === item.sku)?.name || item.sku;
                                        const lineTotal = (item.qtyShipped || 0) * (item.price || 0);
                                        const skuId = typeof item.sku === 'object' ? item.sku._id : item.sku;

                                        return (
                                            <tr key={item._id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-1.5 text-[10px] text-slate-700">
                                                    <span 
                                                        onClick={() => router.push(`/warehouse/skus/${skuId}`)}
                                                        className="hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                                                    >
                                                        {skuName || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-[10px] text-slate-500 group">
                                                    <div className="flex items-center gap-1">
                                                        <span>{item.lotNumber || '-'}</span>
                                                        <button 
                                                            onClick={() => handleEditLot(item._id, skuId)}
                                                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-500 transition-all p-0.5"
                                                            title="Edit Lot #"
                                                        >
                                                            <Pencil className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-[9px] uppercase text-slate-400">{item.uom || '-'}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-slate-500 font-mono">{item.qtyShipped}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-orange-600 font-mono">{formatCurrency(item.cost)}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-slate-500 font-mono">{formatCurrency(item.price)}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-slate-700 font-mono bg-slate-50/30">{formatCurrency(lineTotal)}</td>
                                                <td className="px-3 py-1.5">
                                                    <div className="flex items-center space-x-1">
                                                        <button 
                                                            onClick={() => {
                                                                setEditingItem({
                                                                    ...item,
                                                                    sku: skuId
                                                                });
                                                                setIsItemModalOpen(true);
                                                            }}
                                                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteItem(item._id)}
                                                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {order.lineItems && order.lineItems.length > 0 && (
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={3} className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase text-right">Subtotal</td>
                                            <td className="px-3 py-1.5 text-[10px] font-bold text-slate-700">{totalQty}</td>
                                            <td className="px-3 py-1.5"></td>
                                            <td className="px-3 py-1.5"></td>
                                            <td className="px-3 py-1.5 text-[10px] font-black text-slate-900">{formatCurrency(subtotal)}</td>
                                            <td className="px-3 py-1.5"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}

                    {activeTab === 'Payments' && (
                        <div className="animate-in fade-in duration-300">
                            <table className="w-full border-collapse text-left">
                                <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20">
                                    <tr>
                                        {['Date', 'Amount', 'Created By', 'Actions'].map(col => (
                                            <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(!order.payments || order.payments.length === 0) ? (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">No payments recorded</td>
                                        </tr>
                                    ) : order.payments.map(payment => (
                                        <tr key={payment._id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-1.5 text-[10px] text-slate-500 font-mono">{formatDate(payment.createdAt)}</td>
                                            <td className="px-3 py-1.5 text-[10px] text-emerald-600 font-mono font-bold">{formatCurrency(payment.paymentAmount)}</td>
                                            <td className="px-3 py-1.5 text-[10px] text-slate-500">{getUserName(payment.createdBy)}</td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center space-x-1">
                                                    <button 
                                                        onClick={() => {
                                                            setEditingPayment({
                                                                ...payment,
                                                                createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString().split('T')[0] : ''
                                                            });
                                                            setIsPaymentModalOpen(true);
                                                        }}
                                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeletePayment(payment._id)}
                                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {order.payments && order.payments.length > 0 && (
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase">Total</td>
                                            <td className="px-3 py-1.5 text-[10px] font-black text-emerald-600">{formatCurrency(totalPayments)}</td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Item Modal */}
        {isItemModalOpen && editingItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-sm font-bold uppercase text-slate-900">{editingItem._id ? 'Edit Item' : 'Add Item'}</h2>
                        <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-black">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">SKU</label>
                            <SearchableSelect
                                options={allSkus.map(s => ({ value: s._id, label: s.name }))}
                                value={editingItem.sku}
                                onChange={async (val) => {
                                    const sku = allSkus.find(s => s._id === val);
                                    // 1. Update SKU and Price
                                    setEditingItem((prev: any) => ({ 
                                        ...prev, 
                                        sku: val, 
                                        price: sku?.salePrice || prev.price,
                                        lotNumber: '' // Reset lot on SKU change
                                    }));
                                    
                                    // 2. Auto-Suggest Lot (FIFO: Oldest with Balance > 0)
                                    if (val) {
                                        try {
                                            const res = await fetch(`/api/warehouse/skus/${val}/lots`);
                                            if (res.ok) {
                                                const data = await res.json();
                                                const lots = data.lots || [];
                                                // Sort by Date (Oldest First)
                                                // Assuming 'date' is ISO string
                                                const sorted = lots.sort((a: any, b: any) => {
                                                    const dateA = a.date ? new Date(a.date).getTime() : 0;
                                                    const dateB = b.date ? new Date(b.date).getTime() : 0;
                                                    return dateA - dateB;
                                                });
                                                
                                                // Find first with positive balance
                                                const suggested = sorted.find((l: any) => l.balance > 0);
                                                
                                                if (suggested) {
                                                    setEditingItem((prev: any) => ({ 
                                                        ...prev, 
                                                        sku: val, // Ensure SKU is set (async race condition safety)
                                                        lotNumber: suggested.lotNumber,
                                                        cost: suggested.cost || 0
                                                    }));
                                                    toast.success(`Auto-selected Lot: ${suggested.lotNumber}`, { position: 'bottom-center', duration: 2000 });
                                                }
                                            }
                                        } catch(e) {
                                            console.error("Auto-suggest lot failed", e);
                                        }
                                    }
                                }}
                                placeholder="Select SKU..."
                            />
                        </div>

                        {/* Nested Lot Selection Modal for Item Modal */}
                        {isItemLotModalOpen && editingItem?.sku && (
                            <LotSelectionModal
                                isOpen={isItemLotModalOpen}
                                onClose={() => setIsItemLotModalOpen(false)}
                                skuId={typeof editingItem.sku === 'object' ? editingItem.sku._id : editingItem.sku}
                                currentLotNumber={editingItem.lotNumber}
                                onSelect={(lotNumber, cost) => {
                                    setEditingItem((prev: any) => ({ ...prev, lotNumber, cost: cost || prev.cost }));
                                    setIsItemLotModalOpen(false);
                                }}
                                title="Select Lot Number"
                            />
                        )}
                        <div className="grid grid-cols-2 gap-4">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Lot #</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    readOnly
                                    value={editingItem.lotNumber || ''}
                                    onClick={() => {
                                        if (editingItem.sku) setIsItemLotModalOpen(true);
                                        else toast.error('Please select a SKU first');
                                    }}
                                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none cursor-pointer hover:bg-slate-50"
                                    placeholder={editingItem.sku ? "Select Lot..." : "Select SKU first"}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                    <List className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">UOM</label>
                                <SearchableSelect
                                    options={UOM_OPTIONS}
                                    value={editingItem.uom || 'Each'}
                                    onChange={(val) => setEditingItem({ ...editingItem, uom: val })}
                                    creatable
                                />
                            </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Qty</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={editingItem.qtyShipped || 1}
                                    onChange={(e) => setEditingItem({ ...editingItem, qtyShipped: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Price</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.price || 0}
                                        onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-6 pr-3 py-2 border border-slate-200 rounded text-sm focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <button onClick={handleSaveItem} className="w-full py-2.5 bg-black text-white text-xs font-bold uppercase rounded hover:bg-slate-800 transition-colors">
                            {editingItem._id ? 'Save Changes' : 'Add Item'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Payment Modal */}
        {isPaymentModalOpen && editingPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-green-50/50">
                        <h2 className="text-sm font-bold uppercase text-slate-900">{editingPayment._id ? 'Edit Payment' : 'Add Payment'}</h2>
                        <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-black">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingPayment.paymentAmount || ''}
                                    onChange={(e) => setEditingPayment({ ...editingPayment, paymentAmount: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-7 pr-3 py-2 border border-slate-200 rounded text-sm focus:outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Date</label>
                            <input
                                type="date"
                                value={editingPayment.createdAt || ''}
                                onChange={(e) => setEditingPayment({ ...editingPayment, createdAt: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none"
                            />
                        </div>
                        <button onClick={handleSavePayment} className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold uppercase rounded hover:bg-emerald-700 transition-colors">
                            {editingPayment._id ? 'Save Changes' : 'Add Payment'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Lot Selection Modal */}
        <LotSelectionModal 
            isOpen={isLotModalOpen}
            onClose={() => {
                setIsLotModalOpen(false);
                setEditingLotItemId(null);
                setEditingSkuId(null);
            }}
            onSelect={handleLotSelect}
            skuId={editingSkuId || ''}
            currentLotNumber={order?.lineItems?.find(i => i._id === editingLotItemId)?.lotNumber || ''}
        />
    </div>
  );
}
