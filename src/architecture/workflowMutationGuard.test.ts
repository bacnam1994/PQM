/**
 * workflowMutationGuard.test.ts
 * ==============================
 * Static Architecture Guard ngăn chặn toàn bộ các vi phạm Workflow Status Mutation (WF-020).
 * Bất biến:
 * 1. useTestResultSave.ts KHÔNG ĐƯỢC gọi updateBatchStatus
 * 2. AI services KHÔNG ĐƯỢC trực tiếp mutate batch/testResult workflow status
 * 3. BatchAppService.updateBatch() KHÔNG ĐƯỢC phép thay đổi status
 * 4. createBatch() KHÔNG ĐƯỢC khởi tạo với status khác PENDING
 * 5. Domain evaluation engines KHÔNG ĐƯỢC mutate workflow status
 * 6. UI KHÔNG ĐƯỢC gọi trực tiếp BatchRepository.updateStatus
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function findFiles(dir: string, extensions: string[], excludePatterns: string[] = []): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    if (excludePatterns.some((pattern) => filePath.includes(pattern))) continue;
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extensions, excludePatterns));
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

describe('Architecture Guard: Workflow Status Mutation Prevention (WF-020)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const srcDir = path.join(rootDir, 'src');

  it('WF-001 & WF-002: useTestResultSave.ts KHÔNG ĐƯỢC chứa lệnh gọi updateBatchStatus', () => {
    const saveHookFile = path.join(srcDir, 'hooks/test-results/useTestResultSave.ts');
    expect(fs.existsSync(saveHookFile)).toBe(true);
    const content = fs.readFileSync(saveHookFile, 'utf-8');

    // Không được gọi updateBatchStatus
    const hasUpdateBatchStatus = /updateBatchStatus\s*\(/.test(content);
    expect(hasUpdateBatchStatus).toBe(false);

    // Không được import hoặc tham chiếu BATCH_STATUS.RELEASED hoặc BATCH_STATUS.REJECTED để chuyển trạng thái
    expect(content).not.toContain('updateBatchStatus(batchId, BATCH_STATUS.RELEASED)');
    expect(content).not.toContain('updateBatchStatus(batchId, BATCH_STATUS.REJECTED)');
    expect(content).not.toContain('updateBatchStatus(batchId, BATCH_STATUS.TESTING)');
  });

  it('WF-003: useTestResultForm.ts KHÔNG ĐƯỢC tự ý chuyển batch sang TESTING khi chọn lô hoặc load lô', () => {
    const formHookFile = path.join(srcDir, 'hooks/test-results/useTestResultForm.ts');
    expect(fs.existsSync(formHookFile)).toBe(true);
    const content = fs.readFileSync(formHookFile, 'utf-8');

    // Không được có side effect updateBatchStatus(..., TESTING) khi select batch
    const autoTestingMatch =
      /handleBatchSelect[\s\S]*?updateBatchStatus\s*\([^)]*TESTING[^)]*\)/.test(content);
    expect(autoTestingMatch).toBe(false);
  });

  it('WF-004: Tất cả các luồng tạo Batch trong src/ KHÔNG ĐƯỢC gán status khác PENDING', () => {
    const prodFiles = findFiles(
      srcDir,
      ['.ts', '.tsx'],
      ['.test.', '__tests__', 'mock', 'fixtures', 'dataArchitecture']
    );

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of prodFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        // Tìm các nơi khởi tạo batch object mới có status: BATCH_STATUS.TESTING hoặc status: 'TESTING' hoặc 'RELEASED'
        if (
          (line.includes('status: BATCH_STATUS.TESTING') ||
            line.includes("status: 'TESTING'") ||
            line.includes('status: BATCH_STATUS.RELEASED') ||
            line.includes("status: 'RELEASED'")) &&
          !file.includes('stateMachine.ts') &&
          !file.includes('workflowActions.ts') &&
          !file.includes('types') &&
          !file.includes('constants') &&
          !file.includes('database.rules') &&
          !file.includes('securityRulesValidator') &&
          !file.includes('BatchAppService.ts')
        ) {
          violations.push({
            file: path.relative(rootDir, file),
            line: idx + 1,
            match: line.trim(),
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('WF-005: BatchAppService.updateBatch() KHÔNG ĐƯỢC cho phép sửa status', () => {
    const batchServiceFile = path.join(srcDir, 'services/app/BatchAppService.ts');
    expect(fs.existsSync(batchServiceFile)).toBe(true);
    const content = fs.readFileSync(batchServiceFile, 'utf-8');

    // Kiểm tra guard chặn status mutation trong updateBatch
    expect(content).toContain('Không được thay đổi Workflow Status thông qua updateBatch()');
    expect(content).toContain('batch.status !== old.status');
  });

  it('WF-014: UI Components KHÔNG ĐƯỢC gọi trực tiếp repository.updateStatus hoặc repository.updateWorkflowStatus', () => {
    const uiFiles = [
      ...findFiles(path.join(srcDir, 'pages'), ['.ts', '.tsx'], ['.test.']),
      ...findFiles(path.join(srcDir, 'components'), ['.ts', '.tsx'], ['.test.']),
    ];

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of uiFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (
          line.includes('batchRepository.updateStatus') ||
          line.includes('testResultRepository.updateWorkflowStatus') ||
          line.includes('repo.updateStatus(') ||
          line.includes('repo.updateWorkflowStatus(')
        ) {
          violations.push({
            file: path.relative(rootDir, file),
            line: idx + 1,
            match: line.trim(),
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('WF-016: AI Services KHÔNG ĐƯỢC trực tiếp mutate store.updateBatchStatus hoặc repo.updateStatus', () => {
    const aiFiles = findFiles(
      path.join(srcDir, 'services/ai'),
      ['.ts', '.tsx'],
      ['.test.', '__tests__']
    );

    const violations: { file: string; line: number; match: string }[] = [];

    for (const file of aiFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (
          line.includes('store.updateBatchStatus(') ||
          line.includes('repo.updateStatus(') ||
          line.includes('batchRepository.updateStatus(')
        ) {
          violations.push({
            file: path.relative(rootDir, file),
            line: idx + 1,
            match: line.trim(),
          });
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('Evaluation Engines KHÔNG ĐƯỢC chứa logic chuyển đổi workflow status', () => {
    const evalFiles = findFiles(
      path.join(srcDir, 'domain/evaluation'),
      ['.ts'],
      ['.test.', '__tests__']
    );

    const violations: { file: string; match: string }[] = [];

    for (const file of evalFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      if (
        content.includes('updateBatchStatus') ||
        content.includes('BATCH_STATUS.RELEASED') ||
        content.includes('BATCH_STATUS.REJECTED')
      ) {
        violations.push({
          file: path.relative(rootDir, file),
          match: 'Contains workflow mutation references',
        });
      }
    }

    expect(violations).toEqual([]);
  });
});
