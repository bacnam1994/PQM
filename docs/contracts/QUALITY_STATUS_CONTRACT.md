# QUALITY_STATUS_CONTRACT: Hợp Đồng Đánh Giá Chất Lượng Chuẩn Tắc (Canonical Quality Evaluation)

Tài liệu này chuẩn hóa toàn bộ cấu trúc kết quả đánh giá chất lượng của Lô (Batch Quality Evaluation), loại bỏ hoàn toàn các cờ nhị phân `isPass: boolean` ở tầng Business Logic và UI.

---

## 1. Bản Chất Nghiệp Vụ

- **Canonical Evaluation (Đánh giá Chuẩn tắc)**: Đánh giá chất lượng của một Lô hàng không đơn thuần là phép `AND` logic của các boolean. Nó là một cấu trúc dữ liệu giàu ngữ cảnh (Rich Domain Object) bao gồm trạng thái từng chỉ tiêu, tiến độ phần trăm, các quy tắc thay thế đã xử lý, và các nguyên nhân gây lỗi chi tiết.
- **Authority**: Chỉ có `CanonicalStatusResolver` / `EvaluationEngine` ở tầng Domain mới có thẩm quyền tính toán và phát hành đối tượng này. UI, Report và CoA chỉ nhận về để hiển thị hoặc đóng dấu.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
/**
 * Trạng thái chất lượng chuẩn tắc ở cấp độ Lô sản phẩm
 */
export type CanonicalQualityStatus =
  | 'PASS' // 100% chỉ tiêu bắt buộc đạt chuẩn
  | 'FAIL' // Có ít nhất một chỉ tiêu không đạt (sau khi đã tính quy tắc thay thế)
  | 'PENDING' // Chưa kiểm nghiệm xong toàn bộ chỉ tiêu
  | 'INDETERMINATE'; // Thiếu dữ liệu hoặc có xung đột logic cần chuyên gia xử lý

/**
 * Chi tiết đánh giá của từng chỉ tiêu cấu thành
 */
export interface EvaluatedCriterionSummary {
  criterionId: string;
  criterionCode: string;
  criterionName: string;
  status: 'PASS' | 'FAIL' | 'PENDING' | 'EXEMPTED';
  isMandatory: boolean;
  actualValueDisplay: string;
  specificationDisplay: string;
  failureReason?: string;
  isAlternateApplied?: boolean;
}

/**
 * Hợp đồng dữ liệu Đánh giá Chất lượng chuẩn tắc hoàn chỉnh của Lô
 */
export interface CanonicalBatchEvaluationContract {
  batchId: string;
  batchNumber: string;
  evaluatedAt: string; // Timestamp tính toán (ISO 8601)

  // Trạng thái tổng kết
  overallQualityStatus: CanonicalQualityStatus;

  // Tiến độ thực thi
  totalRequiredCriteria: number;
  completedCriteriaCount: number;
  passedCriteriaCount: number;
  failedCriteriaCount: number;
  exemptedCriteriaCount: number;
  completionPercentage: number; // Giá trị từ 0 đến 100

  // Danh sách các chỉ tiêu chi tiết
  criteriaSummaries: EvaluatedCriterionSummary[];

  // Danh sách các chỉ tiêu bị Thất bại (để hiển thị nhanh cho QA)
  failedCriteria: EvaluatedCriterionSummary[];

  // Trạng thái các quy tắc thay thế đã xử lý
  alternateRulesEvaluation: Array<{
    ruleId: string;
    ruleCode: string;
    ruleType: string;
    state: 'NOT_APPLICABLE' | 'NOT_TRIGGERED' | 'TRIGGERED_PASS' | 'TRIGGERED_FAIL';
    explanation: string;
  }>;

  // Khuyến nghị hành động hệ thống (System Recommendations)
  systemActionRecommendation: {
    canRelease: boolean;
    blockingReasons: string[];
    qaAttentionRequired: boolean;
    badgeToRender: {
      text: string;
      color: 'GREEN' | 'RED' | 'BLUE' | 'YELLOW' | 'GRAY';
      tooltip: string;
    };
  };
}
```

---

## 3. Quy Tắc Sinh Nhãn Giao Diện Động (Dynamic UI Badge Rules)

| `completionPercentage` | `overallQualityStatus` | Nhãn hiển thị cho QA (`badgeToRender`)   | Ý nghĩa nghiệp vụ                          |
| :--------------------- | :--------------------- | :--------------------------------------- | :----------------------------------------- |
| `=== 100`              | `'PASS'`               | 🟦 **"Đã kiểm xong - Chờ QA duyệt"**     | Đủ điều kiện để QA thẩm tra xuất xưởng     |
| `=== 100`              | `'FAIL'`               | 🟥 **"Không Đạt - Yêu cầu OOS/Xử lý"**   | Đã làm xong nhưng phát hiện lỗi            |
| `< 100`                | `'FAIL'`               | 🟥 **"Cảnh báo: Có chỉ tiêu Không Đạt"** | Đang kiểm nhưng đã phát hiện chỉ tiêu hỏng |
| `< 100`                | `'PENDING'`            | 🟨 **"Đang kiểm nghiệm (X%)"**           | Đang tiến hành bình thường                 |
| `=== 0`                | `'PENDING'`            | ⬜ **"Chưa bắt đầu kiểm nghiệm"**        | Mới nhận mẫu                               |

---

## 4. Bất Biến Ràng Buộc (Invariants)

1. **Không có Implicit Pass**: Nếu `totalRequiredCriteria > 0` mà `completedCriteriaCount === 0`, `overallQualityStatus` tuyệt đối không được là `PASS`.
2. **Một chỉ tiêu Fail là toàn Lô Fail**: Nếu bất kỳ chỉ tiêu bắt buộc nào có trạng thái `FAIL` mà không có quy tắc thay thế giải cứu thành công (`TRIGGERED_PASS`), `overallQualityStatus` bắt buộc phải là `FAIL`.
3. **Cấm sửa đổi kết quả**: Đối tượng `CanonicalBatchEvaluationContract` được tạo ra dưới dạng đóng băng (Object.freeze) trong bộ nhớ, không cho phép bất kỳ hàm nào sửa đổi thuộc tính của nó.
