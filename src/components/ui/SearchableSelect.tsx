'use client';

import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
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
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    }, []);

    const selectedOption = options.find(o => o.value === value);

    // Calculate dropdown position
    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width
            });
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Check if click is inside the portal dropdown
                const dropdown = document.getElementById('searchable-select-dropdown');
                if (dropdown && dropdown.contains(event.target as Node)) {
                    return;
                }
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(search.toLowerCase())
    );

    const showCreate = creatable && search && !filteredOptions.some(o => o.label.toLowerCase() === search.toLowerCase());

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearch('');
    };

    const dropdownContent = (
        <div 
            id="searchable-select-dropdown"
            style={{
                position: 'fixed',
                top: dropdownPos.top,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 99999
            }}
            className="rounded-md shadow-2xl max-h-80 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 border-2 border-border"
        >
            {/* Solid background wrapper to prevent bleed-through */}
            <div className="bg-card dark:bg-zinc-900 flex flex-col h-full">
                <div className="p-2 border-b border-border bg-muted sticky top-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-foreground placeholder:text-muted-foreground transition-all"
                            placeholder="Search clients..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onClick={e => e.stopPropagation()}
                        />
                </div>
            </div>
            <div className="overflow-auto flex-1">
                {filteredOptions.length === 0 && !showCreate ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">No results found</div>
                ) : (
                    <div className="p-1">
                        {filteredOptions.map(option => (
                            <div
                                key={option.value}
                                className={cn(
                                    "px-3 py-2.5 text-sm cursor-pointer rounded-md hover:bg-[#FFEF5F] hover:text-black transition-colors text-foreground",
                                    option.value === value && "bg-[#FFEF5F] text-black font-medium"
                                )}
                                onClick={() => handleSelect(option.value)}
                            >
                                {option.label}
                            </div>
                        ))}
                        {showCreate && (
                            <div
                                className="px-3 py-2.5 text-sm cursor-pointer rounded-md hover:bg-accent hover:text-accent-foreground transition-colors text-primary font-medium border-t border-border mt-1 pt-2"
                                onClick={() => handleSelect(search)}
                            >
                                Create &quot;{search}&quot;
                            </div>
                        )}
                    </div>
                )}
            </div>
            </div>
        </div>
    );

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <div
                className={cn(
                    "w-full px-3 py-2.5 border border-input rounded-md text-sm bg-background flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-ring transition-all hover:border-ring/50",
                    !selectedOption && !value ? "text-muted-foreground" : "text-foreground",
                    isOpen && "ring-2 ring-ring border-ring",
                    triggerClassName
                )}
                onClick={() => {
                    setIsOpen(!isOpen);
                    if (!isOpen) setSearch('');
                }}
            >
                <span className="truncate">{selectedOption ? selectedOption.label : (creatable && value ? value : placeholder)}</span>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground ml-2 shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
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

            {mounted && isOpen && createPortal(dropdownContent, document.body)}
        </div>
    );
}
