import {
    Users, Settings, UsersRound, Activity, ShoppingCart, CreditCard,
    Globe, Package, Clock, Database, Factory, Truck, BookOpen,
    Store, BarChart3, PieChart, LineChart, Scale, LayoutDashboard,
    HelpCircle, Ticket, ClipboardCheck, Target, AlertTriangle, CircleDollarSign
} from 'lucide-react';

export const MENU_ITEMS = [
    {
        title: 'Admin',
        icon: Settings,
        items: [
            { title: 'Users', href: '/admin/users', icon: Users },
            { title: 'General Settings', href: '/admin/settings', icon: Settings },
        ]
    },
    {
        title: 'CRM',
        icon: UsersRound,
        items: [
            { title: 'Clients', href: '/crm/clients', icon: UsersRound },
            { title: 'Activities', href: '/crm/activities', icon: Activity },
            { title: 'App Connections', href: '/crm/connections', icon: Globe },
            { title: 'Retention', href: '/crm/retention', icon: Target },
        ]
    },
    {
        title: 'Sales',
        icon: Truck,
        items: [
            { title: 'Wholesale Orders', href: '/sales/wholesale-orders', icon: ShoppingCart },
            { title: 'Web Orders', href: '/sales/web-orders', icon: Globe },
            { title: 'Subscriptions', href: '/sales/subscriptions', icon: Clock },
        ]
    },
    {
        title: 'Warehouse',
        icon: Database,
        items: [
            { title: 'SKUs', href: '/warehouse/skus', icon: Database },
            { title: 'Manufacturing', href: '/warehouse/manufacturing', icon: Factory },
            { title: 'Web Products', href: '/warehouse/web-products', icon: Package },
            { title: 'Opening Balances', href: '/warehouse/opening-balances', icon: Scale },
            { title: 'Audit Adjustments', href: '/warehouse/audit-adjustments', icon: ClipboardCheck },
            { title: 'Purchase Orders', href: '/warehouse/purchase-orders', icon: ShoppingCart },
            { title: 'Recipes', href: '/warehouse/recipes', icon: BookOpen },
            { title: 'Vendors', href: '/warehouse/vendors', icon: Truck },
        ]
    },
    {
        title: 'Reports',
        icon: BarChart3,
        items: [
            { title: 'Dashboard', href: '/reports/dashboard', icon: LayoutDashboard },
            { title: 'Financials', href: '/reports/financials', icon: LineChart },
            { title: 'Inventory', href: '/reports/inventory', icon: Package },
            { title: 'Business', href: '/reports/business', icon: PieChart },
            { title: 'Waiting on Lot', href: '/reports/waiting-on-lot', icon: AlertTriangle },
            { title: 'Missing Cost', href: '/reports/missing-cost', icon: CircleDollarSign },
        ]
    },
    {
        title: 'Help',
        icon: HelpCircle,
        items: [
            { title: 'Tickets', href: '/help/tickets', icon: Ticket },
        ]
    }
];
