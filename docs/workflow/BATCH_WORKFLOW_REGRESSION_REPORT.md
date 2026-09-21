# PQM — BATCH WORKFLOW REGRESSION REPORT

> **Báo cáo kiểm thử hồi quy vòng đời Lô sản xuất (Batch Workflow)**
> Tuân thủ PQM System Workflow Master và Ma trận phân quyền GMP.

---

## 1. VÒNG ĐỜI CHUẨN MỰC CỦA LÔ SẢN XUẤT

```text
TẠO LÔ (CREATE)
  ↓
PENDING (Chờ kiểm nghiệm - Trạng thái ban đầu bắt buộc)
  ↓ [Action: START_TESTING (LAB / PRODUCTION / QA)]
TESTING (Đang kiểm nghiệm)
  ├── [Action: RELEASE_BATCH (QA/ADMIN + 7 Release Gates + E-Sign)] ─────────→ RELEASED
  │                                                                              │
  ├── [Action: REJECT_BATCH (QA/ADMIN + Lý do giải trình bắt buộc)] ──→ REJECTED │
  │                                                                       │      │
  └── [Action: BLOCK_BATCH (QA/ADMIN + Lý do giải trình bắt buộc)] ─────┐ │      │
                                                                        │ │      │
  ┌─────────────────────────────────────────────────────────────────────┘ │      │
  ↓                                                                       │      │
BLOCKED ── [Action: UNBLOCK_BATCH (QA/ADMIN + Retest Plan)] ─→ TESTING    │      │
  │                                                                       │      │
  └── [Action: REJECT_BATCH] ─────────────────────────────────────────────┘      │
                                                                                 │
REJECTED ── [Action: REOPEN_BATCH (QA/ADMIN + Thẩm tra CAPA)] ────────→ PENDING   │
                                                                                 │
RELEASED ── [Action: BLOCK_BATCH (QA/ADMIN + Lý do thu hồi khẩn cấp)] ───────────┘
```

---

## 2. MA TRẬN KIỂM THỬ HỒI QUY CHUYỂN TRẠNG THÁI (15 TRANSITIONS)

| ID        | From       | To         | Actor                 | Điều kiện tiên quyết                    | Kết quả kỳ vọng                                   | Kết quả thực tế     | Trạng thái  |
| :-------- | :--------- | :--------- | :-------------------- | :-------------------------------------- | :------------------------------------------------ | :------------------ | :---------: |
| **BW-01** | `CREATE`   | `PENDING`  | Mọi vai trò           | Khởi tạo Lô mới                         | Bắt buộc gán `PENDING`                            | `PENDING`           | ✅ **PASS** |
| **BW-02** | `CREATE`   | `TESTING`  | Mọi vai trò           | Khởi tạo Lô mới                         | Bị chặn hoặc cưỡng chế về `PENDING`               | Bị chặn / Cưỡng chế | ✅ **PASS** |
| **BW-03** | `PENDING`  | `TESTING`  | LAB / PRODUCTION / QA | Hành động `START_TESTING`               | Cho phép chuyển                                   | Thành công          | ✅ **PASS** |
| **BW-04** | `PENDING`  | `RELEASED` | QA / ADMIN            | Bất kỳ                                  | Từ chối: Không được nhảy cóc qua TESTING          | Bị chặn             | ✅ **PASS** |
| **BW-05** | `PENDING`  | `REJECTED` | QA / ADMIN            | **Bắt buộc có lý do**                   | Cho phép chuyển                                   | Thành công          | ✅ **PASS** |
| **BW-06** | `PENDING`  | `REJECTED` | PRODUCTION / LAB      | Có lý do                                | Từ chối: Chỉ QA/ADMIN                             | Bị chặn             | ✅ **PASS** |
| **BW-07** | `TESTING`  | `PENDING`  | Mọi vai trò           | Bất kỳ                                  | Từ chối: Không được quay lại PENDING từ TESTING   | Bị chặn             | ✅ **PASS** |
| **BW-08** | `TESTING`  | `RELEASED` | QA / ADMIN            | **7 Release Gates + E-Signature**       | Cho phép xuất xưởng                               | Thành công          | ✅ **PASS** |
| **BW-09** | `TESTING`  | `RELEASED` | PRODUCTION / QC       | Có chữ ký                               | Từ chối: Chỉ QA/ADMIN                             | Bị chặn             | ✅ **PASS** |
| **BW-10** | `TESTING`  | `REJECTED` | QA / ADMIN            | **Bắt buộc có lý do giải trình**        | Cho phép từ chối                                  | Thành công          | ✅ **PASS** |
| **BW-11** | `TESTING`  | `BLOCKED`  | QA / ADMIN            | **Bắt buộc có lý do khóa lô**           | Cho phép khóa Lô                                  | Thành công          | ✅ **PASS** |
| **BW-12** | `BLOCKED`  | `TESTING`  | QA / ADMIN            | **Bắt buộc có lý do / Kế hoạch retest** | Cho phép mở khóa kiểm nghiệm lại                  | Thành công          | ✅ **PASS** |
| **BW-13** | `BLOCKED`  | `REJECTED` | QA / ADMIN            | **Bắt buộc có lý do loại bỏ**           | Cho phép từ chối                                  | Thành công          | ✅ **PASS** |
| **BW-14** | `RELEASED` | `BLOCKED`  | QA / ADMIN            | **Bắt buộc có lý do thu hồi (Recall)**  | Cho phép thu hồi khẩn cấp                         | Thành công          | ✅ **PASS** |
| **BW-15** | `REJECTED` | `PENDING`  | QA / ADMIN            | **Bắt buộc có lý do thẩm tra CAPA**     | Cho phép mở lại Lô để xử lý CAPA                  | Thành công          | ✅ **PASS** |
| **BW-16** | `RELEASED` | `TESTING`  | ADMIN                 | Bất kỳ                                  | Từ chối: Đã xuất xưởng không thể quay lại TESTING | Bị chặn             | ✅ **PASS** |
| **BW-17** | `REJECTED` | `RELEASED` | ADMIN                 | Bất kỳ                                  | Từ chối: Đã REJECTED không thể release trực tiếp  | Bị chặn             | ✅ **PASS** |
