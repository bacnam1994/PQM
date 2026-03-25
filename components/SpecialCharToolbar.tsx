import React from 'react';
import { Keyboard } from 'lucide-react';

const SPECIAL_CHARS = ['°C', 'µ', '≤', '≥', '±', '⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁻'];

export const insertSpecialChar = (char: string) => {
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    const start = active.selectionStart || 0;
    const end = active.selectionEnd || 0;
    const val = active.value;
    const newVal = val.slice(0, start) + char + val.slice(end);
    
    // Hack để kích hoạt sự kiện onChange của React
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    
    if (active.tagName === 'INPUT' && nativeInputValueSetter) {
      nativeInputValueSetter.call(active, newVal);
    } else if (active.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(active, newVal);
    } else {
      active.value = newVal;
    }
    active.dispatchEvent(new Event('input', { bubbles: true }));
    active.focus();
    active.setSelectionRange(start + 1, start + 1);
  }
};

export const SpecialCharToolbar: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`sticky top-0 z-20 bg-white border-b border-slate-100 pb-2 mb-4 pt-2 flex items-center gap-2 overflow-x-auto no-scrollbar ${className || ''}`}>
      <div className="flex items-center gap-1 text-xs font-bold text-slate-400 mr-2 shrink-0">
        <Keyboard size={14} /> <span>Ký tự:</span>
      </div>
      {SPECIAL_CHARS.map(char => (
        <button
          key={char}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); insertSpecialChar(char); }}
          className="px-2.5 py-1.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 rounded-lg text-sm font-bold transition-colors min-w-[32px]"
        >
          {char}
        </button>
      ))}
    </div>
  );
};

export default SpecialCharToolbar;