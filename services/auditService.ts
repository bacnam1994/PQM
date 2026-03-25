import { db } from '../firebase';
import { ref, push, serverTimestamp } from 'firebase/database';

export interface AuditLogEntry {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORE' | 'LOGIN';
  collection: 'PRODUCTS' | 'BATCHES' | 'TCCS' | 'TEST_RESULTS' | 'SYSTEM';
  documentId?: string;
  details: string;
  performedBy: string; // Email người thực hiện
  timestamp?: object;
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