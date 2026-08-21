/**
 * AuditLogPage.tsx
 * ========================
 * Trang Admin xem, tìm kiếm và phân tích Nhật ký Hoạt động (Audit Logs) toàn hệ thống.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, Search, Filter, RefreshCw, Shield, 
  PlusCircle, Edit3, Trash2, Download, LogIn, Database,
  Calendar, User, ArrowUpDown, ChevronLeft, ChevronRight, FileSpreadsheet
} from 'lucide-react';
import { subscribeAuditLogs, AuditLogRecord } from '../../services/auditService';
import { formatDateStandard } from '../../utils';

const ACTION_CONFIG = {
  CREATE: {
    label: 'Thêm mới',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    badge: 'bg-emerald-500',
    icon: PlusCircle
  },
  UPDATE: {
    label: 'Cập nhật',
    color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    badge: 'bg-blue-500',
    icon: Edit3
  },
  DELETE: {
    label: 'Xóa',
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
    badge: 'bg-rose-500',
    icon: Trash2
  },
  IMPORT: {
    label: 'Nhập dữ liệu',
    color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    badge: 'bg-purple-500',
    icon: Download
  },
  RESTORE: {
    label: 'Khôi phục',
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    badge: 'bg-amber-500',
    icon: RefreshCw
  },
  LOGIN: {
    label: 'Đăng nhập',
    color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    badge: 'bg-slate-500',
    icon: LogIn
  }
};

const COLLECTION_LABELS: Record<string, string> = {
  PRODUCTS: 'Sản phẩm',
  BATCHES: 'Lô sản xuất',
  TCCS: 'Hồ sơ TCCS',
  TEST_RESULTS: 'Phiếu kiểm nghiệm',
  MATERIALS: 'Nguyên liệu',
  CRITERIA_ALIASES: 'Liên kết chỉ tiêu',
  SYSTEM: 'Hệ thống'
};

const PAGE_SIZE = 25;

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');
  const [userFilter, setUserFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [limitCount, setLimitCount] = useState(200);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeAuditLogs((data) => {
      setLogs(data);
      setLoading(false);
    }, limitCount);

    return () => unsubscribe();
  }, [limitCount]);

  // Danh sách email người thực hiện (unique)
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => {
      if (l.performedBy) set.add(l.performedBy);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Bộ lọc dữ liệu
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Lọc theo hành động
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

      // 2. Lọc theo phân hệ
      if (collectionFilter !== 'ALL' && log.collection !== collectionFilter) return false;

      // 3. Lọc theo người thực hiện
      if (userFilter !== 'ALL' && log.performedBy !== userFilter) return false;

      // 4. Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const detailsMatch = (log.details || '').toLowerCase().includes(query);
        const userMatch = (log.performedBy || '').toLowerCase().includes(query);
        const docIdMatch = (log.documentId || '').toLowerCase().includes(query);
        const actionMatch = (log.action || '').toLowerCase().includes(query);
        if (!detailsMatch && !userMatch && !docIdMatch && !actionMatch) return false;
      }

      return true;
    });
  }, [logs, actionFilter, collectionFilter, userFilter, searchTerm]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    return {
      total: logs.length,
      createCount: logs.filter(l => l.action === 'CREATE').length,
      updateCount: logs.filter(l => l.action === 'UPDATE').length,
      deleteCount: logs.filter(l => l.action === 'DELETE').length,
    };
  }, [logs]);

  // Phân trang
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, currentPage]);

  // Xuất file CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;
    const headers = ['Thời gian', 'Người thực hiện', 'Hành động', 'Phân hệ', 'Mã tài liệu', 'Chi tiết'];
    const rows = filteredLogs.map(l => [
      formatDateStandard(l.timestamp),
      `"${l.performedBy || ''}"`,
      `"${l.action}"`,
      `"${COLLECTION_LABELS[l.collection] || l.collection}"`,
      `"${l.documentId || ''}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PQM_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400">
              <History size={24} />
            </div>
            Nhật ký Hoạt động (Audit Logs)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Theo dõi, truy vết toàn bộ thao tác thêm, sửa, xóa và thay đổi dữ liệu theo chuẩn GMP
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-all shadow-xs"
            title="Xuất file CSV báo cáo kiểm toán"
          >
            <FileSpreadsheet size={16} className="text-emerald-600" />
            <span>Xuất CSV</span>
          </button>

          <select
            value={limitCount}
            onChange={(e) => setLimitCount(Number(e.target.value))}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value={100}>Tải 100 bản ghi</option>
            <option value={200}>Tải 200 bản ghi</option>
            <option value={500}>Tải 500 bản ghi</option>
          </select>
        </div>
      </div>

      {/* Thẻ Thống kê nhanh */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
            <span>Tổng nhật ký</span>
            <Database size={16} className="text-primary-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.total}</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase">
            <span>Tạo mới</span>
            <PlusCircle size={16} />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.createCount}</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase">
            <span>Cập nhật</span>
            <Edit3 size={16} />
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{stats.updateCount}</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 text-xs font-semibold uppercase">
            <span>Đã xóa</span>
            <Trash2 size={16} />
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{stats.deleteCount}</p>
        </div>
      </div>

      {/* Thanh Tìm kiếm & Bộ lọc */}
      <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Ô tìm kiếm */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm kiếm theo chi tiết thao tác, email người dùng, mã tài liệu..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Lọc theo Hành động */}
          <div className="w-full sm:w-44">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="ALL">Tất cả hành động</option>
              <option value="CREATE">Thêm mới (CREATE)</option>
              <option value="UPDATE">Cập nhật (UPDATE)</option>
              <option value="DELETE">Xóa (DELETE)</option>
              <option value="IMPORT">Nhập dữ liệu (IMPORT)</option>
              <option value="RESTORE">Khôi phục (RESTORE)</option>
              <option value="LOGIN">Đăng nhập (LOGIN)</option>
            </select>
          </div>

          {/* Lọc theo Phân hệ */}
          <div className="w-full sm:w-44">
            <select
              value={collectionFilter}
              onChange={(e) => {
                setCollectionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="ALL">Tất cả phân hệ</option>
              <option value="PRODUCTS">Sản phẩm</option>
              <option value="BATCHES">Lô sản xuất</option>
              <option value="TCCS">Hồ sơ TCCS</option>
              <option value="TEST_RESULTS">Phiếu kiểm nghiệm</option>
              <option value="MATERIALS">Nguyên liệu</option>
              <option value="CRITERIA_ALIASES">Liên kết chỉ tiêu</option>
              <option value="SYSTEM">Hệ thống</option>
            </select>
          </div>

          {/* Lọc theo Người dùng */}
          <div className="w-full sm:w-48">
            <select
              value={userFilter}
              onChange={(e) => {
                setUserFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none"
            >
              <option value="ALL">Tất cả người dùng</option>
              {uniqueUsers.map(email => (
                <option key={email} value={email}>{email}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Thông báo số kết quả lọc */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span>
            Hiển thị <strong>{filteredLogs.length}</strong> trên tổng số <strong>{logs.length}</strong> bản ghi
          </span>
          {(searchTerm || actionFilter !== 'ALL' || collectionFilter !== 'ALL' || userFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setActionFilter('ALL');
                setCollectionFilter('ALL');
                setUserFilter('ALL');
                setCurrentPage(1);
              }}
              className="text-primary-600 dark:text-primary-400 font-semibold hover:underline cursor-pointer"
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
      </div>

      {/* Bảng Danh sách Logs */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw size={28} className="animate-spin text-primary-500" />
            <span className="text-sm font-medium">Đang nạp nhật ký kiểm toán...</span>
          </div>
        ) : paginatedLogs.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Shield size={36} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Không tìm thấy nhật ký phù hợp</p>
            <p className="text-xs text-slate-400 mt-1">Hãy thử thay đổi từ khóa hoặc bộ lọc</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-[16%]">Thời gian</th>
                  <th className="py-3 px-4 w-[12%]">Hành động</th>
                  <th className="py-3 px-4 w-[14%]">Phân hệ</th>
                  <th className="py-3 px-4 w-[38%]">Nội dung chi tiết</th>
                  <th className="py-3 px-4 w-[20%]">Người thực hiện</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedLogs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action as keyof typeof ACTION_CONFIG] || ACTION_CONFIG.LOGIN;
                  const Icon = cfg.icon;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Thời gian */}
                      <td className="py-3 px-4 text-xs font-mono text-slate-500 dark:text-slate-400">
                        {formatDateStandard(log.timestamp)}
                      </td>

                      {/* Hành động */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${cfg.color}`}>
                          <Icon size={13} />
                          {cfg.label}
                        </span>
                      </td>

                      {/* Phân hệ */}
                      <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700">
                          {COLLECTION_LABELS[log.collection] || log.collection}
                        </span>
                        {log.documentId && (
                          <span className="block text-[11px] font-mono text-slate-400 mt-0.5 truncate max-w-[140px]" title={log.documentId}>
                            ID: {log.documentId}
                          </span>
                        )}
                      </td>

                      {/* Chi tiết */}
                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                        <p className="leading-snug break-words">{log.details}</p>
                      </td>

                      {/* Người thực hiện */}
                      <td className="py-3 px-4 text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                          <User size={13} className="text-slate-400 shrink-0" />
                          <span className="truncate max-w-[180px]" title={log.performedBy}>
                            {log.performedBy || 'Hệ thống'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;
