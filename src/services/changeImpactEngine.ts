/**
 * PQM V4 Platform - Change Impact Engine (Động cơ Đánh giá Tác động Thay đổi TCCS)
 * Phân tích độ lệch phiên bản TCCS, rà soát các Lô sản xuất đang mở và Phiếu kiểm nghiệm chưa khóa.
 * Cảnh báo xung đột tiêu chuẩn khi ban hành phiên bản TCCS mới.
 */

import { TCCS, Criterion, Batch, TestResult } from '../types';

export type CriterionDiffType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';

export interface CriterionDiff {
  name: string;
  type: CriterionDiffType;
  oldCriterion?: Criterion;
  newCriterion?: Criterion;
  changes: string[];
}

export interface BatchImpactInfo {
  batchId: string;
  batchNo: string;
  status: string;
  impactNote: string;
}

export interface TestResultConflictInfo {
  testResultId: string;
  batchId: string;
  testDate: string;
  conflictDetails: string[];
}

export interface TCCSChangeImpactReport {
  productId: string;
  oldTccsId: string;
  oldTccsCode: string;
  newTccsId: string;
  newTccsCode: string;
  versionChange: string;
  criteriaDiffs: CriterionDiff[];
  hasCriticalSpecificationChanges: boolean;
  affectedActiveBatches: BatchImpactInfo[];
  potentialTestResultConflicts: TestResultConflictInfo[];
  recommendedActions: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export class ChangeImpactEngine {
  /**
   * So sánh sự thay đổi giữa hai danh sách chỉ tiêu TCCS
   */
  static compareCriteria(oldList: Criterion[] = [], newList: Criterion[] = []): CriterionDiff[] {
    const diffs: CriterionDiff[] = [];
    const oldMap = new Map<string, Criterion>();
    const newMap = new Map<string, Criterion>();

    oldList.forEach(c => oldMap.set(c.name.trim().toLowerCase(), c));
    newList.forEach(c => newMap.set(c.name.trim().toLowerCase(), c));

    // 1. Kiểm tra các chỉ tiêu cũ bị sửa hoặc bị xóa
    oldMap.forEach((oldCrit, key) => {
      const newCrit = newMap.get(key);
      if (!newCrit) {
        diffs.push({
          name: oldCrit.name,
          type: 'REMOVED',
          oldCriterion: oldCrit,
          changes: ['Chỉ tiêu bị loại bỏ khỏi phiên bản TCCS mới']
        });
      } else {
        const changes: string[] = [];
        if (oldCrit.min !== newCrit.min) {
          changes.push(`Giới hạn Min đổi từ ${oldCrit.min ?? 'không có'} thành ${newCrit.min ?? 'không có'}`);
        }
        if (oldCrit.max !== newCrit.max) {
          changes.push(`Giới hạn Max đổi từ ${oldCrit.max ?? 'không có'} thành ${newCrit.max ?? 'không có'}`);
        }
        if (oldCrit.unit !== newCrit.unit) {
          changes.push(`Đơn vị đổi từ "${oldCrit.unit}" sang "${newCrit.unit}"`);
        }
        if (oldCrit.expectedText !== newCrit.expectedText) {
          changes.push(`Yêu cầu cảm quan đổi từ "${oldCrit.expectedText || ''}" sang "${newCrit.expectedText || ''}"`);
        }

        diffs.push({
          name: newCrit.name,
          type: changes.length > 0 ? 'MODIFIED' : 'UNCHANGED',
          oldCriterion: oldCrit,
          newCriterion: newCrit,
          changes
        });
      }
    });

    // 2. Kiểm tra các chỉ tiêu mới được thêm vào
    newMap.forEach((newCrit, key) => {
      if (!oldMap.has(key)) {
        diffs.push({
          name: newCrit.name,
          type: 'ADDED',
          newCriterion: newCrit,
          changes: ['Chỉ tiêu mới được bổ sung vào phiên bản TCCS']
        });
      }
    });

    return diffs;
  }

  /**
   * Đánh giá tác động toàn diện khi thay đổi hoặc ban hành TCCS mới
   */
  static assessImpact(
    oldTCCS: TCCS,
    newTCCS: TCCS,
    allBatches: Batch[],
    allTestResults: TestResult[]
  ): TCCSChangeImpactReport {
    const oldAllCriteria = [...(oldTCCS.mainQualityCriteria || []), ...(oldTCCS.safetyCriteria || [])];
    const newAllCriteria = [...(newTCCS.mainQualityCriteria || []), ...(newTCCS.safetyCriteria || [])];

    const criteriaDiffs = this.compareCriteria(oldAllCriteria, newAllCriteria);
    const hasSpecChanges = criteriaDiffs.some(d => d.type === 'ADDED' || d.type === 'REMOVED' || d.type === 'MODIFIED');

    // 1. Rà soát Lô sản xuất đang hoạt động của sản phẩm này (PENDING, TESTING, PACKAGING)
    const activeBatches = allBatches.filter(
      b => b.productId === oldTCCS.productId && b.status !== 'RELEASED' && b.status !== 'REJECTED'
    );

    const affectedActiveBatches: BatchImpactInfo[] = activeBatches.map(b => ({
      batchId: b.id,
      batchNo: b.batchNo,
      status: b.status,
      impactNote: `Lô đang ở trạng thái ${b.status}, cần cập nhật tham chiếu TCCS sang ${newTCCS.code}`
    }));

    // 2. Rà soát Phiếu kiểm nghiệm chưa khóa (DRAFT hoặc đang xét duyệt)
    const activeBatchIds = new Set(activeBatches.map(b => b.id));
    const pendingTestResults = allTestResults.filter(
      r => activeBatchIds.has(r.batchId) && (r as any).overallStatus !== 'APPROVED'
    );

    const potentialTestResultConflicts: TestResultConflictInfo[] = [];

    pendingTestResults.forEach(res => {
      const conflicts: string[] = [];
      const resultMap = new Map<string, string | number>();
      (res.results || []).forEach(r => resultMap.set(r.criteriaName.trim().toLowerCase(), r.value));

      criteriaDiffs.forEach(diff => {
        if (diff.type === 'ADDED') {
          conflicts.push(`Phiếu chưa có kết quả cho chỉ tiêu mới: "${diff.name}"`);
        } else if (diff.type === 'MODIFIED' && diff.newCriterion) {
          const recordedVal = resultMap.get(diff.name.trim().toLowerCase());
          if (recordedVal !== undefined && typeof recordedVal === 'number') {
            const min = diff.newCriterion.min;
            const max = diff.newCriterion.max;
            if (min !== undefined && recordedVal < min) {
              conflicts.push(`Giá trị ${recordedVal} của chỉ tiêu "${diff.name}" dưới ngưỡng Min mới (${min})`);
            }
            if (max !== undefined && recordedVal > max) {
              conflicts.push(`Giá trị ${recordedVal} của chỉ tiêu "${diff.name}" vượt ngưỡng Max mới (${max})`);
            }
          }
        }
      });

      if (conflicts.length > 0) {
        potentialTestResultConflicts.push({
          testResultId: res.id,
          batchId: res.batchId,
          testDate: res.testDate,
          conflictDetails: conflicts
        });
      }
    });

    // 3. Phân cấp mức độ rủi ro
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (potentialTestResultConflicts.length > 0) {
      riskLevel = 'HIGH';
    } else if (affectedActiveBatches.length > 0 || hasSpecChanges) {
      riskLevel = 'MEDIUM';
    }

    // 4. Đề xuất hành động
    const recommendedActions: string[] = [];
    if (affectedActiveBatches.length > 0) {
      recommendedActions.push(`Thông báo cho Quản đốc phân xưởng và QA về ${affectedActiveBatches.length} lô đang sản xuất chịu ảnh hưởng.`);
    }
    if (potentialTestResultConflicts.length > 0) {
      recommendedActions.push(`Yêu cầu Phòng Kiểm nghiệm (QC) tái thẩm tra ${potentialTestResultConflicts.length} phiếu kiểm nghiệm có xung đột.`);
    }
    if (recommendedActions.length === 0) {
      recommendedActions.push('Thay đổi tiêu chuẩn an toàn, không có xung đột trực tiếp với các lô đang sản xuất.');
    }

    return {
      productId: oldTCCS.productId,
      oldTccsId: oldTCCS.id,
      oldTccsCode: oldTCCS.code,
      newTccsId: newTCCS.id,
      newTccsCode: newTCCS.code,
      versionChange: `${oldTCCS.code} ➔ ${newTCCS.code}`,
      criteriaDiffs,
      hasCriticalSpecificationChanges: hasSpecChanges,
      affectedActiveBatches,
      potentialTestResultConflicts,
      recommendedActions,
      riskLevel
    };
  }
}
