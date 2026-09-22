# COA_SNAPSHOT_CONTRACT: Hợp Đồng Bản Chụp Dữ Liệu Phiếu Kiểm Nghiệm (CoA Snapshot Contract)

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu của Bản chụp bất biến (Immutable Snapshot) của Phiếu Kiểm Nghiệm (Certificate of Analysis - CoA). CoA chỉ đọc 100% dữ liệu từ bản chụp này để hiển thị hoặc in ấn, tuyệt đối không tự tính toán lại logic chất lượng.

---

## 1. Bản Chất Nghiệp Vụ

- **Immutability (Tính bất biến)**: Một khi Lô sản phẩm đã được QA Manager phê duyệt và cấp phát hành CoA, toàn bộ thông tin hành chính, danh sách chỉ tiêu, kết quả đo, căn cứ quy chuẩn, chữ ký số và ghi chú footnote đều được đóng băng vĩnh viễn thành một đối tượng `CoASnapshot`.
- **Phòng chống thay đổi hồi cứu (Anti-Tampering)**: Cho dù các bảng dữ liệu gốc trong database có bị chỉnh sửa sau thời điểm này, nội dung CoA khi truy xuất hoặc in ra vẫn phản ánh chính xác 100% thời khắc lịch sử tại thời điểm phê duyệt.
- **Mã băm toàn vẹn (SHA-256 Digest)**: Snapshot được băm bằng thuật toán SHA-256 để kiểm tra tính toàn vẹn mỗi khi tài liệu được tải hoặc quét mã QR xác thực.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
export interface CoACriterionSnapshotItem {
  criterionId: string;
  criterionCode: string;
  criterionName: string;
  department: 'PHYSICAL' | 'CHEMICAL' | 'MICROBIOLOGICAL';
  testingMethod: string;

  // Mức chất lượng quy định (Lấy từ TCCS)
  specificationText: string;

  // Kết quả thực nghiệm
  resultText: string;

  // Kết luận chỉ tiêu
  conclusion: 'ĐẠT' | 'KHÔNG ĐẠT' | 'MIỄN THỬ';

  // Ghi chú footnote nếu áp dụng quy tắc thay thế / miễn thử
  footnoteMarker?: string; // Ví dụ: "(*)", "(**)"
  footnoteContent?: string;
  displayOrder: number;
}

export interface CoASnapshotContract {
  coaId: string;
  coaNumber: string; // Số phát hành chính thức (VD: CoA-2026-089)
  issueDate: string; // Ngày ban hành (ISO 8601)

  // Thông tin hành chính Lô (Snapshot)
  batchInfo: {
    batchId: string;
    batchNumber: string;
    productId: string;
    productName: string;
    genericName: string;
    dosageForm: string;
    strength: string;
    packagingSpecification: string;
    manufacturingDate: string;
    expirationDate: string;
    registrationNumber: string;
    batchSize: string;
    manufacturerName: string;
    manufacturerAddress: string;
  };

  // Căn cứ chất lượng áp dụng
  qualityStandard: {
    tccsId: string;
    tccsCode: string;
    versionNumber: number;
    pharmacopoeiaStandard: string; // DĐVN V, USP 43, BP...
  };

  // Danh sách các chỉ tiêu kiểm nghiệm đóng băng
  criteriaSnapshots: CoACriterionSnapshotItem[];

  // Danh sách các chú thích chân trang pháp lý (Footnotes)
  footnotes: Array<{
    marker: string;
    text: string;
  }>;

  // Kết luận tổng thể pháp lý của Lô
  overallConclusion: 'ĐẠT TIÊU CHUẨN' | 'KHÔNG ĐẠT TIÊU CHUẨN';
  legalDisclaimer: string; // Tuyên bố pháp lý chuẩn mực

  // Khối chữ ký số điện tử 21 CFR Part 11
  signatures: {
    analyst: {
      fullName: string;
      title: string;
      signedAt: string;
      meaning: string;
    };
    reviewer?: {
      fullName: string;
      title: string;
      signedAt: string;
      meaning: string;
    };
    approver: {
      fullName: string;
      title: string;
      signedAt: string;
      meaning: string;
      decisionNumber?: string;
    };
  };

  // Bảo mật toàn vẹn
  verification: {
    snapshotChecksum: string; // SHA-256 của toàn bộ payload Snapshot
    qrCodeUrl: string; // URL tra cứu xác thực trực tuyến công khai
    isRevoked: boolean;
    revokedAt?: string;
    revocationReason?: string;
  };

  createdAt: string;
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Cấm tính toán trong Template**: File view/in CoA (`CoAPrintView.tsx`, `CoAView.tsx`) chỉ được phép binding trực tiếp các thuộc tính trong `CoASnapshotContract` lên HTML elements. Tuyệt đối không có bất kỳ dòng lệnh nào dạng `if (val > spec.max) conclusion = "KHÔNG ĐẠT"`.
2. **Snapshot không thể ghi đè (Append-only / Immutable)**: Sau khi bản ghi `CoASnapshot` được tạo, backend từ chối mọi câu lệnh `UPDATE` trên bảng này. Nếu có sai sót cần chỉnh sửa, phải tạo một `CoASnapshot` mới với số hiệu Revision tăng dần (`CoA-2026-089-Rev1`).
3. **Mã băm Checksum toàn vẹn**: Khi hệ thống đọc Snapshot để render hoặc xuất PDF, hàm kiểm tra toàn vẹn băm lại dữ liệu và so sánh với `verification.snapshotChecksum`. Nếu có sự sai khác dù chỉ 1 ký tự, hệ thống phát cảnh báo dữ liệu đã bị can thiệp trái phép.
