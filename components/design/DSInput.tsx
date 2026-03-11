import React, { useId, useState, useEffect, useRef } from 'react';
import { Search, LucideIcon, ChevronDown } from 'lucide-react';

// ============================================
// FILTER BAR - Glassmorphism & Enhanced
// ============================================

export const DSFilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`glass p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center transition-all duration-300 hover:shadow-lg ${className}`}>
    {children}
  </div>
);

// ============================================
// SEARCH INPUT - Enhanced with animations
// ============================================

export interface DSSearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const DSSearchInput: React.FC<DSSearchInputProps> = (props) => (
  <div className="relative flex-1 w-full group">
    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-[#009639] dark:group-focus-within:text-emerald-400 transition-colors" size={20} />
    <input 
      {...props}
      className={`w-full pl-12 pr-4 py-3 bg-slate-50/80 dark:bg-slate-700/80 backdrop-blur-sm border border-transparent focus:bg-white dark:focus:bg-slate-600 rounded-xl font-medium outline-none shadow-inner text-base placeholder:font-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-4 focus:ring-emerald-100/50 dark:focus:ring-emerald-900/30 focus:border-emerald-200 dark:focus:border-emerald-700 transition-all duration-300 text-slate-700 dark:text-slate-200 ${props.className || ''}`}
    />
  </div>
);

// ============================================
// SELECT - Enhanced with animations
// ============================================

export interface DSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: LucideIcon;
  containerClassName?: string;
}

export const DSSelect: React.FC<DSSelectProps> = ({ icon: Icon, containerClassName = '', className = '', children, ...props }) => (
  <div className={`flex items-center gap-2 bg-slate-50/80 dark:bg-slate-700/80 backdrop-blur-sm rounded-xl px-4 border border-slate-200 dark:border-slate-600 hover:border-[#009639] dark:hover:border-emerald-500 hover:shadow-md focus-within:ring-2 focus-within:ring-emerald-100 dark:focus-within:ring-emerald-900/30 transition-all duration-300 ${containerClassName}`}>
    {Icon && <Icon size={18} className="text-slate-400 dark:text-slate-400 shrink-0 transition-colors" />}
    <select 
      {...props}
      className={`py-3 bg-transparent border-none font-medium outline-none text-sm text-slate-600 dark:text-slate-300 cursor-pointer w-full ${className}`}
    >
      {children}
    </select>
  </div>
);

// ============================================
// VIEW TOGGLE - With enhanced hover animations
// ============================================

export interface DSViewToggleProps {
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  gridIcon: LucideIcon;
  listIcon: LucideIcon;
}

export const DSViewToggle: React.FC<DSViewToggleProps> = ({ viewMode, setViewMode, gridIcon: GridIcon, listIcon: ListIcon }) => (
  <div className="flex bg-slate-100/80 dark:bg-slate-700/80 backdrop-blur-sm p-1.5 rounded-xl shrink-0 shadow-inner">
    <button 
      onClick={() => setViewMode('grid')} 
      className={`p-2.5 rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-lg active:scale-95 ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-md ring-2 ring-emerald-200 dark:ring-emerald-700' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-600/50'}`}
    >
      <GridIcon size={20} />
    </button>
    <button 
      onClick={() => setViewMode('list')} 
      className={`p-2.5 rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-lg active:scale-95 ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-md ring-2 ring-emerald-200 dark:ring-emerald-700' : 'text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-600/50'}`}
    >
      <ListIcon size={20} />
    </button>
  </div>
);

// ============================================
// FORM INPUT - Supports both controlled (value) and uncontrolled (defaultValue)
// ============================================

// Support both event-based and value-based onChange
type OnChangeValue = ((value: string) => void) | ((e: React.ChangeEvent<HTMLInputElement>) => void) | undefined;

export interface DSFormInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'defaultValue'> {
  label?: string;
  onChange?: OnChangeValue;
  defaultValue?: string;
}

/**
 * DSFormInput - supports both controlled (value) and uncontrolled (defaultValue) modes.
 * 
 * Controlled mode (value prop): Parent manages the value, input is controlled
 * Uncontrolled mode (defaultValue only): Input manages its own value like native HTML input
 * 
 * This matches the behavior of BatchList form inputs.
 */
export const DSFormInput = React.memo<DSFormInputProps>(({ label, className = '', id, value, defaultValue, onChange, ...props }) => {
  const reactId = React.useId?.() || id || undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const isFocusedRef = useRef(false);
  
  // For uncontrolled mode: local state tracks input value
  // For controlled mode: local state is initialized with value but tracks focus state only
  const [localValue, setLocalValue] = useState(defaultValue || value || '');
  
  // Determine which value to display
  // If controlled (value prop): use value from parent
  // If uncontrolled (defaultValue only): use local state
  const displayValue = isControlled ? (value || '') : localValue;
  
  // Update local state when controlled value changes (but not when focused)
  useEffect(() => {
    if (isControlled && !isFocusedRef.current) {
      setLocalValue(value || '');
    }
  }, [value, isControlled]);
  
  // Update local state when defaultValue changes (for initial load)
  useEffect(() => {
    if (!isControlled && defaultValue !== undefined) {
      setLocalValue(defaultValue);
    }
  }, [defaultValue, isControlled]);
  
  const handleFocus = () => {
    isFocusedRef.current = true;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // For uncontrolled mode: update local state
    if (!isControlled) {
      setLocalValue(newValue);
    }
    
    // Always call onChange for parent to update
    if (onChange) {
      const onChangeStr = onChange.toString();
      
      // If the onChange expects an event (has 'target' or 'e.' in the function body)
      if (onChangeStr.includes('target') || onChangeStr.includes('e.')) {
        // Event-based - pass the event directly
        onChange(e);
      } else {
        // Value-based - pass string value immediately
        (onChange as (value: string) => void)(newValue);
      }
    }
  };
  
  const handleBlur = () => {
    isFocusedRef.current = false;
    // For uncontrolled mode: sync with parent after blur if needed
    if (!isControlled && defaultValue !== undefined) {
      setLocalValue(defaultValue);
    }
  };
  
  return (
    <div className="space-y-2 group">
      {label && (
        <label htmlFor={reactId} className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1 transition-colors group-focus-within:text-[#009639] dark:group-focus-within:text-emerald-400">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={reactId}
        aria-label={label}
        {...props}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={`w-full px-5 py-3.5 bg-slate-50/80 dark:bg-slate-700/80 backdrop-blur-sm border border-transparent focus:bg-white dark:focus:bg-slate-600 rounded-xl font-medium-slate-600 outline-none shadow-inner text-base text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-emerald-100/50 dark:focus:ring-emerald-900/30 focus:border-emerald-200 dark:focus:border-emerald-700 transition-all duration-300 ${className}`}
      />
    </div>
  );
});

DSFormInput.displayName = 'DSFormInput';

export default {
  DSFilterBar,
  DSSearchInput,
  DSSelect,
  DSViewToggle,
  DSFormInput,
};
