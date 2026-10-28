---
name: pqm-architecture
description: >-
  PQM System Architecture, 15 Golden Invariants (GxP / FDA 21 CFR Part 11),
  Unified Workflow Kernel rules, and 6-layer testing standards. Activate when
  modifying business logic, workflows, state machines, services, repositories,
  or RBAC permissions in PQM.
---

# PQM Architecture & Governance Skill

## 1. 15 Golden Invariants (Quy Tắc Vàng Bất Biến)

1. **Read Master Docs First**: Reference [`PROJECT_OVERVIEW.md`](file:///e:/7%20PQM/PROJECT_OVERVIEW.md), [`docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md`](file:///e:/7%20PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md), and the Governance Suite in [`docs/governance/`](file:///e:/7%20PQM/docs/governance/PQM_AUTHORITY_HIERARCHY_V1.md).
2. **Inspect Before Code**: Answer the 15 architecture inspection questions in [`docs/governance/PQM_VIBECODE_RULES.md`](file:///e:/7%20PQM/docs/governance/PQM_VIBECODE_RULES.md) before modifying workflow or domain logic.
3. **One Business Action = One Canonical Path**:
   `UI -> Feature Hook -> WorkflowFacade.dispatch() -> Guards -> Application Service -> Domain/FSM -> Repository Interface -> Infrastructure -> RTDB`.
4. **Never Bypass Workflow**: Do not create shortcut mutations (`AdminOverride`, `QuickApprove`, `DirectMutation`).
5. **No Direct Firebase Write**: Never call `firebase/database` (`set`, `update`, `push`, `remove`) from UI pages, components, hooks, or application services. Only repository implementations may interact with Firebase.
6. **No Direct Repository Mutation from UI**: UI pages and hooks must never call `repository.save()` or `repository.delete()` directly; dispatch via `WorkflowFacade`.
7. **No Business Logic in UI / Hooks**: UI handles rendering, presentation, loading, and dispatching. Hooks handle queries and orchestration.
8. **Preserve FSM & 7 Release Gates**: Never force a status change. Batch release requires 100% of all 7 Release Gates to pass.
9. **Preserve Canonical Actor & Role Model** ([`docs/governance/PQM_ACTOR_MODEL_V1.md`](file:///e:/7%20PQM/docs/governance/PQM_ACTOR_MODEL_V1.md)):
   - **8 Human Business Roles**: `ADMIN`, `QA`, `QC`, `LAB`, `PRODUCTION`, `USER`, `VIEWER`, `GUEST`.
   - **2 System Actors**: `SYSTEM`, `AI_ADVISORY` (never included in human login `Role` union, cannot sign 21 CFR Part 11 records).
10. **Preserve ALCOA+ Audit Trail**: Every business mutation must emit an audit event to the fail-closed `OutboxAuditQueue`.
11. **AI is Advisory Only (Proposal Pattern)**: AI cannot directly mutate database records or approve states; it only produces proposals requiring human confirmation.
12. **Reuse Before Create**: Check existing Actions, Services, Repositories, and Hooks before creating new ones.
13. **Zero Breaking Changes on Refactor**: Keep existing behavior, signatures, and contracts intact unless explicitly requested.
14. **Always Pass Quality Gates**: Must pass `npm run workflow:guard`, `npx tsc --noEmit`, `npx vitest run tests/architecture/`, and `npm run build`.
15. **Stop on Conflict**: If a request conflicts with Master Workflow rules, report the conflict immediately before editing.

---

## 2. Canonical Directory Map (`src/`)

- `src/pages/` — Route screens grouped by module (`auth`, `batches`, `products`, `public`, `qa`, `quality`, `system`).
- `src/components/` — Reusable UI (`ui/`), layout (`layout/`), domain modals/features (`features/`), AI (`ai/`), operational (`operational/`).
- `src/hooks/` — React Query hooks, form state hooks, and workflow dispatch hooks.
- `src/workflow/` — Unified Workflow Kernel (`WorkflowFacade.ts`, `UnifiedWorkflowExecutor.ts`, `definitions/`, `guards/`, `handlers/`, `events/`).
- `src/domains/` — 16 vertical domain slices (`ai`, `approval`, `auth`, `batch`, `capa`, `change-request`, `coa`, `deviation`, `formula`, `master-data`, `material`, `oos`, `product`, `system`, `tccs`, `test-result`).
- `src/domain/` — Cross-cutting deterministic core engines (`evaluation/`, `canonical/`, `batch/`, `test-result/`, `workflow/`, `rules/`, `audit/`, `consistency/`, `healing/`).
- `src/services/` — Application services (`app/`), AI services (`ai/`), OCR pipeline (`ocr/`), analytics (`analytics/`).
- `src/repositories/` & `src/infrastructure/` — Data access interfaces, query policies, and Firebase RTDB adapters.
- `src/schemas/` & `src/types/` — Zod schemas and strict TypeScript contracts.

---

## 3. Canonical Execution Example

```typescript
// ❌ WRONG: Direct mutation from UI/Hook
await firebaseDatabase.ref('batches/' + id).update({ status: 'RELEASED' });

// ❌ WRONG: Direct repository call bypassing workflow
await batchRepository.save({ ...batch, status: 'RELEASED' });

// ✅ CORRECT: Dispatched through Workflow Kernel
const { dispatch } = useWorkflowActions();
await dispatch({
  actionId: 'BATCH_RELEASE_APPROVE',
  entityId: batch.id,
  payload: { batch, signature: userSignature },
});
```

---

## 4. 6-Layer Verification Standard

1. **Type Check**: `npm run typecheck` (`tsc --noEmit`)
2. **Architecture & Governance Gates**: `npx vitest run tests/architecture/`
3. **Domain & Workflow Unit Tests**: `npx vitest run tests/domain/ tests/workflow/`
4. **Workflow Boundary Guard**: `npm run workflow:guard`
5. **Production Bundle Build**: `npm run build`
6. **E2E Verification (when UI flows change)**: `npm run test:e2e`
