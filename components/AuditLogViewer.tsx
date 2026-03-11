import React, { useState, useEffect, useMemo } from 'react';
import { ref, query, orderByChild, limitToLast, onValue } from 'firebase/database';
import { db } from '../firebase';
import { History, Search, Filter, User, Clock, FileText, Activity, ShieldAlert, Calendar, Download } from 'lucide-react';
import { DSTable, DSTableHead, DSTableBody, DSTableRow, DSTableCell, DSFilterBar, DSSearchInput, DSSelect } from './design';
import { Pagination } from './CommonUI';
import { AuditLogEntry, AuditAction } from '../types';
import { useExport } from '../hooks/useExport';

const ActionBadge = ({ action }: { action: AuditAction }) => {
  const configs: Record<string, string> = {
    CREATE: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    UPDATE: 'bg-blue-100 text-blue-700 border-blue-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
    IMPORT: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    LOGIN: 'bg-slate-100 text-slate-700 border-slate-200',
    LOGOUT: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  const className = configs[action] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase border ${className}`}>
      {action}
    </span>
  );
};

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const { exportToCSV } = useExport();

  // Fetch logs from Firebase
  useEffect(() => {
    const logsRef = ref(db, 'audit_logs');
    // Lấy 500 log mới nhất để tối ưu hiệu suất
    const recentLogsQuery = query(logsRef, orderByChild('timestamp'), limitToLast(500));

    const unsubscribe = onValue(recentLogsQuery, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const loadedLogs = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(loadedLogs);
      } else {
        setLogs([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching audit logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter & Search Logic
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.performedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.documentId && log.documentId.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesAction = filterAction === 'ALL' || log.action === filterAction;

      return matchesSearch && matchesAction;
    });
  }, [logs, searchTerm, filterAction]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterAction]);

  const handleExport = () => {
    const exportData = filteredLogs.map(log => ({
      'Thời gian': new Date(log.timestamp).toLocaleString('vi-VN'),
      'Người thực hiện': log.performedBy,
      'Hành động': log.action,
      'Đối tượng': log.collection,
      'ID Tài liệu': log.documentId || '',
      'Chi tiết': log.details
    }));
    exportToCSV(exportData, 'audit_logs');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <History className="text-indigo-600" /> NHẬT KÝ HỆ THỐNG
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Theo dõi các hoạt động quan trọng của người dùng.</p>
        </div>
        <div className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
          {logs.length} bản ghi gần nhất
        </div>
      </div>

      <DSFilterBar>
        <DSSearchInput 
          placeholder="Tìm theo nội dung, người dùng, ID..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
        
        <DSSelect 
          icon={Activity} 
          value={filterAction} 
          onChange={(e) => setFilterAction(e.target.value)} 
          className="w-40"
        >
          <option value="ALL">Tất cả hành động</option>
          <option value="CREATE">Thêm mới (CREATE)</option>
          <option value="UPDATE">Cập nhật (UPDATE)</option>
          <option value="DELETE">Xóa (DELETE)</option>
          <option value="IMPORT">Nhập liệu (IMPORT)</option>
          <option value="LOGIN">Đăng nhập</option>
        </DSSelect>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 font-black uppercase text-[10px] transition-all shadow-sm ml-auto"
        >
          <Download size={16} /> Xuất CSV
        </button>
      </DSFilterBar>

      {loading ? (
        <div className="p-12 text-center text-slate-400">Đang tải dữ liệu...</div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
            <DSTable>
              <DSTableHead>
                <DSTableRow className="bg-slate-50 dark:bg-slate-700/50">
                  <DSTableCell header>Thời gian</DSTableCell>
                  <DSTableCell header>Người thực hiện</DSTableCell>
                  <DSTableCell header className="text-center">Hành động</DSTableCell>
                  <DSTableCell header>Đối tượng</DSTableCell>
                  <DSTableCell header>Chi tiết</DSTableCell>
                </DSTableRow>
              </DSTableHead>
              <DSTableBody>
                {currentLogs.length > 0 ? (
                  currentLogs.map((log) => (
                    <DSTableRow key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                      <DSTableCell className="w-40">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                            {new Date(log.timestamp).toLocaleDateString('en-GB')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('en-GB')}
                          </span>
                        </div>
                      </DSTableCell>
                      <DSTableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500"><User size={12}/></div>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[150px]" title={log.performedBy}>{log.performedBy}</span>
                        </div>
                      </DSTableCell>
                      <DSTableCell className="text-center w-24">
                        <ActionBadge action={log.action} />
                      </DSTableCell>
                      <DSTableCell className="w-32">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{log.collection}</span>
                      </DSTableCell>
                      <DSTableCell>
                        <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{log.details}</p>
                        {log.documentId && <p className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {log.documentId}</p>}
                      </DSTableCell>
                    </DSTableRow>
                  ))
                ) : (
                  <DSTableRow>
                    <DSTableCell colSpan={5} className="text-center py-8 text-slate-400 italic">Không tìm thấy nhật ký nào phù hợp.</DSTableCell>
                  </DSTableRow>
                )}
              </DSTableBody>
            </DSTable>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </>
      )}
    </div>
  );
};