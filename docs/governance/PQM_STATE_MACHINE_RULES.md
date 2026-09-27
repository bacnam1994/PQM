# 🔄 QUY TẮC MÁY TRẠNG THÁI VÀ CHUYỂN ĐỔI NGHIỆP VỤ (PQM STATE MACHINE RULES)

> **Mã văn bản:** `PQM_STATE_MACHINE_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Master Workflow FSM, ICH Q10, GMP-WHO

---

## 1. NGUYÊN TẮC CỐT LÕI CỦA STATE MACHINE (FSM INVARIANTS)

1. **State Authority độc tôn**: Trạng thái nghiệp vụ của các thực thể (`Batch`, `TestResult`, `Deviation`, `ChangeRequest`, `CoA`, `ApprovalTask`) **CHỈ ĐƯỢC PHÉP THAY ĐỔI** thông qua các lớp State Machine chính thống tại `src/domain/workflow/stateMachine.ts` hoặc các domain-specific state machines (`src/domains/*/domain/rules.ts`).
2. **CẤM Bypass / Admin Override**: Không một vai trò nào — kể cả **ADMIN** — được quyền nhảy cóc trạng thái hoặc bypass máy trạng thái. Trong mã nguồn không tồn tại bất kỳ cờ nào như `adminOverride`, `forceUpdate`, hay `!isActorAdmin`.
3. **Fail-Closed**: Bất kỳ bước chuyển nào không nằm trong danh sách `VALID_TRANSITIONS` đều mặc định bị TỪ CHỐI (`allowed: false`).

---

## 2. CHU KỲ CHUYỂN ĐỔI CHUẨN CỦA CÁC THỰC THỂ CỐT LÕI

### 2.1. Lô sản xuất (Batch State Machine)

- `PENDING` ➔ `TESTING` | `REJECTED`
- `TESTING` ➔ `RELEASED` | `REJECTED` | `BLOCKED`
- `BLOCKED` ➔ `TESTING` | `REJECTED` (Thu hồi/Recall rồi tái thẩm định)
- `RELEASED` ➔ `BLOCKED` (Thu hồi ra thị trường: chỉ chuyển sang BLOCKED, cấm quay về PENDING hay TESTING)
- `REJECTED` ➔ `PENDING` (Mở lại bắt buộc kèm CAPA và giải trình kỹ thuật)

### 2.2. Phiếu kiểm nghiệm (Test Result State Machine)

- **Chu trình đánh giá kỹ thuật**: `PENDING` ➔ `PASS` | `FAIL` | `INVALID` ➔ `SUPERSEDED`
- **Chu trình phê duyệt hành chính**: `DRAFT` ➔ `SUBMITTED` ➔ `FINAL` ➔ `APPROVED` ➔ `RELEASED`
- **Bất biến**: `SUPERSEDED` là trạng thái kết thúc vĩnh viễn (Terminal State), không thể chuyển đổi tiếp.

---

## 3. RÀO CHẮN 7 CỔNG KIỂM SOÁT XUẤT XƯỞNG LÔ (7 RELEASE GATES)

Để một Lô sản xuất chuyển sang trạng thái `RELEASED`, bắt buộc phải vượt qua **100% cả 7 Cổng Kiểm Soát** tại `ReleaseRules.evaluate7ReleaseGates()`:

|    Gate    | Tên Cổng                            | Điều kiện bắt buộc (Fail-Closed)                                                                                  |
| :--------: | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Gate 1** | **Hoàn tất kiểm nghiệm 100%**       | Tỷ lệ hoàn thành các chỉ tiêu kiểm nghiệm bắt buộc phải đạt chính xác 100%.                                       |
| **Gate 2** | **Kết quả chất lượng Đạt (PASS)**   | Canonical Quality Status của Lô phải được giải quyết là `PASS`.                                                   |
| **Gate 3** | **Không có OOS mở**                 | Không tồn tại hồ sơ OOS hoặc kết quả Ngoài tiêu chuẩn chưa được xử lý.                                            |
| **Gate 4** | **Không có Sai lệch Critical mở**   | Không có Quality Deviation cấp độ Nghiêm trọng (Critical) đang mở.                                                |
| **Gate 5** | **CAPA đã giải tỏa**                | Các hành động khắc phục/phòng ngừa liên quan phải hoàn tất giải tỏa.                                              |
| **Gate 6** | **Hồ sơ Lô BPR đã được duyệt**      | Batch Production Record (BPR) phải ở trạng thái APPROVED.                                                         |
| **Gate 7** | **Hạn dùng hợp lệ & Thẩm quyền QA** | Lô chưa hết hạn sử dụng và người ký xuất xưởng bắt buộc phải có thẩm quyền QA/ADMIN kèm chữ ký số 21 CFR Part 11. |
