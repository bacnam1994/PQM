import React, { memo, useMemo } from 'react';
import {
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ArchiveBoxIcon,
  HashtagIcon,
  BeakerIcon,
  ClockIcon,
  ClipboardDocumentListIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Batch, TestResult } from '../../../../types';
import { ActionButtons, CircularProgress } from '../../../../components';
import { formatDateStandard } from '../../../../utils';
import { calculateBatchProgress } from '../utils/batchProgress';
import { BatchStatusSelect } from './BatchStatusSelect';

interface BatchGridItemProps {
  batch: any;
  isExpanded: boolean;
  onExpand: (id: string) => void;
  onEdit: (batch: Batch) => void;
  onDelete: (batch: Batch) => void;
  onView: (batch: Batch) => void;
  testResults: TestResult[];
  onUpdateBatchStatus: (status: string, batchId: string) => void;
  isAdmin: boolean;
}

export const BatchGridItem = memo<BatchGridItemProps>(({
  batch,
  isExpanded,
  onExpand,
  onEdit,
  onDelete,
  onView,
  testResults,
  onUpdateBatchStatus,
  isAdmin,
}) => {
  const expDate = new Date(batch.expDate);
  const today = new Date();
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = diffDays < 0;
  const isNearExpiry = diffDays > 0 && diffDays <= 90;

  const { missingCriteria, progressPercent: calculatedProgress } = useMemo(
    () => calculateBatchProgress(batch, testResults),
    [batch, testResults]
  );
  
  const hasLocalResults = useMemo(() => testResults.some(r => r.batchId === batch.id), [testResults, batch.id]);
  const progressPercent = (isExpanded || hasLocalResults) ? calculatedProgress : (batch.progressPercent ?? 0);

  return (
    <div className={`p-4 flex flex-col gap-3 rounded-xl transition-all duration-200 group relative overflow-hidden h-full bg-surface border border-border shadow-xs hover:border-emerald-500/30 ${isExpanded ? 'col-span-1 md:col-span-2 ring-1 ring-emerald-500/30' : ''}`}>
      {/* Date Warnings */}
      {isExpired && (
        <div className="absolute top-0 right-0 bg-rose-600 text-white text-[10px] font-medium px-2.5 py-0.5 rounded-bl-lg flex items-center gap-1 z-20">
          <CalendarDaysIcon className="h-3 w-3"/> Đã hết hạn
        </div>
      )}
      {isNearExpiry && (
        <div className="absolute top-0 right-0 bg-amber-500 text-white text-[10px] font-medium px-2.5 py-0.5 rounded-bl-lg flex items-center gap-1 z-20">
          <ExclamationTriangleIcon className="h-3 w-3"/> Cận date ({diffDays} ngày)
        </div>
      )}

      {/* Header: Product name & Status */}
      <div className="flex items-start justify-between gap-2 relative z-10">
        <div className="flex items-center gap-1.5 text-xs text-ink-muted truncate pr-2" title={batch.product?.name}>
          <ArchiveBoxIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          <span className="truncate font-medium">{batch.product?.name || 'Sản phẩm'}</span>
        </div>
        <div className="shrink-0">
          <BatchStatusSelect 
            status={batch.status} 
            batchId={batch.id} 
            onUpdate={onUpdateBatchStatus} 
            isAdmin={isAdmin} 
          />
        </div>
      </div>

      {/* Main Info: Batch No and Code */}
      <div className="flex items-center gap-3 pt-1">
        <div className="w-9 h-9 rounded-lg bg-surface-2 border border-border flex items-center justify-center text-ink-muted shrink-0">
          <HashtagIcon className="h-4 w-4" />
        </div>
        <div className="flex flex-col group/link cursor-pointer min-w-0" onClick={() => onView(batch)}>
          <h3 className="font-semibold text-ink text-base leading-tight group-hover/link:text-emerald-600 dark:group-hover/link:text-emerald-400 transition-colors truncate">
            {batch.batchNo}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-mono text-ink-muted">{batch.product?.code}</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <BeakerIcon className="h-3 w-3" /> {progressPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="space-y-1 pt-2.5 border-t border-border/80 text-xs">
        <div className="flex justify-between items-center gap-2">
          <span className="text-ink-muted font-normal">Ngày SX</span>
          <span className="text-ink font-medium">{formatDateStandard(batch.mfgDate)}</span>
        </div>
        <div className="flex justify-between items-center gap-2">
          <span className="text-ink-muted font-normal">Hạn dùng</span>
          <span className={`font-medium ${isExpired ? 'text-rose-600 dark:text-rose-400' : isNearExpiry ? 'text-amber-600 dark:text-amber-400' : 'text-ink'}`}>
            {formatDateStandard(batch.expDate)}
          </span>
        </div>
      </div>

      {/* Footer: Actions */}
      <div className="flex items-center justify-between pt-2.5 mt-auto border-t border-border/80 relative z-10">
        <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <ActionButtons 
            onEdit={() => onEdit(batch)}
            onDelete={() => onDelete(batch)}
          />
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <button 
            onClick={() => onExpand(batch.id)} 
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-xs bg-surface-2 text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors cursor-pointer"
          >
            <ClockIcon className="h-3 w-3" /> {isExpanded ? 'Ẩn' : 'Tiến độ'}
          </button>
          <button 
            onClick={() => onView(batch)} 
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
          >
            Chi tiết
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2 pt-3 border-t border-border animate-in fade-in">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <CircularProgress progress={progressPercent} />
              <div>
                <h4 className="text-xs font-semibold text-ink flex items-center gap-1.5">
                  <BeakerIcon className="h-3.5 w-3.5"/> Tiến độ kiểm nghiệm
                </h4>
                <p className="text-xs text-ink-muted mt-0.5">Hoàn thành {progressPercent}% chỉ tiêu</p>
              </div>
            </div>
            {missingCriteria.length > 0 ? (
              <div className="bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                  <ClipboardDocumentListIcon className="h-3.5 w-3.5"/> Còn thiếu {missingCriteria.length} chỉ tiêu:
                </p>
                <div className="flex flex-wrap gap-1">
                  {missingCriteria.map((c: any, idx: number) => (
                    <span key={idx} className="px-2 py-0.5 bg-surface border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium rounded-full">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 flex items-center gap-2">
                <CheckCircleIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0"/>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Đã kiểm đủ tất cả chỉ tiêu theo TCCS.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

BatchGridItem.displayName = 'BatchGridItem';
