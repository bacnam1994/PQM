import { describe, it, expect, vi } from 'vitest';
import { EntityIdentityManager } from '../identity/entityIdentity';
import { Product, Batch, TCCS, TestResult, TestingLaboratory } from '../../types';
import { TestResultAppService } from '../../services/app/TestResultAppService';

describe('MODEL 3: ENTITY IDENTITY HARDENING REGRESSION TESTS', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod_para_500',
      code: 'PARA500',
      name: 'Paracetamol 500mg',
      group: 'Thuốc hạ sốt giảm đau',
      registrationNo: 'VD-12345-20',
      registrationDate: '2020-01-01',
      registrant: 'V-Biotech',
      status: 'ACTIVE',
      description: 'Paracetamol 500mg viên nén',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'prod_amox_500',
      code: 'AMOX500',
      name: 'Amoxicillin 500mg',
      group: 'Kháng sinh',
      registrationNo: 'VD-54321-20',
      registrationDate: '2020-01-01',
      registrant: 'V-Biotech',
      status: 'ACTIVE',
      description: 'Amoxicillin 500mg viên nang',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockTCCS: TCCS[] = [
    {
      id: 'tccs_para_01',
      code: 'TCCS-PARA-01',
      productId: 'prod_para_500',
      issueDate: '2026-01-01',
      isActive: true,
      mainQualityCriteria: [],
      safetyCriteria: [],
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'tccs_amox_01',
      code: 'TCCS-AMOX-01',
      productId: 'prod_amox_500',
      issueDate: '2026-01-01',
      isActive: true,
      mainQualityCriteria: [],
      safetyCriteria: [],
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  const mockBatches: Batch[] = [
    {
      id: 'batch_tech_001',
      batchNo: 'LOT-2026-001',
      productId: 'prod_para_500',
      tccsId: 'tccs_para_01',
      mfgDate: '2026-02-01',
      expDate: '2029-02-01',
      theoreticalYield: 100000,
      actualYield: 99500,
      yieldUnit: 'viên',
      status: 'PENDING',
      createdAt: '2026-02-01T00:00:00Z',
    },
    {
      id: 'batch_tech_002',
      batchNo: 'LOT-2026-002',
      productId: 'prod_amox_500',
      tccsId: 'tccs_amox_01',
      mfgDate: '2026-02-01',
      expDate: '2028-02-01',
      theoreticalYield: 50000,
      actualYield: 49800,
      yieldUnit: 'viên',
      status: 'PENDING',
      createdAt: '2026-02-01T00:00:00Z',
    },
  ];

  const mockLabs: TestingLaboratory[] = [
    {
      id: 'lab_quatest3',
      code: 'QUATEST3',
      canonicalName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3',
      aliases: ['Quatest 3', 'TT Kỹ thuật 3', 'QUATEST 3'],
      type: 'EXTERNAL',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'lab_internal',
      code: 'INTERNAL',
      canonicalName: 'Phòng Kiểm nghiệm Nội bộ V-Biotech',
      aliases: ['Nội bộ', 'QC V-Biotech', 'Lab nội bộ'],
      type: 'INTERNAL',
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    },
  ];

  const baseTestResult: TestResult = {
    id: 'tr_2026_001',
    batchId: 'batch_tech_001',
    tccsId: 'tccs_para_01',
    labId: 'lab_quatest3',
    labName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3',
    testDate: '2026-02-15',
    overallStatus: 'PASS',
    results: [{ criteriaName: 'Định lượng Paracetamol', value: 99.5, isPass: true }],
    createdAt: '2026-02-15T00:00:00Z',
  };

  it('1. TECHNICAL ID IS PRIMARY: validateTestResultBatch accepts technical ID', () => {
    const res = EntityIdentityManager.validateTestResultBatch(baseTestResult, mockBatches);
    expect(res.isValid).toBe(true);
    expect(res.classification).toBe('PRIMARY');
    expect(res.targetEntityId).toBe('batch_tech_001');
    expect(res.isLegacyMatch).toBeUndefined();
  });

  it('2. REJECTION OF BUSINESS KEY (batchNo) AS FOREIGN KEY: classifies as LEGACY_BUSINESS_KEY', () => {
    const trWithBatchNo: TestResult = {
      ...baseTestResult,
      id: 'tr_legacy_001',
      batchId: 'LOT-2026-001', // trỏ bằng batchNo thay vì batch.id!
    };
    const res = EntityIdentityManager.validateTestResultBatch(trWithBatchNo, mockBatches);
    expect(res.isValid).toBe(false);
    expect(res.classification).toBe('LEGACY_BUSINESS_KEY');
    expect(res.isLegacyMatch).toBe(true);
    expect(res.error).toContain('thay vì technical ID');
  });

  it('3. ORPHAN DETECTION: flags completely non-existent batchId as BROKEN_ORPHAN', () => {
    const orphanTr: TestResult = {
      ...baseTestResult,
      id: 'tr_orphan_001',
      batchId: 'non_existent_batch_id',
    };
    const res = EntityIdentityManager.validateTestResultBatch(orphanTr, mockBatches);
    expect(res.isValid).toBe(false);
    expect(res.classification).toBe('BROKEN_ORPHAN');
    expect(res.error).toContain('không tồn tại');
  });

  it('4. EMPTY FOREIGN KEY: flags missing batchId as EMPTY_REFERENCE', () => {
    const emptyTr: TestResult = {
      ...baseTestResult,
      id: 'tr_empty_001',
      batchId: '',
    };
    const res = EntityIdentityManager.validateTestResultBatch(emptyTr, mockBatches);
    expect(res.isValid).toBe(false);
    expect(res.classification).toBe('EMPTY_REFERENCE');
  });

  it('5. CROSS-PRODUCT TCCS MISMATCH: flags Batch pointing to TCCS of another product', () => {
    const crossBatch: Batch = {
      id: 'batch_cross_001',
      batchNo: 'LOT-CROSS-01',
      productId: 'prod_para_500',
      tccsId: 'tccs_amox_01', // tccs_amox_01 belongs to prod_amox_500!
      mfgDate: '2026-02-01',
      expDate: '2029-02-01',
      theoreticalYield: 1000,
      actualYield: 1000,
      yieldUnit: 'viên',
      status: 'PENDING',
      createdAt: '2026-02-01T00:00:00Z',
    };
    const res = EntityIdentityManager.validateBatchTCCS(crossBatch, mockTCCS);
    expect(res.isValid).toBe(false);
    expect(res.relationship).toBe('BATCH_TCCS_CROSS_PRODUCT');
    expect(res.error).toContain('không khớp với sản phẩm của lô');
  });

  it('6. DUPLICATE ID DETECTION: identifies duplicate technical IDs', () => {
    const batchesWithDup: Batch[] = [
      ...mockBatches,
      {
        id: 'batch_tech_001', // duplicate id!
        batchNo: 'LOT-2026-003',
        productId: 'prod_para_500',
        tccsId: 'tccs_para_01',
        mfgDate: '2026-02-01',
        expDate: '2029-02-01',
        theoreticalYield: 1000,
        actualYield: 1000,
        yieldUnit: 'viên',
        status: 'PENDING',
        createdAt: '2026-02-01T00:00:00Z',
      },
    ];

    const dupReport = EntityIdentityManager.detectDuplicateIdentities(batchesWithDup, 'BATCH');
    expect(dupReport.hasDuplicates).toBe(true);
    expect(dupReport.duplicateIds).toContain('batch_tech_001');
    expect(dupReport.details[0].count).toBe(2);
  });

  it('7. ORPHAN ENTITY DETECTION: comprehensively detects orphan test results, batches, and TCCS', () => {
    const orphanReport = EntityIdentityManager.detectOrphanEntities({
      testResults: [
        baseTestResult,
        {
          ...baseTestResult,
          id: 'tr_orphan',
          batchId: 'ghost_batch',
        },
      ],
      batches: [
        mockBatches[0],
        {
          id: 'batch_orphan_prod',
          batchNo: 'LOT-GHOST-PROD',
          productId: 'ghost_product',
          tccsId: 'tccs_para_01',
          mfgDate: '2026-01-01',
          expDate: '2028-01-01',
          theoreticalYield: 100,
          actualYield: 100,
          yieldUnit: 'viên',
          status: 'PENDING',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
      products: mockProducts,
      tccsList: [
        mockTCCS[0],
        {
          id: 'tccs_orphan_prod',
          code: 'TCCS-GHOST',
          productId: 'ghost_product_tccs',
          issueDate: '2026-01-01',
          isActive: true,
          mainQualityCriteria: [],
          safetyCriteria: [],
          version: 1,
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    expect(orphanReport.hasOrphans).toBe(true);
    expect(orphanReport.totalOrphans).toBe(3);
    expect(orphanReport.orphanTestResults).toHaveLength(1);
    expect(orphanReport.orphanTestResults[0].testResultId).toBe('tr_orphan');
    expect(orphanReport.orphanBatches).toHaveLength(1);
    expect(orphanReport.orphanBatches[0].batchId).toBe('batch_orphan_prod');
    expect(orphanReport.orphanTCCS).toHaveLength(1);
    expect(orphanReport.orphanTCCS[0].tccsId).toBe('tccs_orphan_prod');
  });

  it('8. BROKEN REFERENCES DETECTION & CLASSIFICATION: properly classifies references', () => {
    const brokenRefs = EntityIdentityManager.detectBrokenReferences({
      testResults: [
        baseTestResult, // valid
        {
          ...baseTestResult,
          id: 'tr_with_batchNo',
          batchId: 'LOT-2026-001', // legacy match
        },
        {
          ...baseTestResult,
          id: 'tr_with_ghost_batch',
          batchId: 'ghost_batch_id', // broken orphan
        },
      ],
      batches: mockBatches,
      products: mockProducts,
      tccsList: mockTCCS,
      laboratories: mockLabs,
    });

    expect(brokenRefs).toHaveLength(2);
    const legacyItem = brokenRefs.find((b) => b.classification === 'LEGACY_BUSINESS_KEY');
    const orphanItem = brokenRefs.find((b) => b.classification === 'BROKEN_ORPHAN');

    expect(legacyItem).toBeDefined();
    expect(legacyItem?.resolvedId).toBe('batch_tech_001');
    expect(orphanItem).toBeDefined();
    expect(orphanItem?.sourceEntityId).toBe('tr_with_ghost_batch');
  });

  it('9. IDENTITY AUTO-NORMALIZATION: normalizes batchNo to batch.id and inherits tccsId and labId', () => {
    const rawTr: TestResult = {
      id: 'tr_raw_001',
      batchId: 'LOT-2026-001', // business key
      labName: 'Quatest 3', // alias of lab_quatest3, without labId
      testDate: '2026-02-15',
      overallStatus: 'PASS',
      results: [],
      createdAt: '2026-02-15T00:00:00Z',
    };

    const { normalized, modifications } = EntityIdentityManager.normalizeTestResultIdentity(
      rawTr,
      mockBatches,
      mockTCCS,
      mockLabs
    );

    expect(normalized.batchId).toBe('batch_tech_001'); // normalized to technical ID
    expect(normalized.tccsId).toBe('tccs_para_01'); // inherited from batch
    expect(normalized.labId).toBe('lab_quatest3'); // normalized from alias
    expect(modifications.length).toBe(3);
  });

  it('10. FULL CHAIN VALIDATION: validates testResultId -> batchId -> tccsId -> labId', () => {
    const validChain = EntityIdentityManager.validateEntityIdentityChain({
      testResult: baseTestResult,
      batches: mockBatches,
      products: mockProducts,
      tccsList: mockTCCS,
      laboratories: mockLabs,
    });

    expect(validChain.isValid).toBe(true);
    expect(validChain.errors).toHaveLength(0);
    expect(validChain.batchId).toBe('batch_tech_001');
    expect(validChain.productId).toBe('prod_para_500');
    expect(validChain.tccsId).toBe('tccs_para_01');
    expect(validChain.labId).toBe('lab_quatest3');
  });

  it('11. FULL CHAIN VALIDATION: reports failure if chain is broken', () => {
    const brokenTr: TestResult = {
      ...baseTestResult,
      id: 'tr_broken_chain',
      batchId: 'LOT-2026-001', // legacy business key instead of technical ID
      tccsId: 'tccs_amox_01', // cross-product mismatch with batch!
      labId: 'invalid_lab_id',
    };

    const chainResult = EntityIdentityManager.validateEntityIdentityChain({
      testResult: brokenTr,
      batches: mockBatches,
      products: mockProducts,
      tccsList: mockTCCS,
      laboratories: mockLabs,
    });

    expect(chainResult.isValid).toBe(false);
    expect(chainResult.errors.length).toBeGreaterThan(0);
  });

  it('12. TEST RESULT APP SERVICE: enforces technical batchId and inherits tccsId on save', async () => {
    const mockRepo = {
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn(),
      getAll: vi.fn(),
      getByBatchId: vi.fn(),
      getByStatus: vi.fn(),
      query: vi.fn(),
      subscribeAll: vi.fn(),
    };

    const mockDeviationService = {
      autoLogFromOOS: vi.fn().mockResolvedValue(undefined),
    };

    const service = new TestResultAppService(mockRepo as any, mockDeviationService as any);

    const currentUser = {
      id: 'u1',
      uid: 'u1',
      email: 'qc@vbiotech.vn',
      role: 'QC' as const,
    };

    const trInput: TestResult = {
      ...baseTestResult,
      batchId: 'LOT-2026-001', // Passed batchNo instead of ID
      tccsId: undefined, // omitted tccsId
    };

    await service.createTestResult(trInput, currentUser, {
      batch: mockBatches[0],
    });

    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    const savedTr: TestResult = mockRepo.save.mock.calls[0][0];

    // Assert that batchId was normalized to batch_tech_001, not LOT-2026-001
    expect(savedTr.batchId).toBe('batch_tech_001');
    // Assert that tccsId was inherited from batch.tccsId
    expect(savedTr.tccsId).toBe('tccs_para_01');
  });

  it('13. MASTER IDENTITY AUDIT: generates accurate audit report and health score', () => {
    const cleanAudit = EntityIdentityManager.auditSystemEntityIdentities({
      testResults: [baseTestResult],
      batches: mockBatches,
      products: mockProducts,
      tccsList: mockTCCS,
      laboratories: mockLabs,
    });

    expect(cleanAudit.isHealthy).toBe(true);
    expect(cleanAudit.healthScore).toBe(100);
    expect(cleanAudit.orphans.hasOrphans).toBe(false);

    const degradedAudit = EntityIdentityManager.auditSystemEntityIdentities({
      testResults: [
        baseTestResult,
        {
          ...baseTestResult,
          id: 'tr_bad_1',
          batchId: 'ghost_batch',
        },
      ],
      batches: mockBatches,
      products: mockProducts,
      tccsList: mockTCCS,
      laboratories: mockLabs,
    });

    expect(degradedAudit.isHealthy).toBe(false);
    expect(degradedAudit.healthScore).toBeLessThan(100);
    expect(degradedAudit.orphans.hasOrphans).toBe(true);
  });
});
