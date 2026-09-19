# 🏷️ STATUS MAP — BẢN ĐỒ TRẠNG THÁI TOÀN HỆ THỐNG PQM

> **Phiên bản:** 1.0.0-BASELINE  
> **Nguyên tắc cốt lõi:** Tách bạch tuyệt đối Quality Status khỏi Workflow Status

---

## 1. MA TRẬN PHÂN ĐỊNH TRẠNG THÁI (STATUS DECOUPLING MATRIX)

### 1.1. Chất lượng Kỹ thuật (Canonical Quality Status)

Chỉ gồm đúng 4 trạng thái tất định, do **Domain Quality Engine** quyết định:

- **`PASS`**: Tất cả chỉ tiêu kỹ thuật hợp lệ đều đạt tiêu chuẩn, hoặc chỉ tiêu phụ được miễn trừ hợp lệ qua quy tắc thay thế.
- **`FAIL`**: Tồn tại ít nhất một chỉ tiêu kỹ thuật bắt buộc không đạt (OOS) và không thể bù đắp bởi quy tắc thay thế.
- **`PENDING`**: Phiếu kiểm nghiệm chưa hoàn tất (còn chỉ tiêu trống giá trị, đang nuôi cấy vi sinh...).
- **`UNKNOWN`**: Phiếu kiểm nghiệm rỗng, không có dữ liệu chỉ tiêu hoặc không xác định được tiêu chuẩn đối chiếu.

### 1.2. Vòng đời Tài liệu / Phê duyệt (Workflow Status)

Quản lý chu trình hành chính và phê duyệt chữ ký số, độc lập với kết quả kiểm nghiệm:

- **`DRAFT`**: Bản nháp đang nhập liệu bởi KNV / Lab.
- **`SUBMITTED`**: Đã nộp phiếu, chờ QC/QA soát xét.
- **`FINAL`**: Phiếu đã được chốt số liệu kỹ thuật bởi phòng kiểm nghiệm.
- **`APPROVED`**: Phiếu đã được phê duyệt bằng chữ ký số bởi QA.
- **`RELEASED`**: Phiếu thuộc Lô đã được phê duyệt xuất xưởng chính thức.
- **`REJECTED`**: Phiếu hoặc Lô bị từ chối do vi phạm quy chuẩn.
- **`SUPERSEDED`**: Phiếu kiểm nghiệm cũ bị thay thế bởi phiếu kiểm nghiệm mới (Re-test).

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                      QUY TẮC BẤT BIẾN ALCOA+ & GMP                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  • APPROVED  ≠ PASS     (Phiếu kiểm nghiệm có thể được APPROVE với kết quả FAIL)║
║  • FINAL     ≠ PASS     (Phiếu FINAL có thể mang kết luận FAIL)               ║
║  • RELEASED  ≠ PASS     (Trạng thái xuất xưởng của Lô, không phải của phiếu)   ║
║  • REJECTED  ≠ FAIL     (Trạng thái từ chối hành chính của Lô)                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. MA TRẬN ÁNH XẠ GIA PHẢ (GENEALOGY STATUS MAPPING)

Để khắc phục triệt để lỗi ép trạng thái trung gian (`PENDING` $\to$ `FAIL`) tại `src/services/ai/batchGenealogyService.ts`:

| Trạng thái Phiếu (`overallStatus`) | Trạng thái Gia phả Cũ (Bị lỗi) | Trạng thái Gia phả Chuẩn (Mới) | Huy hiệu hiển thị (UI Badge)   |
| :--------------------------------- | :----------------------------- | :----------------------------- | :----------------------------- |
| `PASS`                             | `OK`                           | **`OK`**                       | 🟢 ĐẠT (Xanh lá)               |
| `FAIL`                             | `FAIL`                         | **`FAIL`**                     | 🔴 KHÔNG ĐẠT (Đỏ)              |
| `PENDING`                          | ❌ `FAIL`                      | **`PENDING`**                  | 🟡 ĐANG KIỂM NGHIỆM (Vàng/Cam) |
| `UNKNOWN`                          | ❌ `FAIL`                      | **`UNKNOWN`**                  | ⚪ CHƯA XÁC ĐỊNH (Xám)         |

---

## 3. THỨ TỰ ƯU TIÊN PHÂN GIẢI TRẠNG THÁI (CANONICAL PRECEDENCE HIERARCHY)

Khi truy vấn chất lượng của một phiếu kiểm nghiệm, hệ thống phải tuân thủ nghiêm ngặt 3 tầng ưu tiên:

```
                  ┌──────────────────────────────────────────────┐
                  │ TẦNG 1: EVALUATION SNAPSHOT HỢP LỆ           │
                  │ - Mã băm SHA-256 đối chiếu khớp 100%         │
                  │ - Không bị đánh dấu invalidation             │
                  │ - Giữ nguyên kết quả lịch sử niêm phong      │
                  └──────────────────────┬───────────────────────┘
                                         │ (Nếu không có snapshot)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │ TẦNG 2: RE-EVALUATION TỪ SOURCE DATA         │
                  │ - Tính toán trực tiếp từ results[] / TCCS    │
                  │ - Áp dụng QualityEvaluationEngine            │
                  │ - Xác định PASS / FAIL / PENDING / UNKNOWN   │
                  └──────────────────────┬───────────────────────┘
                                         │ (Nếu rỗng/không tiêu chí)
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │ TẦNG 3: LEGACY STORED STATUS FALLBACK        │
                  │ - Chỉ dùng cho mục đích tương thích ngược    │
                  │ - Tuyệt đối không cho phép Stored PASS       │
                  │   ghi đè khi có chỉ tiêu FAIL                │
                  └──────────────────────────────────────────────┘
```

---

## 4. QUY TẮC TÍNH TOÁN TỶ LỆ ĐẠT (PASS RATE & FULL TESTING INVARIANTS)

1. **Khi không có bài kiểm nghiệm nào (`bTests.length === 0`)**:
   - `passRate` bắt buộc phải là **`null`** hoặc hiển thị **`N/A`**.
   - Tuyệt đối nghiêm cấm logic cũ: `bTests.length === 0 ? 100`.
2. **Khái niệm `isFullyTested`**:
   - Chỉ được kết luận `isFullyTested = true` khi và chỉ khi:
     $$\text{Tất cả chỉ tiêu bắt buộc} + \text{Tất cả phép thử yêu cầu} + \text{Đầy đủ số liệu thực tế} = \text{HOÀN THÀNH}$$
   - Không được coi việc "Có ít nhất một kết quả PASS" là đã kiểm nghiệm đầy đủ.
