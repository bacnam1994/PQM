/**
 * backend/src/types/signature.ts
 * Type definitions for electronic signature operations
 */

import { SignatureDocumentType, ElectronicSignature } from '@pqm/release-engine';

export { SignatureDocumentType, ElectronicSignature };

export interface CreateSignatureRequestBody {
  documentType: SignatureDocumentType;
  documentId: string;
  documentVersion?: number;
  meaning?: string;
  comments?: string;
  correlationId?: string;
}

export interface CreateSignatureResponseBody {
  success: boolean;
  signature: ElectronicSignature;
  durationMs: number;
  correlationId: string;
}
