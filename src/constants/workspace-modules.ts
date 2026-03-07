/**
 * Master blueprint for all modules, sub-modules, and their fields.
 * This is the single source of truth used when creating workspaces.
 * When a module is enabled, all its sub-modules and fields default to enabled/visible.
 */

export interface FieldBlueprint {
    field: string;
    label: string;
}

export interface SubModuleBlueprint {
    key: string;
    label: string;
    route: string;
    fields: FieldBlueprint[];
}

export interface ModuleBlueprint {
    key: string;
    label: string;
    icon: string; // lucide icon name
    subModules: SubModuleBlueprint[];
}

export const MODULE_BLUEPRINTS: ModuleBlueprint[] = [
    {
        key: 'admin',
        label: 'Admin',
        icon: 'settings',
        subModules: [
            {
                key: 'users',
                label: 'Users',
                route: '/admin/users',
                fields: [
                    { field: 'firstName', label: 'First Name' },
                    { field: 'lastName', label: 'Last Name' },
                    { field: 'email', label: 'Email' },
                    { field: 'phone', label: 'Phone' },
                    { field: 'role', label: 'Role' },
                    { field: 'department', label: 'Department' },
                    { field: 'hourlyRate', label: 'Hourly Rate' },
                    { field: 'status', label: 'Status' },
                ],
            },
            {
                key: 'settings',
                label: 'General Settings',
                route: '/admin/settings',
                fields: [
                    { field: 'companyName', label: 'Company Name' },
                    { field: 'timezone', label: 'Timezone' },
                    { field: 'language', label: 'Language' },
                    { field: 'currency', label: 'Currency' },
                ],
            },
        ],
    },
    {
        key: 'crm',
        label: 'CRM',
        icon: 'users-round',
        subModules: [
            {
                key: 'inbox',
                label: 'Inbox',
                route: '/crm/inbox',
                fields: [
                    { field: 'subject', label: 'Subject' },
                    { field: 'from', label: 'From' },
                    { field: 'date', label: 'Date' },
                    { field: 'body', label: 'Body' },
                ],
            },
            {
                key: 'clients',
                label: 'Clients',
                route: '/crm/clients',
                fields: [
                    { field: 'name', label: 'Name' },
                    { field: 'email', label: 'Email' },
                    { field: 'phone', label: 'Phone' },
                    { field: 'company', label: 'Company' },
                    { field: 'address', label: 'Address' },
                    { field: 'revenue', label: 'Revenue' },
                    { field: 'status', label: 'Status' },
                ],
            },
            {
                key: 'leads',
                label: 'Leads',
                route: '/crm/leads',
                fields: [
                    { field: 'name', label: 'Name' },
                    { field: 'email', label: 'Email' },
                    { field: 'phone', label: 'Phone' },
                    { field: 'source', label: 'Source' },
                    { field: 'status', label: 'Status' },
                    { field: 'assignedTo', label: 'Assigned To' },
                ],
            },
            {
                key: 'activities',
                label: 'Activities',
                route: '/crm/activities',
                fields: [
                    { field: 'type', label: 'Type' },
                    { field: 'description', label: 'Description' },
                    { field: 'date', label: 'Date' },
                    { field: 'client', label: 'Client' },
                ],
            },
            {
                key: 'tasks',
                label: 'Tasks',
                route: '/crm/tasks',
                fields: [
                    { field: 'title', label: 'Title' },
                    { field: 'description', label: 'Description' },
                    { field: 'priority', label: 'Priority' },
                    { field: 'status', label: 'Status' },
                    { field: 'assignee', label: 'Assignee' },
                    { field: 'dueDate', label: 'Due Date' },
                ],
            },
            {
                key: 'retention',
                label: 'Retention',
                route: '/crm/retention',
                fields: [
                    { field: 'client', label: 'Client' },
                    { field: 'lastOrder', label: 'Last Order' },
                    { field: 'status', label: 'Status' },
                    { field: 'action', label: 'Action' },
                ],
            },
            {
                key: 'connections',
                label: 'App Connections',
                route: '/crm/connections',
                fields: [
                    { field: 'service', label: 'Service' },
                    { field: 'status', label: 'Status' },
                    { field: 'lastSync', label: 'Last Sync' },
                ],
            },
        ],
    },
    {
        key: 'sales',
        label: 'Sales',
        icon: 'truck',
        subModules: [
            {
                key: 'wholesale-orders',
                label: 'Wholesale Orders',
                route: '/sales/wholesale-orders',
                fields: [
                    { field: 'orderNumber', label: 'Order Number' },
                    { field: 'client', label: 'Client' },
                    { field: 'date', label: 'Date' },
                    { field: 'status', label: 'Status' },
                    { field: 'total', label: 'Total' },
                    { field: 'cost', label: 'Cost' },
                    { field: 'materialCost', label: 'Material Cost' },
                    { field: 'laborCost', label: 'Labor Cost' },
                    { field: 'packagingCost', label: 'Packaging Cost' },
                    { field: 'lineItems', label: 'Line Items' },
                    { field: 'payments', label: 'Payments' },
                    { field: 'notes', label: 'Notes' },
                ],
            },
            {
                key: 'web-orders',
                label: 'Web Orders',
                route: '/sales/web-orders',
                fields: [
                    { field: 'orderNumber', label: 'Order Number' },
                    { field: 'customer', label: 'Customer' },
                    { field: 'date', label: 'Date' },
                    { field: 'status', label: 'Status' },
                    { field: 'total', label: 'Total' },
                    { field: 'cost', label: 'Cost' },
                    { field: 'materialCost', label: 'Material Cost' },
                    { field: 'laborCost', label: 'Labor Cost' },
                    { field: 'packagingCost', label: 'Packaging Cost' },
                    { field: 'site', label: 'Website' },
                ],
            },
            {
                key: 'subscriptions',
                label: 'Subscriptions',
                route: '/sales/subscriptions',
                fields: [
                    { field: 'client', label: 'Client' },
                    { field: 'plan', label: 'Plan' },
                    { field: 'status', label: 'Status' },
                    { field: 'nextBilling', label: 'Next Billing' },
                    { field: 'amount', label: 'Amount' },
                ],
            },
        ],
    },
    {
        key: 'warehouse',
        label: 'Warehouse',
        icon: 'database',
        subModules: [
            {
                key: 'skus',
                label: 'SKUs',
                route: '/warehouse/skus',
                fields: [
                    { field: 'code', label: 'SKU Code' },
                    { field: 'name', label: 'Name' },
                    { field: 'category', label: 'Category' },
                    { field: 'price', label: 'Price' },
                    { field: 'cost', label: 'Cost' },
                    { field: 'stock', label: 'Stock' },
                    { field: 'image', label: 'Image' },
                ],
            },
            {
                key: 'manufacturing',
                label: 'Manufacturing',
                route: '/warehouse/manufacturing',
                fields: [
                    { field: 'orderNumber', label: 'Order Number' },
                    { field: 'recipe', label: 'Recipe' },
                    { field: 'status', label: 'Status' },
                    { field: 'startDate', label: 'Start Date' },
                    { field: 'endDate', label: 'End Date' },
                    { field: 'cost', label: 'Cost' },
                ],
            },
            {
                key: 'web-products',
                label: 'Web Products',
                route: '/warehouse/web-products',
                fields: [
                    { field: 'name', label: 'Name' },
                    { field: 'sku', label: 'SKU' },
                    { field: 'price', label: 'Price' },
                    { field: 'stock', label: 'Stock' },
                    { field: 'website', label: 'Website' },
                ],
            },
            {
                key: 'opening-balances',
                label: 'Opening Balances',
                route: '/warehouse/opening-balances',
                fields: [
                    { field: 'sku', label: 'SKU' },
                    { field: 'quantity', label: 'Quantity' },
                    { field: 'cost', label: 'Cost' },
                    { field: 'date', label: 'Date' },
                ],
            },
            {
                key: 'audit-adjustments',
                label: 'Audit Adjustments',
                route: '/warehouse/audit-adjustments',
                fields: [
                    { field: 'sku', label: 'SKU' },
                    { field: 'adjustment', label: 'Adjustment' },
                    { field: 'reason', label: 'Reason' },
                    { field: 'date', label: 'Date' },
                ],
            },
            {
                key: 'purchase-orders',
                label: 'Purchase Orders',
                route: '/warehouse/purchase-orders',
                fields: [
                    { field: 'poNumber', label: 'PO Number' },
                    { field: 'vendor', label: 'Vendor' },
                    { field: 'date', label: 'Date' },
                    { field: 'status', label: 'Status' },
                    { field: 'total', label: 'Total' },
                ],
            },
            {
                key: 'recipes',
                label: 'Recipes',
                route: '/warehouse/recipes',
                fields: [
                    { field: 'name', label: 'Name' },
                    { field: 'category', label: 'Category' },
                    { field: 'yield', label: 'Yield' },
                    { field: 'cost', label: 'Cost' },
                ],
            },
            {
                key: 'vendors',
                label: 'Vendors',
                route: '/warehouse/vendors',
                fields: [
                    { field: 'name', label: 'Name' },
                    { field: 'email', label: 'Email' },
                    { field: 'phone', label: 'Phone' },
                    { field: 'address', label: 'Address' },
                ],
            },
            {
                key: 'inventory',
                label: 'Inventory',
                route: '/warehouse/inventory',
                fields: [
                    { field: 'sku', label: 'SKU' },
                    { field: 'onHand', label: 'On Hand' },
                    { field: 'committed', label: 'Committed' },
                    { field: 'available', label: 'Available' },
                ],
            },
        ],
    },
    {
        key: 'reports',
        label: 'Reports',
        icon: 'bar-chart-3',
        subModules: [
            {
                key: 'dashboard',
                label: 'Dashboard',
                route: '/reports/dashboard',
                fields: [
                    { field: 'kpis', label: 'KPIs' },
                    { field: 'aiInsights', label: 'AI Insights' },
                    { field: 'clientRetention', label: 'Client Retention' },
                ],
            },
            {
                key: 'financials',
                label: 'Financials',
                route: '/reports/financials',
                fields: [
                    { field: 'revenue', label: 'Revenue' },
                    { field: 'costs', label: 'Costs' },
                    { field: 'profit', label: 'Profit' },
                    { field: 'margins', label: 'Margins' },
                ],
            },
            {
                key: 'business',
                label: 'Business',
                route: '/reports/business',
                fields: [
                    { field: 'metrics', label: 'Metrics' },
                    { field: 'trends', label: 'Trends' },
                    { field: 'forecasts', label: 'Forecasts' },
                ],
            },
        ],
    },
    {
        key: 'help',
        label: 'Help',
        icon: 'help-circle',
        subModules: [
            {
                key: 'tickets',
                label: 'Tickets',
                route: '/help/tickets',
                fields: [
                    { field: 'ticketId', label: 'Ticket ID' },
                    { field: 'subject', label: 'Subject' },
                    { field: 'requestedBy', label: 'Requested By' },
                    { field: 'priority', label: 'Priority' },
                    { field: 'status', label: 'Status' },
                    { field: 'department', label: 'Department' },
                    { field: 'description', label: 'Description' },
                ],
            },
        ],
    },
];

/**
 * Utility: Generate a full workspace modules array from blueprints.
 * All modules/sub-modules start disabled, all fields visible.
 */
export function generateDefaultModules() {
    return MODULE_BLUEPRINTS.map(mod => ({
        key: mod.key,
        label: mod.label,
        icon: mod.icon,
        enabled: false,
        subModules: mod.subModules.map(sub => ({
            key: sub.key,
            label: sub.label,
            route: sub.route,
            enabled: false,
            crud: { create: true, read: true, update: true, delete: true },
            fields: sub.fields.map(f => ({
                field: f.field,
                label: f.label,
                visible: true,
            })),
        })),
    }));
}
