# 🏛️ PQM SOURCE OF TRUTH MATRIX

## MA TRẬN NGUỒN SỰ THẬT DUY NHẤT & QUYỀN GHI DỮ LIỆU (MODEL 00)

> **Căn cứ:** `PRINCIPLE-001` (Single Source of Truth) và cấu trúc cơ sở dữ liệu Firebase Realtime Database.

---

## 1. PHÂN ĐỊNH NGUỒN DỮ LIỆU CỐT LÕI (AUTHORITATIVE CORE DATA)

| Thực thể / Trường dữ liệu        | Nguồn Chuẩn Hóa Duy Nhất (Canonical Source)                                                               | Nguồn Dẫn Xuất (Derived - Chỉ Đọc)     | Nguồn Cũ (Legacy - Cấm Ghi Mới)     | Thẩm Quyền Ghi (Writable By)   | Rào Chắn Kiểm Soát (Security Guard)        |
| :------------------------------- | :-------------------------------------------------------------------------------------------------------- | :------------------------------------- | :---------------------------------- | :----------------------------- | :----------------------------------------- |
| **Chất lượng phiếu kiểm nghiệm** | `testResults/$id/evaluationSnapshot/overallStatus` (nếu có) $\implies$ `resolveQualityStatus(testResult)` | `overallStatus`, `StatusBadge`         | `status`, `overallResult`, `result` | `QualityEvaluationEngine`      | Chống giả mạo mã băm SHA-256               |
| **Vòng đời phiếu kiểm nghiệm**   | `testResults/$id/workflowStatus`                                                                          | Document Stepper                       | `testResult.isFinal`                | `TestResultAppService` / QA    | `database.rules.json` (Khóa khi Approved)  |
| **Chất lượng Lô sản xuất**       | `CanonicalStatusResolver.resolveBatchQuality()`                                                           | `batch.progressPercent`, Dashboard KPI | `batch.qualityStatus`               | `CanonicalStatusResolver`      | Phân giải động từ các phiếu liên kết       |
| **Vòng đời Lô sản xuất**         | `batches/$id/status`                                                                                      | Batch Timeline                         | `batch.state`                       | `BatchAppService` / QA E-Sign  | Yêu cầu vai trò QA/ADMIN chuyển `RELEASED` |
| **Tỷ lệ Đạt (Pass Rate)**        | `Math.round(passCount / totalCount * 100)` (hoặc `null` nếu 0 tests)                                      | Dashboard Pass Rate Widget             | `passRate: 100% khi 0 tests`        | Dynamic Function (In-memory)   | Cấm lưu cứng giá trị 100% khi rỗng         |
| **Kiểm nghiệm Đầy đủ**           | `bTests.length > 0 && every(PASS \| FAIL)`                                                                | `batch.isFullyTested` badge            | Has at least 1 PASS                 | Dynamic Function (In-memory)   | Yêu cầu 100% chỉ tiêu bắt buộc hoàn thành  |
| **Tiêu chuẩn cơ sở áp dụng**     | `tccsList/$id` (với `isActive: true`)                                                                     | Snapshot trên Batch / Phiếu            | `batch.tccsCode`                    | `TCCSAppService` / QA          | Chỉ cho phép 1 TCCS Active duy nhất        |
| **Nguyên liệu sản xuất**         | `rawMaterials/$id`                                                                                        | `productFormulas/$id/ingredients`      | Free text name                      | `MaterialAppService` / QA      | Định danh Technical ID chuẩn               |
| **Phòng kiểm nghiệm**            | `testing_laboratories/$id`                                                                                | `testResults/$id/labName`              | String label tự do                  | `LaboratoryAppService` / QA    | Tên chuẩn hóa canonicalName                |
| **Chữ ký điện tử**               | `signatures/$id`                                                                                          | Badge đã ký trên CoA                   | Local storage flag                  | `signatureService` / QA E-Sign | Chuỗi kiểm toán bất biến                   |
| **Nhật ký kiểm toán**            | `audit_logs/$id`                                                                                          | Bảng tra cứu Audit Trail               | N/A                                 | `AlcoaAuditManager`            | **BẤT BIẾN - CẤM SỬA/XÓA**                 |

---

## 2. NGUYÊN TẮC BẢO TOÀN NGUỒN SỰ THẬT (INTEGRITY INVARIANTS)

1. **Không ghi đè dữ liệu dẫn xuất**: Dữ liệu dẫn xuất (Derived Data) như `passRate`, `isFullyTested`, số lượng chỉ tiêu đạt, trạng thái phả hệ, điểm SPC là kết quả tính toán động trong RAM, **tuyệt đối không được lưu thành trường cứng có thẩm quyền độc lập trong cơ sở dữ liệu**.
2. **Không tin cậy Client State**: Toàn bộ dữ liệu trong `Zustand store`, `TanStack Query cache`, và `localStorage` chỉ là bản sao phục vụ hiển thị nhanh; trước khi thực hiện hành vi nhạy cảm (Release, Heal, Approve), hệ thống bắt buộc phải đọc lại dữ liệu tươi từ máy chủ (`Fresh DB Read`).
3. **Loại bỏ hoàn toàn trường ma (Ghost Fields)**: Tuyệt đối không sử dụng các trường không có trong schema như `isPass = true` mặc định, `batch.qualityStatus` hoặc `overallStatus = 'LOCKED'`.
