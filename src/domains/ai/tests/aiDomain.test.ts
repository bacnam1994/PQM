/**
 * AI BOUNDARY DOMAIN UNIT TESTS (VS-15)
 * =====================================
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AIBoundaryRules } from '../domain/rules';
import { AIActionGuard } from '../application/aiActionGuard';
import {
  writeAIDraft,
  peekAIDraft,
  consumeAIDraft,
  clearAIDraft,
  hasAIDraft,
  normalizeAIData,
} from '../application/aiDraftManager';

describe('AI Boundary Domain: Canonical Unit Tests (VS-15)', () => {
  describe('1. AIBoundaryRules Enforcement', () => {
    it('assertAdvisoryBoundary: chặn AI role trực tiếp gọi mutation nhạy cảm', () => {
      expect(() =>
        AIBoundaryRules.assertAdvisoryBoundary('BATCH_RELEASE_APPROVE', 'AI_ADVISORY')
      ).toThrow(/AI không được phép thực thi trực tiếp/);

      expect(() =>
        AIBoundaryRules.assertAdvisoryBoundary('TEST_RESULT_APPROVE', 'COPILOT')
      ).toThrow(/AI không được phép thực thi trực tiếp/);

      expect(() =>
        AIBoundaryRules.assertAdvisoryBoundary('BATCH_RELEASE_APPROVE', 'QA')
      ).not.toThrow();
    });

    it('resolveToolPermission: ánh xạ chính xác công cụ AI sang permission', () => {
      expect(
        AIBoundaryRules.resolveToolPermission('updateBatchStatus', { status: 'RELEASED' })
      ).toBe('batch:release');

      expect(
        AIBoundaryRules.resolveToolPermission('updateBatchStatus', { status: 'TESTING' })
      ).toBe('batch:update');

      expect(AIBoundaryRules.resolveToolPermission('createBatch', {})).toBe('batch:create');

      expect(AIBoundaryRules.resolveToolPermission('createTestResult', {})).toBe(
        'test_result:create'
      );

      expect(AIBoundaryRules.resolveToolPermission('queryDataNaturalLanguage', {})).toBe(
        'ai:query'
      );
    });

    it('isRegulatedToolAction: phân định chính xác hành động regulated', () => {
      expect(
        AIBoundaryRules.isRegulatedToolAction('updateBatchStatus', { status: 'RELEASED' })
      ).toBe(true);

      expect(
        AIBoundaryRules.isRegulatedToolAction('updateBatchStatus', { status: 'REJECTED' })
      ).toBe(true);

      expect(
        AIBoundaryRules.isRegulatedToolAction('updateBatchStatus', { status: 'TESTING' })
      ).toBe(false);

      expect(AIBoundaryRules.isRegulatedToolAction('autoHealInconsistencies', {})).toBe(true);

      expect(AIBoundaryRules.isRegulatedToolAction('harmonizeMaterials', {})).toBe(true);
    });

    it('calculateConfidenceScore: tính toán điểm tin cậy chuẩn xác', () => {
      // Trường số
      expect(AIBoundaryRules.calculateConfidenceScore({ confidence: 0.9 })).toEqual({
        score: 0.9,
        level: 'HIGH',
      });

      // Chuỗi HIGH/MEDIUM/LOW
      expect(AIBoundaryRules.calculateConfidenceScore({ confidence: 'HIGH' })).toEqual({
        score: 0.95,
        level: 'HIGH',
      });
      expect(AIBoundaryRules.calculateConfidenceScore({ confidence: 'LOW' })).toEqual({
        score: 0.5,
        level: 'LOW',
      });

      // Mảng kết quả
      const resultWithItems = {
        results: [{ confidence: 'HIGH' }, { confidence: 'MEDIUM' }],
      };
      const score = AIBoundaryRules.calculateConfidenceScore(resultWithItems);
      expect(score.score).toBe(0.85);
      expect(score.level).toBe('HIGH');
    });
  });

  describe('2. AIActionGuard Boundaries', () => {
    const adminUser = { uid: 'u_admin', email: 'admin@vbiotech.vn', role: 'ADMIN', isAdmin: true };
    const qaUser = { uid: 'u_qa', email: 'qa@vbiotech.vn', role: 'QA' };
    const viewerUser = { uid: 'u_viewer', email: 'viewer@vbiotech.vn', role: 'VIEWER' };

    it('chặn người dùng chưa đăng nhập', () => {
      const res = AIActionGuard.validateAIAction('queryDataNaturalLanguage', {}, null);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('Yêu cầu đăng nhập');
    });

    it('chặn người dùng không có quyền RBAC', () => {
      const res = AIActionGuard.validateAIAction(
        'updateBatchStatus',
        { status: 'RELEASED' },
        viewerUser
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain('không có quyền thực hiện');
    });

    it('tạo Proposal bắt buộc người dùng xác nhận đối với hành động Regulated', () => {
      const res = AIActionGuard.validateAIAction(
        'updateBatchStatus',
        { batchId: 'b-01', status: 'RELEASED' },
        qaUser,
        'Tất cả chỉ tiêu đã đạt'
      );
      expect(res.allowed).toBe(true);
      expect(res.requiresUserApproval).toBe(true);
      expect(res.proposal).toBeDefined();
      expect(res.proposal?.status).toBe('PENDING_APPROVAL');
      expect(res.proposal?.targetEntity).toBe('b-01');
      expect(res.proposal?.requiredPermission).toBe('batch:release');
    });

    it('cho phép hành động không nhạy cảm được tự động duyệt proposal', () => {
      const res = AIActionGuard.validateAIAction(
        'queryDataNaturalLanguage',
        { query: 'Danh sách lô tháng 9' },
        qaUser
      );
      expect(res.allowed).toBe(true);
      expect(res.requiresUserApproval).toBe(false);
      expect(res.proposal?.status).toBe('APPROVED');
    });
  });

  describe('3. AIDraftManager & Temporary State Isolation', () => {
    beforeEach(() => {
      clearAIDraft();
    });

    it('ghi draft, kiểm tra sự tồn tại và đọc nội dung draft', () => {
      expect(hasAIDraft()).toBe(false);
      expect(peekAIDraft()).toBeNull();

      const sampleData = { batchNo: 'L260901', criteria: [{ name: 'Độ ẩm', value: '5%' }] };
      const id = writeAIDraft(sampleData);

      expect(id).toBeDefined();
      expect(hasAIDraft()).toBe(true);

      const peeked = peekAIDraft();
      expect(peeked).not.toBeNull();
      expect(peeked?.data).toEqual(sampleData);
    });

    it('consume draft trả về dữ liệu kèm consumedAt và xóa khỏi storage', () => {
      writeAIDraft({ test: 'consume' });
      expect(hasAIDraft()).toBe(true);

      const consumed = consumeAIDraft();
      expect(consumed).not.toBeNull();
      expect(consumed?.consumedAt).toBeDefined();
      expect(consumed?.data).toEqual({ test: 'consume' });

      // Sau khi consume thì storage đã sạch
      expect(hasAIDraft()).toBe(false);
      expect(peekAIDraft()).toBeNull();
    });

    it('normalizeAIData: làm sạch và cấu trúc lại dữ liệu trích xuất từ AI', () => {
      const rawInput = {
        labName: '  Viện Kiểm Nghiệm Thuốc TƯ  ',
        batchNo: '  L260901 ',
        testDate: ' 2026-09-27 ',
        testResults: [
          { criteriaName: ' Định tính ', value: 100, unit: '%', limit: '98-102' },
          { criteriaName: '', value: 'empty name' },
          null,
        ],
      };

      const normalized = normalizeAIData(rawInput);
      expect(normalized).not.toBeNull();
      expect(normalized?.labName).toBe('Viện Kiểm Nghiệm Thuốc TƯ');
      expect(normalized?.batchNo).toBe('L260901');
      expect(normalized?.testResults).toHaveLength(1);
      expect(normalized?.testResults[0]).toEqual({
        criteriaName: 'Định tính',
        value: '100',
        unit: '%',
        limit: '98-102',
      });
    });
  });
});
