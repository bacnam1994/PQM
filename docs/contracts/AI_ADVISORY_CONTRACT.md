# AI_ADVISORY_CONTRACT: Hợp Đồng Giao Diện Trợ Lý Trí Tuệ Nhân Tạo (AI Advisory & Proposal Contract)

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu của các đề xuất tư vấn do Trí tuệ Nhân tạo (AI) tạo ra, đảm bảo nguyên tắc Human-in-the-loop và cấm ghi trực tiếp cơ sở dữ liệu.

---

## 1. Bản Chất Nghiệp Vụ

- **Advisory Only (Chỉ tư vấn đề xuất)**: AI trong PQM hoạt động thuần túy ở tầng sinh đề xuất (Proposal Generator). Dữ liệu phản hồi từ AI không bao giờ là kết luận cuối cùng và không bao giờ được ghi thẳng vào các thực thể nghiệp vụ cốt lõi nếu chưa có sự xác nhận của người dùng có thẩm quyền.
- **Rào chắn Dược khoa (Pharmacological Guardrails)**: Mọi đề xuất từ AI phải đi qua lớp kiểm duyệt kỹ thuật (Technical Sanitation) để loại trừ các phán đoán sai lầm về bản chất phép thử (ví dụ: cấm ánh xạ Định tính sang Định lượng).

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
export type AIInteractionPurpose =
  | 'CRITERIA_MAPPING' // Gợi ý ánh xạ chỉ tiêu OCR/Phiếu vào TCCS
  | 'OOS_ROOT_CAUSE_ADVISORY' // Gợi ý nguyên nhân gốc rễ điều tra OOS
  | 'CAPA_ACTION_PROPOSAL' // Gợi ý danh mục hành động khắc phục phòng ngừa
  | 'PQR_SUMMARY_ASSISTANCE' // Soạn thảo tóm tắt báo cáo chất lượng hàng năm
  | 'DOCUMENT_TRANSLATION'; // Hỗ trợ dịch thuật tài liệu dược điển

export type AIProposalStatus =
  | 'PROPOSED' // AI vừa sinh xong, chờ con người xem xét
  | 'ACCEPTED_AS_IS' // Người dùng chấp nhận toàn bộ không sửa đổi
  | 'ACCEPTED_WITH_EDITS' // Người dùng sửa đổi trước khi áp dụng
  | 'REJECTED'; // Người dùng bác bỏ hoàn toàn đề xuất

export interface AICriterionMappingProposalItem {
  sourceRawText: string; // Văn bản chỉ tiêu trên phiếu gốc/ảnh scan
  suggestedCriterionId: string; // ID chỉ tiêu TCCS mà AI đề xuất ghép
  suggestedCriterionCode: string;
  suggestedCriterionName: string;
  confidenceScore: number; // Điểm tin cậy: 0.00 đến 1.00
  reasoning: string; // Giải thích lý do ghép của AI

  // Kiểm duyệt an toàn dược khoa (Guardrails)
  guardrailValidation: {
    isTypeCompatible: boolean; // Không ghép nhầm Định tính & Định lượng
    isUnitCompatible: boolean; // Đơn vị đo lường tương thích
    passesAllGuards: boolean;
  };

  // Trạng thái quyết định của con người
  humanDecision?: {
    status: 'ACCEPTED' | 'REJECTED' | 'MANUALLY_OVERRIDDEN';
    finalCriterionId?: string;
    decidedBy: string;
    decidedAt: string;
  };
}

export interface AIAdvisoryProposalContract {
  proposalId: string;
  purpose: AIInteractionPurpose;
  targetEntityId?: string; // ID của Batch, TestResult, OOS...

  // Thông tin mô hình AI
  modelInfo: {
    modelName: string; // VD: 'gemini-1.5-pro', 'gpt-4o'
    temperature: number;
    modelVersion: string;
  };

  // Nội dung đề xuất
  promptContextSummary: string;
  suggestedContent: string; // Nội dung văn bản đề xuất
  structuredMappings?: AICriterionMappingProposalItem[]; // Nếu là bài toán mapping

  // Trạng thái phê duyệt của con người
  status: AIProposalStatus;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  userModificationDiff?: string; // Ghi lại sự khác biệt giữa AI sinh và người sửa

  createdAt: string;
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **In-Memory First**: Đối tượng `AIAdvisoryProposalContract` tồn tại trong trạng thái tạm của UI. Chỉ khi người dùng bấm "Áp dụng", các dữ liệu thành phần mới được chuyển hóa thành các entity chính thức gắn với định danh tài khoản của người dùng.
2. **Loại bỏ tự động khi vi phạm Guardrail**: Nếu `passesAllGuards === false`, mục đề xuất đó bị loại bỏ tự động khỏi bảng hiển thị hoặc bị khóa nút "Áp dụng" kèm cảnh báo đỏ.
3. **Lưu vết nguồn gốc**: Bất kỳ dữ liệu nào kế thừa từ đề xuất của AI đều phải gắn cờ `isAssistedByAI: true` trong Audit Trail để phục vụ đánh giá mức độ tin cậy của thuật toán.
