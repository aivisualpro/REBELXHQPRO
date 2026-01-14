'use client';

import React, { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import Link from 'next/link';
import { 
  Phone, Mail, MapPin, Building, Calendar, 
  User, Plus, MoreHorizontal, FileText, 
  Briefcase, CreditCard, Check, Globe
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

export default function EmployeeProfilePage() {
  const { data: session } = useSession();
  const params = useParams();
  const id = params.id as string;
  const [activeTab, setActiveTab] = useState('Overview');
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch real user data from database
  React.useEffect(() => {
    async function fetchUserData() {
      if (id) {
        try {
          const response = await fetch(`/api/users/${id}`);
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
  }, [id]);

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
    );
  }

  if (!userData) {
    return (
        <div className="flex items-center justify-center h-full text-slate-400 font-mono text-xs text-center p-20">
            User profile not found.
        </div>
    );
  }

  const user = userData;
  const fullName = user.firstName ? `${user.firstName} ${user.lastName}` : (user.name || 'Unknown Employee');

  const jobHistory = [
    { id: '2', dept: 'Marketing Team', div: 'Leadership', manager: 'Jack Danniel', date: 'Sep 05, 2024', loc: 'Bergen, NJ' },
    { id: '1', dept: 'Creative Associate', div: 'Project Management', manager: 'Alex Foster', date: 'May 13, 2024', loc: 'Metro DC' },
  ];

  const activities = [
    { id: '6', name: 'Merva Sahin', action: 'assigned to project', time: '02:15 PM', avatar: null },
  ];

  const compensations = [
    { amount: 'Based on Role', period: 'per month', effective: 'Jan 01, 2024' },
  ];

  const tabs = ['Overview', 'Compensation', 'Emergency', 'Time Off', 'Performance', 'Files', 'Onboarding'];

  return (
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

        <div className="flex-1 overflow-y-auto">
            <div className="w-full grid grid-cols-12 gap-0">
                
                {/* Left Sidebar */}
                <div className="col-span-12 lg:col-span-3 space-y-8">
                    {/* Profile Card */}
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
                            <h2 className="text-lg font-black text-slate-900 text-center">{fullName}</h2>
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

                            {/* Only show Connect Google if it's the current user */}
                            {session?.user?.id === user._id && (
                                <div className="pt-2 flex justify-center w-full border-t border-slate-50 mt-4">
                                    {user.googleConnected ? (
                                        <div className="flex items-center space-x-2 px-4 py-2 bg-slate-50 text-slate-600 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-slate-200 w-full justify-center">
                                            <Check className="w-3 h-3 text-emerald-500" />
                                            <span>CONNECTED</span>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => window.location.href = '/api/auth/google'}
                                            className="flex items-center space-x-2 px-4 py-2 bg-white text-slate-700 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-slate-300 hover:bg-slate-50 transition-all w-full justify-center group"
                                        >
                                             <Globe className="w-3 h-3 text-slate-400 group-hover:text-blue-500" />
                                            <span>CONNECT GOOGLE</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 flex justify-center w-full">
                                <Link 
                                    href={`mailto:${user.email}`}
                                    className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-sm text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-all w-full justify-center"
                                >
                                     <Mail className="w-3 h-3" />
                                    <span>Message</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="col-span-12 lg:col-span-9 space-y-8">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Activity */}
                        <div className="bg-white border border-slate-200 p-6">
                            <h2 className="text-lg font-bold text-slate-900 mb-6">Activity</h2>
                            <div className="space-y-6">
                                {activities.map((activity, i) => (
                                    <div key={i} className="flex items-start space-x-3 pb-6 border-b border-slate-50 last:border-0 last:pb-0">
                                        <div className="w-10 h-10 bg-slate-100 flex items-center justify-center shrink-0">
                                            <User className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-600 leading-relaxed">
                                                <Link href={`/profile/${activity.id}`} className="font-bold text-slate-900 hover:text-blue-600 hover:underline">
                                                    {activity.name}
                                                </Link> {activity.action}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{activity.time}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                         {/* Compensation - Hidden/Restricted for others usually, but keeping for demo */}
                        <div className="bg-white border border-slate-200 p-6">
                            <h2 className="text-lg font-bold text-slate-900 mb-6">Compensation</h2>
                             <div className="flex items-center justify-center h-20 text-xs text-slate-400 font-mono">
                                 Restricted Access
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
