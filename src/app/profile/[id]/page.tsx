'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft, User, Mail, Phone, Building, Briefcase, Shield, Calendar,
    Globe, Check, MapPin, DollarSign, Clock, FileText, Activity,
    ChevronRight, ExternalLink, Lock,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

// ─── Info Row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, valueClass }: {
    icon: React.ElementType; label: string; value: React.ReactNode; valueClass?: string;
}) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0 group">
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-secondary/60 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
            </div>
            <span className={cn("text-[12px] font-bold text-foreground text-right max-w-[55%] truncate", valueClass)}>{value || <span className="text-muted-foreground/40">—</span>}</span>
        </div>
    );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
    label: string; value: string | number; icon: React.ElementType; color: string;
}) {
    return (
        <div className="bg-background border border-border rounded-lg p-4 hover:border-border/80 transition-all group">
            <div className="flex items-center justify-between mb-3">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <p className="text-2xl font-black text-foreground tabular-nums tracking-tight">{value}</p>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{label}</p>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmployeeProfilePage() {
    const router = useRouter();
    const { data: session } = useSession();
    const params = useParams();
    const id = params.id as string;

    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

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

    if (loading) {
        return (
            <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
                {/* Skeleton header */}
                <div className="shrink-0 border-b border-border bg-background px-4 py-3">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-secondary animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-4 w-40 rounded bg-secondary animate-pulse" />
                            <div className="h-3 w-24 rounded bg-secondary animate-pulse" />
                        </div>
                    </div>
                </div>
                {/* Skeleton body */}
                <div className="flex-1 p-6">
                    <div className="grid grid-cols-3 gap-4">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-24 rounded-lg bg-secondary/50 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-background gap-4">
                <User className="w-12 h-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">User not found</p>
                <button onClick={() => router.back()} className="text-xs text-primary hover:underline cursor-pointer">Go Back</button>
            </div>
        );
    }

    const fullName = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.name || 'Unknown');
    const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || '?';
    const department = (user.department === 'SUPERADMIN' || user.department === 'Management') ? 'Admin' : (user.department || 'N/A');
    const isOwnProfile = session?.user?.id === user._id;
    const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

    const sessionRole = (session?.user as any)?.role;
    const isAdmin = sessionRole === 'SuperAdmin' || sessionRole === 'Admin';

    const tabs = [
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'work', label: 'Work Info', icon: Briefcase },
        { id: 'files', label: 'Files', icon: FileText },
        ...(isAdmin ? [{ id: 'permissions', label: 'Permissions', icon: Lock }] : []),
    ];

    return (
        <div className="flex flex-col h-[calc(100vh-48px)] bg-background">
            {/* ── Header Banner ────────────────────────────────────────────────────── */}
            <div className="shrink-0 border-b border-border bg-background">
                {/* Gradient accent */}
                <div className="h-20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_25%,rgba(255,255,255,0.02)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.02)_75%)] bg-[length:30px_30px]" />
                </div>
                {/* Profile bar */}
                <div className="px-6 -mt-8 pb-3 flex items-end gap-4">
                    <button onClick={() => router.back()} className="text-muted-foreground hover:text-foreground transition-colors mb-2 cursor-pointer shrink-0" title="Back">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    {/* Avatar */}
                    <div className="relative shrink-0">
                        <div className="w-16 h-16 rounded-full border-[3px] border-background shadow-lg overflow-hidden bg-secondary">
                            {user.profileImage || user.image ? (
                                <Image src={user.profileImage || user.image} alt={fullName} fill className="object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-primary/10">
                                    <span className="text-lg font-black text-primary">{initials}</span>
                                </div>
                            )}
                        </div>
                        {/* Status indicator */}
                        <div className={cn(
                            "absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-background",
                            user.status === 'Active' ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                        )} />
                    </div>
                    {/* Name & role */}
                    <div className="flex-1 min-w-0 mb-1">
                        <h1 className="text-lg font-black text-foreground tracking-tight truncate">{fullName}</h1>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-primary/80 uppercase tracking-wider">{user.role || 'N/A'}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{department}</span>
                            {user.status && (
                                <>
                                    <span className="text-muted-foreground/40">·</span>
                                    <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                                        user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted-foreground/10 text-muted-foreground'
                                    )}>{user.status}</span>
                                </>
                            )}
                        </div>
                    </div>
                    {/* Quick actions */}
                    <div className="flex items-center gap-2 mb-1 shrink-0">
                        {user.email && (
                            <a href={`mailto:${user.email}`} className="h-8 px-3 bg-primary text-primary-foreground hover:opacity-90 transition-all rounded-lg shadow flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
                                <Mail className="w-3.5 h-3.5" />
                                <span>Message</span>
                            </a>
                        )}
                        {user.phone && (
                            <a href={`tel:${user.phone}`} className="h-8 px-3 bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-all rounded-lg flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest">
                                <Phone className="w-3.5 h-3.5" />
                                <span>Call</span>
                            </a>
                        )}
                    </div>
                </div>
                {/* Tab bar */}
                <div className="px-6 flex items-center gap-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.id;
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-1.5 cursor-pointer -mb-px",
                                    active ? 'text-foreground border-foreground' : 'text-muted-foreground border-transparent hover:text-foreground hover:border-muted-foreground/30'
                                )}>
                                <Icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Content ──────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scrollbar-custom">
                <div className="max-w-6xl mx-auto px-6 py-6">

                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="animate-in fade-in duration-300 space-y-6">
                            {/* Stats row */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <StatCard label="Hourly Rate" value={user.hourlyRate ? `$${user.hourlyRate}` : '—'} icon={DollarSign} color="bg-emerald-500/10 text-emerald-500" />
                                <StatCard label="Department" value={department} icon={Building} color="bg-blue-500/10 text-blue-500" />
                                <StatCard label="Role" value={user.role || '—'} icon={Shield} color="bg-purple-500/10 text-purple-500" />
                                <StatCard label="Status" value={user.status || '—'} icon={Activity} color={user.status === 'Active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted-foreground/10 text-muted-foreground'} />
                            </div>

                            {/* Two column layout */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Contact Information */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                            Contact Information
                                        </h3>
                                    </div>
                                    <div className="px-5 py-2">
                                        <InfoRow icon={Mail} label="Email" value={
                                            user.email ? <a href={`mailto:${user.email}`} className="text-primary hover:underline">{user.email}</a> : null
                                        } />
                                        <InfoRow icon={Phone} label="Phone" value={
                                            user.phone ? <a href={`tel:${user.phone}`} className="text-primary hover:underline font-mono">{user.phone}</a> : null
                                        } />
                                        <InfoRow icon={Globe} label="Google" value={
                                            user.googleConnected
                                                ? <span className="flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Connected</span>
                                                : <span className="text-muted-foreground/50">Not Connected</span>
                                        } />
                                    </div>
                                </div>

                                {/* Employment Details */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                            Employment Details
                                        </h3>
                                    </div>
                                    <div className="px-5 py-2">
                                        <InfoRow icon={User} label="Employee ID" value={<span className="font-mono text-[11px]">{user._id}</span>} />
                                        <InfoRow icon={Shield} label="Role" value={user.role} />
                                        <InfoRow icon={Building} label="Department" value={department} />
                                        <InfoRow icon={DollarSign} label="Hourly Rate" value={user.hourlyRate ? <span className="font-mono">${user.hourlyRate}/hr</span> : null} />
                                        {joinDate && <InfoRow icon={Calendar} label="Joined" value={joinDate} />}
                                    </div>
                                </div>
                            </div>

                            {/* Google Integration - only for own profile */}
                            {isOwnProfile && (
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-5 py-3 bg-secondary/30 border-b border-border flex items-center justify-between">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                                            Google Integration
                                        </h3>
                                        {user.googleConnected ? (
                                            <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                                                <Check className="w-3 h-3" /> Connected
                                            </span>
                                        ) : (
                                            <button onClick={() => window.location.href = '/api/auth/google'}
                                                className="h-7 px-3 bg-primary text-primary-foreground hover:opacity-90 transition-all rounded text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer">
                                                <Globe className="w-3 h-3" /> Connect Google
                                            </button>
                                        )}
                                    </div>
                                    <div className="px-5 py-4">
                                        <p className="text-[12px] text-muted-foreground leading-relaxed">
                                            {user.googleConnected
                                                ? `Your Google account (${user.googleEmail || user.email}) is connected. You can access Google Calendar, Sheets, and other integrations.`
                                                : 'Connect your Google account to enable Calendar sync, Drive access, and other productivity integrations.'}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Work Info Tab */}
                    {activeTab === 'work' && (
                        <div className="animate-in fade-in duration-300 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Work Information */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                                            Work Information
                                        </h3>
                                    </div>
                                    <div className="px-5 py-2">
                                        <InfoRow icon={User} label="Employee ID" value={<span className="font-mono text-[11px]">{user._id}</span>} />
                                        <InfoRow icon={Shield} label="Role" value={user.role} />
                                        <InfoRow icon={Building} label="Department" value={department} />
                                        <InfoRow icon={Clock} label="Employment Type" value="Full-Time" />
                                        <InfoRow icon={DollarSign} label="Hourly Rate" value={user.hourlyRate ? <span className="font-mono">${user.hourlyRate}/hr</span> : null} />
                                        {joinDate && <InfoRow icon={Calendar} label="Start Date" value={joinDate} />}
                                    </div>
                                </div>

                                {/* Status & Access */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                                            Status & Access
                                        </h3>
                                    </div>
                                    <div className="px-5 py-2">
                                        <InfoRow icon={Activity} label="Status" value={
                                            <span className={cn(
                                                "flex items-center gap-1.5 text-[11px] font-black uppercase",
                                                user.status === 'Active' ? 'text-emerald-500' : 'text-muted-foreground'
                                            )}>
                                                <div className={cn("w-2 h-2 rounded-full", user.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30')} />
                                                {user.status || 'Inactive'}
                                            </span>
                                        } />
                                        <InfoRow icon={Globe} label="Google Account" value={
                                            user.googleConnected
                                                ? <span className="flex items-center gap-1 text-emerald-500"><Check className="w-3 h-3" /> Connected</span>
                                                : <span className="text-muted-foreground/50">Not Connected</span>
                                        } />
                                        <InfoRow icon={Mail} label="Email" value={user.email} />
                                        <InfoRow icon={Phone} label="Phone" value={user.phone} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Files Tab */}
                    {activeTab === 'files' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center">
                                    <FileText className="w-8 h-8 text-muted-foreground/30" />
                                </div>
                                <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">No files uploaded</p>
                                <p className="text-[12px] text-muted-foreground/60">Employee documents will appear here</p>
                            </div>
                        </div>
                    )}

                    {/* Permissions Tab (Admin only) */}
                    {activeTab === 'permissions' && isAdmin && (
                        <div className="animate-in fade-in duration-300 space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Role & Access Level */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                                            Role & Access Level
                                        </h3>
                                    </div>
                                    <div className="px-5 py-2">
                                        <InfoRow icon={Shield} label="Role" value={
                                            <span className={cn(
                                                "text-[11px] font-black uppercase px-2 py-0.5 rounded-full",
                                                user.role === 'SuperAdmin' ? 'bg-red-500/10 text-red-500' :
                                                    user.role === 'Admin' ? 'bg-purple-500/10 text-purple-500' :
                                                        'bg-blue-500/10 text-blue-500'
                                            )}>{user.role || 'N/A'}</span>
                                        } />
                                        <InfoRow icon={Activity} label="Status" value={
                                            <span className={cn(
                                                "flex items-center gap-1.5 text-[11px] font-black uppercase",
                                                user.status === 'Active' ? 'text-emerald-500' : 'text-muted-foreground'
                                            )}>
                                                <div className={cn("w-2 h-2 rounded-full", user.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30')} />
                                                {user.status || 'Inactive'}
                                            </span>
                                        } />
                                        <InfoRow icon={Building} label="Department" value={department} />
                                        <InfoRow icon={Mail} label="Email" value={user.email} />
                                    </div>
                                </div>

                                {/* Workspace Access */}
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-5 py-3 bg-secondary/30 border-b border-border">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                            Workspace Access
                                        </h3>
                                    </div>
                                    <div className="px-5 py-4">
                                        {user.workspace && user.workspace.length > 0 ? (
                                            <div className="space-y-2">
                                                {(Array.isArray(user.workspace) ? user.workspace : [user.workspace]).map((ws: string, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-3 px-3 py-2.5 bg-secondary border border-border rounded-lg">
                                                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                                            <Building className="w-4 h-4 text-primary" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[12px] font-bold text-foreground">{ws}</div>
                                                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Assigned Workspace</div>
                                                        </div>
                                                        <Check className="w-4 h-4 text-emerald-500 ml-auto" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-8 gap-2">
                                                <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center">
                                                    <Lock className="w-6 h-6 text-muted-foreground/30" />
                                                </div>
                                                <p className="text-[12px] text-muted-foreground font-bold uppercase tracking-widest">No workspaces assigned</p>
                                                <p className="text-[11px] text-muted-foreground/60">This user does not have any workspace permissions.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
