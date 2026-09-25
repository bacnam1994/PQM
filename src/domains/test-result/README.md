# Test Result Domain (Phân hệ Phiếu kiểm nghiệm)

## 1. Ranh giới kiến trúc (Architectural Boundary)

- **Domain Layer (`domain/`)**:
  - `types.ts`: Thực thể `TestResult`, `CriterionResult`, `EvaluationSnapshot`, `TestResultWorkflowStatus`, `CanonicalQualityStatus`.
  - `rules.ts`: `TestResultRules`, `TestResultWorkflowStateMachine`, `TestResultStateMachine`, `QualityWorkflowMatrixGuard`, `resolveTestResultStatus`.
- **Application Layer (`application/`)**:
  - `service.ts`: `TestResultAppService` (Điều phối create, update, workflow status transitions, OCC, RBAC, e-Signatures).
  - `queries.ts`: `TestResultQueries` (Truy xuất dữ liệu test result không làm thay đổi trạng thái).
- **Infrastructure Layer (`infrastructure/`)**:
  - `repository.ts`: Interface `ITestResultRepository` và binding với `FirebaseTestResultRepository`.
- **Workflow Kernel (`workflow/`)**:
  - `definitions.ts`: Định danh Canonical Action IDs (`TEST_RESULT_*`) và trạng thái vòng đời hồ sơ kiểm nghiệm.

## 2. Luồng thực thi chuẩn (Canonical Flow)

```
UI -> TestResultAppService -> WorkflowFacade -> Action Guard -> TestResultWorkflowStateMachine -> FirebaseTestResultRepository
```
