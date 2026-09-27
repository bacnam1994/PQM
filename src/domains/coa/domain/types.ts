/**
 * COA DOMAIN: TYPES & CONTRACTS
 * GMP-WHO / 21 CFR Part 11 Certificate of Analysis (CoA)
 */

import {
  Batch,
  TestResult,
  TCCS,
  Product,
  EvaluationSnapshot,
  ElectronicSignature,
} from '../../../types';

export interface CoAFootnote {
  symbol: string;
  criterionName: string;
  text: string;
}

export interface CoACriterionEntry {
  name: string;
  specification: string;
  result: string;
  isPass: boolean;
  isExempted?: boolean;
  note?: string;
  footnoteSymbol?: string;
}

export interface CoADocumentPayload {
  coaNumber: string;
  batchNumber: string;
  productName: string;
  dosageForm?: string;
  packaging?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  testDate?: string;
  labName?: string;
  overallConclusion: 'ĐẠT TIÊU CHUẨN' | 'KHÔNG ĐẠT TIÊU CHUẨN';
  canonicalStatus: 'PASS' | 'FAIL';
  criteriaList: CoACriterionEntry[];
  footnotes: CoAFootnote[];
  alcoaHash: string;
  isIntegrityVerified: boolean;
  publishedAt: string;
  publishedBy: string;
}

export interface CoAVerificationData {
  testResult: TestResult | null;
  batch: Batch | null;
  product: Product | null;
  tccs: TCCS | null;
  signature: ElectronicSignature | null;
}

export interface GenerateCoAPayloadOptions {
  batch: Batch;
  testResult: TestResult;
  tccs?: TCCS | null;
  currentUser: any;
}

export interface SignCoAOptions {
  coaNumber: string;
  batchNumber: string;
  signature: ElectronicSignature;
  currentUser: any;
}

export interface RevokeCoAOptions {
  coaNumber: string;
  reason: string;
  currentUser: any;
  signature?: ElectronicSignature;
}

export type CoAStatus = 'GENERATED' | 'SIGNED' | 'REVOKED';
