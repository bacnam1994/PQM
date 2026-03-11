import { db } from '../firebase';
import { ref, push, serverTimestamp } from 'firebase/database';
import { AuditAction, AuditCollection } from '../types';

export interface AuditLogEntry {
  action: AuditAction;
  collection: AuditCollection;
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