/**
 * PQM V4 Platform - CAPA Tracker View
 * Quản lý tập trung toàn bộ danh mục Hành động Khắc phục / Phòng ngừa (CAPA Action Items)
 */

import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, Clock, AlertTriangle, Filter, Search, 
  User, Calendar, ArrowRight, ShieldCheck, CheckSquare, Square
} from 'lucide-react';
import { QualityDeviation, CAPAActionItem } from '../../../types/deviation';
import { formatDateStandard } from '../../../utils';

interface FlatCAPAItem extends CAPAActionItem {
  deviationId: string;
  deviationNo: string;
  deviationTitle: string;
  deviationSeverity: string;
  batchNo?: string;
  productName?: string;
}

interface CAPATrackerViewProps {
  deviations: QualityDeviation[];
  onCompleteItem: (deviationId: string, capaId: string) => Promise<void>;
  onSelectDeviation: (deviation: QualityDeviation) => void;
}

export const CAPATrackerView: React.FC<CAPATrackerViewProps> = ({
  deviations,
  onCompleteItem,
  onSelectDeviation
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'COMPLETED'>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const nowStr = new Date().toISOString().split('T')[0];

  // Thu gom toàn bộ CAPA Items kèm thông tin sai lệch cha
  const allItems: FlatCAPAItem[] = useMemo(() => {
    const list: FlatCAPAItem[] = [];
    deviations.forEach(d => {
      (d.capaItems || []).forEach(item => {
        list.push({
          ...item,
          deviationId: d.id,
          deviationNo: d.deviationNo,
          deviationTitle: d.title,
          deviationSeverity: d.severity,
          batchNo: d.batchNo,
          productName: d.productName
        });
      });
    });
    return list;
  }, [deviations]);

  // Bộ lọc
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      // 1. Filter theo status
      const isCompleted = item.status === 'COMPLETED' || item.status === 'VERIFIED';
      const isOverdue = !isCompleted && item.deadline && item.deadline < nowStr;

      if (statusFilter === 'PENDING' && isCompleted) return false;
      if (statusFilter === 'COMPLETED' && !isCompleted) return false;
      if (statusFilter === 'OVERDUE' && !isOverdue) return false;

      // 2. Filter theo type
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchAction = item.action.toLowerCase().includes(q);
        const matchResp = item.responsible.toLowerCase().includes(q);
        const matchDev = item.deviationNo.toLowerCase().includes(q) || item.deviationTitle.toLowerCase().includes(q);
        const matchBatch = item.batchNo?.toLowerCase().includes(q);
        if (!matchAction && !matchResp && !matchDev && !matchBatch) return false;
      }

      return true;
    });
  }, [allItems, statusFilter, typeFilter, searchQuery, nowStr]);

  const typeConfig: Record<string, { label: string; badge: string }> = {
    CORRECTIVE: { label: 'Khắc phục', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200' },
    PREVENTIVE: { label: 'Phòng ngừa', badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200' },
    IMMEDIATE: { label: 'Tức thời', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200' }
  };

  return (
    <div className="space-y-4">
      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo nội dung CAPA, người phụ trách, mã sai lệch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-300' : 'text-slate-500'}`}
            >
              Tất cả ({allItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'PENDING' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-300' : 'text-slate-500'}`}
            >
              Đang thực hiện
            </button>
            <button
              onClick={() => setStatusFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'OVERDUE' ? 'bg-white dark:bg-slate-700 shadow-sm text-rose-600 dark:text-rose-300' : 'text-slate-500'}`}
            >
              Quá hạn
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'COMPLETED' ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-300' : 'text-slate-500'}`}
            >
              Đã hoàn thành
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none text-slate-700 dark:text-slate-200"
          >
            <option value="ALL">Tất cả loại hành động</option>
            <option value="CORRECTIVE">Khắc phục (Corrective)</option>
            <option value="PREVENTIVE">Phòng ngừa (Preventive)</option>
            <option value="IMMEDIATE">Xử lý tức thời (Immediate)</option>
          </select>
        </div>
      </div>

      {/* Danh sách CAPA Items */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-black">
                <th className="p-4 w-12 text-center">Xác nhận</th>
                <th className="p-4 min-w-[280px]">Nội dung Hành động CAPA</th>
                <th className="p-4 w-32">Phân loại</th>
                <th className="p-4 min-w-[180px]">Hồ sơ Sai lệch liên đới</th>
                <th className="p-4 w-36">Người phụ trách</th>
                <th className="p-4 w-32">Hạn chót</th>
                <th className="p-4 w-32 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-medium">
                    Không có hành động CAPA nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const isCompleted = item.status === 'COMPLETED' || item.status === 'VERIFIED';
                  const isOverdue = !isCompleted && item.deadline && item.deadline < nowStr;
                  const parentDeviation = deviations.find(d => d.id === item.deviationId);

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isOverdue ? 'bg-rose-50/20 dark:bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          disabled={isCompleted}
                          onClick={() => onCompleteItem(item.deviationId, item.id)}
                          className={`p-1 rounded-lg transition-all ${
                            isCompleted 
                              ? 'text-emerald-500 cursor-default' 
                              : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={isCompleted ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành CAPA'}
                        >
                          {isCompleted ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>

                      <td className="p-4">
                        <p className={`font-bold text-slate-800 dark:text-slate-100 ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                          {item.action}
                        </p>
                        {item.verificationMethod && (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                            Phương pháp thẩm tra: {item.verificationMethod}
                          </p>
                        )}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${
                          typeConfig[item.type]?.badge || 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {typeConfig[item.type]?.label || item.type}
                        </span>
                      </td>

                      <td className="p-4">
                        {parentDeviation ? (
                          <button
                            type="button"
                            onClick={() => onSelectDeviation(parentDeviation)}
                            className="text-left group"
                          >
                            <span className="font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline flex items-center gap-1">
                              {item.deviationNo}
                              <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                            </span>
                            <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                              {item.deviationTitle}
                            </span>
                            {item.batchNo && (
                              <span className="text-[10px] font-bold text-slate-400">Lô: {item.batchNo}</span>
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-400">{item.deviationNo}</span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                          <User size={13} className="text-slate-400" />
                          <span>{item.responsible}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className={isOverdue ? 'text-rose-500' : 'text-slate-400'} />
                          <span className={`font-mono font-medium ${
                            isOverdue ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {item.deadline ? formatDateStandard(item.deadline) : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200">
                            <CheckCircle2 size={11} /> Đã hoàn tất
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200">
                            <AlertTriangle size={11} /> Quá hạn
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200">
                            <Clock size={11} /> Đang tiến hành
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
