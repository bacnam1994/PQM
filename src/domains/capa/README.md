# CAPA Domain (Phân hệ Quản lý Hành động Khắc phục và Phòng ngừa)

## 1. Ranh giới kiến trúc (Architectural Boundary)

- **Domain Layer (`domain/`)**:
  - `types.ts`: `CAPAActionItem`, `CreateCapaPlanDto`, `QualityDeviation`.
  - `rules.ts`: `CAPARules` (validatePlanDto, canCloseCAPA closed-loop checks), `CAPAStateMachine` (PENDING -> IN_PROGRESS -> COMPLETED -> VERIFIED).
- **Application Layer (`application/`)**:
  - `service.ts`: `CAPAService` (addCapaAction, completeCapaAction, verifyAndCloseCAPA).
  - `queries.ts`: `CAPAQueries` (getAllCAPAItems, getCAPAItemsByDeviationId, getPendingCAPAItems).
- **Infrastructure Layer (`infrastructure/`)**:
  - `repository.ts`: Binding qua `IDeviationRepository` / `FirebaseDeviationRepository`.
- **Workflow Kernel (`workflow/`)**:
  - `definitions.ts`: Định danh Canonical Action IDs (`CAPA_*`) và nhãn trạng thái các bước.

## 2. Luồng thực thi chuẩn (Canonical Flow)

```
UI -> CAPAService -> DeviationAppService -> WorkflowFacade -> Action Guard -> FirebaseDeviationRepository
```
