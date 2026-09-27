/**
 * ARCHITECTURE GATE: NO DIRECT FIREBASE MUTATION
 *
 * Kiểm tra bất biến: Cấm tuyệt đối UI Pages, Components, và Hooks thực hiện mutation trực tiếp
 * (set, push, update, remove) lên Firebase Database / Firestore / Storage.
 * Mọi thay đổi dữ liệu bắt buộc phải qua Application Service và Canonical Workflow.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Gate: No Direct Firebase Mutation in UI Layer', () => {
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

  it('Pages và Components không được import các hàm mutation từ firebase/database', () => {
    const targets = [
      ...getFiles(path.join(srcDir, 'pages')),
      ...getFiles(path.join(srcDir, 'components')),
    ];

    const violations: { file: string; match: string }[] = [];
    const mutationRegex =
      /import\s+{[^}]*\b(set|push|update|remove)\b[^}]*}\s+from\s+['"]firebase\/database['"]/;

    for (const file of targets) {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(mutationRegex);
      if (match) {
        violations.push({ file: path.relative(srcDir, file), match: match[0] });
      }
    }

    expect(
      violations,
      `Phát hiện các file UI import hàm ghi trực tiếp từ firebase/database:\n${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });

  it('Hooks không được import các hàm mutation từ firebase/database', () => {
    const hookFiles = getFiles(path.join(srcDir, 'hooks'));
    const violations: { file: string; match: string }[] = [];
    const mutationRegex =
      /import\s+{[^}]*\b(set|push|update|remove)\b[^}]*}\s+from\s+['"]firebase\/database['"]/;

    for (const file of hookFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const match = content.match(mutationRegex);
      if (match) {
        violations.push({ file: path.relative(srcDir, file), match: match[0] });
      }
    }

    expect(
      violations,
      `Phát hiện các file Hook import hàm ghi trực tiếp từ firebase/database:\n${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });
});
