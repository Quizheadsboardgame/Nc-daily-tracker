import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { cloudDb } from '../db/cloudDatabase';

export function getVendorColorEmoji(hex?: string): string {
  if (!hex) return '⚪';
  const clean = hex.toLowerCase().trim();
  if (clean === '#2563eb' || clean.includes('blue')) return '🔵';
  if (clean === '#059669' || clean === '#10b981' || clean.includes('green') || clean.includes('emerald')) return '🟢';
  if (clean === '#7c3aed' || clean === '#8b5cf6' || clean.includes('violet') || clean.includes('purple')) return '🟣';
  if (clean === '#d97706' || clean === '#f59e0b' || clean.includes('amber') || clean.includes('orange') || clean === '#ea580c') return '🟠';
  if (clean === '#dc2626' || clean === '#e11d48' || clean.includes('red') || clean.includes('rose')) return '🔴';
  if (clean === '#0891b2' || clean === '#06b6d4' || clean.includes('cyan') || clean.includes('teal') || clean === '#0d9488') return '🔷';
  if (clean === '#4f46e5' || clean.includes('indigo')) return '🟣';
  if (clean === '#db2777' || clean.includes('pink')) return '🌸';
  if (clean === '#65a30d' || clean.includes('lime')) return '🟢';
  if (clean === '#475569' || clean.includes('slate') || clean.includes('gray')) return '⚫';
  return '●';
}

export interface VendorDropdownProps {
  id?: string;
  value: string;
  onChange: (vendor: string) => void;
  vendors?: string[];
  placeholder?: string;
  hasError?: boolean;
  includeAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  buttonClassName?: string;
  required?: boolean;
  disabled?: boolean;
}

export const VendorDropdown: React.FC<VendorDropdownProps> = ({
  id,
  value,
  onChange,
  vendors = [],
  placeholder = '-- Choose Vendor --',
  hasError = false,
  includeAllOption = false,
  allOptionLabel = 'All Vendors',
  className = '',
  buttonClassName = '',
  required = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openUpwards, setOpenUpwards] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Combine passed vendors with database known vendors to guarantee NO vendor is ever omitted
  const effectiveVendors = useMemo(() => {
    const set = new Set<string>();

    // 1. Any vendors explicitly passed in prop
    if (Array.isArray(vendors)) {
      vendors.forEach((v) => {
        if (v && v.trim()) set.add(v.trim());
      });
    }

    // 2. Comprehensive cloud database roster (includes preloaded + all sales + all trades + color roster)
    cloudDb.getKnownVendors().forEach((v) => {
      if (v && v.trim()) set.add(v.trim());
    });

    // 3. Ensure current value is included if present and valid
    if (value && value !== 'all' && value.trim()) {
      set.add(value.trim());
    }

    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
  }, [vendors, value]);

  // Filtered by in-dropdown search query
  const filteredVendors = useMemo(() => {
    if (!searchTerm.trim()) return effectiveVendors;
    const clean = searchTerm.toLowerCase().trim();
    return effectiveVendors.filter((v) => v.toLowerCase().includes(clean));
  }, [effectiveVendors, searchTerm]);

  // Position calculation and outside click handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);

      // Check available space below to decide if we should open upwards
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 280 && rect.top > spaceBelow) {
          setOpenUpwards(true);
        } else {
          setOpenUpwards(false);
        }
      }

      // Auto-focus search input if vendors list is large
      if (effectiveVendors.length > 5) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    } else {
      setSearchTerm('');
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, effectiveVendors.length]);

  const isAllSelected = includeAllOption && (value === 'all' || !value);
  const isVendorSelected = Boolean(value) && (!includeAllOption || value !== 'all');
  const selectedVendorColor = isVendorSelected ? cloudDb.getVendorColor(value) : null;

  const handleSelect = (v: string) => {
    onChange(v);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Hidden synced native select for accessibility & automation */}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {includeAllOption ? (
          <option value="all">🌐 {allOptionLabel}</option>
        ) : (
          <option value="">{placeholder}</option>
        )}
        {effectiveVendors.map((v) => {
          const color = cloudDb.getVendorColor(v);
          const emoji = getVendorColorEmoji(color);
          return (
            <option key={v} value={v}>
              {emoji} {v}
            </option>
          );
        })}
      </select>

      {/* Trigger Button with colored dot and vendor name */}
      <button
        ref={triggerRef}
        type="button"
        id={id ? `${id}-btn` : undefined}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer text-left select-none bg-white ${
          hasError
            ? 'border-rose-400 bg-rose-50/30 text-rose-900 focus:ring-2 focus:ring-rose-500/20'
            : isOpen
            ? 'border-zinc-900 ring-2 ring-zinc-900/10 shadow-xs'
            : 'border-zinc-300 hover:border-zinc-400 text-zinc-900'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-zinc-100' : ''} ${buttonClassName}`}
      >
        <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
          {isVendorSelected ? (
            <>
              {/* Signature Colored Dot next to the vendor name */}
              <span
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white ring-1 ring-zinc-900/15 transition-transform"
                style={{ backgroundColor: selectedVendorColor || '#2563eb' }}
                aria-hidden="true"
              />
              <span className="truncate font-bold text-zinc-900">{value}</span>
            </>
          ) : isAllSelected ? (
            <>
              <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-zinc-200 border border-white ring-1 ring-zinc-900/15 flex items-center justify-center text-[10px] text-zinc-600 font-black">
                •
              </span>
              <span className="truncate font-bold text-zinc-800">{allOptionLabel}</span>
            </>
          ) : (
            <>
              <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-zinc-200 border border-dashed border-zinc-400 ring-1 ring-zinc-900/10" />
              <span className="truncate text-zinc-400 font-medium">{placeholder}</span>
            </>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-zinc-700' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Listbox with color dots and instant search */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute z-50 left-0 right-0 ${
            openUpwards ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } bg-white rounded-2xl border border-zinc-250 shadow-2xl p-1.5 animate-fade-in flex flex-col`}
          style={{ maxHeight: '22rem', minWidth: '100%' }}
        >
          {/* Header & Instant Search Filter */}
          <div className="p-1.5 pb-2 border-b border-zinc-100 shrink-0 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                Select Vendor ({effectiveVendors.length} total)
              </span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900"
                >
                  Clear
                </button>
              )}
            </div>

            {effectiveVendors.length > 4 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to filter vendors..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-100/80 focus:bg-white rounded-lg border border-transparent focus:border-zinc-300 focus:outline-hidden text-zinc-900 font-medium transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredVendors.length > 0) {
                      e.preventDefault();
                      handleSelect(filteredVendors[0]);
                    } else if (e.key === 'Escape') {
                      setIsOpen(false);
                    }
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Scrollable Options List */}
          <div
            className="overflow-y-auto overscroll-contain flex-1 py-1 divide-y divide-zinc-50"
            style={{ maxHeight: '16rem', WebkitOverflowScrolling: 'touch' }}
          >
            {includeAllOption && !searchTerm && (
              <button
                type="button"
                role="option"
                aria-selected={value === 'all' || !value}
                onClick={() => handleSelect('all')}
                className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs rounded-lg transition-colors cursor-pointer ${
                  value === 'all' || !value
                    ? 'bg-zinc-100 font-bold text-zinc-950'
                    : 'text-zinc-700 hover:bg-zinc-50 font-medium'
                }`}
              >
                <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-zinc-300 border border-white ring-1 ring-zinc-900/15 flex items-center justify-center text-[10px] text-zinc-600 font-black">
                  •
                </span>
                <span className="truncate flex-1 font-bold">{allOptionLabel}</span>
                {(value === 'all' || !value) && (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-auto" />
                )}
              </button>
            )}

            {!includeAllOption && !searchTerm && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => handleSelect('')}
                className="w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs rounded-lg transition-colors cursor-pointer text-zinc-400 hover:bg-zinc-50 font-medium"
              >
                <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-zinc-200 border border-dashed border-zinc-400 ring-1 ring-zinc-900/10" />
                <span className="truncate flex-1">{placeholder}</span>
              </button>
            )}

            {filteredVendors.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-400">
                No vendors found matching &ldquo;{searchTerm}&rdquo;
              </div>
            ) : (
              filteredVendors.map((v) => {
                const color = cloudDb.getVendorColor(v);
                const isSelected = value === v;

                return (
                  <button
                    type="button"
                    key={v}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(v)}
                    className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs rounded-lg transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-100 font-bold text-zinc-950'
                        : 'text-zinc-700 hover:bg-zinc-50 font-medium'
                    }`}
                  >
                    {/* Signature Brand Color Dot next to each vendor's name */}
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white ring-1 ring-zinc-900/15 transition-transform"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span className="truncate flex-1 font-semibold text-zinc-900">{v}</span>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 ml-auto" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
