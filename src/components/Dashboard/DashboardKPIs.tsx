'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp, Users, DollarSign, Package,
    ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';

const KPICard = ({ title, value, change, trend, icon: Icon, color }: any) => (
    <motion.div
        whileHover={{ y: -5 }}
        className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-xl transition-all group"
    >
        <div className="flex justify-between items-start mb-4">
            <div className={cn("p-3 rounded-xl", color)}>
                <Icon className="w-6 h-6" />
            </div>
            <div className={cn(
                "flex items-center text-xs font-bold px-2 py-1 rounded-full",
                trend === 'up' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
            )}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {change}
            </div>
        </div>
        <div>
            <h3 className="text-muted text-sm font-semibold uppercase tracking-wider mb-1">{title}</h3>
            <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold text-primary">{value}</span>
            </div>
        </div>

        <div className="mt-6 h-1 w-full bg-slate-50 rounded-full overflow-hidden">
            <motion.div
                initial={{ width: 0 }}
                animate={{ width: '70%' }}
                className={cn("h-full", color.replace('bg-', 'bg-opacity-80 bg-'))}
            />
        </div>
    </motion.div>
);

export const DashboardKPIs = () => {
    return (
        <div className="space-y-10 p-4">
            <div className="flex flex-col space-y-2">
                <h1 className="text-4xl font-extrabold tracking-tight text-primary">Welcome back, Admin</h1>
                <p className="text-muted font-medium ">Here's what's happening across RebelX Headquarters today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard
                    title="Total Revenue"
                    value="$124,592"
                    change="+12.5%"
                    trend="up"
                    icon={DollarSign}
                    color="bg-indigo-50 text-indigo-600"
                />
                <KPICard
                    title="New Clients"
                    value="482"
                    change="+3.2%"
                    trend="up"
                    icon={Users}
                    color="bg-sky-50 text-sky-600"
                />
                <KPICard
                    title="Active Orders"
                    value="1,240"
                    change="-2.1%"
                    trend="down"
                    icon={Package}
                    color="bg-amber-50 text-amber-600"
                />
                <KPICard
                    title="System Load"
                    value="24%"
                    change="+0.5%"
                    trend="up"
                    icon={Activity}
                    color="bg-slate-50 text-slate-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-3xl border border-border p-8 shadow-sm">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-bold">Recent Activities</h2>
                        <button className="text-sm font-bold text-accent hover:underline">View All</button>
                    </div>
                    <div className="space-y-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors border border-transparent hover:border-border">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-400">
                                        JD
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-primary">John Doe updated SKU-924</h4>
                                        <p className="text-sm text-muted">Warehouse Management • 2 mins ago</p>
                                    </div>
                                </div>
                                <div className="hidden sm:block">
                                    <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest text-muted">Warehouse</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-primary rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-4">Quick Stats</h2>
                        <p className="text-slate-300 text-sm mb-8 leading-relaxed">
                            Real-time monitoring of serverless functions and database throughput.
                        </p>
                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Monthly Target</span>
                                <span className="text-xl font-bold">$200k / $250k</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: '80%' }}
                                    className="h-full bg-accent"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <div className="bg-slate-800/50 p-4 rounded-2xl">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Uptime</span>
                                    <span className="text-lg font-bold text-accent">99.9%</span>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-2xl">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Latency</span>
                                    <span className="text-lg font-bold text-emerald-400">42ms</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 5, repeat: Infinity }}
                        className="absolute -right-20 -bottom-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl group-hover:bg-accent/30 transition-colors"
                    />
                </div>
            </div>
        </div>
    );
};
