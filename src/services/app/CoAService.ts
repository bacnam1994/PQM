/**
 * CoAService.ts
 * PQM Application Service - Điều phối tạo và xuất bản Phiếu kiểm nghiệm phân tích (Certificate of Analysis - CoA)
 * Tuân thủ 100% tài liệu:
 * - docs/business-rules/BR_06_COA_RULES.md (BR-COA-001 -> BR-COA-004)
 * - docs/specs/FRS_10_COA_GENERATION.md
 * -docs/contracts/COA_SNAPSHOT_CONTRACT.md
 */

import { Batch, TestResult, TCCS, EvaluationSnapshot, ElectronicSignature } from '../../types';
import { verifyEvaluationSnapshotIntegrity } from '../../domain/evaluation/EvaluationSnapshotBuilder';
import { AlternateRuleResolver } from '../../domain/evaluation/AlternateRuleResolver';
import { logAuditAction } from '../auditService';
import { can } from '../permissionService';
import { WorkflowFacade } from '../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../workflow/contracts/actions';
import { signatureService } from '../signatureService';

export interface CoAFootnote {
  symbol: string;
  criterionName: string;
  text: string;
}

export interface CoADocumentPayload {
  coaNumber: string;
  batchNumber: string;
  productName: string;
  dosageForm?: string;
  packaging?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  testDate?: string;
  labName?: string;
  overallConclusion: 'ĐẠT TIÊU CHUẨN' | 'KHÔNG ĐẠT TIÊU CHUẨN';
  canonicalStatus: 'PASS' | 'FAIL';
  criteriaList: Array<{
    name: string;
    specification: string;
    result: string;
    isPass: boolean;
    isExempted?: boolean;
    note?: string;
    footnoteSymbol?: string;
  }>;
  footnotes: CoAFootnote[];
  alcoaHash: string;
  isIntegrityVerified: boolean;
  publishedAt: string;
  publishedBy: string;
}

export class CoAService {
  /**
   * Tạo payload tài liệu CoA đọc 100% từ EvaluationSnapshot đã niêm phong (BR-COA-001)
   * TUYỆT ĐỐI CẤM TỰ TÍNH TOÁN LẠI CHỈ TIÊU HOẶC THAY ĐỔI KẾT QUẢ
   */
  public generateCoAPayload(options: {
    batch: Batch;
    testResult: TestResult;
    tccs?: TCCS | null;
    currentUser: any;
  }): CoADocumentPayload {
    const { batch, testResult, tccs, currentUser } = options;

    if (!testResult.evaluationSnapshot) {
      throw new Error(
        'Từ chối phát hành CoA: Phiếu kiểm nghiệm chưa có Bản chụp thẩm định niêm phong (EvaluationSnapshot). Cần phê duyệt phiếu trước khi tạo CoA.'
      );
    }

    const snapshot: EvaluationSnapshot = testResult.evaluationSnapshot;

    // 1. Kiểm tra tính toàn vẹn chữ ký băm SHA-256 ALCOA+ (BR-COA-003)
    const isIntegrityValid = verifyEvaluationSnapshotIntegrity(
      snapshot,
      testResult.id,
      testResult.batchId
    );

    if (!isIntegrityValid) {
      throw new Error(
        'CẢNH BÁO BẢO MẬT: Chữ ký băm toàn vẹn (SHA-256 Hash) của Snapshot không khớp. Dữ liệu đã bị can thiệp trái phép!'
      );
    }

    // 2. Tự động thu thập Footnote cho các chỉ tiêu Thay thế / Miễn kiểm (BR-COA-002)
    const footnotes: CoAFootnote[] = [];
    let footnoteCounter = 1;

    const boundTccs = tccs || batch.tccsSnapshot;
    const alternateNotesMap = boundTccs?.alternateRules
      ? AlternateRuleResolver.generateAlternateRuleNotes(boundTccs.alternateRules)
      : [];

    const criteriaList = snapshot.criterionResults.map((entry) => {
      let footnoteSymbol: string | undefined;

      if (entry.alternateState && entry.alternateState !== 'NONE') {
        footnoteSymbol = `(*${footnoteCounter++})`;
        let noteText = entry.alternateNote;

        if (!noteText && boundTccs && alternateNotesMap.length > 0) {
          noteText = alternateNotesMap[0];
        }

        if (!noteText) {
          noteText =
            entry.alternateState === 'EXEMPTED'
              ? 'Chỉ tiêu được miễn kiểm tra theo quy định của Tiêu chuẩn cơ sở đã phê duyệt.'
              : 'Chỉ tiêu đạt tiêu chuẩn sau khi thực hiện phép thử bổ sung/thay thế.';
        }

        footnotes.push({
          symbol: footnoteSymbol,
          criterionName: entry.criteriaName,
          text: noteText,
        });
      }

      const displayResult =
        entry.alternateState === 'EXEMPTED'
          ? `Miễn kiểm ${footnoteSymbol || ''}`
          : String(entry.value ?? '');

      return {
        name: entry.criteriaName,
        specification: entry.note || '',
        result: displayResult,
        isPass: entry.isPass !== false,
        isExempted: entry.alternateState === 'EXEMPTED',
        note: entry.note,
        footnoteSymbol,
      };
    });

    const isPass = snapshot.overallStatus === 'PASS';
    const now = new Date().toISOString();

    const payload: CoADocumentPayload = {
      coaNumber: `COA-${batch.batchNo || batch.id}-${new Date().getFullYear()}`,
      batchNumber: batch.batchNo || batch.id,
      productName: (batch as any).productName || 'Sản phẩm',
      manufacturingDate: batch.mfgDate || (batch as any).manufacturingDate,
      expiryDate: batch.expDate || (batch as any).expiryDate,
      testDate: testResult.testDate,
      labName: testResult.labName,
      overallConclusion: isPass ? 'ĐẠT TIÊU CHUẨN' : 'KHÔNG ĐẠT TIÊU CHUẨN',
      canonicalStatus: isPass ? 'PASS' : 'FAIL',
      criteriaList,
      footnotes,
      alcoaHash: snapshot.evaluationHash,
      isIntegrityVerified: isIntegrityValid,
      publishedAt: now,
      publishedBy: currentUser?.email || 'system',
    };

    // Dispatch outbox event for ALCOA+ compliance
    const actor = this.toActor(currentUser);
    WorkflowFacade.dispatch(
      {
        actionId: 'COA_GENERATE',
        entityType: 'COA',
        entityId: payload.coaNumber,
        actor,
        payload,
        reason: `Sinh chứng nhận phân tích CoA: ${payload.coaNumber} cho Lô: ${payload.batchNumber} (Kết luận: ${payload.overallConclusion})`,
      },
      async () => payload
    ).catch(() => {});

    return payload;
  }

  /**
   * Tạo payload tài liệu CoA bất đồng bộ qua Workflow Engine Kernel
   */
  public async generateCoAPayloadAsync(options: {
    batch: Batch;
    testResult: TestResult;
    tccs?: TCCS | null;
    currentUser: any;
  }): Promise<CoADocumentPayload> {
    const payload = this.generateCoAPayload(options);
    const actor = this.toActor(options.currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'COA_GENERATE',
        entityType: 'COA',
        entityId: payload.coaNumber,
        actor,
        payload,
        reason: `Sinh chứng nhận phân tích CoA: ${payload.coaNumber} cho Lô: ${payload.batchNumber} (Kết luận: ${payload.overallConclusion})`,
      },
      async () => payload
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi điều phối COA_GENERATE qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * QA Ký số ban hành chứng chỉ CoA điện tử qua Workflow Kernel (COA_SIGN)
   */
  public async signCoA(options: {
    coaNumber: string;
    batchNumber: string;
    signature: ElectronicSignature;
    currentUser: any;
  }): Promise<{ coaNumber: string; signedAt: string; signature: ElectronicSignature }> {
    const { coaNumber, batchNumber, signature, currentUser } = options;
    const actor = this.toActor(currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'COA_SIGN',
        entityType: 'COA',
        entityId: coaNumber,
        actor,
        payload: { coaNumber, batchNumber },
        signature,
        reason: `Ký số thẩm duyệt chứng nhận CoA: ${coaNumber} cho Lô: ${batchNumber}`,
      },
      async () => {
        const isValid = await signatureService.verifySignatureIntegrity(signature);
        if (!isValid) {
          throw new Error('Chữ ký điện tử thẩm duyệt CoA không hợp lệ hoặc đã bị can thiệp.');
        }

        logAuditAction({
          action: 'UPDATE',
          collection: 'COA_DOCUMENTS' as any,
          documentId: coaNumber,
          details: `Ký số ban hành chứng nhận phân tích CoA: ${coaNumber} (Người ký: ${currentUser?.email})`,
          performedBy: currentUser?.email || 'unknown',
        });

        return {
          coaNumber,
          signedAt: new Date().toISOString(),
          signature,
        };
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi điều phối COA_SIGN qua Workflow.');
    }

    return execution.data!;
  }

  /**
   * Thu hồi hiệu lực chứng nhận CoA đã ban hành (COA_REVOKE)
   */
  public async revokeCoA(options: {
    coaNumber: string;
    reason: string;
    currentUser: any;
    signature?: ElectronicSignature;
  }): Promise<{ coaNumber: string; revokedAt: string; reason: string }> {
    const { coaNumber, reason, currentUser, signature } = options;
    const actor = this.toActor(currentUser);

    const execution = await WorkflowFacade.dispatch(
      {
        actionId: 'COA_REVOKE',
        entityType: 'COA',
        entityId: coaNumber,
        actor,
        payload: { coaNumber, reason },
        reason,
        signature,
      },
      async () => {
        if (!reason || reason.trim().length < 20) {
          throw new Error(
            'ERR_REVOCATION_REASON_TOO_SHORT: Lý do thu hồi CoA phải tối thiểu 20 ký tự giải trình.'
          );
        }

        logAuditAction({
          action: 'UPDATE',
          collection: 'COA_DOCUMENTS' as any,
          documentId: coaNumber,
          details: `Thu hồi hiệu lực chứng nhận CoA: ${coaNumber}. Lý do: ${reason}`,
          performedBy: currentUser?.email || 'unknown',
        });

        return {
          coaNumber,
          revokedAt: new Date().toISOString(),
          reason,
        };
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi điều phối COA_REVOKE qua Workflow.');
    }

    return execution.data!;
  }

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'QA')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || currentUser?.email || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || currentUser?.email || 'User',
      role: rawRole,
      email: currentUser?.email || 'unknown@v-biotech.com',
      isAdmin: currentUser?.isAdmin || rawRole === 'ADMIN',
    } as any;
  }
}

export const coaService = new CoAService();
