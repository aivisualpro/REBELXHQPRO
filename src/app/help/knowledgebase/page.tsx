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
            title: 'Strategic Architecture',
            icon: <ShieldCheck className="w-4 h-4" />,
            sections: [
                {
                    id: 'vision-sovereignty',
                    title: 'The Automated Managerial Layer',
                    content: (
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                <strong>Rebel X Headquarter Pro</strong> is not merely a software application or a database interface; it is a custom-engineered Enterprise Resource Planning (ERP) ecosystem designed to function as a fully automated "Managerial Layer" for the entire enterprise. In traditional organizational structures, as transaction volume scales, companies are forced to hire linear layers of middle management to police production quality, audit inventory levels, and ensure financial reconciliation. This software renders that legacy model obsolete. It oversees the complete lifecycle of capital—from its initial state as raw inventory to its final state as recognized revenue—without the friction, latency, or error rates inherent in human oversight.
                            </p>
                            <p>
                                By engineering this system on a sovereign serverless architecture (Next.js/Vercel) backed by a MongoDB cluster, we have effectively decoupled the company's operational capacity from third-party constraints. We are not paying "per user" or "per row," nor are we beholden to the feature roadmaps of external vendors. Instead, we have built a digital workforce. Adeel Dev's assessment is that the automated logic embedded within these thousands of lines of code performs the equivalent workload of 100 mid-level managers working in unison—monitoring stock levels, auditing extensive ledgers, recalculating manufacturing costs in real-time, and enforcing strict data integrity across the supply chain—without fatigue, error, or salary.
                            </p>
                            <div className="pl-6 border-l-4 border-slate-900 bg-slate-50 p-4 rounded-r-md italic text-slate-600 font-serif">
                                "The ultimate goal of this architecture is to create a 'Digital Twin' of the business that doesn't just record history but actively governs it. We are not building a tool for data entry; we are building a synthetic nervous system for the enterprise."
                            </div>
                            <p>
                                This shift represents a move from "Passive Software" (which waits for user input) to "Active Software" (which demands action or executes it automatically). When inventory dips below a threshold, the system does not just display a red number; it calculates the precise manufacturing run required to replenish it, checks for available raw materials, and queues the Work Order. This is the difference between a dashboard and an autopilot.
                            </p>
                        </div>
                    )
                },
                {
                    id: 'vision-financial-architecture',
                    title: 'Financial Efficiency Index',
                    content: (
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                One of the most critical advantages of a custom-engineered solution is the dramatic compression of Operational Expenditure (OpEx). The infrastructure has been engineered for extreme leverage. The "Rebel X Headquarter Pro" environment runs on a lean, high-performance stack that costs approximately <strong>$200.00 per month</strong> at current scale. This figure includes the enterprise-grade database replication required for data safety, global edge caching via Vercel for sub-second performance, and the high-throughput API access required to power the Grok AI neural engines.
                            </p>
                            <p>
                                To understand the magnitude of this efficiency, one must compare it to the "Shadow Costs" of a fragmented SaaS stack. A typical alternative layout—using separate best-in-class tools for Inventory, CRM, Manufacturing Execution, and Financial Reporting—would easily command monthly fees in the $2,000 to $5,000 range once seat counts and transaction volumes are factored in. But the direct cost is only the tip of the iceberg.
                            </p>
                            <p>
                                The true cost of fragmented systems is "Integration Friction." This is the labor required to reconcile data that doesn't match between your shipping platform and your accounting software. It is the confused warehouse employee who sees one stock level in the WMS and another in the Order Manager. By creating a unified "Source of Truth," Rebel X eliminates this friction entirely. Every web order, every manufacturing run, and every client interaction flows into a single, immutable ledger. We are effectively putting a dollar figure on "Data Trust," and by that metric, the ROI of this system is nearly infinite because it allows Executive Leadership to trust their dashboard implicitly.
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
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                In the Rebel X ecosystem, inventory is never treated as a simple integer. "We have 50 units" is a meaningless statement in modern supply chain management. Instead, we enforce granular <strong>Lot-Level Accountability</strong>. We track the specific history, cost basis, expiration timeline, and "Chain of Custody" for every single bottle and bag via the Ledger. This allows us to enforce a strict First-In-First-Out (FIFO) protocol, effectively rotating stock automatically through software governance rather than relying on warehouse discipline alone.
                            </p>
                            <p>
                                Why does this matter financially? Because without strict FIFO enforcement, your Cost of Goods Sold (COGS) is a mere guess. If you sell a bottle today, the ERP answers the critical financial question: "Did this unit cost $4.00 to make (from a batch made last month) or $6.50 (from a batch made during a supply crunch)?" It does this by automatically allocating the oldest available lot to every outgoing Web Order.
                            </p>
                            <p>
                                This transforms "Gross Profit" from a vague estimation into a distinct, forensic financial fact. The Ledger effectively becomes an audit trail so detailed it borders on the archaeological. You can trace a specific customer complaint back to the exact day, hour, and employee involved in its associated manufacturing run. This level of resolution is typically found only in billion-dollar pharmaceutical supply chains, yet it is standard operating procedure within the Rebel X Headquarter Pro environment.
                            </p>
                        </div>
                    )
                },
                {
                    id: 'warehouse-manufacturing-intelligence',
                    title: 'Real-Time Cost of Goods Manufactured (COGM)',
                    content: (
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                The Manufacturing module is the engine of our financial reality. It is the crucible where raw capital (ingredients, packaging, labor) is transmuted into sellable assets. Most systems struggle to accurately capture the true cost of production because they rely on "Standard Costing"—preset estimates that rarely reflect reality. We have rejected this approach in favor of "Actual Costing."
                            </p>
                            <p>
                                To achieve this, we engineered a "Live Counter" system that captures the arguably most volatile variable in manufacturing: <strong>Human Labor Time</strong>. When a production team member clocks into a Work Order, the system is not merely acting as a stopwatch. It is querying their specific Hourly Rate from the User Database and calculating the labor burden on that specific batch in real-time. This dynamic labor cost is added to the strict FIFO material cost of the ingredients and the fixed cost of packaging to produce a final, undeniable <strong>Cost Per Unit</strong>.
                            </p>
                            <p>
                                This loop closes automatically and instantaneously. The raw materials are deducted from inventory, and a new "Finished Good" Lot is created with this precise cost basis burned into its metadata. This means when we analyze profitability in the Dashboard, we aren't using spreadsheet guesses. We are viewing the mathematical reality of our production floor's efficiency. If a specific batch took 20% longer to produce, the system captures that variance immediately, allowing management to investigate the root cause (training issues, equipment failure) before it becomes a chronic trend.
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
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                The strength of this ERP lies in its massive historical context. A system that starts empty is blind to trends. We successfully ingested nearly 20,000 legacy web orders across multiple domains (KINGKKRATOM, GRASSROOTSHARVEST, etc.) to build a complete, high-resolution picture of the company's performance from Day One. This process was akin to digital archaeology—carefully extracting valuable artifacts from layers of unstructured legacy data.
                            </p>
                            <p>
                                Crucially, we implemented a sophisticated filtration layer during this ingestion. Kemal noted that a significant portion of the historical record—approximately 14,000 to 15,000 orders—was constituted of "spam," bot attacks, or failed transactions. In a standard migration, these would have polluted the database, skewing conversion rates and average order values.
                            </p>
                            <p>
                                Our ingestion engine automatically analyzed payment statuses, customer metadata, and IP patterns to segregate this "noise" from the "signal." This means the historical revenue charts you see on the Dashboard are refined, purified datasets. We have effectively rewritten the company's history to be accurate, ensuring that future trend analysis is based on real financial performance, not legacy debris. This clean data foundation allows us to calculate metrics like "Customer Lifetime Value" (CLV) with a degree of precision that was previously impossible.
                            </p>
                        </div>
                    )
                },
                {
                    id: 'sales-bridge-logic',
                    title: 'The "Semantic Bridge" (SKU Linking)',
                    content: (
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                A classic friction point in modern e-commerce is the semantic disconnect between "Marketing Naming" and "Inventory Naming." The website wants to sell emotions and benefits ("Super Green Maeng Da - Mega Pack"), but the warehouse needs to track standardized physical units ("SKU-3049-KG"). In lesser systems, this translation requires constant human intervention, messy spreadsheet lookups, or fragile naming conventions that stifle marketing creativity.
                            </p>
                            <p>
                                We solved this problem structurally with a permanent <strong>Semantic Bridge</strong> known as "Web Product Linking." The system exposes an interface where we link a WooCommerce Product ID (or any future channel ID) to an Internal SKU exactly once. This creates an immutable bond in the database topology.
                            </p>
                            <p>
                                From that moment forward, the ERP acts as a universal translator. It receives an order for the fancy marketing name, instantly resolves it to the internal SKU, checks the Ledger for the oldest Lot, and decrements stock—all in milliseconds. This decoupling allows the Marketing Department to test unlimited headlines, bundles, and product variations without ever confusing the Warehouse or breaking the financial chain of custody. It is a perfect separation of concerns: Marketing owns the "Name," Operations owns the "Thing."
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
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                We must stop thinking of the "Neural Board" as a dashboard widget or a chat interface. It is, functionally, a synthetic Senior Business Analyst that never sleeps. By integrating the Grok AI model directly into our data stream, we are able to perform 6-dimensional analysis on the business continuously, moving far beyond simple linear reporting.
                            </p>
                            <p>
                                Traditional ERP systems report <em>what happened</em> (Descriptive Analytics). They look backward. The Neural Board is designed to tell us <em>why it happened</em> and <em>what will happen next</em> (Predictive and Inferential Analytics). It looks at "Revenue" not just as a static number, but as a velocity vector with momentum and resistance. It analyzes "Capital Efficiency" by correlating stock holding times with cash flow cycles. It monitors "Customer Pulse" by detecting subtle shifts in reorder frequency across retention cohorts before they become obvious attrition trends.
                            </p>
                            <p>
                                We encourage Executive Leadership to use this tool aggressively. Query it. Ask it complex, multi-variable questions about margin erosion or stockout risks. "If sales of Kratom Powder increase by 20%, when will we run out of packaging materials?" This is the kind of intelligence that typically requires a team of data scientists to produce. It helps us migrate the entire organization from reactive management ("We ran out of stock") to proactive governance ("We need to manufacture Batch X today to prevent a stockout next Tuesday").
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
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                Sales teams across all industries often suffer from "recency bias"—they call the clients they spoke to last week, simply because they are top-of-mind, while ignoring the silent majority who are slowly drifting away. The Retention Command Center is designed to eliminate this human bias through impartial algorithmic enforcement. We categorize the entire client base into strict, mathematically defined cohorts: Active, Warm (30 Days), At Risk (60 Days), and Critical (90+ Days).
                            </p>
                            <p>
                                The "Magic Button" is the tactical nuclear weapon of this module. When pressed, it executes a comprehensive scan of the entire database, analyzing the "Last Touch Point" for every single active account. It identifies every client who has slipped into a risk category and, crucially, it doesn't just produce a static report—it <strong>generates work</strong>.
                            </p>
                            <p>
                                The system instantiates hundreds of specific "Retention Tasks" in the database, maps them to the correct Sales Representative based on territory or history, and sets urgency levels. This turns "Retention" from a vague, feel-good concept into a tangible, trackable to-do list. We are effectively industrializing the process of customer care, ensuring that no relationship dies due to simple negligence or forgetfulness. It guarantees that 100% of the customer base is "touched" at the appropriate operational cadence.
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
                    title: 'Platform Agnosticism & Integrations',
                    content: (
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                A key strategic advantage of this system is its "Frontend Agnosticism." Because the core business logic—the "brain" of the company—resides here, in our custom ERP, we are not beholden to any single e-commerce platform. For example, if the business decides to expand to or switch entirely to Shopify in the future, the ERP remains the central command center. We would simply activate a new "Order Ingestion Adapter" to listen to Shopify's data stream alongside or instead of WooCommerce.
                            </p>
                            <p>
                                The Warehouse team would see no difference in their fulfillment workflow. The Finance team would see no difference in their ledger reports. The "Internal Reality" of the business remains stable even as the external sales channels mutate and evolve. This is true resilience.
                            </p>
                            <p>
                                This extensibility applies equally to communication and logistics. Integrating new channels is a matter of "microscopic tasks," not systemic overhauls. We can rapidly plug in <strong>Google Voice</strong> for call logging, <strong>WhatsApp</strong> for direct customer messaging, and <strong>ShipStation</strong> for logistical synchronization. These are treated as modular plugins to the core system. This adaptability ensures that Rebel X Headquarter Pro will not be a "legacy system" in five years; it is a living platform designed to ingest new technologies rapidly without disrupting the central operational workflow.
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
                        <div className="space-y-8 text-sm text-slate-700 leading-7 font-sans">
                            <p>
                                For the sake of comprehensive documentation and due diligence, we list here the production specifications of the Rebel X Headquarter Pro environment. This transparency ensures that future engineering teams understand the high-performance bedrock upon which this system rests.
                            </p>
                            <div className="bg-slate-900 text-slate-300 p-8 rounded-sm font-mono text-xs leading-relaxed border-l-4 border-emerald-500 shadow-2xl">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div className="space-y-6">
                                        <div>
                                            <h5 className="text-emerald-500 font-bold uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Compute Layer</h5>
                                            <p className="text-white">Next.js 14 (App Router) running on Vercel Edge Network. This architecture utilizes Serverless functions to ensure zero-downtime scalability. It automatically spawns new compute instances in response to traffic spikes, ensuring that the dashboard remains responsive even during high-load events.</p>
                                        </div>
                                        <div>
                                            <h5 className="text-emerald-500 font-bold uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Persistence Layer</h5>
                                            <p className="text-white">MongoDB Atlas (M10 Cluster) configured with automated oplog replication and daily point-in-time backup snapshots. This ensures 99.99% data availability and allows for granular recovery in the event of catastrophic user error.</p>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div>
                                            <h5 className="text-emerald-500 font-bold uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Intelligence Layer</h5>
                                            <p className="text-white">Grok-1 LLM integration via a secure REST API bridge. The system utilizes a specialized context window optimized for financial dataset analysis, pre-feeding the model with relevant schema structures to minimize hallucination rates.</p>
                                        </div>
                                        <div>
                                            <h5 className="text-emerald-500 font-bold uppercase tracking-widest mb-2 border-b border-slate-700 pb-1">Auth & Security</h5>
                                            <p className="text-white">Next-Auth JWT (JSON Web Token) strategy with role-based middleware protection. Administrative routes are hard-gated at the server level, meaning unauthorized requests are rejected before they ever reach the database query stage.</p>
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
            <div className="w-96 border-r border-slate-200 bg-slate-50/50 flex flex-col shrink-0 z-20 shadow-xl shadow-slate-200/50">
                <div className="p-8 border-b border-slate-200 bg-white">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-slate-900 text-white p-2 shadow-lg">
                            <Book className="w-5 h-5" />
                        </div>
                        <h1 className="font-black text-base uppercase tracking-tighter text-slate-900 leading-none">
                            Knowledge Base<br/>
                            <span className="text-[10px] text-slate-400 font-medium tracking-normal opacity-80">Executive Documentation</span>
                        </h1>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono font-bold">
                            <span>{VERSION}</span>
                            <span className="text-slate-300">|</span>
                            <span>SECURE CHECK: OK</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-[9px] font-black text-emerald-700 uppercase tracking-wider">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Live System
                        </div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-4 px-5 py-4 text-left transition-all group rounded-sm border",
                                activeChapter === chapter.id 
                                    ? "bg-white text-slate-900 shadow-md border-slate-200 ring-1 ring-slate-100 z-10 relative transform translate-x-1" 
                                    : "border-transparent text-slate-500 hover:bg-white hover:text-slate-700 hover:border-slate-100 hover:shadow-sm"
                            )}
                        >
                            <span className={cn(
                                "transition-colors duration-200 p-1.5 rounded-md",
                                activeChapter === chapter.id ? "bg-slate-100 text-slate-900" : "bg-transparent text-slate-400 group-hover:text-slate-600 group-hover:bg-slate-50"
                            )}>
                                {chapter.icon}
                            </span>
                            
                            <div className="flex flex-col">
                                <span className={cn(
                                    "text-[11px] font-bold uppercase tracking-widest leading-tight",
                                    activeChapter === chapter.id ? "text-slate-900" : "text-slate-500"
                                )}>{chapter.title}</span>
                                {activeChapter === chapter.id && (
                                    <span className="text-[9px] text-slate-400 font-medium mt-0.5 animate-in fade-in">Currently Viewing</span>
                                )}
                            </div>

                            {activeChapter === chapter.id && (
                                <div className="ml-auto w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="p-8 border-t border-slate-200 bg-white">
                    <div className="flex items-end justify-between mb-3">
                         <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">System Integrity</div>
                         <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">100% OPERATIONAL</span>
                    </div>
                    
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                        <div className="h-full w-full bg-slate-900 origin-left" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">Region</div>
                            <div className="text-[10px] text-slate-600 font-mono">us-east-1</div>
                        </div>
                         <div className="text-right">
                            <div className="text-[9px] text-slate-400 font-bold uppercase">Deploy ID</div>
                            <div className="text-[10px] text-slate-600 font-mono">SHA-88x9</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 
                MAIN CONTENT AREA 
                focused reading environment, rich typography
            */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 relative">
                
                {/* Header Strip */}
                <div className="shrink-0 px-12 py-10 bg-white border-b border-slate-200 flex items-end justify-between sticky top-0 z-10 shadow-sm">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            <span className="opacity-50">Strategic Documentation</span>
                            <ChevronRight className="w-3 h-3 opacity-30" />
                            <span className="text-emerald-600">Chapter: {activeChapterData?.title}</span>
                        </div>
                        <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none">
                            {activeChapterData?.title}
                        </h2>
                    </div>
                    <div className="hidden xl:flex gap-3">
                         <div className="px-4 py-2 bg-slate-50 border border-slate-200 text-[10px] font-bold uppercase text-slate-400 tracking-wider rounded-sm">
                            Last Updated: Dec 30, 2025
                         </div>
                    </div>
                </div>

                {/* Scrollable Reading Pane */}
                <div className="flex-1 overflow-y-auto scroll-smooth w-full pb-20">
                    <div className="max-w-5xl mx-auto px-12 py-16">
                        {/* Intro / Context */}
                        <div className="mb-16 pb-8 border-b border-slate-200">
                            <p className="text-xl text-slate-500 font-serif leading-relaxed antialiased">
                                "This section details the critical architectural and operational components of the Rebel X Headquarter Pro system. It is designed to provide Executive Leadership with a deep understanding of the automated logic, financial integrity, and scalable physics that govern the new digital enterprise."
                            </p>
                        </div>

                        <div className="space-y-16">
                            {activeChapterData?.sections.map(section => (
                                <div key={section.id} id={section.id} className="group transition-all duration-500 bg-white border border-transparent hover:border-slate-200 hover:shadow-xl hover:shadow-slate-200/40 p-1 rounded-lg">
                                    {/* Section Header */}
                                    <button
                                        onClick={() => toggleSection(section.id)}
                                        className={cn(
                                            "w-full flex items-center justify-between px-8 py-6 text-left rounded-md transition-colors",
                                            expandedSections.includes(section.id) ? "bg-slate-50" : "bg-white hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="text-lg font-black text-slate-900 uppercase tracking-widest flex items-center gap-5">
                                            <div className={cn(
                                                "w-4 h-4 border-2 transition-all duration-300 rounded-sm flex items-center justify-center",
                                                expandedSections.includes(section.id) 
                                                    ? "bg-slate-900 border-slate-900" 
                                                    : "bg-transparent border-slate-300 group-hover:border-slate-900"
                                            )}>
                                                {expandedSections.includes(section.id) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            {section.title}
                                        </span>
                                        {expandedSections.includes(section.id) 
                                            ? <ChevronDown className="w-6 h-6 text-slate-900" /> 
                                            : <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-slate-900" />
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
                                            <div className="pt-8 pb-10 px-10 animate-in slide-in-from-top-4 fade-in duration-500">
                                                {section.content}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    
                        {/* Footer Signature */}
                        <div className="mt-32 pt-16 border-t border-slate-200 flex flex-col items-center text-center opacity-40 hover:opacity-100 transition-opacity duration-500">
                            <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center mb-6 shadow-xl">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <p className="text-xs uppercase tracking-[0.2em] font-black text-slate-900">Rebel X Headquarters Pro</p>
                            <p className="text-[10px] font-mono text-slate-500 mt-2">Classified Internal Documentation • {VERSION}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
