# QMS_INCIDENT_CONTRACT: Hợp Đồng Dữ Liệu Sự Cố Chất Lượng (OOS, Deviation & CAPA)

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu và liên kết nghiệp vụ giữa 3 thực thể cốt lõi trong hệ thống quản lý sự cố chất lượng dược phẩm (QMS): Kết quả ngoài tiêu chuẩn (OOS), Sai lệch quy trình (Deviation) và Hành động khắc phục phòng ngừa (CAPA).

---

## 1. Bản Chất Nghiệp Vụ Liên Thông

- **OOS (Out of Specification)**: Kích hoạt khi kết quả thử nghiệm của một chỉ tiêu vượt ra ngoài giới hạn chấp nhận của TCCS. Trọng tâm là điều tra 2 giai đoạn: Giai đoạn 1 (Lỗi phòng kiểm nghiệm - Lab Error) và Giai đoạn 2 (Lỗi quy trình sản xuất - Manufacturing Root Cause).
- **Deviation (Sai lệch)**: Bất kỳ sự cố bất thường nào xảy ra ngoài quy trình thao tác chuẩn (SOP), hồ sơ lô (BPR), nhiệt độ bảo quản, hỏng hóc thiết bị trong quá trình sản xuất hoặc kiểm nghiệm.
- **CAPA (Corrective and Preventive Action)**: Hành động khắc phục triệt để nguyên nhân gốc rễ (Root Cause) để ngăn ngừa tái diễn. Được sinh ra từ OOS hoặc Major/Critical Deviation.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
// ==================== OOS CONTRACT ====================

export type OOSPhase = 'PHASE_1_LAB_INVESTIGATION' | 'PHASE_2_MANUFACTURING_INVESTIGATION';
export type OOSStatus =
  | 'OPEN'
  | 'INVESTIGATING'
  | 'ROOT_CAUSE_IDENTIFIED'
  | 'CAPA_INITIATED'
  | 'CLOSED'
  | 'INVALIDATED';
export type OOSRootCauseCategory =
  | 'LAB_ERROR'
  | 'MANUFACTURING_DEFECT'
  | 'RAW_MATERIAL'
  | 'ENVIRONMENT'
  | 'UNKNOWN';

export interface OOSContract {
  oosId: string;
  oosNumber: string; // VD: OOS-2026-0042
  batchId: string;
  batchNumber: string;
  productId: string;
  testResultId: string;
  criterionId: string;
  criterionName: string;
  reportedAt: string; // ISO 8601
  reportedBy: string;

  initialValueDisplay: string; // Giá trị vượt chuẩn ban đầu
  specificationLimit: string; // Giới hạn quy định

  currentPhase: OOSPhase;
  status: OOSStatus;

  // Giai đoạn 1: Điều tra phòng thí nghiệm
  phase1LabInvestigation: {
    investigatorId: string;
    investigatedAt?: string;
    isLabErrorIdentified: boolean;
    labErrorDetail?: string; // Cân sai, pha nhầm thuốc thử, bọt khí detector...
    checklist: Array<{ checkItem: string; isOk: boolean; notes?: string }>;
    retestRequired: boolean;
    retestResults?: Array<{ analystId: string; value: any; status: 'PASS' | 'FAIL' }>;
    phase1Conclusion?: 'VALID_OOS' | 'LAB_ERROR_INVALIDATED';
  };

  // Giai đoạn 2: Điều tra sản xuất (chỉ chạy khi Phase 1 xác nhận không phải do Lab)
  phase2ManufacturingInvestigation?: {
    investigatorId: string;
    investigatedAt?: string;
    rootCauseCategory: OOSRootCauseCategory;
    rootCauseAnalysis: string; // Áp dụng 5-Why hoặc Fishbone Diagram
    impactAssessment: string; // Đánh giá ảnh hưởng tới các lô khác cùng kỳ
    associatedDeviationId?: string;
  };

  // Kết luận & Phê duyệt
  finalDisposition: {
    batchDisposition: 'REJECT' | 'REPROCESS' | 'RELEASE_UNDER_CONCESSION' | 'PENDING';
    closedAt?: string;
    closedBy?: string;
    qaManagerApproval?: {
      approverId: string;
      approvedAt: string;
      signatureChecksum: string;
      remarks: string;
    };
  };

  linkedCapaId?: string;
}

// ==================== DEVIATION CONTRACT ====================

export type DeviationSeverity = 'MINOR' | 'MAJOR' | 'CRITICAL';
export type DeviationStatus =
  | 'LOGGED'
  | 'UNDER_INVESTIGATION'
  | 'QA_EVALUATION'
  | 'CAPA_PENDING'
  | 'CLOSED';

export interface DeviationContract {
  deviationId: string;
  deviationNumber: string; // VD: DEV-2026-015
  batchId?: string; // Có thể gắn hoặc không gắn với lô cụ thể
  batchNumber?: string;
  department: 'QC' | 'QA' | 'PRODUCTION' | 'WAREHOUSE' | 'ENGINEERING';
  title: string;
  description: string; // Mô tả hiện tượng sai lệch
  occurredAt: string;
  reportedBy: string;

  severity: DeviationSeverity;
  status: DeviationStatus;

  // Đánh giá rủi ro chất lượng (ICH Q9)
  riskAssessment: {
    severityScore: number; // 1 - 5
    probabilityScore: number; // 1 - 5
    detectabilityScore: number; // 1 - 5
    riskPriorityNumber: number; // RPN = S * P * D
    isPatientSafetyImpacted: boolean;
    isProductQualityImpacted: boolean;
  };

  // Biện pháp xử lý tức thời (Immediate / Containment Actions)
  immediateActions: Array<{
    action: string;
    responsiblePerson: string;
    completedAt?: string;
  }>;

  // Điều tra nguyên nhân & CAPA
  investigationSummary?: string;
  linkedCapaIds: string[];

  // Phê duyệt đóng
  closedBy?: string;
  closedAt?: string;
  qaApprovalRemarks?: string;
}

// ==================== CAPA CONTRACT ====================

export type CAPAType = 'CORRECTIVE' | 'PREVENTIVE';
export type CAPAStatus = 'INITIATED' | 'PLAN_APPROVED' | 'IN_PROGRESS' | 'VERIFICATION' | 'CLOSED';

export interface CAPAContract {
  capaId: string;
  capaNumber: string; // VD: CAPA-2026-008
  sourceType: 'OOS' | 'DEVIATION' | 'AUDIT_FINDING' | 'CUSTOMER_COMPLAINT';
  sourceId: string; // ID của OOS hoặc Deviation gốc
  title: string;
  type: CAPAType;
  rootCause: string;
  status: CAPAStatus;

  // Kế hoạch hành động cụ thể (Action Plans)
  actions: Array<{
    actionId: string;
    description: string; // Viết lại SOP, đào tạo nhân sự, bảo dưỡng máy...
    assigneeId: string;
    assigneeName: string;
    dueDate: string;
    completedDate?: string;
    evidenceUrl?: string;
    status: 'PENDING' | 'COMPLETED';
  }>;

  // Đánh giá hiệu quả sau triển khai (Effectiveness Check)
  effectivenessCheck: {
    requiredDate: string; // Sau 3 hoặc 6 tháng triển khai
    evaluatedBy?: string;
    evaluatedAt?: string;
    isEffective: boolean;
    recurrenceObserved: boolean; // Có tái diễn sự cố tương tự hay không
    notes?: string;
  };

  closedBy?: string;
  closedAt?: string;
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Ràng buộc khóa Lô**: Khi Lô có ít nhất 1 OOS hoặc 1 Major/Critical Deviation đang mở (`status !== 'CLOSED'`), hệ thống tự động khóa cổng xuất xưởng Release Gate số 3 và số 4.
2. **Không tự đóng CAPA**: CAPA chỉ có thể chuyển sang trạng thái `CLOSED` sau khi toàn bộ danh sách `actions` đã hoàn thành 100% và có xác nhận của Trưởng phòng QA.
3. **Liên kết 2 chiều**: Từ OOS/Deviation có thể truy cập thẳng tới CAPA và ngược lại.
