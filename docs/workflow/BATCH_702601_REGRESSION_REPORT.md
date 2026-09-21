# PQM — BATCH 702601 REGRESSION REPORT

> **Báo cáo kiểm thử hồi quy ca thực tế: Lô sản xuất 702601**
> Mã sản phẩm: Bio Sacacillus Plus | Tiêu chuẩn: TCCS 64.03:2025/NAMVIET

---

## 1. MÔ TẢ SỰ CỐ GỐC (INCIDENT ANALYSIS)

- **Hiện tượng trước refactor**:
  Khi người dùng nhập và lưu phiếu kiểm nghiệm cho Lô hàng **702601**, mặc dù phiếu kiểm nghiệm có thể đạt hoặc đang trong quá trình nhập, Lô hàng bị hệ thống tự động đổi trạng thái sang `REJECTED` (hoặc `RELEASED` nếu đạt), gây gián đoạn quy trình xuất xưởng và làm sai lệch hồ sơ lô.
- **Nguyên nhân gốc rễ (Root Cause)**:
  Tại hook `useTestResultSave.ts`, sau khi lưu phiếu kiểm nghiệm thành công, mã nguồn cũ gọi:
  ```ts
  if (savedTestResult.overallStatus === 'PASS') {
    await updateBatchStatus(batchId, BATCH_STATUS.RELEASED);
  } else if (savedTestResult.overallStatus === 'FAIL') {
    await updateBatchStatus(batchId, BATCH_STATUS.REJECTED);
  }
  ```
  Đồng thời, khi người dùng mở form hoặc chọn Lô 702601, hook `useTestResultForm.ts` tự ý kích hoạt:
  ```ts
  if (batch.status !== BATCH_STATUS.TESTING) {
    updateBatchStatus(batchId, BATCH_STATUS.TESTING);
  }
  ```
- **Cam kết kiến trúc**:
  Không tạo "hotfix" gắn cứng theo số lô (`if (batchNo === '702601') ...`) hay theo tên sản phẩm (`if (product === 'Bio Sacacillus Plus') ...`). Sự cố 702601 phải được khắc phục tận gốc rễ thông qua việc sửa kiến trúc chung (Common Workflow Architecture).

---

## 2. KỊCH BẢN KIỂM THỬ HỒI QUY (REGRESSION SCENARIOS)

| Kịch bản                                          | Dữ liệu đầu vào                                                                | Hành vi kỳ vọng (Expected)                                                                                  | Kết quả thực tế (Actual)                                                           |  Đánh giá   |
| :------------------------------------------------ | :----------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- | :---------: |
| **Kịch bản 1: Nhập kết quả PASS**                 | Lô 702601 (`TESTING`) + Phiếu kiểm nghiệm PASS 100%                            | Quality Status = `PASS`<br>Completion = `100%`<br>**Batch Status KHÔNG TỰ ĐỔI (vẫn `TESTING`)**             | Quality Status = `PASS`<br>Batch Status = `TESTING`                                | ✅ **PASS** |
| **Kịch bản 2: Nhập kết quả FAIL**                 | Lô 702601 (`TESTING`) + Phiếu kiểm nghiệm có chỉ tiêu OOS (FAIL)               | Quality Status = `FAIL`<br>**Batch Status KHÔNG TỰ ĐỔI (vẫn `TESTING`)**<br>Xuất cảnh báo QA review         | Quality Status = `FAIL`<br>Batch Status = `TESTING`<br>Cảnh báo QA review hiển thị | ✅ **PASS** |
| **Kịch bản 3: Nhập kết quả chưa đầy đủ**          | Lô 702601 (`TESTING`) + 19/20 chỉ tiêu đạt, 1 chỉ tiêu đang kiểm               | Quality Status = `PENDING`<br>**Batch Status KHÔNG TỰ ĐỔI (vẫn `TESTING`)**<br>Không biến thành REJECTED    | Quality Status = `PENDING`<br>Batch Status = `TESTING`                             | ✅ **PASS** |
| **Kịch bản 4: Mở / Chọn Lô 702601 trong Form**    | Lô 702601 đang ở trạng thái bất kỳ (`PENDING`, `TESTING`, v.v.)                | Form tải dữ liệu TCCS Snapshot, danh sách phiếu cũ.<br>**Không có bất kỳ tác vụ ghi đè status nào xảy ra.** | Dữ liệu nạp đầy đủ.<br>Không có mutation.                                          | ✅ **PASS** |
| **Kịch bản 5: QA phê duyệt xuất xưởng Lô 702601** | QA duyệt Lô 702601 khi phiếu đạt + TCCS snapshot hợp lệ + Ký số 21 CFR Part 11 | Lô 702601 chuyển sang `RELEASED`<br>Ghi nhận Audit Trail ALCOA+ kèm mã băm chữ ký SHA-256                   | Lô chuyển `RELEASED`<br>Audit trail ghi nhận an toàn                               | ✅ **PASS** |

---

## 3. BẢN GHI AUDIT TRACE MINH CHỨNG (DECISION TRACE PROOF)

Khi lưu phiếu kiểm nghiệm cho Lô 702601:

```json
{
  "entityType": "TEST_RESULT",
  "entityId": "tr-702601-20260921",
  "batchId": "batch-702601",
  "action": "SAVE_TEST_RESULT",
  "qualityStatus": "PASS",
  "completionRate": 100,
  "workflowMutationTriggered": false,
  "batchWorkflowStatus": "TESTING",
  "auditRecordId": "audit-tr-save-702601-01"
}
```

**Kết luận**: Lô 702601 hoàn toàn không còn hiện tượng tự động đổi trạng thái khi lưu phiếu kiểm nghiệm hoặc khi chọn Lô.
