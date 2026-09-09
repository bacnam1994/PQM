import { describe, it, expect } from 'vitest';
import { AIGovernanceService } from './aiGovernanceService';

describe('TASK-008: AI Governance & Risk Management Service', () => {
  describe('1. Risk Classification (GAMP 5 & GMP)', () => {
    it('phân loại HIGH RISK đối với các tác vụ xuất xưởng lô và điều tra OOS', () => {
      const clearanceEval = AIGovernanceService.classifyRisk('BATCH_CLEARANCE');
      expect(clearanceEval.riskLevel).toBe('HIGH');
      expect(clearanceEval.requiresHumanSignoff).toBe(true);

      const oosEval = AIGovernanceService.classifyRisk('OOS_INVESTIGATION');
      expect(oosEval.riskLevel).toBe('HIGH');
    });

    it('phân loại MEDIUM RISK đối với dự đoán động học suy giảm và so sánh Lab', () => {
      const stabilityEval = AIGovernanceService.classifyRisk('STABILITY_PREDICTION');
      expect(stabilityEval.riskLevel).toBe('MEDIUM');
      expect(stabilityEval.requiresHumanSignoff).toBe(true);
    });

    it('phân loại LOW RISK đối với tra cứu và OCR trích xuất thông tin', () => {
      const searchEval = AIGovernanceService.classifyRisk('GENERAL_SEARCH');
      expect(searchEval.riskLevel).toBe('LOW');
      expect(searchEval.requiresHumanSignoff).toBe(false);
    });
  });

  describe('2. Confidence Policy Evaluation', () => {
    it('cho phép AUTO_ACCEPT khi độ tin cậy >= 95%', () => {
      const res = AIGovernanceService.evaluateConfidence(98);
      expect(res.decision).toBe('AUTO_ACCEPT');
      expect(res.confidence).toBe(98);
    });

    it('bắt buộc REQUIRE_REVIEW khi độ tin cậy trong khoảng 70% - 94%', () => {
      const res = AIGovernanceService.evaluateConfidence(85);
      expect(res.decision).toBe('REQUIRE_REVIEW');
      expect(res.message).toContain('Bắt buộc người dùng phải kiểm tra');
    });

    it('ép FORCE_MANUAL khi độ tin cậy < 70%', () => {
      const res = AIGovernanceService.evaluateConfidence(62);
      expect(res.decision).toBe('FORCE_MANUAL');
      expect(res.message).toContain('Bắt buộc nhập liệu thủ công');
    });
  });

  describe('3. AI Run Record & Human-in-the-Loop Signoff', () => {
    it('tạo bản ghi chạy AI với đầy đủ siêu dữ liệu và rủi ro tương ứng', () => {
      const record = AIGovernanceService.createRunRecord(
        'BATCH_CLEARANCE',
        'gemini-2.5-pro',
        'v1.0.0',
        92,
        'Lô Ginkgo L26001',
        'Khuyến nghị RELEASE có điều kiện'
      );

      expect(record.riskLevel).toBe('HIGH');
      expect(record.model).toBe('gemini-2.5-pro');
      expect(record.runId).toBeDefined();
    });

    it('ghi nhận quyết định phê duyệt có điều chỉnh của QA (Human Signoff)', () => {
      const record = AIGovernanceService.createRunRecord(
        'BATCH_CLEARANCE',
        'gemini-2.5-pro',
        'v1.0.0',
        92,
        'Lô Ginkgo L26001',
        'Khuyến nghị RELEASE'
      );

      const signedRecord = AIGovernanceService.recordHumanSignoff(
        record,
        'MODIFIED',
        'qa_manager@pqm.com',
        'Điều chỉnh giữ lại 10 hộp để kiểm tra lại vi sinh'
      );

      expect(signedRecord.humanDecision).toBe('MODIFIED');
      expect(signedRecord.decidedBy).toBe('qa_manager@pqm.com');
      expect(signedRecord.overrideReason).toContain('kiểm tra lại vi sinh');
    });
  });
});
