import { z } from 'zod';

/**
 * Schema xác thực cho từng dòng kết quả kiểm nghiệm
 */
export const testResultEntrySchema = z.object({
  criteriaName: z.string().trim().min(1, 'Tên chỉ tiêu không được để trống'),
  value: z.string().trim().min(1, 'Kết quả thử nghiệm không được để trống'),
  isPass: z.boolean().default(true),
  isExtra: z.boolean().optional().default(false),
  unit: z.string().optional().default(''),
  limit: z.string().optional().default(''),
  analysisMethod: z.string().optional(),
  confidence: z.string().optional(),
});

export type TestResultEntryFormData = z.infer<typeof testResultEntrySchema>;

/**
 * Schema xác thực cho Phiếu kết quả kiểm nghiệm (Test Result)
 */
export const testResultFormSchema = z.object({
  id: z.string().optional(),
  batchId: z.string().trim().min(1, 'Vui lòng chọn hoặc nhập số Lô sản xuất kiểm nghiệm'),
  labName: z.string().trim().min(1, 'Đơn vị / Phòng kiểm nghiệm không được để trống'),
  testDate: z.string().trim().min(1, 'Ngày kiểm nghiệm không được để trống'),
  overallStatus: z.enum(['PASS', 'FAIL']).default('PASS'),
  notes: z.string().optional().default(''),
  results: z
    .array(testResultEntrySchema)
    .min(1, 'Phiếu kiểm nghiệm phải có ít nhất 1 kết quả thử nghiệm'),
});

export type TestResultFormData = z.infer<typeof testResultFormSchema>;
