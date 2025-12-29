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
    ArrowUpRight, List, Factory, TrendingUp
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
    
    // OPEN BY DEFAULT: All sections initialized in the state
    const [expandedSections, setExpandedSections] = useState<string[]>([
        'vision-strategy', 'vision-cost',
        'warehouse-skus', 'warehouse-ledger', 'warehouse-manufacturing',
        'sales-weborders', 'sales-sync',
        'crm-retention', 'crm-clients',
        'neural-board', 'neural-query',
        'scalability-future', 'scalability-integrations',
        'technical-infra'
    ]);

    // Admin role check
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-white">
                <div className="animate-pulse text-slate-400 text-sm">Initializing Secure Environment...</div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-white">
                <Lock className="w-16 h-16 text-slate-200 mb-4" />
                <h1 className="text-xl font-bold text-slate-400 uppercase tracking-tighter">Restricted Access</h1>
                <p className="text-sm text-slate-400 mt-2">Executive Clearance Required.</p>
                <button onClick={() => router.push('/')} className="mt-6 px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase transition-transform active:scale-95">
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
            id: 'vision',
            title: 'Vision & Cost Analysis',
            icon: <ShieldCheck className="w-4 h-4" />,
            sections: [
                {
                    id: 'vision-strategy',
                    title: 'The "Rebel X Headquarter Pro" Initiative',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed font-sans">
                            <p className="text-base font-medium text-slate-800">Operational Sovereignty & Scalability</p>
                            <p>This system represents a strategic pivot from third-party reliance (AppSheet) to a custom-engineered Enterprise Resource Planning (ERP) platform. It is designed to be an <strong>automated managerial layer</strong>, effectively equivalent to hiring 100 experienced managers to oversee operations 24/7.</p>
                            
                            <div className="grid grid-cols-2 gap-4 my-4">
                                <div className="bg-slate-50 p-4 border border-slate-200">
                                    <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 flex items-center gap-2">
                                        <TrendingUp className="w-3 h-3 text-emerald-600" />
                                        Addressing Scalability
                                    </h4>
                                    <p className="text-xs">Unlike AppSheet, which charges per user/seat and limits row capacity, this system is built on <strong>Serverless Architecture</strong> (Next.js/Vercel) + MongoDB. It scales infinitely with zero per-user licensing fees.</p>
                                </div>
                                <div className="bg-slate-50 p-4 border border-slate-200">
                                    <h4 className="font-bold text-slate-900 text-xs uppercase mb-2 flex items-center gap-2">
                                        <Database className="w-3 h-3 text-blue-600" />
                                        Data Ownership
                                    </h4>
                                    <p className="text-xs">All intelligence—Client data, recipe IP, and financial ledgers—resides in a sovereign database owned entirely by Rebel X, not locked within a proprietary "no-code" ecosystem.</p>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'vision-cost',
                    title: 'Operational Cost Breakdown',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system is engineered for maximum "Financial Efficiency" (one of the 6 Neural Board metrics).</p>
                            
                            <div className="bg-slate-900 text-slate-300 p-4 font-mono text-xs mb-4">
                                <div className="flex justify-between border-b border-slate-700 pb-2 mb-2 uppercase text-[10px] font-bold tracking-widest text-emerald-400">
                                    <span>Monthly Run Rate</span>
                                    <span>~$200.00 / Mo</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span>Infrastructure (Vercel Pro + Bandwidth)</span>
                                        <span>$40.00</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Database Cluster (MongoDB Atlas M10)</span>
                                        <span>$60.00</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>AI Intelligence (Grok/OpenAI API)</span>
                                        <span>~$80.00</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Storage (Cloudinary/S3)</span>
                                        <span>$20.00</span>
                                    </div>
                                </div>
                            </div>
                            <p className="italic text-xs text-slate-500 border-l-2 border-slate-300 pl-3">
                                "The cost of running this beta system, including the AI neural engines, is minimal compared to the managerial labor it replaces." — Adeel Dev
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'warehouse',
            title: 'Inventory & Manufacturing',
            icon: <Factory className="w-4 h-4" />,
            sections: [
                {
                    id: 'warehouse-skus',
                    title: 'SKU Logic & Tiered Classification',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The SKU module is the "Source of Truth" for all physical assets. It goes beyond simple counting by integrating financial performance metrics directly into the product view.</p>
                            
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Tiered Classification:</strong> Products are automatically categorized into <strong>Tier 1, 2, or 3</strong> based on sales velocity and revenue contribution. This allows the warehouse team to prioritize restocking efforts on high-value items.</li>
                                <li><strong>Full Financial Picture:</strong> Clicking a SKU reveals Gross Profit, COGS (Cost of Goods Sold), and COGM (Cost of Goods Manufactured) for that specific item across its lifetime.</li>
                                <li><strong>Available Lots:</strong> Granular view of specific batches (Lots) currently sitting on the shelf, including their individual expiration dates and specific manufacturing costs.</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'warehouse-ledger',
                    title: 'FIFO Ledger System',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>We implement a strict <strong>First-In-First-Out (FIFO)</strong> system to ensure inventory freshness and accurate cost accounting.</p>
                            <div className="p-3 bg-amber-50 border border-amber-200">
                                <h5 className="font-bold text-amber-900 text-xs uppercase mb-1">How it works:</h5>
                                <p className="text-xs text-amber-800">The system automatically suggests the oldest available Lot Number for outbound orders. While this can be manually overridden, the system defaults to FIFO to prevent spoilage.</p>
                            </div>
                            <p className="mt-2"><strong>The Audit Trail:</strong> Every single transaction (Sale, Adjustment, Manufacturing Output) is recorded in the Ledger. You can filter by:</p>
                            <ul className="list-disc pl-5 text-xs font-bold text-slate-800 grid grid-cols-2 gap-2">
                                <li>Date Range</li>
                                <li>Specific Lot Number</li>
                                <li>Transaction Type</li>
                                <li className="text-rose-600">"No Lot/Cost Assigned" (Audit Risk)</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'warehouse-manufacturing',
                    title: 'Automated Manufacturing & COGM',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Manufacturing is the heart of the Cost Analysis engine. It generates <strong>Work Orders</strong> based on pre-defined Recipes.</p>
                            
                            <div className="border border-slate-200 p-4 bg-slate-50">
                                <div className="flex items-center gap-3 mb-4">
                                    <Clock className="w-5 h-5 text-blue-600" />
                                    <h4 className="font-bold text-slate-900 uppercase">The Live Labor Counter</h4>
                                </div>
                                <p className="text-xs mb-3">Employees clock into a specific Work Order. The system tracks their time and multiplies it by their stored <strong>Hourly Rate</strong> to calculate exact Labor Cost.</p>
                                <div className="bg-white border border-slate-200 p-2 text-[10px] font-mono text-slate-500">
                                    [FEATURE] Automatic Shutoff: The system monitors the "Recipe Time Constraint". If a task exceeds the standard time, the counter can auto-stop or flag for review.
                                </div>
                            </div>
                            
                            <p className="font-bold text-slate-900 mt-2">Cost Per Unit Calculation:</p>
                            <p>At the end of a run, the system summons the "Manufacturing Formula":</p>
                            <code className="block bg-slate-900 text-slate-100 p-2 text-xs my-2">
                                (Raw Materials + Packaging + (Time * Hourly Rate)) / Units Produced = COGM
                            </code>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'sales',
            title: 'Web Orders & Integration',
            icon: <Globe className="w-4 h-4" />,
            sections: [
                {
                    id: 'sales-weborders',
                    title: '20,000+ Orders & Spam Filtration',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system ingests data from <strong>KINGKKRATOM, GRASSROOTSHARVEST, GRH-KRATOM, and REBELXBRANDS</strong>. On Day 1, it fetches nearly 20,000 historical web orders.</p>
                            
                            <div className="flex items-start gap-3 p-3 bg-slate-50 border-l-4 border-slate-400">
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                                <div>
                                    <h5 className="font-bold text-slate-900 text-xs uppercase">Spam Countermeasures</h5>
                                    <p className="text-xs mt-1">
                                        As noted by Kemal, approx. 14,000-15,000 of these historical orders are spam. The ERP's ingestion engine applies filters to segregate these from valid financial data, ensuring your "Gross Profit" metrics aren't skewed by fake orders.
                                    </p>
                                </div>
                            </div>

                            <p className="mt-2"><strong>Metadata Harvesting:</strong> For every order, we capture:</p>
                            <ul className="grid grid-cols-2 gap-2 text-xs">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> IP Address (Risk Analysis)</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Payment Status</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Shipping Metadata</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-emerald-500"/> Customer User Agent</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'sales-sync',
                    title: 'Web Product Linking (The Bridge)',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p><strong>Problem:</strong> Marketing names on websites ("Super Kratom 500g") rarely match internal inventory names ("K-Powder-500").</p>
                            <p><strong>Solution:</strong> The "Web Product Linking" interface. You link a Web Product to an Internal SKU <em>once</em>. From that point forward:</p>
                            
                            <ol className="list-decimal pl-5 space-y-2 font-bold text-slate-800 text-xs">
                                <li>Customer buys "Super Kratom" on WordPress.</li>
                                <li>ERP receives order via API.</li>
                                <li>ERP identifies the link to "K-Powder-500".</li>
                                <li>ERP automatically deducts from the correct Lot Number.</li>
                                <li>No human intervention required.</li>
                            </ol>
                            
                            <p className="text-xs text-slate-500 mt-2">Currently, <strong>276 Products</strong> are fully synced and linked across the ecosystem (00:12:20).</p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'neural',
            title: 'Neural Board (AI Engine)',
            icon: <Brain className="w-4 h-4" />,
            sections: [
                {
                    id: 'neural-board',
                    title: '6-Dimensional Business Intelligence',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Powered by <strong>Grok AI</strong>, the Neural Board doesn't just display charts; it "thinks" about your business in 6 specific dimensions:</p>
                            
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {[
                                    { t: "Revenue", d: "Sales velocity & growth" },
                                    { t: "Capital Efficiency", d: "Cash flow & roi" },
                                    { t: "Customer Pulse", d: "Retention & sat" },
                                    { t: "Team Performance", d: "Output vs cost" },
                                    { t: "Stock Health", d: "Risk of stockout" },
                                    { t: "Operational Load", d: "Mfg bottlenecks" },
                                ].map(i => (
                                    <div key={i.t} className="bg-slate-50 border border-slate-200 p-2">
                                        <div className="font-bold text-slate-900 text-[10px] uppercase">{i.t}</div>
                                        <div className="text-[10px] text-slate-500 truncate">{i.d}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'crm',
            title: 'CRM & Retention Command',
            icon: <Users className="w-4 h-4" />,
            sections: [
                {
                    id: 'crm-retention',
                    title: 'The Magic Button (Auto-Task Gen)',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The Retention Command Center categorizes clients by inactivity: <strong>Active, 30 Days (Warm), 60 Days (Risk), 90+ Days (Critical)</strong>.</p>
                            
                            <div className="p-4 bg-emerald-50 border border-emerald-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-1 bg-white border-l border-b border-emerald-100 rounded-bl">
                                    <Zap className="w-3 h-3 text-emerald-500" />
                                </div>
                                <h4 className="font-bold text-emerald-900 text-xs uppercase mb-2">The "Magic Button"</h4>
                                <p className="text-xs text-emerald-800">
                                   Clicking this button triggers a sweeping algorithm that analyzes the "Last Touch Point" for every client. It creates <strong>hundreds of prioritized tasks</strong> instantly for your sales team.
                                </p>
                                <p className="text-[10px] text-emerald-700 mt-2 font-mono">
                                    Example: Client X hasn't ordered in 64 days &rarr; Creates "High Priority Win-Back Call" task assigned to their Rep.
                                </p>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'scalability',
            title: 'Future Scalability',
            icon: <ArrowUpRight className="w-4 h-4" />,
            sections: [
                {
                    id: 'scalability-integrations',
                    title: 'Shopify & Beyond',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p><strong>The Shopify Question:</strong> Kemal asked about switching platforms. Because this ERP decouples the "Logic" from the "Storefront", switching to Shopify is a minor infrastructure change. We simply point the "Order Ingestion API" to Shopify instead of WooCommerce.</p>
                            
                            <h4 className="font-bold text-slate-900 text-xs uppercase mt-4 mb-2">Microscopic Tasks</h4>
                            <p>Adeel Dev categorized the following as "microscopic tasks" to implement:</p>
                            <div className="flex flex-wrap gap-2">
                                <span className="bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] uppercase font-bold text-slate-600">Google Voice Integration</span>
                                <span className="bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] uppercase font-bold text-slate-600">WhatsApp Messaging</span>
                                <span className="bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] uppercase font-bold text-slate-600">ShipStation Sync</span>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'technical',
            title: 'Technical Stack',
            icon: <Terminal className="w-4 h-4" />,
            sections: [
                {
                    id: 'technical-infra',
                    title: 'Infrastructure Verification',
                    content: (
                        <div className="font-mono text-[10px] bg-slate-900 text-slate-400 p-4 space-y-2">
                            <div className="flex justify-between border-b border-slate-800 pb-1">
                                <span>BUILD.TARGET</span>
                                <span className="text-slate-200">Production / Vercel Edge</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1">
                                <span>DB.ENGINE</span>
                                <span className="text-slate-200">MongoDB Atlas (Multi-Region)</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-800 pb-1">
                                <span>API.WOOCOMMERCE</span>
                                <span className="text-slate-200">REST v3 / Webhooks</span>
                            </div>
                            <div className="flex justify-between">
                                <span>AI.MODEL</span>
                                <span className="text-slate-200">Grok-1 ( via Neural Bridge)</span>
                            </div>
                        </div>
                    )
                }
            ]
        }
    ];

    const activeChapterData = chapters.find(c => c.id === activeChapter);

    return (
        <div className="flex h-[calc(100vh-48px)] bg-white font-sans text-slate-900">
            {/* Sidebar Navigation */}
            <div className="w-72 border-r border-slate-200 bg-slate-50 flex flex-col shrink-0">
                <div className="p-5 border-b border-slate-200">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="bg-slate-900 text-white p-1">
                            <Book className="w-4 h-4" />
                        </div>
                        <h1 className="font-black text-sm uppercase tracking-tighter">Knowledge Base</h1>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span className="font-bold text-slate-900">{VERSION}</span>
                        <span>•</span>
                        <span>RELEASED: DEC 30</span>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto py-2">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-5 py-3 text-left transition-all",
                                activeChapter === chapter.id 
                                    ? "bg-white border-y border-slate-200 border-r-2 border-r-slate-900 shadow-sm" 
                                    : "border-y border-transparent hover:bg-slate-100"
                            )}
                        >
                            <span className={cn(
                                "transition-colors",
                                activeChapter === chapter.id ? "text-slate-900" : "text-slate-400"
                            )}>{chapter.icon}</span>
                            
                            <span className={cn(
                                "text-[11px] font-bold uppercase tracking-widest",
                                activeChapter === chapter.id ? "text-slate-900" : "text-slate-500"
                            )}>{chapter.title}</span>
                        </button>
                    ))}
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-100">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">System Online</span>
                    </div>
                    <p className="text-[9px] text-slate-400 leading-tight">
                        Managed by Rebel X Headquarters Pro.<br/>
                        Automated ERP Intelligence Layer.
                    </p>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {/* Header */}
                <div className="shrink-0 px-8 py-6 border-b border-slate-100 flex items-end justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                            <span>Documentation</span>
                            <ChevronRight className="w-3 h-3" />
                            <span>{activeChapterData?.title}</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{activeChapterData?.title}</h2>
                    </div>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 border border-slate-200 text-[10px] font-bold uppercase hover:bg-slate-50 transition-colors flex items-center gap-2">
                            <List className="w-3 h-3" /> Collapse All
                        </button>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-white">
                    <div className="max-w-4xl space-y-8 pb-20">
                        {activeChapterData?.sections.map(section => (
                            <div key={section.id} id={section.id} className="group">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between py-4 text-left border-b-2 border-slate-100 group-hover:border-slate-200 transition-colors"
                                >
                                    <span className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                        <div className={cn("w-2 h-2 rounded-full transition-colors", expandedSections.includes(section.id) ? "bg-slate-900" : "bg-slate-200")} />
                                        {section.title}
                                    </span>
                                    {expandedSections.includes(section.id) 
                                        ? <ChevronDown className="w-4 h-4 text-slate-900" /> 
                                        : <ChevronRight className="w-4 h-4 text-slate-300" />
                                    }
                                </button>
                                
                                {expandedSections.includes(section.id) && (
                                    <div className="py-6 px-1 animate-in slide-in-from-top-2 fade-in duration-300">
                                        {section.content}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
