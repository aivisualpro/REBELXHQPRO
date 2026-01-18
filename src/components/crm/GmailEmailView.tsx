'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { 
  Plus, ChevronLeft, ChevronRight, Trash2, Send, X, MailOpen, MailCheck, Star, User,
  Paperclip, Link as LinkIcon, Smile, Image as ImageIcon, MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface GmailEmailViewProps {
    initialLabel: 'INBOX' | 'SENT';
    forcedClientEmails?: string[]; // Optional prop to force filtering by specific client emails
}

export function GmailEmailView({ initialLabel, forcedClientEmails }: GmailEmailViewProps) {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [composeError, setComposeError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [tokensByPage, setTokensByPage] = useState<Record<number, string | null>>({ 1: null });
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<{ url: string, type: string, name: string } | null>(null);
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const emailsPerPage = 50;

  // Filter settings
  const [filterByClients, setFilterByClients] = useState(false);
  const [clientEmails, setClientEmails] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Fetch settings and client emails on mount
  useEffect(() => {
    const loadFilterSettings = async () => {
      try {
        if (forcedClientEmails && forcedClientEmails.length > 0) {
            // Use forced client emails if provided
            setFilterByClients(true);
            setClientEmails(forcedClientEmails);
            setSettingsLoaded(true);
            console.log('Using forced client emails:', forcedClientEmails);
            return;
        }

        // Fetch CRM settings
        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          const filterEnabled = settingsData.crmFilterEmailsByClients === true;
          setFilterByClients(filterEnabled);
          
          // If filtering is enabled, fetch all client emails
          if (filterEnabled) {
            const clientsRes = await fetch('/api/clients?limit=10000');
            if (clientsRes.ok) {
              const clientsData = await clientsRes.json();
              const allEmails: string[] = [];
              clientsData.clients?.forEach((client: any) => {
                client.emails?.forEach((e: any) => {
                  if (e.value) allEmails.push(e.value.toLowerCase().trim());
                });
              });
              setClientEmails(allEmails);
              console.log('Loaded client emails for filtering:', allEmails.length);
            }
          }
        }
      } catch (error) {
        console.error('Error loading filter settings:', error);
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadFilterSettings();
  }, [forcedClientEmails]);

  const fetchEmails = useCallback(async (page: number) => {
    setLoading(true);
    try {
        const token = tokensByPage[page];
        const res = await fetch(`/api/gmail?label=${initialLabel}${token ? `&pageToken=${token}` : ''}`);
        const data = await res.json();
        
        if (data.emails) {
            let filteredEmails = data.emails;
            
            // Filter emails if setting is enabled and we have client emails
            if (filterByClients && clientEmails.length > 0) {
              console.log('Filtering emails by', clientEmails.length, 'client emails:', clientEmails.slice(0, 5));
              filteredEmails = data.emails.filter((email: any) => {
                // Get sender email (already extracted by API)
                const senderEmail = (email.senderEmail || '').toLowerCase().trim();
                
                // Get all recipients (to, cc, bcc may contain multiple emails)
                const allRecipients = [
                  email.recipient || '',
                  email.cc || '',
                  email.bcc || ''
                ].join(' ').toLowerCase();
                
                // Check if sender matches any client email
                const senderMatch = clientEmails.some(ce => senderEmail.includes(ce) || ce.includes(senderEmail));
                
                // Check if any recipient matches any client email
                const recipientMatch = clientEmails.some(ce => allRecipients.includes(ce));
                
                if (senderMatch || recipientMatch) {
                  console.log('Match found:', email.subject, '- sender:', senderEmail, '- recipients:', allRecipients.substring(0, 50));
                }
                
                return senderMatch || recipientMatch;
              });
              console.log('Filtered from', data.emails.length, 'to', filteredEmails.length, 'emails');
            }
            
            setEmails(filteredEmails);
            setTotalEstimated(filterByClients ? filteredEmails.length : (data.resultSizeEstimate || 0));
            
            // Calculate unread count based on filtered emails if filtering is enabled
            if (filterByClients && clientEmails.length > 0) {
              const filteredUnread = filteredEmails.filter((e: any) => !e.isRead).length;
              setUnreadCount(filteredUnread);
            } else {
              setUnreadCount(data.unreadCount || 0);
            }
            
            if (data.nextPageToken) {
                setTokensByPage(prev => ({ ...prev, [page + 1]: data.nextPageToken }));
                setNextPageToken(data.nextPageToken);
            } else {
                setNextPageToken(null);
            }
        }
    } catch (error) {
        console.error('Error fetching emails:', error);
        toast.error('Failed to load emails');
    } finally {
        setLoading(false);
    }
  }, [initialLabel, tokensByPage, filterByClients, clientEmails]);

  // Only fetch emails AFTER settings are loaded
  useEffect(() => {
    if (!settingsLoaded) return;
    fetchEmails(1);
    setCurrentPage(1);
    setTokensByPage({ 1: null });
  }, [initialLabel, settingsLoaded, filterByClients, clientEmails]);

  const handleCompose = async () => {
    setComposeError(null);
    try {
        const res = await fetch('/api/gmail', {
            method: 'POST',
            body: JSON.stringify(composeData)
        });
        
        const data = await res.json();
        
        if (res.ok) {
            setIsComposeOpen(false);
            setComposeData({ to: '', subject: '', body: '' });
            toast.success('Email sent successfully');
            if (initialLabel === 'SENT') fetchEmails(1);
        } else {
            setComposeError(data.error || 'Failed to send email');
        }
    } catch (error) {
        setComposeError('An unexpected error occurred. Please try again.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
        const res = await fetch('/api/gmail', {
            method: 'PATCH',
            body: JSON.stringify({ messageId: id, action: 'TRASH' })
        });
        if (res.ok) {
            setEmails(prev => prev.filter(e => e.id !== id));
            if (expandedEmailId === id) setExpandedEmailId(null);
            toast.success('Email moved to trash');
        }
    } catch (error) {
        console.error('Error deleting email:', error);
    }
  };

  const toggleReadStatus = async (id: string, currentlyRead: boolean) => {
    try {
        await fetch('/api/gmail', {
            method: 'PATCH',
            body: JSON.stringify({ messageId: id, action: currentlyRead ? 'UNREAD' : 'READ' })
        });
        setEmails(prev => prev.map(e => e.id === id ? { ...e, isRead: !currentlyRead } : e));
        setUnreadCount(prev => currentlyRead ? prev + 1 : Math.max(0, prev - 1));
    } catch (error) {
        console.error('Error toggling read status:', error);
    }
  };

  const handleAttachmentClick = async (emailId: string, att: any) => {
    try {
        const res = await fetch(`/api/gmail?messageId=${emailId}&attachmentId=${att.id}`);
        if (!res.ok) throw new Error('Failed to fetch attachment');
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(new Blob([blob], { type: att.mimeType }));
        
        // Supported types for preview in popup
        const isSupportedPreview = 
            att.mimeType === 'application/pdf' || 
            att.mimeType.startsWith('image/') || 
            att.mimeType.startsWith('video/') ||
            att.mimeType.startsWith('audio/');

        if (isSupportedPreview) {
            setPreviewAttachment({ url, type: att.mimeType, name: att.filename });
        } else {
            // Otherwise, force download
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', att.filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
        }
    } catch (error) {
        console.error('Error handling attachment:', error);
        toast.error('Failed to open attachment');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background transition-colors duration-300">
        {/* Gmail Header Controls */}
        <div className="flex items-center justify-between px-6 h-11 border-b border-border bg-secondary/50 transition-colors">
            <h1 className="text-sm font-bold text-foreground uppercase tracking-tighter shrink-0">
                {initialLabel === 'INBOX' ? unreadCount > 0 ? `Inbox (${unreadCount})` : 'Inbox' : 'Sent'}
            </h1>
            <div className="flex items-center space-x-6">
                <button 
                    onClick={() => setIsComposeOpen(true)}
                    className="flex items-center space-x-2 px-3 h-8 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all rounded shadow-sm cursor-pointer"
                >
                    <Plus className="w-3 h-3" />
                    <span>Compose</span>
                </button>
                
                <div className="flex items-center space-x-4 text-muted-foreground">
                    <span className="text-[10px] font-bold">
                        {emails.length > 0 ? `${(currentPage - 1) * emailsPerPage + 1}-${Math.min(currentPage * emailsPerPage, totalEstimated)} of ${totalEstimated}` : '0-0 of 0'}
                    </span>
                    <div className="flex items-center space-x-1">
                        <button 
                            disabled={currentPage === 1 || loading}
                            onClick={() => {
                                const newPage = currentPage - 1;
                                setCurrentPage(newPage);
                                fetchEmails(newPage);
                            }}
                            className="p-1 hover:text-foreground transition-colors disabled:opacity-30 cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button 
                            disabled={!nextPageToken || loading}
                            onClick={() => {
                                const newPage = currentPage + 1;
                                setCurrentPage(newPage);
                                fetchEmails(newPage);
                            }}
                            className="p-1 hover:text-foreground transition-colors disabled:opacity-30 cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Gmail List */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/50 relative min-h-[400px]">
            {loading && (
                <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                </div>
            )}
            
            {emails.map((email: any) => (
                <div key={email.id} className="border-b border-border/30 last:border-0">
                        <div 
                        onClick={() => {
                            setExpandedEmailId(expandedEmailId === email.id ? null : email.id);
                            if (!email.isRead && initialLabel === 'INBOX') toggleReadStatus(email.id, false);
                        }}
                        className={cn(
                            "flex items-center px-4 h-12 hover:bg-secondary/40 transition-all group cursor-pointer gap-3",
                            email.isRead ? "bg-background" : "bg-primary/5",
                            expandedEmailId === email.id && "bg-secondary"
                        )}
                    >
                        <div className="shrink-0 text-slate-300 hover:text-slate-600 cursor-pointer p-1">
                            <Star className="w-5 h-5 stroke-[1.5]" />
                        </div>
                        <div className={cn(
                            "w-48 shrink-0 text-[14px] truncate ml-1",
                            email.isRead ? "font-normal text-muted" : "font-black text-foreground"
                        )}>
                            {initialLabel === 'INBOX' 
                                ? email.sender 
                                : (email.recipient || 'Unknown').split(',')[0].replace(/<.*>/, '').replace(/"/g, '').trim() || (email.recipient || 'Unknown').split(',')[0]
                            }
                        </div>
                        <div className="flex-1 min-w-0 flex items-baseline text-[14px] truncate pr-4">
                             <span className={cn(
                                "truncate shrink-0 max-w-[400px]", 
                                email.isRead ? "font-normal text-muted" : "font-black text-foreground"
                             )}>
                                {email.subject}
                             </span>
                             <span className="text-muted/50 mx-1 shrink-0">-</span>
                             <span className="text-muted/70 truncate font-normal">
                                {email.snippet}
                             </span>
                        </div>
                        <div className="shrink-0 flex items-center justify-end min-w-[120px] space-x-3">
                            {email.attachments?.length > 0 && (
                                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span className={cn(
                                "text-[12px] group-hover:hidden",
                                email.isRead ? "font-normal text-muted" : "font-black text-foreground"
                            )}>
                                {new Date(email.timestamp).toDateString() === new Date().toDateString() ? email.time : email.date}
                            </span>
                            <div className="hidden group-hover:flex items-center justify-end space-x-1">
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(email.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                {initialLabel === 'INBOX' && (
                                    <button onClick={(e) => { e.stopPropagation(); toggleReadStatus(email.id, email.isRead); }} className="p-1.5 text-muted hover:text-accent hover:bg-accent/10 rounded cursor-pointer">
                                        {email.isRead ? <MailOpen className="w-4 h-4" /> : <MailCheck className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {expandedEmailId === email.id && (
                        <div className="px-16 py-8 bg-card/50 border-y border-border transition-colors duration-300">
                             <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-secondary rounded-full flex items-center justify-center border border-border">
                                        <User className="w-5 h-5 text-muted" />
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm font-black text-foreground">{email.sender}</span>
                                            <span className="text-xs text-muted font-medium tracking-wider">&lt;{email.senderEmail || ''}&gt;</span>
                                        </div>
                                        <div className="flex items-center space-x-2 mt-0.5">
                                            <span className="text-[10px] text-muted/80 font-bold uppercase tracking-widest">to {initialLabel === 'INBOX' ? 'me' : email.recipient}</span>
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{email.date} ({email.time})</span>
                            </div>
                            <div className="space-y-6">
                                <h3 className="text-lg font-black text-foreground">{email.subject}</h3>
                                <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium">
                                    {email.body}
                                </div>

                                {email.attachments?.length > 0 && (
                                    <div className="pt-8 border-t border-slate-50">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Attachments ({email.attachments.length})</p>
                                        <div className="flex flex-wrap gap-3">
                                            {email.attachments.map((att: any) => (
                                                <div 
                                                    key={att.id} 
                                                    onClick={() => handleAttachmentClick(email.id, att)}
                                                    className="group relative flex items-center space-x-3 p-3 bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100 min-w-[200px] cursor-pointer"
                                                >
                                                    <div className="p-2 bg-white border border-slate-200">
                                                        <Paperclip className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-black text-slate-900 truncate">{att.filename}</p>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{(att.size / 1024).toFixed(1)} KB</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ))}
            
            {(!loading && settingsLoaded && emails.length === 0) && (
                <div className="py-20 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest">
                    No messages found in {initialLabel.toLowerCase()}
                </div>
            )}
        </div>

        {/* Compose Modal */}
        {isComposeOpen && (
            <div className="fixed bottom-0 right-12 w-[540px] bg-card border border-border shadow-2xl z-[1001] animate-in slide-in-from-bottom-5 duration-300">
                <div className="bg-[#1A1A1A] text-white px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">New message</span>
                    <div className="flex items-center space-x-3">
                         <button className="hover:text-slate-300 transition-colors cursor-pointer"><MoreHorizontal className="w-4 h-4" /></button>
                         <button onClick={() => setIsComposeOpen(false)} className="hover:text-slate-300 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="p-0">
                    {composeError && <p className="text-xs text-red-400 font-medium bg-red-500/10 p-4 border-b border-red-500/20">{composeError}</p>}
                    <div className="px-4 border-b border-border">
                        <input type="text" placeholder="Recipients" className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground" value={composeData.to} onChange={(e) => setComposeData({...composeData, to: e.target.value})} />
                    </div>
                    <div className="px-4 border-b border-border">
                        <input type="text" placeholder="Subject" className="w-full text-sm py-3 bg-transparent focus:outline-none placeholder:text-muted font-medium text-foreground" value={composeData.subject} onChange={(e) => setComposeData({...composeData, subject: e.target.value})} />
                    </div>
                    <div className="px-4">
                        <textarea placeholder="Message" rows={12} className="w-full text-sm py-4 bg-transparent focus:outline-none resize-none placeholder:text-muted font-medium text-foreground leading-relaxed" value={composeData.body} onChange={(e) => setComposeData({...composeData, body: e.target.value})} />
                    </div>

                    {/* Attachment List */}
                    {attachments.length > 0 && (
                        <div className="px-4 py-2 border-t border-border flex flex-wrap gap-2 bg-secondary/50">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="flex items-center space-x-2 bg-white border border-slate-200 px-2 py-1 rounded text-[10px] font-bold text-slate-600">
                                    <Paperclip className="w-3 h-3" />
                                    <span className="truncate max-w-[100px]">{file.name}</span>
                                    <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="hover:text-red-500 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Toolbar & Send */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
                        <div className="flex items-center space-x-1">
                            <button onClick={handleCompose} className="flex items-center space-x-3 px-8 h-10 bg-primary text-black text-[11px] font-black uppercase tracking-[0.15em] hover:opacity-90 transition-all mr-4 cursor-pointer rounded shadow-sm">
                                <span>Send</span>
                                <Send className="w-3.5 h-3.5" />
                            </button>
                            
                            <div className="flex items-center space-x-0.5 text-slate-500">
                                <input type="file" ref={attachmentInputRef} className="hidden" multiple onChange={(e) => {
                                    if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                                }} />
                                <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => {
                                    if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
                                }} />

                                <button 
                                    onClick={() => attachmentInputRef.current?.click()}
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm cursor-pointer"
                                    title="Attach files"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => toast.success('Link feature coming soon')}
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm cursor-pointer"
                                    title="Insert link"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => toast.success('Emoji picker coming soon')}
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm cursor-pointer"
                                    title="Insert emoji"
                                >
                                    <Smile className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => imageInputRef.current?.click()}
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm cursor-pointer"
                                    title="Insert photo"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                              <button onClick={() => { setIsComposeOpen(false); setAttachments([]); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-sm cursor-pointer">
                                <Trash2 className="w-4 h-4" />
                              </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Attachment Preview Modal */}
        {previewAttachment && (
            <div className="fixed inset-0 bg-black/90 z-[2000] flex flex-col animate-in fade-in duration-200">
                <div className="flex items-center justify-between px-6 py-4 bg-black/40 backdrop-blur-md border-b border-white/10 text-white">
                    <div className="flex items-center space-x-4">
                         <Paperclip className="w-4 h-4 text-slate-400" />
                         <span className="text-sm font-black uppercase tracking-widest">{previewAttachment.name}</span>
                    </div>
                    <div className="flex items-center space-x-6">
                        <button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = previewAttachment.url;
                                link.setAttribute('download', previewAttachment.name);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                            }}
                            className="flex items-center space-x-2 text-[10px] font-black uppercase tracking-widest hover:text-[#FFEF5F] transition-colors"
                        >
                            <span>Download</span>
                        </button>
                        <button 
                            onClick={() => {
                                window.URL.revokeObjectURL(previewAttachment.url);
                                setPreviewAttachment(null);
                            }}
                            className="p-1 hover:bg-white/10 transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
                    {previewAttachment.type.startsWith('image/') && (
                        <img src={previewAttachment.url} alt={previewAttachment.name} className="max-w-full max-h-full object-contain shadow-2xl" />
                    )}
                    {previewAttachment.type === 'application/pdf' && (
                        <iframe src={previewAttachment.url} className="w-full h-full bg-white shadow-2xl" />
                    )}
                    {previewAttachment.type.startsWith('video/') && (
                        <video src={previewAttachment.url} controls autoPlay className="max-w-full max-h-full shadow-2xl" />
                    )}
                    {previewAttachment.type.startsWith('audio/') && (
                        <audio src={previewAttachment.url} controls autoPlay className="w-[400px]" />
                    )}
                </div>
            </div>
        )}
    </div>
  );
}
