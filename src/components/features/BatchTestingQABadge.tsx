import React, { useMemo } from 'react';
import { Batch, TestResult, TCCS } from '../../types';
import { CanonicalStatusResolver } from '../../domain/canonical/canonicalResolver';
import { useAppStore } from '../../store/useAppStore';

export interface BatchTestingQABadgeProps {
  batch: Batch;
  testResults?: TestResult[];
  tccs?: TCCS | null;
  className?: string;
}

/**
 * BatchTestingQABadge - Nhãn hỗ trợ QA trực quan khi Lô đang ở trạng thái TESTING
 *
 * Tuân thủ Master Workflow & Canonical Architecture:
 * - Lô trong DB vẫn giữ status là TESTING (Workflow Status).
 * - UI gọi CanonicalStatusResolver.resolveBatchQuality(batch, testResults, tccs).
 * - Nếu percentage === 100 và batchQualityStatus === 'PASS':
 *   Render nhãn màu xanh dương "Đã kiểm xong - Chờ QA duyệt" bên cạnh chữ TESTING.
 */
export const BatchTestingQABadge: React.FC<BatchTestingQABadgeProps> = ({
  batch,
  testResults,
  tccs,
  className = '',
}) => {
  const storeTestResults = useAppStore((state) => state.testResults);
  const storeTccsList = useAppStore((state) => state.tccsList);

  const isEligible = useMemo(() => {
    // 1. Lô trong DB phải giữ status là TESTING
    if (!batch || batch.status !== 'TESTING') {
      return false;
    }

    // 2. Lấy danh sách kết quả kiểm nghiệm liên quan
    const targetResults =
      testResults && testResults.length > 0
        ? testResults
        : (storeTestResults || []).filter((r) => r && r.batchId === batch.id);

    const boundTccs = tccs || (batch as any)?.tccs;

    try {
      // 3. Phân giải chất lượng chuẩn qua CanonicalStatusResolver (SSoT)
      const resolution = CanonicalStatusResolver.resolveBatchQuality(
        batch,
        targetResults,
        boundTccs,
        storeTccsList
      );

      const percentage = resolution.completion?.percentage ?? 0;
      const qualityStatus = resolution.batchQualityStatus;

      // 4. Điều kiện kích hoạt: Hoàn tất 100% chỉ tiêu VÀ chất lượng ĐẠT (PASS)
      return percentage === 100 && qualityStatus === 'PASS';
    } catch (err) {
      console.error('Lỗi khi phân giải chất lượng Lô trong BatchTestingQABadge:', err);
      return false;
    }
  }, [batch, testResults, tccs, storeTestResults, storeTccsList]);

  if (!isEligible) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-600/30 dark:ring-blue-500/40 shadow-xs transition-colors shrink-0 ${className}`}
      title="Đã kiểm nghiệm xong 100% chỉ tiêu đạt chuẩn theo Canonical Status Resolver — Chờ QA phê duyệt xuất xưởng"
      data-testid="batch-testing-qa-ready-badge"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse shrink-0" />
      <span>Đã kiểm xong - Chờ QA duyệt</span>
    </span>
  );
};

export default BatchTestingQABadge;
