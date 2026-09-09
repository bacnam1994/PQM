import React from 'react';
import { Sparkles, Loader2, CheckCircle2, Layers3, ArrowRight } from 'lucide-react';
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
      icon={Sparkles}
    >
      <div className="space-y-6">
        {isAnalyzingHarmonization ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
            <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">AI đang quét và phân tích độ tương đồng ngữ nghĩa...</p>
            <p className="text-xs text-slate-400">Đang đối chiếu tên chuẩn, bí danh và công thức sản phẩm</p>
          </div>
        ) : harmonizationReport ? (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-indigo-50/60 dark:bg-indigo-950/40 p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                <div className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400">Tổng Nguyên liệu</div>
                <div className="text-lg font-black text-slate-800 dark:text-zinc-100 mt-0.5">{harmonizationReport.totalMaterials}</div>
              </div>

              <div className="bg-purple-50/60 dark:bg-purple-950/40 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/50">
                <div className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400">Cặp có nguy cơ trùng</div>
                <div className="text-lg font-black text-slate-800 dark:text-zinc-100 mt-0.5">{harmonizationReport.duplicateGroups.length} nhóm</div>
              </div>

              <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Điểm sạch dữ liệu</div>
                <div className="text-lg font-black text-slate-800 dark:text-zinc-100 mt-0.5">{harmonizationReport.healthScore}/100</div>
              </div>
            </div>

            {/* Duplicate Groups List */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
                <Layers3 size={13} />
                <span>Danh sách Nhóm nguyên liệu cần Gộp ({harmonizationReport.duplicateGroups.length})</span>
              </h4>

              {harmonizationReport.duplicateGroups.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/40 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">Tuyệt vời! Không phát hiện nguyên liệu nào bị trùng lặp trong danh mục.</p>
                </div>
              ) : (
                harmonizationReport.duplicateGroups.map((group) => {
                  const isMerging = executingMergeGroupId === group.id;

                  return (
                    <div key={group.id} className="p-4 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded text-[10px] font-black">
                            Độ tương đồng: {group.similarityScore}%
                          </span>
                          <span className="text-xs text-slate-400 italic">({group.reason})</span>
                        </div>
                        {group.affectedFormulasCount > 0 && (
                          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded">
                            {group.affectedFormulasCount} công thức liên quan
                          </span>
                        )}
                      </div>

                      {/* Visual Merge Representation */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl">
                          <div className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mb-1">
                            <CheckCircle2 size={12} />
                            <span>Giữ làm Tên Chuẩn (Primary)</span>
                          </div>
                          <div className="font-bold text-sm text-slate-800 dark:text-zinc-100">{group.primaryMaterial.name}</div>
                          {group.primaryMaterial.code && (
                            <div className="text-[10px] font-mono text-slate-400">Mã: {group.primaryMaterial.code}</div>
                          )}
                        </div>

                        <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl">
                          <div className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 flex items-center gap-1 mb-1">
                            <ArrowRight size={12} />
                            <span>Gộp & Chuyển thành Aliases</span>
                          </div>
                          <div className="space-y-1">
                            {group.duplicateMaterials.map(d => (
                              <div key={d.id} className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-between">
                                <span>{d.name}</span>
                                {d.code && <span className="text-[10px] font-mono text-slate-400">({d.code})</span>}
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
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isMerging ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
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

        <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-zinc-850">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold uppercase text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
