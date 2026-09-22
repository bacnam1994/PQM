# PQM — BỘ QUY TẮC NGHIỆP VỤ: RAW MATERIAL RULES

# (QUY TẮC NGUYÊN LIỆU ĐẦU VÀO & TRUY XUẤT NGUỒN GỐC)

> **Mã tài liệu**: `BR-CATALOG-RAW-MATERIAL`  
> **Thư mục**: `docs/business-rules/RAW_MATERIAL_RULES.md`  
> **Phân hệ**: `MOD-05` (Raw Material Workflow)  
> **Tuân thủ**: GAMP 5, GMP Dược phẩm, US FDA 21 CFR Part 211

---

### BR-MAT-001: Kiểm Soát Trạng Thái Phê Duyệt Nguyên Liệu Đầu Vào (Material Release Enforcement)

- **Rule ID**: `BR-MAT-001`
- **Purpose**: Đảm bảo chỉ các lô nguyên liệu đã được phòng QC kiểm nghiệm ĐẠT và QA phê duyệt xuất xưởng sử dụng (`status === 'APPROVED'`) mới được đưa vào cấp phát sản xuất cho Lô.
- **Actor**: Thủ kho nguyên liệu (`WAREHOUSE_KEEPER`), QC kiểm tra nguyên liệu (`QC_INCOMING`).
- **Trigger**: Khi gán Lô nguyên liệu vào Lô sản xuất (`SC-08` / `SC-09`).
- **Input**: `materialBatchId: string`, `batchId: string`.
- **Preconditions**: Lô nguyên liệu tồn tại trong hệ thống.
- **Decision Logic**:
  ```
  matBatch = getMaterialBatch(materialBatchId)
  IF (matBatch.status == 'QUARANTINE')
      THEN REJECT "Lô nguyên liệu đang trong tình trạng biệt trữ (Chờ kiểm nghiệm)"
  IF (matBatch.status == 'REJECTED')
      THEN REJECT "Lô nguyên liệu đã bị Từ chối chất lượng, nghiêm cấm đưa vào sản xuất"
  IF (matBatch.status == 'EXPIRED')
      THEN REJECT "Lô nguyên liệu đã hết hạn sử dụng"
  IF (matBatch.status == 'APPROVED')
      THEN ALLOW assignment
  ```
- **Decision Table**:
  | Trạng thái Lô nguyên liệu | Hạn dùng so với ngày SX | Quyết định gán vào Lô | Kết quả |
  | :--- | :--- | :--- | :--- |
  | `QUARANTINE` (Biệt trữ) | Còn hạn | Từ chối | `MATERIAL_IN_QUARANTINE` |
  | `REJECTED` (Từ chối) | Bất kỳ | Từ chối nghiêm ngặt | `MATERIAL_REJECTED` |
  | `APPROVED` (Đã duyệt) | Hết hạn | Từ chối | `MATERIAL_EXPIRED` |
  | `APPROVED` (Đã duyệt) | Còn hạn | Chấp thuận | `SUCCESS` |
- **Output**: `canAllocate: boolean`, `blockingReason?: string`.
- **State Transition**: Không đổi trạng thái Lô thành phẩm.
- **UI Behavior**: Dropdown chọn lô nguyên liệu chỉ hiển thị các lô có trạng thái `APPROVED` và còn hạn sử dụng. Nếu người dùng quét mã vạch lô biệt trữ hoặc từ chối, phát âm thanh cảnh báo và hiển thị modal lỗi màu đỏ.
- **Report / CoA Behavior**: Thông tin số lô nguyên liệu hiển thị trong Cây phả hệ dữ liệu (Genealogy Tree).
- **Audit Requirement**: Ghi nhận sự kiện `ALLOCATE_MATERIAL_BATCH` kèm thông tin người cấp phát và thời điểm.
- **Forbidden Behavior**: Cấm hành vi "cấp phát trước, duyệt sau" (chưa có kết quả kiểm nghiệm nguyên liệu nhưng đã đưa vào máy dập viên).
- **Exception Handling**: Trường hợp sản xuất khẩn cấp yêu cầu phê duyệt ngoại lệ bằng văn bản của Tổng Giám đốc và Giám đốc Đảm bảo Chất lượng.
- **Test Cases**: `TC-BR-MAT-001-A` (Gán nguyên liệu biệt trữ ➔ Chặn), `TC-BR-MAT-001-B` (Gán nguyên liệu đạt chuẩn ➔ Cho phép).

---

### BR-MAT-002: Ràng Buộc Hạn Sử Dụng Nguyên Liệu So Với Ngày Sản Xuất (Material Expiry Invariance)

- **Rule ID**: `BR-MAT-002`
- **Purpose**: Đảm bảo không sử dụng nguyên liệu cận hạn hoặc đã hết hạn tại thời điểm thực hiện công đoạn pha chế/sản xuất Lô.
- **Actor**: Kế hoạch sản xuất (`PLANNER`), QA Giám sát xưởng (`QA_INSPECTOR`).
- **Trigger**: Khi xác nhận công đoạn phối trộn nguyên liệu (`SC-08`).
- **Input**: `materialBatch.expDate: string`, `batch.mfgDate: string`.
- **Preconditions**: Cả hai ngày đều có định dạng ISO 8601 hợp lệ.
- **Decision Logic**:
  ```
  IF (materialBatch.expDate < batch.mfgDate)
      THEN REJECT "Hạn sử dụng của nguyên liệu trước ngày sản xuất Lô"
  IF (daysBetween(batch.mfgDate, materialBatch.expDate) < materialBatch.safetyBufferDays)
      THEN Gán cảnh báo CẬN HẠN (NEAR_EXPIRY_WARNING)
  ```
- **Decision Table**:
  | Hạn dùng nguyên liệu | Ngày sản xuất Lô | Khoảng cách | Quyết định |
  | :--- | :--- | :--- | :--- |
  | 2026-08-31 | 2026-09-01 | -1 ngày | Từ chối lập tức (`MATERIAL_EXPIRED`) |
  | 2026-09-15 | 2026-09-01 | 14 ngày | Cảnh báo cận hạn (Yêu cầu QA xác nhận) |
  | 2027-09-01 | 2026-09-01 | 365 ngày | Chấp thuận |
- **Output**: `isValid: boolean`, `warning?: string`.
- **State Transition**: Không đổi trạng thái.
- **UI Behavior**: Đổi màu badge hạn sử dụng nguyên liệu sang màu cam/đỏ, yêu cầu QA xác nhận lý do nếu thuộc diện cảnh báo cận hạn.
- **Report / CoA Behavior**: Không áp dụng.
- **Audit Requirement**: Ghi nhận cảnh báo cận hạn vào nhật ký kiểm toán ALCOA+.
- **Forbidden Behavior**: Cấm tự ý sửa hạn sử dụng nguyên liệu mà không qua quy trình thẩm định lại tuổi thọ (Re-test Date Approval).
- **Exception Handling**: Nếu nguyên liệu có quy trình Re-test đạt chuẩn, đính kèm số phiếu kiểm nghiệm lại vào hồ sơ lô.
- **Test Cases**: `TC-BR-MAT-002-A` (Nguyên liệu hết hạn trước ngày SX), `TC-BR-MAT-002-B` (Nguyên liệu hợp lệ).
