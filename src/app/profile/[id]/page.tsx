'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import {
    User, Mail, Phone, Building, Shield, Clock, Globe, Check,
    DollarSign, Activity, ChevronRight, Lock, Eye, EyeOff,
    Briefcase, LayoutDashboard, Zap, ArrowUpRight, Sparkles,
    Calendar, TrendingUp, Target, Award, Coffee, MapPin
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/ThemeProvider';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Quick Link Card ──────────────────────────────────────────────────────────

function QuickLinkCard({ icon: Icon, label, description, href, color, gradient, isDark }: {
    icon: React.ElementType; label: string; description: string; href: string;
    color: string; gradient: string; isDark: boolean;
}) {
    const router = useRouter();
    return (
        <button
            onClick={() => router.push(href)}
            className={cn(
                "group relative overflow-hidden rounded-2xl p-5 text-left transition-all hover:scale-[1.02] cursor-pointer border",
                isDark
                    ? "bg-slate-800/40 hover:bg-slate-800/60 border-slate-700/50 hover:border-slate-600"
                    : "bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300 shadow-sm hover:shadow-md"
            )}
        >
            <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500", gradient)} />
            <div className="relative z-10">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", color)}>
                    <Icon className="w-5 h-5" />
                </div>
                <h3 className={cn("text-sm font-bold mb-1", isDark ? "text-white" : "text-slate-900")}>{label}</h3>
                <p className={cn("text-[11px]", isDark ? "text-slate-400" : "text-slate-500")}>{description}</p>
            </div>
            <ArrowUpRight className={cn("absolute top-4 right-4 w-4 h-4 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0", isDark ? "text-slate-400" : "text-slate-500")} />
        </button>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserProfilePage() {
    const { data: session } = useSession();
    const params = useParams();
    const router = useRouter();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const id = params.id as string;
    const { isModuleEnabled } = usePermissions();

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [workspaces, setWorkspaces] = useState<{ _id: string; name: string; color: string }[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showPassword, setShowPassword] = useState(false);

    const isSuperAdmin = (session?.user as any)?.role === 'SuperAdmin';
    const isOwnProfile = (session?.user as any)?.profileId === id || (session?.user as any)?.id === id;

    useEffect(() => {
        if (!id) return;
        (async () => {
            try {
                const res = await fetch(`/api/users/${id}`);
                if (res.ok) setUser(await res.json());
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        })();
    }, [id]);

    useEffect(() => {
        fetch('/api/workspaces').then(r => r.json()).then(d => {
            if (d.data) setWorkspaces(d.data);
        }).catch(() => { });
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    };

    const getWorkspaceName = () => {
        if (!user?.workspaceId) return null;
        return workspaces.find(w => w._id === user.workspaceId)?.name || null;
    };

    const memberSince = user?.createdAt
        ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
        : 'N/A';

    // Build quick links based on workspace permissions
    const quickLinks = [];
    if (isSuperAdmin || isModuleEnabled('crm')) {
        quickLinks.push({ icon: Mail, label: 'CRM Inbox', description: 'Manage leads & emails', href: '/crm/inbox', color: 'bg-blue-500/20 text-blue-500', gradient: 'bg-blue-500/20' });
        quickLinks.push({ icon: Target, label: 'Leads', description: 'Track your pipeline', href: '/crm/leads', color: 'bg-purple-500/20 text-purple-500', gradient: 'bg-purple-500/20' });
    }
    if (isSuperAdmin || isModuleEnabled('sales')) {
        quickLinks.push({ icon: DollarSign, label: 'Wholesale Orders', description: 'View & manage orders', href: '/sales/wholesale-orders', color: 'bg-emerald-500/20 text-emerald-500', gradient: 'bg-emerald-500/20' });
    }
    if (isSuperAdmin || isModuleEnabled('warehouse')) {
        quickLinks.push({ icon: Activity, label: 'Manufacturing', description: 'Production pipeline', href: '/warehouse/manufacturing', color: 'bg-orange-500/20 text-orange-500', gradient: 'bg-orange-500/20' });
    }
    if (isSuperAdmin || isModuleEnabled('reports')) {
        quickLinks.push({ icon: TrendingUp, label: 'Dashboard', description: 'Business analytics', href: '/reports/dashboard', color: 'bg-cyan-500/20 text-cyan-500', gradient: 'bg-cyan-500/20' });
    }
    if (isSuperAdmin || isModuleEnabled('admin')) {
        quickLinks.push({ icon: Shield, label: 'Admin', description: 'Users & settings', href: '/admin/users', color: 'bg-rose-500/20 text-rose-500', gradient: 'bg-rose-500/20' });
    }

    if (loading) {
        return (
            <div className={cn("flex items-center justify-center h-full", isDark ? "bg-slate-900" : "bg-slate-50")}>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className={cn("flex flex-col items-center justify-center h-full gap-4", isDark ? "bg-slate-900" : "bg-slate-50")}>
                <User className="w-12 h-12 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">User not found</p>
                <button onClick={() => router.back()} className="text-xs text-primary hover:underline cursor-pointer">Go Back</button>
            </div>
        );
    }

    return (
        <div className={cn(
            "h-full flex flex-col relative overflow-hidden",
            isDark
                ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
                : "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900"
        )}>
            {/* Background Effects */}
            <div className={cn("absolute inset-0 pointer-events-none", isDark ? "opacity-[0.03]" : "opacity-[0.04]")} style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${isDark ? '%23ffffff' : '%23000000'}' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
            }} />
            <div className={cn("absolute top-20 left-20 w-96 h-96 rounded-full blur-[120px] animate-pulse pointer-events-none", isDark ? "bg-blue-500/10" : "bg-blue-500/[0.07]")} />
            <div className={cn("absolute bottom-20 right-20 w-96 h-96 rounded-full blur-[120px] animate-pulse pointer-events-none", isDark ? "bg-purple-500/10" : "bg-purple-500/[0.06]")} style={{ animationDelay: '1s' }} />

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto relative z-10">
                <div className="max-w-[1400px] mx-auto p-6 lg:p-8 space-y-8">

                    {/* ═══ Hero Section ═══ */}
                    <section className={cn(
                        "relative overflow-hidden rounded-3xl p-8 lg:p-10",
                        isDark
                            ? "bg-gradient-to-r from-slate-800/80 to-slate-800/40 border border-slate-700/50 backdrop-blur-sm"
                            : "bg-gradient-to-r from-white to-slate-50 border border-slate-200 shadow-lg"
                    )}>
                        {/* Decorative gradient */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
                        <div className={cn("absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] pointer-events-none", isDark ? "bg-blue-500/10" : "bg-blue-500/5")} />

                        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-6">
                            {/* Avatar */}
                            <div className="relative group">
                                <div className="w-24 h-24 rounded-2xl overflow-hidden ring-4 ring-primary/20 shadow-2xl shadow-primary/10">
                                    {user.profileImage ? (
                                        <Image src={user.profileImage} alt={user.firstName} width={96} height={96} className="object-cover w-full h-full" />
                                    ) : (
                                        <div className={cn("w-full h-full flex items-center justify-center text-3xl font-black", isDark ? "bg-slate-700 text-slate-300" : "bg-slate-200 text-slate-500")}>
                                            {user.firstName?.[0]}{user.lastName?.[0]}
                                        </div>
                                    )}
                                </div>
                                <div className={cn(
                                    "absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center",
                                    user.status === 'Active'
                                        ? "bg-emerald-500 border-emerald-400/50"
                                        : "bg-slate-500 border-slate-400/50",
                                    isDark ? "border-slate-800" : "border-white"
                                )}>
                                    <Check className="w-3 h-3 text-white" />
                                </div>
                            </div>

                            {/* User Info */}
                            <div className="flex-1">
                                {isOwnProfile && (
                                    <p className={cn("text-sm font-medium mb-1", isDark ? "text-slate-400" : "text-slate-500")}>
                                        {getGreeting()} 👋
                                    </p>
                                )}
                                <h1 className={cn("text-3xl font-black tracking-tight leading-none mb-2", isDark ? "text-white" : "text-slate-900")}>
                                    {user.firstName} {user.lastName}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest",
                                        isDark ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                                    )}>
                                        <Shield className="w-3 h-3" /> {user.role}
                                    </span>
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                                        isDark ? "bg-slate-700/60 text-slate-300" : "bg-slate-100 text-slate-600"
                                    )}>
                                        <Building className="w-3 h-3" /> {user.department}
                                    </span>
                                    {getWorkspaceName() && (
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                                            isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
                                        )}>
                                            <LayoutDashboard className="w-3 h-3" /> {getWorkspaceName()}
                                        </span>
                                    )}
                                    <span className={cn(
                                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest",
                                        user.status === 'Active'
                                            ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                                            : isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"
                                    )}>
                                        <Zap className="w-3 h-3" /> {user.status}
                                    </span>
                                </div>
                            </div>

                            {/* Right Stats */}
                            <div className="flex items-center gap-6">
                                <div className="text-center">
                                    <div className={cn("text-3xl font-black tabular-nums", isDark ? "text-white" : "text-slate-900")}>
                                        {user.hourlyRate ? `$${user.hourlyRate}` : '—'}
                                    </div>
                                    <div className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", isDark ? "text-slate-400" : "text-slate-500")}>
                                        Hourly Rate
                                    </div>
                                </div>
                                <div className={cn("h-12 w-px", isDark ? "bg-slate-700" : "bg-slate-200")} />
                                <div className="text-center">
                                    <div className={cn("text-[11px] font-bold", isDark ? "text-slate-300" : "text-slate-700")}>
                                        {memberSince}
                                    </div>
                                    <div className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", isDark ? "text-slate-400" : "text-slate-500")}>
                                        Member Since
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ═══ Contact & Details Row ═══ */}
                    <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Contact Information */}
                        <div className={cn(
                            "rounded-2xl p-6 border",
                            isDark ? "bg-slate-800/40 border-slate-700/50 backdrop-blur-sm" : "bg-white border-slate-200 shadow-sm"
                        )}>
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                                    <Mail className="w-4 h-4 text-blue-500" />
                                </div>
                                <h3 className={cn("text-xs font-black uppercase tracking-widest", isDark ? "text-white" : "text-slate-900")}>Contact</h3>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", isDark ? "text-slate-500" : "text-slate-400")}>Email</p>
                                    <p className={cn("text-sm font-semibold truncate", isDark ? "text-white" : "text-slate-900")}>{user.email}</p>
                                </div>
                                <div>
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", isDark ? "text-slate-500" : "text-slate-400")}>Phone</p>
                                    <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>{user.phone || '—'}</p>
                                </div>
                                {/* Password (SuperAdmin only) */}
                                {isSuperAdmin && user.password && (
                                    <div>
                                        <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-1", isDark ? "text-slate-500" : "text-slate-400")}>Password</p>
                                        <div className="flex items-center gap-2">
                                            <p className={cn("text-sm font-mono font-semibold", isDark ? "text-white" : "text-slate-900")}>
                                                {showPassword ? user.password : '••••••••'}
                                            </p>
                                            <button onClick={() => setShowPassword(!showPassword)} className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Work Information */}
                        <div className={cn(
                            "rounded-2xl p-6 border",
                            isDark ? "bg-slate-800/40 border-slate-700/50 backdrop-blur-sm" : "bg-white border-slate-200 shadow-sm"
                        )}>
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                                    <Briefcase className="w-4 h-4 text-purple-500" />
                                </div>
                                <h3 className={cn("text-xs font-black uppercase tracking-widest", isDark ? "text-white" : "text-slate-900")}>Work Info</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Role</p>
                                    <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>{user.role}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Department</p>
                                    <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>{user.department}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Workspace</p>
                                    <p className={cn("text-sm font-bold", isDark ? "text-blue-400" : "text-blue-600")}>{getWorkspaceName() || '—'}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Type</p>
                                    <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>Full-Time</p>
                                </div>
                            </div>
                        </div>

                        {/* Activity Summary */}
                        <div className={cn(
                            "rounded-2xl p-6 border",
                            isDark ? "bg-slate-800/40 border-slate-700/50 backdrop-blur-sm" : "bg-white border-slate-200 shadow-sm"
                        )}>
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <Activity className="w-4 h-4 text-emerald-500" />
                                </div>
                                <h3 className={cn("text-xs font-black uppercase tracking-widest", isDark ? "text-white" : "text-slate-900")}>Activity</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Status</p>
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg",
                                        user.status === 'Active'
                                            ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                                            : isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"
                                    )}>
                                        {user.status}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Google</p>
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg flex items-center gap-1",
                                        user.googleConnected
                                            ? isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-50 text-blue-600"
                                            : isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"
                                    )}>
                                        <Globe className="w-3 h-3" /> {user.googleConnected ? 'Connected' : 'Not Connected'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Joined</p>
                                    <p className={cn("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>{memberSince}</p>
                                </div>
                                {user.hourlyRate && (
                                    <div className="flex items-center justify-between">
                                        <p className={cn("text-[10px] font-bold uppercase tracking-widest", isDark ? "text-slate-500" : "text-slate-400")}>Rate</p>
                                        <p className={cn("text-sm font-black tabular-nums", isDark ? "text-emerald-400" : "text-emerald-600")}>${user.hourlyRate}/hr</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ═══ Quick Links / Workspace Navigation ═══ */}
                    {quickLinks.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-blue-400" />
                                </div>
                                <h2 className={cn("text-lg font-bold", isDark ? "text-white" : "text-slate-900")}>Quick Access</h2>
                                <span className={cn(
                                    "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest",
                                    isDark ? "bg-blue-500/20 text-blue-300" : "bg-blue-100 text-blue-600"
                                )}>
                                    {isSuperAdmin ? 'SuperAdmin' : getWorkspaceName() || 'Workspace'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                {quickLinks.map((link, idx) => (
                                    <QuickLinkCard key={idx} {...link} isDark={isDark} />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Bottom Spacer */}
                    <div className="h-4" />
                </div>
            </div>
        </div>
    );
}
