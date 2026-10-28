/**
 * PQM — Architecture & Static Guard Tests (Phase G / Sections 25 & 26)
 *
 * Kiểm tra 10 nguyên tắc kiến trúc cốt lõi:
 * 1. UI không import infrastructure / Firebase trực tiếp.
 * 2. UI không import Firebase SDK.
 * 3. AI không mutate regulated entities (bắt buộc qua Proposal).
 * 4. Regulated entity status không được set trực tiếp (chặn tại databaseService).
 * 5. State Machine là authority duy nhất cho workflow transition.
 * 6. Quality Engine là authority duy nhất cho quality status.
 * 7. AuditService là authority duy nhất cho audit trail ALCOA+.
 * 8. Repository không bypass security.
 * 9. Regulated query không full-scan fallback (Fail-Closed).
 * 10. Derived fields không trở thành authority.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  QualityWorkflowMatrixGuard,
  TestResultWorkflowStateMachine,
} from '../../src/domain/workflow/stateMachine';
import { QualityEvaluationEngine } from '../../src/domain/evaluation/QualityEvaluationEngine';
import { CanonicalStatusResolver } from '../../src/domain/canonical/canonicalResolver';
import { aiActionGuard } from '../../src/services/ai/aiActionGuard';
import { saveItem, updateBatchStatusService } from '../../src/services/databaseService';
import { getQueryPolicy, REGULATED_COLLECTIONS } from '../../src/repositories/queryPolicy';
import { AlcoaAuditManager } from '../../src/domain/audit/alcoaAuditModel';
import { logAuditAction } from '../../src/services/auditService';

describe('PQM Architectural Invariants & Static Guards (Phase G)', () => {
  const srcDir = path.resolve(__dirname, '../../src');
  const componentsDir = path.resolve(srcDir, 'components');
  const pagesDir = path.resolve(srcDir, 'pages');

  // Hàm đọc đệ quy tất cả các file code trong thư mục
  function getCodeFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getCodeFiles(fullPath));
      } else if (
        /\.(tsx|ts|jsx|js)$/.test(entry.name) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.')
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  // --------------------------------------------------------------------------
  // 1 & 2. UI Layer Isolation (No direct Firebase / Infrastructure imports)
  // --------------------------------------------------------------------------
  it('1 & 2. UI LAYER ISOLATION - Các file trong components và pages không được import Firebase SDK', () => {
    const uiFiles = [...getCodeFiles(componentsDir), ...getCodeFiles(pagesDir)];
    expect(uiFiles.length).toBeGreaterThan(0);

    const forbiddenPatterns = [
      /from ['"]firebase\//,
      /from ['"]firebase['"]/,
      /import\(.*firebase/,
    ];

    const violations: { file: string; line: string }[] = [];

    for (const filePath of uiFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line) => {
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(line) && !line.trim().startsWith('//')) {
            violations.push({ file: path.relative(srcDir, filePath), line: line.trim() });
          }
        }
      });
    }

    expect(violations).toEqual([]);
  });

  // --------------------------------------------------------------------------
  // 3. AI Governance Guard
  // --------------------------------------------------------------------------
  it('3. AI GOVERNANCE - AI không được tự ý thực thi các công cụ nhạy cảm (Regulated Actions)', () => {
    const regulatedTools = [
      { tool: 'updateBatchStatus', payload: { status: 'RELEASED' } },
      { tool: 'updateBatchStatusAction', payload: { status: 'REJECTED' } },
      { tool: 'autoHealInconsistencies', payload: {} },
      { tool: 'triggerAutoHealingAction', payload: {} },
      { tool: 'harmonizeMaterials', payload: {} },
    ];

    const adminUser = { id: 'admin-1', role: 'ADMIN', email: 'admin@pqm.vn' };

    for (const { tool, payload } of regulatedTools) {
      const isReg = aiActionGuard.isRegulatedToolAction(tool, payload);
      expect(isReg).toBe(true);

      const guard = aiActionGuard.validateAIAction(tool, payload, adminUser);
      expect(guard.allowed).toBe(true);
      expect(guard.requiresUserApproval).toBe(true);
      expect(guard.proposal).toBeDefined();
      expect(guard.proposal?.status).toBe('PENDING_APPROVAL');
    }
  });

  // --------------------------------------------------------------------------
  // 4. Regulated Entity Status Protection
  // --------------------------------------------------------------------------
  it('4. REGULATED STATUS PROTECTION - saveItem và updateBatchStatusService chặn ghi trực tiếp', async () => {
    await expect(saveItem('batches', 'B-01', { status: 'RELEASED' })).rejects.toThrow(
      /FORBIDDEN DIRECT WRITE/
    );

    await expect(updateBatchStatusService('B-01', 'RELEASED')).rejects.toThrow(
      /FORBIDDEN STATUS MUTATION/
    );
  });

  // --------------------------------------------------------------------------
  // 5. State Machine Authority
  // --------------------------------------------------------------------------
  it('5. STATE MACHINE AUTHORITY - Chuyển đổi trạng thái tài liệu kiểm nghiệm bắt buộc theo FSM', () => {
    // Không thể nhảy cóc từ DRAFT sang APPROVED khi chưa SUBMITTED/FINAL
    const jumpResult = TestResultWorkflowStateMachine.canTransition('DRAFT', 'APPROVED');
    expect(jumpResult.allowed).toBe(false);

    // Không thể nhảy từ DRAFT sang RELEASED
    const releaseDirectResult = TestResultWorkflowStateMachine.canTransition('DRAFT', 'RELEASED');
    expect(releaseDirectResult.allowed).toBe(false);

    // Đúng luồng: DRAFT -> SUBMITTED -> FINAL -> APPROVED -> RELEASED
    expect(TestResultWorkflowStateMachine.canTransition('DRAFT', 'SUBMITTED').allowed).toBe(true);
    expect(TestResultWorkflowStateMachine.canTransition('SUBMITTED', 'FINAL').allowed).toBe(true);
    expect(TestResultWorkflowStateMachine.canTransition('FINAL', 'APPROVED').allowed).toBe(true);
    expect(TestResultWorkflowStateMachine.canTransition('APPROVED', 'RELEASED').allowed).toBe(true);
  });

  // --------------------------------------------------------------------------
  // 6. Quality Engine Authority
  // --------------------------------------------------------------------------
  it('6. QUALITY ENGINE AUTHORITY - Chỉ QualityEvaluationEngine / CanonicalResolver quyết định PASS/FAIL', () => {
    // Có chỉ tiêu FAIL -> Kết luận tính ra bắt buộc là FAIL
    const overall = QualityEvaluationEngine.calculateOverallStatus(
      [
        { criterionId: 'C1', name: 'Định lượng', value: 99.5, isPass: true } as any,
        { criterionId: 'C2', name: 'Độ ẩm', value: 12.5, isPass: false } as any, // FAIL
      ],
      null
    );
    expect(overall).toBe('FAIL');

    // Có chỉ tiêu chưa có kết quả (undefined) -> PENDING
    const pendingEval = QualityEvaluationEngine.calculateOverallStatus(
      [{ criterionId: 'C1', name: 'Định lượng', value: '', isPass: undefined } as any],
      null
    );
    expect(pendingEval).toBe('PENDING');
  });

  // --------------------------------------------------------------------------
  // 7. Audit Service Authority
  // --------------------------------------------------------------------------
  it('7. AUDIT SERVICE AUTHORITY - AlcoaAuditManager & logAuditAction là thẩm quyền chuẩn mực tuân thủ ALCOA+', () => {
    expect(AlcoaAuditManager).toBeDefined();
    expect(typeof AlcoaAuditManager.computePayloadString).toBe('function');
    expect(typeof AlcoaAuditManager.verifyChainIntegrity).toBe('function');
    expect(typeof logAuditAction).toBe('function');
  });

  // --------------------------------------------------------------------------
  // 8 & 9. Query Policy & Fail-Closed
  // --------------------------------------------------------------------------
  it('8 & 9. QUERY POLICY - Fail-Closed kích hoạt trên 100% regulated collections, cấm full-scan fallback', () => {
    const requiredRegulatedCollections = [
      'batches',
      'testResults',
      'products',
      'tccsList',
      'productFormulas',
      'audit_logs',
    ];

    for (const col of requiredRegulatedCollections) {
      expect(REGULATED_COLLECTIONS.has(col)).toBe(true);
      const policy = getQueryPolicy(col);
      expect(policy.classification).toBe('REGULATED');
      expect(policy.failClosed).toBe(true);
      expect(policy.noFullScanFallback).toBe(true);
    }

    // Các collection không thuộc nhóm regulated
    const nonRegulatedPolicy = getQueryPolicy('ui_user_preferences');
    expect(nonRegulatedPolicy.classification).toBe('NON_REGULATED');
    expect(nonRegulatedPolicy.failClosed).toBe(false);
    expect(nonRegulatedPolicy.noFullScanFallback).toBe(false);
  });

  // --------------------------------------------------------------------------
  // 10. Derived Fields Hierarchy
  // --------------------------------------------------------------------------
  it('10. DERIVED FIELDS HIERARCHY - Các trường phái sinh (isPassed, overallResult) không được override Canonical Status', () => {
    // Bản ghi có cờ cũ isPassed: true nhưng criteria thực tế FAIL -> CanonicalStatusResolver trả về FAIL
    const mockTestResult: any = {
      id: 'TR-DISCREPANCY',
      batchId: 'BATCH-01',
      overallStatus: 'FAIL',
      isPassed: true, // Cờ legacy bị mâu thuẫn
      results: [{ criterionId: 'C1', name: 'Tạp chất', isPass: false }],
    };

    const resolvedStatus = CanonicalStatusResolver.resolveQualityStatus(mockTestResult);
    expect(resolvedStatus).toBe('FAIL');
    expect(resolvedStatus).not.toBe('PASS');
  });
});
