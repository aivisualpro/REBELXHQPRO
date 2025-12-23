'use client';

import React, { useState } from 'react';
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
    Layout,
    Calendar,
    Filter,
    Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type Tab = 'general' | 'localization' | 'notifications' | 'security' | 'dataFilter' | 'defaults';

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

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
        missingSkuImage: ''
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
            toast.error('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'General', icon: Building },
        { id: 'localization', label: 'Localization', icon: Globe },
        { id: 'dataFilter', label: 'Data Filter', icon: Calendar },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
        { id: 'defaults', label: 'Defaults', icon: ImageIcon },
    ];

    if (loading) {
        return <div className="p-8">Loading settings...</div>;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-slate-50">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200 bg-white shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">General Settings</h1>
                    <p className="text-sm text-slate-500 mt-1">Manage your organization's global configurations.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
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

                        {/* DEFAULTS TAB */}
                        {activeTab === 'defaults' && (
                             <div className="space-y-6">
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
                                                                    toast.error('Failed to upload', { id: toastId });
                                                                }
                                                            }} />
                                                        </label>
                                                    </div>
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-xs text-slate-500 leading-relaxed">
                                                        This image will be displayed whenever a SKU's primary image is missing or fails to load.
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
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}

