import React from 'react';
import { Check } from 'lucide-react';

export interface WorkflowStep {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  subtitle?: string;
  status?: 'completed' | 'current' | 'upcoming';
}

export type WorkflowStepItem = WorkflowStep;

export interface WorkflowStepsProps {
  steps: WorkflowStep[];
  activeStep?: number;
  currentStepIndex?: number;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

/**
 * WorkflowSteps - Thanh tiến trình quy trình nghiệp vụ chuẩn ISO/GMP
 * Biến form nhập liệu dài thành luồng công việc rõ ràng theo từng chặng.
 */
export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({
  steps,
  activeStep,
  currentStepIndex,
  onStepClick,
  className = ''
}) => {
  const effectiveActiveIndex = activeStep !== undefined ? activeStep : (currentStepIndex !== undefined ? currentStepIndex : -1);
  return (
    <div className={`w-full overflow-x-auto pb-2 ${className}`}>
      <nav aria-label="Workflow Progress" className="flex items-center gap-2 min-w-max">
        {steps.map((step, index) => {
          const stepStatus = step.status || (
            effectiveActiveIndex >= 0
              ? (index < effectiveActiveIndex ? 'completed' : index === effectiveActiveIndex ? 'current' : 'upcoming')
              : 'upcoming'
          );
          const isClickable = Boolean(onStepClick) && (stepStatus === 'completed' || stepStatus === 'current');
          const stepTitle = step.label || step.title || `Bước ${index + 1}`;
          const stepSubtitle = step.description || step.subtitle;

          return (
            <div key={step.id || index} className="flex items-center gap-2">
              {index > 0 && (
                <div className={`h-0.5 w-6 sm:w-10 transition-colors ${
                  stepStatus === 'completed' || stepStatus === 'current'
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`} />
              )}

              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStepClick && onStepClick(step.id)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-left transition-all ${
                  stepStatus === 'current'
                    ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 shadow-xs'
                    : stepStatus === 'completed'
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 hover:border-emerald-300'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  stepStatus === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : stepStatus === 'current'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}>
                  {stepStatus === 'completed' ? <Check className="w-3 h-3" /> : index + 1}
                </div>

                <div className="flex flex-col">
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {stepTitle}
                  </span>
                  {stepSubtitle && (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {stepSubtitle}
                    </span>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
};
