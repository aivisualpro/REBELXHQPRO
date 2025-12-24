'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    ArrowLeft, 
    Box, 
    Calendar, 
    CreditCard, 
    Truck, 
    CheckCircle2, 
    Clock, 
    MapPin, 
    User, 
    Mail, 
    Phone, 
    Printer, 
    MoreHorizontal,
    Pencil,
    Trash2,
    X,
    Plus,
    Package,
    Search
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal'; // Import
import { List } from 'lucide-react';

interface LineItem {
  _id: string;
  sku: { _id: string; name: string } | string;
  lotNumber: string;
  qty: number;
  total: number;
  website?: string;
  createdAt?: string;
  cost?: number;
}

interface WebOrder {
  _id: string;
  category: string;
  status: string;
  orderAmount: number;
  tax: number;
  firstName: string;
  lastName: string;
  city: string;
  state: string;
  postcode: string;
  email: string;
  createdAt: string;
  lineItems: LineItem[];
}

export default function WebOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<WebOrder | null>(null);
  const [loading, setLoading] = useState(true);

  // Item Modal State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allSkus, setAllSkus] = useState<{ _id: string; name: string, salePrice?: number }[]>([]);
  
  // Derived state for form
  const [formData, setFormData] = useState({
      sku: '',
      qty: 1,
      price: 0, 
      lotNumber: ''
  });

  // Lot Change State (Table Action)
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [activeItemForLot, setActiveItemForLot] = useState<LineItem | null>(null);

  // Lot Selection State (Form Action)
  const [isFormLotSelectorOpen, setIsFormLotSelectorOpen] = useState(false);

  const fetchOrder = async () => {
      try {
          const res = await fetch(`/api/retail/web-orders/${params.id}`);
          if (res.ok) {
              const data = await res.json();
              setOrder(data);
          } else {
              toast.error('Failed to fetch web order');
          }
      } catch (e) {
          toast.error('Error loading web order');
      } finally {
          setLoading(false);
      }
  };

  useEffect(() => {
      if (params.id) fetchOrder();
  }, [params.id]);

  useEffect(() => {
    if (isItemModalOpen && allSkus.length === 0) {
        fetch('/api/skus?limit=1000')
            .then(res => res.json())
            .then(data => setAllSkus(data.skus || []))
            .catch(e => console.error("Failed to fetch SKUs", e));
    }
  }, [isItemModalOpen, allSkus.length]);

  const handleOpenLotModal = (item: LineItem) => {
      setActiveItemForLot(item);
      setIsLotModalOpen(true);
  };

  const handleLotSelectFromTable = async (lotNumber: string) => {
      if (!order || !activeItemForLot) return;
      
      const currentItems = order.lineItems.map(item => {
          if (item._id === activeItemForLot._id) {
              return { ...item, lotNumber };
          }
          return item;
      });

      try {
          const res = await fetch(`/api/retail/web-orders/${order._id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ lineItems: currentItems })
          });

          if (res.ok) {
              toast.success('Lot updated');
              setIsLotModalOpen(false);
              fetchOrder();
          } else {
              toast.error('Failed to update lot');
          }
      } catch (e) {
          toast.error('Error updating lot');
      }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!order) return;
    const newStatus = e.target.value;
    const loadId = toast.loading('Updating status...');

    try {
        const res = await fetch(`/api/retail/web-orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (res.ok) {
            toast.success('Status updated', { id: loadId });
            fetchOrder();
        } else {
            toast.error('Failed to update status', { id: loadId });
        }
    } catch (e) {
        toast.error('Error updating status', { id: loadId });
    }
  };

  // Restored Handlers & Helpers
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; itemId: string | null }>({
      isOpen: false,
      itemId: null
  });

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({ sku: '', qty: 1, price: 0, lotNumber: '' });
    setIsItemModalOpen(true);
  };

  const handleOpenEditModal = (item: LineItem) => {
    setEditingId(item._id);
    const calculatedPrice = (item.total && item.qty) ? (item.total / item.qty) : 0;
    setFormData({
        sku: typeof item.sku === 'object' ? item.sku._id : item.sku,
        qty: item.qty || 1,
        price: calculatedPrice,
        lotNumber: item.lotNumber || ''
    });
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    if (!formData.sku) {
        toast.error('Please select a SKU');
        return;
    }

    let currentItems = [...(order.lineItems || [])];

    if (editingId) {
        currentItems = currentItems.map(item => {
            if (item._id === editingId) {
                return {
                    ...item,
                    sku: formData.sku, 
                    qty: formData.qty,
                    total: formData.qty * formData.price,
                    lotNumber: formData.lotNumber,
                };
            }
            return item;
        });
    } else {
        const newItem: any = {
            sku: formData.sku,
            qty: formData.qty,
            total: formData.qty * formData.price,
            lotNumber: formData.lotNumber,
            website: 'Manual Entry',
            createdAt: new Date().toISOString()
        };
        currentItems.push(newItem);
    }

    try {
        const res = await fetch(`/api/retail/web-orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineItems: currentItems })
        });

        if (res.ok) {
            toast.success(editingId ? 'Item updated' : 'Item added');
            setIsItemModalOpen(false);
            fetchOrder();
        } else {
            toast.error('Failed to save item');
        }
    } catch (e) {
        toast.error('Error saving item');
    }
  };

  const handleDeleteClick = (itemId: string) => {
    setDeleteConfirm({ isOpen: true, itemId });
  };

  const confirmDelete = async () => {
    const { itemId } = deleteConfirm;
    if (!itemId || !order) return;

    const updatedItems = (order.lineItems || []).filter(item => item._id !== itemId);

    try {
        const res = await fetch(`/api/retail/web-orders/${order._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lineItems: updatedItems })
        });

        if (res.ok) {
            toast.success('Item deleted');
            fetchOrder();
            setDeleteConfirm({ isOpen: false, itemId: null });
        } else {
            toast.error('Failed to delete item');
        }
    } catch (e) {
        toast.error('Error deleting item');
    }
  };

  const handleSkuChange = (skuId: string) => {
      const sku = allSkus.find(s => s._id === skuId);
      const newForm = { ...formData, sku: skuId };
      if (sku && sku.salePrice) {
          newForm.price = sku.salePrice;
      }
      setFormData(newForm);
  };

  const formatDate = (dateStr: string) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
      });
  };

  const formatCurrency = (val: number) => {
      if (val === undefined || val === null) return '-';
      return '$' + val.toFixed(2);
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-screen bg-slate-50">
              <div className="animate-spin h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
      );
  }

  if (!order) {
      return (
          <div className="flex items-center justify-center h-screen bg-slate-50">
              <div className="text-slate-400">Order not found</div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 font-sans text-slate-900">
        
        {/* Top Navigation / Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
            <div className="flex items-center space-x-4">
                <button 
                    onClick={() => router.push('/sales/web-orders')} 
                    className="p-2 bg-white border border-slate-200 hover:bg-slate-50 transition-colors text-slate-500 hover:text-slate-900"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                    <div className="flex items-center space-x-3 mb-1">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">#{order._id}</h1>
                        <span className={cn(
                            "px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                            order.status === 'completed' ? "bg-green-50 text-green-700 border-green-100" :
                            order.status === 'processing' ? "bg-blue-50 text-blue-700 border-blue-100" :
                            "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                            {order.status}
                        </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium">
                        Order Details • {formatDate(order.createdAt)}
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-3 text-sm">
                <button 
                  onClick={() => toast('Feature coming soon')}
                  className="flex items-center space-x-2 px-4 py-2 bg-white border border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-600 hover:bg-slate-50 transition-colors"
                >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                </button>
                
                {/* Status Dropdown / Action */}
                <div className="relative">
                     <select 
                        value={order.status}
                        onChange={handleStatusChange}
                        className="appearance-none pl-4 pr-10 py-2 bg-slate-900 text-white text-xs font-bold uppercase tracking-wide hover:bg-slate-800 transition-colors outline-none cursor-pointer border-none"
                     >
                        <option value="pending">Mark as Pending</option>
                        <option value="processing">Mark as Processing</option>
                        <option value="shipped">Mark as Shipped</option>
                        <option value="completed">Mark as Completed</option>
                        <option value="cancelled">Mark as Cancelled</option>
                     </select>
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                         <div className="border-t-[4px] border-l-[4px] border-r-[4px] border-t-white border-l-transparent border-r-transparent" />
                     </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Items */}
            <div className="lg:col-span-2 space-y-6">
                
                {/* Line Items Card */}
                <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Shipment Details</h3>
                        <button onClick={handleOpenAddModal} className="text-[10px] font-bold uppercase text-blue-600 hover:underline flex items-center space-x-1">
                            <Plus className="w-3 h-3" />
                            <span>Add Item</span>
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Item</th>
                                    <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lot #</th>
                                    <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">Qty</th>
                                    <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Price</th>
                                    <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Amount</th>
                                    <th className="px-6 py-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest text-right">Cost</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {order.lineItems?.map((item, idx) => {
                                    const skuName = typeof item.sku === 'object' ? item.sku?.name : item.sku;
                                    const unitPrice = (item.total && item.qty) ? (item.total / item.qty) : 0;
                                    return (
                                        <tr key={`${item._id}-${idx}`} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                        <Package className="w-5 h-5 text-slate-300" />
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">
                                                            {typeof item.sku === 'object' && item.sku?.name ? (
                                                                <a href={`/warehouse/skus/${item.sku._id}`} className="hover:underline hover:text-blue-600 transition-colors">
                                                                    {item.sku.name}
                                                                </a>
                                                            ) : (
                                                                skuName || 'Unknown Item'
                                                            )}
                                                        </div>
                                                        {/* SKU ID shown as subtitle if needed, or just keep minimal */}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-medium text-slate-600">
                                                <div className="flex items-center space-x-2">
                                                    <span>{item.lotNumber || '-'}</span>
                                                    <button onClick={() => handleOpenLotModal(item)} className="p-1 hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors" title="Change Lot">
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-xs text-slate-900 font-bold text-center">{item.qty}</td>
                                            <td className="px-6 py-4 text-xs text-slate-600 text-right">{formatCurrency(unitPrice)}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-slate-900 text-right">{formatCurrency(item.total)}</td>
                                            <td className="px-6 py-4 text-xs font-mono text-slate-600 text-right">
                                                {item.cost !== undefined ? formatCurrency(item.cost) : '-'}
                                            </td>
                                             <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handleDeleteClick(item._id)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Right Column: Sidebar */}
            <div className="space-y-6">
                
                {/* Payment Summary */}
                <div className="bg-white border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Payment</h3>
                        <button className="text-[10px] font-bold uppercase text-slate-500 hover:text-slate-900 flex items-center space-x-1 border border-slate-200 px-2 py-1 hover:bg-slate-50 transition-colors">
                            <Truck className="w-3 h-3" />
                            <span>Invoice</span>
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Subtotal</span>
                            <span className="font-medium text-slate-900">{formatCurrency(order.orderAmount - (order.tax || 0))}</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>Tax</span>
                            <span className="font-medium text-slate-900">{formatCurrency(order.tax || 0)}</span>
                        </div>
                         <div className="flex justify-between text-xs text-slate-500">
                            <span>Shipping</span>
                            <span className="font-medium text-slate-900">$0.00</span> 
                        </div>
                        <div className="h-px bg-slate-100 my-4" />
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-bold text-slate-900">Total</span>
                            <span className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(order.orderAmount)}</span>
                        </div>
                    </div>
                </div>

                {/* Customer Details */}
                <div className="bg-white border border-slate-200 p-6 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Customer</h3>
                    
                    <div className="space-y-6">
                        {/* Profile */}
                        <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-blue-50 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-900">{order.firstName} {order.lastName}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{order.email}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">Customer ID: {order._id.split('-')[1] || 'N/A'}</div>
                            </div>
                        </div>

                        {/* Shipping */}
                        <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-slate-50 flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Shipping Address</div>
                                <div className="text-xs font-medium text-slate-700 leading-relaxed">
                                    {order.city || 'N/A'}, {order.state || 'N/A'} <br />
                                    {order.postcode || 'N/A'}
                                </div>
                            </div>
                        </div>

                        {/* Billing */}
                        <div className="flex items-start space-x-3">
                            <div className="w-8 h-8 bg-slate-50 flex items-center justify-center shrink-0">
                                <CreditCard className="w-4 h-4 text-slate-500" />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-1">Billing Address</div>
                                <div className="text-xs font-medium text-slate-700 leading-relaxed italic text-slate-400">
                                    Same as shipping address
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>

        {/* Modal Logic */}
        {isItemModalOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                 <div className="bg-white shadow-2xl w-full max-w-lg animate-in fade-in zoom-in duration-200 overflow-hidden">
                     <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                         <h3 className="text-sm font-bold uppercase text-slate-900">{editingId ? 'Edit Item' : 'Add New Item'}</h3>
                         <button onClick={() => setIsItemModalOpen(false)}><X className="w-4 h-4 text-slate-400 hover:text-slate-900" /></button>
                     </div>
                     <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Product SKU</label>
                            <SearchableSelect
                                options={allSkus.map(s => ({ value: s._id, label: s.name }))}
                                value={formData.sku}
                                onChange={handleSkuChange}
                                className="w-full"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Quantity</label>
                                <input type="number" value={formData.qty} onChange={e => setFormData({...formData, qty: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors" />
                            </div>
                             <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase text-slate-500">Unit Price</label>
                                <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors" />
                            </div>
                        </div>
                        <div className="space-y-1.5 ">
                            <label className="text-[10px] font-bold uppercase text-slate-500">Lot Number</label>
                            <div className="flex gap-2">
                                <input type="text" value={formData.lotNumber} onChange={e => setFormData({...formData, lotNumber: e.target.value})} className="w-full px-3 py-2 border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!formData.sku) {
                                            toast.error('Please select a SKU first');
                                            return;
                                        }
                                        setIsFormLotSelectorOpen(true);
                                    }}
                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                                    title="Select from Inventory"
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="pt-4">
                            <button type="submit" className="w-full py-3 bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors">
                                {editingId ? 'Save Changes' : 'Add Item'}
                            </button>
                        </div>
                     </form>
                 </div>
             </div>
        )}

        {/* Reusable Lot Modal for Table Action */}
        <LotSelectionModal 
            isOpen={isLotModalOpen}
            onClose={() => setIsLotModalOpen(false)}
            onSelect={handleLotSelectFromTable}
            skuId={activeItemForLot ? (typeof activeItemForLot.sku === 'object' ? activeItemForLot.sku._id : activeItemForLot.sku) : ''}
            currentLotNumber={activeItemForLot?.lotNumber}
        />

        {/* Reusable Lot Modal for Form Action */}
        <LotSelectionModal 
            isOpen={isFormLotSelectorOpen}
            onClose={() => setIsFormLotSelectorOpen(false)}
            onSelect={(lot) => {
                setFormData(prev => ({ ...prev, lotNumber: lot }));
                setIsFormLotSelectorOpen(false);
            }}
            skuId={formData.sku}
            currentLotNumber={formData.lotNumber}
        />

        {/* Delete Modal */}
        {deleteConfirm.isOpen && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                 <div className="bg-white shadow-2xl w-full max-w-sm p-6 text-center">
                     <div className="w-12 h-12 bg-red-50 flex items-center justify-center mx-auto mb-4">
                         <Trash2 className="w-6 h-6 text-red-500" />
                     </div>
                     <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Item?</h3>
                     <p className="text-sm text-slate-500 mb-6">Are you sure you want to remove this item from the order?</p>
                     <div className="flex gap-3">
                         <button onClick={() => setDeleteConfirm({isOpen:false, itemId:null})} className="flex-1 py-2 border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                         <button onClick={confirmDelete} className="flex-1 py-2 bg-red-500 text-white text-sm font-bold hover:bg-red-600">Delete</button>
                     </div>
                 </div>
             </div>
        )}
    </div>
  );
}
