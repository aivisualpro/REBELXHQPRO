'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
    Globe, 
    CheckCircle2, 
    XCircle, 
    Mail, 
    MessageSquare, 
    Phone, 
    ShieldCheck,
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function ConnectionsPage() {
    const { data: session, status } = useSession();
    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);

    useEffect(() => {
        if (session?.user) {
            fetchUserProfile();
        }
    }, [session]);

    const fetchUserProfile = async () => {
        try {
            // Using existing users endpoint if available, or a specialized profile one
            // For now, let's assume we have a simple /api/auth/me or similar
            // or just fetch from users collection if the user has permission
            const res = await fetch(`/api/users/${(session?.user as any).id}`);
            if (res.ok) {
                const data = await res.json();
                setUserData(data);
            }
        } catch (error) {
            console.error("Failed to load user profile", error);
        } finally {
            setLoading(false);
        }
    };

    const handleConnectGoogle = () => {
        // Redirect to our initiator route
        window.location.href = '/api/auth/google';
    };

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-slate-50 overflow-y-auto">
            <div className="max-w-4xl mx-auto w-full p-8 space-y-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">App Connections</h1>
                    <p className="text-sm text-slate-500 mt-1">Connect your workspace apps to sync communications with the CRM.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Google Connection Card */}
                    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                                    <Globe className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Google Workspace</h3>
                                    <p className="text-xs text-slate-500">Gmail & Google Voice Sync</p>
                                </div>
                            </div>
                            {userData?.googleConnected ? (
                                <div className="flex items-center space-x-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase">Connected</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-1 px-2 py-1 bg-slate-100 text-slate-400 rounded-full border border-slate-200">
                                    <XCircle className="w-3 h-3" />
                                    <span className="text-[10px] font-bold uppercase">Disconnected</span>
                                </div>
                            )}
                        </div>

                        <div className="p-6 flex-1 space-y-4">
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Connect your Google account to automatically log Client SMS, Call history, and Emails into the CRM Dashboard.
                            </p>

                            <div className="space-y-2">
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Syncs Call history from Google Voice</span>
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Syncs SMS history from Google Voice</span>
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                                    <span>Syncs Client Emails to activity logs</span>
                                </div>
                            </div>

                            {userData?.googleConnected && (
                                <div className="pt-2">
                                    <div className="p-3 bg-blue-50 border border-blue-100 rounded text-[11px] text-blue-700">
                                        <p className="font-bold mb-1">Authenticated Account:</p>
                                        <p className="font-mono">{userData.googleEmail}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto">
                            <button
                                onClick={handleConnectGoogle}
                                className={cn(
                                    "w-full py-2.5 rounded text-sm font-bold transition-all shadow-sm flex items-center justify-center space-x-2",
                                    userData?.googleConnected 
                                        ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100" 
                                        : "bg-black text-white hover:bg-slate-800"
                                )}
                            >
                                <Globe className="w-4 h-4" />
                                <span>{userData?.googleConnected ? 'Reconnect Account' : 'Connect Google Workspace'}</span>
                            </button>
                            {!userData?.googleConnected && (
                                <p className="text-[10px] text-center text-slate-400 mt-3">
                                    You will be redirected to Google for secure authentication.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Chrome Extension Card */}
                    <div className="bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                                    <Phone className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900">Google Voice Auto-Dialer</h3>
                                    <p className="text-xs text-slate-500">Chrome Extension</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-1 px-2 py-1 bg-purple-50 text-purple-600 rounded-full border border-purple-100">
                                <ShieldCheck className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase">Optional</span>
                            </div>
                        </div>

                        <div className="p-6 flex-1 space-y-4">
                            <p className="text-xs text-slate-600 leading-relaxed">
                                Install our Chrome extension to enable <strong>one-click calling</strong> from the CRM. 
                                When you click a phone number, Google Voice will open and <strong>automatically dial</strong>.
                            </p>

                            <div className="space-y-2">
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>True one-click calling experience</span>
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Auto-clicks Call button in Google Voice</span>
                                </div>
                                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-500" />
                                    <span>Works with all CRM phone numbers</span>
                                </div>
                            </div>

                            <div className="pt-2">
                                <div className="p-3 bg-amber-50 border border-amber-100 rounded text-[11px] text-amber-700">
                                    <p className="font-bold mb-1">⚡ Power User Feature</p>
                                    <p>This extension eliminates the extra click needed to start calls.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto space-y-3">
                            <button
                                onClick={() => {
                                    // Download the zip file
                                    const link = document.createElement('a');
                                    link.href = '/rebelx-gv-autodialer.zip';
                                    link.download = 'rebelx-gv-autodialer.zip';
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    toast.success('Extension downloaded! Extract and follow setup instructions.', { duration: 4000 });
                                }}
                                className="w-full py-2.5 rounded text-sm font-bold transition-all shadow-sm flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-emerald-600 text-white hover:from-blue-700 hover:to-emerald-700"
                            >
                                <Phone className="w-4 h-4" />
                                <span>Download Extension (.zip)</span>
                            </button>
                            
                            <button
                                onClick={() => {
                                    // View README
                                    window.open('/chrome-extension-gv-autodialer/README.md', '_blank');
                                }}
                                className="w-full py-2 rounded text-xs font-bold transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            >
                                View Installation Guide
                            </button>
                            
                            <button
                                onClick={async () => {
                                    try {
                                        // Open chrome://extensions page
                                        const extensionsURL = 'chrome://extensions/';
                                        
                                        // Show instructions modal
                                        toast((t) => (
                                            <div className="text-left space-y-3">
                                                <p className="font-bold text-sm">Quick Setup (1 Minute):</p>
                                                <ol className="text-xs space-y-1 list-decimal list-inside">
                                                    <li>Enable "Developer mode" (top-right toggle)</li>
                                                    <li>Click "Load unpacked"</li>
                                                    <li>Select folder: <code className="bg-slate-100 px-1 rounded">chrome-extension-gv-autodialer</code></li>
                                                    <li>Done! Try calling a client.</li>
                                                </ol>
                                                <button
                                                    onClick={() => {
                                                        window.open(extensionsURL, '_blank');
                                                        toast.dismiss(t.id);
                                                    }}
                                                    className="w-full mt-2 py-1.5 bg-black text-white text-xs font-bold rounded"
                                                >
                                                    Open chrome://extensions/
                                                </button>
                                            </div>
                                        ), { 
                                            duration: 15000,
                                            style: { maxWidth: '400px' }
                                        });
                                    } catch (err) {
                                        toast.error('Please follow the README guide');
                                    }
                                }}
                                className="w-full py-2 rounded text-xs font-bold transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            >
                                Show Setup Instructions
                            </button>
                            
                            <p className="text-[10px] text-center text-slate-400">
                                Extension folder is in your project at <code>chrome-extension-gv-autodialer/</code>
                            </p>
                        </div>
                    </div>

                    {/* Placeholder for other connections */}
                    <div className="bg-white border border-slate-200 shadow-sm border-dashed opacity-50 flex flex-col">
                         <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center">
                                <MessageSquare className="w-6 h-6 text-slate-300" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-400">Slack Integration</h3>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Coming Soon</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Organizational Info Section */}
                <div className="bg-blue-600 rounded-xl p-8 text-white">
                    <div className="flex items-start justify-between">
                        <div className="max-w-xl">
                            <h2 className="text-xl font-bold">Organizational Sync</h2>
                            <p className="text-sm opacity-90 mt-2 leading-relaxed">
                                For the ERP to capture a full view of client communications, each team member needs to connect their Google account. 
                                Once connected, the AI will build a unified timeline of all interactions across your entire staff.
                            </p>
                            <div className="mt-6 flex space-x-6">
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black">100%</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Private & Secure</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-2xl font-black">Real-time</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Background Sync</span>
                                </div>
                            </div>
                        </div>
                        <div className="hidden lg:block">
                            <ShieldCheck className="w-24 h-24 opacity-20" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
