import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, EyeOff, MoreHorizontal, Filter } from 'lucide-react';
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
  className?: string; // Add className prop
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);

  return (
    <div className={cn("flex items-center space-x-2 relative group", className)} {...props}>
      <span className="text-[10px] font-medium text-[#2E2E2E] uppercase leading-[13.3px]">{title}</span>
      {sortable && (
        <div className="relative">
          <button 
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
            }}
            className={cn(
                "h-4 w-4 p-0 hover:bg-slate-100 rounded-sm transition-colors focus:outline-none flex items-center justify-center",
                isOpen ? "bg-slate-100" : ""
            )}
          >
            {isDesc ? (
              <ArrowDown className="h-3 w-3 text-black" />
            ) : isAsc ? (
              <ArrowUp className="h-3 w-3 text-black" />
            ) : (
              <MoreHorizontal className="h-3 w-3 text-slate-300 hover:text-slate-500" />
            )}
          </button>

          {isOpen && (
            <div 
                ref={menuRef}
                className="absolute left-0 top-full mt-1 w-48 bg-white border border-slate-200 shadow-xl z-50 rounded-sm py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
                onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => { onSort?.(columnKey, 'asc'); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-[10px] text-slate-600 hover:bg-slate-50 hover:text-black flex items-center"
              >
                <ArrowUp className="mr-2 h-3.5 w-3.5 text-slate-400" />
                <span>Sort Ascending</span>
              </button>
              <button 
                onClick={() => { onSort?.(columnKey, 'desc'); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-[10px] text-slate-600 hover:bg-slate-50 hover:text-black flex items-center"
              >
                <ArrowDown className="mr-2 h-3.5 w-3.5 text-slate-400" />
                <span>Sort Descending</span>
              </button>
              
              <div className="h-px bg-slate-100 my-1" />
              
              <button 
                onClick={() => { onHide?.(columnKey); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-[10px] text-slate-600 hover:bg-slate-50 hover:text-black flex items-center"
              >
                <EyeOff className="mr-2 h-3.5 w-3.5 text-slate-400" />
                <span>Hide Column</span>
              </button>
              <button 
                onClick={() => { onFilter?.(columnKey); setIsOpen(false); }}
                className="w-full text-left px-3 py-2 text-[10px] text-slate-600 hover:bg-slate-50 hover:text-black flex items-center transition-colors"
                disabled={!onFilter}
              >
                <Filter className="mr-2 h-3.5 w-3.5 text-slate-400" />
                <span>Filter by {title}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
