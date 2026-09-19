# PQM — QUY TRÌNH KIỂM THỬ THẨM ĐỊNH (SYSTEM VALIDATION TEST PROTOCOL)

> **Mã tài liệu:** `PQM-CSV-TP-001`  
> **Phiên bản:** `1.0.0`  
> **Giai đoạn:** `PHASE F — Computer System Validation`  
> **Áp dụng cho:** `Unit, Integration, Adversarial Security, E2E & Architecture Testing`

---

## 1. MỤC TIÊU VÀ PHẠM VI

Quy trình Kiểm thử Thẩm định (Test Protocol) quy định phương thức, môi trường, dữ liệu kiểm thử, tiêu chí chấp nhận (Acceptance Criteria), và các bước thực thi tự động nhằm đảm bảo toàn bộ hệ thống PQM đáp ứng đầy đủ các tiêu chuẩn khắt khe nhất của ngành Dược phẩm trước khi phát hành lên môi trường sản xuất.

---

## 2. CẤU TRÚC VÀ PHÂN TẦNG BỘ KIỂM THỬ (TEST SUITE STRUCTURE)

Hệ thống kiểm thử của PQM được chia thành 4 lớp phòng vệ vững chắc:

```
+-------------------------------------------------------------+
| TẦNG 4: REAL WORKFLOW E2E TESTS                             |
| (tests/e2e/pqmWorkflow.test.ts)                              |
| Kiểm tra luồng dữ liệu 14 bước từ Login -> Genealogy & 12 ca phủ định |
+-------------------------------------------------------------+
                              ↑
+-------------------------------------------------------------+
| TẦNG 3: SECURITY & ADVERSARIAL TESTING                      |
| (tests/security/workflowBypass.test.ts)                     |
| Tấn công nghịch đảo B1 -> B8: giả mạo status, vượt quyền QA, bypass DB |
+-------------------------------------------------------------+
                              ↑
+-------------------------------------------------------------+
| TẦNG 2: AI GOVERNANCE & AUTO-HEALING VALIDATION             |
| (tests/security/autoHealingValidation.test.ts)              |
| Kiểm soát AI proposals, atomic transactions, rollback, NEVER_AUTO_HEAL|
+-------------------------------------------------------------+
                              ↑
+-------------------------------------------------------------+
| TẦNG 1: DOMAIN LOGIC & RESOLVER REGRESSION                  |
| (src/domain/canonical/*.test.ts & workflowExplainability)    |
| Kiểm tra Model 01 -> 13, tính toán chỉ tiêu, OCC versioning  |
+-------------------------------------------------------------+
```

---

## 3. TIÊU CHÍ CHẤP NHẬN BẮT BUỘC (ACCEPTANCE CRITERIA)

Mỗi lần chạy kiểm thử phục vụ thẩm định phát hành (Release Readiness Gate) bắt buộc phải thỏa mãn:

1. **TypeScript Compilation:** `npx tsc --noEmit` phải hoàn tất với **0 lỗi** (Exit code = 0).
2. **Production Bundle Build:** `npm run build` tạo thành công thư mục `dist/` mà không có cảnh báo nghiêm trọng.
3. **Unit & Domain Tests:** 100% test case trong `src/domain/canonical/` và services đạt `PASS`.
4. **Adversarial Security Tests:** 17/17 test case trong `tests/security/workflowBypass.test.ts` đạt `PASS`. Mọi nỗ lực bypass đều phải bị chặn đứng (Fail-Closed).
5. **Real Workflow E2E:** 13/13 test case trong `tests/e2e/pqmWorkflow.test.ts` (Happy Path 14 bước + 12 ca phủ định) đạt `PASS`.
6. **Auto-Healing Validation:** 11/11 test case trong `tests/security/autoHealingValidation.test.ts` đạt `PASS`.
7. **Thời gian thực thi:** Toàn bộ test suite phải hoàn thành trong thời gian cho phép (< 10 giây đối với in-memory Vitest runner).

---

## 4. QUY TRÌNH THỰC THI KIỂM THỬ (EXECUTION INSTRUCTIONS)

### Bước 1: Kiểm tra Biên dịch TypeScript

```powershell
npx tsc --noEmit
```

_Kết quả kỳ vọng:_ Exit code 0, không có dòng lỗi cú pháp hoặc sai kiểu dữ liệu.

### Bước 2: Chạy Toàn bộ Bộ Kiểm thử Thẩm định Tự động

```powershell
npx vitest run tests/
```

_Kết quả kỳ vọng:_ 41 tests passed (3 test files).

### Bước 3: Chạy Kiểm thử Dịch vụ Giải trình (Explainability Service)

```powershell
npx vitest run src/services/workflow/workflowExplainabilityService.test.ts
```

_Kết quả kỳ vọng:_ 4 tests passed.

### Bước 4: Chạy Kiểm thử Toàn vẹn Kiến trúc (Canonical Regression)

```powershell
npx vitest run src/domain/canonical/
```

_Kết quả kỳ vọng:_ Toàn bộ các test Model 01 đến Model 13 đều vượt qua.

### Bước 5: Đóng gói Bản dựng Sản xuất (Production Build)

```powershell
npm run build
```

_Kết quả kỳ vọng:_ Sinh bundle tối ưu trong thư mục `dist/` sẵn sàng deploy Firebase Hosting.

---

## 5. BÁO CÁO VÀ LƯU TRỮ HỒ SƠ THẨM ĐỊNH

Mọi kết quả chạy kiểm thử phải được trích xuất nhật ký và đính kèm vào:

- `docs/validation/PQM_VALIDATION_REPORT.md`
- `docs/audit/PQM_RUNTIME_ENFORCEMENT_AUDIT.md`
- Bản chụp mã nguồn `FULL_SOURCE_CODE.md` sau khi deploy.
