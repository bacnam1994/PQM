# PHÂN HỆ 12: CAPA WORKFLOW

## (QUY TRÌNH HÀNH ĐỘNG KHẮC PHỤC & PHÒNG NGỪA)

> **Mã phân hệ**: `MOD-12`  
> **Tài liệu**: `docs/workflows/MOD_12_CAPA_WORKFLOW.md`  
> **Phạm vi**: Khởi tạo CAPA từ OOS hoặc Sai lệch (Deviation), lập kế hoạch khắc phục, phân công thực hiện, giám sát thời hạn (Deadline tracking) và thẩm định hiệu quả (Effectiveness Check).

---

### 1. MỤC ĐÍCH (PURPOSE)

Đảm bảo các nguyên nhân gốc rễ (Root Cause) gây ra lỗi chất lượng hoặc sai lệch quy trình được triệt tiêu hoàn toàn, ngăn ngừa sự tái diễn (Recurrence Prevention) theo chuẩn cGMP và ISO 9001.

### 2. VÒNG ĐỜI TRẠNG THÁI CAPA (STATE MACHINE)

```
[DRAFT] ──(Trình duyệt)──► [PLAN_APPROVED] ──(Phân công)──► [IN_PROGRESS]
                                                                │
[EFFECTIVE_CLOSED] ◄──(Đạt hiệu quả)── [EFFECTIVENESS_CHECK] ◄──┘ (Hoàn tất thực hiện)
         │                                      │
         ▼                                      ▼ (Không đạt hiệu quả)
     [ARCHIVED]                           [RE_EVALUATED]
```

### 3. QUY ĐỊNH THỜI HẠN & GIÁM SÁT

- Mỗi hành động CAPA phải có `assignedTo` (Người chịu trách nhiệm) và `dueDate` (Hạn chót).
- Khi quá hạn (`dueDate < Today`), hệ thống gửi thông báo cảnh báo đỏ trên Dashboard (`SC-01`) và đưa vào danh sách vi phạm hạn cam kết chất lượng.

### 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-CAPA-01`: Mọi CAPA bắt nguồn từ OOS đều phải liên kết mã định danh hồ sơ OOS gốc.
- `AC-CAPA-02`: Đóng hồ sơ CAPA bắt buộc phải trải qua bước Thẩm định hiệu quả (`Effectiveness Check`).
