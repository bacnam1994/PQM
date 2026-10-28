# PQM Batch Domain (Vertical Slice 5 - Core GMP)

## 1. Trách nhiệm kiến trúc

Quản lý toàn bộ vòng đời sản xuất của Lô thuốc (`Batch`), máy trạng thái GMP (`BatchStateMachine`), bảo vệ Optimistic Concurrency Control (OCC), thẩm định 7 Cổng Kiểm Soát Xuất Xưởng Lô (`ReleaseRules` & `ReleaseService`), tích hợp Chữ ký điện tử 21 CFR Part 11 và ALCOA+ Audit Trail.

## 2. Cấu trúc thư mục

- `domain/types.ts`: Interface `Batch`, `BatchStatus`, `TestResult`, `TCCS`, `ProductFormula`, `QualityDeviation`.
- `domain/rules.ts`: Pure Business Rules (`BatchRules`, `ReleaseRules`, `BatchStateMachine`).
- `application/service.ts`: `BatchAppService` điều phối qua `BatchWorkflowHandlers` & `WorkflowFacade`.
- `application/releaseService.ts`: `ReleaseService` kiểm soát 7 Release Gates và xuất xưởng lô.
- `application/queries.ts`: `BatchQueries` truy vấn lô chỉ đọc an toàn.
- `infrastructure/repository.ts`: Binding với `IBatchRepository` và `FirebaseBatchRepository`.
- `workflow/definitions.ts`: Danh mục Canonical Action IDs (`BATCH_CREATE`, `BATCH_UPDATE_METADATA`, `BATCH_HOLD`, `BATCH_RESUME`, `BATCH_START_PRODUCTION`, `BATCH_RELEASE`, `BATCH_CANCEL`, `BATCH_CLOSE`, `BATCH_REOPEN`, `BATCH_BLOCK_RECALL`).
- `tests/batchDomain.test.ts`: Bộ kiểm thử chuyên sâu cho Batch domain.

## 3. Ranh giới kiến trúc bất biến

- ADMIN cũng không được quyền bypass 7 Release Gates (`ADMIN ≠ workflow bypass`).
- Lô đã ở trạng thái `RELEASED` tuyệt đối không được xóa vật lý (`deleteBatch` bị từ chối); chỉ được thu hồi/phong tỏa khẩn cấp (`BLOCKED`).
- Không được thay đổi Workflow Status thông qua `updateBatch()` metadata; mọi thay đổi trạng thái bắt buộc phải qua `updateStatus()` hoặc `releaseBatch()`.
