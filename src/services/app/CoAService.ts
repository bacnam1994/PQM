/**
 * CoAService.ts
 * PQM Application Service - Điều phối tạo và xuất bản Phiếu kiểm nghiệm phân tích (Certificate of Analysis - CoA)
 * Tuân thủ 100% tài liệu:
 * - docs/business-rules/BR_06_COA_RULES.md (BR-COA-001 -> BR-COA-004)
 * - docs/specs/FRS_10_COA_GENERATION.md
 * -docs/contracts/COA_SNAPSHOT_CONTRACT.md
 */

import { Batch, TestResult, TCCS, EvaluationSnapshot } from '../../types';
import { verifyEvaluationSnapshotIntegrity } from '../../domain/evaluation/EvaluationSnapshotBuilder';
import { AlternateRuleResolver } from '../../domain/evaluation/AlternateRuleResolver';
import { logAuditAction } from '../auditService';
import { can } from '../permissionService';

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

    logAuditAction({
      action: 'CREATE',
      collection: 'COA_DOCUMENTS' as any,
      documentId: payload.coaNumber,
      details: `Sinh chứng nhận phân tích CoA: ${payload.coaNumber} cho Lô: ${payload.batchNumber} (Kết luận: ${payload.overallConclusion})`,
      performedBy: currentUser?.email || 'unknown',
    });

    return payload;
  }
}

export const coaService = new CoAService();
