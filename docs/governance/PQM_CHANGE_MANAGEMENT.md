# 📋 GIAO THỨC QUẢN LÝ THAY ĐỔI HỆ THỐNG (PQM CHANGE MANAGEMENT PROTOCOL)

> **Mã văn bản:** `PQM_CHANGE_MANAGEMENT.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Change Control Protocol in GxP Environment

---

## 1. PHÂN LOẠI CÁC LOẠI HÌNH THAY ĐỔI

Mọi yêu cầu kỹ thuật phát sinh trong dự án phải được phân loại vào đúng 1 trong các nhóm sau:

1. **FEATURE REQUEST (Bổ sung tính năng mới)**:
   - Phải điền đầy đủ mẫu `FEATURE REQUEST TEMPLATE`.
   - Bắt buộc xác định rõ Canonical Action ID, Workflow Handler, RBAC Roles và FSM state transition trước khi code.
2. **BUG FIX (Sửa lỗi phần mềm)**:
   - Phải truy tìm nguyên nhân gốc rễ (Root Cause) theo phân tầng kiến trúc.
   - Cấm "chữa cháy" triệu chứng tại tầng UI bằng cách gán tắt trạng thái.
   - Bắt buộc bổ sung regression test case để lỗi không bao giờ tái diễn.
3. **REFACTOR (Tái cấu trúc mã nguồn)**:
   - Tái cấu trúc phải bảo toàn 100% hành vi nghiệp vụ (Zero Behavioral Change).
   - Không được thực hiện refactor kiến trúc đồng thời với bổ sung tính năng mới trong cùng một commit.
4. **SCHEMA CHANGE (Thay đổi cấu trúc cơ sở dữ liệu)**:
   - Cực kỳ nhạy cảm! Bắt buộc phải có bài phân tích tác động (Impact Analysis), kế hoạch di trú dữ liệu (Migration Plan), và phương án khôi phục (Rollback Plan) được duyệt trước khi thi hành.

---

## 2. BIỂU MẪU ĐẶC TẢ TÍNH NĂNG MỚI (FEATURE REQUEST TEMPLATE)

Trước khi implement một tính năng mới, bắt buộc lập bản mô tả kỹ thuật:

```text
# FEATURE SPECIFICATION

## Tên tính năng (Feature Name)
...
## Phân hệ sở hữu (Domain Slice)
[Product / Material / TCCS / Formula / Batch / TestResult / Deviation / OOS / CAPA / ChangeRequest / CoA / Approval / MasterData / System / AI / Auth]

## Điểm kích hoạt giao diện (UI Entry Point)
[Page / Component / Button]

## Danh mục hành động (Canonical Action ID)
[Action ID đã có HOẶC Đề xuất Action ID mới chuẩn format ENTITY_ACTION]

## Luồng thẩm tra an ninh (Guards)
[RBAC Role / OCC Version / Reason / CFR Part 11 Signature / Confirmation Token]

## Máy trạng thái (FSM State Transition)
[From State -> To State]

## Dịch vụ ứng dụng & Kho lưu trữ (Service & Repository)
[Application Service -> Repository Interface]

## Truy vết kiểm toán (Audit Trail)
[Outbox Queue Payload details]

## Kế hoạch kiểm thử (Test Plan)
[Happy Path / Negative Roles / Invalid Transitions / Concurrency Conflict]
```

---

## 3. NGUYÊN TẮC "NO SILENT ARCHITECTURE CHANGE"

Nghiêm cấm kỹ sư hoặc AI tự ý thay đổi:

- Đổi Action ID hiện có mà không có kế hoạch di chuyển.
- Đổi quy tắc State Machine hoặc bỏ bớt Release Gates.
- Đổi Database Rules hoặc Schema cấu trúc JSON trên Firebase.

Nếu phát hiện bất kỳ mâu thuẫn kiến trúc nào: **DỪNG LẠI (STOP) ➔ BÁO CÁO MÂU THUẪN (REPORT) ➔ CHỜ PHÊ DUYỆT (AWAIT APPROVAL).**
