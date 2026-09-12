import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { ref, onValue, set, remove, push, query, limitToLast, orderByChild, serverTimestamp } from 'firebase/database';
import { useAppStore } from '../../store/useAppStore';
import { 
  UserGroupIcon, 
  ShieldCheckIcon, 
  CalendarIcon, 
  ExclamationTriangleIcon, 
  ClockIcon,
  TrashIcon,
  CheckCircleIcon,
  AdjustmentsHorizontalIcon,
  BeakerIcon,
  CubeIcon,
  EyeIcon,
  UserIcon,
  ClipboardDocumentCheckIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { DSFilterBar, DSSearchInput, DSTable } from '../../components/ui/DesignSystem';
import { ConfirmationModal, Modal } from '../../components/ui/CommonUI';
import { formatDateStandard, formatDateTime } from '../../utils';
import { Role } from '../../types/permissions';

export type UserRole = Role;

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
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

const ROLE_DEFINITIONS: Record<UserRole, { label: string; desc: string; color: string; badgeBg: string; icon: React.ComponentType<{ className?: string }> }> = {
  ADMIN: {
    label: 'Quản trị viên (Admin)',
    desc: 'Toàn quyền tối cao: Quản trị tài khoản, cấu hình hệ thống, duyệt mọi nghiệp vụ.',
    color: 'text-indigo-600 dark:text-indigo-400',
    badgeBg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20',
    icon: ShieldCheckIcon
  },
  QA: {
    label: 'Đảm bảo chất lượng (QA)',
    desc: 'Ký duyệt xuất xưởng Lô, ban hành CoA, phê duyệt TCCS, đóng Sai lệch & Thay đổi.',
    color: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    icon: CheckCircleIcon
  },
  QC: {
    label: 'Kiểm soát chất lượng (QC)',
    desc: 'Soát xét kết quả kiểm nghiệm, cảnh báo OOS, theo dõi xu hướng phân tích SPC.',
    color: 'text-sky-600 dark:text-sky-400',
    badgeBg: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
    icon: BeakerIcon
  },
  LAB: {
    label: 'Kiểm nghiệm viên (Lab)',
    desc: 'Nhập kết quả kiểm nghiệm, quét OCR thông minh, đính kèm dữ liệu phân tích.',
    color: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
    icon: ClipboardDocumentCheckIcon
  },
  PRODUCTION: {
    label: 'Sản xuất (Production)',
    desc: 'Tạo Lô sản xuất, cập nhật sản lượng thực tế, hạn dùng và quy cách đóng gói.',
    color: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    icon: CubeIcon
  },
  USER: {
    label: 'Nhân viên nghiệp vụ (User)',
    desc: 'Vai trò tiêu chuẩn: Tạo và chỉnh sửa Lô sản xuất, nhập phiếu kiểm nghiệm.',
    color: 'text-teal-600 dark:text-teal-400',
    badgeBg: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
    icon: UserIcon
  },
  VIEWER: {
    label: 'Quan sát viên (Viewer)',
    desc: 'Chỉ xem báo cáo, tra cứu hồ sơ lô và chứng nhận chất lượng (không chỉnh sửa).',
    color: 'text-ink-muted',
    badgeBg: 'bg-surface-2 text-ink-muted border-border',
    icon: EyeIcon
  },
  GUEST: {
    label: 'Khách chờ duyệt (Guest)',
    desc: 'Tài khoản mới đăng ký, chưa được cấp quyền truy cập vào dữ liệu hệ thống.',
    color: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
    icon: ClockIcon
  }
};

const ALL_ROLES: UserRole[] = ['ADMIN', 'QA', 'QC', 'LAB', 'PRODUCTION', 'USER', 'VIEWER', 'GUEST'];

const UserManagement: React.FC = () => {
  const currentUser = useAppStore(state => state.user);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);

  // State modal phân quyền
  const [selectedUserForRole, setSelectedUserForRole] = useState<UserData | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('USER');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

  // State modal xác nhận chung (Xóa / Đổi quyền)
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmButtonColor, setConfirmButtonColor] = useState('bg-emerald-600 hover:bg-emerald-700');

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const adminsRef = ref(db, 'users/admins');

    let usersSnapshot: any = undefined;
    let adminsSnapshot: any = undefined;

    const syncData = () => {
      if (usersSnapshot === undefined || adminsSnapshot === undefined) return;

      const usersData = usersSnapshot || {};
      const adminsData = adminsSnapshot || {};
      
      const userList: UserData[] = Object.entries(usersData)
        .filter(([key]) => key !== 'admins')
        .map(([key, value]: [string, any]) => ({
          uid: key,
          email: value.email || '',
          displayName: value.displayName || '',
          createdAt: value.createdAt || '',
          role: (adminsData[key] ? 'ADMIN' : (value.role || 'GUEST')) as UserRole
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

  const handleOpenRoleModal = (user: UserData) => {
    setSelectedUserForRole(user);
    setTargetRole(user.role);
    setIsRoleModalOpen(true);
  };

  const executeRoleChange = async (targetUid: string, currentRole: UserRole, newRole: UserRole) => {
    try {
      await set(ref(db, `users/${targetUid}/role`), newRole);

      if (newRole === 'ADMIN') {
        await set(ref(db, `users/admins/${targetUid}`), true);
      } else {
        await remove(ref(db, `users/admins/${targetUid}`));
      }

      // Ghi Audit Log ALCOA+
      const targetUser = users.find(u => u.uid === targetUid);
      await push(ref(db, 'audit_logs'), {
        action: 'CHANGE_ROLE',
        targetUid: targetUid,
        targetEmail: targetUser?.email || 'Unknown',
        performedBy: currentUser?.email || 'System Admin',
        oldRole: currentRole,
        newRole: newRole,
        timestamp: serverTimestamp()
      });

      toast.success(`Đã chuyển đổi quyền của ${targetUser?.email || 'người dùng'} sang ${newRole}`);
      setIsRoleModalOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(`Lỗi khi cập nhật quyền: ${error.message || 'Thao tác thất bại'}`);
    }
  };

  const handleConfirmRoleChange = () => {
    if (!selectedUserForRole) return;
    if (selectedUserForRole.uid === currentUser?.uid) {
      toast.error("Không thể tự thay đổi quyền của chính mình!");
      return;
    }

    if (selectedUserForRole.role === targetRole) {
      setIsRoleModalOpen(false);
      return;
    }

    setConfirmTitle("Xác nhận chuyển đổi vai trò");
    setConfirmMessage(`Bạn có chắc chắn muốn thay đổi vai trò của tài khoản "${selectedUserForRole.email}" từ ${selectedUserForRole.role} sang ${targetRole}?`);
    setConfirmButtonColor("bg-indigo-600 hover:bg-indigo-700");
    setConfirmAction(() => () => executeRoleChange(selectedUserForRole.uid, selectedUserForRole.role, targetRole));
    setIsConfirmOpen(true);
  };

  const handleDeleteUser = (user: UserData) => {
    if (user.uid === currentUser?.uid) {
      toast.error("Không thể tự xóa tài khoản của chính mình!");
      return;
    }

    setConfirmTitle("Xác nhận xóa tài khoản người dùng");
    setConfirmMessage(`CẢNH BÁO: Bạn đang thực hiện xóa tài khoản "${user.email}". Người dùng sẽ không thể đăng nhập hoặc truy cập dữ liệu nữa. Hành động này sẽ được ghi vết vào Audit Trail.`);
    setConfirmButtonColor("bg-rose-600 hover:bg-rose-700");
    setConfirmAction(() => async () => {
      try {
        await remove(ref(db, `users/${user.uid}`));
        await remove(ref(db, `users/admins/${user.uid}`));

        await push(ref(db, 'audit_logs'), {
          action: 'DELETE_USER',
          targetUid: user.uid,
          targetEmail: user.email,
          performedBy: currentUser?.email || 'System Admin',
          timestamp: serverTimestamp()
        });

        toast.success(`Đã xóa tài khoản ${user.email} khỏi hệ thống.`);
      } catch (err: any) {
        console.error("Lỗi xóa người dùng:", err);
        toast.error("Lỗi khi xóa người dùng: " + (err.message || 'Không có quyền'));
      }
    });
    setIsConfirmOpen(true);
  };

  const filteredUsers = users.filter(u => {
    const matchSearch = (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (u.displayName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-20">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <UserGroupIcon className="text-emerald-600 dark:text-emerald-400 w-6 h-6" /> Quản trị Người dùng & Phân quyền
          </h1>
          <p className="text-ink-muted mt-1 text-xs">
            Quản trị viên có toàn quyền cấp phát, điều chuyển 8 vai trò nghiệp vụ chuẩn GMP và quản lý tài khoản truy cập.
          </p>
        </div>
        <button 
          onClick={() => setIsLogOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-surface border border-border text-ink rounded-lg text-xs font-medium hover:bg-surface-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shadow-xs active:scale-[0.98]"
        >
          <ClockIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Lịch sử phân quyền (Audit Trail)
        </button>
      </div>

      <DSFilterBar>
        <DSSearchInput 
          placeholder="Tìm kiếm theo email, tên người dùng..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3.5 py-2 bg-surface border border-border rounded-xl text-xs font-medium text-ink outline-none focus:ring-2 focus:ring-emerald-500/15 focus:border-emerald-500 transition-all shadow-2xs"
        >
          <option value="ALL">Tất cả vai trò ({users.length})</option>
          {ALL_ROLES.map(r => (
            <option key={r} value={r}>
              {r} ({users.filter(u => u.role === r).length})
            </option>
          ))}
        </select>
        <div className="px-3.5 py-2 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-medium whitespace-nowrap">
          Hiển thị: {filteredUsers.length} tài khoản
        </div>
      </DSFilterBar>

      <DSTable>
        <thead className="bg-surface-2/60 border-b border-border">
          <tr className="text-ink-muted text-xs font-semibold">
            <th className="px-5 py-3">Người dùng</th>
            <th className="px-5 py-3">Ngày tham gia</th>
            <th className="px-5 py-3 text-center">Vai trò hiện tại</th>
            <th className="px-5 py-3 text-right">Thao tác Quản trị viên</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading ? (
            <tr>
              <td colSpan={4} className="p-8 text-center text-ink-muted text-sm font-medium">Đang nạp danh sách tài khoản...</td>
            </tr>
          ) : filteredUsers.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-8 text-center text-ink-muted text-sm">Không tìm thấy tài khoản nào khớp bộ lọc.</td>
            </tr>
          ) : (
            filteredUsers.map((u) => {
              const roleDef = ROLE_DEFINITIONS[u.role] || ROLE_DEFINITIONS.GUEST;
              const RoleIcon = roleDef.icon;
              const isSelf = u.uid === currentUser?.uid;

              return (
                <tr key={u.uid} className="hover:bg-surface-2/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs border border-emerald-500/20">
                        {u.email ? u.email.slice(0, 2).toUpperCase() : 'US'}
                      </div>
                      <div>
                        <div className="font-medium text-ink text-xs flex items-center gap-2">
                          <span>{u.displayName || u.email}</span>
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              BẠN
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-muted font-mono">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      {u.createdAt ? formatDateStandard(u.createdAt) : '---'}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border shadow-2xs ${roleDef.badgeBg}`}>
                      <RoleIcon className="w-3.5 h-3.5" />
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end items-center gap-2">
                      {isSelf ? (
                        <span className="text-xs text-ink-muted font-medium bg-surface-2 px-3 py-1.5 rounded-lg border border-border">
                          Tài khoản hiện tại
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenRoleModal(u)}
                            className="text-xs font-medium px-3 py-1.5 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-500/15 rounded-lg border border-indigo-500/20 transition-all flex items-center gap-1.5 active:scale-[0.98]"
                            title="Phân quyền / Đổi vai trò"
                          >
                            <AdjustmentsHorizontalIcon className="w-3.5 h-3.5" />
                            Phân quyền
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-lg border border-transparent hover:border-rose-500/20 transition-colors active:scale-[0.98]"
                            title="Xóa tài khoản khỏi hệ thống"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </DSTable>

      {/* Modal Phân quyền chi tiết cho Admin */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={`Phân quyền cho tài khoản: ${selectedUserForRole?.email || ''}`}
        icon={AdjustmentsHorizontalIcon}
        color="bg-indigo-600"
      >
        <div className="space-y-4">
          <p className="text-xs text-ink-muted">
            Chọn vai trò phù hợp cho người dùng. Thẩm quyền sẽ có hiệu lực ngay lập tức trong toàn hệ thống.
          </p>

          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto custom-scrollbar pr-1">
            {ALL_ROLES.map((r) => {
              const def = ROLE_DEFINITIONS[r];
              const IconComp = def.icon;
              const isSelected = targetRole === r;

              return (
                <div
                  key={r}
                  onClick={() => setTargetRole(r)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                    isSelected
                      ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'bg-surface hover:bg-surface-2 border-border'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-surface-2 text-ink-soft'
                  }`}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-ink">{def.label}</span>
                      <span className="text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded bg-surface-2 text-ink-muted">
                        {r}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-muted mt-1 leading-relaxed">{def.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-2 rounded-lg border border-border transition-colors active:scale-[0.98]"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmRoleChange}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-xs transition-all active:scale-[0.98] flex items-center gap-2"
            >
              <ShieldCheckIcon className="w-4 h-4" /> Lưu quyền mới
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal xác nhận */}
      <ConfirmationModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => confirmAction && confirmAction()}
        title={confirmTitle}
        message={confirmMessage}
        confirmText="Xác nhận thực hiện"
        icon={ExclamationTriangleIcon}
        confirmButtonColor={confirmButtonColor}
      />

      {/* Modal Lịch sử phân quyền */}
      <Modal
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        title="Nhật ký Phân quyền Hệ thống (Audit Trail)"
        icon={ClockIcon}
        color="bg-emerald-600"
      >
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
          {logs.length === 0 ? (
            <p className="text-center text-ink-muted text-sm py-8">Chưa có dữ liệu nhật ký.</p>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="bg-surface-2/60 p-3 rounded-xl border border-border text-xs">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-ink">{log.performedBy}</span>
                    <span className="text-[10px] text-ink-muted font-mono">{formatDateTime(log.timestamp)}</span>
                  </div>
                  <div className="text-ink-muted">
                    {log.action === 'DELETE_USER' ? (
                      <>Đã xóa tài khoản <span className="font-medium text-rose-600 dark:text-rose-400">{log.targetEmail}</span> khỏi hệ thống</>
                    ) : (
                      <>
                        Đã chuyển vai trò của <span className="font-medium text-emerald-600 dark:text-emerald-400">{log.targetEmail}</span> từ{' '}
                        <span className="font-mono bg-surface text-ink px-1.5 py-0.5 rounded text-[10px] border border-border">{log.oldRole}</span> sang{' '}
                        <span className="font-mono bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded text-[10px] font-medium border border-indigo-500/20">{log.newRole}</span>
                      </>
                    )}
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