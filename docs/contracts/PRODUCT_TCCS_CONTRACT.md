# PRODUCT_TCCS_CONTRACT: Hợp Đồng Dữ Liệu Sản Phẩm & Tiêu Chuẩn Cơ Sở

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu của Sản phẩm (Product), Tiêu chuẩn Cơ sở (TCCS), và cơ chế quản lý phiên bản (Versioning) theo nguyên tắc bất biến (Immutability).

---

## 1. Bản Chất Nghiệp Vụ

- **Product (Sản phẩm)**: Là thực thể mẹ định danh danh mục hàng hóa dược phẩm/thực phẩm chức năng.
- **TCCS (Tiêu chuẩn cơ sở)**: Là chứng từ kỹ thuật quy định các chỉ tiêu chất lượng, mức chất lượng và phương pháp thử của sản phẩm. Mỗi TCCS có vòng đời phiên bản độc lập (`DRAFT`, `EFFECTIVE`, `SUPERSEDED`, `OBSOLETE`).
- **Batch gắn chặt với Snapshot TCCS**: Khi một Lô được khởi tạo, hệ thống chụp lại bản Snapshot nguyên vẹn của TCCS tại thời điểm đó. Nếu TCCS bị sửa đổi hoặc ban hành bản mới sau này, các lô cũ đã sản xuất tuyệt đối không bị ảnh hưởng.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
export type ProductDosageForm =
  | 'TABLET' // Viên nén
  | 'CAPSULE' // Viên nang
  | 'INJECTION' // Thuốc tiêm
  | 'ORAL_LIQUID' // Dung dịch uống, siro
  | 'TOPICAL_CREAM' // Thuốc mỡ, kem bôi
  | 'POWDER' // Thuốc bột, cốm
  | 'RAW_MATERIAL'; // Nguyên liệu hoạt chất / tá dược

export interface ProductContract {
  productId: string;
  productCode: string; // Mã nội bộ duy nhất
  productName: string; // Tên biệt dược hoặc tên thương mại
  genericName: string; // Tên hoạt chất gốc (INN)
  dosageForm: ProductDosageForm;
  strength: string; // Hàm lượng (ví dụ: 500mg)
  packagingSpecification: string; // Quy cách đóng gói (Hộp 10 vỉ x 10 viên)
  shelfLifeMonths: number; // Tuổi thọ (ví dụ: 36 tháng)
  storageConditions: string; // Điều kiện bảo quản (Bảo quản nơi khô mát < 30°C)
  registrationNumber: string; // Số đăng ký lưu hành (SĐK/GPNK)
  manufacturer: string;
  isActive: boolean;
  activeTccsId?: string; // ID bản TCCS đang có hiệu lực
  createdAt: string;
  updatedAt: string;
}

export type TCCSStatus =
  | 'DRAFT' // Bản thảo đang soạn thảo
  | 'UNDER_REVIEW' // Đang chờ thẩm định
  | 'EFFECTIVE' // Đang có hiệu lực chính thức
  | 'SUPERSEDED' // Đã bị thay thế bởi phiên bản mới
  | 'OBSOLETE'; // Đã bị bãi bỏ hoàn toàn

export interface TCCSContract {
  tccsId: string;
  tccsCode: string; // Ví dụ: TCCS-PARA500-02
  productId: string;
  versionNumber: number; // Số phiên bản (1, 2, 3...)
  status: TCCSStatus;
  effectiveDate: string; // Ngày bắt đầu hiệu lực (ISO 8601)
  expirationDate?: string; // Ngày hết hiệu lực
  pharmacopoeiaStandard: string; // Căn cứ Dược điển (VD: DĐVN V, USP 43)

  // Danh sách các chỉ tiêu kiểm nghiệm
  criteria: Array<{
    criterionId: string;
    criterionCode: string;
    criterionName: string;
    department: 'PHYSICAL' | 'CHEMICAL' | 'MICROBIOLOGICAL';
    type: 'NUMERIC' | 'QUALITATIVE' | 'LIMIT_TEST' | 'MICROBIOLOGY';
    specification: {
      unit?: string;
      minValue?: number;
      maxValue?: number;
      expectedText?: string;
      rawSpecificationText: string;
    };
    testingMethod: string; // Phương pháp thử (TCVN, SOP, Dược điển)
    isMandatory: boolean;
    displayOrder: number;
  }>;

  // Danh sách các quy tắc thay thế
  alternateRules?: Array<{
    ruleId: string;
    ruleCode: string;
    ruleType: 'FAIL_RETRY' | 'CONDITIONAL_CHECK' | 'SUBSTITUTION' | 'PERIODIC_SKIP';
    primaryCriterionId: string;
    substituteCriterionId: string;
    footnoteText: string;
  }>;

  // Thông tin phê duyệt ban hành
  approvalInfo?: {
    approvedBy: string;
    approvedByName: string;
    approvedAt: string;
    decisionNumber: string;
    signatureChecksum: string;
  };
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Duy nhất một bản Effective**: Với mỗi Sản phẩm (`productId`), tại một thời điểm chỉ được phép có duy nhất 1 bản TCCS ở trạng thái `EFFECTIVE`. Khi ban hành bản TCCS mới, bản TCCS cũ tự động chuyển sang `SUPERSEDED`.
2. **Không sửa bản đã ban hành**: Khi TCCS đã chuyển sang `EFFECTIVE`, tuyệt đối cấm mọi hành vi chỉnh sửa nội dung tiêu chuẩn. Bất kỳ thay đổi nào bắt buộc phải nâng phiên bản mới (`versionNumber + 1`).
3. **Mã TCCS duy nhất**: Cặp `(productId, versionNumber)` là khóa duy nhất trong toàn hệ thống.
