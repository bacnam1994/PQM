import { describe, it, expect } from 'vitest';
import { PHARMACOPOEIA_TEMPLATES, generateCriteriaFromFormula, checkTCCSFormulaConflicts } from './tccsAssistantService';
import { Criterion, CriterionType, ProductFormula } from '../../types';

describe('tccsAssistantService - AI Pharmacopoeia Templates & Formula Sync', () => {
  it('should provide standard criteria templates for TABLET', () => {
    const template = PHARMACOPOEIA_TEMPLATES.TABLET;
    expect(template).toBeDefined();
    expect(template.criteria.some(c => c.name === 'Độ rã' && c.max === 15)).toBe(true);
    expect(template.criteria.some(c => c.name === 'Độ hòa tan' && c.min === 75)).toBe(true);
    expect(template.criteria.some(c => c.category === 'micro')).toBe(true);
    expect(template.criteria.some(c => c.category === 'metal')).toBe(true);
  });

  it('should generate assay criteria from formula ingredients with +/- 10% bounds', () => {
    const mockFormula: ProductFormula = {
      id: 'f-1',
      productId: 'p-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ingredients: [
        { id: 'ing-1', name: 'Paracetamol', declaredContent: 500, unit: 'mg' },
        { id: 'ing-2', name: 'Caffeine', declaredContent: 65, unit: 'mg' }
      ]
    };

    const criteria = generateCriteriaFromFormula(mockFormula, 10);
    expect(criteria.length).toBe(2);

    const para = criteria.find(c => c.name.includes('Paracetamol'));
    expect(para).toBeDefined();
    expect(para?.min).toBe(450);
    expect(para?.max).toBe(550);
    expect(para?.type).toBe(CriterionType.NUMBER);

    const caff = criteria.find(c => c.name.includes('Caffeine'));
    expect(caff).toBeDefined();
    expect(caff?.min).toBe(58.5);
    expect(caff?.max).toBe(71.5);
  });

  it('should detect when active ingredients are missing in TCCS', () => {
    const mockFormula: ProductFormula = {
      id: 'f-2',
      productId: 'p-2',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ingredients: [
        { id: 'ing-1', name: 'Vitamin C', declaredContent: 100, unit: 'mg' },
        { id: 'ing-2', name: 'Vitamin B1', declaredContent: 10, unit: 'mg' }
      ]
    };

    const tccsCriteria: Criterion[] = [
      { name: 'Cảm quan', type: CriterionType.TEXT, unit: '' },
      { name: 'Định lượng Vitamin C', type: CriterionType.NUMBER, min: 90, max: 110, unit: 'mg' }
    ];

    const conflicts = checkTCCSFormulaConflicts(tccsCriteria, mockFormula);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]).toContain('Vitamin B1');
  });
});
