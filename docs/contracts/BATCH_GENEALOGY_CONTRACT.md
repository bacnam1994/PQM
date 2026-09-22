# BATCH_GENEALOGY_CONTRACT: Hợp Đồng Dữ Liệu Hồ Sơ Lô & Phả Hệ Truy Vết

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu của Hồ sơ Lô Sản phẩm (Batch) và Mạng lưới Phả hệ Dữ liệu (Genealogy Network) theo tiêu chuẩn Thực hành Sản xuất Tốt GMP.

---

## 1. Bản Chất Nghiệp Vụ

- **Batch (Hồ sơ Lô)**: Là thực thể trọng tâm kết nối Sản phẩm, Công thức sản xuất, Tiêu chuẩn chất lượng (TCCS Snapshot), Kết quả kiểm nghiệm (Test Results), Sai lệch (Deviations) và Quyết định xuất xưởng (Release).
- **Genealogy (Phả hệ Lô)**: Mô hình hóa toàn bộ mối quan hệ dòng chảy vật chất từ Nhà cung ứng -> Lô Nguyên vật liệu -> Lô Bán thành phẩm -> Lô Thành phẩm -> Khách hàng/Kho phân phối.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
export type BatchWorkflowStatus =
  | 'DRAFT' // Mới lập kế hoạch, chưa bắt đầu sản xuất
  | 'IN_PRODUCTION' // Đang trong quy trình sản xuất
  | 'TESTING' // Đã xong sản xuất, đang kiểm nghiệm chất lượng (QC)
  | 'QA_REVIEW' // Hoàn tất kiểm nghiệm, QA đang thẩm tra hồ sơ
  | 'APPROVED' // QA đã phê duyệt chất lượng đạt
  | 'RELEASED' // Đã xuất xưởng chính thức ra thị trường
  | 'REJECTED' // Bị từ chối xuất xưởng do không đạt chất lượng
  | 'HOLD' // Bị tạm dừng lưu thông để điều tra bổ sung
  | 'RECALLED'; // Bị thu hồi khẩn cấp khỏi thị trường

export type BatchQualityStatus =
  | 'PASS' // 100% chỉ tiêu đạt chuẩn
  | 'FAIL' // Có ít nhất 1 chỉ tiêu không đạt
  | 'PENDING' // Chưa hoàn thành kiểm nghiệm
  | 'NOT_EVALUATED'; // Chưa có kết quả nào

export interface BatchContract {
  batchId: string;
  batchNumber: string; // Số lô sản xuất (Duy nhất trong năm)
  productId: string;
  productCode: string;
  productName: string;
  formulaId: string;
  formulaVersion: number;

  // Snapshot Tiêu chuẩn cơ sở áp dụng (Bất biến)
  appliedTccsSnapshot: {
    tccsId: string;
    tccsCode: string;
    versionNumber: number;
    snapshotTakenAt: string;
    criteriaCount: number;
  };

  // Thông số sản xuất
  batchSize: number;
  batchSizeUnit: string;
  manufacturingDate: string; // ISO 8601
  expirationDate: string; // ISO 8601
  manufacturingLine?: string; // Dây chuyền sản xuất

  // Trạng thái tách bạch
  workflowStatus: BatchWorkflowStatus;
  canonicalQualityStatus: BatchQualityStatus;

  // Tỷ lệ hoàn thành kiểm nghiệm (%)
  testingProgressPercentage: number;

  // Khóa dữ liệu
  isGenealogyLocked: boolean;
  isTestResultsLocked: boolean;
  isReleased: boolean;

  // Quyết định phát hành
  releaseInfo?: {
    releasedBy: string;
    releasedByName: string;
    releasedAt: string;
    releaseCertificateNumber: string;
    qaManagerSignatureChecksum: string;
  };

  // Thông tin thu hồi / tạm giữ (nếu có)
  holdOrRecallInfo?: {
    type: 'HOLD' | 'RECALL';
    recallClass?: 'CLASS_I' | 'CLASS_II' | 'CLASS_III';
    reason: string;
    actionDate: string;
    authorizedBy: string;
  };

  createdAt: string;
  updatedAt: string;
}

/**
 * Phân bổ nguyên liệu thực tế vào lô sản phẩm
 */
export interface BatchMaterialAllocation {
  allocationId: string;
  batchId: string;
  materialLotId: string;
  materialCode: string;
  materialName: string;
  internalLotNumber: string;
  supplierLotNumber: string;
  supplierName: string;
  actualQuantityUsed: number;
  unit: string;
  dispensedAt: string;
  dispensedBy: string;
}

/**
 * Hợp đồng mạng lưới phả hệ truy xuất nguồn gốc (Graph Representation)
 */
export interface BatchGenealogyGraphContract {
  rootBatchId: string;
  rootBatchNumber: string;

  // Nodes (Các thực thể tham gia)
  nodes: Array<{
    nodeId: string;
    nodeType: 'FINISHED_BATCH' | 'SEMI_FINISHED_BATCH' | 'MATERIAL_LOT' | 'SUPPLIER';
    label: string;
    code: string;
    status: string;
    hasIncident: boolean; // Có OOS/Deviation hay không
  }>;

  // Edges (Các mối quan hệ)
  edges: Array<{
    fromNodeId: string;
    toNodeId: string;
    relationType: 'USED_IN' | 'PRODUCED_FROM' | 'SUPPLIED_BY';
    quantity?: number;
    unit?: string;
  }>;
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Số Lô là Duy Nhất**: `batchNumber` không được phép trùng lặp trong toàn bộ cơ sở dữ liệu.
2. **Bất biến Snapshot TCCS**: Một khi lô đã tạo và gắn Snapshot TCCS, mọi thay đổi trên TCCS gốc sau này không làm biến động các chỉ tiêu kiểm nghiệm đã gán cho lô.
3. **Cấm xuất xưởng khi chất lượng chưa PASS**: Trạng thái `workflowStatus` chỉ có thể chuyển thành `RELEASED` khi `canonicalQualityStatus === 'PASS'` và toàn bộ 7 Cổng kiểm soát xuất xưởng thỏa mãn.
