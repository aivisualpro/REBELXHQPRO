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
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; bottom?: number }>({ top: 0, left: 0, width: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [mounted, setMounted] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    }, []);

    const selectedOption = options.find(o => o.value === value);

    // Calculate dropdown position
    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const dropdownHeight = 300; // Approximate max height (header + max-h-60)
            const spaceBelow = windowHeight - rect.bottom;
            const spaceAbove = rect.top;

            let top = rect.bottom + 4;
            const left = rect.left;
            const width = rect.width;

            // Flip to top if not enough space below and more space above
            if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
                // We don't know the exact height until render, but we can set bottom-aligned or estimate
                // Since we use fixed positioning with `top`, we need to calculate `top`.
                // However, without exact height, `top` is hard.
                // Better approach: render it invisible first? No, too slow.
                // We'll use the estimated max height OR we can use `bottom` prop in style if we change logic.
                // But let's try to just check if we should go UP.
                // If we go UP, `top` should be `rect.top - height`.
                // Since height is dynamic, we can set `bottom: windowHeight - rect.top + 4` and `top: auto`
                // Let's pass `placement: 'top' | 'bottom'` to state or just coordinates.
                // Actually, let's change the style object to support bottom.
                
                // For now, let's assume we can change the `dropdownPos` state structure or just use `top`.
                // If we use `bottom`, we need to update the interface of `dropdownPos` indirectly by using `style` prop more flexibly.
                // Let's assume we can set `top` to `auto` and `bottom`.
            }
            
            // Re-evaluating: To support `bottom` positioning, I should update the state to store `style` object or `top/bottom`.
            // Current state: { top: number, left: number, width: number }
            
            // Simplified "Open from Top" logic requested by user:
            // "should open from the top so that we can see the list properly"
            // If I just set the Z-index really high, it might be visible over others, but if off screen, it's bad.
            // Let's implement the Flip.
            
            const shouldFlip = spaceBelow < 320 && spaceAbove > 320; // 320px buffer
            
            if (shouldFlip) {
                // If flipping, we want the bottom of the dropdown to be at rect.top - 4
                 setDropdownPos({
                    top: -1, // signal to use bottom
                    bottom: windowHeight - rect.top + 4,
                    left: rect.left,
                    width: rect.width
                });
            } else {
                 setDropdownPos({
                    top: rect.bottom + 4,
                    bottom: undefined, 
                    left: rect.left,
                    width: rect.width
                });
            }
        }
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                containerRef.current && 
                !containerRef.current.contains(event.target as Node) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
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

    const dropdownId = `searchable-select-dropdown-${options.length}-${placeholder}`;

    const dropdownContent = (
        <div 
            ref={dropdownRef}
            id={dropdownId}
            style={{
                position: 'fixed',
                top: dropdownPos.top === -1 ? 'auto' : dropdownPos.top,
                bottom: dropdownPos.bottom,
                left: dropdownPos.left,
                width: dropdownPos.width,
                zIndex: 99999
            }}
            className="rounded-md shadow-2xl border-2 border-border animate-in fade-in zoom-in-95 duration-100 bg-card dark:bg-zinc-900 flex flex-col"
            onWheel={(e) => e.stopPropagation()}
        >
            <div className="p-2 border-b border-border bg-muted sticky top-0 shrink-0 z-10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring text-foreground placeholder:text-muted-foreground transition-all"
                        placeholder={placeholder === "Select..." ? "Search..." : `Search ${placeholder}...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto scrollbar-custom bg-card dark:bg-zinc-900">
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
