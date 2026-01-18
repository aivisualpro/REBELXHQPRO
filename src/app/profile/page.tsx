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
                                        className="flex items-center space-x-2 px-4 py-2 bg-[#FFEF5F] text-black rounded-sm text-[10px] font-black uppercase tracking-wider border border-transparent hover:opacity-90 transition-all w-full justify-center group"
                                    >
                                         <Globe className="w-3 h-3 text-black group-hover:scale-110 transition-transform" />
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

                {/* Main Content Area */}
                <div className="col-span-12 lg:col-span-9 h-full overflow-y-auto bg-white p-8">
                    {activeTab === 'Overview' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-2 flex items-center">
                                        <Briefcase className="w-4 h-4 mr-2 text-slate-400" />
                                        Work Information
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Employee ID</span>
                                            <span className="font-bold text-slate-900">{user._id}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Employment Type</span>
                                            <span className="font-bold text-slate-900">Full-Time</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 border-b border-slate-100 pb-2 flex items-center">
                                        <Building className="w-4 h-4 mr-2 text-slate-400" />
                                        Organization
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Direct Manager</span>
                                            <span className="font-bold text-slate-900 text-blue-600">Alex Foster</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Location</span>
                                            <span className="font-bold text-slate-900">Orlando, FL</span>
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

    </>
  );
}
