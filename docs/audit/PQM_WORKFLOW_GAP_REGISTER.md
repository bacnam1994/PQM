# PQM — BẢNG ĐĂNG KÝ LỖ HỔNG & ĐỐI CHIẾU KIẾN TRÚC HỆ THỐNG

# (WORKFLOW READINESS GAP & CONFLICT REGISTER V2)

> **Mã văn kiện**: `PQM-AUDIT-GAP-V2`  
> **Phiên bản**: `2.0.0-CANONICAL-AUDIT`  
> **Ngày phê chuẩn**: 22/09/2026  
> **Cơ sở pháp lý & Khế ước**: [`docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md), [`docs/workflow/PQM_WORKFLOW_V2_BLUEPRINT.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md), [`docs/validation/PQM_FUNCTIONAL_REQUIREMENTS.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/validation/PQM_FUNCTIONAL_REQUIREMENTS.md)  
> **Phạm vi đối chiếu 8 chiều**: `MASTER WORKFLOW` ⟷ `WORKFLOW V2` ⟷ `FRS` ⟷ `DOMAIN` ⟷ `SERVICE` ⟷ `UI` ⟷ `REPORT` ⟷ `TEST`  
> **Nguyên tắc bất biến Phase 0**: **KHÔNG SỬA ĐỔI SOURCE CODE TRONG GIAI ĐOẠN AUDIT.**

---

## 1. TỔNG HỢP MA TRẬN ĐỐI CHIẾU 8 CHIỀU (8-DIMENSIONAL CONFORMANCE MATRIX)

| Chiều đối chiếu                         | Thực trạng                                                                                                                                            | Mức độ tuân thủ | Khoảng trống trọng yếu                                                              |
| :-------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------: | :---------------------------------------------------------------------------------- |
| **1. Master Workflow vs Blueprint V2**  | Cấu trúc 5 tầng và 20 Modules đã được hoạch định trong V2 Blueprint nhưng danh mục Business Rules Catalog chưa tách đủ 21 tài liệu độc lập.           |     **85%**     | Thiếu 11 Business Rule Catalogs chuyên biệt.                                        |
| **2. Master Workflow vs FRS (Yêu cầu)** | FRS hiện tại (`PQM_FUNCTIONAL_REQUIREMENTS.md`) mới bao phủ 10 nhóm cơ bản của Phase F CSV, chưa chi tiết hóa từng điều kiện biên của 20 phân hệ.     |     **70%**     | Cần nâng cấp trọn bộ FRS V2 (FRS-MOD-01 đến FRS-MOD-20).                            |
| **3. Workflow vs Domain Models**        | Domain Types đã bổ sung `Criterion.id`, `StructuredCondition`, `CriterionEvaluationState`, nhưng `executionState` chưa hoàn toàn thay thế `isPass`.   |     **80%**     | `isPass` boolean vẫn còn được dùng làm thuộc tính lưu trữ chính trên DB.            |
| **4. Workflow vs State Machines**       | Đã có FSM cho Batch, TestResult, Criterion, AlternateRule nhưng chưa có rào chắn chặn cứng Admin Override trong các trường hợp vi phạm Quality FAIL.  |     **75%**     | Xung đột giữa quyền Admin Override và Bất biến Release Gate.                        |
| **5. Workflow vs Application Services** | Đã có các Service điều phối (`BatchAppService`, `TestResultAppService`, `TCCSAppService`) nhưng một số luồng OOS/CAPA vẫn phụ thuộc vào component UI. |     **75%**     | Phân hệ OOS và CAPA chưa được điều phối 100% bằng Application Service chuyên trách. |
| **6. Workflow vs UI Implementation**    | UI đã loại bỏ filter ẩn chỉ tiêu phụ, tích hợp Dynamic QA Ready Badge ("Đã kiểm xong - Chờ QA duyệt"), nhưng một số bảng vẫn đọc `isPass` thô.        |     **85%**     | Mới có 4/25 Screen Contracts được ban hành chính thức.                              |
| **7. Workflow vs Report / CoA**         | CoA đã chuyển sang đọc từ `EvaluationSnapshot`, loại bỏ thuật toán tự nội suy, có Footnote pháp lý; in ấn đã an toàn.                                 |     **90%**     | Cần khóa cứng quyền in CoA điện tử chỉ khi Snapshot có Hash hợp lệ.                 |
| **8. Workflow vs Automated Tests**      | 127 test files (1,184 tests) pass 100%, có unit tests cho State Machine và Snapshot; tuy nhiên mới có 6/18 E2E Scenarios.                             |     **80%**     | Thiếu 12 E2E Scenarios tự động hóa (S-007 đến S-018).                               |

---

## 2. BẢNG PHÂN LOẠI SAI LỆCH CHI TIẾT (GAP CLASSIFICATION REGISTER)

Hệ thống phân loại theo 8 nhãn chuẩn:

- `CONFLICT`: Mâu thuẫn trực tiếp giữa các tầng.
- `MISSING`: Chưa có tài liệu đặc tả hoặc thành phần kiến trúc bắt buộc.
- `AMBIGUOUS`: Mô tả chưa rõ ràng, dễ gây hiểu nhầm hoặc tự suy diễn.
- `DUPLICATED`: Trùng lặp mã nguồn hoặc trùng lặp logic thẩm định.
- `IMPLEMENTED_WRONG`: Triển khai sai bản chất nghiệp vụ Dược điển/GMP.
- `IMPLEMENTED_PARTIAL`: Đã triển khai một phần nhưng chưa khép kín quy trình.
- `LEGACY`: Tàn dư kiến trúc cũ cần dọn dẹp hoặc refactor.
- `UNTESTED`: Logic nghiệp vụ chưa có test case bao phủ.

---

### 🔴 NHÓM 1: CÁC XUNG ĐỘT KIẾN TRÚC & NGUYÊN TẮC (CONFLICT)

#### [GAP-C01] Xung đột giữa Admin Override và Bất biến Release Gate GMP

- **Phân loại**: `CONFLICT`
- **Vị trí**: [`src/domain/workflow/stateMachine.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/domain/workflow/stateMachine.ts), [`src/services/app/BatchAppService.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/services/app/BatchAppService.ts)
- **Mâu thuẫn**:
  - _Master Workflow (`PRINCIPLE-003`, `Release Gate Contract`)_ quy định: "Release Gate là rào chắn an ninh bất biến. Lô có kết quả kiểm nghiệm `FAIL` hoặc thiếu phiếu kiểm nghiệm thì TUYỆT ĐỐI KHÔNG MỘT AI (kể cả Admin) được chuyển trạng thái Lô sang `RELEASED`."
  - _Mã nguồn hiện tại_: Cờ `adminOverride` trong `BatchStateMachine` và `BatchAppService.updateStatus` cho phép Admin chuyển thẳng Lô sang `RELEASED` bất chấp kết quả Release Gate.
- **Biện pháp xử lý**: Khóa chặn tuyệt đối: `adminOverride` chỉ được áp dụng cho các trạng thái phục hồi (`REJECTED -> TESTING`, `BLOCKED -> TESTING`), **TUYỆT ĐỐI KHÔNG ĐƯỢC OVERRIDE RELEASE GATE ĐỂ CHUYỂN SANG RELEASED NẾU CHẤT LƯỢNG KHÔNG ĐẠT (PASS)**.

#### [GAP-C02] Xung đột giữa Frozen TCCS Snapshot và Fallback Danh mục TCCS Hiện hành

- **Phân loại**: `CONFLICT`
- **Vị trí**: [`src/domain/canonical/canonicalResolver.ts#L103-L188`](file:///d:/26%20Kiem%20nghiem/PQM/src/domain/canonical/canonicalResolver.ts)
- **Mâu thuẫn**:
  - _Master Workflow_: Lô sản xuất phải được gắn chặt và đánh giá vĩnh viễn theo bản `tccsSnapshot` đóng băng tại thời điểm khởi tạo.
  - _Code hiện tại_: Trong `resolveTccsForBatch`, sau khi kiểm tra snapshot, hệ thống vẫn tra cứu theo `batch.tccsId` trong `allTccsList` (danh mục TCCS hiện hành). Nếu TCCS trên danh mục đã bị sửa đổi (version mới), kết quả kiểm nghiệm lô cũ sẽ bị trôi theo tiêu chuẩn mới.
- **Biện pháp xử lý**: Bắt buộc mọi Lô khi chuyển sang `TESTING` phải có `tccsSnapshot` nhúng kèm mã băm SHA-256. Không dùng danh mục hiện hành để re-evaluate lô lịch sử.

---

### 🔴 NHÓM 2: CÁC ĐẶC TẢ VÀ THÀNH PHẦN CÒN THIẾU (MISSING)

#### [GAP-M01] Thiếu 11 Business Rule Catalogs chuyên biệt (Phase 1)

- **Phân loại**: `MISSING`
- **Vị trí**: `docs/business-rules/`
- **Thực trạng**: Hiện tại mới có 10 file tài liệu gộp (`BR_01` -> `BR_10`). Theo Master Plan V2, cần đủ 21 tài liệu chuẩn hóa 16 thuộc tính:
  1. `MASTER_DATA_RULES.md`
  2. `PRODUCT_RULES.md`
  3. `TCCS_RULES.md`
  4. `FORMULA_RULES.md` _(Chưa có file riêng)_
  5. `RAW_MATERIAL_RULES.md` _(Chưa có file riêng)_
  6. `BATCH_RULES.md`
  7. `TEST_RESULT_RULES.md`
  8. `QUALITY_EVALUATION_RULES.md`
  9. `ALTERNATE_RULES.md`
  10. `OOS_RULES.md` _(Chưa tách riêng)_
  11. `DEVIATION_RULES.md` _(Chưa tách riêng)_
  12. `CAPA_RULES.md` _(Chưa tách riêng)_
  13. `APPROVAL_RULES.md`
  14. `RELEASE_RULES.md`
  15. `COA_RULES.md`
  16. `SIGNATURE_RULES.md` _(Chưa có file riêng)_
  17. `AUDIT_RULES.md` _(Chưa có file riêng)_
  18. `GENEALOGY_RULES.md` _(Chưa có file riêng)_
  19. `REPORTING_RULES.md` _(Chưa có file riêng)_
  20. `AI_RULES.md` _(Chưa có file riêng)_
  21. `RBAC_RULES.md` _(Chưa có file riêng)_

#### [GAP-M02] Thiếu 12 Kịch bản Doanh nghiệp Đoạn-Cuối-Đoạn (Phase 5)

- **Phân loại**: `MISSING`
- **Vị trí**: `docs/functional-specs/scenarios/`
- **Thực trạng**: Hiện tại mới có `S-001` đến `S-006`. Thiếu từ `S-007` đến `S-018`:
  - `S-007`: TCCS Version Change (Thay đổi phiên bản tiêu chuẩn)
  - `S-008`: TestResult Approval (Quy trình phê duyệt phiếu kiểm nghiệm)
  - `S-009`: Batch Release (Quy trình thẩm định và ký xuất xưởng)
  - `S-010`: OOS Investigation (Điều tra kết quả ngoài tiêu chuẩn)
  - `S-011`: Deviation (Xử lý sai lệch trong sản xuất/kiểm nghiệm)
  - `S-012`: CAPA (Hành động khắc phục và phòng ngừa)
  - `S-013`: CoA Generation (Sinh phiếu phân tích từ Snapshot)
  - `S-014`: Audit Trail (Truy vết chuỗi kiểm toán ALCOA+)
  - `S-015`: Electronic Signature (Ký số và kiểm tra mã băm 21 CFR Part 11)
  - `S-016`: Concurrent Modification (Xử lý xung đột ghi đồng thời)
  - `S-017`: Legacy Data Reconciliation (Đối chiếu và chuyển đổi dữ liệu cũ)
  - `S-018`: AI Advisory (Cơ chế đề xuất và duyệt hành động AI)

#### [GAP-M03] Thiếu 21 Screen Contracts (Phase 6)

- **Phân loại**: `MISSING`
- **Vị trí**: `docs/screen-contracts/`
- **Thực trạng**: Mới ban hành `SC_10` (Batch Detail), `SC_12` (PKN Editor), `SC_14` (CoA Report). Cần ban hành đủ 25 hợp đồng màn hình theo danh mục `SCREEN_INVENTORY.md` để khóa cứng hành vi UI (cấm UI tự tính toán kết quả).

---

### 🟡 NHÓM 3: TRIỂN KHAI MỘT PHẦN & CHƯA HOÀN TẤT (IMPLEMENTED_PARTIAL)

#### [GAP-P01] Tách biệt Trạng thái Thực thi (ExecutionState) và Trạng thái Chất lượng (QualityStatus)

- **Phân loại**: `IMPLEMENTED_PARTIAL`
- **Vị trí**: [`src/types/testResult.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/types/testResult.ts), [`src/domain/workflow/criterionStateMachine.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/domain/workflow/criterionStateMachine.ts)
- **Thực trạng**: Đã xây dựng `CriterionResultStateMachine`, nhưng cấu trúc dữ liệu lưu trữ `TestResultEntry` trên database vẫn chủ yếu dựa vào `isPass: boolean | null`. Cần đưa `executionState: CriterionExecutionState` (`NOT_STARTED | REQUIRED | TESTING | COMPLETED | NOT_APPLICABLE | EXEMPTED`) và `qualityStatus: CriterionQualityStatus` (`PASS | FAIL | PENDING | UNKNOWN`) thành trường dữ liệu chính quy.

#### [GAP-P02] Phân hệ OOS, Sai lệch (Deviation) và CAPA chưa tích hợp State Machine điều phối

- **Phân loại**: `IMPLEMENTED_PARTIAL`
- **Vị trí**: [`src/pages/quality/deviations/`](file:///d:/26%20Kiem%20nghiem/PQM/src/pages/quality/deviations/), [`src/components/features/OOSInvestigationModal.tsx`](file:///d:/26%20Kiem%20nghiem/PQM/src/components/features/OOSInvestigationModal.tsx)
- **Thực trạng**: OOS và Deviation hiện đang lưu trữ dạng form dữ liệu và modal UI, chưa kết nối trực tiếp với State Machine điều phối tự động khi có chỉ tiêu kiểm nghiệm `FAIL`.

---

### 🟡 NHÓM 4: TRÙNG LẶP LOGIC & TÀN DƯ MÃ NGUỒN CŨ (DUPLICATED & LEGACY)

#### [GAP-D01] Trùng lặp thuật toán tính phần trăm tiến độ kiểm nghiệm

- **Phân loại**: `DUPLICATED`
- **Vị trí**:
  - `src/pages/batches/BatchList/utils/batchProgress.ts` (`calculateBatchProgress`)
  - `src/domain/canonical/canonicalResolver.ts` (`resolveBatchQuality -> completion.percentage`)
- **Nguy cơ**: Hai nơi tính toán độc lập có thể dẫn đến sai lệch phần trăm hoàn thành giữa màn hình danh sách Lô và màn hình thẩm định chất lượng.
- **Khắc phục**: Quy về 1 hàm duy nhất trong `CanonicalStatusResolver`.

#### [GAP-L01] Trường `composition` tự do trong TCCS

- **Phân loại**: `LEGACY`
- **Vị trí**: [`src/types/tccs.ts#L81`](file:///d:/26%20Kiem%20nghiem/PQM/src/types/tccs.ts)
- **Thực trạng**: Trường `composition` (chuỗi text tự do) đã cũ nhưng vẫn tồn tại song song với `ProductFormula` và `FormulaIngredient`. Cần đánh dấu deprecated và loại bỏ hoàn toàn trong Phase 10.

---

### 🟡 NHÓM 5: VÙNG XÁM & CHƯA CÓ TEST KIỂM CHỨNG (AMBIGUOUS & UNTESTED)

#### [GAP-A01] Quy tắc xử lý khi Lô có nhiều phiếu kiểm nghiệm từ nhiều phòng Lab (Multi-Lab Conflict)

- **Phân loại**: `AMBIGUOUS`
- **Vị trí**: [`src/domain/test-result/testResultStatusResolver.ts`](file:///d:/26%20Kiem%20nghiem/PQM/src/domain/test-result/testResultStatusResolver.ts)
- **Thực trạng**: Khi Lab Hóa lý báo PASS chỉ tiêu A, nhưng Lab Vi sinh báo FAIL chỉ tiêu B; hoặc 2 Lab cùng kiểm 1 chỉ tiêu với 2 kết quả khác nhau (Lab Comparison). Quy tắc ưu tiên phiếu authoritative cần được đặc tả thành Business Rule rõ ràng trong `TEST_RESULT_RULES.md` thay vì để code tự sắp xếp theo timestamp.

#### [GAP-U01] Kịch bản kiểm nghiệm lại (Re-test / Retry) trong cùng một chuỗi phiên bản

- **Phân loại**: `UNTESTED`
- **Vị trí**: [`tests/unit/businessRulesWorkflow.test.ts`](file:///d:/26%20Kiem%20nghiem/PQM/tests/unit/businessRulesWorkflow.test.ts)
- **Thực trạng**: Chưa có integration test tự động kiểm thử kịch bản: Phiếu 1 FAIL -> Kích hoạt Retest -> Phiếu 2 PASS -> Phiếu 1 bị Superseded -> Lô chuyển trạng thái PASS và ghi vết ALCOA+.

---

## 3. LỘ TRÌNH THỰC HIỆN THEO 20 PHASES CỦA MASTER PLAN V2

```text
[PHASE 0: AUDIT] ➔ Hoàn thành PQM_WORKFLOW_GAP_REGISTER.md (Không sửa code)
        ↓
[PHASE 1: RULES] ➔ Ban hành 21 Business Rule Catalogs (docs/business-rules/)
        ↓
[PHASE 2: CONTRACTS] ➔ Ban hành 17 Domain Contracts chuẩn hóa (docs/contracts/)
        ↓
[PHASE 3: STATE MACHINES] ➔ Đặc tả 4 FSM độc lập: Batch, TestResult, Criterion, Alternate
        ↓
[PHASE 4: FRS V2] ➔ Ban hành Functional Specifications cho 20 Modules
        ↓
[PHASE 5: SCENARIOS] ➔ Ban hành 18 E2E Scenarios chi tiết (S-001 đến S-018)
        ↓
[PHASE 6: SCREEN CONTRACTS] ➔ Ban hành 25 Screen Contracts (SC-01 đến SC-25)
        ↓
[PHASE 7: ACCEPTANCE] ➔ Ban hành Acceptance Criteria chuẩn Gherkin cho 100% Rules
        ↓
[PHASE 8: TRACEABILITY] ➔ Thiết lập Traceability Matrix V2 8 tầng khép kín
        ↓
[PHASE 9: CODE AUDIT] ➔ Rà soát toàn bộ Codebase đối chiếu với Spec hoàn chỉnh
        ↓
[PHASE 10: DOMAIN ENGINE] ➔ Tái cấu trúc Domain Engine theo thứ tự 10 tầng
        ↓
[PHASE 11: TEST FIRST] ➔ Triển khai Unit, Integration, E2E Tests trước khi sửa UI
        ↓
[PHASE 12-18: SERVICES & MODULES] ➔ Triển khai Application Services, PKN, TCCS, CoA, Release, OOS, Audit
        ↓
[PHASE 19: UI REBUILD] ➔ Tái cấu trúc giao diện theo Screen Contracts (UI Presentation Only)
        ↓
[PHASE 20: FINAL VALIDATION] ➔ Kiểm định toàn diện, Build, Deploy Firebase, Backup & Export Source
```

---

## 4. KẾT LUẬN PHASE 0

Bản **PQM_WORKFLOW_GAP_REGISTER.md** này đã hoàn thành việc rà soát và đối chiếu 8 chiều, ghi nhận tổng cộng **10 lỗ hổng và khoảng trống kiến trúc trọng yếu** thuộc 6 nhóm phân loại.

Toàn bộ các phát hiện này là đầu vào bắt buộc để triển khai **PHASE 1 — BUSINESS RULE CATALOG** mà không làm xáo trộn hoặc suy diễn sai lệch nghiệp vụ.
