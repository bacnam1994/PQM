import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    Plus, Search, CheckCircle2, AlertCircle, Calendar, Beaker, Trash2,
    History, ListPlus, FlaskConical, Printer, Loader2,
    Package, Hash, Clock, ShieldCheck
} from 'lucide-react';
import { TestResult, TCCS } from '../types';
import { HydratedBatch, HydratedTestResult } from '../hooks/useDataGraph';
import { ensureArray } from '../utils/parsing';
import { DSFormInput } from './design';
import CriteriaInputGroup from './CriteriaInputGroup';
import SpecialCharToolbar from './SpecialCharToolbar';
import { useDebounce } from '../hooks/useDebounce';
import { UseCrudReturn } from '../hooks/useCrud';
import { UseFormReturn } from '../hooks/useForm';

// Define a comprehensive props interface for the form
interface TestResultFormProps {
    crud: UseCrudReturn<TestResult>;
    formValues: any;
    isSubmitting: boolean;
    hydratedBatches: HydratedBatch[];
    activeTCCS: TCCS | null;
    defaultTCCS: TCCS | null;
    latestTCCS: TCCS | null;
    availableTCCSList: TCCS[];
    existingResultsForBatch: HydratedTestResult[];
    batchSearch: string;
    showBatchDropdown: boolean;

    // Handlers
    handleSaveResult: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
    closeFormModal: () => void;
    setFieldValue: UseFormReturn<any>['setFieldValue'];
    addToArray: UseFormReturn<any>['addToArray'];
    removeFromArray: UseFormReturn<any>['removeFromArray'];
    updateInArray: UseFormReturn<any>['updateInArray'];
    setBatchSearch: React.Dispatch<React.SetStateAction<string>>;
    setShowBatchDropdown: React.Dispatch<React.SetStateAction<boolean>>;
    handleBatchSearchFocus: () => void;
    handleBatchSelect: (batchId: string) => void;
    setManualTccsId: React.Dispatch<React.SetStateAction<string | null>>;
    handlePrintConsolidatedCoa: (batchId: string) => void;
    switchToEditMode: (res: TestResult) => void;
    handleSetTestResultsMap: (mapOrUpdater: any) => void;
}

const TestResultForm: React.FC<TestResultFormProps> = ({
    crud,
    formValues,
    isSubmitting,
    hydratedBatches,
    activeTCCS,
    defaultTCCS,
    latestTCCS,
    availableTCCSList,
    existingResultsForBatch,
    batchSearch,
    showBatchDropdown,
    handleSaveResult,
    closeFormModal,
    setFieldValue,
    addToArray,
    removeFromArray,
    updateInArray,
    setBatchSearch,
    setShowBatchDropdown,
    handleBatchSearchFocus,
    handleBatchSelect,
    setManualTccsId,
    handlePrintConsolidatedCoa,
    switchToEditMode,
    handleSetTestResultsMap,
}) => {
    const batchInputRef = useRef<HTMLInputElement>(null);
    const isInputFocusedRef = useRef(false);

    // Local state for batch search input - completely independent from parent state
    // This prevents cursor jumping caused by parent re-renders
    const [localBatchSearch, setLocalBatchSearch] = useState('');
    // Debounce the local input for dropdown filtering only - NOT synced to parent
    const debouncedBatchSearch = useDebounce(localBatchSearch, 300);

    // Sync local state from parent when:
    // 1. batchSearch changes from parent AND input is NOT focused
    // This prevents cursor jumping while typing
    useEffect(() => {
        if (!isInputFocusedRef.current && batchSearch !== localBatchSearch) {
            setLocalBatchSearch(batchSearch);
        }
    }, [batchSearch]);

    // Handle input focus - track focus state to prevent cursor jump
    const handleInputFocus = useCallback(() => {
        isInputFocusedRef.current = true;
        handleBatchSearchFocus();
    }, [handleBatchSearchFocus]);

    // Handle input blur - sync back to parent to ensure consistency
    const handleInputBlur = useCallback(() => {
        isInputFocusedRef.current = false;
        // After blur, sync with parent state
        if (batchSearch !== localBatchSearch) {
            setLocalBatchSearch(batchSearch);
        }
    }, [batchSearch, localBatchSearch]);

    // Filter dropdown using LOCAL debounced value - no parent sync needed
    const availableBatchesForDropdown = useMemo(() => {
        return hydratedBatches.filter(b =>
            (!debouncedBatchSearch || b.batchNo.toLowerCase().includes(debouncedBatchSearch.toLowerCase()) || (b.product?.name || '').toLowerCase().includes(debouncedBatchSearch.toLowerCase()))
        );
    }, [hydratedBatches, debouncedBatchSearch]);

    // Handle batch selection - update both local and parent state
    const handleBatchSelectWrapper = useCallback((batchId: string) => {
        const b = hydratedBatches.find(b => b.id === batchId);
        if (b) {
            const displayValue = `${b.batchNo} - ${b.product?.name}`;
            setLocalBatchSearch(displayValue);
        }
        handleBatchSelect(batchId);
    }, [hydratedBatches, handleBatchSelect]);

    return (
        <form onSubmit={handleSaveResult}>
            {/* SpecialCharToolbar - Di chuyển lên đầu và sticky để tiện khi cuộn */}
            <SpecialCharToolbar className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 -mx-4 px-4 py-2 mb-4 shadow-sm" />

            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Chọn Lô hàng cần test *</label>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                ref={batchInputRef}
                                type="text"
                                value={localBatchSearch}
                                onChange={(e) => setLocalBatchSearch(e.target.value)}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                placeholder="Tìm kiếm Lô hàng..."
                                aria-label="Tìm kiếm Lô hàng"
                                disabled={crud.mode === 'EDIT'}
                                autoComplete="off"
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl font-bold outline-none shadow-inner text-sm dark:text-slate-200 focus:ring-2 focus:ring-indigo-500"
                            />
                            {formValues.batchId && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" size={16} />}

                            {showBatchDropdown && (
                                <div
                                    className="absolute z-20 w-full mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 max-h-60 overflow-y-auto"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                >
                                    {availableBatchesForDropdown.length > 0 ? (
                                        availableBatchesForDropdown.map(b => {
                                            return (
                                                <div
                                                    key={b.id}
                                                    role="button"
                                                    aria-label={`Chọn lô ${b.batchNo}`}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        handleBatchSelectWrapper(b.id);
                                                        setBatchSearch(`${b.batchNo} - ${b.product?.name}`); // Sync to parent
                                                        setShowBatchDropdown(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer border-b border-slate-50 dark:border-slate-700 last:border-none transition-colors ${formValues.batchId === b.id ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
                                                >
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Lô: {b.batchNo}</p>
                                                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{b.product?.name}</p>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="px-4 py-6 text-center">
                                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Không có lô hàng nào</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2 group">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Tên đơn vị kiểm nghiệm *</label>
                            <input
                                type="text"
                                name="labName"
                                list="lab-suggestions"
                                defaultValue={formValues.labName}
                                onChange={(e) => setFieldValue('labName', e.target.value)}
                                required
                                placeholder="VD: Phòng QC, CASE..."
                                className="w-full px-5 py-3.5 bg-slate-50/80 dark:bg-slate-700/80 backdrop-blur-sm border border-transparent focus:bg-white dark:focus:bg-slate-600 rounded-xl font-medium outline-none shadow-inner text-base text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-emerald-100/50 dark:focus:ring-emerald-900/30 focus:border-emerald-200 dark:focus:border-emerald-700 transition-all duration-300"
                            />
                        </div>
                        <div className="col-span-2 space-y-2 group">
                            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">Ngày xuất phiếu *</label>
                            <input
                                type="date"
                                name="testDate"
                                defaultValue={formValues.testDate}
                                onChange={(e) => setFieldValue('testDate', e.target.value)}
                                required
                                className="w-full px-5 py-3.5 bg-slate-50/80 dark:bg-slate-700/80 backdrop-blur-sm border border-transparent focus:bg-white dark:focus:bg-slate-600 rounded-xl font-medium outline-none shadow-inner text-base text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-emerald-100/50 dark:focus:ring-emerald-900/30 focus:border-emerald-200 dark:focus:border-emerald-700 transition-all duration-300"
                            />
                        </div>
                    </div>
                </div>

                {formValues.batchId && (() => {
                    const b = hydratedBatches.find(batch => batch.id === formValues.batchId);
                    if (!b) return null;
                    return (
                        <div className="space-y-3 animate-in fade-in">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl border border-indigo-100 dark:border-indigo-800 flex flex-wrap gap-4 text-xs">
                                <div className="flex items-center gap-1"><Package size={14} className="text-indigo-400" /> <span className="font-bold text-slate-700 dark:text-slate-300">{b.product?.name}</span></div>
                                <div className="flex items-center gap-1"><Hash size={14} className="text-indigo-400" /> <span className="font-bold text-indigo-700 dark:text-indigo-300">{b.batchNo}</span></div>
                                <div className="flex items-center gap-1"><Calendar size={14} className="text-indigo-400" /> <span className="font-bold text-slate-700 dark:text-slate-300">SX: {b.mfgDate ? new Date(b.mfgDate).toLocaleDateString('en-GB') : '---'}</span></div>
                                <div className="flex items-center gap-1"><Clock size={14} className="text-indigo-400" /> <span className="font-bold text-slate-700 dark:text-slate-300">HD: {b.expDate ? new Date(b.expDate).toLocaleDateString('en-GB') : '---'}</span></div>
                            </div>

                            {existingResultsForBatch.length > 0 && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800 animate-in fade-in">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                            <AlertCircle size={12} /> Lô này đã có {existingResultsForBatch.length} phiếu kết quả:
                                        </p>
                                        <button type="button" onClick={() => handlePrintConsolidatedCoa(formValues.batchId)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100">
                                            <Printer size={12} /> Xem CoA Tổng hợp
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {existingResultsForBatch.map(r => (
                                            <div key={r.id} className="flex justify-between items-center text-xs bg-white dark:bg-slate-800 p-2 rounded border border-amber-100/50 dark:border-amber-800/50">
                                                <span className="font-bold text-slate-600 dark:text-slate-300">{r.labName} <span className="font-normal text-slate-400">({new Date(r.testDate).toLocaleDateString('en-GB')})</span></span>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${r.overallStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.overallStatus}</span>
                                                    <button type="button" onClick={() => switchToEditMode(r)} className="text-[9px] font-bold text-blue-600 hover:underline">Sửa phiếu này</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 italic mt-2 text-center">Bạn đang tạo phiếu kết quả <b>MỚI</b>.</p>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {activeTCCS ? (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-100 dark:border-slate-600">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                    <History size={20} /> TIÊU CHUẨN ÁP DỤNG
                                </h4>
                                {defaultTCCS && activeTCCS.id !== defaultTCCS.id && (
                                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded border border-amber-100 dark:border-amber-800">
                                        Đang dùng phiên bản khác với mặc định
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3 mt-2">
                                <select
                                    value={activeTCCS.id}
                                    onChange={(e) => setManualTccsId(e.target.value)}
                                    className="flex-1 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    {availableTCCSList.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.code} (Ban hành: {new Date(t.issueDate).toLocaleDateString('en-GB')})
                                            {defaultTCCS && t.id === defaultTCCS.id ? " - [Mặc định]" : ""}
                                            {latestTCCS && t.id === latestTCCS.id ? " - [Hiệu lực]" : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {(() => {
                            if (!activeTCCS) return null;
                            const allTccsCriteria = [
                                ...ensureArray(activeTCCS.mainQualityCriteria),
                                ...ensureArray(activeTCCS.safetyCriteria)
                            ].filter(c => c && c.name);

                            const totalCount = allTccsCriteria.length;
                            const filledCount = allTccsCriteria.filter(c => {
                                const val = formValues.testResultsMap[c.name];
                                return val !== undefined && String(val).trim() !== '';
                            }).length;

                            const progress = totalCount > 0 ? Math.round((filledCount / totalCount) * 100) : 0;

                            return (
                                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-100 dark:border-slate-600 space-y-3 my-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                            Tiến độ nhập liệu (TCCS)
                                        </p>
                                        <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                                            {filledCount} / {totalCount}
                                        </p>
                                    </div>
                                    <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2.5"><div className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
                                </div>
                            );
                        })()}

                        <CriteriaInputGroup
                            title="Lý hóa & Cảm quan"
                            criteria={ensureArray(activeTCCS.mainQualityCriteria)}
                            icon={<Beaker size={16} />}
                            colorClass="text-indigo-600"
                            activeTCCS={activeTCCS}
                            testResultsMap={formValues.testResultsMap}
                            setTestResultsMap={handleSetTestResultsMap}
                            existingResultsForBatch={existingResultsForBatch}
                        />

                        {(() => {
                            const HEAVY_METAL_KEYWORDS = ['asen', 'chì', 'thủy ngân', 'cadmi'];
                            const safety = ensureArray(activeTCCS.safetyCriteria);
                            const micro = safety.filter(c => {
                                if (!c) return false;
                                const nameLower = (c.name || '').toLowerCase();
                                if ((c as any).category === 'micro') return true;
                                if (!(c as any).category && !HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
                                return false;
                            });
                            const metal = safety.filter(c => {
                                if (!c) return false;
                                const nameLower = (c.name || '').toLowerCase();
                                if ((c as any).category === 'metal') return true;
                                if (!(c as any).category && HEAVY_METAL_KEYWORDS.some(kw => nameLower.includes(kw))) return true;
                                return false;
                            });
                            return (
                                <>
                                    <CriteriaInputGroup
                                        title="Vi sinh vật"
                                        criteria={micro}
                                        icon={<FlaskConical size={16} />}
                                        colorClass="text-emerald-600"
                                        activeTCCS={activeTCCS}
                                        testResultsMap={formValues.testResultsMap}
                                        setTestResultsMap={handleSetTestResultsMap}
                                        existingResultsForBatch={existingResultsForBatch}
                                    />
                                    <CriteriaInputGroup
                                        title="Kim loại nặng"
                                        criteria={metal}
                                        icon={<ShieldCheck size={16} />}
                                        colorClass="text-red-600"
                                        activeTCCS={activeTCCS}
                                        testResultsMap={formValues.testResultsMap}
                                        setTestResultsMap={handleSetTestResultsMap}
                                        existingResultsForBatch={existingResultsForBatch}
                                    />
                                </>
                            );
                        })()}
                    </div>
                ) : formValues.batchId && (
                    <div className="p-8 text-center bg-indigo-50/30 dark:bg-indigo-900/20 rounded-2xl border-4 border-dashed border-indigo-100 dark:border-indigo-800">
                        <AlertCircle size={48} className="mx-auto text-indigo-200 dark:text-indigo-600 mb-4" />
                        <p className="text-sm font-black text-indigo-800 dark:text-indigo-300 uppercase">Không tìm thấy hồ sơ TCCS hiệu lực!</p>
                    </div>
                )}

                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-600">
                    <div className="flex justify-between items-center">
                        <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                            <ListPlus size={20} /> CHỈ TIÊU BỔ SUNG (NGOÀI TCCS)
                        </h4>
                        <button
                            type="button"
                            onClick={() => addToArray('extraCriteria', { id: 'extra_' + Date.now(), name: '', value: '', unit: '', limit: '' })}
                            className="text-[10px] font-bold bg-slate-100 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
                        >
                            <Plus size={14} /> Thêm dòng
                        </button>
                    </div>

                    {formValues.extraCriteria.map((item: any, idx: number) => (
                        <div key={item.id} className="flex gap-2 items-start animate-in slide-in-from-left-2">
                            <input aria-label="Tên chỉ tiêu" placeholder="Tên chỉ tiêu" value={item.name} onChange={e => updateInArray('extraCriteria', idx, 'name', e.target.value)} className="flex-[2] px-3 py-2 bg-slate-50 dark:bg-slate-700 border-none rounded-lg text-sm font-bold outline-none focus:ring-1 focus:ring-indigo-500 dark:text-slate-200" />
                            <input aria-label="Kết quả" placeholder="Kết quả" value={item.value} onChange={e => updateInArray('extraCriteria', idx, 'value', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border-none rounded-lg text-sm font-black text-indigo-700 dark:text-indigo-300 outline-none focus:ring-1 focus:ring-indigo-500 text-right" />
                            <input aria-label="ĐVT" placeholder="ĐVT" value={item.unit} onChange={e => updateInArray('extraCriteria', idx, 'unit', e.target.value)} className="w-16 px-3 py-2 bg-slate-50 dark:bg-slate-700 border-none rounded-lg text-sm font-bold outline-none text-center dark:text-slate-200" />
                            <input aria-label="Mức giới hạn" placeholder="Mức giới hạn" value={item.limit} onChange={e => updateInArray('extraCriteria', idx, 'limit', e.target.value)} className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-700 border-none rounded-lg text-xs font-medium outline-none dark:text-slate-200" />
                            <button type="button" onClick={() => removeFromArray('extraCriteria', idx)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>

                <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-600">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Ghi chú</label>
                    <textarea aria-label="notes" name="notes" value={formValues.notes} onChange={(e) => setFieldValue('notes', e.target.value)} rows={2} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border-none rounded-xl font-bold outline-none shadow-inner text-sm dark:text-slate-200 focus:ring-2 focus:ring-indigo-100 transition-all" placeholder="Ghi chú..." />
                </div>
            </div>

            <div className="pt-6 flex justify-end gap-3 border-t bg-white dark:bg-slate-800 mt-2">
                <button type="button" onClick={closeFormModal} className="px-6 py-3 text-slate-400 dark:text-slate-500 font-black uppercase text-xs tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl">Hủy</button>
                <button type="submit" disabled={!activeTCCS || isSubmitting} className={`px-8 py-3 text-white font-black rounded-xl shadow-2xl transition-all uppercase text-xs tracking-widest ${crud.mode === 'EDIT' ? 'bg-blue-600 shadow-blue-100 hover:bg-blue-700' : 'bg-indigo-600 shadow-indigo-100 hover:bg-indigo-700'} disabled:opacity-20 flex items-center gap-2`}>
                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                    {crud.mode === 'EDIT' ? 'Cập nhật' : 'Lưu kết quả'}
                </button>
            </div>
        </form>
    );
};

export default TestResultForm;
