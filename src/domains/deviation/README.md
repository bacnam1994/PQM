# Deviation Domain (Phân hệ Quản lý Sai lệch Chất lượng)

## 1. Ranh giới kiến trúc (Architectural Boundary)

- **Domain Layer (`domain/`)**:
  - `types.ts`: Thực thể `QualityDeviation`, `DeviationStatus`, `DeviationSeverity`, `DeviationSource`, `CAPAActionItem`, `CreateDeviationInput`.
  - `rules.ts`: `DeviationRules` (validation, canClose), `DeviationStateMachine` (FSM lifecycle: LOGGED -> UNDER_INVESTIGATION -> CAPA_PLANNED -> EFFECTIVENESS_REVIEW -> CLOSED).
- **Application Layer (`application/`)**:
  - `service.ts`: `DeviationAppService` (Điều phối create, updateStatus, autoLogFromOOS, addCAPAItem, completeCAPAItem, delete qua WorkflowFacade).
  - `queries.ts`: `DeviationQueries` (Truy xuất danh sách, theo ID, theo Batch, theo Status).
- **Infrastructure Layer (`infrastructure/`)**:
  - `repository.ts`: Interface `IDeviationRepository` và binding với `FirebaseDeviationRepository`.
- **Workflow Kernel (`workflow/`)**:
  - `definitions.ts`: Định danh Canonical Action IDs (`DEVIATION_*`) và nhãn trạng thái vòng đời.

## 2. Luồng thực thi chuẩn (Canonical Flow)

```
UI -> DeviationAppService -> WorkflowFacade -> Action Guard -> DeviationStateMachine -> FirebaseDeviationRepository
```
