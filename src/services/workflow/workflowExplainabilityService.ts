/**
 * PQM Workflow Explainability Service
 * Cung cấp giải trình lý do chặn/cho phép quy trình dưới dạng dữ liệu có cấu trúc (Structured Data).
 * Tuân thủ triệt để nguyên tắc: UI chỉ render kết quả, không tự tính toán quyết định nghiệp vụ.
 */

import { Batch } from '../../types/batch';
import { TestResult } from '../../types/testResult';
import { TCCS } from '../../types/tccs';
import { QualityDeviation } from '../../types/deviation';
import { Role } from '../../types/permissions';
import { ReleaseRules } from '../../domain/rules/ReleaseRules';
import { BatchRules } from '../../domain/rules/BatchRules';
import {
  BatchStateMachine,
  TestResultWorkflowStateMachine,
  QualityWorkflowMatrixGuard,
} from '../../domain/workflow/stateMachine';
import { resolveTestResultStatus } from '../../domain/test-result/testResultStatusResolver';
import { validateEvaluationSnapshot } from '../../domain/evaluation/EvaluationSnapshotBuilder';
import { can } from '../permissionService';

export type RegulatedWorkflowType =
  | 'BATCH_RELEASE'
  | 'BATCH_START_TESTING'
  | 'TEST_RESULT_APPROVAL'
  | 'TEST_RESULT_FINALIZE'
  | 'COA_ISSUE';

export interface WorkflowReasonItem {
  id: string;
  category:
    | 'AUTHORIZATION'
    | 'QUALITY'
    | 'SPECIFICATION'
    | 'STATE_MACHINE'
    | 'INTEGRITY'
    | 'DEVIATION';
  item: string;
  status: 'PASS' | 'FAIL' | 'PENDING' | 'ALLOWED' | 'BLOCKED' | 'NOT_APPLICABLE';
  message: string;
  blocking: boolean;
}

export interface WorkflowExplainabilityResult {
  entityId: string;
  entityType: 'BATCH' | 'TEST_RESULT';
  workflow: RegulatedWorkflowType;
  isAllowed: boolean;
  decision: 'ALLOWED' | 'BLOCKED';
  summary: string;
  reasons: WorkflowReasonItem[];
  evaluatedAt: string;
  evaluatedBy?: string;
}

export interface BatchReleaseExplainContext {
  batch: Batch;
  testResults: TestResult[];
  boundTccs?: TCCS | null;
  deviations?: QualityDeviation[];
  user?: { uid: string; role?: Role | string; email?: string; isAdmin?: boolean };
}

export interface TestResultApprovalExplainContext {
  testResult: TestResult;
  boundTccs?: TCCS | null;
  user?: { uid: string; role?: Role | string; email?: string; isAdmin?: boolean };
}

export class WorkflowExplainabilityService {
  /**
   * Giải trình lý do chặn hoặc cho phép Xuất xưởng Lô sản xuất (BATCH_RELEASE)
   */
  public static explainBatchRelease(ctx: BatchReleaseExplainContext): WorkflowExplainabilityResult {
    const { batch, testResults, boundTccs, deviations = [], user } = ctx;
    const reasons: WorkflowReasonItem[] = [];
    const evaluatedAt = new Date().toISOString();

    // 1. Kiểm tra thẩm quyền Authorization
    const hasRole = user?.role === 'QA' || user?.isAdmin || can(user, 'batch:release', batch);
    reasons.push({
      id: 'AUTH_ROLE',
      category: 'AUTHORIZATION',
      item: 'Thẩm quyền phê duyệt xuất xưởng',
      status: hasRole ? 'ALLOWED' : 'BLOCKED',
      message: hasRole
        ? `Người dùng ${user?.email || user?.uid || 'Unknown'} (Vai trò: ${user?.role}) có thẩm quyền xuất xưởng.`
        : `Vai trò "${user?.role || 'Chưa xác thực'}" không đủ thẩm quyền xuất xưởng (Yêu cầu QA hoặc Admin).`,
      blocking: !hasRole,
    });

    // 2. Kiểm tra trạng thái vòng đời Lô (State Machine)
    const transitionCheck = BatchStateMachine.canTransition(batch.status, 'RELEASED', {
      actorRole: user?.role,
      actorId: user?.uid,
      conditionsMet: true,
    });
    reasons.push({
      id: 'STATE_TRANSITION',
      category: 'STATE_MACHINE',
      item: 'Chuyển đổi trạng thái Lô',
      status: transitionCheck.allowed ? 'ALLOWED' : 'BLOCKED',
      message: transitionCheck.allowed
        ? `Lô hiện tại ở trạng thái ${batch.status}, cho phép chuyển tiếp sang RELEASED.`
        : `Không thể chuyển từ ${batch.status} sang RELEASED: ${transitionCheck.reason}`,
      blocking: !transitionCheck.allowed,
    });

    // 3. Kiểm tra liên kết TCCS
    const hasTccs = !!boundTccs || !!batch.tccsId || !!batch.tccsSnapshot;
    reasons.push({
      id: 'TCCS_LINK',
      category: 'SPECIFICATION',
      item: 'Liên kết Tiêu chuẩn cơ sở (TCCS)',
      status: hasTccs ? 'PASS' : 'BLOCKED',
      message: hasTccs
        ? `Lô liên kết với TCCS: ${boundTccs?.code || batch.tccsSnapshot?.code || batch.tccsId}.`
        : 'Lô chưa liên kết với bất kỳ Tiêu chuẩn cơ sở (TCCS) nào.',
      blocking: !hasTccs,
    });

    // 4. Kiểm tra Phiếu kiểm nghiệm & Chất lượng (Quality Evaluation)
    const releasePrereq = ReleaseRules.evaluateReleasePrerequisites({
      batch,
      testResults,
      deviations,
      userRole: user?.role,
      boundTccs,
    });

    const hasTestResults = testResults && testResults.length > 0;
    reasons.push({
      id: 'TEST_RESULTS_EXISTENCE',
      category: 'QUALITY',
      item: 'Tồn tại phiếu kiểm nghiệm',
      status: hasTestResults ? 'PASS' : 'BLOCKED',
      message: hasTestResults
        ? `Lô có ${testResults.length} phiếu kiểm nghiệm gắn kèm.`
        : 'Chưa có bất kỳ phiếu kiểm nghiệm nào gắn với Lô.',
      blocking: !hasTestResults,
    });

    // Thẩm tra từng phiếu kiểm nghiệm
    if (hasTestResults) {
      for (const tr of testResults) {
        const trQuality = resolveTestResultStatus(tr);
        const trWorkflow = tr.workflowStatus || 'DRAFT';
        const isApproved = trWorkflow === 'APPROVED';

        reasons.push({
          id: `TR_STATUS_${tr.id}`,
          category: 'QUALITY',
          item: `Phiếu kiểm nghiệm #${tr.id}`,
          status: trQuality === 'PASS' && isApproved ? 'PASS' : 'BLOCKED',
          message: `Phiếu #${tr.id}: Chất lượng = ${trQuality}, Quy trình = ${trWorkflow}${
            !isApproved ? ' (Chưa được QA phê duyệt APPROVED)' : ''
          }`,
          blocking: trQuality !== 'PASS' || !isApproved,
        });

        // Toàn vẹn snapshot
        if (tr.evaluationSnapshot) {
          const snapCheck = validateEvaluationSnapshot(tr.evaluationSnapshot, tr, boundTccs);
          reasons.push({
            id: `SNAPSHOT_${tr.id}`,
            category: 'INTEGRITY',
            item: `Mã băm niêm phong Snapshot #${tr.id}`,
            status: snapCheck.isValid ? 'PASS' : 'BLOCKED',
            message: snapCheck.isValid
              ? `Snapshot mã băm SHA-256 toàn vẹn (${tr.evaluationSnapshot.evaluationHash?.slice(0, 12)}...)`
              : `Snapshot không hợp lệ: ${snapCheck.reason}`,
            blocking: !snapCheck.isValid,
          });
        }
      }
    }

    // 5. Kiểm tra hồ sơ sai lệch chưa đóng
    const openDeviations = deviations.filter(
      (d) =>
        (d.batchId === batch.id || d.batchNo === batch.batchNo) &&
        d.severity === 'CRITICAL' &&
        d.status !== 'CLOSED'
    );
    const noDeviations = openDeviations.length === 0;
    reasons.push({
      id: 'DEVIATION_CHECK',
      category: 'DEVIATION',
      item: 'Hồ sơ sai lệch nghiêm trọng (OOS/CAPA)',
      status: noDeviations ? 'PASS' : 'BLOCKED',
      message: noDeviations
        ? 'Không có hồ sơ sai lệch nghiêm trọng chưa đóng.'
        : `Còn ${openDeviations.length} hồ sơ sai lệch nghiêm trọng đang mở chưa xử lý xong.`,
      blocking: !noDeviations,
    });

    const isAllowed = reasons.every((r) => !r.blocking);

    return {
      entityId: batch.id,
      entityType: 'BATCH',
      workflow: 'BATCH_RELEASE',
      isAllowed,
      decision: isAllowed ? 'ALLOWED' : 'BLOCKED',
      summary: isAllowed
        ? `Lô ${batch.batchNo} đủ điều kiện xuất xưởng (Release Approved).`
        : `Lô ${batch.batchNo} bị CHẶN xuất xưởng: ${reasons
            .filter((r) => r.blocking)
            .map((r) => r.message)
            .join('; ')}`,
      reasons,
      evaluatedAt,
      evaluatedBy: user?.email || user?.uid,
    };
  }

  /**
   * Giải trình lý do phê duyệt Phiếu kiểm nghiệm (TEST_RESULT_APPROVAL)
   */
  public static explainTestResultApproval(
    ctx: TestResultApprovalExplainContext
  ): WorkflowExplainabilityResult {
    const { testResult, boundTccs, user } = ctx;
    const reasons: WorkflowReasonItem[] = [];
    const evaluatedAt = new Date().toISOString();

    // 1. Phân quyền
    const hasQaRole = user?.role === 'QA' || user?.isAdmin;
    reasons.push({
      id: 'APPROVAL_AUTH',
      category: 'AUTHORIZATION',
      item: 'Quyền phê duyệt kiểm nghiệm',
      status: hasQaRole ? 'ALLOWED' : 'BLOCKED',
      message: hasQaRole
        ? `Người dùng ${user?.email || 'Unknown'} có quyền phê duyệt kiểm nghiệm.`
        : `Vai trò "${user?.role}" không có quyền phê duyệt phiếu kiểm nghiệm (Yêu cầu QA/ADMIN).`,
      blocking: !hasQaRole,
    });

    // 2. Chuyển trạng thái State Machine: Yêu cầu phiếu ở FINAL
    const currentWorkflow = testResult.workflowStatus || 'DRAFT';
    const transitionCheck = TestResultWorkflowStateMachine.canTransition(
      currentWorkflow,
      'APPROVED',
      { actorRole: user?.role }
    );
    reasons.push({
      id: 'APPROVAL_TRANSITION',
      category: 'STATE_MACHINE',
      item: 'Bước chuyển quy trình phiếu',
      status: transitionCheck.allowed ? 'ALLOWED' : 'BLOCKED',
      message: transitionCheck.allowed
        ? `Phiếu ở trạng thái ${currentWorkflow}, hợp lệ để chuyển sang APPROVED.`
        : `Không thể duyệt phiếu: ${transitionCheck.reason}`,
      blocking: !transitionCheck.allowed,
    });

    // 3. Ma trận Chất lượng x Quy trình (Quality x Workflow Matrix)
    const qualityStatus = resolveTestResultStatus(testResult);
    const matrixCheck = QualityWorkflowMatrixGuard.validate('APPROVED', qualityStatus);
    reasons.push({
      id: 'QUALITY_MATRIX',
      category: 'QUALITY',
      item: 'Ma trận Chất lượng x Quy trình',
      status: matrixCheck.allowed ? 'ALLOWED' : 'BLOCKED',
      message: matrixCheck.allowed
        ? `Chất lượng phiếu là ${qualityStatus}, hợp lệ để QA phê duyệt chính thức.`
        : `Không thể duyệt phiếu: ${matrixCheck.reason}`,
      blocking: !matrixCheck.allowed,
    });

    // 4. Toàn vẹn snapshot
    if (testResult.evaluationSnapshot) {
      const snapCheck = validateEvaluationSnapshot(
        testResult.evaluationSnapshot,
        testResult,
        boundTccs
      );
      reasons.push({
        id: 'APPROVAL_SNAPSHOT_INTEGRITY',
        category: 'INTEGRITY',
        item: 'Toàn vẹn mã băm ALCOA+',
        status: snapCheck.isValid ? 'PASS' : 'BLOCKED',
        message: snapCheck.isValid
          ? 'Snapshot mã băm SHA-256 toàn vẹn và bất biến.'
          : `Snapshot bị lỗi hoặc sai lệch: ${snapCheck.reason}`,
        blocking: !snapCheck.isValid,
      });
    }

    const isAllowed = reasons.every((r) => !r.blocking);

    return {
      entityId: testResult.id,
      entityType: 'TEST_RESULT',
      workflow: 'TEST_RESULT_APPROVAL',
      isAllowed,
      decision: isAllowed ? 'ALLOWED' : 'BLOCKED',
      summary: isAllowed
        ? `Phiếu kiểm nghiệm #${testResult.id} đủ điều kiện phê duyệt (QA Approval Allowed).`
        : `Phiếu kiểm nghiệm #${testResult.id} bị CHẶN phê duyệt: ${reasons
            .filter((r) => r.blocking)
            .map((r) => r.message)
            .join('; ')}`,
      reasons,
      evaluatedAt,
      evaluatedBy: user?.email || user?.uid,
    };
  }
}
