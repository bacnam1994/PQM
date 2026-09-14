import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/solid';

interface OperationalAIBadgeProps {
  fieldKey: string;
  aiFilledFields?: Set<string> | string[];
  label?: string;
  tooltip?: string;
  className?: string;
}

export const OperationalAIBadge: React.FC<OperationalAIBadgeProps> = ({
  fieldKey,
  aiFilledFields,
  label = 'AI',
  tooltip = 'Dữ liệu được trích xuất và điền tự động bởi AI',
  className = '',
}) => {
  if (!aiFilledFields) return null;

  const isFilled =
    aiFilledFields instanceof Set
      ? aiFilledFields.has(fieldKey)
      : Array.isArray(aiFilledFields) && aiFilledFields.includes(fieldKey);

  if (!isFilled) return null;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 select-none animate-in fade-in duration-300 ${className}`}
    >
      <SparklesIcon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
};
