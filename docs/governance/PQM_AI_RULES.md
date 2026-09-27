# 🧠 QUY TẮC QUẢN TRỊ TRÍ TUỆ NHÂN TẠO (PQM AI RULES)

> **Mã văn bản:** `PQM_AI_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Human-in-the-loop & Regulated AI Safety Guidelines

---

## 1. NGUYÊN TẮC BẤT BIẾN: AI CHỈ LÀ TRỢ LÝ TƯ VẤN (ADVISORY ONLY)

Trong môi trường sản xuất y tế và dược phẩm được kiểm soát nghiêm ngặt (GMP), Trí tuệ Nhân tạo (Gemini AI Copilot / OCR Vision) hoạt động theo nguyên tắc:

```text
AI Inference
     ↓
AIGateway (PromptRegistry, SemanticCache, Audit)
     ↓
AIActionGuard (Phân loại Regulated Action Check)
     ↓
AIActionProposal (Kèm bằng chứng & lý do đề xuất)
     ↓
Human-in-the-loop (Người có thẩm quyền kiểm tra & xác nhận)
     ↓
Canonical Workflow (WorkflowFacade.dispatch)
     ↓
Business Mutation
```

---

## 2. CÁC ĐIỀU CẤM ĐỐI VỚI AI (PROHIBITED AI ACTIONS)

1. ❌ **CẤM AI ghi trực tiếp cơ sở dữ liệu**: AI không bao giờ được cấp quyền gọi trực tiếp `firebase/database` hay các phương thức `save()`, `delete()` của Repository.
2. ❌ **CẤM AI tự động duyệt trạng thái**: AI không được tự ý ký duyệt phiếu kiểm nghiệm (`TEST_RESULT_APPROVE`), giải phóng lô (`BATCH_RELEASE_APPROVE`) hay đóng sai lệch (`DEVIATION_CLOSE`).
3. ❌ **CẤM AI bypass RBAC**: Mọi đề xuất của AI khi được con người chấp thuận vẫn phải trải qua kiểm tra thẩm quyền RBAC của chính người dùng đăng nhập đó.

---

## 3. CÁCH LY BẢN THẢO AI (AI DRAFT ISOLATION)

- Toàn bộ kết quả trích xuất OCR hay phân tích sơ bộ từ AI phải được quản lý bởi `AIDraftManager` (`src/domains/ai/application/aiDraftManager.ts`).
- Dữ liệu bản thảo được lưu tạm thời trong `sessionStorage` của trình duyệt với thời hạn tự hủy (TTL) tối đa 10 phút.
- Dữ liệu bản thảo AI hoàn toàn cách ly với cơ sở dữ liệu chính cho đến khi người dùng kiểm tra trên bảng đối chiếu minh bạch (`MappingConfirmModal.tsx`) và chủ động bấm nút "Lưu phiếu".
