# PQM — WORKFLOW CONTRACT DIFF

> **So sánh sự thay đổi giữa Kiến trúc Cũ (Trước refactor) và Kiến trúc Mới (Sau refactor chuẩn hóa)**

---

## 1. SO SÁNH LUỒNG LƯU KẾT QUẢ KIỂM NGHIỆM (TEST RESULT SAVE FLOW)

```diff
  LƯU PHIẾU KIỂM NGHIỆM:
      ↓
  Validate & Compute Criterion Results
      ↓
  Canonical Evaluation (Model 2)
      ↓
  Persist TestResult vào Database
      ↓
  Cập nhật Completion Rate
      ↓
  Cập nhật Quality Status
-     ↓
- [VI PHẠM] Nếu overallStatus == 'PASS' → updateBatchStatus(batchId, 'RELEASED')
- [VI PHẠM] Nếu overallStatus == 'FAIL' → updateBatchStatus(batchId, 'REJECTED')
- [VI PHẠM] Nếu batch chưa TESTING → updateBatchStatus(batchId, 'TESTING')
+     ↓
+ Ghi nhận Audit Trail chuẩn ALCOA+
+     ↓
+ KẾT THÚC (Batch Status giữ nguyên 100% không đổi)
```

---

## 2. SO SÁNH VÒNG ĐỜI LÔ SẢN XUẤT (BATCH WORKFLOW CONTRACT)

```diff
  KHỞI TẠO LÔ SẢN XUẤT:
- Direct Create (AI / OCR / Auto-Create) → status: 'TESTING'
+ Explicit Create → Bắt buộc status: 'PENDING'

  CHUYỂN SANG ĐANG KIỂM NGHIỆM:
- Side-effect khi mở form hoặc chọn Lô trong dropdown
+ Explicit Action: START_TESTING (LAB / PRODUCTION / QA)

  PHÊ DUYỆT XUẤT XƯỞNG (RELEASE):
- Phân tán giữa BatchRules.canRelease() và UI
+ Unified Release Gate: ReleaseRules.evaluateReleasePrerequisites()
+ Bắt buộc 7 Gates:
+   1. Lô hợp lệ
+   2. TCCS chuẩn và snapshot toàn vẹn
+   3. Có phiếu kiểm nghiệm authoritative
+   4. Canonical Quality = PASS
+   5. Evaluation Snapshot hợp lệ
+   6. Không có sai lệch nghiêm trọng (Critical Deviation) chưa đóng
+   7. QA/ADMIN + Chữ ký điện tử (21 CFR Part 11)

  TỪ CHỐI LÔ (REJECT):
- Tự động nhảy sang REJECTED khi có phiếu FAIL
+ QA Decision qua action REJECT_BATCH + Bắt buộc lý do giải trình rõ ràng + Audit Trail

  MỞ LẠI LÔ (REOPEN REJECTED):
- Không có kiểm soát lý do, user có thể đổi lại
+ QA/ADMIN + Thẩm tra biên bản CAPA (Corrective and Preventive Actions) + Bắt buộc lý do
```

---

## 3. SO SÁNH VÒNG ĐỜI PHIẾU KIỂM NGHIỆM (TEST RESULT WORKFLOW CONTRACT)

```diff
  TRẠNG THÁI CHUẨN:
- Nhầm lẫn giữa TestResult.RELEASED và Batch.RELEASED
+ Phân định rạch ròi:
+   TestResult: DRAFT → SUBMITTED → FINAL → APPROVED → SUPERSEDED
+   Batch:      PENDING → TESTING → RELEASED / REJECTED / BLOCKED

  PHÊ DUYỆT PHIẾU (FINAL → APPROVED):
- Cho phép gọi repo.update({ workflowStatus: 'APPROVED' }) không cần ký số
+ Bắt buộc chữ ký điện tử FDA 21 CFR Part 11 (SHA-256 Checksum) của QA/ADMIN

  HỦY/KIỂM NGHIỆM LẠI (SUPERSEDED):
- Thiếu phân quyền, LAB/QC có thể tự supersede
+ Chỉ QA/ADMIN có lý do giải trình kiểm nghiệm lại mới được chuyển sang SUPERSEDED
+ SUPERSEDED là Terminal State (không thể chuyển tiếp sang bất kỳ trạng thái nào)
```

---

## 4. SO SÁNH PHÂN QUYỀN AI (AI WORKFLOW GOVERNANCE CONTRACT)

```diff
  AI THAO TÁC VỚI WORKFLOW:
- AI có thể gọi updateBatchStatusAction và trực tiếp store.updateBatchStatus()
+ AI CHỈ ĐƯỢC PHÉP ĐỀ XUẤT (PROPOSAL ONLY)
+ Mọi hành động nhạy cảm (Regulated Actions) phải hiển thị Proposal để Người dùng có thẩm quyền phê duyệt
+ AI tạo Lô mới: Bắt buộc PENDING, không được tự ý gán TESTING
```
