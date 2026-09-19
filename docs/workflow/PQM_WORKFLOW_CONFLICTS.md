# 🚨 PQM WORKFLOW CONFLICTS & RESOLUTION REGISTER

## SỔ ĐĂNG KÝ & BÁO CÁO MÂU THUẪN NGHIỆP VỤ (MODEL 00)

> **Căn cứ:** Nguyên tắc tối cao Model 00 — _“Không được thay đổi hoặc diễn giải khác với các nguyên tắc và workflow đã định nghĩa; nếu source code hiện tại mâu thuẫn với Master Workflow, phải báo cáo mâu thuẫn trước khi sửa.”_

---

## 1. TỔNG QUAN XUNG ĐỘT (EXECUTIVE CONFLICT SUMMARY)

Qua quá trình rà soát toàn bộ source code hiện tại đối chiếu với **PQM SYSTEM WORKFLOW MASTER**, hệ thống ghi nhận các điểm mâu thuẫn kiến trúc cốt lõi đã được phát hiện, phân loại và xử lý theo lộ trình:

| Mã mâu thuẫn (Conflict ID) | Phân hệ ảnh hưởng     | Tệp tin phát hiện                            | Mức độ nghiêm trọng | Model phân công |    Trạng thái giải quyết     |
| :------------------------- | :-------------------- | :------------------------------------------- | :-----------------: | :-------------: | :--------------------------: |
| **`CONFLICT-001`**         | Phả hệ lô (Genealogy) | `src/services/ai/batchGenealogyService.ts`   |     🔴 CRITICAL     |     Model 2     | 🟢 ĐÃ KHẮC PHỤC (Hoàn thành) |
| **`CONFLICT-002`**         | Truy vấn dữ liệu      | `src/services/testResultService.ts`          |     🔴 CRITICAL     |    Model 2.5    | 🟢 ĐÃ KHẮC PHỤC (Hoàn thành) |
| **`CONFLICT-003`**         | Đối chiếu dữ liệu     | `src/domain/consistency/consistencyModel.ts` |       🟡 HIGH       |     Model 7     | 🟢 ĐÃ KHẮC PHỤC (Hoàn thành) |
| **`CONFLICT-004`**         | Hàn gắn dữ liệu       | `src/domain/healing/autoHealingFramework.ts` |     🔴 CRITICAL     |     Model 8     | 🟢 ĐÃ KHẮC PHỤC (Hoàn thành) |
| **`CONFLICT-005`**         | Liên kết thực thể     | `src/types/testResult.ts`                    |       🟡 HIGH       |   Model 1 & 3   | 🟢 ĐÃ KHẮC PHỤC (Hoàn thành) |

---

## 2. CHI TIẾT TỪNG MÂU THUẪN (DETAILED CONFLICT ANALYSIS)

### `CONFLICT-001` — Genealogy ép trạng thái trung gian (`PENDING`/`UNKNOWN`) thành `FAIL`

- **Hiện trạng trong source code cũ**:
  ```typescript
  // File: src/services/ai/batchGenealogyService.ts
  const statusFromTestResult = (overallStatus: string): GenealogyNodeStatus => {
    return overallStatus === 'PASS' ? 'OK' : 'FAIL';
  };
  ```
- **Vi phạm nguyên tắc**: `PRINCIPLE-004` (No Implicit Fail).
- **Rủi ro Dược điển**: Các lô hàng đang trong giai đoạn nuôi cấy vi sinh (chưa có kết quả) bị hiển thị thành nút Đỏ (`FAIL`) trên cây phả hệ, gây hoang mang và sai lệch báo cáo thanh tra.
- **Hành vi chuẩn hóa (Canonical Resolution)**:
  ```typescript
  const statusFromTestResult = (overallStatus: string): GenealogyNodeStatus => {
    const canonical = resolveQualityStatus({ overallStatus } as any);
    if (canonical === 'PASS') return 'OK';
    if (canonical === 'FAIL') return 'FAIL';
    if (canonical === 'PENDING') return 'PENDING';
    return 'UNKNOWN';
  };
  ```
- **Model xử lý**: **Model 2** (Canonical Status Resolver).
- **Trạng thái**: Đã sửa và có test kiểm chứng tại `src/pages/batches/batch-360/batchGenealogy.test.ts`.

---

### `CONFLICT-002` — Fallback quét cạn toàn bộ database (`get(ref(db, 'testResults'))`)

- **Hiện trạng trong source code cũ**:
  ```typescript
  // File: src/services/testResultService.ts
  try {
    const batchQuery = query(testResultsRef, orderByChild('batchId'), equalTo(targetBatchId));
    ...
  } catch (error) {
    // FALLBACK NGUY HIỂM: Thử lấy tất cả và lọc client
    const allSnap = await get(ref(db, 'testResults'));
  }
  ```
- **Vi phạm nguyên tắc**: `PRINCIPLE-010` (Fail Closed).
- **Rủi ro Dược điển**: Trên môi trường sản xuất với hàng trăm nghìn bản ghi, việc tải toàn bộ collection làm tràn RAM trình duyệt, treo máy khách và tiềm ẩn nguy cơ rò rỉ dữ liệu khi index bị lỗi.
- **Hành vi chuẩn hóa (Canonical Resolution)**: Loại bỏ triệt để lệnh gọi `get(ref(db, 'testResults'))` và `get(ref(db, 'batches'))`. Khi query lỗi, ghi log có cấu trúc và chuyển sang Fail-Closed (ngừng thao tác, đọc từ offline cache/IndexedDB có kiểm soát).
- **Model xử lý**: **Model 2.5** (Data Access & Security Hardening).
- **Trạng thái**: Đã loại bỏ 100% trong `src/services/testResultService.ts`.

---

### `CONFLICT-003` — Cảnh báo sai lệch Đạt/Không đạt giả do thiếu `tccsId`

- **Hiện trạng trong source code cũ**:
  Trong `auditStatusConsistency` tại `src/domain/consistency/consistencyModel.ts`, hệ thống chỉ tra cứu TCCS qua `tr.tccsId`. Khi phiếu cũ không lưu trường này, hệ thống coi là không có tiêu chuẩn và báo sai lệch `CONTRADICTORY` mặc dù tất cả chỉ tiêu của phiếu đều ĐẠT.
- **Vi phạm nguyên tắc**: `PRINCIPLE-001` (Single Source of Truth) và `PRINCIPLE-004` (No Implicit Fail).
- **Rủi ro Dược điển**: Tạo ra các hồ sơ sai lệch giả (False-positive deviations), làm giảm độ tin cậy của Trung tâm toàn vẹn dữ liệu.
- **Hành vi chuẩn hóa (Canonical Resolution)**: Mở rộng cơ chế phân giải TCCS 3 tầng: `tr.tccsId || batch.tccsId || snapshot.tccsId`. Đồng thời phân loại lỗi thiếu thông tin thành `INCOMPLETE` (chưa hoàn tất) thay vì quy chụp thành `CONTRADICTORY` (mâu thuẫn thực tế).
- **Model xử lý**: **Model 7** (Consistency & Reconciliation).
- **Trạng thái**: Đã kiểm chứng tại `src/domain/canonical/model7Regression.test.ts`.

---

### `CONFLICT-004` — Auto-Healing không có giao dịch nguyên tử (Nguy cơ lỗi chắp vá 1✓, 2✓, 3✗)

- **Hiện trạng trong source code cũ**:
  Các thao tác sửa chữa dữ liệu tự động thực hiện lặp tuần tự qua mảng các action. Nếu action 3 bị lỗi mạng hoặc quyền hạn, action 1 và 2 vẫn nằm lại trong DB ở trạng thái sửa dở dang.
- **Vi phạm nguyên tắc**: `PRINCIPLE-013` (Atomic Regulated Mutation).
- **Rủi ro Dược điển**: Dữ liệu rơi vào trạng thái mất toàn vẹn (Corrupted / Partially Healed state), không thể khôi phục lại nguyên trạng ban đầu.
- **Hành vi chuẩn hóa (Canonical Resolution)**: Xây dựng phương thức `AutoHealingFramework.executeAtomicHealingPlan()` với cơ chế All-or-Nothing. Nếu bất kỳ mutation nào thất bại, kích hoạt `rollbackHandler` hoàn nguyên toàn bộ các thay đổi trước đó về nguyên trạng ban đầu và chuyển status của plan sang `ROLLED_BACK`.
- **Model xử lý**: **Model 8** (Auto-Healing Framework).
- **Trạng thái**: Đã kiểm chứng tại `src/domain/canonical/model8Regression.test.ts` và `src/domain/canonical/model13Regression.test.ts`.

---

### `CONFLICT-005` — TestResult thiếu trường liên kết Technical ID `productId`

- **Hiện trạng trong source code cũ**:
  `TestResult` chỉ lưu `batchId`, khi cần tra cứu sản phẩm phải đi vòng qua `batch.productId`. Nếu Lô bị lỗi hoặc chưa load kịp, liên kết với sản phẩm bị đứt gãy.
- **Vi phạm nguyên tắc**: `PRINCIPLE-012` (Traceability) và Model 3 (Entity Identity).
- **Hành vi chuẩn hóa (Canonical Resolution)**: Bổ sung tường minh trường `productId?: string` trong `TestResult` và `CanonicalTestResult`. Khi tạo phiếu mới, tự động kế thừa và lưu trực tiếp `productId` của Lô.
- **Model xử lý**: **Model 1 & 3** (Canonical Data Model & Entity Identity).
- **Trạng thái**: Đã hoàn thành trong `src/types/testResult.ts`.
