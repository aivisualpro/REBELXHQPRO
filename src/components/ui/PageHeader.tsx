'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Tab {
    id: string;
    label: string;
    icon?: LucideIcon;
}

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    iconGradient?: string;
    actions?: React.ReactNode;
    tabs?: Tab[];
    activeTab?: string;
    onTabChange?: (id: string) => void;
    className?: string;
    stats?: React.ReactNode;
}

export const PageHeader = ({
    title,
    subtitle,
    icon: Icon,
    iconGradient = "from-slate-700 to-slate-900",
    actions,
    tabs,
    activeTab,
    onTabChange,
    className,
    stats
}: PageHeaderProps) => {
    return (
        <div className={cn("shrink-0 bg-white border-b border-slate-200", className)}>
            <div className="px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        {Icon && (
                            <div className={cn(
                                "w-12 h-12 bg-gradient-to-br flex items-center justify-center shadow-lg transform transition-transform hover:scale-105",
                                iconGradient
                            )}>
                                <Icon className="w-6 h-6 text-white" />
                            </div>
                        )}
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-none mb-1">
                                {title}
                            </h1>
                            {subtitle && (
                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-6">
                        {stats && (
                            <div className="hidden border-r border-slate-100 pr-6 md:flex items-center space-x-4">
                                {stats}
                            </div>
                        )}
                        <div className="flex items-center space-x-3">
                            {actions}
                        </div>
                    </div>
                </div>
            </div>

            {tabs && tabs.length > 0 && (
                <div className="px-6 flex items-center space-x-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange?.(tab.id)}
                            className={cn(
                                "relative py-3 text-[11px] font-black uppercase tracking-widest transition-all duration-200",
                                activeTab === tab.id
                                    ? "text-black"
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            <div className="flex items-center space-x-2">
                                {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
                                <span>{tab.label}</span>
                            </div>
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-1 bg-black"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
