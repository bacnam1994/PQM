# OOS Domain (Phân hệ Điều tra Kết quả Ngoài Tiêu Chuẩn - Out of Specification)

## 1. Ranh giới kiến trúc (Architectural Boundary)

- **Domain Layer (`domain/`)**:
  - `types.ts`: `OOSInvestigationPhase1`, `OOSInvestigationPhase2`, `OOSInvestigationStatus`.
  - `rules.ts`: `OOSRules` (validatePhase1, validatePhase2, canConclude), `OOSStateMachine` (TRIGGERED -> PHASE1_LAB_INVESTIGATION -> PHASE2_MFG_INVESTIGATION -> CONCLUDED).
- **Application Layer (`application/`)**:
  - `service.ts`: `OOSService` (triggerOOSInvestigation, submitPhase1Investigation, concludeOOSInvestigation).
  - `queries.ts`: `OOSQueries` (getAllOOS, getOOSById, getOOSByBatchId).
- **Infrastructure Layer (`infrastructure/`)**:
  - `repository.ts`: Binding qua `IDeviationRepository` / `FirebaseDeviationRepository`.
- **Workflow Kernel (`workflow/`)**:
  - `definitions.ts`: Định danh Canonical Action IDs (`OOS_*`) và nhãn trạng thái các giai đoạn.

## 2. Luồng thực thi chuẩn (Canonical Flow)

```
UI -> OOSService -> DeviationAppService -> WorkflowFacade -> Action Guard -> FirebaseDeviationRepository
```
