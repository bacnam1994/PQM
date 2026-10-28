import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormulaRules } from '../domain/rules';
import { FormulaAppService } from '../application/service';
import { FormulaQueries } from '../application/queries';
import { ProductFormula } from '../domain/types';
import { createBaseMockRepository } from '../../../repositories/mockRepositoryHelper';
import { IFormulaRepository } from '../infrastructure/repository';

vi.mock('../../../services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

describe('Formula Domain - Vertical Slice 4', () => {
  let mockRepo: IFormulaRepository;
  let service: FormulaAppService;
  let queries: FormulaQueries;

  const sampleFormula: ProductFormula = {
    id: 'form_001',
    productId: 'prod_001',
    ingredients: [{ id: 'ing_1', name: 'Paracetamol', declaredContent: 500, unit: 'mg' }],
    excipients: [{ id: 'exc_1', name: 'Tinh bột ngô', declaredContent: 50, unit: 'mg' }],
    version: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const adminUser = {
    id: 'usr_admin',
    displayName: 'Admin User',
    role: 'ADMIN',
    permissions: ['formula:create', 'formula:update', 'formula:delete'],
  };

  const readOnlyUser = {
    id: 'usr_viewer',
    displayName: 'Viewer User',
    role: 'VIEWER',
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const base = createBaseMockRepository<ProductFormula>();
    mockRepo = {
      ...base,
      findAll: vi.fn(async () => [sampleFormula]),
      findById: vi.fn(async (id: string) => (id === sampleFormula.id ? sampleFormula : null)),
      findByProductId: vi.fn(async (pId: string) =>
        pId === sampleFormula.productId ? sampleFormula : null
      ),
    };
    service = new FormulaAppService(mockRepo);
    queries = new FormulaQueries(mockRepo);
  });

  describe('Pure Domain Rules', () => {
    it('should validate valid formula', () => {
      const res = FormulaRules.validate({ productId: 'prod_1' });
      expect(res.valid).toBe(true);
    });

    it('should reject formula with empty productId', () => {
      const res = FormulaRules.validate({ productId: '   ' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('liên kết với một sản phẩm cụ thể');
    });

    it('should sanitize string declaredContent into numbers and fallback NaN to 0', () => {
      const rawFormula: any = {
        id: 'raw_1',
        productId: 'prod_1',
        ingredients: [
          { id: 'i1', name: 'A', declaredContent: '250.5', elementalContent: '120' },
          { id: 'i2', name: 'B', declaredContent: 'invalid_num' },
        ],
      };
      const clean = FormulaRules.sanitize(rawFormula);
      expect(clean.ingredients[0].declaredContent).toBe(250.5);
      expect(clean.ingredients[0].elementalContent).toBe(120);
      expect(clean.ingredients[1].declaredContent).toBe(0);
    });
  });

  describe('Formula Application Service', () => {
    it('should reject createFormula if user lacks permission', async () => {
      await expect(service.createFormula(sampleFormula, readOnlyUser)).rejects.toThrow(
        'Bạn không có quyền tạo Công thức sản phẩm'
      );
    });

    it('should dispatch FORMULA_CREATE and save to repo for admin', async () => {
      await service.createFormula(sampleFormula, adminUser);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'form_001', productId: 'prod_001' })
      );
    });

    it('should dispatch FORMULA_UPDATE on updateFormula', async () => {
      await service.updateFormula(sampleFormula, adminUser, 'Cap nhat cong thuc');
      expect(mockRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'form_001' }));
    });

    it('should dispatch FORMULA_ARCHIVE on deleteFormula', async () => {
      await service.deleteFormula('form_001', adminUser);
      expect(mockRepo.delete).toHaveBeenCalledWith('form_001');
    });
  });

  describe('Formula Queries', () => {
    it('should query all formulas', async () => {
      const all = await queries.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('form_001');
    });

    it('should find formula by product ID', async () => {
      const found = await queries.getByProductId('prod_001');
      expect(found).not.toBeNull();
      expect(found?.id).toBe('form_001');
    });
  });
});
