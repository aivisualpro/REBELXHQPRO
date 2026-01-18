'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { X, Loader2, Plus, Trash2, Mail, Phone, MapPin, Globe, Facebook, Briefcase, DollarSign, Calendar, CreditCard, Ship, Wallet, FileText, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
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
    let clearValue = value.replace(/[^\d]/g, '');
    
    // Auto-prefix single digit > 1 (e.g. typing '3' becomes '03')
    if (clearValue.length === 1 && parseInt(clearValue) > 1 && parseInt(clearValue) <= 9) {
        clearValue = '0' + clearValue;
    }
    
    if (clearValue.length >= 2) {
        return `${clearValue.slice(0, 2)}/${clearValue.slice(2, 4)}`;
    }
    return clearValue;
};

const getCardType = (number: string) => {
    const n = number.replace(/\D/g, '');
    if (n.startsWith('4')) return 'Visa';
    if (/^5[1-5]/.test(n) || /^2(2\d{2}|[3-6]\d{2}|7[0-1]\d|720)/.test(n)) return 'MasterCard';
    if (/^3[47]/.test(n)) return 'Amex';
    if (/^6(?:011|5|4[4-9]|22)/.test(n)) return 'Discover';
    return '';
};

const getCardTheme = (type: string) => {
    switch (type.toLowerCase()) {
        case 'visa': return 'from-[#1a1f71] to-[#00579f]';
        case 'mastercard': return 'from-[#232323] to-[#4b4b4b]';
        case 'amex': return 'from-[#007bc1] to-[#00a3e0]';
        case 'discover': return 'from-[#f68121] to-[#ff9d4d]';
        default: return 'from-slate-900 to-slate-800';
    }
};

const formatCCNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
        parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
        return parts.join(' ');
    } else {
        return v;
    }
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

    const [showCC, setShowCC] = useState(false);
    const [showCVV, setShowCVV] = useState(false);
    
    const cardType = getCardType(formData.billing.ccNumber);
    const cardTheme = getCardTheme(cardType);

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
                    <button onClick={onClose} className="text-slate-400 hover:text-black transition-colors cursor-pointer">
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
                                <button type="button" onClick={() => addField('emails')} className="text-blue-600 hover:text-blue-700 cursor-pointer">
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
                                    <button type="button" onClick={() => removeField('emails', idx)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer">
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
                                <button type="button" onClick={() => addField('phones')} className="text-blue-600 hover:text-blue-700 cursor-pointer">
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
                                    <button type="button" onClick={() => removeField('phones', idx)} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors cursor-pointer">
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
                            <button type="button" onClick={() => addField('addresses')} className="flex items-center space-x-1.5 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 cursor-pointer">
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
                                        className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
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

                    {/* Section 6: billing Profile */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3 text-slate-400">
                                <CreditCard className="w-4 h-4" />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Secure Billing Profile</h3>
                            </div>
                            <div className="flex items-center space-x-2 bg-emerald-500/10 px-2 py-1 rounded">
                                <Lock className="w-3 h-3 text-emerald-500" />
                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Secure Handshake</span>
                            </div>
                        </div>
                        
                        <div className={cn("p-6 rounded-sm shadow-2xl space-y-8 relative overflow-hidden group bg-gradient-to-br transition-all duration-500", cardTheme)}>
                            {/* Card Chip & Type Badge */}
                            <div className="flex items-start justify-between relative z-10">
                                <div className="w-10 h-7 bg-gradient-to-br from-yellow-200 via-yellow-400 to-yellow-600 rounded-sm relative overflow-hidden shadow-inner">
                                    <div className="absolute inset-0 border-[0.5px] border-black/10"></div>
                                    <div className="absolute top-1/2 left-0 w-full h-[0.5px] bg-black/20"></div>
                                    <div className="absolute top-0 left-1/2 w-[0.5px] h-full bg-black/20"></div>
                                </div>
                                {cardType && (
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{cardType}</span>
                                )}
                            </div>

                            {/* Visual Security Overlay */}
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                                <ShieldCheck className="w-32 h-32 text-white" />
                            </div>

                            <div className="grid grid-cols-2 gap-8 relative z-10">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Cardholder Name</label>
                                    <input
                                        value={formData.billing.nameOnCard}
                                        autoComplete="cc-name"
                                        onChange={e => setFormData({ ...formData, billing: { ...formData.billing, nameOnCard: e.target.value.toUpperCase() } })}
                                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-600 font-medium"
                                        placeholder="CHRIS JOHNSON"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Encrypted Card Number</label>
                                    <div className="relative">
                                        <input
                                            type={showCC ? "text" : "password"}
                                            value={formData.billing.ccNumber}
                                            autoComplete="cc-number"
                                            onChange={e => {
                                                const formatted = formatCCNumber(e.target.value);
                                                setFormData({ ...formData, billing: { ...formData.billing, ccNumber: formatted.slice(0, 19) } });
                                            }}
                                            className="w-full pl-4 pr-10 py-2.5 bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono tracking-widest"
                                            placeholder="XXXX XXXX XXXX XXXX"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowCC(!showCC)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                        >
                                            {showCC ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-8 relative z-10">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Expiry Date</label>
                                    <input
                                        value={formData.billing.expirationDate}
                                        autoComplete="cc-exp"
                                        onChange={e => {
                                            const formatted = formatExpiryDate(e.target.value);
                                            setFormData({ ...formData, billing: { ...formData.billing, expirationDate: formatted.slice(0, 5) } });
                                        }}
                                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                        placeholder="MM/YY"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Security code (CVV)</label>
                                    <div className="relative">
                                        <input
                                            type={showCVV ? "text" : "password"}
                                            value={formData.billing.securityCode}
                                            autoComplete="cc-csc"
                                            onChange={e => setFormData({ ...formData, billing: { ...formData.billing, securityCode: e.target.value.replace(/\D/g, '').slice(0, 4) } })}
                                            className="w-full pl-4 pr-10 py-2.5 bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                            placeholder="***"
                                        />
                                        <button 
                                            type="button"
                                            onClick={() => setShowCVV(!showCVV)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                                        >
                                            {showCVV ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Billing ZIP</label>
                                    <input
                                        value={formData.billing.zipCode}
                                        autoComplete="postal-code"
                                        onChange={e => setFormData({ ...formData, billing: { ...formData.billing, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) } })}
                                        className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/50 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                                        placeholder="00000"
                                    />
                                </div>
                            </div>

                            {/* Industry Standard Badges */}
                            <div className="pt-4 mt-4 border-t border-slate-800/50 flex items-center justify-between opacity-50 relative z-10">
                                <div className="flex items-center space-x-4">
                                    <div className="flex flex-col">
                                        <div className="flex items-center space-x-1">
                                            <ShieldCheck className="w-2.5 h-2.5 text-blue-400" />
                                            <span className="text-[8px] font-black uppercase text-slate-400">256-Bit SSL</span>
                                        </div>
                                        <span className="text-[7px] text-slate-600 font-medium">Military Grade Encryption</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center space-x-1">
                                            <Lock className="w-2.5 h-2.5 text-emerald-400" />
                                            <span className="text-[8px] font-black uppercase text-slate-400">PCI-DSS Compliant</span>
                                        </div>
                                        <span className="text-[7px] text-slate-600 font-medium">Vault Storage Enabled</span>
                                    </div>
                                </div>
                                <div className="text-[10px] text-white font-black italic tracking-tighter">
                                    REBEL<span className="text-blue-500">X</span> SECURE
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
                        className="px-6 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
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
                            className="px-10 py-2.5 bg-[#FFEF5F] text-black text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-90 transition-all disabled:opacity-50 flex items-center space-x-2 shadow-lg cursor-pointer"
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
