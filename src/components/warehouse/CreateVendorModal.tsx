import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const CITY_OPTIONS = ['Ann Arbor', 'Detroit', 'Grand Rapids', 'Lansing', 'Kalamazoo', 'Flint', 'Traverse City', 'Saginaw', 'Battle Creek', 'Holland', 'Pontiac', 'Dearborn', 'Troy', 'Novi', 'Other'];
const STATE_OPTIONS = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
const COUNTRY_OPTIONS = ['United States', 'Canada', 'Mexico', 'China', 'Germany', 'United Kingdom', 'Brazil', 'India', 'Other'];
const PAYMENT_TERMS_OPTIONS = ['Net 10', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'COD', 'Due on Receipt', 'Prepaid', '2/10 Net 30', 'Other'];

interface CreateVendorModalProps {
    initialName?: string;
    onClose: () => void;
    onSuccess: (vendorDoc: { _id: string; name: string }) => void;
}

export function CreateVendorModal({ initialName = '', onClose, onSuccess }: CreateVendorModalProps) {
    const [editForm, setEditForm] = useState({
        name: initialName,
        contactName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: '',
        website: '',
        paymentTerms: '',
        status: 'Active'
    });
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editForm.name?.trim()) {
            toast.error('Vendor name is required');
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch('/api/vendors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            if (res.ok) {
                const created = await res.json();
                toast.success('Vendor created');
                onSuccess({ _id: created._id, name: created.name });
                onClose();
            } else {
                const err = await res.json();
                toast.error(err.error || 'Failed to create vendor');
            }
        } catch {
            toast.error('Error creating vendor');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-background border border-border rounded shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between px-6 h-[36px] border-b border-border bg-secondary/50">
                    <h2 className="text-sm font-black uppercase text-foreground tracking-widest">Create Vendor</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scrollbar-custom">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={editForm.name}
                                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                                required
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Contact Name</label>
                            <input
                                type="text"
                                value={editForm.contactName}
                                onChange={e => setEditForm({ ...editForm, contactName: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Email</label>
                            <input
                                type="email"
                                value={editForm.email}
                                onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Phone</label>
                            <input
                                type="text"
                                value={editForm.phone}
                                onChange={e => {
                                    const raw = e.target.value.replace(/\D/g, '').slice(0, 10);
                                    let fmt = raw;
                                    if (raw.length > 6) fmt = `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
                                    else if (raw.length > 3) fmt = `(${raw.slice(0, 3)}) ${raw.slice(3)}`;
                                    else if (raw.length > 0) fmt = `(${raw}`;
                                    setEditForm({ ...editForm, phone: fmt });
                                }}
                                placeholder="(000) 000-0000"
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Website</label>
                            <input
                                type="text"
                                value={editForm.website}
                                onChange={e => setEditForm({ ...editForm, website: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            />
                        </div>
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Address</label>
                            <input
                                type="text"
                                value={editForm.address}
                                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">City</label>
                            <select
                                value={editForm.city}
                                onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            >
                                <option value="">Select City</option>
                                {CITY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">State</label>
                            <select
                                value={editForm.state}
                                onChange={e => setEditForm({ ...editForm, state: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            >
                                <option value="">Select State</option>
                                {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Zip Code</label>
                            <input
                                type="text"
                                value={editForm.zipCode}
                                onChange={e => setEditForm({ ...editForm, zipCode: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Country</label>
                            <select
                                value={editForm.country}
                                onChange={e => setEditForm({ ...editForm, country: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            >
                                <option value="">Select Country</option>
                                {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Payment Terms</label>
                            <select
                                value={editForm.paymentTerms}
                                onChange={e => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            >
                                <option value="">Select Payment Terms</option>
                                {PAYMENT_TERMS_OPTIONS.map(pt => <option key={pt} value={pt}>{pt}</option>)}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Status</label>
                            <select
                                value={editForm.status}
                                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                                className="w-full px-3 h-[36px] border border-border rounded text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary/10"
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-3 pt-6 border-t border-border mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-secondary text-foreground text-[10px] font-black uppercase tracking-widest rounded-md hover:bg-secondary/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Create Vendor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
