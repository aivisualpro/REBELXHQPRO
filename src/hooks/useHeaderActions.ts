import { Plus, Download, Filter, Share2, Printer, Clock } from 'lucide-react';

export type HeaderAction = {
    label: string;
    icon: any;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
};

export const getRouteActions = (pathname: string): HeaderAction[] => {
    if (pathname.includes('/crm/clients')) {
        return [];
    }



    if (pathname.includes('/warehouse')) {
        return [];
    }

    if (pathname.includes('/reports/financials')) {
        return []; // Income statement has its own header controls
    }

    if (pathname.includes('/reports')) {
        return [
            { label: 'Export PDF', icon: Download, onClick: () => { }, variant: 'primary' },
            { label: 'Scheduled Reports', icon: Clock, onClick: () => { }, variant: 'outline' },
        ];
    }

    return [];
};
