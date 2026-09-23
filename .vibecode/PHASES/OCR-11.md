# PHASE MANIFEST: OCR-11 — REVIEW UI (BẢNG ĐỐI CHIẾU & XÁC NHẬN)

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_
_Nâng cấp MappingConfirmModal thành bảng đối chiếu minh bạch đầy đủ_

---

## 1. Mục Tiêu (Objective)

Nâng cấp `MappingConfirmModal.tsx` từ giao diện xác nhận đơn giản thành **bảng đối chiếu minh bạch** cho phép QA/QC đối soát toàn bộ thông tin:

| Cột               | Nội dung                                                  | Rule       |
| ----------------- | --------------------------------------------------------- | ---------- |
| Tên OCR gốc       | Tên chỉ tiêu chính xác từ phiếu                           | Rule 1     |
| Từ điển dược (📖) | Thuật ngữ chuẩn hóa nếu tìm được                          | OCR-10     |
| Ánh xạ TCCS       | Tên chuẩn + badge cấp độ (LEARNED/EXACT/DICTIONARY/FUZZY) | OCR-10     |
| Trang nguồn       | Số trang tài liệu                                         | Rule 7     |
| Tin cậy           | Badge % màu theo ngưỡng (≥85 xanh / ≥75 vàng / <75 đỏ)    | Rule 11/12 |
| Kết quả           | Giá trị thực đo — highlight đỏ nếu nghi ngờ OCR           | Rule 1, 5  |
| Đơn vị            | Đơn vị đã chuẩn hóa                                       | Rule 4     |
| Giới hạn TC       | Mức tiêu chuẩn (hoàn toàn tách biệt value)                | Rule 5     |

---

## 2. Phạm Vi Công Việc (Scope)

### Sửa đổi

- `src/components/features/MappingConfirmModal.tsx`: Overwrite toàn bộ UI.
  - Thêm fields metadata vào `AIExtractedItem` (từ OCR-10).
  - Bảng gọn cho **HIGH confidence items** — hiển thị đầy đủ 7 cột.
  - Card chi tiết cho **LOW confidence items** — hiển thị tên, badges, cảnh báo OCR, 3 cột dữ liệu, dropdown TCCS.
  - Helper components: `ConfidenceBadge`, `MappingLevelBadge`.
  - Width tối đa: `max-w-4xl` (tăng từ `max-w-2xl`) để chứa bảng đủ cột.

---

## 3. Thiết Kế UI

```
┌─────────────────────────────────────────────────────────────────────┐
│ ✨ Bảng Đối Chiếu Chỉ Tiêu OCR                                  ✕  │
│ 15 chỉ tiêu · 10 tự động · 5 cần xác nhận                         │
├─────────────────────────────────────────────────────────────────────┤
│ ✅ Điền tự động (10)                                                │
│ ┌──────────────┬────────────────┬──────┬──────┬──────┬──────┬─────┐ │
│ │ Tên OCR gốc  │ Ánh xạ TCCS   │ Trang│Tin c.│Kết q.│ Đv.  │Giới │ │
│ ├──────────────┼────────────────┼──────┼──────┼──────┼──────┼─────┤ │
│ │ Loss on dry. │ Độ ẩm [Từ điển]│ 📄1  │ 90%  │ 5.2  │  %   │≤9.0%│ │
│ │ Ash sulfate  │ Tro sulfat [CX]│ 📄2  │ 88%  │ 0.15 │  %   │≤0.5%│ │
│ └──────────────┴────────────────┴──────┴──────┴──────┴──────┴─────┘ │
│                                                                     │
│ ⚠️ Cần xác nhận (5)                                                │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Kim loại As      📖As     📄3  [55%]  [Gần đúng]  ⚠️ Nghi ngờ │ │
│ │ ⚠️ Nghi ngờ nhầm chữ "O" với số 0                               │ │
│ │ ┌──────────┬──────────┬──────────────────────────────────────┐  │ │
│ │ │ Kết quả  │ Đơn vị   │ Giới hạn TC                          │  │ │
│ │ │ O.05 (🔴)│  ppm     │  ≤ 0.1 ppm                          │  │ │
│ │ └──────────┴──────────┴──────────────────────────────────────┘  │ │
│ │ → Ghép với: [-- Bỏ qua --       ▼]                             │ │
│ └─────────────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│ ☑ Nhớ lựa chọn này        [Hủy]  [✅ Xác nhận & Điền (12 chỉ tiêu)]│
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Báo Cáo Hoàn Thành (Completion Report)

- **Trạng thái**: ✅ PASS
- **TypeScript**: `tsc --noEmit` 0 lỗi
- **Build**: `npm run build` thành công trong 12.17s
- **Tổng OCR test suite**: 107/107 passed
