# BỘ QUY TẮC NGHIỆP VỤ 06: ALTERNATE RULES CATALOG

## (QUY TẮC CHỈ TIÊU THAY THẾ & PHỤ THUỘC TRONG KIỂM NGHIỆM)

> **Mã tài liệu**: `BR-CATALOG-06`  
> **Thư mục**: `docs/business-rules/BR_06_ALTERNATE_RULES.md`  
> **Phân hệ liên quan**: `MOD-09` (Alternate Rules Workflow)  
> **Tầm quan trọng**: 🔴 **CRITICAL - ĐỘC QUYỀN GIẢI QUYẾT LỖI TÁI PHÁT CỦA PQM**

---

### BR-ALT-001: Quy Tắc Thử Nghiệm Lặp Lại Khi Không Đạt (`FAIL_RETRY`)

- **Mục đích**: Hiện thực hóa quy chuẩn Dược điển về việc thử nghiệm bổ sung khi lần thử đầu tiên của chỉ tiêu chính không đạt yêu cầu kỹ thuật.
- **Định nghĩa cặp chỉ tiêu**:
  - `mainCriterion`: Chỉ tiêu thử nghiệm lần 1 (Ví dụ: `Độ rã lần 1`).
  - `altCriterion`: Chỉ tiêu thử nghiệm lần 2 (Ví dụ: `Độ rã lần 2 - Thử thêm 12 viên`).
- **Bảng Quyết Định (Decision Table)**:

| Kết quả Chỉ tiêu chính (`main`) | Kết quả Chỉ tiêu phụ (`alt`) |    Trạng thái `altCriterion`     | Trạng thái cụm chỉ tiêu |       Trạng thái toàn phiếu        |
| :-----------------------------: | :--------------------------: | :------------------------------: | :---------------------: | :--------------------------------: |
|             `PASS`              |     _Chưa nhập / Bất kỳ_     | `NOT_APPLICABLE` (Không cần thử) |         `PASS`          | `PASS` (nếu các chỉ tiêu khác đạt) |
|             `FAIL`              |      _Chưa nhập (Rỗng)_      |  `TRIGGERED_PENDING` (Bắt buộc)  |        `PENDING`        |  `PENDING` (Chặn Submit/Approve)   |
|             `FAIL`              |            `PASS`            |         `TRIGGERED_PASS`         |    `PASS (THAY THẾ)`    |    `PASS` (Được cứu thành công)    |
|             `FAIL`              |            `FAIL`            |         `TRIGGERED_FAIL`         |         `FAIL`          |       `FAIL` (Kích hoạt OOS)       |

- **UI Behavior**: Khi `main` là `FAIL`, ô nhập của `alt` tự động sáng lên, viền màu cam, nhãn badge đổi sang _"CHỜ KẾT QUẢ"_.
- **Test Cases**: `TC-BR-ALT-001-A` (Main PASS ➔ Alt EXEMPTED), `TC-BR-ALT-001-B` (Main FAIL + Alt rỗng ➔ PENDING), `TC-BR-ALT-001-C` (Main FAIL + Alt PASS ➔ Đạt theo thay thế).

---

### BR-ALT-002: Quy Tắc Kiểm Tra Có Điều Kiện (`CONDITIONAL_CHECK`)

- **Mục đích**: Kiểm tra chỉ tiêu phụ chỉ khi kết quả của chỉ tiêu chính thỏa mãn một điều kiện ngưỡng (Ví dụ: Chỉ thử nghiệm chỉ tiêu độc tính/kim loại nặng khi hàm lượng tro vượt mức).
- **Cấu trúc điều kiện**:
  ```typescript
  condition: {
    operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CONTAINS';
    thresholdValue: number | string;
  }
  ```
- **Bảng Quyết Định (Decision Table)**:

|     Điều kiện của `main` thỏa mãn?     | Kết quả `alt` | Trạng thái `altCriterion` |     Kết luận cụm chỉ tiêu      |
| :------------------------------------: | :-----------: | :-----------------------: | :----------------------------: |
| **KHÔNG** (Chưa chạm ngưỡng kích hoạt) |  _Chưa nhập_  |  `EXEMPTED` (Miễn kiểm)   |   `PASS` (Miễn kiểm hợp lệ)    |
|    **CÓ** (Đã kích hoạt điều kiện)     |  _Chưa nhập_  |    `TRIGGERED_PENDING`    | `PENDING` (Bắt buộc phải kiểm) |
|    **CÓ** (Đã kích hoạt điều kiện)     |    `PASS`     |     `TRIGGERED_PASS`      |             `PASS`             |
|    **CÓ** (Đã kích hoạt điều kiện)     |    `FAIL`     |     `TRIGGERED_FAIL`      |             `FAIL`             |

- **Test Cases**: `TC-BR-ALT-002-A` (Tro $\le 1.0\%$ ➔ Miễn kiểm kim loại nặng), `TC-BR-ALT-002-B` (Tro $> 1.0\%$ ➔ Bắt buộc kiểm kim loại nặng).

---

### BR-ALT-003: Cấm Tuyệt Đối Lọc Ẩn Chỉ Tiêu Khỏi Giao Diện (No Criterion Filtering Rule)

- **Mục đích**: Giải quyết tận gốc lỗi giao diện: Không cho phép UI tự ý ẩn đi các dòng chỉ tiêu phụ thuộc khi chưa kích hoạt.
- **Quy tắc cấm kỵ (Forbidden Behavior)**:
  - **CẤM** dùng `criteria.filter(...)` để loại bỏ các chỉ tiêu có trạng thái `NOT_TRIGGERED` hoặc `EXEMPTED`.
  - Toàn bộ 100% chỉ tiêu được định nghĩa trong TCCS Snapshot **BẮT BUỘC PHẢI LUÔN XUẤT HIỆN** trên Form nhập liệu PKN (`SC-12`).
- **Quy chuẩn hiển thị UI**:
  - Chỉ tiêu ở trạng thái `NOT_TRIGGERED` hoặc `EXEMPTED`:
    - Ô `input` đặt thuộc tính `disabled = true`.
    - Placeholder hiển thị: _"Miễn kiểm (tự động)"_.
    - Badge trạng thái hiển thị màu xám/teal: `[MIỄN KIỂM]`.
- **Test Cases**: `TC-BR-ALT-003-A` (Số dòng chỉ tiêu trên UI luôn bằng tổng số chỉ tiêu trong TCCS).

---

### BR-ALT-004: Tự Động Sinh Chú Thích Pháp Lý Trên CoA (CoA Exemption Footnote)

- **Mục đích**: Bảo đảm tính pháp lý của CoA in ra khi có chỉ tiêu không cần làm thử nghiệm thực tế.
- **Quy tắc**:
  - Khi `altCriterion.alternateState === 'EXEMPTED'`:
    - Cột kết quả trên bảng CoA ghi: `"Đạt (*)"` hoặc `"- (*)"`.
    - Tự động sinh dòng chú thích cuối trang (Footnote):
      > _"(_) Miễn kiểm tra theo quy định của Tiêu chuẩn cơ sở khi chỉ tiêu [Tên chỉ tiêu chính] đã đạt."\*
  - CoA chỉ được phép đọc trực tiếp `alternateState` từ bản `EvaluationSnapshot` đã đóng băng, **CẤM TỰ TÍNH TOÁN LẠI Ở CLIENT**.
- **Test Cases**: `TC-BR-ALT-004-A` (CoA in ra có đầy đủ dòng chú thích chân trang khi có chỉ tiêu miễn kiểm).
