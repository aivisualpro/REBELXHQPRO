'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import {
    ArrowLeft,
    Calendar,
    ChevronRight,
    Download,
    Filter,
    Loader2,
    Search,
    TrendingUp,
    Users,
    DollarSign,
    ShoppingCart,
    X,
    Percent,
    Award,
    FileText,
    ChevronDown
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CommissionOrder {
    _id: string;
    label: string;
    clientId: { _id: string; name: string } | string;
    salesRep: { _id: string; firstName: string; lastName: string } | string;
    orderStatus: string;
    createdAt: string;
    lineItems: Array<{
        sku: { _id: string; name: string } | string;
        qtyShipped: number;
        price: number;
        cost?: number;
    }>;
    _subtotal: number;
    _commission: number;
}

interface RepSummary {
    _id: { _id: string; firstName: string; lastName: string } | string | null;
    totalOrders: number;
    totalRevenue: number;
    totalCommission: number;
}

interface GrandTotal {
    totalOrders: number;
    totalRevenue: number;
    totalCommission: number;
}

// ─── Date Helpers (non-timezone) ────────────────────────────────────────────

const getLocalDateString = (year: number, month: number, day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

type DatePreset = 'this_month' | 'last_month' | 'this_year' | 'custom';

function getPresetRange(preset: DatePreset): { startDate: string; endDate: string } {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();

    switch (preset) {
        case 'this_month':
            return {
                startDate: getLocalDateString(y, m, 1),
                endDate: getLocalDateString(y, m, d),
            };
        case 'last_month': {
            const firstLM = new Date(y, m - 1, 1);
            const lastLM = new Date(y, m, 0);
            return {
                startDate: getLocalDateString(firstLM.getFullYear(), firstLM.getMonth(), 1),
                endDate: getLocalDateString(lastLM.getFullYear(), lastLM.getMonth(), lastLM.getDate()),
            };
        }
        case 'this_year':
            return {
                startDate: getLocalDateString(y, 0, 1),
                endDate: getLocalDateString(y, m, d),
            };
        default:
            return {
                startDate: getLocalDateString(y, m, 1),
                endDate: getLocalDateString(y, m, d),
            };
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getClientName(o: CommissionOrder) {
    return typeof o.clientId === 'object' && o.clientId !== null ? o.clientId.name : String(o.clientId || '');
}

function getSalesRepName(rep: CommissionOrder['salesRep'] | RepSummary['_id']) {
    if (!rep) return 'Unassigned';
    if (typeof rep === 'object' && rep !== null && 'firstName' in rep) {
        return `${rep.firstName} ${rep.lastName}`;
    }
    return String(rep);
}

function fmtCurrency(v: number) {
    if (!v && v !== 0) return '—';
    return '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtCompact(v: number) {
    if (!v) return '$0';
    if (v >= 1000000) return '$' + (v / 1000000).toFixed(2) + 'M';
    if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K';
    return '$' + v.toFixed(0);
}

// ─── PDF Export ─────────────────────────────────────────────────────────────

function generateCommissionPDF(
    orders: CommissionOrder[],
    repSummaries: RepSummary[],
    grandTotal: GrandTotal,
    dateRange: { startDate: string; endDate: string },
    selectedRepName: string
) {
    // Build an HTML document optimized for print/PDF
    const formatDatePdf = (d: string) => {
        if (!d) return '-';
        const parts = d.split('T')[0].split('-');
        return `${parts[1]}/${parts[2]}/${parts[0]}`;
    };

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Commission Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; padding: 40px; font-size: 11px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 3px solid #fe9900; padding-bottom: 20px; }
        .header h1 { font-size: 28px; font-weight: 900; color: #0a0a0a; letter-spacing: -0.5px; }
        .header .subtitle { font-size: 12px; color: #666; margin-top: 4px; }
        .header .meta { text-align: right; font-size: 11px; color: #666; }
        .header .meta strong { color: #0a0a0a; }

        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; border: 1px solid #e5e5e5; padding: 16px; }
        .summary-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; font-weight: 700; }
        .summary-card .value { font-size: 24px; font-weight: 900; color: #0a0a0a; margin-top: 4px; }

        .section-title { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #fe9900; margin: 24px 0 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }

        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #0a0a0a; color: #fff; padding: 10px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; text-align: left; }
        th.right { text-align: right; }
        td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
        td.right { text-align: right; font-family: 'Courier New', monospace; }
        td.bold { font-weight: 700; }
        tr:hover { background: #fefefe; }
        tr.total-row { background: #f8f9fa; border-top: 2px solid #0a0a0a; }
        tr.total-row td { font-weight: 900; font-size: 12px; padding: 12px; }

        .rep-section { margin-bottom: 24px; page-break-inside: avoid; }
        .rep-header { background: linear-gradient(135deg, #fff8f0, #fff); border: 1px solid #fe990030; padding: 12px 16px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
        .rep-header .name { font-weight: 800; font-size: 14px; }
        .rep-header .stats { font-size: 11px; color: #666; }
        .rep-header .commission { font-weight: 900; color: #fe9900; font-size: 16px; }

        .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; font-size: 10px; color: #999; display: flex; justify-content: space-between; }
        
        @media print {
            body { padding: 20px; }
            .rep-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>Commission Report</h1>
            <div class="subtitle">Sales Commission at 5% Rate</div>
        </div>
        <div class="meta">
            <div><strong>Period:</strong> ${formatDatePdf(dateRange.startDate)} — ${formatDatePdf(dateRange.endDate)}</div>
            <div><strong>Filter:</strong> ${selectedRepName || 'All Sales Reps'}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleDateString()}</div>
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="label">Total Orders</div>
            <div class="value">${grandTotal.totalOrders.toLocaleString()}</div>
        </div>
        <div class="summary-card">
            <div class="label">Total Revenue</div>
            <div class="value">${fmtCurrency(grandTotal.totalRevenue)}</div>
        </div>
        <div class="summary-card">
            <div class="label">Total Commission (5%)</div>
            <div class="value" style="color: #fe9900;">${fmtCurrency(grandTotal.totalCommission)}</div>
        </div>
    </div>

    <!-- Rep Summary Table -->
    <div class="section-title">Commission by Sales Representative</div>
    <table>
        <thead>
            <tr>
                <th>Sales Representative</th>
                <th class="right">Orders</th>
                <th class="right">Total Revenue</th>
                <th class="right">Commission (5%)</th>
            </tr>
        </thead>
        <tbody>
            ${repSummaries.map(rep => `
                <tr>
                    <td class="bold">${getSalesRepName(rep._id)}</td>
                    <td class="right">${rep.totalOrders}</td>
                    <td class="right">${fmtCurrency(rep.totalRevenue)}</td>
                    <td class="right bold" style="color: #fe9900;">${fmtCurrency(rep.totalCommission)}</td>
                </tr>
            `).join('')}
            <tr class="total-row">
                <td>GRAND TOTAL</td>
                <td class="right">${grandTotal.totalOrders}</td>
                <td class="right">${fmtCurrency(grandTotal.totalRevenue)}</td>
                <td class="right" style="color: #fe9900;">${fmtCurrency(grandTotal.totalCommission)}</td>
            </tr>
        </tbody>
    </table>

    <!-- Detailed Orders Table -->
    <div class="section-title">Detailed Order Breakdown (Completed Orders Only)</div>
    <table>
        <thead>
            <tr>
                <th>Order#</th>
                <th>Date</th>
                <th>Client</th>
                <th>Sales Rep</th>
                <th class="right">Subtotal</th>
                <th class="right">Commission (5%)</th>
            </tr>
        </thead>
        <tbody>
            ${orders.map(o => `
                <tr>
                    <td class="bold">${o.label || '-'}</td>
                    <td>${formatDatePdf(o.createdAt)}</td>
                    <td>${getClientName(o)}</td>
                    <td>${getSalesRepName(o.salesRep)}</td>
                    <td class="right">${fmtCurrency(o._subtotal)}</td>
                    <td class="right bold" style="color: #fe9900;">${fmtCurrency(o._commission)}</td>
                </tr>
            `).join('')}
            <tr class="total-row">
                <td colspan="4">GRAND TOTAL</td>
                <td class="right">${fmtCurrency(grandTotal.totalRevenue)}</td>
                <td class="right" style="color: #fe9900;">${fmtCurrency(grandTotal.totalCommission)}</td>
            </tr>
        </tbody>
    </table>

    <div class="footer">
        <span>RebelX Brands — Commission Report</span>
        <span>Commission Rate: 5% | Generated ${new Date().toLocaleString()}</span>
    </div>
</body>
</html>`;

    // Open a new window with the styled HTML and trigger print (Save as PDF)
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // Slight delay so styles render
        setTimeout(() => {
            printWindow.print();
        }, 400);
    }
}


// ─── Main Component ─────────────────────────────────────────────────────────

export default function CommissionPageWrapper() {
    return (
        <Suspense fallback={
            <div className="h-full flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground/50" />
            </div>
        }>
            <CommissionPage />
        </Suspense>
    );
}

function CommissionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Default date range: current month
    const defaultRange = getPresetRange('this_month');

    const urlStart = searchParams.get('startDate');
    const urlEnd = searchParams.get('endDate');
    const urlRep = searchParams.get('salesRep');

    const [dateRange, setDateRange] = useState({
        startDate: urlStart || defaultRange.startDate,
        endDate: urlEnd || defaultRange.endDate,
    });
    const [datePreset, setDatePreset] = useState<DatePreset>(
        !urlStart && !urlEnd ? 'this_month' : 'custom'
    );
    const [selectedReps, setSelectedReps] = useState<string[]>(urlRep ? urlRep.split(',') : []);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    const [orders, setOrders] = useState<CommissionOrder[]>([]);
    const [repSummaries, setRepSummaries] = useState<RepSummary[]>([]);
    const [grandTotal, setGrandTotal] = useState<GrandTotal>({ totalOrders: 0, totalRevenue: 0, totalCommission: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Highlight and scroll restoration
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedId = sessionStorage.getItem('cr_scroll_to');
        const savedScroll = sessionStorage.getItem('cr_scroll_top');
        if (savedId) {
            sessionStorage.removeItem('cr_scroll_to');
            sessionStorage.removeItem('cr_scroll_top');
            setHighlightId(savedId);

            if (savedScroll && scrollRef.current) {
                scrollRef.current.scrollTop = parseInt(savedScroll, 10);
            }

            const tryScroll = (attempts = 0) => {
                const row = document.querySelector(`[data-order-id="${savedId}"]`);
                if (row) {
                    setTimeout(() => row.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
                    setTimeout(() => setHighlightId(null), 3000);
                } else if (attempts < 30) {
                    setTimeout(() => tryScroll(attempts + 1), 200);
                }
            };
            setTimeout(() => tryScroll(), 100);
        }
    }, []);

    // Sales rep options for the dropdown
    const [salesRepOptions, setSalesRepOptions] = useState<{ label: string; value: string }[]>([]);
    const [repDropdownOpen, setRepDropdownOpen] = useState(false);
    const repDropdownRef = useRef<HTMLDivElement>(null);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    // Close rep dropdown on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (repDropdownRef.current && !repDropdownRef.current.contains(e.target as Node)) {
                setRepDropdownOpen(false);
            }
        };
        if (repDropdownOpen) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [repDropdownOpen]);

    // Fetch sales reps on mount
    useEffect(() => {
        fetch('/api/users?limit=1000')
            .then(res => res.json())
            .then(data => {
                const users = data.users || [];
                setSalesRepOptions(users.map((u: any) => ({
                    label: `${u.firstName} ${u.lastName}`,
                    value: u._id
                })));
            })
            .catch(console.error);
    }, []);

    // Fetch commission data
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (dateRange.startDate) params.set('startDate', dateRange.startDate);
            if (dateRange.endDate) params.set('endDate', dateRange.endDate);
            if (selectedReps.length > 0) params.set('salesRep', selectedReps.join(','));

            const res = await fetch(`/api/reports/commission?${params.toString()}`);
            const data = await res.json();

            if (res.ok) {
                setOrders(data.orders || []);
                setRepSummaries(data.repSummaries || []);
                setGrandTotal(data.grandTotal || { totalOrders: 0, totalRevenue: 0, totalCommission: 0 });
            } else {
                setError(data.error || 'Failed to load data');
            }
        } catch (e) {
            setError('Network error');
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [dateRange, selectedReps]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // URL sync
    useEffect(() => {
        const params = new URLSearchParams();
        if (dateRange.startDate) params.set('startDate', dateRange.startDate);
        if (dateRange.endDate) params.set('endDate', dateRange.endDate);
        if (selectedReps.length > 0) params.set('salesRep', selectedReps.join(','));
        const currentQs = searchParams.toString();
        const newQs = params.toString();
        if (currentQs !== newQs) {
            router.push(`${window.location.pathname}?${newQs}`, { scroll: false });
        }
    }, [dateRange, selectedReps, router, searchParams]);

    const handlePresetChange = (preset: DatePreset) => {
        setDatePreset(preset);
        if (preset !== 'custom') {
            setDateRange(getPresetRange(preset));
        }
    };

    // Filter orders by client-side search
    const filteredOrders = debouncedSearch
        ? orders.filter(o => {
            const q = debouncedSearch.toLowerCase();
            return (
                (o.label || '').toLowerCase().includes(q) ||
                getClientName(o).toLowerCase().includes(q) ||
                getSalesRepName(o.salesRep).toLowerCase().includes(q)
            );
        })
        : orders;

    const handleExportPDF = () => {
        const selectedRepName = selectedReps.length > 0
            ? selectedReps.map(id => {
                const opt = salesRepOptions.find(o => o.value === id);
                return opt?.label || id;
            }).join(', ')
            : '';
        generateCommissionPDF(filteredOrders, repSummaries, grandTotal, dateRange, selectedRepName);
    };

    const toggleRep = (repId: string) => {
        setSelectedReps(prev =>
            prev.includes(repId) ? prev.filter(r => r !== repId) : [...prev, repId]
        );
    };

    const clearFilters = () => {
        const def = getPresetRange('this_month');
        setDateRange(def);
        setDatePreset('this_month');
        setSelectedReps([]);
        setSearch('');
    };

    const hasActiveFilters = selectedReps.length > 0 || datePreset !== 'this_month' || search;

    return (
        <div className="h-full flex flex-col overflow-hidden bg-background text-foreground transition-colors duration-200">
            {/* ─── Top Header ──────────────────────────────────────────────── */}
            <div className="relative shrink-0 h-14 border-b border-border bg-background backdrop-blur-xl px-4 flex items-center justify-between z-50 shadow-sm transition-colors duration-200">
                <div className="flex items-center space-x-3">
                    <button onClick={() => router.back()} className="hover:bg-secondary rounded-full transition-colors p-2 text-muted-foreground cursor-pointer">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="h-5 w-px bg-border mx-1" />
                    <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <Link href="/" className="hover:text-foreground transition-colors">Dashboard</Link>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        <Link href="/reports/financials" className="hover:text-foreground transition-colors">Financials</Link>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                        <span className="text-foreground font-semibold">Commission Report</span>
                        <span className="text-muted-foreground/30 mx-1">|</span>
                        <span className="text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            {loading ? '...' : `${grandTotal.totalOrders} Orders`}
                        </span>
                    </div>
                </div>

                {/* Inline Filters */}
                <div className="flex items-center gap-2 relative z-50">
                    {/* Search */}
                    <div className="relative w-44">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-8 pr-3 h-9 bg-background border border-border rounded-lg text-[11px] outline-none focus:border-primary text-foreground placeholder:text-muted-foreground transition-colors shadow-sm"
                        />
                    </div>

                    {/* Sales Rep Multi-Select Dropdown */}
                    <div className="relative" ref={repDropdownRef}>
                        <button
                            onClick={() => setRepDropdownOpen(!repDropdownOpen)}
                            className={cn(
                                "h-9 px-3 flex items-center gap-2 border rounded-lg text-[11px] font-bold transition-all shadow-sm",
                                selectedReps.length > 0
                                    ? "bg-primary/10 border-primary/30 text-primary"
                                    : "bg-background border-border text-muted-foreground hover:border-border/80"
                            )}
                        >
                            <Users className="w-3.5 h-3.5" />
                            {selectedReps.length > 0 ? `${selectedReps.length} Rep${selectedReps.length > 1 ? 's' : ''}` : 'Sales Rep'}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {repDropdownOpen && (
                            <div className="absolute right-0 top-full mt-1 w-64 max-h-72 bg-background border border-border rounded-lg shadow-xl z-[100] overflow-y-auto">
                                <div className="p-2 border-b border-border">
                                    <button
                                        onClick={() => setSelectedReps([])}
                                        className="text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-wider"
                                    >
                                        Clear Selection
                                    </button>
                                </div>
                                {salesRepOptions.map(rep => (
                                    <button
                                        key={rep.value}
                                        onClick={() => toggleRep(rep.value)}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-[11px] font-medium flex items-center justify-between hover:bg-secondary transition-colors",
                                            selectedReps.includes(rep.value) && "bg-primary/10 text-primary font-bold"
                                        )}
                                    >
                                        <span>{rep.label}</span>
                                        {selectedReps.includes(rep.value) && (
                                            <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                                <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                ))}
                                {salesRepOptions.length === 0 && (
                                    <div className="p-3 text-center text-[11px] text-muted-foreground">Loading...</div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Date Quick Presets */}
                    <div className="flex items-center gap-0 bg-background border border-border rounded-lg overflow-hidden shadow-sm h-9">
                        {(['this_month', 'last_month', 'this_year'] as DatePreset[]).map(preset => (
                            <button
                                key={preset}
                                onClick={() => handlePresetChange(preset)}
                                className={cn(
                                    "px-3 h-full text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap",
                                    datePreset === preset
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                                )}
                            >
                                {preset === 'this_month' ? 'This Month' : preset === 'last_month' ? 'Last Month' : 'This Year'}
                            </button>
                        ))}
                    </div>

                    {/* Date Range Picker */}
                    <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-2 py-0.5 h-9 shadow-sm transition-all hover:border-border/80">
                        <Calendar className="w-4 h-4 text-primary ml-1" />
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={e => { setDateRange(prev => ({ ...prev, startDate: e.target.value })); setDatePreset('custom'); }}
                            className="bg-transparent text-[11px] font-medium text-foreground outline-none w-26 cursor-pointer color-scheme-auto"
                        />
                        <span className="text-muted-foreground/50 text-[11px] font-bold">-</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={e => { setDateRange(prev => ({ ...prev, endDate: e.target.value })); setDatePreset('custom'); }}
                            className="bg-transparent text-[11px] font-medium text-foreground outline-none w-26 cursor-pointer color-scheme-auto"
                        />
                    </div>

                    {/* Export PDF */}
                    <button
                        onClick={handleExportPDF}
                        disabled={loading || orders.length === 0}
                        className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 hover:border-primary/40 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                    </button>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="h-9 px-3 flex items-center gap-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-transparent hover:border-red-500/30 transition-all shadow-sm shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* ─── Content Area ─────────────────────────────────────────────── */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left Column: Orders Table */}
                <div 
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto bg-background min-w-0 relative scrollbar-custom transition-colors duration-200"
                >
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 bg-secondary border-b border-border shadow-sm">
                            <tr>
                                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[80px]">Order#</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[90px]">Date</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[200px]">Client</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[140px]">Sales Rep</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest border-r border-border min-w-[120px] text-right">Subtotal</th>
                                <th className="px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-widest min-w-[130px] text-right">
                                    <span className="flex items-center justify-end gap-1">
                                        <Percent className="w-3 h-3 text-primary" />
                                        Commission (5%)
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 12 }).map((_, i) => (
                                    <tr key={i} className="border-b border-border/30">
                                        {Array.from({ length: 6 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <div
                                                    className="h-3.5 rounded-sm bg-secondary animate-pulse"
                                                    style={{ width: `${40 + Math.random() * 40}%`, animationDelay: `${i * 30}ms` }}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-16 text-center text-[11px] font-medium text-muted-foreground">
                                        <div className="flex flex-col items-center gap-3">
                                            <FileText className="w-10 h-10 text-muted-foreground/30" />
                                            <span>No completed orders found for the selected period</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <>
                                    {filteredOrders.map(order => (
                                        <tr
                                            key={order._id}
                                            data-order-id={order._id}
                                            onClick={() => {
                                                sessionStorage.setItem('cr_scroll_to', order._id);
                                                if (scrollRef.current) {
                                                    sessionStorage.setItem('cr_scroll_top', String(scrollRef.current.scrollTop));
                                                }
                                                router.push(`/sales/wholesale-orders/${order._id}`);
                                            }}
                                            className={cn(
                                                "hover:bg-muted/30 dark:hover:bg-muted/10 transition-colors duration-150 cursor-pointer group",
                                                highlightId === order._id ? "animate-[rowGlow_0.75s_ease-in-out_4] ring-1 ring-primary/40 bg-primary/[0.06]" : ""
                                            )}
                                        >
                                            <td className="px-4 py-3 text-[11px] font-bold text-foreground border-r border-border group-hover:text-primary transition-colors">
                                                {order.label || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-medium text-muted-foreground border-r border-border font-mono">
                                                {formatDate(order.createdAt)}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-medium text-foreground/80 border-r border-border truncate max-w-[200px]" title={getClientName(order)}>
                                                {getClientName(order) || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-medium text-foreground/70 border-r border-border whitespace-nowrap">
                                                {getSalesRepName(order.salesRep)}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-foreground text-right border-r border-border font-mono tracking-tight">
                                                {fmtCurrency(order._subtotal)}
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-primary text-right font-mono tracking-tight group-hover:bg-primary/5 transition-colors">
                                                {fmtCurrency(order._commission)}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Footer totals row */}
                                    <tr className="bg-secondary border-t-2 border-primary/30 sticky bottom-0">
                                        <td colSpan={4} className="px-4 py-3 text-[11px] font-black text-foreground uppercase tracking-widest">
                                            Totals ({filteredOrders.length} Orders)
                                        </td>
                                        <td className="px-4 py-3 text-[11px] font-black text-foreground text-right font-mono tracking-tight">
                                            {fmtCurrency(filteredOrders.reduce((s, o) => s + (o._subtotal || 0), 0))}
                                        </td>
                                        <td className="px-4 py-3 text-[12px] font-black text-primary text-right font-mono tracking-tight">
                                            {fmtCurrency(filteredOrders.reduce((s, o) => s + (o._commission || 0), 0))}
                                        </td>
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Right Column: Side Panel */}
                <div className="w-[360px] shrink-0 overflow-y-auto bg-secondary border-l border-border scrollbar-custom p-5 space-y-5 transition-colors duration-200">

                    {/* Grand Total Commission Card */}
                    <div className="relative overflow-hidden bg-background border border-border shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-5">
                        {/* Decorative glow */}
                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

                        <h3 className="font-bold flex items-center gap-2 mb-4 text-[11px] uppercase tracking-widest text-foreground relative z-10">
                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center border border-primary/20">
                                <Percent className="w-3.5 h-3.5 text-primary" />
                            </div>
                            Commission Summary
                        </h3>

                        <div className="space-y-2 relative z-10">
                            {/* Commission Rate */}
                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md transition-all duration-300 hover:border-primary">
                                <span className="text-[11px] font-black text-white uppercase tracking-tight">Commission Rate</span>
                                <span className="text-[13px] font-black text-primary font-mono">5%</span>
                            </div>

                            {/* Total Orders */}
                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md transition-all duration-300 hover:border-blue-500">
                                <span className="text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <ShoppingCart className="w-3.5 h-3.5 text-blue-400" />
                                    Total Orders
                                </span>
                                <span className="text-[13px] font-black text-blue-400 font-mono">
                                    {loading ? '...' : grandTotal.totalOrders.toLocaleString()}
                                </span>
                            </div>

                            {/* Total Revenue */}
                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 flex items-center justify-between shadow-md transition-all duration-300 hover:border-emerald-500">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-transparent pointer-events-none" />
                                <span className="relative z-10 text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                    Total Revenue
                                </span>
                                <span className="relative z-10 text-[13px] font-black text-emerald-400 font-mono">
                                    {loading ? '...' : fmtCompact(grandTotal.totalRevenue)}
                                </span>
                            </div>

                            {/* Total Commission — Hero */}
                            <div className="relative overflow-hidden rounded-md border border-primary/40 bg-gradient-to-r from-primary/20 to-primary/5 px-4 py-4 flex items-center justify-between shadow-lg transition-all duration-300 hover:border-primary mt-1">
                                <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent pointer-events-none" />
                                <span className="relative z-10 text-[11px] font-black text-white uppercase tracking-tight flex items-center gap-2">
                                    <Award className="w-4 h-4 text-primary" />
                                    Total Commission
                                </span>
                                <span className="relative z-10 text-[16px] font-black text-primary font-mono tracking-tight">
                                    {loading ? '...' : fmtCurrency(grandTotal.totalCommission)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Commission by Rep */}
                    <div className="bg-background border border-border shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-5 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                            <Users className="w-32 h-32 text-primary" />
                        </div>

                        <h3 className="font-bold flex items-center gap-2 mb-5 text-[11px] uppercase tracking-widest text-foreground relative z-10">
                            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                <Users className="w-3.5 h-3.5 text-primary" />
                            </div>
                            By Sales Rep
                        </h3>
                        <div className="space-y-2 relative z-10">
                            {loading ? (
                                <div className="text-muted-foreground text-[11px] font-medium italic">Loading...</div>
                            ) : repSummaries.length === 0 ? (
                                <div className="text-muted-foreground text-[11px] font-medium italic">No data available</div>
                            ) : (
                                repSummaries.map((rep, idx) => {
                                    const maxCommission = repSummaries[0]?.totalCommission || 1;
                                    const widthPercent = (rep.totalCommission / maxCommission) * 100;
                                    return (
                                        <div key={idx} className="group">
                                            <div className="relative overflow-hidden rounded-md border border-slate-800 dark:border-slate-700 bg-slate-900 dark:bg-slate-800 px-3 py-2.5 shadow-md transition-all duration-300 hover:border-primary">
                                                {/* Progress bar */}
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 bg-primary/15 transition-all duration-1000"
                                                    style={{ width: `${widthPercent}%` }}
                                                />
                                                <div className="relative z-10 flex items-center justify-between">
                                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                                        <span className={cn(
                                                            "w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 shadow-sm",
                                                            idx === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                                                                idx === 1 ? "bg-slate-500/20 text-slate-400 border border-slate-500/30" :
                                                                    idx === 2 ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                                                                        "bg-secondary text-muted-foreground"
                                                        )}>
                                                            {idx + 1}
                                                        </span>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <span className="text-[11px] font-bold text-white truncate">
                                                                {getSalesRepName(rep._id)}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {rep.totalOrders} orders • {fmtCompact(rep.totalRevenue)} rev
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-primary font-black text-[12px] shrink-0 ml-3 font-mono">
                                                        {fmtCurrency(rep.totalCommission)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Quick Stats Cards */}
                    <div className="bg-background border border-border shadow-sm hover:shadow-md transition-shadow duration-300 rounded-2xl p-5 overflow-hidden relative">
                        <h3 className="font-bold flex items-center gap-2 mb-4 text-[11px] uppercase tracking-widest text-foreground relative z-10">
                            <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            </div>
                            Metrics
                        </h3>
                        <div className="space-y-3 relative z-10">
                            <MetricRow
                                label="Avg. Order Value"
                                value={loading ? '...' : fmtCurrency(grandTotal.totalOrders > 0 ? grandTotal.totalRevenue / grandTotal.totalOrders : 0)}
                                icon={ShoppingCart}
                                color="blue"
                            />
                            <MetricRow
                                label="Avg. Commission / Order"
                                value={loading ? '...' : fmtCurrency(grandTotal.totalOrders > 0 ? grandTotal.totalCommission / grandTotal.totalOrders : 0)}
                                icon={DollarSign}
                                color="amber"
                            />
                            <MetricRow
                                label="Active Sales Reps"
                                value={loading ? '...' : String(repSummaries.length)}
                                icon={Users}
                                color="purple"
                            />
                            {repSummaries.length > 0 && !loading && (
                                <MetricRow
                                    label="Top Earner"
                                    value={getSalesRepName(repSummaries[0]?._id)}
                                    icon={Award}
                                    color="gold"
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function OrderStatusBadge({ status }: { status: string }) {
    const styleMap: Record<string, { bg: string; color: string; border?: string; darkBg?: string; darkColor?: string }> = {
        'Completed': { bg: '#059669', color: '#ffffff', darkBg: 'rgba(16,185,129,0.2)', darkColor: '#34d399' },
        'Issued': { bg: '#0284c7', color: '#ffffff', darkBg: 'rgba(59,130,246,0.2)', darkColor: '#60a5fa' },
        'Pending Payment': { bg: '#d97706', color: '#ffffff', darkBg: 'rgba(245,158,11,0.2)', darkColor: '#fbbf24' },
        'Shipping': { bg: '#7c3aed', color: '#ffffff', darkBg: 'rgba(124,58,237,0.2)', darkColor: '#a78bfa' },
        'Picking': { bg: '#0891b2', color: '#ffffff', darkBg: 'rgba(8,145,178,0.2)', darkColor: '#22d3ee' },
        'Pending': { bg: '#e2e8f0', color: '#000000', border: '1px solid #cbd5e1', darkBg: 'rgba(100,116,139,0.2)', darkColor: '#cbd5e1' },
    };
    const s = styleMap[status];
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider status-badge"
            data-status={status}
            style={s ? { backgroundColor: s.bg, color: s.color, border: s.border, borderRadius: '4px' } : { borderRadius: '4px' }}
        >
            {status || '—'}
        </span>
    );
}

function MetricRow({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
    const colorMap: Record<string, string> = {
        blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        gold: 'text-primary bg-primary/10 border-primary/20',
    };
    return (
        <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-secondary transition-colors border border-transparent hover:border-border">
            <div className="flex items-center gap-3">
                <div className={cn("w-7 h-7 rounded-md flex items-center justify-center border", colorMap[color])}>
                    <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-medium text-foreground/70">{label}</span>
            </div>
            <span className="text-[11px] font-bold text-foreground truncate max-w-[120px]">{value}</span>
        </div>
    );
}
