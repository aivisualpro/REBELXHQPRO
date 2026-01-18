import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    totalItems: number;
    itemsPerPage?: number;
    itemName?: string;
}

export function Pagination({
    currentPage,
    totalPages,
    onPageChange,
    totalItems,
    itemsPerPage = 20,
    itemName = 'items'
}: PaginationProps) {
    const [goToPage, setGoToPage] = useState('');

    // Update input when page changes externally
    useEffect(() => {
        setGoToPage('');
    }, [currentPage]);

    const handleGoToPage = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const pageNum = parseInt(goToPage);
            if (pageNum >= 1 && pageNum <= totalPages) {
                onPageChange(pageNum);
            }
        }
    };

    return (
        <div className="flex items-center justify-between p-0 bg-transparent">
            <div className="text-[10px] text-muted-foreground font-medium">
                Showing <span className="text-foreground">{totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="text-foreground">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="text-foreground">{totalItems}</span> {itemName}
            </div>

            <div className="flex items-center space-x-2">
                <button
                    disabled={currentPage === 1}
                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center space-x-1">
                    {(() => {
                        let startPage = Math.max(1, currentPage - 2);
                        let endPage = Math.min(totalPages, startPage + 4);

                        if (endPage - startPage < 4) {
                            startPage = Math.max(1, endPage - 4);
                        }

                        return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map(p => (
                            <button
                                key={p}
                                onClick={() => onPageChange(p)}
                                className={cn(
                                    "w-6 h-6 flex items-center justify-center text-[10px] font-bold rounded-sm transition-colors cursor-pointer",
                                    currentPage === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                                )}
                            >
                                {p}
                            </button>
                        ));
                    })()}
                </div>

                <div className="flex items-center space-x-1 ml-2 border-l border-border pl-2">
                    <span className="text-[10px] text-muted-foreground">Go to</span>
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={goToPage}
                        onChange={(e) => setGoToPage(e.target.value)}
                        onKeyDown={handleGoToPage}
                        className="w-8 h-6 text-center text-[10px] bg-background border border-border text-foreground focus:outline-none focus:border-primary transition-colors"
                    />
                </div>

                <button
                    disabled={currentPage === totalPages}
                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
