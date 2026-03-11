import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { logAuditAction as logActionService } from '../services/auditService';
import { AuditAction, AuditCollection } from '../types';

interface LogDetails {
  action: AuditAction;
  collection: AuditCollection;
  documentId?: string;
  details: string;
}

export const useAuditLog = () => {
  const { user } = useAuth();

  const log = useCallback(async (logData: LogDetails) => {
    try {
      await logActionService({
        ...logData,
        performedBy: user?.email || 'unknown_user',
      });
    } catch (error) {
      console.warn("Lỗi ghi nhật ký hệ thống:", error);
    }
  }, [user]);

  return { log };
};