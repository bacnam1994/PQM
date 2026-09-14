/**
 * layeringBoundary.test.ts
 * =========================
 * Kiểm tra phân tầng kiến trúc nghiêm ngặt (Phase 8: Audit & Reliability).
 * Tuân thủ quy tắc 11: UI không được truy cập Firebase trực tiếp.
 * Toàn bộ luồng dữ liệu phải tuân thủ:
 * UI -> Hook -> Service -> Domain -> Repository -> Firebase
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function findFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(filePath, extensions));
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

describe('Phase 8: Architecture Layering Boundary & Reliability', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const pagesDir = path.join(rootDir, 'src/pages');
  const componentsDir = path.join(rootDir, 'src/components');

  it('UI Components & Pages KHÔNG ĐƯỢC chứa direct imports từ Firebase SDK', () => {
    const uiFiles = [
      ...findFiles(pagesDir, ['.ts', '.tsx']),
      ...findFiles(componentsDir, ['.ts', '.tsx']),
    ];

    expect(uiFiles.length).toBeGreaterThan(10);

    const forbiddenImports = [
      "from 'firebase/database'",
      'from "firebase/database"',
      "from 'firebase/storage'",
      'from "firebase/storage"',
      "from 'firebase/auth'",
      'from "firebase/auth"',
    ];

    const violations: { file: string; match: string }[] = [];

    for (const file of uiFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenImports) {
        if (content.includes(pattern)) {
          violations.push({
            file: path.relative(rootDir, file).replace(/\\/g, '/'),
            match: pattern,
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Dịch vụ userService và storageService đóng gói các thao tác Firebase an toàn', async () => {
    const { userService } = await import('../services/userService');
    const { uploadStorageFile, deleteStorageFileByUrl } =
      await import('../services/storageService');

    expect(userService).toBeDefined();
    expect(typeof userService.subscribeUsers).toBe('function');
    expect(typeof userService.updateUserRole).toBe('function');
    expect(typeof userService.deleteUser).toBe('function');

    expect(typeof uploadStorageFile).toBe('function');
    expect(typeof deleteStorageFileByUrl).toBe('function');
  });
});
