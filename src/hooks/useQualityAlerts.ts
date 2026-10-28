/**
 * useQualityAlerts.ts
 * Hook tự động phát hiện bất thường chất lượng từ dữ liệu hiện có.
 * Chạy client-side, sử dụng logic đã có trong reportService.ts.
 */
import { useAppStore } from '../store/useAppStore';
import { QualityAnomaly } from '../types';

export interface QualityAlertsResult {
  alerts: QualityAnomaly[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalCount: number;
  hasAlerts: boolean;
}

export const useQualityAlerts = (daysAhead = 30): QualityAlertsResult => {
  const alerts = useAppStore(state => state.qualityAlerts || []);

  const highCount = alerts.filter(a => a.severity === 'HIGH').length;
  const mediumCount = alerts.filter(a => a.severity === 'MEDIUM').length;
  const lowCount = alerts.filter(a => a.severity === 'LOW').length;

  return {
    alerts,
    highCount,
    mediumCount,
    lowCount,
    totalCount: alerts.length,
    hasAlerts: alerts.length > 0,
  };
};
