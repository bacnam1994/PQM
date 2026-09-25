# PQM — XÁC MINH RANH GIỚI AN TOÀN TRÍ TUỆ NHÂN TẠO (AI BOUNDARY AUDIT)

> **Tài liệu:** PQM_FINAL_AI_BOUNDARY.md  
> **Phiên bản:** 1.0.0-FINAL-SOURCE-VERIFIED  
> **Ngày thực hiện:** 2026-09-24  
> **Mục tiêu:** Xác minh toàn bộ các luồng tương tác của hệ thống Trí tuệ nhân tạo (AI Copilot, OCR Scanner, Auto-Healer, Predictive Inspection) tuân thủ nguyên tắc "Proposal-Only" — AI không có thẩm quyền tự động thay đổi dữ liệu có quy chuẩn (Zero Autonomous Regulated Mutations).

---

## 1. NGUYÊN TẮC QUẢN TRỊ AI TRONG DƯỢC PHẨM (AI GOVERNANCE IN GMP)

1. **AI chỉ mang tính chất hỗ trợ và khuyến nghị (Advisory & Proposal):**
   - AI được phép: Trích xuất OCR văn bản, phân tích xu hướng SPC, dự báo hạn dùng, gợi ý khớp nối chỉ tiêu (Mapping), tổng hợp báo cáo PQR và phát hiện bất thường liên kết dữ liệu.
2. **AI TUYỆT ĐỐI KHÔNG ĐƯỢC PHÉP**:
   - Tự động phê duyệt phiếu kiểm nghiệm (`test_result:approve`).
   - Tự động xuất xưởng lô (`batch:release`) hoặc từ chối lô (`batch:reject`).
   - Tự động thay đổi trạng thái quy trình trong Finite State Machine.
   - Tự động xóa bản ghi hoặc tự động thi hành bản sửa lỗi (Auto-Healing) trực tiếp trên cơ sở dữ liệu.
3. **Mô hình bắt buộc: Human-in-the-Loop (HITL)**:
   $$\text{AI Analysis} \longrightarrow \text{Action Proposal (Draft)} \longrightarrow \text{Authorized Human Review} \longrightarrow \text{Canonical Workflow Execution} \longrightarrow \text{Audit Trail}$$

---

## 2. RÀ SOÁT CÁC ĐIỂM TƯƠNG TÁC AI TRONG MÃ NGUỒN

### 2.1. AI Action Guard (`src/services/ai/aiActionGuard.ts`)

- **Chức năng:** Là chốt chặn an ninh bắt buộc trước khi bất kỳ công cụ AI nào sinh ra đề xuất thao tác dữ liệu.
- **Rà soát danh mục Regulated Actions:**
  ```typescript
  export const REGULATED_ACTIONS: Record<
    string,
    { permission: PermissionAction; isStrict: boolean }
  > = {
    'batch:release': { permission: 'batch:release', isStrict: true },
    'batch:reject': { permission: 'batch:reject', isStrict: true },
    'batch:update': { permission: 'batch:update', isStrict: false },
    'batch:create': { permission: 'batch:create', isStrict: false },
    'test_result:approve': { permission: 'test_result:approve', isStrict: true },
    'test_result:create': { permission: 'test_result:create', isStrict: false },
    'test_result:update': { permission: 'test_result:update', isStrict: false },
    'material:harmonize': { permission: 'material:update', isStrict: true },
    'data:auto_heal': { permission: 'settings:update', isStrict: true },
  };
  ```
- **Cơ chế Proposal Enforce:**
  Nếu một công cụ AI nhắm vào các hành động nhạy cảm (`updateBatchStatus`, `autoHealInconsistencies`, `harmonizeMaterials`), `aiActionGuard.validateAIAction` bắt buộc:
  - `requiresUserApproval: true`
  - Đóng gói thành `AIActionProposal` với trạng thái `PENDING_APPROVAL`.
  - Không cho phép thực thi tự động.

### 2.2. Trích xuất OCR Phiếu kiểm nghiệm (`src/services/ai/tools/ocrTool.ts` & `AIGateway.ts`)

- **Hành vi thực tế:**
  - AI đọc hình ảnh/PDF kiểm nghiệm và trả về mảng kết quả trích xuất dạng JSON Draft.
  - Kết quả được điền trước (Pre-fill) vào giao diện `TestResultForm.tsx`.
  - Kỹ thuật viên phòng Lab hoặc QC bắt buộc phải kiểm tra, đối chiếu bằng chứng vật lý và nhấn nút "Lưu phiếu" / "Gửi duyệt".
  - AI không thể trực tiếp ghi bản ghi vào nhánh `testResults/`.
- **Đánh giá:** ✅ **Hoàn toàn tuân thủ.**

### 2.3. Khởi tạo Lô nhanh bằng AI (`ACT-BTCH-012`)

- **Hành vi thực tế:**
  - Người dùng tải tài liệu kế hoạch sản xuất lên hoặc nhập lệnh ngôn ngữ tự nhiên.
  - AI phân tích và tạo `CREATE_BATCH_PROPOSAL`.
  - Bản đề xuất mở ra cửa sổ Modal `BatchCreationModal` có điền trước thông tin.
  - Người dùng có thẩm quyền thực hiện xác nhận và lưu thông qua `BatchAppService.createBatch`.
- **Đánh giá:** ✅ **Tuân thủ chuẩn tắc.**

### 2.4. Khung Hàn gắn Dữ liệu Tự động (Auto-Healing Framework)

- **Vị trí:** `src/domain/healing/autoHealingFramework.ts` & `src/services/ai/dataIntegrityService.ts`
- **Hành vi thực tế:**
  - `DataIntegrityService` quét 6 nhóm bất cập toàn vẹn thực thể (lô thiếu TCCS, chỉ tiêu mồ côi, sai lệch mã băm).
  - Hệ thống tạo ra một `HealingPlan` gồm danh sách các hành động sửa lỗi dự kiến (`actions`).
  - **Khóa an toàn:** Rào chắn ngăn chặn không cho phép sửa chữa các phiếu đã có `evaluationSnapshot` hoặc đã `APPROVED`/`RELEASED`.
  - Kế hoạch phải được Trưởng phòng QA phê duyệt (`plan.status = 'APPROVED'`) trước khi được đưa vào `executeAtomicHealingPlan`.
  - Khi thực thi, áp dụng cơ chế giao dịch nguyên tử 2 pha (2-phase commit & rollback handler).
- **Đánh giá:** ✅ **Không có tình trạng AI tự ý âm thầm sửa đổi DB.**

### 2.5. Tự học Khớp nối Chỉ tiêu (AI Learned Mapping)

- **Vị trí:** `src/services/ai/autoLearningService.ts`
- **Hành vi thực tế:**
  - Chỉ ghi nhận thống kê số lần người dùng chọn ánh xạ chỉ tiêu thành công thông qua `AILearnedMappingRepository`.
  - Không tự động thay đổi tên chỉ tiêu gốc trong cơ sở dữ liệu TCCS khi chưa có xác nhận từ người quản trị.
- **Đánh giá:** ✅ **Hoàn toàn tuân thủ.**

---

## 3. BẰNG CHỨNG KIỂM THỬ TỰ ĐỘNG

- `src/services/ai/aiActionGuard.test.ts`:
  - `aiActionGuard biến hành động nhạy cảm của AI thành proposal yêu cầu Human Approval` -> **PASS**
  - `aiActionGuard từ chối khi tài khoản AI gọi không có quyền RBAC` -> **PASS**
- `src/domain/canonical/model13Regression.test.ts`:
  - `Gate 1: Client Bypass & Role-based Authorization` -> **PASS**
- `tests/security/autoHealingValidation.test.ts`:
  - `Rào chắn Auto-Heal không được sửa đổi phiếu đã chốt APPROVED` -> **PASS**

---

## 4. KẾT LUẬN

- **Ranh giới an toàn AI:** ✅ **100% PROPOSAL-ONLY & HUMAN-VERIFIED**
- Không có bất kỳ vector tấn công hay luồng tự động nào cho phép AI Copilot vượt quyền con người để thay đổi dữ liệu có quy chuẩn.
