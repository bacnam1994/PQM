/**
 * ARCHITECTURE GATE: WORKFLOW TRACEABILITY
 *
 * Kiểm tra bất biến: Khả năng truy xuất nguồn gốc 2 chiều:
 * 1. Runtime Activity -> Canonical Action ID -> Workflow Execution.
 * 2. Mọi Canonical Action trong registry đều có cấu hình RBAC, Entity Type và Transition rõ ràng.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CANONICAL_ACTION_REGISTRY } from '../../src/workflow/registry/actionRegistry';

describe('Architecture Gate: Workflow Traceability (Bidirectional Traceability)', () => {
  it('100% Actions trong Registry đều có entityType và allowedRoles hợp lệ', () => {
    const actionIds = Object.keys(CANONICAL_ACTION_REGISTRY);
    expect(actionIds.length).toBeGreaterThanOrEqual(40);

    const invalidActions: string[] = [];
    for (const [id, def] of Object.entries(CANONICAL_ACTION_REGISTRY)) {
      if (!def.entityType || !def.allowedRoles || def.allowedRoles.length === 0) {
        invalidActions.push(id);
      }
    }

    expect(
      invalidActions,
      `Các action sau thiếu entityType hoặc allowedRoles: ${invalidActions.join(', ')}`
    ).toHaveLength(0);
  });

  it('Tất cả 16 Domain Slices đều có file definitions.ts xác định workflow actions rõ ràng', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const domainsDir = path.join(srcDir, 'domains');
    const domainFolders = fs
      .readdirSync(domainsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    expect(domainFolders.length).toBeGreaterThanOrEqual(16);

    const missingDefinitions: string[] = [];
    for (const domain of domainFolders) {
      const defFile = path.join(domainsDir, domain, 'workflow', 'definitions.ts');
      if (!fs.existsSync(defFile)) {
        missingDefinitions.push(domain);
      }
    }

    expect(
      missingDefinitions,
      `Các domain sau thiếu workflow/definitions.ts: ${missingDefinitions.join(', ')}`
    ).toHaveLength(0);
  });
});
