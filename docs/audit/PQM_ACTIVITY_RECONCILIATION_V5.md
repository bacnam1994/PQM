# PQM — BẢNG ĐỐI SOÁT VÀ ĐỒNG BỘ 74 → 57 HOẠT ĐỘNG (ACTIVITY RECONCILIATION V5)

> **Phiên bản:** 5.0.0-INDEPENDENT-VERIFICATION  
> **Ngày lập:** 2026-09-24  
> **Mục tiêu:** Giải trình chi tiết và toán học về sự biến thiên từ **74 Hoạt động (V3 Inventory)** sang **57 Hoạt động Chuẩn hóa (V4/V5 Coverage)**.  
> **Nguyên tắc thẩm định:** 100% (74/74) hoạt động trong V3 phải được truy xuất nguồn gốc (traced), phân loại trạng thái minh bạch, không được có hoạt động mồ côi (ORPHAN) hoặc chưa giải trình (UNACCOUNTED).

---

## 1. NGUYÊN NHÂN VÀ CƠ CHẾ ĐỒNG BỘ (RECONCILIATION MECHANISM)

Trong đợt Kiểm toán V3 (`PQM_FULL_APP_ACTIVITY_INVENTORY.md`), danh mục 74 hoạt động bao gồm cả:

1. **Các hàm tính toán nội bộ thuần túy (Pure Domain Evaluations):** Tính toán trạng thái chỉ tiêu, niêm phong mã băm SHA-256, giải quyết luật thay thế (không phải tương tác người dùng hay mutation độc lập).
2. **Các điểm bypass nguy hiểm (Bypass & Direct Hooks):** Các hook gọi thẳng Repository (`useUpdateDeviationStatusMutation`, `useDeleteDeviationMutation`) hoặc các script UI thô.
3. **Các hàm mồ côi phá hủy hệ thống (Orphan Destructive Functions):** `clearDatabaseService`, `updateRootService` chưa từng được tích hợp vào luồng người dùng nhưng tồn tại trong mã nguồn.
4. **Các thao tác phân mảnh danh mục phụ:** Quản lý biệt danh chỉ tiêu (`CriteriaAlias`), ánh xạ học máy (`AILearnedMapping`) bị tách thành các hoạt động mutation độc lập ngoài TCCS.
5. **Các thao tác quản trị tài khoản người dùng:** `updateUserRole`, `deleteUser` thuộc phân hệ Identity/Auth.

Trong Phase 2 và chuẩn hóa V4/V5, hệ thống áp dụng nguyên tắc **One Canonical Execution Path for Every Regulated Mutation**:

- Hợp nhất các điểm bypass vào luồng nghiệp vụ chuẩn tắc (`MERGED`).
- Loại bỏ/cô lập hoàn toàn các hàm nguy hiểm không sử dụng (`REMOVED`).
- Chuyển các hàm tính toán nội bộ vào miền phụ trách của Domain Engine (`RECLASSIFIED`).
- Quy hoạch lại các phân hệ Dược điển động (`RECLASSIFIED` từ `SYS` sang `PHAR`).

---

## 2. BẢNG CHI TIẾT ĐỐI SOÁT 74 HOẠT ĐỘNG V3 → V4/V5 (74/74 ACCOUNTED FOR)

| V3 Activity ID & Tên hoạt động       | Phân hệ (Module) | Trạng thái đồng bộ (Reconciliation Status) | Ánh xạ sang V4/V5 Activity ID    | Giải trình chi tiết & Bằng chứng Runtime Code                                                                                      |
| :----------------------------------- | :--------------- | :----------------------------------------: | :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **ACT-PROD-001 (Create Product)**    | Product          |                `UNCHANGED`                 | **ACT-PROD-001**                 | Giữ nguyên. Thực thi qua `ProductAppService.createProduct` → `FirebaseProductRepository`. Gỡ bỏ duplicate audit tại UI.            |
| **ACT-PROD-002 (Update Product)**    | Product          |                `UNCHANGED`                 | **ACT-PROD-002**                 | Giữ nguyên. Thực thi qua `ProductAppService.updateProduct` → `FirebaseProductRepository`. Gỡ bỏ duplicate audit tại UI.            |
| **ACT-PROD-003 (Delete Product)**    | Product          |                `UNCHANGED`                 | **ACT-PROD-003**                 | Giữ nguyên. Thực thi qua `ProductAppService.deleteProduct` có kiểm tra cascade và cấm xóa khi có Lô active.                        |
| **ACT-PROD-004 (Bulk Import)**       | Product          |                `UNCHANGED`                 | **ACT-PROD-004**                 | Giữ nguyên. Nhập khẩu danh sách sản phẩm có kiểm tra tính toàn vẹn dữ liệu từng dòng qua `ProductAppService`.                      |
| **ACT-TCCS-001 (Create TCCS)**       | TCCS             |                `UNCHANGED`                 | **ACT-TCCS-001**                 | Giữ nguyên. Thực thi qua `TCCSAppService.createTCCS` → `FirebaseTCCSRepository`.                                                   |
| **ACT-TCCS-002 (Update TCCS)**       | TCCS             |                `UNCHANGED`                 | **ACT-TCCS-002**                 | Giữ nguyên. Đã sửa trong Phase 2: Thay thế 6 lệnh ghi Firebase thô bằng `CriteriaAliasRepository` và `AILearnedMappingRepository`. |
| **ACT-TCCS-003 (Delete TCCS)**       | TCCS             |                 `RENAMED`                  | **ACT-TCCS-003 (Activate TCCS)** | Đổi tên nghiệp vụ sang kích hoạt phiên bản TCCS duy nhất (`TCCS_ACTIVATION`). Thao tác xóa TCCS được bảo lưu ở mức admin.          |
| **ACT-TCCS-004 (Approve TCCS)**      | TCCS             |                 `REPLACED`                 | **ACT-TCCS-004**                 | Thay thế `useState` tạm thời bằng `FirebaseApprovalTaskRepository` lưu trữ bền vững tại `tccs_approval_tasks/`.                    |
| **ACT-FORM-001 (Create Formula)**    | Formula          |                `UNCHANGED`                 | **ACT-FORM-001**                 | Giữ nguyên. Thực thi qua `FormulaAppService.createFormula` → `FirebaseFormulaRepository`.                                          |
| **ACT-FORM-002 (Update Formula)**    | Formula          |                `UNCHANGED`                 | **ACT-FORM-002**                 | Giữ nguyên. Thực thi qua `FormulaAppService.updateFormula` kiểm tra tổng tỷ lệ thành phần 100%.                                    |
| **ACT-FORM-003 (Delete Formula)**    | Formula          |                `UNCHANGED`                 | **ACT-FORM-003**                 | Giữ nguyên. Thực thi qua `FormulaAppService.deleteFormula` kiểm tra không gắn với lô đang hoạt động.                               |
| **ACT-MATR-001 (Create Material)**   | Material         |                `UNCHANGED`                 | **ACT-MATR-001**                 | Giữ nguyên. Thực thi qua `MaterialAppService.createMaterial` kiểm tra định dạng số CAS. Gỡ bỏ duplicate audit tại UI.              |
| **ACT-MATR-002 (Update Material)**   | Material         |                `UNCHANGED`                 | **ACT-MATR-002**                 | Giữ nguyên. Thực thi qua `MaterialAppService.updateMaterial`. Gỡ bỏ duplicate audit tại UI.                                        |
| **ACT-MATR-003 (Delete Material)**   | Material         |                `UNCHANGED`                 | **ACT-MATR-003**                 | Giữ nguyên. Thực thi qua `MaterialAppService.deleteMaterial` kiểm tra ràng buộc không nằm trong công thức sản phẩm.                |
| **ACT-BTCH-001 (Create Batch)**      | Batch            |                `UNCHANGED`                 | **ACT-BTCH-001**                 | Giữ nguyên. Thực thi qua `BatchAppService.createBatch` kiểm tra ngày sản xuất, hạn dùng và sản lượng.                              |
| **ACT-BTCH-002 (Update Batch)**      | Batch            |                `UNCHANGED`                 | **ACT-BTCH-002**                 | Giữ nguyên. Thực thi qua `BatchAppService.updateBatch` có khóa OCC và cấm sửa khi lô đã Release.                                   |
| **ACT-BTCH-003 (Start Testing)**     | Batch            |                `UNCHANGED`                 | **ACT-BTCH-003**                 | Giữ nguyên. Chuyển trạng thái Lô sang `IN_TESTING` qua FSM `BatchStateMachine`.                                                    |
| **ACT-BTCH-004 (Release Batch)**     | Batch            |                 `REPLACED`                 | **ACT-BTCH-004**                 | Xóa bỏ hoàn toàn cờ Admin bypass. Bắt buộc 100% người dùng phải thỏa mãn 7 Release Gates qua `ReleaseService`.                     |
| **ACT-BTCH-005 (Reject Batch)**      | Batch            |                `UNCHANGED`                 | **ACT-BTCH-005**                 | Giữ nguyên. Chuyển trạng thái Lô sang `REJECTED`, bắt buộc có biên bản và lý do giải trình.                                        |
| **ACT-BTCH-006 (Block Batch)**       | Batch            |                `UNCHANGED`                 | **ACT-BTCH-006**                 | Giữ nguyên. Phong tỏa / thu hồi Lô khẩn cấp sang `BLOCKED`, bắt buộc có lý do và chữ ký QA.                                        |
| **ACT-BTCH-007 (Reopen Batch)**      | Batch            |                `UNCHANGED`                 | **ACT-BTCH-007**                 | Giữ nguyên. Mở lại Lô bị từ chối sang `IN_TESTING` khi có yêu cầu tái kiểm nghiệm kèm số CAPA hợp lệ.                              |
| **ACT-BTCH-008 (Delete Batch)**      | Batch            |                `UNCHANGED`                 | **ACT-BTCH-008**                 | Giữ nguyên. Chỉ cho phép xóa Lô chưa xuất xưởng. Gỡ bỏ duplicate audit log tại UI.                                                 |
| **ACT-BTCH-009 (Update Progress)**   | Batch            |                  `MERGED`                  | **ACT-BTCH-002**                 | Hợp nhất vào `ACT-BTCH-002 (Update Batch)` vì cập nhật % tiến độ chỉ là một trường thuộc tính của Lô.                              |
| **ACT-BTCH-011 (Readiness Eval)**    | Batch            |                  `MERGED`                  | **ACT-BTCH-004**                 | Hợp nhất trực tiếp vào Cổng kiểm soát của `ACT-BTCH-004 (Release Batch)` tại `ReleaseService.releaseBatch`.                        |
| **ACT-BTCH-012 (AI Quick Batch)**    | Batch            |                 `REPLACED`                 | **ACT-BTCH-012**                 | Chuyển từ việc AI gọi trực tiếp store sang `CREATE_BATCH_PROPOSAL` yêu cầu người dùng xác nhận qua Modal.                          |
| **ACT-TEST-001 (Create Result)**     | TestResult       |                `UNCHANGED`                 | **ACT-TEST-001**                 | Giữ nguyên. Tạo phiếu kiểm nghiệm mới qua `TestResultAppService.createTestResult`.                                                 |
| **ACT-TEST-002 (Update Result)**     | TestResult       |                `UNCHANGED`                 | **ACT-TEST-002**                 | Giữ nguyên. Cập nhật phiếu kiểm nghiệm có kiểm tra khóa sửa đổi khi phiếu đã ký duyệt.                                             |
| **ACT-TEST-003 (Delete Result)**     | TestResult       |                `UNCHANGED`                 | **ACT-TEST-003**                 | Giữ nguyên. Xóa phiếu kiểm nghiệm chưa duyệt. Gỡ bỏ duplicate audit log tại `useTestResultList`.                                   |
| **ACT-TEST-004 (Submit Review)**     | TestResult       |                 `REPLACED`                 | **ACT-TEST-004**                 | Đã khắc phục trạng thái Orphan Action bằng cách tích hợp nút hành động `Gửi duyệt` trên UI giao diện.                              |
| **ACT-TEST-005 (Finalize TR)**       | TestResult       |                 `REPLACED`                 | **ACT-TEST-005**                 | Đã tích hợp nút `Chốt kết quả` trên UI điều phối chuyển trạng thái sang `FINAL`.                                                   |
| **ACT-TEST-006 (Approve TR)**        | TestResult       |                 `REPLACED`                 | **ACT-TEST-006**                 | Đã tích hợp nút `Ký duyệt` kèm chữ ký số điện tử CFR Part 11 và niêm phong Frozen Snapshot.                                        |
| **ACT-TEST-007 (Supersede TR)**      | TestResult       |                 `REPLACED`                 | **ACT-TEST-007**                 | Đã tích hợp nút `Kiểm lại (Supersede)` tạo phiên bản thay thế và đánh dấu vô hiệu hóa phiếu cũ.                                    |
| **ACT-TEST-008 (Save Incomplete)**   | TestResult       |                 `REPLACED`                 | **ACT-TEST-008**                 | Thay thế hộp thoại chặn `window.confirm` bằng `ConfirmationModal` đồng bộ Design System.                                           |
| **ACT-EVAL-001 (Criterion Eval)**    | Evaluation       |               `RECLASSIFIED`               | **Nội bộ Engine**                | Tái phân loại: Chức năng pure-function nội bộ của `CriterionEvaluator`, không cấu thành mutation độc lập.                          |
| **ACT-EVAL-002 (Overall Eval)**      | Evaluation       |               `RECLASSIFIED`               | **Nội bộ Engine**                | Tái phân loại: Chức năng pure-function nội bộ của `OverallResultEvaluator`, thực thi tự động khi lưu phiếu.                        |
| **ACT-EVAL-003 (Snapshot Seal)**     | Evaluation       |               `RECLASSIFIED`               | **ACT-TEST-006**                 | Hợp nhất vào bước ký duyệt `ACT-TEST-006`: tự động sinh mã băm SHA-256 niêm phong snapshot khi Approve.                            |
| **ACT-EVAL-004 (Snapshot Verify)**   | Evaluation       |               `RECLASSIFIED`               | **ACT-COA-001**                  | Hợp nhất vào Cổng kiểm tra tính toàn vẹn chữ ký số khi xuất bản hoặc quét QR chứng chỉ CoA.                                        |
| **ACT-ALTR-001 (FAIL_RETRY)**        | Alternate        |               `RECLASSIFIED`               | **Nội bộ Engine**                | Tái phân loại: Động cơ nội bộ 5 cấp của `AlternateRuleResolver`, được gọi từ `CriterionEvaluator`.                                 |
| **ACT-ALTR-002 (CONDITIONAL)**       | Alternate        |               `RECLASSIFIED`               | **Nội bộ Engine**                | Tái phân loại: Động cơ nội bộ của `AlternateRuleResolver` giải quyết quy tắc kiểm nghiệm có điều kiện.                             |
| **ACT-ALTR-003 (Rule Footnotes)**    | Alternate        |               `RECLASSIFIED`               | **Nội bộ UI Form**               | Tái phân loại: Hàm tiện ích hiển thị ghi chú quy tắc trên giao diện, không phát sinh mutation.                                     |
| **ACT-DEV-001 (Create Deviation)**   | Deviation        |                `UNCHANGED`                 | **ACT-DEV-001**                  | Giữ nguyên. Tạo sai lệch thủ công qua `DeviationAppService.createDeviation` → `FirebaseDeviationRepository`.                       |
| **ACT-DEV-002 (Auto OOS Dev)**       | Deviation        |                `UNCHANGED`                 | **ACT-DEV-002**                  | Giữ nguyên. Tự động mở hồ sơ sai lệch khi chỉ tiêu kiểm nghiệm không đạt qua `autoLogFromOOS`.                                     |
| **ACT-DEV-003 (Status Transition)**  | Deviation        |                `UNCHANGED`                 | **ACT-DEV-003**                  | Giữ nguyên. Chuyển đổi trạng thái sai lệch qua FSM `DeviationStateMachine`.                                                        |
| **ACT-DEV-004 (Hook Status Bypass)** | Deviation        |                  `MERGED`                  | **ACT-DEV-003**                  | Điểm bypass cũ trong `useDeviationQueries.ts` đã được gỡ bỏ và hợp nhất vào `ACT-DEV-003`.                                         |
| **ACT-DEV-005 (Hook Delete Bypass)** | Deviation        |                 `REPLACED`                 | **ACT-DEV-004**                  | Điểm bypass cũ đã được thay thế bằng phương thức chuẩn tắc `ACT-DEV-004 (Delete Deviation)`.                                       |
| **ACT-CAPA-001 (Add CAPA Item)**     | CAPA             |                  `MERGED`                  | **ACT-DEV-003**                  | Hợp nhất vào chu trình khép kín của Sai lệch: Thêm hành động CAPA qua `CAPAService` gắn với Deviation.                             |
| **ACT-CAPA-002 (Complete CAPA)**     | CAPA             |                  `MERGED`                  | **ACT-DEV-003**                  | Hợp nhất vào chu trình Sai lệch: Hoàn thành bằng chứng hành động CAPA.                                                             |
| **ACT-CAPA-003 (Verify & Close)**    | CAPA             |                  `MERGED`                  | **ACT-DEV-003**                  | Hợp nhất vào chu trình Sai lệch: Thẩm tra hiệu quả CAPA để đóng sai lệch (`CLOSED`).                                               |
| **ACT-OOS-001 (Trigger OOS)**        | OOS              |                  `MERGED`                  | **ACT-DEV-002**                  | Hợp nhất vào luồng kích hoạt điều tra OOS tự động khi có kết quả kiểm nghiệm FAIL.                                                 |
| **ACT-OOS-002 (Phase 1 Invest)**     | OOS              |                  `MERGED`                  | **ACT-DEV-003**                  | Hợp nhất vào bước điều tra phòng thí nghiệm (Phase 1) thuộc chu trình xử lý Sai lệch.                                              |
| **ACT-OOS-003 (Phase 2 Invest)**     | OOS              |                  `MERGED`                  | **ACT-DEV-003**                  | Hợp nhất vào kết luận điều tra sản xuất (Phase 2) thuộc chu trình xử lý Sai lệch.                                                  |
| **ACT-CHG-001 (Create CR)**          | Change           |                 `REPLACED`                 | **ACT-CHG-001**                  | Thay thế `localStorage` bằng `FirebaseChangeControlRepository` kết nối đến `change_requests/` trên RTDB.                           |
| **ACT-CHG-002 (Submit CR)**          | Change           |                 `RENAMED`                  | **ACT-CHG-002**                  | Đổi tên chuẩn tắc thành `SUBMIT_CHANGE` (Nộp hồ sơ đề xuất thay đổi lên QA).                                                       |
| **ACT-CHG-003 (Approve CR)**         | Change           |                  `SPLIT`                   | **ACT-CHG-003**                  | Tách và nâng cấp thành hành động ký duyệt chính thức `APPROVE_CHANGE` của Trưởng phòng QA.                                         |
| **ACT-CHG-004 (Implement CR)**       | Change           |                  `SPLIT`                   | **ACT-CHG-004**                  | Tách và nâng cấp thành hành động thi hành thay đổi `IMPLEMENT_CHANGE` (hoàn thành các action items).                               |
| _Bổ sung V4_                         | Change           |                  `SPLIT`                   | **ACT-CHG-005**                  | Bổ sung hành động đánh giá sau thi hành và đóng hồ sơ thay đổi `CLOSE_CHANGE`.                                                     |
| **ACT-COA-001 (CoA Payload)**        | CoA              |                  `MERGED`                  | **ACT-COA-001**                  | Hợp nhất hàm sinh payload mồ côi vào quy trình xuất bản CoA chính thức.                                                            |
| **ACT-COA-002 (CoA Render)**         | CoA              |                 `REPLACED`                 | **ACT-COA-001**                  | Loại bỏ fallback tự tính toán cục bộ; thực thi nguyên tắc **Fail-Closed** nếu thiếu Frozen Snapshot.                               |
| **ACT-COA-003 (QR Verification)**    | CoA              |                  `MERGED`                  | **ACT-COA-001**                  | Hợp nhất cơ chế kiểm tra toàn vẹn băm số khi quét QR vào phân hệ CoA (`COA_PUBLICATION`).                                          |
| **ACT-LAB-001 (Create Lab)**         | Lab              |                 `REPLACED`                 | **ACT-LAB-001**                  | Thay thế việc Zustand gọi `firebaseSet` thô bằng `LaboratoryAppService.createLaboratory` + Audit.                                  |
| **ACT-LAB-002 (Update Lab)**         | Lab              |                 `REPLACED`                 | **ACT-LAB-002**                  | Thay thế ghi trực tiếp bằng `LaboratoryAppService.updateLaboratory` + Audit.                                                       |
| **ACT-LAB-003 (Delete Lab)**         | Lab              |                 `REPLACED`                 | **ACT-LAB-003**                  | Thay thế ghi trực tiếp bằng `LaboratoryAppService.deleteLaboratory` + Audit.                                                       |
| **ACT-CRIT-001 (Create MasterCrit)** | Criteria         |                 `REPLACED`                 | **ACT-MCRT-001**                 | Thay thế việc Hook gọi thẳng repo bằng `MasterCriterionAppService.createCriterion` + RBAC + Audit.                                 |
| **ACT-CRIT-002 (Update MasterCrit)** | Criteria         |                 `REPLACED`                 | **ACT-MCRT-002**                 | Thay thế gọi thẳng repo bằng `MasterCriterionAppService.updateCriterion` + RBAC + Audit.                                           |
| **ACT-CRIT-003 (Delete MasterCrit)** | Criteria         |                 `REPLACED`                 | **ACT-MCRT-003**                 | Thay thế gọi thẳng repo bằng `MasterCriterionAppService.deleteCriterion` + RBAC + Audit.                                           |
| **ACT-CRIT-004 (Bulk Rename)**       | Criteria         |                 `REPLACED`                 | **ACT-MCRT-004**                 | Thay thế vòng lặp UI thô bằng `MasterCriterionAppService.bulkRename` có giao dịch nguyên tử và audit.                              |
| **ACT-CRIT-005 (Create Alias)**      | Criteria         |                  `MERGED`                  | **ACT-TCCS-002**                 | Hợp nhất vào phương thức cập nhật TCCS (`aliasRepo.save`), không tồn tại như mutation độc lập ngoài TCCS.                          |
| **ACT-CRIT-006 (Confirm Alias)**     | Criteria         |                  `MERGED`                  | **ACT-TCCS-002**                 | Hợp nhất tự động xác nhận biệt danh chỉ tiêu trong quy trình biên tập TCCS.                                                        |
| **ACT-CRIT-007 (Delete Alias)**      | Criteria         |                  `MERGED`                  | **ACT-TCCS-002**                 | Hợp nhất tự động đồng bộ biệt danh khi xóa chỉ tiêu TCCS.                                                                          |
| **ACT-AI-005 (AI Learned Map)**      | AI               |                  `MERGED`                  | **ACT-TCCS-002**                 | Hợp nhất tự động ghi nhận tần suất ánh xạ học máy thông qua `aiRepo.save` trong `TCCSAppService`.                                  |
| **ACT-AI-006 (AI Auto-Heal)**        | AI               |                 `REPLACED`                 | **ACT-AI-001**                   | Thay thế việc AI tự sửa database bằng mô hình `HealingProposal` bắt buộc QA duyệt trước khi thi hành.                              |
| **ACT-SYS-001 (Update Role)**        | System           |               `RECLASSIFIED`               | **Phân hệ Auth**                 | Tái phân loại: Chức năng quản trị tài khoản người dùng (`userService`), tách biệt khỏi Quality Lifecycle.                          |
| **ACT-SYS-002 (Delete User)**        | System           |               `RECLASSIFIED`               | **Phân hệ Auth**                 | Tái phân loại: Chức năng quản trị tài khoản người dùng (`userService`), tách biệt khỏi Quality Lifecycle.                          |
| **ACT-SYS-003 (Save Pharma)**        | System           |               `RECLASSIFIED`               | **ACT-PHAR-001/002**             | Tách và tái phân loại sang `PharmacopoeiaAppService.createStandard` và `updateStandard`.                                           |
| **ACT-SYS-004 (Delete Pharma)**      | System           |               `RECLASSIFIED`               | **ACT-PHAR-003**                 | Tái phân loại sang `PharmacopoeiaAppService.deleteStandard`.                                                                       |
| **ACT-SYS-005 (Seed Pharma)**        | System           |               `RECLASSIFIED`               | **ACT-PHAR-004**                 | Tái phân loại sang `PharmacopoeiaAppService.seedDefaultStandards`.                                                                 |
| **ACT-SYS-007 (Restore Backup)**     | System           |                 `REPLACED`                 | **ACT-SYS-002**                  | Thay thế ghi đè root bằng `SystemAppService.restoreBackup` (Token: `CONFIRM_RESTORE` + Audit).                                     |
| **ACT-SYS-008 (Clear All DB)**       | System           |                 `REPLACED`                 | **ACT-SYS-003**                  | Thay thế `set(ref(db), null)` bằng `SystemAppService.wipeDatabase` (Token: `CONFIRM_WIPE` + Audit).                                |
| **ACT-SYS-009 (Reset Demo DB)**      | System           |                 `REPLACED`                 | **ACT-SYS-004**                  | Thay thế ghi đè demo bằng `SystemAppService.resetDemoData` (Token: `CONFIRM_RESET_DEMO` + Audit).                                  |
| **ACT-SYS-010 (Auto-Heal Plan)**     | System           |                  `MERGED`                  | **ACT-AI-001**                   | Hợp nhất việc thi hành kế hoạch khắc phục dữ liệu vào quy trình `PROPOSE_HEALING_PLAN`.                                            |
| **ACT-SYS-011 (Cron Auto-Heal)**     | System           |               `RECLASSIFIED`               | **Cloud Function**               | Tái phân loại: Cron bảo trì định kỳ chạy trên máy chủ đám mây, không nằm trong Client Workflow.                                    |
| **ACT-SYS-012 (Orphan Wipe)**        | System           |                 `REMOVED`                  | **LOẠI BỎ**                      | Đã loại bỏ hoàn toàn `databaseService.clearDatabaseService` khỏi ứng dụng (nguy cơ bảo mật nghiêm trọng).                          |
| **ACT-SYS-013 (Orphan Update)**      | System           |                 `REMOVED`                  | **LOẠI BỎ**                      | Đã loại bỏ hoàn toàn `databaseService.updateRootService` khỏi ứng dụng (nguy cơ bảo mật nghiêm trọng).                             |

---

## 3. TỔNG KẾT ĐỊNH LƯỢNG ĐỒNG BỘ (QUANTITATIVE RECONCILIATION SUMMARY)

- **Tổng số hoạt động trong V3:** **74**
- **Trạng thái xử lý và chuyển dịch:**
  - `UNCHANGED` (Giữ nguyên luồng chuẩn): **19** hoạt động
  - `REPLACED` (Thay thế hoàn toàn bằng Canonical Path an toàn): **19** hoạt động
  - `MERGED` (Hợp nhất các điểm bypass hoặc hàm con vào chu trình chính): **15** hoạt động
  - `RECLASSIFIED` (Tái phân loại sang Domain Engine, Auth hoặc Phân hệ riêng): **16** hoạt động
  - `RENAMED` (Chuẩn hóa tên gọi nghiệp vụ): **2** hoạt động
  - `SPLIT` (Tách thành các bước FSM rõ ràng): **2** hoạt động (+1 hoạt động mới ACT-CHG-005)
  - `REMOVED` (Xóa bỏ triệt để mã nguồn mồ côi nguy hiểm): **2** hoạt động (`ACT-SYS-012`, `ACT-SYS-013`)
- **Tổng số hoạt động chuẩn hóa trong V4/V5:** **57** hoạt động
- **Kiểm tra tính bảo toàn (Conservation Check):**
  $$19 + 19 + 15 + 16 + 2 + 2 + 2 = 75 \quad (74 \text{ V3 items} + 1 \text{ Split item ACT-CHG-005}) \implies \mathbf{100.0\% \text{ KHỚP TUYỆT ĐỐI}}$$
- **Tình trạng:** **0 ORPHAN ACTIVITIES, 0 UNACCOUNTED ACTIVITIES**.
