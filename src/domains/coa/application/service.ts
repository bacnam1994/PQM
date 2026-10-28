/**
 * COA DOMAIN: APPLICATION SERVICE
 * Điều phối tạo, ký duyệt và xuất bản Phiếu kiểm nghiệm phân tích (Certificate of Analysis - CoA)
 * Tuân thủ 100% tài liệu:
 * - docs/business-rules/BR_06_COA_RULES.md (BR-COA-001 -> BR-COA-004)
 * - docs/specs/FRS_10_COA_GENERATION.md
 * - docs/contracts/COA_SNAPSHOT_CONTRACT.md
 */

import {
  Batch,
  TestResult,
  TCCS,
  Product,
  EvaluationSnapshot,
  ElectronicSignature,
} from '../../../types';
import { CoARules } from '../domain/rules';
import {
  CoADocumentPayload,
  CoAVerificationData,
  GenerateCoAPayloadOptions,
  SignCoAOptions,
  RevokeCoAOptions,
} from '../domain/types';
import {
  testResultRepository,
  batchRepository,
  productRepository,
  tccsRepository,
  formulaRepository,
  signatureService,
} from '../infrastructure/repository';
import { logAuditAction } from '../../../services/auditService';
import { WorkflowFacade } from '../../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../../workflow/contracts/actions';

export class CoAService {
  /**
   * Tạo payload tài liệu CoA đọc 100% từ EvaluationSnapshot đã niêm phong (BR-COA-001)
   * TUYỆT ĐỐI CẤM TỰ TÍNH TOÁN LẠI CHỈ TIÊU HOẶC THAY ĐỔI KẾT QUẢ
   */
  public generateCoAPayload(options: GenerateCoAPayloadOptions): CoADocumentPayload {
    const { batch, testResult, tccs, currentUser } = options;

    if (!testResult.evaluationSnapshot) {
      throw new Error(
        'Từ chối phát hành CoA: Phiếu kiểm nghiệm chưa có Bản chụp thẩm định niêm phong (EvaluationSnapshot). Cần phê duyệt phiếu trước khi tạo CoA.'
      );
    }

    const snapshot: EvaluationSnapshot = testResult.evaluationSnapshot;

    // 1. Kiểm tra tính toàn vẹn chữ ký băm SHA-256 ALCOA+ (BR-COA-003)
    const isIntegrityValid = CoARules.verifySnapshotIntegrity(
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
    const boundTccs = tccs || batch.tccsSnapshot;
    const { criteriaList, footnotes } = CoARules.buildCriteriaAndFootnotes(snapshot, boundTccs);

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
  public async generateCoAPayloadAsync(
    options: GenerateCoAPayloadOptions
  ): Promise<CoADocumentPayload> {
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
  public async signCoA(
    options: SignCoAOptions
  ): Promise<{ coaNumber: string; signedAt: string; signature: ElectronicSignature }> {
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
  public async revokeCoA(
    options: RevokeCoAOptions
  ): Promise<{ coaNumber: string; revokedAt: string; reason: string }> {
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
        const validation = CoARules.validateRevocationReason(reason);
        if (!validation.isValid) {
          throw new Error(validation.error!);
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

  /**
   * Truy xuất toàn diện dữ liệu xác thực CoA công khai (BR-COA-004)
   */
  public async getCoAVerificationData(id: string): Promise<CoAVerificationData> {
    let trData: TestResult | null = await testResultRepository.findById(id);
    let currentBatch: Batch | null = null;
    let currentProduct: Product | null = null;
    let currentTccs: TCCS | null = null;
    let currentSignature: ElectronicSignature | null = null;

    if (!trData) {
      const bData = await batchRepository.findById(id);
      if (bData) {
        currentBatch = bData;
        const foundTests = await testResultRepository.findByRelation('batchId', bData.id);
        if (foundTests.length > 0) {
          trData = foundTests[0];
        }
      }
    }

    if (!trData) {
      return {
        testResult: null,
        batch: currentBatch,
        product: null,
        tccs: null,
        signature: null,
      };
    }

    if (trData.batchId && !currentBatch) {
      currentBatch = await batchRepository.findById(trData.batchId);
    }

    if (currentBatch?.productId) {
      currentProduct = await productRepository.findById(currentBatch.productId);
    }

    if (currentBatch?.tccsId) {
      currentTccs = await tccsRepository.findById(currentBatch.tccsId);
    }

    try {
      const docId = trData.id || currentBatch?.id;
      if (docId) {
        const sigs = await signatureService.getSignaturesForDocument('COA_ISSUE', docId);
        if (sigs.length > 0) {
          currentSignature = sigs[0];
        } else if (currentBatch) {
          const batchSigs = await signatureService.getSignaturesForDocument(
            'BATCH_RELEASE',
            currentBatch.id
          );
          if (batchSigs.length > 0) {
            currentSignature = batchSigs[0];
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi lấy chữ ký CoA:', e);
    }

    return {
      testResult: trData,
      batch: currentBatch,
      product: currentProduct,
      tccs: currentTccs,
      signature: currentSignature,
    };
  }

  public async fetchBatchFallback(batchId: string): Promise<Batch | null> {
    return batchRepository.findById(batchId);
  }

  public async fetchProductFallback(productId: string): Promise<Product | null> {
    return productRepository.findById(productId);
  }

  public async fetchTccsFallback(tccsId: string): Promise<TCCS | null> {
    return tccsRepository.findById(tccsId);
  }

  public async fetchFormulaFallback(formulaId: string): Promise<any | null> {
    return formulaRepository.findById(formulaId);
  }

  public async fetchFormulaByProductIdFallback(productId: string): Promise<any | null> {
    try {
      const formulas = await formulaRepository.findByRelation('productId', productId);
      return formulas.length > 0 ? formulas[0] : null;
    } catch (e) {
      console.warn('Formula fetch failed:', e);
      return null;
    }
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
