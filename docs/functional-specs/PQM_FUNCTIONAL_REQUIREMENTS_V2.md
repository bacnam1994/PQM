# ĐẶC TẢ YÊU CẦU CHỨC NĂNG HỆ THỐNG V2 (FRS V2)

## (FUNCTIONAL REQUIREMENTS SPECIFICATION)

> **Mã tài liệu**: `SPEC-FRS-V2-01`  
> **Thư mục**: `docs/functional-specs/PQM_FUNCTIONAL_REQUIREMENTS_V2.md`  
> **Phiên bản chuẩn hóa**: V2.1 — Post-Remediation Freeze  
> **Nguyên tắc truy xuất 8 chiều**: Mỗi FRS bắt buộc map thông suốt:
> `FRS → Business Rule → Domain Contract → Screen Contract → Acceptance Criteria → E2E Scenario → Implementation Target → Automated Test → Status`.

---

## 1. NHÓM CHỨC NĂNG QUẢN LÝ TIÊU CHUẨN CƠ SỞ (TCCS)

### FRS-TCCS-001: Quản lý Danh mục Chỉ tiêu với UUID Bất biến

- **Mô tả**: Khi người dùng thêm chỉ tiêu mới vào TCCS, hệ thống tự động sinh `criterionId` (UUID v4) và gán vĩnh viễn cho chỉ tiêu đó.
- **Business Rule**: `BR-TCCS-002`
- **Domain Contract**: `CRITERION_STATE_CONTRACT.md`
- **Screen Contract**: `SC-06` (`SC_06_TCCS_EDITOR` / `SCREEN_CONTRACTS.md`)
- **Acceptance Criteria**: `AC-TCCS-01` (`ACCEPTANCE_CRITERIA_MASTER.md`)
- **E2E Scenario**: `S-004` (`E2E_SCENARIOS.md`)
- **Implementation Target**: `src/types/tccs.ts`, `src/domain/rules/TCCSRules.ts`
- **Automated Test**: `tests/unit/businessRules/tccsRules.test.ts`
- **Implementation Status**: `IMPLEMENTED`

### FRS-TCCS-002: Cấu hình Quy tắc Chỉ tiêu Thay thế Có Cấu trúc

- **Mô tả**: Trình biên tập TCCS (`SC-06`) cung cấp giao diện trực quan để thiết lập quan hệ thay thế: Chỉ tiêu chính, Chỉ tiêu phụ, Loại quy tắc (`FAIL_RETRY` hoặc `CONDITIONAL_CHECK` kèm toán tử/ngưỡng).
- **Business Rule**: `BR-TCCS-004`, `BR-ALT-001`, `BR-ALT-002`
- **Domain Contract**: `ALTERNATE_RULE_CONTRACT.md`
- **Screen Contract**: `SC-06` (`SCREEN_CONTRACTS.md`)
- **Acceptance Criteria**: `AC-TCCS-04`, `AC-ALT-01`, `AC-ALT-02`
- **E2E Scenario**: `S-004`, `S-005`
- **Implementation Target**: `src/types/tccs.ts`, `src/domain/evaluation/AlternateRuleResolver.ts`
- **Automated Test**: `src/domain/evaluation/AlternateRuleResolver.test.ts`
- **Implementation Status**: `IMPLEMENTED`

### FRS-TCCS-003: Đóng Băng TCCS & Tự Động Kế Thừa Phiên Bản

- **Mô tả**: Khi TCCS đã có Lô sản xuất liên kết, nút "Lưu" trực tiếp bị khóa; cung cấp chức năng "Tạo phiên bản mới (v+1)" để sao chép sang bản thảo mới.
- **Business Rule**: `BR-TCCS-001`, `BR-TCCS-003`
- **Domain Contract**: `PRODUCT_TCCS_CONTRACT.md`
- **Screen Contract**: `SC-04`, `SC-05`, `SC-06` (`SCREEN_CONTRACTS.md`)
- **Acceptance Criteria**: `AC-TCCS-02`, `AC-TCCS-03`
- **E2E Scenario**: `S-004`, `S-007`
- **Implementation Target**: `src/services/app/TCCSAppService.ts`
- **Automated Test**: `src/services/app/TCCSAppService.test.ts`
- **Implementation Status**: `IMPLEMENTED`

---

## 2. NHÓM CHỨC NĂNG HỒ SƠ LÔ SẢN XUẤT (BATCH)

### FRS-BAT-001: Tự Động Tạo TCCS Snapshot Khi Khởi Tạo Lô

- **Mô tả**: Tại thời điểm tạo Lô thành công, hệ thống tự động deep clone bản TCCS đang `ACTIVE` và nhúng vào `batch.tccsSnapshot`.
- **Business Rule**: `BR-BAT-001`
- **Domain Contract**: `BATCH_GENEALOGY_CONTRACT.md`
- **Screen Contract**: `SC-09`, `SC-10` (`SC_10_BATCH_DETAIL_CONTRACT.md`)
- **Acceptance Criteria**: `AC-BAT-01`
- **E2E Scenario**: `S-001`, `S-002`
- **Implementation Target**: `src/services/app/BatchAppService.ts`
- **Automated Test**: `src/services/app/BatchAppService.test.ts`
- **Implementation Status**: `IMPLEMENTED`

### FRS-BAT-002: Phân Tách Tuyệt Đối Quality Status và Workflow Status

- **Mô tả**: Không cho phép cập nhật trực tiếp trường `batch.qualityStatus`. Trường này được tính toán độc quyền bởi `CanonicalStatusResolver` / `QualityEvaluationEngine`.
- **Business Rule**: `BR-BAT-002`
- **Domain Contract**: `WORKFLOW_STATUS_CONTRACT.md`, `QUALITY_STATUS_CONTRACT.md`
- **Screen Contract**: `SC-09`, `SC-10`
- **Acceptance Criteria**: `AC-BAT-02`
- **E2E Scenario**: `S-001`, `S-003`
- **Implementation Target**: `src/domain/canonical/canonicalResolver.ts`, `src/domain/canonical/canonicalStatus.ts`
- **Automated Test**: `src/domain/canonical/canonicalArchitecture.test.ts`
- **Implementation Status**: `IMPLEMENTED`

### FRS-BAT-003: Cơ Chế Khóa Dữ Liệu Bất Biến (Data Locking)

- **Mô tả**: Khi `batch.status === 'APPROVED'` hoặc `'RELEASED'`, API từ chối toàn bộ các thao tác chỉnh sửa thông tin sản xuất của lô.
- **Business Rule**: `BR-BAT-003`
- **Domain Contract**: `STATE_MACHINES.md (FSM 1)`
- **Screen Contract**: `SC-10`
- **Acceptance Criteria**: `AC-BAT-03`
- **E2E Scenario**: `S-001`
- **Implementation Target**: `src/services/app/BatchAppService.ts`
- **Automated Test**: `tests/domain/batchWorkflowRegression.test.ts`
- **Implementation Status**: `IMPLEMENTED`

---

## 3. NHÓM CHỨC NĂNG PHIẾU KIỂM NGHIỆM & ĐÁNH GIÁ CHẤT LƯỢNG

### FRS-QEV-001: Đánh Giá Chỉ Tiêu Chuẩn Hóa Theo Thời Gian Thực

- **Mô tả**: Khi nhập giá trị, hệ thống gọi `CriterionEvaluator` để so sánh với $min, max$ (với epsilon $10^{-9}$) hoặc $expectedText$ và hiển thị nhãn Đạt / Không đạt tức thì, bảo toàn số 0 hợp lệ.
- **Business Rule**: `BR-QEV-001`, `BR-QEV-002`, `BR-QEV-003`
- **Domain Contract**: `QUALITY_STATUS_CONTRACT.md`, `CRITERION_STATE_CONTRACT.md`
- **Screen Contract**: `SC-12` (`SC_12_PKN_EDITOR_CONTRACT.md`)
- **Acceptance Criteria**: `AC-QEV-01`, `AC-QEV-02`, `AC-QEV-03`
- **E2E Scenario**: `S-001`, `S-004`
- **Implementation Target**: `src/domain/evaluation/CriterionEvaluator.ts`
- **Automated Test**: `src/domain/evaluation/QualityEvaluationEngine.parity.test.ts`
- **Implementation Status**: `IMPLEMENTED`

### FRS-QEV-002: Phân Giải Tự Động Quy Tắc Thay Thế

- **Mô tả**: Khi chỉ tiêu chính FAIL trong `FAIL_RETRY`, chỉ tiêu phụ đổi sang `TRIGGERED_PENDING`, mở khóa ô nhập, giữ toàn phiếu `PENDING`. Khi Main PASS, chỉ tiêu phụ chuyển `NOT_APPLICABLE`. Đối với `CONDITIONAL_CHECK`, khi điều kiện false, chỉ tiêu phụ chuyển `EXEMPTED`. Toàn bộ 100% chỉ tiêu luôn hiển thị trên UI.
- **Business Rule**: `BR-ALT-001`, `BR-ALT-002`, `BR-ALT-003`
- **Domain Contract**: `ALTERNATE_RULE_CONTRACT.md`, `STATE_MACHINES.md (FSM 4)`
- **Screen Contract**: `SC-12` (`SC_12_PKN_EDITOR_CONTRACT.md`)
- **Acceptance Criteria**: `AC-ALT-01`, `AC-ALT-02`, `AC-ALT-03`
- **E2E Scenario**: `S-004`, `S-005`, `S-006`
- **Implementation Target**: `src/domain/evaluation/AlternateRuleResolver.ts`
- **Automated Test**: `src/domain/evaluation/AlternateRuleResolver.test.ts`
- **Implementation Status**: `IMPLEMENTED`

### FRS-QEV-003: Chặn Nộp Phiếu Kiểm Nghiệm (Submit Gate)

- **Mô tả**: Nút "Gửi thẩm tra" (Submit) bị vô hiệu hóa khi còn bất kỳ chỉ tiêu bắt buộc nào chưa có kết quả hoặc có chỉ tiêu thay thế đang ở trạng thái `TRIGGERED_PENDING`.
- **Business Rule**: `BR-TR-001`
- **Domain Contract**: `TEST_RESULT_CONTRACT.md`, `STATE_MACHINES.md (FSM 2)`
- **Screen Contract**: `SC-12`
- **Acceptance Criteria**: `AC-TR-01`
- **E2E Scenario**: `S-001`, `S-003`
- **Implementation Target**: `src/services/app/TestResultAppService.ts`
- **Automated Test**: `src/services/app/TestResultAppService.test.ts`
- **Implementation Status**: `IMPLEMENTED`

### FRS-QEV-004: Tạo Evaluation Snapshot Kèm Mã Băm Khi Ký Duyệt

- **Mô tả**: Khi QA Manager ký duyệt phiếu kiểm nghiệm, hệ thống trích xuất toàn bộ kết quả, tính toán mã băm SHA-256 và lưu đối tượng `evaluationSnapshot` bất biến vào bản ghi phiếu.
- **Business Rule**: `BR-TR-002`
- **Domain Contract**: `COA_SNAPSHOT_CONTRACT.md`, `SIGNATURE_AUDIT_CONTRACT.md`
- **Screen Contract**: `SC-12`, `SC-13`, `SC-18`
- **Acceptance Criteria**: `AC-TR-02`
- **E2E Scenario**: `S-001`, `S-008`
- **Implementation Target**: `src/domain/evaluation/EvaluationSnapshotBuilder.ts`
- **Automated Test**: `tests/integration/evaluationSnapshotWorkflow.test.ts`
- **Implementation Status**: `IMPLEMENTED`

---

## 4. NHÓM CHỨC NĂNG RELEASE GATE & BÁO CÁO COA

### FRS-REL-001: Rào Chắn Xuất Xưởng Lô 7 Cổng (7 Release Gates)

- **Mô tả**: Hệ thống kiểm tra đồng thời 7 cổng kiểm soát an toàn trước khi cho phép QA Director / Authorized Person ký lệnh xuất xưởng (`RELEASED`):
  1. **Gate 1 (Batch Lifecycle State)**: Lô ở trạng thái hợp lệ (`TESTING` hoặc `QA_REVIEW`), không bị `HOLD` hoặc `REJECTED`.
  2. **Gate 2 (Canonical Quality Status)**: Đánh giá chất lượng chuẩn tắc của Lô phải là `PASS`.
  3. **Gate 3 (Criteria Completeness)**: 100% chỉ tiêu bắt buộc đã được đánh giá đầy đủ (`completionPercentage === 100`).
  4. **Gate 4 (OOS Investigation Resolution)**: 100% hồ sơ OOS liên quan đã được điều tra xong và duyệt đóng.
  5. **Gate 5 (Deviation Containment)**: 100% phiếu sai lệch Major/Critical liên đới đã hoàn tất biện pháp cô lập rủi ro.
  6. **Gate 6 (Raw Materials & Batch Expiry)**: 100% nguyên vật liệu không quá hạn tại thời điểm SX, và Lô còn trong hạn dùng.
  7. **Gate 7 (Part 11 Electronic Signature & Authorization)**: Chữ ký số điện tử xác thực mật khẩu, đúng vai trò và mã băm SHA-256.
- **Ràng buộc an ninh**: Nếu bất kỳ cổng nào chưa đạt, nút "Ký xuất xưởng" tại `SC-10` bị khóa cứng; hành vi bypass ở backend/API bị chặn hoàn toàn.
- **Business Rule**: `BR-REL-001`, `BR-REL-002`, `BR-SEC-001`
- **Domain Contract**: `BATCH_GENEALOGY_CONTRACT.md`, `STATE_MACHINES.md (FSM 1)`
- **Screen Contract**: `SC-10` (`SC_10_BATCH_DETAIL_CONTRACT.md`)
- **Acceptance Criteria**: `AC-REL-01`, `AC-REL-02`, `AC-SEC-01`
- **E2E Scenario**: `S-001`, `S-009`
- **Implementation Target**: `src/domain/rules/ReleaseRules.ts`, `src/services/app/ReleaseService.ts`
- **Automated Test**: `src/domain/rules/ReleaseRules.test.ts`, `tests/unit/services/releaseService.test.ts`
- **Implementation Status**: `PARTIAL` (Specification đã chuẩn hóa 7 Gates; hiện trạng mã nguồn còn hardcode Gate 5 & Gate 6 chờ Step 2 tái cấu trúc)

### FRS-COA-001: Xuất Bản Báo Cáo CoA Độc Quyền Từ Snapshot

- **Mô tả**: Màn hình xem và in CoA (`SC-14`) chỉ đọc dữ liệu từ `batch.evaluationSnapshot`. Cấm mọi hành vi tính toán lại hoặc nội suy ở client. Tự động sinh footnote cho chỉ tiêu thay thế / miễn kiểm.
- **Business Rule**: `BR-COA-001`, `BR-COA-002`, `BR-ALT-004`
- **Domain Contract**: `COA_SNAPSHOT_CONTRACT.md`
- **Screen Contract**: `SC-14` (`SC_14_COA_REPORT_CONTRACT.md`)
- **Acceptance Criteria**: `AC-COA-01`, `AC-COA-02`, `AC-ALT-04`
- **E2E Scenario**: `S-001`, `S-013`
- **Implementation Target**: `src/services/app/CoAService.ts`, `src/components/features/CoAReport.tsx`
- **Automated Test**: `tests/unit/services/coaService.test.ts`, `tests/unit/components/coaReport.test.ts`
- **Implementation Status**: `PARTIAL` (Specification quy định cấm recalculate; hiện trạng `CoAReport.tsx` còn `useMemo` tính lại chờ Step 2 gỡ bỏ)

---

## 5. NHÓM CHỨC NĂNG SỰ CỐ CHẤT LƯỢNG & KIỂM TOÁN (OOS, CAPA, AUDIT)

### FRS-OOS-001: Quản lý Vòng đời Điều tra OOS 2 Giai đoạn

- **Mô tả**: Khi có chỉ tiêu FAIL, hệ thống tự động sinh hồ sơ OOS. Quy trình điều tra gồm Phase I (Phòng lab) và Phase II (Sản xuất). Khóa xuất xưởng lô cho đến khi OOS được đóng hợp lệ.
- **Business Rule**: `BR-OOS-001`, `BR-OOS-002`
- **Domain Contract**: `QMS_INCIDENT_CONTRACT.md`
- **Screen Contract**: `SC-15` (`SCREEN_CONTRACTS.md`)
- **Acceptance Criteria**: `AC-OOS-01`, `AC-OOS-02`
- **E2E Scenario**: `S-002`, `S-010`
- **Implementation Target**: `src/services/app/OOSService.ts`, Tuyến route `/oos`
- **Automated Test**: `tests/unit/services/oosCapaService.test.ts`
- **Implementation Status**: `PARTIAL` (Service cơ bản đã có, Route riêng `/oos` chưa có trên `App.tsx` chờ Step 2)

### FRS-CAP-001: Quản lý Hành động Khắc phục Phòng ngừa (CAPA)

- **Mô tả**: Quản lý vòng đời khép kín của các hành động CAPA phát sinh từ OOS/Deviation, phân công trách nhiệm, thời hạn và đánh giá hiệu quả sau 3-6 tháng.
- **Business Rule**: `BR-CAP-001`, `BR-CAP-002`
- **Domain Contract**: `QMS_INCIDENT_CONTRACT.md`
- **Screen Contract**: `SC-17` (`SCREEN_CONTRACTS.md`)
- **Acceptance Criteria**: `AC-CAP-01`, `AC-CAP-02`
- **E2E Scenario**: `S-012`
- **Implementation Target**: `src/services/app/CAPAService.ts`, Tuyến route `/capa`
- **Automated Test**: `tests/unit/services/oosCapaService.test.ts`
- **Implementation Status**: `PARTIAL` (Lưu nhúng trong Deviation, Route `/capa` chưa có trên `App.tsx` chờ Step 2)

### FRS-AUD-001: Nhật ký Kiểm toán ALCOA+ & Nối Chuỗi Mã Băm

- **Mô tả**: Mọi biến động dữ liệu quan trọng đều được ghi nhận vào nhật ký kiểm toán Append-Only, cấm sửa/xóa, có mã băm toàn vẹn SHA-256 nối chuỗi `previousHash`.
- **Business Rule**: `BR-AUD-001`, `BR-AUD-002`
- **Domain Contract**: `SIGNATURE_AUDIT_CONTRACT.md`
- **Screen Contract**: `SC-20` (`SCREEN_CONTRACTS.md`)
- **Acceptance Criteria**: `AC-AUD-01`, `AC-AUD-02`
- **E2E Scenario**: `S-014`
- **Implementation Target**: `src/services/auditService.ts`, `src/utils/hashChain.ts`
- **Automated Test**: `src/services/auditService.test.ts`
- **Implementation Status**: `PARTIAL` (`auditService.ts` đã có, `hashChain.ts` nối chuỗi là `NOT_IMPLEMENTED` chờ Step 2)
