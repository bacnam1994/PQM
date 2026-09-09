import React from 'react';
import { 
  MagnifyingGlassIcon, 
  CheckCircleIcon, 
  CubeIcon, 
  HashtagIcon, 
  CalendarIcon, 
  ClockIcon, 
  ExclamationCircleIcon, 
  PrinterIcon 
} from '@heroicons/react/24/outline';
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
          <label className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
            Chọn Lô hàng cần test *
          </label>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted w-5 h-5" />
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
              className="w-full pl-10 pr-10 py-2.5 bg-surface border border-border rounded-xl font-medium text-ink placeholder:text-ink-muted outline-none text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-60 transition-all"
            />
            {batchId && <CheckCircleIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-600 w-5 h-5" />}

            {showBatchDropdown && (
              <div className="absolute z-20 w-full mt-2 bg-surface rounded-xl shadow-xl border border-border max-h-60 overflow-y-auto divide-y divide-border">
                {availableBatchesForDropdown.map(b => (
                  <div
                    key={b.id}
                    onClick={() => {
                      handleBatchSelect(b.id);
                      setBatchSearch(`${b.batchNo} - ${b.product?.name}`);
                      setShowBatchDropdown(false);
                    }}
                    className={`px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors ${
                      batchId === b.id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink uppercase">Lô: {b.batchNo}</p>
                    <p className="text-xs text-ink-muted">{b.product?.name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
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
          <div className="sm:col-span-2">
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
        <div className="space-y-3">
          <div className="bg-surface-2 p-3.5 rounded-xl border border-border flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <CubeIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-ink">{selectedBatch.product?.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <HashtagIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{selectedBatch.batchNo}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-ink-muted" />
              <span className="text-ink-soft">
                SX: {selectedBatch.mfgDate ? formatDateStandard(selectedBatch.mfgDate) : '---'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 text-ink-muted" />
              <span className="text-ink-soft">
                HD: {selectedBatch.expDate ? formatDateStandard(selectedBatch.expDate) : '---'}
              </span>
            </div>
          </div>

          {existingResultsForBatch.length > 0 && (
            <div className="bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ExclamationCircleIcon className="w-4 h-4" /> Lô này đã có {existingResultsForBatch.length} phiếu kết quả:
                </p>
                <button
                  type="button"
                  onClick={() => window.open(getAppUrl(`/test-results/coa/${batchId}`), '_blank')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold uppercase tracking-wider hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  <PrinterIcon className="w-3.5 h-3.5" /> Xem CoA Tổng hợp
                </button>
              </div>
              <div className="space-y-1.5">
                {existingResultsForBatch.map((r: any) => (
                  <div key={r.id} className="flex justify-between items-center text-xs bg-surface p-2.5 rounded-lg border border-border">
                    <span className="font-medium text-ink">
                      {r.labName} <span className="text-ink-muted font-normal">({formatDateStandard(r.testDate)})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          r.overallStatus === TEST_RESULT_STATUS.PASS
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {r.overallStatus}
                      </span>
                      <button
                        type="button"
                        onClick={() => switchToEditMode(r)}
                        className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Sửa phiếu này
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700/80 dark:text-amber-400/80 italic mt-2 text-center">
                Bạn đang tạo phiếu kết quả <b>MỚI</b> (ví dụ: gửi mẫu thêm cho đơn vị khác).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
