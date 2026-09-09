import { describe, it, expect } from 'vitest';
import { ChangeImpactEngine } from './changeImpactEngine';
import { TCCS, Criterion, CriterionType, Batch, TestResult } from '../types';

describe('TASK-009: ChangeImpactEngine - TCCS Versioning & Impact Assessment', () => {
  const cMoisture: Criterion = { name: 'Độ ẩm', unit: '%', min: 0, max: 9.0, type: CriterionType.NUMBER };
  const cAssayOld: Criterion = { name: 'Định lượng Ginkgo', unit: '%', min: 22.0, max: 27.0, type: CriterionType.NUMBER };
  const cAssayTightened: Criterion = { name: 'Định lượng Ginkgo', unit: '%', min: 23.0, max: 26.0, type: CriterionType.NUMBER };
  const cHeavyMetals: Criterion = { name: 'Kim loại nặng', unit: 'ppm', max: 20, type: CriterionType.NUMBER };

  const oldTCCS: TCCS = {
    id: 'tccs-1',
    productId: 'prod-ginkgo',
    code: 'TCCS 01:2024',
    issueDate: '2024-01-01',
    isActive: true,
    mainQualityCriteria: [cMoisture, cAssayOld],
    safetyCriteria: [],
    createdAt: '2024-01-01T00:00:00Z'
  };

  const newTCCS: TCCS = {
    id: 'tccs-2',
    productId: 'prod-ginkgo',
    code: 'TCCS 01:2026',
    issueDate: '2026-03-01',
    isActive: true,
    mainQualityCriteria: [cMoisture, cAssayTightened], // Siết chặt định lượng 23 - 26%
    safetyCriteria: [cHeavyMetals], // Thêm kim loại nặng
    createdAt: '2026-03-01T00:00:00Z'
  };

  describe('1. Criteria Comparison (Diff Engine)', () => {
    it('phát hiện chỉ tiêu siết chặt min/max và chỉ tiêu mới được thêm vào', () => {
      const diffs = ChangeImpactEngine.compareCriteria(
        [cMoisture, cAssayOld],
        [cMoisture, cAssayTightened, cHeavyMetals]
      );

      expect(diffs.length).toBe(3);

      const moistureDiff = diffs.find(d => d.name === 'Độ ẩm');
      expect(moistureDiff?.type).toBe('UNCHANGED');

      const assayDiff = diffs.find(d => d.name === 'Định lượng Ginkgo');
      expect(assayDiff?.type).toBe('MODIFIED');
      expect(assayDiff?.changes.some(c => c.includes('Min'))).toBe(true);

      const metalDiff = diffs.find(d => d.name === 'Kim loại nặng');
      expect(metalDiff?.type).toBe('ADDED');
    });
  });

  describe('2. Comprehensive Change Impact Assessment', () => {
    const batches: Batch[] = [
      { id: 'b-active', productId: 'prod-ginkgo', batchNo: 'L26001', status: 'TESTING', tccsId: 'tccs-1', mfgDate: '2026-02-01', expDate: '2028-02-01', theoreticalYield: 1000, actualYield: 980, yieldUnit: 'Hộp', createdAt: '2026-02-01' },
      { id: 'b-released', productId: 'prod-ginkgo', batchNo: 'L25099', status: 'RELEASED', tccsId: 'tccs-1', mfgDate: '2025-12-01', expDate: '2027-12-01', theoreticalYield: 1000, actualYield: 990, yieldUnit: 'Hộp', createdAt: '2025-12-01' },
      { id: 'b-other', productId: 'prod-other', batchNo: 'L999', status: 'TESTING', tccsId: 'tccs-x', mfgDate: '2026-01-01', expDate: '2028-01-01', theoreticalYield: 500, actualYield: 490, yieldUnit: 'Lọ', createdAt: '2026-01-01' }
    ];

    const testResults: TestResult[] = [
      {
        id: 'tr-active',
        batchId: 'b-active',
        labName: 'Lab Trung Tâm',
        testDate: '2026-02-15',
        overallStatus: 'PASS', // Đạt theo TCCS cũ (22.5%) nhưng sẽ TRƯỢT theo TCCS mới (yêu cầu >= 23.0%)
        results: [
          { criteriaName: 'Độ ẩm', value: 5.0, isPass: true },
          { criteriaName: 'Định lượng Ginkgo', value: 22.5, isPass: true }
        ],
        createdAt: '2026-02-15'
      }
    ];

    it('rà soát và cảnh báo xung đột giới hạn tiêu chuẩn mới với phiếu kiểm nghiệm chưa khóa', () => {
      const report = ChangeImpactEngine.assessImpact(oldTCCS, newTCCS, batches, testResults);

      expect(report.hasCriticalSpecificationChanges).toBe(true);
      expect(report.affectedActiveBatches.length).toBe(1);
      expect(report.affectedActiveBatches[0].batchNo).toBe('L26001');

      // Phát hiện xung đột giá trị 22.5% dưới Min mới (23.0%)
      expect(report.potentialTestResultConflicts.length).toBe(1);
      expect(report.potentialTestResultConflicts[0].conflictDetails.some(d => d.includes('dưới ngưỡng Min mới'))).toBe(true);

      // Đánh giá mức rủi ro CAO vì có phiếu bị ảnh hưởng tiêu chuẩn
      expect(report.riskLevel).toBe('HIGH');
      expect(report.recommendedActions.some(a => a.includes('tái thẩm tra'))).toBe(true);
    });
  });
});
