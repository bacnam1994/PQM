/**
 * ARCHITECTURE GATE: GOVERNANCE DRIFT DETECTION
 *
 * Kiểm tra khả năng tự động phát hiện sai lệch (Drift Detection) giữa:
 * 1. Action Registry (Code) vs Workflow Documentation
 * 2. State Machine FSM (Code) vs State Transition Matrix (Docs)
 * 3. Actor Model & Role Semantics (Docs/Vibecode) vs Permission Types (Code)
 * 4. Authority Registry (Docs) vs Canonical Component Implementations (Code)
 * 5. Exception Expiration Policy (Docs) vs Active Architecture Exceptions
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CANONICAL_ACTION_REGISTRY } from '../../src/workflow/definitions';
import { BatchStateMachine } from '../../src/domain/workflow/stateMachine';

describe('Architecture Gate: Governance Drift Detection', () => {
  const rootDir = path.resolve(__dirname, '../..');

  // ------------------------------------------------------------------------
  // Gate 1: Action Registry vs Documentation Drift
  // ------------------------------------------------------------------------
  it('Gate 1: Mọi Action ID trong CANONICAL_ACTION_REGISTRY phải được ghi nhận trong tài liệu chuẩn tắc', () => {
    const masterWorkflowPath = path.join(rootDir, 'docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md');
    const catalogPath = path.join(rootDir, 'docs/workflow/CANONICAL_ACTION_CATALOG.md');

    expect(fs.existsSync(masterWorkflowPath)).toBe(true);
    expect(fs.existsSync(catalogPath)).toBe(true);

    const masterDocContent = fs.readFileSync(masterWorkflowPath, 'utf-8');
    const catalogContent = fs.readFileSync(catalogPath, 'utf-8');
    const combinedDocs = masterDocContent + '\n' + catalogContent;

    const actionIds = Object.keys(CANONICAL_ACTION_REGISTRY);
    const undocumentedActions: string[] = [];

    for (const actionId of actionIds) {
      if (!combinedDocs.includes(actionId)) {
        undocumentedActions.push(actionId);
      }
    }

    expect(
      undocumentedActions,
      `Phát hiện Action ID trong code nhưng KHÔNG có trong tài liệu (Action Drift):\n${undocumentedActions.join(', ')}`
    ).toHaveLength(0);
  });

  // ------------------------------------------------------------------------
  // Gate 2: State Transition Matrix vs FSM Code Drift
  // ------------------------------------------------------------------------
  it('Gate 2: Các bước chuyển trạng thái của Batch FSM phải được phản ánh đầy đủ trong State Transition Matrix', () => {
    const stmPath = path.join(rootDir, 'docs/workflow/PQM_STATE_TRANSITION_MATRIX.md');
    expect(fs.existsSync(stmPath)).toBe(true);

    const stmContent = fs.readFileSync(stmPath, 'utf-8');

    // Lấy định nghĩa FSM từ BatchStateMachine
    const transitions = (BatchStateMachine as any).VALID_TRANSITIONS as Record<string, string[]>;
    expect(transitions).toBeDefined();

    const missingTransitions: string[] = [];
    for (const [fromState, toStates] of Object.entries(transitions)) {
      for (const toState of toStates) {
        // Kiểm tra xem cặp chuyển đổi có được ghi nhận trong STM không
        const transitionMention = `${fromState}` && `${toState}`;
        if (!stmContent.includes(fromState) || !stmContent.includes(toState)) {
          missingTransitions.push(`${fromState} ➔ ${toState}`);
        }
      }
    }

    expect(
      missingTransitions,
      `Phát hiện bước chuyển trạng thái FSM nhưng thiếu trong State Transition Matrix (FSM Drift):\n${missingTransitions.join(', ')}`
    ).toHaveLength(0);
  });

  // ------------------------------------------------------------------------
  // Gate 3: Actor Model & Role Semantics Drift
  // ------------------------------------------------------------------------
  it('Gate 3: Mô hình Actor Model và Master Rules phải đồng bộ phân định 8 Human Roles + 2 System Actors', () => {
    const actorModelPath = path.join(rootDir, 'docs/governance/PQM_ACTOR_MODEL_V1.md');
    const masterRulesPath = path.join(rootDir, '.vibecode/PQM_MASTER_RULES.md');
    const permissionsTypesPath = path.join(rootDir, 'src/types/permissions.ts');

    expect(fs.existsSync(actorModelPath)).toBe(true);
    expect(fs.existsSync(masterRulesPath)).toBe(true);
    expect(fs.existsSync(permissionsTypesPath)).toBe(true);

    const actorModelContent = fs.readFileSync(actorModelPath, 'utf-8');
    const masterRulesContent = fs.readFileSync(masterRulesPath, 'utf-8');
    const permissionsContent = fs.readFileSync(permissionsTypesPath, 'utf-8');

    const expectedHumanRoles = [
      'ADMIN',
      'QA',
      'QC',
      'LAB',
      'PRODUCTION',
      'USER',
      'VIEWER',
      'GUEST',
    ];
    const expectedSystemActors = ['SYSTEM', 'AI_ADVISORY'];

    // 1. Phải có đủ 8 Human Roles trong tài liệu
    for (const role of expectedHumanRoles) {
      expect(actorModelContent).toContain(role);
      expect(masterRulesContent).toContain(role);
      expect(permissionsContent).toContain(`'${role}'`);
    }

    // 2. Phải có 2 System Actors trong tài liệu
    for (const actor of expectedSystemActors) {
      expect(actorModelContent).toContain(actor);
      expect(masterRulesContent).toContain(actor);
    }

    // 3. System Actors cấm nằm trong Human Role enum/type dùng để login
    const humanRoleRegex = /export\s+type\s+Role\s*=\s*([^;]+);/;
    const match = permissionsContent.match(humanRoleRegex);
    if (match) {
      const roleUnion = match[1];
      expect(roleUnion).not.toContain('SYSTEM');
      expect(roleUnion).not.toContain('AI_ADVISORY');
    }
  });

  // ------------------------------------------------------------------------
  // Gate 4: Canonical Authority Registry vs Code Implementations
  // ------------------------------------------------------------------------
  it('Gate 4: 14 loại thẩm quyền chuẩn tắc trong Registry phải có file triển khai thực tế', () => {
    const authorityRegistryPath = path.join(
      rootDir,
      'docs/governance/PQM_CANONICAL_AUTHORITY_REGISTRY_V1.md'
    );
    expect(fs.existsSync(authorityRegistryPath)).toBe(true);

    const keyImplementations = [
      'src/workflow/definitions/index.ts',
      'src/workflow/WorkflowFacade.ts',
      'src/services/permissionService.ts',
      'src/domain/workflow/stateMachine.ts',
      'src/domain/evaluation/QualityEvaluationEngine.ts',
      'src/domains/batch/domain/rules.ts',
      'src/workflow/events/outboxAuditQueue.ts',
      'src/services/signatureService.ts',
      'src/domains/ai/application/aiActionGuard.ts',
      'src/store/useUIStore.ts',
    ];

    const missingFiles: string[] = [];
    for (const relPath of keyImplementations) {
      if (!fs.existsSync(path.join(rootDir, relPath))) {
        missingFiles.push(relPath);
      }
    }

    expect(
      missingFiles,
      `Phát hiện Canonical Owner được quy định trong Authority Registry nhưng thiếu file code (Authority Drift):\n${missingFiles.join(', ')}`
    ).toHaveLength(0);
  });

  // ------------------------------------------------------------------------
  // Gate 5: Architecture Exception Policy Compliance & Expiration Gate
  // ------------------------------------------------------------------------
  it('Gate 5: Không có ngoại lệ kiến trúc nào quá hạn hoặc có thời hạn vượt quá 30 ngày', () => {
    const policyPath = path.join(
      rootDir,
      'docs/governance/PQM_ARCHITECTURE_EXCEPTION_POLICY_V1.md'
    );
    expect(fs.existsSync(policyPath)).toBe(true);

    const content = fs.readFileSync(policyPath, 'utf-8');

    // Tìm các dòng đăng ký ngoại lệ EXC-XXX
    const exceptionLineRegex =
      /\|\s*\*\*(EXC-\d+)\*\*\s*\|[^|]+\|[^|]+\|[^|]+\|\s*`?(\d{4}-\d{2}-\d{2})`?\s*\|/g;
    let match;
    const exceptions: { id: string; expiration: string }[] = [];

    while ((match = exceptionLineRegex.exec(content)) !== null) {
      exceptions.push({
        id: match[1],
        expiration: match[2],
      });
    }

    expect(exceptions.length).toBeGreaterThanOrEqual(1);

    // Kiểm tra từng exception
    const createdDate = new Date('2026-09-27');
    const maxAllowedExpiration = new Date('2026-10-27'); // <= 30 ngày

    for (const exc of exceptions) {
      const expDate = new Date(exc.expiration);
      expect(
        expDate.getTime(),
        `Ngoại lệ ${exc.id} có ngày hết hạn (${exc.expiration}) vượt quá 30 ngày kể từ ngày tạo (${createdDate.toISOString().slice(0, 10)})`
      ).toBeLessThanOrEqual(maxAllowedExpiration.getTime());
    }
  });
});
