/**
 * ARCHITECTURE GATE: NO DIRECT REPOSITORY MUTATION
 *
 * Kiểm tra bất biến: Cấm tuyệt đối UI Pages và Components import trực tiếp các triển khai Firebase Repositories.
 * UI chỉ được gọi thông qua Feature Hooks, Application Services hoặc Workflow Facade.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Gate: No Direct Repository Mutation in UI Layer', () => {
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

  it('UI Pages và Components không được import trực tiếp Firebase Repositories', () => {
    const targets = [
      ...getFiles(path.join(srcDir, 'pages')),
      ...getFiles(path.join(srcDir, 'components')),
    ];

    const violations: { file: string; match: string }[] = [];
    const directRepoRegex =
      /from\s+['"][^'"]*(repositories\/firebase\/Firebase|infrastructure\/repositories\/Firebase)[^'"]*['"]/;

    for (const file of targets) {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(directRepoRegex);
      if (match) {
        violations.push({ file: path.relative(srcDir, file), match: match[0] });
      }
    }

    expect(
      violations,
      `Phát hiện các file UI import trực tiếp Firebase Repositories:\n${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });
});
