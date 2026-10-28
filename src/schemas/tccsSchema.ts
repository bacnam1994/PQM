import { z } from 'zod';

/**
 * Schema xác thực cho từng Chỉ tiêu kỹ thuật (Criterion)
 */
export const criterionSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, 'Tên chỉ tiêu không được để trống'),
    type: z.enum(['NUMBER', 'TEXT']).default('NUMBER'),
    unit: z.string().optional().default(''),
    min: z.union([z.number(), z.null(), z.undefined()]).optional(),
    max: z.union([z.number(), z.null(), z.undefined()]).optional(),
    textValue: z.string().optional().default(''),
    declaredContent: z.union([z.number(), z.null(), z.undefined()]).optional(),
    formulaIngredientId: z.string().optional(),
    calculationBasis: z
      .union([z.enum(['DECLARED', 'ELEMENTAL']), z.literal('')])
      .optional()
      .default('DECLARED'),
    confidence: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'NUMBER' && typeof data.min === 'number' && typeof data.max === 'number') {
        return data.min <= data.max;
      }
      return true;
    },
    {
      message: 'Giá trị tối thiểu (Min) không được lớn hơn giá trị tối đa (Max)',
      path: ['min'],
    }
  );

export type CriterionFormData = z.infer<typeof criterionSchema>;

/**
 * Schema xác thực cho Biểu mẫu Tiêu chuẩn cơ sở (TCCS)
 */
export const tccsFormSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(1, 'Mã số TCCS không được để trống'),
  productId: z.string().trim().min(1, 'Vui lòng chọn sản phẩm áp dụng tiêu chuẩn'),
  issueDate: z.string().trim().min(1, 'Ngày ban hành không được để trống'),
  isActive: z.boolean().default(true),
  packaging: z.string().optional().default(''),
  storage: z.string().optional().default(''),
  shelfLife: z.string().optional().default(''),
  standardRefs: z.string().optional().default(''),
  mainQualityCriteria: z.array(criterionSchema).default([]),
  safetyCriteria: z.array(criterionSchema).default([]),
  notes: z.string().optional().default(''),
});

export type TCCSFormData = z.infer<typeof tccsFormSchema>;
