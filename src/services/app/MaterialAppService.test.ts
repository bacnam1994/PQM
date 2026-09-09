import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaterialAppService } from './MaterialAppService';
import { IMaterialRepository } from '../../repositories/MaterialRepository';
import { RawMaterial, ProductFormula } from '../../types';

describe('MaterialAppService - PQM 3.0 Application Service', () => {
  let mockRepo: IMaterialRepository;
  let service: MaterialAppService;

  const adminUser = { uid: 'u-admin', role: 'ADMIN', isAdmin: true };
  const viewerUser = { uid: 'u-viewer', role: 'VIEWER' };

  const sampleMaterial: RawMaterial = {
    id: 'mat-001',
    code: 'NL-GINKGO',
    name: 'Cao khô Bạch quả (Ginkgo Biloba Extract)',
    aliases: ['Chiết xuất bạch quả'],
    category: 'ACTIVE',
    standard: 'DĐVN V',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  const sampleFormula: ProductFormula = {
    id: 'form-001',
    productId: 'prod-001',
    ingredients: [
      { id: 'ing-1', name: 'Cao khô Bạch quả', declaredContent: 120, unit: 'mg', materialId: 'mat-001' }
    ],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(sampleMaterial),
      findAll: vi.fn().mockResolvedValue([sampleMaterial]),
      findByCode: vi.fn().mockResolvedValue(sampleMaterial),
      findByCasNumber: vi.fn().mockResolvedValue(null),
      searchByNameOrAlias: vi.fn().mockResolvedValue([sampleMaterial]),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    service = new MaterialAppService(mockRepo);
  });

  it('should allow authorized user to create raw material', async () => {
    await expect(service.createMaterial(sampleMaterial, adminUser)).resolves.not.toThrow();
    expect(mockRepo.save).toHaveBeenCalledWith(sampleMaterial);
  });

  it('should deny unauthorized viewer from creating material', async () => {
    await expect(service.createMaterial(sampleMaterial, viewerUser)).rejects.toThrow('Từ chối quyền');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should block deletion of material when it is in use by a product formula', async () => {
    await expect(
      service.deleteMaterial('mat-001', [sampleFormula], adminUser, 'Cao khô Bạch quả')
    ).rejects.toThrow('đang được sử dụng trong Công thức');
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should allow deletion when material is NOT used in any product formula', async () => {
    await expect(
      service.deleteMaterial('mat-unused', [sampleFormula], adminUser, 'Nguyên liệu thử nghiệm')
    ).resolves.not.toThrow();
    expect(mockRepo.delete).toHaveBeenCalledWith('mat-unused');
  });
});
