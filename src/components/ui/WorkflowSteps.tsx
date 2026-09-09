import React from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';

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
 * WorkflowSteps - Tailwind UI Progress Steps
 * Thanh tiến trình quy trình nghiệp vụ chuẩn ISO/GMP với màu emerald và token hệ thống.
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
                    ? 'bg-emerald-600 dark:bg-emerald-500'
                    : 'bg-border'
                }`} />
              )}

              <button
                type="button"
                disabled={!isClickable}
                onClick={() => onStepClick && onStepClick(step.id)}
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-left transition-all ${
                  stepStatus === 'current'
                    ? 'border-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 shadow-xs ring-1 ring-inset ring-emerald-600/30'
                    : stepStatus === 'completed'
                    ? 'border-emerald-200 dark:border-emerald-800/60 bg-surface text-ink hover:bg-surface-2'
                    : 'border-border bg-surface text-ink-faint opacity-70 cursor-not-allowed'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                  stepStatus === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : stepStatus === 'current'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-surface-3 text-ink-faint border border-border'
                }`}>
                  {stepStatus === 'completed' ? <CheckIcon className="w-3.5 h-3.5" /> : index + 1}
                </div>

                <div className="flex flex-col">
                  <span className="text-xs font-semibold whitespace-nowrap">
                    {stepTitle}
                  </span>
                  {stepSubtitle && (
                    <span className="text-[10px] text-ink-faint truncate max-w-[140px]">
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

