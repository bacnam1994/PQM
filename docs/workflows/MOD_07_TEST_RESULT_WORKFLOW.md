# PHÂN HỆ 07: TEST RESULT (PKN) WORKFLOW

## (QUY TRÌNH QUẢN LÝ PHIẾU KIỂM NGHIỆM & NHẬP LIỆU PHÒNG LAB)

> **Mã phân hệ**: `MOD-07`  
> **Tài liệu**: `docs/workflows/MOD_07_TEST_RESULT_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo Phiếu kiểm nghiệm (PKN), lấy mẫu, giao việc cho Kiểm nghiệm viên (Analyst), nhập số liệu phân tích, thẩm tra kết quả, ký duyệt và đóng băng Evaluation Snapshot.

---

### 1. MỤC ĐÍCH (PURPOSE)

Quản lý toàn bộ quá trình thu thập và thẩm định bằng chứng kỹ thuật phòng thí nghiệm. Đảm bảo:

1. Mọi kết quả kiểm nghiệm đều có nguồn gốc thực chứng (Evidence Before Conclusion).
2. Không có bất kỳ kết luận "Đạt ngầm" hoặc "Rớt ngầm" nào (No Implicit Pass / No Implicit Fail).
3. Khi phiếu kiểm nghiệm được phê duyệt, toàn bộ trạng thái đánh giá được đóng băng vĩnh viễn vào **Evaluation Snapshot** có mã băm bảo mật (Hash).

### 2. ĐỐI TƯỢNG THAM GIA (ACTORS)

- **QC Analyst (Kiểm nghiệm viên)**: Thực hiện phép thử, nhập kết quả thô, nộp phiếu kiểm nghiệm.
- **QC Reviewer (Trưởng phòng/Người thẩm tra)**: Thẩm tra phương pháp, kiểm tra tính toán, ký nháy.
- **QA Manager**: Ký số phê duyệt chính thức (Approved).
- **System Engine**: Tự động đánh giá chỉ tiêu theo thời gian thực và tạo Snapshot.

### 3. SỰ KIỆN KÍCH HOẠT (TRIGGER)

- Khi tiếp nhận mẫu kiểm nghiệm từ xưởng sản xuất hoặc kho nguyên liệu.
- Khi Kiểm nghiệm viên hoàn thành phép thử và nhập kết quả.

### 4. DỮ LIỆU ĐẦU VÀO (INPUT)

- `id`: UUID của Phiếu kiểm nghiệm.
- `reportNumber`: Số phiếu kiểm nghiệm chính thức (Duy nhất, VD: `PKN-240901-01`).
- `batchId`: ID của Lô sản xuất tương ứng.
- `labName`: Tên phòng lab thực hiện (Nội bộ hoặc Chỉ định ngoại kiểm).
- `testDate`: Ngày thực hiện kiểm nghiệm.
- `results`: Mảng kết quả các chỉ tiêu (`TestResultEntry[]`):
  - `criterionId`: ID duy nhất của chỉ tiêu (Ánh xạ từ TCCS Snapshot của Lô).
  - `criteriaName`: Tên chỉ tiêu tại thời điểm kiểm nghiệm.
  - `value`: Giá trị thô được nhập (Số học hoặc Chuỗi văn bản).
  - `isPass`: Kết quả đánh giá sơ bộ (`true`, `false`, `null`).
  - `alternateState`: Trạng thái quy tắc thay thế (`NOT_TRIGGERED`, `TRIGGERED_PENDING`, `TRIGGERED_PASS`, `TRIGGERED_FAIL`, `EXEMPTED`).
- `status`: Trạng thái quy trình (`DRAFT`, `SUBMITTED`, `FINAL`, `APPROVED`, `REJECTED`, `SUPERSEDED`).
- `qualityStatus`: Trạng thái chất lượng kỹ thuật (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`).

### 5. CÁC BƯỚC THỰC THI (STEPS)

1. **Khởi tạo PKN**: Người dùng tạo PKN mới tại `SC-11` / `SC-12`. Hệ thống tự động nạp danh sách chỉ tiêu từ `tccsSnapshot` của Lô.
2. **Nhập liệu & Đánh giá thời gian thực**: Kiểm nghiệm viên nhập kết quả. Động cơ `CriterionEvaluator` và `AlternateRuleResolver` chạy tức thì để xác định trạng thái của từng chỉ tiêu.
3. **Nộp phiếu (Submit)**: Kiểm nghiệm viên kiểm tra tổng thể và bấm "Gửi thẩm tra".
   - Hệ thống kiểm tra điều kiện toàn vẹn: Không còn chỉ tiêu bắt buộc nào bị bỏ trống hoặc ở trạng thái `TRIGGERED_PENDING`.
   - Phiếu chuyển sang `SUBMITTED`.
4. **Thẩm tra (Review)**: QC Reviewer kiểm tra số liệu, xác nhận phương pháp thử. Phiếu chuyển sang `FINAL`.
5. **Ký duyệt & Sinh Snapshot (Approve)**:
   - QA Manager kiểm tra và ký số điện tử.
   - Hệ thống đóng băng kết quả, tạo `EvaluationSnapshot` bất biến kèm mã băm SHA-256.
   - Phiếu chuyển sang `APPROVED`. Cấm mọi thao tác sửa đổi tiếp theo.

### 6. BẢNG QUYẾT ĐỊNH (DECISION TABLE)

| Trạng thái hiện tại | Hành động                     | Điều kiện                                                  | Quyết định của Hệ thống                                                            |
| :------------------ | :---------------------------- | :--------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| `DRAFT`             | Bấm "Gửi thẩm tra" (Submit)   | Còn chỉ tiêu bắt buộc chưa nhập giá trị                    | Chặn Submit, hiển thị danh sách chỉ tiêu thiếu                                     |
| `DRAFT`             | Bấm "Gửi thẩm tra" (Submit)   | Có chỉ tiêu thay thế đang ở trạng thái `TRIGGERED_PENDING` | Chặn Submit, cảnh báo: "Chỉ tiêu phụ đang chờ kết quả"                             |
| `SUBMITTED`         | Sửa giá trị kết quả           | Chỉ Kiểm nghiệm viên được thu hồi về `DRAFT` để sửa        | Thu hồi về `DRAFT` kèm lý do giải trình                                            |
| `APPROVED`          | Bất kỳ ai yêu cầu sửa dữ liệu | Đã có chữ ký điện tử và Evaluation Snapshot                | **CẤM TUYỆT ĐỐI**. Chỉ được phép tạo Phiếu kiểm nghiệm mới thay thế (`SUPERSEDED`) |

### 7. VÒNG ĐỜI TRẠNG THÁI (STATE MACHINE)

```
[DRAFT] ──(Nộp phiếu)──► [SUBMITTED] ──(Thẩm tra)──► [FINAL] ──(Ký duyệt QA)──► [APPROVED]
   ▲                          │                         │                           │
   └──(Thu hồi sửa đổi)───────┘                         ▼                           │
                                                    [REJECTED]                      │
                                                        ▲                           │
                                                        │                           ▼
                                            (Có phiếu mới thay thế) ────► [SUPERSEDED]
```

### 8. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-TR-01`: Cấm nộp phiếu (Submit) khi còn chỉ tiêu bắt buộc hoặc chỉ tiêu thay thế đang chờ kết quả.
- `AC-TR-02`: Khi phiếu đạt trạng thái `APPROVED`, bắt buộc phải có `EvaluationSnapshot` lưu trữ nguyên trạng.
- `AC-TR-03`: Dữ liệu của PKN đã `APPROVED` không thể bị chỉnh sửa dưới bất kỳ hình thức nào.
