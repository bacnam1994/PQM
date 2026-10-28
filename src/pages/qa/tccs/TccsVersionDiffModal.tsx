/**
 * PQM V4 Platform - TCCS Version Diff Modal
 * Trực quan hóa độ lệch tiêu chuẩn kỹ thuật giữa 2 phiên bản TCCS theo chuẩn GMP
 */

import React from 'react';
import { 
  XMarkIcon, 
  ArrowsRightLeftIcon, 
  PlusCircleIcon, 
  MinusCircleIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  ArrowRightIcon 
} from '@heroicons/react/24/outline';
import { CriterionDiff, ChangeImpactEngine } from '../../../services/changeImpactEngine';
import { Criterion } from '../../../types';

interface TccsVersionDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  oldVersionCode: string;
  newVersionCode: string;
  oldCriteria: Criterion[];
  newCriteria: Criterion[];
}

export const TccsVersionDiffModal: React.FC<TccsVersionDiffModalProps> = ({
  isOpen,
  onClose,
  oldVersionCode,
  newVersionCode,
  oldCriteria,
  newCriteria
}) => {
  if (!isOpen) return null;

  const diffs: CriterionDiff[] = ChangeImpactEngine.compareCriteria(oldCriteria, newCriteria);

  const addedCount = diffs.filter(d => d.type === 'ADDED').length;
  const removedCount = diffs.filter(d => d.type === 'REMOVED').length;
  const modifiedCount = diffs.filter(d => d.type === 'MODIFIED').length;
  const unchangedCount = diffs.filter(d => d.type === 'UNCHANGED').length;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-4xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <ArrowsRightLeftIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink uppercase tracking-tight flex items-center gap-2">
                So sánh phiên bản TCCS
              </h2>
              <p className="text-xs text-ink-muted font-medium">
                Đối chiếu chi tiết giữa <span className="font-bold text-ink">{oldVersionCode || 'Bản cũ'}</span> và <span className="font-bold text-emerald-600 dark:text-emerald-400">{newVersionCode || 'Bản mới'}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-ink-muted hover:text-ink rounded-xl hover:bg-surface-3 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Thống kê biến động */}
        <div className="px-6 py-3 bg-surface-2 border-b border-border grid grid-cols-4 gap-3 text-center">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
              <PlusCircleIcon className="w-3.5 h-3.5" /> Thêm mới
            </div>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{addedCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
              <ExclamationTriangleIcon className="w-3.5 h-3.5" /> Sửa đổi
            </div>
            <span className="text-lg font-black text-amber-600 dark:text-amber-400">{modifiedCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center justify-center gap-1">
              <MinusCircleIcon className="w-3.5 h-3.5" /> Loại bỏ
            </div>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400">{removedCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-surface-3 border border-border">
            <div className="text-xs font-bold text-ink-muted flex items-center justify-center gap-1">
              <CheckCircleIcon className="w-3.5 h-3.5" /> Không đổi
            </div>
            <span className="text-lg font-black text-ink">{unchangedCount}</span>
          </div>
        </div>

        {/* Danh sách chỉ tiêu so sánh */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {diffs.length === 0 ? (
            <div className="text-center py-12 text-ink-muted text-sm font-medium">
              Không có chỉ tiêu nào để so sánh.
            </div>
          ) : (
            diffs.map((diff, index) => {
              const badgeConfig = {
                ADDED: { bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20', label: 'THÊM MỚI' },
                REMOVED: { bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20', label: 'LOẠI BỎ' },
                MODIFIED: { bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20', label: 'SỬA ĐỔI' },
                UNCHANGED: { bg: 'bg-surface-3 text-ink-muted border-border', label: 'GIỮ NGUYÊN' }
              }[diff.type];

              return (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border transition-all ${
                    diff.type === 'MODIFIED' 
                      ? 'bg-amber-500/5 border-amber-500/20' 
                      : diff.type === 'ADDED' 
                      ? 'bg-emerald-500/5 border-emerald-500/20'
                      : diff.type === 'REMOVED'
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : 'bg-surface border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-ink">{diff.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${badgeConfig.bg}`}>
                        {badgeConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Chi tiết nội dung thay đổi */}
                  {diff.changes.length > 0 && (
                    <div className="mt-2 space-y-1 pl-3 border-l-2 border-amber-400">
                      {diff.changes.map((change, cIdx) => (
                        <p key={cIdx} className="text-xs font-semibold text-ink-soft flex items-center gap-1.5">
                          <ArrowRightIcon className="w-3 h-3 text-amber-500 shrink-0" />
                          {change}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Bảng so sánh cụ thể nếu sửa đổi */}
                  {diff.type === 'MODIFIED' && diff.oldCriterion && diff.newCriterion && (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs bg-surface-2 p-2.5 rounded-lg border border-border">
                      <div>
                        <span className="text-[10px] font-bold text-ink-muted uppercase tracking-wider block mb-1">Phiên bản cũ</span>
                        <div className="font-mono text-ink-soft">
                          {diff.oldCriterion.type === 'NUMBER' ? (
                            <span>
                              Min: {diff.oldCriterion.min ?? '-'} | Max: {diff.oldCriterion.max ?? '-'} {diff.oldCriterion.unit}
                            </span>
                          ) : (
                            <span>{diff.oldCriterion.expectedText || 'N/A'}</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Phiên bản mới</span>
                        <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {diff.newCriterion.type === 'NUMBER' ? (
                            <span>
                              Min: {diff.newCriterion.min ?? '-'} | Max: {diff.newCriterion.max ?? '-'} {diff.newCriterion.unit}
                            </span>
                          ) : (
                            <span>{diff.newCriterion.expectedText || 'N/A'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm transition-colors"
          >
            Đóng bảng so sánh
          </button>
        </div>
      </div>
    </div>
  );
};
