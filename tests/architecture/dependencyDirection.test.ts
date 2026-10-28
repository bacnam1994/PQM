/**
 * ARCHITECTURE GATE: DEPENDENCY DIRECTION
 *
 * Kiểm tra bất biến: Chiều phụ thuộc đơn hướng:
 * UI / Pages / Components -> Hooks -> Application Services / Facade -> Domain -> Repositories -> Infrastructure
 * Cấm tuyệt đối:
 * - Domain layer import từ UI (pages, components, hooks)
 * - Domain layer import từ Infrastructure (Firebase, network)
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Gate: Dependency Direction (Clean Architecture Invariant)', () => {
  const srcDir = path.resolve(__dirname, '../../src');
  const domainsDir = path.join(srcDir, 'domains');

  function getDomainFiles(domainName: string): string[] {
    const targetDir = path.join(domainsDir, domainName, 'domain');
    if (!fs.existsSync(targetDir)) return [];
    return fs
      .readdirSync(targetDir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .map((f) => path.join(targetDir, f));
  }

  it('Tầng Domain Core (domain/rules, domain/types) không được import từ UI layer', () => {
    const domainFolders = fs
      .readdirSync(domainsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const violations: { file: string; importStatement: string }[] = [];
    const forbiddenUIRegex = /from\s+['"][^'"]*(\/pages\/|\/components\/|\/hooks\/)[^'"]*['"]/;

    for (const domain of domainFolders) {
      const files = getDomainFiles(domain);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const match = content.match(forbiddenUIRegex);
        if (match) {
          violations.push({ file: path.relative(srcDir, file), importStatement: match[0] });
        }
      }
    }

    expect(
      violations,
      `Phát hiện Domain Layer vi phạm phụ thuộc ngược lên UI Layer:\n${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });

  it('Tầng Domain Core không được import trực tiếp Firebase SDK hoặc I/O', () => {
    const domainFolders = fs
      .readdirSync(domainsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    const violations: { file: string; importStatement: string }[] = [];
    const forbiddenFirebaseRegex = /from\s+['"]firebase\/[^'"]*['"]/;

    for (const domain of domainFolders) {
      const files = getDomainFiles(domain);
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8');
        const match = content.match(forbiddenFirebaseRegex);
        if (match) {
          violations.push({ file: path.relative(srcDir, file), importStatement: match[0] });
        }
      }
    }

    expect(
      violations,
      `Phát hiện Domain Layer import trực tiếp Firebase SDK:\n${JSON.stringify(violations, null, 2)}`
    ).toHaveLength(0);
  });
});
