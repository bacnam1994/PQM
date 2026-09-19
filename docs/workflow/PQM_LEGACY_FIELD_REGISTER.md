# PQM — BẢNG ĐĂNG KÝ VÀ PHÂN LOẠI TRƯỜNG DỮ LIỆU CŨ (LEGACY FIELD REGISTER)

> **Mã tài liệu:** `PQM-LFR-001`  
> **Phiên bản:** `1.0.0`  
> **Thuộc giai đoạn:** `PHASE E — Legacy / Data Migration Audit`  
> **Tuân thủ chuẩn:** `PQM_SYSTEM_WORKFLOW_MASTER.md` & `MODEL 01 -> MODEL 13`

---

## 1. MỤC ĐÍCH VÀ PHẠM VI

Tài liệu này kiểm kê và phân loại 100% các trường trạng thái, cờ logic, và trường dữ liệu liên quan đến chất lượng, quy trình phê duyệt trong hệ thống PQM.
Mục tiêu là:

1. Phân biệt rạch ròi giữa **CANONICAL** (chuẩn mực), **DERIVED** (phái sinh), **COMPATIBILITY** (tương thích ngược), **LEGACY** (cũ cần di chuyển), và **FORBIDDEN** (cấm ghi trực tiếp).
2. Thiết lập chính sách **Dual-Read** và **Migration Plan** để không gây gián đoạn hoặc mất mát dữ liệu đang vận hành trên môi trường sản xuất.
3. Ngăn chặn việc UI hoặc các tiến trình nền tự ý ghi đè lên các trường cũ hoặc nhầm lẫn giữa Workflow Status và Quality Status.

---

## 2. QUY ƯỚC PHÂN LOẠI (CLASSIFICATION TAXONOMY)

| Phân loại         | Định nghĩa                                                                       | Chính sách Đọc                  | Chính sách Ghi                                            |
| :---------------- | :------------------------------------------------------------------------------- | :------------------------------ | :-------------------------------------------------------- |
| **CANONICAL**     | Nguồn chân lý duy nhất (Single Source of Truth). Quyết định nghiệp vụ cuối cùng. | Bắt buộc đọc ưu tiên số 1       | Chỉ ghi qua State Machine, Domain Engine hoặc App Service |
| **DERIVED**       | Dữ liệu tính toán phái sinh từ các chỉ tiêu hoặc snapshot.                       | Được đọc để hiển thị nhanh      | Tự động tính toán lại, cấm ghi thủ công từ UI             |
| **COMPATIBILITY** | Trường duy trì để tương thích với các view báo cáo hoặc client cũ.               | Đọc fallback nếu Canonical null | Ghi đồng bộ (Dual-Write) từ Domain Service                |
| **LEGACY**        | Trường từ phiên bản cũ (PQM v1/v2), đang trong lộ trình deprecation.             | Đọc fallback có log cảnh báo    | **CẤM GHI MỚI** (Read-Only)                               |
| **FORBIDDEN**     | Các trường hoặc biến thể tự tạo phá vỡ tính toàn vẹn hoặc bị cấm ghi trực tiếp.  | Không đọc                       | **CHẶN HOÀN TOÀN** tại Gateway & Repository               |

---

## 3. BẢNG ĐĂNG KÝ TRƯỜNG DỮ LIỆU (FIELD REGISTER MATRIX)

| Field Name                        | Target Entity   | Current Use / Ý nghĩa                                                                          | Authority (Thẩm quyền quyết định)                                   | Phân loại                  | Derived?                      | Legacy? | Migration / Kế hoạch xử lý                                                  |
| :-------------------------------- | :-------------- | :--------------------------------------------------------------------------------------------- | :------------------------------------------------------------------ | :------------------------- | :---------------------------- | :------ | :-------------------------------------------------------------------------- |
| `overallStatus`                   | `TestResult`    | Kết luận chất lượng chính thức của phiếu KN (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`)             | `QualityEvaluationEngine` / `CanonicalStatusResolver`               | **CANONICAL**              | Có (từ tiêu chí + TCCS)       | Không   | Giữ nguyên làm chuẩn mực Model 1.                                           |
| `qualityStatus`                   | `TestResult`    | Alias đồng bộ với `overallStatus` cho Model 1 Canonical Type                                   | `QualityEvaluationEngine`                                           | **COMPATIBILITY**          | Có                            | Không   | Đồng bộ tự động với `overallStatus`.                                        |
| `workflowStatus`                  | `TestResult`    | Trạng thái vòng đời tài liệu (`DRAFT`, `SUBMITTED`, `APPROVED`, `RELEASED`, `REJECTED`)        | `TestResultWorkflowStateMachine`                                    | **CANONICAL**              | Không (FSM State)             | Không   | Tách biệt hoàn toàn khỏi Quality Status.                                    |
| `status`                          | `TestResult`    | Chuỗi trạng thái tự do từ PQM v1/v2 (ví dụ: "Đạt", "Không đạt", "Chờ duyệt")                   | Không có thẩm quyền                                                 | **LEGACY**                 | Không rõ                      | **Có**  | **Chặn ghi mới**. Đọc fallback qua `normalizeTestResultStatus()`.           |
| `overallResult`                   | `TestResult`    | Kết luận dạng chuỗi tự do cũ ("Đạt chuẩn", "Không đạt")                                        | Không có                                                            | **LEGACY**                 | Không rõ                      | **Có**  | Chuyển đổi sang `overallStatus` trong migration script.                     |
| `resultStatus`                    | `TestResult`    | Biến thể cũ từ module nhập lab bên ngoài                                                       | Không có                                                            | **LEGACY**                 | Không rõ                      | **Có**  | Map về `CanonicalQualityStatus`.                                            |
| `result`                          | `TestResult`    | Biến thể cũ lưu kết quả tóm tắt                                                                | Không có                                                            | **LEGACY**                 | Không rõ                      | **Có**  | Thay bằng `evaluationSnapshot.summary`.                                     |
| `conclusion`                      | `TestResult`    | Kết luận bằng lời của kiểm nghiệm viên                                                         | Không có thẩm quyền về Pass/Fail                                    | **COMPATIBILITY**          | Không                         | Không   | Giữ làm trường ghi chú/mô tả văn bản (`notes`).                             |
| `conclusionStatus`                | `TestResult`    | Trường cũ kết hợp kết luận và trạng thái                                                       | Không có                                                            | **LEGACY**                 | Không rõ                      | **Có**  | Loại bỏ sau khi migrate sang `overallStatus`.                               |
| `isPassed` / `passed` / `pass`    | `TestResult`    | Cờ Boolean (`true`/`false`) phản ánh Đạt/Không đạt                                             | Không có thẩm quyền (mất trạng thái PENDING/UNKNOWN)                | **FORBIDDEN DIRECT WRITE** | Có (nếu đọc)                  | **Có**  | **Cấm ghi trực tiếp**. Đọc thông qua getter `overallStatus === 'PASS'`.     |
| `isFinal`                         | `TestResult`    | Cờ Boolean đánh dấu phiếu đã chốt kết quả                                                      | Không có thẩm quyền                                                 | **LEGACY**                 | Có                            | **Có**  | Thay thế bằng `workflowStatus === 'FINAL' \|\| 'APPROVED' \|\| 'RELEASED'`. |
| `status`                          | `Batch`         | Trạng thái quy trình sản xuất/xuất xưởng của Lô (`PENDING`, `TESTING`, `RELEASED`, `REJECTED`) | `BatchAppService` / `QualityWorkflowMatrixGuard`                    | **CANONICAL**              | Không                         | Không   | Chuẩn Model 1. Cấm dùng làm Quality Decision.                               |
| `overallStatus` / `qualityStatus` | `Batch`         | Quyết định chất lượng của Lô (tổng hợp từ các phiếu KN)                                        | `CanonicalStatusResolver.resolveAuthoritativeTestResultsForBatch()` | **DERIVED**                | **Có** (tính toán on-the-fly) | Không   | Không lưu tĩnh vào DB để tránh lệch trạng thái.                             |
| `approved` / `isApproved`         | `Batch`         | Cờ Boolean cũ biểu thị Lô đã duyệt                                                             | Không có                                                            | **LEGACY**                 | Có                            | **Có**  | Thay bằng `status === 'RELEASED'` và kiểm tra `electronicSignature`.        |
| `released`                        | `Batch`         | Cờ Boolean cũ biểu thị Lô đã xuất xưởng                                                        | Không có                                                            | **LEGACY**                 | Có                            | **Có**  | Thay bằng `status === 'RELEASED'`.                                          |
| `status`                          | `Product`       | Trạng thái lưu hành (`ACTIVE`, `DISCONTINUED`, `RECALLED`)                                     | `ProductService`                                                    | **CANONICAL**              | Không                         | Không   | Chuẩn Model 1.                                                              |
| `status`                          | `TCCS`          | Cờ hiệu lực của tiêu chuẩn (`ACTIVE`, `DRAFT`, `OBSOLETE`)                                     | `TCCSService`                                                       | **CANONICAL**              | Không                         | Không   | Chuẩn Model 3.                                                              |
| `isActive`                        | `TCCS`          | Cờ boolean tương thích với query Firestore                                                     | `TCCSService`                                                       | **COMPATIBILITY**          | Có                            | Không   | Đồng bộ với `status === 'ACTIVE'`.                                          |
| `evaluationSnapshot`              | `TestResult`    | Snapshot bất biến lưu kết quả thẩm định và hash SHA-256                                        | `EvaluationSnapshotBuilder`                                         | **CANONICAL**              | Có (bất biến)                 | Không   | Cấm sửa sau khi tạo. Bắt buộc kiểm tra SHA-256.                             |
| `evaluationHash`                  | `TestResult`    | Mã băm SHA-256 chống làm giả dữ liệu thẩm định                                                 | `EvaluationSnapshotBuilder`                                         | **CANONICAL**              | Có                            | Không   | So khớp khi Finalize/Approve/Release.                                       |
| `version`                         | Tất cả entities | Số phiên bản tuần tự phục vụ Optimistic Concurrency Control (OCC)                              | Domain Services / BaseRepository                                    | **CANONICAL**              | Không                         | Không   | Tự động tăng khi cập nhật, chống ghi đè phiên bản cũ.                       |

---

## 4. CHIẾN LƯỢC DUAL-READ VÀ DI CHUYỂN DỮ LIỆU (MIGRATION PLAN)

### 4.1. Quy trình 9 bước chuẩn mực

```
1. Phân tích Consumer
      ↓
2. Xác định Phụ thuộc Dữ liệu
      ↓
3. Khai báo Trường Canonical
      ↓
4. Kích hoạt Dual-Read (Ưu tiên Canonical, fallback Legacy)
      ↓
5. Chạy Script Migration (Batch Update có Dry-run & Log)
      ↓
6. Xác minh Tính nhất quán (Data Consistency Verification 100%)
      ↓
7. Loại bỏ Nhánh Đọc cũ (Remove Old Read Path)
      ↓
8. Chặn Hoàn toàn Nhánh Ghi cũ (Remove Old Write Path)
      ↓
9. Xóa Field Schema khỏi Database sau chu kỳ bảo trì
```

### 4.2. Chính sách Dual-Read cho TestResult

Hàm `resolveQualityStatus` và `toCanonicalTestResult` triển khai chiến lược Dual-Read an toàn:

```typescript
// Ưu tiên:
// 1. evaluationSnapshot.overallStatus (Bất biến, có chữ ký/hash)
// 2. testResult.overallStatus / qualityStatus (Canonical Model 1)
// 3. Fallback đọc legacy: status / overallResult / isPassed (được chuẩn hóa qua normalizeTestResultStatus)
export function resolveTestResultQualityStatus(tr: TestResult): CanonicalQualityStatus {
  if (tr.evaluationSnapshot?.overallStatus) {
    return tr.evaluationSnapshot.overallStatus;
  }
  if (tr.overallStatus) {
    return tr.overallStatus;
  }
  if (tr.qualityStatus) {
    return tr.qualityStatus;
  }
  // Fallback an toàn cho dữ liệu cũ từ PQM v1/v2
  if (tr.status) {
    return normalizeTestResultStatus(tr.status);
  }
  if (tr.overallResult) {
    return normalizeTestResultStatus(tr.overallResult);
  }
  if (typeof tr.isPassed === 'boolean') {
    return tr.isPassed ? 'PASS' : 'FAIL';
  }
  return 'UNKNOWN';
}
```

### 4.3. Script Di Chuyển Dữ liệu (Migration & Dry-run)

- Script migration chuẩn được định nghĩa tại `scripts/migrate_legacy_test_results.ts`.
- Chế độ **Dry-Run**: Quét toàn bộ collection `testResults`, đối chiếu các trường legacy với `overallStatus`, in ra báo cáo thống kê số bản ghi cần migrate và các trường hợp có sự không khớp (discrepancy) mà **không ghi** vào database.
- Chế độ **Execution**: Cập nhật theo từng Batch Firestore kèm ghi chú `audit_log` với lý do `MIGRATION_PHASE_E_LEGACY_FIELDS`.
- **Rollback Strategy**: Sao lưu snapshot trước khi chạy migration vào file JSON cục bộ mã hóa ngày giờ `backups/backup_test_results_pre_migration_{timestamp}.json`.

---

## 5. RÀO CHẮN AN NINH ĐỐI VỚI AI VÀ AUTO-HEAL

1. **AI Governance**:
   - AI chỉ được phép đọc và phân tích, đề xuất phương án sửa lỗi dữ liệu cũ (`HealingPlan`).
   - AI **tuyệt đối không được tự ý sửa trực tiếp** các trường `status`, `overallStatus`, `evaluationSnapshot` vào cơ sở dữ liệu.
2. **Auto-Healing Boundaries**:
   - `SAFE_AUTO_HEAL`: Chỉ áp dụng cho chuẩn hóa định dạng hiển thị, index tìm kiếm.
   - `CONTROLLED_HEAL`: Sửa khóa ngoại, liên kết lô cần phê duyệt từ QA hoặc ADMIN.
   - `NEVER_AUTO_HEAL`: Tuyệt đối cấm tự động sửa kết quả gốc phòng lab (`results`, `value`), chữ ký điện tử, hoặc bản ghi kiểm toán (`audit_logs`).
