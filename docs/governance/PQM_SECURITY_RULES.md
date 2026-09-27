# 🔒 QUY TẮC AN NINH VÀ TOÀN VẸN DỮ LIỆU DƯỢC PHẨM (PQM SECURITY RULES)

> **Mã văn bản:** `PQM_SECURITY_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** FDA 21 CFR Part 11, ALCOA+, RBAC

---

## 1. CHỮ KÝ ĐIỆN TỬ SỐ HÓA (21 CFR PART 11 COMPLIANT ELECTRONIC SIGNATURE)

Các hành động phê duyệt then chốt (`BATCH_RELEASE_APPROVE`, `TEST_RESULT_APPROVE`, `COA_SIGN`) bắt buộc phải có chữ ký điện tử hợp lệ gắn kèm theo tiêu chuẩn 21 CFR Part 11:

- **Thông tin tối thiểu**: Tên người ký, Email, Vai trò (`role`), Thời điểm ký (`timestamp`), và Ý định ký (`intent`, ví dụ: "Ký xuất xưởng Lô sản xuất").
- **Tính bất biến**: Chữ ký được niêm phong gắn liền với bản ghi dữ liệu, không thể xóa bỏ hay sửa đổi.

---

## 2. PHÂN TÁCH NHIỆM VỤ (SEGREGATION OF DUTIES - SOD)

- Người lập phiếu kiểm nghiệm hoặc người tạo hồ sơ thay đổi **KHÔNG ĐƯỢC PHÉP** tự mình phê duyệt phiếu/hồ sơ đó.
- Hàm `ApprovalRules.verifySoDCompliance()` (`src/domains/approval/domain/rules.ts`) tự động chặn đứng mọi hành vi tự duyệt.

---

## 3. MÃ TOKEN XÁC NHẬN CHO TÁC VỤ PHÁ HỦY (CONFIRMATION TOKENS)

Các tác vụ quản trị hệ thống có rủi ro cao hoặc xóa dữ liệu hàng loạt bắt buộc phải có mã Token xác thực 2 bước từ phía người dùng nhập thủ công:

- Khôi phục hệ thống: Token `CONFIRM_RESTORE`
- Xóa sạch dữ liệu: Token `CONFIRM_WIPE`
- Nạp lại dữ liệu demo: Token `CONFIRM_RESET_DEMO`
- Xóa hồ sơ Lô: Token `DELETE_BATCH_<BATCH_NO>`

Hàm `destructiveActionGuard` sẽ kiểm tra chính xác từng ký tự của Token trước khi cho phép thực thi.
