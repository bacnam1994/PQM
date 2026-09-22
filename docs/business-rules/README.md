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

## 2. Thư Mục Tài Liệu Tham Khảo Chi Tiết (Reference Catalog)

Thư mục [`reference/`](file:///d:/26%20Kiem%20nghiem/PQM/docs/business-rules/reference) chứa các bản tài liệu bóc tách chuyên sâu theo từng module nghiệp vụ cũ. Các tài liệu này phục vụ mục đích tham khảo chi tiết, giải thích bối cảnh kỹ thuật và **KHÔNG THAY THẾ HOẶC XUNG ĐỘT** với 10 bộ quy tắc SSoT ở trên.
