# PHÂN HỆ 13: APPROVAL WORKFLOW

## (QUY TRÌNH PHÊ DUYỆT ĐA CẤP & NGUYÊN TẮC BỐN MẮT)

> **Mã phân hệ**: `MOD-13`  
> **Tài liệu**: `docs/workflows/MOD_13_APPROVAL_WORKFLOW.md`  
> **Phạm vi**: Cấu hình quy trình phê duyệt đa cấp cho TCCS, Phiếu kiểm nghiệm (PKN), Lô sản xuất, Hồ sơ OOS và Quyết định xuất xưởng.

---

### 1. MỤC ĐÍCH (PURPOSE)

Thiết lập cơ chế kiểm soát chéo và trách nhiệm giải trình minh bạch:

1. **Nguyên tắc bốn mắt (Four-Eyes Principle)**: Người lập dữ liệu không bao giờ được phép tự phê duyệt dữ liệu do chính mình tạo ra (`creator !== approver`).
2. **Phân cấp thẩm quyền rõ ràng**: Chỉ các chức danh có quyền hạn theo quy chế (QA Manager, QC Head) mới được duyệt các mốc quyết định pháp lý.
3. **Chống phê duyệt vượt cấp hoặc phê duyệt thiếu bằng chứng**.

### 2. MA TRẬN THẨM QUYỀN PHÊ DUYỆT (APPROVAL MATRIX)

| Thực thể                    | Người lập (Originator) | Người thẩm tra (Reviewer) | Người phê duyệt cuối (Final Approver) |
| :-------------------------- | :--------------------- | :------------------------ | :------------------------------------ |
| **TCCS**                    | QC Analyst / R&D       | QC Manager                | **QA Manager**                        |
| **Phiếu kiểm nghiệm (PKN)** | QC Analyst             | QC Reviewer               | **QA Manager / QC Head**              |
| **Lô sản xuất (Batch)**     | Production Planner     | Production Head           | **QA Manager**                        |
| **Xuất xưởng Lô (Release)** | System Validation Gate | QA Specialist             | **QA Director / Authorized Person**   |
| **Hồ sơ OOS / Sai lệch**    | QC / Production        | Phụ trách bộ phận         | **QA Manager**                        |

---

### 3. NGUYÊN TẮC BẮT BUỘC KHI PHÊ DUYỆT

1. **Kiểm tra chữ ký số**: Mọi hành động Phê duyệt chính thức bắt buộc phải kích hoạt Modal Ký số điện tử (`SC-18`, tuân thủ `MOD-16`).
2. **Kiểm tra xung đột lợi ích (Anti-Self-Approval)**:
   - Nếu `currentUser.id === entity.createdBy`, hệ thống **vô hiệu hóa nút Phê duyệt** và hiển thị thông báo: _"Nguyên tắc kiểm soát chất lượng không cho phép tự phê duyệt hồ sơ của chính mình"_.
3. **Quy định khi Từ chối (Rejection)**:
   - Khi bấm "Từ chối" (Reject), người duyệt **BẮT BUỘC** phải nhập lý do giải trình chi tiết (tối thiểu 20 ký tự). Lý do này được ghi bất biến vào Audit Trail và thông báo cho người lập để xử lý.

### 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-APP-01`: Người tạo bản ghi tuyệt đối không được phê duyệt bản ghi đó.
- `AC-APP-02`: Hành động từ chối bắt buộc phải có văn bản giải trình lý do.
