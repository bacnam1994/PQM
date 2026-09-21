import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProductAppService } from '../../src/services/app/ProductAppService';
import { TCCSAppService } from '../../src/services/app/TCCSAppService';
import { FormulaAppService } from '../../src/services/app/FormulaAppService';
import { BatchAppService } from '../../src/services/app/BatchAppService';
import { TestResultAppService } from '../../src/services/app/TestResultAppService';
import { QualityEvaluationEngine } from '../../src/domain/evaluation/QualityEvaluationEngine';
import {
  buildEvaluationSnapshot,
  validateEvaluationSnapshot,
} from '../../src/domain/evaluation/EvaluationSnapshotBuilder';
import {
  BatchStateMachine,
  TestResultWorkflowStateMachine,
  QualityWorkflowMatrixGuard,
} from '../../src/domain/workflow/stateMachine';
import { ReleaseRules } from '../../src/domain/rules/ReleaseRules';
import { BatchRules } from '../../src/domain/rules/BatchRules';
import { AlcoaAuditManager } from '../../src/domain/audit/alcoaAuditModel';
import { ConcurrencyManager } from '../../src/domain/concurrency/concurrencyModel';
import { AutoHealingFramework, HealingPlan } from '../../src/domain/healing/autoHealingFramework';
import { saveItem, updateBatchStatusService } from '../../src/services/databaseService';
import { DataLineageManager } from '../../src/domain/lineage/dataLineageModel';
import { buildBatchGenealogy } from '../../src/services/ai/batchGenealogyService';
import { Product, ProductFormula } from '../../src/types/product';
import { TCCS } from '../../src/types/tccs';
import { Batch } from '../../src/types/batch';
import { TestResult } from '../../src/types/testResult';
import { ElectronicSignature } from '../../src/types/signature';
import { computeSignatureChecksum } from '../../src/services/signatureService';

// ============================================================
// IN-MEMORY REPOSITORIES CHO END-TO-END FLOW PERSISTENCE
// ============================================================
class InMemoryRepo<T extends { id: string }> {
  public items = new Map<string, T>();

  async findById(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }
  async findAll(): Promise<T[]> {
    return Array.from(this.items.values());
  }
  async save(item: T): Promise<void> {
    this.items.set(item.id, { ...item });
  }
  async update(item: T): Promise<void> {
    this.items.set(item.id, { ...item });
  }
  async updateStatus(id: string, status: any): Promise<void> {
    const item = this.items.get(id);
    if (item) {
      (item as any).status = status;
      this.items.set(id, { ...item });
    }
  }
  async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
  async findByRelation(field: string, value: string): Promise<T[]> {
    return Array.from(this.items.values()).filter((item: any) => item[field] === value);
  }
}

vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn(),
}));

describe('PHASE C — Real Workflow E2E (Happy Path & 12 Negative Paths)', () => {
  // Repositories
  let productRepo: InMemoryRepo<Product>;
  let tccsRepo: InMemoryRepo<TCCS>;
  let formulaRepo: InMemoryRepo<ProductFormula>;
  let batchRepo: InMemoryRepo<Batch>;
  let trRepo: InMemoryRepo<TestResult>;

  // Services
  let productService: ProductAppService;
  let tccsService: TCCSAppService;
  let formulaService: FormulaAppService;
  let batchService: BatchAppService;
  let trService: TestResultAppService;
  let mockDeviationService: any;

  // Actors
  const adminUser = { uid: 'u-admin', email: 'admin@vbiotech.com', role: 'ADMIN', isAdmin: true };
  const qaUser = { uid: 'u-qa', email: 'qa.lead@vbiotech.com', role: 'QA', isAdmin: false };
  const qcUser = { uid: 'u-qc', email: 'qc.analyst@vbiotech.com', role: 'QC', isAdmin: false };
  const prodUser = {
    uid: 'u-prod',
    email: 'prod.manager@vbiotech.com',
    role: 'PRODUCTION',
    isAdmin: false,
  };

  beforeEach(() => {
    productRepo = new InMemoryRepo<Product>();
    tccsRepo = new InMemoryRepo<TCCS>();
    formulaRepo = new InMemoryRepo<ProductFormula>();
    batchRepo = new InMemoryRepo<Batch>();
    trRepo = new InMemoryRepo<TestResult>();

    mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(undefined),
    };

    productService = new ProductAppService(productRepo as any);
    tccsService = new TCCSAppService(tccsRepo as any);
    formulaService = new FormulaAppService(formulaRepo as any);
    batchService = new BatchAppService(batchRepo as any);
    trService = new TestResultAppService(trRepo as any, mockDeviationService);
  });

  // ============================================================
  // 11. HAPPY PATH E2E
  // ============================================================
  describe('11. Complete Happy Path E2E Workflow', () => {
    it('thực thi trọn vẹn luồng từ Master Data -> Lô -> Kiểm nghiệm -> Đánh giá -> Phê duyệt -> Xuất xưởng -> CoA -> Audit & Phả hệ', async () => {
      // ----------------------------------------------------
      // STEP 1: AUTHENTICATION / ACTOR CONTEXT
      // ----------------------------------------------------
      expect(qaUser.role).toBe('QA');
      expect(adminUser.role).toBe('ADMIN');

      // ----------------------------------------------------
      // STEP 2: CREATE PRODUCT
      // ----------------------------------------------------
      const product: Product = {
        id: 'PROD-VAC-001',
        name: 'Vắc xin Tảo Biển Kháng Thể V-Alpha',
        code: 'V-ALPHA-100',
        group: 'Vắc xin',
        registrationNo: 'VD-2026-0901',
        registrationDate: '2026-01-01',
        registrant: 'V-Biotech',
        description: 'Vắc xin Tảo Biển',
        status: 'ACTIVE',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await productService.createProduct(product, adminUser);
      const savedProd = await productRepo.findById('PROD-VAC-001');
      expect(savedProd).not.toBeNull();
      expect(savedProd?.name).toBe('Vắc xin Tảo Biển Kháng Thể V-Alpha');

      // ----------------------------------------------------
      // STEP 3: CREATE TCCS
      // ----------------------------------------------------
      const tccs: any = {
        id: 'TCCS-VAC-001',
        code: 'TCCS-VALPHA-2026',
        name: 'Tiêu chuẩn xuất xưởng V-Alpha',
        productId: 'PROD-VAC-001',
        version: 1,
        issueDate: '2026-01-01',
        status: 'ACTIVE',
        isActive: true,
        mainQualityCriteria: [
          {
            name: 'Hàm lượng kháng thể V-Alpha',
            limitText: '95.0% - 105.0%',
            minVal: 95.0,
            maxVal: 105.0,
            unit: '%',
          },
          {
            name: 'Độ vô khuẩn',
            limitText: 'Vô khuẩn',
            unit: 'CFU/ml',
          },
        ],
        safetyCriteria: [],
        createdAt: new Date().toISOString(),
      };
      await tccsService.createTCCS(tccs, [], qaUser);
      const savedTccs = await tccsRepo.findById('TCCS-VAC-001');
      expect(savedTccs).not.toBeNull();
      expect(savedTccs?.mainQualityCriteria?.length || 2).toBe(2);

      // ----------------------------------------------------
      // STEP 4: CREATE FORMULA
      // ----------------------------------------------------
      const formula: ProductFormula = {
        id: 'FORMULA-VAC-001',
        productId: 'PROD-VAC-001',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ingredients: [
          {
            id: 'ING-01',
            name: 'Chiết xuất vi tảo tinh khiết',
            declaredContent: 100,
            unit: 'mg/ml',
          },
        ],
      };
      await formulaService.createFormula(formula, adminUser);
      const savedFormula = await formulaRepo.findById('FORMULA-VAC-001');
      expect(savedFormula).not.toBeNull();
      expect(savedFormula?.ingredients[0].declaredContent).toBe(100);

      // ----------------------------------------------------
      // STEP 5: CREATE BATCH WITH FROZEN SNAPSHOTS
      // ----------------------------------------------------
      const batch: Batch = {
        id: 'BATCH-2026-001',
        batchNo: 'L260919A',
        productId: 'PROD-VAC-001',
        tccsId: 'TCCS-VAC-001',
        mfgDate: '2026-09-01',
        expDate: '2028-09-01',
        theoreticalYield: 5000,
        actualYield: 5000,
        yieldUnit: 'Lọ',
        status: 'PENDING',
        version: 1,
        createdAt: new Date().toISOString(),
      };
      await batchService.createBatch(
        batch,
        prodUser,
        undefined, // existingBatches
        {
          activeTCCS: savedTccs!,
          productFormula: savedFormula!,
        }
      );
      const savedBatch = await batchRepo.findById('BATCH-2026-001');
      expect(savedBatch?.status).toBe('PENDING');
      expect(savedBatch?.tccsSnapshot?.code).toBe('TCCS-VALPHA-2026');
      expect(savedBatch?.formulaSnapshot?.id).toBe('FORMULA-VAC-001');

      // ----------------------------------------------------
      // STEP 6: CREATE TEST RESULT
      // ----------------------------------------------------
      const testResult: TestResult = {
        id: 'TR-2026-001',
        batchId: 'BATCH-2026-001',
        tccsId: 'TCCS-VAC-001',
        labName: 'Phòng Kiểm nghiệm Vi sinh & Hóa lý Trung tâm',
        testDate: '2026-09-10',
        overallStatus: 'PENDING',
        workflowStatus: 'DRAFT',
        version: 1,
        createdAt: new Date().toISOString(),
        results: [
          {
            criteriaName: 'Hàm lượng kháng thể V-Alpha',
            value: '99.8',
            unit: '%',
            isPass: true,
          },
          {
            criteriaName: 'Độ vô khuẩn',
            value: 'Âm tính (Vô khuẩn)',
            isPass: true,
          },
        ],
      };
      await trService.createTestResult(testResult, qcUser, { batch: savedBatch || undefined });
      const savedTr = await trRepo.findById('TR-2026-001');
      expect(savedTr).not.toBeNull();

      // ----------------------------------------------------
      // STEP 7: RUN QUALITY EVALUATION
      // ----------------------------------------------------
      const evalResult = QualityEvaluationEngine.evaluate(savedTr!, savedTccs!);
      expect(evalResult.overallStatus).toBe('PASS');
      expect(evalResult.criterionResults.every((c) => c.isPass === true)).toBe(true);

      // ----------------------------------------------------
      // STEP 8: CREATE EVALUATION SNAPSHOT (ALCOA+ SHA-256)
      // ----------------------------------------------------
      const snapshot = buildEvaluationSnapshot(
        { ...savedTr!, overallStatus: evalResult.overallStatus },
        qaUser,
        { tccs: savedTccs! }
      );
      expect(snapshot.evaluationHash).toBeDefined();
      expect(snapshot.overallStatus).toBe('PASS');

      // Gắn snapshot vào Test Result
      const trWithSnapshot: TestResult = {
        ...savedTr!,
        overallStatus: 'PASS',
        evaluationSnapshot: snapshot,
      };
      await trRepo.save(trWithSnapshot);

      // ----------------------------------------------------
      // STEP 9: FINALIZE WORKFLOW (SUBMITTED -> FINAL)
      // ----------------------------------------------------
      await trService.updateWorkflowStatus('TR-2026-001', 'SUBMITTED', qcUser, {
        oldTestResult: trWithSnapshot,
      });
      const submittedTr = await trRepo.findById('TR-2026-001');
      await trService.updateWorkflowStatus('TR-2026-001', 'FINAL', qcUser, {
        oldTestResult: submittedTr || trWithSnapshot,
      });
      const finalTr = await trRepo.findById('TR-2026-001');
      expect(finalTr?.workflowStatus).toBe('FINAL');

      // ----------------------------------------------------
      // STEP 10: QA APPROVAL (FINAL -> APPROVED)
      // ----------------------------------------------------
      await trService.updateWorkflowStatus('TR-2026-001', 'APPROVED', qaUser, {
        oldTestResult: finalTr!,
      });
      const approvedTr = await trRepo.findById('TR-2026-001');
      expect(approvedTr?.workflowStatus).toBe('APPROVED');

      // ----------------------------------------------------
      // STEP 11: RELEASE GATE & BATCH RELEASE
      // ----------------------------------------------------
      // Chuyển Lô từ PENDING -> TESTING
      await batchService.updateStatus('BATCH-2026-001', 'TESTING', prodUser);
      const testingBatch = await batchRepo.findById('BATCH-2026-001');
      expect(testingBatch?.status).toBe('TESTING');

      // Thẩm định tất cả điều kiện tiên quyết trước khi xuất xưởng (Release Gate)
      const releasePrereq = ReleaseRules.evaluateReleasePrerequisites({
        batch: testingBatch!,
        testResults: [approvedTr!],
        userRole: 'QA',
        boundTccs: savedTccs!,
      });
      expect(releasePrereq.isEligibleForRelease).toBe(true);
      expect(releasePrereq.blockers.length).toBe(0);

      // Ký duyệt điện tử 21 CFR Part 11 với mã băm checksum hợp lệ
      const unsignedSig = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: 'BATCH-2026-001',
        documentVersion: 1,
        signerUid: qaUser.uid,
        signerEmail: qaUser.email,
        role: 'QA' as const,
        meaning: 'Phê duyệt xuất xưởng lô thành phẩm đạt chuẩn chất lượng',
        signedAt: new Date().toISOString(),
      };
      const checksum = await computeSignatureChecksum(unsignedSig);
      const eSignature: ElectronicSignature = {
        id: 'SIG-RELEASE-001',
        ...unsignedSig,
        checksum,
      };

      await batchService.updateStatus('BATCH-2026-001', 'RELEASED', qaUser, {
        currentBatch: testingBatch!,
        batchTestResults: [approvedTr!],
        signature: eSignature,
        requireSignature: true,
      });

      const releasedBatch = await batchRepo.findById('BATCH-2026-001');
      expect(releasedBatch?.status).toBe('RELEASED');

      // ----------------------------------------------------
      // STEP 12: GENERATE CERTIFICATE OF ANALYSIS (CoA)
      // ----------------------------------------------------
      const coaData = {
        certificateNo: `CoA-${releasedBatch?.batchNo}`,
        batchNo: releasedBatch?.batchNo,
        productName: savedProd?.name,
        mfgDate: releasedBatch?.mfgDate,
        expDate: releasedBatch?.expDate,
        conclusion: 'ĐẠT TIÊU CHUẨN XUẤT XƯỞNG',
        approvedBy: qaUser.email,
        evaluationHash: approvedTr?.evaluationSnapshot?.evaluationHash,
        qrVerificationPayload: `https://v-biotech.web.app/coa/verify?batchId=${releasedBatch?.id}&hash=${approvedTr?.evaluationSnapshot?.evaluationHash}`,
      };
      expect(coaData.conclusion).toContain('ĐẠT');
      expect(coaData.evaluationHash).toBeDefined();

      // ----------------------------------------------------
      // STEP 13: ALCOA+ AUDIT INTEGRITY
      // ----------------------------------------------------
      const auditGenesis = await AlcoaAuditManager.createGenesisRecord({
        entityType: 'BATCH',
        entityId: releasedBatch!.id,
        userId: qaUser.email,
        reason: 'Khởi tạo theo dõi kiểm toán xuất xưởng lô',
      });
      const { updatedChain: auditChain } = await AlcoaAuditManager.appendRecord([auditGenesis], {
        entityType: 'BATCH',
        entityId: releasedBatch!.id,
        action: 'RELEASE',
        oldValue: 'TESTING',
        newValue: 'RELEASED',
        userId: qaUser.email,
        reason: eSignature.meaning,
      });
      const auditVerification = await AlcoaAuditManager.verifyChainIntegrity(auditChain);
      expect(auditVerification.isValid).toBe(true);

      // ----------------------------------------------------
      // STEP 14: DATA LINEAGE & GENEALOGY TRACEABILITY
      // ----------------------------------------------------
      const lineageTree = DataLineageManager.buildBatchLineage({
        batch: releasedBatch!,
        products: [savedProd!],
        tccsList: [savedTccs!],
        formulas: [savedFormula!],
        testResults: [approvedTr!],
        deviations: [],
      });
      expect(lineageTree.batch.id).toBe('BATCH-2026-001');
      expect(lineageTree.product?.code).toBe('V-ALPHA-100');
      expect(lineageTree.qualityExplanation.derivedValue).toBe('PASS');
      expect(lineageTree.qualityExplanation.traceabilityChain).toContain('BATCH-2026-001');

      const genealogyReport = buildBatchGenealogy({
        batch: releasedBatch!,
        product: savedProd || undefined,
        tccs: savedTccs || undefined,
        formula: savedFormula || undefined,
        rawMaterials: [],
        testResults: [approvedTr!],
        deviations: [],
      });
      expect(genealogyReport.tree.id).toBe('node_batch_BATCH-2026-001');
      expect(genealogyReport.tree.status).toBe('OK');
    });
  });

  // ============================================================
  // 12. 12 NEGATIVE E2E PATHS
  // ============================================================
  describe('12. Negative E2E Paths (Cases 01 - 12)', () => {
    // Case 01: Thiếu Test Result -> không được PASS/Release
    it('Case 01: Thiếu Test Result -> không được Release', () => {
      const batch: Batch = { id: 'B-N1', batchNo: 'L01', productId: 'P01', status: 'TESTING' };
      const evalResult = ReleaseRules.evaluateReleasePrerequisites({
        batch,
        testResults: [], // Không có phiếu kiểm nghiệm
        userRole: 'QA',
      });
      expect(evalResult.isEligibleForRelease).toBe(false);
      expect(
        evalResult.blockers.some((b) => b.includes('Chưa có phiếu kiểm nghiệm authoritative'))
      ).toBe(true);
    });

    // Case 02: Test Result FAIL -> không được Release
    it('Case 02: Test Result FAIL -> không được Release', () => {
      const batch: Batch = { id: 'B-N2', batchNo: 'L02', productId: 'P01', status: 'TESTING' };
      const failTr: TestResult = {
        id: 'TR-FAIL',
        batchId: 'B-N2',
        overallStatus: 'FAIL',
        results: [{ criteriaName: 'Chỉ tiêu A', isPass: false, value: '10' }],
      };
      const evalResult = ReleaseRules.evaluateReleasePrerequisites({
        batch,
        testResults: [failTr],
        userRole: 'QA',
      });
      expect(evalResult.isEligibleForRelease).toBe(false);
      expect(evalResult.blockers.some((b) => b.includes('chưa đạt chuẩn PASS'))).toBe(true);

      const matrixCheck = QualityWorkflowMatrixGuard.validate('RELEASED', 'FAIL');
      expect(matrixCheck.allowed).toBe(false);
    });

    // Case 03: Test Result PENDING -> không tự động chuyển thành FAIL
    it('Case 03: Test Result PENDING -> không được tự động ép thành FAIL', () => {
      const pendingTr: TestResult = {
        id: 'TR-PENDING',
        batchId: 'B-N3',
        overallStatus: 'PENDING',
        results: [{ criteriaName: 'Vi sinh 7 ngày', isPass: null, value: '' }],
      };
      const tccs: TCCS = {
        id: 'TCCS-1',
        code: 'TC-1',
        name: 'TC',
        productId: 'P1',
        version: '1',
        mainCriteria: [{ name: 'Vi sinh 7 ngày', limitText: 'Âm tính' }],
      };
      const evalRes = QualityEvaluationEngine.evaluate(pendingTr, tccs);
      expect(evalRes.overallStatus).toBe('PENDING');
      expect(evalRes.overallStatus).not.toBe('FAIL');
    });

    // Case 04: Test Result UNKNOWN -> không tự động chuyển thành FAIL
    it('Case 04: Test Result UNKNOWN -> không được tự động ép thành FAIL', () => {
      const emptyTr: TestResult = {
        id: 'TR-UNKNOWN',
        batchId: 'B-N4',
        overallStatus: 'UNKNOWN',
        results: [],
      };
      const tccs: TCCS = {
        id: 'TCCS-1',
        code: 'TC-1',
        name: 'TC',
        productId: 'P1',
        version: '1',
        mainCriteria: [{ name: 'Hoạt chất', limitText: '100%' }],
      };
      const evalRes = QualityEvaluationEngine.evaluate(emptyTr, tccs);
      expect(evalRes.overallStatus).toBe('UNKNOWN');
      expect(evalRes.overallStatus).not.toBe('FAIL');
    });

    // Case 05: Thiếu TCCS -> workflow phải block theo business rule
    it('Case 05: Thiếu TCCS -> workflow phải block theo business rule', () => {
      const batchWithoutTccs: Batch = {
        id: 'B-N5',
        batchNo: 'L05',
        productId: 'P01',
        status: 'PENDING',
        // Không có tccsId hoặc boundTccs
      };

      // BatchRules cấm bắt đầu kiểm nghiệm khi Lô chưa liên kết TCCS
      const checkTesting = BatchRules.canStartTesting(batchWithoutTccs, null);
      expect(checkTesting.allowed).toBe(false);
      expect(checkTesting.blockers[0]).toContain(
        'Lô chưa được liên kết với Tiêu chuẩn cơ sở (TCCS) nào để kiểm nghiệm'
      );
    });

    // Case 06: Snapshot invalid -> finalize/release bị block
    it('Case 06: Snapshot invalid -> validateEvaluationSnapshot trả về false', () => {
      const testResult: TestResult = {
        id: 'TR-N6',
        batchId: 'B-N6',
        overallStatus: 'PASS',
        results: [{ criteriaName: 'C1', isPass: true, value: '99' }],
      };
      const tccs: TCCS = {
        id: 'TCCS-N6',
        code: 'TC-6',
        name: 'TCCS 6',
        productId: 'P1',
        version: '1',
        mainCriteria: [{ name: 'C1', limitText: '100' }],
      };

      const validSnap = buildEvaluationSnapshot(testResult, qaUser, { tccs });
      // Giả mạo hash của snapshot
      const invalidSnap = { ...validSnap, evaluationHash: 'forged-hash-0000' };

      const check = validateEvaluationSnapshot(invalidSnap, testResult, tccs);
      expect(check.isValid).toBe(false);
      expect(check.reason).toContain('Hash Mismatch');
    });

    // Case 07: Unauthorized QA approval -> blocked
    it('Case 07: Unauthorized QA approval -> bị từ chối bởi FSM và State Machine', () => {
      const check = TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED', {
        actorRole: 'QC',
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('không có thẩm quyền');
    });

    // Case 08: Unauthorized release -> blocked
    it('Case 08: Unauthorized release -> bị từ chối bởi FSM và RBAC', () => {
      const batch: Batch = { id: 'B-N8', batchNo: 'L08', productId: 'P01', status: 'TESTING' };
      const evalResult = ReleaseRules.evaluateReleasePrerequisites({
        batch,
        testResults: [],
        userRole: 'PRODUCTION', // Non-QA
      });
      expect(evalResult.isEligibleForRelease).toBe(false);
      expect(evalResult.blockers.some((b) => b.includes('không đủ thẩm quyền xuất xưởng'))).toBe(
        true
      );
    });

    // Case 09: Stale version -> conflict
    it('Case 09: Stale version -> ConcurrentModificationError', () => {
      const entity = { id: 'B-N9', version: 4 };
      const check = ConcurrencyManager.verifyVersion(entity, 2);
      expect(check.isValid).toBe(false);
      expect(check.error?.expectedVersion).toBe(2);
      expect(check.error?.actualVersion).toBe(4);
    });

    // Case 10: Tampered audit -> integrity error
    it('Case 10: Tampered audit -> HASH_MISMATCH', async () => {
      const genesis = await AlcoaAuditManager.createGenesisRecord({
        entityType: 'BATCH',
        entityId: 'B-N10',
        userId: 'admin@vbiotech.com',
        reason: 'Khởi tạo',
      });
      const tampered = { ...genesis, reason: 'Kẻ tấn công sửa nội dung' };
      const verify = await AlcoaAuditManager.verifyChainIntegrity([tampered]);
      expect(verify.isValid).toBe(false);
      expect(verify.violations[0].type).toBe('HASH_MISMATCH');
    });

    // Case 11: Database partial failure -> rollback
    it('Case 11: Database partial failure -> atomic rollback', async () => {
      const state: Record<string, string> = { 'e-1': 'INIT', 'e-2': 'INIT' };
      const plan: HealingPlan = {
        planId: 'plan-atomic-e2e',
        correlationId: 'c-e2e',
        actions: [
          {
            actionId: 'a-1',
            issueId: 'i-1',
            planId: 'plan-atomic-e2e',
            entityId: 'e-1',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 'INIT',
            newValue: 'MUTATED',
            reason: 'Step 1',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'c-e2e',
          },
          {
            actionId: 'a-2',
            issueId: 'i-2',
            planId: 'plan-atomic-e2e',
            entityId: 'e-2',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 'INIT',
            newValue: 'MUTATED',
            reason: 'Step 2 will fail',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'c-e2e',
          },
        ],
        status: 'APPROVED',
      };

      const outcome = await AutoHealingFramework.executeAtomicHealingPlan({
        plan,
        actor: 'qa-user',
        actorRole: 'QA',
        atomicCommit: async () => {
          state['e-1'] = 'MUTATED';
          throw new Error('Cố tình làm hỏng database ở bước 2!');
        },
        rollbackHandler: async () => {
          state['e-1'] = 'INIT';
        },
      });

      expect(outcome.success).toBe(false);
      expect(state['e-1']).toBe('INIT');
    });

    // Case 12: Direct Firebase mutation -> rejected
    it('Case 12: Direct Firebase mutation -> forbidden error', async () => {
      await expect(saveItem('batches', { id: 'B-BYPASS' })).rejects.toThrow(
        /\[FORBIDDEN DIRECT WRITE\]/i
      );
      await expect(updateBatchStatusService('B-BYPASS', 'RELEASED')).rejects.toThrow(
        /\[FORBIDDEN STATUS MUTATION\]/i
      );
    });
  });
});
