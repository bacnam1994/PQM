# BẢNG ĐĂNG KÝ LỖ HỔNG & MÂU THUẪN KIẾN TRÚC PQM

## (WORKFLOW GAP & CONFLICT REGISTER)

> **Mã tài liệu**: `PQM-GAP-REG-001`  
> **Trạng thái**: ACTIVE (Baseline Audit)  
> **Ngày lập**: 22/09/2026  
> **Phạm vi đối chiếu**: [`PQM_SYSTEM_WORKFLOW_MASTER.md`](file:///D:/26%20Kiem%20nghiem/PQM/docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md) vs Thực trạng mã nguồn (`src/`)

---

## 1. TỔNG QUAN PHÂN LOẠI KHOẢNG TRỐNG

| Mã phân loại          | Định nghĩa                                                        | Số lượng phát hiện | Mức độ nghiêm trọng |
| :-------------------- | :---------------------------------------------------------------- | :----------------: | :-----------------: |
| **CONFLICT**          | Mã nguồn triển khai mâu thuẫn trực tiếp với Master Workflow       |         6          |     🔴 CRITICAL     |
| **MISSING**           | Nghiệp vụ cần thiết nhưng hoàn toàn chưa có trong tài liệu đặc tả |         8          |       🔴 HIGH       |
| **IMPLEMENTED_WRONG** | Đã triển khai nhưng sai bản chất hoặc sai lệch cơ chế             |         5          |       🔴 HIGH       |
| **AMBIGUOUS**         | Master Workflow mô tả chung chung, để ngỏ cho dev/UI tự suy diễn  |         7          |      🟡 MEDIUM      |
| **LEGACY**            | Mã nguồn tàn dư cũ mâu thuẫn với kiến trúc hiện tại               |         4          |      🟡 MEDIUM      |

---

## 2. CHI TIẾT CÁC LỖ HỔNG & MÂU THUẪN HỆ THỐNG

### 🔴 GAP-01: Phụ thuộc vào Tên chuỗi (String Name) thay vì Criterion ID

- **Phân loại**: `IMPLEMENTED_WRONG` / `ARCHITECTURAL_DEBT`
- **Vị trí**: [`src/types/tccs.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/tccs.ts), [`src/types/testResult.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/testResult.ts), [`AlternateRuleResolver.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/domain/evaluation/AlternateRuleResolver.ts)
- **Thực trạng**:
  - `Criterion` trong TCCS không có trường `id` hoặc `code` bất biến duy nhất, chỉ có `name: string`.
  - `AlternateRule` liên kết qua `main: string` và `alt: string`.
  - Toàn bộ hệ thống phải dùng các hàm chuẩn hóa chuỗi `normalizeName()`, `criteriaAliasService`, `isNameMatch()` để so khớp tên chỉ tiêu.
- **Hậu quả**: Khi người dùng gõ sai chính tả, đổi dấu câu, khoảng trắng thừa, hoặc cập nhật tên chỉ tiêu trong TCCS, toàn bộ liên kết Alternate Rule và lịch sử kiểm nghiệm bị đứt gãy.
- **Quy chuẩn sửa đổi bắt buộc**: `Criterion` bắt buộc phải có `id` (UUID hoặc NanoID). `AlternateRule` bắt buộc tham chiếu qua `mainCriterionId` và `altCriterionId`.

---

### 🔴 GAP-02: Màn hình CoA tự động gộp và nội suy dữ liệu thay vì lấy từ EvaluationSnapshot

- **Phân loại**: `CONFLICT` (Vi phạm trực tiếp nguyên tắc SSOT & Data Locking của Master Workflow)
- **Vị trí**: [`src/components/features/CoAReport.tsx#L210-L255`](file:///D:/26%20Kiem%20nghiem/PQM/src/components/features/CoAReport.tsx)
- **Thực trạng**:
  - `CoAReport.tsx` tự động chạy hàm `deduplicatedResults` gộp nhiều kết quả bằng thuật toán riêng.
  - Tự động chạy vòng lặp duyệt qua TCCS để **nội suy (interpolate)** chỉ tiêu thiếu/rỗng qua `AlternateRuleResolver`.
- **Mâu thuẫn với Workflow**: Master Workflow quy định: _"Bất kỳ tài liệu pháp lý nào (CoA, Phiếu kiểm nghiệm) in ra PHẢI đọc trực tiếp từ EvaluationSnapshot đã được khóa bất biến (Locked Snapshot) sau khi phê duyệt. Giao diện báo cáo TUYỆT ĐỐI KHÔNG được tự tính toán lại hoặc tự bổ sung kết quả ảo."_
- **Quy chuẩn sửa đổi bắt buộc**: CoA chỉ được phép render trực tiếp mảng `snapshot.criterionResults`. Nếu thiếu kết quả hoặc chưa có snapshot, cấm xuất CoA.

---

### 🔴 GAP-03: Thiếu State Machine tường minh ở cấp Chỉ tiêu (Criterion-Level State Machine)

- **Phân loại**: `MISSING`
- **Vị trí**: [`src/types/testResult.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/testResult.ts), [`AlternateRuleResolver.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/domain/evaluation/AlternateRuleResolver.ts)
- **Thực trạng**:
  - Hệ thống mới chỉ có State Machine cho `Batch` và `TestResult`.
  - Cấp chỉ tiêu hiện chỉ có `isPass: boolean | null` kèm theo một enum bổ trợ rời rạc `AlternateCriterionState`.
  - Khi chỉ tiêu chính FAIL, chỉ tiêu phụ không có một vòng đời trạng thái chuyển tiếp chính thức được kiểm soát bởi State Machine: `NOT_STARTED` ➔ `REQUIRED` ➔ `TESTING` ➔ `PASS` / `FAIL` / `PENDING` / `EXEMPTED`.
- **Hậu quả**: Các component UI tự biên tự diễn (chỗ thì hiện "Miễn kiểm", chỗ thì ẩn dòng, chỗ thì coi không nhập là FAIL).
- **Quy chuẩn sửa đổi bắt buộc**: Xây dựng `CriterionStateEngine` độc lập, quản lý chuyển dịch trạng thái của từng chỉ tiêu một cách tiền định.

---

### 🔴 GAP-04: Cấu trúc điều kiện của AlternateRule dạng chuỗi tự do (Unstructured Condition)

- **Phân loại**: `AMBIGUOUS` / `IMPLEMENTED_WRONG`
- **Vị trí**: [`src/types/tccs.ts#L36-L45`](file:///D:/26%20Kiem%20nghiem/PQM/src/types/tccs.ts)
- **Thực trạng**:
  - `AlternateRule` chỉ có `type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK'` và `conditionValue?: string`.
  - Giá trị `conditionValue` là chuỗi tự do (ví dụ: `"> 100"`, `"Đục"`, `"< 5%"`), dẫn đến `AlternateRuleResolver` phải dùng Regex để bóc tách toán tử `>`, `<`, `<=`, `==`.
- **Hậu quả**: Không có kiểm tra tính hợp lệ lúc người dùng tạo TCCS (Schema validation). Nếu người dùng nhập sai cú pháp, Engine sẽ parse lỗi lúc runtime khi đánh giá lô.
- **Quy chuẩn sửa đổi bắt buộc**: Chuẩn hóa điều kiện dạng AST/JSON Schema có cấu trúc:
  ```typescript
  condition: {
    operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CONTAINS' | 'BETWEEN';
    targetValue: number | string;
    targetValueMax?: number;
  }
  ```

---

### 🔴 GAP-05: Thiếu Hợp đồng Hành vi Giao diện (UI Behavior Contract) cho PKN Editor

- **Phân loại**: `MISSING`
- **Vị trí**: [`src/components/features/CriteriaInputGroup.tsx`](file:///D:/26%20Kiem%20nghiem/PQM/src/components/features/CriteriaInputGroup.tsx)
- **Thực trạng**:
  - Không có tài liệu nào quy định:
    1. Chỉ tiêu ở trạng thái `NOT_TRIGGERED` thì UI hiển thị như thế nào (Disabled input, nhãn "Miễn kiểm", không được ẩn dòng).
    2. Chỉ tiêu ở trạng thái `TRIGGERED_PENDING` thì UI cảnh báo thế nào (Border màu vàng/cam, nhãn "Chờ kết quả", chặn Submit).
    3. Khi nào Analyst được phép gõ đè, khi nào bị khóa ô nhập.
- **Hậu quả**: UI tự quyết định logic hiển thị, dẫn tới việc từng phiên bản code có hành vi khác nhau (lúc thì ẩn chỉ tiêu, lúc thì bắt buộc nhập).
- **Quy chuẩn sửa đổi bắt buộc**: Ban hành tài liệu `SC-012_PKN_EDITOR_CONTRACT.md`.

---

### 🟡 GAP-06: TCCS Versioning & Snapshotting chưa bất biến hoàn toàn

- **Phân loại**: `CONFLICT` / `AMBIGUOUS`
- **Vị trí**: [`src/services/dataConsistencyService.ts`](file:///D:/26%20Kiem%20nghiem/PQM/src/services/dataConsistencyService.ts), [`src/pages/tccs/`](file:///D:/26%20Kiem%20nghiem/PQM/src/pages/tccs/)
- **Thực trạng**:
  - Master Workflow yêu cầu: Mỗi Lô sản xuất khi tạo ra phải được gắn chặt với một bản **TCCS Snapshot (Frozen Spec)** tại thời điểm sản xuất.
  - Thực tế mã nguồn: Nhiều nơi vẫn load TCCS hiện hành (`isActive === true`) của sản phẩm đó để đánh giá lại lô cũ, khiến việc sửa TCCS sau này làm sai lệch kết quả kiểm nghiệm của các lô đã sản xuất trong quá khứ.
- **Quy chuẩn sửa đổi bắt buộc**: Bắt buộc mọi Lô phải có `tccsSnapshotId` và nhúng nguyên vẹn bản snapshot TCCS vào metadata của Lô.

---

### 🟡 GAP-07: Quy trình Release Gate chưa có rào chắn chặn cứng tại Firebase Rules

- **Phân loại**: `CONFLICT`
- **Vị trí**: [`database.rules.json`](file:///D:/26%20Kiem%20nghiem/PQM/database.rules.json)
- **Thực trạng**:
  - Master Workflow tuyên bố: _"Release Gate là chốt chặn an ninh tối thượng. Lô không ĐẠT kiểm nghiệm thì KHÔNG MỘT AI (kể cả Admin) được chuyển trạng thái sang RELEASED."_
  - Tuy nhiên, trong `database.rules.json`, quy tắc bảo vệ trạng thái `status === 'RELEASED'` chỉ kiểm tra quyền `auth.token.role === 'admin' || 'qa_manager'`, mà **chưa kiểm tra điều kiện `data.child('qualityStatus').val() === 'PASS'` và có đủ chữ ký điện tử**.
- **Hậu quả**: Nếu có bug ở UI hoặc gọi trực tiếp API/Firebase SDK, trạng thái RELEASED vẫn có thể bị ghi vào cơ sở dữ liệu.
- **Quy chuẩn sửa đổi bắt buộc**: Bổ sung rào chắn an ninh cấp cơ sở dữ liệu (Database Security Guard) trong `database.rules.json`.

---

## 3. DANH SÁCH TÀN DƯ MÃ NGUỒN CŨ CẦN XỬ LÝ (LEGACY DEBT)

1. **`composition` trong TCCS**: Trường `composition` dạng text tự do trong TCCS đã cũ nhưng vẫn tồn tại song song với `ProductFormula`.
2. **`criteriaAliasService`**: Service xử lý alias tên chỉ tiêu là giải pháp tình thế do thiếu Master Criterion ID. Cần được quy hoạch lại thành tầng hỗ trợ Import/OCR thay vì làm lõi cho Domain.
3. **Các trường Workflow Status lẫn lộn**: Vẫn còn một số hàm kiểm tra `batch.status === 'PASSED'` hoặc `batch.status === 'FAILED'` thay vì tách biệt `batch.status` (Workflow) và `batch.qualityStatus` (Quality).

---

## 4. KẾT LUẬN & ĐỀ XUẤT HÀNH ĐỘNG

Bảng đăng ký này là căn cứ pháp lý để xây dựng **Blueprint V2** và thực hiện **Phase 1 – Phase 6**. Tuyệt đối không sửa code trước khi các tài liệu đặc tả khắc phục 7 lỗ hổng trên được ký duyệt.
