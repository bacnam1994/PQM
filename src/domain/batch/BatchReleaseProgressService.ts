/**
 * BatchReleaseProgressService.ts
 * ===============================
 * Dịch vụ tính toán tiến trình 7 Release Gates và giai đoạn xuất xưởng (BatchReleaseStage).
 *
 * NGUYÊN TẮC THIẾT KẾ:
 * 1. Tách biệt hoàn toàn BatchReleaseStage khỏi Batch.status (lifecycle workflow).
 * 2. FIRST-FAIL RULE: Gate đầu tiên bị FAIL/BLOCKED = currentGate; không cộng điểm các gate phía sau.
 * 3. Idempotent: Cùng inputs → cùng outputs, không có side effects.
 * 4. Không hardcode Gate PASS, không bỏ Gate, không fake signature.
 * 5. RELEASED chỉ được set bởi BATCH_RELEASE_APPROVE qua BatchStateMachine; service này chỉ tính READY_TO_RELEASE.
 */

import { Batch, BatchReleaseStage, BatchReleaseGateProgress } from '../../types/batch';
import { TestResult } from '../../types';
import { QualityDeviation as Deviation } from '../../types';
import { TCCS } from '../../types';
import { ElectronicSignature } from '../../types/signature';
import { BatchReleaseDecisionService, ReleaseGateResult } from './BatchReleaseDecisionService';
import { DataFreshnessState } from './batchIntegrityValidator';

export interface ResolveBatchReleaseProgressParams {
  batch: Batch;
  testResults: TestResult[];
  deviations?: Deviation[];
  boundTccs?: TCCS | null;
  tccsList?: TCCS[];
  dataFreshness?: DataFreshnessState;
  userRole?: string;
  userSignature?: ElectronicSignature | null;
  signatures?: ElectronicSignature[];
}

export interface BatchReleaseProgress {
  /** Giai đoạn 7 Gate (canonical, không phải lifecycle status) */
  releaseStage: BatchReleaseStage;
  /** Chi tiết tiến trình số lượng */
  releaseGateProgress: BatchReleaseGateProgress;
  /** Kết quả từng Gate (1–7) để UI render */
  gateResults: ReleaseGateResult[];
  /** Đủ điều kiện để mở bước ký QA (Cổng 1-6 PASS, Cổng 7 đang chờ ký) */
  readyForSignature: boolean;
  /** Đủ điều kiện xuất xưởng hoàn toàn (toàn bộ 7/7 Cổng đã PASS) */
  readyForRelease: boolean;
  /** @deprecated Dùng readyForSignature hoặc readyForRelease để phân định rõ ràng */
  readyForFinalApproval: boolean;
  /** Timestamp tính toán */
  evaluatedAt: string;
}

/**
 * Ánh xạ từ số gate completed → BatchReleaseStage.
 * - NOT_STARTED: Batch chưa được dispatch testing (PENDING) hoặc chưa bắt đầu quá trình review.
 * - GATE_N: Batch đang TESTING nhưng bị blocked tại Gate N.
 * - READY_TO_RELEASE: Tất cả 7 Gate đều PASS (preview mode).
 * - RELEASED / REJECTED: Shortcut từ Batch.status.
 */
function stageFromCompleted(
  completed: number,
  batchStatus: Batch['status'],
  gatesEvaluated: boolean
): BatchReleaseStage {
  if (batchStatus === 'RELEASED') return 'RELEASED';
  if (batchStatus === 'REJECTED') return 'REJECTED';

  if (completed === 7) return 'READY_TO_RELEASE';

  // Batch PENDING và chưa có bất kỳ gate nào được đánh giá = chưa bắt đầu
  if (batchStatus === 'PENDING' && !gatesEvaluated) return 'NOT_STARTED';

  // Batch đang trong tiến trình (TESTING, BLOCKED) nhưng Gate 1 chưa qua
  if (completed === 0) return 'GATE_1'; // đang chờ Gate 1

  // completed 1–6 → waiting for Gate (completed+1)
  const waitingGate = completed + 1;
  const gateMap: Record<number, BatchReleaseStage> = {
    1: 'GATE_1',
    2: 'GATE_2',
    3: 'GATE_3',
    4: 'GATE_4',
    5: 'GATE_5',
    6: 'GATE_6',
    7: 'GATE_7',
  };
  return gateMap[waitingGate] ?? 'GATE_1';
}

export class BatchReleaseProgressService {
  public static readonly VERSION = '1.0.0-BATCH-RELEASE-PROGRESS';

  /**
   * Tính toán tiến trình 7 Release Gates theo FIRST-FAIL RULE.
   *
   * Thuật toán:
   * - Duyệt tuần tự Gate 1 → Gate 7 (preview mode, không cần chữ ký thực cho Gate 7).
   * - Nếu Gate i FAIL/BLOCKED → completed = i-1, currentGate = i, dừng lại.
   * - Nếu tất cả PASS → completed = 7, READY_TO_RELEASE.
   *
   * Gate 7 preview: isPreview=true → signaturePassed=true (Gate 7 sẽ được đánh giá đầy đủ
   * tại thời điểm BATCH_RELEASE_APPROVE với chữ ký thực).
   */
  public static resolveReleaseProgress(
    params: ResolveBatchReleaseProgressParams
  ): BatchReleaseProgress {
    const {
      batch,
      testResults = [],
      deviations = [],
      boundTccs,
      tccsList = [],
      dataFreshness = {},
      userRole,
      userSignature,
      signatures = [],
    } = params;

    const evaluatedAt = new Date().toISOString();

    // Phase 8: Xác định chữ ký canonical (documentType = BATCH_RELEASE, documentId = batch.id)
    let effectiveSignature = userSignature || null;
    if (!effectiveSignature) {
      const candidateSigs: ElectronicSignature[] = [
        ...(Array.isArray(signatures) ? signatures : []),
        ...(Array.isArray(batch.releaseSignatures) ? batch.releaseSignatures : []),
      ];
      const releaseSig = candidateSigs
        .filter((s) => s && s.documentType === 'BATCH_RELEASE' && s.documentId === batch.id)
        .sort((a, b) => (b.signedAt || '').localeCompare(a.signedAt || ''))[0];
      if (releaseSig) {
        effectiveSignature = releaseSig;
      }
    }

    // Batch đã released → bảo toàn trạng thái 7/7 Gates và trả về gateResults đầy đủ
    if (batch.status === 'RELEASED') {
      const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
        batch,
        testResults,
        deviations,
        boundTccs,
        tccsList,
        dataFreshness,
        userRole: userRole || effectiveSignature?.role,
        userSignature: effectiveSignature,
        isPreview: false,
      });

      const progress: BatchReleaseGateProgress = {
        completed: 7,
        total: 7,
        currentGate: 8,
        percentage: 100,
        evaluatedAt,
      };
      return {
        releaseStage: 'RELEASED',
        releaseGateProgress: progress,
        gateResults: decision.gates,
        readyForSignature: false,
        readyForRelease: true,
        readyForFinalApproval: false, // đã released
        evaluatedAt,
      };
    }

    if (batch.status === 'REJECTED') {
      const progress: BatchReleaseGateProgress = {
        completed: 0,
        total: 7,
        currentGate: 0,
        percentage: 0,
        evaluatedAt,
      };
      return {
        releaseStage: 'REJECTED',
        releaseGateProgress: progress,
        gateResults: [],
        readyForSignature: false,
        readyForRelease: false,
        readyForFinalApproval: false,
        evaluatedAt,
      };
    }

    // Chạy 7-Gate Decision
    const decision = BatchReleaseDecisionService.resolveBatchReleaseDecision({
      batch,
      testResults,
      deviations,
      boundTccs,
      tccsList,
      dataFreshness,
      userRole: userRole || effectiveSignature?.role,
      userSignature: effectiveSignature,
      isPreview: false,
    });

    const gates = decision.gates; // ReleaseGateResult[], luôn 7 phần tử

    // FIRST-FAIL RULE: đếm số gate PASS tuần tự từ Gate 1
    let completed = 0;
    let currentGate = 1; // Gate đang chờ (1-based)

    for (let i = 0; i < gates.length; i++) {
      if (gates[i].passed) {
        completed++;
        currentGate = i + 2; // next gate (i+1 is 0-based, gate is 1-based → i+2)
      } else {
        currentGate = i + 1; // this gate (0-based i → 1-based gate = i+1)
        break;
      }
    }

    // Nếu tất cả 7 PASS, currentGate = 8 (sentinel "done")
    if (completed === 7) currentGate = 8;
    if (completed === 0) currentGate = 1;

    const percentage = Math.round((completed / 7) * 100);
    const progress: BatchReleaseGateProgress = {
      completed,
      total: 7,
      currentGate,
      percentage,
      evaluatedAt,
    };

    const releaseStage = stageFromCompleted(completed, batch.status, gates.length > 0);

    // Phân định rạch ròi giữa readyForSignature và readyForRelease
    // 6/7: readyForSignature = true, readyForRelease = false
    // 7/7: readyForSignature = false, readyForRelease = true
    const gate1to6AllPass = gates.slice(0, 6).every((g) => g.passed);
    const all7Pass = completed === 7 && gates.every((g) => g.passed);

    const readyForSignature = gate1to6AllPass && !all7Pass;
    const readyForRelease = all7Pass;

    return {
      releaseStage,
      releaseGateProgress: progress,
      gateResults: gates,
      readyForSignature,
      readyForRelease,
      readyForFinalApproval: readyForSignature, // backward compatibility
      evaluatedAt,
    };
  }

  /**
   * Tạo snapshot BatchReleaseProgress để persist vào Firebase.
   * Chỉ serialize những gì cần thiết (không serialize toàn bộ decision).
   */
  public static toStoragePayload(
    progress: BatchReleaseProgress
  ): Pick<Batch, 'releaseStage' | 'releaseGateProgress'> {
    return {
      releaseStage: progress.releaseStage,
      releaseGateProgress: progress.releaseGateProgress,
    };
  }
}
