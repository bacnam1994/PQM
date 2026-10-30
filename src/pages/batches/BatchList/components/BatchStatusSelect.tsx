import React, { useMemo, useState } from 'react';
import {
  ShieldCheckIcon,
  XMarkIcon,
  LockClosedIcon,
  PencilSquareIcon,
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
import { BatchInspectionProgressService } from '../../../../domain/batch/BatchInspectionProgressService';
import { InspectionEvaluationModal } from '../../../../components/features/InspectionEvaluationModal';

interface BatchStatusSelectProps {
  status: string;
  batchId: string;
  onUpdate?: (status: string, batchId: string) => void;
  isAdmin?: boolean;
  batch?: Batch;
  testResults?: TestResult[];
  tccs?: TCCS | null;
  releaseGateProgress?: BatchReleaseGateProgress | null;
  releaseStage?: BatchReleaseStage | string | null;
}

export const BatchStatusSelect: React.FC<BatchStatusSelectProps> = ({
  status,
  batchId,
  batch,
  testResults,
  tccs,
  releaseGateProgress: propReleaseGateProgress,
  releaseStage: propReleaseStage,
}) => {
  const storeBatches = useAppStore((state) => state.batches);
  const tccsList = useAppStore((state) => state.tccsList);
  const user = useAppStore((state) => state.user);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);

  const effectiveBatch = batch || storeBatches.find((b) => b.id === batchId);
  const userRole = (user?.role || '').trim().toUpperCase();
  const canEvaluate = ['QA', 'QC', 'ADMIN'].includes(userRole);

  // Tính toán tiến độ kiểm nghiệm và trạng thái phân giải chính thức
  const inspectionCalc = useMemo(() => {
    if (!effectiveBatch) return null;
    const boundTccs = tccs || tccsList.find((t) => t.id === effectiveBatch.tccsId);
    return BatchInspectionProgressService.calculateInspectionProgress({
      batch: effectiveBatch,
      testResults: testResults || [],
      tccs: boundTccs,
      tccsList,
    });
  }, [effectiveBatch, testResults, tccs, tccsList]);

  const resolvedInspectionStatus = useMemo(() => {
    if (!effectiveBatch) return 'NOT_TESTED';
    const boundTccs = tccs || tccsList.find((t) => t.id === effectiveBatch.tccsId);
    return BatchInspectionProgressService.resolveInspectionStatusWithFallback({
      batch: effectiveBatch,
      testResults: testResults || [],
      tccs: boundTccs,
      tccsList,
    });
  }, [effectiveBatch, testResults, tccs, tccsList]);

  // Dynamic Canonical Gate Progress
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
    return null;
  }, [propReleaseGateProgress, propReleaseStage, effectiveBatch]);

  const gateProgress = resolvedProgress?.gateProgress ?? effectiveBatch?.releaseGateProgress;
  const releaseStage = resolvedProgress?.releaseStage ?? effectiveBatch?.releaseStage;

  // Secondary badge: Trạng thái xuất xưởng & Release Gate (không còn là trạng thái chính)
  const renderReleaseBadge = () => {
    if (status === 'RELEASED') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
          title="Lô đã hoàn thành ký duyệt xuất xưởng GMP"
          data-testid="batch-release-badge"
        >
          <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0" />
          <span>Đã xuất xưởng</span>
        </span>
      );
    }

    if (status === 'REJECTED') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
          title="Từ chối xuất xưởng"
        >
          <XMarkIcon className="w-3.5 h-3.5 shrink-0" />
          <span>Từ chối</span>
        </span>
      );
    }

    if (status === 'BLOCKED') {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20"
          title="Lô tạm khóa theo quy trình GMP"
        >
          <LockClosedIcon className="w-3.5 h-3.5 shrink-0" />
          <span>Tạm khóa</span>
        </span>
      );
    }

    const completed = gateProgress?.completed ?? 0;
    const isReadyToSign = completed === 6 || releaseStage === 'GATE_7';

    if (isReadyToSign) {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
          title="Gate 7/7: Đã đủ điều kiện ký số xuất xưởng (21 CFR Part 11)"
          data-testid="batch-ready-to-sign-badge"
        >
          <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0" />
          <span>Chờ ký xuất xưởng</span>
        </span>
      );
    }

    if (completed > 0) {
      return (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-2 text-ink-muted border border-border"
          title={`Tiến trình Release Gates: ${completed}/7 gates`}
        >
          <ShieldCheckIcon className="w-3 h-3 text-ink-muted shrink-0" />
          <span>Gate {completed}/7</span>
        </span>
      );
    }

    return null;
  };

  // Primary badge: Tiến độ kiểm nghiệm & Kết luận chất lượng
  const renderInspectionBadge = () => {
    const completed = inspectionCalc?.progress.completedCount ?? 0;
    const required = inspectionCalc?.progress.requiredCount ?? 0;

    switch (resolvedInspectionStatus) {
      case 'PASS':
        return (
          <StatusBadge
            status="PASS"
            label="Đạt (PASS)"
            className="cursor-default"
            title={
              effectiveBatch?.inspectionEvaluation?.evaluatorName
                ? `Đã thẩm định Đạt bởi ${effectiveBatch.inspectionEvaluation.evaluatorName} (${effectiveBatch.inspectionEvaluation.evaluatorRole})`
                : 'Đã hoàn thành kiểm nghiệm và đạt tiêu chuẩn'
            }
          />
        );

      case 'FAIL':
        return (
          <StatusBadge
            status="FAIL"
            label="Không đạt (FAIL)"
            className="cursor-default"
            title={
              effectiveBatch?.inspectionEvaluation?.reason
                ? `Lý do: ${effectiveBatch.inspectionEvaluation.reason}`
                : 'Không đạt tiêu chuẩn kiểm nghiệm'
            }
          />
        );

      case 'PENDING_REVIEW':
        if (canEvaluate && effectiveBatch && inspectionCalc) {
          return (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEvaluationModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-all shadow-xs cursor-pointer group/eval"
              title="Đủ 100% chỉ tiêu. Nhấn để QA/QC/Admin xác nhận kết luận chất lượng"
              data-testid="batch-pending-review-action"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
              <span>
                Chờ đánh giá ({completed}/{required})
              </span>
              <PencilSquareIcon className="w-3.5 h-3.5 text-indigo-500 group-hover/eval:scale-110 transition-transform shrink-0" />
            </button>
          );
        }
        return (
          <StatusBadge
            status="PENDING_REVIEW"
            label={`Chờ đánh giá (${completed}/{required})`}
            pulse
          />
        );

      case 'IN_PROGRESS':
        return <StatusBadge status="IN_PROGRESS" label={`Đang kiểm (${completed}/${required})`} />;

      case 'NOT_TESTED':
      default:
        return (
          <StatusBadge
            status="NOT_TESTED"
            label={required > 0 ? `Chưa kiểm (0/${required})` : 'Chưa kiểm'}
          />
        );
    }
  };

  return (
    <>
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {/* 1. Trạng thái kiểm nghiệm chính */}
        {renderInspectionBadge()}

        {/* 2. Trạng thái xuất xưởng / Release Gate phụ trợ */}
        {renderReleaseBadge()}
      </div>

      {/* Modal đánh giá kiểm nghiệm */}
      {isEvaluationModalOpen && effectiveBatch && inspectionCalc && (
        <InspectionEvaluationModal
          isOpen={isEvaluationModalOpen}
          onClose={() => setIsEvaluationModalOpen(false)}
          batch={effectiveBatch}
          calculation={inspectionCalc}
          testResults={testResults}
        />
      )}
    </>
  );
};
