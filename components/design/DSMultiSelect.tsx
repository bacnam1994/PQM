import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';

// ============================================
// MULTI-SELECT COMPONENT
// ============================================

export interface DSMultiSelectOption {
  value: string;
  label: string;
}

export interface DSMultiSelectProps {
  options: DSMultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  label?: string;
}

export const DSMultiSelect: React.FC<DSMultiSelectProps> = ({ 
  options, 
  value, 
  onChange, 
  placeholder = 'Chọn...',
  label 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const id = useId();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = useCallback((optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }, [onChange, value]);

  const selectedLabels = options.filter(o => value.includes(o.value)).map(o => o.label).join(', ');

  useEffect(() => {
    if (isOpen) {
      setHighlightedIndex(0);
      requestAnimationFrame(() => {
        optionRefs.current[0]?.focus();
      });
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  const focusOption = (idx: number) => {
    const clamped = Math.max(0, Math.min(options.length - 1, idx));
    setHighlightedIndex(clamped);
    optionRefs.current[clamped]?.focus();
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      const idx = e.key === 'ArrowDown' ? 0 : options.length - 1;
      focusOption(idx);
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusOption((highlightedIndex + 1) % options.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusOption((highlightedIndex - 1 + options.length) % options.length);
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      focusOption(0);
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      focusOption(options.length - 1);
      return;
    }
if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (highlightedIndex >= 0 && options[highlightedIndex]) {
        toggleOption(options[highlightedIndex].value);
      }
    }
  };

  return (
    <div className="space-y-2" ref={containerRef}>
      {label && <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">{label}</label>}
      <div className="relative">
        <button
          ref={triggerRef}
          id={`${id}-trigger`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={`${id}-listbox`}
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          onKeyDown={onTriggerKeyDown}
          className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-left font-medium text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900/50 transition-all flex items-center justify-between"
        >
          <span className={value.length === 0 ? 'text-slate-400' : 'truncate pr-2'}>
            {value.length === 0 ? placeholder : selectedLabels}
          </span>
          <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <div
            ref={listRef}
            id={`${id}-listbox`}
            role="listbox"
            aria-label={label || placeholder}
            aria-multiselectable="true"
            tabIndex={-1}
            onKeyDown={onListKeyDown}
            className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-auto"
          >
            {options.map((option, idx) => (
              <button
                key={option.value}
                ref={el => optionRefs.current[idx] = el}
                role="option"
                aria-selected={value.includes(option.value)}
                tabIndex={-1}
                onClick={() => toggleOption(option.value)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 ${highlightedIndex === idx ? 'bg-slate-50 dark:bg-slate-700/50' : ''} transition-colors`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  value.includes(option.value) 
                    ? 'bg-emerald-500 border-emerald-500' 
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {value.includes(option.value) && <Check size={12} className="text-white" />}
                </div>
                <span className="text-sm text-slate-700 dark:text-slate-200">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DSMultiSelect;

