# PQM — MA TRẬN TRUY VẾT YÊU CẦU & KIỂM THỬ (REQUIREMENTS TRACEABILITY MATRIX - RTM)

> **Mã tài liệu:** `PQM-CSV-RTM-001`  
> **Phiên bản:** `1.0.0`  
> **Giai đoạn:** `PHASE F — Computer System Validation`  
> **Chuẩn mực:** `GAMP 5 V-Model Traceability (URS -> FRS -> Architecture/Code -> Business Rule -> Test Case -> Test Evidence)`

---

## 1. MỤC TIÊU CỦA MA TRẬN TRUY VẾT

Ma trận RTM chứng minh tính khép kín 100% của chu trình thẩm định phần mềm:

- Mỗi Yêu cầu Người dùng (**URS**) đều được hiện thực hóa bằng một Yêu cầu Chức năng kỹ thuật (**FRS**).
- Mỗi FRS đều có vị trí mã nguồn cụ thể (**Code Implementation**) và quy tắc nghiệp vụ điều phối (**Domain Rule**).
- Mỗi FRS đều có ca kiểm thử tự động (**Test Case**) xác minh hành vi thực tế.
- Toàn bộ ca kiểm thử đều có bằng chứng chạy thực tế thành công (**Test Evidence**).

---

## 2. BẢNG MA TRẬN TRUY VẾT ĐẦY ĐỦ (FULL TRACEABILITY MATRIX)

| URS ID          | FRS ID          | Mô tả Chức năng Kỹ thuật                                                 | Thành phần Mã nguồn (Code File & Class)              | Quy tắc Nghiệp vụ (Domain Rule ID) | Ca Kiểm thử Tự động (Test File & Test ID)                                                       | Bằng chứng Xác minh (Execution Evidence) | Trạng thái (Status) |
| :-------------- | :-------------- | :----------------------------------------------------------------------- | :--------------------------------------------------- | :--------------------------------- | :---------------------------------------------------------------------------------------------- | :--------------------------------------- | :------------------ |
| **URS-PRD-001** | **FRS-PRD-001** | Tạo sản phẩm đầy đủ thuộc tính và validate Zod schema                    | `src/services/productService.ts`                     | `RULE-PRD-VALIDATE`                | `tests/e2e/pqmWorkflow.test.ts` (Step 2)                                                        | PASS (2.58s runtime)                     | **VALIDATED**       |
| **URS-PRD-002** | **FRS-PRD-002** | Ngăn chặn tạo trùng lặp mã sản phẩm và chặn xóa khi có lô                | `src/services/productService.ts`                     | `RULE-PRD-UNIQUE-CODE`             | `tests/e2e/pqmWorkflow.test.ts` (Step 2 & Negative)                                             | PASS (Verified duplicate rejection)      | **VALIDATED**       |
| **URS-TCS-001** | **FRS-TCS-001** | Thiết lập cấu trúc chỉ tiêu TCCS và giới hạn định lượng                  | `src/services/tccsService.ts`                        | `RULE-TCCS-CRITERIA`               | `tests/e2e/pqmWorkflow.test.ts` (Step 3)                                                        | PASS (TCCS ACTIVE created)               | **VALIDATED**       |
| **URS-TCS-002** | **FRS-TCS-002** | Chỉ duy nhất 1 TCCS ACTIVE, tự động archive phiên bản cũ                 | `src/services/tccsService.ts`                        | `RULE-TCCS-SINGLE-ACTIVE`          | `tests/e2e/pqmWorkflow.test.ts` (Step 3)                                                        | PASS (Verified single active)            | **VALIDATED**       |
| **URS-FOR-001** | **FRS-FOR-001** | Tạo công thức sản phẩm gồm hoạt chất và tá dược                          | `src/services/productFormulaService.ts`              | `RULE-FOR-INGREDIENTS`             | `tests/e2e/pqmWorkflow.test.ts` (Step 4)                                                        | PASS (Formula created)                   | **VALIDATED**       |
| **URS-BAT-001** | **FRS-BAT-001** | Chặn tạo lô nếu thiếu TCCS hiệu lực hoặc thiếu Công thức                 | `src/services/batchAppService.ts`                    | `RULE-BAT-ACTIVE-TCCS`             | `tests/e2e/pqmWorkflow.test.ts` (Case 05)                                                       | PASS (Blocked when missing TCCS)         | **VALIDATED**       |
| **URS-BAT-002** | **FRS-BAT-002** | Tự động chụp bất biến `tccsSnapshot` & `formulaSnapshot` vào Lô          | `src/services/batchAppService.ts`                    | `RULE-BAT-IMMUTABLE-SNAP`          | `tests/e2e/pqmWorkflow.test.ts` (Step 5)                                                        | PASS (Snapshots attached to Batch)       | **VALIDATED**       |
| **URS-BAT-003** | **FRS-BAT-003** | Chặn trùng số lô trên cùng sản phẩm                                      | `src/services/batchAppService.ts`                    | `RULE-BAT-UNIQUE-BATCHNO`          | `tests/e2e/pqmWorkflow.test.ts` (Step 5)                                                        | PASS (Verified batch uniqueness)         | **VALIDATED**       |
| **URS-TST-001** | **FRS-TST-001** | Nhập kết quả kiểm nghiệm chi tiết theo chỉ tiêu TCCS                     | `src/services/testResultAppService.ts`               | `RULE-TR-ENTRY-VALID`              | `tests/e2e/pqmWorkflow.test.ts` (Step 6)                                                        | PASS (TestResult initialized)            | **VALIDATED**       |
| **URS-TST-002** | **FRS-TST-002** | Vòng đời tài liệu FSM: DRAFT -> SUBMITTED -> FINAL -> APPROVED           | `src/domain/workflow/stateMachine.ts`                | `RULE-TR-STATE-MACHINE`            | `tests/security/workflowBypass.test.ts` (B1, B3)                                                | PASS (Transitions strictly governed)     | **VALIDATED**       |
| **URS-QEV-001** | **FRS-QEV-001** | Thẩm định chất lượng tự động: FAIL nếu có chỉ tiêu rớt, PASS nếu đủ      | `src/domain/evaluation/QualityEvaluationEngine.ts`   | `RULE-QEV-FAIL-PROPAGATION`        | `tests/e2e/pqmWorkflow.test.ts` (Step 7, Case 01, Case 02)                                      | PASS (Canonical resolution verified)     | **VALIDATED**       |
| **URS-QEV-002** | **FRS-QEV-002** | Cấm UI ghi đè chất lượng; cấm suy diễn PENDING/UNKNOWN thành FAIL        | `src/domain/canonical/canonicalResolver.ts`          | `RULE-QEV-NO-UI-GUESS`             | `tests/e2e/pqmWorkflow.test.ts` (Case 03, Case 04)                                              | PASS (Preserved PENDING/UNKNOWN)         | **VALIDATED**       |
| **URS-SNP-001** | **FRS-SNP-001** | Tạo Snapshot thẩm định bất biến kèm mã băm SHA-256                       | `src/domain/evaluation/EvaluationSnapshotBuilder.ts` | `RULE-SNP-SHA256-SEAL`             | `tests/e2e/pqmWorkflow.test.ts` (Step 8)                                                        | PASS (Hash computed & verified)          | **VALIDATED**       |
| **URS-SNP-002** | **FRS-SNP-002** | Phát hiện và chặn đứng mọi can thiệp sửa lén snapshot                    | `src/domain/evaluation/EvaluationSnapshotBuilder.ts` | `RULE-SNP-TAMPER-DETECT`           | `tests/security/workflowBypass.test.ts` (B5), `tests/e2e/pqmWorkflow.test.ts` (Case 06)         | PASS (Hash mismatch -> BLOCKED)          | **VALIDATED**       |
| **URS-REL-001** | **FRS-REL-001** | Chỉ người có vai trò QA/ADMIN mới có quyền phê duyệt & xuất xưởng        | `src/domain/workflow/stateMachine.ts`                | `RULE-REL-RBAC-QA-ONLY`            | `tests/security/workflowBypass.test.ts` (B1, B2), `tests/e2e/pqmWorkflow.test.ts` (Case 07, 08) | PASS (Denied for OPERATOR/GUEST)         | **VALIDATED**       |
| **URS-REL-002** | **FRS-REL-002** | Rào chắn 6 điểm xuất xưởng lô (Pass, Snapshot, Approved, Signature)      | `src/domain/workflow/stateMachine.ts`                | `RULE-REL-6-POINT-GATE`            | `tests/e2e/pqmWorkflow.test.ts` (Step 11, Case 02, Case 06)                                     | PASS (Release gate fully enforced)       | **VALIDATED**       |
| **URS-SIG-001** | **FRS-SIG-001** | Chữ ký số 21 CFR Part 11 với mã băm checksum SHA-256                     | `src/domain/signature/signatureService.ts`           | `RULE-SIG-21CFR11`                 | `tests/e2e/pqmWorkflow.test.ts` (Step 12)                                                       | PASS (Cryptographic signature valid)     | **VALIDATED**       |
| **URS-SIG-002** | **FRS-SIG-002** | Dữ liệu bị thay đổi sau khi ký làm vô hiệu hóa chữ ký                    | `src/domain/signature/signatureService.ts`           | `RULE-SIG-INTEGRITY`               | `tests/e2e/pqmWorkflow.test.ts` (Step 12)                                                       | PASS (Tampered data invalidates sig)     | **VALIDATED**       |
| **URS-COA-001** | **FRS-COA-001** | Kết xuất Certificate of Analysis (CoA) chuẩn từ kết quả đã duyệt         | `src/services/ai/tools/batchActionTools.ts`          | `RULE-COA-APPROVED-ONLY`           | `tests/e2e/pqmWorkflow.test.ts` (Step 13)                                                       | PASS (CoA generated with full metadata)  | **VALIDATED**       |
| **URS-GEN-001** | **FRS-GEN-001** | Dựng cây phả hệ DAG nguồn gốc lô (Genealogy)                             | `src/services/ai/batchGenealogyService.ts`           | `RULE-GEN-DAG-BUILD`               | `tests/e2e/pqmWorkflow.test.ts` (Step 14)                                                       | PASS (Full DAG lineage verified)         | **VALIDATED**       |
| **URS-AUD-001** | **FRS-AUD-001** | Nhật ký kiểm toán ALCOA+ Append-Only cho mọi hành động nhạy cảm          | `src/domain/audit/AuditService.ts`                   | `RULE-AUD-APPEND-ONLY`             | `tests/security/workflowBypass.test.ts` (B6), `tests/e2e/pqmWorkflow.test.ts` (Case 10)         | PASS (Audit log immutable)               | **VALIDATED**       |
| **URS-AIG-001** | **FRS-AIG-001** | AI chỉ được tạo Proposal, tuyệt đối cấm tự ý ghi DB hoặc xuất xưởng      | `src/services/ai/aiActionGuard.ts`                   | `RULE-AI-PROPOSAL-ONLY`            | `tests/security/autoHealingValidation.test.ts` (Test 9)                                         | PASS (AI proposal guard enforced)        | **VALIDATED**       |
| **URS-AIG-002** | **FRS-AIG-002** | Auto-Healing All-or-Nothing có preview, chặn NEVER_AUTO_HEAL và rollback | `src/domain/healing/autoHealingFramework.ts`         | `RULE-HEAL-ATOMIC-ALL-OR-NOTHING`  | `tests/security/autoHealingValidation.test.ts` (Tests 1-8)                                      | PASS (Atomic rollback verified)          | **VALIDATED**       |

---

## 3. KẾT LUẬN ĐỘ PHỦ TRUY VẾT (COVERAGE SUMMARY)

- **Tổng số Yêu cầu URS:** 23
- **Tổng số FRS tương ứng:** 23 (100% ánh xạ)
- **Tổng số Ca kiểm thử tự động:** 23/23 đã có kiểm thử (100% kiểm thử)
- **Tỷ lệ kiểm thử thành công:** 100% (41/41 bài kiểm thử trong `tests/` đều vượt qua).
- **Kết luận:** Hệ thống PQM hoàn toàn đáp ứng yêu cầu thẩm định truy vết theo GAMP 5.
