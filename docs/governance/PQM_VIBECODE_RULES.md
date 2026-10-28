# 🤖 BỘ QUY TẮC PHÁT TRIỂN DÀNH CHO AI & VIBECODE (PQM VIBECODE RULES)

> **Mã văn bản:** `PQM_VIBECODE_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tính chất:** BẮT BUỘC TUÂN THỦ 100% — KHÔNG CÓ NGOẠI LỆ

---

## 1. CHU KỲ 10 BƯỚC BẮT BUỘC TRƯỚC VÀ SAU KHI CODE

Mọi yêu cầu công việc (feature, bugfix, refactor) bắt buộc phải tuân thủ nghiêm ngặt tiến trình 10 bước:

```text
1. UNDERSTAND       (Nắm trọn vẹn yêu cầu nghiệp vụ và bối cảnh)
2. INSPECT          (Khảo sát 15 câu hỏi kiến trúc trước khi chạm code)
3. TRACE            (Lần vết luồng hiện hữu từ UI -> Action -> FSM -> Repo)
4. DESIGN           (Thiết kế giải pháp hội tụ về Canonical Path)
5. REUSE            (Ưu tiên tái sử dụng Action/Service/Hook hiện có)
6. IMPLEMENT        (Viết code sạch, đúng ranh giới phân tầng)
7. TEST             (Viết test case và chạy Unit/Integration test)
8. ARCHITECTURE     (Chạy npm run workflow:guard & tests/architecture/)
9. REGRESSION       (Chạy tsc --noEmit và npm test -- --run)
10. REPORT          (Báo cáo đầy đủ 13 thuộc tính bàn giao)
```

---

## 2. 15 CÂU HỎI BẮT BUỘC TRƯỚC KHI CODE (INSPECT CHECKLIST)

Trước khi tạo mới hoặc sửa bất kỳ dòng mã nào, AI/Kỹ sư **PHẢI** trả lời rõ ràng 15 câu hỏi:

1. Chức năng này thuộc Domain nào trong 16 Domain Slices?
2. Activity / Page / Component nào kích hoạt nó?
3. Canonical Action ID tương ứng là gì?
4. Action này đã tồn tại trong `CANONICAL_ACTION_REGISTRY` chưa?
5. Workflow nào tiếp nhận và điều phối?
6. Handler / Application Service nào thực thi?
7. Những Guard an ninh nào áp dụng (RBAC, Reason, Signature, OCC, Confirmation Token)?
8. Vai trò người dùng nào (trong 8 Canonical Roles) được phép thực hiện?
9. Máy trạng thái (FSM) và chuyển đổi trạng thái nào bị ảnh hưởng?
10. Application Service nào sở hữu nghiệp vụ này?
11. Repository Interface nào đảm nhiệm lưu trữ dữ liệu?
12. Sự kiện Outbox Audit Trail nào phát sinh để lưu vết ALCOA+?
13. Đã có chức năng tương tự tồn tại trong codebase chưa (có thể tái sử dụng không)?
14. Có legacy adapter nào đang cùng xử lý nghiệp vụ này không?
15. Đã có test suite nào hiện hữu bao phủ flow này chưa?

> ⚠️ **NẾU CHƯA TRẢ LỜI ĐƯỢC 15 CÂU HỎI TRÊN: TUYỆT ĐỐI KHÔNG ĐƯỢC IMPLEMENT!**

---

## 3. NGUYÊN TẮC "REUSE BEFORE CREATE" (TÁI SỬ DỤNG TRƯỚC KHI TẠO MỚI)

Thứ tự ưu tiên tối thượng khi xử lý bất kỳ thành phần mã nguồn nào:

```text
REUSE EXISTING (Tái sử dụng nguyên vẹn)
      ↓
EXTEND EXISTING (Mở rộng thành phần hiện có mà không phá vỡ contract)
      ↓
REFACTOR EXISTING (Tái cấu trúc thành phần hiện có nếu cần thiết)
      ↓
CREATE NEW (Chỉ tạo mới khi thực sự là nghiệp vụ hoàn toàn mới chưa có tiền lệ)
```

---

## 4. DANH SÁCH BÁO CÁO CUỐI TASK BẮT BUỘC (COMPLETION REPORT TEMPLATE)

Khi hoàn thành bất kỳ task nào, AI **BẮT BUỘC** phải báo cáo định lượng theo mẫu sau:

```text
FILES MOVED:         ...
FILES CREATED:       ...
FILES DELETED:       ...
IMPORTS UPDATED:     ...
WORKFLOW ACTIONS:    ...
TESTS:               PASS (số test pass)
TYPECHECK:           PASS (0 errors)
BUILD:               PASS (thời gian build)
ARCHITECTURE:        PASS (workflow:guard 0 vi phạm)
TRACEABILITY:        PASS (Activity ➔ Action ➔ FSM ➔ Repo)
REMAINING LEGACY:    ...
BLOCKERS / RISKS:    ...
COMMIT SHA:          ...
```
