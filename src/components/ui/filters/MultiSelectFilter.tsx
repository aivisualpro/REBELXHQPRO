import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
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
    dropdownWidth?: string;
}

export interface MultiSelectFilterRef {
    open: () => void;
    close: () => void;
}

export const MultiSelectFilter = forwardRef<MultiSelectFilterRef, FilterProps>(({ label, options, selectedValues, onChange, icon: Icon = Filter, className, dropdownWidth }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        open: () => setIsOpen(true),
        close: () => setIsOpen(false)
    }));

    // Close dropdown when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
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

    const filteredOptions = options
        .filter(option => option.label.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const aSelected = selectedValues.includes(a.value);
            const bSelected = selectedValues.includes(b.value);
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return a.label.localeCompare(b.label);
        });

    return (
        <div className="relative z-50" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center space-x-1.5 px-3 py-1.5 border rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer",
                    selectedValues.length > 0
                        ? "bg-primary text-black border-transparent hover:opacity-90"
                        : "bg-background text-muted-foreground border-border hover:border-border/80 hover:text-foreground",
                    className
                )}
            >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
                {selectedValues.length > 0 && (
                    <span className="ml-1 flex items-center justify-center bg-white text-black text-[10px] w-4 h-4 rounded-full font-black">
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
                <div className={cn("absolute right-0 top-full mt-2 bg-background border border-border shadow-xl rounded-lg z-[100] animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-80 overflow-hidden", dropdownWidth || "w-64")}>
                    <div className="p-2 border-b border-border sticky top-0 bg-background z-10">
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 bg-secondary border border-border text-[11px] text-foreground focus:outline-none focus:border-primary rounded-md transition-colors placeholder:text-muted-foreground"
                            autoFocus
                        />
                    </div>
                    <div className="p-1.5 overflow-y-auto scrollbar-custom">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-4 text-[11px] text-muted-foreground text-center italic">No options found</div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => toggleOption(option.value)}
                                    className="flex items-center space-x-3 px-3 py-2.5 hover:bg-secondary/50 cursor-pointer rounded-md group transition-colors"
                                >
                                    <div className={cn(
                                        "w-4 h-4 border rounded flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm",
                                        selectedValues.includes(option.value) 
                                            ? "bg-primary border-primary" 
                                            : "border-border group-hover:border-border/80 bg-background"
                                    )}>
                                        {selectedValues.includes(option.value) && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className={cn(
                                        "text-[11px] uppercase font-bold tracking-tight truncate transition-colors",
                                        selectedValues.includes(option.value) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
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
});

MultiSelectFilter.displayName = "MultiSelectFilter";
