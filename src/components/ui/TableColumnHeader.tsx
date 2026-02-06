import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, ArrowDown, EyeOff, Filter, GripVertical, Check, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterOption {
  label: string;
  value: string;
}

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
  // New filter props
  filterOptions?: FilterOption[];
  selectedFilters?: string[];
  onFilterChange?: (key: string, values: string[]) => void;
  // Text search filter
  textFilter?: string;
  onTextFilterChange?: (key: string, value: string) => void;
  // Date range filter
  isDate?: boolean;
  dateFrom?: string;
  dateTo?: string;
  onDateFilterChange?: (key: string, from: string, to: string) => void;
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
  filterOptions,
  selectedFilters = [],
  onFilterChange,
  textFilter = '',
  onTextFilterChange,
  isDate,
  dateFrom = '',
  dateTo = '',
  onDateFilterChange,
  className,
  ...props
}: TableColumnHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isSorted = currentSortBy === (typeof column === 'string' ? column : column.key);
  const isAsc = isSorted && currentSortOrder === 'asc';
  const isDesc = isSorted && currentSortOrder === 'desc';
  const columnKey = typeof column === 'string' ? column : column.key;

  const [localMin, setLocalMin] = useState(currentMin);
  const [localMax, setLocalMax] = useState(currentMax);
  const [localTextFilter, setLocalTextFilter] = useState(textFilter);
  const [localDateFrom, setLocalDateFrom] = useState(dateFrom);
  const [localDateTo, setLocalDateTo] = useState(dateTo);
  const [filterSearch, setFilterSearch] = useState('');
  const [localSelectedFilters, setLocalSelectedFilters] = useState<string[]>(selectedFilters);

  useEffect(() => {
    setLocalMin(currentMin);
    setLocalMax(currentMax);
  }, [currentMin, currentMax]);

  useEffect(() => {
    setLocalTextFilter(textFilter);
  }, [textFilter]);

  useEffect(() => {
    setLocalDateFrom(dateFrom);
    setLocalDateTo(dateTo);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    // Compare arrays using JSON to avoid infinite loop when selectedFilters has same values but different reference
    if (JSON.stringify([...localSelectedFilters].sort()) !== JSON.stringify([...selectedFilters].sort())) {
      setLocalSelectedFilters(selectedFilters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(selectedFilters)]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowFilterPanel(false);
      }
    }
    
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setShowFilterPanel(false);
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
    setShowFilterPanel(false);
  };

  const handleTextApply = () => {
    onTextFilterChange?.(columnKey, localTextFilter);
    setIsOpen(false);
    setShowFilterPanel(false);
  };

  const handleDateApply = () => {
    onDateFilterChange?.(columnKey, localDateFrom, localDateTo);
    setIsOpen(false);
    setShowFilterPanel(false);
  };

  const handleMultiSelectApply = () => {
    onFilterChange?.(columnKey, localSelectedFilters);
    setIsOpen(false);
    setShowFilterPanel(false);
  };

  const toggleFilterOption = (value: string) => {
    setLocalSelectedFilters(prev => 
      prev.includes(value) 
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const clearAllFilters = () => {
    setLocalSelectedFilters([]);
    onFilterChange?.(columnKey, []);
    setIsOpen(false);
    setShowFilterPanel(false);
  };

  const hasActiveFilter = selectedFilters.length > 0 || textFilter || (dateFrom && dateTo) || (currentMin || currentMax);

  const filteredOptions = filterOptions?.filter(opt => 
    opt.label.toLowerCase().includes(filterSearch.toLowerCase())
  );

  return (
    <div className={cn("flex items-center space-x-1 relative group", className)} {...props}>
      {sortable && (
        <div className="relative">
          <button 
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(!isOpen);
              setShowFilterPanel(false);
            }}
            className={cn(
                "h-5 w-5 p-0 hover:bg-secondary rounded-sm transition-colors focus:outline-none flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground",
                isOpen ? "bg-secondary text-foreground" : "",
                hasActiveFilter ? "text-primary" : ""
            )}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {isOpen && !showFilterPanel && (
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
              
              {onHide && (
                <button 
                  onClick={() => { onHide?.(columnKey); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center cursor-pointer transition-colors"
                >
                  <EyeOff className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span>Hide Column</span>
                </button>
              )}

              {/* Filter Option - opens filter panel */}
              {(filterOptions || onTextFilterChange || isNumeric || isDate) && (
                <button 
                  onClick={() => { setShowFilterPanel(true); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-[10px] hover:bg-secondary hover:text-foreground flex items-center transition-colors cursor-pointer",
                    hasActiveFilter ? "text-primary font-bold" : "text-muted-foreground"
                  )}
                >
                  <Filter className={cn("mr-2 h-3.5 w-3.5", hasActiveFilter ? "text-primary" : "text-muted-foreground")} />
                  <span>Filter by {title}</span>
                  {hasActiveFilter && <span className="ml-auto text-[9px] bg-primary text-primary-foreground px-1 rounded">Active</span>}
                </button>
              )}

              {/* Legacy onFilter callback */}
              {onFilter && !filterOptions && !onTextFilterChange && !isNumeric && !isDate && (
                <button 
                  onClick={() => { onFilter?.(columnKey); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center transition-colors cursor-pointer"
                >
                  <Filter className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <span>Filter by {title}</span>
                </button>
              )}
            </div>
          )}

          {/* Filter Panel */}
          {isOpen && showFilterPanel && (
            <div 
                ref={menuRef}
                className="absolute left-0 top-full mt-1 w-64 bg-card border border-border shadow-xl z-50 rounded-sm py-2 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
                onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 pb-2 border-b border-border">
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">Filter: {title}</span>
                <button 
                  onClick={() => setShowFilterPanel(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Multi-select filter options */}
              {filterOptions && filterOptions.length > 0 && (
                <div className="max-h-60 overflow-y-auto">
                  {filterOptions.length > 5 && (
                    <div className="px-3 py-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                        <input 
                          type="text"
                          placeholder="Search..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-secondary/50 border border-border rounded focus:outline-none focus:border-primary text-foreground"
                        />
                      </div>
                    </div>
                  )}
                  <div className="py-1">
                    {filteredOptions?.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => toggleFilterOption(opt.value)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-[10px] flex items-center cursor-pointer transition-colors",
                          localSelectedFilters.includes(opt.value) 
                            ? "bg-primary/10 text-primary font-medium" 
                            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 mr-2 border rounded-sm flex items-center justify-center transition-colors",
                          localSelectedFilters.includes(opt.value) 
                            ? "bg-primary border-primary" 
                            : "border-border"
                        )}>
                          {localSelectedFilters.includes(opt.value) && (
                            <Check className="h-3 w-3 text-primary-foreground" />
                          )}
                        </div>
                        <span className="truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex space-x-2 px-3 pt-2 border-t border-border">
                    <button 
                      onClick={clearAllFilters}
                      className="flex-1 px-2 py-1.5 text-[9px] font-bold text-muted-foreground border border-border uppercase hover:bg-secondary cursor-pointer transition-colors rounded-sm"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={handleMultiSelectApply}
                      className="flex-1 px-2 py-1.5 text-[9px] font-bold text-primary-foreground bg-primary uppercase hover:bg-primary/90 cursor-pointer rounded-sm"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Text filter */}
              {onTextFilterChange && !filterOptions && (
                <div className="px-3 py-2">
                  <input 
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}...`}
                    value={localTextFilter}
                    onChange={(e) => setLocalTextFilter(e.target.value)}
                    className="w-full px-2 py-1.5 text-[10px] bg-secondary/50 border border-border rounded focus:outline-none focus:border-primary text-foreground"
                  />
                  <div className="flex space-x-2 pt-2">
                    <button 
                      onClick={() => { setLocalTextFilter(''); onTextFilterChange(columnKey, ''); setIsOpen(false); setShowFilterPanel(false); }}
                      className="flex-1 px-2 py-1.5 text-[9px] font-bold text-muted-foreground border border-border uppercase hover:bg-secondary cursor-pointer transition-colors rounded-sm"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={handleTextApply}
                      className="flex-1 px-2 py-1.5 text-[9px] font-bold text-primary-foreground bg-primary uppercase hover:bg-primary/90 cursor-pointer rounded-sm"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Date range filter */}
              {isDate && onDateFilterChange && (
                <div className="px-3 py-2 space-y-2">
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">From</label>
                    <input 
                      type="date"
                      value={localDateFrom}
                      onChange={(e) => setLocalDateFrom(e.target.value)}
                      className="w-full px-2 py-1.5 text-[10px] bg-secondary/50 border border-border rounded focus:outline-none focus:border-primary text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-muted-foreground uppercase">To</label>
                    <input 
                      type="date"
                      value={localDateTo}
                      onChange={(e) => setLocalDateTo(e.target.value)}
                      className="w-full px-2 py-1.5 text-[10px] bg-secondary/50 border border-border rounded focus:outline-none focus:border-primary text-foreground"
                    />
                  </div>
                  <div className="flex space-x-2 pt-1">
                    <button 
                      onClick={() => { setLocalDateFrom(''); setLocalDateTo(''); onDateFilterChange(columnKey, '', ''); setIsOpen(false); setShowFilterPanel(false); }}
                      className="flex-1 px-2 py-1.5 text-[9px] font-bold text-muted-foreground border border-border uppercase hover:bg-secondary cursor-pointer transition-colors rounded-sm"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={handleDateApply}
                      className="flex-1 px-2 py-1.5 text-[9px] font-bold text-primary-foreground bg-primary uppercase hover:bg-primary/90 cursor-pointer rounded-sm"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* Numeric range filter */}
              {isNumeric && onNumericFilter && (
                <div className="px-3 py-2 space-y-2">
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
                      onClick={() => { setLocalMin(''); setLocalMax(''); onNumericFilter(columnKey, '', ''); setIsOpen(false); setShowFilterPanel(false); }}
                      className="flex-1 px-2 py-1 text-[9px] font-bold text-muted-foreground border border-border uppercase hover:bg-secondary cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                    <button 
                      onClick={handleNumericApply}
                      className="flex-1 px-2 py-1 text-[9px] font-bold text-primary-foreground bg-primary uppercase hover:bg-primary/90 cursor-pointer"
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
      {/* Filter Active Indicator */}
      {hasActiveFilter && <Filter className="h-3 w-3 text-primary fill-primary/20" />}
    </div>
  );
}
