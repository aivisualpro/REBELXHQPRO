'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
    Send, X, Mail, Paperclip, CheckCircle2, XCircle, AlertCircle,
    ChevronDown, ChevronUp, FileText, Loader2, MailPlus, Inbox, Search,
    BookTemplate, Save, Trash2, FileDown, History, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface ClientInfo {
    _id: string;
    name: string;
    emails?: { value: string; label?: string }[];
    contacts?: { firstName?: string; lastName?: string; email?: string; phone?: string; role?: string }[];
}

interface EmailRecord {
    _id: string;
    from: string;
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    body: string;
    bodyText: string;
    hasAttachment: boolean;
    attachmentName: string;
    status: 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced';
    sentBy: string;
    sentAt: string;
    errorMessage?: string;
}

interface EmailTemplateRecord {
    _id: string;
    name: string;
    subject: string;
    body: string;
}

interface RecipientMemory {
    email: string;
    lastUsed: string;
    count: number;
}

interface OrderEmailsTabProps {
    orderId: string;
    orderLabel: string;
    client: ClientInfo | null;
}

export function OrderEmailsTab({ orderId, orderLabel, client }: OrderEmailsTabProps) {
    const { data: session } = useSession();
    const [emails, setEmails] = useState<EmailRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Compose state
    const [toEmails, setToEmails] = useState<string[]>([]);
    const [toInput, setToInput] = useState('');
    const [ccEmails, setCcEmails] = useState<string[]>([]);
    const [ccInput, setCcInput] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [bccEmails, setBccEmails] = useState<string[]>([]);
    const [bccInput, setBccInput] = useState('');
    const [showBcc, setShowBcc] = useState(false);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [attachPdf, setAttachPdf] = useState(true);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestionField, setActiveSuggestionField] = useState<'to' | 'cc' | 'bcc'>('to');
    const toInputRef = useRef<HTMLInputElement>(null);

    // Templates state
    const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
    const [showTemplateMenu, setShowTemplateMenu] = useState(false);
    const [showSaveTemplate, setShowSaveTemplate] = useState(false);
    const [templateName, setTemplateName] = useState('');

    // Recipient memory state
    const [recipientMemory, setRecipientMemory] = useState<RecipientMemory[]>([]);

    // Gather all available emails from client + memory
    const availableEmails = useCallback(() => {
        const emailList: { email: string; label: string; source: 'client' | 'memory' }[] = [];
        const seen = new Set<string>();

        // Client emails first
        if (client) {
            client.emails?.forEach(e => {
                if (e.value && !seen.has(e.value.toLowerCase())) {
                    emailList.push({ email: e.value, label: e.label || 'Client', source: 'client' });
                    seen.add(e.value.toLowerCase());
                }
            });
            client.contacts?.forEach(c => {
                if (c.email && !seen.has(c.email.toLowerCase())) {
                    const name = [c.firstName, c.lastName].filter(Boolean).join(' ');
                    emailList.push({ email: c.email, label: name || c.role || 'Contact', source: 'client' });
                    seen.add(c.email.toLowerCase());
                }
            });
        }

        // Then recipient memory (previously used)
        recipientMemory.forEach(r => {
            if (!seen.has(r.email.toLowerCase())) {
                emailList.push({
                    email: r.email,
                    label: `Used ${r.count}x`,
                    source: 'memory',
                });
                seen.add(r.email.toLowerCase());
            }
        });

        return emailList;
    }, [client, recipientMemory]);

    const fetchEmails = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/sales/orders/${orderId}/emails`);
            if (res.ok) {
                const data = await res.json();
                setEmails(data.emails || []);
            }
        } catch (e) {
            console.error('Error fetching emails:', e);
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    // Fetch templates + recipient memory on mount
    useEffect(() => {
        fetchEmails();

        // Fetch templates
        fetch('/api/sales/email-templates')
            .then(r => r.json())
            .then(d => setTemplates(d.templates || []))
            .catch(() => { });

        // Fetch recipient memory
        fetch('/api/sales/email-recipients')
            .then(r => r.json())
            .then(d => setRecipientMemory(d.recipients || []))
            .catch(() => { });

        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [fetchEmails]);

    // ⚡ Poll for queued emails to update their status
    const startPolling = useCallback(() => {
        if (pollingRef.current) clearInterval(pollingRef.current);
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/sales/orders/${orderId}/emails`);
                if (res.ok) {
                    const data = await res.json();
                    const serverEmails: EmailRecord[] = data.emails || [];
                    
                    let newlyDelivered = 0;
                    let newlyFailed = 0;
                    let lastError = '';

                    setEmails(prev => {
                        let hasQueued = false;
                        newlyDelivered = 0;
                        newlyFailed = 0;
                        
                        const updated = prev.map(e => {
                            if (e.status === 'queued') {
                                // Try to match by real _id if it was updated, otherwise match fallback by subject and time
                                const match = serverEmails.find(se => 
                                    se._id === e._id || 
                                    (e._id.startsWith('optimistic-') && se.subject === e.subject && Math.abs(new Date(se.sentAt).getTime() - new Date(e.sentAt).getTime()) < 30000)
                                );
                                
                                if (match && match.status !== 'queued') {
                                    if (match.status === 'sent' || match.status === 'delivered') {
                                        newlyDelivered++;
                                    } else if (match.status === 'failed' || match.status === 'bounced') {
                                        newlyFailed++;
                                        lastError = match.errorMessage || 'Unknown error';
                                    }
                                    return match;
                                }
                                hasQueued = true;
                                // Return the match if found but still queued, else e
                                return match || e;
                            }
                            
                            // Also sync any other status changes just in case
                            const exist = serverEmails.find(se => se._id === e._id);
                            return exist || e;
                        });

                        if (!hasQueued && pollingRef.current) {
                            clearInterval(pollingRef.current);
                            pollingRef.current = null;
                        }
                        
                        return updated;
                    });

                    // Trigger side-effects OUTSIDE the state updater
                    if (newlyDelivered > 0) {
                        toast.success('Email delivered successfully!', { icon: '✅' });
                    }
                    if (newlyFailed > 0) {
                        toast.error(`Email failed: ${lastError || 'Unknown error'}`);
                    }
                }
            } catch { /* silently retry */ }
        }, 3000);
        pollingRef.current = interval;
    }, [orderId]);

    const openCompose = () => {
        const clientEmails = availableEmails();
        const clientOnly = clientEmails.filter(e => e.source === 'client');
        setToEmails(clientOnly.length > 0 ? [clientOnly[0].email] : []);
        setToInput('');
        setCcEmails([]);
        setCcInput('');
        setBccEmails([]);
        setBccInput('');
        setShowCc(false);
        setShowBcc(false);
        setSubject(`Invoice ${orderLabel}`);
        setBody(`Dear ${client?.name || 'Client'},\n\nPlease find attached your invoice ${orderLabel}.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nREBEL X Brands`);
        setAttachPdf(true);
        setShowTemplateMenu(false);
        setShowSaveTemplate(false);
        setIsComposeOpen(true);
    };

    const handleSend = async () => {
        if (toEmails.length === 0) {
            toast.error('Please add at least one recipient');
            return;
        }
        if (!subject.trim()) {
            toast.error('Subject is required');
            return;
        }

        // ⚡ OPTIMISTIC: Close modal and show email INSTANTLY
        const optimisticEmail: EmailRecord = {
            _id: `optimistic-${Date.now()}`,
            from: 'info@rebelxbrandscrm.com',
            to: [...toEmails],
            cc: [...ccEmails],
            bcc: [...bccEmails],
            subject: subject.trim(),
            body: body,
            bodyText: body,
            hasAttachment: attachPdf,
            attachmentName: attachPdf ? `${orderLabel}.pdf` : '',
            status: 'queued',
            sentBy: (session?.user as any)?.email || '',
            sentAt: new Date().toISOString(),
        };

        const sendPayload = {
            to: [...toEmails],
            cc: ccEmails.length > 0 ? [...ccEmails] : undefined,
            bcc: bccEmails.length > 0 ? [...bccEmails] : undefined,
            subject: subject.trim(),
            textBody: body,
            attachPdf,
            sentBy: (session?.user as any)?.email || (session?.user as any)?.id || '',
            orderLabel,
        };

        // Close modal and add to list IMMEDIATELY
        setIsComposeOpen(false);
        setEmails(prev => [optimisticEmail, ...prev]);
        toast.success('Email queued — sending in background...', { icon: '🚀' });

        // ⚡ Fire-and-forget API call
        fetch(`/api/sales/orders/${orderId}/emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sendPayload),
        })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.email) {
                    setEmails(prev => prev.map(e =>
                        e._id === optimisticEmail._id ? { ...data.email } : e
                    ));
                    startPolling();

                    // Update recipient memory with new emails
                    toEmails.forEach(email => {
                        setRecipientMemory(prev => {
                            const exists = prev.find(r => r.email.toLowerCase() === email.toLowerCase());
                            if (exists) {
                                return prev.map(r => r.email.toLowerCase() === email.toLowerCase()
                                    ? { ...r, count: r.count + 1, lastUsed: new Date().toISOString() }
                                    : r
                                );
                            }
                            return [{ email, count: 1, lastUsed: new Date().toISOString() }, ...prev];
                        });
                    });
                } else {
                    setEmails(prev => prev.map(e =>
                        e._id === optimisticEmail._id ? { ...e, status: 'failed' as const, errorMessage: data.error || 'Failed to send' } : e
                    ));
                    toast.error(data.error || 'Failed to send email');
                }
            })
            .catch(err => {
                setEmails(prev => prev.map(e =>
                    e._id === optimisticEmail._id ? { ...e, status: 'failed' as const, errorMessage: err.message || 'Network error' } : e
                ));
                toast.error('Network error sending email');
            });
    };

    const handleResend = (email: EmailRecord, e: React.MouseEvent) => {
        e.stopPropagation();

        const optimisticEmail: EmailRecord = {
            _id: `optimistic-${Date.now()}`,
            from: email.from || 'info@rebelxbrandscrm.com',
            to: [...email.to],
            cc: [...(email.cc || [])],
            bcc: [...(email.bcc || [])],
            subject: email.subject,
            body: email.body,
            bodyText: email.bodyText,
            hasAttachment: email.hasAttachment,
            attachmentName: email.attachmentName,
            status: 'queued',
            sentBy: (session?.user as any)?.email || '',
            sentAt: new Date().toISOString(),
        };

        const sendPayload = {
            to: [...email.to],
            cc: email.cc && email.cc.length > 0 ? [...email.cc] : undefined,
            bcc: email.bcc && email.bcc.length > 0 ? [...email.bcc] : undefined,
            subject: email.subject,
            htmlBody: email.body,
            textBody: email.bodyText,
            attachPdf: email.hasAttachment,
            sentBy: (session?.user as any)?.email || (session?.user as any)?.id || '',
            orderLabel,
        };

        setEmails(prev => [optimisticEmail, ...prev]);
        toast.success('Resending email...', { icon: '🚀' });

        fetch(`/api/sales/orders/${orderId}/emails`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sendPayload),
        })
            .then(res => res.json())
            .then(data => {
                if (data.success && data.email) {
                    setEmails(prev => prev.map(e =>
                        e._id === optimisticEmail._id ? { ...data.email } : e
                    ));
                    startPolling();
                } else {
                    setEmails(prev => prev.map(e =>
                        e._id === optimisticEmail._id ? { ...e, status: 'failed' as const, errorMessage: data.error || 'Failed to resend' } : e
                    ));
                    toast.error(data.error || 'Failed to resend email');
                }
            })
            .catch(err => {
                setEmails(prev => prev.map(e =>
                    e._id === optimisticEmail._id ? { ...e, status: 'failed' as const, errorMessage: err.message || 'Network error' } : e
                ));
                toast.error('Network error resending email');
            });
    };

    // Template functions
    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            toast.error('Template name is required');
            return;
        }
        try {
            const res = await fetch('/api/sales/email-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: templateName.trim(),
                    subject: subject,
                    body: body,
                    createdBy: (session?.user as any)?.email || '',
                }),
            });
            const data = await res.json();
            if (data.success) {
                setTemplates(prev => [data.template, ...prev]);
                setShowSaveTemplate(false);
                setTemplateName('');
                toast.success('Template saved!');
            }
        } catch {
            toast.error('Failed to save template');
        }
    };

    const handleLoadTemplate = (template: EmailTemplateRecord) => {
        if (template.subject) setSubject(template.subject);
        setBody(template.body);
        setShowTemplateMenu(false);
        toast.success(`Template "${template.name}" loaded`);
    };

    const handleDeleteTemplate = async (id: string) => {
        try {
            await fetch(`/api/sales/email-templates?id=${id}`, { method: 'DELETE' });
            setTemplates(prev => prev.filter(t => t._id !== id));
            toast.success('Template deleted');
        } catch {
            toast.error('Failed to delete template');
        }
    };

    const addEmail = (email: string, field: 'to' | 'cc' | 'bcc') => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;

        if (field === 'to' && !toEmails.includes(trimmed)) {
            setToEmails([...toEmails, trimmed]);
            setToInput('');
        } else if (field === 'cc' && !ccEmails.includes(trimmed)) {
            setCcEmails([...ccEmails, trimmed]);
            setCcInput('');
        } else if (field === 'bcc' && !bccEmails.includes(trimmed)) {
            setBccEmails([...bccEmails, trimmed]);
            setBccInput('');
        }
        setShowSuggestions(false);
    };

    const removeEmail = (email: string, field: 'to' | 'cc' | 'bcc') => {
        if (field === 'to') setToEmails(toEmails.filter(e => e !== email));
        else if (field === 'cc') setCcEmails(ccEmails.filter(e => e !== email));
        else setBccEmails(bccEmails.filter(e => e !== email));
    };

    const handleInputKeyDown = (e: React.KeyboardEvent, field: 'to' | 'cc' | 'bcc') => {
        const input = field === 'to' ? toInput : field === 'cc' ? ccInput : bccInput;
        if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
            e.preventDefault();
            addEmail(input, field);
        }
        if (e.key === 'Backspace' && !input) {
            const arr = field === 'to' ? toEmails : field === 'cc' ? ccEmails : bccEmails;
            if (arr.length > 0) {
                removeEmail(arr[arr.length - 1], field);
            }
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'queued':
                return (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-purple-500/15 text-purple-500 border border-purple-500/30 animate-pulse">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Sending</span>
                    </span>
                );
            case 'sent':
                return (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-sky-500/15 text-sky-500 border border-sky-500/30">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Sent</span>
                    </span>
                );
            case 'delivered':
                return (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>Delivered</span>
                    </span>
                );
            case 'failed':
                return (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-red-500/15 text-red-500 border border-red-500/30">
                        <XCircle className="w-2.5 h-2.5" />
                        <span>Failed</span>
                    </span>
                );
            case 'bounced':
                return (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-500 border border-amber-500/30">
                        <AlertCircle className="w-2.5 h-2.5" />
                        <span>Bounced</span>
                    </span>
                );
            default:
                return null;
        }
    };

    const formatEmailDate = (dateStr: string) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;

        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    };

    const filteredEmails = emails.filter(email => {
        if (!searchText) return true;
        const s = searchText.toLowerCase();
        return (
            email.subject.toLowerCase().includes(s) ||
            email.to.some(t => t.toLowerCase().includes(s)) ||
            email.bodyText?.toLowerCase().includes(s)
        );
    });

    const getSuggestions = (input: string, field: 'to' | 'cc' | 'bcc') => {
        const existing = field === 'to' ? toEmails : field === 'cc' ? ccEmails : bccEmails;
        return availableEmails().filter(e =>
            !existing.includes(e.email.toLowerCase()) &&
            (e.email.toLowerCase().includes(input.toLowerCase()) || e.label.toLowerCase().includes(input.toLowerCase()))
        );
    };

    // Render email suggestion item
    const renderSuggestion = (s: { email: string; label: string; source: 'client' | 'memory' }, field: 'to' | 'cc' | 'bcc') => (
        <button
            key={s.email}
            onMouseDown={e => { e.preventDefault(); addEmail(s.email, field); }}
            className="w-full text-left px-3 py-2 hover:bg-purple-500/10 transition-colors flex items-center justify-between cursor-pointer group"
        >
            <div className="flex items-center space-x-2 min-w-0">
                <div className={cn(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black shrink-0",
                    s.source === 'client'
                        ? "bg-purple-500/15 text-purple-500 border border-purple-500/20"
                        : "bg-blue-500/15 text-blue-500 border border-blue-500/20"
                )}>
                    {s.source === 'client' ? <Mail className="w-2.5 h-2.5" /> : <History className="w-2.5 h-2.5" />}
                </div>
                <span className="text-xs font-bold text-foreground truncate">{s.email}</span>
            </div>
            <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider shrink-0 ml-2",
                s.source === 'client' ? "text-purple-500" : "text-blue-500"
            )}>
                {s.label}
            </span>
        </button>
    );

    // Render email input field (shared between To, CC, BCC)
    const renderEmailField = (
        field: 'to' | 'cc' | 'bcc',
        label: string,
        emails: string[],
        input: string,
        setInput: (v: string) => void,
        chipColor: string,
        hovColor: string,
    ) => (
        <div className="px-4 py-2 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest w-8 shrink-0">{label}</span>
                {emails.map(email => (
                    <span
                        key={email}
                        className={`inline-flex items-center space-x-1 px-2 py-1 ${chipColor} text-[11px] font-bold rounded-sm group`}
                    >
                        <span>{email}</span>
                        <button
                            onClick={() => removeEmail(email, field)}
                            className="opacity-50 group-hover:opacity-100 hover:text-red-500 transition-all cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
                <div className="relative flex-1 min-w-[120px]">
                    <input
                        ref={field === 'to' ? toInputRef : undefined}
                        type="text"
                        value={input}
                        onChange={e => {
                            setInput(e.target.value);
                            setActiveSuggestionField(field);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => { setActiveSuggestionField(field); setShowSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        onKeyDown={e => handleInputKeyDown(e, field)}
                        placeholder={emails.length === 0 ? `Add ${label.toLowerCase()}...` : ''}
                        className="w-full text-xs py-1 bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    {showSuggestions && activeSuggestionField === field && getSuggestions(input, field).length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border shadow-xl z-50 max-h-48 overflow-y-auto rounded-sm">
                            {/* Section headers */}
                            {getSuggestions(input, field).some(s => s.source === 'client') && (
                                <div className="px-3 py-1.5 bg-secondary/50 border-b border-border">
                                    <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em]">Client Contacts</span>
                                </div>
                            )}
                            {getSuggestions(input, field).filter(s => s.source === 'client').map(s => renderSuggestion(s, field))}

                            {getSuggestions(input, field).some(s => s.source === 'memory') && (
                                <>
                                    <div className="px-3 py-1.5 bg-secondary/50 border-b border-border border-t">
                                        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-[0.2em]">Recently Used</span>
                                    </div>
                                    {getSuggestions(input, field).filter(s => s.source === 'memory').map(s => renderSuggestion(s, field))}
                                </>
                            )}
                        </div>
                    )}
                </div>
                {field === 'to' && (
                    <div className="flex items-center space-x-1 shrink-0">
                        {!showCc && (
                            <button onClick={() => setShowCc(true)} className="text-[9px] font-black text-muted-foreground hover:text-foreground uppercase tracking-wider cursor-pointer px-1">
                                Cc
                            </button>
                        )}
                        {!showBcc && (
                            <button onClick={() => setShowBcc(true)} className="text-[9px] font-black text-muted-foreground hover:text-foreground uppercase tracking-wider cursor-pointer px-1">
                                Bcc
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Email Header */}
            <div className="flex items-center justify-between px-4 h-10 border-b border-border bg-secondary/30 shrink-0">
                <div className="flex items-center space-x-3">
                    <Mail className="w-3.5 h-3.5 text-purple-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground">
                        Emails {emails.length > 0 && `(${emails.length})`}
                    </span>
                </div>
                <div className="flex items-center space-x-2">
                    <div className="relative">
                        <Search className="w-3 h-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search emails..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            className="h-7 pl-7 pr-3 text-[11px] bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-purple-500/30 w-48 text-foreground placeholder:text-muted-foreground"
                        />
                    </div>
                    <button
                        onClick={openCompose}
                        className="h-7 px-3 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center space-x-1.5 rounded-sm shadow-sm cursor-pointer"
                    >
                        <MailPlus className="w-3 h-3" />
                        <span>Compose</span>
                    </button>
                </div>
            </div>

            {/* Email List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                    </div>
                ) : filteredEmails.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center mb-4 border border-purple-500/20">
                            <Inbox className="w-7 h-7 text-purple-500/50" />
                        </div>
                        <p className="text-sm font-bold text-foreground mb-1">No emails sent yet</p>
                        <p className="text-xs text-muted-foreground mb-4 max-w-[240px]">
                            {searchText ? 'No emails match your search' : 'Send your first email with the invoice PDF attached'}
                        </p>
                        {!searchText && (
                            <button
                                onClick={openCompose}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700 transition-all rounded-sm shadow-lg cursor-pointer"
                            >
                                Send First Email
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-border/50">
                        {filteredEmails.map((email) => (
                            <div key={email._id} className="group">
                                <div
                                    onClick={() => setExpandedId(expandedId === email._id ? null : email._id)}
                                    className={cn(
                                        "flex items-center px-4 py-3 hover:bg-secondary/40 transition-all cursor-pointer gap-3",
                                        expandedId === email._id && "bg-secondary/60"
                                    )}
                                >
                                    <div className={cn(
                                        "w-2 h-2 rounded-full shrink-0",
                                        email.status === 'queued' ? "bg-purple-500 animate-pulse" :
                                            email.status === 'sent' ? "bg-sky-500" :
                                                email.status === 'delivered' ? "bg-emerald-500" :
                                                    email.status === 'failed' ? "bg-red-500" : "bg-amber-500"
                                    )} />

                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/20 flex items-center justify-center shrink-0">
                                        <Send className="w-3 h-3 text-purple-500" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center space-x-2 mb-0.5">
                                            <span className="text-xs font-bold text-foreground truncate">
                                                {email.to.join(', ')}
                                            </span>
                                            {email.hasAttachment && (
                                                <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-foreground/80 font-medium truncate">
                                                {email.subject}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">
                                                — {email.bodyText?.slice(0, 60)}...
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3 shrink-0">
                                        <button
                                            onClick={(e) => handleResend(email, e)}
                                            title="Resend this email"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground mr-1"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5" />
                                        </button>
                                        {getStatusBadge(email.status)}
                                        <span className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                                            {formatEmailDate(email.sentAt)}
                                        </span>
                                        {expandedId === email._id ? (
                                            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                                        ) : (
                                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                                        )}
                                    </div>
                                </div>

                                {expandedId === email._id && (
                                    <div className="px-6 py-5 bg-card/50 border-t border-border animate-in slide-in-from-top-1 duration-200">
                                        <div className="space-y-2 mb-5 pb-4 border-b border-border/50">
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-12 shrink-0">From</span>
                                                <span className="text-xs font-bold text-foreground">{email.from}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-12 shrink-0">To</span>
                                                <div className="flex flex-wrap gap-1">
                                                    {email.to.map((addr, i) => (
                                                        <span key={i} className="px-2 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[11px] font-bold rounded-sm border border-purple-500/20">
                                                            {addr}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            {email.cc && email.cc.length > 0 && (
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-12 shrink-0">CC</span>
                                                    <span className="text-xs text-foreground/70">{email.cc.join(', ')}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-12 shrink-0">Date</span>
                                                <span className="text-xs text-foreground/70">{new Date(email.sentAt).toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground w-12 shrink-0">By</span>
                                                <span className="text-xs text-foreground/70">{email.sentBy || '-'}</span>
                                            </div>
                                        </div>

                                        <h3 className="text-sm font-black text-foreground mb-3">{email.subject}</h3>

                                        <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium mb-4">
                                            {email.bodyText || email.body}
                                        </div>

                                        {email.hasAttachment && email.attachmentName && (
                                            <div className="pt-4 border-t border-border/50">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Attachment</p>
                                                <div className="inline-flex items-center space-x-2 px-3 py-2 bg-secondary/50 border border-border hover:border-purple-500/30 transition-colors rounded-sm">
                                                    <div className="w-8 h-8 bg-red-500/10 border border-red-500/20 rounded-sm flex items-center justify-center">
                                                        <FileText className="w-4 h-4 text-red-500" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-foreground">{email.attachmentName}</p>
                                                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">PDF Document</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {email.errorMessage && (
                                            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-sm">
                                                <div className="flex items-center space-x-2">
                                                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                                    <span className="text-xs text-red-500 font-bold">{email.errorMessage}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Compose Modal */}
            {isComposeOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border shadow-2xl w-full max-w-[640px] flex flex-col animate-in zoom-in-95 duration-200 overflow-hidden rounded-sm mx-4" style={{ maxHeight: '85vh' }}>
                        {/* Compose Header */}
                        <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white px-5 py-3 flex items-center justify-between shrink-0">
                            <div className="flex items-center space-x-2">
                                <MailPlus className="w-4 h-4" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em]">New Email</span>
                            </div>
                            <div className="flex items-center space-x-2">
                                {/* Template button */}
                                <div className="relative">
                                    <button
                                        onClick={() => { setShowTemplateMenu(!showTemplateMenu); setShowSaveTemplate(false); }}
                                        className="h-7 px-2 text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 rounded-sm flex items-center space-x-1 transition-colors cursor-pointer"
                                    >
                                        <BookTemplate className="w-3 h-3" />
                                        <span>Templates</span>
                                    </button>

                                    {showTemplateMenu && (
                                        <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border shadow-2xl z-50 rounded-sm overflow-hidden animate-in slide-in-from-top-1 duration-150">
                                            {/* Save as template */}
                                            <button
                                                onClick={() => { setShowSaveTemplate(!showSaveTemplate); }}
                                                className="w-full text-left px-3 py-2.5 text-xs font-bold text-foreground hover:bg-purple-500/10 transition-colors flex items-center space-x-2 border-b border-border cursor-pointer"
                                            >
                                                <Save className="w-3.5 h-3.5 text-purple-500" />
                                                <span>Save Current as Template</span>
                                            </button>

                                            {showSaveTemplate && (
                                                <div className="px-3 py-2.5 border-b border-border bg-secondary/30">
                                                    <div className="flex items-center space-x-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Template name..."
                                                            value={templateName}
                                                            onChange={e => setTemplateName(e.target.value)}
                                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveTemplate(); }}
                                                            className="flex-1 h-7 px-2 text-xs bg-background border border-border rounded-sm focus:outline-none focus:ring-1 focus:ring-purple-500/30 text-foreground"
                                                            autoFocus
                                                        />
                                                        <button
                                                            onClick={handleSaveTemplate}
                                                            className="h-7 px-3 text-[9px] font-black uppercase bg-purple-600 text-white hover:bg-purple-700 rounded-sm transition-colors cursor-pointer"
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Template list */}
                                            {templates.length === 0 ? (
                                                <div className="px-3 py-4 text-center">
                                                    <FileDown className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1" />
                                                    <p className="text-[10px] text-muted-foreground font-bold">No saved templates</p>
                                                </div>
                                            ) : (
                                                <div className="max-h-48 overflow-y-auto">
                                                    {templates.map(t => (
                                                        <div
                                                            key={t._id}
                                                            className="flex items-center justify-between px-3 py-2 hover:bg-secondary/50 transition-colors group"
                                                        >
                                                            <button
                                                                onClick={() => handleLoadTemplate(t)}
                                                                className="flex-1 text-left cursor-pointer min-w-0"
                                                            >
                                                                <p className="text-xs font-bold text-foreground truncate">{t.name}</p>
                                                                <p className="text-[10px] text-muted-foreground truncate">{t.body.slice(0, 50)}...</p>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteTemplate(t._id)}
                                                                className="p-1 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2 cursor-pointer"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button onClick={() => setIsComposeOpen(false)} className="hover:text-white/70 transition-colors cursor-pointer">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Compose Body */}
                        <div className="flex-1 overflow-y-auto" onClick={() => { setShowTemplateMenu(false); setShowSaveTemplate(false); }}>
                            {/* To Field */}
                            {renderEmailField('to', 'To', toEmails, toInput, setToInput, 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20', 'hover:bg-purple-500/10')}

                            {/* CC Field */}
                            {showCc && renderEmailField('cc', 'Cc', ccEmails, ccInput, setCcInput, 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20', 'hover:bg-indigo-500/10')}

                            {/* BCC Field */}
                            {showBcc && renderEmailField('bcc', 'Bcc', bccEmails, bccInput, setBccInput, 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20', 'hover:bg-violet-500/10')}

                            {/* Subject */}
                            <div className="px-4 border-b border-border">
                                <input
                                    type="text"
                                    placeholder="Subject"
                                    value={subject}
                                    onChange={e => setSubject(e.target.value)}
                                    className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted-foreground font-bold text-foreground"
                                />
                            </div>

                            {/* Body */}
                            <div className="px-4">
                                <textarea
                                    placeholder="Compose your email..."
                                    rows={10}
                                    value={body}
                                    onChange={e => setBody(e.target.value)}
                                    className="w-full text-sm py-4 bg-transparent focus:outline-none resize-none placeholder:text-muted-foreground font-medium text-foreground leading-relaxed"
                                />
                            </div>

                            {/* PDF Attachment Toggle */}
                            <div className="mx-4 mb-3 p-3 bg-secondary/50 border border-border rounded-sm">
                                <label className="flex items-center justify-between cursor-pointer group">
                                    <div className="flex items-center space-x-3">
                                        <div className={cn(
                                            "w-9 h-9 rounded-sm flex items-center justify-center transition-colors",
                                            attachPdf ? "bg-red-500/15 border border-red-500/30" : "bg-secondary border border-border"
                                        )}>
                                            <FileText className={cn("w-4 h-4", attachPdf ? "text-red-500" : "text-muted-foreground")} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-foreground">Attach Invoice PDF</p>
                                            <p className="text-[10px] text-muted-foreground">{orderLabel}.pdf — Auto-generated from order</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={attachPdf}
                                        onClick={() => setAttachPdf(!attachPdf)}
                                        className={cn(
                                            "w-10 h-5 rounded-full transition-colors relative shadow-inner shrink-0",
                                            attachPdf ? "bg-purple-600" : "bg-border"
                                        )}
                                    >
                                        <span className={cn(
                                            "block w-4 h-4 bg-white rounded-full transition-transform absolute top-0.5 left-0.5 shadow",
                                            attachPdf ? "translate-x-5" : "translate-x-0"
                                        )} />
                                    </button>
                                </label>
                            </div>
                        </div>

                        {/* Compose Footer */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/30 shrink-0">
                            <button
                                onClick={handleSend}
                                disabled={toEmails.length === 0}
                                className="flex items-center space-x-2 px-6 h-9 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-[0.15em] hover:from-purple-700 hover:to-indigo-700 transition-all rounded-sm shadow-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Send Email</span>
                            </button>
                            <button
                                onClick={() => setIsComposeOpen(false)}
                                className="px-4 h-9 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:bg-secondary transition-colors rounded-sm cursor-pointer"
                            >
                                Discard
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
