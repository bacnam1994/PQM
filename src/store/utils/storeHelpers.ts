import { ref, set as firebaseSet, remove as firebaseRemove } from 'firebase/database';
import { db } from '../../firebase';
import { parseNumberFromText } from '../../utils';
import { ProductFormula } from '../../types';

// --- QUẢN LÝ TIẾN TRÌNH GHI ---
let pendingWritesCount = 0;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (pendingWritesCount > 0) {
      e.preventDefault();
      e.returnValue = 'Dữ liệu đang được đồng bộ lên máy chủ. Bạn có chắc chắn muốn thoát?';
      return e.returnValue;
    }
  });
}

export interface MutationMeta {
  path: string;
  operation: 'SET' | 'UPDATE' | 'REMOVE';
  data?: any;
}

export const getPendingWritesCount = () => pendingWritesCount;

export const executeOfflineOptimistic = async (
  task: Promise<any>,
  get: () => any,
  _meta?: MutationMeta
) => {
  get().setSyncStatus('SAVING');
  pendingWritesCount++;
  try {
    await task;
    pendingWritesCount--;
    get().setSyncStatus('SAVED');
    setTimeout(() => get().setSyncStatus('IDLE'), 1500);
  } catch (e: any) {
    pendingWritesCount--;
    if (e?.code === 'unavailable' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      get().setSyncStatus('OFFLINE');
      return;
    }
    get().setSyncStatus('ERROR');
    throw e;
  }
};

export const removeUndefined = (obj: any): any => {
  if (obj === undefined) return null;
  if (typeof obj === 'number') {
    if (isNaN(obj) || !isFinite(obj)) return 0;
    return obj;
  }
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);

  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      const val = obj[key];
      if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) {
        result[key] = 0;
      } else {
        result[key] = removeUndefined(val);
      }
    }
  }
  return result;
};

export const handleSaveRecord = async (path: string, item: any, get: () => any) => {
  if (!item || !item.id) throw new Error('Dữ liệu không hợp lệ (Thiếu ID)');
  try {
    const cleanItem = removeUndefined(item);
    const targetPath = `${path}/${item.id}`;
    await executeOfflineOptimistic(firebaseSet(ref(db, targetPath), cleanItem), get, {
      path: targetPath,
      operation: 'SET',
      data: cleanItem,
    });
  } catch (error: any) {
    if (
      error.message &&
      (error.message.toLowerCase().includes('permission denied') ||
        error.code === 'PERMISSION_DENIED')
    ) {
      get().notify({
        type: 'ERROR',
        title: 'Lỗi phân quyền',
        message: `Lưu thất bại! Bạn không có quyền thực hiện hoặc dữ liệu vi phạm bảo mật.`,
      });
      get().setSyncStatus('IDLE');
    } else {
      get().notify({ type: 'ERROR', title: 'Lỗi lưu dữ liệu', message: error.message });
      get().setSyncStatus('ERROR');
    }
    throw error;
  }
};

/**
 * Phân giải danh tính người dùng hiện tại từ Zustand State
 * Đảm bảo luôn đính kèm vai trò (role) và cờ Admin đầy đủ cho các Application Services
 */
export const resolveCurrentIdentity = (state: any) => {
  if (!state) return null;
  const user = state.user;
  const isAdmin =
    !!state.isAdmin || state.role === 'ADMIN' || !!user?.isAdmin || user?.role === 'ADMIN';
  const role = isAdmin ? 'ADMIN' : user?.role || state.role || 'GUEST';

  if (!user) {
    if (isAdmin) {
      return {
        uid: 'admin-system',
        email: 'admin@v-biotech.local',
        displayName: 'Quản trị viên',
        role: 'ADMIN',
        isAdmin: true,
      };
    }
    return null;
  }

  return {
    ...user,
    role,
    isAdmin,
  };
};

export const handleDeleteRecord = async (
  path: string,
  id: string,
  get: () => any,
  requireAdmin: boolean = false
) => {
  if (requireAdmin && !(get().isAdmin || get().role === 'ADMIN')) {
    get().notify({
      type: 'ERROR',
      title: 'Từ chối truy cập',
      message: 'Chỉ Quản trị viên mới có quyền xóa dữ liệu này.',
    });
    throw new Error('Permission denied');
  }
  try {
    const targetPath = `${path}/${id}`;
    await executeOfflineOptimistic(firebaseRemove(ref(db, targetPath)), get, {
      path: targetPath,
      operation: 'REMOVE',
    });
  } catch (error: any) {
    if (
      error.message &&
      (error.message.toLowerCase().includes('permission denied') ||
        error.code === 'PERMISSION_DENIED')
    ) {
      get().notify({
        type: 'ERROR',
        title: 'Xóa thất bại',
        message: 'Bạn không có quyền xóa dữ liệu này.',
      });
      get().setSyncStatus('IDLE');
    } else {
      get().setSyncStatus('ERROR');
    }
    throw error;
  }
};

// Helper chuẩn hóa công thức trước khi lưu, bảo đảm không có NaN/Infinity gây lỗi Firebase RTDB
export const processFormulaBeforeSave = (formula: ProductFormula): ProductFormula => {
  const processed = { ...formula };
  const sanitizeFormulaItem = (item: any) => {
    if (!item) return item;
    const newItem = { ...item };

    // 1. Xử lý declaredContent: nếu là string, parse ra số; nếu NaN / không hợp lệ thì gán 0
    let dc = newItem.declaredContent;
    if (typeof dc === 'string') {
      const parsed = parseNumberFromText(dc);
      dc = isNaN(parsed) || !isFinite(parsed) ? 0 : parsed;
    } else if (typeof dc !== 'number' || isNaN(dc) || !isFinite(dc)) {
      dc = 0;
    }
    newItem.declaredContent = dc;

    // 2. Xử lý elementalContent: nếu có thì parse số hợp lệ, nếu không hợp lệ hoặc không có thì delete
    let ec = newItem.elementalContent;
    if (ec !== undefined && ec !== null && ec !== '') {
      if (typeof ec === 'string') {
        const parsed = parseNumberFromText(ec);
        ec = isNaN(parsed) || !isFinite(parsed) ? undefined : parsed;
      } else if (typeof ec !== 'number' || isNaN(ec) || !isFinite(ec)) {
        ec = undefined;
      }
    } else {
      ec = undefined;
    }

    if (ec !== undefined) {
      newItem.elementalContent = ec;
    } else {
      delete newItem.elementalContent;
    }

    // 3. Đảm bảo id và name
    if (!newItem.name) newItem.name = '';
    if (!newItem.unit) newItem.unit = '';

    return newItem;
  };

  if (processed.ingredients && Array.isArray(processed.ingredients)) {
    processed.ingredients = processed.ingredients.map(sanitizeFormulaItem);
  }
  if (processed.excipients && Array.isArray(processed.excipients)) {
    processed.excipients = processed.excipients.map(sanitizeFormulaItem);
  }
  return processed;
};
