import React, { memo, forwardRef, useId } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentMagnifyingGlassIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { motion, useReducedMotion } from 'motion/react';
import { MOTION_SPRINGS } from '../../lib/motion';
import { useUIStore } from '../../store/useUIStore';
import { parseDateToISO } from '../../utils';

// 1. Container cho thanh công cụ (Filter Bar - Modern Glassmorphic)
export const DSFilterBar: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`glass-panel bg-surface/90 dark:bg-surface/80 backdrop-blur-md p-3 sm:p-3.5 rounded-2xl border border-border/80 shadow-xs flex flex-col md:flex-row gap-3 items-center transition-all ${className}`}
  >
    {children}
  </div>
);

// 2. Ô tìm kiếm chuẩn (Linear Minimal Search Input)
export const DSSearchInput = memo(
  forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }
  >((props, ref) => (
    <div className="relative flex-1 w-full group">
      <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 group-focus-within:scale-110 transition-all pointer-events-none" />
      <input
        ref={ref}
        {...props}
        className={`w-full pl-10 pr-9 py-2 bg-surface-2/80 hover:bg-surface-2 border border-border/80 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-surface rounded-xl text-sm font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all placeholder:text-ink-faint shadow-2xs ${props.className || ''}`}
      />
      {props.value && props.onClear && (
        <button
          type="button"
          onClick={props.onClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink p-1 rounded-lg hover:bg-surface-3/80 active:scale-95 transition-all cursor-pointer"
          aria-label="Xóa nội dung tìm kiếm"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  ))
);

// 3. Select Box chuẩn (Tailwind UI Select Menu with Icon)
interface DSSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: any;
  containerClassName?: string;
}

export const DSSelect = forwardRef<HTMLSelectElement, DSSelectProps>(
  ({ icon: Icon, containerClassName = '', className = '', children, ...props }, ref) => (
    <div
      className={`flex items-center gap-2 bg-surface-2/80 hover:bg-surface-2 rounded-xl px-3 border border-border/80 hover:border-emerald-500/35 focus-within:border-emerald-500 focus-within:bg-surface focus-within:ring-2 focus-within:ring-emerald-500/15 shadow-2xs transition-all ${containerClassName}`}
    >
      {Icon &&
        (typeof Icon === 'function' || typeof Icon === 'object' ? (
          React.isValidElement(Icon) ? (
            Icon
          ) : (
            <Icon className="w-4 h-4 text-emerald-600/80 dark:text-emerald-400/80 shrink-0" />
          )
        ) : null)}
      <select
        ref={ref}
        {...props}
        className={`py-2 bg-transparent border-none font-medium outline-none text-xs sm:text-sm text-ink cursor-pointer w-full focus:ring-0 ${className}`}
      >
        {children}
      </select>
    </div>
  )
);

// 4. Nút chuyển đổi chế độ xem (Grid/List - Animate UI Gliding Toggle)
export const DSViewToggle: React.FC<{
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  gridIcon: any;
  listIcon: any;
}> = memo(({ viewMode, setViewMode, gridIcon: GridIcon, listIcon: ListIcon }) => {
  const toggleId = useId();
  const shouldReduceMotion = useReducedMotion();

  const renderIcon = (IconComp: any) => {
    if (!IconComp) return null;
    if (React.isValidElement(IconComp)) return IconComp;
    return <IconComp className="w-4 h-4 relative z-10" />;
  };

  return (
    <div className="inline-flex items-center rounded-xl p-1 bg-surface-2/90 border border-border/80 shrink-0 shadow-2xs">
      <button
        type="button"
        onClick={() => setViewMode('grid')}
        className={`relative p-1.5 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'grid'
            ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
            : 'text-ink-faint hover:text-ink'
        }`}
        title="Chế độ lưới"
        aria-label="Chế độ lưới"
      >
        {viewMode === 'grid' &&
          (shouldReduceMotion ? (
            <div className="absolute inset-0 rounded-lg bg-surface shadow-xs border border-emerald-500/25" />
          ) : (
            <motion.div
              layoutId={`view-toggle-${toggleId}`}
              transition={MOTION_SPRINGS.snappy}
              className="absolute inset-0 rounded-lg bg-surface shadow-xs border border-emerald-500/25"
            />
          ))}
        {renderIcon(GridIcon)}
      </button>
      <button
        type="button"
        onClick={() => setViewMode('list')}
        className={`relative p-1.5 rounded-lg transition-colors cursor-pointer ${
          viewMode === 'list'
            ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
            : 'text-ink-faint hover:text-ink'
        }`}
        title="Chế độ danh sách"
        aria-label="Chế độ danh sách"
      >
        {viewMode === 'list' &&
          (shouldReduceMotion ? (
            <div className="absolute inset-0 rounded-lg bg-surface shadow-xs border border-emerald-500/25" />
          ) : (
            <motion.div
              layoutId={`view-toggle-${toggleId}`}
              transition={MOTION_SPRINGS.snappy}
              className="absolute inset-0 rounded-lg bg-surface shadow-xs border border-emerald-500/25"
            />
          ))}
        {renderIcon(ListIcon)}
      </button>
    </div>
  );
});

// 5. Card chuẩn — Enterprise Glass Card Panel
export const DSCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  isExpanded?: boolean;
}> = ({ children, className = '', isExpanded = false }) => (
  <div
    className={`bg-surface/95 dark:bg-surface/90 rounded-2xl border transition-all duration-200 overflow-hidden ${
      isExpanded
        ? 'border-emerald-500/60 ring-2 ring-emerald-500/15 shadow-md'
        : 'border-border/80 shadow-xs hover:border-emerald-500/35 hover:shadow-md hover:-translate-y-[1px]'
    } ${className}`}
  >
    {children}
  </div>
);

// 6. Table Container chuẩn
export const DSTable: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`bg-surface/95 dark:bg-surface/90 rounded-2xl border border-border/80 shadow-xs overflow-hidden ${className}`}
  >
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">{children}</table>
    </div>
  </div>
);

// 7. Input Form chuẩn (Tailwind UI Form Field)
export const DSFormInput = memo(
  forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string }>(
    ({ label, className = '', ...props }, ref) => (
      <div className="space-y-1.5">
        {label && (
          <label className="text-xs font-semibold text-ink-soft pl-0.5 block">{label}</label>
        )}
        <input
          ref={ref}
          {...props}
          className={`w-full px-3.5 py-2.5 bg-surface-2/80 hover:bg-surface-2 border border-border/80 focus:border-emerald-500 focus:bg-surface rounded-xl font-medium outline-none text-sm text-ink transition-all placeholder:text-ink-faint focus:ring-2 focus:ring-emerald-500/15 shadow-2xs ${className}`}
        />
      </div>
    )
  )
);

// 8. Trạng thái rỗng chuẩn (Tailwind UI Empty State)
export const DSEmptyState: React.FC<{
  title: string;
  message: string;
  icon?: any;
  className?: string;
}> = ({ title, message, icon: Icon = DocumentMagnifyingGlassIcon, className = '' }) => {
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) return Icon;
    return <Icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />;
  };

  return (
    <div
      className={`col-span-full p-8 sm:p-12 flex flex-col items-center justify-center text-center bg-surface-2/30 dark:bg-surface-2/20 rounded-2xl border border-dashed border-border/80 relative overflow-hidden ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border border-emerald-500/20 flex items-center justify-center mb-3.5 shadow-xs">
        {renderIcon()}
      </div>
      <h3 className="text-ink font-bold text-sm sm:text-base tracking-tight mb-1 font-display">
        {title}
      </h3>
      <p className="text-ink-muted text-xs sm:text-sm font-normal max-w-md leading-relaxed">
        {message}
      </p>
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
  name,
}) => {
  const dateFormat = useUIStore((s) => s.dateFormat) || 'DD/MM/YYYY';
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
      {label && <label className="text-xs font-semibold text-ink-soft pl-0.5 block">{label}</label>}
      <div className="relative flex items-center w-full">
        <input
          type="text"
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder={dateFormat.toLowerCase()}
          required={required}
          className={`w-full pl-3.5 pr-10 py-2.5 bg-surface-2/80 hover:bg-surface-2 border border-border/80 focus:border-emerald-500 focus:bg-surface rounded-xl font-medium outline-none text-sm text-ink transition-all placeholder:text-ink-faint focus:ring-2 focus:ring-emerald-500/15 shadow-2xs ${className}`}
        />
        <button
          type="button"
          onClick={handleIconClick}
          className="absolute right-3 text-ink-faint hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1 cursor-pointer"
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
