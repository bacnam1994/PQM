/**
 * aiGovernance.test.ts
 * =======================================================
 * Kiểm thử kiến trúc Quản trị AI (P11 - AI Governance Architecture Test)
 * Đảm bảo:
 * 1. AI chỉ đóng vai trò: OCR, Mapping, Suggestion, Explanation, Summary, Prediction, Investigation.
 * 2. AI KHÔNG BAO GIỜ tự ý đưa ra quyết định PASS/FAIL có tính thẩm quyền (Authoritative Decision).
 * 3. Mọi đánh giá PASS/FAIL bắt buộc phải qua Deterministic Evaluation Engine (QualityEvaluationEngine).
 * 4. Các luồng nghiệp vụ rủi ro cao (Clearance, Release, OOS) bắt buộc Human-in-the-Loop.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AIGovernanceService } from '../services/ai/aiGovernanceService';
import { QualityEvaluationEngine } from '../domain/evaluation/QualityEvaluationEngine';
import { CriterionEvaluator } from '../domain/evaluation/CriterionEvaluator';
import { Criterion } from '../types';

describe('P11 — AI Governance & Deterministic Evaluation Authority', () => {
  describe('Nguyên tắc 1: Quyền quyết định ĐẠT / KHÔNG ĐẠT thuộc về Deterministic Engine', () => {
    it('QualityEvaluationEngine & CriterionEvaluator đánh giá hoàn toàn tất định (deterministic), không phụ thuộc AI', () => {
      const criterion: Criterion = {
        name: 'Định lượng Paracetamol',
        type: 'NUMBER',
        min: 95.0,
        max: 105.0,
      } as any;

      // TH1: 100.0% -> PASS
      const passResult = CriterionEvaluator.evaluateCriterion(criterion, '100.0');
      expect(passResult.isPass).toBe(true);
      expect(QualityEvaluationEngine.evaluateCriterionSmart(criterion, '100.0')).toBe(true);

      // TH2: 90.0% -> FAIL
      const failResult = CriterionEvaluator.evaluateCriterion(criterion, '90.0');
      expect(failResult.isPass).toBe(false);
      expect(QualityEvaluationEngine.evaluateCriterionSmart(criterion, '90.0')).toBe(false);

      // Cùng input luôn ra cùng output (100% deterministic)
      const repeatResult = CriterionEvaluator.evaluateCriterion(criterion, '90.0');
      expect(repeatResult.isPass).toBe(failResult.isPass);
    });
  });

  describe('Nguyên tắc 2: Phân loại rủi ro & Human-in-the-loop (AIGovernanceService)', () => {
    it('các tính năng rủi ro cao bắt buộc phải có chữ ký/phê duyệt của con người (Human Signoff)', () => {
      const highRiskFeatures = [
        'BATCH_CLEARANCE',
        'OOS_INVESTIGATION',
        'RELEASE_DOSSIER',
        'DEVIATION_CLOSURE',
      ];

      for (const feature of highRiskFeatures) {
        const risk = AIGovernanceService.classifyRisk(feature);
        expect(risk.riskLevel).toBe('HIGH');
        expect(risk.requiresHumanSignoff).toBe(true);
      }
    });

    it('tính năng tra cứu/trợ giúp nhập liệu có mức độ rủi ro thấp', () => {
      const lowRisk = AIGovernanceService.classifyRisk('OCR_EXTRACTION');
      expect(lowRisk.riskLevel).toBe('LOW');
      expect(lowRisk.requiresHumanSignoff).toBe(false);
    });

    it('chính sách độ tin cậy buộc nhập liệu thủ công nếu AI score < 70%', () => {
      const lowConfidence = AIGovernanceService.evaluateConfidence(65);
      expect(lowConfidence.decision).toBe('FORCE_MANUAL');

      const mediumConfidence = AIGovernanceService.evaluateConfidence(85);
      expect(mediumConfidence.decision).toBe('REQUIRE_REVIEW');

      const highConfidence = AIGovernanceService.evaluateConfidence(98);
      expect(highConfidence.decision).toBe('AUTO_ACCEPT');
    });

    it('ghi nhận nhật ký kiểm toán AI (AIRunAuditRecord) cùng quyết định người dùng', () => {
      const record = AIGovernanceService.createRunRecord(
        'BATCH_CLEARANCE',
        'gemini-1.5-pro',
        'v2.1',
        92,
        'Dữ liệu 10 lô xuất xưởng',
        'Khuyến nghị thẩm tra'
      );

      expect(record.riskLevel).toBe('HIGH');
      expect(record.runId).toBeDefined();

      const signed = AIGovernanceService.recordHumanSignoff(
        record,
        'MODIFIED',
        'qa_manager@vbiotech.vn',
        'Điều chỉnh do bổ sung kết quả vi sinh'
      );

      expect(signed.humanDecision).toBe('MODIFIED');
      expect(signed.decidedBy).toBe('qa_manager@vbiotech.vn');
      expect(signed.overrideReason).toContain('vi sinh');
    });
  });

  describe('Nguyên tắc 3: Kiểm tra tĩnh mã nguồn — Không có AI service nào tự ý cập nhật Firebase trực tiếp', () => {
    it('toàn bộ file trong src/services/ai không được gọi trực tiếp Firebase mutation API (set, remove, update)', () => {
      const aiDir = path.resolve(__dirname, '../services/ai');
      const files = fs
        .readdirSync(aiDir)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

      const directMutationPatterns = [
        /\bset\s*\(\s*ref\s*\(/,
        /\bremove\s*\(\s*ref\s*\(/,
        /\bupdate\s*\(\s*ref\s*\(/,
      ];

      const violations: string[] = [];

      for (const file of files) {
        const filePath = path.join(aiDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        for (const pattern of directMutationPatterns) {
          if (pattern.test(content)) {
            violations.push(`${file} vi phạm: tự ý gọi direct Firebase mutation: ${pattern}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
