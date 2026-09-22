# PHÂN HỆ 03: TCCS & SPECIFICATIONS WORKFLOW

## (QUY TRÌNH QUẢN LÝ TIÊU CHUẨN CƠ SỞ & CHỈ TIÊU KIỂM NGHIỆM)

> **Mã phân hệ**: `MOD-03`  
> **Tài liệu**: `docs/workflows/MOD_03_TCCS_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo Tiêu chuẩn cơ sở, cấu hình Chỉ tiêu chất lượng (Quality Criteria), Chỉ tiêu An toàn (Safety Criteria), Quy tắc chỉ tiêu thay thế (Alternate Rules), Quản lý phiên bản (Versioning) và Đóng băng tiêu chuẩn (Specification Freezing/Snapshotting).

---

### 1. MỤC ĐÍCH (PURPOSE)

Thiết lập "Thước đo chất lượng pháp lý" cho từng sản phẩm. Định nghĩa toàn bộ các yêu cầu kỹ thuật (Cảm quan, Định tính, Định lượng, Giới hạn nhiễm khuẩn, Kim loại nặng...) mà sản phẩm bắt buộc phải thỏa mãn để được phép xuất xưởng. Đảm bảo tính bất biến của tiêu chuẩn theo từng lô sản xuất.

### 2. ĐỐI TƯỢNG THAM GIA (ACTORS)

- **QC Manager / R&D**: Soạn thảo bộ chỉ tiêu, phương pháp kiểm nghiệm, giới hạn chấp nhận và quy tắc thay thế.
- **QA Manager**: Thẩm tra, ký duyệt ban hành tiêu chuẩn chính thức (Hiệu lực pháp lý).
- **System Engine**: Tự động đánh số phiên bản, khóa bất biến khi có Lô tham chiếu.

### 3. SỰ KIỆN KÍCH HOẠT (TRIGGER)

- Khi ban hành sản phẩm mới.
- Khi có Quyết định thay đổi tiêu chuẩn (Change Control): Sửa đổi mức giới hạn, bổ sung chỉ tiêu an toàn theo khuyến cáo Bộ Y tế / Dược điển mới.

### 4. DỮ LIỆU ĐẦU VÀO (INPUT)

- `id`: UUID bất biến của TCCS.
- `productId`: ID sản phẩm cha.
- `code`: Mã TCCS (VD: `TCCS-01:2024/VBT`).
- `version`: Số phiên bản tăng dần (VD: `1`, `2`, `3`).
- `issueDate`: Ngày ban hành chính thức.
- `effectiveDate`: Ngày bắt đầu có hiệu lực sản xuất.
- `criteria`: Mảng các chỉ tiêu chất lượng và an toàn. Mỗi chỉ tiêu bao gồm:
  - `id`: UUID duy nhất của chỉ tiêu (BẮT BUỘC, không dùng tên để làm ID).
  - `code`: Mã chỉ tiêu ngắn (VD: `CRIT_DO_AM`).
  - `name`: Tên chỉ tiêu (VD: `Độ ẩm`).
  - `type`: Kiểu dữ liệu (`NUMBER` hoặc `TEXT`).
  - `unit`: Đơn vị tính (VD: `%`, `cfu/g`, `mg/viên`).
  - `min`, `max`: Giới hạn số học (nếu là `NUMBER`).
  - `expectedText`: Giá trị chuẩn văn bản (nếu là `TEXT`).
  - `analysisMethod`: Phương pháp thử (VD: `DĐVN V, Phụ lục 9.6`).
- `alternateRules`: Danh mục các quy tắc chỉ tiêu thay thế (Xem chi tiết tại `MOD-09`):
  - `id`: UUID của quy tắc.
  - `mainCriterionId`: ID của chỉ tiêu chính.
  - `altCriterionId`: ID của chỉ tiêu phụ thuộc / thay thế.
  - `type`: Kiểu quy tắc (`FAIL_RETRY` hoặc `CONDITIONAL_CHECK`).
  - `condition`: Cấu trúc điều kiện kích hoạt dạng có cấu trúc (AST/Schema).
  - `displayNote`: Văn bản ghi chú tự động in trên TCCS và CoA.

### 5. ĐIỀU KIỆN TIÊN QUYẾT (PRECONDITIONS)

- Sản phẩm cha (`productId`) phải đang ở trạng thái `ACTIVE`.
- Mã TCCS không được trùng lặp với phiên bản đang có hiệu lực.
- Mọi chỉ tiêu phải có `id` duy nhất và phương pháp thử rõ ràng.

### 6. CÁC BƯỚC THỰC THI (STEPS)

1. **Khởi tạo bản thảo**: QC tạo TCCS mới ở trạng thái `DRAFT` tại `SC-06` (TCCS Editor).
2. **Cấu hình chỉ tiêu & quy tắc thay thế**: Khai báo danh mục chỉ tiêu kèm các ràng buộc `min/max/expectedText`. Thiết lập liên kết quy tắc thay thế giữa các `criterionId`.
3. **Thẩm định & Ký điện tử**: QA Manager kiểm tra đối chiếu với Hồ sơ đăng ký thuốc. Ký số điện tử phê duyệt.
4. **Ban hành & Chuyển dịch hiệu lực**:
   - TCCS mới chuyển sang trạng thái `ACTIVE`.
   - Phiên bản TCCS cũ của sản phẩm đó tự động chuyển sang trạng thái `SUPERSEDED`.
5. **Cơ chế Snapshot cho Lô sản xuất**: Khi một Lô sản xuất được tạo ra, hệ thống tự động copy toàn bộ nội dung TCCS hiện hành thành một bản **Frozen TCCS Snapshot** lưu vĩnh viễn cùng Lô đó.

### 7. BẢNG QUYẾT ĐỊNH (DECISION TABLE)

| Tình huống                                                   | Quy tắc xử lý                                                                                       | Trạng thái tiếp theo   |
| :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :--------------------- |
| Sửa đổi TCCS khi **chưa có Lô nào sử dụng**                  | Cho phép sửa trực tiếp bản thảo                                                                     | Giữ nguyên `DRAFT`     |
| Sửa đổi TCCS khi **đã có Lô sản xuất liên kết**              | CẤM SỬA TRỰC TIẾP. Bắt buộc tạo phiên bản mới (`Clone to New Version`) qua quy trình Change Control | Bản mới: `DRAFT` (v+1) |
| Chỉ tiêu thay thế trỏ đến cùng một chỉ tiêu (`main === alt`) | Báo lỗi logic 400 Bad Request, chặn lưu                                                             | Form báo đỏ            |
| Tồn tại vòng lặp quy tắc thay thế (A thay B, B thay A)       | Báo lỗi Circular Dependency, chặn lưu                                                               | Form báo đỏ            |

### 8. VÒNG ĐỜI TRẠNG THÁI (STATE MACHINE)

```
[DRAFT] ──(Ký duyệt QA)──► [ACTIVE] ──(Có phiên bản mới)──► [SUPERSEDED]
   │                                                             ▲
   └────────(Hủy bỏ)────────► [ARCHIVED] ◄───────────────────────┘
```

### 9. DỮ LIỆU ĐẦU RA (OUTPUT)

- Bản ghi TCCS phiên bản chính thức.
- Bảng ghi chú quy tắc thay thế tự động sinh ra cho các mẫu in pháp lý.

### 10. NGUYÊN TẮC BẤT DI BẤT DỊCH (FROZEN SPEC PRINCIPLE)

- Mọi thay đổi trong TCCS phiên bản mới **KHÔNG BAO GIỜ** được phép làm thay đổi cách đánh giá của các Lô đã sản xuất theo TCCS phiên bản cũ. Các Lô cũ vĩnh viễn được thẩm định dựa trên bản **TCCS Snapshot** lúc tạo lô.

### 11. YÊU CẦU KIỂM TOÁN (AUDIT REQUIREMENT)

- Lưu lại lịch sử toàn bộ các lần thay đổi (Diff so sánh các chỉ tiêu thay đổi giữa version cũ và version mới).

### 12. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-TCCS-01`: Mỗi chỉ tiêu bắt buộc có `id` định danh duy nhất.
- `AC-TCCS-02`: Tại một thời điểm, một sản phẩm chỉ có duy nhất 1 bản TCCS ở trạng thái `ACTIVE`.
- `AC-TCCS-03`: Tuyệt đối không cho phép sửa trực tiếp TCCS đã có Lô sản xuất liên kết.
