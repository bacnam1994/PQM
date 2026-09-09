import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormulaAppService } from './FormulaAppService';
import { IFormulaRepository } from '../../repositories/FormulaRepository';
import { ProductFormula } from '../../types';

describe('FormulaAppService - PQM 3.0 Application Service', () => {
  let mockRepo: IFormulaRepository;
  let service: FormulaAppService;

  const adminUser = { uid: 'u-admin', role: 'ADMIN', isAdmin: true };
  const qaUser = { uid: 'u-qa', role: 'QA' };
  const viewerUser = { uid: 'u-viewer', role: 'VIEWER' };

  const sampleFormula: ProductFormula = {
    id: 'form-001',
    productId: 'prod-001',
    ingredients: [
      { id: 'ing-1', name: 'Cao khô Bạch quả', declaredContent: 120, elementalContent: 28.8, unit: 'mg' },
      { id: 'ing-2', name: 'Magie stearat', declaredContent: '5.5' as any, unit: 'mg' }
    ],
    excipients: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn().mockResolvedValue(sampleFormula),
      findAll: vi.fn().mockResolvedValue([sampleFormula]),
      findByProductId: vi.fn().mockResolvedValue(sampleFormula),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined)
    };
    service = new FormulaAppService(mockRepo);
  });

  it('should sanitize string declaredContent into proper float numbers', () => {
    const cleaned = service.sanitizeFormula(sampleFormula);
    expect(typeof cleaned.ingredients[1].declaredContent).toBe('number');
    expect(cleaned.ingredients[1].declaredContent).toBe(5.5);
  });

  it('should allow authorized user to create formula', async () => {
    await expect(service.createFormula(sampleFormula, qaUser)).resolves.not.toThrow();
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should deny unauthorized viewer from creating formula', async () => {
    await expect(service.createFormula(sampleFormula, viewerUser)).rejects.toThrow('Từ chối quyền');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should allow authorized user to delete formula', async () => {
    await expect(service.deleteFormula('form-001', adminUser)).resolves.not.toThrow();
    expect(mockRepo.delete).toHaveBeenCalledWith('form-001');
  });
});
