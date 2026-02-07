'use client';

import React, { useState } from 'react';
import { 
    Save, 
    Upload,
    Users,
    FileText,
    DollarSign,
    Mail,
    ToggleLeft,
    ToggleRight,
    Contact,
    Activity,
    ListTodo
} from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

export default function CRMSettingsPage() {
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const importClientsRef = React.useRef<HTMLInputElement>(null);
    const importNotesRef = React.useRef<HTMLInputElement>(null);
    const importContactsRef = React.useRef<HTMLInputElement>(null);
    const importActivitiesRef = React.useRef<HTMLInputElement>(null);
    const importTasksRef = React.useRef<HTMLInputElement>(null);

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
        crmMinRevenueSlab: '20',
        crmFilterEmailsByClients: false
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
                        body: JSON.stringify({ notes: results.data })
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

    const handleImportContacts = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        
        setImporting(true);
        const toastId = toast.loading('Parsing contacts file...');
        
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
                    toast.loading(`Importing ${totalRows} contacts...`, { id: toastId });
                    const res = await fetch('/api/clients/import-contacts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ contacts: results.data })
                    });
                    
                    if (res.ok) {
                        const data = await res.json();
                        toast.success(`Imported ${data.count} contacts (${data.skippedDuplicates} duplicates skipped)`, { id: toastId });
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

    const handleImportActivities = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        
        setImporting(true);
        const toastId = toast.loading('Parsing activities file...');
        
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
                    const BATCH_SIZE = 2000;
                    let totalImported = 0;
                    let totalMissing = 0;
                    
                    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
                        const batch = results.data.slice(i, i + BATCH_SIZE);
                        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                        const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
                        
                        toast.loading(`Importing batch ${batchNum}/${totalBatches} (${i + batch.length}/${totalRows})...`, { id: toastId });
                        
                        const res = await fetch('/api/clients/import-activities', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ activities: batch })
                        });
                        
                        if (res.ok) {
                            const data = await res.json();
                            totalImported += data.count || 0;
                            totalMissing += data.missingClients || 0;
                        } else {
                            const err = await res.json();
                            toast.error(`Batch ${batchNum} failed: ${err.error || 'Unknown error'}`, { id: toastId });
                            setImporting(false);
                            return;
                        }
                    }
                    
                    toast.success(`Imported ${totalImported} activities (${totalMissing} missing clients)`, { id: toastId });
                } catch (err) {
                    console.error(err);
                    toast.error('Import failed', { id: toastId });
                }
                setImporting(false);
            }
        });
    };

    const handleImportTasks = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        
        setImporting(true);
        const toastId = toast.loading('Parsing tasks file...');
        
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
                    const BATCH_SIZE = 2000;
                    let totalImported = 0;
                    let totalMissing = 0;
                    
                    for (let i = 0; i < totalRows; i += BATCH_SIZE) {
                        const batch = results.data.slice(i, i + BATCH_SIZE);
                        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                        const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
                        
                        toast.loading(`Importing batch ${batchNum}/${totalBatches} (${i + batch.length}/${totalRows})...`, { id: toastId });
                        
                        const res = await fetch('/api/clients/import-tasks', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tasks: batch })
                        });
                        
                        if (res.ok) {
                            const data = await res.json();
                            totalImported += data.count || 0;
                            totalMissing += data.missingClients || 0;
                        } else {
                            const err = await res.json();
                            toast.error(`Batch ${batchNum} failed: ${err.error || 'Unknown error'}`, { id: toastId });
                            setImporting(false);
                            return;
                        }
                    }
                    
                    toast.success(`Imported ${totalImported} tasks (${totalMissing} missing clients)`, { id: toastId });
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
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card shrink-0">
                <h1 className="text-sm font-bold uppercase text-foreground">CRM Settings</h1>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                    <input
                        ref={importContactsRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportContacts}
                    />
                    <input
                        ref={importActivitiesRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportActivities}
                    />
                    <input
                        ref={importTasksRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleImportTasks}
                    />

                    {/* Row 1: Import Clients */}
                    {/* Row 1: Import Clients */}
                    <div className="p-6 bg-card border border-border flex items-center justify-between rounded-lg">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                                <Users className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Import Clients (CSV)</h4>
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
                    {/* Row 2: Import Client Notes */}
                    <div className="p-6 bg-card border border-border flex items-center justify-between rounded-lg">
                         <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Import Client Notes (CSV)</h4>
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

                    {/* Row 3: Import Client Contacts */}
                    <div className="p-6 bg-card border border-border flex items-center justify-between rounded-lg">
                         <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                                <Contact className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Import Client Contacts (CSV)</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Columns: clientid, firstName, lastName, email, phone, phoneType, extension, role, status, address, city, state, zipCode, country, website, communicationPreference, followUpFrequency
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => importContactsRef.current?.click()}
                            disabled={importing}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{importing ? 'Importing...' : 'Upload'}</span>
                        </button>
                    </div>

                    {/* Row 4: Import Activities */}
                    <div className="p-6 bg-card border border-border flex items-center justify-between rounded-lg">
                         <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                                <Activity className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Import Activities (CSV)</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Columns: type, client (legacyId), comments, createdAt, createdBy
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => importActivitiesRef.current?.click()}
                            disabled={importing}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{importing ? 'Importing...' : 'Upload'}</span>
                        </button>
                    </div>

                    {/* Row 5: Import Tasks */}
                    <div className="p-6 bg-card border border-border flex items-center justify-between rounded-lg">
                         <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                                <ListTodo className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Import Tasks (CSV)</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Columns: clientid (legacyId), task, type, priority, assignedTo, autoGenerated, triggerReason, notes, status, dueDate, nextFollowupDate, completionDate, createdBy, createdAt, updatedAt
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => importTasksRef.current?.click()}
                            disabled={importing}
                            className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-medium rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{importing ? 'Importing...' : 'Upload'}</span>
                        </button>
                    </div>

                    {/* Row 3: Threshold */}
                    <div className="p-6 bg-card border border-border flex items-center justify-between rounded-lg">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                                <DollarSign className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Lead to Client Threshold</h4>
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
                                className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                                min="0"
                            />
                        </div>
                    </div>

                    {/* Row 4: Filter Emails by Clients/Leads */}
                    <div className="p-6 bg-card border border-border flex items-center justify-between rounded-lg">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0">
                                <Mail className="w-5 h-5 text-black" />
                            </div>
                            <div>
                                <h4 className="text-sm font-medium text-foreground">Filter Emails by Clients/Leads</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Only show emails matching client/lead email addresses in Inbox and Sent
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSettings({...settings, crmFilterEmailsByClients: !settings.crmFilterEmailsByClients})}
                            className="relative w-12 h-6 rounded-sm transition-colors duration-200"
                            style={{ backgroundColor: settings.crmFilterEmailsByClients ? '#facc15' : '#d1d5db' }}
                        >
                            <span 
                                className={`absolute top-0.5 w-5 h-5 rounded-sm transition-all duration-200 ${settings.crmFilterEmailsByClients ? 'left-[26px] bg-black' : 'left-0.5 bg-white'}`}
                            />
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

