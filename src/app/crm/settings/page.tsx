'use client';

import React, { useState } from 'react';
import { 
    Save, 
    Upload,
    Users,
    FileText,
    DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function CRMSettingsPage() {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const importClientsRef = React.useRef<HTMLInputElement>(null);
    const importNotesRef = React.useRef<HTMLInputElement>(null);

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
        filterDataFrom: '', 
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

    const handleImportClients = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        
        setImporting(true);
        const toastId = toast.loading('Parsing file...');
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const totalRows = results.data.length;
                if (totalRows === 0) {
                    toast.error('No data found in file', { id: toastId });
                    setImporting(false);
                    return;
                }
                
                try {
                    toast.loading(`Importing ${totalRows} clients...`, { id: toastId });
                    
                    // The API expects { clients: [...] }, matched with crm/clients/page.tsx
                    const res = await fetch('/api/clients/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ clients: results.data })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        toast.success(`Successfully imported ${data.count || totalRows} clients`, { id: toastId });
                    } else {
                        const err = await res.json();
                        toast.error(err.error || 'Import failed', { id: toastId });
                    }
                } catch (err) {
                    console.error(err);
                    toast.error('Import failed', { id: toastId });
                }
                setImporting(false);
            }
        });
    };

    const handleImportNotes = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        
        setImporting(true);
        const toastId = toast.loading('Parsing notes file...');
        
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const totalRows = results.data.length;
                if (totalRows === 0) {
                    toast.error('No data found in file', { id: toastId });
                    setImporting(false);
                    return;
                }
                
                try {
                    toast.loading(`Importing ${totalRows} notes...`, { id: toastId });
                    const res = await fetch('/api/clients/import-notes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data: results.data })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        toast.success(`Successfully imported ${data.count || totalRows} notes`, { id: toastId });
                    } else {
                        const err = await res.json();
                        toast.error(err.error || 'Import failed', { id: toastId });
                    }
                } catch (err) {
                    console.error(err);
                    toast.error('Import failed', { id: toastId });
                }
                setImporting(false);
            }
        });
    };

    if (loading) {
        return <div className="p-8">Loading settings...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-white shrink-0">
                <h1 className="text-sm font-bold uppercase text-slate-900">CRM Settings</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-1.5 bg-black text-white rounded text-xs font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                    <Save className="w-3.5 h-3.5" />
                    <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-4">
                    {/* Hidden file inputs */}
                    <input
                        ref={importClientsRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportClients}
                    />
                    <input
                        ref={importNotesRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportNotes}
                    />

                    {/* Row 1: Import Clients */}
                    <div className="p-6 bg-white border-b border-sidebar-border flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-sidebar-accent/10 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-sidebar-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-sidebar-foreground">Import Clients (CSV)</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Columns: name, email, phone, address, city, state
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => importClientsRef.current?.click()}
                            disabled={importing}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{importing ? 'Importing...' : 'Upload'}</span>
                        </button>
                    </div>

                    {/* Row 2: Import Client Notes */}
                    <div className="p-6 bg-white border-b border-sidebar-border flex items-center justify-between">
                         <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-sidebar-accent/10 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-sidebar-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-sidebar-foreground">Import Client Notes (CSV)</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Columns: clientId, note, createdAt (optional)
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => importNotesRef.current?.click()}
                            disabled={importing}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{importing ? 'Importing...' : 'Upload'}</span>
                        </button>
                    </div>

                    {/* Row 3: Threshold */}
                    <div className="p-6 bg-white border-b border-sidebar-border flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-sidebar-accent/10 flex items-center justify-center shrink-0">
                                <DollarSign className="w-5 h-5 text-sidebar-primary" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-sidebar-foreground">Lead to Client Threshold</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Revenue amount to convert Lead to Client
                                </p>
                            </div>
                        </div>
                        <div className="relative w-32">
                             <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                             <input 
                                type="number" 
                                value={settings.crmMinRevenueSlab}
                                onChange={e => setSettings({...settings, crmMinRevenueSlab: e.target.value})}
                                className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                min="0"
                            />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

