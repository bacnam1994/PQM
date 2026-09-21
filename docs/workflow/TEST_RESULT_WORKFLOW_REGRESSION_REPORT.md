# PQM — TEST RESULT WORKFLOW REGRESSION REPORT

> **Báo cáo kiểm thử hồi quy vòng đời Phiếu kiểm nghiệm (TestResult Workflow)**
> Tuân thủ FDA 21 CFR Part 11 và GMP-WHO Annex 11.

---

## 1. VÒNG ĐỜI CHUẨN MỰC CỦA TEST RESULT

Phiếu kiểm nghiệm trong PQM 3.0 tuân thủ máy trạng thái hữu hạn 5 pha:

```text
DRAFT (Dự thảo phân tích)
  ↓ [LAB/QC nhập liệu & gửi soát xét]
SUBMITTED (Đã nộp chờ soát xét)
  ↓ [QC/QA soát xét chuyên môn & chốt kết quả]
FINAL (Đã hoàn tất phân tích kỹ thuật)
  ↓ [QA/ADMIN soát xét & ký điện tử 21 CFR Part 11]
APPROVED (Đã phê duyệt chính thức)
  ↓ [QA/ADMIN kích hoạt kiểm nghiệm lại theo CAPA]
SUPERSEDED (Bị thay thế - Terminal State)
```

---

## 2. KẾT QUẢ KIỂM THỬ HỒI QUY CHI TIẾT

| Test Case | Chuyển đổi trạng thái    | Vai trò thực hiện (Actor) | Điều kiện tiên quyết                             | Kết quả kỳ vọng                        | Kết quả thực tế      | Trạng thái  |
| :-------- | :----------------------- | :------------------------ | :----------------------------------------------- | :------------------------------------- | :------------------- | :---------: |
| **TR-01** | `DRAFT -> SUBMITTED`     | LAB / QC / QA             | Phiếu có kết quả hợp lệ                          | Cho phép chuyển                        | Cho phép             | ✅ **PASS** |
| **TR-02** | `SUBMITTED -> FINAL`     | QC / QA / ADMIN           | Các chỉ tiêu đã được soát xét                    | Cho phép chuyển                        | Cho phép             | ✅ **PASS** |
| **TR-03** | `SUBMITTED -> FINAL`     | LAB                       | —                                                | Từ chối (LAB không được tự chốt FINAL) | Bị chặn với lỗi RBAC | ✅ **PASS** |
| **TR-04** | `FINAL -> APPROVED`      | QA / ADMIN                | **Bắt buộc Chữ ký số 21 CFR Part 11 hợp lệ**     | Cho phép phê duyệt và ghi nhận chữ ký  | Phê duyệt thành công | ✅ **PASS** |
| **TR-05** | `FINAL -> APPROVED`      | QA / ADMIN                | **Không có chữ ký số**                           | Từ chối: Thiếu chữ ký điện tử hợp lệ   | Bị chặn              | ✅ **PASS** |
| **TR-06** | `FINAL -> APPROVED`      | QA / ADMIN                | **Chữ ký bị sai mã băm / giả mạo**               | Từ chối: Chữ ký không toàn vẹn         | Bị chặn              | ✅ **PASS** |
| **TR-07** | `FINAL -> APPROVED`      | QC / LAB                  | Có chữ ký                                        | Từ chối: Chỉ QA/ADMIN có thẩm quyền    | Bị chặn              | ✅ **PASS** |
| **TR-08** | `APPROVED -> SUPERSEDED` | QA / ADMIN                | **Bắt buộc có lý do giải trình kiểm nghiệm lại** | Cho phép chuyển sang SUPERSEDED        | Cho phép             | ✅ **PASS** |
| **TR-09** | `APPROVED -> SUPERSEDED` | QA / ADMIN                | Không có lý do                                   | Từ chối: Bắt buộc lý do                | Bị chặn              | ✅ **PASS** |
| **TR-10** | `APPROVED -> SUPERSEDED` | QC / LAB                  | Có lý do                                         | Từ chối: Chỉ QA/ADMIN                  | Bị chặn              | ✅ **PASS** |
| **TR-11** | `SUPERSEDED -> ANY`      | ADMIN / QA                | Bất kỳ                                           | Từ chối tuyệt đối (Terminal State)     | Bị chặn              | ✅ **PASS** |
| **TR-12** | `DRAFT -> APPROVED`      | QA                        | Bỏ qua SUBMITTED/FINAL                           | Từ chối (Phải tuần tự qua FSM)         | Bị chặn              | ✅ **PASS** |

---

## 3. GIẢI QUYẾT XUNG ĐỘT CONTRACT (WF-013 & WF-021)

- **Trước refactor**: Có sự nhầm lẫn giữa `TestResult.RELEASED` và `Batch.RELEASED`.
- **Sau refactor**:
  - `TestResult` dừng lại ở trạng thái cao nhất là `APPROVED`.
  - `Batch` mới là thực thể có trạng thái `RELEASED` (Xuất xưởng lô).
  - Tuyệt đối không dùng `TestResult.workflowStatus = 'RELEASED'` để đại diện cho việc xuất xưởng Lô.
