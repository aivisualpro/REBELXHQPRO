'use client';

import React, { useState, useRef } from 'react';
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
    PackageCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

type Tab = 'general' | 'localization' | 'crm' | 'notifications' | 'security' | 'dataFilter' | 'modules';
type ModuleSubTab = 'sales' | 'warehouse' | 'reports' | 'help';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [moduleSubTab, setModuleSubTab] = useState<ModuleSubTab>('sales');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Sales Import State
    const [importStatus, setImportStatus] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const importOrdersRef = useRef<HTMLInputElement>(null);
    const importLineItemsRef = useRef<HTMLInputElement>(null);
    const importPaymentsRef = useRef<HTMLInputElement>(null);

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
                            console.log(`Import ${label} chunk ${i+1} response:`, JSON.stringify(data, null, 2));
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

    const tabs = [
        { id: 'general', label: 'General', icon: Building },
        { id: 'localization', label: 'Localization', icon: Globe },
        { id: 'dataFilter', label: 'Data Filter', icon: Calendar },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'modules', label: 'Modules', icon: Layers },
    ];

    const moduleSubTabs = [
        { id: 'sales', label: 'Sales', icon: ShoppingCart },
        { id: 'warehouse', label: 'Warehouse', icon: Warehouse },
        { id: 'reports', label: 'Reports', icon: BarChart3 },
        { id: 'help', label: 'Help', icon: HelpCircle },
    ];



    if (loading) {
        return <div className="p-8">Loading settings...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-slate-50">
            {/* Header */}
            <div className="flex items-center justify-end px-4 py-2 border-b border-slate-100 bg-white shrink-0">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-1.5 bg-black text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-white border-r border-slate-200 flex flex-col pt-6 shrink-0">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={cn(
                                    "flex items-center space-x-3 px-6 py-3 text-sm font-medium transition-colors border-l-2",
                                    activeTab === tab.id 
                                        ? "border-black text-black bg-slate-50" 
                                        : "border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Company Details</h2>
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700">Company Name</label>
                                            <div className="relative">
                                                <Building className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="text" 
                                                    value={settings.companyName}
                                                    onChange={e => setSettings({...settings, companyName: e.target.value})}
                                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                                />
                                            </div>
                                        </div>
                                        {/* ... other general fields ... */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700">Support Email</label>
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                    <input 
                                                        type="email" 
                                                        value={settings.email}
                                                        onChange={e => setSettings({...settings, email: e.target.value})}
                                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-xs font-bold text-slate-700">Phone</label>
                                                <div className="relative">
                                                    <Smartphone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                    <input 
                                                        type="text" 
                                                        value={settings.phone}
                                                        onChange={e => setSettings({...settings, phone: e.target.value})}
                                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                         <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700">Address</label>
                                            <div className="relative">
                                                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="text" 
                                                    value={settings.address}
                                                    onChange={e => setSettings({...settings, address: e.target.value})}
                                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
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
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Regional Settings</h2>
                                    
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700">Default Currency</label>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                <select 
                                                    value={settings.currency}
                                                    onChange={e => setSettings({...settings, currency: e.target.value})}
                                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10 appearance-none"
                                                >
                                                    <option value="USD">USD ($)</option>
                                                    <option value="EUR">EUR (€)</option>
                                                    <option value="GBP">GBP (£)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-slate-700">Timezone</label>
                                            <div className="relative">
                                                <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                                <select 
                                                    value={settings.timezone}
                                                    onChange={e => setSettings({...settings, timezone: e.target.value})}
                                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10 appearance-none"
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
                                        <label className="text-xs font-bold text-slate-700">Date Format</label>
                                        <div className="space-y-2">
                                            {['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'].map(fmt => (
                                                <label key={fmt} className="flex items-center space-x-3 cursor-pointer p-3 border border-slate-200 rounded hover:bg-slate-50 transition-colors">
                                                    <input 
                                                        type="radio" 
                                                        name="dateFormat"
                                                        value={fmt}
                                                        checked={settings.dateFormat === fmt}
                                                        onChange={e => setSettings({...settings, dateFormat: e.target.value})}
                                                        className="text-black focus:ring-black"
                                                    />
                                                    <span className="text-sm font-medium text-slate-700">{fmt} <span className="text-slate-400 text-xs ml-2">(e.g. {new Date().toLocaleDateString()})</span></span>
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
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Global Data Filtering</h2>
                                    <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg flex items-start space-x-4 mb-4">
                                        <div className="shrink-0 mt-0.5">
                                            <Filter className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-blue-800">Start Date Filter</h4>
                                            <p className="text-xs text-blue-700 mt-1">
                                                All data in the system (SKUs, Orders, Tickets, etc.) created BEFORE this date will be hidden from views. 
                                                Leave empty to show all history.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-700">Filter Data From (Start Date)</label>
                                        <div className="relative max-w-sm">
                                            <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input 
                                                type="date" 
                                                value={settings.filterDataFrom || ''}
                                                onChange={e => setSettings({...settings, filterDataFrom: e.target.value})}
                                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black/10"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-500">
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
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Alert Preferences</h2>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                                                    <Mail className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">Email Notifications</p>
                                                    <p className="text-xs text-slate-500">Receive daily summaries and critical alerts via email.</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={settings.emailAlerts}
                                                    onChange={e => setSettings({...settings, emailAlerts: e.target.checked})}
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                                            </label>
                                        </div>

                                        <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                            <div className="flex items-center space-x-4">
                                                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
                                                    <Bell className="w-5 h-5 text-purple-600" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">Push Notifications</p>
                                                    <p className="text-xs text-slate-500">Real-time alerts via browser or mobile app.</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={settings.pushNotifications}
                                                    onChange={e => setSettings({...settings, pushNotifications: e.target.checked})}
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
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
                                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Access Control</h2>
                                    
                                    <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg flex items-start space-x-4">
                                        <Shield className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                        <div>
                                            <h4 className="text-sm font-bold text-orange-800">Two-Factor Authentication (2FA)</h4>
                                            <p className="text-xs text-orange-700 mt-1">Enforce 2FA for all admin accounts to enhance security.</p>
                                        </div>
                                        <div className="ml-auto">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={settings.twoFactor}
                                                    onChange={e => setSettings({...settings, twoFactor: e.target.checked})}
                                                    className="sr-only peer" 
                                                />
                                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="p-6 bg-slate-100 rounded-lg text-center">
                                        <p className="text-xs text-slate-500 mb-3">Want to change your password?</p>
                                        <button className="px-4 py-2 border border-slate-300 bg-white text-slate-700 text-xs font-bold uppercase rounded shadow-sm hover:bg-slate-50 transition-colors">
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
                                <div className="flex items-center space-x-1 border-b border-slate-200 pb-0">
                                    {moduleSubTabs.map(tab => {
                                        const Icon = tab.icon;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={() => setModuleSubTab(tab.id as ModuleSubTab)}
                                                className={cn(
                                                    "flex items-center space-x-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 -mb-px",
                                                    moduleSubTab === tab.id 
                                                        ? "border-black text-black" 
                                                        : "border-transparent text-slate-400 hover:text-slate-600"
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

                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Wholesale Orders Import</h2>
                                            
                                            {/* Status Display */}
                                            {importStatus && (
                                                <div className={cn(
                                                    "p-3 rounded-lg text-sm font-medium",
                                                    importStatus.startsWith('✓') ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                    importStatus.startsWith('⚠️') ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                    importStatus.startsWith('❌') ? "bg-red-50 text-red-700 border border-red-200" :
                                                    "bg-blue-50 text-blue-700 border border-blue-200"
                                                )}>
                                                    {isImporting && <RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />}
                                                    {importStatus}
                                                </div>
                                            )}

                                            <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Upload className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-blue-800">Data Import</h4>
                                                    <p className="text-xs text-blue-700 mt-1">
                                                        Import wholesale orders data from CSV files. Orders use <code className="bg-blue-100 px-1 rounded">legacyId</code> for matching - 
                                                        existing records will be updated, new records will be created.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Import Orders */}
                                                <button
                                                    onClick={() => importOrdersRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                                                        <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Orders</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Order headers, client, status, dates
                                                    </p>
                                                </button>

                                                {/* Import Line Items */}
                                                <button
                                                    onClick={() => importLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mb-3 group-hover:bg-purple-200 transition-colors">
                                                        <Package className="w-6 h-6 text-purple-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Line Items</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        SKUs, quantities, prices, lots
                                                    </p>
                                                </button>

                                                {/* Import Payments */}
                                                <button
                                                    onClick={() => importPaymentsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3 group-hover:bg-emerald-200 transition-colors">
                                                        <CreditCard className="w-6 h-6 text-emerald-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Payments</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Payment amounts, dates
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px] text-slate-500">
                                                    <div>
                                                        <span className="font-bold text-slate-700">Orders:</span>
                                                        <p>legacyId, label, clientId, salesRep, orderStatus, paymentMethod, shippedDate, shippingMethod, trackingNumber, shippingCost, tax, category, shippingAddress, city, state, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Line Items:</span>
                                                        <p>orderNumber (legacyId), sku, qtyShipped, price, uom, lotNumber, cost</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Payments:</span>
                                                        <p>orderNumber (legacyId), paymentAmount, createdAt</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Warehouse Module Settings */}
                                {moduleSubTab === 'warehouse' && (
                                    <div className="space-y-6 animate-in fade-in duration-200">
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
                                            ref={importLabResultsRef}
                                            onChange={(e) => handleImport(e, '/api/lab-results/import', 'Lab Results')}
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
                                            ref={importKitsRef}
                                            onChange={(e) => handleImport(e, '/api/kits/import', 'Product Kits')}
                                        />
                                        <input
                                            type="file"
                                            accept=".csv"
                                            className="hidden"
                                            ref={importKitLineItemsRef}
                                            onChange={(e) => handleImport(e, '/api/kits/import-lineitems', 'Kit Line Items')}
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
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">System Defaults</h2>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-700 block mb-2">Missing SKU Image (Fallback)</label>
                                                    <div className="flex items-start space-x-4">
                                                        <div className="w-32 h-32 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden relative group">
                                                            {settings.missingSkuImage ? (
                                                                <img src={settings.missingSkuImage} alt="Fallback" className="w-full h-full object-contain" />
                                                            ) : (
                                                                <ImageIcon className="w-8 h-8 text-slate-300" />
                                                            )}
                                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <label className="cursor-pointer text-white text-xs font-bold px-2 py-1 border border-white rounded hover:bg-white hover:text-black transition-colors">
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
                                                                                setSettings(prev => ({...prev, missingSkuImage: data.url }));
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
                                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                                This image will be displayed whenever a SKU&apos;s primary image is missing or fails to load.
                                                            </p>
                                                            {settings.missingSkuImage && (
                                                                <button 
                                                                    onClick={() => setSettings(prev => ({...prev, missingSkuImage: ''}))}
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
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">SKU Data Import</h2>
                                            
                                            {/* Status Display */}
                                            {importStatus && (
                                                <div className={cn(
                                                    "p-3 rounded-lg text-sm font-medium",
                                                    importStatus.startsWith('✓') ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                    importStatus.startsWith('⚠️') ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                    importStatus.startsWith('❌') ? "bg-red-50 text-red-700 border border-red-200" :
                                                    "bg-blue-50 text-blue-700 border border-blue-200"
                                                )}>
                                                    {isImporting && <RefreshCw className="w-4 h-4 inline mr-2 animate-spin" />}
                                                    {importStatus}
                                                </div>
                                            )}

                                            <div className="p-4 border border-teal-200 bg-teal-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Upload className="w-5 h-5 text-teal-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-teal-800">SKU Data Import</h4>
                                                    <p className="text-xs text-teal-700 mt-1">
                                                        Import SKUs and Variances from CSV files. SKUs use <code className="bg-teal-100 px-1 rounded">legacyId</code> for matching - 
                                                        existing records will be updated, new records will be created.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Import SKUs */}
                                                <button
                                                    onClick={() => importSkusRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mb-3 group-hover:bg-teal-200 transition-colors">
                                                        <Package className="w-6 h-6 text-teal-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import SKUs</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Master product catalog data
                                                    </p>
                                                </button>

                                                {/* Import Variances */}
                                                <button
                                                    onClick={() => importVariancesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-orange-400 hover:bg-orange-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors">
                                                        <Layers className="w-6 h-6 text-orange-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Variances</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Product variants (sizes, colors)
                                                    </p>
                                                </button>

                                                {/* Import Vendors */}
                                                <button
                                                    onClick={() => importVendorsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 group-hover:bg-indigo-200 transition-colors">
                                                        <Truck className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Vendors</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Supplier list (legacyId, name, terms)
                                                    </p>
                                                </button>

                                                {/* Import POs */}
                                                <button
                                                    onClick={() => importPurchaseOrdersRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
                                                        <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import POs</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Purchase Orders (legacyId, vendor)
                                                    </p>
                                                </button>

                                                {/* Import PO Line Items */}
                                                <button
                                                    onClick={() => importPoLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-cyan-400 hover:bg-cyan-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-cyan-100 flex items-center justify-center mb-3 group-hover:bg-cyan-200 transition-colors">
                                                        <ShoppingCart className="w-6 h-6 text-cyan-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import PO Lines</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Items for POs (poNumber, sku, qty)
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] text-slate-500">
                                                    <div>
                                                        <span className="font-bold text-slate-700">SKUs:</span>
                                                        <p>legacyId, name, image, category, subCategory, materialType, uom, salePrice, orderUpto, reOrderPoint, kitApplied, isLotApplied</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Variances:</span>
                                                        <p>sku (or skuLegacyId), name, website, image</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Opening Balances Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Opening Balances Import</h2>
                                            
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

                                            <div className="p-4 border border-indigo-200 bg-indigo-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Scale className="w-5 h-5 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-indigo-800">Opening Balances Import</h4>
                                                    <p className="text-xs text-indigo-700 mt-1">
                                                        Import inventory opening balances from CSV. The <code className="bg-indigo-100 px-1 rounded">sku</code> column maps to SKU <code className="bg-indigo-100 px-1 rounded">legacyId</code> for matching.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => importOpeningBalancesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 group-hover:bg-indigo-200 transition-colors">
                                                        <Upload className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Opening Balances</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Inventory starting quantities &amp; costs
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-slate-500">
                                                    <span className="font-bold text-slate-700">Opening Balances:</span>
                                                    <p>sku, lotNumber, qty, uom, cost, expirationDate, createdAt, createdBy</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Audit Adjustments Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Audit Adjustments Import</h2>

                                            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <ClipboardCheck className="w-5 h-5 text-amber-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-800">Audit Adjustments Import</h4>
                                                    <p className="text-xs text-amber-700 mt-1">
                                                        Import audit adjustments from CSV. The <code className="bg-amber-100 px-1 rounded">sku</code> column maps to SKU <code className="bg-amber-100 px-1 rounded">legacyId</code> for matching. New ObjectIds are generated for each record.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => importAuditAdjustmentsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
                                                        <ClipboardCheck className="w-6 h-6 text-amber-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Audit Adjustments</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Inventory adjustments (qty corrections)
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-slate-500">
                                                    <span className="font-bold text-slate-700">Audit Adjustments:</span>
                                                    <p>sku (legacyId), lotNumber, qty, reason, createdBy, createdAt</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lab Results Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Lab Results Import</h2>

                                            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <FlaskConical className="w-5 h-5 text-amber-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-800">Lab Results Import</h4>
                                                    <p className="text-xs text-amber-700 mt-1">
                                                        Import lab results from CSV files. Records are matched by <code className="bg-amber-100 px-1 rounded">name</code> for upsert.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                                <button
                                                    onClick={() => importLabResultsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
                                                        <FlaskConical className="w-6 h-6 text-amber-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Lab Results</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Product lab test results
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-slate-500">
                                                    <span className="font-bold text-slate-700">Lab Results:</span>
                                                    <p>name, variations, brand, labTestStatus, labResultDate, company, link</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Recipes Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Recipes Import</h2>

                                            <div className="p-4 border border-amber-200 bg-amber-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <UtensilsCrossed className="w-5 h-5 text-amber-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-amber-800">Recipes Import</h4>
                                                    <p className="text-xs text-amber-700 mt-1">
                                                        Import recipes, line items, and steps from CSV. The <code className="bg-amber-100 px-1 rounded">sku</code> column maps to SKU <code className="bg-amber-100 px-1 rounded">legacyId</code>. Recipe <code className="bg-amber-100 px-1 rounded">legacyId</code> is used for matching parent recipes.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button
                                                    onClick={() => importRecipesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
                                                        <UtensilsCrossed className="w-6 h-6 text-amber-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Recipes</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Master recipe data
                                                    </p>
                                                </button>
                                                <button
                                                    onClick={() => importRecipeLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
                                                        <Layers className="w-6 h-6 text-amber-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Recipe Items</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Ingredient line items
                                                    </p>
                                                </button>
                                                <button
                                                    onClick={() => importRecipeStepsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
                                                        <FileSpreadsheet className="w-6 h-6 text-amber-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Recipe Steps</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Process steps
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-slate-500 space-y-1">
                                                    <div>
                                                        <span className="font-bold text-slate-700">Recipes:</span>
                                                        <p>legacyId, name, sku (legacyId), qty, uom, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Recipe Line Items:</span>
                                                        <p>recipeId (parent legacyId), sku (legacyId), qty, uom, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Recipe Steps:</span>
                                                        <p>recipeId (parent legacyId), step, description, details, createdBy, createdAt</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Product Kits Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Product Kits Import</h2>

                                            <div className="p-4 border border-teal-200 bg-teal-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <PackageCheck className="w-5 h-5 text-teal-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-teal-800">Product Kits Import</h4>
                                                    <p className="text-xs text-teal-700 mt-1">
                                                        First import Kits (parent records), then import Kit Items to add line items to each kit.
                                                        The <code className="bg-teal-100 px-1 rounded">kitId</code> in items CSV should match the kit&apos;s <code className="bg-teal-100 px-1 rounded">legacyId</code>.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button
                                                    onClick={() => importKitsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mb-3 group-hover:bg-teal-200 transition-colors">
                                                        <PackageCheck className="w-6 h-6 text-teal-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Product Kits</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Parent kit records
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importKitLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-teal-400 hover:bg-teal-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center mb-3 group-hover:bg-teal-200 transition-colors">
                                                        <PackageCheck className="w-6 h-6 text-teal-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Kit Items</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Line items for kits
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-slate-500 space-y-1">
                                                    <div>
                                                        <span className="font-bold text-slate-700">Kits:</span>
                                                        <p>legacyId, name, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Kit Items:</span>
                                                        <p>kitId (parent legacyId), sku (SKU legacyId), qty</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Manufacturing Import Section */}
                                        <div className="space-y-4">
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Manufacturing Import</h2>

                                            <div className="p-4 border border-violet-200 bg-violet-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <Truck className="w-5 h-5 text-violet-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-violet-800">Manufacturing Import</h4>
                                                    <p className="text-xs text-violet-700 mt-1">
                                                        Import in order: Manufacturing Orders first, then Line Items, Labor, and Notes.
                                                        The <code className="bg-violet-100 px-1 rounded">woNumber</code> in sub-imports should match the order&apos;s <code className="bg-violet-100 px-1 rounded">legacyId</code>.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                                <button
                                                    onClick={() => importMfgOrdersRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Orders</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Manufacturing orders
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgLineItemsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Line Items</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        WO line items
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgLaborRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Labor</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Labor entries
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgNotesRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
                                                        <Truck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Notes</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        WO notes
                                                    </p>
                                                </button>

                                                <button
                                                    onClick={() => importMfgQualityChecksRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
                                                        <ClipboardCheck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import QC</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Quality checks
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-slate-500 space-y-1">
                                                    <div>
                                                        <span className="font-bold text-slate-700">Manufacturing Orders:</span>
                                                        <p>legacyId, label, sku (SKU legacyId), recipesId (Recipe legacyId), qty, uom, qtyDifference, scheduledStart, scheduledFinish, priority, status, createdBy, finishedBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Line Items:</span>
                                                        <p>woNumber (parent legacyId), lotNumber, recipeId (Recipe legacyId), sku (SKU legacyId), uom, recipeQty, sa, qtyExtra, qtyScrapped, createdAt, createdBy</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Labor:</span>
                                                        <p>woNumber (parent legacyId), type, user, duration, hourlyRate, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Notes:</span>
                                                        <p>woNumber (parent legacyId), note, createdBy, createdAt</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-slate-700">Quality Checks:</span>
                                                        <p>woNumber (parent legacyId), checkedBy, packagedBy, label, lot, seal, packageQuality, repackaged, weight, target, actualWeight, qualityCheckedBy, createdAt</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Reports Module Settings */}
                                {moduleSubTab === 'reports' && (
                                    <div className="space-y-6 animate-in fade-in duration-200">
                                        <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg">
                                            <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                            <h3 className="text-sm font-bold text-slate-400">Reports Module</h3>
                                            <p className="text-xs text-slate-400 mt-1">Reports configuration options coming soon.</p>
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
                                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Tickets Import</h2>

                                            <div className="p-4 border border-violet-200 bg-violet-50 rounded-lg flex items-start space-x-4 mb-4">
                                                <div className="shrink-0 mt-0.5">
                                                    <TicketCheck className="w-5 h-5 text-violet-600" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-violet-800">Import Tickets</h4>
                                                    <p className="text-xs text-violet-700 mt-1">
                                                        Import help desk tickets from a CSV file. The <code className="bg-violet-100 px-1 rounded">requestedBy</code> field should contain a user email or ID.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <button
                                                    onClick={() => importTicketsRef.current?.click()}
                                                    disabled={isImporting}
                                                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-lg hover:border-violet-400 hover:bg-violet-50 transition-colors group disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-3 group-hover:bg-violet-200 transition-colors">
                                                        <TicketCheck className="w-6 h-6 text-violet-600" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-slate-700">Import Tickets</h4>
                                                    <p className="text-[10px] text-slate-500 mt-1 text-center">
                                                        Help desk tickets
                                                    </p>
                                                </button>
                                            </div>

                                            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                                                <h4 className="text-xs font-bold text-slate-600 mb-2">CSV Column Reference</h4>
                                                <div className="text-[10px] text-slate-500">
                                                    <span className="font-bold text-slate-700">Tickets:</span>
                                                    <p>date, requestedBy, subCategory, issue, reason, priority, deadline, description, department, document, status, completionNote, completedBy, completedAt</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}

