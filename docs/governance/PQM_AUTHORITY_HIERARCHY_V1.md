# 👑 THỨ TỰ PHÂN CẤP THẨM QUYỀN HỆ THỐNG PQM (AUTHORITY HIERARCHY V1)

> **Mã văn bản:** `PQM_AUTHORITY_HIERARCHY_V1.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Quy tắc giải quyết xung đột:** Cấp cao hơn luôn phủ quyết (override) cấp thấp hơn; tài liệu cùng cấp mâu thuẫn phải STOP & REPORT.

---

## 1. THÁP PHÂN CẤP THẨM QUYỀN 8 TẦNG (8-LEVEL AUTHORITY PYRAMID)

Mọi quyết định kỹ thuật, quy tắc code, hoặc tranh chấp giải thích logic nghiệp vụ bắt buộc phải đối chiếu theo thứ tự ưu tiên giảm dần từ **Level 0** đến **Level 7**:

```text
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 0: REGULATORY & LEGAL CONSTRAINTS                     │
│  - Dược điển VN V, USP, BP, FDA 21 CFR Part 11, ICH Q10     │
│  - Bắt buộc tuân thủ pháp lý cao nhất trong ngành Dược      │
└──────────────────────────────┬──────────────────────────────┘
                               │ overrides
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 1: SYSTEM WORKFLOW MASTER                             │
│  - docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md              │
│  - Bản thiết kế tổng thể luồng nghiệp vụ toàn hệ thống      │
└──────────────────────────────┬──────────────────────────────┘
                               │ overrides
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 2: CANONICAL SOURCE-OF-TRUTH MATRIX                   │
│  - docs/workflow/PQM_SOURCE_OF_TRUTH_MATRIX.md              │
│  - docs/workflow/PQM_STATE_TRANSITION_MATRIX.md             │
│  - docs/workflow/PQM_WORKFLOW_FAILURE_MATRIX.md             │
└──────────────────────────────┬──────────────────────────────┘
                               │ overrides
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 3: CANONICAL CONTRACTS & REGISTRIES                   │
│  - CANONICAL_ACTION_REGISTRY (src/workflow/definitions/)    │
│  - Repository Interfaces (src/repositories/interfaces/)     │
│  - Canonical Actor Model (8 Roles + 2 System Actors)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ overrides
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 4: ACCEPTED ARCHITECTURE DECISION RECORDS (ADR)       │
│  - docs/adr/ADR-001-WORKFLOW-CANONICAL-STANDARDS.md         │
│  - docs/adr/ADR-REBUILD-WORKFLOW-CONTRACT-FREEZE.md         │
└──────────────────────────────┬──────────────────────────────┘
                               │ overrides
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 5: ARCHITECTURE & GOVERNANCE RULES                    │
│  - docs/governance/*.md                                     │
│  - .vibecode/PQM_MASTER_RULES.md, WORKFLOW.md               │
└──────────────────────────────┬──────────────────────────────┘
                               │ overrides
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 6: CODE IMPLEMENTATION                                │
│  - Source code thực tế trong src/domains/, src/workflow/    │
│  - Automated Architecture Tests (tests/architecture/)       │
└──────────────────────────────┬──────────────────────────────┘
                               │ overrides
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ LEVEL 7: UI PRESENTATION, EXAMPLES & SCRIPTS                │
│  - Giao diện người dùng, mockups, mẫu xuất báo cáo Excel/PDF│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. NGUYÊN TẮC GIẢI QUYẾT XUNG ĐỘT (CONFLICT RESOLUTION PROTOCOL)

1. **Khác cấp thẩm quyền**: Tài liệu ở Cấp cao hơn (Level $N$) luôn luôn có hiệu lực phủ quyết (override) tài liệu ở Cấp thấp hơn (Level $N+k$). Ví dụ: Mã nguồn (Level 6) nếu mâu thuẫn với System Workflow Master (Level 1) thì **bắt buộc phải sửa mã nguồn theo Master Workflow**.
2. **Cùng cấp thẩm quyền**: Nếu hai tài liệu hoặc định nghĩa cùng thuộc một Level mâu thuẫn nhau:
   ```text
   🛑 STOP (DỪNG LẠI NGAY LẬP TỨC)
       ↓
   📢 REPORT CONFLICT (BÁO CÁO RÕ RÀNG MẪU THUẪN CHO NGƯỜI DÙNG)
       ↓
   🚫 DO NOT GUESS (TUYỆT ĐỐI KHÔNG TỰ SUY DIỄN HOẶC CHỌN BỪA)
       ↓
   ⏳ AWAIT FORMAL DECISION (CHỜ QUYẾT ĐỊNH CHÍNH THỨC CỦA CHỦ DỰ ÁN)
   ```
3. **Cấm hạ thấp cấp thẩm quyền**: Không được phép sửa đổi quy tắc ở cấp cao hơn chỉ nhằm mục đích làm cho một đoạn mã vi phạm ở cấp thấp hơn vượt qua bài kiểm thử (Không được "update rule to make test pass").
