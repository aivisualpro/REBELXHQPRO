'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Book, ChevronRight, ChevronDown, Home, Package, ShoppingCart, Users, BarChart3,
    Wrench, Brain, Shield, Zap, Target, Layers, Box, FileText, Settings, HelpCircle,
    AlertTriangle, CheckCircle2, Truck, DollarSign, PieChart, Activity, Clock,
    Lock, Server, Globe, Database, Cpu, RefreshCw, Terminal, Code, Link as LinkIcon,
    ShieldCheck, ZapOff, History, Kanban, MessageSquare, PhoneCall, Mail, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Chapter {
    id: string;
    title: string;
    icon: React.ReactNode;
    sections: Section[];
}

interface Section {
    id: string;
    title: string;
    content: React.ReactNode;
}

const VERSION = "V.b0.21";

export default function KnowledgeBasePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeChapter, setActiveChapter] = useState<string>('overview');
    
    // Updated: Initialize all sections as expanded
    const [expandedSections, setExpandedSections] = useState<string[]>([
        'overview-intro', 'overview-architecture', 'overview-vision',
        'dashboard-overview', 'dashboard-neural',
        'warehouse-skus', 'warehouse-ledger', 'warehouse-manufacturing', 'warehouse-recipes', 'warehouse-other',
        'sales-weborders', 'sales-wholesale', 'sales-subscriptions',
        'crm-clients', 'crm-retention',
        'reports-income', 'reports-cogm', 'reports-other',
        'admin-users', 'admin-settings',
        'integrations-websites', 'integrations-future',
        'technical-stack', 'technical-models', 'technical-api'
    ]);

    // Admin role check
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <div className="animate-pulse text-slate-400 text-sm">Loading...</div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-white">
                <Lock className="w-16 h-16 text-slate-200 mb-4" />
                <h1 className="text-xl font-bold text-slate-400 uppercase tracking-tighter">Access Restricted</h1>
                <p className="text-sm text-slate-400 mt-2">This page is only accessible to Administrators.</p>
                <button onClick={() => router.push('/')} className="mt-6 px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase">
                    Return to Dashboard
                </button>
            </div>
        );
    }

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => 
            prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
        );
    };

    const chapters: Chapter[] = [
        {
            id: 'overview',
            title: 'System Overview',
            icon: <Home className="w-4 h-4" />,
            sections: [
                {
                    id: 'overview-intro',
                    title: 'Strategic Vision & Project Scope',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p><strong className="text-slate-900">Rebel X Headquarter Pro</strong> is the evolutionary successor to AppSheet-based solutions. Built as a custom-engineered Enterprise Resource Planning (ERP) platform, it provides complete sovereignty over business data and operations.</p>
                            
                            <div className="bg-slate-50 border border-slate-200 p-4 space-y-3">
                                <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-200 pb-2 mb-2">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    The Core Mission
                                </div>
                                <p>To eliminate the scalability bottlenecks and maintenance overhead of AppSheet while providing enterprise-grade features that integrate directly with WordPress, ShipStation, and AI intelligence layers.</p>
                                <div className="grid grid-cols-3 gap-2 text-[10px] font-bold uppercase tracking-wider">
                                    <div className="bg-white border border-slate-200 p-2 text-center text-slate-600">Low Maintenance</div>
                                    <div className="bg-white border border-slate-200 p-2 text-center text-slate-600">Live Integrations</div>
                                    <div className="bg-white border border-slate-200 p-2 text-center text-slate-600">AI Neural Engine</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="font-bold text-slate-900">Key Distinctions:</h4>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li><strong>Not Just a CRM:</strong> While it manages clients, it is fundamentally an ERP that handles the entire supply chain from raw ingredients to final web sale.</li>
                                    <li><strong>Managerial Automation:</strong> Designed to act as an automated oversight layer, replacing the need for manual data entry and cross-platform verification.</li>
                                    <li><strong>Cost Efficiency:</strong> Operational costs are capped at approximately $200/month, covering live servers and API throughput for Grok AI and WooCommerce.</li>
                                </ul>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'overview-architecture',
                    title: 'The High-Performance Stack',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The platform leverages a cutting-edge technical architecture designed for sub-second latency and absolute data integrity.</p>
                            
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <Terminal className="w-4 h-4 text-slate-400 mb-2" />
                                    <div className="font-black text-[10px] uppercase text-slate-900">Core</div>
                                    <p className="text-[11px] mt-1 text-slate-500">Next.js 14 (Turbopack)</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <Code className="w-4 h-4 text-blue-400 mb-2" />
                                    <div className="font-black text-[10px] uppercase text-slate-900">Logic</div>
                                    <p className="text-[11px] mt-1 text-slate-500">strict TypeScript 5.0</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <Database className="w-4 h-4 text-emerald-400 mb-2" />
                                    <div className="font-black text-[10px] uppercase text-slate-900">Storage</div>
                                    <p className="text-[11px] mt-1 text-slate-500">MongoDB Atlas / Mongoose</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <Shield className="w-4 h-4 text-purple-400 mb-2" />
                                    <div className="font-black text-[10px] uppercase text-slate-900">Auth</div>
                                    <p className="text-[11px] mt-1 text-slate-500">Next-Auth (JWT)</p>
                                </div>
                            </div>

                            <p className="italic text-xs text-slate-500">The system is deployed on Vercel with automated CI/CD pipelines, ensuring that every code push is verified for type safety before going live.</p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'dashboard',
            title: 'Neural Dashboard & AI Engine',
            icon: <Brain className="w-4 h-4" />,
            sections: [
                {
                    id: 'dashboard-neural',
                    title: 'Neural Board Matrix',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>Neural Board</strong> is the "brain" of the ERP, powered by Grok AI models. It processes millions of data points across your SKUs, Web Orders, and Manufacturing logs to deliver high-level intelligence.</p>
                            
                            <div className="bg-slate-900 rounded p-4 text-slate-300 font-mono text-xs">
                                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                                    <span className="flex items-center gap-2"><Brain className="w-4 h-4 text-blue-400" /> LIVE NEURAL ANALYSIS</span>
                                    <span className="text-emerald-400">SYNCED: OK</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Revenue Pulse</div>
                                        <div className="text-blue-400">Analyzing sales velocity...</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Capital Shield</div>
                                        <div className="text-emerald-400">Inventory value optimized.</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Team Load</div>
                                        <div className="text-amber-400">3 Work Orders in Queue.</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">Stock Health</div>
                                        <div className="text-rose-400">2 SKUs below ROP.</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 pt-2">
                                <div className="bg-slate-50 p-2 border border-slate-200">
                                    <div className="font-bold text-slate-900 text-xs">Dynamic Querying</div>
                                    <p className="text-[10px] leading-tight mt-1">Talk to your business data as if you're talking to a manager. "What is our GP for the last 90 days across KINGKKRATOM?"</p>
                                </div>
                                <div className="bg-slate-50 p-2 border border-slate-200">
                                    <div className="font-bold text-slate-900 text-xs">Predictive ROP</div>
                                    <p className="text-[10px] leading-tight mt-1">The AI predicts when you will run out of stock based on manufacturing time + web order velocity.</p>
                                </div>
                                <div className="bg-slate-50 p-2 border border-slate-200">
                                    <div className="font-bold text-slate-900 text-xs">Operational Alerts</div>
                                    <p className="text-[10px] leading-tight mt-1">Identifies bottlenecks in the manufacturing process where labor cost exceeds recipe standards.</p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'warehouse',
            title: 'Master Warehouse & Supply Chain',
            icon: <Package className="w-4 h-4" />,
            sections: [
                {
                    id: 'warehouse-skus',
                    title: 'Deep-Dive: SKU Intelligence',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Every physical item is tracked at the SKU level, encompassing everything from raw herbs and labels to finished bottles.</p>
                            
                            <div className="bg-slate-50 border border-slate-200">
                                <div className="px-4 py-2 border-b border-slate-200 font-bold bg-slate-100 flex items-center gap-2">
                                    <Layers className="w-4 h-4" /> SKU DATA DIMENSIONS
                                </div>
                                <div className="p-4 grid grid-cols-2 gap-x-8 gap-y-4">
                                    <div>
                                        <h5 className="font-bold text-slate-900 mb-1">Financial Attribution</h5>
                                        <p className="text-xs">Tracks COGS (Cost of Goods Sold) vs COGM (Cost of Goods Manufactured) per unit. Includes historical gross profit tracking down to the decimal.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-900 mb-1">Stock Thresholds</h5>
                                        <p className="text-xs">Re-Order Point (ROP) and Order Upto (OU) levels trigger automated purchase alerts and neural board notifications.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-900 mb-1">Tier Classification</h5>
                                        <p className="text-xs">Tiers 1, 2, and 3 are automatically assigned based on revenue and order frequency, helping focus capital on movers.</p>
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-slate-900 mb-1">Lot Enforcement</h5>
                                        <p className="text-xs">Optional "Lot Applied" toggle enforces FIFO and lot number association for all outbound shipments.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'warehouse-manufacturing',
                    title: 'Manufacturing & COGM Logic',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Manufacturing isn't just a record; it's a dynamic cost-calculation engine.</p>
                            
                            <div className="relative pl-8 border-l-2 border-slate-200 space-y-6 py-2">
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1 bg-white p-1 rounded-full border-2 border-slate-900">
                                        <FileText className="w-4 h-4" />
                                    </div>
                                    <h5 className="font-bold text-slate-900 mb-1 uppercase tracking-tight">The Work Order Creation</h5>
                                    <p className="text-xs">When you start a work order, the ERP looks at the recipe. It cross-checks current inventory costs (using FIFO from warehouse lots) to estimate initial material cost.</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1 bg-white p-1 rounded-full border-2 border-slate-900">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <h5 className="font-bold text-slate-900 mb-1 uppercase tracking-tight">Live Labor Injection</h5>
                                    <p className="text-xs">Employees clock in on the dashboard. The ERP calculates labor cost dynamically based on their specific hourly rate stored in the User database.</p>
                                </div>
                                <div className="relative">
                                    <div className="absolute -left-[41px] top-1 bg-white p-1 rounded-full border-2 border-slate-900">
                                        <RefreshCw className="w-4 h-4" />
                                    </div>
                                    <h5 className="font-bold text-slate-900 mb-1 uppercase tracking-tight">Closing the Loop (COGM)</h5>
                                    <p className="text-xs">Upon completion, materials are deducted from Stock, and a NEW Lot is created for the finished product. The calculated cost (Material + Labor + Packaging) becomes the NEW COGS for that lot.</p>
                                </div>
                            </div>

                            <div className="bg-slate-900 text-slate-100 p-4 font-mono text-xs">
                                <div className="flex justify-between border-b border-slate-700 pb-2 mb-2 uppercase text-[10px] font-bold">
                                    <span>Manufacturing Formula</span>
                                    <span>COGM_V.b0.21</span>
                                </div>
                                <div className="space-y-1">
                                    <p>Material_Cost = Sum(Item_Qty * Lot_Cost)</p>
                                    <p>Labor_Cost = (Duration / 3600) * Hourly_Rate</p>
                                    <p>Total_Cost = Material_Cost + Labor_Cost + Overheads</p>
                                    <p className="text-emerald-400 mt-2 font-black">COST_PER_UNIT = Total_Cost / Yield_Qty</p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'sales',
            title: 'Multichannel Sales & Sync',
            icon: <ShoppingCart className="w-4 h-4" />,
            sections: [
                {
                    id: 'sales-weborders',
                    title: 'Sync Architecture: Web Orders',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Our system integrates directly with WooCommerce stores. We manage the complexity of product name variations between websites and our ERP.</p>
                            
                            <div className="space-y-3">
                                <div className="bg-slate-50 p-4 border border-slate-200">
                                    <h5 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><LinkIcon className="w-4 h-4" /> SKU Linking (The "Bridge")</h5>
                                    <p className="text-xs leading-relaxed">Web products often have marketing-friendly names like "Super Green Deluxe". Our SKU lineup uses internal identifiers. The **SKU Linking** feature allows you to bridge these entities once. Every future order for "Super Green Deluxe" will automatically be deducted from the correct internal SKU and Lot.</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 p-3 border border-slate-200 border-l-4 border-l-blue-600">
                                        <div className="font-bold text-slate-900 text-[11px] uppercase">Real-Time Sync</div>
                                        <p className="text-[10px] mt-1">Incremental sync monitors change logs to update only new orders, saving server resource.</p>
                                    </div>
                                    <div className="bg-slate-50 p-3 border border-slate-200 border-l-4 border-l-amber-600">
                                        <div className="font-bold text-slate-900 text-[11px] uppercase">Spam Filtering</div>
                                        <p className="text-[10px] mt-1">Advanced logic filters out 14k+ legacy spam orders while retaining financial data core.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'crm',
            title: 'CRM Retention Command',
            icon: <Users className="w-4 h-4" />,
            sections: [
                {
                    id: 'crm-retention',
                    title: 'The Retention Algorithm',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Retention is handled by a specialized subsystem designed to predict and prevent client churn.</p>
                            
                            <div className="flex flex-col gap-4">
                                <div className="bg-slate-50 border border-slate-200 p-4">
                                    <h5 className="font-bold text-slate-900 mb-2 flex items-center gap-2 font-black uppercase text-xs tracking-widest"><Zap className="w-4 h-4 text-amber-500" /> The Magic Button Logic</h5>
                                    <p className="text-xs leading-relaxed mb-3">When triggered, the system scans the entire **Client Database** and compares the **Last Order Date** across all channels against pre-set retention windows:</p>
                                    <div className="grid grid-cols-4 gap-2 font-mono text-[9px] text-center">
                                        <div className="p-2 bg-white border border-slate-200 text-slate-600 uppercase">30 Days<br/>Regular</div>
                                        <div className="p-2 bg-blue-50 border border-blue-200 text-blue-800 uppercase">60 Days<br/>At Risk</div>
                                        <div className="p-2 bg-amber-50 border border-amber-200 text-amber-800 uppercase">90 Days<br/>Critical</div>
                                        <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 uppercase">90+ Days<br/>Lost?</div>
                                    </div>
                                    <p className="text-[10px] mt-3 italic text-slate-500">The system then automatically generates **Retention Tasks** in a Kanban format, assigned to the correct Sales Rep, with a due date set for today.</p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'technical',
            title: 'Technical Documentation',
            icon: <Code className="w-4 h-4" />,
            sections: [
                {
                    id: 'technical-stack',
                    title: 'System Infrastructure',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Detailed technical overview of the production environment and architecture.</p>
                            <div className="space-y-3">
                                <div className="bg-slate-50 border border-slate-200 p-3 font-mono text-[11px]">
                                    <div className="text-slate-400 mb-1">// Production Runtime</div>
                                    <div>Platform: Vercel Serverless</div>
                                    <div>Node Version: 18.x</div>
                                    <div>Edge Cache: Enabled</div>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3 font-mono text-[11px]">
                                    <div className="text-slate-400 mb-1">// Database Cluster</div>
                                    <div>Type: MongoDB Atlas (M10 Cluster)</div>
                                    <div>Persistence: Oplog Replication</div>
                                    <div>Availability: 99.99%</div>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'technical-models',
                    title: 'Core Data Schemas (Mongoose)',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system's data integrity is maintained through strict Mongoose schemas.</p>
                            <div className="space-y-4">
                                <div>
                                    <div className="font-bold text-slate-900 border-b border-slate-200 mb-2 uppercase text-[10px] tracking-widest">SKU Model</div>
                                    <pre className="bg-slate-900 text-slate-300 p-3 rounded overflow-x-auto text-[10px]">
{`Schema({
    _id: String, // Internal barcode / handle
    category: String,
    materialType: String,
    salePrice: Number,
    reOrderPoint: Number,
    isLotApplied: Boolean,
    variances: [VariationSchema],
    totalWebOrders: Number,
    timestamps: true
})`}
                                    </pre>
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 border-b border-slate-200 mb-2 uppercase text-[10px] tracking-widest">WebOrder Model</div>
                                    <pre className="bg-slate-900 text-slate-300 p-3 rounded overflow-x-auto text-[10px]">
{`Schema({
    _id: String, // WC Order ID
    status: String,
    dateCreated: Date,
    total: Number,
    lineItems: [{
        productId: Number,
        linkedSkuId: String, // ERP Link
        lotNumber: String,
        cost: Number
    }],
    website: String
})`}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        }
    ];

    const activeChapterData = chapters.find(c => c.id === activeChapter);

    return (
        <div className="flex h-[calc(100vh-48px)] bg-white">
            {/* Sidebar */}
            <div className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <div className="bg-slate-900 p-1.5 shadow-lg">
                            <Book className="w-4 h-4 text-white" />
                        </div>
                        <h1 className="font-bold text-slate-900 text-sm uppercase tracking-tighter">Knowledge Base</h1>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-500 font-mono font-bold px-1.5 py-0.5 bg-slate-200 rounded-sm">{VERSION}</span>
                        <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider animate-pulse flex items-center gap-1">
                            <Activity className="w-2.5 h-2.5" /> Stable
                        </span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-left text-[11px] font-black uppercase tracking-widest transition-all",
                                activeChapter === chapter.id 
                                    ? "bg-slate-900 text-white shadow-md transform translate-x-1" 
                                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            )}
                        >
                            {chapter.icon}
                            {chapter.title}
                        </button>
                    ))}
                </div>
                <div className="p-3 border-t border-slate-200 bg-slate-100">
                    <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest flex items-center gap-2 mb-1">
                        <Server className="w-3 h-3" /> Core Engine
                    </div>
                    <p className="text-[10px] text-slate-600 font-mono">deployment:iad1-prod</p>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="shrink-0 px-6 py-4 border-b border-slate-200 bg-white/50 backdrop-blur-md flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Search className="w-3.5 h-3.5" />
                        <span className="uppercase tracking-widest text-[10px] font-bold">Documentation</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-slate-900 font-black uppercase tracking-widest">{activeChapterData?.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors">
                            <FileText className="w-3 h-3" /> PDF Export
                        </button>
                        <div className="h-4 w-px bg-slate-200" />
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Live System
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="mb-10">
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{activeChapterData?.title}</h2>
                            <p className="text-slate-500 text-sm mt-2 italic">Detailed technical and operational guide for the {activeChapterData?.title} module.</p>
                        </div>
                        
                        {activeChapterData?.sections.map(section => (
                            <div key={section.id} id={section.id} className="border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors bg-white border-b border-slate-100"
                                >
                                    <span className="font-black text-slate-900 text-xs uppercase tracking-widest flex items-center gap-3">
                                        <div className={cn(
                                            "w-1 h-3 transition-colors",
                                            expandedSections.includes(section.id) ? "bg-slate-900" : "bg-slate-200"
                                        )} />
                                        {section.title}
                                    </span>
                                    {expandedSections.includes(section.id) 
                                        ? <ChevronDown className="w-4 h-4 text-slate-900" /> 
                                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                                    }
                                </button>
                                {expandedSections.includes(section.id) && (
                                    <div className="px-6 py-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                        {section.content}
                                    </div>
                                )}
                            </div>
                        ))}

                        <div className="pt-10 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 uppercase font-black tracking-widest">
                            <span>REBEL X HQ PRO SYSTEM DOCUMENTATION</span>
                            <span>LAST UPDATED: DEC 30, 2025</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
