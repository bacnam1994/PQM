/**
 * ARCHITECTURE GATE: NO WORKFLOW BYPASS
 *
 * Kiểm tra bất biến: Cấm tuyệt đối bypass State Machine hoặc Release Gates.
 * 1. Admin không có quyền bypass State Machine (không tồn tại cờ adminOverride hay !isActorAdmin).
 * 2. Xuất xưởng lô (RELEASED) bắt buộc phải qua 7 Release Gates.
 * 3. Phiếu kiểm nghiệm không thể tự nhảy sang APPROVED mà không qua FSM.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  BatchStateMachine,
  TestResultStateMachine,
  DeviationStateMachine,
} from '../../src/domain/workflow/stateMachine';
import { ReleaseRules } from '../../src/domains/batch/domain/rules';

describe('Architecture Gate: No Workflow Bypass', () => {
  const srcDir = path.resolve(__dirname, '../../src');

  it('Không có mã nguồn nào sử dụng cờ adminOverride để bypass FSM', () => {
    function searchAdminOverride(dir: string): string[] {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let matches: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          matches = matches.concat(searchAdminOverride(fullPath));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (content.includes('adminOverride')) {
            matches.push(path.relative(srcDir, fullPath));
          }
        }
      }
      return matches;
    }

    const found = searchAdminOverride(srcDir);
    expect(found, `Tìm thấy cờ adminOverride trong source code:\n${found.join('\n')}`).toHaveLength(
      0
    );
  });

  it('BatchStateMachine từ chối các bước chuyển không hợp lệ (Fail-Closed)', () => {
    // Không thể nhảy từ PENDING sang RELEASED trực tiếp
    const canBypassPendingToReleased = BatchStateMachine.canTransition('PENDING', 'RELEASED');
    expect(canBypassPendingToReleased.allowed).toBe(false);

    // Không thể nhảy từ REJECTED sang RELEASED
    const canBypassRejectedToReleased = BatchStateMachine.canTransition('REJECTED', 'RELEASED');
    expect(canBypassRejectedToReleased.allowed).toBe(false);
  });

  it('TestResultStateMachine bảo vệ nghiêm ngặt chu trình trạng thái (SUPERSEDED là trạng thái kết thúc)', () => {
    // SUPERSEDED là trạng thái kết thúc bất biến, không thể chuyển tiếp sang PASS
    const canSupersededToPass = TestResultStateMachine.canTransition('SUPERSEDED', 'PASS');
    expect(canSupersededToPass.allowed).toBe(false);

    // Không thể nhảy trực tiếp từ PENDING sang SUPERSEDED (phải có kết quả trước)
    const cannotPendingToSuperseded = TestResultStateMachine.canTransition('PENDING', 'SUPERSEDED');
    expect(cannotPendingToSuperseded.allowed).toBe(false);

    // Không thể quay lui từ PASS về PENDING
    const cannotPassToPending = TestResultStateMachine.canTransition('PASS', 'PENDING');
    expect(cannotPassToPending.allowed).toBe(false);
  });

  it('ReleaseRules.evaluate7ReleaseGates bắt buộc 100% 7 Gates đạt PASS', () => {
    const mockBatch: any = {
      id: 'batch_test',
      status: 'TESTING',
      batchNo: 'TEST-01',
    };

    // Khi không có test results hoặc test results chưa APPROVED -> Chặn xuất xưởng
    const result = ReleaseRules.evaluate7ReleaseGates({
      batch: mockBatch,
      testResults: [],
      deviations: [],
    });
    expect(result.allGatesPassed).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });
});
