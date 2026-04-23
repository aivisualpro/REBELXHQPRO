import {
    ClipboardList, Trash2, DollarSign, Users, BarChart3, Timer, FileWarning,
    Package, ShieldAlert, Activity, XCircle, Repeat, AlertOctagon
} from 'lucide-react';

export const KPIS: {
    id: string; label: string; desc: string; icon: any; key: string;
    severity: (v: number) => 'red' | 'amber' | 'green';
    cols: { key: string; label: string; w?: string }[];
    hero?: boolean; // special full-width hero treatment
}[] = [
    {
        id: 'unfulfilledOrders', label: 'Unfulfilled Orders', desc: 'All manufacturing orders not yet fulfilled — requires immediate attention',
        icon: AlertOctagon, key: 'unfulfilledOrders', hero: true,
        severity: v => v > 20 ? 'red' : v > 5 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: 'ageDays', label: 'Age (Days)', w: 'w-24' },
            { key: 'priority', label: 'Priority', w: 'w-24' }, { key: 'qty', label: 'Qty', w: 'w-20' },
            { key: 'scheduledFinish', label: 'Sched. Finish', w: 'w-32' }, { key: 'createdBy', label: 'Created By', w: 'w-28' },
        ],
    },
    {
        id: 'incomplete', label: 'Incomplete MOs', desc: 'Open manufacturing orders',
        icon: ClipboardList, key: 'incomplete',
        severity: v => v > 10 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: 'ageDays', label: 'Age (Days)', w: 'w-24' },
            { key: 'priority', label: 'Priority', w: 'w-24' }, { key: 'qty', label: 'Qty', w: 'w-20' },
            { key: 'scheduledFinish', label: 'Sched. Finish', w: 'w-32' },
        ],
    },
    {
        id: 'scrap', label: 'Wastage / Scrap', desc: 'MOs with scrap recorded',
        icon: Trash2, key: 'scrap',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'scrapQty', label: 'Scrap Qty', w: 'w-24' }, { key: 'scrapPct', label: 'Scrap %', w: 'w-20' },
            { key: 'qty', label: 'Planned Qty', w: 'w-24' }, { key: 'status', label: 'Status', w: 'w-28' },
        ],
    },
    {
        id: 'missingCost', label: 'Missing Cost', desc: 'Fulfilled MOs with zero cost',
        icon: DollarSign, key: 'missingCost',
        severity: v => v > 10 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'qty', label: 'Qty', w: 'w-20' }, { key: 'totalCost', label: 'Total Cost', w: 'w-24' },
            { key: 'createdAt', label: 'Completed', w: 'w-28' },
        ],
    },
    {
        id: 'laborAnomalies', label: 'Labor Anomalies', desc: 'Same-SKU labor hour outliers',
        icon: Users, key: 'laborAnomalies',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'laborHours', label: 'Labor Hrs', w: 'w-24' }, { key: 'skuMedian', label: 'Median', w: 'w-20' },
            { key: 'p25', label: 'P25', w: 'w-16' }, { key: 'p75', label: 'P75', w: 'w-16' },
            { key: 'deviationPct', label: 'Dev %', w: 'w-20' },
        ],
    },
    {
        id: 'costOutliers', label: 'Cost/Unit Outliers', desc: 'Same-SKU cost deviations',
        icon: BarChart3, key: 'costOutliers',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'costPerUnit', label: 'Cost/Unit', w: 'w-24' }, { key: 'skuMedian', label: 'Median', w: 'w-24' },
            { key: 'deviationPct', label: 'Dev %', w: 'w-20' }, { key: 'totalCost', label: 'Total Cost', w: 'w-24' },
        ],
    },
    {
        id: 'overdue', label: 'Overdue MOs', desc: 'Past scheduled finish date',
        icon: Timer, key: 'overdue',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'daysOverdue', label: 'Days Overdue', w: 'w-28' }, { key: 'qty', label: 'Qty', w: 'w-20' },
            { key: 'priority', label: 'Priority', w: 'w-24' }, { key: 'status', label: 'Status', w: 'w-28' },
        ],
    },
    {
        id: 'noBom', label: 'No BOM / Recipe', desc: 'MOs without linked recipe',
        icon: FileWarning, key: 'noBom',
        severity: v => v > 0 ? 'red' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: 'createdAt', label: 'Created', w: 'w-28' },
            { key: 'createdBy', label: 'Created By', w: 'w-28' },
        ],
    },
    {
        id: 'unreserved', label: 'Component Shortages', desc: 'Open MOs with unassigned lots',
        icon: Package, key: 'unreserved',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: 'qty', label: 'Qty', w: 'w-20' },
            { key: '_missing', label: 'Missing Components' },
        ],
    },
    {
        id: 'operatorDiscrepancies', label: 'Operator Overlaps', desc: 'Same operator on 2+ MOs same day',
        icon: ShieldAlert, key: 'operatorDiscrepancies',
        severity: v => v > 3 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'operator', label: 'Operator', w: 'w-32' }, { key: 'date', label: 'Date', w: 'w-28' },
            { key: '_mos', label: 'Work Orders' },
        ],
    },
    {
        id: 'yieldVariance', label: 'Yield Variance', desc: 'Output differs from planned qty',
        icon: Activity, key: 'yieldVariance',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'planned', label: 'Planned', w: 'w-20' }, { key: 'actual', label: 'Actual', w: 'w-20' },
            { key: 'variancePct', label: 'Variance %', w: 'w-24' }, { key: 'scrapQty', label: 'Scrap', w: 'w-20' },
        ],
    },
    {
        id: 'noValuation', label: 'Valuation Missing', desc: 'Labor logged but cost not posted',
        icon: XCircle, key: 'noValuation',
        severity: v => v > 5 ? 'red' : v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'qty', label: 'Qty', w: 'w-20' }, { key: 'laborCost', label: 'Labor Cost', w: 'w-24' },
            { key: 'totalCost', label: 'Total Cost', w: 'w-24' }, { key: 'createdAt', label: 'Created', w: 'w-28' },
        ],
    },
    {
        id: 'reworkLoops', label: 'Rework Loops', desc: 'Same SKU used twice in one MO',
        icon: Repeat, key: 'reworkLoops',
        severity: v => v > 0 ? 'amber' : 'green',
        cols: [
            { key: 'label', label: 'MO#', w: 'w-24' }, { key: 'skuName', label: 'SKU' },
            { key: 'status', label: 'Status', w: 'w-28' }, { key: '_dupes', label: 'Duplicate Components' },
        ],
    },
];

export const SEV_COLORS = {
    red: { border: 'border-rose-500/60', bg: 'bg-rose-500/8', icon: 'bg-rose-500/20 text-rose-500', value: 'text-rose-500', dot: 'bg-rose-500' },
    amber: { border: 'border-amber-500/60', bg: 'bg-amber-500/8', icon: 'bg-amber-500/20 text-amber-500', value: 'text-amber-400', dot: 'bg-amber-500' },
    green: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', icon: 'bg-emerald-500/20 text-emerald-500', value: 'text-emerald-500', dot: 'bg-emerald-500' },
};
