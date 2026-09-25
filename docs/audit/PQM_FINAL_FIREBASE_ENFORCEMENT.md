# PQM — ĐỐI CHIẾU VÀ THẨM ĐỊNH FIREBASE SECURITY RULES (FIREBASE ENFORCEMENT)

> **Tài liệu:** PQM_FINAL_FIREBASE_ENFORCEMENT.md  
> **Phiên bản:** 1.0.0-FINAL-SOURCE-VERIFIED  
> **Ngày thực hiện:** 2026-09-24  
> **File kiểm toán cốt lõi:** `database.rules.json` & `src/services/securityRulesValidator.ts`  
> **Mục tiêu:** Thẩm tra ranh giới bảo vệ tại tầng cơ sở dữ liệu (Server-side Database Rules), đánh giá các cơ chế bảo vệ thực thể, nhật ký kiểm toán bất biến, chữ ký số, và phân định rõ ràng giữa các rào chắn DB-level và App-level.

---

## 1. MÔ TẢ MA TRẬN BẢO VỆ FIREBASE REALTIME DATABASE RULES

Firebase Realtime Database Rules đóng vai trò là chốt chặn an ninh tối thượng tại tầng máy chủ (Server-side Defense), bảo vệ cơ sở dữ liệu ngay cả khi client bị can thiệp qua console hoặc REST API:

| Nhánh dữ liệu (Collection)           | Quyền Đọc (.read)         | Quyền Ghi (.write)      | Cơ chế bảo vệ Server-side nổi bật                                                                                                                    | Phân loại rào chắn |
| :----------------------------------- | :------------------------ | :---------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------: |
| **Root (`/`)**                       | Authenticated Admin       | Authenticated Admin     | Cấm triệt để người dùng thông thường đọc/ghi trực tiếp vào root database. Ngăn chặn lệnh xóa sạch `set(ref(db), null)`.                              |    **DB-LEVEL**    |
| **`audit_logs`**                     | Admin / Owner             | Authenticated Appender  | **Append-Only Immutability:** `!data.exists() && newData.exists()`. Cấm tuyệt đối `UPDATE` và `DELETE` đối với mọi tài khoản bao gồm cả Admin.       |    **DB-LEVEL**    |
| **`electronic_signatures`**          | Public (QR Verify)        | Authenticated Signer    | **Append-Only:** `!data.exists() && newData.exists()`. Chữ ký điện tử sau khi ghi nhận không thể sửa đổi hoặc xóa bỏ.                                |    **DB-LEVEL**    |
| **`products`**                       | Authenticated             | Admin                   | Chỉ Quản trị viên mới được thêm/sửa/xóa hồ sơ sản phẩm.                                                                                              |    **DB-LEVEL**    |
| **`batches`**                        | Authenticated             | QA / Admin / User Guard | - Non-QA chỉ được tạo lô ở trạng thái `PENDING`.<br>- Non-QA bị cấm chuyển trạng thái sang `RELEASED`, `REJECTED`, `BLOCKED`.                        |    **DB-LEVEL**    |
| **`testResults`**                    | Authenticated             | QA / Admin / Lab Guard  | - Khi đã có `evaluationSnapshot`, người dùng thông thường bị cấm ghi đè.<br>- Non-QA bị cấm chuyển `workflowStatus` sang `APPROVED` hoặc `RELEASED`. |    **DB-LEVEL**    |
| **`tccs`**                           | Authenticated             | QA / Admin              | Tiêu chuẩn cơ sở chỉ cho phép QA và Admin khởi tạo, ban hành.                                                                                        |    **DB-LEVEL**    |
| **`product_formulas`**               | Authenticated             | QA / Admin              | Công thức định lượng được bảo vệ bởi QA và Admin.                                                                                                    |    **DB-LEVEL**    |
| **`raw_materials`**                  | Authenticated             | QA / Admin              | Danh mục nguyên phụ liệu được bảo vệ.                                                                                                                |    **DB-LEVEL**    |
| **`master_criteria`** _(Đã bổ sung)_ | Authenticated             | QA / Admin              | Bảo vệ danh mục chỉ tiêu chuẩn, khắc phục lỗ hổng fallback về root rule.                                                                             |    **DB-LEVEL**    |
| **`change_requests`** _(Đã bổ sung)_ | Authenticated             | QA / Admin / QC / User  | Cho phép nhân sự nhà máy gửi đề xuất thay đổi nhưng yêu cầu xác thực vai trò.                                                                        |    **DB-LEVEL**    |
| **`approval_tasks`** _(Đã bổ sung)_  | Authenticated             | QA / Admin / QC         | Bảo vệ các tác vụ phê duyệt đa cấp TCCS và Lô.                                                                                                       |    **DB-LEVEL**    |
| **`testing_laboratories`**           | Authenticated             | Admin                   | Danh mục phòng kiểm nghiệm do Admin quản lý.                                                                                                         |    **DB-LEVEL**    |
| **`users`**                          | Authenticated Owner/Admin | Owner/Admin Guard       | **Role Escalation Defense:** Người dùng không thể tự gán `role: 'ADMIN'` hoặc `isAdmin: true` cho tài khoản của mình.                                |    **DB-LEVEL**    |

---

## 2. PHÂN ĐỊNH RANH GIỚI DB-LEVEL VS APP-LEVEL

Do đặc thù ngôn ngữ của Firebase Realtime Database Rules (không hỗ trợ chạy thuật toán phức tạp như kiểm tra 8 quy tắc Nelson, 7 Release Gates, hoặc băm đệ quy Canonical JSON):

1. **Rào chắn tại tầng Database (DB-LEVEL GUARDS):**
   - Đảm bảo tính xác thực người dùng (`auth != null`).
   - Ngăn chặn người dùng trái thẩm quyền (chặn Operator xuất xưởng lô, chặn Lab phê duyệt phiếu kiểm nghiệm).
   - Bảo đảm tính bất biến (Append-only) cho `audit_logs` và `electronic_signatures`.
   - Ngăn chặn ghi đè phiếu kiểm nghiệm đã niêm phong (`data.hasChild('evaluationSnapshot')`).
   - Ngăn chặn leo thang đặc quyền (`users` node).

2. **Rào chắn tại tầng Ứng dụng & Domain (APP-LEVEL GUARDS):**
   - Thẩm định chi tiết **7 Cổng Kiểm Soát Xuất Xưởng (7 Release Gates)** trong `ReleaseRules`.
   - Kiểm tra **Finite State Machine 16 bước** trong `BatchStateMachine` và `TestResultStateMachine`.
   - Tính toán và xác thực tính toàn vẹn của mã băm **SHA-256** trên 12 trường dữ liệu cốt lõi (`evaluationSnapshot`).
   - Kiểm soát tính toàn vẹn công thức (tổng tỷ lệ định lượng 100%, không cho xóa nguyên liệu đang dùng trong công thức).
   - Kiểm soát khóa lạc quan (OCC) chống ghi đè phiên bản lỗi thời (`validateOptimisticLock`).

---

## 3. CÁC ĐIỂM ĐÃ ĐƯỢC CẢI TIẾN TRONG ĐỢT KIỂM TOÁN NÀY

1. **Khắc phục khoảng trống (Gaps) trong `database.rules.json`**:
   - Trước đây: `master_criteria`, `change_requests`, và `approval_tasks` chưa được định nghĩa nút riêng trong `database.rules.json`, khiến các yêu cầu hợp lệ của QA/QC có nguy cơ kế thừa quy tắc root (vốn chỉ dành cho Admin).
   - Hiện tại: Đã cấu hình tường minh 3 nút trên với phân quyền và chỉ mục `.indexOn` đầy đủ, đảm bảo an toàn truy vấn và phân quyền chính xác.

2. **Khóa vĩnh viễn các API nguy hiểm tại `databaseService.ts`**:
   - `clearDatabaseService`, `updateRootService`, `deleteItemService` đã được ném lỗi `[FORBIDDEN ROOT OPERATION]`, ngăn chặn triệt để mọi kịch bản bypass phía client.

---

## 4. KẾT LUẬN

- **Mức độ an ninh Firebase Rules:** ✅ **ĐẠT CHUẨN CƠ SỞ DỮ LIỆU GMP & 21 CFR PART 11**
- Tầng cơ sở dữ liệu cung cấp rào chắn phòng thủ vững chắc độc lập với client, bảo toàn tính toàn vẹn của dữ liệu và nhật ký kiểm toán.
