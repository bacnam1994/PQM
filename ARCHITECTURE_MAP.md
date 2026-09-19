# 🏛️ ARCHITECTURE MAP — BẢN ĐỒ KIẾN TRÚC PHÂN TẦNG PQM

> **Phiên bản:** 1.0.0-BASELINE  
> **Áp dụng:** Toàn bộ hệ thống Quản lý Chất lượng PQM

---

## 1. SƠ ĐỒ PHÂN TẦNG TỔNG THỂ (LAYERED ARCHITECTURE)

```
                    ┌──────────────────────────────────────────────┐
                    │                   UI / UX                    │
                    │   Dashboard / Forms / Reports / Modals / Coa │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │              APPLICATION LAYER               │
                    │   TestResultAppService / BatchAppService     │
                    │   ApprovalWorkflowService / TanStack Query   │
                    └──────────────────────┬───────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
  ┌──────────────┐                 ┌────────────────┐                ┌──────────────┐
  │ Domain Model │                 │ Quality Engine │                │ Workflow FSM │
  │ Entity ID    │                 │ PASS/FAIL/...  │                │ Draft/Final  │
  └──────┬───────┘                 └───────┬────────┘                └──────┬───────┘
         │                                 │                                │
         └─────────────────────────────────┼────────────────────────────────┘
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │            DATA INTEGRITY & AUDIT            │
                    │  ALCOA+ Hash Chaining / Post-Heal Verify     │
                    │  Consistency Reconciliation / Lineage Engine │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │           TRUSTED BACKEND / RULES            │
                    │  Firebase Rules / RBAC / E-Signature Guard   │
                    │  Optimistic Concurrency / Atomic Transaction │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │                FIREBASE RTDB                 │
                    │   testResults / batches / tccs / audit_logs  │
                    └──────────────────────────────────────────────┘
```

---

## 2. NGUYÊN TẮC PHÂN TẦNG BẤT BIẾN (INVIOLABLE BOUNDARY RULES)

### Quy tắc 1: UI không tự quyết định chất lượng

- **Nghiêm cấm**: UI components không được tự chạy logic kiểm tra Đạt/Không đạt qua các cú pháp ad-hoc (`results.some(...)`, `r.overallStatus === 'PASS' ? 'OK' : 'FAIL'`).
- **Bắt buộc**: UI chỉ được nhận và hiển thị kết quả từ `CanonicalStatusResolver` hoặc `QualityEvaluationEngine`.

### Quy tắc 2: AI không trực tiếp thay đổi cơ sở dữ liệu

- **Nghiêm cấm**: AI Services không được import Firebase SDK (`set`, `update`, `remove`) và không được trực tiếp gọi mutation trên Zustand store hay Firebase.
- **Bắt buộc**: Mọi hành động sửa chữa dữ liệu của AI phải theo luồng:
  $$\text{AI Proposal} \longrightarrow \text{Human Approval} \longrightarrow \text{Trusted App Service} \longrightarrow \text{Domain Validation} \longrightarrow \text{Atomic Transaction} \longrightarrow \text{Audit Log}$$

### Quy tắc 3: Client không phải Security Boundary

- **Nghiêm cấm**: Không tin cậy dữ liệu client gửi lên (phiên bản, trạng thái duyệt, chữ ký).
- **Bắt buộc**: Firebase RTDB Security Rules phải thực thi kiểm soát phân quyền (RBAC), chống ghi đè phiên bản cũ (Stale Concurrency), và khóa chặt các trường niêm phong (`evaluationSnapshot`, `evaluationHash`, `audit_logs`).

### Quy tắc 4: Tách biệt Chất lượng (Quality) và Vòng đời (Workflow)

- Quality Status độc lập 100% với Workflow Status:
  - `QualityStatus`: Đánh giá kỹ thuật dựa trên tiêu chuẩn kỹ thuật (`PASS`, `FAIL`, `PENDING`, `UNKNOWN`).
  - `WorkflowStatus`: Vòng đời hành chính của tài liệu (`DRAFT`, `FINAL`, `APPROVED`, `RELEASED`).
  - **Không bao giờ suy luận**: `APPROVED` $\implies$ `PASS` hoặc `REJECTED` $\implies$ `FAIL`.

---

## 3. MA TRẬN TƯƠNG TÁC THÀNH PHẦN (COMPONENT COMMUNICATION MATRIX)

| Tầng gọi (Caller)        | Tầng đích (Target)           | Phương thức giao tiếp                 | Ghi chú & Rào chắn                                        |
| :----------------------- | :--------------------------- | :------------------------------------ | :-------------------------------------------------------- |
| **UI Components**        | **Application Services**     | Function Calls, Hooks                 | Chỉ tương tác qua AppService hoặc Query Hooks             |
| **Application Services** | **Domain Evaluation Engine** | Deterministic Service Calls           | Đánh giá chỉ tiêu và trạng thái chất lượng                |
| **Application Services** | **Workflow State Machine**   | Transition Request                    | Kiểm tra điều kiện tiên quyết trước khi chuyển trạng thái |
| **Application Services** | **Repositories**             | Repository Methods (`save`, `update`) | Đóng gói toàn bộ truy vấn dữ liệu                         |
| **Auto-Heal Engine**     | **Approval Gate**            | Plan Proposal & E-Sign                | Yêu cầu QA/ADMIN phê duyệt trước khi commit               |
| **Repositories**         | **Firebase RTDB**            | RTDB SDK Reference calls              | Bị kiểm soát bởi `database.rules.json`                    |
