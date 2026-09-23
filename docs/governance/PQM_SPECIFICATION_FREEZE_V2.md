# PQM_SPECIFICATION_FREEZE_V2: Tuyên Ngôn Đóng Băng Kiến Trúc Đặc Tả

> **Mã văn kiện**: `MANIFEST-SPEC-FREEZE-V2`  
> **Dự án**: Hệ thống Quản lý Chất lượng & Kiểm nghiệm Dược phẩm (PQM)  
> **Cột mốc**: VIBECODE STEP 1A — SPECIFICATION REMEDIATION & FREEZE  
> **Hiệu lực**: Bắt đầu từ ngày ban hành. Toàn bộ các quyết định đặc tả dưới đây được **KHÓA BẤT BIẾN (FROZEN)** làm nền tảng pháp lý kỹ thuật cho **STEP 2 — DOMAIN ENGINE REBUILD**.  
> **Quy tắc thượng tôn**: Không bất kỳ mã nguồn triển khai nào được phép thay đổi, làm sai lệch hoặc tự diễn giải lại các quyết định đã đóng băng trong văn kiện này.

---

## 1. Phân Cấp Thẩm Quyền Tài Liệu (Document Authority Hierarchy)

Hệ thống tài liệu PQM tuân thủ phân cấp kiểm soát nghiêm ngặt 9 tầng từ thượng nguồn (Upstream) xuống hạ nguồn (Downstream):

```text
               [TẦNG 1] Business Workflow (Master Workflow)
                                 ↓
               [TẦNG 2] Business Rules SSoT (BR_01 .. BR_10)
                                 ↓
               [TẦNG 3] Domain Contracts (docs/contracts/)
                                 ↓
               [TẦNG 4] Functional Requirements (FRS V2)
                                 ↓
               [TẦNG 5] Screen Contracts (SCREEN_INVENTORY.md & SC-01..25)
                                 ↓
               [TẦNG 6] Acceptance Criteria (BDD Gherkin & Test Case Registry)
                                 ↓
               [TẦNG 7] E2E Business Scenarios (docs/scenarios/)
                                 ↓
               [TẦNG 8] Traceability Matrix (Canonical RTM V2)
                                 ↓
               [TẦNG 9] Code Implementation (src/ & tests/)
```

**Nguyên tắc bất biến của Phân cấp Thẩm quyền**:

1. Tài liệu cấp dưới **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP ĐỊNH NGHĨA LẠI** hoặc xung đột với tài liệu cấp trên.
2. Mọi xung đột logic giữa mã nguồn và đặc tả phải được phân giải dựa trên tài liệu ở tầng cao nhất có thẩm quyền.
3. Không được thay đổi yêu cầu nghiệp vụ của đặc tả chỉ để hợp thức hóa đoạn code cũ (legacy).

---

## 2. Danh Mục Tài Liệu Chuẩn Tắc (Canonical Source of Truth Manifest)

| Phân Vùng Đặc Tả        | Tài Liệu SSoT Duy Nhất Được Công Nhận                                                                                                                                                                                                                   | Trạng Thái | Vai Trò & Thẩm Quyền                                        |
| :---------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :--------: | :---------------------------------------------------------- |
| **Workflow Master**     | [`docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md)                                                                                                                          |  `FROZEN`  | "Hiến pháp" tối cao về quy trình nghiệp vụ và luồng dữ liệu |
| **Business Rules**      | [`docs/business-rules/BR_01_PRODUCT_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_01_PRODUCT_RULES.md) đến [`BR_10_AUDIT_SECURITY_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_10_AUDIT_SECURITY_RULES.md) |  `FROZEN`  | 10 bộ quy tắc nghiệp vụ chuẩn tắc độc quyền (SSoT)          |
| **Rule Registry**       | [`docs/business-rules/RULE_ID_REGISTRY.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/RULE_ID_REGISTRY.md)                                                                                                                                  |  `FROZEN`  | Bảng định danh duy nhất cho toàn bộ 52 mã Rule ID           |
| **Domain Contracts**    | Thư mục [`docs/contracts/`](file:///d:/26%20Kiem%20nghiem/PQM/docs/contracts/) (18 bản hợp đồng miền)                                                                                                                                                   |  `FROZEN`  | Hợp đồng kiểu dữ liệu, FSM và ranh giới kiến trúc           |
| **Functional Specs**    | [`docs/functional-specs/PQM_FUNCTIONAL_REQUIREMENTS_V2.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/functional-specs/PQM_FUNCTIONAL_REQUIREMENTS_V2.md)                                                                                                  |  `FROZEN`  | Đặc tả chức năng hệ thống truy xuất 8 chiều                 |
| **Screen Inventory**    | [`docs/screen-contracts/SCREEN_INVENTORY.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/screen-contracts/SCREEN_INVENTORY.md) & [`SCREEN_ID_REGISTRY.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/screen-contracts/SCREEN_ID_REGISTRY.md)                   |  `FROZEN`  | Định danh chuẩn 25 màn hình giao diện (`SC-01` đến `SC-25`) |
| **Acceptance Criteria** | [`docs/acceptance/ACCEPTANCE_CRITERIA_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/acceptance/ACCEPTANCE_CRITERIA_MASTER.md) & [`TEST_CASE_REGISTRY.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/acceptance/TEST_CASE_REGISTRY.md)                 |  `FROZEN`  | Tiêu chí nghiệm thu BDD Gherkin và bảng ca kiểm thử         |
| **E2E Scenarios**       | [`docs/scenarios/E2E_BUSINESS_SCENARIOS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/scenarios/E2E_BUSINESS_SCENARIOS.md)                                                                                                                                |  `FROZEN`  | Bộ 18 kịch bản nghiệp vụ đầu cuối                           |
| **Traceability Matrix** | [`docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/traceability/PQM_TRACEABILITY_MATRIX_V2.md)                                                                                                                  |  `FROZEN`  | Ma trận truy xuất nguồn gốc 8 chiều khép kín, zero phantom  |

---

## 3. Các Quyết Định Kiến Trúc Đã Được Đóng Băng (Frozen Architectural Decisions)

### 3.1. Quyết định 1: Mô hình Rào chắn Xuất xưởng 7 Cổng (7 Release Gates)

- **Mô hình chuẩn tắc**: Khóa duy nhất mô hình **7 Release Gates** đồng bộ từ Master Workflow (`PQM_SYSTEM_WORKFLOW_MASTER.md`), Business Rule (`BR-REL-001`), FRS (`FRS-REL-001`), Screen Contract (`SC-10`) đến RTM.
- **Loại bỏ**: Xóa bỏ hoàn toàn mô hình 5 Gates khỏi mọi văn kiện đặc tả.
- **Cam kết Step 2**: Toàn bộ 7 Gates sẽ được kết nối dữ liệu thực tế tại `ReleaseService.ts`, gỡ bỏ triệt để hardcode `gate5Passed = true` và fallback Gate 6.

### 3.2. Quyết định 2: Tách biệt 3 Hệ thống Trạng thái Độc lập (3 Decoupled Status Systems)

Hệ thống khóa vĩnh viễn sự phân tách giữa 3 chiều trạng thái trực giao:

1. **Criterion Execution State** (`CriterionExecutionState`):
   `NOT_STARTED` | `REQUIRED` | `TESTING` | `COMPLETED` | `NOT_APPLICABLE` | `EXEMPTED`
2. **Quality Status** (`CanonicalQualityStatus` / `CriterionQualityStatus`):
   - Cấp chỉ tiêu: `PASS` | `FAIL` | `PENDING` | `NOT_APPLICABLE`
   - Cấp Lô: `PASS` | `FAIL` | `PENDING` | `INDETERMINATE` (Dành riêng cho xung đột đa lab hoặc ngoại lệ kỹ thuật cần QA can thiệp)
3. **Workflow Status** (`BatchWorkflowStatus` / `TestResultWorkflowStatus`):
   - Lô (9 trạng thái): `DRAFT` | `IN_PRODUCTION` | `TESTING` | `QA_REVIEW` | `APPROVED` | `RELEASED` | `REJECTED` | `HOLD` | `RECALLED`
   - Phiếu KN (6 trạng thái): `DRAFT` | `SUBMITTED` | `REVIEWED` | `APPROVED` | `REJECTED` | `REVOKED`

- **Bất biến**: `isPass: boolean` bị cấm làm thẩm quyền quyết định nghiệp vụ.

### 3.3. Quyết định 3: Đóng băng Ngữ nghĩa và Phạm vi Quy tắc Thay thế (Alternate Rules)

- **Semantics của `FAIL_RETRY`**:
  - Main `PASS` ➔ Alt là `NOT_APPLICABLE` (không dùng `EXEMPTED`).
  - Main `FAIL` + Alt rỗng ➔ Alt là `REQUIRED` (`TRIGGERED_PENDING`), Toàn phiếu là `PENDING` (bảo toàn quyền thử lại, cấm ép rớt `FAIL`).
  - Main `FAIL` + Alt `PASS` ➔ Alt là `COMPLETED` (`TRIGGERED_PASS`), Cứu Đạt chỉ tiêu chính.
  - Main `FAIL` + Alt `FAIL` ➔ Alt là `COMPLETED` (`TRIGGERED_FAIL`), Kết luận Không Đạt.
- **Semantics của `CONDITIONAL_CHECK`**:
  - Điều kiện `FALSE` (An toàn) ➔ Alt là `EXEMPTED`, Kết luận `PASS` (Miễn kiểm hợp lệ).
  - Điều kiện `TRUE` (Kích hoạt) ➔ Bắt buộc thử nghiệm (`TRIGGERED_PENDING` / `REQUIRED`).
- **Phạm vi V2 (Scope Freeze)**:
  - Chỉ hỗ trợ duy nhất 2 loại: `FAIL_RETRY` và `CONDITIONAL_CHECK`.
  - Các loại `SUBSTITUTION` và `PERIODIC_SKIP` được khóa nhãn **`FUTURE / OUT_OF_SCOPE (V3+)`**, không được xem là nợ thiếu sót của V2.
- **Hiển thị UI**: Toàn bộ 100% chỉ tiêu luôn xuất hiện trên form `SC-12`, cấm dùng `filter()` ẩn dòng chỉ tiêu.

### 3.4. Quyết định 4: Đóng băng Bất biến Phiếu CoA (CoA Immutability)

- Màn hình và bản in CoA (`SC-14`) chỉ đọc dữ liệu độc quyền từ `batch.evaluationSnapshot`.
- Tuyệt đối cấm mọi hành vi tính toán lại (re-calculation), so sánh $min/max$, hoặc nội suy (client interpolation) trong component trình bày.

### 3.5. Quyết định 5: Đóng băng Hệ thống 25 Màn hình Giao diện (`SC-01` đến `SC-25`)

- Khóa duy nhất bảng phân bổ trong `SCREEN_INVENTORY.md` và `SCREEN_ID_REGISTRY.md`.
- `SC-09`: Batch List | `SC-10`: Batch Detail & Release Gate | `SC-11`: PKN List | `SC-12`: PKN Editor | `SC-14`: CoA Report.

### 3.6. Quyết định 6: Khép kín Ma trận RTM (Zero Phantom References)

- Mọi thành phần chưa có file mã nguồn trên đĩa đều được ghi nhận tường minh với trạng thái `PLANNED / NOT_IMPLEMENTED` kèm kế hoạch thi công ở Step 2.
- Không một đường dẫn ảo nào được phép xuất hiện trong RTM.

---

## 4. Chữ Ký Xác Nhận & Chuyển Giao (Sign-off & Handoff)

Bằng văn kiện này, toàn bộ cấu trúc đặc tả của hệ thống PQM V2 chính thức đạt trạng thái **FROZEN**.

Dự án đủ điều kiện tiến hành **STEP 1B — AUDIT RE-CHECK** để thẩm tra độc lập toàn diện trước khi bước vào **STEP 2 — DOMAIN ENGINE REBUILD**.
