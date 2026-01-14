'use client';

import React, { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { 
  Phone, Mail, MapPin, Building, Calendar, 
  User, Plus, MoreHorizontal, FileText, 
  Briefcase, CreditCard, Check, Globe, Star,
  ChevronLeft, ChevronRight, Trash2, Send, X, MailOpen, MailCheck
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { GoogleIntegrationModal } from '@/components/profile/GoogleIntegrationModal';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('Overview');
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch real user data from database
  React.useEffect(() => {
    async function fetchUserData() {
      if (session?.user?.id) {
        try {
          const response = await fetch(`/api/users/${session.user.id}`);
          if (response.ok) {
            const data = await response.json();
            setUserData(data);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchUserData();
  }, [session?.user?.id]);

  const user = userData || session?.user;

  // Mock Data matching the design (remaining for UI structure)
  const jobHistory = [
    { id: '1', dept: 'Creative Associate', div: 'Project Management', manager: 'Alex Foster', date: 'May 13, 2024', loc: 'Metro DC' },
    { id: '2', dept: 'Marketing Team', div: 'Leadership', manager: 'Jack Danniel', date: 'Sep 05, 2024', loc: 'Bergen, NJ' },
    { id: '3', dept: 'Team Lead', div: 'Creator', manager: 'Alina Skazka', date: 'Jun 08, 2023', loc: 'Miami, FL' },
    { id: '4', dept: 'Finance & Accounting', div: 'Senior Consultant', manager: 'John Miller', date: 'Sep 13, 2022', loc: 'Chicago, IL' },
    { id: '5', dept: 'Team Lead', div: 'Creator', manager: 'Mark Baldwin', date: 'Jul 07, 2023', loc: 'Miami, FL' },
  ];

  const activities = [
    { id: '4', name: 'John Miller', action: 'last login on Jul 13, 2024', time: '05:36 PM', avatar: null },
    { id: '6', name: 'Merva Sahin', action: 'date created on Sep 08, 2024', time: '03:12 PM', avatar: null },
    { id: '7', name: 'Tammy Collier', action: 'updated on Aug 15, 2023', time: '05:36 PM', avatar: null },
  ];

  const tabs = ['Overview', 'Compensation', 'Emergency', 'Time Off', 'Performance', 'Files', 'Onboarding'];
  const [emailTab, setEmailTab] = useState('Inbox');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });
  const [composeError, setComposeError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [emails, setEmails] = useState<any[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [tokensByPage, setTokensByPage] = useState<Record<number, string | null>>({ 1: null });
  const [totalEstimated, setTotalEstimated] = useState(0);
  const [inboxUnread, setInboxUnread] = useState(0);
  const emailsPerPage = 50;

  const fetchEmails = async (page: number, label: string) => {
    if (!user?.googleConnected) return;
    
    setEmailLoading(true);
    try {
        const token = tokensByPage[page];
        const res = await fetch(`/api/gmail?label=${label.toUpperCase()}${token ? `&pageToken=${token}` : ''}`);
        const data = await res.json();
        
        if (data.emails) {
            setEmails(data.emails);
            setTotalEstimated(data.resultSizeEstimate || 0);
            setInboxUnread(data.unreadCount || 0);
            if (data.nextPageToken) {
                setTokensByPage(prev => ({ ...prev, [page + 1]: data.nextPageToken }));
                setNextPageToken(data.nextPageToken);
            } else {
                setNextPageToken(null);
            }
        }
    } catch (error) {
        console.error('Error fetching emails:', error);
    } finally {
        setEmailLoading(false);
    }
  };

  React.useEffect(() => {
    if (user?.googleConnected) {
        fetchEmails(1, emailTab);
        setCurrentPage(1);
        setTokensByPage({ 1: null });
    }
  }, [emailTab, user?.googleConnected]);

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
            setEmailTab('Sent');
            fetchEmails(1, 'Sent');
        } else {
            console.error('Error sending email:', data.error);
            setComposeError(data.error || 'Failed to send email');
        }
    } catch (error) {
        console.error('Error sending email:', error);
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
        setInboxUnread(prev => currentlyRead ? prev + 1 : Math.max(0, prev - 1));
    } catch (error) {
        console.error('Error toggling read status:', error);
    }
  };

  if (!session) {
    return (
        <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs">
            Please log in to view profile.
        </div>
    )
  }

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
    );
  }

  return (
    <>
    <div className="h-full flex flex-col bg-slate-50/50 overflow-hidden">
        {/* Top Navigation Tabs */}
        <div className="bg-white border-b border-slate-200 px-8">
            <div className="flex items-center space-x-8">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "py-4 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-colors",
                            activeTab === tab 
                                ? "border-black text-black" 
                                : "border-transparent text-slate-500 hover:text-black"
                        )}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex-1 overflow-hidden">
            <div className="w-full h-full grid grid-cols-12 gap-0">
                
                {/* Left Sidebar */}
                <div className="col-span-12 lg:col-span-3 space-y-8 overflow-y-auto border-r border-slate-200 bg-white">
                    {/* ID Card */}
                    <div className="bg-white p-6 border border-slate-200">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-20 h-20 bg-slate-100 relative overflow-hidden mb-4 rounded-full">
                                {user.profileImage || user.image ? (
                                    <Image src={user.profileImage || user.image} alt="Profile" fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-orange-100">
                                        <User className="w-8 h-8 text-orange-600" />
                                    </div>
                                )}
                            </div>
                            <h2 className="text-lg font-black text-slate-900 text-center">
                                {user.firstName ? `${user.firstName} ${user.lastName}` : (user.name || 'User')}
                            </h2>
                        </div>

                        <div className="space-y-4 w-full">
                            <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-3">
                                <span className="text-slate-500 font-medium">Email</span>
                                <span className="text-slate-900 font-bold truncate max-w-[180px]">{user.email}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-3">
                                <span className="text-slate-500 font-medium">Phone</span>
                                <span className="text-slate-900 font-bold">{user.phone || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-3">
                                <span className="text-slate-500 font-medium">Role</span>
                                <span className="text-slate-900 font-bold">{user.role || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-slate-50 pb-3">
                                <span className="text-slate-500 font-medium">Department</span>
                                <span className="text-slate-900 font-bold">
                                    {(user.department === 'SUPERADMIN' || user.department === 'Management') ? 'Admin' : (user.department || 'N/A')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pb-1">
                                <span className="text-slate-500 font-medium">Status</span>
                                <span className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                                    user.status === 'Active' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                                )}>
                                    {user.status || 'Inactive'}
                                </span>
                            </div>

                            <div className="pt-6 flex justify-center w-full">
                                {user.googleConnected ? (
                                    <button 
                                        onClick={() => setIsGoogleModalOpen(true)}
                                        className="flex items-center space-x-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-slate-200 hover:bg-slate-100 hover:text-black transition-all cursor-pointer w-full justify-center"
                                    >
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span>CONNECTED</span>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => setIsGoogleModalOpen(true)}
                                        className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all w-full justify-center group"
                                    >
                                         <Globe className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                        <span>CONNECT GOOGLE</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <GoogleIntegrationModal 
                    isOpen={isGoogleModalOpen}
                    onClose={() => setIsGoogleModalOpen(false)}
                    isConnected={!!user.googleConnected}
                    userEmail={user.email}
                    onConnect={() => {
                        window.location.href = '/api/auth/google';
                    }}
                />

                {/* Main Content */}
                <div className="col-span-12 lg:col-span-9 h-full overflow-y-auto bg-white">
                    {/* Gmail Section */}
                    <div className="bg-white border border-slate-200">
                        {/* Gmail Tabs & Controls */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center space-x-6">
                                {['Inbox', 'Sent'].map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => {
                                            setEmailTab(t);
                                            setExpandedEmailId(null);
                                            setCurrentPage(1);
                                        }}
                                        className={cn(
                                            "text-xs font-bold uppercase tracking-widest transition-colors pb-1 border-b-2",
                                            emailTab === t ? "text-black border-black" : "text-slate-400 border-transparent hover:text-black"
                                        )}
                                    >
                                        {t === 'Inbox' ? `Inbox (${inboxUnread})` : t}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center space-x-4 text-slate-400">
                                <button 
                                    onClick={() => setIsComposeOpen(true)}
                                    className="p-1 hover:text-blue-600 transition-colors bg-blue-50/50 rounded"
                                    title="Compose New Email"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                                <button className="hover:text-black transition-colors text-[10px] font-bold">
                                    {emails.length > 0 ? `${(currentPage - 1) * emailsPerPage + 1}-${Math.min(currentPage * emailsPerPage, totalEstimated)} of ${totalEstimated || emails.length}` : '0-0 of 0'}
                                </button>
                                <div className="flex items-center space-x-1">
                                    <button 
                                        disabled={currentPage === 1 || emailLoading}
                                        onClick={() => {
                                            const newPage = currentPage - 1;
                                            setCurrentPage(newPage);
                                            fetchEmails(newPage, emailTab);
                                        }}
                                        className="p-1 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button 
                                        disabled={!nextPageToken || emailLoading}
                                        onClick={() => {
                                            const newPage = currentPage + 1;
                                            setCurrentPage(newPage);
                                            fetchEmails(newPage, emailTab);
                                        }}
                                        className="p-1 hover:text-black transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Gmail List */}
                        <div className="divide-y divide-slate-50 relative min-h-[400px]">
                            {emailLoading && (
                                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px]">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                                </div>
                            )}
                            
                            {emails.map((email: any) => (
                                <div key={email.id} className="border-b border-slate-50 last:border-0">
                                    <div 
                                        onClick={() => {
                                            setExpandedEmailId(expandedEmailId === email.id ? null : email.id);
                                            if (!email.isRead) toggleReadStatus(email.id, false);
                                        }}
                                        className={cn(
                                            "flex items-center px-4 py-2.5 border-b border-slate-100 hover:shadow-sm transition-all group relative cursor-pointer gap-3",
                                            email.isRead ? "bg-white" : "bg-white",
                                            expandedEmailId === email.id && "bg-blue-50/30"
                                        )}
                                    >
                                        {/* Checkbox */}
                                        <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center justify-center p-1 cursor-pointer hover:bg-slate-100 rounded-full">
                                            <div className="w-4 h-4 border border-slate-300 rounded-[2px] group-hover:border-slate-400 bg-white" />
                                        </div>

                                        {/* Star */}
                                        <div onClick={(e) => e.stopPropagation()} className="shrink-0 text-slate-300 hover:text-slate-600 cursor-pointer p-1 hover:bg-slate-100 rounded-full">
                                            <Star className="w-5 h-5 stroke-[1.5]" />
                                        </div>

                                        {/* Sender */}
                                        <div className={cn(
                                            "w-48 shrink-0 text-[14px] truncate ml-1",
                                            email.isRead ? "font-normal text-slate-700" : "font-black text-slate-900"
                                        )}>
                                            {email.sender}
                                        </div>

                                        {/* Content */}
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

                                        {/* Date/Actions */}
                                        <div className="shrink-0 flex items-center justify-end min-w-[80px]">
                                            <span className={cn(
                                                "text-[12px] group-hover:hidden",
                                                email.isRead ? "font-normal text-slate-500" : "font-black text-slate-900"
                                            )}>
                                                {new Date(email.timestamp).toDateString() === new Date().toDateString() 
                                                    ? email.time 
                                                    : email.date}
                                            </span>
                                            
                                            <div className="hidden group-hover:flex items-center justify-end space-x-1">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(email.id);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleReadStatus(email.id, email.isRead);
                                                    }}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all"
                                                    title={email.isRead ? "Mark as Unread" : "Mark as Read"}
                                                >
                                                    {email.isRead ? <MailOpen className="w-4 h-4" /> : <MailCheck className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Body */}
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
                                                            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">&lt;{email.sender.toLowerCase().replace(' ', '.')}@rebelxbrands.com&gt;</span>
                                                        </div>
                                                        <div className="flex items-center space-x-2 mt-0.5">
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">to me</span>
                                                            <ChevronRight className="w-2.5 h-2.5 text-slate-300" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{email.date} ({email.time})</span>
                                                    <button className="p-1.5 text-slate-400 hover:text-black hover:bg-slate-50 rounded transition-colors">
                                                        <Plus className="w-4 h-4 rotate-45" />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-6">
                                                <h3 className="text-lg font-black text-slate-900 leading-tight">
                                                    {email.subject}
                                                </h3>
                                                <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap font-medium kerning-wide">
                                                    {email.body}
                                                </div>
                                                
                                                <div className="pt-8 border-t border-slate-100 flex items-center space-x-4">
                                                    <button className="px-6 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-sm">
                                                        Reply
                                                    </button>
                                                    <button className="px-6 py-2 bg-white border border-slate-200 text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all rounded-sm">
                                                        Forward
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {(!emailLoading && emails.length === 0) && (
                            <div className="py-20 text-center text-slate-400 font-mono text-xs uppercase tracking-widest">
                                {user.googleConnected ? `No messages in ${emailTab}` : 'Connect Google to see emails'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>

    {/* Compose Modal */}
    {isComposeOpen && (
        <div className="fixed bottom-0 right-12 w-96 bg-white border border-slate-200 shadow-2xl rounded-t-lg z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-black text-white px-4 py-2 flex items-center justify-between rounded-t-lg">
                <span className="text-xs font-bold uppercase tracking-widest">New message</span>
                <button onClick={() => setIsComposeOpen(false)}>
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="p-4 space-y-4">
                {composeError && (
                    <div className="bg-red-50 border border-red-100 p-3 rounded-md animate-in slide-in-from-top-2">
                        <div className="flex items-start space-x-2">
                            <X className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-xs text-red-600 font-medium leading-normal">{composeError}</p>
                                {composeError.includes('reconnect') && (
                                    <button 
                                        onClick={() => setIsGoogleModalOpen(true)}
                                        className="mt-2 text-[10px] font-bold uppercase tracking-wider text-red-700 underline hover:text-red-900"
                                    >
                                        Open Settings
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                <input 
                    type="text" 
                    placeholder="Recipient (Email)"
                    className="w-full text-xs border-b border-slate-100 py-2 focus:outline-none focus:border-black transition-colors"
                    value={composeData.to}
                    onChange={(e) => setComposeData({...composeData, to: e.target.value})}
                />
                <input 
                    type="text" 
                    placeholder="Subject"
                    className="w-full text-xs border-b border-slate-100 py-2 focus:outline-none focus:border-black transition-colors"
                    value={composeData.subject}
                    onChange={(e) => setComposeData({...composeData, subject: e.target.value})}
                />
                <textarea 
                    placeholder="Message"
                    rows={8}
                    className="w-full text-xs border-none py-2 focus:outline-none resize-none"
                    value={composeData.body}
                    onChange={(e) => setComposeData({...composeData, body: e.target.value})}
                />
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <button 
                        onClick={handleCompose}
                        className="flex items-center space-x-2 px-6 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all rounded-sm"
                    >
                        <span>Send</span>
                        <Send className="w-3 h-3" />
                    </button>
                    <button 
                        onClick={() => setIsComposeOpen(false)}
                        className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )}
    </>
  );
}
