# FORMULA_MATERIAL_CONTRACT: Hợp Đồng Dữ Liệu Công Thức Sản Xuất & Nguyên Liệu

Tài liệu này chuẩn hóa cấu trúc dữ liệu của Định mức Công thức Sản xuất (Master Formula / BOM) và Nguyên vật liệu (Raw Materials & Packaging Materials) phục vụ liên kết phả hệ và kiểm soát chất lượng đầu vào.

---

## 1. Bản Chất Nghiệp Vụ

- **RawMaterial (Nguyên vật liệu)**: Đại diện cho hoạt chất (Active Pharmaceutical Ingredient - API), tá dược (Excipients), hoặc bao bì đóng gói trực tiếp.
- **ProductFormula (Công thức sản phẩm)**: Quy định tỷ lệ chuẩn của từng nguyên liệu cấu thành trên một đơn vị quy chuẩn hoặc cỡ lô chuẩn (Master Batch Size).
- **Material Lot vs Batch**: Mỗi đợt nhập nguyên liệu tạo ra một Lô Nguyên liệu (Material Lot) có kết quả kiểm nghiệm đầu vào (RM Testing) và CoA của nhà cung cấp.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
export type MaterialCategory =
  | 'ACTIVE_INGREDIENT' // Hoạt chất chính
  | 'EXCIPIENT' // Tá dược
  | 'PRIMARY_PACKAGING' // Bao bì cấp 1 (tiếp xúc trực tiếp: vỉ, lọ, nút cao su)
  | 'SECONDARY_PACKAGING' // Bao bì cấp 2 (hộp giấy, tờ HDSD, thùng carton)
  | 'PROCESSING_AID'; // Chất phụ trợ sản xuất (dung môi hòa tan, khí trơ)

export interface RawMaterialContract {
  materialId: string;
  materialCode: string; // Mã nguyên liệu duy nhất
  materialName: string; // Tên nguyên liệu theo Dược điển
  casNumber?: string; // Số CAS hóa chất
  category: MaterialCategory;
  standardGrade: string; // Chuẩn phẩm cấp (VD: DĐVN V, USP, BP, EP, Food Grade)
  defaultUnit: 'g' | 'kg' | 'mg' | 'l' | 'ml' | 'piece';
  storageConditions: string;
  retestPeriodMonths: number; // Chu kỳ kiểm nghiệm lại (Retest period)
  isActive: boolean;
}

export interface MaterialLotContract {
  lotId: string;
  materialId: string;
  lotNumber: string; // Số lô của nhà cung cấp
  internalLotNumber: string; // Mã lô nội bộ do kho gán khi tiếp nhận
  supplierName: string;
  manufacturerName: string;
  countryOfOrigin: string;
  manufacturingDate: string;
  expirationDate: string;
  retestDate?: string;
  receiptDate: string;
  receivedQuantity: number;
  remainingQuantity: number;
  unit: string;
  qcStatus: 'QUARANTINE' | 'PASS' | 'FAIL' | 'RETEST_REQUIRED';
  incomingTestResultId?: string; // ID phiếu kiểm nghiệm đầu vào
  supplierCoaFileUrl?: string; // File CoA đính kèm của nhà sản xuất
}

export interface ProductFormulaContract {
  formulaId: string;
  formulaCode: string;
  productId: string;
  versionNumber: number;
  batchSizeStandard: number; // Cỡ lô chuẩn (ví dụ: 100,000 viên hoặc 500 kg)
  batchSizeUnit: string;
  status: 'DRAFT' | 'APPROVED' | 'OBSOLETE';

  // Danh sách các thành phần nguyên liệu
  ingredients: Array<{
    materialId: string;
    materialCode: string;
    materialName: string;
    quantityPerBatch: number; // Lượng cho cỡ lô chuẩn
    unit: string;
    percentage: number; // Tỷ lệ phần trăm trong công thức (%)
    overagePercentage?: number; // Tỷ lệ hao hụt / bù trừ cho phép (%)
    isKeyActiveIngredient: boolean;
  }>;

  effectiveDate: string;
  approvedBy?: string;
  approvedAt?: string;
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Tổng tỷ lệ công thức**: Đối với công thức tính theo phần trăm, tổng tỷ lệ của toàn bộ thành phần nguyên liệu (không bao gồm tá dược độn tùy biến) phải bằng 100% $\pm$ sai số dung sai cho phép.
2. **Khóa Lô Nguyên Liệu không đạt**: Lô nguyên liệu có trạng thái `qcStatus !== 'PASS'` tuyệt đối bị khóa, không thể phân bổ vào bất kỳ Lô sản xuất nào trong hệ thống.
3. **Cảnh báo hạn kiểm nghiệm lại**: Nếu ngày sản xuất của Lô vượt quá `retestDate` của lô nguyên liệu, hệ thống tự động cảnh báo và yêu cầu kiểm nghiệm lại nguyên liệu trước khi cấp phát.
