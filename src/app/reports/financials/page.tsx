'use client';

import React from 'react';
import Link from 'next/link';
import { 
    FileText, 
    TrendingUp, 
    Wallet, 
    PiggyBank,
    ArrowRight,
    BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

const financialReports = [
    {
        title: 'Income Statement',
        description: 'View revenue, expenses, and profitability over time',
        href: '/reports/financials/income-statement',
        icon: TrendingUp,
        color: 'emerald',
        available: true
    },
    {
        title: 'Cost of Goods Manufactured',
        description: 'Manufacturing batches, materials used, and production costs',
        href: '/reports/financials/cogm',
        icon: FileText,
        color: 'purple',
        available: true
    },
    {
        title: 'Balance Sheet',
        description: 'Assets, liabilities, and equity snapshot',
        href: '/reports/financials/balance-sheet',
        icon: Wallet,
        color: 'blue',
        available: false
    },
    {
        title: 'Cash Flow Statement',
        description: 'Track cash movements and liquidity',
        href: '/reports/financials/cash-flow',
        icon: PiggyBank,
        color: 'purple',
        available: false
    },
    {
        title: 'Expense Report',
        description: 'Detailed breakdown of operating expenses',
        href: '/reports/financials/expenses',
        icon: FileText,
        color: 'amber',
        available: false
    }
];

const colorClasses = {
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-500/30',
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/30',
    purple: 'from-purple-500 to-purple-600 shadow-purple-500/30',
    amber: 'from-amber-500 to-amber-600 shadow-amber-500/30'
};

export default function FinancialsPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-10">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-4">
                        <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
                        <span>/</span>
                        <span>Reports</span>
                        <span>/</span>
                        <span className="text-white font-medium">Financials</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <BarChart3 className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Financial Reports</h1>
                            <p className="text-slate-400 text-sm mt-1">Comprehensive financial analysis and reporting</p>
                        </div>
                    </div>
                </div>

                {/* Reports Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {financialReports.map((report) => (
                        <Link
                            key={report.title}
                            href={report.available ? report.href : '#'}
                            className={cn(
                                "group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 transition-all duration-300",
                                report.available 
                                    ? "hover:bg-slate-800/80 hover:border-slate-600/50 hover:scale-[1.02] cursor-pointer" 
                                    : "opacity-50 cursor-not-allowed"
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg",
                                        colorClasses[report.color as keyof typeof colorClasses]
                                    )}>
                                        <report.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                                            {report.title}
                                            {!report.available && (
                                                <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-slate-700 text-slate-400 rounded-full">
                                                    Coming Soon
                                                </span>
                                            )}
                                        </h3>
                                        <p className="text-slate-400 text-sm">{report.description}</p>
                                    </div>
                                </div>
                                {report.available && (
                                    <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
