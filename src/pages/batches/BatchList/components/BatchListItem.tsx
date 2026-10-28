import React, { memo, useMemo } from 'react';
import { TestResult, Batch } from '../../../../types';
import { ActionButtons } from '../../../../components';
import { formatDateStandard } from '../../../../utils';
import { BatchStatusSelect } from './BatchStatusSelect';
import { BatchInspectionProgressService } from '../../../../domain/batch/BatchInspectionProgressService';
import { useAppStore } from '../../../../store/useAppStore';

interface BatchListItemProps {
  batch: any;
  onEdit: (batch: Batch) => void;
  onDelete: (batch: Batch) => void;
  onView: (batch: Batch) => void;
  onUpdateBatchStatus: (status: string, batchId: string) => void;
  isAdmin: boolean;
  testResults: TestResult[];
}

export const BatchListItem = memo<BatchListItemProps>(
  ({ batch, onEdit, onDelete, onView, onUpdateBatchStatus, isAdmin, testResults }) => {
    const tccsList = useAppStore((state) => state.tccsList);
    const boundTccs = batch.tccs || tccsList.find((t: any) => t.id === batch.tccsId);

    const inspectionCalc = useMemo(
      () =>
        BatchInspectionProgressService.calculateInspectionProgress({
          batch,
          testResults,
          tccs: boundTccs,
          tccsList,
        }),
      [batch, testResults, boundTccs, tccsList]
    );

    const completedCount = inspectionCalc.progress.completedCount;
    const requiredCount = inspectionCalc.progress.requiredCount;
    const progressPercent = inspectionCalc.progress.percentage;

    return (
      <tr className="hover:bg-surface-2/60 transition-colors">
        <td className="px-4 py-3 font-mono font-medium text-ink text-sm">{batch.batchNo}</td>
        <td className="px-4 py-3">
          <div className="font-medium text-ink text-sm">{batch.product?.name}</div>
          <div className="text-xs font-mono text-ink-muted">{batch.product?.code}</div>
        </td>
        <td className="px-4 py-3 text-xs">
          <div className="text-ink-soft">SX: {formatDateStandard(batch.mfgDate)}</div>
          <div className="font-medium text-rose-600 dark:text-rose-400">
            HD: {formatDateStandard(batch.expDate)}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-col items-center justify-center gap-1">
            <BatchStatusSelect
              status={batch.status}
              batchId={batch.id}
              onUpdate={onUpdateBatchStatus}
              isAdmin={isAdmin}
              batch={batch}
              testResults={testResults}
              releaseGateProgress={batch.releaseGateProgress}
              releaseStage={batch.releaseStage}
            />
            <div className="text-[11px] text-ink-muted flex items-center gap-1.5 justify-center flex-wrap">
              <span>
                Chỉ tiêu: {completedCount}/{requiredCount} ({progressPercent}%)
              </span>
              <span>•</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {batch.status === 'RELEASED'
                  ? 'Đã xuất xưởng'
                  : `Xuất xưởng: ${batch.releaseGateProgress?.completed ?? 0}/7`}
              </span>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end items-center gap-1">
            <ActionButtons
              onView={() => onView(batch)}
              onEdit={() => onEdit(batch)}
              onDelete={() => onDelete(batch)}
            />
          </div>
        </td>
      </tr>
    );
  }
);

BatchListItem.displayName = 'BatchListItem';
