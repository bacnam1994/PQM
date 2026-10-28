# HỢP ĐỒNG GIAO DIỆN LẬP TRÌNH DỊCH VỤ (SERVICE CONTRACTS)

## (LEVEL 2: APPLICATION & DOMAIN ENGINE INTERFACES)

> **Mã tài liệu**: `CONTRACT-SERVICE-01`  
> **Thư mục**: `docs/contracts/SERVICE_CONTRACTS.md`  
> **Phạm vi**: Giao diện chuẩn giữa Core Domain Engine, Application Services và Giao diện người dùng (UI).

---

## 1. GIAO DIỆN ĐỘNG CƠ ĐÁNH GIÁ CHẤT LƯỢNG (IQualityEvaluationEngine)

```typescript
export interface IQualityEvaluationEngine {
  /**
   * Đánh giá giá trị của một chỉ tiêu đơn lẻ dựa trên TCCS
   */
  evaluateCriterion(
    criterion: Criterion,
    rawValue: any
  ): {
    isPass: boolean | null;
    normalizedValue: any;
    error?: string;
  };

  /**
   * Tổng hợp trạng thái chất lượng toàn phiếu kiểm nghiệm
   * Tuân thủ triệt để No Implicit Pass / No Implicit Fail
   */
  resolveOverallStatus(
    entries: TestResultEntry[],
    tccsSnapshot: TCCS
  ): {
    overallStatus: CanonicalQualityStatus; // PASS | FAIL | PENDING | UNKNOWN
    hasFailures: boolean;
    pendingCriteriaIds: string[];
    alternateRescuedCriteriaIds: string[];
  };

  /**
   * Tạo bản EvaluationSnapshot đóng băng dữ liệu khi ký duyệt
   */
  createEvaluationSnapshot(
    testResult: TestResult,
    tccsSnapshot: TCCS,
    approverId: string
  ): EvaluationSnapshot;
}
```

---

## 2. GIAO DIỆN PHÂN GIẢI QUY TẮC THAY THẾ (IAlternateRuleResolver)

```typescript
export interface ResolvedCriterionAlternateStatus {
  alternateState: AlternateCriterionState;
  isParticipating: boolean;
  isRequired: boolean;
  isPending: boolean;
  isExempted: boolean;
  displayNote: string;
  badgeLabel: string;
  badgeVariant: 'EXEMPTED' | 'PENDING' | 'TRIGGERED' | 'PASS' | 'FAIL';
}

export interface IAlternateRuleResolver {
  /**
   * Phân giải trạng thái của một chỉ tiêu trong mối quan hệ với toàn bộ các chỉ tiêu khác
   */
  resolveCriterionState(
    criterionId: string,
    currentValue: any,
    allValuesMap: Record<string, any>,
    alternateRules: AlternateRule[]
  ): ResolvedCriterionAlternateStatus;

  /**
   * Kiểm tra xem điều kiện có cấu trúc có thỏa mãn hay không
   */
  isConditionTriggered(condition: StructuredCondition, actualValue: any): boolean;
}
```

---

## 3. NGUYÊN TẮC GIAO TIẾP VỚI GIAO DIỆN (UI INTEGRATION RULE)

- Toàn bộ các Component giao diện (`CriteriaInputGroup`, `TestResultDetail`, `CoAReport`) **BẮT BUỘC** phải gọi các phương thức từ các Interface trên.
- **CẤM TUYỆT ĐỐI**: Không một Component UI nào được tự viết logic so sánh `>` hay `<`, hoặc tự duyệt mảng để gán nhãn "Đạt" hay "Miễn kiểm".
