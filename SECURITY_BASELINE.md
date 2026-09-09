# PQM 3.0 - BÁO CÁO KHẢO SÁT BẢO MẬT & PHÂN QUYỀN (SECURITY BASELINE)
> **Phiên bản:** 3.0.0-baseline  
> **Thời điểm kiểm toán:** 2026-09-08  
> **Phạm vi:** Firebase Database Rules, Storage Rules, Client RBAC, AI Tool Permissions, ALCOA+ Audit Trail

---

## 1. PHÂN TÍCH HIỆN TRẠNG PHÂN QUYỀN (CURRENT RBAC ARCHITECTURE)

### 1.1. Mô hình vai trò nhị phân (Binary Roles)
Hệ thống hiện tại chỉ có 3 vai trò giản lược:
- `ADMIN`: Toàn quyền thêm, sửa, xóa tất cả danh mục, duyệt TCCS, xem audit log, quản lý người dùng.
- `USER`: Được tạo lô hàng, tạo phiếu kiểm nghiệm mới; không có quyền sửa danh mục chuẩn hoặc phê duyệt.
- `GUEST`: Tài khoản mới đăng ký, chuyển hướng đến trang `/welcome`.

### 1.2. Khoảng trống nghiệp vụ Dược & GMP
Trong nhà máy sản xuất Dược/Công nghệ sinh học đạt chuẩn GMP-WHO/EU-GMP, mô hình nhị phân (Admin/User) **hoàn toàn không đáp ứng được yêu cầu thanh tra chất lượng**:
- **Thiếu vai trò QC (Quality Control)**: Kiểm nghiệm viên nhập dữ liệu kiểm nghiệm, Trưởng phòng QC soát xét kết quả (QC Review).
- **Thiếu vai trò QA (Quality Assurance)**: Đảm bảo chất lượng độc lập, xem xét hồ sơ lô, ký duyệt xuất xưởng (**Batch Release**), ký ban hành Phiếu phân tích (**CoA Issue**).
- **Thiếu vai trò PRODUCTION (Sản xuất)**: Tạo kế hoạch sản xuất, nhập sản lượng thực tế, không được phép can thiệp kết quả kiểm nghiệm.
- **Thiếu vai trò VIEWER / AUDITOR**: Thanh tra viên, nhân viên đối tác chỉ có quyền xem báo cáo, không được chỉnh sửa bất kỳ dữ liệu nào.

---

## 2. LỖ HỔNG BẢO MẬT PHÁT HIỆN TẠI FIREBASE RULES (VULNERABILITY AUDIT)

### 🚨 Lỗ hổng 1: Leo thang đặc quyền người dùng (Privilege Escalation - CRITICAL)
- **Vị trí**: `database.rules.json` dòng 11-16
  ```json
  "users": {
    "$uid": {
      ".read": "auth != null && auth.uid === $uid",
      ".write": "auth != null && auth.uid === $uid"
    }
  }
  ```
- **Phân tích rủi ro**:
  Người dùng đã xác thực (`auth != null`) có toàn quyền ghi vào node `/users/$uid` của chính mình mà không có bất kỳ ràng buộc schema hoặc trường dữ liệu nào.
  Kẻ tấn công hoặc người dùng bất kỳ có thể mở Console trình duyệt và thực thi:
  ```javascript
  firebase.database().ref('users/' + auth.currentUser.uid).update({ role: 'ADMIN' });
  ```
  Ngay sau đó, do rule tại root quy định:
  ```json
  ".read": "... || root.child('users/' + auth.uid + '/role').val() === 'ADMIN'",
  ".write": "... || root.child('users/' + auth.uid + '/role').val() === 'ADMIN'"
  ```
  Tài khoản này lập tức trở thành **Root Admin**, chiếm quyền đọc và ghi đè toàn bộ cơ sở dữ liệu của nhà máy!

### 🚨 Lỗ hổng 2: Cho phép USER sửa đổi trạng thái Lô không kiểm soát (Workflow Bypass - CRITICAL)
- **Vị trí**: `database.rules.json` (node `batches`)
  ```json
  "$item_id": {
    ".write": "auth != null && (... || (root.child('users/' + auth.uid + '/role').val() === 'USER' && newData.exists()))"
  }
  ```
- **Phân tích rủi ro**:
  Bất kỳ user nào cũng có thể gửi lệnh update chuyển trạng thái lô hàng thành `status: 'RELEASED'` mà không cần qua bất kỳ bước kiểm tra:
  - Phiếu kiểm nghiệm có Đạt không?
  - Có được duyệt bởi QA không?
  - Có lý do thu hồi hoặc điều tra OOS không?

### 🚨 Lỗ hổng 3: Giả mạo bằng chứng Audit Trail (Tampering / Spoofing - HIGH)
- **Vị trí**: `database.rules.json` (node `audit_logs`)
  ```json
  "audit_logs": {
    "$log_id": {
      ".write": "auth != null && !data.exists() && newData.exists()"
    }
  }
  ```
- **Phân tích rủi ro**:
  Quy tắc hiện tại là append-only (`!data.exists() && newData.exists()`), ngăn việc xóa/sửa log cũ. Tuy nhiên, rule **KHÔNG xác thực** nội dung ghi mới:
  - Không bắt buộc `newData.child('actorId').val() === auth.uid`.
  - Người dùng có thể ghi log mạo danh người khác, ghi lùi thời gian `timestamp`, hoặc che giấu các hành vi sửa đổi thực tế.

### ⚠️ Lỗ hổng 4: AI Copilot Tools tự thực thi bỏ qua phân quyền (AI Action Bypass - HIGH)
- Trong `src/services/ai/aiTools.ts`, các công cụ hành động (`updateBatchStatus`, `createBatch`, `autoHealInconsistencies`) gọi trực tiếp vào Zustand store và Firebase:
  ```typescript
  // Trích đoạn aiTools.ts:
  const store = useAppStore.getState();
  await store.updateBatch(batchId, { status: newStatus });
  ```
  AI Copilot có thể bị Prompt Injection hoặc hướng dẫn qua chat để đổi trạng thái lô sang `RELEASED` hoặc thực hiện `autoHeal` xóa dữ liệu mà không hề qua kiểm tra quyền người đang ngồi trước màn hình.

---

## 3. ĐỀ XUẤT KIẾN TRÚC AN NINH PQM 3.0 (PHASE 1 PLAN)

### 3.1. Ma trận phân quyền ma trận 6 Vai trò (Role x Module x Action Matrix)
Thiết lập 6 vai trò chuẩn GMP:
1. **ADMIN**: Quản trị tài khoản, cấu hình hệ thống, phục hồi sao lưu.
2. **QA (Quality Assurance)**: Duyệt TCCS, ký duyệt xuất xưởng lô (**Batch Release**), ban hành CoA, mở điều tra OOS/CAPA.
3. **QC (Quality Control)**: Phê duyệt kết quả kiểm nghiệm nội bộ, quản lý chỉ tiêu, theo dõi xu hướng.
4. **LAB (Kiểm nghiệm viên)**: Nhập kết quả kiểm nghiệm, đính kèm file đo phổ, ghi nhận OOS.
5. **PRODUCTION (Sản xuất)**: Khởi tạo lô sản xuất, nhập năng suất, đóng gói.
6. **VIEWER / AUDITOR**: Chỉ đọc các báo cáo chất lượng được phép.

### 3.2. Dịch vụ phân quyền tập trung (`permissionService.ts`)
Thay thế toàn bộ các lệnh kiểm tra rải rác `if (isAdmin)` bằng các hàm kiểm tra năng lực ngữ cảnh:
```typescript
can(user, 'batch:release', batch);
can(user, 'testResult:approve', testResult);
can(user, 'tccs:publish', tccs);
```

### 3.3. Tái cấu trúc hoàn toàn Firebase Database Rules
- Khóa chặt node `/users/$uid`: Chỉ cho phép sửa profile cá nhân (tên, avatar), **cấm tuyệt đối sửa trường `role`**.
- Quản trị role qua node bảo mật riêng hoặc Custom Claims được set từ Admin Backend.
- Ràng buộc chuyển trạng thái (State Transition Guard) trực tiếp trên Database Rules: Lô chỉ được `RELEASED` khi người sửa có claim `role === 'QA'` hoặc `role === 'ADMIN'`.

### 3.4. Bộ kiểm thử quy tắc an ninh (Security Rules Tests with Emulator)
Xây dựng bộ test tự động sử dụng `@firebase/rules-unit-testing` để chứng minh 100% các kịch bản:
- Ngăn chặn leo thang quyền tự phong Admin.
- Ngăn chặn user thường chuyển trạng thái lô sang Released.
- Ngăn chặn giả mạo actorId trong audit log.
