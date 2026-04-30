// Shared vacation type configuration — icons, colors, emojis
// Used across frontend components and email templates

export const VACATION_TYPE_CONFIG: Record<string, {
    label: string;
    emoji: string;
    icon: string; // lucide icon name
    color: string; // tailwind color token
    hex: string; // hex for emails
    bgHex: string; // light bg hex for emails
}> = {
    'Annual Leave': {
        label: 'Annual Leave',
        emoji: '🏖️',
        icon: 'Palmtree',
        color: 'emerald',
        hex: '#059669',
        bgHex: '#ecfdf5',
    },
    'Sick Leave': {
        label: 'Sick Leave',
        emoji: '🤒',
        icon: 'Thermometer',
        color: 'red',
        hex: '#dc2626',
        bgHex: '#fef2f2',
    },
    'Personal Leave': {
        label: 'Personal Leave',
        emoji: '🧘',
        icon: 'UserRound',
        color: 'violet',
        hex: '#7c3aed',
        bgHex: '#f5f3ff',
    },
    'Unpaid Leave': {
        label: 'Unpaid Leave',
        emoji: '💤',
        icon: 'Ban',
        color: 'slate',
        hex: '#475569',
        bgHex: '#f8fafc',
    },
    'Maternity/Paternity': {
        label: 'Maternity/Paternity',
        emoji: '👶',
        icon: 'Baby',
        color: 'pink',
        hex: '#db2777',
        bgHex: '#fdf2f8',
    },
    'Bereavement': {
        label: 'Bereavement',
        emoji: '🕊️',
        icon: 'Heart',
        color: 'gray',
        hex: '#6b7280',
        bgHex: '#f9fafb',
    },
    'Other': {
        label: 'Other',
        emoji: '📋',
        icon: 'FileText',
        color: 'amber',
        hex: '#d97706',
        bgHex: '#fffbeb',
    },
};

export const VACATION_TYPES = Object.keys(VACATION_TYPE_CONFIG);

export function getVacationTypeConfig(type: string) {
    return VACATION_TYPE_CONFIG[type] || VACATION_TYPE_CONFIG['Other'];
}
