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
    TrendingUp, Rocket, Landmark, GitBranch, Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const VERSION = "V.b0.21";

export default function KnowledgeBasePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeChapter, setActiveChapter] = useState<string>('strategy');
    
    // Initialize ALL sections as expanded for maximum visibility as requested
    const [expandedSections, setExpandedSections] = useState<string[]>([
        'strategy-vision', 'strategy-appsheet', 'strategy-roi',
        'dashboard-health', 'dashboard-neural',
        'warehouse-skus', 'warehouse-ledger', 'warehouse-automated-manufacturing',
        'omnichannel-woocommerce', 'omnichannel-linking', 'omnichannel-interoperability',
        'orders-management', 'orders-spam',
        'crm-retention', 'crm-magic-button',
        'financials-operating-costs', 'financials-integration-plan',
        'tech-stack', 'tech-models'
    ]);

    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent animate-spin" />
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Initializing Intelligence Base...</p>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-white p-8 text-center">
                <div className="bg-rose-50 p-6 border border-rose-100 mb-6">
                    <Lock className="w-12 h-12 text-rose-500 mb-4 mx-auto" />
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Access Denied</h1>
                    <p className="text-slate-500 text-sm max-w-md mt-2">
                        You are attempting to access classified ERP documentation. 
                        Only accounts with **Administrator** level clearance can view the Knowledge Base.
                    </p>
                </div>
                <button 
                    onClick={() => router.push('/')} 
                    className="px-8 py-3 bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all border border-slate-900"
                >
                    Return to Mission Control
                </button>
            </div>
        );
    }

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => 
            prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
        );
    };

    const chapters = [
        {
            id: 'strategy',
            title: 'Strategic Vision & Roadmap',
            icon: <Rocket className="w-4 h-4" />,
            sections: [
                {
                    id: 'strategy-vision',
                    title: 'The Vision: Rebel X Headquarter Pro',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <div className="flex items-start gap-4 bg-slate-900 p-6 border-l-4 border-amber-500 shadow-2xl">
                                <div className="p-3 bg-amber-500/10 rounded-full border border-amber-500/20">
                                    <Brain className="w-6 h-6 text-amber-500" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-white font-black uppercase tracking-widest text-sm mb-2">The "100 Manager" Analogy</h4>
                                    <p className="text-slate-400 text-xs italic">
                                        "Rebel X Headquarter Pro is not merely software; it is a digital workforce. Operating this ERP is equivalent to hiring 100 experienced managers at a directorial level, all focusing on different aspects of your business simultaneously—from inventory auditing to client retention—without the overhead of human management."
                                    </p>
                                </div>
                            </div>
                            <p>
                                Traditionally, businesses struggle with fragmented data. Sales are in one place, manufacturing in another, and client relationships in a third. 
                                **Rebel X Headquarter Pro** acts as the unified central nervous system, ensuring every department communicates in real-time.
                            </p>
                        </div>
                    )
                },
                {
                    id: 'strategy-appsheet',
                    title: 'Transitioning from AppSheet: Why Custom?',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Kemal Whyte's core concern focused on **scalability and maintenance costs** of no-code platforms like AppSheet. Our migration to a custom-coded Next.js enterprise solution addresses these specifically:</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="border border-slate-200 p-4 bg-white">
                                    <div className="flex items-center gap-2 font-black text-slate-900 text-xs uppercase mb-2">
                                        <ZapOff className="w-4 h-4 text-rose-500" /> AppSheet Bottlenecks
                                    </div>
                                    <ul className="text-[11px] space-y-1 text-slate-500 list-disc pl-4">
                                        <li>Limited performance with large datasets (20k+ orders)</li>
                                        <li>High per-user monthly licensing fees</li>
                                        <li>Restrictive UI/UX customization capabilities</li>
                                        <li>Disconnected from live website APIs</li>
                                    </ul>
                                </div>
                                <div className="border border-slate-200 p-4 bg-slate-50">
                                    <div className="flex items-center gap-2 font-black text-slate-900 text-xs uppercase mb-2">
                                        <Zap className="w-4 h-4 text-emerald-500" /> RX-HQ Pro Advantages
                                    </div>
                                    <ul className="text-[11px] space-y-1 text-slate-700 list-disc pl-4 font-medium">
                                        <li>Infinite scalability with MongoDB Atlas</li>
                                        <li>Zero licensing fees (Operating on bare-metal cloud)</li>
                                        <li>Complete branding and layout sovereignty</li>
                                        <li>Direct, real-time integration with WordPress/Shopify</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'intelligence',
            title: 'Neural Dashboard & Business Health',
            icon: <Cpu className="w-4 h-4" />,
            sections: [
                {
                    id: 'dashboard-health',
                    title: 'Business Health Matrix',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The dashboard provides a **Business Health Score** (currently calculated at 60% in the beta stage). This isn't just a number—it's an aggregation of 6 critical intelligence vectors powered by **Grok AI models (xAI)**:</p>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {[
                                    { title: 'Revenue', icon: <DollarSign />, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
                                    { title: 'Capital Efficiency', icon: <Landmark />, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                                    { title: 'Customer Pulse', icon: <Users />, color: 'bg-purple-50 border-purple-200 text-purple-700' },
                                    { title: 'Team Performance', icon: <Activity />, color: 'bg-amber-50 border-amber-200 text-amber-700' },
                                    { title: 'Stock Health', icon: <Package />, color: 'bg-orange-50 border-orange-200 text-orange-700' },
                                    { title: 'Operational Load', icon: <Search />, color: 'bg-slate-50 border-slate-200 text-slate-700' }
                                ].map(v => (
                                    <div key={v.title} className={cn("p-3 border flex flex-col items-center gap-1 text-center font-black uppercase text-[10px] tracking-widest", v.color)}>
                                        <div className="mb-1 opacity-50">{React.cloneElement(v.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}</div>
                                        {v.title}
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs italic pt-2 border-t border-slate-100">
                                **Dynamic Querying:** Users can query the AI (Grok) directly via the dashboard chat. The AI is fed live data context, allowing it to answer complex questions like "Which of our Tier 1 products is losing margin due to labor inefficiency?"
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'warehouse',
            title: 'Advanced Warehouse & Manufacturing',
            icon: <Package className="w-4 h-4" />,
            sections: [
                {
                    id: 'warehouse-skus',
                    title: 'Tiered SKU Management & Financials',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The SKUs system is designed to provide a "full picture" of every product's journey from ingredient to profit.</p>
                            <div className="space-y-3">
                                <div className="p-4 border border-slate-200 bg-white">
                                    <h5 className="font-black text-slate-900 text-xs uppercase mb-2">Tier Classification System</h5>
                                    <p className="text-xs text-slate-500">
                                        Products are automatically categorized into **Tiers 1, 2, and 3**. This allows managers to prioritize stock availability for high-revenue drivers while thinning out slow-moving assets.
                                    </p>
                                </div>
                                <div className="p-4 border border-slate-200 bg-slate-50">
                                    <h5 className="font-black text-slate-900 text-xs uppercase mb-2">Available Lots & COGS</h5>
                                    <p className="text-xs text-slate-700">
                                        Clicking into any SKU reveals its **Lot Inventory**. Every lot is timestamped with its specific **Cost of Goods Manufactured (COGM)**. When sales happen, the system matches the lot's COGM against the sale price to provide a real-time **Gross Profit** analysis for that specific batch.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'warehouse-ledger',
                    title: 'Inventory Ledger & FIFO Auditing',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The Ledger is a comprehensive immutable record of every transaction since **Day One**.</p>
                            <ul className="list-disc pl-5 space-y-2 font-medium">
                                <li><strong>FIFO Automation:</strong> The system automatically suggests lot numbers based on the First-In-First-Out principle, ensuring stock never expires.</li>
                                <li><strong>Manual Overrides:</strong> While automated, managers can override lot selections for specific wholesale orders or samples.</li>
                                <li><strong>Auditing Flags:</strong> A specialized filter identifies "Incomplete Transactions"—those missing lot numbers or cost data—allowing the team to fix errors before month-end financial reporting.</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'warehouse-automated-manufacturing',
                    title: 'Automated Manufacturing & Labor Shutoff',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The manufacturing module converts raw recipes into finished lots with microscopic precision.</p>
                            <div className="bg-slate-900 p-6 text-slate-300">
                                <div className="flex items-center gap-3 mb-4">
                                    <Shield className="w-5 h-5 text-amber-500" />
                                    <h5 className="text-white font-black uppercase text-xs tracking-widest">Recipe-Constraint Labor Tracking</h5>
                                </div>
                                <p className="text-xs leading-relaxed opacity-80 mb-4">
                                    Unlike traditional ERPs where labor is an estimate, we use a **live labor counter**. 
                                    When a manufacturing session begins, the system starts a timer.
                                </p>
                                <div className="p-3 bg-white/5 border border-white/10 rounded-sm">
                                    <div className="flex justify-between items-center text-[10px] font-bold mb-1 uppercase tracking-tighter">
                                        <span>Labor Counter Logic</span>
                                        <span className="text-amber-500">RX-CONTROL-01</span>
                                    </div>
                                    <p className="text-[10px] font-mono">IF (CurrentTime &gt; RecipeConstraintTime) THEN Trigger(Automatic_Shutoff)</p>
                                    <p className="text-[10px] font-mono mt-1 italic">// Prevents labor cost bloating by capping time based on production standards.</p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'omnichannel',
            title: 'Omnichannel Integration (E-Commerce)',
            icon: <Globe className="w-4 h-4" />,
            sections: [
                {
                    id: 'omnichannel-woocommerce',
                    title: 'Live Website Control Center',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The CRM is bi-directionally linked to all existing websites (KINGKKRATOM, GRASSROOTSHARVEST, etc.), acting as a master control panel for **276+ synced products**.</p>
                            <div className="bg-emerald-50 border border-emerald-100 p-4">
                                <h5 className="font-bold text-emerald-900 text-xs mb-1 uppercase tracking-widest flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> NO WP-ADMIN REQUIRED
                                </h5>
                                <p className="text-xs text-emerald-800">
                                    You can update inventory, change prices, edit descriptions, or even delete products across all 4 websites directly from the ERP. The system pushes these changes instantly via REST APIs.
                                </p>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'omnichannel-linking',
                    title: 'SKU Linking & Harmonization',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>E-commerce stores often use different names than the warehouse (e.g., "Red Maeng Da 500g" vs "RMD-PKG-500").</p>
                            <p><strong>The Linking System:</strong> Allows simple one-click linking of a web product to an internal SKU. Once linked, the ERP takes over. It watches for incoming web orders, identifies the linked SKU, checks the available lots, and automatically deducts the inventory—all in the background.</p>
                        </div>
                    )
                },
                {
                    id: 'omnichannel-interoperability',
                    title: 'Interoperability: Shopify & External Tools',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Kemal asked about compatibility if switching to **Shopify**. Because our system is built on an open API architecture, switching to Shopify or BigCommerce is considered a **"microscopic task"** for the development team.</p>
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="p-3 border border-slate-200">
                                    <div className="font-black text-slate-900 text-[10px] uppercase">ShipStation</div>
                                    <p className="text-[10px] text-slate-500">Planned integration will allow managing order fulfillment and shipping labels directly from this ERP.</p>
                                </div>
                                <div className="p-3 border border-slate-200">
                                    <div className="font-black text-slate-900 text-[10px] uppercase">Communication</div>
                                    <p className="text-[10px] text-slate-500">Direct integration with Google Voice and WhatsApp for client communication history.</p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'orders',
            title: 'Global Order Management (20k+ Records)',
            icon: <ShoppingCart className="w-4 h-4" />,
            sections: [
                {
                    id: 'orders-management',
                    title: 'Unified Order Hub',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system has ingested **nearly 20,000 web orders** dating back to system inception. This allows for unmatched historical data analysis.</p>
                            <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-xs">
                                <div>
                                    <h6 className="font-black text-slate-900 uppercase text-[9px]">Financial Metadata</h6>
                                    <p className="text-slate-500 leading-snug">Every order tracks IP addresses, payment status, tax classes, and method of fulfillment.</p>
                                </div>
                                <div>
                                    <h6 className="font-black text-slate-900 uppercase text-[9px]">Customer Intelligence</h6>
                                    <p className="text-slate-500 leading-snug">Orders are automatically indexed to client profiles, building a lifetime value (LTV) profile for every customer.</p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'orders-spam',
                    title: 'Spam Intelligence',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed bg-amber-50 p-6 border border-amber-200">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                <h5 className="font-black text-amber-900 text-xs uppercase tracking-widest">The "Spam Core" Reality</h5>
                            </div>
                            <p className="text-xs text-amber-800 leading-relaxed font-medium">
                                Out of the 20,000 ingested orders, approximately **14,000 - 15,000 have been identified as spam** based on historical patterns and transaction validity. 
                                Our system maintains these records in a specialized index to ensure they do not bloat your actual revenue reports or AI insights, but keeps the data for IP-blacklist and fraud prevention logic.
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'crm',
            title: 'CRM Retention & Client Growth',
            icon: <Users className="w-4 h-4" />,
            sections: [
                {
                    id: 'crm-retention',
                    title: 'The Retention Command Center',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Client retention is the key to retail scalability. The **Retention Command Center** monitors the engagement pulse of every client.</p>
                            <div className="flex gap-4">
                                <div className="flex-1 bg-white border border-slate-200 p-4">
                                    <div className="text-rose-500 font-black text-xs uppercase mb-2">Critical Risk</div>
                                    <p className="text-[11px] text-slate-500">Clients not touched or haven't ordered in 90+ days are automatically flagged and prioritized at the top of the sales queue.</p>
                                </div>
                                <div className="flex-1 bg-white border border-slate-200 p-4">
                                    <div className="text-amber-500 font-black text-xs uppercase mb-2">At Risk</div>
                                    <p className="text-[11px] text-slate-500">Clients in the 30-60 day range are identified for "soft touch" check-ins via follow-up emails.</p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'crm-magic-button',
                    title: 'The "Magic Button" Automation',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <div className="bg-slate-900 p-6 shadow-2xl">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                                        <Zap className="w-4 h-4 text-white" />
                                    </div>
                                    <h5 className="text-white font-black uppercase text-xs tracking-widest">ONE-CLICK TASK GENERATION</h5>
                                </div>
                                <p className="text-slate-400 text-xs leading-relaxed mb-4">
                                    Managing hundreds of inactive clients manually is impossible. The **Magic Button** automates this by analyzing inactivity data and instantly generating formatted tasks for your sales reps.
                                </p>
                                <div className="p-3 bg-white/5 border border-white/10 text-[10px] font-mono text-emerald-400">
                                    &gt; Analyzing 4,500 client profiles...<br/>
                                    &gt; Identifying 242 Critical Risk Clients...<br/>
                                    &gt; Generating 242 Priority-High Follow-up Call tasks...<br/>
                                    &gt; Assigning tasks to Sales Team based on current load...<br/>
                                    &gt; SUCCESS: Task Matrix Generation Complete.
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'financials',
            title: 'System Economics & Integration Plan',
            icon: <Landmark className="w-4 h-4" />,
            sections: [
                {
                    id: 'financials-operating-costs',
                    title: 'Maintenance & Operating Cost Breakdown',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Kemal Whyte requested a clear breakdown of the cost to run this "Directorial Level" digital asset. In the Beta phase, the cost is minimal:</p>
                            <div className="border border-slate-200 overflow-hidden">
                                <table className="w-full text-left text-[11px]">
                                    <thead className="bg-slate-50 border-b border-slate-200 h-10">
                                        <tr>
                                            <th className="px-4 font-black uppercase tracking-widest text-slate-400">Component</th>
                                            <th className="px-4 font-black uppercase tracking-widest text-slate-400">Cost (Monthly)</th>
                                            <th className="px-4 font-black uppercase tracking-widest text-slate-400">Provider</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        <tr>
                                            <td className="px-4 py-3 font-bold text-slate-900">Vercel Production Tier</td>
                                            <td className="px-4 py-3">$40.00</td>
                                            <td className="px-4 py-3">Vercel Inc.</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-bold text-slate-900">MongoDB Atlas (M10 Cluster)</td>
                                            <td className="px-4 py-3">$60.00</td>
                                            <td className="px-4 py-3">MongoDB</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-bold text-slate-900">Grok AI & OpenAI API Usage</td>
                                            <td className="px-4 py-3">$80.00 (avg)</td>
                                            <td className="px-4 py-3">xAI / OpenAI</td>
                                        </tr>
                                        <tr className="bg-slate-900 text-white">
                                            <td className="px-4 py-3 font-black uppercase italic">TOTAL MONTHLY OPERATING</td>
                                            <td className="px-4 py-3 font-black underline underline-offset-4 text-amber-500">$180.00 - $200.00</td>
                                            <td className="px-4 py-3 font-black">---</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[10px] italic text-slate-400">
                                **Note:** Compare this $200/month against the equivalent cost of hiring even ONE junior manager ($4,000+/month). The ROI is calculated at &gt;20x.
                            </p>
                        </div>
                    )
                },
                {
                    id: 'financials-integration-plan',
                    title: 'Detailed Integration Plan (TIMELINE)',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <h5 className="font-black text-slate-900 text-xs uppercase mb-2">Phase 1: Database Harmonization (COMPLETE)</h5>
                            <p className="text-xs">Ingesting 20k orders, SKU setup, and initial WooCommerce sync.</p>
                            
                            <h5 className="font-black text-slate-900 text-xs uppercase mb-2">Phase 2: Operational Beta (CURRENT)</h5>
                            <p className="text-xs">Live labor tracking, manufacturing work orders, and FIFO ledger auditing.</p>
                            
                            <h5 className="font-black text-slate-900 text-xs uppercase mb-2 flex items-center gap-2">
                                Phase 3: External Communication Sync (NEXT STEP)
                            </h5>
                            <ul className="text-xs list-disc pl-5">
                                <li>WhatsApp & Google Voice integration (Est. 1 week)</li>
                                <li>ShipStation API handshake (Est. 2 weeks)</li>
                                <li>Shopify Bridge (Available on demand)</li>
                            </ul>
                        </div>
                    )
                }
            ]
        }
    ];

    const activeChapterData = chapters.find(c => c.id === activeChapter);

    return (
        <div className="flex h-[calc(100vh-48px)] bg-white overflow-hidden font-sans">
            {/* Sidebar with High-End Aesthetic */}
            <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0 relative">
                <div className="p-8 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="bg-slate-900 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.1)]">
                            <Book className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-slate-900 text-lg uppercase tracking-tighter leading-none">Intelligence</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Knowledge Repository</p>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-sm">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em]">Live Beta v0.21</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-4 px-5 py-4 text-left transition-all duration-300 relative group overflow-hidden",
                                activeChapter === chapter.id 
                                    ? "bg-slate-900 text-white shadow-xl translate-x-1" 
                                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-900"
                            )}
                        >
                            {activeChapter === chapter.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />
                            )}
                            <div className={cn(
                                "p-2 rounded-sm transition-colors",
                                activeChapter === chapter.id ? "bg-white/10" : "bg-slate-100 group-hover:bg-white"
                            )}>
                                {chapter.icon}
                            </div>
                            <span className="font-black text-[11px] uppercase tracking-widest">{chapter.title}</span>
                            <ChevronRight className={cn(
                                "w-4 h-4 ml-auto transition-transform",
                                activeChapter === chapter.id ? "rotate-90 opacity-100" : "opacity-30 group-hover:translate-x-1"
                            )} />
                        </button>
                    ))}
                </div>

                <div className="p-6 border-t border-slate-200 bg-slate-100 flex flex-col gap-3">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        <span>Cluster Status</span>
                        <span className="text-emerald-500">OPTIMAL</span>
                    </div>
                    <div className="space-y-1">
                        <div className="h-1 bg-slate-200 w-full rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900 w-[94%]" />
                        </div>
                        <div className="flex justify-between text-[9px] font-mono text-slate-500 uppercase">
                            <span>Integrity check</span>
                            <span>94%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-slate-50/50">
                <div className="shrink-0 h-16 px-10 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-slate-900 rotate-45" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Section Archive</span>
                        <ChevronRight className="w-3 h-3 text-slate-300" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">{activeChapterData?.title}</span>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 group cursor-pointer">
                            <Share2 className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
                            <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-slate-900 tracking-widest">Share Arch.</span>
                        </div>
                        <div className="h-4 w-px bg-slate-200" />
                        <div className="text-[10px] font-mono text-slate-400">AUTH: {session?.user?.email}</div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="max-w-5xl mx-auto px-10 py-16 space-y-16">
                        {/* Chapter Hero */}
                        <div className="space-y-6">
                            <div className="inline-block px-4 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.4em]">
                                Deep Dive Module
                            </div>
                            <h2 className="text-6xl font-black text-slate-900 uppercase tracking-tighter leading-none pr-20">
                                {activeChapterData?.title}
                            </h2>
                            <p className="text-xl text-slate-400 font-light max-w-2xl leading-relaxed">
                                Detailed technical specifications, business logic, and operational documentation for the Rebel X ERP Ecosystem.
                            </p>
                        </div>

                        {/* Sections List */}
                        <div className="space-y-8 pb-32">
                            {activeChapterData?.sections.map((section, index) => (
                                <div key={section.id} id={section.id} className="group scroll-mt-24">
                                    <div className="flex items-start gap-8">
                                        <div className="pt-2">
                                            <div className="text-3xl font-black text-slate-200 group-hover:text-slate-900 transition-colors duration-500 font-mono">
                                                0{index + 1}
                                            </div>
                                        </div>
                                        <div className="flex-1 border-t-2 border-slate-900 pt-8 transition-all duration-500">
                                            <button 
                                                onClick={() => toggleSection(section.id)}
                                                className="w-full text-left flex items-center justify-between mb-8 group"
                                            >
                                                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter group-hover:translate-x-2 transition-transform duration-300">
                                                    {section.title}
                                                </h3>
                                                <div className={cn(
                                                    "p-2 border-2 border-slate-900 transition-transform duration-500",
                                                    expandedSections.includes(section.id) ? "rotate-180 bg-slate-900 text-white" : ""
                                                )}>
                                                    <ChevronDown className="w-5 h-5" />
                                                </div>
                                            </button>
                                            
                                            {expandedSections.includes(section.id) && (
                                                <div className="animate-in fade-in slide-in-from-top-4 duration-700 fill-mode-both">
                                                    <div className="text-slate-600">
                                                        {section.content}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
