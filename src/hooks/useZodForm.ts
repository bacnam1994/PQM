import { useForm as useRHFForm, UseFormProps, FieldValues } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ZodSchema } from 'zod';

/**
 * useZodForm
 * Hook quản lý biểu mẫu chuyên nghiệp chuẩn React Hook Form + Zod.
 * - State Uncontrolled Components: Giảm thiểu 95% số lần re-render không cần thiết.
 * - Type-safe validation: Bắt lỗi ngay tại client trước khi dữ liệu chạm tới Firebase.
 */
export function useZodForm<TFieldValues extends FieldValues = FieldValues>(
  schema: ZodSchema<any>,
  options?: Omit<UseFormProps<TFieldValues>, 'resolver'>
) {
  return useRHFForm<TFieldValues>({
    ...options,
    resolver: zodResolver(schema) as any,
    mode: options?.mode || 'onBlur',
  });
}

export { useFieldArray, Controller, useWatch } from 'react-hook-form';
