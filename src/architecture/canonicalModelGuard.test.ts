/**
 * canonicalModelGuard.test.ts
 * ===========================
 * Static Architecture Guard cho PQM VIBE CODING — MODEL 1: CANONICAL DATA MODEL HARDENING.
 *
 * Tự động quét toàn bộ mã nguồn production (domain, services, repositories, hooks, schemas, types)
 * và FAIL nếu phát hiện bất kỳ pattern nào có thể biến thiếu dữ liệu / UNKNOWN / PENDING thành PASS:
 * - || 'PASS'
 * - ?? 'PASS'
 * - || "PASS"
 * - ?? "PASS"
 * - default('PASS')
 * - default("PASS")
 * - default(true) đối với isPass
 * - passRate mặc định 100 khi 0 test
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function findProductionFiles(dir: string, extensions: string[]): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findProductionFiles(filePath, extensions));
    } else {
      // Loại trừ các file test / fixture
      if (
        !file.endsWith('.test.ts') &&
        !file.endsWith('.test.tsx') &&
        !file.endsWith('.spec.ts') &&
        !file.endsWith('.spec.tsx') &&
        extensions.some((ext) => file.endsWith(ext))
      ) {
        results.push(filePath);
      }
    }
  }
  return results;
}

describe('MODEL 1 STATIC GUARD: Canonical Quality Status & No Default PASS', () => {
  const rootSrcDir = path.resolve(__dirname, '..');
  const targetDirs = [
    path.join(rootSrcDir, 'domain'),
    path.join(rootSrcDir, 'services'),
    path.join(rootSrcDir, 'repositories'),
    path.join(rootSrcDir, 'hooks'),
    path.join(rootSrcDir, 'schemas'),
    path.join(rootSrcDir, 'types'),
    path.join(rootSrcDir, 'utils'),
  ];

  const productionFiles = targetDirs.flatMap((dir) => findProductionFiles(dir, ['.ts', '.tsx']));

  it('Production code KHÔNG ĐƯỢC chứa || "PASS" hoặc ?? "PASS"', () => {
    const forbiddenPatterns = [
      "|| 'PASS'",
      '|| "PASS"',
      "?? 'PASS'",
      '?? "PASS"',
      "|| 'Pass'",
      "|| 'Đạt'",
      "?? 'Đạt'",
    ];

    const violations: { file: string; line: number; pattern: string; lineContent: string }[] = [];

    for (const file of productionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, index) => {
        // Bỏ qua comment dòng
        const trimmed = lineText.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        for (const pattern of forbiddenPatterns) {
          if (lineText.includes(pattern)) {
            violations.push({
              file: path.relative(rootSrcDir, file),
              line: index + 1,
              pattern,
              lineContent: trimmed,
            });
          }
        }
      });
    }

    expect(
      violations,
      `Phát hiện ${violations.length} vi phạm default PASS nguy hiểm:\n` +
        violations
          .map((v) => `  [${v.file}:${v.line}] tìm thấy "${v.pattern}": ${v.lineContent}`)
          .join('\n')
    ).toEqual([]);
  });

  it('Production schemas KHÔNG ĐƯỢC default("PASS") hoặc default(true) cho isPass', () => {
    const schemasDir = path.join(rootSrcDir, 'schemas');
    const schemaFiles = findProductionFiles(schemasDir, ['.ts']);

    const forbiddenSchemaPatterns = ["default('PASS')", 'default("PASS")'];

    const violations: string[] = [];

    for (const file of schemaFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenSchemaPatterns) {
        if (content.includes(pattern)) {
          violations.push(`${path.basename(file)} chứa pattern: ${pattern}`);
        }
      }

      // Kiểm tra riêng testResultEntrySchema không được default(true) cho isPass
      if (file.includes('testResultSchema')) {
        if (content.includes('isPass: z.boolean().nullable().default(true)')) {
          violations.push(`${path.basename(file)} có isPass default(true)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('Data hydration KHÔNG ĐƯỢC biến 0 tests thành passRate 100%', () => {
    const dataGraphFile = path.join(rootSrcDir, 'hooks/useDataGraph.ts');
    const content = fs.readFileSync(dataGraphFile, 'utf-8');

    // Chặn bTests.length > 0 ? ... : 100
    const dangerousPassRatePatterns = [': 100,', ': 100;'];

    const lines = content.split('\n');
    const passRateViolations: string[] = [];

    lines.forEach((lineText, idx) => {
      const trimmed = lineText.trim();
      if (
        trimmed.includes('passRate') &&
        dangerousPassRatePatterns.some((p) => trimmed.includes(p))
      ) {
        passRateViolations.push(`useDataGraph.ts:${idx + 1} -> ${trimmed}`);
      }
    });

    expect(
      passRateViolations,
      `Phát hiện logic passRate mặc định 100% khi không có test:\n` + passRateViolations.join('\n')
    ).toEqual([]);
  });

  it('Production code KHÔNG ĐƯỢC chứa full database scan get(ref(db, "testResults"))', () => {
    const forbiddenFullScans = [
      "get(ref(db, 'testResults'))",
      'get(ref(db, "testResults"))',
      "get(ref(db, 'batches'))",
      'get(ref(db, "batches"))',
    ];

    const violations: { file: string; line: number; lineContent: string }[] = [];

    for (const file of productionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((lineText, index) => {
        const trimmed = lineText.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

        for (const pattern of forbiddenFullScans) {
          if (lineText.includes(pattern)) {
            violations.push({
              file: path.relative(rootSrcDir, file),
              line: index + 1,
              lineContent: trimmed,
            });
          }
        }
      });
    }

    expect(
      violations,
      `Phát hiện ${violations.length} điểm quét cạn toàn bộ database (Full Scan) vi phạm Fail-Closed:\n` +
        violations.map((v) => `  [${v.file}:${v.line}] ${v.lineContent}`).join('\n')
    ).toEqual([]);
  });
});
