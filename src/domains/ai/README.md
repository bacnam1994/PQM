# AI Boundary Domain (VS-15)

## 1. Ranh giới kiến trúc (AI Boundary & Regulatory Compliance)

AI Domain chịu trách nhiệm điều phối toàn bộ các hoạt động suy luận AI (LLM / Computer Vision / Speech-to-Text):

- **Zero Direct Mutation**: AI không được phép tự ý thay đổi dữ liệu cơ sở dữ liệu (`database.rules.json` / Firebase RTDB), không được phép tự duyệt phiếu kiểm nghiệm hay xuất xưởng lô sản xuất.
- **Proposal Only & Human-in-the-Loop**: Mọi khuyến nghị can thiệp hệ thống của AI bắt buộc phải trả về dưới dạng `AIActionProposal` với đầy đủ bằng chứng giải trình (Rationale & Evidence), chờ người dùng có thẩm quyền RBAC phê duyệt.
- **ALCOA+ Traceability**: 100% các lần suy luận AI đều được ghi vết Audit Trail kèm mã phiên bản Prompt chính thức từ `PromptRegistry`, model thực thi, thời gian phản hồi (latency), và điểm tin cậy (Confidence Score).
- **Draft Isolation**: Dữ liệu trích xuất từ phiếu kiểm nghiệm / OCR được lưu tạm thời qua `AIDraftManager` (sessionStorage) có TTL 10 phút, cách ly tuyệt đối khỏi cơ sở dữ liệu sản xuất.

## 2. Cấu trúc thư mục

```text
src/domains/ai/
├── domain/
│   ├── types.ts          # AIActionProposal, GuardValidationResult, AIGatewayRequest, AIGatewayResponse
│   └── rules.ts          # AIBoundaryRules: assertAdvisoryBoundary, resolveToolPermission, isRegulatedToolAction
├── infrastructure/
│   └── gateway.ts        # AIGatewayService kết nối Gemini API & Semantic Cache
├── application/
│   ├── aiActionGuard.ts  # Chốt chặn an ninh AI Action Guard
│   ├── aiDraftManager.ts # Quản lý bản thảo trích xuất tạm thời
│   └── queries.ts        # AIQueries
├── workflow/
│   └── definitions.ts    # AI_WORKFLOW_ACTIONS, AI_ACTION_LABELS
├── tests/
│   └── aiDomain.test.ts  # Bộ unit tests thẩm định ranh giới an toàn AI
├── index.ts              # Canonical entrypoint
└── README.md             # Tài liệu slice
```

## 3. Luồng điều phối Canonical Actions

```text
User / Input -> AI Gateway -> Inference -> AI Action Guard -> Proposal -> User Review -> Canonical Workflow -> Firebase RTDB
```

- AI không bao giờ gọi trực tiếp repository.
- Sau khi người dùng xác nhận Proposal, UI gọi Canonical Application Service (ví dụ: `BatchAppService`, `TestResultAppService`) để điều phối qua `WorkflowFacade.dispatch()`.
