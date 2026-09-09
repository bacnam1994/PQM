/**
 * PQM V4 Platform - TCCS Version Diff Modal
 * Trực quan hóa độ lệch tiêu chuẩn kỹ thuật giữa 2 phiên bản TCCS theo chuẩn GMP
 */

import React from 'react';
import { 
  X, GitCompare, PlusCircle, MinusCircle, AlertTriangle, 
  CheckCircle2, ArrowRight, ShieldCheck, Scale 
} from 'lucide-react';
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <GitCompare size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight flex items-center gap-2">
                So sánh phiên bản TCCS
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Đối chiếu chi tiết giữa <span className="font-bold text-slate-700 dark:text-slate-200">{oldVersionCode || 'Bản cũ'}</span> và <span className="font-bold text-indigo-600 dark:text-indigo-400">{newVersionCode || 'Bản mới'}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thống kê biến động */}
        <div className="px-6 py-3 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 grid grid-cols-4 gap-3 text-center">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50">
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1">
              <PlusCircle size={14} /> Thêm mới
            </div>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-300">{addedCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50">
            <div className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center justify-center gap-1">
              <AlertTriangle size={14} /> Sửa đổi
            </div>
            <span className="text-lg font-black text-amber-600 dark:text-amber-300">{modifiedCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50">
            <div className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center justify-center gap-1">
              <MinusCircle size={14} /> Loại bỏ
            </div>
            <span className="text-lg font-black text-rose-600 dark:text-rose-300">{removedCount}</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-1">
              <CheckCircle2 size={14} /> Không đổi
            </div>
            <span className="text-lg font-black text-slate-700 dark:text-slate-300">{unchangedCount}</span>
          </div>
        </div>

        {/* Danh sách chỉ tiêu so sánh */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {diffs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm font-medium">
              Không có chỉ tiêu nào để so sánh.
            </div>
          ) : (
            diffs.map((diff, index) => {
              const badgeConfig = {
                ADDED: { bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800', label: 'THÊM MỚI' },
                REMOVED: { bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800', label: 'LOẠI BỎ' },
                MODIFIED: { bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800', label: 'SỬA ĐỔI' },
                UNCHANGED: { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700', label: 'GIỮ NGUYÊN' }
              }[diff.type];

              return (
                <div 
                  key={index}
                  className={`p-4 rounded-xl border transition-all ${
                    diff.type === 'MODIFIED' 
                      ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60' 
                      : diff.type === 'ADDED' 
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : diff.type === 'REMOVED'
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{diff.name}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border uppercase tracking-wider ${badgeConfig.bg}`}>
                        {badgeConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Chi tiết nội dung thay đổi */}
                  {diff.changes.length > 0 && (
                    <div className="mt-2 space-y-1 pl-3 border-l-2 border-amber-300 dark:border-amber-700">
                      {diff.changes.map((change, cIdx) => (
                        <p key={cIdx} className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <ArrowRight size={12} className="text-amber-500 shrink-0" />
                          {change}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Bảng so sánh cụ thể nếu sửa đổi */}
                  {diff.type === 'MODIFIED' && diff.oldCriterion && diff.newCriterion && (
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs bg-white dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Phiên bản cũ</span>
                        <div className="font-mono text-slate-700 dark:text-slate-300">
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
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block mb-1">Phiên bản mới</span>
                        <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
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
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-xs uppercase tracking-wider shadow-md transition-colors"
          >
            Đóng bảng so sánh
          </button>
        </div>
      </div>
    </div>
  );
};
