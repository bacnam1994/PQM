/**
 * PHASE 4 INTEGRATION TEST SUITE: MASTER DATA, AI PROPOSALS & SYSTEM OPERATIONS
 *
 * Kiểm tra toàn diện kiến trúc điều phối qua WorkflowFacade:
 * 1. ProductAppService (PRODUCT_CREATE, PRODUCT_UPDATE, PRODUCT_ARCHIVE, OCC)
 * 2. MaterialAppService (MATERIAL_CREATE, MATERIAL_UPDATE, MATERIAL_DELETE, Formula Integrity)
 * 3. FormulaAppService (FORMULA_CREATE, FORMULA_UPDATE, FORMULA_ARCHIVE, Sanitization)
 * 4. MasterCriterionAppService (CRITERIA_MASTER_CREATE, CRITERIA_MASTER_UPDATE, Bulk Rename)
 * 5. TCCSAppService (TCCS_CREATE, TCCS_UPDATE_DRAFT, TCCS_OBSOLETE, Batch Lock)
 * 6. SystemAppService (SYSTEM_BACKUP_EXECUTE, SYSTEM_RESTORE_EXECUTE, SYSTEM_WIPE_DEMO_EXECUTE, Confirmation Tokens)
 * 7. AI Advisory Boundaries (Advisory/Proposal only, human confirmation for canonical mutation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductAppService } from '../../src/services/app/ProductAppService';
import { MaterialAppService } from '../../src/services/app/MaterialAppService';
import { FormulaAppService } from '../../src/services/app/FormulaAppService';
import { MasterCriterionAppService } from '../../src/services/app/MasterCriterionAppService';
import { TCCSAppService } from '../../src/services/app/TCCSAppService';
import { SystemAppService, SystemActionContext } from '../../src/services/app/SystemAppService';
import { CANONICAL_ACTION_REGISTRY } from '../../src/workflow/definitions';
import { createBaseMockRepository } from '../../src/repositories/mockRepositoryHelper';
import {
  Product,
  RawMaterial,
  ProductFormula,
  MasterCriterion,
  TCCS,
  Batch,
  CriteriaAlias,
} from '../../src/types';

describe('Phase 4: Master Data, AI Proposals & System Operations Integration Suite', () => {
  const adminUser = { uid: 'usr_admin', email: 'admin@vbiotech.vn', role: 'ADMIN', isAdmin: true };
  const qaUser = { uid: 'usr_qa', email: 'qa@vbiotech.vn', role: 'QA' };
  const viewerUser = { uid: 'usr_viewer', email: 'viewer@vbiotech.vn', role: 'VIEWER' };

  // ==========================================
  // 1. PRODUCT WORKFLOW
  // ==========================================
  describe('ProductAppService Workflow', () => {
    let mockRepo: any;
    let service: ProductAppService;

    const sampleProduct: Product = {
      id: 'prod-001',
      code: 'SP-GINKGO',
      name: 'Ginkgo Biloba 120mg',
      group: 'Viên nang mềm',
      registrationNo: 'VD-12345-20',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockRepo = {
        ...createBaseMockRepository<Product>(),
        findById: vi.fn().mockResolvedValue(sampleProduct),
        findAll: vi.fn().mockResolvedValue([sampleProduct]),
        bulkSave: vi.fn().mockResolvedValue(undefined),
      };
      service = new ProductAppService(mockRepo);
    });

    it('cho phép tạo sản phẩm mới và gọi PRODUCT_CREATE qua WorkflowFacade', async () => {
      await expect(service.createProduct(sampleProduct, adminUser)).resolves.not.toThrow();
      expect(mockRepo.save).toHaveBeenCalledWith(sampleProduct);
    });

    it('chặn người dùng không có quyền (VIEWER) tạo sản phẩm', async () => {
      await expect(service.createProduct(sampleProduct, viewerUser)).rejects.toThrow(
        'Từ chối quyền'
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('cập nhật sản phẩm tăng version và tuân thủ OCC', async () => {
      const updated = { ...sampleProduct, name: 'Ginkgo Biloba Forte' };
      await expect(service.updateProduct(updated, adminUser)).resolves.not.toThrow();
      expect(mockRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'prod-001',
          name: 'Ginkgo Biloba Forte',
          version: 2,
        })
      );
    });

    it('xóa sản phẩm điều phối qua PRODUCT_ARCHIVE', async () => {
      await expect(
        service.deleteProduct('prod-001', adminUser, 'Ginkgo Biloba')
      ).resolves.not.toThrow();
      expect(mockRepo.delete).toHaveBeenCalledWith('prod-001');
    });

    it('nạp hàng loạt sản phẩm điều phối qua PRODUCT_CREATE', async () => {
      await expect(service.bulkCreateProducts([sampleProduct], adminUser)).resolves.not.toThrow();
      expect(mockRepo.bulkSave).toHaveBeenCalledWith([sampleProduct]);
    });
  });

  // ==========================================
  // 2. MATERIAL WORKFLOW
  // ==========================================
  describe('MaterialAppService Workflow', () => {
    let mockRepo: any;
    let service: MaterialAppService;

    const sampleMaterial: RawMaterial = {
      id: 'mat-001',
      code: 'NL-GINKGO',
      name: 'Cao khô lá Ginkgo Biloba',
      category: 'ACTIVE',
      grade: 'Dược dụng',
      supplier: 'Indena S.p.A',
      origin: 'Italy',
      standard: 'USP',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockRepo = createBaseMockRepository<RawMaterial>();
      service = new MaterialAppService(mockRepo);
    });

    it('cho phép Admin tạo nguyên liệu qua MATERIAL_CREATE và chặn vai trò không có quyền', async () => {
      await expect(service.createMaterial(sampleMaterial, adminUser)).resolves.not.toThrow();
      expect(mockRepo.save).toHaveBeenCalledWith(sampleMaterial);

      await expect(service.createMaterial(sampleMaterial, qaUser)).rejects.toThrow('Từ chối quyền');
    });

    it('chặn xóa nguyên liệu khi đang được sử dụng trong công thức sản phẩm', async () => {
      const activeFormula: ProductFormula = {
        id: 'form-001',
        productId: 'prod-001',
        servingSize: '1 viên',
        ingredients: [
          {
            materialId: 'mat-001',
            materialName: 'Cao khô lá Ginkgo Biloba',
            declaredContent: 120,
            unit: 'mg',
          },
        ],
        excipients: [],
        createdAt: '2026-01-01T00:00:00Z',
      };

      await expect(
        service.deleteMaterial('mat-001', [activeFormula], adminUser, 'Cao khô lá Ginkgo Biloba')
      ).rejects.toThrow('đang được sử dụng trong Công thức sản phẩm');
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('cho phép xóa nguyên liệu không còn gắn trong công thức qua MATERIAL_DELETE', async () => {
      await expect(
        service.deleteMaterial('mat-001', [], adminUser, 'Cao khô lá Ginkgo Biloba')
      ).resolves.not.toThrow();
      expect(mockRepo.delete).toHaveBeenCalledWith('mat-001');
    });
  });

  // ==========================================
  // 3. FORMULA WORKFLOW
  // ==========================================
  describe('FormulaAppService Workflow', () => {
    let mockRepo: any;
    let service: FormulaAppService;

    const sampleFormula: ProductFormula = {
      id: 'form-001',
      productId: 'prod-001',
      servingSize: '1 viên',
      ingredients: [
        {
          materialId: 'mat-001',
          materialName: 'Cao Ginkgo',
          declaredContent: '120.5' as any,
          unit: 'mg',
        },
      ],
      excipients: [],
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockRepo = createBaseMockRepository<ProductFormula>();
      service = new FormulaAppService(mockRepo);
    });

    it('làm sạch dữ liệu định lượng và điều phối FORMULA_CREATE', async () => {
      await expect(service.createFormula(sampleFormula, qaUser)).resolves.not.toThrow();
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'form-001',
          ingredients: [
            expect.objectContaining({
              declaredContent: 120.5,
            }),
          ],
        })
      );
    });

    it('điều phối FORMULA_ARCHIVE khi xóa công thức', async () => {
      await expect(service.deleteFormula('form-001', adminUser)).resolves.not.toThrow();
      expect(mockRepo.delete).toHaveBeenCalledWith('form-001');
    });
  });

  // ==========================================
  // 4. MASTER CRITERION WORKFLOW
  // ==========================================
  describe('MasterCriterionAppService Workflow', () => {
    let mockRepo: any;
    let service: MasterCriterionAppService;

    const sampleCriterion: MasterCriterion = {
      id: 'crit-001',
      canonicalName: 'Độ ẩm',
      category: 'Vật lý',
      defaultUnit: '%',
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockRepo = {
        ...createBaseMockRepository<MasterCriterion>(),
        findAll: vi.fn().mockResolvedValue([sampleCriterion]),
        findActive: vi.fn().mockResolvedValue([sampleCriterion]),
      };
      service = new MasterCriterionAppService(mockRepo);
    });

    it('tạo chỉ tiêu mẫu qua CRITERIA_MASTER_CREATE', async () => {
      await expect(service.create(sampleCriterion, qaUser)).resolves.not.toThrow();
      expect(mockRepo.save).toHaveBeenCalledWith(sampleCriterion);
    });

    it('cập nhật chỉ tiêu mẫu qua CRITERIA_MASTER_UPDATE', async () => {
      const updated = { ...sampleCriterion, canonicalName: 'Độ ẩm tồn dư' };
      await expect(service.update(updated, qaUser)).resolves.not.toThrow();
      expect(mockRepo.update).toHaveBeenCalledWith(updated);
    });

    it('xóa chỉ tiêu mẫu qua CRITERIA_MASTER_UPDATE', async () => {
      await expect(service.delete('crit-001', adminUser, 'Độ ẩm')).resolves.not.toThrow();
      expect(mockRepo.delete).toHaveBeenCalledWith('crit-001');
    });
  });

  // ==========================================
  // 5. TCCS WORKFLOW
  // ==========================================
  describe('TCCSAppService Workflow', () => {
    let mockTccsRepo: any;
    let mockAliasRepo: any;
    let mockAiRepo: any;
    let service: TCCSAppService;

    const sampleTCCS: TCCS = {
      id: 'tccs-001',
      code: 'TCCS-01:2026',
      productId: 'prod-001',
      productName: 'Ginkgo Biloba 120mg',
      mainQualityCriteria: [{ id: 'c1', name: 'Định tính Ginkgo', expectation: 'Dương tính' }],
      safetyCriteria: [{ id: 'c2', name: 'Chì (Pb)', expectation: '≤ 3.0 ppm' }],
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
    };

    beforeEach(() => {
      mockTccsRepo = createBaseMockRepository<TCCS>();
      mockAliasRepo = createBaseMockRepository<CriteriaAlias>();
      mockAiRepo = createBaseMockRepository<any>();
      service = new TCCSAppService(mockTccsRepo, mockAliasRepo, mockAiRepo);
    });

    it('tạo mới TCCS qua TCCS_CREATE và thiết lập Single Active Version', async () => {
      await expect(service.createTCCS(sampleTCCS, [], qaUser)).resolves.not.toThrow();
      expect(mockTccsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'tccs-001',
          isActive: true,
        })
      );
    });

    it('chặn xóa TCCS nếu đang được liên kết với lô sản xuất', async () => {
      const batchWithTCCS = {
        id: 'batch-001',
        batchNo: 'L260901',
        productId: 'prod-001',
        tccsId: 'tccs-001',
      } as Batch;

      await expect(
        service.deleteTCCS('tccs-001', [batchWithTCCS], adminUser, 'TCCS-01:2026')
      ).rejects.toThrow('đang liên kết với ít nhất một lô sản xuất');
      expect(mockTccsRepo.delete).not.toHaveBeenCalled();
    });

    it('cho phép xóa TCCS khi không bị tham chiếu qua TCCS_OBSOLETE', async () => {
      await expect(
        service.deleteTCCS('tccs-001', [], adminUser, 'TCCS-01:2026')
      ).resolves.not.toThrow();
      expect(mockTccsRepo.delete).toHaveBeenCalledWith('tccs-001');
    });

    it('quản lý Criteria Alias qua CRITERIA_ALIAS_MAP', async () => {
      const alias: CriteriaAlias = {
        id: 'ca-001',
        tccsId: 'tccs-001',
        canonicalName: 'Độ ẩm',
        aliases: ['Độ ẩm bã khô'],
        confirmedByAdmin: true,
      };

      await expect(service.addCriteriaAlias(alias, qaUser)).resolves.not.toThrow();
      expect(mockAliasRepo.save).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 6. SYSTEM OPERATIONS WORKFLOW
  // ==========================================
  describe('SystemAppService Workflow', () => {
    let mockSysRepo: any;
    let service: SystemAppService;

    const adminContext: SystemActionContext = {
      actorId: 'usr_admin',
      actorRole: 'ADMIN',
      actorEmail: 'admin@vbiotech.vn',
      reason: 'Bảo trì định kỳ',
    };

    beforeEach(() => {
      mockSysRepo = {
        backupDatabase: vi.fn().mockResolvedValue({ products: { p1: { name: 'A' } } }),
        restoreDatabase: vi.fn().mockResolvedValue(undefined),
        wipeDatabase: vi.fn().mockResolvedValue(undefined),
        resetDemoData: vi.fn().mockResolvedValue(undefined),
      };
      service = new SystemAppService(mockSysRepo);
    });

    it('ADMIN thực hiện sao lưu dữ liệu qua SYSTEM_BACKUP_EXECUTE', async () => {
      const result = await service.backupDatabase(adminContext);
      expect(result.success).toBe(true);
      expect(result.action).toBe('DATABASE_BACKUP');
      expect(mockSysRepo.backupDatabase).toHaveBeenCalledTimes(1);
    });

    it('chặn người dùng không phải ADMIN thực hiện sao lưu hoặc khôi phục', async () => {
      const qaContext: SystemActionContext = {
        actorId: 'usr_qa',
        actorRole: 'QA',
        actorEmail: 'qa@vbiotech.vn',
        reason: 'Thử nghiệm',
      };
      await expect(service.backupDatabase(qaContext)).rejects.toThrow(
        /bắt buộc quyền Quản trị viên/
      );
    });

    it('RESTORE yêu cầu token CONFIRM_RESTORE và lý do giải trình', async () => {
      // Thiếu token
      await expect(
        service.restoreDatabase(
          { products: {} },
          { ...adminContext, confirmationToken: 'WRONG_TOKEN' }
        )
      ).rejects.toThrow(/Mã xác nhận khôi phục không hợp lệ/);

      // Đúng token
      const result = await service.restoreDatabase(
        { products: { p1: { name: 'Ginkgo' } } },
        { ...adminContext, confirmationToken: 'CONFIRM_RESTORE' }
      );
      expect(result.success).toBe(true);
      expect(mockSysRepo.restoreDatabase).toHaveBeenCalledTimes(1);
    });

    it('WIPE yêu cầu token CONFIRM_WIPE và lý do giải trình', async () => {
      // Thiếu lý do
      await expect(
        service.wipeDatabase({ ...adminContext, reason: '', confirmationToken: 'CONFIRM_WIPE' })
      ).rejects.toThrow(/bắt buộc phải có lý do giải trình/);

      // Đúng token và lý do
      const result = await service.wipeDatabase({
        ...adminContext,
        confirmationToken: 'CONFIRM_WIPE',
      });
      expect(result.success).toBe(true);
      expect(mockSysRepo.wipeDatabase).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================
  // 7. AI ADVISORY BOUNDARIES
  // ==========================================
  describe('AI Advisory Boundaries & Human Confirmation', () => {
    it('mọi AI canonical actions đều ở mức rủi ro LOW hoặc NONE và không tự ý ghi audit bắt buộc', () => {
      const aiActionIds = [
        'AI_OCR_EXTRACT',
        'AI_MAPPING_PROPOSE',
        'AI_STABILITY_PREDICT',
        'AI_BATCH_CLEARANCE_PROPOSE',
        'AI_NATURAL_QUERY',
        'AI_VOICE_PARSE',
        'AI_LAB_COMPARE',
        'AI_DATA_INTEGRITY_SCAN',
      ] as const;

      for (const id of aiActionIds) {
        const meta = CANONICAL_ACTION_REGISTRY[id];
        expect(meta).toBeDefined();
        expect(['LOW', 'NONE']).toContain(meta.risk);
        expect(meta.requiresAudit).toBe(false);
      }
    });

    it('SYSTEM_AUTO_HEAL_PROPOSE là rủi ro LOW nhưng SYSTEM_AUTO_HEAL_APPROVE và EXECUTE là rủi ro HIGH và cần phê duyệt người', () => {
      const proposeMeta = CANONICAL_ACTION_REGISTRY['SYSTEM_AUTO_HEAL_PROPOSE'];
      const approveMeta = CANONICAL_ACTION_REGISTRY['SYSTEM_AUTO_HEAL_APPROVE'];
      const executeMeta = CANONICAL_ACTION_REGISTRY['SYSTEM_AUTO_HEAL_EXECUTE'];

      expect(proposeMeta.risk).toBe('LOW');
      expect(proposeMeta.allowedRoles).toContain('AI_ADVISORY');

      expect(approveMeta.risk).toBe('HIGH');
      expect(approveMeta.allowedRoles).not.toContain('AI_ADVISORY');
      expect(approveMeta.allowedRoles).toContain('QA');
      expect(approveMeta.requiresReason).toBe(true);

      expect(executeMeta.risk).toBe('HIGH');
      expect(executeMeta.allowedRoles).not.toContain('AI_ADVISORY');
      expect(executeMeta.allowedRoles).toContain('ADMIN');
      expect(executeMeta.requiresReason).toBe(true);
    });
  });
});
