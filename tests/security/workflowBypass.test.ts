import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityRulesValidator } from '../../src/services/securityRulesValidator';
import { BatchAppService } from '../../src/services/app/BatchAppService';
import { TestResultAppService } from '../../src/services/app/TestResultAppService';
import {
  BatchStateMachine,
  QualityWorkflowMatrixGuard,
} from '../../src/domain/workflow/stateMachine';
import { AlcoaAuditManager } from '../../src/domain/audit/alcoaAuditModel';
import { ConcurrencyManager } from '../../src/domain/concurrency/concurrencyModel';
import { AutoHealingFramework, HealingPlan } from '../../src/domain/healing/autoHealingFramework';
import {
  buildEvaluationSnapshot,
  validateEvaluationSnapshot,
} from '../../src/domain/evaluation/evaluationSnapshotBuilder';
import { saveItem, updateBatchStatusService } from '../../src/services/databaseService';
import { Batch } from '../../src/types/batch';
import { TestResult } from '../../src/types/testResult';
import { TCCS } from '../../src/types/tccs';

// In-Memory Repository Mock for Batch
class InMemoryBatchRepository {
  public store = new Map<string, Batch>();

  async findById(id: string): Promise<Batch | null> {
    return this.store.get(id) || null;
  }

  async save(batch: Batch): Promise<void> {
    this.store.set(batch.id, { ...batch });
  }

  async update(batch: Batch): Promise<void> {
    this.store.set(batch.id, { ...batch });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}

// In-Memory Repository Mock for TestResult
class InMemoryTestResultRepository {
  public store = new Map<string, TestResult>();

  async findById(id: string): Promise<TestResult | null> {
    return this.store.get(id) || null;
  }

  async save(tr: TestResult): Promise<void> {
    this.store.set(tr.id, { ...tr });
  }

  async update(tr: TestResult): Promise<void> {
    this.store.set(tr.id, { ...tr });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async findByRelation(field: string, value: string): Promise<TestResult[]> {
    return Array.from(this.store.values()).filter((r: any) => r[field] === value);
  }
}

vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn(),
}));

describe('PHASE B — Security & Adversarial Testing (B1 - B8)', () => {
  let batchRepo: InMemoryBatchRepository;
  let trRepo: InMemoryTestResultRepository;
  let batchService: BatchAppService;
  let trService: TestResultAppService;
  let mockDeviationService: any;

  const labUser = { uid: 'u-lab-1', email: 'lab@factory.com', role: 'LAB', isAdmin: false };
  const qcUser = { uid: 'u-qc-1', email: 'qc@factory.com', role: 'QC', isAdmin: false };
  const qaUser = { uid: 'u-qa-1', email: 'qa@factory.com', role: 'QA', isAdmin: false };
  const adminUser = { uid: 'u-admin-1', email: 'admin@factory.com', role: 'ADMIN', isAdmin: true };

  beforeEach(() => {
    batchRepo = new InMemoryBatchRepository();
    trRepo = new InMemoryTestResultRepository();
    mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(undefined),
    };
    batchService = new BatchAppService(batchRepo as any);
    trService = new TestResultAppService(trRepo as any, mockDeviationService);
  });

  // ============================================================
  // B1. UNAUTHORIZED APPROVAL
  // ============================================================
  describe('B1. Unauthorized Approval Defense', () => {
    it('chặn người dùng không có quyền QA (QC, LAB, OPERATOR) duyệt Test Result', async () => {
      const initialTestResult: TestResult = {
        id: 'TR-SEC-01',
        batchId: 'BATCH-SEC-01',
        tccsId: 'TCCS-01',
        overallStatus: 'PASS',
        workflowStatus: 'FINAL',
        version: 1,
        results: [
          {
            criterionName: 'Định lượng hoạt chất',
            value: '99.5',
            unit: '%',
            isPass: true,
          },
        ],
      };
      await trRepo.save(initialTestResult);

      // 1. Thử duyệt bởi QC -> Bị từ chối bởi App Service / State Machine
      await expect(trService.updateWorkflowStatus('TR-SEC-01', 'APPROVED', qcUser)).rejects.toThrow(
        /không có thẩm quyền.*APPROVED/i
      );

      // 2. Thử duyệt bởi LAB -> Bị từ chối
      await expect(
        trService.updateWorkflowStatus('TR-SEC-01', 'APPROVED', labUser)
      ).rejects.toThrow(/không có thẩm quyền.*APPROVED/i);

      // 3. Database UNCHANGED: Trạng thái trong DB vẫn giữ nguyên FINAL
      const savedInDb = await trRepo.findById('TR-SEC-01');
      expect(savedInDb?.workflowStatus).toBe('FINAL');
      expect(savedInDb?.version).toBe(1);

      // 4. Kiểm tra qua SecurityRulesValidator (Database Rules Level)
      const secCheck = SecurityRulesValidator.evaluate(
        { uid: qcUser.uid, role: qcUser.role, isAdmin: qcUser.isAdmin },
        'UPDATE',
        'testResults/TR-SEC-01',
        { workflowStatus: 'APPROVED' },
        { workflowStatus: 'FINAL' }
      );
      expect(secCheck.allowed).toBe(false);
      expect(secCheck.reason).toContain('Chỉ QA mới có thẩm quyền');
    });

    it('cho phép QA hợp lệ thực hiện phê duyệt phiếu kiểm nghiệm', async () => {
      const initialTestResult: TestResult = {
        id: 'TR-SEC-02',
        batchId: 'BATCH-SEC-01',
        tccsId: 'TCCS-01',
        overallStatus: 'PASS',
        workflowStatus: 'FINAL',
        version: 1,
        results: [{ criterionName: 'Chỉ tiêu 1', value: '100', isPass: true }],
      };
      await trRepo.save(initialTestResult);

      const unsignedSig = {
        documentType: 'TEST_RESULT' as const,
        documentId: 'TR-SEC-02',
        documentVersion: 1,
        signerUid: qaUser.uid,
        signerEmail: qaUser.email,
        role: 'QA' as const,
        meaning: 'APPROVE' as const,
        signedAt: new Date().toISOString(),
      };
      const { computeSignatureChecksum } = await import('../../src/services/signatureService');
      const checksum = await computeSignatureChecksum(unsignedSig);
      const mockSignature = {
        id: 'SIG-TEST-01',
        ...unsignedSig,
        checksum,
      };
      await trService.updateWorkflowStatus('TR-SEC-02', 'APPROVED', qaUser, {
        signature: mockSignature as any,
      });

      const saved = await trRepo.findById('TR-SEC-02');
      expect(saved?.workflowStatus).toBe('APPROVED');
      expect(saved?.version).toBe(2);
    });
  });

  // ============================================================
  // B2. UNAUTHORIZED RELEASE
  // ============================================================
  describe('B2. Unauthorized Release Defense', () => {
    it('chặn người dùng không có quyền Release (LAB, QC, OPERATOR) xuất xưởng Lô sản xuất', async () => {
      const testingBatch: Batch = {
        id: 'BATCH-SEC-02',
        batchNo: 'L260901',
        productId: 'PROD-01',
        status: 'TESTING',
        version: 1,
      };
      await batchRepo.save(testingBatch);

      // LAB thử release lô
      await expect(batchService.updateStatus('BATCH-SEC-02', 'RELEASED', labUser)).rejects.toThrow(
        /Chỉ bộ phận QA hoặc Quản trị viên mới có thẩm quyền/i
      );

      // QC thử release lô
      await expect(batchService.updateStatus('BATCH-SEC-02', 'RELEASED', qcUser)).rejects.toThrow(
        /Chỉ bộ phận QA hoặc Quản trị viên mới có thẩm quyền/i
      );

      // Database UNCHANGED: Batch vẫn ở trạng thái TESTING
      const savedInDb = await batchRepo.findById('BATCH-SEC-02');
      expect(savedInDb?.status).toBe('TESTING');

      // Security Rules Gate cũng từ chối
      const secCheck = SecurityRulesValidator.evaluate(
        { uid: labUser.uid, role: labUser.role, isAdmin: labUser.isAdmin },
        'UPDATE',
        'batches/BATCH-SEC-02',
        { status: 'RELEASED' },
        { status: 'TESTING' }
      );
      expect(secCheck.allowed).toBe(false);
      expect(secCheck.reason).toContain('Chỉ QA mới có thẩm quyền');
    });
  });

  // ============================================================
  // B3. DIRECT CLIENT STATUS MUTATION
  // ============================================================
  describe('B3. Direct Client Status Mutation Defense', () => {
    it('chặn client cố tình bypass State Machine bằng cách gọi databaseService.saveItem', async () => {
      await expect(saveItem('batches', { id: 'B-HACK', status: 'RELEASED' })).rejects.toThrow(
        /\[FORBIDDEN DIRECT WRITE\]/i
      );
    });

    it('chặn client gọi databaseService.updateBatchStatusService trực tiếp', async () => {
      await expect(updateBatchStatusService('B-HACK', 'RELEASED')).rejects.toThrow(
        /\[FORBIDDEN STATUS MUTATION\]/i
      );
    });

    it('từ chối chuyển trạng thái bất hợp pháp (PENDING -> RELEASED) qua State Machine', async () => {
      const check = BatchStateMachine.canTransition('PENDING', 'RELEASED', {
        actorRole: 'QA',
        actorId: 'u-qa',
        conditionsMet: true,
      });
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Chuyển đổi trạng thái không hợp lệ');
    });

    it('WF-006 & Section 14: SecurityRulesValidator chặn toàn bộ các kịch bản bypass workflow của batch', () => {
      const prodUser = { uid: 'u-prod', role: 'PRODUCTION' as const, isAdmin: false };
      const qaActor = { uid: 'u-qa', role: 'QA' as const, isAdmin: false };

      // 1. Tạo batch mới với status != PENDING -> BỊ CHẶN
      const createTesting = SecurityRulesValidator.evaluate(prodUser, 'CREATE', 'batches/B-NEW', {
        status: 'TESTING',
      });
      expect(createTesting.allowed).toBe(false);
      expect(createTesting.reason).toContain('PENDING');

      // 2. PENDING -> RELEASED -> BỊ CHẶN bất kể role
      const pendingToReleased = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'RELEASED' },
        { status: 'PENDING' }
      );
      expect(pendingToReleased.allowed).toBe(false);

      // 3. PENDING -> REJECTED -> PRODUCTION bị chặn, QA được phép
      const pendingToRejectedProd = SecurityRulesValidator.evaluate(
        prodUser,
        'UPDATE',
        'batches/B-01',
        { status: 'REJECTED' },
        { status: 'PENDING' }
      );
      expect(pendingToRejectedProd.allowed).toBe(false);
      const pendingToRejectedQA = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'REJECTED' },
        { status: 'PENDING' }
      );
      expect(pendingToRejectedQA.allowed).toBe(true);

      // 4. TESTING -> PENDING -> BỊ CHẶN bất kể role
      const testingToPending = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'PENDING' },
        { status: 'TESTING' }
      );
      expect(testingToPending.allowed).toBe(false);

      // 5. TESTING -> RELEASED -> PRODUCTION bị chặn, QA được phép
      const testingToReleasedProd = SecurityRulesValidator.evaluate(
        prodUser,
        'UPDATE',
        'batches/B-01',
        { status: 'RELEASED' },
        { status: 'TESTING' }
      );
      expect(testingToReleasedProd.allowed).toBe(false);
      const testingToReleasedQA = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'RELEASED' },
        { status: 'TESTING' }
      );
      expect(testingToReleasedQA.allowed).toBe(true);

      // 6. TESTING -> REJECTED -> PRODUCTION bị chặn, QA được phép
      const testingToRejectedProd = SecurityRulesValidator.evaluate(
        prodUser,
        'UPDATE',
        'batches/B-01',
        { status: 'REJECTED' },
        { status: 'TESTING' }
      );
      expect(testingToRejectedProd.allowed).toBe(false);
      const testingToRejectedQA = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'REJECTED' },
        { status: 'TESTING' }
      );
      expect(testingToRejectedQA.allowed).toBe(true);

      // 7. BLOCKED -> TESTING -> PRODUCTION bị chặn, QA được phép
      const blockedToTestingProd = SecurityRulesValidator.evaluate(
        prodUser,
        'UPDATE',
        'batches/B-01',
        { status: 'TESTING' },
        { status: 'BLOCKED' }
      );
      expect(blockedToTestingProd.allowed).toBe(false);
      const blockedToTestingQA = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'TESTING' },
        { status: 'BLOCKED' }
      );
      expect(blockedToTestingQA.allowed).toBe(true);

      // 8. REJECTED -> PENDING -> PRODUCTION bị chặn, QA được phép
      const rejectedToPendingProd = SecurityRulesValidator.evaluate(
        prodUser,
        'UPDATE',
        'batches/B-01',
        { status: 'PENDING' },
        { status: 'REJECTED' }
      );
      expect(rejectedToPendingProd.allowed).toBe(false);
      const rejectedToPendingQA = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'PENDING' },
        { status: 'REJECTED' }
      );
      expect(rejectedToPendingQA.allowed).toBe(true);

      // 9. RELEASED -> PENDING & RELEASED -> TESTING -> BỊ CHẶN bất kể role
      const releasedToPending = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'PENDING' },
        { status: 'RELEASED' }
      );
      expect(releasedToPending.allowed).toBe(false);
      const releasedToTesting = SecurityRulesValidator.evaluate(
        qaActor,
        'UPDATE',
        'batches/B-01',
        { status: 'TESTING' },
        { status: 'RELEASED' }
      );
      expect(releasedToTesting.allowed).toBe(false);
    });
  });

  // ============================================================
  // B4. QUALITY STATUS FORGERY
  // ============================================================
  describe('B4. Quality Status Forgery Defense', () => {
    it('server/domain tái tính toán và từ chối trạng thái PASS giả mạo khi có chỉ tiêu FAIL', async () => {
      // Client cố tình gửi payload với overallStatus: 'PASS' nhưng kết quả thực tế có chỉ tiêu OOS
      const forgedPayload: TestResult = {
        id: 'TR-FORGED-01',
        batchId: 'BATCH-01',
        tccsId: 'TCCS-01',
        labName: 'Phòng kiểm nghiệm Hóa Lý',
        testDate: '2026-09-19',
        overallStatus: 'PASS' as any, // Client forge
        version: 1,
        results: [
          { criterionName: 'Độ ẩm', value: '15.0', isPass: false }, // FAIL!
          { criterionName: 'Hoạt chất', value: '98.0', isPass: true },
        ],
      };

      // App service phải tính lại qua QualityEvaluationEngine và lưu kết quả là FAIL
      await trService.createTestResult(forgedPayload, qcUser);

      const saved = await trRepo.findById('TR-FORGED-01');
      expect(saved?.overallStatus).toBe('FAIL'); // Bị ghi đè thành FAIL
      expect(saved?.overallStatus).not.toBe('PASS');
    });

    it('QualityWorkflowMatrixGuard chặn chuyển sang RELEASED khi QualityStatus là FAIL (Bất biến GMP)', () => {
      const releaseCheck = QualityWorkflowMatrixGuard.validate('RELEASED', 'FAIL');
      expect(releaseCheck.allowed).toBe(false);
      expect(releaseCheck.reason).toContain('BẤT BIẾN GMP');
      expect(releaseCheck.reason).toContain('kết quả kiểm nghiệm FAIL');
    });

    it('QualityWorkflowMatrixGuard chặn chuyển sang APPROVED/RELEASED khi QualityStatus là PENDING hoặc UNKNOWN', () => {
      expect(QualityWorkflowMatrixGuard.validate('APPROVED', 'PENDING').allowed).toBe(false);
      expect(QualityWorkflowMatrixGuard.validate('APPROVED', 'UNKNOWN').allowed).toBe(false);
      expect(QualityWorkflowMatrixGuard.validate('RELEASED', 'PENDING').allowed).toBe(false);
      expect(QualityWorkflowMatrixGuard.validate('RELEASED', 'UNKNOWN').allowed).toBe(false);
    });
  });

  // ============================================================
  // B5. SNAPSHOT TAMPERING
  // ============================================================
  describe('B5. Snapshot Tampering Defense', () => {
    it('phát hiện can thiệp vào evaluation snapshot khi hash bị sai lệch', async () => {
      const mockTccs: TCCS = {
        id: 'TCCS-SEC',
        code: 'TCCS-01',
        name: 'Tiêu chuẩn test',
        productId: 'PROD-01',
        version: '1.0',
        mainCriteria: [
          { name: 'Hoạt chất', limitText: '90-110%', minVal: 90, maxVal: 110, unit: '%' },
        ],
      };

      const testResult: TestResult = {
        id: 'TR-SNAP-01',
        batchId: 'BATCH-01',
        tccsId: 'TCCS-SEC',
        overallStatus: 'PASS',
        version: 1,
        results: [{ criteriaName: 'Hoạt chất', value: '95', isPass: true }],
      };

      // Sinh snapshot hợp lệ
      const validSnapshot = buildEvaluationSnapshot(testResult, qaUser, { tccs: mockTccs });

      // Xác minh snapshot gốc hợp lệ
      const originalVerification = validateEvaluationSnapshot(validSnapshot, testResult, mockTccs);
      expect(originalVerification.isValid).toBe(true);

      // Kẻ tấn công can thiệp vào criterionResults trong snapshot (sửa giá trị từ 95 -> 50)
      const tamperedSnapshot = {
        ...validSnapshot,
        criterionResults: [
          {
            ...validSnapshot.criterionResults[0],
            value: '50', // Tampered!
          },
        ],
      };

      const tamperedVerification = validateEvaluationSnapshot(
        tamperedSnapshot,
        testResult,
        mockTccs
      );
      expect(tamperedVerification.isValid).toBe(false);
      expect(tamperedVerification.reason).toContain('Hash Mismatch');
    });

    it('chặn client thường sửa đổi phiếu kiểm nghiệm đã có snapshot đánh giá', () => {
      const lockedData = {
        id: 'TR-LOCKED',
        overallStatus: 'PASS',
        evaluationSnapshot: {
          evaluatedAt: '2026-09-01T00:00:00Z',
          evaluationHash: 'abc-hash-64-characters',
        },
      };

      const result = SecurityRulesValidator.evaluate(
        { uid: 'u-qc', role: 'QC', isAdmin: false },
        'UPDATE',
        'testResults/TR-LOCKED',
        { overallStatus: 'FAIL' },
        lockedData
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('đã có snapshot đánh giá');
    });
  });

  // ============================================================
  // B6. AUDIT TAMPERING
  // ============================================================
  describe('B6. Audit Tampering Defense', () => {
    it('AlcoaAuditManager phát hiện khi bản ghi audit bị sửa nội dung (HASH_MISMATCH)', async () => {
      const genesis = await AlcoaAuditManager.createGenesisRecord({
        entityType: 'TEST_RESULT',
        entityId: 'TR-AUDIT-01',
        userId: 'admin@factory.com',
        reason: 'Khởi tạo phiếu kiểm nghiệm ban đầu',
      });

      // Giả mạo nội dung nhật ký
      const tampered = { ...genesis, reason: 'Nội dung này đã bị hacker sửa đổi lén' };
      const verifyResult = await AlcoaAuditManager.verifyChainIntegrity([tampered]);

      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.violations.length).toBeGreaterThan(0);
      expect(verifyResult.violations[0].type).toBe('HASH_MISMATCH');
    });

    it('AlcoaAuditManager phát hiện khi một bản ghi trong chuỗi bị xóa (BROKEN_LINK)', async () => {
      const rec0 = await AlcoaAuditManager.createGenesisRecord({
        entityType: 'BATCH',
        entityId: 'B-01',
        userId: 'admin@factory.com',
        reason: 'Tạo lô',
      });

      const { updatedChain: chain1 } = await AlcoaAuditManager.appendRecord([rec0], {
        entityType: 'BATCH',
        entityId: 'B-01',
        action: 'UPDATE',
        userId: 'admin@factory.com',
        reason: 'Chuyển sang TESTING',
      });

      const { updatedChain: chain2 } = await AlcoaAuditManager.appendRecord(chain1, {
        entityType: 'BATCH',
        entityId: 'B-01',
        action: 'RELEASE',
        userId: 'qa@factory.com',
        reason: 'Phê duyệt xuất xưởng',
      });

      // Kẻ tấn công xóa bản ghi giữa (chỉ còn rec0 và rec2)
      const brokenChain = [chain2[0], chain2[2]];
      const verifyResult = await AlcoaAuditManager.verifyChainIntegrity(brokenChain);

      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.violations.some((v) => v.type === 'BROKEN_LINK')).toBe(true);
    });

    it('chặn ngay cả ADMIN sửa hoặc xóa nhật ký kiểm toán (ALCOA+ Append-only)', () => {
      const updateCheck = SecurityRulesValidator.evaluate(
        { uid: adminUser.uid, role: adminUser.role, isAdmin: true },
        'UPDATE',
        'audit_logs/AUD-001',
        { reason: 'Admin sửa lý do' }
      );
      expect(updateCheck.allowed).toBe(false);
      expect(updateCheck.reason).toContain('ALCOA+ Violation: Nhật ký kiểm toán là bất biến');

      const deleteCheck = SecurityRulesValidator.evaluate(
        { uid: adminUser.uid, role: adminUser.role, isAdmin: true },
        'DELETE',
        'audit_logs/AUD-001'
      );
      expect(deleteCheck.allowed).toBe(false);
      expect(deleteCheck.reason).toContain('ALCOA+ Violation: Nhật ký kiểm toán là bất biến');
    });
  });

  // ============================================================
  // B7. STALE VERSION (OPTIMISTIC CONCURRENCY CONTROL)
  // ============================================================
  describe('B7. Stale Version & OCC Conflict Defense', () => {
    it('chặn cập nhật khi client gửi version cũ hơn version hiện tại trên database', async () => {
      const currentBatch: Batch = {
        id: 'B-OCC-01',
        batchNo: 'L260901',
        productId: 'PROD-01',
        version: 3, // DB đã lên version 3
        status: 'TESTING',
      };
      await batchRepo.save(currentBatch);

      // Client A đọc được version 1, giờ cố submit update với version 1
      const staleBatchPayload: Batch = {
        ...currentBatch,
        version: 1, // Stale!
        notes: 'Client A cố ghi đè',
      };

      await expect(
        batchService.updateBatch(staleBatchPayload, adminUser, currentBatch)
      ).rejects.toThrow(/đã được cập nhật bởi một phiên làm việc khác/i);

      // Trạng thái DB không bị ghi đè
      const inDb = await batchRepo.findById('B-OCC-01');
      expect(inDb?.version).toBe(3);
      expect(inDb?.notes).toBeUndefined();
    });

    it('ConcurrencyManager.verifyVersion trả về lỗi cụ thể khi version không khớp', () => {
      const entityInDb = { id: 'B-01', version: 5 };
      const check = ConcurrencyManager.verifyVersion(entityInDb, 4);

      expect(check.isValid).toBe(false);
      expect(check.error?.name).toBe('ConcurrentModificationError');
      expect(check.error?.expectedVersion).toBe(4);
      expect(check.error?.actualVersion).toBe(5);
    });
  });

  // ============================================================
  // B8. PARTIAL FAILURE ATOMIC ROLLBACK
  // ============================================================
  describe('B8. Partial Failure & Atomic Rollback Defense', () => {
    it('khôi phục 100% trạng thái ban đầu khi 1 thao tác trong chuỗi đa mutation thất bại', async () => {
      const databaseState: Record<string, { id: string; status: string; version: number }> = {
        'batch-1': { id: 'batch-1', status: 'TESTING', version: 1 },
        'batch-2': { id: 'batch-2', status: 'TESTING', version: 1 },
        'batch-3': { id: 'batch-3', status: 'TESTING', version: 1 },
      };

      const plan: HealingPlan = {
        planId: 'plan-atomic-adversarial',
        correlationId: 'corr-adv-01',
        actions: [
          {
            actionId: 'act-1',
            issueId: 'iss-1',
            planId: 'plan-atomic-adversarial',
            entityId: 'batch-1',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 'TESTING',
            newValue: 'COMPLETED',
            reason: 'Step 1 update',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'corr-adv-01',
          },
          {
            actionId: 'act-2',
            issueId: 'iss-2',
            planId: 'plan-atomic-adversarial',
            entityId: 'batch-2',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 'TESTING',
            newValue: 'COMPLETED',
            reason: 'Step 2 update',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'corr-adv-01',
          },
          {
            actionId: 'act-3',
            issueId: 'iss-3',
            planId: 'plan-atomic-adversarial',
            entityId: 'batch-3',
            actor: 'qa-user',
            approvedBy: 'qa-lead',
            oldValue: 'TESTING',
            newValue: 'COMPLETED',
            reason: 'Step 3 will intentionally fail',
            timestamp: new Date().toISOString(),
            result: 'SUCCESS',
            correlationId: 'corr-adv-01',
          },
        ],
        status: 'APPROVED',
      };

      const executionOutcome = await AutoHealingFramework.executeAtomicHealingPlan({
        plan,
        actor: 'qa-user',
        actorRole: 'QA',
        atomicCommit: async () => {
          for (const act of plan.actions) {
            if (act.entityId === 'batch-3') {
              throw new Error('Mô phỏng đứt kết nối mạng hoặc lỗi DB ở mutation thứ 3!');
            }
            databaseState[act.entityId].status = act.newValue;
          }
          return true;
        },
        rollbackHandler: async () => {
          // Khôi phục tất cả về oldValue
          for (const act of plan.actions) {
            if (databaseState[act.entityId]) {
              databaseState[act.entityId].status = act.oldValue;
            }
          }
        },
      });

      expect(executionOutcome.success).toBe(false);
      expect(executionOutcome.error).toContain(
        'Mô phỏng đứt kết nối mạng hoặc lỗi DB ở mutation thứ 3!'
      );

      // Xác minh tuyệt đối: KHÔNG có entity nào bị half-written
      expect(databaseState['batch-1'].status).toBe('TESTING');
      expect(databaseState['batch-2'].status).toBe('TESTING');
      expect(databaseState['batch-3'].status).toBe('TESTING');
    });
  });
});
