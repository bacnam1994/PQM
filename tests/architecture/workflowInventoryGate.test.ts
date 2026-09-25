/**
 * WORKFLOW INVENTORY GATE TEST
 *
 * Kiểm tra cổng an toàn Phase 0:
 * 1. ACTIVITY_INVENTORY.json tồn tại và có cấu trúc hợp lệ
 * 2. 100% activities đã được phân loại (unmappedCount === 0)
 * 3. 0 hoạt động mồ côi (orphanCount === 0)
 * 4. Tất cả desiredAction đều thuộc danh mục Action ID chuẩn theo ADR-001
 * 5. Tất cả owner đều thuộc 8 vai trò chuẩn hoặc SYSTEM/AI_ADVISORY
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Workflow Inventory Gate (Phase 0 Safety Gate)', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const inventoryPath = path.join(rootDir, 'docs/workflow/ACTIVITY_INVENTORY.json');

  it('Gate 0.1: File ACTIVITY_INVENTORY.json phải tồn tại', () => {
    expect(fs.existsSync(inventoryPath)).toBe(true);
  });

  it('Gate 0.2: 100% Activities phải được phân loại (0 UNMAPPED, 0 ORPHAN)', () => {
    const raw = fs.readFileSync(inventoryPath, 'utf-8');
    const data = JSON.parse(raw);

    expect(data.gateMetrics).toBeDefined();
    expect(data.gateMetrics.unmappedCount).toBe(0);
    expect(data.gateMetrics.orphanCount).toBe(0);
    expect(data.gateMetrics.gateStatus).toBe('PASSED');
    expect(data.totalActivities).toBeGreaterThanOrEqual(100);
  });

  it('Gate 0.3: Mọi desiredAction phải tuân thủ chuẩn đặt tên theo ADR-001', () => {
    const raw = fs.readFileSync(inventoryPath, 'utf-8');
    const data = JSON.parse(raw);

    const validActionPattern = /^[A-Z0-9]+(_[A-Z0-9]+)+$/;
    for (const act of data.activities) {
      expect(act.desiredAction).toMatch(validActionPattern);
      expect(act.desiredAction).not.toBe('UPDATE');
      expect(act.desiredAction).not.toBe('SAVE');
      expect(act.desiredAction).not.toBe('EDIT');
    }
  });

  it('Gate 0.4: Mọi vai trò chủ quản (owner) phải là Canonical Roles hợp lệ', () => {
    const raw = fs.readFileSync(inventoryPath, 'utf-8');
    const data = JSON.parse(raw);

    const allowedOwners = new Set([
      'ADMIN',
      'QA',
      'QC',
      'LAB',
      'PRODUCTION',
      'USER',
      'VIEWER',
      'GUEST',
      'SYSTEM',
      'AI_ADVISORY',
    ]);

    for (const act of data.activities) {
      expect(allowedOwners.has(act.owner)).toBe(true);
    }
  });

  it('Gate 0.5: package.json phải chứa lệnh chạy workflow:inventory', () => {
    const pkgPath = path.join(rootDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.scripts['workflow:inventory']).toBeDefined();
  });
});
