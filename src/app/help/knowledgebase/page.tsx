'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
    Book, ChevronRight, ChevronDown, Home, Package, ShoppingCart, Users, BarChart3,
    Wrench, Brain, Shield, Zap, Target, Layers, Box, FileText, Settings, HelpCircle,
    AlertTriangle, CheckCircle2, Truck, DollarSign, PieChart, Activity, Clock,
    Lock, Server, Globe, Database, Cpu, RefreshCw
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
    const [expandedSections, setExpandedSections] = useState<string[]>(['overview-intro']);

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
                    title: 'Introduction to Rebel X Headquarter Pro',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p><strong className="text-slate-900">Rebel X Headquarter Pro</strong> is a comprehensive Enterprise Resource Planning (ERP) system designed specifically for Rebel X Brands. Unlike traditional CRM systems, this platform functions as a complete business operating system, comparable to having 100 experienced managers working simultaneously across all departments.</p>
                            <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
                                <p className="font-bold text-slate-900">Version: {VERSION}</p>
                                <p className="text-xs text-slate-500">Status: Beta Phase | Monthly Operating Cost: ~$200</p>
                            </div>
                            <p>The system was developed to address scalability concerns with AppSheet, providing a low-maintenance, highly integrated solution that connects seamlessly with existing websites, shipping services, and communication platforms.</p>
                            <h4 className="font-bold text-slate-900 pt-2">Core Capabilities:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>SKU & Inventory Management</strong> - Complete product lifecycle tracking with lot-level traceability</li>
                                <li><strong>Manufacturing & COGM</strong> - Automated work orders with real-time cost analysis</li>
                                <li><strong>Multi-Website Integration</strong> - Connected to KINGKKRATOM, GRASSROOTSHARVEST, GRHKTATOM, REBELXBRANDS</li>
                                <li><strong>AI-Powered Insights</strong> - Neural board with Grok AI integration for business intelligence</li>
                                <li><strong>CRM & Retention</strong> - Client management with automated follow-up task generation</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'overview-architecture',
                    title: 'System Architecture',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The platform is built on modern web technologies ensuring scalability, performance, and seamless integration capabilities.</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <div className="flex items-center gap-2 mb-2"><Server className="w-4 h-4 text-blue-600" /><span className="font-bold text-slate-900">Frontend</span></div>
                                    <p className="text-xs">Next.js 14 with React, TypeScript, and Tailwind CSS for a responsive, modern interface.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <div className="flex items-center gap-2 mb-2"><Database className="w-4 h-4 text-emerald-600" /><span className="font-bold text-slate-900">Database</span></div>
                                    <p className="text-xs">MongoDB Atlas for flexible document storage with Mongoose ODM.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <div className="flex items-center gap-2 mb-2"><Globe className="w-4 h-4 text-purple-600" /><span className="font-bold text-slate-900">APIs</span></div>
                                    <p className="text-xs">WooCommerce REST API integration for all connected websites.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <div className="flex items-center gap-2 mb-2"><Cpu className="w-4 h-4 text-amber-600" /><span className="font-bold text-slate-900">AI Engine</span></div>
                                    <p className="text-xs">Grok AI integration for neural insights and business intelligence.</p>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 pt-2">The system is designed for easy integration with Shopify, ShipStation, Google Voice, WhatsApp, and other platforms as needed—described as "microscopic tasks" in terms of development effort.</p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'dashboard',
            title: 'Dashboard & AI',
            icon: <Brain className="w-4 h-4" />,
            sections: [
                {
                    id: 'dashboard-overview',
                    title: 'Dashboard Overview',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>Dashboard</strong> serves as the command center, providing at-a-glance business health metrics and AI-powered insights.</p>
                            <h4 className="font-bold text-slate-900">Key Metrics Displayed:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Business Health Score</strong> - Real-time percentage indicating overall operational health</li>
                                <li><strong>Revenue & Profit</strong> - Total revenue, gross profit, and net income with trend indicators</li>
                                <li><strong>Order Statistics</strong> - Web orders and wholesale orders counts with comparisons</li>
                                <li><strong>Top Selling Products</strong> - Best performers by revenue with quantity sold</li>
                                <li><strong>Recent Orders</strong> - Latest transactions across all channels</li>
                            </ul>
                            <h4 className="font-bold text-slate-900 pt-2">Date Filtering:</h4>
                            <p>All dashboard metrics can be filtered by: This Month, Last Month, Last 3 Months, or This Year.</p>
                        </div>
                    )
                },
                {
                    id: 'dashboard-neural',
                    title: 'Neural Board & AI Insights',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>Neural Board</strong> is powered by Grok AI and provides intelligent analysis across six critical business dimensions:</p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: <DollarSign className="w-4 h-4" />, title: 'Revenue Analysis', desc: 'Sales trends, growth patterns, and revenue optimization opportunities' },
                                    { icon: <PieChart className="w-4 h-4" />, title: 'Capital Efficiency', desc: 'Cash flow, inventory turnover, and capital utilization metrics' },
                                    { icon: <Users className="w-4 h-4" />, title: 'Customer Pulse', desc: 'Customer behavior patterns, retention rates, and satisfaction indicators' },
                                    { icon: <Activity className="w-4 h-4" />, title: 'Team Performance', desc: 'Employee productivity, task completion rates, and departmental efficiency' },
                                    { icon: <Package className="w-4 h-4" />, title: 'Stock Health', desc: 'Inventory levels, reorder alerts, and stock movement analysis' },
                                    { icon: <Wrench className="w-4 h-4" />, title: 'Operational Load', desc: 'Manufacturing capacity, bottlenecks, and workflow optimization' }
                                ].map(item => (
                                    <div key={item.title} className="bg-slate-50 border border-slate-200 p-3">
                                        <div className="flex items-center gap-2 text-slate-900 font-bold">{item.icon}{item.title}</div>
                                        <p className="text-xs mt-1">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                            <h4 className="font-bold text-slate-900 pt-2">AI Chat Interface:</h4>
                            <p>Users can query the AI directly about their business. The system connects to live data streams to provide specific, data-driven insights in real-time.</p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'warehouse',
            title: 'Warehouse Management',
            icon: <Package className="w-4 h-4" />,
            sections: [
                {
                    id: 'warehouse-skus',
                    title: 'SKUs (Stock Keeping Units)',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>SKUs page</strong> is the master product database containing all inventory items with comprehensive details.</p>
                            <h4 className="font-bold text-slate-900">Product Information Displayed:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Product image, name, category, sub-category, material type</li>
                                <li>Unit of Measure (UOM), sale price, current stock quantity</li>
                                <li>Financial metrics: Revenue, COGS, COGM, Gross Profit</li>
                                <li>Tier classification (1, 2, or 3) based on performance</li>
                            </ul>
                            <h4 className="font-bold text-slate-900 pt-2">SKU Detail View:</h4>
                            <p>Clicking any SKU opens a detailed view showing:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Available Lots</strong> - Each lot with its cost of goods manufactured, quantity, and expiration</li>
                                <li><strong>Transaction Ledger</strong> - Complete history from day one showing all stock movements</li>
                                <li><strong>Lot-Level Analytics</strong> - Total revenue, total sales, and gross profit per lot</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'warehouse-ledger',
                    title: 'Inventory Ledger & FIFO System',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system implements a sophisticated <strong>First-In-First-Out (FIFO)</strong> inventory management system with full traceability.</p>
                            <h4 className="font-bold text-slate-900">Ledger Features:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Complete transaction history from day one</li>
                                <li>Stock levels tracked by lot number</li>
                                <li>Automatic lot number suggestions based on FIFO</li>
                                <li>Manual lot number override capability</li>
                                <li>Filtering by date range, lot number, or transaction type</li>
                                <li>Audit trail for transactions missing lot numbers or costs</li>
                            </ul>
                            <div className="bg-amber-50 border border-amber-200 p-3 mt-3">
                                <div className="flex items-center gap-2 text-amber-800 font-bold"><AlertTriangle className="w-4 h-4" />Important</div>
                                <p className="text-xs text-amber-700 mt-1">Lot numbers are applied automatically but can be changed when needed. The system highlights transactions without lot numbers or costs for auditing purposes.</p>
                            </div>
                        </div>
                    )
                },
                {
                    id: 'warehouse-manufacturing',
                    title: 'Manufacturing & Work Orders',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>Manufacturing module</strong> enables automated work order creation with comprehensive cost analysis.</p>
                            <h4 className="font-bold text-slate-900">Work Order Process:</h4>
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>Select the output SKU and associated recipe</li>
                                <li>System automatically generates work order with all line items</li>
                                <li>Materials are pulled from inventory with lot tracking</li>
                                <li>Labor time is tracked via live counter</li>
                                <li>Cost analysis is calculated in real-time</li>
                            </ol>
                            <h4 className="font-bold text-slate-900 pt-2">Cost Analysis Breakdown:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Material Costs</strong> - Raw ingredients and components</li>
                                <li><strong>Packaging Costs</strong> - Bottles, labels, boxes, etc.</li>
                                <li><strong>Labor Costs</strong> - Based on hourly rates and tracked time</li>
                                <li><strong>Cost Per Unit</strong> - Total COGM divided by output quantity</li>
                            </ul>
                            <h4 className="font-bold text-slate-900 pt-2">Labor Tracking:</h4>
                            <p>A live counter tracks production time with optional automatic shutoff based on recipe time constraints. Labor cost is calculated using the assigned employee's hourly rate.</p>
                        </div>
                    )
                },
                {
                    id: 'warehouse-recipes',
                    title: 'Recipes Management',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p><strong>Recipes</strong> define the bill of materials and production steps for manufactured products.</p>
                            <h4 className="font-bold text-slate-900">Recipe Components:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Header</strong> - Recipe name, output SKU, yield quantity, UOM</li>
                                <li><strong>Line Items</strong> - Required materials with quantities</li>
                                <li><strong>Steps</strong> - Production instructions with time estimates</li>
                            </ul>
                            <p className="pt-2">Recipes can be copied to create variations, and bulk import is available via CSV for recipes, line items, and steps.</p>
                        </div>
                    )
                },
                {
                    id: 'warehouse-other',
                    title: 'Additional Warehouse Pages',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <div className="space-y-3">
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <p className="font-bold text-slate-900">Web Products</p>
                                    <p className="text-xs">Synced products from all connected websites (276+ products). Supports incremental and full sync with WooCommerce stores.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <p className="font-bold text-slate-900">Purchase Orders</p>
                                    <p className="text-xs">Manage vendor purchases, track receiving, and update inventory with proper lot assignment.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <p className="font-bold text-slate-900">Vendors</p>
                                    <p className="text-xs">Supplier database with contact information, payment terms, and purchase history.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <p className="font-bold text-slate-900">Opening Balances</p>
                                    <p className="text-xs">Initialize inventory quantities and costs when starting the system or adding new lots.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <p className="font-bold text-slate-900">Audit Adjustments</p>
                                    <p className="text-xs">Record inventory adjustments with reasons for auditing and reconciliation.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <p className="font-bold text-slate-900">Lab Results</p>
                                    <p className="text-xs">Track lab testing status, results, and certifications for products.</p>
                                </div>
                                <div className="bg-slate-50 border border-slate-200 p-3">
                                    <p className="font-bold text-slate-900">Kits</p>
                                    <p className="text-xs">Bundle products together as kits with component tracking.</p>
                                </div>
                            </div>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'sales',
            title: 'Sales & Orders',
            icon: <ShoppingCart className="w-4 h-4" />,
            sections: [
                {
                    id: 'sales-weborders',
                    title: 'Web Orders',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The system is connected to all existing websites and can fetch <strong>nearly 20,000 web orders</strong> from day one.</p>
                            <div className="bg-amber-50 border border-amber-200 p-3">
                                <p className="text-xs text-amber-700"><strong>Note:</strong> Approximately 14,000-15,000 of historical orders are identified as spam.</p>
                            </div>
                            <h4 className="font-bold text-slate-900">Order Information Available:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Order status (pending, processing, completed, cancelled)</li>
                                <li>Customer details and contact information</li>
                                <li>Shipping address and method</li>
                                <li>Line items with SKU linking capability</li>
                                <li>Financial details (subtotal, tax, shipping, total)</li>
                                <li>Metadata (IP address, payment status, payment method)</li>
                            </ul>
                            <h4 className="font-bold text-slate-900 pt-2">SKU Linking:</h4>
                            <p>Web products (which may have different names) can be linked to the internal SKU lineup. Once linked, the system automatically applies lot numbers to all associated transactions and reduces quantity from the main SKU ledger.</p>
                        </div>
                    )
                },
                {
                    id: 'sales-wholesale',
                    title: 'Wholesale Orders',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p><strong>Wholesale Orders</strong> manages B2B transactions with retail clients.</p>
                            <h4 className="font-bold text-slate-900">Features:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Client-linked orders with history tracking</li>
                                <li>Line items with lot number assignment</li>
                                <li>Status workflow (Draft, Confirmed, Shipped, Delivered, Cancelled)</li>
                                <li>Invoice generation and payment tracking</li>
                                <li>Integration with CRM client records</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'sales-subscriptions',
                    title: 'Subscriptions',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Manages recurring subscription orders from websites.</p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'crm',
            title: 'CRM & Retention',
            icon: <Users className="w-4 h-4" />,
            sections: [
                {
                    id: 'crm-clients',
                    title: 'Client Management',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>CRM module</strong> provides comprehensive client relationship management linked to all sales channels.</p>
                            <h4 className="font-bold text-slate-900">Client Information:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Contact details (phones, emails, addresses)</li>
                                <li>Company information and contacts</li>
                                <li>Order history and lifetime value</li>
                                <li>Activity log and communication history</li>
                                <li>Last contact date and engagement status</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'crm-retention',
                    title: 'Retention Command Center',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>Retention Command Center</strong> is a powerful tool for managing client follow-ups and preventing churn.</p>
                            <h4 className="font-bold text-slate-900">Client Segmentation:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Active Clients</strong> - Recently engaged customers</li>
                                <li><strong>30+ Days Inactive</strong> - Needs attention</li>
                                <li><strong>60+ Days Inactive</strong> - At risk</li>
                                <li><strong>90+ Days Inactive</strong> - Critical risk</li>
                            </ul>
                            <h4 className="font-bold text-slate-900 pt-2">Magic Button - Auto Task Generation:</h4>
                            <p>The system can automatically generate follow-up tasks for sales representatives based on client inactivity. This feature can create hundreds of prioritized tasks instantly, assigned to team members with appropriate due dates.</p>
                            <h4 className="font-bold text-slate-900 pt-2">Task Types:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Followup Call / Email</li>
                                <li>Check-in</li>
                                <li>Re-engagement</li>
                                <li>Win-back</li>
                                <li>Feedback Request</li>
                            </ul>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'reports',
            title: 'Reports & Analytics',
            icon: <BarChart3 className="w-4 h-4" />,
            sections: [
                {
                    id: 'reports-income',
                    title: 'Income Statement',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The <strong>Income Statement</strong> provides comprehensive P&L analysis with customizable date ranges.</p>
                            <h4 className="font-bold text-slate-900">Sections:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Revenue</strong> - Web orders, wholesale orders, other income</li>
                                <li><strong>Cost of Goods Sold</strong> - Direct costs, COGM</li>
                                <li><strong>Gross Profit</strong> - Revenue minus COGS</li>
                                <li><strong>Operating Expenses</strong> - Labor, overhead, marketing</li>
                                <li><strong>Net Income</strong> - Final profit/loss</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'reports-cogm',
                    title: 'Cost of Goods Manufactured',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p><strong>COGM Report</strong> analyzes manufacturing costs across all production.</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Material cost breakdown by SKU</li>
                                <li>Labor cost analysis</li>
                                <li>Cost per unit trends</li>
                                <li>Production efficiency metrics</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'reports-other',
                    title: 'Other Reports',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Business Report</strong> - Overall business performance metrics</li>
                                <li><strong>Activity Report</strong> - Team activity and productivity</li>
                            </ul>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'admin',
            title: 'Administration',
            icon: <Settings className="w-4 h-4" />,
            sections: [
                {
                    id: 'admin-users',
                    title: 'User Management',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Manage system users with role-based access control.</p>
                            <h4 className="font-bold text-slate-900">User Roles:</h4>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>SuperAdmin</strong> - Full system access</li>
                                <li><strong>Admin</strong> - Administrative functions including Knowledge Base</li>
                                <li><strong>Executive Assistant</strong> - Operations support</li>
                                <li><strong>Sales Director / Sales / Sales Executive</strong> - Sales operations</li>
                                <li><strong>QC</strong> - Quality control functions</li>
                                <li><strong>Warehouse</strong> - Inventory operations</li>
                                <li><strong>Manager</strong> - Departmental management</li>
                                <li><strong>Shipping</strong> - Order fulfillment</li>
                            </ul>
                        </div>
                    )
                },
                {
                    id: 'admin-settings',
                    title: 'System Settings',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Configure system-wide settings including:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Default images and branding</li>
                                <li>Data filtering start date</li>
                                <li>Dropdown options (categories, materials, etc.)</li>
                                <li>Integration credentials</li>
                            </ul>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'integrations',
            title: 'Integrations',
            icon: <RefreshCw className="w-4 h-4" />,
            sections: [
                {
                    id: 'integrations-websites',
                    title: 'Website Integration',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>The CRM is linked to all websites enabling direct product management without logging into WordPress:</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Edit, add, or delete products</li>
                                <li>Update stock quantities</li>
                                <li>Sync orders and customers</li>
                                <li>Currently synced: 276+ products across 4 websites</li>
                            </ul>
                            <h4 className="font-bold text-slate-900 pt-2">Platform Compatibility:</h4>
                            <p>The system is designed for easy switching to other platforms like Shopify—only requiring API connection changes.</p>
                        </div>
                    )
                },
                {
                    id: 'integrations-future',
                    title: 'Planned Integrations',
                    content: (
                        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                            <p>Upcoming integrations (described as "microscopic tasks"):</p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>ShipStation</strong> - Order fulfillment and shipping management</li>
                                <li><strong>Google Voice</strong> - Call logging and communication</li>
                                <li><strong>WhatsApp</strong> - Customer communication</li>
                                <li><strong>Shopify</strong> - Alternative e-commerce platform</li>
                            </ul>
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
                        <Book className="w-5 h-5 text-slate-700" />
                        <h1 className="font-bold text-slate-900 text-sm uppercase tracking-tight">Knowledge Base</h1>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{VERSION}</p>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {chapters.map(chapter => (
                        <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter.id)}
                            className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition-colors",
                                activeChapter === chapter.id 
                                    ? "bg-slate-900 text-white" 
                                    : "text-slate-600 hover:bg-slate-200"
                            )}
                        >
                            {chapter.icon}
                            {chapter.title}
                        </button>
                    ))}
                </div>
                <div className="p-3 border-t border-slate-200 bg-slate-100">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Rebel X Headquarter Pro</p>
                    <p className="text-[10px] text-slate-400">Enterprise Resource Planning</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="shrink-0 px-6 py-4 border-b border-slate-200 bg-slate-50/30">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <span>Knowledge Base</span>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-slate-900 font-bold">{activeChapterData?.title}</span>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl space-y-4">
                        {activeChapterData?.sections.map(section => (
                            <div key={section.id} className="border border-slate-200 bg-white">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                                >
                                    <span className="font-bold text-slate-900 text-sm">{section.title}</span>
                                    {expandedSections.includes(section.id) 
                                        ? <ChevronDown className="w-4 h-4 text-slate-400" /> 
                                        : <ChevronRight className="w-4 h-4 text-slate-400" />
                                    }
                                </button>
                                {expandedSections.includes(section.id) && (
                                    <div className="px-4 pb-4 border-t border-slate-100">
                                        <div className="pt-4">{section.content}</div>
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
