# 🔒 SỔ ĐĂNG KÝ THẨM QUYỀN CHUẨN TẮC & ĐẶC TẢ NGHIỆP VỤ V2 (PQM CANONICAL AUTHORITY REGISTRY V2)

> **Mã định danh:** `PQM_CANONICAL_AUTHORITY_REGISTRY_V2.md`  
> **Phiên bản:** `2.0.0-PROD-CANONICAL`  
> **Trạng thái:** `ACTIVE` (Thay thế hoàn toàn V1)  
> **Nguyên tắc bất biến:**  
> **ONE BUSINESS RULE → ONE CANONICAL AUTHORITY → ONE SERVER SECURITY BOUNDARY → ONE WORKFLOW PATH → ONE AUDIT TRAIL → ONE TESTABLE SOURCE OF TRUTH.**  
> Tuyệt đối không cho phép 2 cơ quan thẩm quyền ngang nhau. Giao diện (Client) chỉ được Preview/Thu thập ý định. Máy chủ (Server Cloud Function/Firebase Security Rules) là Thẩm quyền Thực thi Bất biến (Server Security Boundary).

---

## 1. MÔ HÌNH PHÂN TẦNG KIẾN TRÚC CHUẨN TẮC (CANONICAL ARCHITECTURE MAP)

```
[ CLIENT / UI LAYER ]
  │
  ├─ User Intent & Inputs (No direct DB mutation to RELEASED)
  ├─ Client Preview: CanonicalReleaseEngine.evaluateReleaseEligibility(...) (ReadOnly in-RAM)
  └─ Command Dispatcher: IReleaseCommandPort (CloudFunctionsReleaseCommandAdapter)
         │
         ▼
[ SERVER SECURITY BOUNDARY / CLOUD FUNCTIONS ]
  │
  ├─ Callable Command: approveBatchRelease (HTTPS with Auth Context & Custom Claims)
  ├─ Idempotency Engine: /release_commands/{idempotencyKey} (PROCESSING -> COMPLETED/FAILED)
  ├─ Optimistic Concurrency Control (OCC): expectedVersion === batch.version
  ├─ Fresh DB Reads: /batches, /electronic_signatures, /testResults, /quality_deviations
  ├─ Domain Release Engine: @pqm/release-engine (7 Gates Fail-Closed + Canonical SHA-256 Checksum)
  ├─ Immutable Snapshot Builder: ALCOA+ Snapshot with Gates, Signer UID, Timestamp, Checksum
  └─ Atomic Transaction Commit:
         ├── /batches/{batchId}: status = 'RELEASED', version++, releaseSnapshot
         ├── /electronic_signatures/{signatureId}: status = 'CONSUMED'
         ├── /release_commands/{idempotencyKey}: status = 'COMPLETED'
         └── /audit_logs/{auditId}: append-only server audit record
```

---

## 2. BẢNG MA TRẬN ĐĂNG KÝ THẨM QUYỀN 19 PHÂN HỆ NGHIỆP VỤ (CAPABILITY REGISTRY)

### 1. Master Data (Danh mục Dữ liệu gốc)

- **RULE_ID:** `RULE-MD-001`
- **BUSINESS_RULE:** Dữ liệu danh mục chuẩn (đơn vị tính, chỉ tiêu kiểm nghiệm, phương pháp) chỉ được quản trị bởi ADMIN/QA, có bảo vệ toàn vẹn lịch sử.
- **CANONICAL_CODE:** `src/domains/master-data/` & `src/services/masterCriterionService.ts`
- **SERVER_AUTHORITY:** Firebase RTDB Rules chặn client không phải ADMIN/QA cập nhật danh mục gốc.
- **CLIENT_PREVIEW:** Giao diện tra cứu danh mục, dropdown filter, kiểm tra trùng lặp mã trước khi gửi.
- **FIREBASE_RULE:** `/masterCriteria: .read: auth != null, .write: isAdmin == true || role == 'ADMIN' || role == 'QA'`
- **TEST_SUITE:** `tests/unit/businessRules/masterCriterionRules.test.ts`
- **ACCEPTANCE_CRITERIA:** Chặn hoàn toàn Viewer/QC sửa đổi Master Data gốc.

### 2. Product (Hồ sơ Sản phẩm)

- **RULE_ID:** `RULE-PROD-002`
- **BUSINESS_RULE:** Mỗi sản phẩm phải có mã độc nhất (code), tên đăng ký, dạng bào chế và liên kết với ít nhất 1 TCCS hiệu lực.
- **CANONICAL_CODE:** `src/domains/product/` & `src/services/productService.ts`
- **SERVER_AUTHORITY:** Cloud Functions / RTDB validation chặn trùng mã và chặn xóa sản phẩm đã có Lô sản xuất.
- **CLIENT_PREVIEW:** Xem thông tin Product 360, kiểm tra tính đầy đủ hồ sơ trước khi lưu.
- **FIREBASE_RULE:** `/products: .read: auth != null, .write: role == 'ADMIN' || role == 'QA'`
- **TEST_SUITE:** `src/domain/canonical/model1Regression.test.ts`
- **ACCEPTANCE_CRITERIA:** Không cho phép tạo trùng product code; chặn xóa sản phẩm đã phát sinh Lô.

### 3. TCCS (Tiêu chuẩn Cơ sở)

- **RULE_ID:** `RULE-TCCS-003`
- **BUSINESS_RULE:** TCCS có phiên bản (version), ngày hiệu lực; chỉ có duy nhất 1 TCCS ACTIVE cho mỗi sản phẩm tại một thời điểm; TCCS đã phê duyệt không được sửa trực tiếp mà phải nâng version.
- **CANONICAL_CODE:** `src/domains/tccs/` & `src/domain/tccs/tccsLifecycle.ts`
- **SERVER_AUTHORITY:** RTDB Rules & Domain Handlers enforce status `DRAFT -> ACTIVE -> SUPERSEDED`.
- **CLIENT_PREVIEW:** Preview chỉ tiêu TCCS, so sánh phiên bản cũ/mới, kiểm tra tiêu chuẩn số/chữ.
- **FIREBASE_RULE:** `/tccs: .read: auth != null, .write: role == 'ADMIN' || role == 'QA'`
- **TEST_SUITE:** `tests/unit/businessRules/tccsRules.test.ts`
- **ACCEPTANCE_CRITERIA:** Không thể active đồng thời 2 TCCS cho cùng 1 sản phẩm; TCCS cũ tự động sang SUPERSEDED.

### 4. Formula (Công thức Sản xuất)

- **RULE_ID:** `RULE-FORM-004`
- **BUSINESS_RULE:** Công thức sản xuất phải liệt kê chính xác các nguyên liệu, tỷ lệ %, tổng định mức = 100% (hoặc đúng cỡ lô lý thuyết), ràng buộc với Product.
- **CANONICAL_CODE:** `src/domains/formula/` & `src/services/formulaService.ts`
- **SERVER_AUTHORITY:** RTDB write validation đảm bảo tính toàn vẹn công thức, snapshot được nhúng vào Lô khi khởi tạo.
- **CLIENT_PREVIEW:** Tính toán tổng tỷ lệ thành phần, cân bằng khối lượng tức thời trong RAM.
- **FIREBASE_RULE:** `/formulas: .read: auth != null, .write: role == 'ADMIN' || role == 'QA'`
- **TEST_SUITE:** `src/domain/canonical/model2Regression.test.ts`
- **ACCEPTANCE_CRITERIA:** Chặn lưu công thức có nguyên liệu trùng lặp hoặc tỷ lệ không hợp lệ.

### 5. Raw Material (Nguyên phụ liệu)

- **RULE_ID:** `RULE-MAT-005`
- **BUSINESS_RULE:** Nguyên liệu phải có mã nguyên liệu, số lô nhà sản xuất, hạn dùng, trạng thái kiểm nghiệm trước khi cấp phát vào sản xuất.
- **CANONICAL_CODE:** `src/domains/material/` & `src/services/materialService.ts`
- **SERVER_AUTHORITY:** RTDB Rules kiểm soát quyền nhập và cập nhật trạng thái nguyên liệu (LAB/QC/QA).
- **CLIENT_PREVIEW:** Cảnh báo nguyên liệu cận hạn, hiển thị trạng thái đạt chuẩn.
- **FIREBASE_RULE:** `/materials: .read: auth != null, .write: auth != null`
- **TEST_SUITE:** `src/pages/products/materials/hooks/useMaterialListState.test.ts`
- **ACCEPTANCE_CRITERIA:** Chặn cấp phát nguyên liệu chưa qua kiểm nghiệm hoặc bị REJECTED.

### 6. Batch (Lô Sản xuất)

- **RULE_ID:** `RULE-BATCH-006`
- **BUSINESS_RULE:** Vòng đời Lô: `PENDING -> TESTING -> RELEASED | REJECTED | BLOCKED`. Khởi tạo luôn ở `PENDING` và đóng băng Snapshot TCCS + Công thức. Bảo vệ OCC bằng `version`.
- **CANONICAL_CODE:** `src/domains/batch/` & `src/domain/workflow/stateMachine.ts`
- **SERVER_AUTHORITY:** RTDB Rules chặn client tự chuyển `status = 'RELEASED'`. Chặn nhảy cóc trạng thái ngoài FSM.
- **CLIENT_PREVIEW:** State Machine visualization, cảnh báo phiên bản cũ (OCC), hiển thị tiến độ 7 Gates.
- **FIREBASE_RULE:** `/batches/$batch_id: .write: auth != null && newData.child('status').val() !== 'RELEASED'`
- **TEST_SUITE:** `tests/domain/batchWorkflowRegression.test.ts`, `src/services/app/BatchAppService.test.ts`
- **ACCEPTANCE_CRITERIA:** Chặn 100% mọi nỗ lực của Client nhằm ghi trực tiếp trạng thái `RELEASED`.

### 7. Test Result (Phiếu Kiểm nghiệm)

- **RULE_ID:** `RULE-TR-007`
- **BUSINESS_RULE:** Phiếu kiểm nghiệm ghi nhận kết quả từng chỉ tiêu, tính toán đạt/không đạt theo TCCS, chuyển trạng thái: `DRAFT -> SUBMITTED -> APPROVED -> SUPERSEDED`.
- **CANONICAL_CODE:** `src/domains/test-result/` & `src/domain/test-result/testResultWorkflow.ts`
- **SERVER_AUTHORITY:** RTDB Rules & Workflow Handlers: Chặn chỉnh sửa phiếu đã `APPROVED` mà không qua thủ tục Revoke có lý do.
- **CLIENT_PREVIEW:** Đánh giá tức thời đạt/không đạt của từng chỉ tiêu theo ngưỡng Min/Max của TCCS.
- **FIREBASE_RULE:** `/testResults/$tr_id: .read: auth != null, .write: auth != null`
- **TEST_SUITE:** `src/domains/test-result/tests/testResultDomain.test.ts`, `tests/domain/testResultWorkflowRegression.test.ts`
- **ACCEPTANCE_CRITERIA:** Phiếu đã duyệt không thể xóa hoặc sửa đè; sửa đổi phải sinh phiên bản mới với chữ ký thu hồi.

### 8. Quality Evaluation (Đánh giá Chất lượng)

- **RULE_ID:** `RULE-QE-008`
- **BUSINESS_RULE:** Quyết định chất lượng tổng thể của Lô là hàm thuần túy tất định (Deterministic Resolver) dựa trên tập hợp phiếu kiểm nghiệm hiệu lực: Chỉ đạt `PASS` khi 100% chỉ tiêu yêu cầu đạt chuẩn.
- **CANONICAL_CODE:** `src/domain/batch/canonicalBatchQualityDecision.ts`
- **SERVER_AUTHORITY:** Cloud Function Release Command đọc trực tiếp và thẩm định lại toàn bộ test results.
- **CLIENT_PREVIEW:** Hiển thị Canonical Quality Decision badge, danh sách chỉ tiêu còn thiếu hoặc vi phạm.
- **FIREBASE_RULE:** Không lưu trường chất lượng thô có thể thao túng; thẩm định động.
- **TEST_SUITE:** `tests/domain/batchWorkflowRegression.test.ts`
- **ACCEPTANCE_CRITERIA:** Dù chỉ 1 chỉ tiêu FAIL hoặc chưa thử, hệ thống lập tức đánh giá chất lượng là FAIL/PENDING, cấm xuất xưởng.

### 9. OOS (Xử lý Kết quả Ngoài Tiêu chuẩn)

- **RULE_ID:** `RULE-OOS-009`
- **BUSINESS_RULE:** Khi bất kỳ chỉ tiêu kiểm nghiệm nào ngoài tiêu chuẩn, tự động kích hoạt điều tra OOS. Lô có OOS mở bị khóa Gate 3 không được xuất xưởng.
- **CANONICAL_CODE:** `src/domains/oos/` & `packages/release-engine/src/gates.ts` (Gate 3)
- **SERVER_AUTHORITY:** Server Release Command kiểm tra trực tiếp danh sách OOS đang mở liên quan tới BatchId.
- **CLIENT_PREVIEW:** Cảnh báo OOS Investigation Modal, hiển thị Gate 3 FAIL với mã `ERR_OPEN_OOS_EXISTS`.
- **FIREBASE_RULE:** `/quality_deviations: .read: auth != null, .write: auth != null`
- **TEST_SUITE:** `src/domains/oos/tests/oosDomain.test.ts`
- **ACCEPTANCE_CRITERIA:** Không thể xuất xưởng bất kỳ Lô nào nếu có OOS đang trong trạng thái mở/đang điều tra.

### 10. Deviation (Sai lệch Chất lượng)

- **RULE_ID:** `RULE-DEV-010`
- **BUSINESS_RULE:** Mọi sai lệch sản xuất/kiểm nghiệm được phân loại: `MINOR`, `MAJOR`, `CRITICAL`. Sai lệch Major/Critical bắt buộc phải có CAPA và giải trình trước khi đóng.
- **CANONICAL_CODE:** `src/domains/deviation/` & `packages/release-engine/src/gates.ts` (Gate 4)
- **SERVER_AUTHORITY:** Server Release Command quét Gate 4: Chặn xuất xưởng nếu tồn tại sai lệch Critical chưa đóng.
- **CLIENT_PREVIEW:** Cảnh báo hồ sơ sai lệch, tiến độ điều tra nguyên nhân gốc rễ (RCA).
- **FIREBASE_RULE:** `/quality_deviations: .read: auth != null, .write: auth != null`
- **TEST_SUITE:** `src/domains/deviation/tests/deviationDomain.test.ts`
- **ACCEPTANCE_CRITERIA:** Bất kỳ sai lệch nghiêm trọng nào chưa được QA phê duyệt đóng sẽ chặn Gate 4 (`ERR_OPEN_CRITICAL_DEVIATION`).

### 11. CAPA (Hành động Khắc phục & Phòng ngừa)

- **RULE_ID:** `RULE-CAPA-011`
- **BUSINESS_RULE:** CAPA phát sinh từ OOS hoặc Sai lệch nghiêm trọng phải hoàn thành và được QA thẩm tra hiệu quả trước khi lô liên quan được xuất xưởng (Gate 5).
- **CANONICAL_CODE:** `src/domains/capa/` & `packages/release-engine/src/gates.ts` (Gate 5)
- **SERVER_AUTHORITY:** Server Release Command kiểm tra trạng thái toàn bộ CAPA của Lô.
- **CLIENT_PREVIEW:** Hiển thị Gate 5, danh mục hành động CAPA và hạn hoàn thành.
- **FIREBASE_RULE:** `/capa: .read: auth != null, .write: auth != null`
- **TEST_SUITE:** `src/domains/capa/tests/capaDomain.test.ts`
- **ACCEPTANCE_CRITERIA:** Lô bị chặn Gate 5 nếu CAPA bắt buộc chưa hoàn thành (`ERR_CAPA_NOT_FULFILLED`).

### 12. Approval & BPR Review (Phê duyệt Hồ sơ Lô)

- **RULE_ID:** `RULE-BPR-012`
- **BUSINESS_RULE:** Hồ sơ sản xuất điện tử (BPR) phải trải qua quy trình: `SUBMITTED -> UNDER_REVIEW -> APPROVED`. QA là người duy nhất có thẩm quyền phê duyệt BPR (Gate 6).
- **CANONICAL_CODE:** `src/workflow/handlers/batchWorkflowHandlers.ts` & `packages/release-engine/src/gates.ts` (Gate 6)
- **SERVER_AUTHORITY:** Server Release Command kiểm tra `batch.bprReviewStatus === 'APPROVED'` từ DB tươi.
- **CLIENT_PREVIEW:** Nút duyệt BPR chỉ hiển thị cho QA; hiển thị Gate 6 xanh khi BPR đã duyệt.
- **FIREBASE_RULE:** `/batches/$batch_id/bprReviewStatus: .write: root.child('users').child(auth.uid).child('role').val() === 'QA' || root.child('users').child(auth.uid).child('role').val() === 'ADMIN'`
- **TEST_SUITE:** `tests/workflow/phase2VerticalSlices.test.ts` (Gate 6 tests)
- **ACCEPTANCE_CRITERIA:** Chặn xuất xưởng nếu BPR chưa được QA duyệt (`ERR_BPR_NOT_APPROVED`).

### 13. Batch Release (Xuất xưởng Lô sản phẩm)

- **RULE_ID:** `RULE-REL-013`
- **BUSINESS_RULE:** Thẩm quyền độc tôn thuộc về Server Cloud Function `approveBatchRelease`. Yêu cầu: Đủ 7 Gates, chữ ký số chuẩn SHA-256, đúng role QA/ADMIN, kiểm soát phiên bản OCC, Idempotency khóa giao dịch, đóng băng Snapshot ALCOA+.
- **CANONICAL_CODE:** `functions/src/releaseFunction.ts` & `packages/release-engine/`
- **SERVER_AUTHORITY:** Cloud Function `approveBatchRelease` thực thi Multi-path Atomic Transaction. Client không thể trực tiếp ghi DB.
- **CLIENT_PREVIEW:** `CanonicalReleaseEngine.evaluateReleaseEligibility(...)` hiển thị trước 7 cổng kiểm soát trong RAM.
- **FIREBASE_RULE:** `/batches/$batch_id: .write: newData.child('status').val() !== 'RELEASED'`, `/release_commands: .write: false`
- **TEST_SUITE:** `tests/hardening/p0p1ClosureAudit.test.ts`, `tests/workflow/phase2VerticalSlices.test.ts`
- **ACCEPTANCE_CRITERIA:** Không một client nào có thể release mà không đi qua Cloud Function với đầy đủ 7 Gates và SHA-256 exact match.

### 14. CoA (Phiếu Kiểm nghiệm Xuất xưởng / Certificate of Analysis)

- **RULE_ID:** `RULE-COA-014`
- **BUSINESS_RULE:** CoA chỉ được phát hành cho Lô đã ở trạng thái `RELEASED`. Nội dung CoA trích xuất từ dữ liệu Snapshot bất biến của Lô, không bị ảnh hưởng bởi thay đổi Master Data sau này.
- **CANONICAL_CODE:** `src/pages/quality/coa/` & `src/utils/reportHelpers.ts`
- **SERVER_AUTHORITY:** Server ngăn chặn cấp CoA cho Lô chưa RELEASED hoặc đang bị RECALL.
- **CLIENT_PREVIEW:** Xem trước bản in CoA, mã QR tra cứu tính toàn vẹn tài liệu.
- **FIREBASE_RULE:** `/coa_records: .read: auth != null, .write: role == 'QA' || role == 'ADMIN'`
- **TEST_SUITE:** `src/pages/quality/summary-report/utils/reportHelpers.test.ts`
- **ACCEPTANCE_CRITERIA:** Không thể in hoặc tạo CoA hợp lệ nếu Lô chưa ở trạng thái RELEASED.

### 15. E-Signature (Chữ ký Điện tử 21 CFR Part 11)

- **RULE_ID:** `RULE-SIG-015`
- **BUSINESS_RULE:** Chữ ký điện tử tuân thủ FDA 21 CFR Part 11: Bắt buộc xác thực lại (Reauthentication), định danh Signer UID, Email, Role, Ý nghĩa ký, Thời điểm ký. Mã băm SHA-256 tính toán chuẩn NIST toàn bộ payload. Vòng đời: `CREATED -> CONSUMED | REVOKED | REJECTED | SUPERSEDED`.
- **CANONICAL_CODE:** `packages/release-engine/src/checksum.ts`, `packages/release-engine/src/lifecycle.ts`, `src/services/signatureService.ts`
- **SERVER_AUTHORITY:** Server kiểm tra exact-match `storedChecksum === computedChecksum`. Client không được tự chuyển `CONSUMED`.
- **CLIENT_PREVIEW:** Modal xác thực mật khẩu, xem thông tin tóm tắt trước khi ký số.
- **FIREBASE_RULE:** `/electronic_signatures/$sig_id: .write: !data.exists() && newData.child('status').val() === 'CREATED'` (Cấm client update)
- **TEST_SUITE:** `src/services/signatureService.test.ts`, `tests/helpers/canonicalTestSignature.ts`
- **ACCEPTANCE_CRITERIA:** Bất kỳ sai lệch dù 1 ký tự trong payload ký đều bị Server từ chối (`ERR_SIGNATURE_TAMPERED`).

### 16. Audit Log (Nhật ký Kiểm toán ALCOA+)

- **RULE_ID:** `RULE-AUD-016`
- **BUSINESS_RULE:** Mọi giao dịch thay đổi trạng thái nghiệp vụ bắt buộc phải ghi nhận Audit Log bất biến: `eventId`, `timestamp`, `actorUid`, `actorRole`, `action`, `entityType`, `entityId`, `previousState`, `newState`, `reason`, `correlationId`, `commandId`.
- **CANONICAL_CODE:** `functions/src/releaseFunction.ts`, `src/workflow/events/outboxAuditQueue.ts`, `src/services/auditService.ts`
- **SERVER_AUTHORITY:** `/audit_logs` có `.write: false` trên client; chỉ Firebase Admin SDK máy chủ được phép ghi (Server-Only Append-Only).
- **CLIENT_PREVIEW:** Màn hình tra cứu Audit Trail dành cho QA/Admin, bộ lọc theo thời gian, actor, entity.
- **FIREBASE_RULE:** `/audit_logs: .read: QA/QC/Admin, .write: false` (Server-Only Append-Only)
- **TEST_SUITE:** `src/services/rulesAudit.test.ts`, `src/services/auditService.test.ts`
- **ACCEPTANCE_CRITERIA:** Client không thể giả mạo, sửa đổi hoặc xóa bất kỳ dòng audit log nào.

### 17. Genealogy (Phả hệ Dữ liệu & Khối Lô)

- **RULE_ID:** `RULE-GEN-017`
- **BUSINESS_RULE:** Cho phép truy xuất nguồn gốc hai chiều (Forward/Backward Traceability): Từ nguyên liệu đầu vào -> Lô thành phẩm -> Phiếu kiểm nghiệm -> Khách hàng/CoA.
- **CANONICAL_CODE:** `src/services/batchGenealogyService.ts` & `src/pages/batches/batch-360/`
- **SERVER_AUTHORITY:** Đọc các liên kết quan hệ nhất quán dựa trên ID và snapshot.
- **CLIENT_PREVIEW:** Đồ thị quan hệ cây phả hệ, cảnh báo đứt gãy liên kết dữ liệu.
- **FIREBASE_RULE:** Read-only access qua các collection liên quan.
- **TEST_SUITE:** `tests/integration/evaluationSnapshotWorkflow.test.ts`
- **ACCEPTANCE_CRITERIA:** Truy vết tức thời lịch sử sản xuất của bất kỳ Lô nào trong vòng dưới 1 giây.

### 18. Reporting & SPC (Báo cáo & Kiểm soát Quá trình Thống kê)

- **RULE_ID:** `RULE-REP-018`
- **BUSINESS_RULE:** Báo cáo chất lượng định kỳ (PQR) và biểu đồ kiểm soát SPC tuân thủ 8 quy tắc Nelson, tính toán năng lực quá trình (Cp, Cpk).
- **CANONICAL_CODE:** `functions/src/spcFunction.ts`, `functions/src/reportFunction.ts`, `src/utils/spcEngine.ts`
- **SERVER_AUTHORITY:** Cloud Function `calculateSPCMetrics` và `generateQualityReport` tính toán tập trung trên Server.
- **CLIENT_PREVIEW:** Biểu đồ xu hướng, đường giới hạn UCL/LCL/CL trong giao diện Trend Analysis.
- **FIREBASE_RULE:** Storage rules bảo vệ file Excel báo cáo xuất xưởng.
- **TEST_SUITE:** `src/utils/spcEngine.test.ts`, `src/pages/quality/trend/utils/spcHelpers.test.ts`
- **ACCEPTANCE_CRITERIA:** Đảm bảo kết quả tính toán SPC trên máy tính của người dùng và máy chủ khớp chính xác 100%.

### 19. AI Assistant & Governance (Trí tuệ Nhân tạo & Quản trị AI)

- **RULE_ID:** `RULE-AI-019`
- **BUSINESS_RULE:** AI chỉ giữ vai trò Khuyến nghị & Cố vấn (Advisory Only). AI tuyệt đối không có quyền tự động quyết định trạng thái, ký duyệt hay ghi đè dữ liệu nghiệp vụ nếu không có thao tác xác nhận tường minh của người dùng có thẩm quyền.
- **CANONICAL_CODE:** `src/domains/ai/`, `src/services/ai/aiActionGuard.ts`, `src/services/ai/aiDraftManager.ts`
- **SERVER_AUTHORITY:** Toàn bộ API calls AI đi qua rào chắn xác thực, kiểm soát context bảo mật thông tin (không lộ credentials).
- **CLIENT_PREVIEW:** Khung trò chuyện trợ lý AI, bản thảo đề xuất được lưu tạm trong `sessionStorage`.
- **FIREBASE_RULE:** AI không có tài khoản riêng hay quyền write trực tiếp vào database.
- **TEST_SUITE:** `src/domains/ai/tests/aiDomain.test.ts`, `src/services/ai/aiActionGuard.test.ts`
- **ACCEPTANCE_CRITERIA:** Không một đề xuất nào của AI có thể tự động chuyển trạng thái thực thể nếu không có chữ ký của người dùng có thẩm quyền.

---

## 3. QUY TẮC BẢO TOÀN KIẾN TRÚC & CHỐNG TRÔI DẠT (GOVERNANCE ENFORCEMENT)

1. **Kiểm tra hồi quy tự động (Automated Governance Test):**
   Mọi thay đổi cấu trúc mã nguồn phải được kiểm tra qua `tests/architecture/governanceDrift.test.ts` và `tests/architecture/noDuplicateAuthority.test.ts`.
2. **Không bypass Firebase Rules:**
   Không được cấp quyền ghi cho client đối với các thực thể nhạy cảm đã chuyển giao cho Server (như `audit_logs`, `release_commands`, và `batches` ở trạng thái `RELEASED`).
3. **Mã băm chữ ký điện tử duy nhất:**
   Chỉ chấp nhận thuật toán SHA-256 chuẩn NIST. Xóa bỏ hoàn toàn mọi cơ chế fallback, mã băm thô hoặc mock hash.
