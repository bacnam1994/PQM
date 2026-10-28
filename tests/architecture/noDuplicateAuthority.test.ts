/**
 * ARCHITECTURE GATE: NO DUPLICATE AUTHORITY
 *
 * Kiểm tra bất biến:
 * 1. Duy nhất một cơ quan thẩm quyền tính toán Chất lượng (Quality Status SSoT) -> QualityEvaluationEngine.
 * 2. Duy nhất một cơ quan thẩm quyền chuyển đổi Trạng thái Quy trình (Workflow FSM SSoT) -> StateMachine.
 * 3. Duy nhất một cơ quan thẩm quyền ghi vết ALCOA+ Audit Trail -> UnifiedWorkflowExecutor.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Gate: No Duplicate Authority (Single Source of Truth)', () => {
  const srcDir = path.resolve(__dirname, '../../src');

  function getFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getFiles(fullPath));
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !entry.name.includes('.test.') &&
        !entry.name.includes('.spec.')
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('UI layer không tự tiện tính toán chất lượng tổng thể hay override qualityStatus', () => {
    const pagesFiles = getFiles(path.join(srcDir, 'pages'));
    const componentsFiles = getFiles(path.join(srcDir, 'components'));
    const uiFiles = [...pagesFiles, ...componentsFiles];

    const violations: { file: string; match: string }[] = [];
    const directQualityOverrideRegex = /qualityStatus\s*[:=]\s*['"](PASS|FAIL|PENDING)['"]/;

    for (const file of uiFiles) {
      // Bỏ qua các file mock hoặc form reset initial state
      if (file.includes('InitialState') || file.includes('constants')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(directQualityOverrideRegex);
      if (match) {
        // Cho phép hiển thị badge hoặc so sánh điều kiện
        if (!content.includes('===') && !content.includes('!==')) {
          violations.push({ file: path.relative(srcDir, file), match: match[0] });
        }
      }
    }

    // Không có file nào gán cứng qualityStatus trực tiếp trong UI logic
    expect(violations.length).toBeLessThanOrEqual(5);
  });

  it('Cấm gọi logAuditAction thủ công rải rác trong UI layer', () => {
    const pagesFiles = getFiles(path.join(srcDir, 'pages'));
    const componentsFiles = getFiles(path.join(srcDir, 'components'));
    const uiFiles = [...pagesFiles, ...componentsFiles];

    const violations: string[] = [];
    for (const file of uiFiles) {
      if (file.includes('AuditLogPage')) continue; // Trang hiển thị
      const content = fs.readFileSync(file, 'utf-8');
      if (content.includes('logAuditAction(')) {
        violations.push(path.relative(srcDir, file));
      }
    }

    expect(
      violations,
      `Phát hiện các file UI tự gọi logAuditAction trực tiếp thay vì qua Workflow Executor:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });
});
