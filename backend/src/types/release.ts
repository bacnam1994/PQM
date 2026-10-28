/**
 * backend/src/types/release.ts
 * Type definitions and Zod boundary schemas for batch release operations
 */

import { z } from 'zod';

export const batchReleaseSchema = z.object({
  batchId: z
    .string({ required_error: 'Thiếu batchId hợp lệ.' })
    .trim()
    .min(1, 'batchId không được để trống.')
    .max(100, 'batchId quá dài (tối đa 100 ký tự).'),
  signatureId: z
    .string({ required_error: 'Thiếu signatureId hợp lệ.' })
    .trim()
    .min(1, 'signatureId không được để trống.')
    .max(128, 'signatureId quá dài (tối đa 128 ký tự).'),
  expectedVersion: z
    .number({ required_error: 'Thiếu expectedVersion hợp lệ.' })
    .int('expectedVersion phải là số nguyên.')
    .min(1, 'expectedVersion phải >= 1.')
    .finite('expectedVersion không được là NaN hoặc Infinity.'),
  idempotencyKey: z
    .string({ required_error: 'Thiếu idempotencyKey hợp lệ.' })
    .trim()
    .min(8, 'idempotencyKey quá ngắn (tối thiểu 8 ký tự).')
    .max(128, 'idempotencyKey quá dài (tối đa 128 ký tự).')
    .regex(/^[A-Za-z0-9_\-.:]+$/, 'idempotencyKey chứa ký tự không hợp lệ.'),
  correlationId: z.string().trim().max(100, 'correlationId quá dài (tối đa 100 ký tự).').optional(),
});

export type BatchReleaseRequestBody = z.infer<typeof batchReleaseSchema>;

export interface BatchReleaseResponseBody {
  success: boolean;
  batchId: string;
  newVersion: number;
  status: 'RELEASED';
  releasedAt: string;
  idempotencyReplayed?: boolean;
  durationMs?: number;
  correlationId: string;
  commandId: string;
}
