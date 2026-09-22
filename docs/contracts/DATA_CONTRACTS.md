# HỢP ĐỒNG CẤU TRÚC DỮ LIỆU CHUẨN HÓA (DATA CONTRACTS)

## (LEVEL 2: CANONICAL SCHEMAS & IMMUTABLE DATA STRUCTURES)

> **Mã tài liệu**: `CONTRACT-DATA-01`  
> **Thư mục**: `docs/contracts/DATA_CONTRACTS.md`  
> **Phạm vi**: Schema chuẩn của Criterion, AlternateRule, TestResultEntry, EvaluationSnapshot, và Batch.

---

## 1. SCHEMA CHỈ TIÊU KIỂM NGHIỆM (CRITERION SCHEMA)

> Giải quyết dứt điểm lỗi `GAP-01`: Bắt buộc có trường `id` định danh duy nhất.

```typescript
export enum CriterionType {
  NUMBER = 'NUMBER',
  TEXT = 'TEXT',
}

export interface Criterion {
  /** Định danh bất biến toàn hệ thống (UUID v4 hoặc NanoID) - BẮT BUỘC */
  id: string;

  /** Mã ngắn chỉ tiêu dùng cho phân tích (VD: CRIT_DO_AM) */
  code?: string;

  /** Tên hiển thị của chỉ tiêu (VD: "Độ ẩm", "Độ tan rã") */
  name: string;

  /** Kiểu dữ liệu kiểm nghiệm: Số học hoặc Văn bản */
  type: CriterionType;

  /** Đơn vị tính (VD: "%", "mg/viên", "cfu/g") */
  unit?: string;

  /** Giới hạn số học cận dưới */
  min?: number;

  /** Giới hạn số học cận trên */
  max?: number;

  /** Giá trị văn bản mong đợi đối với kiểu TEXT */
  expectedText?: string;

  /** Phương pháp thử nghiệm (VD: "DĐVN V, Phụ lục 9.6") */
  analysisMethod?: string;

  /** Đánh dấu chỉ tiêu bắt buộc phải có kết quả */
  isRequired?: boolean;

  /** Thứ tự sắp xếp hiển thị trên form và báo cáo */
  orderIndex?: number;
}
```

---

## 2. SCHEMA QUY TẮC THAY THẾ CÓ CẤU TRÚC (STRUCTURED ALTERNATE RULE)

> Giải quyết dứt điểm lỗi `GAP-04`: Chuẩn hóa điều kiện dạng AST/Schema thay vì chuỗi tự do.

```typescript
export type AlternateRuleType = 'FAIL_RETRY' | 'CONDITIONAL_CHECK';

export interface StructuredCondition {
  operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'CONTAINS' | 'BETWEEN';
  thresholdValue: number | string;
  thresholdValueMax?: number; // Dùng khi operator là BETWEEN
}

export interface AlternateRule {
  /** UUID của quy tắc thay thế */
  id: string;

  /** ID của chỉ tiêu chính (Tham chiếu về Criterion.id) - BẮT BUỘC */
  mainCriterionId: string;

  /** ID của chỉ tiêu phụ thuộc/thay thế (Tham chiếu về Criterion.id) - BẮT BUỘC */
  altCriterionId: string;

  /** Loại quy tắc: Thử lại khi rớt hoặc Kiểm tra theo điều kiện */
  type: AlternateRuleType;

  /** Cấu trúc điều kiện kích hoạt (Bắt buộc với CONDITIONAL_CHECK) */
  condition?: StructuredCondition;

  /** Đánh dấu quy tắc đang được bật/tắt */
  enabled: boolean;

  /** Ghi chú giải thích nội bộ */
  note?: string;

  /** Văn bản ghi chú tự động in trên chân trang TCCS và CoA */
  displayNote: string;
}
```

---

## 3. SCHEMA KẾT QUẢ CHỈ TIÊU (CRITERION RESULT / TEST RESULT ENTRY)

```typescript
export interface TestResultEntry {
  /** ID chỉ tiêu (Tham chiếu về Criterion.id của TCCS Snapshot) */
  criterionId: string;

  /** Tên chỉ tiêu tại thời điểm kiểm nghiệm (Snapshot display) */
  criteriaName: string;

  /** Giá trị kết quả nhập thô từ phòng lab */
  value: string | number;

  /** Giá trị sau chuẩn hóa (đã trim, parse số) */
  normalizedValue?: number | string | null;

  /** Kết quả thẩm định: true = PASS, false = FAIL, null = PENDING / Ghi nhận */
  isPass: boolean | null;

  /** Trạng thái quy tắc thay thế */
  alternateState: AlternateCriterionState;

  /** ID của quy tắc thay thế được áp dụng (nếu có) */
  alternateRuleId?: string;

  /** Chú thích tự động (ví dụ: "Đạt theo quy tắc thay thế lần 2") */
  alternateNote?: string;

  /** Đánh dấu chỉ tiêu được miễn kiểm hợp lệ */
  isExempted?: boolean;

  /** Bằng chứng đính kèm (Hình ảnh sắc ký đồ HPLC, file đo quang) */
  evidenceUrls?: string[];
}
```

---

## 4. SCHEMA EVALUATION SNAPSHOT (BẢN ĐÓNG BĂNG THẨM ĐỊNH BẤT BIẾN)

> Hợp đồng duy nhất cho việc in ấn CoA và báo cáo pháp lý (`SC-14`).

```typescript
export interface EvaluationSnapshot {
  /** Phiên bản của Động cơ thẩm định (VD: "3.0.0-CANONICAL") */
  engineVersion: string;

  /** Khóa ngoại liên kết */
  testResultId: string;
  batchId: string;
  tccsId: string;
  tccsVersion: string | number;

  /** Thời điểm và danh tính người thẩm định/phê duyệt */
  evaluatedAt: string; // ISO 8601 UTC
  evaluatedBy: string; // User ID

  /** Trạng thái chất lượng tổng thể chính thức */
  overallStatus: 'PASS' | 'FAIL';

  /** Mảng kết quả các chỉ tiêu đã được đóng băng nguyên trạng 100% */
  criterionResults: TestResultEntry[];

  /** Đánh dấu có sử dụng quy tắc thay thế trong phiếu này không */
  alternateUsed: boolean;

  /** Mã băm SHA-256 bảo đảm tính toàn vẹn và chống giả mạo */
  evaluationHash: string;
}
```
