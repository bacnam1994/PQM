import React from 'react';
import { Search, CheckCircle2, Package, Hash, Calendar, Clock, AlertCircle, Printer } from 'lucide-react';
import { DSFormInput, DSDateInput } from '../../../../components';
import { formatDateStandard, TEST_RESULT_STATUS, getAppUrl } from '../../../../utils';
import { HydratedBatch } from '../../../../hooks/useDataGraph';

export interface BatchLabSelectorProps {
  batchSearch: string;
  setBatchSearch: (val: string) => void;
  showBatchDropdown: boolean;
  setShowBatchDropdown: (val: boolean) => void;
  isEditMode: boolean;
  batchId: string;
  availableBatchesForDropdown: HydratedBatch[];
  handleBatchSelect: (batchId: string) => void;
  setFieldValue: (field: string, value: any) => void;
  labName: string;
  testDate: string;
  hydratedBatches: HydratedBatch[];
  existingResultsForBatch: any[];
  switchToEditMode: (res: any) => void;
}

export const BatchLabSelector: React.FC<BatchLabSelectorProps> = ({
  batchSearch,
  setBatchSearch,
  showBatchDropdown,
  setShowBatchDropdown,
  isEditMode,
  batchId,
  availableBatchesForDropdown,
  handleBatchSelect,
  setFieldValue,
  labName,
  testDate,
  hydratedBatches,
  existingResultsForBatch,
  switchToEditMode,
}) => {
  const selectedBatch = hydratedBatches.find(batch => batch.id === batchId);

  return (
    <div className="space-y-6">
      <datalist id="lab-suggestions">
        <option value="Phòng QC (Nội bộ)" />
        <option value="CASE" />
        <option value="Quatest 3" />
        <option value="Eurofins" />
        <option value="Viện Pasteur" />
      </datalist>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">
            Chọn Lô hàng cần test *
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={batchSearch}
              onChange={(e) => {
                setBatchSearch(e.target.value);
                setShowBatchDropdown(true);
                if (!e.target.value) setFieldValue('batchId', '');
              }}
              onFocus={() => setShowBatchDropdown(true)}
              onBlur={() => setTimeout(() => setShowBatchDropdown(false), 200)}
              placeholder="Tìm kiếm Lô hàng (Số lô hoặc Tên SP)..."
              disabled={isEditMode}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-500"
            />
            {batchId && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" size={16} />}

            {showBatchDropdown && (
              <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                {availableBatchesForDropdown.map(b => (
                  <div
                    key={b.id}
                    onClick={() => {
                      handleBatchSelect(b.id);
                      setBatchSearch(`${b.batchNo} - ${b.product?.name}`);
                      setShowBatchDropdown(false);
                    }}
                    className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${
                      batchId === b.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-700 uppercase">Lô: {b.batchNo}</p>
                    <p className="text-[10px] font-medium text-slate-500">{b.product?.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <DSFormInput
              label="Tên đơn vị kiểm nghiệm *"
              name="labName"
              list="lab-suggestions"
              value={labName}
              onChange={(e) => setFieldValue('labName', e.target.value)}
              required
              placeholder="VD: Phòng QC, CASE..."
            />
          </div>
          <div className="col-span-2">
            <DSDateInput
              label="Ngày xuất phiếu *"
              name="testDate"
              value={testDate}
              onChange={(val) => setFieldValue('testDate', val)}
              required
            />
          </div>
        </div>
      </div>

      {batchId && selectedBatch && (
        <div className="space-y-3 animate-in fade-in">
          <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1">
              <Package size={14} className="text-indigo-400" />
              <span className="font-bold text-slate-700">{selectedBatch.product?.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <Hash size={14} className="text-indigo-400" />
              <span className="font-bold text-indigo-700">{selectedBatch.batchNo}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar size={14} className="text-indigo-400" />
              <span className="font-bold text-slate-700">
                SX: {selectedBatch.mfgDate ? formatDateStandard(selectedBatch.mfgDate) : '---'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock size={14} className="text-indigo-400" />
              <span className="font-bold text-slate-700">
                HD: {selectedBatch.expDate ? formatDateStandard(selectedBatch.expDate) : '---'}
              </span>
            </div>
          </div>

          {existingResultsForBatch.length > 0 && (
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100 animate-in fade-in">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle size={12} /> Lô này đã có {existingResultsForBatch.length} phiếu kết quả:
                </p>
                <button
                  type="button"
                  onClick={() => window.open(getAppUrl(`/test-results/coa/${batchId}`), '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
                >
                  <Printer size={12} /> Xem CoA Tổng hợp
                </button>
              </div>
              <div className="space-y-1">
                {existingResultsForBatch.map((r: any) => (
                  <div key={r.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-amber-100/50">
                    <span className="font-bold text-slate-600">
                      {r.labName} <span className="font-normal text-slate-400">({formatDateStandard(r.testDate)})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          r.overallStatus === TEST_RESULT_STATUS.PASS
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {r.overallStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => switchToEditMode(r)}
                        className="text-[9px] font-bold text-blue-600 hover:underline"
                      >
                        Sửa phiếu này
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-amber-600/70 italic mt-2 text-center">
                Bạn đang tạo phiếu kết quả <b>MỚI</b> (ví dụ: gửi mẫu thêm cho đơn vị khác).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
