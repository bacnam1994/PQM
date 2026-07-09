import React from 'react';
import { Keyboard } from 'lucide-react';

const SPECIAL_CHARS = ['\u00b0C', '\u00b5', '\u2264', '\u2265', '\u00b1', '\u2070', '\u00b9', '\u00b2', '\u00b3', '\u2074', '\u2075', '\u2076', '\u2077', '\u2078', '\u2079', '\u207b'];

export const insertSpecialChar = (char: string) => {
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    const start = active.selectionStart || 0;
    const end = active.selectionEnd || 0;
    const val = active.value;
    const newVal = val.slice(0, start) + char + val.slice(end);

    // Hack để kích hoạt sự kiện onChange của React
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
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] w-[95%] md:w-auto max-w-[980px] bg-white/85 dark:bg-slate-800/85 backdrop-blur-xl border border-white/40 dark:border-slate-700 shadow-glass rounded-2xl px-4 py-2.5 flex items-center gap-3 overflow-x-auto no-scrollbar transition-all duration-300 hover:shadow-glass-hover group ${className || ''}`}>

      {/* Nhóm 1: Ký tự đặc biệt */}
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-primary-600 dark:text-primary-400 shrink-0">
        <Keyboard size={14} className="group-hover:animate-bounce" />
        <span>Ký tự</span>
      </div>
      <div className="flex items-center gap-1.5 pb-1 pt-1">
        {SPECIAL_CHARS.map(char => (
          <button
            key={char}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertSpecialChar(char); }}
            className="px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/80 hover:bg-primary-50 dark:hover:bg-primary-900/50 hover:text-primary-600 dark:hover:text-primary-400 border border-slate-200/50 dark:border-slate-700 rounded-lg text-sm font-black transition-all shrink-0 shadow-sm hover:shadow hover:scale-110 active:scale-95"
          >
            {char}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-slate-200 dark:bg-slate-600 shrink-0" />

      {/* Nhóm 2: Số mũ nhanh */}
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-indigo-500 dark:text-indigo-400 shrink-0">
        <span>Số mũ</span>
      </div>
      <div className="flex items-center gap-1.5 pb-1 pt-1">
        {SCI_SHORTCUTS.map(({ label, insert }) => (
          <button
            key={label}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); insertSpecialChar(insert); }}
            title={`Chèn: ${insert}`}
            className="px-3 py-1.5 bg-indigo-50/80 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-800/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-700/50 rounded-lg text-xs font-black transition-all shrink-0 shadow-sm hover:shadow hover:scale-110 active:scale-95"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SpecialCharToolbar;