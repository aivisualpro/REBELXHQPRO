'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Book, ChevronRight, ChevronDown, List, ShieldCheck, Factory, Globe, Brain, Users, ArrowUpRight, Terminal, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

// VERSION IDENTIFIER
const VERSION = "V.b0.21.PRO";

/* -------------------------------------------------------------------------- */
/*                                TYPES & INTERFACES                          */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                                COMPONENT LOGIC                             */
/* -------------------------------------------------------------------------- */

export default function KnowledgeBasePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    
    // NAVIGATION STATE
    const [activeChapter, setActiveChapter] = useState<string>('vision');
    
    // DEFAULT EXPANDED STATE 
    // We maintain this comprehensive list to ensure the user is greeted with a wall of valuable text immediately.
    const [expandedSections, setExpandedSections] = useState<string[]>([
        'vision-sovereignty', 'vision-financial-architecture',
        'warehouse-integrity', 'warehouse-manufacturing-intelligence',
        'sales-archaeology', 'sales-bridge-logic',
        'neural-synthesis',
        'crm-retention-algorithm',
        'scalability-future-proof',
        'technical-infrastructure'
    ]);

    // ROLE-BASED ACCESS CONTROL
    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    // LOADING STATE
    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-48px)] bg-slate-50">
                <div className="text-slate-400 text-xs font-mono uppercase tracking-widest animate-pulse">
                    Decrypting Executive Intelligence Layer...
                </div>
            </div>
        );
    }

    // SECURITY GATE
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-slate-50 border-t border-slate-200">
                <Lock className="w-12 h-12 text-slate-300 mb-6" />
                <h1 className="text-lg font-bold text-slate-500 uppercase tracking-widest">Clearance Level Insufficient</h1>
                <p className="text-sm text-slate-400 mt-3 max-w-md text-center leading-relaxed">
                    This strategic documentation contains sensitive operational logic, financial formulas, and long-term architectural roadmaps intended solely for Executive Leadership.
                </p>
                <button 
                    onClick={() => router.push('/')} 
                    className="mt-8 px-6 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                    Return to Operational Dashboard
                </button>
            </div>
        );
    }

    const toggleSection = (sectionId: string) => {
        setExpandedSections(prev => 
            prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
        );
    };

    /* -------------------------------------------------------------------------- */
    /*                                CONTENT REPOSITORY                          */
    /* -------------------------------------------------------------------------- */

    const chapters: Chapter[] = [
        {
            id: 'vision',
            title: 'Strategic Vision & Economics',
            icon: <ShieldCheck className="w-4 h-4" />,
            sections: [
                {
                    id: 'vision-sovereignty',
                    title: 'The Pivot to Operational Sovereignty',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                The transition from a constrained "no-code" environment like AppSheet to the <strong>Rebel X Headquarter Pro</strong> custom ERP represents a fundamental shift in business philosophy. It is the move from "renting" capability to "owning" a sovereign digital asset. In our previous architectural reviews, it became evident that while AppSheet served as a functional prototype, its linear cost scaling and rigid row limits would eventually strangle the company's growth trajectory. As we scale toward thousands of daily transactions, the "tax" levied by third-party platforms becomes punitive—both financially and operationally.
                            </p>
                            <p>
                                By engineering this system on a serverless architecture (Next.js/Vercel) backed by a MongoDB cluster, we have effectively decoupled the company's operational capacity from its software licensing costs. We are no longer paying "per user" or "per row." Instead, we have built a system that functions as an <strong>Automated Managerial Layer</strong>. This is not merely a CRM; it is a digital workforce. Adeel Dev's assessment is that the automated logic embedded within these thousands of lines of code performs the equivalent workload of 100 mid-level managers working in unison—monitoring stock levels, auditing extensive ledgers, recalculating manufacturing costs in real-time, and enforcing strict data integrity across the supply chain—without fatigue, error, or salary.
                            </p>
                            <p className="pl-4 border-l-2 border-slate-900 italic text-slate-600">
                                "We are not building a tool for data entry. We are building a synthetic nervous system for the enterprise that enforces business logic 24/7."
                            </p>
                        </div>
                    )
                },
                {
                    id: 'vision-financial-architecture',
                    title: 'The Financial Efficiency Index',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                Kemal Whyte's primary concern regarding the "burn rate" of maintaining a custom software stack has been addressed through aggressive architectural optimization. The "Rebel X Headquarter Pro" environment has been engineered to run on a lean, high-performance infrastructure that costs approximately <strong>$200.00 per month</strong> at current scale. This figure is deceptive in its modesty; it covers enterprise-grade database replication, global edge caching via Vercel, and the API throughput required to power the Grok AI neural engines.
                            </p>
                            <p>
                                Contrast this with the alternative: A fragmented stack of SaaS subscriptions (Inventory Management, separate CRMs, standalone Manufacturing software, and Zapier glue-code) would easily exceed $2,000–$5,000 monthly once user seat limits are breached. More importantly, the hidden cost of "integration friction"—where data in ShipStation doesn't match data in QuickBooks—evaporates here. By creating a unified "Source of Truth," we eliminate the reconciliation labor that typically consumes the Finance department's end-of-month cycle. We are putting a dollar figure on "data trust," and by that metric, the ROI of this system is nearly infinite.
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'warehouse',
            title: 'Supply Chain Physics',
            icon: <Factory className="w-4 h-4" />,
            sections: [
                {
                    id: 'warehouse-integrity',
                    title: 'Inventory Discipline & The FIFO Imperative',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                In many retail operations, inventory is treated as a simple integer: "We have 50 units." In the Rebel X ecosystem, this simplicity is rejected in favor of granular <strong>Lot-Level Accountability</strong>. We do not just track <em>how many</em> units exist; we track the specific history, cost basis, and expiration timeline of every single bottle and bag via the Ledger. This allows us to enforce a strict First-In-First-Out (FIFO) protocol.
                            </p>
                            <p>
                                Why does this matter? Because without FIFO, your Cost of Goods Sold (COGS) is a guess. If you sell a bottle today, did it cost you $4.00 to make (from a batch made last year) or $6.50 (from a batch made during a supply crunch)? The ERP answers this question automatically by allocating the oldest available lot to every outgoing Web Order. This transforms "Gross Profit" from a vague estimation into a distinct financial fact. The Ledger effectively becomes a forensic audit trail, allowing us to trace a specific customer complaint back to the exact day, hour, and employee involved in its manufacturing.
                            </p>
                        </div>
                    )
                },
                {
                    id: 'warehouse-manufacturing-intelligence',
                    title: 'Real-Time Cost of Goods Manufactured (COGM)',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                The Manufacturing module is the engine of our financial reality. It is where raw capital (ingredients, packaging, labor) is transmuted into sellable assets. We have engineered a "Live Counter" system that captures the arguably most volatile variable in manufacturing: <strong>Human Labor Time</strong>.
                            </p>
                            <p>
                                When a production team member clocks into a Work Order, the system is not just a stopwatch. It is querying their specific Hourly Rate from the User Database and calculating the labor burden on that batch in real-time. This dynamic labor cost is added to the strict FIFO material cost of the ingredients and the fixed cost of packaging to produce a final, undeniable <strong>Cost Per Unit</strong>.
                            </p>
                            <p>
                                This loop closes automatically: The raw materials are deducted from inventory, and a new "Finished Good" Lot is created with this precise cost basis burned into its metadata. This means when we analyze profitability in the Dashboard, we aren't using "standard costing" or spreadsheet guesses. We are viewing the mathematical reality of our production floor's efficiency.
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'sales',
            title: 'Commercial Integration Logic',
            icon: <Globe className="w-4 h-4" />,
            sections: [
                {
                    id: 'sales-archaeology',
                    title: 'Data Archaeology: The 20,000 Order Ingestion',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                Launching this ERP required a massive capability regarding historical data "ingestion." We did not start with a blank slate; we had to digest nearly 20,000 legacy web orders across multiple domains (KINGKKRATOM, GRASSROOTSHARVEST, etc.). This process was akin to digital archaeology. As noted by Kemal, a significant portion of this history—approximately 14,000 to 15,000 orders—was constituted of "spam" or failed transactions that clouded the company's financial history.
                            </p>
                            <p>
                                We engineered a sophisticated filtration layer during the ingestion process. Instead of blindly importing every record, the system analyzes payment statuses, customer metadata, and IP patterns to segregate "noise" from "signal." This means the historical revenue charts you see on the Dashboard are not just raw dumps; they are refined, purified datasets. We have effectively rewritten the company's history to be accurate, discarding the digital debris that accumulated over years of operation.
                            </p>
                        </div>
                    )
                },
                {
                    id: 'sales-bridge-logic',
                    title: 'The "Semantic Bridge" (SKU Linking)',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                A classic friction point in e-commerce is the disconnect between "Marketing Naming" and "Inventory Naming." The website calls it "Super Green Maeng Da - Mega Pack," but the warehouse knows it as "SKU-3049-KG." In lesser systems, this translation requires constant human intervention or messy spreadsheet lookups.
                            </p>
                            <p>
                                We solved this with a permanent <strong>Semantic Bridge</strong> known as "Web Product Linking." The system exposes an interface where we link a WooCommerce Product ID to an Internal SKU exactly once. This creates an immutable bond in the database. From that moment forward, the ERP acts as a universal translator. It receives an order for the fancy marketing name, instantly resolves it to the internal SKU, checks the Ledger for the oldest Lot, and decrements stock—all in milliseconds. This allows Marketing to be creative with product names and bundles without ever confusing the Warehouse or breaking the financial chain of custody.
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'neural',
            title: 'Neural Board & Artificial Intelligence',
            icon: <Brain className="w-4 h-4" />,
            sections: [
                {
                    id: 'neural-synthesis',
                    title: 'The Synthetic Analyst (Grok AI)',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                We must stop thinking of the "Neural Board" as a dashboard widget. It is, functionally, a synthetic Senior Business Analyst that never sleeps. By integrating the Grok AI model directly into our data stream, we are able to perform 6-dimensional analysis on the business continuously.
                            </p>
                            <p>
                                Most ERPs report <em>what happened</em> (Descriptive Analytics). The Neural Board is designed to tell us <em>why it happened</em> and <em>what will happen next</em> (Predictive Analytics). It looks at "Revenue" not just as a number, but as a velocity vector. It analyzes "Capital Efficiency" by correlating stock holding times with cash flow. It monitors "Customer Pulse" by detecting subtle shifts in reorder frequency across cohorts. Use this tool aggressively. Query it. Ask it complex questions about margin erosion or stockout risks. It helps us migrate from reactive management ("We ran out of stock") to proactive governance ("We need to manufacture Batch X today to prevent a stockout next Tuesday").
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'crm',
            title: 'Customer Retention Command',
            icon: <Users className="w-4 h-4" />,
            sections: [
                {
                    id: 'crm-retention-algorithm',
                    title: 'Algorithmic Churn Prevention',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                Sales teams often suffer from "recency bias"—they call the clients they spoke to last week, ignoring the silent majority who are slowly drifting away. The Retention Command Center is designed to eliminate this human bias through algorithmic enforcement. We categorize the entire client base into strict cohorts: Active, Warm (30 Days), At Risk (60 Days), and Critical (90+ Days).
                            </p>
                            <p>
                                The "Magic Button" is the tactical nuclear weapon of this module. When pressed, it executes a comprehensive scan of the entire database, identifying every client who has slipped into a risk category. It doesn't just produce a report; it <strong>generates work</strong>. It instantiates hundreds of specific "Retention Tasks" in the database, assigns them to the appropriate Sales Representative, and sets due dates. This turns "Retention" from a vague concept into a tangible, trackable to-do list. We are effectively industrializing the process of caring about our customers, ensuring no relationship dies due to simple negligence.
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'scalability',
            title: 'Future-Proofing Architecture',
            icon: <ArrowUpRight className="w-4 h-4" />,
            sections: [
                {
                    id: 'scalability-future-proof',
                    title: 'Platform Agnosticism (The Shopify Pivot)',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                A key concern raised was the "Vendor Lock-in" risk—specifically, what happens if Rebel X moves from WooCommerce to Shopify? Because we have built a custom ERP, the logic of our business resides <em>here</em>, not in the e-commerce platform. The "Store" is merely a frontend input mechanism.
                            </p>
                            <p>
                                This decoupling means that switching to Shopify is an infrastructure detail, not a business crisis. We would simply rewrite the "Order Ingestion Adapter"—a microscopic task in the grand scheme of software engineering—to listen to Shopify's webhooks instead of WooCommerce's. The Warehouse team would see no difference. The Finance team would see no difference. The "Internal Reality" of the business remains stable even as the external sales channels mutate. This includes integrating new channels like ShipStation, WhatsApp, or Google Voice. These are merely new APIs to consume, not new systems to learn.
                            </p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'technical',
            title: 'Technical Specification',
            icon: <Terminal className="w-4 h-4" />,
            sections: [
                {
                    id: 'technical-infrastructure',
                    title: 'Production Environment Specifications',
                    content: (
                        <div className="space-y-6 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                For the sake of comprehensive documentation, we list here the production specifications of the Rebel X Headquarter Pro environment. This transparency ensures that future engineering teams understand the bedrock upon which this system rests.
                            </p>
                            <div className="bg-slate-900 text-slate-300 p-6 rounded-sm font-mono text-xs leading-relaxed border-l-4 border-emerald-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div>
                                            <h5 className="text-slate-500 font-bold uppercase tracking-widest mb-1">Compute Layer</h5>
                                            <p className="text-white">Next.js 14 (App Router) running on Vercel Edge Network. Serverless functions ensure zero-downtime scalability during high-traffic events.</p>
                                        </div>
                                        <div>
                                            <h5 className="text-slate-500 font-bold uppercase tracking-widest mb-1">Persistence Layer</h5>
                                            <p className="text-white">MongoDB Atlas (M10 Cluster) with automated oplog replication and daily point-in-time backup snapshots.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div>
                                            <h5 className="text-slate-500 font-bold uppercase tracking-widest mb-1">Intelligence Layer</h5>
                                            <p className="text-white">Grok-1 LLM integration via REST API bridge. Context window optimized for financial dataset analysis.</p>
                                        </div>
                                        <div>
                                            <h5 className="text-slate-500 font-bold uppercase tracking-widest mb-1">Auth & Security</h5>
                                            <p className="text-white">Next-Auth JWT strategy with role-based middleware protection. Admin routes are hard-gated at the server level.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        }
    ];

    const activeChapterData = chapters.find(c => c.id === activeChapter);

    /* -------------------------------------------------------------------------- */
    /*                                RENDER LAYER                                */
    /* -------------------------------------------------------------------------- */

    return (
        <div className="flex h-[calc(100vh-48px)] bg-white font-sans text-slate-900 overflow-hidden">
            {/* 
                SIDEBAR NAVIGATION 
                premium rigid layout with monospaced accents
            */}
            <div className="w-80 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0 z-20">
                <div className="p-6 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-slate-900 text-white p-1.5 shadow-lg">
                            <Book className="w-5 h-5" />
                        </div>
                        <h1 className="font-black text-sm uppercase tracking-tighter text-slate-900">Knowledge Base</h1>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono font-bold">
                            <span>{VERSION}</span>
                            <span className="text-slate-300">|</span>
                            <span>SECURE</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100/50 border border-emerald-200 rounded text-[9px] font-black text-emerald-700 uppercase tracking-wider">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Live
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all group rounded-sm",
                                activeChapter === chapter.id 
                                    ? "bg-white text-slate-900 shadow-sm border border-slate-200 ring-1 ring-slate-200 z-10 relative" 
                                    : "text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-sm"
                            )}
                        >
                            <span className={cn(
                                "transition-colors duration-200",
                                activeChapter === chapter.id ? "text-slate-900" : "text-slate-400 group-hover:text-slate-600"
                            )}>{chapter.icon}</span>
                            
                            <span className={cn(
                                "text-[11px] font-bold uppercase tracking-widest",
                                activeChapter === chapter.id ? "text-slate-900" : "text-slate-500"
                            )}>{chapter.title}</span>

                            {activeChapter === chapter.id && (
                                <div className="ml-auto w-1.5 h-1.5 bg-slate-900 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-6 border-t border-slate-200 bg-white">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">System Status</div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full w-full bg-emerald-500 origin-left" />
                        </div>
                        <span className="text-[10px] font-mono text-emerald-600 font-bold">100%</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-mono mt-2">
                        Deployment ID: <span className="text-slate-600">iad1-prod-88x9</span>
                    </p>
                </div>
            </div>

            {/* 
                MAIN CONTENT AREA 
                focused reading environment, rich typography
            */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white/50 relative">
                
                {/* Header Strip */}
                <div className="shrink-0 px-10 py-8 bg-white border-b border-slate-100 flex items-end justify-between sticky top-0 z-10">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            <span>Strategic Documentation</span>
                            <ChevronRight className="w-3 h-3" />
                            <span>{activeChapterData?.title}</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter shadow-slate-200 drop-shadow-sm">
                            {activeChapterData?.title}
                        </h2>
                    </div>
                    <div className="hidden md:flex gap-3">
                         <div className="px-4 py-2 bg-slate-50 border border-slate-100 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                            Last Updated: Dec 30, 2025
                         </div>
                    </div>
                </div>

                {/* Scrollable Reading Pane */}
                <div className="flex-1 overflow-y-auto bg-white scroll-smooth w-full">
                    <div className="max-w-5xl mx-auto px-10 py-12 pb-32">
                        {/* Intro / Context (Optional based on chapter, but good for flow) */}
                        <div className="mb-12 border-b-2 border-slate-900 pb-6">
                            <p className="text-lg font-medium text-slate-500 italic font-serif leading-relaxed">
                                "This section details critical components of the Rebel X Headquarter Pro architecture. Understanding this logic is a prerequisite for high-level operational decision making."
                            </p>
                        </div>

                        <div className="space-y-12">
                            {activeChapterData?.sections.map(section => (
                                <div key={section.id} id={section.id} className="group transition-all duration-500">
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className="w-full flex items-center justify-between py-5 text-left border-b border-slate-200 group-hover:border-slate-400 transition-colors"
                                    >
                                        <span className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-4">
                                            <div className={cn(
                                                "w-3 h-3 border-2 transition-all duration-300",
                                                expandedSections.includes(section.id) 
                                                    ? "bg-slate-900 border-slate-900" 
                                                    : "bg-transparent border-slate-300 group-hover:border-slate-900"
                                            )} />
                                            {section.title}
                                        </span>
                                        {expandedSections.includes(section.id) 
                                            ? <ChevronDown className="w-5 h-5 text-slate-900" /> 
                                            : <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-900" />
                                        }
                                    </button>
                                    
                                    {/* Section Content */}
                                    <div 
                                        className={cn(
                                            "grid transition-[grid-template-rows] duration-500 ease-in-out",
                                            expandedSections.includes(section.id) ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                                        )}
                                    >
                                        <div className="overflow-hidden">
                                            <div className="pt-8 pb-4 pr-8 animate-in slide-in-from-top-4 fade-in duration-500">
                                                {section.content}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    
                        {/* Footer Signature */}
                        <div className="mt-24 pt-12 border-t border-slate-100 flex flex-col items-center text-center opacity-50">
                            <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center mb-4">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                            <p className="text-[10px] uppercase tracking-widest font-black text-slate-900">Rebel X Headquarters Pro</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-1">Confidential Internal Documentation</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
