import React from 'react';
import {
  SparklesIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  Square3Stack3DIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import { Modal } from '../../../../components';
import { DuplicateGroup, HarmonizationReport } from '../../../../services/ai/materialHarmonizerService';

interface MaterialHarmonizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAnalyzingHarmonization: boolean;
  harmonizationReport: HarmonizationReport | null;
  executingMergeGroupId: string | null;
  handleExecuteMerge: (group: DuplicateGroup) => Promise<void>;
}

export const MaterialHarmonizerModal: React.FC<MaterialHarmonizerModalProps> = ({
  isOpen,
  onClose,
  isAnalyzingHarmonization,
  harmonizationReport,
  executingMergeGroupId,
  handleExecuteMerge
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI Rà soát & Chuẩn hóa Danh mục Nguyên liệu"
      icon={SparklesIcon}
    >
      <div className="space-y-5">
        {isAnalyzingHarmonization ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-bold text-ink">AI đang quét và phân tích độ tương đồng ngữ nghĩa...</p>
            <p className="text-xs text-ink-muted">Đang đối chiếu tên chuẩn, bí danh và công thức sản phẩm</p>
          </div>
        ) : harmonizationReport ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface-2 p-3.5 rounded-xl border border-border">
                <div className="text-[10px] font-bold uppercase text-ink-muted">Tổng Nguyên liệu</div>
                <div className="text-lg font-bold text-ink mt-0.5">{harmonizationReport.totalMaterials}</div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/40 p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/50">
                <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Cặp có nguy cơ trùng</div>
                <div className="text-lg font-bold text-amber-900 dark:text-amber-200 mt-0.5">{harmonizationReport.duplicateGroups.length} nhóm</div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Điểm sạch dữ liệu</div>
                <div className="text-lg font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">{harmonizationReport.healthScore}/100</div>
              </div>
            </div>

            {/* Duplicate Groups List */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Square3Stack3DIcon className="h-3.5 w-3.5" />
                <span>Danh sách Nhóm nguyên liệu cần Gộp ({harmonizationReport.duplicateGroups.length})</span>
              </h4>

              {harmonizationReport.duplicateGroups.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                  <CheckCircleIcon className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">Tuyệt vời! Không phát hiện nguyên liệu nào bị trùng lặp trong danh mục.</p>
                </div>
              ) : (
                harmonizationReport.duplicateGroups.map((group) => {
                  const isMerging = executingMergeGroupId === group.id;

                  return (
                    <div key={group.id} className="p-4 bg-surface-2 rounded-xl border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded text-[10px] font-bold">
                            Độ tương đồng: {group.similarityScore}%
                          </span>
                          <span className="text-xs text-ink-muted italic">({group.reason})</span>
                        </div>
                        {group.affectedFormulasCount > 0 && (
                          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 px-2 py-0.5 rounded">
                            {group.affectedFormulasCount} công thức liên quan
                          </span>
                        )}
                      </div>

                      {/* Visual Merge Representation */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
                          <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1">
                            <CheckCircleIcon className="h-3.5 w-3.5" />
                            <span>Giữ làm Tên Chuẩn (Primary)</span>
                          </div>
                          <div className="font-bold text-sm text-ink">{group.primaryMaterial.name}</div>
                          {group.primaryMaterial.code && (
                            <div className="text-[10px] font-mono text-ink-muted">Mã: {group.primaryMaterial.code}</div>
                          )}
                        </div>

                        <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl">
                          <div className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 flex items-center gap-1 mb-1">
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                            <span>Gộp & Chuyển thành Aliases</span>
                          </div>
                          <div className="space-y-1">
                            {group.duplicateMaterials.map(d => (
                              <div key={d.id} className="text-xs font-semibold text-ink flex items-center justify-between">
                                <span>{d.name}</span>
                                {d.code && <span className="text-[10px] font-mono text-ink-muted">({d.code})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          disabled={isMerging}
                          onClick={() => handleExecuteMerge(group)}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isMerging ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <SparklesIcon className="h-3.5 w-3.5" />}
                          <span>Thực hiện Gộp vào "{group.primaryMaterial.name}"</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}

        <div className="flex justify-end pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-surface-2 text-ink-soft hover:text-ink font-semibold text-xs rounded-lg hover:bg-surface-3 transition-colors cursor-pointer border border-border"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
