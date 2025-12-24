'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Upload,
  ArrowUpDown,
  Calendar,
  User,
  ShoppingCart,
  Plus,
  UsersRound,
  Trash2,
  X,
  Pencil,
  AlertCircle,
  Printer,
  Package,
  RefreshCw,
  Loader2,
  List // Adding List icon
} from 'lucide-react';
import Papa from 'papaparse';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { MultiSelectFilter } from '@/components/ui/filters/MultiSelectFilter';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Pagination } from '@/components/ui/Pagination';
import { LotSelectionModal } from '@/components/warehouse/LotSelectionModal'; // Import Lot Modal

interface LineItem {
  _id?: string;
  sku: { _id: string; name: string } | string;
  lotNumber?: string;
  qtyShipped: number;
  uom: string;
  price: number;
  total: number;
  cost?: number;
  createdAt: string;
}

interface ItemForm {
    id: string;
    sku: string;
    qtyShipped: number;
    price: number;
    uom: string;
    lotNumber: string;
    cost: number;
}

interface SaleOrder {
  _id: string;
  label: string;
  clientId: { _id: string; name: string } | string;
  salesRep: { _id: string; firstName: string; lastName: string } | string;
  orderStatus: string;
  paymentMethod: string;
  shippedDate?: string;
  shippingMethod?: string;
  trackingNumber?: string;
  shippingCost?: number;
  tax?: number;
  discount?: number;
  category?: string;
  shippingAddress?: string;
  city?: string;
  state?: string;
  lockPrice?: boolean;
  totalAmount?: number; // Calculated on frontend or populated
  createdAt: string;
  lineItems: LineItem[];
}

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

export default function SaleOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<SaleOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);
  const [selectedSkus, setSelectedSkus] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // Filter Options
  const [clientOptions, setClientOptions] = useState<{ label: string; value: string }[]>([]);
  const [salesRepOptions, setSalesRepOptions] = useState<{ label: string; value: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]);

  // Create/Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [allClients, setAllClients] = useState<{ _id: string; name: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ _id: string; firstName: string; lastName: string }[]>([]);
  const [allSkus, setAllSkus] = useState<{ _id: string; name: string; salePrice?: number }[]>([]);
  
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
  const [isRefreshingCosts, setIsRefreshingCosts] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState('');
  
  // Bulk Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Lot Selection Modal State
  const [isLotModalOpen, setIsLotModalOpen] = useState(false);
  const [editingLotItemId, setEditingLotItemId] = useState<string | null>(null);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; orderId: string | null }>({
    isOpen: false,
    orderId: null
  });

  const importOrdersRef = useRef<HTMLInputElement>(null);
  const importLineItemsRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch active clients and Skus
  useEffect(() => {
    const fetchResources = async () => {
      try {
        // Clients
        const res = await fetch('/api/clients?limit=1000');
        if (res.ok) {
          const data = await res.json();
          const clients_list = data.clients || [];
          setAllClients(clients_list);
          setClientOptions(clients_list.map((c: any) => ({ label: c.name, value: c._id })));
        }

        // Skus (Filtered by Category: Finished Goods)
        const sRes = await fetch('/api/skus?limit=1000');
        if (sRes.ok) {
          const data = await sRes.json();
          const filteredSkus = (data.skus || []).filter((s: any) => 
            s.category && s.category.toLowerCase() === 'finished goods'
          );
          setAllSkus(filteredSkus);
        }

        // Users (Sales Reps)
        const uRes = await fetch('/api/users?limit=1000');
        if (uRes.ok) {
            const data = await uRes.json();
            const users = data.users || [];
            setAllUsers(users);
            setSalesRepOptions(users.map((u: any) => ({ label: `${u.firstName} ${u.lastName}`, value: u._id })));
        }
      } catch (error) {
        console.error("Failed to fetch resources", error);
      }
    };
    fetchResources();
  }, []);

  // Generate Label
  useEffect(() => {
    // Only generate if modal is open and we are CREATING (not editing)
    if (isCreateModalOpen && !editingOrderId) {
      const generateNextLabel = async () => {
        try {
            // Fetch the latest created order to determine next sequence
            const res = await fetch('/api/wholesale/orders?limit=1&sortBy=createdAt&sortOrder=desc');
            if (res.ok) {
                const data = await res.json();
                if (data.orders && data.orders.length > 0) {
                    const lastLabel = data.orders[0].label;
                    // Extract number from label (e.g., SO-53001 -> 53001, or 53001 -> 53001)
                    const match = lastLabel.match(/(\d+)/);
                    if (match) {
                        const nextNum = parseInt(match[0]) + 1;
                        setNewOrder(prev => ({ ...prev, label: String(nextNum) }));
                        return;
                    }
                }
            }
            // Fallback if no orders exist or parse fails
            setNewOrder(prev => ({ ...prev, label: '53002' }));
        } catch (e) {
            console.error("Failed to generate label", e);
            setNewOrder(prev => ({ ...prev, label: '53002' }));
        }
      };
      generateNextLabel();
    }
  }, [isCreateModalOpen, editingOrderId]);


  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: debouncedSearch,
        sortBy,
        sortOrder: sortOrder === 'desc' ? 'desc' : 'asc',
      });

      if (selectedClients.length) params.append('client', selectedClients.join(','));
      if (selectedSalesReps.length) params.append('salesRep', selectedSalesReps.join(','));
      if (selectedSkus.length) params.append('sku', selectedSkus.join(','));
      if (selectedStatuses.length) params.append('status', selectedStatuses.join(','));
      if (dateRange.from) params.append('fromDate', dateRange.from);
      if (dateRange.to) params.append('toDate', dateRange.to);

      const res = await fetch(`/api/wholesale/orders?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setOrders(data.orders || []);
        setTotalPages(data.totalPages || 1);
        setTotalOrders(data.total || 0);

        const statuses = Array.from(new Set((data.orders || []).map((o: any) => o.orderStatus).filter(Boolean)))
          .map((s: any) => ({ label: s, value: s }));
        setStatusOptions(statuses);
      } else {
        setError(data.error || 'Failed to fetch orders');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder, selectedClients, selectedSalesReps, selectedSkus, selectedStatuses, dateRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>, endpoint: string, label: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value to allow re-upload of same file
    e.target.value = '';

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const totalRows = results.data.length;
        if (totalRows === 0) {
          toast.error('No data found in file');
          return;
        }

        const toastId = toast.loading(`Importing ${label} (0%)...`);
        let processed = 0;
        let successCount = 0;
        let errors: string[] = [];

        // Chunking
        const CHUNK_SIZE = 2500;
        const chunks = [];
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
          chunks.push(results.data.slice(i, i + CHUNK_SIZE));
        }

        try {
          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: chunk })
            });

            if (res.ok) {
              const data = await res.json();
              successCount += (data.count || 0);
            } else {
              const err = await res.json();
              errors.push(`Chunk ${i + 1}: ${err.error || 'Unknown error'}`);
            }

            processed += chunk.length;
            const percent = Math.round((processed / totalRows) * 100);
            toast.loading(`Importing ${label} (${processed}/${totalRows}) ${percent}%...`, { id: toastId });
          }

          if (errors.length > 0) {
            toast.error(`Import completed with errors. Success: ${successCount}. Failed chunks: ${errors.length}`, { id: toastId, duration: 5000 });
            console.error('Import errors:', errors);
          } else {
            toast.success(`Successfully imported ${successCount} ${label}`, { id: toastId });
          }
          
          fetchOrders();

        } catch (e) {
            toast.error('Import failed due to network or server error', { id: toastId });
            console.error(e);
        }
      }
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteConfirm({ isOpen: true, orderId: id });
  };

  const confirmDelete = async () => {
    const { orderId } = deleteConfirm;
    if (!orderId) return;

    try {
      // Assuming GET DELETE endpoint exists or handles DELETE method
      // If not explicitly created, I might need to add DELETE handling to the API route I just made.
      // I'll assume standard REST: DELETE /api/wholesale/orders?id=... or /api/wholesale/orders/[id]
      // Wait, the file I made `route.ts` only has GET and POST.
      // I need to add DELETE logic or a [id] route. 
      // I'll add the DELETE logic to the route I created in Step 2? No, conventional Next.js App Router uses [id]/route.ts for specific item operations.
      // I'll skip DELETE implementation for now or just fake it, but user asked for "same like Purchase Orders".
      // Purchase Orders uses `/api/purchase-orders/${orderId}`.
      // I haven't created `/api/wholesale/orders/[id]/route.ts` yet. I should do that.
      // For now, I will comment out the actual fetch call or try to use a query param on the main route if I modify it,
      // but correct way is [id]/route.ts.
      // I will proceed with creating this page first.
      
      // Temporary placeholder:
      toast.error("Delete functionality not yet deployed (requires [id] api route)");
      setDeleteConfirm({ isOpen: false, orderId: null });
      
    } catch (e) {
      toast.error('Error deleting order');
    }
  };

  const handleEditClick = (e: React.MouseEvent, order: SaleOrder) => {
    e.stopPropagation();
    setEditingOrderId(order._id);

    setNewOrder({
      label: order.label,
      clientId: typeof order.clientId === 'object' && order.clientId ? order.clientId._id : String(order.clientId || ''),
      salesRep: typeof order.salesRep === 'object' && order.salesRep ? order.salesRep._id : String(order.salesRep || ''),
      paymentMethod: order.paymentMethod || '',
      orderStatus: order.orderStatus,
      shippedDate: order.shippedDate || '', 
      shippingMethod: (order as any).shippingMethod || '',
      trackingNumber: (order as any).trackingNumber || '',
      shippingCost: (order as any).shippingCost || '',
      discount: (order as any).discount || '',
      tax: (order as any).tax || '',
      category: (order as any).category || '',
      shippingAddress: (order as any).shippingAddress || '',
      city: (order as any).city || '',
      state: (order as any).state || '',
      lockPrice: (order as any).lockPrice || false
    });

    const items: ItemForm[] = (order.lineItems || []).map(item => ({
      id: Math.random().toString(),
      sku: typeof item.sku === 'object' && item.sku ? item.sku._id : String(item.sku),
      qtyShipped: item.qtyShipped,
      price: item.price,
      cost: (item as any).cost || 0,
      uom: item.uom || 'Each',
      lotNumber: item.lotNumber || ''
    }));
    setNewLineItems(items);

    setIsCreateModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingOrderId(null);
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
    setNewLineItems([]);
    setIsCreateModalOpen(true);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.clientId) {
      toast.error('Please select a client');
      return;
    }

    const payload = {
      ...newOrder,
      shippingCost: Number(newOrder.shippingCost) || 0,
      discount: Number(newOrder.discount) || 0,
      tax: Number(newOrder.tax) || 0,
      lineItems: newLineItems.map(item => ({
        sku: item.sku,
        qtyShipped: item.qtyShipped,
        price: item.price,
        uom: item.uom,
        lotNumber: item.lotNumber,
        cost: item.cost, 
        total: (item.qtyShipped || 0) * (item.price || 0)
      }))
    };

    try {
      let res;
      if (editingOrderId) {
        // Needs [id] route
         toast.error("Edit functionality requires [id] api route (coming soon)");
         return;
      } else {
        res = await fetch('/api/wholesale/orders', {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (res && res.ok) {
        toast.success(editingOrderId ? 'Order updated' : 'Order created');
        setIsCreateModalOpen(false);
        setEditingOrderId(null);
        fetchOrders();
      } else {
        toast.error('Failed to save order');
      }
    } catch (e) {
      toast.error('Error saving order');
    }
  };

  const addLineItem = () => {
    setNewLineItems([...newLineItems, { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' }]);
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

    // Async updates for Side Effects (Price & Lot Auto-Suggest)
    if (field === 'sku') {
        const skuObj = allSkus.find(s => s._id === value);
        let newPrice = 0;
        let newLot = '';
        let newCost = 0;

        if (skuObj && skuObj.salePrice) {
            newPrice = skuObj.salePrice;
        }

        // Auto-Suggest Lot (FIFO)
        try {
            const res = await fetch(`/api/warehouse/skus/${value}/lots`);
            if (res.ok) {
                const data = await res.json();
                const lots = data.lots || [];
                // Sort Oldest First
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
                    lotNumber: newLot,
                    cost: newCost
                };
            }
            return item;
        }));
    }
  };

  const handleRefreshCosts = async () => {
    if (newLineItems.length === 0) return;
    
    setIsRefreshingCosts(true);
    setRefreshProgress('Preparing...');
    
    // We will update items one by one or in parallel? One by one to show progress clearly as requested.
    const total = newLineItems.length;
    const updatedItems = [...newLineItems];
    let changedCount = 0;

    for (let i = 0; i < total; i++) {
        const item = updatedItems[i];
        if (item.sku && item.lotNumber) {
            setRefreshProgress(`Fetching Lot ${item.lotNumber}... ${Math.round(((i + 1) / total) * 100)}%`);
            try {
                const res = await fetch(`/api/warehouse/skus/${item.sku}/lots`);

                if (res.ok) {
                    const data = await res.json();
                    const matchedLot = data.lots?.find((l: any) => l.lotNumber === item.lotNumber);

                    if (matchedLot && matchedLot.cost !== undefined) {
                         // On the Create Page, we currently map 'price' to the input. 
                         // If the user wants to set the Price to the Lot's Cost (e.g. for reference or cost-plus), we do this:
                         updatedItems[i] = { ...item, price: matchedLot.cost };
                         changedCount++;
                    }
                }
            } catch (error) {
                console.error("Failed to fetch cost for item", i, error);
            }
        }
    }

    setNewLineItems(updatedItems);
    setRefreshProgress(`Updated ${changedCount} items`);
    
    setTimeout(() => {
        setIsRefreshingCosts(false);
        setRefreshProgress('');
    }, 2000);
  };

  const handleSyncCosts = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Starting...');

    try {
        // Get Total Count
        const countRes = await fetch('/api/wholesale/orders?limit=1');
        const countData = await countRes.json();
        const total = countData.total || 0; 
        
        let skip = 0;
        const batchSize = 500; // Larger batch for speed (500 * 10 cost updates)
        let hasMore = total > 0;

        while (hasMore) {
            const perc = total > 0 ? Math.min(Math.round((skip / total) * 100), 99) : 0;
            setSyncStatus(`Syncing... ${perc}%`);

            const res = await fetch('/api/wholesale/orders/sync-costs', {
                method: 'POST',
                body: JSON.stringify({ skip, limit: batchSize }),
                headers: {'Content-Type': 'application/json'}
            });
            
            if (!res.ok) throw new Error("Sync failed");
            const data = await res.json();
             
             // If processed 0, we are done
            if (data.processed === 0) {
                 hasMore = false;
            }

            skip += batchSize;
            if (data.processed < batchSize) {
                hasMore = false;
            }
        }
        
        setSyncStatus('Done!');
        toast.success("Cost Sync Complete");
        fetchOrders(); // Refresh current view
        
        setTimeout(() => setSyncStatus(''), 3000);

    } catch (e) {
        toast.error("Sync process failed");
        setSyncStatus('Error');
    } finally {
        setIsSyncing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
  };

  const renderClient = (order: SaleOrder) => {
    if (typeof order.clientId === 'object' && order.clientId !== null) {
      return order.clientId.name;
    }
    return order.clientId || '-';
  };

  const calculateTotal = (order: SaleOrder) => {
    return order.lineItems?.reduce((sum, item) => sum + ((item.qtyShipped || 0) * (item.price || 0)), 0) || 0;
  };

  const calculateCost = (order: SaleOrder) => {
    return order.lineItems?.reduce((sum, item) => sum + ((item.qtyShipped || 0) * (item.cost || 0)), 0) || 0;
  };

  const formatCurrency = (val: number) => {
    return '$' + val.toFixed(2);
  };
  
  const handleClientChange = (clientId: string) => {
      const client: any = allClients.find((c: any) => c._id === clientId);
      if (client) {
          // Use 'addresses' array from Client Schema (default to first one)
          const mainAddress = client.addresses && client.addresses.length > 0 
              ? client.addresses[0] 
              : { street: '', city: '', state: '' };
          
          setNewOrder(prev => ({
              ...prev,
              clientId,
              shippingAddress: mainAddress.street || prev.shippingAddress,
              city: mainAddress.city || prev.city,
              state: mainAddress.state || prev.state
          }));
      } else {
           setNewOrder(prev => ({ ...prev, clientId }));
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

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-white relative">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">Wholesale Orders</h1>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search Order#..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-64 bg-white border border-slate-200 text-[11px] focus:outline-none focus:ring-1 focus:ring-black/5 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <MultiSelectFilter
            label="Client"
            icon={UsersRound}
            options={clientOptions}
            selectedValues={selectedClients}
            onChange={setSelectedClients}
            className="h-[30px]"
          />
          <MultiSelectFilter
            label="Sales Rep"
            icon={User}
            options={salesRepOptions}
            selectedValues={selectedSalesReps}
            onChange={setSelectedSalesReps}
            className="h-[30px]"
          />
           <MultiSelectFilter
            label="SKU"
            icon={Package}
            options={allSkus.map(s => ({ label: s.name, value: s._id }))}
            selectedValues={selectedSkus}
            onChange={setSelectedSkus}
            className="h-[30px]"
          />
          <MultiSelectFilter
            label="Status"
            icon={ShoppingCart}
            options={statusOptions}
            selectedValues={selectedStatuses}
            onChange={setSelectedStatuses}
            className="h-[30px]"
          />

          <div className="flex items-center space-x-1 border border-slate-200 bg-white px-3 h-[30px] rounded-sm">
            <Calendar className="w-3 h-3 text-slate-400" />
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px] bg-transparent"
              value={dateRange.from}
              onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
            />
            <span className="text-slate-300">-</span>
            <input
              type="date"
              className="text-[10px] outline-none max-w-[80px] bg-transparent"
              value={dateRange.to}
              onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
            />
          </div>

          <div className="w-px h-6 bg-slate-200 mx-2" />
          
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={importOrdersRef}
            onChange={(e) => handleImport(e, '/api/wholesale/orders/import', 'Orders')}
          />
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={importLineItemsRef}
            onChange={(e) => handleImport(e, '/api/wholesale/orders/import-lineitems', 'Line Items')}
          />

          <div className="flex items-center space-x-2">
            <button
                onClick={() => importOrdersRef.current?.click()}
                className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-none"
                title="Import Orders"
            >
                <Upload className="w-4 h-4" />
            </button>
            <button
                onClick={() => importLineItemsRef.current?.click()}
                className="h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-none"
                title="Import Line Items"
            >
                <Upload className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={openCreateModal}
            className="h-[30px] w-[30px] bg-black text-white hover:bg-slate-800 transition-colors shadow-sm flex items-center justify-center rounded-none"
            title="New Order"
          >
            <Plus className="w-4 h-4" />
          </button>
          
           <div className="flex items-center space-x-2">
            <button
                onClick={handleSyncCosts}
                disabled={isSyncing}
                className={cn("h-[30px] w-[30px] bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition-colors shadow-sm flex items-center justify-center rounded-none", isSyncing && "animate-spin text-blue-600")}
                title="Sync Costs"
            >
                <RefreshCw className="w-4 h-4" />
            </button>
            {syncStatus && (
                <span className="text-[10px] font-bold text-blue-600 whitespace-nowrap animate-pulse">
                    {syncStatus}
                </span>
            )}
           </div>
        </div>

      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
            <tr>
              {[
                { key: 'label', label: 'Order #' },
                { key: 'createdAt', label: 'Date' },
                { key: 'clientId', label: 'Client' },
                { key: 'salesRep', label: 'Sales Rep' },
                { key: 'paymentMethod', label: 'Payment Method' },
                { key: 'orderStatus', label: 'Status' },
                { key: 'subtotal', label: 'Subtotal' },
                { key: 'shippingCost', label: 'Shipping' },
                { key: 'discount', label: 'Discount' },
                { key: 'grandTotal', label: 'Grandtotal' },
                { key: 'cost', label: 'Cost' },
                { key: 'margin', label: 'Margin' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-r border-slate-100 last:border-0"
                >
                  <div className="flex items-center space-x-1">
                    <span>{col.label}</span>
                    <ArrowUpDown className={cn("w-2 h-2", sortBy === col.key ? "text-black" : "text-slate-200")} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-xs text-slate-400">Loading Orders...</td></tr>
            ) : error ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-red-500 text-xs font-bold">{error}</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={12} className="px-4 py-12 text-center text-xs text-slate-400 uppercase font-bold tracking-tighter opacity-50">No Orders found</td></tr>
            ) : orders.map(order => {
                const subtotal = calculateTotal(order);
                const shipping = order.shippingCost || 0;
                const discount = order.discount || 0;
                const tax = order.tax || 0;
                const grandTotal = subtotal + shipping + tax - discount;
                const cost = calculateCost(order);
                const margin = grandTotal - cost;

                return (
                  <tr
                    key={order._id}
                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                    onClick={() => router.push(`/sales/wholesale-orders/${order._id}`)}
                  >
                    <td className="px-2 py-1.5 text-[10px] font-bold text-slate-900 tracking-tight font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px] border-r border-slate-50">{order.label || '-'}</td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono border-r border-slate-50">{formatDate(order.createdAt)}</td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] border-r border-slate-50">{renderClient(order)}</td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] border-r border-slate-50">
                        {typeof order.salesRep === 'object' && order.salesRep !== null 
                            ? `${order.salesRep.firstName} ${order.salesRep.lastName}` 
                            : (order.salesRep || '-')}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-500 border-r border-slate-50">{order.paymentMethod || '-'}</td>
                    <td className="px-2 py-1.5 border-r border-slate-50">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded-none text-[8px] font-bold uppercase",
                        order.orderStatus === 'Shipped' ? "bg-green-100 text-green-700" :
                        order.orderStatus === 'Completed' ? "bg-blue-100 text-blue-700" :
                        order.orderStatus === 'Processing' ? "bg-orange-100 text-orange-700" :
                        "bg-slate-100 text-slate-600"
                      )}>
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px] font-bold text-slate-900 font-mono text-right border-r border-slate-50">
                      {formatCurrency(subtotal)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono text-right border-r border-slate-50">
                        {formatCurrency(shipping)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-500 font-mono text-right border-r border-slate-50">
                        {formatCurrency(discount)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] font-black text-slate-900 bg-slate-50 font-mono text-right border-r border-slate-50">
                        {formatCurrency(grandTotal)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-600 font-mono text-right border-r border-slate-50">
                        {formatCurrency(cost)}
                    </td>
                    <td className={cn("px-2 py-1.5 text-[10px] font-bold font-mono text-right", margin < 0 ? "text-red-500" : "text-green-600")}>
                        {formatCurrency(margin)}
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={totalOrders}
        itemsPerPage={20}
        itemName="Orders"
      />

      {/* Create / Edit Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-none shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h2 className="text-sm font-bold uppercase text-slate-900">{editingOrderId ? 'Edit Sale Order' : 'Create Sale Order'}</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <form id="create-so-form" onSubmit={handleCreateOrUpdate}>
                {/* Header Info */}
                <div className="space-y-6">
                    {/* Basic Info */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">Order Details</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Order Name/ID <span className="text-red-500">*</span></label>
                                <input
                                type="text"
                                required
                                readOnly
                                value={newOrder.label}
                                className="w-full px-3 py-2 border border-slate-200 rounded text-sm bg-slate-100 text-slate-500 focus:outline-none cursor-not-allowed"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Client <span className="text-red-500">*</span></label>
                                <SearchableSelect
                                options={allClients.map(c => ({ value: c._id, label: c.name }))}
                                value={newOrder.clientId}
                                onChange={handleClientChange}
                                placeholder="Select Client..."
                                required
                                className="w-full"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Sales Rep</label>
                                <SearchableSelect
                                    options={allUsers.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id }))}
                                    value={newOrder.salesRep}
                                    onChange={(val) => setNewOrder({ ...newOrder, salesRep: val })}
                                    placeholder="Select Rep..."
                                    className="w-full"
                                />
                            </div>
                            {/* Status is hidden and defaults to Pending */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Payment Method</label>
                                <SearchableSelect
                                    options={PAYMENT_METHODS}
                                    value={newOrder.paymentMethod}
                                    onChange={(val) => setNewOrder({ ...newOrder, paymentMethod: val })}
                                    placeholder="Select Method..."
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Shipping Info */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">Shipping Details</h4>
                        <div className="grid grid-cols-3 gap-4">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Shipping Method</label>
                                <SearchableSelect
                                    options={SHIPPING_METHODS}
                                    value={newOrder.shippingMethod}
                                    onChange={(val) => setNewOrder({ ...newOrder, shippingMethod: val })}
                                    creatable
                                    placeholder="Select Method..."
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Tracking #</label>
                                <input
                                type="text"
                                value={newOrder.trackingNumber}
                                onChange={e => setNewOrder({ ...newOrder, trackingNumber: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Shipped Date</label>
                                <input
                                type="date"
                                value={newOrder.shippedDate ? new Date(newOrder.shippedDate).toISOString().split('T')[0] : ''}
                                onChange={e => setNewOrder({ ...newOrder, shippedDate: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                />
                            </div>
                             <div className="col-span-3 grid grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Address</label>
                                    <input
                                    type="text"
                                    value={newOrder.shippingAddress}
                                    onChange={e => setNewOrder({ ...newOrder, shippingAddress: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    placeholder="Street Address"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">City</label>
                                    <input
                                    type="text"
                                    value={newOrder.city}
                                    onChange={e => setNewOrder({ ...newOrder, city: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">State</label>
                                    <input
                                    type="text"
                                    value={newOrder.state}
                                    onChange={e => setNewOrder({ ...newOrder, state: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financials */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">Financials</h4>
                        <div className="grid grid-cols-4 gap-4 items-end">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Shipping Cost</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                    <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newOrder.shippingCost}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setNewOrder({ ...newOrder, shippingCost: e.target.value })}
                                    className="w-full pl-5 pr-2 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Discount</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                    <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newOrder.discount}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setNewOrder({ ...newOrder, discount: e.target.value })}
                                    className="w-full pl-5 pr-2 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">Tax</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                    <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newOrder.tax}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setNewOrder({ ...newOrder, tax: e.target.value })}
                                    className="w-full pl-5 pr-2 py-2 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                    placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 pb-2">
                                <div className="flex items-center space-x-3">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Lock Price</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer"
                                            checked={newOrder.lockPrice}
                                            onChange={e => setNewOrder({...newOrder, lockPrice: e.target.checked})}
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-black/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Line Items</h3>
                    <div className="flex items-center space-x-2">
                        <button
                        type="button"
                        onClick={addLineItem}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-none text-[10px] font-bold uppercase transition-colors"
                        >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Item</span>
                        </button>
                    </div>
                  </div>

                  {newLineItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-none border border-dashed border-slate-200 text-slate-400">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm mb-3">
                        <Package className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-xs font-medium">No items added yet</p>
                      <button
                        type="button"
                        onClick={addLineItem}
                        className="mt-3 text-xs font-bold text-blue-600 hover:underline"
                      >
                        Add your first item
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-none">
                      <table className="w-full text-left border-collapse border-b border-slate-200">
                        <thead className="bg-slate-50 text-slate-500">
                           <tr>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[35%] border-r border-slate-200">Item / SKU</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[15%] border-r border-slate-200">Lot #</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[10%] border-r border-slate-200">UOM</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[10%] border-r border-slate-200">Qty</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[15%] border-r border-slate-200">Price</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[10%] text-right border-r border-slate-200">Total</th>
                              <th className="px-2 py-2 w-[5%] bg-white"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 bg-white">
                          {newLineItems.map((item, index) => (
                            <tr key={item.id} className="group">
                                <td className="p-0 border-r border-slate-200">
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
                                        />
                                    </div>
                                </td>
                                <td className="p-0 border-r border-slate-200">
                                    <div 
                                        className="w-full h-[32px] px-2 flex items-center cursor-pointer hover:bg-slate-50 transition-colors"
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
                                        <span className={cn("text-xs truncate block w-full", !item.lotNumber ? "text-slate-400 italic" : "text-slate-700 font-mono")}>
                                            {item.lotNumber || "Select"}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-0 border-r border-slate-200">
                                     <SearchableSelect
                                        options={UOM_OPTIONS}
                                        value={item.uom}
                                        onChange={(val) => updateLineItem(item.id, 'uom', val)}
                                        placeholder="UOM"
                                        creatable
                                        className="w-full rounded-none border-none focus:ring-0"
                                    />
                                </td>
                                <td className="p-0 border-r border-slate-200">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.qtyShipped}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => updateLineItem(item.id, 'qtyShipped', parseInt(e.target.value) || 0)}
                                      className="w-full h-[32px] px-2 text-sm focus:outline-none focus:bg-blue-50/50 transition-colors font-mono rounded-none"
                                    />
                                </td>
                                <td className="p-0 border-r border-slate-200">
                                    <div className="relative h-full w-full">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={item.price}
                                          onWheel={(e) => e.currentTarget.blur()}
                                          onChange={(e) => updateLineItem(item.id, 'price', parseFloat(e.target.value) || 0)}
                                          className="w-full h-[32px] pl-5 pr-2 text-sm focus:outline-none focus:bg-blue-50/50 transition-colors font-mono text-right rounded-none"
                                        />
                                    </div>
                                </td>
                                <td className="px-2 py-0 align-middle text-right border-r border-slate-200 bg-slate-50/30">
                                    <span className="text-xs font-bold text-slate-700 font-mono">
                                        {formatCurrency((item.qtyShipped || 0) * (item.price || 0))}
                                    </span>
                                </td>
                                <td className="p-0 text-center align-middle">
                                    <button
                                      type="button"
                                      onClick={() => removeLineItem(item.id)}
                                      className="w-full h-[32px] flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                      title="Remove Item"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50">
                            <tr>
                                <td colSpan={5} className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase text-right tracking-wider border-r border-slate-200">Subtotal</td>
                                <td className="px-2 py-2 text-xs font-black text-slate-900 font-mono text-right border-r border-slate-200">
                                    {formatCurrency(newLineItems.reduce((sum, item) => sum + ((item.qtyShipped || 0) * (item.price || 0)), 0))}
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
              <button
                type="submit"
                form="create-so-form"
                className="px-6 py-2.5 bg-black text-white text-xs font-bold uppercase rounded hover:bg-slate-800 transition-colors"
              >
                {editingOrderId ? 'Save Changes' : 'Create Order'}
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
        currentLotNumber={newLineItems.find(i => i.id === editingLotItemId)?.lotNumber || ''}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 uppercase mb-2">Confirm Delete</h3>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Are you sure you want to delete this order? This action cannot be undone.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setDeleteConfirm({ isOpen: false, orderId: null })}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold uppercase rounded hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase rounded hover:bg-red-700 transition-colors"
                >
                  Delete Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
