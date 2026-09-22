# PQM WORKFLOW V2 BLUEPRINT: KIẾN TRÚC ĐẶC TẢ HỆ THỐNG ĐA TẦNG

## (SYSTEM SPECIFICATION ARCHITECTURE BLUEPRINT)

> **Mã tài liệu**: `PQM-SPEC-V2-BLUEPRINT`  
> **Trạng thái**: APPROVED FOR ARCHITECTURE  
> **Ngày ban hành**: 22/09/2026  
> **Áp dụng cho**: Toàn bộ dự án PQM (Dược phẩm & Kiểm nghiệm)

---

## 1. MỤC TIÊU VÀ TRIẾT LÝ VIBECODING MỚI

Tài liệu này xác lập mô hình đặc tả 5 tầng (Level 0 – Level 5) cho hệ thống PQM nhằm đảm bảo:

1. **Kiến trúc đi trước mã nguồn**: Không có bất kỳ dòng code nào được viết nếu thiếu đặc tả nghiệp vụ, luật xử lý và tiêu chí nghiệm thu tương ứng.
2. **Loại bỏ hoàn toàn vùng xám**: Chấm dứt tình trạng UI tự suy diễn quy tắc kinh doanh, CoA tự nội suy số liệu, hay engine đánh rớt chỉ tiêu sai quy trình.
3. **Tính nhất quán toàn vẹn (ALCOA+)**: Mọi dữ liệu kiểm nghiệm, thẩm định và phê duyệt đều có nguồn gốc duy nhất (SSOT), có thể truy vết và kiểm toán 100%.

---

## 2. KIẾN TRÚC PHÂN TẦNG ĐẶC TẢ (THE 5-LEVEL ARCHITECTURE)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LEVEL 0: MASTER WORKFLOW & HIẾN PHÁP HỆ THỐNG (Constitution)           │
│ File: docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md                       │
│ - Tuyên ngôn các nguyên tắc bất biến: SSOT, Quality != Workflow,        │
│   No Implicit Pass/Fail, Evidence Before Conclusion, Data Locking,      │
│   Canonical Quality Evaluation, Release Gate...                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ LEVEL 1: BUSINESS RULES CATALOG (Bộ luật nghiệp vụ - BR-xxx)            │
│ Thư mục: docs/business-rules/                                           │
│ - Quy tắc xử lý chi tiết theo chuẩn: Rule ID, Trigger, Input,           │
│   Precondition, Decision, Output, State Transition, UI, Report, Audit   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ LEVEL 2: DOMAIN CONTRACTS & STATE MACHINES                              │
│ Thư mục: docs/contracts/                                                │
│ - State Machines: Batch, TestResult, Criterion, AlternateRule, OOS      │
│ - Data Contracts: Criterion, CriterionResult, EvaluationSnapshot        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ LEVEL 3: FUNCTIONAL SPECIFICATIONS (FRS) & E2E SCENARIOS                │
│ Thư mục: docs/functional-specs/                                         │
│ - Đặc tả chức năng hệ thống chi tiết (FRS-xxx)                          │
│ - Kịch bản người dùng từ đầu đến cuối (Scenario S-001 -> S-xxx)         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ LEVEL 4: SCREEN & UI BEHAVIOR CONTRACTS                                 │
│ Thư mục: docs/screen-contracts/                                         │
│ - Danh mục 25 màn hình chuẩn (Screen Inventory)                         │
│ - Hợp đồng hành vi UI: States, Form validations, Rules hiển thị         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ LEVEL 5: ACCEPTANCE CRITERIA & AUTOMATED TESTS                          │
│ Thư mục: docs/acceptance/ & tests/                                      │
│ - Tiêu chí nghiệm thu Gherkin (Given - When - Then: AC-xxx)             │
│ - Ma trận truy vết Traceability Matrix V2                               │
│ - Bộ kiểm thử tự động (Unit, Integration, E2E Playwright)               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. DANH MỤC 20 PHÂN HỆ NGHIỆP VỤ (BUSINESS DOMAIN MAP)

Toàn bộ nghiệp vụ của PQM được chia thành 20 phân hệ có mã định danh chuẩn:

|     Mã     | Tên Phân Hệ                    | Mục tiêu cốt lõi                                                             |
| :--------: | :----------------------------- | :--------------------------------------------------------------------------- |
| **MOD-01** | **Master Data & Organization** | Quản lý danh mục chung, cơ sở pháp lý, nhà xưởng, phòng lab                  |
| **MOD-02** | **Product Management**         | Quản lý thông tin sản phẩm, hoạt chất, số đăng ký, dạng bào chế              |
| **MOD-03** | **TCCS & Specifications**      | Vòng đời Tiêu chuẩn cơ sở, phiên bản, chỉ tiêu và quy tắc thay thế           |
| **MOD-04** | **Product Formula**            | Quản lý công thức định tính, định lượng, hàm lượng hoạt chất                 |
| **MOD-05** | **Raw Material & Supplier**    | Quản lý nguyên vật liệu đầu vào, nhà cung cấp, COA nguyên liệu               |
| **MOD-06** | **Batch Production**           | Quản lý lô sản xuất, lệnh sản xuất, liên kết TCCS và khóa dữ liệu            |
| **MOD-07** | **Test Result (PKN)**          | Vòng đời phiếu kiểm nghiệm, phân công, nhập liệu kết quả                     |
| **MOD-08** | **Quality Evaluation Engine**  | Động cơ thẩm định chất lượng chuẩn hóa, đánh giá chỉ tiêu                    |
| **MOD-09** | **Alternate Rules Engine**     | Xử lý quy tắc chỉ tiêu thay thế (FAIL_RETRY, CONDITIONAL_CHECK)              |
| **MOD-10** | **OOS Management**             | Quy trình điều tra kết quả ngoài tiêu chuẩn (Out Of Specification)           |
| **MOD-11** | **Deviation Management**       | Xử lý và ghi nhận sự cố, sai lệch trong sản xuất & kiểm nghiệm               |
| **MOD-12** | **CAPA Management**            | Quản lý hành động khắc phục và phòng ngừa sai lệch chất lượng                |
| **MOD-13** | **Approval Workflow**          | Quy trình phê duyệt đa cấp (Analyst ➔ Checker ➔ QA Manager)                  |
| **MOD-14** | **Release Gate**               | Chốt chặn xuất xưởng lô sản phẩm, kiểm tra điều kiện an toàn                 |
| **MOD-15** | **CoA Generation**             | Sinh phiếu phân tích kết quả (Certificate of Analysis) từ Snapshot           |
| **MOD-16** | **Electronic Signature**       | Ký số điện tử tuân thủ FDA 21 CFR Part 11                                    |
| **MOD-17** | **Audit Trail**                | Nhật ký kiểm toán toàn vẹn, bất biến, ghi nhận mọi thay đổi                  |
| **MOD-18** | **Genealogy & Traceability**   | Truy xuất nguồn gốc chuỗi cung ứng: Nguyên liệu ➔ Lô ➔ Phân phối             |
| **MOD-19** | **Reporting & Analytics**      | Báo cáo thống kê, phân tích xu hướng chất lượng, cảnh báo sớm                |
| **MOD-20** | **AI Assistant & Copilot**     | Trợ lý AI hỗ trợ tra cứu, đối chiếu tài liệu nhưng không có quyền quyết định |

---

## 4. DANH MỤC 25 MÀN HÌNH CHUẨN (SCREEN INVENTORY)

Mỗi màn hình đều có một `SCREEN_CONTRACT` riêng biệt quy định mọi thành phần và hành vi:

1. **SC-01**: **Dashboard Tổng quan Chất lượng** (Quality Overview, Alert Hub, KPI Cards)
2. **SC-02**: **Danh mục Sản phẩm** (Product List, Bộ lọc dạng bào chế, Trạng thái)
3. **SC-03**: **Chi tiết Sản phẩm** (Product Detail, Thông tin đăng ký, Lịch sử lô)
4. **SC-04**: **Danh mục TCCS** (TCCS List, Phiên bản hiệu lực, Lịch sử sửa đổi)
5. **SC-05**: **Chi tiết TCCS** (TCCS Viewer, Xem chỉ tiêu, Ghi chú thay thế)
6. **SC-06**: **Trình biên tập TCCS** (TCCS Editor, Cấu hình chỉ tiêu, Cấu hình Alternate Rules)
7. **SC-07**: **Công thức Sản phẩm** (Product Formula Manager, Tỷ lệ NVL, Hàm lượng)
8. **SC-08**: **Quản lý Nguyên vật liệu** (Raw Material Inventory, Nhà sản xuất)
9. **SC-09**: **Danh mục Lô sản xuất** (Batch List, Bộ lọc trạng thái, Cảnh báo hạn dùng)
10. **SC-10**: **Chi tiết Lô sản xuất** (Batch Detail, Hồ sơ lô, Trạng thái chất lượng)
11. **SC-11**: **Danh mục Phiếu kiểm nghiệm (PKN)** (Test Result List, Phòng Lab)
12. **SC-12**: **Trình biên tập & Nhập liệu PKN** (PKN Editor, Nhập kết quả chỉ tiêu)
13. **SC-13**: **Chi tiết Phiếu kiểm nghiệm** (PKN Viewer, Bảng kết quả, Đối chiếu tiêu chuẩn)
14. **SC-14**: **Xem & In Chứng nhận Phân tích (CoA)** (CoA Viewer & Print Engine)
15. **SC-15**: **Quản lý Hồ sơ OOS** (OOS List & Detail, Luồng điều tra nguyên nhân)
16. **SC-16**: **Quản lý Hồ sơ Sai lệch (Deviation)** (Deviation Tracking, Phân tích rủi ro)
17. **SC-17**: **Quản lý Hồ sơ CAPA** (CAPA List & Detail, Phân công và giám sát)
18. **SC-18**: **Trung tâm Phê duyệt & Ký số** (Approval Center, Ký điện tử CFR Part 11)
19. **SC-19**: **Nhật ký Ký số Điện tử** (Electronic Signature Log, Xác thực chữ ký)
20. **SC-20**: **Nhật ký Kiểm toán (Audit Trail)** (Audit Log Explorer, Lịch sử thay đổi)
21. **SC-21**: **Cây Phả hệ & Truy xuất nguồn gốc** (Batch Genealogy Tree, Nguyên liệu ➔ Thành phẩm)
22. **SC-22**: **Trung tâm Báo cáo & Thống kê** (Reports & Quality Trends Analytics)
23. **SC-23**: **Trợ lý Trí tuệ Nhân tạo (AI Copilot)** (AI Assistant Chat, Giải thích nghiệp vụ)
24. **SC-24**: **Quản lý Người dùng & Phân quyền (RBAC)** (User Management & Role Permissions)
25. **SC-25**: **Cài đặt Hệ thống** (System Settings, Dược điển, Cấu hình phòng Lab)

---

## 5. THIẾT KẾ CỐT LÕI: STATE MACHINE Ở CẤP CHỈ TIÊU (CRITERION-LEVEL STATE MACHINE)

Để giải quyết tận gốc lỗi "Chỉ tiêu thay thế", hệ thống thiết lập State Machine 2 tầng:

### A. Vòng đời Trạng thái Chỉ tiêu thường (Standard Criterion State Machine)

```
  [NOT_STARTED]
        │ (Khi tạo PKN từ TCCS)
        ▼
   [REQUIRED]
        │ (Khi Kiểm nghiệm viên bắt đầu nhập kết quả)
        ▼
   [TESTING]
        ├── (Giá trị nằm trong giới hạn TCCS) ────────────► [PASS]
        ├── (Giá trị vượt giới hạn & không có Alt Rule) ─► [FAIL] ──► (Kích hoạt OOS)
        └── (Chưa có kết quả hoặc dữ liệu không hợp lệ) ─► [PENDING]
```

### B. Vòng đời Trạng thái Quy tắc Thay thế (Alternate Rule State Machine)

Áp dụng độc quyền cho các cặp chỉ tiêu có cấu hình quy tắc thay thế:

```
                      [NOT_APPLICABLE] (Không có cấu hình quy tắc)
                             │
                             ▼
                    [NOT_TRIGGERED] (Chỉ tiêu chính chưa rớt / Điều kiện chưa thỏa)
                             │       👉 UI hiển thị nhãn "MIỄN KIỂM", Khóa ô nhập liệu
                             │
            ┌────────────────┴────────────────┐
            │                                 │
(Chỉ tiêu chính PASS)             (Chỉ tiêu chính FAIL hoặc thỏa điều kiện)
            │                                 │
            ▼                                 ▼
       [EXEMPTED]                   [TRIGGERED_PENDING]
(Chính thức được miễn kiểm,         (Bắt buộc phải kiểm nghiệm chỉ tiêu phụ,
 Không ảnh hưởng kết quả lô)         Ô nhập liệu mở ra, PKN ở trạng thái PENDING)
                                              │
                             ┌────────────────┴────────────────┐
                             │                                 │
                  (Chỉ tiêu phụ PASS)               (Chỉ tiêu phụ FAIL)
                             │                                 │
                             ▼                                 ▼
                     [TRIGGERED_PASS]                  [TRIGGERED_FAIL]
                 (Toàn bộ chỉ tiêu ĐẠT            (Toàn bộ chỉ tiêu KHÔNG ĐẠT,
                  theo cơ chế thay thế)            Chính thức kích hoạt OOS)
```

---

## 6. QUY CHUẨN CẤU TRÚC BUSINESS RULE (BR TEMPLATE)

Mọi Business Rule trong thư mục `docs/business-rules/` đều phải tuân theo cấu trúc nghiêm ngặt:

```markdown
### BR-[MODULE]-[CODE]-[STT]: [TÊN QUY TẮC]

- **Mục đích**: Lý do quy tắc tồn tại trong thực tế GMP / Kiểm nghiệm.
- **Actor áp dụng**: Analyst, QA, QC, System.
- **Trigger**: Sự kiện kích hoạt quy tắc.
- **Input**: Danh sách tham số đầu vào.
- **Precondition**: Điều kiện tiên quyết để quy tắc được phép chạy.
- **Decision Table / Logic**: Bảng logic quyết định (IF - THEN - ELSE).
- **Output & State Transition**: Dữ liệu đầu ra và trạng thái chuyển dịch.
- **UI Behavior Contract**: Hành vi hiển thị bắt buộc trên giao diện.
- **Report / CoA Behavior**: Cách thức thể hiện trên CoA hoặc Báo cáo.
- **Forbidden Behavior**: Những hành vi cấm kỵ tuyệt đối.
- **Exception Handling**: Xử lý tình huống ngoại lệ.
- **Audit Requirement**: Yêu cầu ghi nhật ký kiểm toán.
- **Test Cases**: Danh sách mã kiểm thử đơn vị cần có.
```

---

## 7. LỘ TRÌNH THỰC THI (MIGRATION & IMPLEMENTATION PHASES)

- **Giai đoạn A (Đặc tả)**: Hoàn thiện Phase 1 ➔ Phase 6 (Không chạm vào code).
- **Giai đoạn B (Engine & Tests)**: Xây dựng Domain Engine, Resolvers, Unit/E2E Tests độc lập.
- **Giai đoạn C (UI & Polish)**: Tái thiết kế màn hình giao diện theo đúng Screen Contract.
