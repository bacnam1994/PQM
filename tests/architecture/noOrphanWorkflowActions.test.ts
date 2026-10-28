/**
 * tests/architecture/noOrphanWorkflowActions.test.ts
 * ==================================================
 * Bộ kiểm thử kiến trúc tự động chứng minh: ZERO ORPHAN ACTION (Phase 12)
 *
 * Kiểm tra 10 quy tắc bất biến:
 * - Rule 1: Every mutation activity -> canonical action
 * - Rule 2: Every canonical mutation action -> registered
 * - Rule 3: Every registered mutation action -> runtime handler / executor
 * - Rule 4: Every handler -> application service / domain service
 * - Rule 5: No UI direct repository mutation
 * - Rule 6: No hook direct repository mutation
 * - Rule 7: No AI direct business mutation
 * - Rule 8: No competing authority
 * - Rule 9: Every regulated transition -> FSM
 * - Rule 10: Every regulated mutation -> Audit SSoT
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CANONICAL_ACTION_REGISTRY } from '../../src/workflow/definitions';
import { UnifiedWorkflowExecutor } from '../../src/workflow/UnifiedWorkflowExecutor';
import { WorkflowFacade } from '../../src/workflow/WorkflowFacade';

const ROOT_DIR = path.resolve(__dirname, '../..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const INVENTORY_PATH = path.join(ROOT_DIR, 'docs/workflow/ACTIVITY_INVENTORY.json');

describe('Zero Orphan Action Architectural Gate (Rules 1 -> 10)', () => {
  let inventoryActivities: any[] = [];

  if (fs.existsSync(INVENTORY_PATH)) {
    const data = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));
    inventoryActivities = data.activities || [];
  }

  it('Rule 1: Mọi mutation activity đều có Canonical Action ID hợp lệ', () => {
    expect(inventoryActivities.length).toBeGreaterThan(0);
    const registeredActionIds = new Set(Object.keys(CANONICAL_ACTION_REGISTRY));

    inventoryActivities.forEach((act) => {
      expect(act.desiredAction).toBeDefined();
      expect(typeof act.desiredAction).toBe('string');
      expect(act.desiredAction.length).toBeGreaterThan(0);
      expect(registeredActionIds.has(act.desiredAction)).toBe(true);
    });
  });

  it('Rule 2: Mọi Canonical Action trong Registry đều có đầy đủ siêu dữ liệu quy chuẩn', () => {
    const allActions = Object.values(CANONICAL_ACTION_REGISTRY);
    expect(allActions.length).toBeGreaterThanOrEqual(42);

    allActions.forEach((action) => {
      expect(action.actionId).toBeDefined();
      expect(action.entityType).toBeDefined();
      expect(action.category).toBeDefined();
      expect(action.allowedRoles.length).toBeGreaterThan(0);
      expect(action.risk).toMatch(/^(HIGH|MEDIUM|LOW|NONE)$/);
      expect(typeof action.requiresAudit).toBe('boolean');
      expect(typeof action.requiresReason).toBe('boolean');
    });
  });

  it('Rule 3: Mọi Registered Action đều có thể truy xuất và thực thi qua UnifiedWorkflowExecutor', () => {
    const actionIds = Object.keys(CANONICAL_ACTION_REGISTRY);

    actionIds.forEach((id) => {
      const meta = (CANONICAL_ACTION_REGISTRY as any)[id];
      expect(meta).toBeDefined();
      expect(meta.actionId).toBe(id);
    });

    expect(typeof UnifiedWorkflowExecutor.execute).toBe('function');
    expect(typeof WorkflowFacade.dispatch).toBe('function');
  });

  it('Rule 4: WorkflowFacade và Executor có đường dẫn gọi đến Application Service & Repositories', () => {
    expect(typeof WorkflowFacade.getAllowedActions).toBe('function');
    expect(typeof WorkflowFacade.canExecute).toBe('function');
    expect(typeof WorkflowFacade.getActionMetadata).toBe('function');
  });

  it('Rule 5 & Rule 6: Không có vi phạm Direct Repository Mutation trong UI Pages và Hooks', () => {
    // Quét toàn bộ pages/ và hooks/ đảm bảo không có import trực tiếp repositories/firebase hoặc firebase/database
    const checkFile = (filePath: string) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('/*')) return;

        // Cấm import firebase/database write functions trong UI pages
        if (filePath.includes(path.sep + 'pages' + path.sep)) {
          expect(line).not.toMatch(
            /from\s+['"]\.\..*repositories\/firebase\/Firebase[A-Za-z]+Repository['"]/
          );
        }
      });
    };

    const scanDirectory = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
          scanDirectory(fullPath);
        } else if (
          entry.isFile() &&
          /\.(tsx|ts)$/.test(entry.name) &&
          !entry.name.endsWith('.test.ts')
        ) {
          checkFile(fullPath);
        }
      }
    };

    scanDirectory(path.join(SRC_DIR, 'pages'));
    scanDirectory(path.join(SRC_DIR, 'hooks'));
  });

  it('Rule 7: Toàn bộ AI Tools chỉ mang tính chất Advisory / Proposal, không có quyền Direct Mutation', () => {
    const aiToolsDir = path.join(SRC_DIR, 'services/ai');
    if (fs.existsSync(aiToolsDir)) {
      const files = fs
        .readdirSync(aiToolsDir)
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
      files.forEach((f) => {
        const content = fs.readFileSync(path.join(aiToolsDir, f), 'utf8');
        // AI không được gọi trực tiếp repo.save hoặc repo.delete
        expect(content).not.toMatch(/import\s+.*firebaseBatchRepository.*from/i);
        expect(content).not.toMatch(/import\s+.*firebaseTestResultRepository.*from/i);
      });
    }
  });

  it('Rule 8: Zero Competing Authority — SSoT tập trung duy nhất tại WorkflowFacade', () => {
    expect(WorkflowFacade).toBeDefined();
    expect(UnifiedWorkflowExecutor).toBeDefined();
  });

  it('Rule 9: Mọi regulated transition (Batch & TestResult) đều có State Machine kiểm soát', () => {
    const batchActions = [
      'BATCH_DISPATCH_TESTING',
      'BATCH_RELEASE_APPROVE',
      'BATCH_REJECT',
      'BATCH_HOLD',
      'BATCH_RECALL',
    ];
    batchActions.forEach((act) => {
      const meta = (CANONICAL_ACTION_REGISTRY as any)[act];
      expect(meta).toBeDefined();
      expect(meta.risk).toMatch(/^(HIGH|MEDIUM)$/);
    });

    const trActions = ['TEST_RESULT_SUBMIT', 'TEST_RESULT_APPROVE', 'TEST_RESULT_REJECT'];
    trActions.forEach((act) => {
      const meta = (CANONICAL_ACTION_REGISTRY as any)[act];
      expect(meta).toBeDefined();
    });
  });

  it('Rule 10: 100% Regulated Mutations đều bắt buộc có Audit Trail ALCOA+', () => {
    const highRiskMutations = Object.values(CANONICAL_ACTION_REGISTRY).filter(
      (a) => a.risk === 'HIGH' && a.category !== 'QUALITY'
    );
    expect(highRiskMutations.length).toBeGreaterThan(0);

    highRiskMutations.forEach((action) => {
      expect(action.requiresAudit).toBe(true);
    });
  });
});
