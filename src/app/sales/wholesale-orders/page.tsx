'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Plus,
  Trash2,
  X,
  Pencil,
  AlertCircle,
  Printer,
  RefreshCw,
  Loader2,
  Package,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TableColumnHeader } from '@/components/ui/TableColumnHeader';
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
    productDescription?: string;
    _originalSkuLabel?: string; // To handle legacy display
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
  payments?: { paymentAmount: number }[];
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

function SaleOrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  // Filter Options
  const [clientOptions, setClientOptions] = useState<{ label: string; value: string }[]>([]);
  const [salesRepOptions, setSalesRepOptions] = useState<{ label: string; value: string }[]>([]);
  const [statusOptions, setStatusOptions] = useState<{ label: string; value: string }[]>([]);

  // Create/Edit Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);

  const [allClients, setAllClients] = useState<{ _id: string; name: string; salesPerson?: { _id: string; firstName: string; lastName: string } | string | null; addresses?: { street: string; city: string; state: string }[] }[]>([]);
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
    orderStatus: 'Picking',
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
        const res = await fetch('/api/clients?limit=5000');
        if (res.ok) {
          const data = await res.json();
          const clients_list = data.clients || [];
          setAllClients(clients_list);
          setClientOptions(clients_list.map((c: any) => ({ label: c.name, value: c._id })));
        }

        // Skus (Fetch all, no limit/filter to ensure legacy/other categories appear)
        const sRes = await fetch('/api/skus?limit=5000');
        if (sRes.ok) {
          const data = await sRes.json();
          // Do NOT filter by category, user needs to see all variants/types
          setAllSkus(data.skus || []);
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

  // Handle createFor URL parameter (auto-open modal with client pre-selected)
  useEffect(() => {
    const createForClientId = searchParams.get('createFor');
    if (createForClientId) {
      
      const initializeForClient = (client: any) => {
        // Get sales rep - handle both object and string formats
        let salesRepId = '';
        if (client.salesPerson) {
            if (typeof client.salesPerson === 'object' && client.salesPerson._id) {
                salesRepId = client.salesPerson._id;
            } else if (typeof client.salesPerson === 'string') {
                salesRepId = client.salesPerson;
            }
        }
        
        // Get address from client
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
        setNewLineItems([]);
        setEditingOrderId(null);
        setIsCreateModalOpen(true);
        
        // Clear the URL parameter without navigation
        router.replace('/sales/wholesale-orders', { scroll: false });
      };

      // First try to find in loaded clients, otherwise fetch
      const found = allClients.find(c => c._id === createForClientId);
      if (found) {
          initializeForClient(found);
      } else {
           fetch(`/api/clients/${createForClientId}`)
            .then(res => res.json())
            .then(data => {
                if (data && data._id) {
                    initializeForClient(data);
                }
            })
            .catch(err => console.error("Failed to fetch client for creation", err));
      }
    }
  }, [searchParams, allClients, router]);

  // Handle createNew URL parameter (from header Add button)
  useEffect(() => {
    const createNew = searchParams.get('createNew');
    if (createNew === 'true') {
      openCreateModal();
      // Clear the URL parameter without navigation
      router.replace('/sales/wholesale-orders', { scroll: false });
    }
  }, [searchParams, router]);

  // Handle syncCosts URL parameter (from header Sync Costs button)
  useEffect(() => {
    const syncCosts = searchParams.get('syncCosts');
    if (syncCosts === 'true') {
      handleSyncCosts();
      // Clear the URL parameter without navigation
      router.replace('/sales/wholesale-orders', { scroll: false });
    }
  }, [searchParams, router]);

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
      if (selectedPaymentMethods.length) params.append('paymentMethod', selectedPaymentMethods.join(','));
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
  }, [page, debouncedSearch, sortBy, sortOrder, selectedClients, selectedSalesReps, selectedSkus, selectedStatuses, selectedPaymentMethods, dateRange]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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
      sku: typeof item.sku === 'object' && item.sku ? item.sku._id : (item.sku ? String(item.sku) : ''),
      qtyShipped: item.qtyShipped,
      price: item.price,
      cost: (item as any).cost || 0,
      uom: item.uom || 'Each',
      lotNumber: item.lotNumber || '',
      productDescription: (item as any).productDescription,
      _originalSkuLabel: typeof item.sku === 'object' && item.sku ? item.sku.name : ((item as any).productDescription || (item.sku ? String(item.sku) : ''))
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
        orderStatus: 'Picking',
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
    // Initialize with 3 empty items
    setNewLineItems([
        { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' },
        { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' },
        { id: Math.random().toString(), sku: '', qtyShipped: 1, price: 0, cost: 0, uom: 'Each', lotNumber: '' }
    ]);
    setIsCreateModalOpen(true);
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!newOrder.clientId) {
      toast.error('Please select a client');
      return;
    }
    if (!newOrder.salesRep) {
      toast.error('Sales Rep is required');
      return;
    }
    if (!newOrder.shippingAddress) {
      toast.error('Address is required');
      return;
    }

    if (newLineItems.length === 0) {
      toast.error('At least 1 line item is required');
      return;
    }
    // Validate each line item has a SKU
    const invalidItems = newLineItems.filter(item => !item.sku);
    if (invalidItems.length > 0) {
      toast.error('All line items must have a SKU selected');
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
        const batchSize = 500;
        let hasMore = total > 0;

        // Cumulative stats
        let totalProcessed = 0;
        let totalLineItems = 0;
        let totalMatched = 0;
        let totalUpdated = 0;
        let sources = { openingBalance: 0, purchaseOrder: 0, manufacturing: 0, auditAdjustment: 0 };

        while (hasMore) {
            const perc = total > 0 ? Math.min(Math.round((skip / total) * 100), 99) : 0;
            setSyncStatus(`${perc}% | Orders: ${totalProcessed}/${total} | Items: ${totalLineItems} | Matched: ${totalMatched} | Updated: ${totalUpdated}`);

            const res = await fetch('/api/wholesale/orders/sync-costs', {
                method: 'POST',
                body: JSON.stringify({ skip, limit: batchSize }),
                headers: {'Content-Type': 'application/json'}
            });
            
            if (!res.ok) throw new Error("Sync failed");
            const data = await res.json();
             
            // Accumulate stats
            totalProcessed += data.processed || 0;
            totalUpdated += data.updated || 0;
            if (data.stats) {
                totalLineItems += data.stats.totalLineItems || 0;
                totalMatched += data.stats.matchedItems || 0;
                if (data.stats.sources) {
                    sources.openingBalance += data.stats.sources.openingBalance || 0;
                    sources.purchaseOrder += data.stats.sources.purchaseOrder || 0;
                    sources.manufacturing += data.stats.sources.manufacturing || 0;
                    sources.auditAdjustment += data.stats.sources.auditAdjustment || 0;
                }
            }

            // Update status with latest stats
            setSyncStatus(`${Math.min(Math.round((totalProcessed / total) * 100), 99)}% | Orders: ${totalProcessed}/${total} | Items: ${totalLineItems} | Matched: ${totalMatched} | Updated: ${totalUpdated}`);

            // If processed 0, we are done
            if (data.processed === 0) {
                 hasMore = false;
            }

            skip += batchSize;
            if (data.processed < batchSize) {
                hasMore = false;
            }
        }
        
        setSyncStatus(`✓ Complete! Orders: ${totalProcessed} | Items: ${totalLineItems} | Matched: ${totalMatched} | Updated: ${totalUpdated} | OB:${sources.openingBalance} PO:${sources.purchaseOrder} MFG:${sources.manufacturing} ADJ:${sources.auditAdjustment}`);
        toast.success(`Cost Sync Complete! Updated ${totalUpdated} items.`);
        fetchOrders(); // Refresh current view
        
        setTimeout(() => setSyncStatus(''), 8000);

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
    return '$' + val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 });
  };
  
  const handleClientChange = (clientId: string) => {
      const client: any = allClients.find((c: any) => c._id === clientId);
      if (client) {
          // Use 'addresses' array from Client Schema (default to first one)
          const mainAddress = client.addresses && client.addresses.length > 0 
              ? client.addresses[0] 
              : { street: '', city: '', state: '' };
          
          // Get sales rep from client - handle both object and string formats
          // API returns populated object { _id, firstName, lastName } or null
          let salesRepId = '';
          if (client.salesPerson) {
              if (typeof client.salesPerson === 'object' && client.salesPerson._id) {
                  salesRepId = client.salesPerson._id;
              } else if (typeof client.salesPerson === 'string') {
                  salesRepId = client.salesPerson;
              }
          }
          
          setNewOrder(prev => ({
              ...prev,
              clientId,
              salesRep: salesRepId || prev.salesRep,
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
    <div className="flex flex-col h-[calc(100vh-36px)] bg-background relative transition-colors duration-300">
      <div className="flex-1 overflow-x-hidden overflow-y-auto scrollbar-custom bg-background/50 relative">
        <div className="min-w-full px-2 py-2">
            <table className="w-full text-left border-separate border-spacing-0 relative z-0">
          <thead className="sticky top-0 bg-secondary/80 z-10 border-b border-border backdrop-blur-md transition-colors">
            <tr>
              {/* Order # - Text search */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="label"
                  title="Order #"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  textFilter={search}
                  onTextFilterChange={(_key, value) => setSearch(value)}
                  className="text-muted-foreground"
                />
              </th>
              {/* Date - Date range */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="createdAt"
                  title="Date"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  isDate
                  dateFrom={dateRange.from}
                  dateTo={dateRange.to}
                  onDateFilterChange={(_key, from, to) => setDateRange({ from, to })}
                  className="text-muted-foreground"
                />
              </th>
              {/* Client - Multi-select */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="clientId"
                  title="Client"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={clientOptions}
                  selectedFilters={selectedClients}
                  onFilterChange={(_key, values) => setSelectedClients(values)}
                  className="text-muted-foreground"
                />
              </th>
              {/* Sales Rep - Multi-select */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="salesRep"
                  title="Sales Rep"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={salesRepOptions}
                  selectedFilters={selectedSalesReps}
                  onFilterChange={(_key, values) => setSelectedSalesReps(values)}
                  className="text-muted-foreground"
                />
              </th>
              {/* Payment Method - Multi-select */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="paymentMethod"
                  title="Payment Method"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={PAYMENT_METHODS}
                  selectedFilters={selectedPaymentMethods}
                  onFilterChange={(_key, values) => setSelectedPaymentMethods(values)}
                  className="text-muted-foreground"
                />
              </th>
              {/* Status - Multi-select */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="orderStatus"
                  title="Status"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  filterOptions={statusOptions}
                  selectedFilters={selectedStatuses}
                  onFilterChange={(_key, values) => setSelectedStatuses(values)}
                  className="text-muted-foreground"
                />
              </th>
              {/* Subtotal */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="subtotal"
                  title="Subtotal"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Shipping */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="shippingCost"
                  title="Shipping"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Discount */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="discount"
                  title="Discount"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Grandtotal */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="grandTotal"
                  title="Grandtotal"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Balance */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="balance"
                  title="Balance"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Cost */}
              <th className="border-r border-border">
                <TableColumnHeader
                  column="cost"
                  title="Cost"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
              {/* Margin */}
              <th className="border-r border-border last:border-0">
                <TableColumnHeader
                  column="margin"
                  title="Margin"
                  currentSortBy={sortBy}
                  currentSortOrder={sortOrder}
                  onSort={(key, dir) => { setSortBy(key); setSortOrder(dir); }}
                  className="text-muted-foreground"
                />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-background/50">
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

                const orderPaid = (order.payments || []).reduce((sum, p) => sum + (p.paymentAmount || 0), 0);
                const balance = grandTotal - orderPaid;

                return (
                  <tr
                    key={order._id}
                    className="group relative z-0 bg-background transition-colors duration-150"
                  >
                    <td className="px-2 py-1.5 border-r border-border group-hover:border-l-2 group-hover:border-l-primary transition-all">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold text-foreground tracking-tight font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px]">{order.label || '-'}</span>
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => router.push(`/sales/wholesale-orders/${order._id}`)}
                            className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary rounded transition-colors cursor-pointer"
                            title="View Order"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleEditClick(e, order)}
                            className="p-1 text-muted-foreground hover:text-primary hover:bg-secondary rounded transition-colors cursor-pointer"
                            title="Edit Order"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono border-r border-border">{formatDate(order.createdAt)}</td>
                    <td className="px-2 py-1.5 text-[10px] text-foreground font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] border-r border-border">{renderClient(order)}</td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px] border-r border-border">
                        {typeof order.salesRep === 'object' && order.salesRep !== null 
                            ? `${order.salesRep.firstName} ${order.salesRep.lastName}` 
                            : (order.salesRep || '-')}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground border-r border-border">{order.paymentMethod || '-'}</td>
                    <td className="px-2 py-1.5 border-r border-border text-center">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                        order.orderStatus === 'Completed' ? "bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/30" :
                        order.orderStatus === 'Issued' ? "bg-sky-500/15 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400 border border-sky-500/30" :
                        order.orderStatus === 'Pending Payment' ? "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/30" :
                        order.orderStatus === 'Shipping' ? "bg-violet-500/15 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-500/30" :
                        order.orderStatus === 'Picking' ? "bg-cyan-500/15 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 border border-cyan-500/30" :
                        "bg-muted text-muted-foreground border border-border"
                      )}>
                        {order.orderStatus}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-[10px] font-bold text-foreground font-mono text-right border-r border-border">
                      {formatCurrency(subtotal)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono text-right border-r border-border">
                        {formatCurrency(shipping)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono text-right border-r border-border">
                        {formatCurrency(discount)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] font-black text-foreground bg-secondary/10 font-mono text-right border-r border-border">
                        {formatCurrency(grandTotal)}
                    </td>
                    <td className={cn("px-2 py-1.5 text-[10px] font-bold font-mono text-right border-r border-border", balance > 0.01 ? "text-destructive" : "text-emerald-500")}>
                        {formatCurrency(balance)}
                    </td>
                    <td className="px-2 py-1.5 text-[10px] text-muted-foreground font-mono text-right border-r border-border">
                        {formatCurrency(cost)}
                    </td>
                    <td className={cn("px-2 py-1.5 text-[10px] font-bold font-mono text-right", margin < 0 ? "text-destructive" : "text-emerald-500")}>
                        {formatCurrency(margin)}
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      </div>
     </div>

      <div className="border-t border-border bg-background transition-colors duration-300">
        <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalOrders}
            itemsPerPage={20}
            itemName="Orders"
        />
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/20 shrink-0">
              <h2 className="text-sm font-bold uppercase text-foreground tracking-wider flex items-center gap-2">
                {editingOrderId ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingOrderId ? 'Edit Sale Order' : 'Create Sale Order'}
              </h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="create-so-form" onSubmit={handleCreateOrUpdate} className="space-y-8">
                {/* Header Info */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Column */}
                    <div className="col-span-8 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Client <span className="text-destructive">*</span></label>
                                <SearchableSelect
                                    options={allClients.map(c => ({ value: c._id, label: c.name }))}
                                    value={newOrder.clientId}
                                    onChange={handleClientChange}
                                    placeholder="Select Client..."
                                    className="w-full h-9 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Sales Rep <span className="text-destructive">*</span></label>
                                <SearchableSelect
                                    options={allUsers.map(u => ({ label: `${u.firstName} ${u.lastName}`, value: u._id }))}
                                    value={newOrder.salesRep}
                                    onChange={(val) => setNewOrder({ ...newOrder, salesRep: val })}
                                    placeholder="Select Rep..."
                                    className="w-full h-9 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Payment Method</label>
                                <SearchableSelect
                                    options={PAYMENT_METHODS}
                                    value={newOrder.paymentMethod}
                                    onChange={(val) => setNewOrder({ ...newOrder, paymentMethod: val })}
                                    placeholder="Select Method..."
                                    className="w-full h-9 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Order Status</label>
                                <SearchableSelect
                                    options={statusOptions.length > 0 ? statusOptions : [{ label: 'Picking', value: 'Picking' }]}
                                    value={newOrder.orderStatus}
                                    onChange={(val) => setNewOrder({ ...newOrder, orderStatus: val })}
                                    className="w-full h-9 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                />
                            </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Date</label>
                                <input
                                type="date"
                                disabled
                                className="w-full h-9 px-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-500 cursor-not-allowed"
                                value={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Column (Label/Meta) */}
                    <div className="col-span-4 bg-secondary/10 border border-border rounded p-4 space-y-4">
                        <div className="flex flex-col items-center justify-center h-full space-y-2">
                             <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Order Number (Auto)</div>
                             <div className="text-3xl font-black text-primary">{newOrder.label || '---'}</div>
                             <div className="flex items-center gap-2 mt-2">
                                 <span className={cn("px-2 py-0.5 text-[10px] uppercase font-bold rounded border",
                                     newOrder.orderStatus === 'Completed' ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                     newOrder.orderStatus === 'Pending Payment' ? "bg-amber-100 text-amber-700 border-amber-200" :
                                     "bg-slate-100 text-slate-700 border-slate-200"
                                 )}>
                                     {newOrder.orderStatus}
                                 </span>
                             </div>
                        </div>
                    </div>
                </div>

                    {/* Shipping Details */}
                    <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Shipping Details</h4>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Method</label>
                                <SearchableSelect
                                    options={SHIPPING_METHODS}
                                    value={newOrder.shippingMethod}
                                    onChange={(val) => setNewOrder({ ...newOrder, shippingMethod: val })}
                                    creatable
                                    placeholder="Select Method..."
                                    className="w-full h-9 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                />
                            </div>
                             <div className="col-span-2 space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tracking #</label>
                                <input
                                type="text"
                                value={newOrder.trackingNumber}
                                onChange={e => setNewOrder({ ...newOrder, trackingNumber: e.target.value })}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                />
                            </div>
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipped Date</label>
                                <input
                                type="date"
                                value={newOrder.shippedDate ? new Date(newOrder.shippedDate).toISOString().split('T')[0] : ''}
                                onChange={e => setNewOrder({ ...newOrder, shippedDate: e.target.value })}
                                className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                />
                            </div>
                             <div className="col-span-3">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Address <span className="text-destructive">*</span></label>
                                    <input
                                    type="text"
                                    value={newOrder.shippingAddress}
                                    onChange={e => setNewOrder({ ...newOrder, shippingAddress: e.target.value })}
                                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                    placeholder="Street Address, City, State, Zip"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Financials */}
                    <div>
                        <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3 pb-1 border-b border-border">Financials</h4>
                        <div className="grid grid-cols-4 gap-4 items-end">
                             <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Shipping Cost</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                    <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newOrder.shippingCost}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setNewOrder({ ...newOrder, shippingCost: e.target.value })}
                                    className="w-full h-9 pl-5 pr-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                    placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Discount</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                    <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newOrder.discount}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setNewOrder({ ...newOrder, discount: e.target.value })}
                                    className="w-full h-9 pl-5 pr-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                    placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tax</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                                    <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={newOrder.tax}
                                    onWheel={(e) => e.currentTarget.blur()}
                                    onChange={e => setNewOrder({ ...newOrder, tax: e.target.value })}
                                    className="w-full h-9 pl-5 pr-2 bg-white border border-slate-200 rounded text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-slate-900"
                                    placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 pb-2">
                                <div className="flex items-center space-x-3">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Lock Price</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer"
                                            checked={newOrder.lockPrice}
                                            onChange={e => setNewOrder({...newOrder, lockPrice: e.target.checked})}
                                        />
                                        <div className="w-9 h-5 bg-secondary peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer dark:bg-muted peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                <div className="border-t border-border pt-6">
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
                    <div className="flex flex-col items-center justify-center py-12 bg-secondary/10 rounded-none border border-dashed border-border text-muted-foreground">
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
                    <div className="border border-border rounded-none">
                      <table className="w-full text-left border-collapse border-b border-border">
                        <thead className="bg-secondary/50 text-muted-foreground">
                           <tr>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[25%] border-r border-border">Item / SKU</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[20%] border-r border-border">Description</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[12%] border-r border-border">Lot #</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[8%] border-r border-border">UOM</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[8%] border-r border-border">Qty</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[12%] border-r border-border">Price</th>
                              <th className="px-2 py-2 text-[9px] uppercase font-bold tracking-wider w-[10%] text-right border-r border-border">Total</th>
                              <th className="px-2 py-2 w-[5%] bg-card"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-border bg-card">
                          {newLineItems.map((item, index) => (
                            <tr key={item.id} className="group">
                                <td className="p-0 border-r border-border text-foreground">
                                    <div className="w-full h-full">
                                        <SearchableSelect
                                            options={(() => {
                                                  const available = allSkus.filter(s => !newLineItems.some(i => i.id !== item.id && i.sku === s._id));
                                                  const opts = available.map(s => ({ value: s._id, label: s.name }));
                                                  const isMissing = item.sku && !allSkus.find(s => s._id === item.sku);
                                                  const isLegacyDisplay = !item.sku && item._originalSkuLabel; 

                                                  if (isMissing) {
                                                      opts.push({ 
                                                          value: item.sku, 
                                                          label: item._originalSkuLabel || `Legacy: ${item.sku}` 
                                                      });
                                                  } else if (isLegacyDisplay) {
                                                      opts.push({
                                                          value: '',
                                                          label: item._originalSkuLabel || 'Unknown Item'
                                                      });
                                                  }
                                                  
                                                  return opts;
                                            })()}
                                            value={item.sku}
                                            onChange={(val) => updateLineItem(item.id, 'sku', val)}
                                            placeholder={item._originalSkuLabel || "Select SKU"}
                                            className="w-full rounded-none border-none text-xs focus:ring-0 bg-transparent text-foreground h-[32px]"
                                        />
                                    </div>
                                </td>
                                <td className="p-0 border-r border-border">
                                    <input
                                      type="text"
                                      value={item.productDescription || ''}
                                      onChange={(e) => updateLineItem(item.id, 'productDescription', e.target.value)}
                                      className="w-full h-[32px] px-2 text-xs focus:outline-none focus:bg-primary/5 transition-colors rounded-none bg-transparent text-foreground"
                                      placeholder="Description..."
                                    />
                                </td>
                                <td className="p-0 border-r border-border">
                                    <div 
                                        className="w-full h-[32px] px-2 flex items-center cursor-pointer hover:bg-secondary/30 transition-colors"
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
                                <td className="p-0 border-r border-border text-foreground">
                                     <SearchableSelect
                                        options={UOM_OPTIONS}
                                        value={item.uom}
                                        onChange={(val) => updateLineItem(item.id, 'uom', val)}
                                        placeholder="UOM"
                                        creatable
                                        className="w-full rounded-none border-none focus:ring-0 bg-transparent text-foreground h-[32px] text-xs"
                                    />
                                </td>
                                <td className="p-0 border-r border-border">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.qtyShipped}
                                      onWheel={(e) => e.currentTarget.blur()}
                                      onChange={(e) => updateLineItem(item.id, 'qtyShipped', parseInt(e.target.value) || 0)}
                                      className="w-full h-[32px] px-2 text-xs focus:outline-none focus:bg-primary/5 transition-colors font-mono rounded-none bg-transparent text-foreground"
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
                                          className="w-full h-[32px] pl-5 pr-2 text-xs focus:outline-none focus:bg-primary/5 transition-colors font-mono text-right rounded-none bg-transparent text-foreground"
                                        />
                                    </div>
                                </td>
                                <td className="px-2 py-0 align-middle text-right border-r border-border bg-secondary/10">
                                    <span className="text-xs font-bold text-foreground font-mono">
                                        {formatCurrency((item.qtyShipped || 0) * (item.price || 0))}
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
                        <tfoot className="bg-secondary/50">
                            <tr>
                                <td colSpan={6} className="px-2 py-2 text-[10px] font-bold text-muted-foreground uppercase text-right tracking-wider border-r border-border">Subtotal</td>
                                <td className="px-2 py-2 text-xs font-black text-foreground font-mono text-right border-r border-border">
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

            <div className="p-4 border-t border-border bg-secondary/50 flex justify-end shrink-0">
              <button
                type="submit"
                form="create-so-form"
                className="px-6 py-2.5 bg-primary text-primary-foreground text-xs font-bold uppercase rounded hover:bg-primary/90 transition-colors"
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

export default function SaleOrdersPage() {
    return (
        <Suspense fallback={<div className="p-8">Loading orders...</div>}>
            <SaleOrdersContent />
        </Suspense>
    );
}
