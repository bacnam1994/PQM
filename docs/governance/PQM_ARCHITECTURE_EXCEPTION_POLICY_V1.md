# ⚠️ CHÍNH SÁCH QUẢN LÝ NGOẠI LỆ KIẾN TRÚC (ARCHITECTURE EXCEPTION POLICY V1)

> **Mã văn bản:** `PQM_ARCHITECTURE_EXCEPTION_POLICY_V1.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Nguyên tắc cốt lõi:** CẤM tuyệt đối việc tạo workaround hoặc ngoại lệ âm thầm (No Silent Workaround).

---

## 1. NGUYÊN TẮC QUẢN LÝ NGOẠI LỆ

1. **Không có ngoại lệ vô thời hạn**: Mọi ngoại lệ kiến trúc (nếu có lý do kỹ thuật chính đáng bắt buộc phải duy trì tạm thời) **PHẢI** có ngày hết hạn (`Expiration Date`).
2. **Cấm các ghi chú mơ hồ**: Tuyệt đối cấm các comment trong code như `// TODO: fix later`, `// temporary workaround`, `// for now bypass this` mà không gắn với mã định danh ngoại lệ được phê duyệt.
3. **Biện pháp bù đắp bắt buộc (Compensating Control)**: Bất kỳ ngoại lệ nào cũng phải đi kèm với một cơ chế kiểm soát bù đắp (ví dụ: giới hạn phạm vi áp dụng đúng 1 file duy nhất, có rào chắn an ninh bổ sung).

---

## 2. CẤU TRÚC ĐĂNG KÝ NGOẠI LỆ BẮT BUỘC (EXCEPTION RECORD TEMPLATE)

Mọi ngoại lệ muốn được chấp thuận phải lập hồ sơ theo đúng 11 trường thông tin chuẩn tắc:

```text
Exception ID:         EXC-[STT] (ví dụ EXC-001)
Tên ngoại lệ:         ...
Quy tắc bị ảnh hưởng: [Quy tắc trong PQM_ARCHITECTURE_RULES hoặc PQM_WORKFLOW_RULES]
Lớp bị ảnh hưởng:     [Domain / Application / Infrastructure / UI]
Lý do kỹ thuật:       [Tại sao bắt buộc phải có ngoại lệ, không thể giải quyết ngay bằng chuẩn]
Phạm vi áp dụng:      [Đường dẫn chính xác đến file hoặc module duy nhất được phép]
Mức độ rủi ro:        [THẤP / TRUNG BÌNH / CAO]
Chủ sở hữu ngoại lệ:  [Tên kỹ sư / Lead chịu trách nhiệm]
Ngày tạo:             YYYY-MM-DD
Ngày hết hạn:         YYYY-MM-DD (Tối đa không quá 30 ngày kể từ ngày tạo)
Biện pháp bù đắp:     [Kiểm tra giới hạn trong architecture test, logging cảnh báo đặc biệt]
Kế hoạch xóa bỏ:      [Lộ trình thay thế hoàn toàn khi hết hạn]
```

---

## 3. DANH MỤC CÁC NGOẠI LỆ HIỆN HÀNH ĐÃ ĐƯỢC PHÊ DUYỆT (ACTIVE EXCEPTIONS)

| Exception ID | Tên ngoại lệ                    | Quy tắc bị ảnh hưởng              | Phạm vi áp dụng                                       | Ngày hết hạn | Biện pháp bù đắp (Compensating Control)                                                 |
| :----------: | ------------------------------- | --------------------------------- | ----------------------------------------------------- | :----------: | --------------------------------------------------------------------------------------- |
| **EXC-001**  | Thin Adapters Tương Thích Ngược | Direct imports trong legacy tests | 37 files tại `src/services/app/`, `src/repositories/` | `2026-12-31` | Toàn bộ các adapter chỉ re-export thuần túy từ Domain Slices, không chứa logic thứ hai. |

---

## 4. XỬ LÝ NGOẠI LỆ HẾT HẠN HOẶC KHÔNG ĐĂNG KÝ

- Bất kỳ đoạn mã nào vi phạm ranh giới kiến trúc mà **không có Exception ID hợp lệ** hoặc **đã quá hạn (Expired)** sẽ bị coi là một **LỖ HỔNG AN NINH KIẾN TRÚC NGHIÊM TRỌNG**.
- Cổng kiểm soát `npm run workflow:guard` và các bài test trong `tests/architecture/` sẽ lập tức đánh dấu FAIL và chặn việc biên dịch/commit.
