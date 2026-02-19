'use client';

import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
    onOpenChange?: (open: boolean) => void;
}

// ── Fuzzy Tokenized Search Engine ──────────────────────────────────────────
// Splits the query into words, matches each independently (any order),
// with prefix-trimming for typo tolerance. Scores results by relevance.

function buildFuzzyPatterns(token: string): string[] {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [escaped];
    if (token.length >= 4) patterns.push(escaped.slice(0, -1));
    if (token.length >= 6) patterns.push(escaped.slice(0, -2));
    return [...new Set(patterns)];
}

function fuzzyMatch(label: string, searchQuery: string): { matches: boolean; score: number } {
    if (!searchQuery.trim()) return { matches: true, score: 0 };

    const lowerLabel = label.toLowerCase();
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    // Every token must match somewhere in the label
    let totalScore = 0;
    for (const token of tokens) {
        const patterns = buildFuzzyPatterns(token);
        let tokenMatched = false;

        for (let pi = 0; pi < patterns.length; pi++) {
            try {
                const regex = new RegExp(patterns[pi], 'i');
                if (regex.test(lowerLabel)) {
                    tokenMatched = true;
                    // Score: exact token gets highest, trimmed prefixes get less
                    // Also bonus for: starts-with, exact match, shorter labels
                    const matchIndex = lowerLabel.search(regex);
                    let tokenScore = 10 - pi * 3; // 10 for exact, 7 for -1 char, 4 for -2 chars

                    // Bonus: token appears at start of a word boundary
                    if (matchIndex === 0 || lowerLabel[matchIndex - 1] === ' ' || lowerLabel[matchIndex - 1] === '-') {
                        tokenScore += 5;
                    }

                    // Bonus: exact full match of a word
                    const afterMatch = matchIndex + patterns[pi].length;
                    if ((matchIndex === 0 || /[\s\-]/.test(lowerLabel[matchIndex - 1])) &&
                        (afterMatch >= lowerLabel.length || /[\s\-]/.test(lowerLabel[afterMatch]))) {
                        tokenScore += 8;
                    }

                    totalScore += tokenScore;
                    break;
                }
            } catch {
                // Invalid regex, skip
            }
        }

        if (!tokenMatched) return { matches: false, score: 0 };
    }

    // Bonus: shorter labels rank higher (more specific matches)
    totalScore += Math.max(0, 20 - label.length * 0.1);

    return { matches: true, score: totalScore };
}

function highlightLabel(label: string, searchQuery: string): React.ReactNode {
    if (!searchQuery.trim()) return label;

    const tokens = searchQuery.trim().split(/\s+/).filter(Boolean);
    const allPatterns: string[] = [];
    tokens.forEach(token => {
        buildFuzzyPatterns(token).forEach(p => allPatterns.push(p));
    });

    // Longest first for greedy matching, deduplicate
    allPatterns.sort((a, b) => b.length - a.length);
    const uniquePatterns = [...new Set(allPatterns)].filter(p => p.length > 0);
    if (!uniquePatterns.length) return label;

    try {
        const regex = new RegExp(`(${uniquePatterns.join('|')})`, 'gi');
        const parts = label.split(regex);
        if (parts.length <= 1) return label;

        const testRegex = new RegExp(`^(?:${uniquePatterns.join('|')})$`, 'i');
        return (
            <>
                {parts.map((part, i) => {
                    if (!part) return null;
                    if (testRegex.test(part)) {
                        return <span key={i} className="bg-primary/25 text-primary font-bold rounded-sm">{part}</span>;
                    }
                    return <span key={i}>{part}</span>;
                })}
            </>
        );
    } catch {
        return label;
    }
}

// ── Component ──────────────────────────────────────────────────────────────

export function SearchableSelect({
    options,
    value,
    onChange,
    placeholder = "Select...",
    className,
    triggerClassName,
    required,
    creatable,
    onOpenChange
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

    // Notify parent of open/close changes
    useEffect(() => {
        onOpenChange?.(isOpen);
    }, [isOpen]);

    const selectedOption = options.find(o => o.value === value);

    // Calculate dropdown position
    useLayoutEffect(() => {
        if (isOpen && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            const shouldFlip = (windowHeight - rect.bottom) < 320 && rect.top > 320;
            
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

    // ── Fuzzy tokenized filtering + scoring ──
    const filteredOptions = useMemo(() => {
        if (!search.trim()) return options;

        const scored: { option: Option; score: number }[] = [];
        for (const option of options) {
            const { matches, score } = fuzzyMatch(option.label, search);
            if (matches) scored.push({ option, score });
        }

        // Sort by score descending (best matches first)
        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.option);
    }, [options, search]);

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
            className="rounded-md shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-100 bg-card flex flex-col"
            onWheel={(e) => e.stopPropagation()}
        >
            <div className="border-b border-border bg-secondary/50 sticky top-0 shrink-0 z-10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full pl-9 pr-3 py-2 text-sm bg-background border-none rounded-md focus:outline-none text-foreground placeholder:text-muted-foreground transition-all"
                        placeholder={placeholder === "Select..." ? "Search..." : `Search ${placeholder}...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            </div>
            
            <div className="max-h-60 overflow-y-auto scrollbar-custom bg-card">
                {filteredOptions.length === 0 && !showCreate ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">No results found</div>
                ) : (
                    <div className="p-1">
                        {filteredOptions.map(option => (
                            <div
                                key={option.value}
                                className={cn(
                                    "px-3 py-2.5 text-sm cursor-pointer rounded-md hover:bg-[#fe9900] hover:text-black transition-colors text-foreground",
                                    option.value === value && "bg-[#fe9900] text-black font-medium"
                                )}
                                onClick={() => handleSelect(option.value)}
                            >
                                {highlightLabel(option.label, search)}
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
                    "w-full px-3 h-full border border-input rounded-md text-sm bg-background flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-ring transition-all hover:border-ring/50",
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
