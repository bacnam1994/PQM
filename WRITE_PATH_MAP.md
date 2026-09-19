# ✍️ WRITE PATH MAP — BẢN ĐỒ CÁC ĐƯỜNG GHI DỮ LIỆU FIREBASE

> **Phiên bản:** 1.0.0-BASELINE  
> **Tổng số điểm ghi được phát hiện:** 38 điểm

---

## 1. DANH SÁCH TOÀN BỘ ĐƯỜNG GHI VÀO FIREBASE REALTIME DATABASE

|   TT   | Node Firebase RTDB            | Thao tác         | File thực hiện                 | Service / Repository      | Quyền hạn yêu cầu (RBAC)            | Rào chắn & Invariants                                                                            |
| :----: | :---------------------------- | :--------------- | :----------------------------- | :------------------------ | :---------------------------------- | :----------------------------------------------------------------------------------------------- |
| **1**  | `testResults/$id`             | `set` / `update` | `BaseFirebaseRepository.ts`    | `TestResultRepository`    | `QA`, `ADMIN`, `LAB`, `QC`          | Không cho phép sửa đổi sau khi đã có `evaluationSnapshot` (ngoại trừ QA/ADMIN có Change Control) |
| **2**  | `testResults/` (multi-path)   | `update`         | `testResultService.ts`         | `syncBatchTestResults`    | `QA`, `ADMIN`                       | Multi-path update đồng bộ danh mục                                                               |
| **3**  | `batches/$id`                 | `set` / `update` | `BaseFirebaseRepository.ts`    | `BatchRepository`         | `QA`, `ADMIN`, `USER`, `PRODUCTION` | Không cho phép sửa đổi khi Lô đã `RELEASED` hoặc `REJECTED` (ngoại trừ ADMIN)                    |
| **4**  | `batches/$id/status`          | `update`         | `FirebaseBatchRepository.ts`   | `FirebaseBatchRepository` | `QA`, `ADMIN`                       | Chỉ QA/ADMIN được đổi sang `RELEASED` hoặc `REJECTED`                                            |
| **5**  | `products/$id`                | `set` / `update` | `BaseFirebaseRepository.ts`    | `ProductRepository`       | `ADMIN`                             | Chỉ ADMIN được tạo/sửa/xóa hồ sơ sản phẩm                                                        |
| **6**  | `products/` (multi-path)      | `update`         | `FirebaseProductRepository.ts` | `ProductRepository`       | `ADMIN`                             | Cập nhật đồng loạt mã hoặc trạng thái                                                            |
| **7**  | `tccs/$id`                    | `set` / `update` | `BaseFirebaseRepository.ts`    | `TCCSRepository`          | `QA`, `ADMIN`                       | Tiêu chuẩn cơ sở bắt buộc thẩm định bởi QA/ADMIN                                                 |
| **8**  | `tccs/$id`                    | `remove`         | `FirebaseTCCSRepository.ts`    | `TCCSRepository`          | `ADMIN`                             | Không cho xóa TCCS đang được Lô liên kết                                                         |
| **9**  | `product_formulas/$id`        | `set` / `update` | `BaseFirebaseRepository.ts`    | `FormulaRepository`       | `QA`, `ADMIN`                       | Công thức định lượng bắt buộc thẩm quyền QA/ADMIN                                                |
| **10** | `raw_materials/$id`           | `set` / `update` | `BaseFirebaseRepository.ts`    | `MaterialRepository`      | `QA`, `ADMIN`                       | Danh mục nguyên liệu                                                                             |
| **11** | `master_criteria/$id`         | `set` / `update` | `BaseFirebaseRepository.ts`    | `MasterCriterionRepo`     | `QA`, `ADMIN`                       | Chỉ tiêu kiểm nghiệm Master Data                                                                 |
| **12** | `criteria_aliases/$id`        | `set` / `update` | `TCCSAppService.ts`            | `CriteriaAliasService`    | `QA`, `ADMIN`                       | Ánh xạ tên viết tắt của chỉ tiêu                                                                 |
| **13** | `ai_learned_mappings/$id`     | `set` / `update` | `TCCSAppService.ts`            | `AILearnedMappingRepo`    | `QA`, `ADMIN`                       | Ánh xạ AI đã được người dùng phê duyệt                                                           |
| **14** | `pharmacopoeia_standards/$id` | `set` / `update` | `pharmacopoeiaService.ts`      | `pharmacopoeiaService`    | `QA`, `ADMIN`                       | Danh mục tiêu chuẩn dược điển DĐVN V, USP, BP                                                    |
| **15** | `quality_deviations/$id`      | `set` / `update` | `BaseFirebaseRepository.ts`    | `DeviationRepository`     | `QA`, `ADMIN`, `QC`, `USER`         | Tạo hồ sơ sai lệch CAPA                                                                          |
| **16** | `electronic_signatures/$id`   | `set`            | `signatureService.ts`          | `signatureService`        | Authenticated User                  | **Append-only**: Cấm sửa đổi hoặc xóa chữ ký đã ký                                               |
| **17** | `audit_logs/$id`              | `set`            | `auditService.ts`              | `auditHardeningService`   | Authenticated User                  | **Append-only**: Cấm sửa đổi hoặc xóa bản ghi kiểm toán                                          |
| **18** | `users/$uid`                  | `set`            | `authService.ts`               | `authService`             | User chính chủ                      | Tạo profile mới khi đăng ký (mặc định `GUEST`)                                                   |
| **19** | `users/$uid/role`             | `set`            | `userService.ts`               | `userService`             | `ADMIN`                             | Chỉ ADMIN được quyền phân quyền tài khoản                                                        |
| **20** | `users/admins/$uid`           | `set` / `remove` | `userService.ts`               | `userService`             | `ADMIN`                             | Danh sách định danh Quản trị viên tối cao                                                        |
| **21** | `quality_alerts/$id`          | `set` / `update` | `databaseService.ts`           | `databaseService`         | Authenticated non-GUEST             | Ghi nhận cảnh báo chất lượng thời gian thực                                                      |
| **22** | `testing_laboratories/$id`    | `set` / `update` | `BaseFirebaseRepository.ts`    | `LaboratoryRepository`    | `ADMIN`                             | Quản lý danh mục phòng kiểm nghiệm đối tác                                                       |

---

## 2. RÀO CHẮN AN TOÀN CHO ĐƯỜNG GHI (WRITE-PATH HARDENING REQUIREMENTS)

1. **Atomic Transaction**:
   - Khi thực hiện các thay đổi phức tạp (như Auto-Heal plan hoặc Batch Release), toàn bộ các mutations phải gom thành 1 lệnh cập nhật đa nhánh (`update(ref(db), multiPathPayload)`) để đảm bảo tính nguyên tố (All-or-Nothing).
2. **Optimistic Concurrency Check (Model 11)**:
   - Mọi bản ghi thuộc nhóm Regulated (`TestResult`, `Batch`, `TCCS`, `Formula`) bắt buộc mang trường `version`.
   - Trước khi ghi, backend/service phải so khớp `expectedVersion === currentVersion`. Nếu không khớp, trả về lỗi `CONFLICT` ngay lập tức.
3. **Precondition Validation (Model 5 & Model 6)**:
   - Dữ liệu trước khi chạm vào Firebase phải vượt qua cả 3 tầng:
     - Tier 1: Zod Schema (kiểu dữ liệu, định dạng, trường bắt buộc).
     - Tier 2: Domain Reference (khóa ngoại không mồ côi, ID thực thể hợp lệ).
     - Tier 3: Regulatory Business Rules (không phê duyệt khi có chỉ tiêu FAIL, không xuất xưởng khi còn sai lệch mở).
