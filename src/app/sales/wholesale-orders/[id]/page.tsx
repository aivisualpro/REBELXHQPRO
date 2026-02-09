'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Calendar, CreditCard, Truck, Plus, X, Trash2, Pencil, User, MapPin, DollarSign, List, RefreshCw, MessageSquare } from 'lucide-react';
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
  productDescription?: string;
}

interface Payment {
  _id: string;
  orderNumber: string;
  paymentAmount: number;
  createdAt: string;
  createdBy: string;
}

interface Note {
  _id: string;
  legacyId?: string;
  note: string;
  createdBy: string;
  createdAt: string;
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
  notes?: Note[];
}

const PAYMENT_METHODS = [
    { label: 'Cash', value: 'Cash' },
    { label: 'Credit Card', value: 'Credit Card' },
    { label: 'Check By Mail', value: 'Check By Mail' },
    { label: 'ACH', value: 'ACH' },
    { label: 'Nothing Due', value: 'Nothing Due' },
    { label: 'CC#', value: 'CC#' },
    { label: 'Mobile Check Deposit', value: 'Mobile Check Deposit' },
    { label: 'Auth Payment Link', value: 'Auth Payment Link' },
    { label: 'COD Check', value: 'COD Check' },
    { label: 'COD', value: 'COD' },
    { label: 'Consignment', value: 'Consignment' },
    { label: 'Net Terms', value: 'Net Terms' }
];

const SHIPPING_METHODS = [
    { label: 'FedEx', value: 'FedEx' },
    { label: 'UPS', value: 'UPS' },
    { label: 'USPS', value: 'USPS' },
    { label: 'DHL', value: 'DHL' },
    { label: 'Pickup', value: 'Pickup' },
    { label: 'LTL Freight', value: 'LTL Freight' },
    { label: 'Courier', value: 'Courier' }
];

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

const TABS = ['Line Items', 'Payments', 'Notes'] as const;
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

  // Edit Header Modal State
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [editingHeader, setEditingHeader] = useState<any>(null);

  // Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');

  // Delete Order State
  const [isDeleting, setIsDeleting] = useState(false);

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

  const [headerPortal, setHeaderPortal] = useState<HTMLElement | null>(null);
  useEffect(() => {
      // Find the portal target after mount
      const target = document.getElementById('header-portal-target');
      if (target) setHeaderPortal(target);
  }, [loading]); // Retry when loading changes or on mount

  useEffect(() => {
      fetch('/api/skus?limit=5000')
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
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    };

    const formatCost = (val?: number) => {
        if (val === undefined || val === null) return '-';
        return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
    };

  const renderClient = (val: any) => {
      if (typeof val === 'object' && val !== null) return val.name;
      return val || '-';
  };

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'Completed': return "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-500/30";
          case 'Issued': return "bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border-sky-500/30";
          case 'Pending Payment': return "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30";
          case 'Shipping': return "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border-violet-500/30";
          case 'Picking': return "bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border-cyan-500/30";
          default: return "bg-secondary text-muted-foreground border-border";
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
      if (!order) return;
      toast((t) => (
          <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-white">Delete this item?</p>
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
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                      Delete
                  </button>
              </div>
          </div>
      ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
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
              ? { ...item, lotNumber, cost: cost || 0, sku: (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku } 
              : { ...item, sku: (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku }
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
      if (!order) return;
      toast((t) => (
          <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-white">Delete this payment?</p>
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
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-bold rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
                  >
                      Delete
                  </button>
              </div>
          </div>
      ), { duration: 10000, position: 'top-center', style: { maxWidth: '360px', background: '#1a1a1a', color: '#fff', marginTop: '40vh' } });
  };

  const handleSaveHeader = async () => {
    if (!order || !editingHeader) return;

    try {
        const res = await fetch(`/api/wholesale/orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editingHeader)
        });
        if (res.ok) {
            const data = await res.json();
            setOrder(data);
            toast.success('Order details updated');
            setIsHeaderModalOpen(false);
        }
    } catch (e) {
        toast.error('Failed to update order');
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
        const skuId = (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku;
        
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
          <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-background">
              <div className="text-sm text-muted-foreground">Loading...</div>
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

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-background relative">
        {/* Header Portal Content */}
        {headerPortal && order && createPortal(
            <>
                {/* Actions - Back, Edit, Delete */}
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => router.back()} 
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                    </button>
                    <button 
                        onClick={() => {
                            setEditingHeader({
                                salesRep: typeof order.salesRep === 'object' && order.salesRep ? (order.salesRep as any)._id : order.salesRep,
                                orderStatus: order.orderStatus,
                                paymentMethod: order.paymentMethod,
                                shippingMethod: order.shippingMethod,
                                trackingNumber: order.trackingNumber,
                                shippingCost: order.shippingCost,
                                discount: order.discount,
                                tax: order.tax,
                                shippedDate: order.shippedDate ? new Date(order.shippedDate).toISOString().split('T')[0] : '',
                                shippingAddress: order.shippingAddress,
                                city: order.city,
                                state: order.state
                            });
                            setIsHeaderModalOpen(true);
                        }}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                    </button>
                    <button 
                        onClick={() => {
                            toast((t) => (
                                <div className="flex flex-col gap-2">
                                    <p className="text-sm font-bold text-white">Delete this order?</p>
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
                                                    const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                                                        method: 'DELETE'
                                                    });
                                                    if (res.ok) {
                                                        toast.success('Order deleted');
                                                        router.push('/sales/wholesale-orders');
                                                    } else {
                                                        const data = await res.json();
                                                        toast.error(data.error || 'Failed to delete order');
                                                    }
                                                } catch (e) {
                                                    toast.error('Error deleting order');
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
                        }}
                        disabled={isDeleting}
                        className="flex items-center space-x-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer border border-red-500/30 text-red-500 hover:text-white hover:bg-red-600 disabled:opacity-50"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                    </button>
                </div>
            </>,
            headerPortal
        )}

        {/* Removed inline Header Row */}

        <div className="flex flex-1 overflow-hidden">
            {/* Left Sidebar: Details (30%) */}
            <div className="w-[30%] border-r border-border bg-secondary/30 overflow-y-auto p-4 space-y-4">
                {/* Identity Boxes */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="border border-border rounded-md p-3 bg-background text-center">
                        <div className="text-[11px] font-bold text-foreground">{order.label}</div>
                    </div>
                    <div className="border border-border rounded-md p-3 bg-background text-center">
                        <div className="text-[11px] font-bold text-foreground break-words">{renderClient(order.clientId)}</div>
                    </div>
                    <div className="border border-border rounded-md p-3 bg-background text-center flex items-center justify-center">
                        <select
                            value={order.orderStatus}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className={cn(
                                "text-[10px] font-black uppercase tracking-wider border rounded cursor-pointer outline-none appearance-none bg-transparent px-1 py-0.5 w-full text-center",
                                getStatusColor(order.orderStatus)
                            )}
                        >
                            <option value="Completed">Completed</option>
                            <option value="Issued">Issued</option>
                            <option value="Pending Payment">Pending</option>
                            <option value="Shipping">Shipping</option>
                            <option value="Picking">Picking</option>
                        </select>
                    </div>
                </div>

                {/* Details */}
                <div>

                    {/* Info Rows */}
                    <div className="space-y-6">

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Order Date</div>
                                <div className="text-xs font-medium text-foreground">{formatDate(order.createdAt)}</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Shipped Date</div>
                                <div className="text-xs font-medium text-foreground">{formatDate(order.shippedDate)}</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Payment Method</div>
                                <div className="text-xs font-medium text-foreground">{order.paymentMethod || '-'}</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Ship Via</div>
                                <div className="text-xs font-medium text-foreground">{order.shippingMethod || '-'}</div>
                            </div>
                            <div className="flex justify-between items-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Sales Rep</div>
                                <div className="text-xs font-medium text-foreground">{getUserName(order.salesRep)}</div>
                            </div>
                            {/* Tracking Card */}
                            {order.trackingNumber ? (
                              <div className="mt-1">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic mb-1.5">Tracking</div>
                                <a
                                  href={order.trackingNumber.startsWith('http') 
                                    ? order.trackingNumber 
                                    : `https://www.ups.com/track?loc=en_US&tracknum=${order.trackingNumber}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block group"
                                >
                                  <div className="border border-border rounded-md p-3 bg-background hover:border-amber-500/50 hover:shadow-sm transition-all cursor-pointer">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <div className="flex items-center space-x-2">
                                        <div className="w-5 h-5 bg-[#FFB500] rounded flex items-center justify-center shrink-0">
                                          <Truck className="w-3 h-3 text-[#351C15]" />
                                        </div>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">UPS Tracking</span>
                                      </div>
                                      <svg className="w-3 h-3 text-muted-foreground group-hover:text-amber-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </div>
                                    <div className="font-mono text-[11px] font-bold text-foreground tracking-wide break-all">
                                      {order.trackingNumber.startsWith('http') 
                                        ? (() => { try { return new URL(order.trackingNumber).searchParams.get('tracknum') || order.trackingNumber; } catch { return order.trackingNumber; }})()
                                        : order.trackingNumber}
                                    </div>
                                  </div>
                                </a>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold italic">Tracking</div>
                                <div className="text-xs font-medium text-foreground">-</div>
                              </div>
                            )}
                        </div>

                        {/* Address */}
                        <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5 font-bold italic">Shipping Address</div>
                            <div className="text-xs font-medium text-foreground">{order.shippingAddress || '-'}</div>
                            <div className="text-xs text-muted-foreground">{order.city}, {order.state}</div>
                        </div>
                    </div>
                </div>

                {/* Payment Summary */}
                <div>
                    <h3 className="text-xs font-bold uppercase text-foreground tracking-widest mb-4 border-b border-border pb-2">Payment Summary</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Subtotal</span>
                            <span className="text-sm font-mono font-medium text-foreground">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Shipping</span>
                            <span className="text-sm font-mono font-medium text-foreground">{formatCurrency(order.shippingCost || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Discount</span>
                            <span className="text-sm font-mono font-medium text-red-500">-{formatCurrency(order.discount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center group pt-1 border-t border-border">
                            <span className="text-sm text-foreground font-bold">Order Total</span>
                            <span className="text-sm font-mono font-bold text-foreground">{formatCurrency(grandTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Payments Received</span>
                            <span className="text-sm font-mono font-medium text-emerald-600">{formatCurrency(totalPayments)}</span>
                        </div>
                        <div className="pt-3 mt-3 border-t border-border flex justify-between items-center">
                            <span className="text-sm font-bold text-foreground uppercase tracking-wider">Balance</span>
                            <span className={cn("text-base font-mono font-bold", balance > 0 ? "text-red-600" : "text-emerald-600")}>
                                {formatCurrency(balance)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Content: Tabs (70%) */}
            <div className="w-[70%] bg-background flex flex-col overflow-hidden">
                {/* Tabs & Actions */}
                <div className="px-6 border-b border-border shrink-0 flex items-center justify-between bg-background z-10 h-9">
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
                                    {tab === 'Line Items' ? order.lineItems?.length || 0 : tab === 'Payments' ? order.payments?.length || 0 : order.notes?.length || 0}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Inline Actions */}
                    <div className="flex items-center space-x-2">
                        {activeTab === 'Line Items' && (
                            <>
                                <button
                                    onClick={() => {
                                        setEditingItem({ sku: '', lotNumber: '', qtyShipped: 1, price: 0, uom: 'Each' });
                                        setIsItemModalOpen(true);
                                    }}
                                    className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-amber-500 text-black hover:bg-amber-600 transition-colors flex items-center space-x-1 shadow-sm"
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
                                className="px-3 h-9 text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center space-x-1 shadow-sm"
                            >
                                <Plus className="w-3 h-3" />
                                <span>Add Payment</span>
                            </button>
                        )}
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
                    {activeTab === 'Line Items' && (
                        <div className="animate-in fade-in duration-300">
                            <table className="w-full border-collapse text-left">
                                <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                    <tr>
                                        {['SKU', 'Lot #', 'UOM', 'Qty', 'Cost', 'Price', 'Total', 'Actions'].map(col => (
                                            <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(!order.lineItems || order.lineItems.length === 0) ? (
                                        <tr>
                                            <td colSpan={8} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No line items</td>
                                        </tr>
                                    ) : order.lineItems.map(item => {
                                    const skuNameRaw = typeof item.sku === 'object' ? item.sku?.name : allSkus.find(s => s._id === item.sku)?.name || item.sku;
                                    const skuName = (skuNameRaw && skuNameRaw !== item.sku) ? skuNameRaw : (item.productDescription || skuNameRaw);
                                        const lineTotal = (item.qtyShipped || 0) * (item.price || 0);
                                        const skuId = (item.sku && typeof item.sku === 'object') ? item.sku._id : item.sku;

                                        return (
                                            <tr key={item._id} className="hover:bg-secondary/50 transition-colors">
                                                <td className="px-3 py-1.5 text-[10px] text-foreground">
                                                    <span 
                                                        onClick={() => router.push(`/warehouse/skus/${skuId}`)}
                                                        className="hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                                                    >
                                                        {skuName || '-'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-1.5 text-[10px] text-muted-foreground group">
                                                    <div className="flex items-center gap-1">
                                                        {item.lotNumber ? (
                                                            <Link 
                                                                href={`/warehouse/skus/${skuId}?lot=${encodeURIComponent(item.lotNumber)}`}
                                                                className="text-foreground font-mono hover:text-blue-600 hover:underline transition-colors"
                                                            >
                                                                {item.lotNumber}
                                                            </Link>
                                                        ) : (
                                                            <span>-</span>
                                                        )}
                                                        <button 
                                                            onClick={() => handleEditLot(item._id, skuId)}
                                                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-blue-500 transition-all p-0.5"
                                                            title="Edit Lot #"
                                                        >
                                                            <Pencil className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 text-[9px] uppercase text-muted-foreground">{item.uom || '-'}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{item.qtyShipped}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-orange-600 font-mono whitespace-nowrap">{formatCost(item.cost)}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{formatCurrency(item.price)}</td>
                                                <td className="px-3 py-1.5 text-[10px] text-foreground font-mono bg-secondary/20">{formatCurrency(lineTotal)}</td>
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
                                                            className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteItem(item._id)}
                                                            className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
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
                                    <tfoot className="bg-secondary border-t border-border">
                                        <tr>
                                            <td colSpan={3} className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase text-right">Subtotal</td>
                                            <td className="px-3 py-1.5 text-[10px] font-bold text-foreground">{totalQty}</td>
                                            <td className="px-3 py-1.5"></td>
                                            <td className="px-3 py-1.5"></td>
                                            <td className="px-3 py-1.5 text-[10px] font-black text-foreground">{formatCurrency(subtotal)}</td>
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
                                <thead className="bg-secondary/50 border-y border-border sticky top-0 z-20">
                                    <tr>
                                        {['Date', 'Amount', 'Created By', 'Actions'].map(col => (
                                            <th key={col} className="px-3 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(!order.payments || order.payments.length === 0) ? (
                                        <tr>
                                            <td colSpan={4} className="px-3 py-6 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No payments recorded</td>
                                        </tr>
                                    ) : order.payments.map(payment => (
                                        <tr key={payment._id} className="hover:bg-secondary/50 transition-colors">
                                            <td className="px-3 py-1.5 text-[10px] text-muted-foreground font-mono">{formatDate(payment.createdAt)}</td>
                                            <td className="px-3 py-1.5 text-[10px] text-emerald-600 font-mono font-bold">{formatCurrency(payment.paymentAmount)}</td>
                                            <td className="px-3 py-1.5 text-[10px] text-muted-foreground">{getUserName(payment.createdBy)}</td>
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
                                                        className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeletePayment(payment._id)}
                                                        className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {order.payments && order.payments.length > 0 && (
                                    <tfoot className="bg-secondary border-t border-border">
                                        <tr>
                                            <td className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase">Total</td>
                                            <td className="px-3 py-1.5 text-[10px] font-black text-emerald-600">{formatCurrency(totalPayments)}</td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}

                    {activeTab === 'Notes' && (
                        <div className="animate-in fade-in duration-300 p-4 space-y-3">
                            {(!order.notes || order.notes.length === 0) ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <MessageSquare className="w-8 h-8 text-muted-foreground/30 mb-2" />
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">No notes yet</p>
                                </div>
                            ) : (
                                order.notes.map(note => (
                                    <div key={note._id} className="border border-border rounded-md p-3 bg-secondary/20 hover:bg-secondary/40 transition-colors group">
                                        <div className="flex items-start justify-between">
                                            <p className="text-xs text-foreground whitespace-pre-wrap flex-1">{note.note}</p>
                                            <button
                                                onClick={() => {
                                                    toast((t) => (
                                                        <div className="flex flex-col gap-2">
                                                            <p className="text-sm font-bold text-white">Delete this note?</p>
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
                                                                            const updatedNotes = order.notes?.filter(n => n._id !== note._id) || [];
                                                                            const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                                                                                method: 'PATCH',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ notes: updatedNotes })
                                                                            });
                                                                            if (res.ok) {
                                                                                const data = await res.json();
                                                                                setOrder(data);
                                                                                toast.success('Note deleted');
                                                                            }
                                                                        } catch (e) {
                                                                            toast.error('Failed to delete note');
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
                                                className="p-1 text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <div className="flex items-center space-x-3 mt-2 pt-2 border-t border-border/50">
                                            <span className="text-[9px] text-muted-foreground font-mono">{note.createdAt ? new Date(note.createdAt).toLocaleDateString() : '-'}</span>
                                            <span className="text-[9px] text-muted-foreground">{getUserName(note.createdBy)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Item Modal */}
        {isItemModalOpen && editingItem && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-card rounded-lg shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/50">
                        <h2 className="text-sm font-bold uppercase text-foreground">{editingItem._id ? 'Edit Item' : 'Add Item'}</h2>
                        <button onClick={() => setIsItemModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">SKU</label>
                            <SearchableSelect
                                options={(() => {
                                    const opts = allSkus.map(s => ({ value: s._id, label: s.name }));
                                    // Add current value if missing (Legacy ID support)
                                    if (editingItem.sku && !allSkus.find(s => s._id === editingItem.sku)) {
                                        const label = editingItem.productDescription || editingItem.name || `Legacy: ${editingItem.sku}`;
                                        opts.push({ value: editingItem.sku, label });
                                    }
                                    return opts;
                                })()}
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
                            <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Lot #</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    readOnly
                                    value={editingItem.lotNumber || ''}
                                    onClick={() => {
                                        if (editingItem.sku) setIsItemLotModalOpen(true);
                                        else toast.error('Please select a SKU first');
                                    }}
                                    className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none cursor-pointer hover:bg-secondary"
                                    placeholder={editingItem.sku ? "Select Lot..." : "Select SKU first"}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                    <List className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">UOM</label>
                                <SearchableSelect
                                    options={UOM_OPTIONS}
                                    value={editingItem.uom || 'Each'}
                                    onChange={(val) => setEditingItem({ ...editingItem, uom: val })}
                                    creatable
                                />
                            </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Qty</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={editingItem.qtyShipped || 1}
                                    onChange={(e) => setEditingItem({ ...editingItem, qtyShipped: parseInt(e.target.value) || 0 })}
                                    className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Price</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editingItem.price || 0}
                                        onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-6 pr-3 py-2 border border-border rounded text-sm focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <button onClick={handleSaveItem} className="w-full py-2.5 bg-foreground text-background text-xs font-bold uppercase rounded hover:opacity-90 transition-colors">
                            {editingItem._id ? 'Save Changes' : 'Add Item'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Payment Modal */}
        {isPaymentModalOpen && editingPayment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-card rounded-lg shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-emerald-500/10">
                        <h2 className="text-sm font-bold uppercase text-foreground">{editingPayment._id ? 'Edit Payment' : 'Add Payment'}</h2>
                        <button onClick={() => setIsPaymentModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Amount</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editingPayment.paymentAmount || ''}
                                    onChange={(e) => setEditingPayment({ ...editingPayment, paymentAmount: parseFloat(e.target.value) || 0 })}
                                    className="w-full pl-7 pr-3 py-2 border border-border rounded text-sm focus:outline-none"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-foreground uppercase tracking-wider">Date</label>
                            <input
                                type="date"
                                value={editingPayment.createdAt || ''}
                                onChange={(e) => setEditingPayment({ ...editingPayment, createdAt: e.target.value })}
                                className="w-full px-3 py-2 border border-border rounded text-sm focus:outline-none"
                            />
                        </div>
                        <button onClick={handleSavePayment} className="w-full py-2.5 bg-emerald-600 text-white text-xs font-bold uppercase rounded hover:bg-emerald-700 transition-colors">
                            {editingPayment._id ? 'Save Changes' : 'Add Payment'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Edit Header Modal */}
        {isHeaderModalOpen && editingHeader && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-card rounded-none shadow-2xl w-full max-w-4xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-6 border-b border-border bg-muted/50 shrink-0 h-9">
                        <h2 className="text-sm font-bold uppercase text-foreground">Edit Order Details</h2>
                        <button onClick={() => setIsHeaderModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto p-4 scrollbar-custom bg-background">
                        <div className="space-y-6">
                            {/* Order Details Section */}
                            <div>
                                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Order Details</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Order Name/ID</label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={order?.label || ''}
                                            className="w-full h-[34px] px-3 border border-border rounded-md text-sm bg-secondary/50 text-muted-foreground focus:outline-none cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Client</label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={typeof order?.clientId === 'object' && order?.clientId ? (order.clientId as any).name : String(order?.clientId || '')}
                                            className="w-full h-[34px] px-3 border border-border rounded-md text-sm bg-secondary/50 text-muted-foreground focus:outline-none cursor-not-allowed"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Rep</label>
                                        <SearchableSelect
                                            options={allUsers.map(u => ({ label: `${u.firstName || ''} ${u.lastName || ''}`.trim(), value: u._id }))}
                                            value={editingHeader.salesRep}
                                            onChange={(val) => setEditingHeader({...editingHeader, salesRep: val})}
                                            placeholder="Select Rep..."
                                            className="w-full"
                                            triggerClassName="py-[6px] bg-card"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Method</label>
                                        <SearchableSelect
                                            options={PAYMENT_METHODS}
                                            value={editingHeader.paymentMethod}
                                            onChange={(val) => setEditingHeader({...editingHeader, paymentMethod: val})}
                                            placeholder="Select Method..."
                                            className="w-full"
                                            triggerClassName="py-[6px] bg-card"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Shipping Details Section */}
                            <div>
                                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Shipping Details</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Order Status</label>
                                        <select
                                            value={editingHeader.orderStatus}
                                            onChange={(e) => setEditingHeader({...editingHeader, orderStatus: e.target.value})}
                                            className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                        >
                                            <option value="Completed">Completed</option>
                                            <option value="Issued">Issued</option>
                                            <option value="Pending Payment">Pending Payment</option>
                                            <option value="Shipping">Shipping</option>
                                            <option value="Picking">Picking</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipped Date</label>
                                        <input
                                            type="date"
                                            value={editingHeader.shippedDate}
                                            onChange={(e) => setEditingHeader({...editingHeader, shippedDate: e.target.value})}
                                            className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Method</label>
                                        <SearchableSelect
                                            options={SHIPPING_METHODS}
                                            value={editingHeader.shippingMethod}
                                            onChange={(val) => setEditingHeader({...editingHeader, shippingMethod: val})}
                                            placeholder="Select Method..."
                                            creatable
                                            className="w-full"
                                            triggerClassName="py-[6px] bg-card"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tracking Number</label>
                                        <input
                                            type="text"
                                            value={editingHeader.trackingNumber}
                                            onChange={(e) => setEditingHeader({...editingHeader, trackingNumber: e.target.value})}
                                            className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                        />
                                    </div>

                                    {/* Address - Full Width */}
                                    <div className="col-span-2 md:col-span-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Address</label>
                                            <input
                                                type="text"
                                                value={editingHeader.shippingAddress}
                                                onChange={(e) => setEditingHeader({...editingHeader, shippingAddress: e.target.value})}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                                placeholder="Street Address, City, State, Zip"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">City</label>
                                            <input
                                                type="text"
                                                value={editingHeader.city}
                                                onChange={(e) => setEditingHeader({...editingHeader, city: e.target.value})}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                                placeholder="City"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">State</label>
                                            <input
                                                type="text"
                                                value={editingHeader.state}
                                                onChange={(e) => setEditingHeader({...editingHeader, state: e.target.value})}
                                                className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                                placeholder="State"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Costs Section */}
                            <div>
                                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Costs</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Cost ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editingHeader.shippingCost}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            onChange={(e) => setEditingHeader({...editingHeader, shippingCost: parseFloat(e.target.value) || 0})}
                                            className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Discount ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editingHeader.discount}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            onChange={(e) => setEditingHeader({...editingHeader, discount: parseFloat(e.target.value) || 0})}
                                            className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tax ($)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={editingHeader.tax}
                                            onWheel={(e) => e.currentTarget.blur()}
                                            onChange={(e) => setEditingHeader({...editingHeader, tax: parseFloat(e.target.value) || 0})}
                                            className="w-full h-[34px] px-3 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="px-4 border-t border-border bg-muted/20 flex items-center justify-end shrink-0 h-9">
                        <button onClick={handleSaveHeader} className="px-6 py-1.5 bg-[#FFEF5F] text-black text-xs font-bold uppercase rounded hover:opacity-90 transition-colors shadow-lg">
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Add Note Modal */}
        {isNoteModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-card rounded-none shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 flex flex-col border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-6 border-b border-border bg-muted/50 shrink-0 h-9">
                        <h2 className="text-sm font-bold uppercase text-foreground">Add Note</h2>
                        <button onClick={() => setIsNoteModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4 bg-background">
                        <textarea
                            value={newNoteText}
                            onChange={(e) => setNewNoteText(e.target.value)}
                            placeholder="Enter note..."
                            rows={5}
                            className="w-full px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground resize-none"
                        />
                    </div>
                    <div className="px-4 border-t border-border bg-muted/20 flex items-center justify-end shrink-0 h-9">
                        <button
                            onClick={async () => {
                                if (!order || !newNoteText.trim()) return;
                                try {
                                    const newNote = {
                                        note: newNoteText.trim(),
                                        createdBy: (session?.user as any)?.id || '',
                                        createdAt: new Date().toISOString()
                                    };
                                    const updatedNotes = [...(order.notes || []), newNote];
                                    const res = await fetch(`/api/wholesale/orders/${order._id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ notes: updatedNotes })
                                    });
                                    if (res.ok) {
                                        const data = await res.json();
                                        setOrder(data);
                                        setIsNoteModalOpen(false);
                                        setNewNoteText('');
                                        toast.success('Note added');
                                    } else {
                                        toast.error('Failed to add note');
                                    }
                                } catch (e) {
                                    toast.error('Error adding note');
                                }
                            }}
                            disabled={!newNoteText.trim()}
                            className="px-6 py-1.5 bg-blue-600 text-white text-xs font-bold uppercase rounded hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Save Note
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
