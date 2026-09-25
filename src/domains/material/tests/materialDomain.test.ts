import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaterialRules } from '../domain/rules';
import { MaterialAppService } from '../application/service';
import { MaterialQueries } from '../application/queries';
import { RawMaterial, ProductFormula } from '../domain/types';
import { createBaseMockRepository } from '../../../repositories/mockRepositoryHelper';
import { IMaterialRepository } from '../domain/types';

vi.mock('../../../services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

describe('Material Domain - Vertical Slice 2', () => {
  let mockRepo: IMaterialRepository;
  let service: MaterialAppService;
  let queries: MaterialQueries;

  const sampleMaterial: RawMaterial = {
    id: 'mat_001',
    code: 'MAT-PAR-01',
    name: 'Paracetamol Powder',
    aliases: ['Acetaminophen'],
    category: 'ACTIVE',
    standard: 'DĐVN V',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const adminUser = {
    id: 'usr_admin',
    displayName: 'Admin User',
    role: 'ADMIN',
    permissions: ['material:create', 'material:update', 'material:delete'],
  };

  const readOnlyUser = {
    id: 'usr_viewer',
    displayName: 'Viewer User',
    role: 'VIEWER',
    permissions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const base = createBaseMockRepository<RawMaterial>();
    mockRepo = {
      ...base,
      findAll: vi.fn(async () => [sampleMaterial]),
      findByCode: vi.fn(async (code: string) =>
        code === sampleMaterial.code ? sampleMaterial : null
      ),
      findByCasNumber: vi.fn(async (_cas: string) => null),
      searchByNameOrAlias: vi.fn(async (_query: string) => [sampleMaterial]),
    };
    service = new MaterialAppService(mockRepo);
    queries = new MaterialQueries(mockRepo);
  });

  describe('Pure Domain Rules', () => {
    it('should validate valid material', () => {
      const res = MaterialRules.validate({ name: 'Active Material' });
      expect(res.valid).toBe(true);
    });

    it('should reject material with empty name', () => {
      const res = MaterialRules.validate({ name: '   ' });
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Tên nguyên liệu không được để trống');
    });

    it('should correctly detect if material is used in formula ingredients or excipients', () => {
      const formulas: ProductFormula[] = [
        {
          id: 'form_1',
          productId: 'prod_1',
          version: 1,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          ingredients: [
            {
              id: 'ing_1',
              materialId: 'mat_001',
              name: 'Paracetamol',
              declaredContent: 500,
              unit: 'mg',
            },
          ],
          excipients: [],
        },
      ];
      expect(MaterialRules.isUsedInFormulas('mat_001', formulas)).toBe(true);
      expect(MaterialRules.isUsedInFormulas('mat_999', formulas)).toBe(false);
    });
  });

  describe('Material Application Service', () => {
    it('should reject createMaterial if user lacks permission', async () => {
      await expect(service.createMaterial(sampleMaterial, readOnlyUser)).rejects.toThrow(
        'Bạn không có quyền thêm mới nguyên liệu'
      );
    });

    it('should dispatch MATERIAL_CREATE and save to repo for admin', async () => {
      const newMat: RawMaterial = {
        id: 'mat_002',
        code: 'MAT-IBU-01',
        name: 'Ibuprofen',
        aliases: [],
        category: 'ACTIVE',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      };
      await service.createMaterial(newMat, adminUser);
      expect(mockRepo.save).toHaveBeenCalledWith(newMat);
    });

    it('should block deleteMaterial if material is used in formulas', async () => {
      const formulas: ProductFormula[] = [
        {
          id: 'form_1',
          productId: 'prod_1',
          version: 1,
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
          ingredients: [
            {
              id: 'ing_1',
              materialId: 'mat_001',
              name: 'Paracetamol',
              declaredContent: 500,
              unit: 'mg',
            },
          ],
          excipients: [],
        },
      ];
      await expect(service.deleteMaterial('mat_001', formulas, adminUser)).rejects.toThrow(
        'đang được sử dụng trong Công thức sản phẩm'
      );
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('should allow deleteMaterial if not used in any formula', async () => {
      await service.deleteMaterial('mat_001', [], adminUser, 'Paracetamol Powder');
      expect(mockRepo.delete).toHaveBeenCalledWith('mat_001');
    });
  });

  describe('Material Queries', () => {
    it('should query all materials', async () => {
      const all = await queries.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('mat_001');
    });

    it('should query material by code', async () => {
      const found = await queries.getByCode('MAT-PAR-01');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Paracetamol Powder');
    });
  });
});
