# PQM — RÀ SOÁT VÀ THẨM ĐỊNH THẨM QUYỀN QUẢN TRỊ VIÊN (ADMIN ENFORCEMENT)

> **Tài liệu:** PQM_FINAL_ADMIN_ENFORCEMENT.md  
> **Phiên bản:** 1.0.0-FINAL-SOURCE-VERIFIED  
> **Ngày thực hiện:** 2026-09-24  
> **Mục tiêu:** Rà soát toàn bộ từ khóa đặc quyền Admin (`isAdmin`, `isActorAdmin`, `bypass`, `override`, `force`, `skip`) trên toàn bộ 560 file mã nguồn, phân định ranh giới giữa thẩm quyền hợp lệ và các điểm bypass bất hợp pháp đối với các cổng kiểm soát Dược phẩm (GMP Regulated Gates).

---

## 1. NGUYÊN TẮC QUẢN TRỊ KHÔNG NGOẠI LỆ (ZERO REGULATED BYPASS PRINCIPLE)

Trong môi trường sản xuất Dược phẩm tuân thủ cGMP (FDA 21 CFR Part 210/211 và WHO GMP):

1. **Quản trị viên (ADMIN)** được trao quyền cấu hình hệ thống, phục hồi cơ sở dữ liệu, quản lý tài khoản và thực thi các thao tác can thiệp khẩn cấp.
2. **TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP**:
   - Bỏ qua chuyển đổi trạng thái FSM (ví dụ: không được ép nhảy từ `PENDING` thẳng sang `RELEASED`).
   - Bỏ qua 7 Cổng Kiểm Soát Xuất Xưởng (7 Release Gates).
   - Xóa bỏ hoặc sửa đổi hồ sơ nhật ký kiểm toán (Audit Trail Immutability).
   - Sửa đổi kết quả kiểm nghiệm đã niêm phong mã băm SHA-256 (`evaluationSnapshot`).
   - Thực thi các thao tác nhạy cảm mà không ghi nhận lý do giải trình (`reason`).

---

## 2. PHÂN LOẠI VÀ ĐỐI CHIẾU SỬ DỤNG TỪ KHÓA ADMIN TRONG MÃ NGUỒN

### 2.1. Phân nhóm UI Visibility & Feature Access (Hợp lệ)

- **Vị trí:** `src/components/`, `src/pages/`
- **Mục đích:** Ẩn/hiện các nút công cụ quản trị (như nút "Cấu hình hệ thống", "Dọn dẹp danh mục", "Quản lý phòng kiểm nghiệm").
- **Đánh giá:** ✅ **Hợp lệ**, phục vụ trải nghiệm người dùng, không can thiệp vào quy tắc nghiệp vụ tầng backend/domain.

### 2.2. Phân nhóm Administrative Management (Hợp lệ)

- **Vị trí:** `SystemAppService.ts`, `FirebaseSystemRepository.ts`
- **Mục đích:** Cho phép Admin thực hiện `backupDatabase`, `restoreDatabase`, `wipeDatabase`, `resetDemoData`.
- **Rào chắn bảo vệ:**
  - Bắt buộc token xác nhận nghiêm ngặt (`CONFIRM_RESTORE`, `CONFIRM_WIPE`, `CONFIRM_RESET_DEMO`).
  - Bắt buộc lý do giải trình.
  - Ghi vết kiểm toán đầy đủ trong `audit_logs` với Collection `SYSTEM`.
- **Đánh giá:** ✅ **Hợp lệ và an toàn**.

### 2.3. Rà soát Quy trình Xuất xưởng Lô (Release Gate Enforcement)

- **Vị trí rà soát:** `src/services/app/ReleaseService.ts`
- **Mã nguồn thẩm định:**

  ```typescript
  // Thẩm tra 7 Release Gates (Bắt buộc 100% người dùng bao gồm Admin, không có ngoại lệ)
  const evaluation = this.evaluateReleaseReadiness({
    batch: currentBatch,
    testResults,
    boundTccs,
    deviations,
    userRole: currentUser?.role,
  });

  if (!evaluation.isEligible || !evaluation.allGatesPassed) {
    throw new Error(
      `Từ chối xuất xưởng: Còn rào cản chưa thỏa mãn (${evaluation.blockers.join('; ')})`
    );
  }
  ```

- **Xác minh:** Không còn bất kỳ cờ `if (!isAdmin)` hay `adminOverride` nào bao quanh `evaluateReleaseReadiness`. Kể cả tài khoản có `role: 'ADMIN'` hoặc `isAdmin: true` đều phải vượt qua toàn bộ 7 cổng kiểm soát mới có thể xuất xưởng lô.
- **Đánh giá:** ✅ **Zero Admin Bypass strictly enforced**.

### 2.4. Rà soát Finite State Machine (Batch & Test Result FSM)

- **Vị trí rà soát:** `src/domain/workflow/stateMachine.ts` và `BatchAppService.ts`
- **Mã nguồn thẩm định:**
  - Khi Admin thực hiện thay đổi trạng thái Lô trong `BatchAppService.updateStatus`, bước chuyển trạng thái vẫn bắt buộc phải đi qua `BatchStateMachine.canTransition(...)`.
  - Cố gắng chuyển từ `PENDING` sang `RELEASED` hoặc từ `RELEASED` về `PENDING` đều bị chặn đứng với mã lỗi `INVALID_STATE_TRANSITION`.
  - Admin không thể xóa Lô đã xuất xưởng (`RELEASED`):
    ```typescript
    if (targetBatch?.status === 'RELEASED') {
      throw new Error(
        'Từ chối thao tác: Không thể xóa Lô đã xuất xưởng (RELEASED). Chỉ có thể thu hồi (Recall/Blocked) theo quy định GMP.'
      );
    }
    ```
- **Đánh giá:** ✅ **Bảo toàn bất biến GMP**.

### 2.5. Rà soát Tính Bất Biến của Audit Trail đối với Admin

- **Vị trí rà soát:** `database.rules.json` và `SecurityRulesValidator.ts`
- **Mã nguồn thẩm định:**
  ```typescript
  // Ngoại lệ duy nhất của ADMIN: Không được UPDATE hoặc DELETE Audit Trail (Quy định ALCOA+ bất biến)
  if (resourcePath.startsWith('audit_logs') && (action === 'UPDATE' || action === 'DELETE')) {
    return {
      allowed: false,
      reason: 'ALCOA+ Violation: Nhật ký kiểm toán là bất biến, không thể sửa đổi hoặc xóa.',
    };
  }
  ```
- **Firebase Database Rules:** Đường dẫn `audit_logs/$log_id` được quy định `.write: "!data.exists() && newData.exists()"` -> Quy tắc Append-only được bảo vệ trực tiếp tại tầng cơ sở dữ liệu.
- **Đánh giá:** ✅ **Audit Trail tuyệt đối bất biến đối với mọi người dùng bao gồm Admin**.

---

## 3. KẾT QUẢ KIỂM THỬ TỰ ĐỘNG

Bộ kiểm thử hồi quy `tests/security/workflowBypass.test.ts` và `tests/architecture/unifiedWorkflowArchitecture.test.ts` đã kiểm tra:

1. `BatchAppService không được chứa bypass !isActorAdmin trong kiểm tra Release` -> **PASS**
2. `ReleaseService không được chứa bypass !isAdmin trong kiểm tra Release Gates` -> **PASS**
3. `Chặn ngay cả ADMIN cố tình xóa hoặc sửa nhật ký kiểm toán` -> **PASS**
4. `Admin không thể xóa phiếu kiểm nghiệm hoặc lô đã xuất xưởng` -> **PASS**

---

## 4. KẾT LUẬN

- **Trạng thái rào chắn Admin:** ✅ **CHẶT CHẼ, KHÔNG CÓ LỖ HỔNG BYPASS**
- Đặc quyền Quản trị viên chỉ giới hạn trong phạm vi bảo trì hệ thống và các thao tác được cấp quyền trong Workflow Action Catalog.
