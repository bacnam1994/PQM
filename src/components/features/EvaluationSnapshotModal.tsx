/**
 * EvaluationSnapshotModal.tsx
 * =============================
 * Giao diện xem và so sánh Evaluation Snapshot Lịch sử (Phase 5).
 * Tuân thủ tiêu chuẩn ALCOA+ Data Integrity trong Dược phẩm:
 * - Hiển thị snapshot thẩm định đã đóng băng tại thời điểm duyệt.
 * - So sánh phiên bản TCCS lúc kiểm nghiệm vs Phiên bản TCCS hiện tại.
 * - Kiểm tra tính toàn vẹn chữ ký băm (Evaluation Hash Integrity Verification).
 */

import React, { useMemo } from 'react';
import {
  ShieldCheckIcon,
  ClockIcon,
  UserIcon,
  DocumentCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ArrowsRightLeftIcon,
  KeyIcon,
} from '@heroicons/react/24/outline';
import { Modal } from '../ui/CommonUI';
import { TestResult, TCCS } from '../../types';
import { formatDateStandard } from '../../utils';
import { createEvaluationHash } from '../../domain/evaluation/EvaluationSnapshotBuilder';

interface EvaluationSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  testResult: TestResult | null;
  currentTccs?: TCCS | null;
}

export const EvaluationSnapshotModal: React.FC<EvaluationSnapshotModalProps> = ({
  isOpen,
  onClose,
  testResult,
  currentTccs,
}) => {
  const snapshot = testResult?.evaluationSnapshot;

  // Kiểm tra hash toàn vẹn
  const integrityVerification = useMemo(() => {
    if (!snapshot || !testResult) return { isValid: false, reason: 'Chưa có snapshot' };

    const recalculatedHash = createEvaluationHash({
      testResultId: testResult.id,
      batchId: testResult.batchId,
      overallStatus: snapshot.overallStatus,
      criterionResults: snapshot.criterionResults,
      evaluatedAt: snapshot.evaluatedAt,
      evaluatedBy: snapshot.evaluatedBy,
    });

    const isMatch = snapshot.evaluationHash === recalculatedHash;
    return {
      isValid: isMatch,
      hash: snapshot.evaluationHash,
      recalculatedHash,
      reason: isMatch
        ? 'Toàn vẹn ALCOA+ (Khớp mã băm)'
        : 'Cảnh báo: Dữ liệu có dấu hiệu bị can thiệp!',
    };
  }, [snapshot, testResult]);

  // So sánh TCCS version
  const tccsDiff = useMemo(() => {
    if (!snapshot) return null;
    const snapshotVer = snapshot.tccsVersion || 1;
    const currentVer = currentTccs?.version || 1;
    const isDifferent = snapshotVer !== currentVer;

    return {
      snapshotVer,
      currentVer,
      isDifferent,
      currentTccsName: currentTccs?.code || 'TCCS Hiện hành',
    };
  }, [snapshot, currentTccs]);

  if (!testResult) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lịch sử Thẩm định & Snapshot Toàn vẹn (ALCOA+)">
      <div className="space-y-6 text-sm">
        {/* Header Thông tin tổng quan */}
        <div className="bg-surface-2 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-ink">Phiếu: {testResult.id}</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  snapshot?.overallStatus === 'PASS'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                }`}
              >
                {snapshot?.overallStatus === 'PASS' ? 'ĐẠT TIÊU CHUẨN' : 'KHÔNG ĐẠT'}
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              Động cơ đánh giá:{' '}
              <code className="font-mono">{snapshot?.engineVersion || 'Legacy Engine'}</code>
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <div className="flex items-center gap-1">
              <UserIcon className="w-4 h-4 text-ink-muted" />
              <span>{snapshot?.evaluatedBy || 'System'}</span>
            </div>
            <div className="flex items-center gap-1">
              <ClockIcon className="w-4 h-4 text-ink-muted" />
              <span>
                {snapshot?.evaluatedAt ? formatDateStandard(snapshot.evaluatedAt) : '---'}
              </span>
            </div>
          </div>
        </div>

        {/* Verification Status Banner */}
        <div
          className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            integrityVerification.isValid
              ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 text-amber-800 dark:text-amber-200'
          }`}
        >
          {integrityVerification.isValid ? (
            <ShieldCheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="font-bold flex items-center justify-between">
              <span>{integrityVerification.reason}</span>
              <span className="text-xs font-mono opacity-80">
                {integrityVerification.hash
                  ? `Hash: ${integrityVerification.hash.substring(0, 16)}...`
                  : ''}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              Snapshot được đóng băng điện tử bất biến (Immutable Audit Trail) tại thời điểm duyệt.
            </p>
          </div>
        </div>

        {/* TCCS Version Comparison Alert */}
        {tccsDiff && tccsDiff.isDifferent && (
          <div className="p-3.5 bg-sky-50/80 border border-sky-200 dark:bg-sky-950/40 dark:border-sky-800 rounded-xl text-sky-800 dark:text-sky-200 flex items-start gap-3">
            <ArrowsRightLeftIcon className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-sm">
                Tiêu chuẩn TCCS đã có phiên bản mới hơn phiên bản thẩm định!
              </div>
              <p>
                Phiếu kiểm nghiệm này được thẩm định dựa trên{' '}
                <strong>TCCS v{tccsDiff.snapshotVer}</strong>. Hiện tại, sản phẩm đang áp dụng{' '}
                <strong>TCCS v{tccsDiff.currentVer}</strong>.
              </p>
              <p className="text-ink-muted">
                * Lưu ý: Kết quả thẩm định pháp lý ban đầu vẫn có hiệu lực vĩnh viễn theo nguyên tắc
                truy vết Dược điển (Good Documentation Practices).
              </p>
            </div>
          </div>
        )}

        {/* Bảng Chi tiết từng chỉ tiêu đóng băng */}
        <div>
          <h4 className="font-bold text-ink mb-2.5 flex items-center gap-2">
            <DocumentCheckIcon className="w-4 h-4 text-brand-600" />
            Kết quả Đánh giá Chi tiết Từng Chỉ tiêu (Frozen Snapshot)
          </h4>

          <div className="border border-border rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2 border-b border-border text-xs font-semibold text-ink-muted uppercase">
                  <th className="py-2.5 px-3.5">STT</th>
                  <th className="py-2.5 px-3.5">Tên Chỉ Tiêu</th>
                  <th className="py-2.5 px-3.5">Giá Trị Thực Đo</th>
                  <th className="py-2.5 px-3.5">Ngưỡng / Ghi Chú</th>
                  <th className="py-2.5 px-3.5 text-center">Kết Quả</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {snapshot?.criterionResults && snapshot.criterionResults.length > 0 ? (
                  snapshot.criterionResults.map((item, idx) => (
                    <tr key={idx} className="hover:bg-surface-2/50 transition-colors">
                      <td className="py-2 px-3.5 text-ink-muted font-mono">{idx + 1}</td>
                      <td className="py-2 px-3.5 font-medium text-ink">{item.criteriaName}</td>
                      <td className="py-2 px-3.5 font-mono text-ink">{item.value || '---'}</td>
                      <td className="py-2 px-3.5 text-ink-soft">{item.note || '---'}</td>
                      <td className="py-2 px-3.5 text-center">
                        {item.isPass ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <CheckCircleIcon className="w-4 h-4" /> Đạt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
                            <XCircleIcon className="w-4 h-4" /> K.Đạt
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-ink-muted">
                      Phiếu kiểm nghiệm cũ chưa khởi tạo Evaluation Snapshot chi tiết.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lý do / Cảnh báo nếu có */}
        {snapshot?.reasons && snapshot.reasons.length > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-200 text-xs">
            <span className="font-bold">Lý do thẩm định không đạt: </span>
            {snapshot.reasons.join('; ')}
          </div>
        )}
      </div>
    </Modal>
  );
};
