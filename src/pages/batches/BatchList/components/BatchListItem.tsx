import React, { memo, useMemo } from 'react';
import { TestResult, Batch } from '../../../../types';
import { ActionButtons } from '../../../../components';
import { formatDateStandard } from '../../../../utils';
import { calculateBatchProgress } from '../utils/batchProgress';
import { BatchStatusSelect } from './BatchStatusSelect';

interface BatchListItemProps {
  batch: any;
  onEdit: (batch: Batch) => void;
  onDelete: (batch: Batch) => void;
  onView: (batch: Batch) => void;
  onUpdateBatchStatus: (status: string, batchId: string) => void;
  isAdmin: boolean;
  testResults: TestResult[];
}

export const BatchListItem = memo<BatchListItemProps>(({
  batch,
  onEdit,
  onDelete,
  onView,
  onUpdateBatchStatus,
  isAdmin,
  testResults,
}) => {
  const { progressPercent: calculatedProgress } = useMemo(
    () => calculateBatchProgress(batch, testResults),
    [batch, testResults]
  );
  const hasLocalResults = useMemo(() => testResults.some(r => r.batchId === batch.id), [testResults, batch.id]);
  const progressPercent = hasLocalResults ? calculatedProgress : (batch.progressPercent ?? 0);

  return (
    <tr className="hover:bg-surface-2/60 transition-colors">
      <td className="px-4 py-3 font-mono font-medium text-ink text-sm">{batch.batchNo}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-ink text-sm">{batch.product?.name}</div>
        <div className="text-xs font-mono text-ink-muted">{batch.product?.code}</div>
      </td>
      <td className="px-4 py-3 text-xs">
        <div className="text-ink-soft">SX: {formatDateStandard(batch.mfgDate)}</div>
        <div className="font-medium text-rose-600 dark:text-rose-400">HD: {formatDateStandard(batch.expDate)}</div>
      </td>
      <td className="px-4 py-3 text-center">
        <BatchStatusSelect 
          status={batch.status} 
          batchId={batch.id} 
          onUpdate={onUpdateBatchStatus} 
          isAdmin={isAdmin} 
        />
        <div className="mt-1 text-xs font-medium text-ink-muted">Tiến độ: {progressPercent}%</div>
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
});

BatchListItem.displayName = 'BatchListItem';
