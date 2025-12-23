import React, { useState, useRef, useEffect } from 'react';
import { Filter, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
    label: string;
    value: string;
}

interface FilterProps {
    label: string;
    options: FilterOption[];
    selectedValues: string[];
    onChange: (values: string[]) => void;
    icon?: React.ElementType; // allow custom icon
    className?: string;
}


export function MultiSelectFilter({ label, options, selectedValues, onChange, icon: Icon = Filter, className }: FilterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset search when opening
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const toggleOption = (value: string) => {
        if (selectedValues.includes(value)) {
            onChange(selectedValues.filter(v => v !== value));
        } else {
            onChange([...selectedValues, value]);
        }
    };

    const clearFilter = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
    };

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center space-x-1.5 px-3 py-1.5 border rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all",
                    selectedValues.length > 0
                        ? "bg-black text-white border-black hover:bg-slate-800"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700",
                    className
                )}
            >
                <Icon className="w-3 h-3" />
                <span>{label}</span>
                {selectedValues.length > 0 && (
                    <span className="ml-1 flex items-center justify-center bg-white text-black text-[9px] w-4 h-4 rounded-full font-black">
                        {selectedValues.length}
                    </span>
                )}
                {selectedValues.length > 0 && (
                    <div onClick={clearFilter} className="ml-1 p-0.5 hover:bg-white/20 rounded-full cursor-pointer">
                        <X className="w-3 h-3" />
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-100 shadow-xl rounded-sm z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-80">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 text-[10px] focus:outline-none focus:border-black focus:ring-0 rounded-sm transition-colors"
                            autoFocus
                        />
                    </div>
                    <div className="p-1 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-[10px] text-slate-400 text-center">No options found</div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => toggleOption(option.value)}
                                    className="flex items-center space-x-2 px-3 py-2 hover:bg-slate-50 cursor-pointer rounded-sm group transition-colors"
                                >
                                    <div className={cn(
                                        "w-3.5 h-3.5 border rounded-sm flex items-center justify-center transition-colors shrink-0",
                                        selectedValues.includes(option.value) ? "bg-black border-black" : "border-slate-300 group-hover:border-slate-400 bg-white"
                                    )}>
                                        {selectedValues.includes(option.value) && <Check className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <span className={cn(
                                        "text-[10px] uppercase font-bold tracking-tight truncate",
                                        selectedValues.includes(option.value) ? "text-black" : "text-slate-500"
                                    )}>
                                        {option.label}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
