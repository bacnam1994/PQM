import React, { useState, useMemo, useEffect, memo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useTestResultContext } from '../context/TestResultContext';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Plus, Search, Layers, Hash, History, CheckCircle2, AlertTriangle, 
  CalendarOff, Upload, FileSpreadsheet, Info, LayoutGrid, List, 
  Edit2, Loader2, ClipboardCheck, FlaskConical, ListChecks, ArrowUpDown, 
  Filter, CalendarRange, X, ShieldCheck, Clock, FileUp, Eye, RefreshCw
} from 'lucide-react';
import { Batch, TestResult, AuditAction, TCCS } from '../types';
import { PageHeader, Modal, StatusBadge, Pagination, ConfirmationModal } from '../components/CommonUI';
import { useDataGraph } from '../hooks/useDataGraph';
import { DSFilterBar, DSSearchInput, DSSelect, DSViewToggle, DSCard, DSTable, DSFormInput } from '../components/DesignSystem';
import { BATCH_STATUS } from '../utils/constants';
import { useDebounce } from '../hooks/useDebounce';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatDateStandard, toInputDate, parseDateToISO } from '../utils/dateUtils';
import { logAuditAction } from '../services/auditService';
import { useCrud } from '../hooks/useCrud';
import { ActionButtons, DeleteModal, AddButton } from '../components/CrudControls';
import { generateId } from '../utils/idGenerator';
import { debug } from '../utils/debug';

// ============================================
// TYPE DEFINITIONS
// ============================================

type HydratedBatchWithProduct = ReturnType<typeof useDataGraph>['batches'][0];

// ============================================
// SUB-COMPONENTS
// ============================================

/**
 * BatchDetailContent - Component hiển thị chi tiết lô trong Modal
 */
const BatchDetailContent = ({ 
  viewBatch, 
  testResults, 
  findTccsByMfgDate,
  setViewBatch,
  hydratedBatches,
  tccsList
}: { 
  viewBatch: Batch; 
  testResults: TestResult[]; 
  findTccsByMfgDate: (productId: string, mfgDate: string | null) => TCCS | null;
  setViewBatch: (batch: Batch | null) => void;
  hydratedBatches: HydratedBatchWithProduct[];
  tccsList: TCCS[];
}) => {
  // Tìm TCCS áp dụng cho lô theo logic nhất quán với trang nhập kết quả
  const tccs = findTccsByMfgDate(viewBatch.productId, viewBatch.mfgDate);
  
  // Lấy TCCS hiện tại của lô (đang được lưu trong DB)
  const currentTccs = tccsList.find(t => t.id === viewBatch.tccsId);
  
  // Kiểm tra xem TCCS hiện tại có khớp với TCCS đúng theo ngày SX không
  const isTccsMismatched = currentTccs && tccs && currentTccs.id !== tccs.id;
  
  // Lấy thông tin product từ hydratedBatches (nếu có)
  const hydratedBatch = hydratedBatches.find(b => b.id === viewBatch.id);
  const productName = hydratedBatch?.product?.name || 'N/A';
  const productCode = hydratedBatch?.product?.code || 'N/A';
  
  const batchTestResults = testResults.filter(r => r.batchId === viewBatch.id);

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
      {/* Cảnh báo TCCS không khớp */}
      {isTccsMismatched && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-red-800">Cảnh báo: TCCS không khớp!</p>
              <p className="text-red-700 mt-1">
                Lô này đang sử dụng <strong>{currentTccs.code}</strong> nhưng theo ngày SX ({formatDateStandard(viewBatch.mfgDate)}), nên sử dụng <strong>{tccs.code}</strong>.
              </p>
              <p className="text-xs text-red-600 mt-2">
                Vui lòng cập nhật lô để sử dụng TCCS đúng.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TCCS Info Card */}
      {tccs ? (
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
          <div className="flex items-center gap-2 mb-2">
            <FileSpreadsheet size={16} className="text-indigo-600" />
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">TCCS Áp dụng</span>
            {isTccsMismatched && (
              <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Cần cập nhật</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase">Mã TCCS</p>
              <p className="font-bold text-indigo-800">{tccs.code}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-indigo-400 uppercase">Ngày ban hành</p>
              <p className="font-bold text-indigo-800">{formatDateStandard(tccs.issueDate)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
          <p className="text-xs font-bold text-amber-700">Không tìm thấy TCCS phù hợp cho lô này.</p>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sản phẩm</p>
            <h4 className="font-bold text-slate-800 text-lg">{productName}</h4>
            <p className="text-xs font-bold text-indigo-600">{productCode}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Số Lô</p>
            <h4 className="font-black text-slate-800 text-xl">{viewBatch.batchNo}</h4>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="font-bold text-slate-500">NSX:</span> {formatDateStandard(viewBatch.mfgDate)}
          </div>
          <div>
            <span className="font-bold text-slate-500">HSD:</span> {formatDateStandard(viewBatch.expDate)}
          </div>
          <div>
            <span className="font-bold text-slate-500">Cỡ lô:</span> {viewBatch.theoreticalYield?.toLocaleString()} {viewBatch.yieldUnit}
          </div>
          <div>
            <span className="font-bold text-slate-500">Thực tế:</span> {viewBatch.actualYield?.toLocaleString()} {viewBatch.yieldUnit}
          </div>
        </div>
      </div>

      {/* Test Results */}
      <div>
        <h5 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
          <ClipboardCheck size={14} /> Lịch sử Kiểm nghiệm
        </h5>
        <div className="space-y-4">
          {batchTestResults.length === 0 ? (
            <div className="p-8 text-center border border-slate-100 rounded-xl bg-slate-50 text-slate-400 italic text-xs">
              Chưa có kết quả kiểm nghiệm nào.
            </div>
          ) : (
            batchTestResults.map(res => (
              <div key={res.id} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 flex justify-between items-center border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                        res.overallStatus === 'PASS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {res.overallStatus === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-700">{res.labName}</p>
                      <p className="text-[10px] text-slate-500">{new Date(res.testDate).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                  <Link to={`/test-results?batchId=${viewBatch.id}`} className="text-[10px] font-bold text-indigo-600 hover:underline">
                    Xem phiếu
                  </Link>
                </div>
                <div className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50/50 text-slate-400 font-bold">
                      <tr>
                        <th className="px-4 py-2 text-left">Chỉ tiêu</th>
                        <th className="px-4 py-2 text-right">Kết quả</th>
                        <th className="px-4 py-2 text-center">ĐVT</th>
                        <th className="px-4 py-2 text-center">Đánh giá</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {res.results.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/30">
                          <td className="px-4 py-2 font-medium text-slate-700">{item.criteriaName}</td>
                          <td className="px-4 py-2 text-right font-bold text-slate-800">{item.value}</td>
                          <td className="px-4 py-2 text-center text-slate-500">{item.unit}</td>
                          <td className="px-4 py-2 text-center">
                            {item.isPass ? (
                              <CheckCircle2 size={14} className="mx-auto text-emerald-500" />
                            ) : (
                              <X size={14} className="mx-auto text-red-500" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={() => setViewBatch(null)}
          className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold uppercase transition-colors"
        >
          Đóng
        </button>
      </div>
    </div>
  );
};

/**
 * BatchStatusSelect
 */
const BatchStatusSelect = ({ 
  status, 
  batchId, 
  onUpdate, 
  isAdmin 
}: { 
  status: string; 
  batchId: string; 
  onUpdate: (s: string, id: string) => void; 
  isAdmin: boolean;
}) => {
  const getStatusColor = (s: string) => {
    switch (s) {
      case 'RELEASED':
        return 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm';
      case 'REJECTED':
        return 'bg-red-600 text-white border-red-600 hover:bg-red-700 shadow-sm';
      case 'TESTING':
        return 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
    }
  };

  const getStatusIcon = (s: string) => {
    switch (s) {
      case 'RELEASED':
        return ShieldCheck;
      case 'REJECTED':
        return X;
      case 'TESTING':
        return Loader2;
      default:
        return Clock;
    }
  };

  const Icon = getStatusIcon(status);
  const iconColor = status === 'PENDING' ? 'text-slate-500' : 'text-white';

  if (!isAdmin) {
    return <StatusBadge type="BATCH" status={status} />;
  }

  return (
    <div className="relative inline-block group/select" onClick={(e) => e.stopPropagation()}>
      <div className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${iconColor}`}>
        <Icon size={12} className={status === 'TESTING' ? 'animate-spin' : ''} />
      </div>
      <select
        value={status}
        onChange={(e) => onUpdate(e.target.value, batchId)}
        className={`appearance-none pl-7 pr-6 py-1 rounded text-[10px] font-black uppercase border cursor-pointer outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all ${getStatusColor(status)}`}
      >
        <option value="PENDING">Chờ kiểm</option>
        <option value="TESTING">Đang kiểm</option>
        <option value="RELEASED">Phê duyệt</option>
        <option value="REJECTED">Từ chối</option>
      </select>
      <div className={`absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover/select:opacity-100 transition-opacity ${iconColor}`}>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
};

/**
 * BatchGridItem - Grid view item component for a batch
 */
const BatchGridItem = memo(({ 
  batch, 
  isExpanded, 
  onExpand, 
  onEdit, 
  onDelete, 
  onView, 
  testResults, 
  onUpdateBatchStatus, 
  isAdmin 
}: {
  batch: HydratedBatchWithProduct;
  isExpanded: boolean;
  onExpand: (id: string) => void;
  onEdit: (batch: Batch) => void;
  onDelete: (batch: Batch) => void;
  onView: (batch: Batch) => void;
  testResults: TestResult[];
  onUpdateBatchStatus: (status: string, batchId: string) => void;
  isAdmin: boolean;
}) => {
  // Safety check: Nếu dữ liệu batch bị lỗi/null, không render gì cả để tránh crash
  if (!batch) return null;

  // Logic tính hạn dùng
  const expDate = new Date(batch.expDate || 0);
  const today = new Date();
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isExpired = diffDays < 0;
  const isNearExpiry = diffDays > 0 && diffDays <= 90; // Cảnh báo trước 90 ngày

  // --- LOGIC TÍNH TOÁN TIẾN ĐỘ KIỂM NGHIỆM ---
  const tccs = batch.tccs;
  // Lọc an toàn, bỏ qua các kết quả test bị null/undefined
  const batchResults = testResults ? testResults.filter(r => r && r.batchId === batch.id) : [];

  // Tập hợp các chỉ tiêu đã kiểm (Dựa trên tên và lấy kết quả mới nhất)
  const latestResultsByCriteria = new Map<string, { isPass: boolean; value: unknown }>();
  batchResults.forEach(r => {
    if (Array.isArray(r.results)) {
      r.results.forEach(res => {
        if (res) {
          const existing = latestResultsByCriteria.get(res.criteriaName);
          if (!existing) {
            latestResultsByCriteria.set(res.criteriaName, { isPass: res.isPass, value: res.value });
          }
        }
      });
    }
  });

  // Tập hợp các chỉ tiêu yêu cầu trong TCCS
  const requiredCriteria = tccs
    ? [
        ...(Array.isArray(tccs.mainQualityCriteria) ? tccs.mainQualityCriteria : []),
        ...(Array.isArray(tccs.safetyCriteria) ? tccs.safetyCriteria : []),
      ].filter(c => c && c.name)
    : [];

  // Xây dựng danh sách "đã kiểm" bao gồm cả logic thay thế
  const testedCriteriaNames = new Set<string>();
  const rules = tccs?.alternateRules || [];

  // Thêm các chỉ tiêu đã có kết quả trực tiếp
  Array.from(latestResultsByCriteria.keys()).forEach(c => testedCriteriaNames.add(c));

  // Xử lý logic thay thế để xác định các chỉ tiêu "được coi là đã kiểm"
  rules.forEach(rule => {
    const mainName = rule.main;
    const altName = rule.alt;
    const mainResult = latestResultsByCriteria.get(mainName);

    if (!mainResult) return;

    // FAIL_RETRY: Nếu TC1 đạt -> TC2 được coi là đã kiểm
    if (!rule.type || rule.type === 'FAIL_RETRY') {
      if (mainResult.isPass) {
        testedCriteriaNames.add(altName);
      }
    }
    // CONDITIONAL_CHECK: Nếu TC1 đạt VÀ giá trị <= ngưỡng -> TC2 được coi là đã kiểm
    else if (rule.type === 'CONDITIONAL_CHECK') {
      if (mainResult.isPass && mainResult.value !== undefined && mainResult.value !== '') {
        const threshold = parseFloat(String(rule.conditionValue)) || 0;
        const val = parseFloat(String(mainResult.value)) || 0;

        if (val <= threshold) {
          testedCriteriaNames.add(altName);
        }
      }
    }
  });

  const missingCriteria = requiredCriteria.filter(c => !testedCriteriaNames.has(c.name));
  const progressPercent = requiredCriteria.length > 0
    ? Math.round(((requiredCriteria.length - missingCriteria.length) / requiredCriteria.length) * 100)
    : 0;

  return (
    <DSCard isExpanded={isExpanded} className={`p-6 relative group ${isExpanded ? 'col-span-2' : ''}`}>
      {/* Cảnh báo hạn dùng */}
      {isExpired && (
        <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1">
          <CalendarOff size={10} /> Đã hết hạn
        </div>
      )}
      {isNearExpiry && !isExpired && (
        <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-widest flex items-center gap-1">
          <AlertTriangle size={10} /> Cận date ({diffDays} ngày)
        </div>
      )}

      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-slate-50 rounded-2xl text-indigo-600">
          <Hash size={24} />
        </div>
        <BatchStatusSelect
          status={batch.status}
          batchId={batch.id}
          onUpdate={onUpdateBatchStatus}
          isAdmin={isAdmin}
        />
      </div>
      <h3 className="font-black text-slate-800 text-lg uppercase truncate">Lô: {batch.batchNo}</h3>
      <p className="text-[10px] font-black text-slate-400 uppercase truncate mb-4">{batch.product?.name}</p>

      <div className="space-y-1 mb-4 bg-slate-50 p-2 rounded-lg">
        <div className="flex justify-between items-center text-xs font-medium text-slate-500">
          <span className="uppercase text-[9px] font-bold text-slate-400">NSX:</span>
          <span className="text-slate-700 font-bold">{formatDateStandard(batch.mfgDate)}</span>
        </div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-500">
          <span className="uppercase text-[9px] font-bold text-slate-400">HSD:</span>
          <span className={`${isExpired ? 'text-red-600 font-black' : isNearExpiry ? 'text-amber-600 font-bold' : 'text-slate-700'}`}>
            {formatDateStandard(batch.expDate)}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-500 pt-2 border-t border-slate-200 mt-2">
          <span className="uppercase text-[9px] font-bold text-slate-400">Cỡ lô:</span>
          <span className="text-slate-700 font-bold">{batch.theoreticalYield?.toLocaleString()} {batch.yieldUnit}</span>
        </div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-500">
          <span className="uppercase text-[9px] font-bold text-slate-400">Sản lượng:</span>
          <span className="text-slate-700 font-bold">{batch.actualYield?.toLocaleString()} {batch.yieldUnit}</span>
        </div>
        <div className="flex justify-between items-center text-xs font-medium text-slate-500">
          <span className="uppercase text-[9px] font-bold text-slate-400">Quy cách:</span>
          <span className="text-slate-700 font-bold">{batch.packaging || '---'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => onExpand(batch.id)}
          className="text-[10px] font-black text-indigo-600 uppercase hover:underline flex items-center gap-1"
        >
          <History size={14} /> {isExpanded ? 'Ẩn' : 'Lịch sử'}
        </button>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Link
            to={`/test-results?batchId=${batch.id}`}
            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
            title="Kết quả kiểm nghiệm"
          >
            <ClipboardCheck size={16} />
          </Link>
          <ActionButtons
            onView={() => onView(batch)}
            onEdit={() => onEdit(batch)}
            onDelete={() => onDelete(batch)}
          />
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in">
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
              <FlaskConical size={12} /> Tiến độ kiểm nghiệm ({progressPercent}%)
            </h4>
            <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${progressPercent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            {missingCriteria.length > 0 ? (
              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-700 mb-1 flex items-center gap-1">
                  <ListChecks size={12} /> Còn thiếu {missingCriteria.length} chỉ tiêu:
                </p>
                <div className="flex flex-wrap gap-1">
                  {missingCriteria.map((c, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-white border border-amber-200 text-amber-800 text-[9px] font-bold rounded-md">
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-700">Đã kiểm đủ tất cả chỉ tiêu theo TCCS.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </DSCard>
  );
});

/**
 * BatchListItem - List view item component for a batch
 */
const BatchListItem = memo(({ 
  batch, 
  onEdit, 
  onDelete, 
  onView, 
  onUpdateBatchStatus, 
  isAdmin 
}: {
  batch: HydratedBatchWithProduct;
  onEdit: (b: Batch) => void;
  onDelete: (batch: Batch) => void;
  onView: (batch: Batch) => void;
  onUpdateBatchStatus: (status: string, batchId: string) => void;
  isAdmin: boolean;
}) => {
  // Safety check
  if (!batch) return null;

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 font-black text-slate-800">{batch.batchNo}</td>
      <td className="px-4 py-3">
        <div className="font-bold text-slate-700 text-sm">{batch.product?.name}</div>
        <div className="text-[10px] text-slate-400 uppercase">{batch.product?.code}</div>
        {batch.packaging && <div className="text-[10px] text-slate-500 italic mt-0.5">{batch.packaging}</div>}
      </td>
      <td className="px-4 py-3 text-xs">
        <div className="font-medium text-slate-600">SX: {formatDateStandard(batch.mfgDate)}</div>
        <div className="font-bold text-red-500">HD: {formatDateStandard(batch.expDate)}</div>
      </td>
      <td className="px-4 py-3 text-center text-xs">
        <div className="text-slate-500">
          Cỡ lô: <span className="font-bold">{batch.theoreticalYield?.toLocaleString()}</span>
        </div>
        <div className="text-slate-700">
          Sản lượng: <span className="font-bold">{batch.actualYield?.toLocaleString()}</span>
        </div>
        <div className="text-[9px] text-slate-400">{batch.yieldUnit}</div>
      </td>
      <td className="px-4 py-3 text-center">
        <BatchStatusSelect
          status={batch.status}
          batchId={batch.id}
          onUpdate={onUpdateBatchStatus}
          isAdmin={isAdmin}
        />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
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

/**
 * BatchDataList - Component that renders either grid or list view
 */
const BatchDataList = ({ 
  viewMode, 
  data, 
  expandedId, 
  onExpand, 
  onEdit, 
  onDelete, 
  onView, 
  testResults, 
  onUpdateBatchStatus, 
  isAdmin 
}: {
  viewMode: 'grid' | 'list';
  data: HydratedBatchWithProduct[];
  expandedId: string | null;
  onExpand: (id: string) => void;
  onEdit: (batch: Batch) => void;
  onDelete: (batch: Batch) => void;
  onView: (batch: Batch) => void;
  testResults: TestResult[];
  onUpdateBatchStatus: (status: string, batchId: string) => void;
  isAdmin: boolean;
}) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {data.map((batch) =>
          batch && (
            <BatchGridItem
              key={batch.id}
              batch={batch}
              isExpanded={expandedId === batch.id}
              onExpand={onExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              testResults={testResults}
              onUpdateBatchStatus={onUpdateBatchStatus}
              isAdmin={isAdmin}
            />
          )
        )}
      </div>
    );
  }

  return (
    <DSTable>
      <thead className="bg-slate-50 border-b border-slate-100">
        <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
          <th className="px-4 py-3">Số Lô</th>
          <th className="px-4 py-3">Sản phẩm</th>
          <th className="px-4 py-3">Ngày SX / Hạn dùng</th>
          <th className="px-4 py-3 text-center">Cỡ lô / Sản lượng</th>
          <th className="px-4 py-3 text-center">Trạng thái</th>
          <th className="px-4 py-3 text-right">Thao tác</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {data.map((batch) =>
          batch && (
            <BatchListItem
              key={batch.id}
              batch={batch}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
              onUpdateBatchStatus={onUpdateBatchStatus}
              isAdmin={isAdmin}
            />
          )
        )}
      </tbody>
    </DSTable>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

const BatchList: React.FC = () => {
  // Context hooks
  const { state, addBatch, updateBatch, deleteBatch, updateBatchStatus, isAdmin, notify } = useAppContext();
  const { testResults } = useTestResultContext();
  const { user } = useAuth();

  // Data hooks
  const { batches: hydratedBatches = [] } = useDataGraph() || {};
  
  // Safe access to state arrays with fallbacks
  const products = state?.products || [];
  const tccsList = state?.tccsList || [];
  const batches = state?.batches || [];

  // Loading state check - wait for all critical data contexts to be ready
  const isLoading = !state || !Array.isArray(state.batches) || !Array.isArray(testResults);

  // State declarations
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProductId, setFilterProductId] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: 'createdAt' | 'mfgDate' | 'batchNo'; direction: 'asc' | 'desc' }>({
    key: 'createdAt',
    direction: 'desc',
  });
  const [viewMode, setViewMode] = useLocalStorage<'grid' | 'list'>('batch_view_mode', 'grid');

  // Modal states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportResultModalOpen, setIsImportResultModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [viewBatch, setViewBatch] = useState<Batch | null>(null);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; errors: string[] }>({ count: 0, errors: [] });
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<{ status: string; batchId: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isUpdateTccsModalOpen, setIsUpdateTccsModalOpen] = useState(false);
  const [isUpdatingTccs, setIsUpdatingTccs] = useState(false);

  const itemsPerPage = 12;
  const crud = useCrud<Batch>();

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorModalOpen(true);
  };

  /**
   * Hàm tìm TCCS phù hợp dựa trên ngày sản xuất (mfgDate)
   * Quy tắc: Chọn TCCS có issueDate gần nhất nhưng <= mfgDate
   */
  const findTccsByMfgDate = (productId: string, mfgDate: string | null): TCCS | null => {
    // Debug log - only shows in development
    debug.log(`[findTccsByMfgDate] productId: ${productId}, mfgDate: ${mfgDate}`);
    debug.log(`[findTccsByMfgDate] Tổng số TCCS: ${tccsList.length}`);
    
    // Lọc TCCS của sản phẩm
    const productTccsList = tccsList.filter(t => t.productId === productId);
    debug.log(`[findTccsByMfgDate] TCCS của SP: ${productTccsList.length}`, productTccsList.map(t => ({ id: t.id, code: t.code, issueDate: t.issueDate, isActive: t.isActive })));
    
    if (productTccsList.length === 0) return null;

    // Sort theo issueDate giảm dần (mới nhất trước)
    const sortedTccs = [...productTccsList].sort(
      (a, b) => new Date(b.issueDate || 0).getTime() - new Date(a.issueDate || 0).getTime()
    );

    // Nếu không có ngày SX, lấy TCCS mới nhất
    if (!mfgDate) {
      debug.log(`[findTccsByMfgDate] Không có mfgDate, lấy TCCS mới nhất: ${sortedTccs[0]?.code}`);
      return sortedTccs[0];
    }

    const mfgTime = new Date(mfgDate || 0).getTime();
    debug.log(`[findTccsByMfgDate] mfgTime: ${mfgTime}, ngày: ${new Date(mfgTime).toLocaleDateString()}`);

    // Tìm TCCS có issueDate <= mfgDate
    const match = sortedTccs.find(t => new Date(t.issueDate || 0).getTime() <= mfgTime);

    if (match) {
      debug.log(`[findTccsByMfgDate] Tìm thấy TCCS phù hợp: ${match.code}, issueDate: ${match.issueDate}`);
      return match;
    }

    // Fallback: Lấy TCCS cũ nhất nếu không có TCCS nào phù hợp
    debug.log(`[findTccsByMfgDate] Không tìm thấy TCCS phù hợp, lấy TCCS cũ nhất: ${sortedTccs[sortedTccs.length - 1]?.code}`);
    return sortedTccs[sortedTccs.length - 1];
  };

  // ============================================
  // MEMOIZED VALUES
  // ============================================

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    hydratedBatches.forEach(b => {
      if (b?.mfgDate) {
        years.add(new Date(b.mfgDate).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [hydratedBatches]);

  const filteredBatches = useMemo(() => {
    return hydratedBatches
      .filter(b => {
        // Safety check: Bỏ qua các phần tử undefined/null trong mảng
        if (!b) return false;
        
        const matchesSearch =
          (b.batchNo || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (b.product?.name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase());
        const matchesProduct = filterProductId === '' || b.productId === filterProductId;
        const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;

        let matchesTime = true;
        if (isAdvancedFilterOpen) {
          // Lọc theo khoảng thời gian cụ thể (Ngày SX)
          if (dateRange.from && (!b.mfgDate || b.mfgDate < dateRange.from)) matchesTime = false;
          if (dateRange.to && (!b.mfgDate || b.mfgDate > dateRange.to)) matchesTime = false;
        } else {
          // Lọc theo Năm/Tháng (Cơ bản)
          const mfgDate = new Date(b.mfgDate || 0);
          const matchesYear = filterYear === 'ALL' || mfgDate.getFullYear().toString() === filterYear;
          const matchesMonth = filterMonth === 'ALL' || (mfgDate.getMonth() + 1).toString() === filterMonth;
          matchesTime = matchesYear && matchesMonth;
        }

        return matchesSearch && matchesProduct && matchesStatus && matchesTime;
      })
      .sort((a, b) => {
        // Safety check khi sort
        if (!a || !b) return 0;
        if (sortConfig.key === 'batchNo') {
          return sortConfig.direction === 'asc'
            ? (a.batchNo || '').localeCompare(b.batchNo || '')
            : (b.batchNo || '').localeCompare(a.batchNo || '');
        } else if (sortConfig.key === 'mfgDate') {
          const dateA = new Date(a.mfgDate || 0).getTime();
          const dateB = new Date(b.mfgDate || 0).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        } else {
          // Default createdAt
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
      });
  }, [
    hydratedBatches,
    debouncedSearchTerm,
    filterProductId,
    filterStatus,
    filterMonth,
    filterYear,
    sortConfig,
    isAdvancedFilterOpen,
    dateRange,
  ]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterProductId, filterStatus, filterMonth, filterYear, sortConfig, isAdvancedFilterOpen, dateRange]);

  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const currentBatches = filteredBatches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleAddBatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!selectedProductId) {
      notify({ type: 'WARNING', message: 'Vui lòng chọn một sản phẩm!' });
      return;
    }
    
    const pid = selectedProductId;
    const mfgDateValue = formData.get('mfgDate') as string;

    // Lọc TCCS active của sản phẩm
    const tccs = findTccsByMfgDate(pid, mfgDateValue);
    if (!tccs) {
      return notify({ type: 'WARNING', title: 'Thiếu TCCS', message: 'Sản phẩm được chọn chưa có TCCS hiệu lực. Vui lòng lập TCCS trước.' });
    }

    const batchNo = (formData.get('batchNo') as string).toUpperCase();

    // Kiểm tra trùng số lô (1 số lô chỉ xuất hiện 1 lần cho 1 sản phẩm)
    if (batches.some(b => b.batchNo === batchNo && b.productId === pid)) {
      return notify({ type: 'WARNING', title: 'Trùng lặp', message: `Số lô "${batchNo}" đã tồn tại cho sản phẩm này.` });
    }

    const batchData = {
      productId: pid,
      tccsId: tccs.id,
      batchNo: batchNo,
      mfgDate: formData.get('mfgDate') as string,
      expDate: formData.get('expDate') as string,
      theoreticalYield: parseFloat(formData.get('theoreticalYield') as string) || 0,
      actualYield: parseFloat(formData.get('actualYield') as string) || 0,
      yieldUnit: formData.get('yieldUnit') as string,
      packaging: formData.get('packaging') as string,
    };

    setIsSubmitting(true);
    try {
      await addBatch({
        id: generateId('batch'),
        ...batchData,
        status: BATCH_STATUS.PENDING,
        createdAt: new Date().toISOString(),
      });

      logAuditAction({
        action: AuditAction.CREATE,
        collection: 'BATCHES',
        details: `Tạo lô mới: ${batchData.batchNo}`,
        performedBy: user?.email || 'unknown',
      });

      crud.close();
      notify({ type: 'SUCCESS', title: 'Thành công', message: `Đã tạo lô ${batchData.batchNo}` });
      setSelectedProductId('');
      setProductSearch('');
    } catch (error) {
      debug.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!crud.selectedItem) return;
    
    const formData = new FormData(e.currentTarget);

    // Nếu không chọn lại sản phẩm thì dùng ID cũ
    const pid = selectedProductId || crud.selectedItem.productId;
    const mfgDateValue = formData.get('mfgDate') as string;

    // Lọc TCCS active của sản phẩm và sử dụng hàm tiện ích
    const tccs = findTccsByMfgDate(pid, mfgDateValue || null);
    if (!tccs) {
      return notify({ type: 'WARNING', title: 'Thiếu TCCS', message: 'Sản phẩm được chọn chưa có TCCS hiệu lực.' });
    }

    const batchNo = (formData.get('batchNo') as string).toUpperCase();

    // Kiểm tra trùng số lô (trừ chính nó khi cập nhật)
    if (batches.some(b => b.batchNo === batchNo && b.productId === pid && b.id !== crud.selectedItem.id)) {
      return notify({ type: 'WARNING', title: 'Trùng lặp', message: `Số lô "${batchNo}" đã tồn tại cho sản phẩm này.` });
    }

    const batchData = {
      productId: pid,
      tccsId: tccs.id,
      batchNo: batchNo,
      mfgDate: formData.get('mfgDate') as string,
      expDate: formData.get('expDate') as string,
      theoreticalYield: parseFloat(formData.get('theoreticalYield') as string) || 0,
      actualYield: parseFloat(formData.get('actualYield') as string) || 0,
      yieldUnit: formData.get('yieldUnit') as string,
      packaging: formData.get('packaging') as string,
    };

    // Loại bỏ các trường hydrated (product, tccsData) trước khi lưu
    const { product, tccsData, ...cleanBatch } = crud.selectedItem as unknown as {
      product?: unknown;
      tccsData?: unknown;
      [key: string]: unknown;
    };

    setIsSubmitting(true);
    try {
      await updateBatch({
        id: crud.selectedItem.id,
        ...cleanBatch,
        ...batchData,
        status: crud.selectedItem.status,
        createdAt: crud.selectedItem.createdAt,
        updatedAt: new Date().toISOString(),
      });

      logAuditAction({
        action: AuditAction.UPDATE,
        collection: 'BATCHES',
        documentId: crud.selectedItem.id,
        details: `Cập nhật lô: ${batchData.batchNo}`,
        performedBy: user?.email || 'unknown',
      });

      crud.close();
      notify({ type: 'SUCCESS', title: 'Đã cập nhật', message: `Cập nhật thành công lô ${batchData.batchNo}` });
      setSelectedProductId('');
      setProductSearch('');
    } catch (error) {
      debug.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkImport = async () => {
    if (!importText.trim()) return;
    
    const lines = importText.trim().split('\n');
    let count = 0;
    const errors: string[] = [];
    const processedBatchNos = new Set<string>(); // Theo dõi các lô đã xử lý trong lần nhập này
    setIsSubmitting(true);

    try {
      for (const line of lines) {
        // Format: Mã SP | Số Lô | Ngày SX | Hạn dùng | SL Lý thuyết | SL Thực tế | Đơn vị
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        const pCode = parts[0]?.trim().toUpperCase();
        const batchNo = parts[1]?.trim().toUpperCase();

        if (!pCode || !batchNo) continue;

        const product = products.find(p => p.code === pCode);
        if (!product) {
          errors.push(`Không tìm thấy sản phẩm mã "${pCode}" cho lô ${batchNo}`);
          continue;
        }

        // Tìm TCCS phù hợp với ngày sản xuất của lô
        const batchMfgDate = parseDateToISO(parts[2]);
        const tccs = findTccsByMfgDate(product.id, batchMfgDate);

        if (!tccs) {
          errors.push(`Sản phẩm "${pCode}" chưa có TCCS phù hợp với ngày SX ${parts[2]} để gán cho lô ${batchNo}`);
          continue;
        }

        const compositeKey = `${product.id}-${batchNo}`;
        
        // Kiểm tra trùng trong DB hoặc trùng trong chính file đang nhập
        if (batches.some(b => b.batchNo === batchNo && b.productId === product.id) || processedBatchNos.has(compositeKey)) {
          errors.push(`Lô "${batchNo}" của sản phẩm "${pCode}" đã tồn tại (hoặc bị trùng lặp)`);
          continue;
        }

        await addBatch({
          id: generateId('batch'),
          productId: product.id,
          tccsId: tccs.id,
          batchNo: batchNo,
          mfgDate: parseDateToISO(parts[2]),
          expDate: parseDateToISO(parts[3]),
          theoreticalYield: parseFloat(parts[4]?.trim()) || 0,
          actualYield: parseFloat(parts[5]?.trim()) || 0,
          yieldUnit: parts[6]?.trim() || 'Hộp',
          packaging: parts[7]?.trim() || '',
          status: BATCH_STATUS.PENDING,
          createdAt: new Date().toISOString(),
        });
        processedBatchNos.add(compositeKey);
        count++;
      }

      if (count > 0) {
        logAuditAction({
          action: AuditAction.IMPORT,
          collection: 'BATCHES',
          details: `Nhập khẩu ${count} lô hàng từ Excel`,
          performedBy: user?.email || 'unknown',
        });
      }

      notify({ type: 'SUCCESS', title: 'Nhập liệu hoàn tất', message: `Đã nhập thành công ${count} lô hàng.` });
      setImportResult({ count, errors });
      setIsImportResultModalOpen(true);
      setIsImportModalOpen(false); // Chỉ đóng form khi chạy hết vòng lặp thành công
      setImportText('');
    } catch (e) {
      debug.error('Lỗi nhập liệu:', e);
      // Không đóng form, giữ nguyên để user sửa
    } finally {
      setIsSubmitting(false); // Luôn tắt loading
    }
  };

  const handleFileRead = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setImportText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAutoCalculateYield = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const form = e.target.form;
    if (form && !isNaN(val)) {
      const actualInput = form.elements.namedItem('actualYield') as HTMLInputElement;
      if (actualInput) {
        // Tự động tính 98% (làm tròn)
        actualInput.value = Math.round(val * 0.98).toString();
      }
    }
  };

  const handleEditClick = useCallback(
    (batch: Batch) => {
      crud.openEdit(batch);
      setSelectedProductId(batch.productId);
      const p = products.find(prod => prod.id === batch.productId);
      setProductSearch(p ? `${p.code} - ${p.name}` : '');
    },
    [products]
  );

  const handleViewClick = useCallback((batch: Batch) => {
    setViewBatch(batch);
  }, []);

  const handleDeleteClick = useCallback((batch: Batch) => {
    crud.openDelete(batch);
  }, []);

  const handleExpandClick = useCallback((id: string) => {
    setExpandedBatchId(prevId => (prevId === id ? null : id));
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (crud.selectedItem) {
      try {
        await deleteBatch(crud.selectedItem.id);
        // Đóng modal ngay khi xóa thành công
        crud.close();
        notify({ type: 'SUCCESS', title: 'Đã xóa', message: `Đã xóa lô ${crud.selectedItem?.batchNo}` });

        // Ghi log an toàn
        try {
          logAuditAction({
            action: AuditAction.DELETE,
            collection: 'BATCHES',
            documentId: crud.selectedItem?.id || '',
            details: `Xóa lô ID: ${crud.selectedItem?.id}`,
            performedBy: user?.email || 'unknown',
          });
        } catch (logErr) {
          debug.warn('Ghi log thất bại:', logErr);
        }
      } catch (error) {
        debug.error('Failed to delete batch:', error);
        // Không đóng modal để người dùng biết có lỗi
      }
    } else {
      crud.close();
    }
  }, [crud.selectedItem, deleteBatch, user, notify]);

  const handleUpdateBatchStatusClick = (newStatus: string, batchId: string) => {
    setRejectReason('');
    setPendingStatusUpdate({ status: newStatus, batchId });
    setIsStatusConfirmOpen(true);
  };

  const confirmBatchStatusUpdate = async () => {
    if (!pendingStatusUpdate) return;
    try {
      await updateBatchStatus(pendingStatusUpdate.batchId, pendingStatusUpdate.status, rejectReason);
      notify({
        type: 'SUCCESS',
        title: 'Cập nhật trạng thái',
        message: `Đã chuyển trạng thái lô sang: ${pendingStatusUpdate.status}`,
      });
    } catch (error) {
      debug.error('Lỗi cập nhật trạng thái:', error);
      notify({ type: 'ERROR', message: 'Không thể cập nhật trạng thái lô.' });
    } finally {
      setIsStatusConfirmOpen(false);
      setPendingStatusUpdate(null);
    }
  };

  /**
   * Cập nhật TCCS cho tất cả các lô dựa trên ngày sản xuất
   */
  const handleUpdateAllBatchTccs = async () => {
    setIsUpdatingTccs(true);
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      for (const batch of batches) {
        if (!batch.productId || !batch.mfgDate) {
          skippedCount++;
          continue;
        }

        const correctTccs = findTccsByMfgDate(batch.productId, batch.mfgDate);
        
        if (!correctTccs) {
          errors.push(`Lô ${batch.batchNo}: Không tìm thấy TCCS phù hợp`);
          errorCount++;
          continue;
        }

        // Debug: Log giá trị để kiểm tra
        debug.log(`Lô ${batch.batchNo}: tccsId hiện tại = ${batch.tccsId}, TCCS đúng = ${correctTccs.id}`);

        // Chỉ cập nhật nếu TCCS khác với hiện tại (bao gồm cả trường hợp batch.tccsId undefined)
        const needsUpdate = !batch.tccsId || batch.tccsId !== correctTccs.id;
        
        if (needsUpdate) {
          try {
            await updateBatch({
              id: batch.id,
              tccsId: correctTccs.id,
              productId: batch.productId,
              batchNo: batch.batchNo,
              mfgDate: batch.mfgDate,
              expDate: batch.expDate,
              theoreticalYield: batch.theoreticalYield,
              actualYield: batch.actualYield,
              yieldUnit: batch.yieldUnit,
              packaging: batch.packaging,
              status: batch.status,
              createdAt: batch.createdAt,
              updatedAt: new Date().toISOString(),
            });
            debug.log(`Đã cập nhật lô ${batch.batchNo} từ ${batch.tccsId} -> ${correctTccs.id}`);
            updatedCount++;
          } catch (err) {
            debug.error(`Lỗi cập nhật lô ${batch.batchNo}:`, err);
            errorCount++;
          }
        } else {
          skippedCount++;
        }
      }

      debug.log(`Kết quả: Cập nhật ${updatedCount}, Bỏ qua ${skippedCount}, Lỗi ${errorCount}`);

      if (updatedCount > 0) {
        logAuditAction({
          action: AuditAction.UPDATE,
          collection: 'BATCHES',
          details: `Cập nhật TCCS hàng loạt cho ${updatedCount} lô`,
          performedBy: user?.email || 'unknown',
        });
      }

      notify({
        type: updatedCount > 0 ? 'SUCCESS' : 'INFO',
        title: 'Cập nhật TCCS',
        message: updatedCount > 0 
          ? `Đã cập nhật TCCS cho ${updatedCount} lô. ${errorCount > 0 ? `Có ${errorCount} lỗi.` : ''}`
          : `Tất cả ${batches.length} lô đã có TCCS đúng theo ngày SX.`,
      });

      setIsUpdateTccsModalOpen(false);
    } catch (error) {
      debug.error('Lỗi cập nhật TCCS hàng loạt:', error);
      notify({ type: 'ERROR', message: 'Có lỗi xảy ra khi cập nhật TCCS.' });
    } finally {
      setIsUpdatingTccs(false);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Loading state - show skeleton while data is loading */}
      {isLoading ? (
        <div className="space-y-6 animate-pulse">
          <div className="h-20 bg-slate-100 rounded-2xl" />
          <div className="h-12 bg-slate-100 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <PageHeader
            title="Quản lý Lô & Tồn kho"
            subtitle="Quản lý dòng đời sản phẩm."
            icon={Layers}
            action={
              <div className="flex gap-3">
                <button
                  onClick={() => setIsUpdateTccsModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl hover:bg-amber-100 font-black uppercase text-[10px] transition-all shadow-sm"
                  title="Cập nhật TCCS cho các lô cũ theo ngày SX"
                >
                  <RefreshCw size={16} /> Cập nhật TCCS
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-black uppercase text-[10px] transition-all shadow-sm"
                >
                  <Upload size={16} /> Nhập Excel
                </button>
                <AddButton
                  onClick={() => {
                    setSelectedProductId('');
                    setProductSearch('');
                    crud.openAdd();
                  }}
                  label="Đăng ký Lô mới"
                />
              </div>
            }
          />

          <DSFilterBar>
            <DSSearchInput
              placeholder="Tìm số lô..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            {!isAdvancedFilterOpen && (
              <>
                <DSSelect
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="w-32"
                >
                  <option value="ALL">Tất cả năm</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      Năm {year}
                    </option>
                  ))}
                </DSSelect>
                <DSSelect
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="w-32"
                >
                  <option value="ALL">Tất cả tháng</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                    <option key={month} value={month}>
                      Tháng {month}
                    </option>
                  ))}
                </DSSelect>
              </>
            )}
            <DSSelect
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-32"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value={BATCH_STATUS.PENDING}>Kế hoạch</option>
              <option value={BATCH_STATUS.TESTING}>Đang kiểm</option>
              <option value={BATCH_STATUS.RELEASED}>Phê duyệt</option>
              <option value={BATCH_STATUS.REJECTED}>Loại bỏ</option>
            </DSSelect>
            <DSSelect
              icon={ArrowUpDown}
              value={`${sortConfig.key}-${sortConfig.direction}`}
              onChange={(e) => {
                const [key, direction] = e.target.value.split('-');
                setSortConfig({ key: key as 'createdAt' | 'mfgDate' | 'batchNo', direction: direction as 'asc' | 'desc' });
              }}
              className="w-32"
            >
              <option value="createdAt-desc">Mới tạo nhất</option>
              <option value="mfgDate-desc">Ngày SX (Mới)</option>
              <option value="mfgDate-asc">Ngày SX (Cũ)</option>
              <option value="batchNo-asc">Số lô (A-Z)</option>
              <option value="batchNo-desc">Số lô (Z-A)</option>
            </DSSelect>

            <button
              onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
              className={`p-2 rounded-lg border transition-colors ${
                isAdvancedFilterOpen ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
              title="Lọc nâng cao"
            >
              <Filter size={20} />
            </button>

            <DSViewToggle
              viewMode={viewMode}
              setViewMode={setViewMode}
              gridIcon={LayoutGrid}
              listIcon={List}
            />
          </DSFilterBar>

          {isAdvancedFilterOpen && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 animate-in slide-in-from-top-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <CalendarRange size={12} /> Từ ngày (SX)
                </label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={e => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <CalendarRange size={12} /> Đến ngày (SX)
                </label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={e => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Sản phẩm cụ thể</label>
                  <button
                    onClick={() => {
                      setDateRange({ from: '', to: '' });
                      setFilterProductId('');
                      setFilterStatus('ALL');
                    }}
                    className="text-[10px] font-bold text-red-500 hover:underline flex items-center gap-1"
                  >
                    <X size={10} /> Xóa bộ lọc
                  </button>
                </div>
                <select
                  value={filterProductId}
                  onChange={e => setFilterProductId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Tất cả sản phẩm --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} - {p.code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <BatchDataList
            viewMode={viewMode}
            data={currentBatches}
            expandedId={expandedBatchId}
            onExpand={handleExpandClick}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onView={handleViewClick}
            testResults={testResults}
            onUpdateBatchStatus={handleUpdateBatchStatusClick}
            isAdmin={isAdmin}
          />

          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

          {/* Modal Thêm Mới */}
          <Modal isOpen={crud.mode === 'ADD'} onClose={crud.close} title="Đăng ký Lô Sản xuất" icon={Plus}>
            <form onSubmit={handleAddBatch} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  value={productSearch}
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                    if (!e.target.value) setSelectedProductId('');
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  placeholder="Tìm kiếm sản phẩm..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl font-bold outline-none shadow-inner text-sm focus:ring-2 focus:ring-indigo-500"
                />
                {selectedProductId && (
                  <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600" size={16} />
                )}

                {showProductDropdown && (
                  <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto">
                    {products
                      .filter(
                        p =>
                          !productSearch ||
                          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          p.code.toLowerCase().includes(productSearch.toLowerCase())
                      )
                      .map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setProductSearch(`${p.code} - ${p.name}`);
                            setShowProductDropdown(false);
                          }}
                          className={`px-4 py-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors ${
                            selectedProductId === p.id ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <p className="text-sm font-bold text-slate-700">{p.name}</p>
                          <p className="text-[10px] font-black text-slate-400 uppercase">{p.code}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>
              <DSFormInput name="batchNo" required placeholder="Số Lô" className="uppercase" />
              <div className="grid grid-cols-2 gap-4">
                <DSFormInput type="date" name="mfgDate" />
                <DSFormInput type="date" name="expDate" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DSFormInput type="number" name="theoreticalYield" placeholder="Cỡ lô" onChange={handleAutoCalculateYield} />
                <DSFormInput type="number" name="actualYield" placeholder="Sản lượng" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DSFormInput name="yieldUnit" placeholder="Đơn vị tính" />
                <DSFormInput name="packaging" placeholder="Quy cách đóng gói" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs disabled:opacity-70 flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Xác nhận
                </button>
              </div>
            </form>
          </Modal>

          {/* Modal Cập Nhật */}
          <Modal isOpen={crud.mode === 'EDIT'} onClose={crud.close} title="Cập nhật thông tin Lô" icon={Edit2}>
            {crud.selectedItem && (
              <form onSubmit={handleUpdateBatch} className="space-y-4">
                <div className="relative">
                  <div className="w-full px-4 py-3 bg-slate-100 border rounded-xl font-bold text-slate-500 flex justify-between items-center">
                    <span>{productSearch}</span>
                    <span className="text-[10px] uppercase bg-slate-200 px-2 py-1 rounded">Không thể đổi SP</span>
                  </div>
                </div>
                <DSFormInput label="Số Lô" name="batchNo" defaultValue={crud.selectedItem.batchNo} required className="uppercase" />
                <div className="grid grid-cols-2 gap-4">
                  <DSFormInput label="Ngày SX" type="date" name="mfgDate" defaultValue={toInputDate(crud.selectedItem.mfgDate)} />
                  <DSFormInput label="Hạn dùng" type="date" name="expDate" defaultValue={toInputDate(crud.selectedItem.expDate)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DSFormInput type="number" name="theoreticalYield" defaultValue={crud.selectedItem.theoreticalYield} placeholder="Cỡ lô" onChange={handleAutoCalculateYield} />
                  <DSFormInput type="number" name="actualYield" defaultValue={crud.selectedItem.actualYield} placeholder="Sản lượng" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <DSFormInput name="yieldUnit" defaultValue={crud.selectedItem.yieldUnit} placeholder="Đơn vị tính" />
                  <DSFormInput name="packaging" defaultValue={crud.selectedItem.packaging} placeholder="Quy cách đóng gói" />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={crud.close} className="px-6 py-3 text-slate-400 font-black uppercase text-xs">
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black uppercase text-xs disabled:opacity-70 flex items-center gap-2"
                  >
                    {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                    Cập nhật
                  </button>
                </div>
              </form>
            )}
          </Modal>

          {/* Modal Nhập Excel */}
          <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title="Nhập dữ liệu hàng loạt" icon={FileSpreadsheet} color="bg-indigo-600">
            <div className="space-y-6">
              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                <h4 className="flex items-center gap-2 text-indigo-700 font-black text-[10px] uppercase tracking-widest mb-4">
                  <Info size={16} /> Hướng dẫn xếp cột (Excel/Google Sheets)
                </h4>
                <p className="text-xs text-indigo-600 mb-4 leading-relaxed">
                  Bạn có thể copy trực tiếp các vùng dữ liệu từ Excel và dán vào ô bên dưới.
                  Hệ thống sẽ tự nhận diện theo thứ tự các cột như sau:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    '1. Mã Sản phẩm (Bắt buộc - Phải tồn tại)',
                    '2. Số Lô (Bắt buộc)',
                    '3. Ngày SX (YYYY-MM-DD)',
                    '4. Hạn dùng (YYYY-MM-DD)',
                    '5. Cỡ lô (Số)',
                    '6. Sản lượng (Số)',
                    '7. Đơn vị tính',
                    '8. Quy cách đóng gói',
                  ].map((txt, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[10px] font-bold text-indigo-800 bg-white/50 px-3 py-1.5 rounded-xl border border-indigo-100/50">
                      <CheckCircle2 size={12} className="text-indigo-400" /> {txt}
                    </div>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t border-indigo-200/50">
                  <p className="text-[9px] font-black text-indigo-400 uppercase mb-2">Ví dụ dữ liệu chuẩn:</p>
                  <code className="block p-3 bg-white rounded-xl text-[10px] text-slate-600 font-mono shadow-inner border border-indigo-100">
                    VB-001, B010124, 2024-01-01, 2027-01-01, 5000, 4950, Hộp, Hộp 20 ống
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleFileRead}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors">
                    <FileUp size={16} /> Tải lên file CSV/TXT
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 italic">Hỗ trợ file văn bản (.txt, .csv) ngăn cách bởi dấu phẩy hoặc tab.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Dán dữ liệu vào đây</label>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  rows={8}
                  className="w-full p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] font-mono text-xs focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  placeholder="Copy từ Excel và dán tại đây..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setIsImportModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-xs">
                  Hủy
                </button>
                <button
                  onClick={handleBulkImport}
                  disabled={!importText.trim() || isSubmitting}
                  className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs shadow-xl shadow-indigo-100 disabled:opacity-30 disabled:shadow-none flex items-center gap-2"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Tiến hành nhập
                </button>
              </div>
            </div>
          </Modal>

          {/* Modal Xác nhận xóa */}
          <DeleteModal
            isOpen={crud.mode === 'DELETE'}
            onClose={crud.close}
            onConfirm={handleConfirmDelete}
            itemName={crud.selectedItem?.batchNo}
            warningMessage="Tất cả kết quả kiểm nghiệm liên quan cũng sẽ bị xóa. Hành động này không thể hoàn tác."
          />

          {/* Modal Kết quả Nhập Excel */}
          <Modal isOpen={isImportResultModalOpen} onClose={() => setIsImportResultModalOpen(false)} title="Kết quả nhập hàng loạt" icon={Info}>
            <div>
              <p>Đã nhập thành công {importResult.count} lô hàng.</p>
              {importResult.errors.length > 0 && (
                <div className="mt-4">
                  <p className="font-bold">Lỗi:</p>
                  <ul className="list-disc list-inside max-h-40 overflow-y-auto bg-slate-50 p-2 rounded-lg">
                    {importResult.errors.map((error, index) => (
                      <li key={index} className="text-red-600 text-xs">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end pt-4">
                <button type="button" onClick={() => setIsImportResultModalOpen(false)} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs">
                  Đóng
                </button>
              </div>
            </div>
          </Modal>

          {/* Modal Lỗi */}
          <Modal isOpen={errorModalOpen} onClose={() => setErrorModalOpen(false)} title="Lỗi" icon={AlertTriangle}>
            <div>
              <p>{errorMessage}</p>
              <div className="flex justify-end pt-4">
                <button type="button" onClick={() => setErrorModalOpen(false)} className="px-10 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-xs">
                  Đóng
                </button>
              </div>
            </div>
          </Modal>

          {/* Modal Xác nhận chuyển trạng thái */}
          <ConfirmationModal
            isOpen={isStatusConfirmOpen}
            onClose={() => setIsStatusConfirmOpen(false)}
            onConfirm={confirmBatchStatusUpdate}
            title="Xác nhận chuyển trạng thái"
            message={
              <div className="space-y-3">
                <p>
                  Bạn có chắc chắn muốn chuyển trạng thái lô hàng sang{' '}
                  <strong className="text-indigo-600">
                    {pendingStatusUpdate?.status === 'RELEASED' ? 'PHÊ DUYỆT' : pendingStatusUpdate?.status === 'REJECTED' ? 'TỪ CHỐI' : pendingStatusUpdate?.status}
                  </strong>{' '}
                  không?
                </p>
                {pendingStatusUpdate?.status === 'REJECTED' && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Lý do từ chối:</label>
                    <textarea
                      className="w-full border rounded-xl p-3 text-xs bg-slate-50 focus:ring-2 focus:ring-indigo-100 outline-none"
                      placeholder="Nhập lý do từ chối..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            }
            confirmText="Đồng ý"
            icon={ShieldCheck}
          />

          {/* Modal Xác nhận cập nhật TCCS hàng loạt */}
          <ConfirmationModal
            isOpen={isUpdateTccsModalOpen}
            onClose={() => setIsUpdateTccsModalOpen(false)}
            onConfirm={handleUpdateAllBatchTccs}
            title="Cập nhật TCCS hàng loạt"
            message={
              <div className="space-y-3">
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={24} className="text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-bold text-amber-800">Cảnh báo quan trọng!</p>
                      <p className="text-amber-700 mt-1">
                        Hệ thống sẽ cập nhật TCCS cho <strong>tất cả các lô</strong> dựa trên ngày sản xuất.
                      </p>
                      <ul className="text-xs text-amber-700 mt-2 list-disc list-inside">
                        <li>Lô sẽ được gán TCCS có ngày ban hành gần nhất nhưng trước hoặc bằng ngày SX</li>
                        <li>Chỉ các lô có TCCS không khớp mới được cập nhật</li>
                        <li>Hành động này có thể ảnh hưởng đến tiến độ kiểm nghiệm</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-slate-600">
                  Bạn có muốn tiếp tục không?
                </p>
              </div>
            }
            confirmText={isUpdatingTccs ? "Đang cập nhật..." : "Xác nhận cập nhật"}
            icon={RefreshCw}
          />

          {/* Modal Xem Chi Tiết Lô */}
          <Modal
            isOpen={!!viewBatch}
            onClose={() => setViewBatch(null)}
            title="Tổng hợp Hồ sơ Lô"
            icon={Eye}
            color="bg-blue-600"
          >
            {viewBatch && (
              <BatchDetailContent
                viewBatch={viewBatch} 
                testResults={testResults} 
                findTccsByMfgDate={findTccsByMfgDate}
                setViewBatch={setViewBatch}
                hydratedBatches={hydratedBatches}
                tccsList={tccsList}
              />
            )}
          </Modal>
        </>
      )}
    </div>
  );
};

export default BatchList;
