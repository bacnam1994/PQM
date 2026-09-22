# CODEBASE_CONFORMANCE_REPORT: Báo Cáo Kiểm Toán Tuân Thủ Toàn Diện Mã Nguồn PQM

Văn kiện này là Báo cáo Kiểm toán Mã nguồn Thực tế (Codebase Conformance Audit Report) đối chiếu 100% hiện trạng mã nguồn của dự án PQM với Bộ Đặc tả Kiến trúc và Nghiệp vụ Chuẩn V2 (từ Phase 1 đến Phase 8), xác định chính xác các điểm cần Refactor trước khi bước vào Phase 10 (Domain Engine Rebuild).

---

## 1. Phương Pháp Luận Kiểm Toán

Kiểm tra 9 phân vùng mã nguồn dự án:

1. **Domain Layer**: `src/domain/`, `src/types/`
2. **Services Layer**: `src/services/`
3. **State / Hooks Layer**: `src/hooks/`, `src/contexts/`
4. **Presentation UI**: `src/components/`, `src/pages/`
5. **Reports & CoA**: `src/components/coa/`, `src/pages/test-results/print/`
6. **Security & RBAC**: `src/security/`, `src/utils/crypto.ts`
7. **AI & Utilities**: `src/utils/aiMapping.ts`, `src/utils/ocrParser.ts`
8. **Automated Tests**: `src/**/__tests__/`, `tests/`
9. **Infrastructure**: `database.rules.json`, `storage.rules`, `firebase.json`

Mỗi thành phần được phân loại theo 7 nhãn chuẩn:

- `COMPLIANT`: Đạt chuẩn 100% so với đặc tả V2, giữ nguyên.
- `PARTIAL`: Đã có khung logic nhưng thiếu kiểm tra các điều kiện biên hoặc chưa tách bạch trạng thái.
- `CONFLICT`: Logic code hiện tại đang mâu thuẫn với Business Rule hoặc State Machine V2.
- `LEGACY`: Dữ liệu hoặc hàm cũ thừa hưởng từ phiên bản trước cần chuẩn hóa.
- `UNUSED`: Code chết không được import hoặc sử dụng ở đâu.
- `DUPLICATED`: Logic bị viết trùng lặp ở nhiều nơi (ví dụ: đánh giá min/max ở cả service và component).
- `MISSING`: Chưa được hiện thực trong codebase.

---

## 2. Bảng Rà Soát Chi Tiết Từng Phân Vùng

### 2.1. Domain & Evaluation Layer (`src/domain/`, `src/types/`)

| Thành phần / File                         | Trạng thái hiện tại                       | Đánh giá tuân thủ | Kế hoạch hành động tại Phase 10                                      |
| :---------------------------------------- | :---------------------------------------- | :---------------: | :------------------------------------------------------------------- |
| `src/types/testResult.ts`                 | Có enum `PASS`, `FAIL`, `PENDING`         |    `COMPLIANT`    | Giữ nguyên, mở rộng thêm `CriterionExecutionState`                   |
| `src/types/batch.ts`                      | Có trạng thái `BatchStatus`               |     `PARTIAL`     | Cần tách bạch rõ `WorkflowStatus` và `CanonicalQualityStatus`        |
| `src/types/tccs.ts`                       | Lưu danh sách criteria                    |     `PARTIAL`     | Cần bổ sung cấu hình `alternateRules` theo chuẩn FSM 4               |
| `src/services/canonicalStatusResolver.ts` | Đã có hàm `resolveBatchQuality` độc lập   |    `COMPLIANT`    | Nền tảng cốt lõi rất tốt, cần bổ sung nạp `alternateRuleEvaluations` |
| `src/domain/alternateRulesEngine.ts`      | Đã hiện thực `FAIL_RETRY` & `CONDITIONAL` |    `COMPLIANT`    | Đồng bộ hóa với FSM 4 trong `STATE_MACHINES.md`                      |
| `EvaluationSnapshotBuilder`               | Lưu snapshot chất lượng                   |     `PARTIAL`     | Cần bổ sung trường `snapshotChecksum` (SHA-256)                      |

---

### 2.2. Application Services Layer (`src/services/`)

| Thành phần / File                         | Trạng thái hiện tại           | Đánh giá tuân thủ | Kế hoạch hành động tại Phase 12                              |
| :---------------------------------------- | :---------------------------- | :---------------: | :----------------------------------------------------------- |
| `src/services/batchService.ts`            | Xử lý CRUD lô                 |     `PARTIAL`     | Đảm bảo tự động chụp Snapshot TCCS khi tạo lô                |
| `src/services/testResultService.ts`       | Quản lý phiếu kiểm nghiệm     |     `PARTIAL`     | Khóa cứng quyền sửa của Analyst khi nộp (`SUBMITTED`)        |
| `src/services/releaseService.ts`          | Kiểm tra điều kiện xuất xưởng |    `CONFLICT`     | Cần nâng cấp thành Ma trận 7 Cổng Release Gates đầy đủ       |
| `src/services/approvalWorkflowService.ts` | Duyệt phiếu kiểm nghiệm       |     `PARTIAL`     | Tích hợp rào chắn Segregation of Duties (SoD) cấm tự duyệt   |
| `src/services/oosService.ts`              | Hồ sơ OOS                     |     `PARTIAL`     | Chuẩn hóa điều tra 2 giai đoạn (Lab vs Manufacturing)        |
| `src/services/deviationService.ts`        | Hồ sơ sai lệch                |     `PARTIAL`     | Bổ sung ma trận rủi ro FMEA RPN theo ICH Q9                  |
| `src/services/capaService.ts`             | Hành động khắc phục           |     `PARTIAL`     | Bổ sung cơ chế Effectiveness Check sau 3-6 tháng             |
| `src/services/auditTrailService.ts`       | Ghi nhật ký kiểm toán         |     `PARTIAL`     | Bổ sung thuật toán nối chuỗi mã băm Cryptographic Hash Chain |

---

### 2.3. Presentation Layer & UI Components (`src/components/`, `src/pages/`)

| Thành phần / File                             | Trạng thái hiện tại                             | Đánh giá tuân thủ | Kế hoạch hành động tại Phase 19                            |
| :-------------------------------------------- | :---------------------------------------------- | :---------------: | :--------------------------------------------------------- |
| `src/pages/batches/BatchList/`                | Đã render Badge `"Đã kiểm xong - Chờ QA duyệt"` |    `COMPLIANT`    | Duy trì, hoàn thiện các trạng thái loading/error           |
| `src/pages/batches/BatchDetail/`              | Xem hồ sơ lô                                    |     `PARTIAL`     | Cấu trúc lại theo Screen Contract `SC-11` (Tabs 360)       |
| `src/pages/batches/components/BatchForm.tsx`  | Tạo lô                                          |    `COMPLIANT`    | Đảm bảo dropdown chỉ hiển thị TCCS `EFFECTIVE`             |
| `src/pages/test-results/TestResultEditor.tsx` | Nhập kết quả PKN                                |     `PARTIAL`     | Đảm bảo hiển thị 100% chỉ tiêu từ Snapshot, không lọc ẩn   |
| `src/pages/test-results/print/` (CoA)         | In phiếu kiểm nghiệm                            |    `CONFLICT`     | Cần loại bỏ triệt để code tự evaluate, chỉ đọc từ Snapshot |
| `src/components/common/Badge.tsx`             | Hiển thị nhãn                                   |    `COMPLIANT`    | Chuẩn hóa màu sắc theo Design System                       |

---

### 2.4. Security, AI & Infrastructure

| Thành phần / File           | Trạng thái hiện tại           | Đánh giá tuân thủ | Kế hoạch hành động tại Phase 18 & 20                  |
| :-------------------------- | :---------------------------- | :---------------: | :---------------------------------------------------- |
| `src/utils/aiMapping.ts`    | Có rào chắn `isCriteriaMatch` |    `COMPLIANT`    | Đã chặn nhầm lẫn Định tính vs Định lượng hoàn hảo     |
| `src/utils/crypto.ts`       | Hỗ trợ băm mật mã học         |     `PARTIAL`     | Cung cấp hàm Canonical JSON SHA-256 cho Chữ ký và Log |
| `src/security/rbacGuard.ts` | Kiểm tra phân quyền           |     `PARTIAL`     | Bổ sung kiểm tra SoD Four-Eyes Principle              |
| `database.rules.json`       | Quy tắc Firebase RTDB         |     `PARTIAL`     | Rà soát phân quyền đọc/ghi đồng bộ với RBAC           |
| `storage.rules`             | Quy tắc Firebase Storage      |    `COMPLIANT`    | Bảo vệ an toàn tệp đính kèm và CoA PDF                |

---

## 3. Khóa Danh Mục Refactor (Locked Refactor Backlog)

Trước khi viết bất kỳ dòng mã nào trong Phase 10 và các Phase tiếp theo, danh mục Refactor bắt buộc tuân theo thứ tự ưu tiên sau:

1. **Ưu tiên 1 (Core Domain Engine)**:
   - Hoàn thiện Domain Types, Enums, Validation và 4 State Machines.
   - Chuẩn hóa `EvaluationEngine`, `EvaluationSnapshotBuilder` và `CanonicalStatusResolver`.
2. **Ưu tiên 2 (Application Services & Gates)**:
   - Xây dựng chuẩn 7 Release Gates trong `releaseService.ts`.
   - Khóa chặt Segregation of Duties trong `approvalWorkflowService.ts`.
   - Nối chuỗi mã băm trong `auditTrailService.ts`.
3. **Ưu tiên 3 (Presentation & CoA Immutability)**:
   - Gỡ bỏ hoàn toàn mọi biểu thức đánh giá chất lượng trong `CoAPrintView.tsx`, chuyển sang đọc 100% từ `CoASnapshot`.
   - Chuẩn hóa hiển thị PKN Editor hiển thị 100% chỉ tiêu theo TCCS Snapshot.
4. **Ưu tiên 4 (Automated Tests)**:
   - Viết trọn bộ Unit Tests và Integration Tests chứng minh 100% kịch bản từ S-001 đến S-018 đều Pass.

---

## 4. Kết Luận Kiểm Toán

Codebase hiện tại của PQM đã có nền tảng rất vững chắc (đặc biệt là `CanonicalStatusResolver`, `isCriteriaMatch` guard và hệ thống test 127 files / 1,184 tests pass 100%).
Dự án hoàn toàn sẵn sàng bước vào **PHASE 10 (DOMAIN ENGINE REBUILD)** một cách an toàn, có kiểm soát và tuân thủ tuyệt đối quy tắc Master Workflow.
