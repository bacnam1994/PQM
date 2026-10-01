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
import { BatchReleaseDecisionService, ReleaseGateResult } from './BatchReleaseDecisionService';
import { DataFreshnessState } from './batchIntegrityValidator';

export interface ResolveBatchReleaseProgressParams {
  batch: Batch;
  testResults: TestResult[];
  deviations?: Deviation[];
  boundTccs?: TCCS | null;
  tccsList?: TCCS[];
  dataFreshness?: DataFreshnessState;
  /**
   * Không truyền userRole/signature vào đây – Gate 7 preview mode không cần chữ ký thực.
   * Chữ ký chỉ cần tại thời điểm BATCH_RELEASE_APPROVE thực sự.
   */
}

export interface BatchReleaseProgress {
  /** Giai đoạn 7 Gate (canonical, không phải lifecycle status) */
  releaseStage: BatchReleaseStage;
  /** Chi tiết tiến trình số lượng */
  releaseGateProgress: BatchReleaseGateProgress;
  /** Kết quả từng Gate (1–7) để UI render */
  gateResults: ReleaseGateResult[];
  /** Đủ điều kiện kích hoạt BATCH_RELEASE_APPROVE (chỉ khi 6/7 gate đầu PASS – Gate 7 tính khi ký) */
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
    } = params;

    const evaluatedAt = new Date().toISOString();

    // Batch đã released → shortcut
    if (batch.status === 'RELEASED') {
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
        gateResults: [],
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
        readyForFinalApproval: false,
        evaluatedAt,
      };
    }

    // Chạy 7-Gate Decision ở PREVIEW mode (không cần chữ ký thực)
    const decision = BatchReleaseDecisionService.evaluateReleasePreview({
      batch,
      testResults,
      deviations,
      boundTccs,
      tccsList,
      dataFreshness,
      // Không truyền userRole/signature: preview sẽ bỏ qua kiểm tra chữ ký Gate 7
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

    // readyForFinalApproval = Gate 1–6 đã PASS (Gate 7 sẽ được xác thực với chữ ký thực khi approve)
    // Không nghĩa là tất cả 7 PASS – Gate 7 preview không có chữ ký thực nên có thể false ở đây.
    const gate1to6AllPass = gates.slice(0, 6).every((g) => g.passed);

    return {
      releaseStage,
      releaseGateProgress: progress,
      gateResults: gates,
      readyForFinalApproval: gate1to6AllPass,
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
