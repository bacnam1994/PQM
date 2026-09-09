import React from 'react';
import { CommandLineIcon } from '@heroicons/react/24/outline';

const SPECIAL_CHARS = ['\u00b0C', '\u00b5', '\u2264', '\u2265', '\u00b1', '\u2070', '\u00b9', '\u00b2', '\u00b3', '\u2074', '\u2075', '\u2076', '\u2077', '\u2078', '\u2079', '\u207b'];

export const insertSpecialChar = (char: string) => {
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    const start = active.selectionStart || 0;
    const end = active.selectionEnd || 0;
    const val = active.value;
    const newVal = val.slice(0, start) + char + val.slice(end);

    // Kích hoạt sự kiện onChange của React
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

    if (active.tagName === 'INPUT' && nativeInputValueSetter) {
      nativeInputValueSetter.call(active, newVal);
    } else if (active.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
      nativeTextAreaValueSetter.call(active, newVal);
    } else {
      active.value = newVal;
    }
    active.dispatchEvent(new Event('input', { bubbles: true }));
    active.focus();
    active.setSelectionRange(start + char.length, start + char.length);
  }
};

// Các nút số mũ nhanh: label hiển thị → chuỗi chèn vào input
const SCI_SHORTCUTS: { label: string; insert: string }[] = [
  { label: '10^', insert: '10^' },
  { label: '\u00d710\u00b3', insert: 'x10^3' },
  { label: '\u00d710\u2074', insert: 'x10^4' },
  { label: '\u00d710\u2075', insert: 'x10^5' },
  { label: '\u00d710\u2076', insert: 'x10^6' },
  { label: '\u00d710\u2077', insert: 'x10^7' },
  { label: '\u00d710\u207b\u00b9', insert: 'x10^-1' },
  { label: '\u00d710\u207b\u00b2', insert: 'x10^-2' },
  { label: '\u00d710\u207b\u00b3', insert: 'x10^-3' },
];

export const SpecialCharToolbar: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[95%] md:w-auto max-w-[980px] bg-surface/90 backdrop-blur-xl border border-border shadow-xl rounded-2xl px-4 py-2 flex items-center gap-3 overflow-x-auto no-scrollbar transition-all duration-300 group ${className || ''}`}>

      {/* Nhóm 1: Ký tự đặc biệt */}
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
        <CommandLineIcon className="w-4 h-4" />
        <span>Ký tự</span>
      </div>
      <div className="flex items-center gap-1.5 py-0.5">
        {SPECIAL_CHARS.map(char => (
          <button
            key={char}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertSpecialChar(char); }}
            className="px-2.5 py-1 bg-surface-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 text-ink border border-border/80 rounded-lg text-xs font-bold transition-all shrink-0 shadow-2xs hover:shadow-xs active:scale-95"
          >
            {char}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border shrink-0" />

      {/* Nhóm 2: Số mũ nhanh */}
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-teal-700 dark:text-teal-400 shrink-0">
        <span>Số mũ</span>
      </div>
      <div className="flex items-center gap-1.5 py-0.5">
        {SCI_SHORTCUTS.map(({ label, insert }) => (
          <button
            key={label}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertSpecialChar(insert); }}
            title={`Chèn: ${insert}`}
            className="px-2.5 py-1 bg-teal-50/60 dark:bg-teal-950/30 hover:bg-teal-100/70 dark:hover:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/40 rounded-lg text-xs font-bold transition-all shrink-0 shadow-2xs hover:shadow-xs active:scale-95"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SpecialCharToolbar;