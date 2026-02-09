'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Package,
  Trash2,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal';

const UOM_OPTIONS = [
  { label: 'Each', value: 'Each' },
  { label: 'Box', value: 'Box' },
  { label: 'Case', value: 'Case' },
  { label: 'Pack', value: 'Pack' },
  { label: 'Pair', value: 'Pair' },
  { label: 'Set', value: 'Set' },
  { label: 'Roll', value: 'Roll' },
  { label: 'Kg', value: 'Kg' },
  { label: 'Lb', value: 'Lb' },
  { label: 'M', value: 'M' },
  { label: 'Ft', value: 'Ft' },
  { label: 'L', value: 'L' },
  { label: 'Gal', value: 'Gal' }
];

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

interface ItemForm {
    id: string;
    sku: string;
    productDescription: string;
    qtyShipped: number;
    price: number;
    uom: string;
    lotNumber: string;
    cost: number;
}

interface SaleOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialClientId?: string;
    orderToEdit?: any; // SaleOrder type if available, using any to avoid deep import issues for now
}

export function SaleOrderModal({ isOpen, onClose, onSuccess, initialClientId, orderToEdit }: SaleOrderModalProps) {
    // Resources
    const [allClients, setAllClients] = useState<{ _id: string; name: string; salesPerson?: { _id: string; firstName: string; lastName: string } | string | null; addresses?: { street: string; city: string; state: string }[] }[]>([]);
    const [allUsers, setAllUsers] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);
    const [allSkus, setAllSkus] = useState<{ _id: string; name: string; salePrice?: number; productDescription?: string }[]>([]);

    // Form State
    const [newOrder, setNewOrder] = useState<{
        label: string;
        clientId: string;
        salesRep: string;
        paymentMethod: string;
        orderStatus: string;
        shippedDate: string;
        shippingMethod: string;
        trackingNumber: string;
        shippingCost: number | string;
        discount: number | string;
        tax: number | string;
        category: string;
        shippingAddress: string;
        city: string;
        state: string;
        lockPrice: boolean;
    }>({
        label: '',
        clientId: '',
        salesRep: '',
        paymentMethod: '',
        orderStatus: 'Pending',
        shippedDate: '',
        shippingMethod: '',
        trackingNumber: '',
        shippingCost: '',
        discount: '',
        tax: '',
        category: '',
        shippingAddress: '',
        city: '',
        state: '',
        lockPrice: false
    });
    const [newLineItems, setNewLineItems] = useState<ItemForm[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // Lot Modal State
    const [isLotModalOpen, setIsLotModalOpen] = useState(false);
    const [editingLotItemId, setEditingLotItemId] = useState<string | null>(null);
    const [editingSkuId, setEditingSkuId] = useState<string | null>(null);

    // Fetch Resources
    useEffect(() => {
        if (isOpen) {
            const fetchResources = async () => {
                try {
                     const [clientsRes, skusRes, usersRes] = await Promise.all([
                        fetch('/api/clients?limit=5000'),
                        fetch('/api/skus?limit=5000'), // Increased limit for full SKU access
                        fetch('/api/users?limit=1000')
                     ]);

                     if (clientsRes.ok) {
                         const data = await clientsRes.json();
                         setAllClients(data.clients || []);
                     }
                     if (skusRes.ok) {
                         const data = await skusRes.json();
                         // Only show "Finished Goods" category SKUs for wholesale orders
                         const finishedGoods = (data.skus || []).filter((s: any) => 
                             s.category && s.category.toLowerCase() === 'finished goods'
                         );
                         setAllSkus(finishedGoods);
                     }
                     if (usersRes.ok) {
                         const data = await usersRes.json();
                         setAllUsers(data.users || []);
                     }
                } catch (e) {
                    console.error("Failed to fetch modal resources", e);
                }
            };
            fetchResources();
        }
    }, [isOpen]);

    // Initialize Form
    useEffect(() => {
        if (isOpen) {
            if (orderToEdit) {
                // Edit Mode
                setNewOrder({
                    label: orderToEdit.label,
                    clientId: typeof orderToEdit.clientId === 'object' && orderToEdit.clientId ? orderToEdit.clientId._id : String(orderToEdit.clientId || ''),
                    salesRep: typeof orderToEdit.salesRep === 'object' && orderToEdit.salesRep ? orderToEdit.salesRep._id : String(orderToEdit.salesRep || ''),
                    paymentMethod: orderToEdit.paymentMethod || '',
                    orderStatus: orderToEdit.orderStatus,
                    shippedDate: orderToEdit.shippedDate || '', 
                    shippingMethod: orderToEdit.shippingMethod || '',
                    trackingNumber: orderToEdit.trackingNumber || '',
                    shippingCost: orderToEdit.shippingCost || '',
                    discount: orderToEdit.discount || '',
                    tax: orderToEdit.tax || '',
                    category: orderToEdit.category || '',
                    shippingAddress: orderToEdit.shippingAddress || '',
                    city: orderToEdit.city || '',
                    state: orderToEdit.state || '',
                    lockPrice: orderToEdit.lockPrice || false
                });

                const items: ItemForm[] = (orderToEdit.lineItems || []).map((item: any) => ({
                    id: Math.random().toString(),
                    sku: typeof item.sku === 'object' && item.sku ? item.sku._id : String(item.sku),
                    productDescription: item.productDescription || '',
                    qtyShipped: item.qtyShipped,
                    price: item.price,
                    cost: item.cost || 0,
                    uom: item.uom || 'Each',
                    lotNumber: item.lotNumber || ''
                }));
                setNewLineItems(items);
            } else {
                // Create Mode
                 setNewOrder({
                    label: '',
                    clientId: '',
                    salesRep: '',
                    paymentMethod: '',
                    orderStatus: 'Pending',
                    shippedDate: '',
                    shippingMethod: '',
                    trackingNumber: '',
                    shippingCost: '',
                    discount: '',
                    tax: '',
                    category: '',
                    shippingAddress: '',
                    city: '',
                    state: '',
                    lockPrice: false
                });
                const initialItems = Array(3).fill(null).map(() => ({
                    id: Math.random().toString(),
                    sku: '',
                    productDescription: '',
                    qtyShipped: 1,
                    price: 0,
                    cost: 0,
                    uom: 'Each',
                    lotNumber: ''
                }));
                setNewLineItems(initialItems);

                // Pre-fill client if provided
                if (initialClientId && allClients.length > 0) {
                     const client = allClients.find(c => c._id === initialClientId);
                     if (client) initializeForClient(client);
                } else if (initialClientId && allClients.length === 0) {
                    // Try waiting for clients or just set ID (but address won't populate until clients load)
                    // Better to rely on handleClientChange or wait for clients. 
                    // We'll set clientId and try to populate if client exists in next effect
                }
            }
        }
    }, [isOpen, orderToEdit, initialClientId, allClients.length]); // Add allClients.length dependency to retry init when clients load

    const initializeForClient = (client: any) => {
         // Get sales rep 
        let salesRepId = '';
        if (client.salesPerson) {
            if (typeof client.salesPerson === 'object' && client.salesPerson._id) {
                salesRepId = client.salesPerson._id;
            } else if (typeof client.salesPerson === 'string') {
                salesRepId = client.salesPerson;
            }
        }
        
        const mainAddress = client.addresses && client.addresses.length > 0 
          ? client.addresses[0] 
          : { street: '', city: '', state: '' };
        
        setNewOrder(prev => ({
          ...prev,
          clientId: client._id,
          salesRep: salesRepId,
          shippingAddress: mainAddress.street || '',
          city: mainAddress.city || '',
          state: mainAddress.state || ''
        }));
    };

    // Ensure client details populate if initialClientId is passed and clients load late
    useEffect(() => {
        if (isOpen && !orderToEdit && initialClientId && !newOrder.shippingAddress && allClients.length > 0) {
             const client = allClients.find(c => c._id === initialClientId);
             if (client) initializeForClient(client);
        }
    }, [allClients, initialClientId, isOpen, orderToEdit, newOrder.shippingAddress]);


    // Generate Label (only for new orders)
    useEffect(() => {
        if (isOpen && !orderToEdit && !newOrder.label) {
            const generateLabel = async () => {
                try {
                    const res = await fetch('/api/wholesale/orders?limit=1&sortBy=createdAt&sortOrder=desc');
                    if (res.ok) {
                        const data = await res.json();
                        if (data.orders && data.orders.length > 0) {
                            const lastLabel = data.orders[0].label;
                            const match = lastLabel.match(/(\d+)/);
                            if (match) {
                                const nextNum = parseInt(match[0]) + 1;
                                setNewOrder(prev => ({ ...prev, label: String(nextNum) }));
                                return;
                            }
                        }
                    }
                    setNewOrder(prev => ({ ...prev, label: '53002' }));
                } catch {
                     setNewOrder(prev => ({ ...prev, label: '53002' }));
                }
            };
            generateLabel();
        }
    }, [isOpen, orderToEdit, newOrder.label]);

    const handleClientChange = (clientId: string) => {
        const client = allClients.find(c => c._id === clientId);
        if (client) {
            initializeForClient(client);
        } else {
             setNewOrder(prev => ({ ...prev, clientId }));
        }
    };

    const addLineItem = () => {
        setNewLineItems([...newLineItems, { id: Math.random().toString(), sku: '', productDescription: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' }]);
    };

    const removeLineItem = (id: string) => {
        setNewLineItems(newLineItems.filter(i => i.id !== id));
    };

    const updateLineItem = async (id: string, field: keyof ItemForm, value: any) => {
        setNewLineItems(prev => prev.map(item => {
          if (item.id === id) {
            return { ...item, [field]: value };
          }
          return item;
        }));
    
        if (field === 'sku') {
            const skuObj = allSkus.find(s => s._id === value);
            let newPrice = 0;
            let newProductDescription = '';
            let newLot = '';
            let newCost = 0;
    
            if (skuObj) {
                newPrice = skuObj.salePrice || 0;
                newProductDescription = skuObj.productDescription || '';
            }
    
            // Auto-Suggest Lot (FIFO)
            try {
                const res = await fetch(`/api/warehouse/skus/${value}/lots`);
                if (res.ok) {
                    const data = await res.json();
                    const lots = data.lots || [];
                    const sorted = lots.sort((a: any, b: any) => {
                         const dateA = a.date ? new Date(a.date).getTime() : 0;
                         const dateB = b.date ? new Date(b.date).getTime() : 0;
                         return dateA - dateB;
                    });
                    const suggested = sorted.find((l: any) => l.balance > 0);
                    if (suggested) {
                        newLot = suggested.lotNumber;
                        newCost = suggested.cost || 0;
                    }
                }
            } catch (e) {
                console.error("Failed to auto-suggest lot", e);
            }
    
            setNewLineItems(prev => prev.map(item => {
                if (item.id === id) {
                    return { 
                        ...item, 
                        price: newPrice || item.price,
                        productDescription: newProductDescription,
                        lotNumber: newLot,
                        cost: newCost
                    };
                }
                return item;
            }));
        }
    };

    const handleLotSelect = (lotNumber: string, cost?: number) => {
        if (!editingLotItemId) return;
        setNewLineItems(prev => prev.map(item => {
            if (item.id === editingLotItemId) {
                return { ...item, lotNumber, cost: cost || 0 };
            }
            return item;
        }));
        setIsLotModalOpen(false);
        setEditingLotItemId(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newOrder.clientId) { toast.error('Please select a client'); return; }
        if (!newOrder.salesRep) { toast.error('Sales Rep is required'); return; }
        if (!newOrder.shippingAddress) { toast.error('Address is required'); return; }
        if (newLineItems.length === 0) { toast.error('At least 1 line item is required'); return; }
        // Only validate SKUs that are in use (have been touched)
        const actualLineItems = newLineItems.filter(item => item.sku);
        if (actualLineItems.length === 0) { toast.error('At least 1 line item with a SKU is required'); return; }

        const payload = {
          ...newOrder,
          shippingCost: Number(newOrder.shippingCost) || 0,
          discount: Number(newOrder.discount) || 0,
          tax: Number(newOrder.tax) || 0,
          lineItems: actualLineItems.map(item => ({
            sku: item.sku,
            qtyShipped: item.qtyShipped,
            price: item.price,
            uom: item.uom,
            lotNumber: item.lotNumber,
            cost: item.cost, 
            total: (item.qtyShipped || 0) * (item.price || 0)
          }))
        };

        setIsSaving(true);
        try {
            if (orderToEdit) {
                 toast.error("Edit functionality requires backend update.");
            } else {
                const res = await fetch('/api/wholesale/orders', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    headers: { 'Content-Type': 'application/json' }
                });
                if (res.ok) {
                    toast.success('Order created');
                    onSuccess();
                    onClose();
                } else {
                    const err = await res.json();
                    toast.error(err.error || 'Failed to save order');
                }
            }
        } catch (e) {
            toast.error('Error saving order');
        } finally {
            setIsSaving(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-6xl rounded-none shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-border flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 border-b border-border bg-muted/50 shrink-0 h-9">
              <h2 className="text-sm font-bold uppercase text-foreground">{orderToEdit ? 'Edit Sale Order' : 'Create Sale Order'}</h2>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 scrollbar-custom bg-background">
              <form id="create-so-form" onSubmit={handleSubmit}>
                {/* Header Info */}
                <div className="space-y-6">
                    {/* Basic Info */}
                    <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Order Details</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Order Name/ID <span className="text-destructive">*</span></label>
                                <input
                                type="text"
                                required
                                readOnly
                                value={newOrder.label}
                                className="w-full h-[34px] px-3 border border-border rounded-md text-sm bg-secondary/50 text-muted-foreground focus:outline-none cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Client <span className="text-destructive">*</span></label>
                                {initialClientId ? (
                                    <input
                                        type="text"
                                        readOnly
                                        value={allClients.find(c => c._id === newOrder.clientId)?.name || 'Loading...'}
                                        className="w-full h-[34px] px-3 border border-border rounded-md text-sm bg-secondary/50 text-muted-foreground focus:outline-none cursor-not-allowed"
                                    />
                                ) : (
                                    <SearchableSelect
                                        options={allClients.map(c => ({ value: c._id, label: c.name }))}
                                        value={newOrder.clientId}
                                        onChange={handleClientChange}
                                        placeholder="Select Client..."
                                        required
                                        className="w-full"
                                    />
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Rep <span className="text-destructive">*</span></label>
                                {initialClientId ? (
                                    <input
                                        type="text"
                                        readOnly
                                        value={allUsers.find(u => u._id === newOrder.salesRep) ? `${allUsers.find(u => u._id === newOrder.salesRep)?.firstName} ${allUsers.find(u => u._id === newOrder.salesRep)?.lastName}` : 'Loading...'}
                                        className="w-full h-[34px] px-3 border border-border rounded-md text-sm bg-secondary/50 text-muted-foreground focus:outline-none cursor-not-allowed"
                                    />
                                ) : (
                                    <SearchableSelect
                                        options={allUsers.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id }))}
                                        value={newOrder.salesRep}
                                        onChange={(val) => setNewOrder({ ...newOrder, salesRep: val })}
                                        placeholder="Select Rep..."
                                        className="w-full"
                                    />
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Method</label>
                                <SearchableSelect
                                    options={PAYMENT_METHODS}
                                    value={newOrder.paymentMethod}
                                    onChange={(val) => setNewOrder({ ...newOrder, paymentMethod: val })}
                                    placeholder="Select Method..."
                                    className="w-full"
                                    triggerClassName="py-[6px] bg-card"
                                />
                            </div>
                            
                            {/* Address Row */}
                            <div className="col-span-2 md:col-span-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Address <span className="text-destructive">*</span></label>
                                    <input
                                    type="text"
                                    value={newOrder.shippingAddress}
                                    onChange={e => setNewOrder({ ...newOrder, shippingAddress: e.target.value })}
                                    className="w-full px-3 py-2 border border-input rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background text-foreground"
                                    placeholder="Street Address, City, State, Zip"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-border pt-2 mt-2">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Line Items <span className="text-destructive">*</span></h3>
                    <div className="flex items-center space-x-2">
                        <button
                        type="button"
                        onClick={addLineItem}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-none text-[10px] font-bold uppercase transition-colors"
                        >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Item</span>
                        </button>
                    </div>
                  </div>

                  {newLineItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-muted/20 rounded-none border border-dashed border-border text-muted-foreground">
                      <div className="w-12 h-12 bg-card rounded-full flex items-center justify-center shadow-sm mb-3">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium">No items added yet</p>
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="mt-3 text-xs font-bold text-primary hover:underline"
                      >
                        Add your first item
                      </button>
                    </div>
                  ) : (
                    <div className="border border-border rounded-none overflow-x-auto">
                      <table className="w-full text-left border-collapse border-b border-border min-w-[900px]">
                        <thead className="bg-muted/50 text-foreground">
                           <tr>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[20%] border-r border-border">Item / SKU</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[20%] border-r border-border">Product Description</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[10%] border-r border-border">Lot #</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[8%] border-r border-border">UOM</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[8%] border-r border-border">Qty</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[12%] border-r border-border">Price</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[10%] text-right border-r border-border">Total</th>
                              <th className="px-2 py-2 w-[4%] bg-card"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                          {newLineItems.map((item, index) => (
                            <tr key={item.id} className="group">
                                <td className="p-0 border-r border-border">
                                    <div className="w-full h-full">
                                        <SearchableSelect
                                            options={allSkus
                                                .filter(s => !newLineItems.some(i => i.id !== item.id && i.sku === s._id))
                                                .map(s => ({ value: s._id, label: s.name }))
                                            }
                                            value={item.sku}
                                            onChange={(val) => updateLineItem(item.id, 'sku', val)}
                                            placeholder="Select SKU"
                                            className="w-full rounded-none border-none text-sm focus:ring-0"
                                            triggerClassName="bg-transparent border-none rounded-none shadow-none ring-0 focus-within:ring-0 hover:border-none"
                                        />
                                    </div>
                                </td>
                                <td className="p-0 border-r border-border">
                                    <input
                                        type="text"
                                        value={item.productDescription}
                                        onChange={(e) => updateLineItem(item.id, 'productDescription', e.target.value)}
                                        placeholder="Product description..."
                                        className="w-full h-[32px] px-2 text-xs focus:outline-none focus:bg-primary/5 transition-colors rounded-none bg-transparent text-foreground"
                                    />
                                </td>
                                <td className="p-0 border-r border-border">
                                    <div 
                                        className="w-full h-[32px] px-2 flex items-center cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => {
                                            if (!item.sku) {
                                                toast.error("Select SKU first");
                                                return;
                                            }
                                            setEditingLotItemId(item.id);
                                            setEditingSkuId(item.sku);
                                            setIsLotModalOpen(true);
                                        }}
                                    >
                                        <span className={cn("text-xs truncate block w-full", !item.lotNumber ? "text-muted-foreground italic" : "text-foreground font-mono")}>
                                            {item.lotNumber || "Select"}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-0 border-r border-border">
                                     <SearchableSelect
                                        options={UOM_OPTIONS}
                                        value={item.uom}
                                        onChange={(val) => updateLineItem(item.id, 'uom', val)}
                                        placeholder="UOM"
                                        creatable
                                        className="w-full rounded-none border-none focus:ring-0"
                                            triggerClassName="bg-transparent border-none rounded-none shadow-none ring-0 focus-within:ring-0 hover:border-none"
                                    />
                                </td>
                                <td className="p-0 border-r border-border">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.qtyShipped}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => updateLineItem(item.id, 'qtyShipped', parseInt(e.target.value) || 0)}
                                      className="w-full h-[32px] px-2 text-sm focus:outline-none focus:bg-primary/5 transition-colors font-mono rounded-none bg-background text-foreground"
                                    />
                                </td>
                                <td className="p-0 border-r border-border">
                                    <div className="relative h-full w-full">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={item.price}
                                          onWheel={(e) => e.currentTarget.blur()}
                                          onChange={(e) => updateLineItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                          className="w-full h-[32px] pl-5 pr-2 text-sm focus:outline-none focus:bg-primary/5 transition-colors font-mono text-right rounded-none bg-background text-foreground"
                                        />
                                    </div>
                                </td>
                                <td className="px-2 py-0 align-middle text-right border-r border-border bg-muted/30">
                                    <span className="text-xs font-bold text-foreground font-mono">
                                        {((item.qtyShipped || 0) * (item.price || 0)).toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                                    </span>
                                </td>
                                <td className="p-0 text-center align-middle">
                                    <button
                                      type="button"
                                      onClick={() => removeLineItem(item.id)}
                                      className="w-full h-[32px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                      title="Remove Item"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6} className="px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase text-right tracking-wider bg-muted/50">Subtotal</td>
                                <td className="px-2 py-2 text-xs font-black text-foreground font-mono text-right bg-muted/50">
                                    {newLineItems.reduce((sum, item) => sum + ((item.qtyShipped || 0) * (item.price || 0)), 0).toLocaleString(undefined, {style: 'currency', currency: 'USD'})}
                                </td>
                                <td className="bg-card"></td>
                            </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="px-4 border-t border-border bg-muted/20 flex items-center justify-end shrink-0 h-9">
              <button
                type="submit"
                form="create-so-form"
                disabled={isSaving}
                className="px-6 py-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase rounded hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSaving ? 'Creating...' : (orderToEdit ? 'Save Changes' : 'Create Order')}</span>
              </button>
            </div>
          </div>

          {/* Lot Selection Modal (Nested) */}
           <LotSelectionModal
                isOpen={isLotModalOpen}
                onClose={() => {
                    setIsLotModalOpen(false);
                    setEditingLotItemId(null);
                    setEditingSkuId(null);
                }}
                onSelect={handleLotSelect}
                skuId={editingSkuId || ''}
                currentLotNumber={newLineItems.find(i => i.id === editingLotItemId)?.lotNumber || ''}
            />
        </div>
    );
}
