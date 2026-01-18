import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, EyeOff, Filter, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TableColumnHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  column: any; // Can be a column object or just a string key
  title: string;
  sortable?: boolean;
  currentSortBy?: string;
  currentSortOrder?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  onHide?: (key: string) => void;
  onFilter?: (key: string) => void;
  onNumericFilter?: (key: string, min: string, max: string) => void;
  isNumeric?: boolean;
  currentMin?: string;
  currentMax?: string;
  className?: string; 
}

export function TableColumnHeader({
  column,
  title,
  sortable = true,
  currentSortBy,
  currentSortOrder,
  onSort,
  onHide,
  onFilter,
  onNumericFilter,
  isNumeric,
  currentMin = '',
  currentMax = '',
  className,
  ...props
}: TableColumnHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isSorted = currentSortBy === (typeof column === 'string' ? column : column.key);
  const isAsc = isSorted && currentSortOrder === 'asc';
  const isDesc = isSorted && currentSortOrder === 'desc';
  const columnKey = typeof column === 'string' ? column : column.key;

  const [localMin, setLocalMin] = useState(currentMin);
  const [localMax, setLocalMax] = useState(currentMax);

  useEffect(() => {
    setLocalMin(currentMin);
    setLocalMax(currentMax);
  }, [currentMin, currentMax]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuRef]);

  const handleNumericApply = () => {
    onNumericFilter?.(columnKey, localMin, localMax);
    setIsOpen(false);
  };

  return (
    <div className={cn("flex items-center space-x-1 relative group", className)} {...props}>
      {sortable && (
        <div className="relative">
          <button 
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className={cn(
                "h-5 w-5 p-0 hover:bg-secondary rounded-sm transition-colors focus:outline-none flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground",
                isOpen ? "bg-secondary text-foreground" : ""
            )}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {isOpen && (
            <div 
                ref={menuRef}
                className="absolute left-0 top-full mt-1 w-48 bg-card border border-border shadow-xl z-50 rounded-sm py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
                onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => { onSort?.(columnKey, 'asc'); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center cursor-pointer transition-colors"
              >
                <ArrowUp className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>Sort Ascending</span>
              </button>
              <button 
                onClick={() => { onSort?.(columnKey, 'desc'); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center cursor-pointer transition-colors"
              >
                <ArrowDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>Sort Descending</span>
              </button>
              
              <div className="h-px bg-border my-1" />
              
              <button 
                onClick={() => { onHide?.(columnKey); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center cursor-pointer transition-colors"
              >
                <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <span>Hide Column</span>
              </button>

              {/* Show Filter option even if onFilter is missing, for UI demo, or handle conditionally */}
               <button 
                  onClick={() => { onFilter?.(columnKey); setIsOpen(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center transition-colors cursor-pointer",
                    !onFilter && "opacity-50 cursor-not-allowed hidden" 
                  )}
                >
                  <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span>Filter by {title}</span>
                </button>

              {isNumeric && onNumericFilter && (
                <div className="px-3 py-2 space-y-2 border-t border-border mt-1">
                  <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Filter Range</div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      placeholder="Min"
                      value={localMin}
                      onChange={(e) => setLocalMin(e.target.value)}
                      className="w-full px-2 py-1 bg-secondary/50 border border-border rounded-sm text-[10px] focus:outline-none focus:border-primary text-foreground"
                    />
                    <span className="text-muted-foreground">-</span>
                    <input 
                      type="number" 
                      placeholder="Max"
                      value={localMax}
                      onChange={(e) => setLocalMax(e.target.value)}
                      className="w-full px-2 py-1 bg-secondary/50 border border-border rounded-sm text-[10px] focus:outline-none focus:border-primary text-foreground"
                    />
                  </div>
                  <div className="flex space-x-2 pt-1">
                    <button 
                      onClick={() => { setLocalMin(''); setLocalMax(''); onNumericFilter(columnKey, '', ''); setIsOpen(false); }}
                      className="flex-1 px-2 py-1 text-[9px] font-bold text-muted-foreground border border-border uppercase hover:bg-secondary cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={handleNumericApply}
                      className="flex-1 px-2 py-1 text-[9px] font-bold text-black bg-[#FFEF5F] uppercase hover:opacity-90 cursor-pointer"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <span className="text-[10px] font-medium text-foreground uppercase leading-[13.3px] select-none">{title}</span>
      {/* Sort Indicator separated from menu trigger */}
      {isAsc && <ArrowUp className="h-3 w-3 text-primary" />}
      {isDesc && <ArrowDown className="h-3 w-3 text-primary" />}
    </div>
  );
}
