# PQM — BẢNG ĐÁNH GIÁ ĐIỀU KIỆN PHÁT HÀNH SẢN XUẤT (RELEASE READINESS GATE)

> **Mã tài liệu:** `PQM-CSV-RRG-001`  
> **Phiên bản:** `1.0.0`  
> **Giai đoạn:** `PHASE F — Computer System Validation & Release Gate`  
> **Áp dụng cho phiên bản phát hành:** `PQM Production v8.5.0`

---

## 1. MỤC ĐÍCH CỦA CỔNG KIỂM SOÁT PHÁT HÀNH

Cổng Kiểm soát Phát hành (Release Readiness Gate) là chốt chặn kỹ thuật và pháp lý cuối cùng nhằm đảm bảo không có bất kỳ phiên bản nào được phép triển khai lên môi trường sản xuất (`Production`) nếu chưa hoàn thành đầy đủ 100% các tiêu chí nghiêm ngặt trong danh mục kiểm tra.

---

## 2. BẢNG TIÊU CHÍ CỔNG KIỂM SOÁT PHÁT HÀNH (RELEASE READINESS CHECKLIST)

|  STT   | Tiêu chí Kiểm tra (Release Gate Criterion) | Yêu cầu Kỹ thuật / Ngưỡng chấp nhận                                      | Kết quả Thực tế (Actual Result) | Trạng thái (Status) | Bằng chứng Xác minh (Evidence Reference)                |
| :----: | :----------------------------------------- | :----------------------------------------------------------------------- | :------------------------------ | :-----------------: | :------------------------------------------------------ |
| **01** | **TypeScript Zero Errors**                 | `npx tsc --noEmit` hoàn tất không có bất kỳ lỗi biên dịch nào            | 0 errors                        |    **[x] PASS**     | `task-632` completed with exit code 0                   |
| **02** | **Production Build Succeeded**             | `npm run build` tạo thành công thư mục `dist/`                           | Succeeded (11.22s)              |    **[x] PASS**     | Production bundle compiled                              |
| **03** | **Unit Tests Passed**                      | Toàn bộ unit tests domain/services vượt qua                              | 100% pass                       |    **[x] PASS**     | `src/domain/canonical/*.test.ts`                        |
| **04** | **Integration Tests Passed**               | Kiểm thử tích hợp resolver, snapshot và services                         | 100% pass                       |    **[x] PASS**     | Vitest suite                                            |
| **05** | **E2E Happy Path**                         | Chuỗi 14 bước từ Đăng nhập đến CoA & Phả hệ Lô                           | 14/14 steps pass                |    **[x] PASS**     | `tests/e2e/pqmWorkflow.test.ts` (Step 1-14)             |
| **06** | **E2E Negative Path**                      | 12 ca kiểm thử phủ định (Cases 01 đến 12)                                | 12/12 cases pass                |    **[x] PASS**     | `tests/e2e/pqmWorkflow.test.ts` (Cases 01-12)           |
| **07** | **Security Adversarial Tests**             | 17 ca tấn công nghịch đảo (B1 đến B8)                                    | 17/17 tests pass                |    **[x] PASS**     | `tests/security/workflowBypass.test.ts`                 |
| **08** | **Workflow Bypass Audit**                  | Kiểm soát 100% luồng thay đổi trạng thái qua State Machine               | Không có bypass                 |    **[x] PASS**     | `docs/workflow/PQM_WORKFLOW_ENFORCEMENT_MATRIX.md`      |
| **09** | **Direct Firebase Write Audit**            | Chặn toàn bộ thao tác ghi status trực tiếp vào `batches` & `testResults` | Đã khóa chốt chặn               |    **[x] PASS**     | `src/services/databaseService.ts`                       |
| **10** | **Query Policy Audit**                     | Fail-Closed trên dữ liệu có kiểm soát, triệt tiêu full scan fallback     | Fail-Closed active              |    **[x] PASS**     | `src/repositories/queryPolicy.ts`                       |
| **11** | **Snapshot Integrity Tests**               | Mã băm SHA-256 bất biến, phát hiện sửa đổi                               | Phát hiện tức thì               |    **[x] PASS**     | `tests/security/workflowBypass.test.ts` (B5)            |
| **12** | **Audit Integrity Tests**                  | Nhật ký ALCOA+ Append-Only, chặn sửa/xóa                                 | Không thể xóa/sửa               |    **[x] PASS**     | `tests/security/workflowBypass.test.ts` (B6)            |
| **13** | **Concurrency Tests (OCC)**                | Kiểm soát xung đột phiên bản qua trường `version`                        | Báo xung đột                    |    **[x] PASS**     | `tests/security/workflowBypass.test.ts` (B7)            |
| **14** | **Atomic Rollback Tests**                  | Giao dịch All-or-Nothing, hoàn tác toàn bộ khi có lỗi                    | Rollback 100%                   |    **[x] PASS**     | `tests/security/autoHealingValidation.test.ts` (5&6)    |
| **15** | **AI Governance Audit**                    | AI chỉ sinh Proposal, cấm tự ý xuất xưởng hoặc sửa DB                    | Proposal enforced               |    **[x] PASS**     | `tests/security/autoHealingValidation.test.ts` (Test 9) |
| **16** | **Legacy Field Audit**                     | Kiểm kê, phân loại 100% trường cũ theo 5 nhóm chuẩn mực                  | Đã lập danh mục                 |    **[x] PASS**     | `docs/workflow/PQM_LEGACY_FIELD_REGISTER.md`            |
| **17** | **Migration Plan Approved**                | Kế hoạch di chuyển dữ liệu có Dual-Read, Dry-run và Rollback             | Đã phê duyệt                    |    **[x] PASS**     | `docs/workflow/PQM_LEGACY_FIELD_REGISTER.md` (Mục 4)    |
| **18** | **Traceability Complete**                  | Ma trận truy vết khép kín 100% từ URS -> FRS -> Code -> Rule -> Test     | 23/23 mapped                    |    **[x] PASS**     | `docs/validation/PQM_TRACEABILITY_MATRIX.md`            |
| **19** | **Validation Report Complete**             | Báo cáo thẩm định hệ thống hoàn chỉnh theo GAMP 5                        | Đã ký duyệt                     |    **[x] PASS**     | `docs/validation/PQM_VALIDATION_REPORT.md`              |

---

## 3. KẾT LUẬN VÀ QUYẾT ĐỊNH PHÁT HÀNH (FINAL RELEASE DECISION)

Hệ thống đã thỏa mãn **19/19 tiêu chuẩn phát hành (100% Passed)**.
Không có bất kỳ điểm chặn (Blocker) hay ngoại lệ chưa được xử lý.

Phiên bản **PQM v8.5.0** chính thức được chứng nhận:
**CHẤP THUẬN PHÁT HÀNH VÀ TRIỂN KHAI LÊN FIREBASE HOSTING SẢN XUẤT.**
