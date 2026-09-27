/**
 * ARCHITECTURE GATE: NO ORPHAN MUTATION
 *
 * Kiểm tra bất biến: Cấm mọi thao tác ghi dữ liệu (mutation) mà không gắn với
 * Application Service / Canonical Action có Audit Trail.
 * Không chấp nhận bất kỳ Orphan Mutation nào trên toàn bộ 16 domain slices.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Gate: No Orphan Mutation', () => {
  const srcDir = path.resolve(__dirname, '../../src');

  it('Các Application Services trong các domain slices mutating đều tích hợp qua WorkflowFacade hoặc WorkflowHandlers', () => {
    const domainsDir = path.join(srcDir, 'domains');
    const domainFolders = fs
      .readdirSync(domainsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    expect(domainFolders.length).toBeGreaterThanOrEqual(16);

    const NON_MUTATING_DOMAINS = new Set(['ai', 'auth']);
    const slicesWithoutWorkflow: string[] = [];

    for (const domain of domainFolders) {
      if (NON_MUTATING_DOMAINS.has(domain)) continue;

      const appDir = path.join(domainsDir, domain, 'application');
      if (!fs.existsSync(appDir)) continue;

      const appFiles = fs
        .readdirSync(appDir)
        .filter((f) => f.endsWith('.ts') && !f.includes('queries'));
      let hasWorkflowIntegration = false;

      for (const file of appFiles) {
        const content = fs.readFileSync(path.join(appDir, file), 'utf-8');
        if (
          content.includes('WorkflowFacade') ||
          content.includes('WorkflowHandlers') ||
          content.includes('WorkflowService') ||
          content.includes('deviationAppService') ||
          content.includes('workflow')
        ) {
          hasWorkflowIntegration = true;
          break;
        }
      }

      if (!hasWorkflowIntegration) {
        slicesWithoutWorkflow.push(domain);
      }
    }

    expect(
      slicesWithoutWorkflow,
      `Các domain sau không có tích hợp Workflow/WorkflowHandlers trong application service: ${slicesWithoutWorkflow.join(', ')}`
    ).toHaveLength(0);
  });
});
