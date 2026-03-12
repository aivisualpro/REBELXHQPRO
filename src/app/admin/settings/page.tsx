'use client';

import React, { useState, useRef, useCallback, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Save,
    Globe,
    Building,
    Bell,
    Shield,
    Mail,
    Smartphone,
    MapPin,
    DollarSign,
    Clock,
    BarChart3,
    HelpCircle,
    Calendar,
    Filter,
    Image as ImageIcon,
    Layers,
    ShoppingCart,
    Warehouse,
    Upload,
    RefreshCw,
    FileSpreadsheet,
    Package,
    CreditCard,
    Scale,
    Truck,
    ClipboardCheck,
    FlaskConical,
    UtensilsCrossed,
    TicketCheck,
    PackageCheck,
    MessageSquare,
    Download,
    Search,
    Loader2,
    Plus,
    X,
    LayoutGrid,
    ChevronRight,
    ChevronDown,
    Eye,
    EyeOff,
    Pencil,
    Trash2,
    FolderOpen,
    Copy,
    Check,
    AlertTriangle,
    UsersRound,
    Database,
    Ticket,
    Settings
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { MODULE_BLUEPRINTS, generateDefaultModules } from '@/constants/workspace-modules';

type Tab = 'workspaces' | 'general' | 'localization' | 'crm' | 'notifications' | 'security' | 'dataFilter' | 'modules';
type ModuleSubTab = 'sales' | 'warehouse' | 'reports' | 'help';

// ─── Toggle Switch Component ─────────────────────────────────────────────────
function ToggleSwitch({ checked, onChange, size = 'md', activeColor = '#10b981' }: {
    checked: boolean;
    onChange: (val: boolean) => void;
    size?: 'sm' | 'md';
    activeColor?: string;
}) {
    const w = size === 'sm' ? 32 : 40;
    const h = size === 'sm' ? 18 : 22;
    const dot = size === 'sm' ? 14 : 18;
    const pad = 2;
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="cursor-pointer shrink-0 focus:outline-none"
            style={{
                position: 'relative',
                width: w,
                height: h,
                borderRadius: h / 2,
                backgroundColor: checked ? activeColor : 'hsl(var(--secondary))',
                border: checked ? `1px solid ${activeColor}` : '1px solid hsl(var(--border))',
                transition: 'background-color 0.2s ease, border-color 0.2s ease',
            }}
        >
            <span
                style={{
                    position: 'absolute',
                    top: pad,
                    left: checked ? w - dot - pad - 2 : pad,
                    width: dot,
                    height: dot,
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            />
        </button>
    );
}

// Module icon mapping
const MODULE_ICONS: Record<string, React.ElementType> = {
    admin: Settings,
    crm: UsersRound,
    sales: Truck,
    warehouse: Database,
    reports: BarChart3,
    help: HelpCircle,
};

function SettingsPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    // URL-synced tab state
    const activeTab = (searchParams.get('tab') as Tab) || 'workspaces';
    const moduleSubTab = (searchParams.get('moduleTab') as ModuleSubTab) || 'sales';

    // ── Workspace Management State ──
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [wsLoading, setWsLoading] = useState(false);
    const [wsEditing, setWsEditing] = useState<any>(null);
    const [wsFormOpen, setWsFormOpen] = useState(false);
    const [wsSaving, setWsSaving] = useState(false);
    const [wsDeleting, setWsDeleting] = useState<string | null>(null);
    const [wsFormData, setWsFormData] = useState({
        name: '',
        description: '',
        color: '#f2b61c',
        isDefault: false,
        modules: generateDefaultModules(),
    });
    const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
    const [expandedSubModules, setExpandedSubModules] = useState<Record<string, boolean>>({});

    // Fetch workspaces
    const fetchWorkspaces = useCallback(async () => {
        setWsLoading(true);
        try {
            const res = await fetch('/api/workspaces');
            if (res.ok) {
                const data = await res.json();
                setWorkspaces(data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch workspaces', error);
        } finally {
            setWsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'workspaces') {
            fetchWorkspaces();
        }
    }, [activeTab, fetchWorkspaces]);

    // Open create form
    const openCreateWorkspace = () => {
        setWsEditing(null);
        setWsFormData({
            name: '',
            description: '',
            color: '#f2b61c',
            isDefault: false,
            modules: generateDefaultModules(),
        });
        setExpandedModules({});
        setExpandedSubModules({});
        setWsFormOpen(true);
    };

    // Open edit form
    const openEditWorkspace = (ws: any) => {
        setWsEditing(ws);
        // Merge saved modules with blueprint to handle any new modules/sub-modules added
        const savedModules = ws.modules || [];
        const mergedModules = generateDefaultModules().map(blueprint => {
            const saved = savedModules.find((m: any) => m.key === blueprint.key);
            if (!saved) return blueprint;
            return {
                ...blueprint,
                enabled: saved.enabled,
                subModules: blueprint.subModules.map(subBp => {
                    const savedSub = (saved.subModules || []).find((s: any) => s.key === subBp.key);
                    if (!savedSub) return subBp;
                    return {
                        ...subBp,
                        enabled: savedSub.enabled,
                        crud: savedSub.crud || subBp.crud,
                        fields: subBp.fields.map(fBp => {
                            const savedField = (savedSub.fields || []).find((f: any) => f.field === fBp.field);
                            return savedField ? { ...fBp, visible: savedField.visible } : fBp;
                        }),
                    };
                }),
            };
        });
        setWsFormData({
            name: ws.name,
            description: ws.description || '',
            color: ws.color || '#f2b61c',
            isDefault: ws.isDefault || false,
            modules: mergedModules,
        });
        setExpandedModules({});
        setExpandedSubModules({});
        setWsFormOpen(true);
    };

    // Save workspace
    const handleWsSave = async () => {
        if (!wsFormData.name.trim()) {
            toast.error('Workspace name is required');
            return;
        }
        setWsSaving(true);
        try {
            const url = wsEditing ? `/api/workspaces/${wsEditing._id}` : '/api/workspaces';
            const method = wsEditing ? 'PUT' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(wsFormData),
            });
            if (res.ok) {
                toast.success(wsEditing ? 'Workspace updated' : 'Workspace created');
                setWsFormOpen(false);
                fetchWorkspaces();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to save workspace');
            }
        } catch (error) {
            toast.error('Failed to save workspace');
        } finally {
            setWsSaving(false);
        }
    };

    // Delete workspace
    const handleWsDelete = async (id: string) => {
        setWsDeleting(id);
        try {
            const res = await fetch(`/api/workspaces/${id}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success('Workspace deleted');
                fetchWorkspaces();
            } else {
                toast.error('Failed to delete workspace');
            }
        } catch (error) {
            toast.error('Failed to delete workspace');
        } finally {
            setWsDeleting(null);
        }
    };

    // Toggle module enabled
    const toggleModuleEnabled = (moduleKey: string) => {
        setWsFormData(prev => ({
            ...prev,
            modules: prev.modules.map(m =>
                m.key === moduleKey
                    ? {
                        ...m,
                        enabled: !m.enabled,
                        // When enabling a module, enable all sub-modules by default
                        subModules: m.subModules.map(s => ({
                            ...s,
                            enabled: !m.enabled ? true : s.enabled,
                        })),
                    }
                    : m
            ),
        }));
    };

    // Toggle sub-module enabled
    const toggleSubModuleEnabled = (moduleKey: string, subKey: string) => {
        setWsFormData(prev => ({
            ...prev,
            modules: prev.modules.map(m => {
                if (m.key !== moduleKey) return m;

                const updatedSubModules = m.subModules.map(s =>
                    s.key === subKey ? { ...s, enabled: !s.enabled } : s
                );
                
                // Enforce that parent module is enabled if any submodule is enabled
                const hasEnabledSub = updatedSubModules.some(s => s.enabled);

                return {
                    ...m,
                    enabled: m.enabled || hasEnabledSub,
                    subModules: updatedSubModules,
                };
            }),
        }));
    };

    // Toggle CRUD permission
    const toggleCrudPermission = (moduleKey: string, subKey: string, op: 'create' | 'read' | 'update' | 'delete') => {
        setWsFormData(prev => ({
            ...prev,
            modules: prev.modules.map(m =>
                m.key === moduleKey
                    ? {
                        ...m,
                        subModules: m.subModules.map(s =>
                            s.key === subKey
                                ? { ...s, crud: { ...s.crud, [op]: !s.crud[op] } }
                                : s
                        ),
                    }
                    : m
            ),
        }));
    };

    // Toggle field visibility
    const toggleFieldVisibility = (moduleKey: string, subKey: string, fieldName: string) => {
        setWsFormData(prev => ({
            ...prev,
            modules: prev.modules.map(m =>
                m.key === moduleKey
                    ? {
                        ...m,
                        subModules: m.subModules.map(s =>
                            s.key === subKey
                                ? {
                                    ...s,
                                    fields: s.fields.map(f =>
                                        f.field === fieldName ? { ...f, visible: !f.visible } : f
                                    ),
                                }
                                : s
                        ),
                    }
                    : m
            ),
        }));
    };

    // Enable all / Disable all for a module
    const setAllSubModules = (moduleKey: string, enabled: boolean) => {
        setWsFormData(prev => ({
            ...prev,
            modules: prev.modules.map(m =>
                m.key === moduleKey
                    ? {
                        ...m,
                        subModules: m.subModules.map(s => ({ ...s, enabled })),
                    }
                    : m
            ),
        }));
    };

    // Duplicate workspace
    const duplicateWorkspace = (ws: any) => {
        setWsEditing(null);
        const mergedModules = generateDefaultModules().map(blueprint => {
            const saved = (ws.modules || []).find((m: any) => m.key === blueprint.key);
            if (!saved) return blueprint;
            return {
                ...blueprint,
                enabled: saved.enabled,
                subModules: blueprint.subModules.map(subBp => {
                    const savedSub = (saved.subModules || []).find((s: any) => s.key === subBp.key);
                    if (!savedSub) return subBp;
                    return {
                        ...subBp,
                        enabled: savedSub.enabled,
                        crud: savedSub.crud || subBp.crud,
                        fields: subBp.fields.map(fBp => {
                            const savedField = (savedSub.fields || []).find((f: any) => f.field === fBp.field);
                            return savedField ? { ...fBp, visible: savedField.visible } : fBp;
                        }),
                    };
                }),
            };
        });
        setWsFormData({
            name: `${ws.name} (Copy)`,
            description: ws.description || '',
            color: ws.color || '#f2b61c',
            isDefault: false,
            modules: mergedModules,
        });
        setExpandedModules({});
        setExpandedSubModules({});
        setWsFormOpen(true);
    };

    const setActiveTab = useCallback((tab: Tab) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        params.delete('moduleTab');
        router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
    }, [searchParams, router]);

    const setModuleSubTab = useCallback((subTab: ModuleSubTab) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'modules');
        params.set('moduleTab', subTab);
        router.replace(`/admin/settings?${params.toString()}`, { scroll: false });
    }, [searchParams, router]);

    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [headerSearch, setHeaderSearch] = useState('');

    // Sales Import State
    const [importStatus, setImportStatus] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const importOrdersRef = useRef<HTMLInputElement>(null);
    const importLineItemsRef = useRef<HTMLInputElement>(null);
    const importPaymentsRef = useRef<HTMLInputElement>(null);
    const importNotesRef = useRef<HTMLInputElement>(null);

    // Sync Costs State
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');

    // Warehouse Import Refs
    const importSkusRef = useRef<HTMLInputElement>(null);
    const importVariancesRef = useRef<HTMLInputElement>(null);
    const importOpeningBalancesRef = useRef<HTMLInputElement>(null);
    const importVendorsRef = useRef<HTMLInputElement>(null);
    const importPurchaseOrdersRef = useRef<HTMLInputElement>(null);
    const importPoLineItemsRef = useRef<HTMLInputElement>(null);
    const importAuditAdjustmentsRef = useRef<HTMLInputElement>(null);
    const importLabResultsRef = useRef<HTMLInputElement>(null);
    const importRecipesRef = useRef<HTMLInputElement>(null);
    const importRecipeLineItemsRef = useRef<HTMLInputElement>(null);
    const importRecipeStepsRef = useRef<HTMLInputElement>(null);
    const importTicketsRef = useRef<HTMLInputElement>(null);
    const importKitsRef = useRef<HTMLInputElement>(null);
    const importKitLineItemsRef = useRef<HTMLInputElement>(null);
    const importMfgOrdersRef = useRef<HTMLInputElement>(null);
    const importMfgLineItemsRef = useRef<HTMLInputElement>(null);
    const importMfgLaborRef = useRef<HTMLInputElement>(null);
    const importMfgNotesRef = useRef<HTMLInputElement>(null);
    const importMfgQualityChecksRef = useRef<HTMLInputElement>(null);

    // Web Products Sync & Management
    const importWebProductsCsvRef = useRef<HTMLInputElement>(null);
    const [wpSyncStatus, setWpSyncStatus] = useState({
        isSyncing: false,
        currentStep: '',
        progress: 0,
        total: 0,
    });

    // Web Orders Sync
    const [woSyncStatus, setWoSyncStatus] = useState({
        isSyncing: false,
        currentStep: '',
        progress: 0,
        total: 0,
        fetchingPhase: false,
        fetchingPage: 0,
        fetchingFound: 0,
        fetchingSite: '',
    });
    const [wpModalOpen, setWpModalOpen] = useState(false);
    const [wpSubmitting, setWpSubmitting] = useState(false);
    const [wpEditing, setWpEditing] = useState<any>(null);
    const wpInitialForm = {
        _id: '', webId: 0, sku_code: '', name: '', image: '', website: '',
        category: '', subCategory: '', materialType: '', uom: '',
        salePrice: 0, orderUpto: 0, reOrderPoint: 0, kitApplied: false, isLotApplied: false
    };
    const [wpFormData, setWpFormData] = useState(wpInitialForm);

    const [settings, setSettings] = useState({
        companyName: 'RebelX Headquarters',
        email: 'admin@rebelx.com',
        phone: '+1 (555) 000-0000',
        address: '123 Innovation Dr, Tech City, TC 90210',
        currency: 'USD',
        timezone: 'America/New_York',
        dateFormat: 'MM/DD/YYYY',
        emailAlerts: true,
        pushNotifications: false,
        twoFactor: true,
        filterDataFrom: '', // Global Date Filter
        missingSkuImage: '',
        crmMinRevenueSlab: '20'
    });

    React.useEffect(() => {
        fetchSettings();
    }, []);



    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (error) {
            console.error("Failed to load settings", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                toast.success('Settings saved successfully');
            } else {
                toast.error('Failed to save settings');
            }
        } catch (error) {
            console.error("Error saving settings", error);
            toast.error('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    // Handle CSV Import (same pattern as wholesale-orders)
    const handleImport = (e: React.ChangeEvent<HTMLInputElement>, endpoint: string, label: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = ''; // Reset input to allow re-upload

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const totalRows = results.data.length;
                if (totalRows === 0) {
                    toast.error('No data found in file');
                    return;
                }

                setIsImporting(true);
                const toastId = toast.loading(`Importing ${label} (0%)...`);
                setImportStatus(`Importing ${label}...`);
                let processed = 0;
                let successCount = 0;
                let errors: string[] = [];

                // Chunking for large imports
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
                            // Always log full response for debugging
                            console.log(`Import ${label} chunk ${i + 1} response:`, JSON.stringify(data, null, 2));
                            if (data.debug) {
                                console.log('CSV Headers:', data.debug.csvHeaders);
                                console.log('First row raw:', data.debug.firstRowRaw);
                                console.log('PaymentTerms samples:', data.debug.paymentTermsSamples);
                                console.log('Processed samples:', data.debug.processedSamples);
                            }
                        } else {
                            const err = await res.json();
                            errors.push(`Chunk ${i + 1}: ${err.error || 'Unknown error'}`);
                        }

                        processed += chunk.length;
                        const percent = Math.round((processed / totalRows) * 100);
                        toast.loading(`Importing ${label} (${processed}/${totalRows}) ${percent}%...`, { id: toastId });
                        setImportStatus(`Importing ${label}: ${percent}%`);
                    }

                    if (errors.length > 0) {
                        toast.error(`Import completed with errors. Success: ${successCount}. Failed chunks: ${errors.length}`, { id: toastId, duration: 5000 });
                        console.error('Import errors:', errors);
                        setImportStatus(`⚠️ Completed with errors: ${successCount} imported`);
                    } else {
                        toast.success(`Successfully imported ${successCount} ${label}`, { id: toastId });
                        setImportStatus(`✓ Imported ${successCount} ${label}`);
                    }

                } catch (e) {
                    toast.error('Import failed due to network or server error', { id: toastId });
                    setImportStatus('❌ Import failed');
                    console.error(e);
                } finally {
                    setIsImporting(false);
                    // Clear status after 5 seconds
                    setTimeout(() => setImportStatus(''), 5000);
                }
            }
        });
    };

    // Web Products Sync
    const handleWebProductSync = async (fullSync = false) => {
        try {
            const url = fullSync
                ? '/api/retail/web-products/sync?full=true'
                : '/api/retail/web-products/sync';
            const res = await fetch(url, { method: 'POST' });
            if (res.ok) {
                toast.success(fullSync ? 'Full sync started' : 'Incremental sync started');
                pollWebProductSyncProgress();
            } else {
                const err = await res.json();
                toast.error('Failed to start sync: ' + err.error);
            }
        } catch (e) {
            toast.error('Sync start error');
        }
    };

    const pollWebProductSyncProgress = useCallback(async () => {
        const timer = setInterval(async () => {
            try {
                const res = await fetch('/api/retail/web-products/sync');
                const data = await res.json();
                setWpSyncStatus(data);
                if (!data.isSyncing && (data.currentStep === 'Complete' || data.currentStep === 'Failed')) {
                    clearInterval(timer);
                    if (data.currentStep === 'Complete') {
                        toast.success('Web product sync completed successfully');
                    } else {
                        toast.error('Web product sync failed. Check details.');
                    }
                }
            } catch (e) {
                console.error('WP polling error:', e);
            }
        }, 1000);
    }, []);

    // Check initial web product sync status when on warehouse tab
    useEffect(() => {
        if (activeTab === 'modules' && moduleSubTab === 'warehouse') {
            fetch('/api/retail/web-products/sync').then(res => res.json()).then(data => {
                if (data.isSyncing) {
                    setWpSyncStatus(data);
                    pollWebProductSyncProgress();
                }
            }).catch(() => { });
            fetch('/api/retail/web-orders/sync').then(res => res.json()).then(data => {
                if (data.isSyncing) {
                    setWoSyncStatus(data);
                    pollWebOrderSyncProgress();
                }
            }).catch(() => { });
        }
    }, [activeTab, moduleSubTab, pollWebProductSyncProgress]);

    // Web Orders Sync
    const handleWebOrderSync = async (fullSync = false) => {
        try {
            const url = fullSync
                ? '/api/retail/web-orders/sync?full=true'
                : '/api/retail/web-orders/sync';
            const res = await fetch(url, { method: 'POST' });
            if (res.ok) {
                toast.success(fullSync ? 'Full order sync started' : 'Incremental order sync started');
                pollWebOrderSyncProgress();
            } else {
                const err = await res.json();
                toast.error('Failed to start sync: ' + err.error);
            }
        } catch (e) {
            toast.error('Sync start error');
        }
    };

    const pollWebOrderSyncProgress = useCallback(async () => {
        const timer = setInterval(async () => {
            try {
                const res = await fetch('/api/retail/web-orders/sync');
                const data = await res.json();
                setWoSyncStatus(data);
                if (!data.isSyncing && (data.currentStep === 'Complete' || data.currentStep === 'Failed')) {
                    clearInterval(timer);
                    if (data.currentStep === 'Complete') {
                        toast.success('Web order sync completed successfully');
                    } else {
                        toast.error('Web order sync failed.');
                    }
                }
            } catch (e) {
                console.error('WO polling error:', e);
            }
        }, 1000);
    }, []);

    // Web Products CSV Import
    const handleWebProductImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const loadingToast = toast.loading('Importing web products...');
                    const res = await fetch('/api/skus/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ skus: results.data })
                    });
                    toast.dismiss(loadingToast);
                    if (res.ok) {
                        const data = await res.json();
                        toast.success(`Imported/Updated ${data.count} items`);
                    } else {
                        const err = await res.json();
                        toast.error('Import failed: ' + err.error);
                    }
                } catch (e) {
                    toast.error('Import error');
                    console.error(e);
                }
            }
        });
    };

    // Web Product Add/Edit Submit
    const handleWebProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setWpSubmitting(true);
        try {
            const url = wpEditing ? `/api/retail/web-products/${wpEditing._id}` : '/api/retail/web-products';
            const method = wpEditing ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...wpFormData })
            });
            if (res.ok) {
                setWpModalOpen(false);
                toast.success(wpEditing ? 'Product updated' : 'Product created');
            } else {
                const err = await res.json();
                toast.error('Error: ' + (err.error || err.message));
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to save');
        } finally {
            setWpSubmitting(false);
        }
    };

    const tabs = [
        { id: 'workspaces', label: 'Workspaces', icon: LayoutGrid, keywords: 'workspaces permissions roles modules crud fields access control' },
        { id: 'general', label: 'General', icon: Building, keywords: 'company name email phone address support general' },
        { id: 'localization', label: 'Localization', icon: Globe, keywords: 'currency timezone date format locale localization language' },
        { id: 'dataFilter', label: 'Data Filter', icon: Calendar, keywords: 'data filter date range crm revenue' },
        { id: 'notifications', label: 'Notifications', icon: Bell, keywords: 'notifications email alerts sms push' },
        { id: 'security', label: 'Security', icon: Shield, keywords: 'security password authentication two-factor session' },
        { id: 'modules', label: 'Modules', icon: Layers, keywords: 'modules sales warehouse reports help import export sync vendors skus recipes kits manufacturing purchase orders lab results audit adjustments opening balances tickets' },
    ];

    const moduleSubTabs = [
        { id: 'sales', label: 'Sales', icon: ShoppingCart, keywords: 'sales orders import sync wholesale payments notes' },
        { id: 'warehouse', label: 'Warehouse', icon: Warehouse, keywords: 'warehouse skus vendors import export purchase orders kits recipes manufacturing lab results audit adjustments opening balances variances' },
        { id: 'reports', label: 'Reports', icon: BarChart3, keywords: 'reports analytics' },
        { id: 'help', label: 'Help', icon: HelpCircle, keywords: 'help tickets support' },
    ];

    // Filter tabs based on search
    const searchLower = headerSearch.toLowerCase().trim();
    const filteredTabs = searchLower
        ? tabs.filter(tab => tab.label.toLowerCase().includes(searchLower) || tab.keywords.includes(searchLower))
        : tabs;
    const filteredModuleSubTabs = searchLower
        ? moduleSubTabs.filter(tab => tab.label.toLowerCase().includes(searchLower) || tab.keywords.includes(searchLower))
        : moduleSubTabs;

    // Auto-navigate to first matching tab when search changes
    useEffect(() => {
        if (!searchLower) return;
        // If current tab is still in filtered results, stay on it
        if (filteredTabs.find(t => t.id === activeTab)) return;
        // Otherwise navigate to first match
        if (filteredTabs.length > 0) {
            setActiveTab(filteredTabs[0].id as Tab);
        }
    }, [searchLower]);

    // Auto-navigate module sub-tab when on modules tab and search changes
    useEffect(() => {
        if (!searchLower || activeTab !== 'modules') return;
        if (filteredModuleSubTabs.find(t => t.id === moduleSubTab)) return;
        if (filteredModuleSubTabs.length > 0) {
            setModuleSubTab(filteredModuleSubTabs[0].id as ModuleSubTab);
        }
    }, [searchLower, activeTab]);



    if (loading) {
        return <div className="p-8">Loading settings...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            {/* Page Header */}
            <div className="shrink-0 border-b border-border bg-card/80 backdrop-blur-sm">
                <div className="px-4 py-2.5 flex items-center gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                            <Settings className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <h1 className="text-[14px] font-black uppercase tracking-widest text-foreground">Settings</h1>
                    </div>
                    <div className="h-5 w-px bg-border shrink-0" />
                    <div className="relative shrink-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search settings..."
                            value={headerSearch}
                            onChange={e => setHeaderSearch(e.target.value)}
                            className="pl-8 pr-8 h-8 w-56 bg-background border border-border text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-muted-foreground text-foreground rounded"
                        />
                        {headerSearch && (
                            <button onClick={() => setHeaderSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-20 cursor-pointer">
                                <X className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    <div className="flex-1" />
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="h-8 px-4 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                        <Save className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-black uppercase tracking-widest">{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-card/50 border-r border-border flex flex-col pt-4 shrink-0">
                    <div className="px-5 mb-3">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Navigation</span>
                    </div>
                    {filteredTabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={cn(
                                    "flex items-center space-x-3 px-5 py-2.5 text-[12px] font-bold transition-all border-l-2 mx-2 rounded-r-lg",
                                    isActive
                                        ? "border-l-primary text-foreground bg-primary/10"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                                )}
                            >
                                <Icon className={cn("w-4 h-4", isActive && "text-primary")} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* WORKSPACES TAB */}
                        {activeTab === 'workspaces' && (
                            <div className="space-y-6">
                                {!wsFormOpen ? (
                                    /* ═══ WORKSPACE LIST VIEW ═══ */
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Workspaces</h2>
                                                <p className="text-xs text-muted-foreground mt-0.5">Create and manage permission workspaces for your team</p>
                                            </div>
                                            <button
                                                onClick={openCreateWorkspace}
                                                className="h-8 px-4 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span className="text-[11px] font-black uppercase tracking-widest">New Workspace</span>
                                            </button>
                                        </div>

                                        {/* SuperAdmin Badge */}
                                        <div className="p-4 border border-emerald-500/30 bg-emerald-950/40 rounded-lg flex items-start space-x-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                                                <Shield className="w-5 h-5 text-emerald-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-emerald-400">SuperAdmin Access</h4>
                                                <p className="text-xs text-emerald-400/70 mt-1">
                                                    SuperAdmin users have unrestricted access to all modules, sub-modules, and fields.
                                                    No workspace assignment is needed for SuperAdmin accounts.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Workspace Cards */}
                                        {wsLoading ? (
                                            <div className="flex items-center justify-center py-12">
                                                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                                <span className="ml-2 text-sm text-muted-foreground">Loading workspaces...</span>
                                            </div>
                                        ) : workspaces.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-border rounded-lg">
                                                <LayoutGrid className="w-12 h-12 text-muted-foreground/30 mb-3" />
                                                <p className="text-sm font-medium text-muted-foreground">No workspaces yet</p>
                                                <p className="text-xs text-muted-foreground/60 mt-1">Create your first workspace to define team permissions</p>
                                                <button
                                                    onClick={openCreateWorkspace}
                                                    className="mt-4 h-8 px-4 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span className="text-[11px] font-black uppercase tracking-widest">Create Workspace</span>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                {workspaces.map((ws) => {
                                                    const enabledModCount = (ws.modules || []).filter((m: any) => m.enabled).length;
                                                    const totalSubMods = (ws.modules || []).reduce((acc: number, m: any) => acc + (m.subModules || []).filter((s: any) => s.enabled).length, 0);
                                                    return (
                                                        <div
                                                            key={ws._id}
                                                            className="group relative border border-border rounded-lg p-5 hover:border-primary/30 transition-all bg-card hover:shadow-lg hover:shadow-primary/5"
                                                        >
                                                            {/* Color accent bar */}
                                                            <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-lg" style={{ backgroundColor: ws.color || '#f2b61c' }} />

                                                            <div className="flex items-start justify-between mt-1">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${ws.color || '#f2b61c'}25` }}>
                                                                        <LayoutGrid className="w-5 h-5" style={{ color: ws.color || '#f2b61c' }} />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h3 className="text-sm font-black text-foreground">{ws.name}</h3>
                                                                            {ws.isDefault && (
                                                                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-primary/20 text-primary rounded">
                                                                                    Default
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {ws.description && (
                                                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{ws.description}</p>
                                                                        )}
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => duplicateWorkspace(ws)}
                                                                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                                        title="Duplicate"
                                                                    >
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => openEditWorkspace(ws)}
                                                                        className="p-1.5 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleWsDelete(ws._id)}
                                                                        disabled={wsDeleting === ws._id}
                                                                        className="p-1.5 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                                                                        title="Delete"
                                                                    >
                                                                        {wsDeleting === ws._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Stats */}
                                                            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border/60">
                                                                <div className="flex items-center gap-1.5">
                                                                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    <span className="text-xs text-muted-foreground">
                                                                        <span className="font-bold text-foreground">{enabledModCount}</span> modules
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                                                                    <span className="text-xs text-muted-foreground">
                                                                        <span className="font-bold text-foreground">{totalSubMods}</span> sub-modules
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Module pills */}
                                                            <div className="flex flex-wrap gap-1.5 mt-3">
                                                                {(ws.modules || []).filter((m: any) => m.enabled).map((m: any) => (
                                                                    <span
                                                                        key={m.key}
                                                                        className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border border-border text-foreground/70 bg-secondary/80"
                                                                    >
                                                                        {m.label}
                                                                    </span>
                                                                ))}
                                                                {enabledModCount === 0 && (
                                                                    <span className="text-[10px] text-muted-foreground/50 italic">No modules enabled</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* ═══ WORKSPACE FORM/EDITOR ═══ */
                                    <div className="space-y-6">
                                        {/* Header */}
                                        <div className="flex items-center justify-between p-4 bg-card border border-border rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => setWsFormOpen(false)}
                                                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${wsFormData.color}25` }}>
                                                    <LayoutGrid className="w-4 h-4" style={{ color: wsFormData.color }} />
                                                </div>
                                                <div>
                                                    <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                                                        {wsEditing ? 'Edit Workspace' : 'New Workspace'}
                                                    </h2>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">Configure modules, permissions, and field visibility</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleWsSave}
                                                disabled={wsSaving}
                                                className="h-9 px-5 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                            >
                                                {wsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                <span className="text-[11px] font-black uppercase tracking-widest">{wsSaving ? 'Saving...' : 'Save Workspace'}</span>
                                            </button>
                                        </div>

                                        {/* Basic Info */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-border rounded-lg bg-card">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Workspace Name *</label>
                                                <input
                                                    type="text"
                                                    value={wsFormData.name}
                                                    onChange={e => setWsFormData(prev => ({ ...prev, name: e.target.value }))}
                                                    placeholder="e.g. Sales Team, Warehouse Crew"
                                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description</label>
                                                <input
                                                    type="text"
                                                    value={wsFormData.description}
                                                    onChange={e => setWsFormData(prev => ({ ...prev, description: e.target.value }))}
                                                    placeholder="Optional description"
                                                    className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50"
                                                />
                                            </div>
                                            <div className="flex gap-4">
                                                <div className="space-y-1.5 flex-1">
                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Color</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="color"
                                                            value={wsFormData.color}
                                                            onChange={e => setWsFormData(prev => ({ ...prev, color: e.target.value }))}
                                                            className="w-8 h-8 rounded border border-border cursor-pointer"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={wsFormData.color}
                                                            onChange={e => setWsFormData(prev => ({ ...prev, color: e.target.value }))}
                                                            className="flex-1 px-3 py-2 bg-background border border-border rounded text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/30"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Default</label>
                                                    <div className="mt-1.5">
                                                        <ToggleSwitch
                                                            checked={wsFormData.isDefault}
                                                            onChange={(val) => setWsFormData(prev => ({ ...prev, isDefault: val }))}
                                                            activeColor="hsl(var(--primary))"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Module Permission Builder */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <Layers className="w-4 h-4 text-primary" />
                                                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Module Permissions</h3>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">Enable modules → configure sub-modules → set CRUD → toggle fields</p>
                                            </div>

                                            {wsFormData.modules.map((mod) => {
                                                const ModIcon = MODULE_ICONS[mod.key] || Layers;
                                                const isExpanded = expandedModules[mod.key];
                                                const enabledSubs = mod.subModules.filter(s => s.enabled).length;
                                                const totalSubs = mod.subModules.length;

                                                return (
                                                    <div
                                                        key={mod.key}
                                                        className={cn(
                                                            "border rounded-lg overflow-hidden transition-all",
                                                            mod.enabled ? "border-border bg-card" : "border-border/30 opacity-50"
                                                        )}
                                                    >
                                                        {/* Module Header */}
                                                        <div className={cn(
                                                            "flex items-center gap-3 px-4 py-3 transition-colors border-b",
                                                            mod.enabled ? "bg-secondary/80 border-border" : "bg-secondary/30 border-transparent"
                                                        )}>
                                                            <button
                                                                onClick={() => setExpandedModules(prev => ({ ...prev, [mod.key]: !prev[mod.key] }))}
                                                                className="p-0.5 rounded hover:bg-secondary text-muted-foreground cursor-pointer"
                                                            >
                                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                            </button>
                                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${wsFormData.color}15` }}>
                                                                <ModIcon className="w-4 h-4" style={{ color: wsFormData.color }} />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold text-foreground">{mod.label}</span>
                                                                    {mod.enabled && (
                                                                        <span className="text-[10px] text-muted-foreground">
                                                                            {enabledSubs}/{totalSubs} sub-modules
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {mod.enabled && (
                                                                <div className="flex items-center gap-1.5 mr-2">
                                                                    <button
                                                                        onClick={() => setAllSubModules(mod.key, true)}
                                                                        className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-600/20 rounded hover:bg-emerald-600/30 cursor-pointer transition-colors"
                                                                    >
                                                                        All On
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setAllSubModules(mod.key, false)}
                                                                        className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400 bg-red-600/20 rounded hover:bg-red-600/30 cursor-pointer transition-colors"
                                                                    >
                                                                        All Off
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <ToggleSwitch
                                                                checked={mod.enabled}
                                                                onChange={() => toggleModuleEnabled(mod.key)}
                                                            />
                                                        </div>

                                                        {/* Sub-modules */}
                                                        {isExpanded && mod.enabled && (
                                                            <div className="border-t border-border">
                                                                {mod.subModules.map((sub) => {
                                                                    const subExpandKey = `${mod.key}.${sub.key}`;
                                                                    const isSubExpanded = expandedSubModules[subExpandKey];
                                                                    const isChildSub = sub.key.startsWith('wo-');

                                                                    return (
                                                                        <div key={sub.key} className={cn(
                                                                            "border-b border-border/60 last:border-b-0",
                                                                            sub.enabled ? "" : "opacity-40",
                                                                            isChildSub && "border-l-2 border-l-primary/20 ml-10 bg-secondary/20"
                                                                        )}>
                                                                            {/* Sub-module row */}
                                                                            <div className={cn(
                                                                                "flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors",
                                                                                isChildSub ? "pl-6" : "pl-14"
                                                                            )}>
                                                                                <button
                                                                                    onClick={() => setExpandedSubModules(prev => ({ ...prev, [subExpandKey]: !prev[subExpandKey] }))}
                                                                                    className="p-0.5 rounded hover:bg-secondary text-muted-foreground cursor-pointer"
                                                                                    disabled={!sub.enabled}
                                                                                >
                                                                                    {isSubExpanded && sub.enabled ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                </button>
                                                                                <span className="text-xs font-semibold text-foreground flex-1">
                                                                                    {isChildSub && <span className="text-muted-foreground mr-1.5">↳</span>}
                                                                                    {sub.label}
                                                                                </span>

                                                                                {/* CRUD Pills */}
                                                                                {sub.enabled && mod.key !== 'reports' && (
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        {(['create', 'update', 'delete'] as const).map(op => (
                                                                                            <button
                                                                                                key={op}
                                                                                                onClick={() => toggleCrudPermission(mod.key, sub.key, op)}
                                                                                                className={cn(
                                                                                                    "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer border",
                                                                                                    sub.crud[op]
                                                                                                        ? op === 'create' ? 'bg-emerald-600/25 text-emerald-400 border-emerald-500/40'
                                                                                                            : op === 'update' ? 'bg-amber-600/25 text-amber-400 border-amber-500/40'
                                                                                                                : 'bg-red-600/25 text-red-400 border-red-500/40'
                                                                                                        : 'bg-secondary/80 text-muted-foreground/30 border-border line-through'
                                                                                                )}
                                                                                            >
                                                                                                {op === 'create' ? 'Add' : op === 'update' ? 'Edit' : 'Delete'}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                )}

                                                                                <ToggleSwitch
                                                                                    checked={sub.enabled}
                                                                                    onChange={() => toggleSubModuleEnabled(mod.key, sub.key)}
                                                                                    size="sm"
                                                                                />
                                                                            </div>

                                                                            {/* Field Permissions */}
                                                                            {isSubExpanded && sub.enabled && sub.fields.length > 0 && (
                                                                                <div className="bg-background/60 px-4 py-3 pl-20 border-t border-border/40">
                                                                                    <div className="flex items-center gap-2 mb-2.5">
                                                                                        <Eye className="w-3 h-3 text-muted-foreground" />
                                                                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Field Visibility</span>
                                                                                    </div>
                                                                                    <div className="flex flex-wrap gap-1.5">
                                                                                        {sub.fields.map(field => (
                                                                                            <button
                                                                                                key={field.field}
                                                                                                onClick={() => toggleFieldVisibility(mod.key, sub.key, field.field)}
                                                                                                className={cn(
                                                                                                    "flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold rounded-md transition-all cursor-pointer border",
                                                                                                    field.visible
                                                                                                        ? 'bg-card border-border text-foreground hover:border-red-500/40'
                                                                                                        : 'bg-red-950/30 border-red-500/30 text-red-400 line-through hover:border-emerald-500/40'
                                                                                                )}
                                                                                            >
                                                                                                {field.visible ? <Eye className="w-3 h-3 text-emerald-500" /> : <EyeOff className="w-3 h-3 text-red-400" />}
                                                                                                {field.label}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Bottom Save Button */}
                                        <div className="flex items-center justify-between pt-4 border-t border-border">
                                            <button
                                                onClick={() => setWsFormOpen(false)}
                                                className="h-8 px-4 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all rounded-lg flex items-center gap-1.5 cursor-pointer text-[11px] font-bold uppercase tracking-widest"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleWsSave}
                                                disabled={wsSaving}
                                                className="h-8 px-6 bg-primary text-black hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                            >
                                                {wsSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                <span className="text-[11px] font-black uppercase tracking-widest">{wsSaving ? 'Saving...' : 'Save Workspace'}</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* GENERAL TAB */}
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                {/* ... existing General Tab content (re-rendered here or kept but we need to ensure it uses the state correctly) ... */}
                                {/* To avoid deleting existing content, I will just replicate the general tab structure if this tool replaces full blocks, 
                                    but wait, I am replacing the Function Body basically. I should be careful. 
                                    Actually I should use "replace_file_content" more targeted or rewrite the main parts.
                                    The "ReplacementContent" above is currently replacing everything from start of component to end of tabs definition? 
                                    Wait, the previous file had a lot of JSX.
                                    The prompt implies I should rewrite the component to handle the new logic. 
                                    I will write the FULL component again to be safe and ensure all tabs are there. 
                                */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg">
                                        <Building className="w-4 h-4 text-primary" />
                                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Company Details</h2>
                                    </div>
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground">Company Name</label>
                                            <div className="relative">
                                                <Building className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    value={settings.companyName}
                                                    onChange={e => setSettings({ ...settings, companyName: e.target.value })}
                                                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                                                />
                                            </div>
                                        </div>
                                        {/* ... other general fields ... */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground">Support Email</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                                    <input
                                                        type="email"
                                                        value={settings.email}
                                                        onChange={e => setSettings({ ...settings, email: e.target.value })}
                                                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-muted-foreground">Phone</label>
                                                <div className="relative">
                                                    <Smartphone className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                                    <input
                                                        type="text"
                                                        value={settings.phone}
                                                        onChange={e => setSettings({ ...settings, phone: e.target.value })}
                                                        className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground">Address</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                                <input
                                                    type="text"
                                                    value={settings.address}
                                                    onChange={e => setSettings({ ...settings, address: e.target.value })}
                                                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* LOCALIZATION TAB */}
                        {activeTab === 'localization' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg">
                                        <Globe className="w-4 h-4 text-primary" />
                                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Regional Settings</h2>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground">Default Currency</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                                <select
                                                    value={settings.currency}
                                                    onChange={e => setSettings({ ...settings, currency: e.target.value })}
                                                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring appearance-none"
                                                >
                                                    <option value="USD">USD ($)</option>
                                                    <option value="EUR">EUR (€)</option>
                                                    <option value="GBP">GBP (£)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-muted-foreground">Timezone</label>
                                            <div className="relative">
                                                <Clock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                                <select
                                                    value={settings.timezone}
                                                    onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                                                    className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring appearance-none"
                                                >
                                                    <option value="America/New_York">Eastern Time (US & Canada)</option>
                                                    <option value="America/Chicago">Central Time (US & Canada)</option>
                                                    <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                                    <option value="Europe/London">London</option>
                                                    <option value="Asia/Tokyo">Tokyo</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground">Date Format</label>
                                        <div className="space-y-2">
                                            {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map(fmt => (
                                                <label key={fmt} className="flex items-center space-x-3 cursor-pointer p-3 border border-border rounded hover:bg-secondary/50 transition-colors">
                                                    <input
                                                        type="radio"
                                                        name="dateFormat"
                                                        value={fmt}
                                                        checked={settings.dateFormat === fmt}
                                                        onChange={e => setSettings({ ...settings, dateFormat: e.target.value })}
                                                        className="text-foreground focus:ring-black"
                                                    />
                                                    <span className="text-sm font-medium text-muted-foreground">{fmt} <span className="text-muted-foreground text-xs ml-2">(e.g. {formatDate()})</span></span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* DATA FILTER TAB */}
                        {activeTab === 'dataFilter' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg">
                                        <Calendar className="w-4 h-4 text-primary" />
                                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Global Data Filtering</h2>
                                    </div>
                                    <div className="p-4 border border-blue-500/30 bg-blue-950/40 rounded-lg flex items-start space-x-4 mb-4">
                                        <div className="shrink-0 mt-0.5">
                                            <Filter className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-400">Start Date Filter</h4>
                                            <p className="text-xs text-blue-400/70 mt-1">
                                                All data in the system (SKUs, Orders, Tickets, etc.) created BEFORE this date will be hidden from views.
                                                Leave empty to show all history.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-muted-foreground">Filter Data From (Start Date)</label>
                                        <div className="relative max-w-sm">
                                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="date"
                                                value={settings.filterDataFrom || ''}
                                                onChange={e => setSettings({ ...settings, filterDataFrom: e.target.value })}
                                                className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring"
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">
                                            Select a date to hide older records.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* NOTIFICATIONS TAB */}
                        {activeTab === 'notifications' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg">
                                        <Bell className="w-4 h-4 text-primary" />
                                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Alert Preferences</h2>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-full bg-blue-950/40 flex items-center justify-center">
                                                    <Mail className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">Email Notifications</p>
                                                    <p className="text-xs text-muted-foreground">Receive daily summaries and critical alerts via email.</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.emailAlerts}
                                                    onChange={e => setSettings({ ...settings, emailAlerts: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-foreground"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                                                    <Bell className="w-5 h-5 text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-foreground">Push Notifications</p>
                                                    <p className="text-xs text-muted-foreground">Real-time alerts via browser or mobile app.</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.pushNotifications}
                                                    onChange={e => setSettings({ ...settings, pushNotifications: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-foreground"></div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SECURITY TAB */}
                        {activeTab === 'security' && (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 p-3 bg-card border border-border rounded-lg">
                                        <Shield className="w-4 h-4 text-primary" />
                                        <h2 className="text-sm font-black uppercase tracking-widest text-foreground">Access Control</h2>
                                    </div>

                                    <div className="p-4 border border-orange-500/30 bg-orange-950/40 rounded-lg flex items-start space-x-4">
                                        <Shield className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-orange-400">Two-Factor Authentication (2FA)</h4>
                                            <p className="text-xs text-orange-400/70 mt-1">Enforce 2FA for all admin accounts to enhance security.</p>
                                        </div>
                                        <div className="ml-auto">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.twoFactor}
                                                    onChange={e => setSettings({ ...settings, twoFactor: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-secondary peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-secondary/50 rounded-lg text-center">
                                        <p className="text-xs text-muted-foreground mb-3">Want to change your password?</p>
                                        <button className="px-4 py-2 border border-border bg-background text-muted-foreground text-xs font-bold uppercase rounded shadow-sm hover:bg-secondary/50 transition-colors">
                                            Reset Profile Password
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* MODULES TAB */}
                        {activeTab === 'modules' && (
                            <div className="space-y-6">
                                {/* Sub-tabs for modules */}
                                <div className="flex items-center space-x-1 border-b border-border pb-0">
                                    {filteredModuleSubTabs.map(tab => {
                                        const Icon = tab.icon;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setModuleSubTab(tab.id as ModuleSubTab)}
                                                className={cn(
                                                    "flex items-center space-x-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px",
                                                    moduleSubTab === tab.id
                                                        ? "border-foreground text-foreground"
                                                        : "border-transparent text-muted-foreground hover:text-muted-foreground"
                                                )}
                                            >
                                                <Icon className="w-4 h-4" />
                                                <span>{tab.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>



                                {/* Sales Module Settings */}
                                {moduleSubTab === 'sales' && (
                                    <div className="space-y-6 animate-in fade-in duration-200">
                                        {/* Hidden File Inputs */}
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
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importPaymentsRef}
                                            onChange={(e) => handleImport(e, '/api/wholesale/orders/import-payments', 'Payments')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importNotesRef}
                                            onChange={(e) => handleImport(e, '/api/wholesale/orders/import-notes', 'Notes')}
                                        />

                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Wholesale Orders Import</h2>

                                            {/* Status Display */}
                                            {importStatus && (
                                                <div className={cn(
                                                    "p-3 rounded-lg text-sm font-medium",
                                                    importStatus.startsWith('✓') ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" :
                                                        importStatus.startsWith('⚠️') ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                                            importStatus.startsWith('❌') ? "bg-red-500/10 text-red-700 border border-red-500/20" :
                                                                "bg-blue-950/40 text-blue-400 border border-blue-500/30"
                                                )}>
                                                    {isImporting && <RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />}
                                                    {importStatus}
                                                </div>
                                            )}

                                            <div className="p-4 border border-blue-500/30 bg-blue-950/40 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Upload className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-blue-400">Data Import</h4>
                                                    <p className="text-xs text-blue-400 mt-1">
                                                        Import wholesale orders data from CSV files. Orders use <code className="bg-blue-500/20 px-1 rounded">legacyId</code> for matching -
                                                        existing records will be updated, new records will be created.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Import Orders */}
                                                <button
                                                    onClick={() => importOrdersRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-blue-400 hover:bg-blue-950/40 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-colors">
                                                        <FileSpreadsheet className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Orders</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Order headers, client, status, dates
                                                    </p>
                                                </button>

                                                {/* Import Line Items */}
                                                <button
                                                    onClick={() => importLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-purple-400 hover:bg-purple-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-3 group-hover:bg-purple-500/30 transition-colors">
                                                        <Package className="w-6 h-6 text-purple-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Line Items</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        SKUs, quantities, prices, lots
                                                    </p>
                                                </button>

                                                {/* Import Payments */}
                                                <button
                                                    onClick={() => importPaymentsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-emerald-400 hover:bg-emerald-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:bg-emerald-500/30 transition-colors">
                                                        <CreditCard className="w-6 h-6 text-emerald-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Payments</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Payment amounts, dates
                                                    </p>
                                                </button>

                                                {/* Import Notes */}
                                                <button
                                                    onClick={() => importNotesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-blue-400 hover:bg-blue-950/40 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-colors">
                                                        <MessageSquare className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Notes</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Order notes, comments
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] text-muted-foreground">
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Orders:</span>
                                                        <p>legacyId, label, clientId, salesRep, orderStatus, paymentMethod, shippedDate, shippingMethod, trackingNumber, shippingCost, tax, category, shippingAddress, city, state, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Line Items:</span>
                                                        <p>orderNumber (legacyId), sku, qtyShipped, price, uom, lotNumber, cost</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Payments:</span>
                                                        <p>orderNumber (legacyId), paymentAmount, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Notes:</span>
                                                        <p>legacyId (parent order), note, createdBy, createdAt</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sync Costs Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Cost Synchronization</h2>

                                            <div className="p-4 border border-amber-500/30 bg-amber-950/40 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <RefreshCw className="w-5 h-5 text-amber-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-400">Sync Costs</h4>
                                                    <p className="text-xs text-amber-400 mt-1">
                                                        Scan all wholesale orders and update line item costs by matching SKU lot numbers from Opening Balances,
                                                        Purchase Orders, Manufacturing, and Audit Adjustments. This process runs in batches of 500 orders.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Sync Status Display */}
                                            {syncStatus && (
                                                <div className={cn(
                                                    "p-3 rounded-lg text-sm font-medium font-mono",
                                                    syncStatus.startsWith('✓') ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" :
                                                        syncStatus === 'Error' ? "bg-red-500/10 text-red-700 border border-red-500/20" :
                                                            "bg-blue-950/40 text-blue-400 border border-blue-500/30"
                                                )}>
                                                    {isSyncing && <RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />}
                                                    {syncStatus}
                                                </div>
                                            )}

                                            <button
                                                onClick={async () => {
                                                    if (isSyncing) return;
                                                    setIsSyncing(true);
                                                    setSyncStatus('Starting...');

                                                    try {
                                                        const countRes = await fetch('/api/wholesale/orders?limit=1');
                                                        const countData = await countRes.json();
                                                        const total = countData.total || 0;

                                                        let skip = 0;
                                                        const batchSize = 500;
                                                        let hasMore = total > 0;

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
                                                                headers: { 'Content-Type': 'application/json' }
                                                            });

                                                            if (!res.ok) throw new Error('Sync failed');
                                                            const data = await res.json();

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

                                                            setSyncStatus(`${Math.min(Math.round((totalProcessed / total) * 100), 99)}% | Orders: ${totalProcessed}/${total} | Items: ${totalLineItems} | Matched: ${totalMatched} | Updated: ${totalUpdated}`);

                                                            if (data.processed === 0) hasMore = false;
                                                            skip += batchSize;
                                                            if (data.processed < batchSize) hasMore = false;
                                                        }

                                                        setSyncStatus(`✓ Complete! Orders: ${totalProcessed} | Items: ${totalLineItems} | Matched: ${totalMatched} | Updated: ${totalUpdated} | OB:${sources.openingBalance} PO:${sources.purchaseOrder} MFG:${sources.manufacturing} ADJ:${sources.auditAdjustment}`);
                                                        toast.success(`Cost Sync Complete! Updated ${totalUpdated} items.`);
                                                        setTimeout(() => setSyncStatus(''), 8000);
                                                    } catch (e) {
                                                        toast.error('Sync process failed');
                                                        setSyncStatus('Error');
                                                    } finally {
                                                        setIsSyncing(false);
                                                    }
                                                }}
                                                disabled={isSyncing}
                                                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed w-full max-w-xs"
                                            >
                                                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                    <RefreshCw className={cn("w-6 h-6 text-amber-400", isSyncing && "animate-spin")} />
                                                </div>
                                                <h4 className="text-sm font-bold text-muted-foreground">{isSyncing ? 'Syncing...' : 'Sync Costs'}</h4>
                                                <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                    Update all order line item costs
                                                </p>
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Warehouse Module Settings */}
                                {moduleSubTab === 'warehouse' && (
                                    <div className="space-y-6 animate-in fade-in duration-200">

                                        {/* Web Products Sync & Management */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Web Products Sync & Management</h2>

                                            {/* Sync Progress */}
                                            {wpSyncStatus.isSyncing && (
                                                <div className="bg-primary px-4 py-3 flex items-center justify-between text-black animate-in slide-in-from-top duration-300 rounded-lg shadow-md">
                                                    <div className="flex items-center space-x-3 flex-1">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">{wpSyncStatus.currentStep}</span>
                                                        {wpSyncStatus.total > 0 && (
                                                            <div className="flex-1 max-w-sm bg-black/10 h-1.5 rounded-full overflow-hidden mx-6">
                                                                <div
                                                                    className="bg-black h-full transition-all duration-500"
                                                                    style={{ width: `${(wpSyncStatus.progress / wpSyncStatus.total) * 100}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest ml-4">
                                                        {wpSyncStatus.total > 0 ? `${Math.round((wpSyncStatus.progress / wpSyncStatus.total) * 100)}% (${wpSyncStatus.progress}/${wpSyncStatus.total})` : 'Initializing...'}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="p-4 border border-blue-500/30 bg-blue-950/40 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Globe className="w-5 h-5 text-blue-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-blue-400">WooCommerce Sync</h4>
                                                    <p className="text-xs text-blue-400 mt-1">
                                                        Sync web products from all connected WooCommerce stores. <strong>Incremental</strong> only syncs recently changed products. <strong>Full</strong> re-syncs everything from scratch.
                                                    </p>
                                                </div>
                                            </div>

                                            <input
                                                type="file"
                                                accept=".csv"
                                                className="hidden"
                                                ref={importWebProductsCsvRef}
                                                onChange={handleWebProductImport}
                                            />

                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                {/* Incremental Sync */}
                                                <button
                                                    onClick={() => handleWebProductSync(false)}
                                                    disabled={wpSyncStatus.isSyncing}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-blue-400 hover:bg-blue-950/40 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-colors">
                                                        {wpSyncStatus.isSyncing ? <Loader2 className="w-6 h-6 text-blue-600 animate-spin" /> : <Globe className="w-6 h-6 text-blue-400" />}
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Sync</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Incremental - changed products only
                                                    </p>
                                                </button>

                                                {/* Full Sync */}
                                                <button
                                                    onClick={() => handleWebProductSync(true)}
                                                    disabled={wpSyncStatus.isSyncing}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                        <Globe className="w-6 h-6 text-amber-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Full Sync</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        All products from scratch
                                                    </p>
                                                </button>

                                                {/* Import CSV */}
                                                <button
                                                    onClick={() => importWebProductsCsvRef.current?.click()}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-teal-400 hover:bg-teal-500/10 transition-colors group"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center mb-3 group-hover:bg-teal-500/30 transition-colors">
                                                        <Upload className="w-6 h-6 text-teal-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import CSV</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Import products from CSV file
                                                    </p>
                                                </button>

                                                {/* Add Product */}
                                                <button
                                                    onClick={() => {
                                                        setWpEditing(null);
                                                        setWpFormData(wpInitialForm);
                                                        setWpModalOpen(true);
                                                    }}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/10 transition-colors group"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-3 group-hover:bg-primary/30 transition-colors">
                                                        <Plus className="w-6 h-6 text-primary" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Add Product</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Manually add a web product
                                                    </p>
                                                </button>
                                            </div>
                                        </div>

                                        {/* ─── Web Orders Sync ─── */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Web Orders Sync</h2>

                                            {/* Sync Progress */}
                                            {woSyncStatus.isSyncing && (
                                                <div className="bg-primary px-4 py-3 flex items-center justify-between text-black animate-in slide-in-from-top duration-300 rounded-lg shadow-md">
                                                    <div className="flex items-center space-x-3 flex-1">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                            {woSyncStatus.fetchingPhase ? `Fetching ${woSyncStatus.fetchingSite}...` : woSyncStatus.currentStep}
                                                        </span>
                                                        {woSyncStatus.total > 0 && (
                                                            <div className="flex-1 max-w-sm bg-black/10 h-1.5 rounded-full overflow-hidden mx-6">
                                                                <div
                                                                    className="bg-black h-full transition-all duration-500"
                                                                    style={{ width: `${(woSyncStatus.progress / woSyncStatus.total) * 100}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] font-black uppercase tracking-widest ml-4">
                                                        {woSyncStatus.fetchingPhase
                                                            ? `Page ${woSyncStatus.fetchingPage} · ${woSyncStatus.fetchingFound} found`
                                                            : woSyncStatus.total > 0 ? `${Math.round((woSyncStatus.progress / woSyncStatus.total) * 100)}% (${woSyncStatus.progress}/${woSyncStatus.total})` : 'Initializing...'}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="p-4 border border-purple-500/20 bg-purple-500/10 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <ShoppingCart className="w-5 h-5 text-purple-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-purple-600 dark:text-purple-400">WooCommerce Orders Sync</h4>
                                                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                                        Sync web orders from all connected WooCommerce stores. <strong>Incremental</strong> only syncs recently changed orders. <strong>Full</strong> re-syncs everything from scratch.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                {/* Incremental Sync */}
                                                <button
                                                    onClick={() => handleWebOrderSync(false)}
                                                    disabled={woSyncStatus.isSyncing}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-purple-400 hover:bg-purple-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-3 group-hover:bg-purple-500/30 transition-colors">
                                                        {woSyncStatus.isSyncing ? <Loader2 className="w-6 h-6 text-purple-600 animate-spin" /> : <ShoppingCart className="w-6 h-6 text-purple-600" />}
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Sync Orders</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Incremental - changed orders only
                                                    </p>
                                                </button>

                                                {/* Full Sync */}
                                                <button
                                                    onClick={() => handleWebOrderSync(true)}
                                                    disabled={woSyncStatus.isSyncing}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                        <ShoppingCart className="w-6 h-6 text-amber-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Full Sync</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        All orders from scratch
                                                    </p>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Hidden File Inputs for SKU Import */}
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importSkusRef}
                                            onChange={(e) => handleImport(e, '/api/skus/import', 'SKUs')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importVariancesRef}
                                            onChange={(e) => handleImport(e, '/api/skus/import-variances', 'Variances')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importVendorsRef}
                                            onChange={(e) => handleImport(e, '/api/vendors/import', 'Vendors')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importPurchaseOrdersRef}
                                            onChange={(e) => handleImport(e, '/api/purchase-orders/import', 'Purchase Orders')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importPoLineItemsRef}
                                            onChange={(e) => handleImport(e, '/api/purchase-orders/import-lineitems', 'PO Line Items')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importAuditAdjustmentsRef}
                                            onChange={(e) => handleImport(e, '/api/audit-adjustments/import', 'Audit Adjustments')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importRecipesRef}
                                            onChange={(e) => handleImport(e, '/api/recipes/import', 'Recipes')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importRecipeLineItemsRef}
                                            onChange={(e) => handleImport(e, '/api/recipes/import-lineitems', 'Recipe Line Items')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importRecipeStepsRef}
                                            onChange={(e) => handleImport(e, '/api/recipes/import-steps', 'Recipe Steps')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importMfgOrdersRef}
                                            onChange={(e) => handleImport(e, '/api/manufacturing/import', 'Manufacturing Orders')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importMfgLineItemsRef}
                                            onChange={(e) => handleImport(e, '/api/manufacturing/import-lineitems', 'Manufacturing Line Items')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importMfgLaborRef}
                                            onChange={(e) => handleImport(e, '/api/manufacturing/import-labor', 'Manufacturing Labor')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importMfgNotesRef}
                                            onChange={(e) => handleImport(e, '/api/manufacturing/import-notes', 'Manufacturing Notes')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importMfgQualityChecksRef}
                                            onChange={(e) => handleImport(e, '/api/manufacturing/import-quality-checks', 'Manufacturing Quality Checks')}
                                        />

                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">System Defaults</h2>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs font-bold text-muted-foreground block mb-2">Missing SKU Image (Fallback)</label>
                                                    <div className="flex items-start space-x-4">
                                                        <div className="w-32 h-32 bg-secondary/50 border border-border rounded-lg flex items-center justify-center overflow-hidden relative group">
                                                            {settings.missingSkuImage ? (
                                                                <img src={settings.missingSkuImage} alt="Fallback" className="w-full h-full object-contain" />
                                                            ) : (
                                                                <ImageIcon className="w-8 h-8 text-muted-foreground" />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <label className="cursor-pointer text-white text-xs font-bold px-2 py-1 border border-white rounded hover:bg-background hover:text-foreground transition-colors">
                                                                    Change
                                                                    <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (!file) return;
                                                                        const toastId = toast.loading('Uploading...');
                                                                        const formData = new FormData();
                                                                        formData.append('file', file);
                                                                        try {
                                                                            const res = await fetch('/api/upload', { method: 'POST', body: formData });
                                                                            if (res.ok) {
                                                                                const data = await res.json();
                                                                                setSettings(prev => ({ ...prev, missingSkuImage: data.url }));
                                                                                toast.success('Uploaded', { id: toastId });
                                                                            } else {
                                                                                throw new Error('Upload failed');
                                                                            }
                                                                        } catch (err) {
                                                                            console.error(err);
                                                                            toast.error('Failed to upload', { id: toastId });
                                                                        }
                                                                    }} />
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                                This image will be displayed whenever a SKU&apos;s primary image is missing or fails to load.
                                                            </p>
                                                            {settings.missingSkuImage && (
                                                                <button
                                                                    onClick={() => setSettings(prev => ({ ...prev, missingSkuImage: '' }))}
                                                                    className="mt-2 text-[10px] text-red-600 hover:underline"
                                                                >
                                                                    Remove Default Image
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SKU Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">SKU Data Import</h2>

                                            {/* Status Display */}
                                            {importStatus && (
                                                <div className={cn(
                                                    "p-3 rounded-lg text-sm font-medium",
                                                    importStatus.startsWith('✓') ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" :
                                                        importStatus.startsWith('⚠️') ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                                                            importStatus.startsWith('❌') ? "bg-red-500/10 text-red-700 border border-red-500/20" :
                                                                "bg-blue-950/40 text-blue-400 border border-blue-500/30"
                                                )}>
                                                    {isImporting && <RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />}
                                                    {importStatus}
                                                </div>
                                            )}

                                            <div className="p-4 border border-teal-500/20 bg-teal-500/10 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Upload className="w-5 h-5 text-teal-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-teal-600 dark:text-teal-400">SKU Data Import</h4>
                                                    <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                                                        Import SKUs and Variances from CSV files. SKUs use <code className="bg-teal-500/20 px-1 rounded">legacyId</code> for matching -
                                                        existing records will be updated, new records will be created.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Import SKUs */}
                                                <button
                                                    onClick={() => importSkusRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-teal-400 hover:bg-teal-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center mb-3 group-hover:bg-teal-500/30 transition-colors">
                                                        <Package className="w-6 h-6 text-teal-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import SKUs</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Master product catalog data
                                                    </p>
                                                </button>

                                                {/* Import Variances */}
                                                <button
                                                    onClick={() => importVariancesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-orange-400 hover:bg-orange-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mb-3 group-hover:bg-orange-500/30 transition-colors">
                                                        <Layers className="w-6 h-6 text-orange-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Variances</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Product variants (sizes, colors)
                                                    </p>
                                                </button>

                                                {/* Import Vendors */}
                                                <button
                                                    onClick={() => importVendorsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-indigo-400 hover:bg-indigo-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mb-3 group-hover:bg-indigo-500/30 transition-colors">
                                                        <Truck className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Vendors</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Supplier list (legacyId, name, terms)
                                                    </p>
                                                </button>

                                                {/* Export Vendors */}
                                                <button
                                                    onClick={async () => {
                                                        const toastId = toast.loading('Exporting vendors...');
                                                        try {
                                                            const res = await fetch('/api/vendors?limit=99999');
                                                            if (!res.ok) throw new Error('Failed to fetch vendors');
                                                            const data = await res.json();
                                                            const vendors = data.vendors || [];
                                                            if (vendors.length === 0) {
                                                                toast.error('No vendors to export', { id: toastId });
                                                                return;
                                                            }
                                                            const csvData = vendors.map((v: any) => ({
                                                                legacyId: v.legacyId || '',
                                                                name: v.name || '',
                                                                contactName: v.contactName || '',
                                                                email: v.email || '',
                                                                phone: v.phone || '',
                                                                address: v.address || '',
                                                                city: v.city || '',
                                                                state: v.state || '',
                                                                zipCode: v.zipCode || '',
                                                                country: v.country || '',
                                                                website: v.website || '',
                                                                paymentTerms: v.paymentTerms || '',
                                                                carrierPreference: v.carrierPreference || '',
                                                                status: v.status || '',
                                                            }));
                                                            const csv = Papa.unparse(csvData);
                                                            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                                            const url = URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;
                                                            link.download = `vendors_export_${new Date().toISOString().split('T')[0]}.csv`;
                                                            link.click();
                                                            URL.revokeObjectURL(url);
                                                            toast.success(`Exported ${vendors.length} vendors`, { id: toastId });
                                                        } catch (err) {
                                                            console.error(err);
                                                            toast.error('Failed to export vendors', { id: toastId });
                                                        }
                                                    }}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-emerald-400 hover:bg-emerald-500/10 transition-colors group"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:bg-emerald-500/30 transition-colors">
                                                        <Download className="w-6 h-6 text-emerald-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Export Vendors</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Download all vendors as CSV
                                                    </p>
                                                </button>

                                                {/* Import POs */}
                                                <button
                                                    onClick={() => importPurchaseOrdersRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-blue-400 hover:bg-blue-950/40 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-3 group-hover:bg-blue-500/30 transition-colors">
                                                        <FileSpreadsheet className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import POs</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Purchase Orders (legacyId, vendor)
                                                    </p>
                                                </button>

                                                {/* Import PO Line Items */}
                                                <button
                                                    onClick={() => importPoLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-cyan-400 hover:bg-cyan-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center mb-3 group-hover:bg-cyan-200 transition-colors">
                                                        <ShoppingCart className="w-6 h-6 text-cyan-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import PO Lines</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Items for POs (poNumber, sku, qty)
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-6 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-muted-foreground">
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">SKUs:</span>
                                                        <p>legacyId, name, image, category, subCategory, materialType, uom, salePrice, orderUpto, reOrderPoint, kitApplied, isLotApplied</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Variances:</span>
                                                        <p>sku (or skuLegacyId), name, website, image</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Opening Balances Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Opening Balances Import</h2>

                                            <input
                                                type="file"
                                                accept=".csv"
                                                className="hidden"
                                                ref={importOpeningBalancesRef}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    e.target.value = '';
                                                    setIsImporting(true);
                                                    const toastId = toast.loading('Parsing opening balances...');

                                                    Papa.parse(file, {
                                                        header: true,
                                                        skipEmptyLines: true,
                                                        complete: async (results) => {
                                                            const rows = results.data as any[];
                                                            if (rows.length === 0) {
                                                                toast.error('No data found', { id: toastId });
                                                                setIsImporting(false);
                                                                return;
                                                            }

                                                            const BATCH_SIZE = 2000;
                                                            let totalImported = 0;
                                                            let allErrors: string[] = [];

                                                            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                                                                const batch = rows.slice(i, i + BATCH_SIZE);
                                                                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                                                                const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
                                                                toast.loading(`Importing batch ${batchNum}/${totalBatches} (${rows.length} total)...`, { id: toastId });

                                                                try {
                                                                    const res = await fetch('/api/opening-balances/import', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({ data: batch })
                                                                    });
                                                                    const data = await res.json();
                                                                    if (res.ok) {
                                                                        totalImported += data.count || 0;
                                                                        if (data.errors?.length) allErrors.push(...data.errors);
                                                                    } else {
                                                                        allErrors.push(`Batch ${batchNum}: ${data.error}`);
                                                                    }
                                                                } catch (err: any) {
                                                                    allErrors.push(`Batch ${batchNum}: ${err.message}`);
                                                                }
                                                            }

                                                            toast.success(`Imported ${totalImported} opening balances!`, { id: toastId });
                                                            if (allErrors.length > 0) {
                                                                setTimeout(() => toast.error(`${allErrors.length} errors. Check console.`), 1500);
                                                                console.error('Opening Balances import errors:', allErrors);
                                                            }
                                                            setIsImporting(false);
                                                        }
                                                    });
                                                }}
                                            />

                                            <div className="p-4 border border-indigo-500/20 bg-indigo-500/10 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Scale className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Opening Balances Import</h4>
                                                    <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
                                                        Import inventory opening balances from CSV. The <code className="bg-indigo-500/20 px-1 rounded">sku</code> column maps to SKU <code className="bg-indigo-500/20 px-1 rounded">legacyId</code> for matching.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => importOpeningBalancesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-indigo-400 hover:bg-indigo-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center mb-3 group-hover:bg-indigo-500/30 transition-colors">
                                                        <Upload className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Opening Balances</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Inventory starting quantities &amp; costs
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-muted-foreground">
                                                    <span className="font-bold text-muted-foreground">Opening Balances:</span>
                                                    <p>sku, lotNumber, qty, uom, cost, expirationDate, createdAt, createdBy</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Audit Adjustments Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Audit Adjustments Import</h2>

                                            <div className="p-4 border border-amber-500/30 bg-amber-950/40 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <ClipboardCheck className="w-5 h-5 text-amber-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-400">Audit Adjustments Import</h4>
                                                    <p className="text-xs text-amber-400 mt-1">
                                                        Import audit adjustments from CSV. The <code className="bg-amber-500/20 px-1 rounded">sku</code> column maps to SKU <code className="bg-amber-500/20 px-1 rounded">legacyId</code> for matching. New ObjectIds are generated for each record.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => importAuditAdjustmentsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                        <ClipboardCheck className="w-6 h-6 text-amber-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Audit Adjustments</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Inventory adjustments (qty corrections)
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-muted-foreground">
                                                    <span className="font-bold text-muted-foreground">Audit Adjustments:</span>
                                                    <p>sku (legacyId), lotNumber, qty, reason, createdBy, createdAt</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lab Results Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Lab Results Import</h2>

                                            <div className="p-4 border border-amber-500/30 bg-amber-950/40 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <FlaskConical className="w-5 h-5 text-amber-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-400">Lab Results Import</h4>
                                                    <p className="text-xs text-amber-400 mt-1">
                                                        Import lab results from CSV files. Records are matched by <code className="bg-amber-500/20 px-1 rounded">name</code> for upsert.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => importLabResultsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                        <FlaskConical className="w-6 h-6 text-amber-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Lab Results</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Product lab test results
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-muted-foreground">
                                                    <span className="font-bold text-muted-foreground">Lab Results:</span>
                                                    <p>name, variations, brand, labTestStatus, labResultDate, company, link</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recipes Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Recipes Import</h2>

                                            <div className="p-4 border border-amber-500/30 bg-amber-950/40 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <UtensilsCrossed className="w-5 h-5 text-amber-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-400">Recipes Import</h4>
                                                    <p className="text-xs text-amber-400 mt-1">
                                                        Import recipes, line items, and steps from CSV. The <code className="bg-amber-500/20 px-1 rounded">sku</code> column maps to SKU <code className="bg-amber-500/20 px-1 rounded">legacyId</code>. Recipe <code className="bg-amber-500/20 px-1 rounded">legacyId</code> is used for matching parent recipes.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button
                                                    onClick={() => importRecipesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                        <UtensilsCrossed className="w-6 h-6 text-amber-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Recipes</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Master recipe data
                                                    </p>
                                                </button>
                                                <button
                                                    onClick={() => importRecipeLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                        <Layers className="w-6 h-6 text-amber-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Recipe Items</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Ingredient line items
                                                    </p>
                                                </button>
                                                <button
                                                    onClick={() => importRecipeStepsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-amber-400 hover:bg-amber-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-3 group-hover:bg-amber-500/30 transition-colors">
                                                        <FileSpreadsheet className="w-6 h-6 text-amber-400" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Recipe Steps</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Process steps
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-muted-foreground space-y-1">
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Recipes:</span>
                                                        <p>legacyId, name, sku (legacyId), qty, uom, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Recipe Line Items:</span>
                                                        <p>recipeId (parent legacyId), sku (legacyId), qty, uom, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Recipe Steps:</span>
                                                        <p>recipeId (parent legacyId), step, description, details, createdBy, createdAt</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Product Kits Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Product Kits Import</h2>

                                            <div className="p-4 border border-teal-500/20 bg-teal-500/10 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <PackageCheck className="w-5 h-5 text-teal-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-teal-600 dark:text-teal-400">Product Kits Import</h4>
                                                    <p className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                                                        First import Kits (parent records), then import Kit Items to add line items to each kit.
                                                        The <code className="bg-teal-500/20 px-1 rounded">kitId</code> in items CSV should match the kit&apos;s <code className="bg-teal-500/20 px-1 rounded">legacyId</code>.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button
                                                    onClick={() => importKitsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-teal-400 hover:bg-teal-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center mb-3 group-hover:bg-teal-500/30 transition-colors">
                                                        <PackageCheck className="w-6 h-6 text-teal-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Product Kits</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Parent kit records
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importKitLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-teal-400 hover:bg-teal-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-teal-500/20 flex items-center justify-center mb-3 group-hover:bg-teal-500/30 transition-colors">
                                                        <PackageCheck className="w-6 h-6 text-teal-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Kit Items</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Line items for kits
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-muted-foreground space-y-1">
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Kits:</span>
                                                        <p>legacyId, name, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Kit Items:</span>
                                                        <p>kitId (parent legacyId), sku (SKU legacyId), qty</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Manufacturing Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Manufacturing Import</h2>

                                            <div className="p-4 border border-violet-500/20 bg-violet-500/10 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Truck className="w-5 h-5 text-violet-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-violet-600 dark:text-violet-400">Manufacturing Import</h4>
                                                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                                                        Import in order: Manufacturing Orders first, then Line Items, Labor, and Notes.
                                                        The <code className="bg-violet-500/20 px-1 rounded">woNumber</code> in sub-imports should match the order&apos;s <code className="bg-violet-500/20 px-1 rounded">legacyId</code>.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                                <button
                                                    onClick={() => importMfgOrdersRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-violet-400 hover:bg-violet-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-3 group-hover:bg-violet-500/30 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Orders</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Manufacturing orders
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-violet-400 hover:bg-violet-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-3 group-hover:bg-violet-500/30 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Line Items</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        WO line items
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgLaborRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-violet-400 hover:bg-violet-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-3 group-hover:bg-violet-500/30 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Labor</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Labor entries
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgNotesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-violet-400 hover:bg-violet-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-3 group-hover:bg-violet-500/30 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Notes</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        WO notes
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgQualityChecksRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-violet-400 hover:bg-violet-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-3 group-hover:bg-violet-500/30 transition-colors">
                                                        <ClipboardCheck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import QC</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Quality checks
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-muted-foreground space-y-1">
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Manufacturing Orders:</span>
                                                        <p>legacyId, label, sku (SKU legacyId), recipesId (Recipe legacyId), qty, uom, qtyDifference, scheduledStart, scheduledFinish, priority, status, createdBy, finishedBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Line Items:</span>
                                                        <p>woNumber (parent legacyId), lotNumber, recipeId (Recipe legacyId), sku (SKU legacyId), uom, recipeQty, sa, qtyExtra, qtyScrapped, createdAt, createdBy</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Labor:</span>
                                                        <p>woNumber (parent legacyId), type, user, duration, hourlyRate, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Notes:</span>
                                                        <p>woNumber (parent legacyId), note, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-muted-foreground">Quality Checks:</span>
                                                        <p>woNumber (parent legacyId), checkedBy, packagedBy, label, lot, seal, packageQuality, repackaged, weight, target, actualWeight, qualityCheckedBy, createdAt</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Web Product Add Modal */}
                                {wpModalOpen && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                                        <div className="bg-background w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh] rounded border border-border">
                                            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/50 shrink-0">
                                                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
                                                    {wpEditing ? 'Edit Product' : 'Add New Web Product'}
                                                </h2>
                                                <button onClick={() => setWpModalOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                                <form id="wp-form" onSubmit={handleWebProductSubmit} className="space-y-6">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Name <span className="text-destructive">*</span></label>
                                                            <input type="text" required value={wpFormData.name} onChange={e => setWpFormData({ ...wpFormData, name: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Website <span className="text-destructive">*</span></label>
                                                            <input type="text" required placeholder="e.g. KINGKKRATOM" value={wpFormData.website} onChange={e => setWpFormData({ ...wpFormData, website: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Web ID (WooCommerce) <span className="text-destructive">*</span></label>
                                                            <input type="number" required value={wpFormData.webId} onChange={e => setWpFormData({ ...wpFormData, webId: Number(e.target.value) })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Linked SKU Code</label>
                                                            <input type="text" placeholder="Matches internal SKU" value={wpFormData.sku_code} onChange={e => setWpFormData({ ...wpFormData, sku_code: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Image URL</label>
                                                        <input type="text" placeholder="https://..." value={wpFormData.image} onChange={e => setWpFormData({ ...wpFormData, image: e.target.value })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Category</label>
                                                            <select className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground" value={wpFormData.category} onChange={e => setWpFormData({ ...wpFormData, category: e.target.value })}>
                                                                <option value="">Select Category</option>
                                                                {["Finished Goods", "High Priority", "Lab Testing", "Maintenance", "Packaging", "Part", "Shipping Category"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sub Category</label>
                                                            <select className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground" value={wpFormData.subCategory} onChange={e => setWpFormData({ ...wpFormData, subCategory: e.target.value })}>
                                                                <option value="">Select Sub-Category</option>
                                                                {["Bags", "Bottle and Lids", "Display Boxes", "Disposable Vape", "Edibles", "Flavors", "Hemp", "Kava", "Kratom", "Kratom Extract", "Kratom Powder", "Labels/Shrink-Bands", "Marketing Material", "Packagings", "R&D (Research and Developement)", "Raw Ingredients", "simple", "variable"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                            </select>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Material Type</label>
                                                            <select className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground" value={wpFormData.materialType} onChange={e => setWpFormData({ ...wpFormData, materialType: e.target.value })}>
                                                                <option value="">Select Material Type</option>
                                                                {["Bag", "Bottle", "Box", "Capsule", "Clings", "Crystal", "Dropper", "Edible", "Extracts", "Label", "Lid/Top", "Liquid", "Oils", "Postcards", "Posters", "Powder", "Sample Boxes", "Seal", "Shipping Boxes", "Shrinkband", "Smokables", "Stickers", "Suppository", "SWAG", "Table Tents", "Tablets", "Terpenes", "Topicals"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-4">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">UOM</label>
                                                            <input list="wp-uom-options" className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground" value={wpFormData.uom} onChange={e => setWpFormData({ ...wpFormData, uom: e.target.value })} placeholder="Select or Type..." />
                                                            <datalist id="wp-uom-options">
                                                                {["Bottle", "Box", "Case", "EA", "Grams", "Hour", "Kg", "Kit", "Liter", "Meter", "Pallet", "Roll"].map(opt => <option key={opt} value={opt} />)}
                                                            </datalist>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Sale Price ($)</label>
                                                            <input type="number" value={wpFormData.salePrice} onChange={e => setWpFormData({ ...wpFormData, salePrice: Number(e.target.value) })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Order Upto</label>
                                                            <input type="number" value={wpFormData.orderUpto} onChange={e => setWpFormData({ ...wpFormData, orderUpto: Number(e.target.value) })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Re-Order Point</label>
                                                            <input type="number" value={wpFormData.reOrderPoint} onChange={e => setWpFormData({ ...wpFormData, reOrderPoint: Number(e.target.value) })} className="w-full px-3 py-2 bg-background border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary/10 transition-colors text-foreground font-medium" />
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center space-x-6 pt-2">
                                                        <label className="flex items-center space-x-2 cursor-pointer group">
                                                            <div className="relative flex items-center">
                                                                <input type="checkbox" className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-border bg-background transition-all checked:bg-primary" checked={wpFormData.kitApplied} onChange={e => setWpFormData({ ...wpFormData, kitApplied: e.target.checked })} />
                                                                <svg className="pointer-events-none absolute h-3 w-3 translate-x-[2px] text-black opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Kit Applied</span>
                                                        </label>
                                                        <label className="flex items-center space-x-2 cursor-pointer group">
                                                            <div className="relative flex items-center">
                                                                <input type="checkbox" className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-border bg-background transition-all checked:bg-primary" checked={wpFormData.isLotApplied} onChange={e => setWpFormData({ ...wpFormData, isLotApplied: e.target.checked })} />
                                                                <svg className="pointer-events-none absolute h-3 w-3 translate-x-[2px] text-black opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                            </div>
                                                            <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">Lot Applied (Traceability)</span>
                                                        </label>
                                                    </div>
                                                </form>
                                            </div>
                                            <div className="px-6 py-4 border-t border-border bg-secondary/50 shrink-0 flex justify-end space-x-3">
                                                <button type="button" onClick={() => setWpModalOpen(false)} className="px-6 h-10 text-[11px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary rounded transition-all cursor-pointer">Cancel</button>
                                                <button type="submit" form="wp-form" disabled={wpSubmitting} className="px-8 h-10 bg-primary text-black text-[11px] font-black uppercase tracking-widest rounded hover:opacity-90 transition-all shadow-md disabled:opacity-50 flex items-center space-x-3 cursor-pointer">
                                                    {wpSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                                    <span>{wpEditing ? 'Save Changes' : 'Create Product'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Reports Module Settings */}
                                {moduleSubTab === 'reports' && (
                                    <div className="space-y-6 animate-in fade-in duration-200">
                                        <div className="p-8 text-center border-2 border-dashed border-border rounded-lg">
                                            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                                            <h3 className="text-sm font-bold text-muted-foreground">Reports Module</h3>
                                            <p className="text-xs text-muted-foreground mt-1">Reports configuration options coming soon.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Help Module Settings */}
                                {moduleSubTab === 'help' && (
                                    <div className="space-y-6 animate-in fade-in duration-200">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importTicketsRef}
                                            onChange={(e) => handleImport(e, '/api/tickets/import', 'Tickets')}
                                        />
                                        {/* Tickets Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Tickets Import</h2>

                                            <div className="p-4 border border-violet-500/20 bg-violet-500/10 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <TicketCheck className="w-5 h-5 text-violet-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-violet-600 dark:text-violet-400">Import Tickets</h4>
                                                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                                                        Import help desk tickets from a CSV file. The <code className="bg-violet-500/20 px-1 rounded">requestedBy</code> field should contain a user email or ID.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button
                                                    onClick={() => importTicketsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-lg hover:border-violet-400 hover:bg-violet-500/10 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-3 group-hover:bg-violet-500/30 transition-colors">
                                                        <TicketCheck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-muted-foreground">Import Tickets</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-1 text-center">
                                                        Help desk tickets
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-secondary/30 rounded-lg">
                                                <h4 className="text-xs font-bold text-muted-foreground mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-muted-foreground">
                                                    <span className="font-bold text-muted-foreground">Tickets:</span>
                                                    <p>date, requestedBy, subCategory, issue, reason, priority, deadline, description, department, document, status, completionNote, completedBy, completedAt</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div >
            </div >
        </div >
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen bg-background">
                <div className="text-sm text-muted-foreground">Loading settings...</div>
            </div>
        }>
            <SettingsPageContent />
        </Suspense>
    );
}
