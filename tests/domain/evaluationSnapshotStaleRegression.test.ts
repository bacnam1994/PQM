/**
 * tests/domain/evaluationSnapshotStaleRegression.test.ts
 * ======================================================
 * BỘ KIỂM THỬ HỒI QUY: PHÁT HIỆN STALE VÀ TỰ ĐỘNG REBUILD EVALUATION SNAPSHOT
 *
 * Khắc phục triệt để lỗi: PKN thêm/sửa/xóa chỉ tiêu nhưng CoA vẫn hiển thị snapshot cũ.
 * Tuân thủ chuẩn ALCOA+ và Part 11:
 * - Fingerprint & Stale Detection toàn diện cho mọi thay đổi dữ liệu đánh giá.
 * - Tự động rebuild snapshot trên phiếu DRAFT / có thể chỉnh sửa.
 * - Bảo vệ tuyệt đối không overwrite snapshot lịch sử của phiếu đã APPROVED hoặc RELEASED.
 * - Chặn (BLOCK) CoA chính thức nếu phát hiện snapshot bị stale hoặc can thiệp.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestResult, Batch, TCCS, CriterionType } from '../../src/types';
import {
  buildEvaluationSnapshot,
  isEvaluationSnapshotStale,
  buildEvaluationFingerprint,
  validateEvaluationSnapshot,
  CURRENT_ENGINE_VERSION,
} from '../../src/domain/evaluation/EvaluationSnapshotBuilder';
import { TestResultWorkflowHandlers } from '../../src/workflow/handlers/testResultWorkflowHandlers';
import { ITestResultRepository } from '../../src/repositories/TestResultRepository';

describe('Regression Test: Evaluation Snapshot Stale Detection & Rebuild Workflow', () => {
  const mockUser = {
    id: 'usr_qa_01',
    uid: 'usr_qa_01',
    email: 'qa.lead@vbiotech.vn',
    displayName: 'QA Lead',
    role: 'QA',
  };

  const mockTccsV1: TCCS = {
    id: 'tccs-paracetamol-500',
    code: 'TCCS-PARA-500',
    productName: 'Paracetamol 500mg',
    version: 1,
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      { id: 'crit-01', name: 'Định tính', expectedText: 'Dương tính', type: CriterionType.TEXT },
      { id: 'crit-02', name: 'Độ ẩm', min: 0, max: 5.0, unit: '%', type: CriterionType.NUMBER },
      {
        id: 'crit-03',
        name: 'Định lượng',
        min: 95.0,
        max: 105.0,
        unit: '%',
        type: CriterionType.NUMBER,
      },
      { id: 'crit-04', name: 'Độ hòa tan', min: 80.0, unit: '%', type: CriterionType.NUMBER },
    ],
  };

  const mockBatch: Batch = {
    id: 'batch-para-2026-001',
    batchNo: 'PARA-2026-01',
    productId: 'prod-para-500',
    tccsId: 'tccs-paracetamol-500',
    status: 'TESTING',
    mfgDate: '2026-09-01',
    expDate: '2028-09-01',
    batchSize: 100000,
  };

  // Mock repo cho handler
  let mockRepo: ITestResultRepository;
  let savedEntities: Map<string, TestResult>;
  let handlers: TestResultWorkflowHandlers;

  beforeEach(() => {
    savedEntities = new Map<string, TestResult>();
    mockRepo = {
      save: vi.fn(async (tr: TestResult) => {
        savedEntities.set(tr.id, tr);
      }),
      update: vi.fn(async (tr: TestResult) => {
        savedEntities.set(tr.id, tr);
      }),
      delete: vi.fn(async (id: string) => {
        savedEntities.delete(id);
      }),
      findById: vi.fn(async (id: string) => savedEntities.get(id) || null),
      findAll: vi.fn(async () => Array.from(savedEntities.values())),
    };
    handlers = new TestResultWorkflowHandlers(mockRepo, {
      autoLogFromOOS: vi.fn().mockResolvedValue(undefined),
    } as any);
  });

  // =========================================================================
  // SECTION 1: UNIT TESTS CHO isEvaluationSnapshotStale & Fingerprint
  // =========================================================================
  describe('Phase 1 & Phase 2: isEvaluationSnapshotStale Unit Tests', () => {
    const baseTestResult: TestResult = {
      id: 'tr-001',
      batchId: mockBatch.id,
      tccsId: mockTccsV1.id,
      labName: 'Phòng Hóa Lý',
      testDate: '2026-09-15',
      overallStatus: 'PASS',
      workflowStatus: 'DRAFT',
      version: 1,
      results: [
        { criteriaName: 'Định tính', value: 'Dương tính', isPass: true },
        { criteriaName: 'Độ ẩm', value: '3.5', isPass: true },
        { criteriaName: 'Định lượng', value: '99.8', isPass: true },
        { criteriaName: 'Độ hòa tan', value: '88.0', isPass: true },
      ],
    };

    it('Case 0: Dữ liệu giống hệt -> stale: false', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      const check = isEvaluationSnapshotStale(snapshot, baseTestResult, mockTccsV1);
      expect(check.stale).toBe(false);
      expect(check.reason).toBeUndefined();
    });

    it('Case 1 & 2: Thêm chỉ tiêu -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      // Thêm chỉ tiêu mới E (Tạp chất liên quan)
      const trWithExtraCriterion: TestResult = {
        ...baseTestResult,
        results: [
          ...baseTestResult.results,
          { criteriaName: 'Tạp chất liên quan', value: '0.1', isPass: true },
        ],
      };

      const check = isEvaluationSnapshotStale(snapshot, trWithExtraCriterion, mockTccsV1);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain(
        'Số lượng chỉ tiêu hiện tại (5) khác với số lượng chỉ tiêu trong snapshot (4)'
      );
    });

    it('Case 3: Xóa chỉ tiêu -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      // Xóa 1 chỉ tiêu (còn 3 chỉ tiêu)
      const trRemovedCriterion: TestResult = {
        ...baseTestResult,
        results: baseTestResult.results.slice(0, 3),
      };

      const check = isEvaluationSnapshotStale(snapshot, trRemovedCriterion, mockTccsV1);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain(
        'Số lượng chỉ tiêu hiện tại (3) khác với số lượng chỉ tiêu trong snapshot (4)'
      );
    });

    it('Case 4: Đổi tên chỉ tiêu -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      const trRenamed: TestResult = {
        ...baseTestResult,
        results: [
          baseTestResult.results[0],
          { criteriaName: 'Mất khối lượng do làm khô', value: '3.5', isPass: true }, // đổi tên Độ ẩm
          baseTestResult.results[2],
          baseTestResult.results[3],
        ],
      };

      const check = isEvaluationSnapshotStale(snapshot, trRenamed, mockTccsV1);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain('Tên chỉ tiêu thứ 2 không khớp');
    });

    it('Case 5: Đổi giá trị chỉ tiêu -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      const trValChanged: TestResult = {
        ...baseTestResult,
        results: [
          baseTestResult.results[0],
          { criteriaName: 'Độ ẩm', value: '4.8', isPass: true }, // đổi từ 3.5 -> 4.8
          baseTestResult.results[2],
          baseTestResult.results[3],
        ],
      };

      const check = isEvaluationSnapshotStale(snapshot, trValChanged, mockTccsV1);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain('Giá trị chỉ tiêu "Độ ẩm" đã thay đổi');
    });

    it('Case 6: Đổi PASS/FAIL -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      const trPassChanged: TestResult = {
        ...baseTestResult,
        overallStatus: 'FAIL',
        results: [
          baseTestResult.results[0],
          { criteriaName: 'Độ ẩm', value: '6.5', isPass: false }, // rớt
          baseTestResult.results[2],
          baseTestResult.results[3],
        ],
      };

      const check = isEvaluationSnapshotStale(snapshot, trPassChanged, mockTccsV1);
      expect(check.stale).toBe(true);
    });

    it('Case 7: Đổi thứ tự chỉ tiêu -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      // Hoán đổi thứ tự chỉ tiêu 1 và chỉ tiêu 2
      const trReordered: TestResult = {
        ...baseTestResult,
        results: [
          baseTestResult.results[1],
          baseTestResult.results[0],
          baseTestResult.results[2],
          baseTestResult.results[3],
        ],
      };

      const check = isEvaluationSnapshotStale(snapshot, trReordered, mockTccsV1);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain('Tên chỉ tiêu thứ 1 không khớp');
    });

    it('Case 8: TCCS ID thay đổi -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      const differentTccs: TCCS = { ...mockTccsV1, id: 'tccs-new-standard-999' };
      const check = isEvaluationSnapshotStale(snapshot, baseTestResult, differentTccs);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain('Snapshot áp dụng sai TCCS');
    });

    it('Case 9: TCCS version thay đổi -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });

      const upgradedTccs: TCCS = { ...mockTccsV1, version: 2 };
      const check = isEvaluationSnapshotStale(snapshot, baseTestResult, upgradedTccs);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain('Snapshot dùng phiên bản TCCS cũ');
    });

    it('Case 10: Engine version không tương thích -> stale: true', () => {
      const snapshot = buildEvaluationSnapshot(baseTestResult, mockUser, {
        boundTccs: mockTccsV1,
      });
      const oldEngineSnap = { ...snapshot, engineVersion: '3.0.0-legacy' };

      const check = isEvaluationSnapshotStale(oldEngineSnap, baseTestResult, mockTccsV1);
      expect(check.stale).toBe(true);
      expect(check.reason).toContain('Phiên bản engine trong snapshot');
    });

    it('Fingerprint thay đổi tất định khi dữ liệu nguồn thay đổi', () => {
      const fp1 = buildEvaluationFingerprint(baseTestResult, mockTccsV1);
      const fp2 = buildEvaluationFingerprint(baseTestResult, mockTccsV1);
      expect(fp1).toBe(fp2);

      const modifiedTR = {
        ...baseTestResult,
        results: [...baseTestResult.results, { criteriaName: 'Mới', value: '1', isPass: true }],
      };
      const fpModified = buildEvaluationFingerprint(modifiedTR, mockTccsV1);
      expect(fp1).not.toBe(fpModified);
    });
  });

  // =========================================================================
  // SECTION 2: WORKFLOW HANDLERS - TỰ ĐỘNG REBUILD SNAPSHOT KHI PKN THAY ĐỔI
  // =========================================================================
  describe('Phase 3 & Phase 4: handleUpdate Snapshot Rebuild Workflow', () => {
    it('THÊM CHỈ TIÊU: Snapshot tự động được build lại chứa đủ chỉ tiêu mới sau khi lưu', async () => {
      // 1. Tạo PKN ban đầu với 3 chỉ tiêu: A, B, C
      const initialTR: TestResult = {
        id: 'tr-test-add',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'DRAFT',
        version: 1,
        results: [
          { criteriaName: 'Định tính', value: 'Dương tính', isPass: true },
          { criteriaName: 'Độ ẩm', value: '3.0', isPass: true },
          { criteriaName: 'Định lượng', value: '100.0', isPass: true },
        ],
      };

      const created = await handlers.handleCreate(initialTR, mockUser, { batch: mockBatch });
      expect(created.evaluationSnapshot).toBeDefined();
      expect(created.evaluationSnapshot?.criterionResults).toHaveLength(3);

      // 2. Mở lại PKN, thêm chỉ tiêu D (Độ hòa tan), overallStatus vẫn là PASS
      const updatedTR: TestResult = {
        ...created,
        results: [...created.results, { criteriaName: 'Độ hòa tan', value: '85.0', isPass: true }],
      };

      // 3. Gọi handleUpdate
      const updated = await handlers.handleUpdate(updatedTR, mockUser, created, {
        batch: mockBatch,
      });

      // 4. Snapshot BẮT BUỘC phải được rebuild và có 4 chỉ tiêu
      expect(updated.evaluationSnapshot).toBeDefined();
      expect(updated.evaluationSnapshot?.criterionResults).toHaveLength(4);
      expect(
        updated.evaluationSnapshot?.criterionResults.some((c) => c.criteriaName === 'Độ hòa tan')
      ).toBe(true);

      // 5. Xác minh toàn vẹn hash mới
      const validation = validateEvaluationSnapshot(updated.evaluationSnapshot, updated);
      expect(validation.isValid).toBe(true);
    });

    it('ĐỔI GIÁ TRỊ CHỈ TIÊU: Snapshot tự động được cập nhật giá trị mới', async () => {
      const initialTR: TestResult = {
        id: 'tr-test-val',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'DRAFT',
        version: 1,
        results: [{ criteriaName: 'Độ ẩm', value: '3.0', isPass: true }],
      };

      const created = await handlers.handleCreate(initialTR, mockUser, { batch: mockBatch });
      expect(created.evaluationSnapshot?.criterionResults[0].value).toBe('3.0');

      // Sửa giá trị từ 3.0 -> 3.8
      const updatedTR: TestResult = {
        ...created,
        results: [{ criteriaName: 'Độ ẩm', value: '3.8', isPass: true }],
      };

      const updated = await handlers.handleUpdate(updatedTR, mockUser, created, {
        batch: mockBatch,
      });
      expect(updated.evaluationSnapshot?.criterionResults[0].value).toBe('3.8');

      const validation = validateEvaluationSnapshot(updated.evaluationSnapshot, updated);
      expect(validation.isValid).toBe(true);
    });

    it('XÓA CHỈ TIÊU: Snapshot tự động loại bỏ chỉ tiêu đã xóa', async () => {
      const initialTR: TestResult = {
        id: 'tr-test-del',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'DRAFT',
        version: 1,
        results: [
          { criteriaName: 'Định tính', value: 'Dương tính', isPass: true },
          { criteriaName: 'Độ ẩm', value: '3.0', isPass: true },
        ],
      };

      const created = await handlers.handleCreate(initialTR, mockUser, { batch: mockBatch });
      expect(created.evaluationSnapshot?.criterionResults).toHaveLength(2);

      // Xóa chỉ tiêu 'Độ ẩm'
      const updatedTR: TestResult = {
        ...created,
        results: [{ criteriaName: 'Định tính', value: 'Dương tính', isPass: true }],
      };

      const updated = await handlers.handleUpdate(updatedTR, mockUser, created, {
        batch: mockBatch,
      });
      expect(updated.evaluationSnapshot?.criterionResults).toHaveLength(1);
      expect(updated.evaluationSnapshot?.criterionResults[0].criteriaName).toBe('Định tính');
    });

    it('ĐỔI PASS -> FAIL: Snapshot và overallStatus được cập nhật chính xác sang FAIL', async () => {
      const initialTR: TestResult = {
        id: 'tr-test-fail',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'DRAFT',
        version: 1,
        results: [{ criteriaName: 'Độ ẩm', value: '3.0', isPass: true }],
      };

      const created = await handlers.handleCreate(initialTR, mockUser, { batch: mockBatch });
      expect(created.overallStatus).toBe('PASS');

      // Chuyển kết quả sang FAIL (Độ ẩm 8.0% > 5.0%)
      const updatedTR: TestResult = {
        ...created,
        results: [{ criteriaName: 'Độ ẩm', value: '8.0', isPass: false }],
      };

      const updated = await handlers.handleUpdate(updatedTR, mockUser, created, {
        batch: mockBatch,
      });
      expect(updated.overallStatus).toBe('FAIL');
      expect(updated.evaluationSnapshot?.overallStatus).toBe('FAIL');
      expect(updated.evaluationSnapshot?.reasons.length).toBeGreaterThan(0);
    });

    it('KHÔNG ĐỔI DỮ LIỆU: Giữ nguyên snapshot cũ (không sinh lại hash vô nghĩa)', async () => {
      const initialTR: TestResult = {
        id: 'tr-test-nochange',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'DRAFT',
        version: 1,
        results: [{ criteriaName: 'Độ ẩm', value: '3.0', isPass: true }],
      };

      const created = await handlers.handleCreate(initialTR, mockUser, { batch: mockBatch });
      const initialHash = created.evaluationSnapshot?.evaluationHash;

      // Cập nhật chỉ ghi chú labName hoặc reportNo, results không đổi
      const updatedTR: TestResult = {
        ...created,
        reportNo: 'KN-2026-0001',
      };

      const updated = await handlers.handleUpdate(updatedTR, mockUser, created, {
        batch: mockBatch,
      });
      expect(updated.evaluationSnapshot?.evaluationHash).toBe(initialHash);
    });
  });

  // =========================================================================
  // SECTION 3: BẢO VỆ LỊCH SỬ APPROVED VÀ RELEASED (Phase 7 & Phase 15 & 19)
  // =========================================================================
  describe('Phase 7, 15 & 19: Approved and Released History Protection', () => {
    it('APPROVED: Từ chối chỉnh sửa trực tiếp, không overwrite snapshot đã niêm phong', async () => {
      const approvedTR: TestResult = {
        id: 'tr-approved-001',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'APPROVED',
        version: 2,
        results: [{ criteriaName: 'Độ ẩm', value: '3.0', isPass: true }],
      };
      approvedTR.evaluationSnapshot = buildEvaluationSnapshot(approvedTR, mockUser, {
        boundTccs: mockTccsV1,
      });

      // Cố tình gọi handleUpdate để sửa dữ liệu trên phiếu đã APPROVED
      const attemptEdit: TestResult = {
        ...approvedTR,
        results: [{ criteriaName: 'Độ ẩm', value: '4.5', isPass: true }],
      };

      await expect(
        handlers.handleUpdate(attemptEdit, mockUser, approvedTR, { batch: mockBatch })
      ).rejects.toThrow(
        /Từ chối thao tác: Không thể chỉnh sửa trực tiếp Phiếu kiểm nghiệm ở trạng thái APPROVED/
      );
    });

    it('RELEASED: Từ chối chỉnh sửa trực tiếp trên phiếu đã xuất xưởng', async () => {
      const releasedTR: TestResult = {
        id: 'tr-released-001',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'RELEASED',
        version: 3,
        results: [{ criteriaName: 'Độ ẩm', value: '3.0', isPass: true }],
      };
      releasedTR.evaluationSnapshot = buildEvaluationSnapshot(releasedTR, mockUser, {
        boundTccs: mockTccsV1,
      });

      const attemptEdit: TestResult = {
        ...releasedTR,
        results: [{ criteriaName: 'Độ ẩm', value: '2.5', isPass: true }],
      };

      await expect(
        handlers.handleUpdate(attemptEdit, mockUser, releasedTR, { batch: mockBatch })
      ).rejects.toThrow(
        /Từ chối thao tác: Không thể chỉnh sửa trực tiếp Phiếu kiểm nghiệm ở trạng thái RELEASED/
      );
    });
  });

  // =========================================================================
  // SECTION 4: COA VALIDATION VÀ STALE HANDLING (Phase 8 & Phase 12)
  // =========================================================================
  describe('Phase 8 & Phase 12: CoA Validation and Stale Handling', () => {
    it('CoA OFFICIAL: Bị chặn (Invalid) khi snapshot bị stale so với dữ liệu phiếu', () => {
      const officialTR: TestResult = {
        id: 'tr-official-coa',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'APPROVED',
        version: 2,
        results: [
          { criteriaName: 'Định tính', value: 'Dương tính', isPass: true },
          { criteriaName: 'Độ ẩm', value: '3.0', isPass: true },
        ],
      };
      // Snapshot chỉ có 1 chỉ tiêu (Định tính)
      const staleSnapshot = buildEvaluationSnapshot(
        {
          ...officialTR,
          results: [{ criteriaName: 'Định tính', value: 'Dương tính', isPass: true }],
        },
        mockUser,
        { boundTccs: mockTccsV1 }
      );

      // Kiểm tra validateEvaluationSnapshot đối chiếu với officialTR (có 2 chỉ tiêu)
      const validation = validateEvaluationSnapshot(staleSnapshot, officialTR, mockTccsV1);
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toContain(
        'Số lượng chỉ tiêu hiện tại (2) khác với số lượng chỉ tiêu trong snapshot (1)'
      );
    });

    it('CoA OFFICIAL: Hợp lệ khi snapshot khớp 100% dữ liệu phiếu kiểm nghiệm', () => {
      const officialTR: TestResult = {
        id: 'tr-official-ok',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Lab QC',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'APPROVED',
        version: 2,
        results: [
          { criteriaName: 'Định tính', value: 'Dương tính', isPass: true },
          { criteriaName: 'Độ ẩm', value: '3.0', isPass: true },
        ],
      };
      const validSnapshot = buildEvaluationSnapshot(officialTR, mockUser, {
        boundTccs: mockTccsV1,
      });

      const validation = validateEvaluationSnapshot(validSnapshot, officialTR, mockTccsV1);
      expect(validation.isValid).toBe(true);
      expect(validation.reason).toBeUndefined();
    });
  });

  // =========================================================================
  // SECTION 5: ACCEPTANCE TEST QUAN TRỌNG NHẤT (Section 21)
  // =========================================================================
  describe('Acceptance Test (Section 21 Scenario): Thêm chỉ tiêu sau lần lưu trước', () => {
    it('Đúng kịch bản: PKN tạo A + B -> Lưu -> Mở lại thêm C -> Lưu -> Snapshot và CoA có đủ A + B + C', async () => {
      // 1. Tạo PKN với:
      //    - Chỉ tiêu A: Định tính
      //    - Chỉ tiêu B: Độ ẩm
      const trL1: TestResult = {
        id: 'tr-acceptance-user-flow',
        batchId: mockBatch.id,
        tccsId: mockTccsV1.id,
        labName: 'Phòng Kiểm Nghiệm Trung Tâm',
        testDate: '2026-09-16',
        overallStatus: 'PASS',
        workflowStatus: 'DRAFT',
        version: 1,
        results: [
          { criteriaName: 'Định tính', value: 'Dương tính', isPass: true },
          { criteriaName: 'Độ ẩm', value: '3.2', isPass: true },
        ],
      };

      // 2. Save lần 1
      const savedL1 = await handlers.handleCreate(trL1, mockUser, { batch: mockBatch });
      expect(savedL1.evaluationSnapshot).toBeDefined();
      expect(savedL1.evaluationSnapshot?.criterionResults).toHaveLength(2);
      expect(savedL1.evaluationSnapshot?.criterionResults.map((c) => c.criteriaName)).toEqual([
        'Định tính',
        'Độ ẩm',
      ]);

      // 3. Người dùng mở lại PKN và thêm Chỉ tiêu C: Định lượng
      const trL2: TestResult = {
        ...savedL1,
        results: [...savedL1.results, { criteriaName: 'Định lượng', value: '99.5', isPass: true }],
      };

      // 4. Save lần 2
      const savedL2 = await handlers.handleUpdate(trL2, mockUser, savedL1, { batch: mockBatch });

      // 5. Kiểm tra kết quả
      // PKN có 3 chỉ tiêu:
      expect(savedL2.results).toHaveLength(3);

      // Snapshot BẮT BUỘC có 3 chỉ tiêu (không bị kẹt snapshot cũ 2 chỉ tiêu):
      expect(savedL2.evaluationSnapshot).toBeDefined();
      expect(savedL2.evaluationSnapshot?.criterionResults).toHaveLength(3);
      expect(savedL2.evaluationSnapshot?.criterionResults.map((c) => c.criteriaName)).toEqual([
        'Định tính',
        'Độ ẩm',
        'Định lượng',
      ]);

      // Xác thực CoA reading: validateEvaluationSnapshot trả về isValid: true
      const validation = validateEvaluationSnapshot(
        savedL2.evaluationSnapshot,
        savedL2,
        mockTccsV1
      );
      expect(validation.isValid).toBe(true);

      // Snapshot mới có đầy đủ chỉ tiêu C
      const critC = savedL2.evaluationSnapshot?.criterionResults.find(
        (c) => c.criteriaName === 'Định lượng'
      );
      expect(critC).toBeDefined();
      expect(critC?.value).toBe('99.5');
      expect(critC?.isPass).toBe(true);
    });
  });
});
