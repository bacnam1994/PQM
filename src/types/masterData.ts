/**
 * PQM — Master Data: Chỉ tiêu Kiểm nghiệm (MasterCriterion)
 *
 * Entity "Hồ sơ gốc" cho từng chỉ tiêu kiểm nghiệm.
 * Tách biệt hoàn toàn khỏi TCCS: TCCS chỉ giữ Limits (Min/Max),
 * còn định nghĩa nguyên bản (tên chuẩn, đơn vị, quy tắc tính %) được
 * quản lý tập trung tại đây — lưu trên Firebase `master_criteria/`.
 *
 * Lợi ích:
 * - AI map kết quả OCR thẳng vào `canonicalName` / `id`
 * - Analytics Group By `masterCriterionId` thay vì chuỗi text dễ sai
 * - Loại bỏ false-positive trong dataConsistencyService
 * - Autocomplete trong TCCS Form giúp QA chọn tên chuẩn thay vì gõ tự do
 */

export type MasterCriterionCategory = 'QUALITY' | 'SAFETY' | 'MICROBIO' | 'SENSORY';
export type MasterCriterionType = 'NUMBER' | 'TEXT';
export type CalculationBasis = 'DECLARED' | 'ELEMENTAL';

export interface MasterCriterion {
  /** ID nội bộ hệ thống. VD: `crit_dong_01`, `crit_bacillus_01` */
  id: string;

  /** Tên chuẩn hóa toàn hệ thống. VD: "Hàm lượng Đồng", "Tổng Bacillus" */
  canonicalName: string;

  /** Nhóm phân loại chỉ tiêu */
  category: MasterCriterionCategory;

  /** Đơn vị mặc định. VD: "mg", "ppm", "CFU/g", "IU", "%" */
  defaultUnit: string;

  /** Kiểu dữ liệu kết quả */
  type: MasterCriterionType;

  /**
   * Liên kết với nguyên liệu gốc trong `rawMaterials/`.
   * VD: Chỉ tiêu "Hàm lượng Đồng" → link vào nguyên liệu "Đồng sulfat" hoặc "Đồng nguyên tố"
   */
  linkedMaterialId?: string;

  /**
   * Quy tắc tính % mặc định.
   * - `DECLARED`: Tính theo hàm lượng muối/hợp chất (mặc định)
   * - `ELEMENTAL`: Tính theo hàm lượng nguyên tố/ion gốc
   * Có thể bị ghi đè (override) tại từng TCCS cụ thể qua `Criterion.calculationBasis`.
   */
  defaultCalculationBasis?: CalculationBasis;

  /** Mô tả ngắn, phương pháp thử, tài liệu tham chiếu */
  description?: string;

  /** Trạng thái hoạt động — chỉ hiển thị chỉ tiêu active trong Autocomplete */
  isActive: boolean;

  createdAt: string;
  updatedAt?: string;

  /** Email người tạo — phục vụ Audit Trail */
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Form data cho Modal tạo/sửa MasterCriterion.
 * Dùng với react-hook-form + Zod schema.
 */
export interface MasterCriterionFormData {
  canonicalName: string;
  category: MasterCriterionCategory;
  defaultUnit: string;
  type: MasterCriterionType;
  linkedMaterialId?: string;
  defaultCalculationBasis?: CalculationBasis;
  description?: string;
  isActive: boolean;
}

/** Label tiếng Việt cho từng category */
export const MASTER_CRITERION_CATEGORY_LABELS: Record<MasterCriterionCategory, string> = {
  QUALITY: 'Chất lượng chính',
  SAFETY: 'An toàn / Kim loại nặng',
  MICROBIO: 'Vi sinh vật',
  SENSORY: 'Cảm quan',
};

/** Màu badge cho từng category */
export const MASTER_CRITERION_CATEGORY_COLORS: Record<MasterCriterionCategory, string> = {
  QUALITY:
    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40',
  SAFETY:
    'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40',
  MICROBIO:
    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800/40',
  SENSORY:
    'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-800/40',
};
