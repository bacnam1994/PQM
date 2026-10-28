import { z } from 'zod';

/**
 * Schema xác thực cho từng dòng Thành phần / Tá dược trong Công thức
 */
export const formulaIngredientSchema = z.object({
  id: z.string().optional(),
  materialId: z.string().optional(),
  name: z.string().trim().min(1, 'Tên hoạt chất / tá dược không được để trống'),
  declaredContent: z.string().trim().min(1, 'Hàm lượng công bố không được để trống'),
  elementalContent: z.string().trim().optional(),
  unit: z.string().trim().min(1, 'Đơn vị tính không được để trống'),
  confidence: z.string().optional(),
});

export type FormulaIngredientFormData = z.infer<typeof formulaIngredientSchema>;

/**
 * Schema xác thực toàn diện cho biểu mẫu Công thức sản phẩm (Product Formula)
 */
export const productFormulaFormSchema = z.object({
  id: z.string().optional(),
  productId: z.string().trim().min(1, 'Vui lòng chọn sản phẩm áp dụng công thức'),
  ingredients: z
    .array(formulaIngredientSchema)
    .min(1, 'Công thức bắt buộc phải có ít nhất 1 hoạt chất chính'),
  excipients: z.array(formulaIngredientSchema).default([]),
  sensory: z.string().optional().default(''),
  packaging: z.string().optional().default(''),
  storage: z.string().optional().default(''),
  shelfLife: z.string().optional().default(''),
});

export type ProductFormulaFormData = z.infer<typeof productFormulaFormSchema>;
