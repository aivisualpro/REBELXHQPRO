'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Book, ChevronRight, ChevronDown, Home, Package, ShoppingCart, Users, BarChart3,
    Wrench, Brain, Shield, Zap, Target, Layers, Box, FileText, Settings, HelpCircle,
    AlertTriangle, CheckCircle2, Truck, DollarSign, PieChart, Activity, Clock,
    Lock, Server, Globe, Database, Cpu, RefreshCw, Terminal, Code, Link as LinkIcon,
    ShieldCheck, ZapOff, History, Kanban, MessageSquare, PhoneCall, Mail, Search,
    CpuIcon, Rocket, BadgeDollarSign, Microscope, Workflow
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
    const [activeChapter, setActiveChapter] = useState<string>('vision');
    
    // Initialize all sections as expanded
    const [expandedSections, setExpandedSections] = useState<string[]>([
        'vision-strategy', 'vision-costs', 'vision-timeline',
        'skus-mgmt', 'skus-ledger', 'skus-tiers',
        'web-sync', 'web-linking', 'web-management',
        'mfg-automation', 'mfg-costing', 'mfg-labor',
        'ai-neural', 'ai-metrics',
        'crm-retention', 'crm-magic',
        'ops-structure', 'ops-roles',
        'tech-stack', 'tech-interop'
    ]);

    // Admin role check
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white text-slate-400">
                <div className="animate-pulse text-sm font-bold uppercase tracking-widest">Initialising Knowledge Stream...</div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-white">
                <Lock className="w-16 h-16 text-slate-200 mb-4" />
                <h1 className="text-xl font-bold text-slate-400 uppercase tracking-tighter">Access Restricted</h1>
                <p className="text-sm text-slate-400 mt-2">This executive intelligence port is restricted to Administrators.</p>
                <button onClick={() => router.push('/')} className="mt-6 px-6 py-2 bg-black text-white text-[10px] font-black uppercase tracking-widest shadow-xl">
                    Return to Safe Zone
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
            id: 'vision',
            title: 'Executive Vision & ROI',
            icon: <Rocket className="w-4 h-4" />,
            sections: [
                {
                    id: 'vision-strategy',
                    title: 'The Pivot: Why Rebel X HQ Pro?',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <div className="border-l-4 border-black pl-4 py-1 italic text-slate-500">
                                "The transition from AppSheet to a custom-engineered ERP addresses the critical concerns of scalability and mounting maintenance costs."
                            </div>
                            <p><strong>Rebel X Headquarter Pro</strong> was designed to replace the technical debt of AppSheet. While AppSheet was instrumental in early phases, it lacks the throughput for complex SKU management, high-volume web order processing, and advanced neural insights. Our vision is a system that is <strong>low maintenance, high interoperability</strong>, and completely sovereign.</p>
                            <div className="bg-slate-50 border border-slate-200 p-4">
                                <h4 className="font-black text-slate-900 uppercase text-[10px] mb-2 tracking-widest">Managerial Strength</h4>
                                <p className="text-xs">Compare this ERP to hiring <strong>100 experienced managers</strong>. It provides oversight, automated guardrails, and real-time auditing that would otherwise require a massive workforce.</p>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'vision-costs',
                    title: 'Operational Cost Analysis',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>One of the primary objectives was to keep the "keep-the-lights-on" costs extremely low while maintaining professional performance.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black text-white p-4">
                                    <div className="text-[10px] uppercase font-black text-slate-400">Monthly Operating Cost</div>
                                    <div className="text-2xl font-black mt-1">~$200.00</div>
                                    <p className="text-[9px] mt-2 text-slate-400">Includes: Live Production Servers, Grok AI API throughput, Database Clusters, and WooCommerce Sync Hooks.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-4">
                                    <div className="text-[10px] uppercase font-black text-slate-500">System Status</div>
                                    <div className="text-xl font-black mt-1 text-slate-900 uppercase">Beta Phase</div>
                                    <p className="text-[9px] mt-2 text-slate-500">The core engine is 100% functional. Currently refining UI micro-interactions and deep-linking integrations.</p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'vision-timeline',
                    title: 'Integration Roadmap',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Integration with your existing communication and shipping workflows is a "microscopic task" in this architecture.</p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <div className="p-1 bg-blue-50 text-blue-600"><Workflow className="w-4 h-4" /></div>
                                    <div>
                                        <div className="font-bold text-slate-900">Communication Layer</div>
                                        <p className="text-xs">Direct API hooks for Google Voice and WhatsApp for logged communication directly within the CRM.</p>
                                    </div>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="p-1 bg-amber-50 text-amber-600"><Truck className="w-4 h-4" /></div>
                                    <div>
                                        <div className="font-bold text-slate-900">Logistics Layer</div>
                                        <p className="text-xs">ShipStation integration to manage shipping labels and tracking numbers without leaving the HQ Pro interface.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'skus',
            title: 'SKU & Inventory Intelligence',
            icon: <Package className="w-4 h-4" />,
            sections: [
                {
                    id: 'skus-mgmt',
                    title: 'Master SKU Command',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The SKUs page is the source of truth for the entire business. It doesn't just show "how many", it shows <strong>"how healthy"</strong>.</p>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-50 p-3 border border-slate-200">
                                    <div className="font-black text-slate-900 text-[10px] uppercase">Tier 1</div>
                                    <p className="text-[10px]">High Velocity / Higher Margin. The core of the business revenue.</p>
                                </div>
                                <div className="bg-slate-50 p-3 border border-slate-200">
                                    <div className="font-black text-slate-900 text-[10px] uppercase">Tier 2</div>
                                    <p className="text-[10px]">Moderate Movers. Strategic growth products.</p>
                                </div>
                                <div className="bg-slate-50 p-3 border border-slate-200">
                                    <div className="font-black text-slate-900 text-[10px] uppercase">Tier 3</div>
                                    <p className="text-[10px]">Long-tail / Bulk. Essential but lower turn-over.</p>
                                </div>
                            </div>
                            <h4 className="font-bold text-slate-900 pt-2 uppercase text-xs">A Full Picture per Product:</h4>
                            <p>Clicking any product opens a massive intelligence window:</p>
                            <ul className="list-disc pl-5 space-y-1 text-xs">
                                <li><strong>Images & Branding:</strong> Live synced visual assets.</li>
                                <li><strong>Financial Metrics:</strong> Revenue vs COGS vs Gross Profit per SKU.</li>
                                <li><strong>Lot Visibility:</strong> See exactly which lots are in stock, their specific COGM, and their expiration.</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'skus-ledger',
                    title: 'The Perpetual Ledger & FIFO',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system maintains a ledger of <strong>every transaction from Day One</strong>. This is not just a stock count; it's a historical record of movement.</p>
                            <div className="bg-slate-50 border border-slate-200">
                                <div className="px-4 py-2 border-b border-slate-200 font-bold bg-slate-100 text-[10px] uppercase">Ledger Functionality</div>
                                <div className="p-4 space-y-3">
                                    <div className="flex gap-3">
                                        <div className="w-1 h-auto bg-blue-500" />
                                        <p className="text-xs"><strong>Automated FIFO:</strong> The system automatically suggests and applies lot numbers based on the First-In-First-Out principle to ensure shelf freshness.</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <div className="w-1 h-auto bg-amber-500" />
                                        <p className="text-xs"><strong>Granular Auditing:</strong> Users can filter by date range, lot number, or transaction type. Crucially, the system identifies "Uncosted Transactions" where no lot or cost was applied, allowing for flawless financial auditing.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'web',
            title: 'Web Product Synergy',
            icon: <Globe className="w-4 h-4" />,
            sections: [
                {
                    id: 'web-sync',
                    title: 'Multi-Store Integration',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system is currently connected to all your existing websites, with <strong>276+ products</strong> synced in real-time.</p>
                            <div className="bg-slate-900 p-4 text-emerald-400 font-mono text-xs">
                                <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                                    <span>WEBSITE SYNC CORE</span>
                                    <span className="text-[10px] bg-emerald-900/50 px-1 uppercase">Active</span>
                                </div>
                                <div>Synced Orders: ~20,000 (Historical)</div>
                                <div className="text-amber-400">Spam Identified: 14,000 - 15,000 (Filtered)</div>
                                <div className="mt-2 text-slate-400">// Metadata Capture: Captured IP addresses, payment status, customer user agents.</div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'web-linking',
                    title: 'The "Linking" Breakthrough',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Marketing and Warehouse often use different names. The "Super Kratom" on the website is "SKU-KRT-01" in the warehouse.</p>
                            <div className="flex gap-4 items-center bg-slate-50 p-4 border border-slate-200">
                                <div className="text-center px-4">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Web Name</div>
                                    <div className="font-bold text-slate-900">Green Malay (50g)</div>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-400" />
                                <div className="bg-black text-white px-4 py-2 text-center shadow-lg">
                                    <div className="text-[10px] uppercase font-bold text-slate-500">Master SKU</div>
                                    <div className="font-bold uppercase tracking-tighter">SKU-GM-50</div>
                                </div>
                            </div>
                            <p className="text-xs">Once linked, the ERP <strong>automatically deducts inventory</strong> and applies lot numbers to all web transactions, removing the need for manual reconciliation between WooCommerce and your warehouse ledger.</p>
                        </div>
                    )
                },
                {
                    id: 'web-management',
                    title: 'Direct Dashboard Control',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The CRM allows you to manage your websites <strong>without logging into WordPress</strong>. You gain full control directly from HQ Pro:</p>
                            <ul className="grid grid-cols-2 gap-2 text-xs">
                                <li className="bg-slate-50 p-2 border border-slate-200 flex items-center gap-2 rounded-sm font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Edit Product Info</li>
                                <li className="bg-slate-50 p-2 border border-slate-200 flex items-center gap-2 rounded-sm font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Create New Products</li>
                                <li className="bg-slate-50 p-2 border border-slate-200 flex items-center gap-2 rounded-sm font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Direct Stock Injection</li>
                                <li className="bg-slate-50 p-2 border border-slate-200 flex items-center gap-2 rounded-sm font-bold"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Global Price Sync</li>
                            </ul>
                            <div className="bg-amber-50 p-3 border border-amber-200 text-xs text-amber-900 italic">
                                Switching to Shopify in the future? The system architecture makes this a simply "API swap"—no need to rebuild the entire ERP.
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'mfg',
            title: 'Automated Manufacturing',
            icon: <Wrench className="w-4 h-4" />,
            sections: [
                {
                    id: 'mfg-automation',
                    title: 'Automated Work Orders',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The manufacturing module eliminates errors by automating the bill of materials (BOM) based on pre-defined recipes.</p>
                            <div className="bg-slate-50 border border-slate-200 p-4">
                                <h4 className="font-bold text-slate-900 mb-2 uppercase text-[10px] tracking-widest">The Workflow</h4>
                                <p className="text-xs">Pick a SKU + Pick a Recipe = <strong>Instant Work Order</strong>. The system pulls the exact quantity of materials, packaging, and labels needed. It prevents over-pulling and ensures consistency across batches.</p>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'mfg-costing',
                    title: 'Deep Cost Analysis (COGM)',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Traditional systems guess your costs. HQ Pro calculates them precisely.</p>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-1">
                                    <span className="text-slate-500 uppercase">Material Cost</span>
                                    <span className="text-slate-900">Calculated via FIFO Lot Ledger</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-1">
                                    <span className="text-slate-500 uppercase">Packaging Cost</span>
                                    <span className="text-slate-900">Tracked per unit (Bottles, Labels, Seal)</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-bold border-b border-slate-100 pb-1">
                                    <span className="text-slate-500 uppercase">Labor Cost</span>
                                    <span className="text-slate-900">Tracked via LIVE HR integration</span>
                                </div>
                                <div className="flex items-center justify-between text-xs font-black bg-slate-900 text-white p-2">
                                    <span className="uppercase text-[10px]">Total Cost Per Unit</span>
                                    <span>REAL-TIME COGM</span>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'mfg-labor',
                    title: 'Live Labor Tracking',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Labor is often the "hidden cost". Our system makes it visible via a LIVE counter.</p>
                            <div className="bg-slate-50 border border-slate-200 p-4">
                                <div className="flex items-center justify-between font-bold text-slate-900 mb-3">
                                    <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-blue-600" /> Batch Counter</div>
                                    <div className="text-xs text-blue-600">01:24:12</div>
                                </div>
                                <p className="text-xs">The counter calculates labor cost based on the <strong>assigned employee's hourly rate</strong>. It includes an <strong>automatic shutoff logic</strong> based on recipe time constraints to prevent "run-away" labor costs. This data is fed back into the final COGM of the lot.</p>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'ai',
            title: 'Neural Intelligence (Grok)',
            icon: <Brain className="w-4 h-4" />,
            sections: [
                {
                    id: 'ai-neural',
                    title: 'The AI Neural Board',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>Neural Board</strong> is an AI-powered insights layer that analyzes six critical domains of your enterprise:</p>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {[
                                    { label: 'Revenue', icon: <DollarSign className="w-3 h-3" /> },
                                    { label: 'Capital Efficiency', icon: <PieChart className="w-3 h-3" /> },
                                    { label: 'Customer Pulse', icon: <Users className="w-3 h-3" /> },
                                    { label: 'Team Performance', icon: <Activity className="w-3 h-3" /> },
                                    { label: 'Stock Health', icon: <Package className="w-3 h-3" /> },
                                    { label: 'Operational Load', icon: <Zap className="w-3 h-3" /> }
                                ].map(item => (
                                    <div key={item.label} className="bg-slate-900 text-white p-2 border border-slate-800 flex items-center gap-2">
                                        <div className="bg-slate-800 p-1">{item.icon}</div>
                                        <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs italic text-slate-500 pt-2">Powered by Grok AI models. The system allows you to query the AI about your business specifically: "How many wholesale orders came in from Florida in the last 6 months?"</p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'crm',
            title: 'Client Retention Command',
            icon: <Users className="w-4 h-4" />,
            sections: [
                {
                    id: 'crm-retention',
                    title: 'Retention Command Center',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Acquiring clients is expensive; keeping them is profitable. Our <strong>Retention Center</strong> segments clients by inactivity windows:</p>
                            <div className="flex gap-2">
                                <div className="flex-1 bg-emerald-50 border border-emerald-200 p-2 text-center">
                                    <div className="text-[10px] font-bold text-emerald-800">ACTIVE</div>
                                </div>
                                <div className="flex-1 bg-amber-50 border border-amber-200 p-2 text-center">
                                    <div className="text-[10px] font-bold text-amber-800">30+ DAYS</div>
                                </div>
                                <div className="flex-1 bg-orange-50 border border-orange-200 p-2 text-center">
                                    <div className="text-[10px] font-bold text-orange-800">60+ DAYS</div>
                                </div>
                                <div className="flex-1 bg-rose-50 border border-rose-200 p-2 text-center">
                                    <div className="text-[10px] font-bold text-rose-800">90+ CRITICAL</div>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'crm-magic',
                    title: 'The Magic Button Strategy',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <div className="bg-black text-white p-4 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-1 bg-amber-500 text-black font-black text-[8px] uppercase tracking-tighter shadow-lg transform rotate-12 translate-x-2 -translate-y-1">Patented Logic</div>
                                <h5 className="font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Retention Automation</h5>
                                <p className="text-[11px] leading-relaxed text-slate-300">
                                    Feeling overwhelmed by hundreds of inactive clients? The **Magic Button** analyzes your entire database and automatically generates follow-up tasks for your sales team. 
                                </p>
                                <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-[9px] text-slate-400">
                                    <div>1. Scan 500+ Clients</div>
                                    <div>2. Filter Inactivity</div>
                                    <div>3. Create Tasks</div>
                                    <div>4. Assign Sales Reps</div>
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
            <div className="w-72 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
                <div className="p-6 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="bg-black p-2 shadow-2xl">
                            <Rocket className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-slate-900 text-sm uppercase tracking-tighter leading-none">Intelligence</h1>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">Rebel X HQ Pro</p>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                        <div className="px-2 py-0.5 bg-slate-900 text-[9px] font-black text-white uppercase tracking-widest">{VERSION}</div>
                        <div className="flex-1 h-px bg-slate-100" />
                        <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live System</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-4 px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest transition-all relative overflow-hidden group",
                                activeChapter === chapter.id 
                                    ? "bg-black text-white shadow-2xl scale-[1.02] z-10" 
                                    : "text-slate-400 hover:text-slate-900 hover:bg-white border border-transparent hover:border-slate-200"
                            )}
                        >
                            <div className={cn(
                                "p-1.5 transition-colors",
                                activeChapter === chapter.id ? "bg-slate-800" : "bg-slate-100 text-slate-400 group-hover:bg-black group-hover:text-white"
                            )}>
                                {chapter.icon}
                            </div>
                            {chapter.title}
                            {activeChapter === chapter.id && (
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-amber-500" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-6 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400">AJ</div>
                        <div>
                            <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Adeel Jabbar</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Executive Lead</div>
                        </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2 text-[9px] font-bold text-slate-500 flex items-center gap-2">
                        <Terminal className="w-3 h-3 text-slate-400" /> $ uptime: 99.98%
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                <div className="shrink-0 px-8 py-4 border-b border-slate-200 flex items-center justify-between bg-white z-10">
                    <div className="flex items-center gap-3 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
                        <Book className="w-4 h-4" />
                        <span>Corporate Intelligence</span>
                        <ChevronRight className="w-3 h-3 text-slate-200" />
                        <span className="text-black font-black">{activeChapterData?.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-4 py-1.5 border border-slate-200 text-[9px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95">
                            <FileText className="w-3.5 h-3.5" /> Briefing Export
                        </button>
                        <div className="h-4 w-px bg-slate-200 mx-2" />
                        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                            Sync Status: <span className="text-emerald-600">Encrypted</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto scroll-smooth">
                    <div className="max-w-4xl mx-auto px-12 py-12">
                        <div className="mb-16">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-0.5 w-12 bg-black" />
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Section briefing</span>
                            </div>
                            <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">{activeChapterData?.title}</h2>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl font-medium italic">
                                This chapter details the operational logic, technical architecture, and business vision for the {activeChapterData?.title} component of the Rebel X Headquarters ERP.
                            </p>
                        </div>
                        
                        <div className="space-y-6">
                            {activeChapterData?.sections.map(section => (
                                <div key={section.id} id={section.id} className="group">
                                    <div className="bg-white border boundary-none shadow-[0_0_1px_rgba(0,0,0,0.1),0_4px_24px_rgba(0,0,0,0.02)] transition-all group-hover:shadow-[0_4px_32px_rgba(0,0,0,0.06)] overflow-hidden">
                                        <button
                                            onClick={() => toggleSection(section.id)}
                                            className="w-full flex items-center justify-between px-8 py-6 text-left"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-1 h-6 transition-all",
                                                    expandedSections.includes(section.id) ? "bg-black" : "bg-slate-100 group-hover:bg-slate-300"
                                                )} />
                                                <span className="font-black text-slate-900 text-sm uppercase tracking-widest">{section.title}</span>
                                            </div>
                                            {expandedSections.includes(section.id) 
                                                ? <ChevronDown className="w-5 h-5 text-black" /> 
                                                : <ChevronRight className="w-5 h-5 text-slate-300" />
                                            }
                                        </button>
                                        <div className={cn(
                                            "transition-all duration-500 ease-in-out px-8",
                                            expandedSections.includes(section.id) ? "max-h-[5000px] opacity-100 pb-10" : "max-h-0 opacity-0 overflow-hidden"
                                        )}>
                                            <div className="border-t border-slate-50 pt-8">
                                                {section.content}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-24 pt-10 border-t border-slate-100 flex flex-col items-center gap-6">
                            <div className="bg-black text-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.5em] shadow-2xl">
                                REBEL X HQ PRO
                            </div>
                            <div className="flex items-center gap-4 text-[9px] text-slate-400 uppercase font-bold tracking-widest">
                                <span>INTERNAL CLASSIFIED DOCUMENT</span>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <span>DEC 30, 2025</span>
                                <div className="w-1 h-1 rounded-full bg-slate-300" />
                                <span>VERSION 0.21 BETA</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
