import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Option {
    value: string;
    label: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    creatable?: boolean;
    triggerClassName?: string;
}

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className,
    triggerClassName,
    required,
    creatable
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => o.value === value);

    // Check available space and set dropdown direction
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const dropdownHeight = 260; // max-h-60 = 15rem = 240px + some padding
            
            // If not enough space below but more space above, open upward
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                setOpenDirection('up');
            } else {
                setOpenDirection('down');
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
        if (!isOpen) {
            setSearch('');
        }
    }, [isOpen]);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(search.toLowerCase())
    );

    const showCreate = creatable && search && !filteredOptions.some(o => o.label.toLowerCase() === search.toLowerCase());

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <div
                className={cn(
                    "w-full px-3 py-2 border border-slate-200 rounded text-sm bg-white flex items-center justify-between cursor-pointer focus-within:ring-1 focus-within:ring-black/10 transition-shadow",
                    !selectedOption && !value ? "text-slate-400" : "text-slate-900",
                    triggerClassName
                )}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : (creatable && value ? value : placeholder)}</span>
                <ChevronDown className={cn("w-4 h-4 text-slate-400 ml-2 shrink-0 transition-transform", isOpen && "rotate-180")} />
            </div>

            {required && (
                <input
                    type="text"
                    className="absolute opacity-0 pointer-events-none w-px h-px bottom-0"
                    required={required}
                    value={value}
                    onChange={() => { }}
                    tabIndex={-1}
                />
            )}

            {isOpen && (
                <div 
                    ref={dropdownRef}
                    className={cn(
                        "absolute z-50 w-full bg-white border border-slate-100 rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100",
                        openDirection === 'down' ? "mt-1 top-full" : "mb-1 bottom-full"
                    )}
                >
                    <div className="p-2 border-b border-slate-50 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-sm focus:outline-none focus:border-black/20"
                            placeholder="Search or type new..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <div className="overflow-auto flex-1 p-1">
                        {filteredOptions.length === 0 && !showCreate ? (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">No results found</div>
                        ) : (
                            <>
                                {filteredOptions.map(option => (
                                    <div
                                        key={option.value}
                                        className={cn(
                                            "px-3 py-2 text-xs cursor-pointer rounded-sm hover:bg-slate-50 transition-colors",
                                            option.value === value && "bg-slate-50 font-bold text-black"
                                        )}
                                        onClick={() => {
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                    >
                                        {option.label}
                                    </div>
                                ))}
                                {showCreate && (
                                    <div
                                        className="px-3 py-2 text-xs cursor-pointer rounded-sm hover:bg-slate-50 transition-colors text-blue-600 font-medium border-t border-slate-50 mt-1"
                                        onClick={() => {
                                            onChange(search);
                                            setIsOpen(false);
                                            setSearch('');
                                        }}
                                    >
                                        Create "{search}"
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
