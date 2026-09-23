# BUSINESS RULES CATALOG (LEVEL 1) - SINGLE SOURCE OF TRUTH (SSoT)

> **QUY CHẾ QUẢN TRỊ NGHIỆP VỤ (VIBECODE V2)**:  
> Thư mục này là **Single Source of Truth (SSoT) DUY NHẤT** cho toàn bộ Business Rules của hệ thống PQM.  
> Mọi logic thẩm định, máy trạng thái, điều kiện phát hành và xử lý kiểm nghiệm bắt buộc phải đối chiếu theo 10 bộ quy tắc chuẩn tắc được định danh từ `BR_01` đến `BR_10` dưới đây:

## 1. Danh Mục 10 Bộ Quy Tắc Chuẩn Tắc (Canonical SSoT)

1. [`BR_01_PRODUCT_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_01_PRODUCT_RULES.md): Quy tắc quản lý sản phẩm, số đăng ký và hạn dùng.
2. [`BR_02_TCCS_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_02_TCCS_RULES.md): Quy tắc Tiêu chuẩn cơ sở, phiên bản hiệu lực và tiêu chuẩn chấp nhận.
3. [`BR_03_BATCH_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_03_BATCH_RULES.md): Quy tắc Lô sản xuất, niêm phong Snapshot và bảo vệ hồ sơ.
4. [`BR_04_TEST_RESULT_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_04_TEST_RESULT_RULES.md): Quy tắc Phiếu kiểm nghiệm, vòng đời nhập liệu và phân quyền tách biệt (SoD).
5. [`BR_05_QUALITY_EVALUATION_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_05_QUALITY_EVALUATION_RULES.md): Quy tắc Đánh giá chất lượng chuẩn tắc đa tầng (Execution State vs Quality Status).
6. [`BR_06_ALTERNATE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_06_ALTERNATE_RULES.md): Quy tắc Chỉ tiêu thay thế V2 (`FAIL_RETRY` & `CONDITIONAL_CHECK`).
7. [`BR_07_OOS_DEVIATION_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_07_OOS_DEVIATION_RULES.md): Quy tắc xử lý sự cố ngoài tiêu chuẩn OOS và sai lệch Deviation.
8. [`BR_08_APPROVAL_RELEASE_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_08_APPROVAL_RELEASE_RULES.md): Quy tắc Thẩm duyệt và 7 Cổng kiểm soát xuất xưởng (7 Release Gates).
9. [`BR_09_COA_REPORT_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_09_COA_REPORT_RULES.md): Quy tắc Phiếu CoA chính thức, đọc độc quyền từ Snapshot và Footnotes.
10. [`BR_10_AUDIT_SECURITY_RULES.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/BR_10_AUDIT_SECURITY_RULES.md): Quy tắc Nhật ký kiểm toán ALCOA+, ký số điện tử và phân quyền RBAC.

---

## 2. Phân Loại Toàn Bộ 21 Tài Liệu Tham Khảo (Reference Catalog Classification)

Thư mục [`reference/`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/reference) chứa các tài liệu bóc tách chuyên sâu theo từng module nghiệp vụ. Toàn bộ 21 tài liệu được phân loại rõ ràng theo quyền hạn định nghĩa nghiệp vụ:

| Tên tài liệu trong `reference/` | Phân loại phân cấp     | Trạng thái quyền lực | Tài liệu SSoT thay thế              | Ghi chú & Phạm vi               |
| :------------------------------ | :--------------------- | :------------------- | :---------------------------------- | :------------------------------ |
| `PRODUCT_RULES.md`              | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_01_PRODUCT_RULES.md`            | Đã tổng hợp toàn bộ vào BR_01   |
| `TCCS_RULES.md`                 | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_02_TCCS_RULES.md`               | Đã tổng hợp toàn bộ vào BR_02   |
| `BATCH_RULES.md`                | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_03_BATCH_RULES.md`              | Đã tổng hợp toàn bộ vào BR_03   |
| `TEST_RESULT_RULES.md`          | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_04_TEST_RESULT_RULES.md`        | Đã tổng hợp toàn bộ vào BR_04   |
| `QUALITY_EVALUATION_RULES.md`   | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_05_QUALITY_EVALUATION_RULES.md` | Đã tổng hợp toàn bộ vào BR_05   |
| `ALTERNATE_RULES.md`            | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_06_ALTERNATE_RULES.md`          | Đã tổng hợp toàn bộ vào BR_06   |
| `OOS_RULES.md`                  | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_07_OOS_DEVIATION_RULES.md`      | Đã tổng hợp vào BR_07           |
| `DEVIATION_RULES.md`            | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_07_OOS_DEVIATION_RULES.md`      | Đã tổng hợp vào BR_07           |
| `APPROVAL_RULES.md`             | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_08_APPROVAL_RELEASE_RULES.md`   | Đã tổng hợp vào BR_08           |
| `RELEASE_RULES.md`              | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_08_APPROVAL_RELEASE_RULES.md`   | Đã tổng hợp vào BR_08           |
| `COA_RULES.md`                  | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_09_COA_REPORT_RULES.md`         | Đã tổng hợp vào BR_09           |
| `AUDIT_RULES.md`                | `SUPERSEDED`           | Thay thế bởi SSoT    | `BR_10_AUDIT_SECURITY_RULES.md`     | Đã tổng hợp vào BR_10           |
| `MASTER_DATA_RULES.md`          | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `DATA_CONTRACTS.md` / `BR_01`       | Quy chuẩn chi tiết danh mục gốc |
| `FORMULA_RULES.md`              | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `FORMULA_MATERIAL_CONTRACT.md`      | Quy chuẩn định mức BOM ±20%     |
| `RAW_MATERIAL_RULES.md`         | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `FORMULA_MATERIAL_CONTRACT.md`      | Quản lý kho, hạn retest         |
| `CAPA_RULES.md`                 | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `QMS_INCIDENT_CONTRACT.md`          | Vòng đời CAPA 90 ngày           |
| `SIGNATURE_RULES.md`            | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `SIGNATURE_AUDIT_CONTRACT.md`       | Chi tiết 21 CFR Part 11         |
| `GENEALOGY_RULES.md`            | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `BATCH_GENEALOGY_CONTRACT.md`       | Thuật toán đồ thị phả hệ        |
| `REPORTING_RULES.md`            | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `DATA_CONTRACTS.md`                 | Quy chuẩn SPC và APQR           |
| `AI_RULES.md`                   | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `AI_ADVISORY_CONTRACT.md`           | Quy chuẩn an toàn AI Gateway    |
| `RBAC_RULES.md`                 | `SUPPORTING_REFERENCE` | Tham khảo kỹ thuật   | `APPROVAL_CONTRACT.md`              | Chi tiết ma trận 8 vai trò      |

---

## 3. Sổ Bộ Định Danh Quy Tắc Chuẩn Tắc (Rule ID Registry)

Toàn bộ các mã định danh quy tắc nghiệp vụ (`BR-xxx`) được quản lý và đối chiếu duy nhất tại:
👉 [`docs/business-rules/RULE_ID_REGISTRY.md`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/RULE_ID_REGISTRY.md)
