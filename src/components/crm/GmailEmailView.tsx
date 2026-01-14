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
}

export function GmailEmailView({ initialLabel }: GmailEmailViewProps) {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const emailsPerPage = 50;

  const fetchEmails = useCallback(async (page: number) => {
    setLoading(true);
    try {
        const token = tokensByPage[page];
        const res = await fetch(`/api/gmail?label=${initialLabel}${token ? `&pageToken=${token}` : ''}`);
        const data = await res.json();
        
        if (data.emails) {
            setEmails(data.emails);
            setTotalEstimated(data.resultSizeEstimate || 0);
            setUnreadCount(data.unreadCount || 0);
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
  }, [initialLabel, tokensByPage]);

  useEffect(() => {
    fetchEmails(1);
    setCurrentPage(1);
    setTokensByPage({ 1: null });
  }, [initialLabel]);

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

  return (
    <div className="flex flex-col h-full bg-white">
        {/* Gmail Header Controls */}
        <div className="flex items-center justify-between px-6 py-1.5 border-b border-slate-100 bg-[#FAFAFA]">
            <div className="flex-1" /> {/* Spacer */}
            <div className="flex items-center space-x-6">
                <button 
                    onClick={() => setIsComposeOpen(true)}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-sm"
                >
                    <Plus className="w-3 h-3" />
                    <span>Compose</span>
                </button>
                
                <div className="flex items-center space-x-4 text-slate-400">
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
                            className="p-1 hover:text-black transition-colors disabled:opacity-30"
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
                            className="p-1 hover:text-black transition-colors disabled:opacity-30"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>

        {/* Gmail List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 relative min-h-[400px]">
            {loading && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                </div>
            )}
            
            {emails.map((email: any) => (
                <div key={email.id} className="border-b border-slate-50 last:border-0">
                    <div 
                        onClick={() => {
                            setExpandedEmailId(expandedEmailId === email.id ? null : email.id);
                            if (!email.isRead && initialLabel === 'INBOX') toggleReadStatus(email.id, false);
                        }}
                        className={cn(
                            "flex items-center px-4 hover:shadow-sm transition-all group cursor-pointer gap-3",
                            email.isRead ? "bg-white" : "bg-blue-50/10",
                            expandedEmailId === email.id && "bg-blue-50/30"
                        )}
                    >
                        <div className="shrink-0 text-slate-300 hover:text-slate-600 cursor-pointer p-1">
                            <Star className="w-5 h-5 stroke-[1.5]" />
                        </div>
                        <div className={cn(
                            "w-48 shrink-0 text-[14px] truncate ml-1",
                            email.isRead ? "font-normal text-slate-700" : "font-black text-slate-900"
                        )}>
                            {initialLabel === 'INBOX' ? email.sender : `To: ${email.recipient || 'Unknown'}`}
                        </div>
                        <div className="flex-1 min-w-0 flex items-baseline text-[14px] truncate pr-4">
                             <span className={cn(
                                "truncate shrink-0 max-w-[400px]", 
                                email.isRead ? "font-normal text-slate-700" : "font-black text-slate-900"
                             )}>
                                {email.subject}
                             </span>
                             <span className="text-slate-400 mx-1 shrink-0">-</span>
                             <span className="text-slate-500 truncate font-normal">
                                {email.snippet}
                             </span>
                        </div>
                        <div className="shrink-0 flex items-center justify-end min-w-[100px]">
                            <span className={cn(
                                "text-[12px] group-hover:hidden",
                                email.isRead ? "font-normal text-slate-500" : "font-black text-slate-900"
                            )}>
                                {new Date(email.timestamp).toDateString() === new Date().toDateString() ? email.time : email.date}
                            </span>
                            <div className="hidden group-hover:flex items-center justify-end space-x-1">
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(email.id); }} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                {initialLabel === 'INBOX' && (
                                    <button onClick={(e) => { e.stopPropagation(); toggleReadStatus(email.id, email.isRead); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                        {email.isRead ? <MailOpen className="w-4 h-4" /> : <MailCheck className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {expandedEmailId === email.id && (
                        <div className="px-16 py-8 bg-white border-y border-slate-100 animate-in slide-in-from-top-2 duration-200">
                             <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                                        <User className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-sm font-black text-slate-900">{email.sender}</span>
                                            <span className="text-xs text-slate-400 font-medium tracking-wider">&lt;{email.senderEmail || ''}&gt;</span>
                                        </div>
                                        <div className="flex items-center space-x-2 mt-0.5">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">to {initialLabel === 'INBOX' ? 'me' : email.recipient}</span>
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{email.date} ({email.time})</span>
                            </div>
                            <div className="space-y-6">
                                <h3 className="text-lg font-black text-slate-900">{email.subject}</h3>
                                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">
                                    {email.body}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
            
            {(!loading && emails.length === 0) && (
                <div className="py-20 text-center text-slate-400 font-mono text-xs uppercase tracking-widest">
                    No messages found in {initialLabel.toLowerCase()}
                </div>
            )}
        </div>

        {/* Compose Modal */}
        {isComposeOpen && (
            <div className="fixed bottom-0 right-12 w-[540px] bg-white border border-slate-200 shadow-2xl z-[1001] animate-in slide-in-from-bottom-5 duration-300">
                <div className="bg-[#1A1A1A] text-white px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">New message</span>
                    <div className="flex items-center space-x-3">
                         <button className="hover:text-slate-300 transition-colors"><MoreHorizontal className="w-4 h-4" /></button>
                         <button onClick={() => setIsComposeOpen(false)} className="hover:text-slate-300 transition-colors"><X className="w-4 h-4" /></button>
                    </div>
                </div>
                <div className="p-0">
                    {composeError && <p className="text-xs text-red-600 font-medium bg-red-50 p-4 border-b border-red-100">{composeError}</p>}
                    <div className="px-4 border-b border-slate-100">
                        <input type="text" placeholder="Recipients" className="w-full text-sm py-3 focus:outline-none placeholder:text-slate-400 font-medium" value={composeData.to} onChange={(e) => setComposeData({...composeData, to: e.target.value})} />
                    </div>
                    <div className="px-4 border-b border-slate-100">
                        <input type="text" placeholder="Subject" className="w-full text-sm py-3 focus:outline-none placeholder:text-slate-400 font-medium" value={composeData.subject} onChange={(e) => setComposeData({...composeData, subject: e.target.value})} />
                    </div>
                    <div className="px-4">
                        <textarea placeholder="Message" rows={12} className="w-full text-sm py-4 focus:outline-none resize-none placeholder:text-slate-400 font-medium leading-relaxed" value={composeData.body} onChange={(e) => setComposeData({...composeData, body: e.target.value})} />
                    </div>

                    {/* Attachment List */}
                    {attachments.length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-50 flex flex-wrap gap-2 bg-slate-50/50">
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
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-white">
                        <div className="flex items-center space-x-1">
                            <button onClick={handleCompose} className="flex items-center space-x-3 px-8 py-2.5 bg-black text-white text-[11px] font-black uppercase tracking-[0.15em] hover:bg-slate-800 transition-all mr-4">
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
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm"
                                    title="Attach files"
                                >
                                    <Paperclip className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => toast.success('Link feature coming soon')}
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm"
                                    title="Insert link"
                                >
                                    <LinkIcon className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => toast.success('Emoji picker coming soon')}
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm"
                                    title="Insert emoji"
                                >
                                    <Smile className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => imageInputRef.current?.click()}
                                    className="p-2 hover:bg-slate-50 hover:text-black transition-all rounded-sm"
                                    title="Insert photo"
                                >
                                    <ImageIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                             <button onClick={() => { setIsComposeOpen(false); setAttachments([]); }} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all rounded-sm">
                                <Trash2 className="w-4 h-4" />
                             </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
