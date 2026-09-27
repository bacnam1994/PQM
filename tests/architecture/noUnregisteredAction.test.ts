/**
 * ARCHITECTURE GATE: NO UNREGISTERED ACTION
 *
 * Kiểm tra bất biến: 100% action IDs được dispatch qua WorkflowFacade
 * bắt buộc phải có mặt trong CANONICAL_ACTION_REGISTRY.
 * Không chấp nhận bất kỳ action ID ma hoặc tự chế nào (0 UNREGISTERED ACTION).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CANONICAL_ACTION_REGISTRY } from '../../src/workflow/registry/actionRegistry';

describe('Architecture Gate: No Unregistered Actions in System', () => {
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
        !entry.name.includes('.spec.') &&
        !entry.name.includes('workflowActionCatalog.ts')
      ) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('100% actionId được dispatch qua WorkflowFacade.dispatch() đều đã đăng ký trong Registry', () => {
    const allFiles = getFiles(srcDir);
    const registeredActions = new Set(Object.keys(CANONICAL_ACTION_REGISTRY));

    const dispatchedActionRegex = /actionId:\s*['"]([A-Z0-9_]+)['"]/g;
    const unregisteredActions: { file: string; actionId: string }[] = [];

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      while ((match = dispatchedActionRegex.exec(content)) !== null) {
        const actionId = match[1];
        if (!registeredActions.has(actionId)) {
          unregisteredActions.push({ file: path.relative(srcDir, file), actionId });
        }
      }
    }

    expect(
      unregisteredActions,
      `Phát hiện các Action ID chưa đăng ký trong CANONICAL_ACTION_REGISTRY:\n${JSON.stringify(unregisteredActions, null, 2)}`
    ).toHaveLength(0);
  });
});
