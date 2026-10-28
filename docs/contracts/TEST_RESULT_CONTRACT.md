# TEST_RESULT_CONTRACT: Hợp Đồng Dữ Liệu Kết Quả & Phiếu Kiểm Nghiệm

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu của Phiếu Kiểm Nghiệm (PKN / Test Result Sheet) và Kết quả kiểm nghiệm của từng chỉ tiêu (Criterion Result).

---

## 1. Bản Chất Nghiệp Vụ

- **TestResult (Phiếu kiểm nghiệm)**: Là tập hợp các kết quả thử nghiệm thực tế của một Lô hàng, do Kỹ thuật viên kiểm nghiệm (Analyst) thực hiện, được Thẩm tra bởi QA Reviewer và Phê duyệt bởi QA Manager.
- **CriterionResult**: Đại diện cho kết quả đo đạc thực tế của từng chỉ tiêu kỹ thuật riêng biệt.
- **Nguyên tắc No Overwrite**: Mọi sửa đổi kết quả sau khi đã nộp hoặc duyệt bắt buộc phải tạo phiên bản mới (Revision) hoặc ghi nhận lý do chi tiết kèm vết kiểm toán ALCOA+.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
export type TestResultStatus =
  | 'DRAFT' // Kỹ thuật viên đang nhập liệu
  | 'SUBMITTED' // Đã hoàn thành và nộp lên chờ thẩm định
  | 'REVIEWED' // Trưởng nhóm KCS/QA đã kiểm tra tính toàn vẹn
  | 'APPROVED' // Trưởng phòng QA đã phê duyệt chính thức
  | 'REJECTED' // Bị trả về yêu cầu làm lại / giải trình
  | 'REVOKED'; // Đã từng được duyệt nhưng bị thu hồi vô hiệu

export interface CriterionResultItem {
  criterionId: string;
  criterionCode: string;
  criterionName: string;
  department: 'PHYSICAL' | 'CHEMICAL' | 'MICROBIOLOGICAL';

  // Dữ liệu nhập thực nghiệm
  numericValue?: number;
  textValue?: string;
  displayValue: string; // Giá trị chuẩn để in ấn hiển thị (VD: "99.8%" hoặc "Khớp chuẩn")

  // Đánh giá chất lượng của riêng chỉ tiêu này
  evaluationStatus: 'PASS' | 'FAIL' | 'PENDING' | 'EXEMPTED';
  isOutOfSpecification: boolean;

  // Thông tin thực hiện phép thử
  analystId: string;
  analystName: string;
  testedDate: string; // Ngày làm thực tế
  testingEquipment?: string; // Máy sắc ký, máy đo pH, tủ sấy...
  rawNotes?: string;

  // Trạng thái khóa của chỉ tiêu
  isLocked: boolean;
}

export interface TestResultContract {
  testResultId: string;
  testResultNumber: string; // Mã số phiếu kiểm nghiệm (VD: PKN-2026-00123)
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  sampleReceiptDate: string; // Ngày nhận mẫu
  sampleQuantity: string; // Lượng mẫu nhận (VD: 50 viên)

  // Trạng thái vòng đời của phiếu
  status: TestResultStatus;
  revisionNumber: number; // Phiên bản sửa đổi (1, 2, 3...)

  // Danh sách toàn bộ kết quả chỉ tiêu
  results: CriterionResultItem[];

  // Tỷ lệ hoàn thành (%)
  completionRate: number;

  // Lịch sử thẩm định & Phê duyệt đa cấp
  workflowHistory: Array<{
    step: 'SUBMIT' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'REVOKE';
    actorId: string;
    actorName: string;
    actorRole: string;
    actionDate: string;
    comment?: string;
    signatureChecksum?: string;
  }>;

  // Mã băm bảo mật toàn vẹn phiếu
  documentChecksum: string;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Số lượng chỉ tiêu phải đầy đủ**: Phiếu kiểm nghiệm phải chứa toàn bộ các chỉ tiêu được định nghĩa trong Snapshot TCCS của Lô, không được tự ý xóa bớt hàng chỉ tiêu.
2. **Khóa dữ liệu khi Submit**: Khi trạng thái chuyển sang `SUBMITTED`, giao diện khóa chỉnh sửa của Kỹ thuật viên để bảo toàn bằng chứng thẩm tra.
3. **Mã băm Document Checksum**: Mỗi khi phiếu được duyệt, toàn bộ mảng `results` được băm SHA-256 để lưu thành `documentChecksum`. Mọi can thiệp backend ngoài luồng làm sai hash sẽ bị báo động an ninh.
