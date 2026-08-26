import { describe, it, expect } from 'vitest';
import { generatePQRRuleBasedNarrative, PQRQualityMetricsSummary } from './pqrNarrativeService';

describe('pqrNarrativeService - AI PQR Executive Summary Generator', () => {
  it('should generate comprehensive executive quality narrative', () => {
    const summary: PQRQualityMetricsSummary = {
      periodLabel: 'Năm 2026',
      productName: 'Paracetamol 500mg',
      totalBatches: 25,
      passedBatches: 24,
      failedBatches: 1,
      passRate: 96.0,
      criteriaCpkList: [
        { name: 'Định lượng Paracetamol', cpk: 1.45, isCapable: true },
        { name: 'Độ rã', cpk: 1.15, isCapable: false }
      ],
      totalOOSCount: 1
    };

    const narrative = generatePQRRuleBasedNarrative(summary);
    expect(narrative.fullNarrative).toBeDefined();
    expect(narrative.overviewSection).toContain('25 lô');
    expect(narrative.overviewSection).toContain('96.0%');
    expect(narrative.cpkEvaluationSection).toContain('Độ rã');
    expect(narrative.deviationSection).toContain('1 trường hợp');
    expect(narrative.conclusionAndPlanSection).toContain('KẾT LUẬN');
  });

  it('should handle perfect process capability with 100% Cpk >= 1.33', () => {
    const summary: PQRQualityMetricsSummary = {
      periodLabel: 'Quý 1/2026',
      productName: 'Amoxicillin 500mg',
      totalBatches: 10,
      passedBatches: 10,
      failedBatches: 0,
      passRate: 100.0,
      criteriaCpkList: [
        { name: 'Định lượng', cpk: 1.62, isCapable: true }
      ],
      totalOOSCount: 0
    };

    const narrative = generatePQRRuleBasedNarrative(summary);
    expect(narrative.cpkEvaluationSection).toContain('mức lý tưởng');
    expect(narrative.deviationSection).toContain('không phát sinh');
  });
});
