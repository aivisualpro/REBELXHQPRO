'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { 
  Phone, Mail, MapPin, Building, Calendar, 
  User, Plus, MoreHorizontal, FileText, 
  Briefcase, CreditCard, Check, Globe, Star,
  ChevronLeft, ChevronRight, Trash2, Send, X, MailOpen, MailCheck,
  Lock, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, KeyRound
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

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  const tabs = ['Overview', 'Security', 'Compensation', 'Emergency', 'Time Off', 'Performance', 'Files', 'Onboarding'];

  const handleChangePassword = async () => {
    setPasswordMessage(null);

    if (!currentPassword) {
      setPasswordMessage({ type: 'error', text: 'Current password is required' });
      return;
    }
    if (!newPassword) {
      setPasswordMessage({ type: 'error', text: 'New password is required' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordMessage({ type: 'error', text: 'New password must be different from current password' });
      return;
    }

    setPasswordChanging(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPasswordMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch (err) {
      setPasswordMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setPasswordChanging(false);
    }
  };

  if (!session) {
    return (
        <div className="flex items-center justify-center h-full text-muted-foreground font-mono text-xs">
            Please log in to view profile.
        </div>
    )
  }

  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
        </div>
    );
  }

  // Password strength indicator
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    if (score <= 1) return { level: 1, label: 'Weak', color: 'bg-red-500' };
    if (score <= 2) return { level: 2, label: 'Fair', color: 'bg-orange-500' };
    if (score <= 3) return { level: 3, label: 'Good', color: 'bg-yellow-500' };
    if (score <= 4) return { level: 4, label: 'Strong', color: 'bg-emerald-500' };
    return { level: 5, label: 'Very Strong', color: 'bg-emerald-400' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <>
    <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Top Navigation Tabs */}
        <div className="bg-card border-b border-border px-8">
            <div className="flex items-center space-x-8 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "py-4 text-[11px] font-bold uppercase tracking-wider border-b-2 transition-all duration-300 whitespace-nowrap",
                            activeTab === tab 
                                ? "border-primary text-foreground" 
                                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted/30"
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
                <div className="col-span-12 lg:col-span-3 space-y-0 overflow-y-auto border-r border-border bg-card">
                    {/* ID Card */}
                    <div className="p-6 border-b border-border">
                        <div className="flex flex-col items-center mb-6">
                            <div className="w-20 h-20 relative overflow-hidden mb-4 rounded-full ring-2 ring-border ring-offset-2 ring-offset-card transition-all duration-300 hover:ring-primary/50">
                                {user.profileImage || user.image ? (
                                    <Image src={user.profileImage || user.image} alt="Profile" fill className="object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                        <User className="w-8 h-8 text-primary" />
                                    </div>
                                )}
                            </div>
                            <h2 className="text-lg font-black text-foreground text-center">
                                {user.firstName ? `${user.firstName} ${user.lastName}` : (user.name || 'User')}
                            </h2>
                        </div>

                        <div className="space-y-4 w-full">
                            <div className="flex items-center justify-between text-xs border-b border-border/50 pb-3">
                                <span className="text-muted-foreground font-medium">Email</span>
                                <span className="text-foreground font-bold truncate max-w-[180px]">{user.email}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-border/50 pb-3">
                                <span className="text-muted-foreground font-medium">Phone</span>
                                <span className="text-foreground font-bold">{user.phone || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-border/50 pb-3">
                                <span className="text-muted-foreground font-medium">Role</span>
                                <span className="text-foreground font-bold">{user.role || 'N/A'}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs border-b border-border/50 pb-3">
                                <span className="text-muted-foreground font-medium">Department</span>
                                <span className="text-foreground font-bold">
                                    {(user.department === 'SUPERADMIN' || user.department === 'Management') ? 'Admin' : (user.department || 'N/A')}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pb-1">
                                <span className="text-muted-foreground font-medium">Status</span>
                                <span className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                                    user.status === 'Active' 
                                        ? "bg-emerald-500/10 text-emerald-400 dark:bg-emerald-500/20 dark:text-emerald-400" 
                                        : "bg-muted/10 text-muted-foreground"
                                )}>
                                    {user.status || 'Inactive'}
                                </span>
                            </div>

                            <div className="pt-6 flex justify-center w-full">
                                {user.googleConnected ? (
                                    <button 
                                        onClick={() => setIsGoogleModalOpen(true)}
                                        className="flex items-center space-x-2 px-4 py-2 bg-secondary text-muted-foreground rounded-sm text-[10px] font-bold uppercase tracking-wider border border-border hover:bg-border/30 hover:text-foreground transition-all cursor-pointer w-full justify-center"
                                    >
                                        <Check className="w-3 h-3 text-emerald-500" />
                                        <span>CONNECTED</span>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => setIsGoogleModalOpen(true)}
                                        className="flex items-center space-x-2 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-[10px] font-black uppercase tracking-wider border border-transparent hover:opacity-90 transition-all w-full justify-center group"
                                    >
                                         <Globe className="w-3 h-3 text-primary-foreground group-hover:scale-110 transition-transform" />
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
                <div className="col-span-12 lg:col-span-9 h-full overflow-y-auto bg-background p-8">
                    {activeTab === 'Overview' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground border-b border-border pb-2 flex items-center">
                                        <Briefcase className="w-4 h-4 mr-2 text-muted-foreground" />
                                        Work Information
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Employee ID</span>
                                            <span className="font-bold text-foreground">{user._id}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Employment Type</span>
                                            <span className="font-bold text-foreground">Full-Time</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground border-b border-border pb-2 flex items-center">
                                        <Building className="w-4 h-4 mr-2 text-muted-foreground" />
                                        Organization
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Direct Manager</span>
                                            <span className="font-bold text-primary">Alex Foster</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Location</span>
                                            <span className="font-bold text-foreground">Orlando, FL</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Security' && (
                        <div className="space-y-8 max-w-2xl">
                            {/* Change Password Section */}
                            <div className="border border-border bg-card overflow-hidden">
                                {/* Section header */}
                                <div className="px-6 py-5 border-b border-border bg-secondary/50 flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-primary/10 flex items-center justify-center">
                                        <KeyRound className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Change Password</h3>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">Update your account password to keep your account secure</p>
                                    </div>
                                </div>

                                <div className="p-6 space-y-5">
                                    {/* Success / Error Message */}
                                    {passwordMessage && (
                                        <div className={cn(
                                            "flex items-center space-x-3 p-4 border text-sm font-medium animate-in slide-in-from-top-2 duration-300",
                                            passwordMessage.type === 'success' 
                                                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
                                                : "bg-red-500/5 border-red-500/20 text-red-400"
                                        )}>
                                            {passwordMessage.type === 'success' 
                                                ? <CheckCircle2 className="w-4 h-4 shrink-0" /> 
                                                : <AlertCircle className="w-4 h-4 shrink-0" />
                                            }
                                            <span>{passwordMessage.text}</span>
                                        </div>
                                    )}

                                    {/* Current Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Current Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <input
                                                type={showCurrentPassword ? 'text' : 'password'}
                                                value={currentPassword}
                                                onChange={(e) => { setCurrentPassword(e.target.value); setPasswordMessage(null); }}
                                                placeholder="Enter current password"
                                                className="w-full pl-10 pr-10 py-3 bg-background border border-border text-foreground text-xs font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* New Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            New Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <input
                                                type={showNewPassword ? 'text' : 'password'}
                                                value={newPassword}
                                                onChange={(e) => { setNewPassword(e.target.value); setPasswordMessage(null); }}
                                                placeholder="Enter new password"
                                                className="w-full pl-10 pr-10 py-3 bg-background border border-border text-foreground text-xs font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {/* Password Strength Bar */}
                                        {newPassword && (
                                            <div className="space-y-1.5 pt-1 animate-in slide-in-from-top-1 duration-200">
                                                <div className="flex space-x-1">
                                                    {[1, 2, 3, 4, 5].map((i) => (
                                                        <div 
                                                            key={i} 
                                                            className={cn(
                                                                "h-1 flex-1 transition-all duration-300",
                                                                i <= passwordStrength.level ? passwordStrength.color : "bg-border"
                                                            )} 
                                                        />
                                                    ))}
                                                </div>
                                                <p className={cn(
                                                    "text-[10px] font-bold uppercase tracking-wider",
                                                    passwordStrength.level <= 1 ? "text-red-400" :
                                                    passwordStrength.level <= 2 ? "text-orange-400" :
                                                    passwordStrength.level <= 3 ? "text-yellow-400" :
                                                    "text-emerald-400"
                                                )}>
                                                    {passwordStrength.label}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm Password */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                            Confirm New Password
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <input
                                                type={showConfirmPassword ? 'text' : 'password'}
                                                value={confirmPassword}
                                                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordMessage(null); }}
                                                placeholder="Confirm new password"
                                                className={cn(
                                                    "w-full pl-10 pr-10 py-3 bg-background border text-foreground text-xs font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-all",
                                                    confirmPassword && confirmPassword !== newPassword 
                                                        ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20" 
                                                        : confirmPassword && confirmPassword === newPassword 
                                                            ? "border-emerald-500/50 focus:border-emerald-500/50 focus:ring-emerald-500/20"
                                                            : "border-border focus:border-primary/50 focus:ring-primary/20"
                                                )}
                                            />
                                            <button 
                                                type="button"
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        {confirmPassword && confirmPassword !== newPassword && (
                                            <p className="text-[10px] text-red-400 font-medium animate-in slide-in-from-top-1 duration-200">Passwords do not match</p>
                                        )}
                                        {confirmPassword && confirmPassword === newPassword && newPassword && (
                                            <p className="text-[10px] text-emerald-400 font-medium flex items-center space-x-1 animate-in slide-in-from-top-1 duration-200">
                                                <Check className="w-3 h-3" />
                                                <span>Passwords match</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Requirements */}
                                    <div className="bg-secondary/30 border border-border p-4 space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Password Requirements</p>
                                        {[
                                            { label: 'Minimum 6 characters', met: newPassword.length >= 6 },
                                            { label: 'Contains uppercase letter', met: /[A-Z]/.test(newPassword) },
                                            { label: 'Contains a number', met: /[0-9]/.test(newPassword) },
                                            { label: 'Contains special character', met: /[^A-Za-z0-9]/.test(newPassword) },
                                        ].map((req, i) => (
                                            <div key={i} className="flex items-center space-x-2 text-[11px]">
                                                {req.met ? (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                                ) : (
                                                    <div className="w-3.5 h-3.5 border border-border rounded-full" />
                                                )}
                                                <span className={cn(
                                                    "transition-colors",
                                                    req.met ? "text-foreground" : "text-muted-foreground"
                                                )}>{req.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Action Footer */}
                                <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-end space-x-3">
                                    <button 
                                        onClick={() => {
                                            setCurrentPassword('');
                                            setNewPassword('');
                                            setConfirmPassword('');
                                            setPasswordMessage(null);
                                        }}
                                        className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground border border-border hover:border-muted transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleChangePassword}
                                        disabled={passwordChanging || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                                        className={cn(
                                            "px-6 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-2",
                                            passwordChanging || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword
                                                ? "bg-muted/20 text-muted-foreground cursor-not-allowed border border-border"
                                                : "bg-primary text-primary-foreground hover:opacity-90 border border-transparent"
                                        )}
                                    >
                                        {passwordChanging ? (
                                            <>
                                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary-foreground"></div>
                                                <span>Updating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-3 h-3" />
                                                <span>Update Password</span>
                                            </>
                                        )}
                                    </button>
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
