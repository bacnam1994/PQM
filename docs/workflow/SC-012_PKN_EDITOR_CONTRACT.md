# SC-012: HỢP ĐỒNG HÀNH VI GIAO DIỆN PHIẾU KIỂM NGHIỆM (PKN EDITOR UI CONTRACT)

> **Mã quy chuẩn:** `SC-012`  
> **Phiên bản:** `1.0.0-CANONICAL`  
> **Cập nhật lần cuối:** 2026-09-25  
> **Thực thể áp dụng:** `TEST_RESULT` (`TestResultFormPage.tsx`, `CriteriaInputGroup.tsx`)  
> **Giải quyết lỗ hổng:** [`GAP-05`](file:///d:/26%20Kiem%20nghiem/PQM/docs/workflow/WORKFLOW_GAP_REGISTER.md)

---

## 1. NGUYÊN TẮC THIẾT KẾ CỐT LÕI (SSOT)

1. **Giao diện chỉ hiển thị và ghi nhận dữ liệu (Passive Consumer)**:
   - Giao diện người dùng (UI) **tuyệt đối không được tự suy đoán hoặc tái diễn giải** trạng thái Đạt/Không đạt hay tính toán quy tắc thay thế.
   - Mọi trạng thái hiển thị của từng chỉ tiêu bắt buộc phải tiêu thụ trực tiếp từ kết quả đánh giá của `AlternateRuleResolver` và `CriterionEvaluator`.
2. **Nguyên tắc Minh bạch Dữ liệu ALCOA+ (No Hidden Rows)**:
   - **Cấm 100% việc ẩn dòng chỉ tiêu (`filter` / `display: none`)** trên bảng nhập liệu khi một chỉ tiêu phụ được miễn kiểm.
   - Mọi chỉ tiêu quy định trong TCCS tại thời điểm sản xuất (TCCS Snapshot) đều phải xuất hiện đầy đủ trên màn hình để kiểm nghiệm viên và thanh tra viên đối soát toàn vẹn.

---

## 2. MA TRẬN TRẠNG THÁI CHỈ TIÊU & HÀNH VI GIAO DIỆN

| Trạng thái chỉ tiêu     | Điều kiện kích hoạt                                                                                                          | Trạng thái ô nhập (Input)                                                                                      | Nhãn Badge hiển thị                                                   | Hành vi Submit Form                                                                                                          |
| :---------------------- | :--------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **`NORMAL`**            | Chỉ tiêu thông thường, không gắn quy tắc thay thế                                                                            | **Mở (Enabled)**: Cho phép nhập liệu bình thường. Border xám `border-slate-300`.                               | `ĐẠT` (Xanh lá) / `KHÔNG ĐẠT` (Đỏ) / `CHỜ NHẬP` (Xám)                 | Cho phép submit nếu không có chỉ tiêu bắt buộc nào còn trống.                                                                |
| **`NOT_TRIGGERED`**     | Chỉ tiêu phụ được **Miễn kiểm** do chỉ tiêu chính tương ứng đã ĐẠT chuẩn                                                     | **Khóa (Disabled)**: Ô nhập bị vô hiệu hóa, `bg-slate-100 dark:bg-slate-800 cursor-not-allowed`.               | 🟢 **`MIỄN KIỂM`** (Badge xanh dương/xám nhạt kèm icon miễn kiểm)     | Cho phép submit bình thường. Trạng thái không bị coi là thiếu dữ liệu.                                                       |
| **`TRIGGERED_PENDING`** | Chỉ tiêu chính không đạt; Quy tắc thay thế (`FAIL_RETRY` / `CONDITIONAL_CHECK`) kích hoạt chỉ tiêu phụ nhưng chưa có kết quả | **Cảnh báo (Highlighted)**: Border vàng cam nổi bật `border-amber-400 focus:ring-amber-400`, tooltip cảnh báo. | 🟡 **`CHỜ KẾT QUẢ`** (Badge hổ phách nhấp nháy hoặc có viền cảnh báo) | **Chặn Submit (Blocked)**: Vô hiệu hóa nút `SUBMIT` và `FINALIZE`; hiển thị thông báo lỗi yêu cầu nhập đủ chỉ tiêu thay thế. |
| **`TRIGGERED_PASS`**    | Chỉ tiêu thay thế đã được kiểm nghiệm và đạt chuẩn kỹ thuật                                                                  | **Mở (Enabled)**: Cho phép sửa khi đang ở bản nháp.                                                            | 🟢 **`ĐẠT (THAY THẾ)`** (Badge xanh lá kèm tag ghi chú quy tắc)       | Cho phép submit; tính vào trạng thái tổng thể ĐẠT thay thế.                                                                  |
| **`TRIGGERED_FAIL`**    | Chỉ tiêu thay thế đã kiểm nghiệm nhưng không đạt chuẩn                                                                       | **Mở (Enabled)**: Cho phép sửa khi đang ở bản nháp.                                                            | 🔴 **`KHÔNG ĐẠT`** (Badge đỏ cảnh báo OOS)                            | Cho phép submit; kích hoạt cảnh báo OOS / Deviation.                                                                         |

---

## 3. MA TRẬN QUYỀN HẠN BIÊN TẬP (EDITABILITY BY WORKFLOW STATUS)

| Trạng thái phiếu (`workflowStatus`) |   Vai trò `LAB` / `QC`   |                    Vai trò `QA`                     |     Vai trò `ADMIN`      | Ghi chú an ninh                                                |
| :---------------------------------- | :----------------------: | :-------------------------------------------------: | :----------------------: | :------------------------------------------------------------- |
| **`DRAFT`**                         | ✏️ Toàn quyền nhập & sửa |              ✏️ Toàn quyền nhập & sửa               | ✏️ Toàn quyền nhập & sửa | Được phép lưu nháp tự động (`useFormDraft`).                   |
| **`SUBMITTED`**                     |  🔒 Chỉ xem (Read-only)  | 👁️ Soát xét / Duyệt (`APPROVE`) / Trả về (`REJECT`) | 👁️ Soát xét / Điều phối  | Ô nhập khóa hoàn toàn để bảo toàn nguyên trạng gửi duyệt.      |
| **`APPROVED`**                      |    🔒 Khóa vĩnh viễn     |                  🔒 Khóa vĩnh viễn                  |    🔒 Khóa vĩnh viễn     | Đã niêm phong SHA-256 `evaluationSnapshot`. Không ai được sửa. |
| **`RELEASED`**                      |    🔒 Khóa vĩnh viễn     |                  🔒 Khóa vĩnh viễn                  |    🔒 Khóa vĩnh viễn     | Lô đã xuất xưởng. Bất biến ALCOA+.                             |

---

## 4. CHI TIẾT TỔ HỢP GIAO DIỆN (UI IMPLEMENTATION GUIDELINES)

### 4.1. Badge "MIỄN KIỂM" (`NOT_TRIGGERED`)

```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
  <CheckCircleIcon className="w-3 h-3 mr-1 text-slate-400" />
  MIỄN KIỂM
</span>
```

Tooltip đính kèm: _"Chỉ tiêu phụ được miễn kiểm tra do chỉ tiêu chính đã đạt chuẩn."_

### 4.2. Badge "CHỜ KẾT QUẢ" (`TRIGGERED_PENDING`)

```tsx
<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-300 dark:border-amber-800 animate-pulse">
  <ClockIcon className="w-3 h-3 mr-1 text-amber-500" />
  CHỜ KẾT QUẢ
</span>
```

Tooltip đính kèm: _"Quy tắc kiểm nghiệm thay thế đã kích hoạt. Yêu cầu nhập kết quả chỉ tiêu này để hoàn thành phiếu."_

---

## 5. KIỂM CHỨNG & TRUY VẾT

- Mọi thay đổi logic hiển thị chỉ tiêu trong `CriteriaInputGroup.tsx` bắt buộc phải đối chiếu với các mục trong tài liệu này.
- Khi kiểm thử E2E Playwright hoặc Unit Test `CriteriaInputGroup.test.tsx`, phải bảo đảm:
  1. Không có assertion nào kiểm tra `getByText('...')` biến mất khi chỉ tiêu phụ được miễn kiểm (phải tồn tại và mang badge `MIỄN KIỂM`).
  2. Nút Submit bị disable khi có ít nhất một chỉ tiêu mang trạng thái `TRIGGERED_PENDING`.
