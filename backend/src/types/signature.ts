/**
 * backend/src/types/signature.ts
 * Type definitions and Zod boundary schemas for electronic signature operations
 */

import { z } from 'zod';
import { SignatureDocumentType, ElectronicSignature } from '@pqm/release-engine';

export { SignatureDocumentType, ElectronicSignature };

export const signatureDocumentTypeEnum = z.enum([
  'BATCH',
  'BATCH_RELEASE',
  'BATCH_REJECT',
  'TEST_RESULT',
  'TEST_RESULT_APPROVAL',
  'COA_ISSUE',
  'TCCS',
  'DEVIATION',
  'CHANGE_CONTROL',
]);

export const createSignatureSchema = z.object({
  documentType: signatureDocumentTypeEnum,
  documentId: z
    .string({ required_error: 'Mã tài liệu (documentId) không được để trống.' })
    .trim()
    .min(1, 'Mã tài liệu không được để trống.')
    .max(100, 'Mã tài liệu quá dài (tối đa 100 ký tự).'),
  documentVersion: z
    .number()
    .int('Phiên bản tài liệu (documentVersion) phải là số nguyên.')
    .positive('Phiên bản tài liệu phải lớn hơn 0.')
    .finite('Phiên bản tài liệu không được là NaN hoặc Infinity.')
    .optional(),
  meaning: z
    .string()
    .trim()
    .max(250, 'Mục đích ký (meaning) không được vượt quá 250 ký tự.')
    .optional(),
  comments: z
    .string()
    .trim()
    .max(1000, 'Ghi chú (comments) không được vượt quá 1000 ký tự.')
    .optional(),
  correlationId: z
    .string()
    .trim()
    .max(100, 'Correlation ID không được vượt quá 100 ký tự.')
    .optional(),
});

export type CreateSignatureRequestBody = z.infer<typeof createSignatureSchema>;

export interface CreateSignatureResponseBody {
  success: boolean;
  signature: ElectronicSignature;
  durationMs: number;
  correlationId: string;
}
