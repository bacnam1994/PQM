import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, set, remove, push, query, limitToLast, orderByChild, serverTimestamp } from 'firebase/database';
import { useAppStore } from '../../store/useAppStore';
import { Users, Shield, Search, Calendar, UserCog, AlertTriangle, FileClock, History } from 'lucide-react';
import toast from 'react-hot-toast';
import { DSFilterBar, DSSearchInput, DSTable } from '../../components/ui/DesignSystem';
import { ConfirmationModal, Modal } from '../../components/ui/CommonUI';
import { formatDateStandard, formatDateTime } from '../../utils';

type UserRole = 'ADMIN' | 'USER' | 'GUEST';

interface UserData {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  targetEmail: string;
  performedBy: string;
  oldRole: string;
  newRole: string;
  timestamp: string;
}

const UserManagement: React.FC = () => {
  const currentUser = useAppStore(state => state.user);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  // State for confirmation modal
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const adminsRef = ref(db, 'users/admins');

    let usersSnapshot: any = undefined;
    let adminsSnapshot: any = undefined;

    const syncData = () => {
      // Chỉ xử lý khi cả 2 nguồn dữ liệu đã phản hồi ít nhất 1 lần (tránh flicker role)
      if (usersSnapshot === undefined || adminsSnapshot === undefined) return;

      const usersData = usersSnapshot || {};
      const adminsData = adminsSnapshot || {};
      
      const userList: UserData[] = Object.entries(usersData)
        .filter(([key]) => key !== 'admins')
        .map(([key, value]: [string, any]) => ({
          uid: key,
          ...value,
          role: adminsData[key] ? 'ADMIN' : (value.role || 'GUEST')
      }));
      setUsers(userList);
      setLoading(false);
    };

    const unsubUsers = onValue(usersRef, (snapshot) => {
      usersSnapshot = snapshot.val();
      syncData();
    }, (error) => {
      console.error("Lỗi tải danh sách users:", error);
      setLoading(false);
    });

    const unsubAdmins = onValue(adminsRef, (snapshot) => {
      adminsSnapshot = snapshot.val();
      syncData();
    }, (error) => {
      console.error("Lỗi tải danh sách admins:", error);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubAdmins();
    };
  }, []);

  // Load Audit Logs
  useEffect(() => {
    if (!isLogOpen) return;
    
    const logsRef = query(ref(db, 'audit_logs'), orderByChild('timestamp'), limitToLast(50));
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedLogs = Object.entries(data).map(([key, val]: [string, any]) => ({
          id: key,
          ...val
        })).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setLogs(loadedLogs);
      } else {
        setLogs([]);
      }
    });
    return () => unsubscribe();
  }, [isLogOpen]);

  const handleRoleChange = async (targetUid: string, currentRole: UserRole, newRole: UserRole) => {
    if (targetUid === currentUser?.uid) {
      toast.error("Không thể tự thay đổi quyền của chính mình!");
      return;
    }
    
    setConfirmMessage(`Bạn có chắc chắn muốn chuyển đổi quyền của tài khoản này thành ${newRole}?`);
    setConfirmAction(() => async () => {
      try {
        await set(ref(db, `users/${targetUid}/role`), newRole);

        if (newRole === 'ADMIN') {
          await set(ref(db, `users/admins/${targetUid}`), true);
        } else {
          await remove(ref(db, `users/admins/${targetUid}`));
        }

        // Ghi Audit Log
        const targetUser = users.find(u => u.uid === targetUid);
        await push(ref(db, 'audit_logs'), {
          action: 'CHANGE_ROLE',
          targetUid: targetUid,
          targetEmail: targetUser?.email || 'Unknown',
          performedBy: currentUser?.email || 'System',
          oldRole: currentRole,
          newRole: newRole,
          timestamp: serverTimestamp()  // [BẢO MẬT] Dùng server timestamp, không dùng client timestamp
        });

        toast.success(`Đã cập nhật quyền thành ${newRole}`);
      } catch (error) {
        console.error(error);
        toast.error("Lỗi khi cập nhật quyền.");
      }
    });
    setIsConfirmOpen(true);
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 dark:text-zinc-150 flex items-center gap-3">
          <UserCog className="text-indigo-600" size={32} /> Quản lý Người dùng
        </h1>
        <p className="text-slate-500 dark:text-zinc-400 mt-1">Phân quyền và quản lý tài khoản truy cập hệ thống.</p>
      </div>

      <DSFilterBar>
        <DSSearchInput placeholder="Tìm kiếm theo email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-xl text-xs font-bold whitespace-nowrap">
          Tổng: {filteredUsers.length} tài khoản
        </div>
        <button 
          onClick={() => setIsLogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-355 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm ml-auto"
        >
          <FileClock size={16} /> Lịch sử phân quyền
        </button>
      </DSFilterBar>

      <DSTable>
            <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800/80">
              <tr className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-widest">
                <th className="px-6 py-4">Người dùng</th>
                <th className="px-6 py-4">Ngày đăng ký</th>
                <th className="px-6 py-4 text-center">Vai trò</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-zinc-850">
              {loading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-zinc-500 text-sm font-bold">Đang tải dữ liệu...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 dark:text-zinc-550 text-sm">Không tìm thấy người dùng nào.</td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs shrink-0">
                          {u.email?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-700 dark:text-zinc-200 text-sm flex items-center gap-2">
                            {u.email}
                            {u.uid === currentUser?.uid && <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded uppercase font-black">Bạn</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{u.uid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs font-medium">
                        <Calendar size={14} />
                        {u.createdAt ? formatDateStandard(u.createdAt) : '---'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                        u.role === 'ADMIN' 
                          ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400' 
                          : u.role === 'USER' 
                            ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                      }`}>
                        {u.role === 'ADMIN' ? <Shield size={12} /> : <Users size={12} />}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        {u.uid === currentUser?.uid ? (
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-bold bg-slate-50 dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                            Không thể tự sửa
                          </span>
                        ) : (
                          <>
                            {u.role === 'GUEST' && (
                              <button
                                onClick={() => handleRoleChange(u.uid, 'GUEST', 'USER')}
                                className="text-xs font-black px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-600/10 transition-all hover:-translate-y-0.5 duration-200"
                              >
                                Duyệt làm User
                              </button>
                            )}
                            {u.role === 'USER' && (
                              <>
                                <button
                                  onClick={() => handleRoleChange(u.uid, 'USER', 'ADMIN')}
                                  className="text-xs font-bold px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:text-indigo-700 rounded-lg border border-indigo-100 dark:border-indigo-900/50 transition-all"
                                >
                                  Thăng cấp Admin
                                </button>
                                <button
                                  onClick={() => handleRoleChange(u.uid, 'USER', 'GUEST')}
                                  className="text-xs font-bold px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-455 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-700 rounded-lg border border-rose-100 dark:border-rose-900/50 transition-all"
                                >
                                  Hạ xuống Khách
                                </button>
                              </>
                            )}
                            {u.role === 'ADMIN' && (
                              <button
                                onClick={() => handleRoleChange(u.uid, 'ADMIN', 'USER')}
                                className="text-xs font-bold px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-700 rounded-lg border border-amber-100 dark:border-amber-900/50 transition-all"
                              >
                                Hạ cấp xuống User
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
      </DSTable>

      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => confirmAction && confirmAction()}
        title="Xác nhận thay đổi quyền"
        message={confirmMessage}
        confirmText="Xác nhận"
        icon={AlertTriangle}
        confirmButtonColor="bg-indigo-600 hover:bg-indigo-700"
      />

      <Modal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        title="Nhật ký Phân quyền Hệ thống"
        icon={History}
        color="bg-slate-700"
      >
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {logs.length === 0 ? (
            <p className="text-center text-slate-400 dark:text-zinc-500 text-sm py-8">Chưa có dữ liệu nhật ký.</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="bg-slate-50 dark:bg-zinc-900 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-slate-700 dark:text-zinc-200">{log.performedBy}</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">{formatDateTime(log.timestamp)}</span>
                  </div>
                  <div className="text-slate-600 dark:text-zinc-350">
                    Đã thay đổi quyền của <span className="font-bold text-indigo-600 dark:text-indigo-400">{log.targetEmail}</span> từ <span className="font-mono bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300 px-1 rounded text-[10px]">{log.oldRole}</span> sang <span className="font-mono bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 px-1 rounded text-[10px] font-bold">{log.newRole}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default UserManagement;