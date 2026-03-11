import React from 'react';

// ============================================
// TOGGLE SWITCH COMPONENT - Enhanced with animations
// ============================================

export interface DSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const DSwitch: React.FC<DSwitchProps> = ({ checked, onChange, label, disabled = false }) => (
  <label className={`flex items-center gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
    <div 
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-12 h-7 rounded-full transition-all duration-300 ${checked ? 'bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <div 
        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-lg transition-all duration-300 hover:scale-110 ${checked ? 'translate-x-6' : 'translate-x-1'} ${checked ? 'shadow-white/50' : ''}`}
      />
    </div>
    {label && <span className="text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors">{label}</span>}
  </label>
);

export default DSwitch;

