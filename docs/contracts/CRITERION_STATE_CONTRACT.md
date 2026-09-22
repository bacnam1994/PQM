# CRITERION_STATE_CONTRACT: Hợp Đồng Dữ Liệu Trạng Thái Chỉ Tiêu Kiểm Nghiệm

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu và vòng đời trạng thái của từng Chỉ tiêu kiểm nghiệm (Criterion) trong hệ thống PQM, đảm bảo sự tách bạch tuyệt đối giữa Trạng thái thực thi phép thử (Execution State) và Đánh giá chất lượng (Quality Status).

---

## 1. Nguyên Tắc Cốt Lõi Tách Bạch Trạng Thái

- **Quality ≠ Execution**: Một chỉ tiêu có thể đã làm xong (`ExecutionState = COMPLETED`) nhưng chất lượng lại Không Đạt (`QualityStatus = FAIL`); hoặc một chỉ tiêu được miễn kiểm hợp lệ (`ExecutionState = EXEMPTED`) nhưng chất lượng chuẩn tắc vẫn được công nhận Đạt (`QualityStatus = PASS`).
- **No Implicit Pass / Fail**: Giá trị `QualityStatus` bắt buộc phải là một trong các enum tường minh (`PASS`, `FAIL`, `PENDING`, `NOT_EVALUATED`), tuyệt đối không dùng giá trị boolean (`isPass: boolean`).

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
/**
 * Trạng thái thực thi phép thử vật lý / hóa học của chỉ tiêu
 */
export type CriterionExecutionState =
  | 'NOT_STARTED' // Chưa lấy mẫu hoặc chưa bắt đầu làm phép thử
  | 'REQUIRED' // Bắt buộc phải thực hiện theo tiêu chuẩn
  | 'TESTING' // Đang trong quá trình tiến hành thử nghiệm
  | 'COMPLETED' // Đã hoàn thành phép thử và có số liệu thô
  | 'NOT_APPLICABLE' // Không áp dụng cho lô cụ thể này (dạng bào chế/quy cách khác)
  | 'EXEMPTED'; // Được miễn thử nghiệm theo quy chế chỉ tiêu thay thế hợp lệ

/**
 * Trạng thái chất lượng chuẩn tắc của chỉ tiêu
 */
export type CriterionQualityStatus =
  | 'PASS' // Kết quả thực nghiệm nằm trong giới hạn cho phép
  | 'FAIL' // Kết quả thực nghiệm nằm ngoài tiêu chuẩn (kích hoạt OOS)
  | 'PENDING' // Đang chờ thêm số liệu hoặc chưa đủ căn cứ kết luận
  | 'NOT_EVALUATED'; // Chưa thực hiện đánh giá chất lượng

/**
 * Kiểu chỉ tiêu kiểm nghiệm theo Dược điển
 */
export type CriterionType =
  | 'NUMERIC' // Chỉ tiêu định lượng (Assay, pH, Tạp chất, Độ ẩm...)
  | 'QUALITATIVE' // Chỉ tiêu định tính (Cảm quan, Định tính màu, IR/HPLC...)
  | 'LIMIT_TEST' // Giới hạn (Giới hạn kim loại nặng, Tro không tan...)
  | 'MICROBIOLOGY'; // Vi sinh vật (Tổng số VSV hiếu khí, E. coli...)

/**
 * Hợp đồng dữ liệu hoàn chỉnh của Chỉ tiêu trong Hồ sơ Kiểm nghiệm Lô
 */
export interface CriterionContract {
  criterionId: string;
  criterionCode: string;
  criterionName: string;
  criterionType: CriterionType;
  department: 'PHYSICAL' | 'CHEMICAL' | 'MICROBIOLOGICAL';

  // Tiêu chuẩn chấp nhận (Acceptance Criteria từ TCCS Snapshot)
  specification: {
    unit?: string;
    minValue?: number;
    maxValue?: number;
    targetValue?: number;
    expectedText?: string;
    comparator?: 'EQUALS' | 'CONTAINS' | 'MATCHES_REGEX';
    rawSpecificationText: string;
  };

  // Trạng thái thực thi & Kết quả đo
  executionState: CriterionExecutionState;
  resultData?: {
    numericValue?: number;
    textValue?: string;
    testedAt: string; // ISO 8601
    analystId: string;
    analystName: string;
    rawObservationNotes?: string;
    equipmentUsed?: string;
  };

  // Đánh giá chất lượng chuẩn tắc (Chỉ do Domain Engine gán)
  qualityStatus: CriterionQualityStatus;
  evaluationDetail?: {
    evaluatedAt: string;
    ruleApplied: string;
    isOutOfSpecification: boolean;
    deviationMargin?: number;
  };

  // Mối liên kết quy tắc thay thế (nếu có)
  alternateRuleRef?: {
    ruleId: string;
    role: 'PRIMARY' | 'SUBSTITUTE';
    isExemptedByAlternate: boolean;
  };
}
```

---

## 3. Ma Trận Chuyển Đổi Trạng Thái Chỉ Tiêu (Criterion State Matrix)

| Execution State  | Kết quả nhập liệu              | Quality Status hợp lệ              | Ghi chú nghiệp vụ                  |
| :--------------- | :----------------------------- | :--------------------------------- | :--------------------------------- |
| `NOT_STARTED`    | Chưa có                        | `NOT_EVALUATED`                    | Trạng thái ban đầu khi khởi tạo lô |
| `TESTING`        | Đang nhập dở dang              | `PENDING`                          | Không được vội kết luận            |
| `COMPLETED`      | Nằm trong khoảng `[Min, Max]`  | `PASS`                             | Đạt tiêu chuẩn                     |
| `COMPLETED`      | Vượt ngoài khoảng `[Min, Max]` | `FAIL`                             | Không đạt, tự động kích hoạt OOS   |
| `EXEMPTED`       | Không cần nhập số đo           | `PASS` (nếu chỉ tiêu thay thế Đạt) | Đạt theo quy chế thay thế          |
| `NOT_APPLICABLE` | Không thực hiện                | `NOT_EVALUATED`                    | Bỏ qua khỏi tính mẫu số hoàn thành |

---

## 4. Bất Biến Ràng Buộc Dữ Liệu (Invariants)

1. **Khóa sau thẩm duyệt**: Khi kết quả kiểm nghiệm của chỉ tiêu đã được QA phê duyệt (`status === 'APPROVED'`), cả `executionState` và `qualityStatus` đều bị khóa bất biến.
2. **Cấm mâu thuẫn**: Không bao giờ tồn tại trạng thái `executionState === 'NOT_STARTED'` mà `qualityStatus === 'PASS'`.
3. **Tính toán tỷ lệ**: Chỉ tiêu ở trạng thái `NOT_APPLICABLE` không được tính vào tổng số chỉ tiêu bắt buộc khi tính % hoàn thành của Lô.
