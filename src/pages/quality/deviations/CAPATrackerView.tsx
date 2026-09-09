/**
 * PQM V4 Platform - CAPA Tracker View
 * Quản lý tập trung toàn bộ danh mục Hành động Khắc phục / Phòng ngừa (CAPA Action Items)
 */

import React, { useState, useMemo } from 'react';
import { 
  CheckCircleIcon, 
  ClockIcon, 
  ExclamationTriangleIcon, 
  MagnifyingGlassIcon, 
  UserIcon, 
  CalendarIcon, 
  ArrowRightIcon 
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
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
    CORRECTIVE: { label: 'Khắc phục', badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
    PREVENTIVE: { label: 'Phòng ngừa', badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
    IMMEDIATE: { label: 'Tức thời', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
  };

  return (
    <div className="space-y-4">
      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <MagnifyingGlassIcon className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Tìm theo nội dung CAPA, người phụ trách, mã sai lệch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-2 border border-border rounded-xl text-xs font-bold text-ink placeholder:text-ink-muted outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center bg-surface-2 border border-border p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'ALL' ? 'bg-surface shadow-sm text-emerald-600 dark:text-emerald-400 font-bold' : 'text-ink-muted hover:text-ink'}`}
            >
              Tất cả ({allItems.length})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'PENDING' ? 'bg-surface shadow-sm text-blue-600 dark:text-blue-400 font-bold' : 'text-ink-muted hover:text-ink'}`}
            >
              Đang thực hiện
            </button>
            <button
              onClick={() => setStatusFilter('OVERDUE')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'OVERDUE' ? 'bg-surface shadow-sm text-rose-600 dark:text-rose-400 font-bold' : 'text-ink-muted hover:text-ink'}`}
            >
              Quá hạn
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === 'COMPLETED' ? 'bg-surface shadow-sm text-emerald-600 dark:text-emerald-400 font-bold' : 'text-ink-muted hover:text-ink'}`}
            >
              Đã hoàn thành
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-surface-2 border border-border rounded-xl text-xs font-bold outline-none text-ink"
          >
            <option value="ALL">Tất cả loại hành động</option>
            <option value="CORRECTIVE">Khắc phục (Corrective)</option>
            <option value="PREVENTIVE">Phòng ngừa (Preventive)</option>
            <option value="IMMEDIATE">Xử lý tức thời (Immediate)</option>
          </select>
        </div>
      </div>

      {/* Danh sách CAPA Items */}
      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-2 border-b border-border text-ink-muted uppercase tracking-wider font-black">
                <th className="p-4 w-12 text-center">Xác nhận</th>
                <th className="p-4 min-w-[280px]">Nội dung Hành động CAPA</th>
                <th className="p-4 w-32">Phân loại</th>
                <th className="p-4 min-w-[180px]">Hồ sơ Sai lệch liên đới</th>
                <th className="p-4 w-36">Người phụ trách</th>
                <th className="p-4 w-32">Hạn chót</th>
                <th className="p-4 w-32 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-ink-muted font-medium">
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
                      className={`hover:bg-surface-2 transition-colors ${
                        isOverdue ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          disabled={isCompleted}
                          onClick={() => onCompleteItem(item.deviationId, item.id)}
                          className={`h-5 w-5 mx-auto rounded flex items-center justify-center border transition-all ${
                            isCompleted 
                              ? 'bg-emerald-600 border-emerald-600 text-white cursor-default' 
                              : 'border-border text-transparent hover:border-emerald-600'
                          }`}
                          title={isCompleted ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành CAPA'}
                        >
                          <CheckIcon className="h-3.5 w-3.5 stroke-[3]" />
                        </button>
                      </td>

                      <td className="p-4">
                        <p className={`font-bold text-ink ${isCompleted ? 'line-through text-ink-muted' : ''}`}>
                          {item.action}
                        </p>
                        {item.verificationMethod && (
                          <p className="text-[11px] text-ink-muted mt-0.5">
                            Phương pháp thẩm tra: {item.verificationMethod}
                          </p>
                        )}
                      </td>

                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider ${
                          typeConfig[item.type]?.badge || 'bg-surface-2 text-ink-soft border-border'
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
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 group-hover:underline flex items-center gap-1">
                              {item.deviationNo}
                              <ArrowRightIcon className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                            <span className="text-[11px] text-ink-muted block truncate max-w-[200px]">
                              {item.deviationTitle}
                            </span>
                            {item.batchNo && (
                              <span className="text-[10px] font-bold text-ink-muted">Lô: {item.batchNo}</span>
                            )}
                          </button>
                        ) : (
                          <span className="text-ink-muted">{item.deviationNo}</span>
                        )}
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5 text-ink font-medium">
                          <UserIcon className="h-3.5 w-3.5 text-ink-muted" />
                          <span>{item.responsible}</span>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <CalendarIcon className={`h-3.5 w-3.5 ${isOverdue ? 'text-rose-500' : 'text-ink-muted'}`} />
                          <span className={`font-mono font-medium ${
                            isOverdue ? 'font-bold text-rose-600 dark:text-rose-400' : 'text-ink'
                          }`}>
                            {item.deadline ? formatDateStandard(item.deadline) : '—'}
                          </span>
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        {isCompleted ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircleIcon className="h-3 w-3" /> Đã hoàn tất
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <ExclamationTriangleIcon className="h-3 w-3" /> Quá hạn
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <ClockIcon className="h-3 w-3" /> Đang tiến hành
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
