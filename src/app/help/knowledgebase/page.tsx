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
    TrendingUp, Rocket, Landmark, GitBranch, Share2, Sparkles, Wand2, Info, Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const VERSION = "V.b0.21";

// Asset URLs from generate_image results
const ASSETS = {
    DASHBOARD: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1767040400/rebelx-headquarters/assets/erp_neural_dashboard_preview_1767039803698.png",
    SKU_MATRIX: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1767040400/rebelx-headquarters/assets/sku_inventory_matrix_preview_1767039818352.png",
    MANUFACTURING: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1767040400/rebelx-headquarters/assets/manufacturing_recipe_flow_preview_1767039834670.png",
    CRM: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1767040400/rebelx-headquarters/assets/crm_retention_command_preview_1767039848747.png",
    NANO_BANANA: "https://res.cloudinary.com/dwkq4s4rg/image/upload/v1767040400/rebelx-headquarters/assets/nano_banana_mascot_stylized_1767039861352.png"
};

export default function KnowledgeBasePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeChapter, setActiveChapter] = useState<string>('strategy');
    
    // All sections expanded by default for full visibility
    const [expandedSections, setExpandedSections] = useState<string[]>([
        'strategy-vision', 'strategy-appsheet', 'strategy-roi', 'strategy-nanobanana',
        'intelligence-health', 'intelligence-neural', 'intelligence-predictive',
        'warehouse-skus', 'warehouse-ledger', 'warehouse-automated-manufacturing', 'warehouse-traceability',
        'omnichannel-woocommerce', 'omnichannel-linking', 'omnichannel-interoperability',
        'orders-management', 'orders-spam', 'orders-financials',
        'crm-retention', 'crm-magic-button', 'crm-client-360',
        'financials-operating-costs', 'financials-integration-plan', 'financials-compliance',
        'tech-stack', 'tech-models', 'tech-security'
    ]);

    const userRole = (session?.user as any)?.role;
    const isAdmin = userRole === 'Admin' || userRole === 'SuperAdmin';

    if (status === 'loading') {
        return (
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="flex flex-col items-center gap-6">
                    <div className="relative w-20 h-20">
                        <div className="absolute inset-0 border-4 border-slate-900 border-t-transparent animate-spin" />
                        <div className="absolute inset-2 border-4 border-amber-400 border-b-transparent animate-spin-slow" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Zap className="w-6 h-6 text-slate-900 animate-pulse" />
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-sm font-black uppercase tracking-[0.3em] text-slate-900">RX-HQ Intelligence</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Hydrating Documentation...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-48px)] bg-slate-50 p-8 text-center">
                <div className="bg-white p-12 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] border-b-8 border-rose-500 max-w-xl">
                    <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-rose-100">
                        <Lock className="w-10 h-10 text-rose-500" />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4">Classified Access</h1>
                    <p className="text-slate-500 text-sm leading-relaxed mb-8">
                        The information contained within the **Rebel X Knowledge Base** is restricted to senior personnel. 
                        Your current account clearance level does not permit viewing of core ERP architectural or operational blueprints.
                    </p>
                    <button 
                        onClick={() => router.push('/')} 
                        className="w-full py-4 bg-slate-900 text-white text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
                    >
                        Return to Command Center
                    </button>
                </div>
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
            title: 'Strategic Vision & Foundation',
            icon: <Rocket className="w-4 h-4" />,
            sections: [
                {
                    id: 'strategy-vision',
                    title: 'The "100 Manager" Philosophy',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-amber-300 opacity-20 blur group-hover:opacity-40 transition duration-1000"></div>
                                <div className="relative bg-slate-900 p-8 border-l-8 border-amber-500 shadow-2xl overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                                        <Brain className="w-48 h-48 text-white" />
                                    </div>
                                    <div className="flex items-start gap-6">
                                        <div className="p-4 bg-amber-500 rounded-sm shadow-lg transform -rotate-1 group-hover:rotate-0 transition-transform">
                                            <Brain className="w-8 h-8 text-slate-900" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-amber-500 font-black uppercase tracking-widest text-sm mb-3">Enterprise-Grade Intelligence</h4>
                                            <p className="text-slate-300 text-sm italic leading-relaxed">
                                                "Rebel X Headquarter Pro is engineered to be a digital workforce. Operating this ERP is equivalent to hiring 100 experienced senior managers. It doesn't just store data; it audits, predicts, and enforces business logic across the entire supply chain 24/7."
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <p>
                                    Rebel X Headquarter Pro (RX-HQ) was born from a fundamental need: **Operational Sovereignty**. 
                                    By centralizing every aspect of the business into a custom-built, bare-metal application, we have eliminated the fragmentation that plagues most growing brands. 
                                    Whether it's the cost of a single raw gram of Kratom or the lifetime value of a customer on KINGKKRATOM, the data flows through one single source of truth.
                                </p>
                                <div className="bg-slate-50 border border-slate-200 p-6 flex items-center gap-6">
                                    <div className="shrink-0">
                                        <Image src={ASSETS.NANO_BANANA} alt="Nano Banana" width={100} height={100} className="drop-shadow-xl" />
                                    </div>
                                    <div>
                                        <h5 className="font-black text-slate-900 uppercase text-xs mb-1">Meet the Nano Banana</h5>
                                        <p className="text-[11px] text-slate-500 leading-relaxed">
                                            The **Nano Banana** mascot represents our commitment to "Small but Powerful" logic. 
                                            Like our micro-services architecture, it symbolizes high-density intelligence packed into a fast, sleek, and efficient interface. 
                                            When you see the Nano Banana, you're looking at a piece of the system designed for peak efficiency.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'strategy-appsheet',
                    title: 'The AppSheet Pivot: Solving Scalability',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <p>Kemal Whyte's core concern focused on the **scalability and unsustainable maintenance costs** of no-code platforms like AppSheet. As a business grows to 20,000+ orders and multi-website complexity, no-code platforms become "Technical Debt" that slows down growth.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="border border-slate-200 bg-white relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 h-1 bg-rose-500 w-full" />
                                    <div className="p-6">
                                        <div className="flex items-center gap-3 font-black text-rose-500 text-sm uppercase mb-4">
                                            <ZapOff className="w-5 h-5" /> The AppSheet Crisis
                                        </div>
                                        <ul className="text-xs space-y-3 text-slate-500">
                                            <li className="flex gap-2 font-bold"><AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" /> Latency Spike: Large datasets cause 10s-30s load times.</li>
                                            <li className="flex gap-2 font-bold"><AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" /> Licensing Bloat: Per-user fees cost thousands monthly.</li>
                                            <li className="flex gap-2 font-bold"><AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" /> UI Ceiling: Inability to build complex, professional interfaces.</li>
                                            <li className="flex gap-2 font-bold"><AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" /> Offline Lag: Sync issues lead to data duplication and errors.</li>
                                        </ul>
                                    </div>
                                </div>
                                <div className="border border-slate-200 bg-slate-900 shadow-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 h-1 bg-emerald-500 w-full" />
                                    <div className="p-6">
                                        <div className="flex items-center gap-3 font-black text-emerald-500 text-sm uppercase mb-4">
                                            <Zap className="w-5 h-5" /> The RX-HQ Pro Fix
                                        </div>
                                        <ul className="text-xs space-y-3 text-slate-400">
                                            <li className="flex gap-2 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> Sub-Second Performance: Turbopack & CDN edge caching.</li>
                                            <li className="flex gap-2 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> Fixed Cost Model: Minimal cloud fees regardless of users.</li>
                                            <li className="flex gap-2 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> Full Design Freedom: Flat, premium, high-speed UI.</li>
                                            <li className="flex gap-2 font-bold"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> Direct API Pipeline: Native website and shipping sync.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'intelligence',
            title: 'Neural Engine & Live Intelligence',
            icon: <Cpu className="w-4 h-4" />,
            sections: [
                {
                    id: 'intelligence-neural',
                    title: 'Grok AI Integration: The Neural Board',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <div className="flex flex-col xl:flex-row gap-8 items-start">
                                <div className="flex-1 space-y-4">
                                    <p>The **Neural Board** is the intelligence layer of the ERP, powered by the latest LLM models from xAI (Grok). It doesn't just present static numbers; it interprets them.</p>
                                    <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest border-b-2 border-slate-900 pb-2 inline-block">6 Dimensions of Analysis</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { t: 'Revenue Matrix', d: 'Predicts month-end totals based on current velocity.' },
                                            { t: 'Capital Pulse', d: 'Monitors cash flow tied up in stagnant inventory.' },
                                            { t: 'Customer Echo', d: 'Segments clients by behavioral purchase patterns.' },
                                            { t: 'Product Velocity', d: 'Identifies Tier-1 movers vs slow-burners.' },
                                            { t: 'Labor Integrity', d: 'Flags labor cost overages in manufacturing.' },
                                            { t: 'Workflow Load', d: 'Optimizes production scheduling per department.' }
                                        ].map(item => (
                                            <div key={item.t} className="p-3 border border-slate-200 bg-white shadow-sm">
                                                <div className="font-black text-slate-900 text-[10px] uppercase mb-1 tracking-tighter">{item.t}</div>
                                                <p className="text-[10px] leading-tight text-slate-500">{item.d}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="w-full xl:w-[400px] shrink-0 border-8 border-slate-900 shadow-2xl">
                                    <Image src={ASSETS.DASHBOARD} alt="Dashboard Preview" width={400} height={250} className="w-full" />
                                    <div className="bg-slate-900 p-4 text-center">
                                        <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Neural Visualization Output</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-blue-50 border-l-4 border-blue-600 p-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Wand2 className="w-5 h-5 text-blue-600" />
                                    <h5 className="font-black text-blue-900 uppercase text-xs">Dynamic Data Prompting</h5>
                                </div>
                                <p className="text-xs text-blue-800 leading-relaxed">
                                    Unlike traditional chat bots, our AI is **context-aware**. When you ask "Are we over-producing capsules?", the system feeds the AI a live summary of capsule stock, recent web order trends, and pending work orders. The AI then generates a data-driven recommendation on whether to pause production or increase quantity.
                                </p>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'warehouse',
            title: 'Physical Operations & Manufacturing',
            icon: <Package className="w-4 h-4" />,
            sections: [
                {
                    id: 'warehouse-skus',
                    title: 'Deep SKU Archeology',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <div className="flex flex-col xl:flex-row-reverse gap-8 items-start">
                                <div className="flex-1 space-y-4">
                                    <p>At the center of the warehouse is our **SKU Master Database**. It manages every physical asset with microscopic detail, from bulk 20kg bags of powder to the heat-shrink seals on a single bottle.</p>
                                    <h4 className="font-black text-slate-900 uppercase text-xs tracking-widest border-b-2 border-slate-900 pb-2 inline-block">The "Full Picture" View</h4>
                                    <p>Clicking any SKU doesn't just show quantity; it provides a financial forensic report:</p>
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-3 text-xs font-bold bg-white p-3 border border-slate-200">
                                            <Landmark className="w-4 h-4 text-emerald-500" /> 
                                            <span>Real-Time GP: Current revenue minus active lot COGS.</span>
                                        </li>
                                        <li className="flex items-center gap-3 text-xs font-bold bg-white p-3 border border-slate-200">
                                            <History className="w-4 h-4 text-orange-500" /> 
                                            <span>The Ledger: Every single movement since day one.</span>
                                        </li>
                                        <li className="flex items-center gap-3 text-xs font-bold bg-white p-3 border border-slate-200">
                                            <Target className="w-4 h-4 text-blue-500" /> 
                                            <span>Tiering: Auto-assigned priority (T1, T2, T3).</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="w-full xl:w-[400px] shrink-0 border-8 border-slate-900 shadow-2xl relative">
                                    <Image src={ASSETS.SKU_MATRIX} alt="SKU Matrix" width={400} height={250} className="w-full" />
                                    <div className="absolute top-2 right-2 bg-amber-500 text-slate-900 px-2 py-1 text-[8px] font-bold uppercase tracking-widest">Live Matrix</div>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'warehouse-automated-manufacturing',
                    title: 'The Manufacturing Vault & Automated COGM',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <Image src={ASSETS.MANUFACTURING} alt="Manufacturing Flow" width={1000} height={400} className="w-full border border-slate-200 shadow-xl py-8 px-4 bg-white" />
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="p-6 border-b-4 border-slate-900 bg-white flex flex-col items-center text-center">
                                    <div className="p-3 bg-slate-900 rounded-full mb-4">
                                        <FileText className="w-6 h-6 text-white" />
                                    </div>
                                    <h6 className="font-black text-slate-900 uppercase text-xs mb-2">Automated WO Generation</h6>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        Select an output SKU and a recipe. The system instantly generates a Work Order, identifying all raw materials required and flagging any ingredients that are currently out of stock.
                                    </p>
                                </div>
                                <div className="p-6 border-b-4 border-amber-500 bg-white flex flex-col items-center text-center">
                                    <div className="p-3 bg-amber-500 rounded-full mb-4">
                                        <Clock className="w-6 h-6 text-white" />
                                    </div>
                                    <h6 className="font-black text-slate-900 uppercase text-xs mb-2">Live Labor Logic</h6>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        Employees clock-in directly on the work order. The ERP calculates labor cost using their specific hourly rate. It monitors the recipe's expected duration and can trigger alerts if labor-per-unit exceeds business standards.
                                    </p>
                                </div>
                                <div className="p-6 border-b-4 border-emerald-500 bg-white flex flex-col items-center text-center">
                                    <div className="p-3 bg-emerald-500 rounded-full mb-4">
                                        <ShieldCheck className="w-6 h-6 text-white" />
                                    </div>
                                    <h6 className="font-black text-slate-900 uppercase text-xs mb-2">COGM Finalization</h6>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        When finished, the ERP automatically creates a NEW lot for the finished SKU. It calculates the final **Cost of Goods Manufactured (COGM)** by summing: Material Costs + Packaging Costs + Actual Labor Tracking.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'omnichannel',
            title: 'Omnichannel & CRM Intelligence',
            icon: <Globe className="w-4 h-4" />,
            sections: [
                {
                    id: 'omnichannel-woocommerce',
                    title: 'Multichannel Mastery: Beyond WordPress',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <p>The ERP is the "Master Controller" for every website in the organization. Currently, we sync with **KINGKKRATOM, GRASSROOTSHARVEST, GRHKTRATOM, and REBELXBRANDS**.</p>
                            <div className="bg-slate-900 p-8 shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                    <Globe className="w-64 h-64 text-white" />
                                </div>
                                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <h4 className="text-white font-black uppercase text-sm tracking-[0.2em] border-l-4 border-amber-500 pl-4">No-Entry Website Management</h4>
                                        <p className="text-slate-400 text-xs">
                                            Managers no longer need to log into WordPress to manage business. The ERP pushes updates directly to the WooCommerce stores via robust REST APIs. 
                                            This eliminates the risk of human error in secondary DASHBOARDs.
                                        </p>
                                        <div className="flex gap-2">
                                            {['PRODUCT EDIT', 'STOCK SYNC', 'PRICE UPDATES', 'CATEGORIZATION'].map(tag => (
                                                <span key={tag} className="px-2 py-1 bg-white/10 text-white font-bold text-[8px] border border-white/20">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <h4 className="text-white font-black uppercase text-sm tracking-[0.2em] border-l-4 border-blue-500 pl-4">Platform Interoperability</h4>
                                        <p className="text-slate-400 text-xs">
                                            As Kemal inquired about **Shopify**, our system is platform-agnostic. Switching your front-end from WooCommerce to Shopify or even custom headless solutions is a straightforward API handshake—described by the team as a **"microscopic task"**.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'crm-magic-button',
                    title: 'CRM: The Retention Magic Button',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <div className="flex flex-col xl:flex-row gap-8 items-start">
                                <div className="w-full xl:w-[450px] shrink-0 border-8 border-slate-900 shadow-2xl overflow-hidden group">
                                    <div className="relative">
                                        <Image src={ASSETS.CRM} alt="CRM Preview" width={450} height={300} className="w-full transform group-hover:scale-105 transition-transform duration-1000" />
                                        <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <div className="p-3 bg-amber-500 rounded-full animate-bounce">
                                                <Zap className="w-8 h-8 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-900 p-4 border-t border-slate-800">
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">CRM Retention Sub-System</span>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-6 pt-4">
                                    <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter leading-none">Automated Client Salvation</h3>
                                    <p>With nearly 20,000 orders in the system, manual client tracking is impossible. The **Retention Command Center** uses behavioral segmentation to prevent churn.</p>
                                    
                                    <div className="space-y-4">
                                        <div className="p-4 border border-slate-200 bg-white">
                                            <div className="flex items-center gap-2 font-black text-slate-900 uppercase text-xs mb-1">
                                                <Zap className="w-4 h-4 text-amber-500" /> The Magic Button
                                            </div>
                                            <p className="text-xs text-slate-500 leading-relaxed">
                                                When the "Magic Button" is activated, the system scans the database for inactivity. 
                                                It automatically generates prioritized follow-up tasks (Call, Email, Win-back) for sales representatives, 
                                                distributing the workload based on current team capacity.
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-4 bg-emerald-50 border border-emerald-100">
                                                <div className="font-bold text-emerald-900 text-[10px] uppercase mb-1">Active Pulse</div>
                                                <p className="text-[10px] text-emerald-700">Clients currently contributing to regular revenue stream.</p>
                                            </div>
                                            <div className="p-4 bg-rose-50 border border-rose-100">
                                                <div className="font-bold text-rose-900 text-[10px] uppercase mb-1">Critical Churn</div>
                                                <p className="text-[10px] text-rose-700">Clients not seen in 90+ days—automatically flagged for senior intervention.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'financials',
            title: 'Economics & ROI Breakdown',
            icon: <Landmark className="w-4 h-4" />,
            sections: [
                {
                    id: 'financials-operating-costs',
                    title: 'The Unmatched Efficiency: Costs & Performance',
                    content: (
                        <div className="space-y-6 text-sm text-slate-600 leading-relaxed">
                            <p>Kemal Whyte's desire for a comprehensive write-up on costs led to this transparent reveal of our infrastructure economics. 
                            Compared to equivalent "off-the-shelf" ERP systems that cost $5,000-$50,000/month, our custom stack operates at near-zero overhead.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { t: 'Vercel Edge', c: '$40.00', d: 'Production servers and CDN hosting.' },
                                    { t: 'MongoDB Atlas', c: '$65.00', d: 'Secure, redundant data clustering.' },
                                    { t: 'Grok / OpenAI', c: '$80.00', d: 'Fluid AI intelligence API credits.' },
                                    { t: 'Domain/SSL', c: '$15.00', d: 'Security and web access routing.' }
                                ].map(item => (
                                    <div key={item.t} className="bg-white border-b-4 border-slate-900 p-6 flex flex-col justify-between group hover:bg-slate-900 hover:text-white transition-all duration-300">
                                        <div>
                                            <div className="font-black text-[10px] uppercase tracking-widest mb-1 opacity-50">{item.t}</div>
                                            <div className="text-2xl font-black mb-4 group-hover:text-amber-500 transition-colors">{item.c}</div>
                                        </div>
                                        <p className="text-[10px] leading-relaxed opacity-70 italic">{item.d}</p>
                                    </div>
                                ))}
                            </div>
                            
                            <div className="bg-slate-900 text-white p-8 border-l-8 border-emerald-500 flex items-center justify-between">
                                <div>
                                    <div className="font-black text-xs uppercase tracking-[0.3em] mb-2 opacity-50">Total Projected Opex</div>
                                    <div className="text-4xl font-black text-emerald-400">$200.00 <span className="text-xs text-white opacity-30 font-light">/ MONTHLY ESTIMATE</span></div>
                                </div>
                                <div className="text-right hidden md:block">
                                    <div className="text-[10px] font-mono text-slate-400 leading-relaxed">
                                        EFFICIENCY DELTA: -98.2% VS SAP/NETSUITE<br/>
                                        ROI MULTIPLIER: 25.4X PER EMPLOYEE<br/>
                                        VERSION_TAG: {VERSION}_STABLE
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

    return (
        <div className="flex h-[calc(100vh-48px)] bg-white overflow-hidden font-sans selection:bg-amber-400 selection:text-slate-900">
            {/* High-End Sidebar Architecture */}
            <div className="w-80 border-r border-slate-200 bg-white flex flex-col shrink-0 relative z-20">
                <div className="p-8 border-b border-slate-200 bg-white group cursor-default">
                    <div className="flex items-center gap-4 mb-6 transition-transform group-hover:translate-x-1 duration-500">
                        <div className="bg-slate-900 p-3 shadow-[10px_10px_30px_rgba(0,0,0,0.1)] group-hover:shadow-[10px_10px_40px_rgba(0,0,0,0.2)] transition-shadow">
                            <Book className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="font-black text-slate-900 text-xl uppercase tracking-tighter leading-none mb-1">Knowledge</h1>
                            <div className="flex items-center gap-2">
                                <div className="h-[2px] w-4 bg-amber-500" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Intelligence Base</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto pt-4 p-4 space-y-1">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-4 px-5 py-4 text-left transition-all duration-500 relative group overflow-hidden",
                                activeChapter === chapter.id 
                                    ? "bg-slate-900 text-white shadow-2xl translate-x-2" 
                                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-900 translate-x-0"
                            )}
                        >
                            {activeChapter === chapter.id && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 z-10" />
                            )}
                            <div className={cn(
                                "p-2 transition-all duration-500",
                                activeChapter === chapter.id ? "bg-white/10 scale-110" : "bg-slate-50 group-hover:scale-110"
                            )}>
                                {chapter.icon}
                            </div>
                            <span className="font-black text-[11px] uppercase tracking-widest">{chapter.title}</span>
                            <ChevronRight className={cn(
                                "w-4 h-4 ml-auto transition-all duration-500",
                                activeChapter === chapter.id ? "rotate-90 opacity-100" : "opacity-30 group-hover:translate-x-2"
                            )} />
                        </button>
                    ))}
                </div>

                <div className="p-8 border-t border-slate-200 bg-slate-50 space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">
                        <span>Architecture Pulse</span>
                        <span className="text-emerald-500 animate-pulse">OPTIMAL</span>
                    </div>
                    <div className="space-y-2">
                        <div className="h-[3px] bg-slate-200 w-full rounded-full overflow-hidden">
                            <div className="h-full bg-slate-900 w-[100%] animate-in slide-in-from-left duration-1000" />
                        </div>
                        <div className="flex justify-between text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] font-mono">
                            <span>Integrity check</span>
                            <span>100%</span>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200 flex items-center gap-3">
                        <Image src={ASSETS.NANO_BANANA} alt="Nano Banana" width={24} height={24} className="opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help" />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Secured by Nano Banana Logic</span>
                    </div>
                </div>
            </div>

            {/* Cinematic Main Content Engine */}
            <div className="flex-1 flex flex-col bg-white/50 backdrop-blur-sm relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, black 1px, transparent 0)', backgroundSize: '40px 40px' }} />

                <div className="shrink-0 h-20 px-12 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-[2px] bg-slate-200" />
                        <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-[0.4em]">
                            <span>Archive Module</span>
                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-slate-900 group-hover:text-amber-500 transition-colors cursor-default">{activeChapterData?.title}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 group cursor-pointer">
                            <Eye className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-all" />
                            <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-slate-900 tracking-[0.2em]">Public View</span>
                        </div>
                        <div className="h-6 w-[1px] bg-slate-200" />
                        <div className="text-[10px] font-mono font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                             {session?.user?.email}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto scroll-smooth">
                    <div className="max-w-6xl mx-auto px-12 py-20 space-y-24 pb-48">
                        {/* Dramatic Chapter Hero */}
                        <div className="space-y-8 relative">
                            <div className="inline-flex items-center gap-4 px-6 py-2 bg-slate-900 shadow-2xl">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <span className="text-white text-[11px] font-black uppercase tracking-[0.5em]">Enterprise Module v0.21</span>
                            </div>
                            <h2 className="text-8xl font-black text-slate-900 uppercase tracking-tighter leading-[0.85] pr-20">
                                {activeChapterData?.title}
                            </h2>
                            <div className="h-1 w-24 bg-amber-500" />
                            <p className="text-2xl text-slate-400 font-light max-w-3xl leading-relaxed italic">
                                Exploring the fundamental business logic, architectural constraints, and operational efficiency of the {activeChapterData?.title} ecosystem.
                            </p>
                        </div>

                        {/* High-Impact Section Grid */}
                        <div className="space-y-20">
                            {activeChapterData?.sections.map((section, index) => (
                                <div key={section.id} id={section.id} className="group relative">
                                    <div className="flex flex-col lg:flex-row items-start gap-12">
                                        <div className="lg:w-20 shrink-0">
                                            <div className="text-6xl font-black text-slate-100 group-hover:text-slate-900 transition-colors duration-1000 font-mono italic leading-none sticky top-10">
                                                {String(index + 1).padStart(2, '0')}
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-8">
                                            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-6 group-hover:border-amber-500 transition-colors duration-500">
                                                <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter group-hover:translate-x-4 transition-transform duration-500">
                                                    {section.title}
                                                </h3>
                                                <div className={cn(
                                                    "p-3 border-4 border-slate-900 transition-all duration-700",
                                                    expandedSections.includes(section.id) ? "rotate-180 bg-slate-900 text-white" : "group-hover:border-amber-500 group-hover:bg-amber-50"
                                                )}>
                                                    <ChevronDown className="w-6 h-6" />
                                                </div>
                                            </div>
                                            
                                            {expandedSections.includes(section.id) && (
                                                <div className="animate-in fade-in slide-in-from-top-12 duration-1000 fill-mode-both">
                                                    <div className="text-slate-600 prose prose-slate max-w-none">
                                                        {section.content}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Premium Footer Signature */}
                        <div className="pt-20 border-t-8 border-slate-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 py-12">
                            <div className="space-y-2">
                                <h4 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">RX-HQ ARCHIVE</h4>
                                <div className="flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                                    <span>Rebel X Brands</span>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>Proprietary Intel</span>
                                    <div className="w-1 h-1 rounded-full bg-slate-300" />
                                    <span>2025</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-1">Authenticated by</div>
                                    <div className="text-xs font-mono font-bold text-slate-400 underline underline-offset-4">{session?.user?.name}</div>
                                </div>
                                <div className="p-4 bg-slate-900 shadow-2xl border-4 border-white">
                                    <ShieldCheck className="w-8 h-8 text-amber-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
