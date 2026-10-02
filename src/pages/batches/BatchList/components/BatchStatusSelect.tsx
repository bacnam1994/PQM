import React, { useMemo } from 'react';
import {
  ShieldCheckIcon,
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
  ChevronUpDownIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import { StatusBadge } from '../../../../components';
import {
  Batch,
  TestResult,
  TCCS,
  BatchReleaseGateProgress,
  BatchReleaseStage,
} from '../../../../types';
import { useAppStore } from '../../../../store/useAppStore';
import { BatchStateMachine } from '../../../../domain/workflow/stateMachine';
import { BatchReleaseProgressService } from '../../../../domain/batch/BatchReleaseProgressService';

interface BatchStatusSelectProps {
  status: string;
  batchId: string;
  onUpdate: (status: string, batchId: string) => void;
  isAdmin: boolean;
  batch?: Batch;
  testResults?: TestResult[];
  tccs?: TCCS | null;
  releaseGateProgress?: BatchReleaseGateProgress | null;
  releaseStage?: BatchReleaseStage | string | null;
}

export const BatchStatusSelect: React.FC<BatchStatusSelectProps> = ({
  status,
  batchId,
  onUpdate,
  isAdmin,
  batch,
  testResults,
  tccs,
  releaseGateProgress: propReleaseGateProgress,
  releaseStage: propReleaseStage,
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

  // Dynamic Canonical Gate Progress:
  // 1. Ưu tiên props truyền vào (e.g. từ BatchDetailPage với canonicalGateProgress)
  // 2. Tiếp theo từ effectiveBatch.releaseGateProgress (đã sync DB)
  // 3. Fallback tính toán tại chỗ qua BatchReleaseProgressService nếu có testResults
  const resolvedProgress = useMemo(() => {
    if (propReleaseGateProgress) {
      return {
        gateProgress: propReleaseGateProgress,
        releaseStage: propReleaseStage ?? effectiveBatch?.releaseStage,
      };
    }
    if (effectiveBatch?.releaseGateProgress) {
      return {
        gateProgress: effectiveBatch.releaseGateProgress,
        releaseStage: effectiveBatch.releaseStage,
      };
    }
    if (effectiveBatch && testResults && testResults.length > 0) {
      try {
        const res = BatchReleaseProgressService.resolveReleaseProgress({
          batch: effectiveBatch,
          testResults,
          boundTccs: (effectiveBatch as any)?.tccsSnapshot || (effectiveBatch as any)?.tccs || tccs,
        });
        return {
          gateProgress: res.releaseGateProgress,
          releaseStage: res.releaseStage,
        };
      } catch {
        return null;
      }
    }
    return null;
  }, [propReleaseGateProgress, propReleaseStage, effectiveBatch, testResults, tccs]);

  const gateProgress = resolvedProgress?.gateProgress ?? effectiveBatch?.releaseGateProgress;
  const releaseStage = resolvedProgress?.releaseStage ?? effectiveBatch?.releaseStage;

  // Phase 4 & 5: Hiển thị 2 tầng (Lifecycle + Release Gate Progress từ DB, không tự tính)
  const releaseProgressLabel = useMemo(() => {
    if (!effectiveBatch) return null;
    if (status === 'RELEASED') {
      return '7/7 Gate · Đã xuất xưởng';
    }
    if (status === 'REJECTED') {
      return 'Từ chối xuất xưởng';
    }
    if (status === 'BLOCKED') {
      return 'Tạm khóa';
    }
    const completed = gateProgress?.completed ?? 0;
    const current = gateProgress?.currentGate ?? completed + 1;

    if (completed === 7 || releaseStage === 'READY_TO_RELEASE') {
      return '7/7 Gate · Sẵn sàng xuất xưởng';
    }
    if (current === 7 || completed === 6 || releaseStage === 'GATE_7') {
      return 'Gate 7/7 · Chờ ký xuất xưởng';
    }
    if (current === 6 || completed === 5 || releaseStage === 'GATE_6') {
      return 'Gate 6/7 · Chờ BPR Review';
    }
    if (current === 5 || completed === 4 || releaseStage === 'GATE_5') {
      return 'Gate 5/7 · Chờ CAPA';
    }
    if (current === 4 || completed === 3 || releaseStage === 'GATE_4') {
      return 'Gate 4/7 · Có sai lệch';
    }
    if (current === 3 || completed === 2 || releaseStage === 'GATE_3') {
      return 'Gate 3/7 · Có OOS';
    }
    if (current === 2 || completed === 1 || releaseStage === 'GATE_2') {
      return 'Gate 2/7 · Đánh giá chất lượng';
    }
    if (status === 'PENDING') {
      return 'Chưa bắt đầu';
    }
    return 'Gate 1/7 · Đang kiểm nghiệm';
  }, [effectiveBatch, status, gateProgress, releaseStage]);

  const renderReleaseBadge = () => {
    if (!releaseProgressLabel) return null;
    const completed = gateProgress?.completed ?? (status === 'RELEASED' ? 7 : 0);
    const isReadyToSign = completed === 6 || releaseStage === 'GATE_7';
    const isFullyApproved = completed === 7 || status === 'RELEASED';

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border shrink-0 transition-colors ${
          status === 'RELEASED'
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
            : isReadyToSign
              ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold'
              : isFullyApproved
                ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 font-semibold'
                : 'bg-surface-2 text-ink-muted border-border'
        }`}
        title={`Tiến trình Release Gates: ${releaseProgressLabel}`}
        data-testid="batch-release-gate-badge"
      >
        <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0" />
        <span>{releaseProgressLabel}</span>
      </span>
    );
  };

  if (!isAdmin || availableActions.length === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <StatusBadge type="BATCH" status={status} />
        {renderReleaseBadge()}
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
      {renderReleaseBadge()}
    </div>
  );
};
