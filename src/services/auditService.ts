import { db } from '../firebase';
import { ref, push, serverTimestamp, query, orderByChild, limitToLast, onValue, get } from 'firebase/database';

export interface AuditLogEntry {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORE' | 'LOGIN';
  collection: 'PRODUCTS' | 'BATCHES' | 'TCCS' | 'TEST_RESULTS' | 'SYSTEM' | 'CRITERIA_ALIASES' | 'MATERIALS';
  documentId?: string;
  details: string;
  performedBy: string; // Email người thực hiện
  timestamp?: number | object;
}

export interface AuditLogRecord extends Omit<AuditLogEntry, 'timestamp'> {
  id: string;
  timestamp: number;
}

/**
 * Ghi lại nhật ký hoạt động của người dùng
 */
export const logAuditAction = async (entry: Omit<AuditLogEntry, 'timestamp'>) => {
  try {
    const logsRef = ref(db, 'audit_logs');
    await push(logsRef, {
      ...entry,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to log audit action:", error);
    // Không throw error để tránh làm gián đoạn luồng chính
  }
};

/**
 * Lấy danh sách nhật ký hoạt động gần nhất
 */
export const fetchAuditLogs = async (limitCount: number = 100): Promise<AuditLogRecord[]> => {
  try {
    const logsQuery = query(ref(db, 'audit_logs'), orderByChild('timestamp'), limitToLast(limitCount));
    const snapshot = await get(logsQuery);
    if (!snapshot.exists()) return [];

    const data = snapshot.val();
    const records: AuditLogRecord[] = Object.keys(data).map(key => ({
      id: key,
      ...data[key],
      timestamp: typeof data[key].timestamp === 'number' ? data[key].timestamp : Date.now()
    }));

    // Sắp xếp mới nhất lên đầu
    return records.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return [];
  }
};

/**
 * Lắng nghe realtime các nhật ký hoạt động gần nhất
 */
export const subscribeAuditLogs = (
  callback: (logs: AuditLogRecord[]) => void,
  limitCount: number = 100
) => {
  const logsQuery = query(ref(db, 'audit_logs'), orderByChild('timestamp'), limitToLast(limitCount));
  return onValue(logsQuery, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const data = snapshot.val();
    const records: AuditLogRecord[] = Object.keys(data).map(key => ({
      id: key,
      ...data[key],
      timestamp: typeof data[key].timestamp === 'number' ? data[key].timestamp : Date.now()
    }));
    callback(records.sort((a, b) => b.timestamp - a.timestamp));
  }, (error) => {
    console.error("Error subscribing to audit logs:", error);
    callback([]);
  });
};