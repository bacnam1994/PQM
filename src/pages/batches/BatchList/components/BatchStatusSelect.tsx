import React from 'react';
import {
  ShieldCheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
  ChevronUpDownIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { StatusBadge, BatchTestingQABadge } from '../../../../components';
import { Batch, TestResult, TCCS } from '../../../../types';
import { useAppStore } from '../../../../store/useAppStore';
import { BatchStateMachine } from '../../../../domain/workflow/stateMachine';

interface BatchStatusSelectProps {
  status: string;
  batchId: string;
  onUpdate: (status: string, batchId: string) => void;
  isAdmin: boolean;
  batch?: Batch;
  testResults?: TestResult[];
  tccs?: TCCS | null;
}

export const BatchStatusSelect: React.FC<BatchStatusSelectProps> = ({
  status,
  batchId,
  onUpdate,
  isAdmin,
  batch,
  testResults,
  tccs,
}) => {
  const storeBatches = useAppStore((state) => state.batches);
  const effectiveBatch = batch || storeBatches.find((b) => b.id === batchId);

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'RELEASED':
        return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20';
      case 'REJECTED':
        return 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20';
      case 'TESTING':
        return 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20';
      case 'BLOCKED':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20';
      default:
        return 'bg-surface-2 text-ink-muted border-border hover:bg-surface-3';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'RELEASED':
        return ShieldCheckIcon;
      case 'REJECTED':
        return XMarkIcon;
      case 'TESTING':
        return ArrowPathIcon;
      case 'BLOCKED':
        return LockClosedIcon;
      default:
        return ClockIcon;
    }
  };

  const IconComponent = getStatusIcon(status);
  const iconColor = status === 'PENDING' ? 'text-ink-muted' : 'text-current';

  const availableActions = BatchStateMachine.getAvailableWorkflowActions(
    status as any,
    isAdmin ? 'ADMIN' : 'QA'
  );

  if (!isAdmin || availableActions.length === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <StatusBadge type="BATCH" status={status} />
        {effectiveBatch && status === 'TESTING' && (
          <BatchTestingQABadge batch={effectiveBatch} testResults={testResults} tccs={tccs} />
        )}
      </div>
    );
  }

  const currentLabel =
    status === 'PENDING'
      ? 'Chờ kiểm'
      : status === 'TESTING'
        ? 'Đang kiểm'
        : status === 'RELEASED'
          ? 'Đã xuất xưởng'
          : status === 'REJECTED'
            ? 'Từ chối'
            : status === 'BLOCKED'
              ? 'Tạm khóa'
              : status;

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <div className="relative inline-block group/select" onClick={(e) => e.stopPropagation()}>
        <div
          className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`}
        >
          <IconComponent className={`h-3 w-3 ${status === 'TESTING' ? 'animate-spin' : ''}`} />
        </div>
        <select
          value={status}
          onChange={(e) => {
            if (e.target.value !== status) {
              onUpdate(e.target.value, batchId);
            }
          }}
          className={`appearance-none pl-6 pr-5 py-1 rounded-full text-xs font-medium border cursor-pointer outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors ${getStatusColor(status)}`}
        >
          <option value={status} disabled className="bg-surface text-ink font-semibold">
            {currentLabel} (Hiện tại)
          </option>
          {availableActions.map((act) => (
            <option key={act.actionId} value={act.to} className="bg-surface text-ink">
              ➔ {act.label}
            </option>
          ))}
        </select>
        <div
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover/select:opacity-100 transition-opacity ${iconColor}`}
        >
          <ChevronUpDownIcon className="h-3 w-3" />
        </div>
      </div>
      {effectiveBatch && status === 'TESTING' && (
        <BatchTestingQABadge batch={effectiveBatch} testResults={testResults} tccs={tccs} />
      )}
    </div>
  );
};
