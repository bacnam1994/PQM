# 🚨 PQM MASTER RULES FOR VIBECODE & AI ASSISTANTS

> **IMPORTANT**: You are modifying the **PQM (Product Quality Management)** system for regulated pharmaceutical manufacturing (GxP, FDA 21 CFR Part 11, ICH Q10).
> **MANDATORY**: Before writing or modifying any code in this repository, you **MUST** strictly follow the 15 Golden Invariants below.

---

## 15 GOLDEN INVARIANTS (QUY TẮC VÀNG KHÔNG ĐƯỢC VI PHẠM)

1. **Read Master Docs First**: Read and reference [`PROJECT_OVERVIEW.md`](file:///d:/26%20Kiem%20nghiem/PQM/PROJECT_OVERVIEW.md) and [`docs/governance/PQM_ENGINEERING_GOVERNANCE.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_ENGINEERING_GOVERNANCE.md).
2. **Inspect Before Code**: Never write code before answering all 15 architecture inspection questions in [`PQM_VIBECODE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/governance/PQM_VIBECODE_RULES.md).
3. **One Business Action = One Canonical Path**: Every business action must follow the canonical path: `UI -> Feature Hook -> WorkflowFacade.dispatch() -> Guards -> Application Service -> Domain/FSM -> Repository Interface -> Infrastructure -> RTDB`.
4. **Never Bypass Workflow**: Do not create parallel or shortcut workflows (`AdminOverride`, `QuickApprove`, `DirectMutation`).
5. **No Direct Firebase Write**: Never call `firebase/database` `set`, `update`, `push`, `remove` from UI pages, components, hooks, or application services. Only pure repository implementations in `src/infrastructure/repositories/` may interact with Firebase.
6. **No Direct Repository Mutation from UI**: UI pages and hooks must never call `repository.save()` or `repository.delete()`. All mutations must go through `WorkflowFacade.dispatch()`.
7. **No Business Logic in UI / Hooks**: UI is only for render, presentation, loading, and action dispatching. Hooks are only for queries and orchestration.
8. **Preserve FSM & 7 Release Gates**: Never force a status change. Batch release requires 100% of all 7 Release Gates to pass.
9. **Preserve RBAC**: Only the 8 canonical roles (`ADMIN`, `QA`, `QC`, `LAB`, `PRODUCTION`, `USER`, `VIEWER`, `GUEST`) are permitted.
10. **Preserve ALCOA+ Audit Trail**: Every business mutation must emit an audit event to the fail-closed `OutboxAuditQueue`.
11. **AI is Advisory Only (Proposal Pattern)**: AI cannot directly mutate database records or approve states. AI only produces proposals requiring human confirmation.
12. **Reuse Before Create**: Check existing Actions, Services, Repositories, and Hooks before creating new ones.
13. **Zero Breaking Changes on Refactor**: Keep existing behavior, signatures, and contracts intact unless explicitly requested.
14. **Always Pass Quality Gates**: Must pass `npm run workflow:guard` (0 violations), `npx tsc --noEmit` (0 errors), `tests/architecture/` (100% PASS), and `npm run build`.
15. **Stop on Conflict**: If a user request conflicts with these master rules, **STOP AND REPORT** the conflict immediately.

---

## CANONICAL EXECUTION CHEAT SHEET

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
