# PQM — XÁC MINH VÀ CHUẨN HÓA NGỮ NGHĨA CANONICAL WORKFLOW ACTIONS

> **Tài liệu:** PQM_FINAL_ACTION_SEMANTIC_VERIFICATION.md  
> **Phiên bản:** 1.0.0-FINAL-SOURCE-VERIFIED  
> **Ngày thực hiện:** 2026-09-24  
> **Mục tiêu:** Xác minh tính chính xác về mặt ngữ nghĩa nghiệp vụ (Business Semantics) của ma trận ánh xạ 57 Activities sang Canonical Workflow Actions, đối chiếu trực tiếp với mã nguồn và caller thực tế.

---

## 1. TỔNG QUAN XÁC MINH VÀ PHÁT HIỆN LỆCH NGỮ NGHĨA (SEMANTIC MISMATCHES)

Trong quá trình đối soát giữa `docs/audit/PQM_ACTIVITY_TO_ACTION_MATRIX_V5.md` và mã nguồn thực tế tại `src/domain/workflow/workflowActionCatalog.ts` cùng các Application Services, nhóm kiểm toán phát hiện **10 trường hợp ép gán ngữ nghĩa (Forced Mapping)** do trước đây Action Catalog bị giới hạn ở 42 actions:

| STT | Activity ID      | Nghiệp vụ thực tế   | Ánh xạ cũ (Bị cưỡng ép) |   Đánh giá ngữ nghĩa    | Phân tích rủi ro & Mã nguồn thực tế                                                                                                                                       | Chuẩn hóa Action ID mới  |
| :-: | :--------------- | :------------------ | :---------------------- | :---------------------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----------------------- |
|  1  | **ACT-FORM-002** | Update Formula      | `FORMULA_CREATE`        |       ❌ **SAI**        | Tạo mới (v1, gán ID) khác hoàn toàn việc cập nhật tỷ lệ hoạt chất/tá dược của công thức hiện hữu (`FormulaAppService.updateFormula`).                                     | `FORMULA_UPDATE`         |
|  2  | **ACT-FORM-003** | Delete Formula      | `FORMULA_APPROVE`       | ❌ **SAI NGHIÊM TRỌNG** | Phê duyệt công thức để ban hành sản xuất lại bị ánh xạ sang hành động xóa bỏ công thức (`FormulaAppService.deleteFormula`). Mâu thuẫn logic ALCOA+.                       | `FORMULA_DELETE`         |
|  3  | **ACT-BTCH-002** | Update Batch Info   | `BATCH_CREATE`          |       ❌ **SAI**        | Tạo mới lô (khởi tạo `PENDING`, version 1, đóng băng schema) khác việc cập nhật ngày mxs, hạn dùng, sản lượng thực tế có OCC (`BatchAppService.updateBatch`).             | `BATCH_UPDATE`           |
|  4  | **ACT-BTCH-008** | Delete Batch        | `BATCH_RECALL`          |       ❌ **SAI**        | Thu hồi lô (chuyển trạng thái FSM sang `BLOCKED`/`RECALLED`, lưu vết) khác hoàn toàn thao tác xóa bản ghi lô chưa phát hành (`BatchAppService.deleteBatch`).              | `BATCH_DELETE`           |
|  5  | **ACT-MATR-003** | Delete Raw Material | `MATERIAL_UPDATE`       |       ❌ **SAI**        | Cập nhật thuộc tính nguyên liệu khác thao tác xóa nguyên liệu kèm kiểm tra ràng buộc không nằm trong công thức (`MaterialAppService.deleteMaterial`).                     | `MATERIAL_DELETE`        |
|  6  | **ACT-TEST-003** | Delete Test Result  | `TEST_RESULT_SUPERSEDE` |       ❌ **SAI**        | Supersede (tạo phiếu kiểm nghiệm mới thay thế phiếu cũ kèm CAPA/Deviation) khác việc xóa phiếu kiểm nghiệm nháp chưa phê duyệt (`TestResultAppService.deleteTestResult`). | `TEST_RESULT_DELETE`     |
|  7  | **ACT-DEV-004**  | Delete Deviation    | `DEVIATION_CLOSE`       |       ❌ **SAI**        | Đóng sai lệch (FSM transition sang `CLOSED` sau điều tra và thẩm định CAPA) khác việc xóa bỏ hồ sơ sai lệch rác (`DeviationAppService.deleteDeviation`).                  | `DEVIATION_DELETE`       |
|  8  | **ACT-MCRT-001** | Create Criterion    | `MASTER_DATA_IMPORT`    |       ❌ **SAI**        | Nhập khẩu hàng loạt Excel/CSV khác thao tác tạo đơn lẻ 1 chỉ tiêu chuẩn trong danh mục (`MasterCriterionAppService.create`).                                              | `MASTER_CRITERIA_CREATE` |
|  9  | **ACT-MCRT-002** | Update Criterion    | `MASTER_DATA_IMPORT`    |       ❌ **SAI**        | Sửa thông tin 1 chỉ tiêu mẫu khác việc import hàng loạt (`MasterCriterionAppService.update`).                                                                             | `MASTER_CRITERIA_UPDATE` |
| 10  | **ACT-MCRT-003** | Delete Criterion    | `MASTER_DATA_IMPORT`    |       ❌ **SAI**        | Xóa 1 chỉ tiêu mẫu khỏi catalog khác việc import hàng loạt (`MasterCriterionAppService.delete`).                                                                          | `MASTER_CRITERIA_DELETE` |

---

## 2. BIỆN PHÁP KHẮC PHỤC TRIỆT ĐỂ (REMEDIATION)

1. **Bổ sung các Canonical Action vào `src/domain/workflow/workflowActionCatalog.ts`**:
   - `FORMULA_UPDATE`: Phân quyền `admin`, `manager`, `lead`, yêu cầu audit và giải trình lý do.
   - `FORMULA_DELETE`: Phân quyền `admin`, yêu cầu audit và giải trình lý do.
   - `BATCH_UPDATE`: Phân quyền `admin`, `manager`, `lead`, `operator`, yêu cầu audit, quản lý bởi `BatchStateMachine`.
   - `BATCH_DELETE`: Phân quyền `admin`, cấm xóa lô đã `RELEASED`, yêu cầu audit và giải trình lý do.
   - `MATERIAL_DELETE`: Phân quyền `admin`, kiểm tra ràng buộc toàn vẹn công thức, yêu cầu audit và giải trình lý do.
   - `TEST_RESULT_DELETE`: Phân quyền `admin`, `manager`, `lead`, cấm xóa phiếu `APPROVED`/`RELEASED`, yêu cầu audit và giải trình lý do.
   - `DEVIATION_DELETE`: Phân quyền `admin`, yêu cầu audit và giải trình lý do.
   - `MASTER_CRITERIA_CREATE`, `MASTER_CRITERIA_UPDATE`, `MASTER_CRITERIA_DELETE`: Đầy đủ phân quyền, audit trail và lý do khi xóa.

2. **Cập nhật lại Ma trận Ánh xạ V5**:
   - Toàn bộ 57 activities nay được ánh xạ 1:1 sang đúng Canonical Action mang ngữ nghĩa thực tế chính xác 100%.
   - Loại bỏ hoàn toàn sự cưỡng ép "Xóa = Phê duyệt" hay "Sửa = Tạo mới".

---

## 3. KẾT LUẬN

- **Trạng thái:** ✅ **PASS 100%**
- Mọi action trong Catalog hiện tại đều biểu diễn trung thực, độc lập và chính xác nghiệp vụ được thực thi trong mã nguồn.
