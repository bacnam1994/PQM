import { describe, it, expect } from 'vitest';
import {
  stripPharmaAffixes,
  calculateStringSimilarity,
  analyzeMaterialDuplicates,
  createMergeExecutionPlan
} from './materialHarmonizerService';
import { RawMaterial, ProductFormula } from '../../types';

describe('materialHarmonizerService', () => {
  it('strips pharma affixes correctly', () => {
    expect(stripPharmaAffixes('Cao khô Bạch quả')).toBe('bạch quả');
    expect(stripPharmaAffixes('Ginkgo Biloba Extract')).toBe('ginkgo biloba');
    expect(stripPharmaAffixes('Bột Paracetamol')).toBe('paracetamol');
  });

  it('calculates string similarity accurately for pharmaceutical terms', () => {
    const scoreExact = calculateStringSimilarity('Ginkgo Biloba', 'Ginkgo Biloba');
    expect(scoreExact).toBe(1.0);

    const scoreAffix = calculateStringSimilarity('Cao khô Bạch quả', 'Bạch quả');
    expect(scoreAffix).toBeGreaterThanOrEqual(0.9);

    const scoreDifferent = calculateStringSimilarity('Vitamin C', 'Paracetamol');
    expect(scoreDifferent).toBeLessThan(0.3);
  });

  it('detects duplicate raw materials and generates duplicate groups', () => {
    const rawMaterials: RawMaterial[] = [
      {
        id: 'mat_1',
        name: 'Ginkgo Biloba Extract',
        aliases: ['Cao bạch quả'],
        category: 'ACTIVE',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 'mat_2',
        name: 'Cao khô Bạch quả',
        aliases: [],
        category: 'ACTIVE',
        createdAt: '2026-01-02',
        updatedAt: '2026-01-02',
      },
      {
        id: 'mat_3',
        name: 'Vitamin C (Ascorbic Acid)',
        aliases: ['Acid Ascorbic'],
        category: 'ACTIVE',
        createdAt: '2026-01-03',
        updatedAt: '2026-01-03',
      },
    ];

    const formulas: ProductFormula[] = [
      {
        id: 'form_1',
        productId: 'prod_1',
        ingredients: [
          { id: 'ing_1', name: 'Ginkgo Biloba Extract', declaredContent: 120, unit: 'mg', materialId: 'mat_1' },
          { id: 'ing_2', name: 'Cao khô Bạch quả', declaredContent: 120, unit: 'mg', materialId: 'mat_2' }
        ],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      }
    ];

    const report = analyzeMaterialDuplicates(rawMaterials, formulas);
    expect(report.duplicateGroups.length).toBeGreaterThanOrEqual(1);
    expect(report.duplicateGroups[0].primaryMaterial).toBeDefined();

    const plan = createMergeExecutionPlan(report.duplicateGroups[0], formulas);
    expect(plan.deletedMaterialIds).toContain('mat_2');
    expect(plan.updatedPrimaryMaterial.aliases).toContain('Cao khô Bạch quả');
    expect(plan.updatedFormulas.length).toBe(1);
    expect(plan.updatedFormulas[0].ingredients[1].materialId).toBe('mat_1');
  });
});
