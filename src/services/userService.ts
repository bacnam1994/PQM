/**
 * userService.ts
 * ===============
 * Dịch vụ quản lý người dùng và phân quyền hệ thống (User Management Service).
 * Tuân thủ kiến trúc phân lớp: UI -> Service -> Firebase, không truy cập trực tiếp từ UI.
 */

import {
  ref,
  onValue,
  set,
  remove,
  push,
  query,
  limitToLast,
  orderByChild,
  serverTimestamp,
} from 'firebase/database';
import { db } from '../firebase';
import { Role } from '../types/permissions';

export type UserRole = Role;

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
}

export interface UserAuditLogEntry {
  id: string;
  action: string;
  targetEmail: string;
  performedBy: string;
  oldRole: string;
  newRole: string;
  timestamp: string;
}

export class UserService {
  /**
   * Lắng nghe danh sách người dùng thời gian thực
   */
  subscribeUsers(onSuccess: (users: UserData[]) => void, onError?: (err: any) => void): () => void {
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
          role: (adminsData[key] ? 'ADMIN' : value.role || 'GUEST') as UserRole,
        }));
      onSuccess(userList);
    };

    const unsubUsers = onValue(
      usersRef,
      (snapshot) => {
        usersSnapshot = snapshot.val();
        syncData();
      },
      (error) => {
        console.error('Lỗi tải danh sách users:', error);
        if (onError) onError(error);
      }
    );

    const unsubAdmins = onValue(
      adminsRef,
      (snapshot) => {
        adminsSnapshot = snapshot.val();
        syncData();
      },
      (error) => {
        console.error('Lỗi tải danh sách admins:', error);
        if (onError) onError(error);
      }
    );

    return () => {
      unsubUsers();
      unsubAdmins();
    };
  }

  /**
   * Lắng nghe Audit Logs người dùng
   */
  subscribeUserAuditLogs(
    onSuccess: (logs: UserAuditLogEntry[]) => void,
    limitCount: number = 50
  ): () => void {
    const logsRef = query(
      ref(db, 'audit_logs'),
      orderByChild('timestamp'),
      limitToLast(limitCount)
    );
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loadedLogs = Object.entries(data)
          .map(([key, val]: [string, any]) => ({
            id: key,
            ...val,
          }))
          .sort(
            (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        onSuccess(loadedLogs);
      } else {
        onSuccess([]);
      }
    });
    return () => unsubscribe();
  }

  /**
   * Cập nhật vai trò người dùng kèm ghi vết Audit Trail
   */
  async updateUserRole(
    targetUid: string,
    targetEmail: string,
    currentRole: UserRole,
    newRole: UserRole,
    performedBy: string
  ): Promise<void> {
    await set(ref(db, `users/${targetUid}/role`), newRole);

    if (newRole === 'ADMIN') {
      await set(ref(db, `users/admins/${targetUid}`), true);
    } else {
      await remove(ref(db, `users/admins/${targetUid}`));
    }

    await push(ref(db, 'audit_logs'), {
      action: 'CHANGE_ROLE',
      targetUid,
      targetEmail,
      performedBy,
      oldRole: currentRole,
      newRole,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Xóa tài khoản người dùng kèm ghi vết Audit Trail
   */
  async deleteUser(targetUid: string, targetEmail: string, performedBy: string): Promise<void> {
    await remove(ref(db, `users/${targetUid}`));
    await remove(ref(db, `users/admins/${targetUid}`));

    await push(ref(db, 'audit_logs'), {
      action: 'DELETE_USER',
      targetUid,
      targetEmail,
      performedBy,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Tải ảnh đại diện người dùng lên Storage và cập nhật hồ sơ cá nhân
   */
  async uploadUserAvatar(user: any, file: File): Promise<string> {
    const { getStorage, ref: sRef, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const { updateProfile } = await import('firebase/auth');
    const storage = getStorage();
    const storageRef = sRef(storage, `avatars/${user.uid}_${Date.now()}`);
    await uploadBytes(storageRef, file);
    const photoURL = await getDownloadURL(storageRef);
    await updateProfile(user, { photoURL });
    return photoURL;
  }
}

export const userService = new UserService();
