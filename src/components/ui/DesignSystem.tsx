import React, { memo, forwardRef } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentMagnifyingGlassIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import { useUIStore } from '../../store/useUIStore';
import { parseDateToISO } from '../../utils';

// 1. Container cho thanh công cụ (Filter Bar - Tailwind UI standard)
export const DSFilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-surface p-3 sm:p-4 rounded-2xl border border-border shadow-xs flex flex-col md:flex-row gap-3 items-center ${className}`}>
    {children}
  </div>
);

// 2. Ô tìm kiếm chuẩn (Tailwind UI Minimal Search Input)
export const DSSearchInput = memo(forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }>((props, ref) => (
  <div className="relative flex-1 w-full group">
    <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors pointer-events-none" />
    <input 
      ref={ref}
      {...props}
      className={`w-full pl-10 pr-9 py-2 bg-surface-2 border border-border/80 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-surface rounded-xl text-sm font-medium text-ink outline-none focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-ink-faint ${props.className || ''}`}
    />
    {props.value && props.onClear && (
       <button
         type="button"
         onClick={props.onClear}
         className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink p-1 rounded-md hover:bg-surface-3 transition-colors"
         aria-label="Xóa nội dung tìm kiếm"
       >
          <XMarkIcon className="w-3.5 h-3.5" />
       </button>
    )}
  </div>
)));

// 3. Select Box chuẩn (Tailwind UI Select Menu with Icon)
interface DSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: any;
  containerClassName?: string;
}

export const DSSelect = forwardRef<HTMLSelectElement, DSSelectProps>(({ icon: Icon, containerClassName = '', className = '', children, ...props }, ref) => (
  <div className={`flex items-center gap-2 bg-surface-2 rounded-xl px-3 border border-border/80 hover:border-border focus-within:border-emerald-500 focus-within:bg-surface focus-within:ring-1 focus-within:ring-emerald-500 transition-all ${containerClassName}`}>
    {Icon && (
      typeof Icon === 'function' || typeof Icon === 'object' ? (
        React.isValidElement(Icon) ? Icon : <Icon className="w-4 h-4 text-ink-faint shrink-0" />
      ) : null
    )}
    <select 
      ref={ref}
      {...props}
      className={`py-2 bg-transparent border-none font-medium outline-none text-xs sm:text-sm text-ink cursor-pointer w-full focus:ring-0 ${className}`}
    >
      {children}
    </select>
  </div>
));

// 4. Nút chuyển đổi chế độ xem (Grid/List - Tailwind UI View Toggle)
export const DSViewToggle: React.FC<{ 
  viewMode: 'grid' | 'list'; 
  setViewMode: (mode: 'grid' | 'list') => void;
  gridIcon: any;
  listIcon: any;
}> = memo(({ viewMode, setViewMode, gridIcon: GridIcon, listIcon: ListIcon }) => {
  const renderIcon = (IconComp: any) => {
    if (!IconComp) return null;
    if (React.isValidElement(IconComp)) return IconComp;
    return <IconComp className="w-4 h-4" />;
  };

  return (
    <div className="inline-flex rounded-lg p-0.5 bg-surface-2 border border-border shrink-0">
      <button 
        type="button"
        onClick={() => setViewMode('grid')} 
        className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-surface text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-ink-faint hover:text-ink'}`}
        title="Chế độ lưới"
      >
        {renderIcon(GridIcon)}
      </button>
      <button 
        type="button"
        onClick={() => setViewMode('list')} 
        className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-surface text-emerald-700 dark:text-emerald-400 shadow-xs' : 'text-ink-faint hover:text-ink'}`}
        title="Chế độ danh sách"
      >
        {renderIcon(ListIcon)}
      </button>
    </div>
  );
});

// 5. Card chuẩn — Tailwind UI Card Panel
export const DSCard: React.FC<{ children: React.ReactNode; className?: string; isExpanded?: boolean }> = ({ children, className = '', isExpanded = false }) => (
  <div className={`bg-surface rounded-2xl border transition-all overflow-hidden ${isExpanded ? 'border-emerald-500/80 ring-1 ring-emerald-500 shadow-md' : 'border-border shadow-xs hover:shadow-sm'} ${className}`}>
    {children}
  </div>
);

// 6. Table Container chuẩn
export const DSTable: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-surface rounded-2xl border border-border shadow-xs overflow-hidden ${className}`}>
    <table className="w-full text-left">
      {children}
    </table>
  </div>
);

// 7. Input Form chuẩn (Tailwind UI Form Field)
export const DSFormInput = memo(forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string }>(({ label, className = '', ...props }, ref) => (
  <div className="space-y-1.5">
    {label && <label className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider pl-0.5">{label}</label>}
    <input 
      ref={ref}
      {...props}
      className={`w-full px-3.5 py-2.5 bg-surface-2 border border-border/80 focus:border-emerald-500 focus:bg-surface rounded-xl font-medium outline-none text-sm text-ink transition-all placeholder:text-ink-faint focus:ring-1 focus:ring-emerald-500 ${className}`}
    />
  </div>
)));

// 8. Trạng thái rỗng chuẩn (Tailwind UI Empty State)
export const DSEmptyState: React.FC<{ title: string; message: string; icon?: any; className?: string }> = ({ title, message, icon: Icon = DocumentMagnifyingGlassIcon, className = '' }) => {
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    return <Icon className="w-7 h-7 text-ink-faint" />;
  };

  return (
    <div className={`col-span-full p-12 sm:p-16 flex flex-col items-center justify-center text-center bg-surface-2/30 rounded-2xl border-2 border-dashed border-border animate-in fade-in duration-300 ${className}`}>
       <div className="p-3.5 bg-surface rounded-2xl mb-4 text-ink-faint shadow-xs border border-border">
         {renderIcon()}
       </div>
       <h3 className="text-ink font-semibold text-sm tracking-tight mb-1.5">{title}</h3>
       <p className="text-ink-faint text-xs sm:text-sm font-normal max-w-md leading-relaxed">{message}</p>
    </div>
  );
};

// 9. Input Date chuẩn hóa theo cấu hình dd/mm/yyyy
interface DSDateInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  name?: string;
}

export const DSDateInput: React.FC<DSDateInputProps> = ({
  label,
  value,
  onChange,
  required,
  className = '',
  name
}) => {
  const dateFormat = useUIStore(s => s.dateFormat) || 'DD/MM/YYYY';
  const hiddenInputRef = React.useRef<HTMLInputElement>(null);
  const [displayText, setDisplayText] = React.useState('');

  React.useEffect(() => {
    if (!value) {
      setDisplayText('');
      return;
    }
    try {
      const parts = value.split('-');
      if (parts.length === 3) {
        const yyyy = parts[0];
        const mm = parts[1];
        const dd = parts[2];
        if (dateFormat === 'DD/MM/YYYY') {
          setDisplayText(`${dd}/${mm}/${yyyy}`);
        } else if (dateFormat === 'MM/DD/YYYY') {
          setDisplayText(`${mm}/${dd}/${yyyy}`);
        } else {
          setDisplayText(`${yyyy}-${mm}-${dd}`);
        }
      } else {
        setDisplayText(value);
      }
    } catch {
      setDisplayText(value);
    }
  }, [value, dateFormat]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayText(e.target.value);
  };

  const handleBlur = () => {
    if (!displayText) {
      onChange('');
      return;
    }
    const isoDate = parseDateToISO(displayText);
    onChange(isoDate);
  };

  const handleIconClick = () => {
    if (hiddenInputRef.current) {
      try {
        hiddenInputRef.current.showPicker();
      } catch {
        hiddenInputRef.current.focus();
        hiddenInputRef.current.click();
      }
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="text-[11px] font-semibold text-ink-faint uppercase tracking-wider pl-0.5">{label}</label>}
      <div className="relative flex items-center w-full">
        <input
          type="text"
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder={dateFormat.toLowerCase()}
          required={required}
          className={`w-full pl-3.5 pr-10 py-2.5 bg-surface-2 border border-border/80 focus:border-emerald-500 focus:bg-surface rounded-xl font-medium outline-none text-sm text-ink transition-all placeholder:text-ink-faint focus:ring-1 focus:ring-emerald-500 ${className}`}
        />
        <button
          type="button"
          onClick={handleIconClick}
          className="absolute right-3 text-ink-faint hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1"
          aria-label="Chọn ngày từ lịch"
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
        <input
          type="date"
          ref={hiddenInputRef}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          name={name}
          className="absolute opacity-0 w-0 h-0 pointer-events-none"
        />
      </div>
    </div>
  );
};