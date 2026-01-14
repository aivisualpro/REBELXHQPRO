'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { X, Loader2, Plus, Trash2, Mail, Phone, MapPin, Globe, Facebook, Briefcase, DollarSign, Calendar, CreditCard, Ship, Wallet, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialType?: 'Client' | 'Lead';
    initialData?: any;
}

const COMPANY_TYPES = ['SHOP', 'DISTRO', 'VAPE STORE', 'POTENTIAL', 'WHL', 'MASTER DISTRO'];
const CONTACT_STATUSES = ['Initial Contact', 'Sampling', 'New Prospect', 'Closed won', 'Closed lost', 'Uncategorized'];

const formatPhoneNumber = (value: string) => {
    if (!value) return value;
    const phoneNumber = value.replace(/[^\d]/g, '');
    const phoneNumberLength = phoneNumber.length;
    if (phoneNumberLength < 4) return phoneNumber;
    if (phoneNumberLength < 7) {
        return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
    }
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

const formatExpiryDate = (value: string) => {
    const clearValue = value.replace(/[^\d]/g, '');
    if (clearValue.length >= 2) {
        return `${clearValue.slice(0, 2)}/${clearValue.slice(2, 4)}`;
    }
    return clearValue;
};

export default function ClientModal({ isOpen, onClose, onSuccess, initialType = 'Client', initialData }: ClientModalProps) {
    const { data: session } = useSession();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [salesReps, setSalesReps] = useState<{ _id: string, firstName: string, lastName: string }[]>([]);
    
    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        contactType: initialData?.contactType || initialType,
        companyType: initialData?.companyType || 'POTENTIAL',
        contactStatus: initialData?.contactStatus || (initialType === 'Lead' ? 'Initial Contact' : 'Uncategorized'),
        salesPerson: initialData?.salesPerson || (session?.user as any)?.id || '',
        description: initialData?.description || '',
        website: initialData?.website || '',
        facebookPage: initialData?.facebookPage || '',
        industry: initialData?.industry || '',
        forecastedAmount: initialData?.forecastedAmount || 0,
        projectedCloseDate: initialData?.projectedCloseDate ? new Date(initialData.projectedCloseDate).toISOString().split('T')[0] : '',
        emails: initialData?.emails && initialData.emails.length > 0 
            ? initialData.emails.map((e: any) => ({ value: e.value, label: e.label || 'Main' })) 
            : [{ value: '', label: 'Main' }],
        phones: initialData?.phones && initialData.phones.length > 0 
            ? initialData.phones.map((p: any) => ({ value: p.value, label: p.label || 'Main' })) 
            : [{ value: '', label: 'Main' }],
        addresses: initialData?.addresses && initialData.addresses.length > 0 
            ? initialData.addresses.map((a: any) => ({ 
                street: a.street || '', 
                city: a.city || '', 
                state: a.state || '', 
                postalCode: a.postalCode || '', 
                country: a.country || 'USA', 
                label: a.label || 'Main' 
            })) 
            : [{ street: '', city: '', state: '', postalCode: '', country: 'USA', label: 'Main' }],
        billing: {
            nameOnCard: initialData?.billing?.nameOnCard || '',
            ccNumber: initialData?.billing?.ccNumber || '',
            expirationDate: initialData?.billing?.expirationDate || '',
            securityCode: initialData?.billing?.securityCode || '',
            zipCode: initialData?.billing?.zipCode || ''
        },
        defaultShippingTerms: initialData?.defaultShippingTerms || '',
        defaultPaymentMethod: initialData?.defaultPaymentMethod || '',
        notes: initialData?.notes?.[0]?.note || ''
    });

    // Reset form when initialData changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                name: initialData?.name || '',
                contactType: initialData?.contactType || initialType,
                companyType: initialData?.companyType || 'POTENTIAL',
                contactStatus: initialData?.contactStatus || (initialType === 'Lead' ? 'Initial Contact' : 'Uncategorized'),
                salesPerson: initialData?.salesPerson || (session?.user as any)?.id || '',
                description: initialData?.description || '',
                website: initialData?.website || '',
                facebookPage: initialData?.facebookPage || '',
                industry: initialData?.industry || '',
                forecastedAmount: initialData?.forecastedAmount || 0,
                projectedCloseDate: initialData?.projectedCloseDate ? new Date(initialData.projectedCloseDate).toISOString().split('T')[0] : '',
                emails: initialData?.emails && initialData.emails.length > 0 
                    ? initialData.emails.map((e: any) => ({ value: e.value, label: e.label || 'Main' })) 
                    : [{ value: '', label: 'Main' }],
                phones: initialData?.phones && initialData.phones.length > 0 
                    ? initialData.phones.map((p: any) => ({ value: p.value, label: p.label || 'Main' })) 
                    : [{ value: '', label: 'Main' }],
                addresses: initialData?.addresses && initialData.addresses.length > 0 
                    ? initialData.addresses.map((a: any) => ({ 
                        street: a.street || '', 
                        city: a.city || '', 
                        state: a.state || '', 
                        postalCode: a.postalCode || '', 
                        country: a.country || 'USA', 
                        label: a.label || 'Main' 
                    })) 
                    : [{ street: '', city: '', state: '', postalCode: '', country: 'USA', label: 'Main' }],
                billing: {
                    nameOnCard: initialData?.billing?.nameOnCard || '',
                    ccNumber: initialData?.billing?.ccNumber || '',
                    expirationDate: initialData?.billing?.expirationDate || '',
                    securityCode: initialData?.billing?.securityCode || '',
                    zipCode: initialData?.billing?.zipCode || ''
                },
                defaultShippingTerms: initialData?.defaultShippingTerms || '',
                defaultPaymentMethod: initialData?.defaultPaymentMethod || '',
                notes: initialData?.notes?.[0]?.note || ''
            });
        }
    }, [initialData, isOpen, initialType, session]);

    // Update salesPerson when session is available
    useEffect(() => {
        if (session?.user && !formData.salesPerson) {
            setFormData(prev => ({ ...prev, salesPerson: (session.user as any).id }));
        }
    }, [session]);

    useEffect(() => {
        if (isOpen) {
            fetchSalesReps();
        }
    }, [isOpen]);

    const fetchSalesReps = async () => {
        try {
            const res = await fetch('/api/users?limit=100');
            const data = await res.json();
            if (data.users) {
                setSalesReps(data.users);
            }
        } catch (e) {
            console.error("Failed to load sales reps");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const isEditing = !!initialData?._id;
            const url = isEditing ? `/api/clients/${initialData._id}` : '/api/clients';
            const method = isEditing ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(`${formData.contactType} ${isEditing ? 'updated' : 'created'} successfully`);
                onSuccess();
                onClose();
            } else {
                const err = await res.json();
                toast.error(err.error || `Failed to ${isEditing ? 'update' : 'create'} ${formData.contactType.toLowerCase()}`);
            }
        } catch (error) {
            console.error('Submit error:', error);
            toast.error('A network error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addField = (type: 'emails' | 'phones' | 'addresses') => {
        if (type === 'emails') setFormData({ ...formData, emails: [...formData.emails, { value: '', label: '' }] });
        if (type === 'phones') setFormData({ ...formData, phones: [...formData.phones, { value: '', label: '' }] });
        if (type === 'addresses') setFormData({ ...formData, addresses: [...formData.addresses, { street: '', city: '', state: '', postalCode: '', country: 'USA', label: '' }] });
    };

    const removeField = (type: 'emails' | 'phones' | 'addresses', index: number) => {
        if (type === 'emails' && formData.emails.length > 1) {
            setFormData({ ...formData, emails: formData.emails.filter((_: any, i: number) => i !== index) });
        }
        if (type === 'phones' && formData.phones.length > 1) {
            setFormData({ ...formData, phones: formData.phones.filter((_: any, i: number) => i !== index) });
        }
        if (type === 'addresses' && formData.addresses.length > 1) {
            setFormData({ ...formData, addresses: formData.addresses.filter((_: any, i: number) => i !== index) });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-900">
                        {initialData?._id ? `Edit ${formData.contactType}` : `Add New ${formData.contactType}`}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-black transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Scrollable Form Area */}
                <form id="client-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-10 scrollbar-custom bg-slate-50/30">
                    {/* Section 1: Identity & Classification */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-slate-400">
                            <Briefcase className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Profile & Classification</h3>
                        </div>
                        <div className="grid grid-cols-6 gap-6">
                            <div className="col-span-4 space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Company Name</label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    placeholder="Acme Corporation"
                                />
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Contact Type</label>
                                <select
                                    value={formData.contactType}
                                    onChange={e => setFormData({ ...formData, contactType: e.target.value as any })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all cursor-pointer"
                                >
                                    <option value="Client">Client</option>
                                    <option value="Lead">Lead</option>
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Industry Style</label>
                                <select
                                    value={formData.companyType}
                                    onChange={e => setFormData({ ...formData, companyType: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all cursor-pointer"
                                >
                                    {COMPANY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Pipeline Stage</label>
                                <select
                                    value={formData.contactStatus}
                                    onChange={e => setFormData({ ...formData, contactStatus: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all cursor-pointer"
                                >
                                    {CONTACT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="col-span-2 space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Assigned Representative</label>
                                <select
                                    value={formData.salesPerson}
                                    onChange={e => setFormData({ ...formData, salesPerson: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all cursor-pointer"
                                >
                                    <option value="">Unassigned</option>
                                    {salesReps.map(r => (
                                        <option key={r._id} value={r._id}>{r.firstName} {r.lastName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Business Intel */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-slate-400">
                            <Globe className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Business Intelligence</h3>
                        </div>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter flex items-center">
                                    <Globe className="w-2.5 h-2.5 mr-1" /> Website
                                </label>
                                <input
                                    value={formData.website}
                                    onChange={e => setFormData({ ...formData, website: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    placeholder="https://..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter flex items-center">
                                    <Facebook className="w-2.5 h-2.5 mr-1 text-blue-600" /> Facebook Page
                                </label>
                                <input
                                    value={formData.facebookPage}
                                    onChange={e => setFormData({ ...formData, facebookPage: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    placeholder="facebook.com/..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter flex items-center">
                                    <FileText className="w-2.5 h-2.5 mr-1" /> Industry Tag
                                </label>
                                <input
                                    value={formData.industry}
                                    onChange={e => setFormData({ ...formData, industry: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    placeholder="e.g. Technology"
                                />
                            </div>
                            <div className="col-span-3 space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Business Description</label>
                                    <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    rows={5}
                                    placeholder="Core business focus and overview..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Interaction & Forecasts */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-slate-400">
                            <DollarSign className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Growth & Financials</h3>
                        </div>
                        <div className="grid grid-cols-4 gap-6">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Forecasted Amount ($)</label>
                                <input
                                    type="number"
                                    value={formData.forecastedAmount}
                                    onChange={e => setFormData({ ...formData, forecastedAmount: parseFloat(e.target.value) || 0 })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Projected Close</label>
                                <input
                                    type="date"
                                    value={formData.projectedCloseDate}
                                    onChange={e => setFormData({ ...formData, projectedCloseDate: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Shipping Terms</label>
                                <input
                                    value={formData.defaultShippingTerms}
                                    onChange={e => setFormData({ ...formData, defaultShippingTerms: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    placeholder="e.g. Free Shipping"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Payment Method</label>
                                <input
                                    value={formData.defaultPaymentMethod}
                                    onChange={e => setFormData({ ...formData, defaultPaymentMethod: e.target.value })}
                                    className="w-full px-4 py-2 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    placeholder="e.g. Credit Card"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Section 4: Contact Channels */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-slate-400">
                            <Phone className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Contact Channels</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                        {/* Emails */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center">
                                    <Mail className="w-3 h-3 mr-2 text-blue-500" /> Emails
                                </h3>
                                <button type="button" onClick={() => addField('emails')} className="text-blue-600 hover:text-blue-700">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {formData.emails.map((email: any, idx: number) => (
                                <div key={idx} className="flex space-x-2">
                                    <input
                                        type="email"
                                        placeholder="email@example.com"
                                        value={email.value}
                                        onChange={e => {
                                            const newEmails = [...formData.emails];
                                            newEmails[idx].value = e.target.value;
                                            setFormData({ ...formData, emails: newEmails });
                                        }}
                                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-black transition-colors"
                                    />
                                    <button type="button" onClick={() => removeField('emails', idx)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Phones */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center">
                                    <Phone className="w-3 h-3 mr-2 text-emerald-500" /> Phones
                                </h3>
                                <button type="button" onClick={() => addField('phones')} className="text-blue-600 hover:text-blue-700">
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {formData.phones.map((phone: any, idx: number) => (
                                <div key={idx} className="flex space-x-2">
                                    <input
                                        type="tel"
                                        placeholder="(000) 000-0000"
                                        value={phone.value}
                                        onChange={e => {
                                            const formatted = formatPhoneNumber(e.target.value);
                                            const newPhones = [...formData.phones];
                                            newPhones[idx].value = formatted;
                                            setFormData({ ...formData, phones: newPhones });
                                        }}
                                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:border-black transition-colors"
                                    />
                                    <button type="button" onClick={() => removeField('phones', idx)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                    {/* Section 5: Locations */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 text-slate-400">
                                <MapPin className="w-4 h-4" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Geographic Locations</h3>
                            </div>
                            <button type="button" onClick={() => addField('addresses')} className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700">
                                <Plus className="w-3 h-3" />
                                <span>Add Location</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            {formData.addresses.map((address: any, idx: number) => (
                                <div key={idx} className="p-4 bg-white border border-slate-200 rounded-sm space-y-3 relative group shadow-sm">
                                    <button 
                                        type="button" 
                                        onClick={() => removeField('addresses', idx)} 
                                        className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                        placeholder="Street Address"
                                        value={address.street}
                                        onChange={e => {
                                            const newAddrs = [...formData.addresses];
                                            newAddrs[idx].street = e.target.value;
                                            setFormData({ ...formData, addresses: newAddrs });
                                        }}
                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                    />
                                    <div className="grid grid-cols-3 gap-2">
                                        <input
                                            placeholder="City"
                                            value={address.city}
                                            onChange={e => {
                                                const newAddrs = [...formData.addresses];
                                                newAddrs[idx].city = e.target.value;
                                                setFormData({ ...formData, addresses: newAddrs });
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 border border-slate-100 text-[10px] focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                        />
                                        <input
                                            placeholder="State"
                                            value={address.state}
                                            onChange={e => {
                                                const newAddrs = [...formData.addresses];
                                                newAddrs[idx].state = e.target.value;
                                                setFormData({ ...formData, addresses: newAddrs });
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 border border-slate-100 text-[10px] focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                        />
                                        <input
                                            placeholder="ZIP"
                                            value={address.postalCode}
                                            onChange={e => {
                                                const newAddrs = [...formData.addresses];
                                                newAddrs[idx].postalCode = e.target.value;
                                                setFormData({ ...formData, addresses: newAddrs });
                                            }}
                                            className="px-3 py-1.5 bg-slate-50 border border-slate-100 text-[10px] focus:outline-none focus:ring-1 focus:ring-black transition-all"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section 6: Billing Profile */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-slate-400">
                            <CreditCard className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Billing Profile</h3>
                        </div>
                        <div className="p-6 bg-slate-900 rounded-sm shadow-xl space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Cardholder Name</label>
                                    <input
                                        value={formData.billing.nameOnCard}
                                        onChange={e => setFormData({ ...formData, billing: { ...formData.billing, nameOnCard: e.target.value } })}
                                        className="w-full px-4 py-2 bg-slate-800 border-none text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                                        placeholder="Full Name"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Card Number</label>
                                    <input
                                        value={formData.billing.ccNumber}
                                        onChange={e => setFormData({ ...formData, billing: { ...formData.billing, ccNumber: e.target.value } })}
                                        className="w-full px-4 py-2 bg-slate-800 border-none text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                        placeholder="**** **** **** ****"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Expires</label>
                                    <input
                                        value={formData.billing.expirationDate}
                                        onChange={e => {
                                            const formatted = formatExpiryDate(e.target.value);
                                            setFormData({ ...formData, billing: { ...formData.billing, expirationDate: formatted.slice(0, 5) } });
                                        }}
                                        className="w-full px-4 py-2 bg-slate-800 border-none text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                        placeholder="MM/YY"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">CVV</label>
                                    <input
                                        value={formData.billing.securityCode}
                                        onChange={e => setFormData({ ...formData, billing: { ...formData.billing, securityCode: e.target.value } })}
                                        className="w-full px-4 py-2 bg-slate-800 border-none text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                        placeholder="***"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Billing ZIP</label>
                                    <input
                                        value={formData.billing.zipCode}
                                        onChange={e => setFormData({ ...formData, billing: { ...formData.billing, zipCode: e.target.value } })}
                                        className="w-full px-4 py-2 bg-slate-800 border-none text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                                        placeholder="00000"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 7: Notes */}
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-slate-400">
                            <FileText className="w-4 h-4" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Administrative Notes</h3>
                        </div>
                        <div className="space-y-1.5">
                            <textarea
                                rows={3}
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full px-4 py-3 bg-white border border-slate-200 text-sm focus:outline-none focus:ring-1 focus:ring-black transition-all resize-none shadow-sm"
                                placeholder="Add confidential internal notes here..."
                            />
                        </div>
                    </div>
                </form>

                {/* Footer Section */}
                <div className="px-8 py-5 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                    >
                        Discard Changes
                    </button>
                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            form="client-modal-form"
                            id="client-modal-form-submit"
                            disabled={isSubmitting}
                            onClick={() => {
                                const form = document.getElementById('client-modal-form') as HTMLFormElement;
                                if (form) form.requestSubmit();
                            }}
                            className="px-10 py-2.5 bg-black text-white text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center space-x-2 shadow-lg"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Syncing...</span>
                                </>
                            ) : (
                                <span>{initialData?._id ? 'Apply Updates' : `Initialize ${formData.contactType}`}</span>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
