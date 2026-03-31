import React from 'react';
import Link from 'next/link';
import { 
    Package,
    ArrowRight,
    AlertCircle,
    Box
} from 'lucide-react';

const inventoryReports = [
    {
        title: 'Inventory on hand',
        description: 'Real-time inventory valuation grouped by category',
        href: '/reports/inventory/on-hand',
        icon: Box,
        color: 'blue' as const,
        available: true
    },
    {
        title: 'Re-Order',
        description: 'SKUs low on stock falling below re-order points',
        href: '/reports/inventory/re-order',
        icon: AlertCircle,
        color: 'orange' as const,
        available: true
    }
];

const colorClasses = {
    blue: 'from-blue-500 to-blue-600 shadow-blue-500/30 text-white',
    orange: 'from-orange-500 to-orange-600 shadow-orange-500/30 text-white',
};

export default function InventoryIndexPage() {
    return (
        <div className="flex flex-col h-[calc(100vh-40px)] bg-background text-foreground overflow-y-auto overflow-x-hidden scrollbar-custom">
            <div className="max-w-6xl mx-auto w-full p-8 pb-20">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold uppercase tracking-widest">
                        <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
                        <span>/</span>
                        <span>Reports</span>
                        <span>/</span>
                        <span className="text-foreground">Inventory</span>
                    </div>
                </div>

                {/* Report Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {inventoryReports.map((report, idx) => {
                        const Icon = report.icon;
                        return (
                            <Link 
                                href={report.available ? report.href : '#'} 
                                key={idx}
                                className={`group relative flex flex-col p-6 rounded-2xl bg-card border border-border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden ${
                                    !report.available ? 'opacity-60 cursor-not-allowed grayscale' : ''
                                }`}
                            >
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br opacity-5 group-hover:opacity-10 rounded-bl-full transition-opacity duration-300" />
                                
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[report.color]} flex items-center justify-center`}>
                                        <Icon className="w-6 h-6" />
                                    </div>
                                    {report.available ? (
                                        <div className="w-8 h-8 rounded-full bg-secondary text-muted-foreground flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-all">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-1 rounded-md uppercase tracking-wider">
                                            Coming Soon
                                        </span>
                                    )}
                                </div>

                                <div className="relative z-10 mt-auto">
                                    <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-indigo-500 transition-colors">
                                        {report.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {report.description}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
