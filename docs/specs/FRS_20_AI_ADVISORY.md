# FRS-MOD-20: Đặc Tả Nghiệp Vụ Trợ Lý Trí Tuệ Nhân Tạo & Rào Chắn Dược Khoa (AI Advisory & Safety Guardrails)

Tài liệu này quy định chi tiết chức năng tích hợp Trí tuệ Nhân tạo (AI) trong việc hỗ trợ ánh xạ chỉ tiêu kiểm nghiệm, gợi ý điều tra nguyên nhân gốc rễ và rào chắn an toàn dược khoa (Pharmacological Guardrails).

---

## 1. Input & Data Schema

- `taskType`: Loại tác vụ AI (`CRITERIA_MAPPING`, `ROOT_CAUSE_SUGGESTION`, `CAPA_PROPOSAL`).
- `inputPayload`: Dữ liệu ngữ cảnh đưa vào Prompt.
- `outputProposal`: Bản thảo đề xuất trả về từ AI (chỉ lưu trên UI state tạm thời).

## 2. Validation Rules & Guardrails

- **Guardrail 1 (Phân loại phép thử)**: Nghiêm cấm ánh xạ giữa phép thử Định tính (Identification) và phép thử Định lượng (Assay).
- **Guardrail 2 (Đơn vị đo)**: Kiểm tra tính tương thích của đơn vị đo lường trước khi đưa ra đề xuất.
- **Guardrail 3 (Human-in-the-loop)**: AI tuyệt đối không có quyền tự động gọi API ghi đè cơ sở dữ liệu nếu chưa có người dùng bấm "Chấp nhận".

## 3. Business Rules Reference

- `BR-AI-001`: Cơ chế đề xuất tư vấn cấm ghi trực tiếp cơ sở dữ liệu (Advisory Proposal-Only).
- `BR-AI-002`: Rào chắn chống nhầm lẫn nghiệp vụ dược khoa của AI.

## 4. State Management

- `PROPOSED` -> `ACCEPTED` | `REJECTED` bởi người dùng.

## 5. Service Layer Contract

```typescript
export interface AIAdvisoryService {
  suggestCriteriaMapping(
    ocrTexts: string[],
    tccsCriteria: CriterionSpec[]
  ): Promise<AICriterionMappingProposalItem[]>;
  suggestOOSRootCause(investigationData: Phase1Input): Promise<string[]>;
  applyGuardrails(proposal: AICriterionMappingProposalItem): boolean;
}
```

## 6. Permission & RBAC

- Toàn bộ người dùng có thể sử dụng AI để hỗ trợ nhập liệu, nhưng quyết định áp dụng thuộc về chính tài khoản của người dùng đó.

## 7. Error Handling

- `ERR_AI_GUARDRAIL_VIOLATION`: Đề xuất bị hệ thống tự động loại bỏ vì vi phạm logic dược điển.

## 8. Audit Trail Requirement

- Ghi nhận cờ `isAssistedByAI: true` và Model Name khi người dùng chấp nhận đề xuất từ AI.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Rào chắn dược khoa loại bỏ đề xuất nhầm lẫn Định tính sang Định lượng
  Given Dữ liệu OCR từ phiếu scan có dòng chữ "Định tính Paracetamol: Dương tính"
  And AI model gợi ý ánh xạ dòng này vào chỉ tiêu "Hàm lượng Paracetamol (90% - 110%)"
  When Hệ thống chạy bộ lọc rào chắn "isCriteriaMatch"
  Then Đề xuất bị rào chắn loại bỏ hoàn toàn
  And Người dùng không nhìn thấy đề xuất sai trái này trên giao diện
```
