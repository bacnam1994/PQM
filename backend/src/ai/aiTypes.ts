/**
 * backend/src/ai/aiTypes.ts
 * Types and interfaces for Server-Side AI Intelligence Suite
 */

import { z } from 'zod';

export type AIAnalysisType =
  | 'batch_analysis'
  | 'test_result_analysis'
  | 'deviation_analysis'
  | 'document_analysis'
  | 'capa_assistant';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type EvidenceSourceType =
  | 'BATCH'
  | 'TEST_RESULT'
  | 'SPECIFICATION'
  | 'DEVIATION'
  | 'DOCUMENT';

export interface AIEvidence {
  sourceType: EvidenceSourceType;
  sourceId: string;
  quoteOrMetric?: string;
}

export interface AIFinding {
  title: string;
  description: string;
  evidence: AIEvidence[];
}

export interface AISummaryResult {
  summary: string;
  riskLevel: RiskLevel;
  findings: AIFinding[];
  recommendations: string[];
  limitations: string[];
  confidence?: ConfidenceLevel;
}

export interface AIAuditMetadata {
  aiAnalysisId: string;
  uid: string;
  userEmail: string;
  timestamp: string;
  model: string;
  promptVersion: string;
  analysisType: AIAnalysisType;
  contextHash: string;
  inputRecordIds: string[];
  correlationId: string;
}

export interface AIAnalyzeRequest {
  type: AIAnalysisType;
  batchId?: string;
  testResultId?: string;
  deviationId?: string;
  documentId?: string;
  promptOverride?: string;
  correlationId?: string;
}

export interface BuiltContext {
  type: AIAnalysisType;
  contextText: string;
  contextHash: string;
  validRecordIds: Set<string>;
  inputRecordIds: string[];
  rawData: Record<string, any>;
}

// Zod validation schema for Structured AI Output (Phase 7 & 9)
export const AIEvidenceSchema = z.object({
  sourceType: z.enum(['BATCH', 'TEST_RESULT', 'SPECIFICATION', 'DEVIATION', 'DOCUMENT']),
  sourceId: z.string().min(1),
  quoteOrMetric: z.string().optional(),
});

export const AIFindingSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.array(AIEvidenceSchema).default([]),
});

export const AISummaryResultSchema = z.object({
  summary: z.string().min(1),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  findings: z.array(AIFindingSchema).default([]),
  recommendations: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const AIAnalyzeRequestSchema = z.object({
  type: z.enum([
    'batch_analysis',
    'test_result_analysis',
    'deviation_analysis',
    'document_analysis',
    'capa_assistant',
  ]),
  batchId: z.string().optional(),
  testResultId: z.string().optional(),
  deviationId: z.string().optional(),
  promptOverride: z.string().max(2000).optional(),
  correlationId: z.string().optional(),
});

// Zod schemas for AI Configuration Management (Phase 5, 6, 7)
export const AIConfigUpdateSchema = z.object({
  apiKey: z
    .string()
    .min(10, 'API Key tối thiểu 10 ký tự')
    .max(200, 'API Key tối đa 200 ký tự')
    .refine((val) => val.trim().length > 0, 'API Key không được để trống'),
  model: z.string().optional(),
});

export const AITestConnectionSchema = z.object({
  apiKey: z.string().optional(),
  model: z.string().optional(),
});

export type AIConfigUpdatePayload = z.infer<typeof AIConfigUpdateSchema>;
export type AITestConnectionPayload = z.infer<typeof AITestConnectionSchema>;
