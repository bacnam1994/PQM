# PHÂN HỆ 15: COA (CERTIFICATE OF ANALYSIS) WORKFLOW

## (QUY TRÌNH XUẤT PHIẾU PHÂN TÍCH KẾT QUẢ & XÁC THỰC CÔNG KHAI)

> **Mã phân hệ**: `MOD-15`  
> **Tài liệu**: `docs/workflows/MOD_15_COA_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo bản in CoA, đọc dữ liệu từ Evaluation Snapshot, định dạng khoa học các giá trị kiểm nghiệm, tạo mã QR xác thực công khai, xuất file PDF và lưu vết kiểm toán.

---

### 1. MỤC ĐÍCH (PURPOSE)

Sinh ra tài liệu pháp lý đại diện cho chất lượng của lô sản phẩm trước cơ quan quản lý và khách hàng. Đảm bảo:

1. **Tuyệt đối không tính toán lại (No Dynamic Re-calculation)**: Toàn bộ số liệu trên CoA phải được sao chép nguyên trạng từ `EvaluationSnapshot` đã đóng băng của Lô.
2. **Không tự nội suy (No UI Interpolation)**: Khắc phục triệt để lỗi cũ khi giao diện CoA tự chạy vòng lặp bù số liệu.
3. **Tính minh thực và chống giả mạo**: Mỗi bản CoA đều có mã QR tra cứu tính toàn vẹn chữ ký điện tử.

---

### 2. NGUỒN DỮ LIỆU CỦA COA (SINGLE SOURCE OF TRUTH)

```
┌─────────────────────────────────────────────────────────────┐
│ EVALUATION SNAPSHOT (Bản ghi thẩm định chất lượng đã khóa)  │
│ - engineVersion, evaluatedAt, overallStatus: PASS           │
│ - criterionResults[]:                                       │
│   ├── criteriaName: "Độ ẩm", value: "7.2", isPass: true     │
│   ├── criteriaName: "Vi sinh", isExempted: true             │
│   └── alternateState: "EXEMPTED", alternateNote: "..."      │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Đọc nguyên vẹn 100%)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ COA RENDER ENGINE (Giao diện Xem & In CoA - SC-14)          │
│ - Render trực tiếp ra bảng kết quả                          │
│ - Hiển thị ghi chú miễn kiểm tự động từ alternateNote       │
│ - KHÔNG TỰ CHẠY LOGIC TÍNH TOÁN ĐẠT / KHÔNG ĐẠT             │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. QUY ĐỊNH HIỂN THỊ KẾT QUẢ TRÊN COA

1. **Chỉ tiêu bình thường có kết quả**:
   - Cột "Yêu cầu kỹ thuật": Lấy từ TCCS Snapshot.
   - Cột "Kết quả": Hiển thị giá trị chuẩn hóa (áp dụng định dạng khoa học $\times 10^n$ nếu là vi sinh hoặc số thập phân theo quy định).
2. **Chỉ tiêu thuộc diện Miễn kiểm (`EXEMPTED`)**:
   - Cột "Kết quả": Hiển thị ký hiệu `"Đạt (*)"` hoặc `"- (*)"`.
   - Chân trang CoA: Tự động in dòng chú thích pháp lý từ `alternateNote`:
     > _"(_) Miễn kiểm tra theo quy định của Tiêu chuẩn cơ sở khi chỉ tiêu [Tên chỉ tiêu chính] đã đạt yêu cầu."\*
3. **Chỉ tiêu qua thử nghiệm thay thế (`TRIGGERED_PASS`)**:
   - Cột "Kết quả": Hiển thị giá trị đạt được từ lần thử thay thế kèm số phiếu kiểm nghiệm bổ sung.

---

### 4. MÃ QR VÀ XÁC THỰC CÔNG KHAI (PUBLIC VERIFICATION)

- Mỗi trang CoA in ra bắt buộc có mã QR chứa URL: `https://v-biotech.web.app/verify/{batchId}`.
- Khi quét mã QR, trang xác thực công khai hiển thị:
  - Tên sản phẩm, Số lô, Ngày sản xuất, Hạn dùng.
  - Tình trạng xuất xưởng chính thức (`RELEASED` hay `BLOCKED`).
  - Danh tính người ký duyệt và thời gian ký số CFR Part 11.

---

### 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-COA-01`: CoA chỉ được phép xuất khi Lô đã có `EvaluationSnapshot` ở trạng thái `PASS`.
- `AC-COA-02`: Giao diện CoA tuyệt đối không chứa logic tự phân giải hay tự nội suy kết quả.
- `AC-COA-03`: Mọi chỉ tiêu được miễn kiểm theo Alternate Rule đều phải có chú thích chân trang rõ ràng.
