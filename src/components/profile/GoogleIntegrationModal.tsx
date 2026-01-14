import React from 'react';
import { X, Globe, Check, ShieldCheck, MessageSquare, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleIntegrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    isConnected: boolean;
    userEmail?: string | null;
    onConnect: () => void;
}

export const GoogleIntegrationModal = ({ isOpen, onClose, isConnected, userEmail, onConnect }: GoogleIntegrationModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-[500px] shadow-2xl animate-in zoom-in-95 duration-200 border border-slate-200">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-black transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-blue-50 flex items-center justify-center border border-blue-100">
                                <Globe className="w-8 h-8 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Google Workspace</h2>
                                <p className="text-sm text-slate-500 font-medium">Gmail & Google Voice Sync</p>
                            </div>
                        </div>
                        {isConnected ? (
                            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase text-[10px] font-bold tracking-wider">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>Connected</span>
                            </div>
                        ) : (
                             <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 uppercase text-[10px] font-bold tracking-wider">
                                <span>Not Connected</span>
                            </div>
                        )}
                    </div>

                    {/* Content */}
                    <div className="space-y-6">
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            Connect your Google account to automatically log Client SMS, Call history, and Emails into the CRM Dashboard.
                        </p>

                        <div className="space-y-3">
                             {[
                                 { text: 'Syncs Call history from Google Voice', icon: ShieldCheck },
                                 { text: 'Syncs SMS history from Google Voice', icon: MessageSquare },
                                 { text: 'Syncs Client Emails to activity logs', icon: Mail },
                             ].map((feature, i) => (
                                 <div key={i} className="flex items-center space-x-3 text-sm text-slate-600">
                                     <div className="w-5 h-5 rounded-full border border-blue-200 flex items-center justify-center shrink-0">
                                         <Check className="w-3 h-3 text-blue-500 stroke-[3]" />
                                     </div>
                                     <span className="font-medium text-slate-600">{feature.text}</span>
                                 </div>
                             ))}
                        </div>

                        {isConnected && (
                            <div className="bg-blue-50/50 border border-blue-100 p-4">
                                <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Authenticated Account:</h4>
                                <p className="text-sm font-medium text-blue-600">{userEmail}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100">
                    <button 
                        onClick={onConnect}
                        className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-white text-slate-700 font-bold uppercase tracking-widest text-xs border border-slate-300 hover:bg-slate-50 hover:border-slate-400 hover:text-black transition-all"
                    >
                        <Globe className="w-4 h-4" />
                        <span>{isConnected ? 'Reconnect Account' : 'Connect Account'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
