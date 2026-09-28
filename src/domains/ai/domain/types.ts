/**
 * AI BOUNDARY DOMAIN: TYPES (VS-15)
 * =================================
 * Định nghĩa kiểu dữ liệu ranh giới an toàn cho AI Copilot / AI Services.
 * Tuân thủ nghiêm ngặt nguyên tắc: AI chỉ Advisory & Proposal, Human-in-the-loop confirmation.
 */

import { PermissionAction } from '../../../types/permissions';
import { PromptIdentifier } from '../../../services/ai/promptRegistry';

export type AIConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AIActionProposal<T = any> {
  id: string;
  toolName: string;
  targetEntity: string;
  requiredPermission: PermissionAction;
  isRegulated: boolean;
  requiresConfirmation: boolean;
  payload: T;
  evidence: string;
  rationale: string;
  proposedAt: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'EXECUTED';
}

export interface GuardValidationResult {
  allowed: boolean;
  requiresUserApproval: boolean;
  requiredPermission: PermissionAction;
  reason?: string;
  proposal?: AIActionProposal;
}

export interface AIGatewayRequest<TInput = any> {
  promptId: PromptIdentifier;
  promptVersion?: string;
  input: TInput;
  options?: {
    modelOverride?: string;
    temperature?: number;
    userId?: string;
    userEmail?: string;
    documentType?: string;
    documentId?: string;
    responseSchema?: any;
    bypassCache?: boolean;
    ttlMinutes?: number;
  };
}

export interface AIGatewayResponse<TOutput = any> {
  success: boolean;
  data?: TOutput;
  error?: string;
  metadata: {
    promptId: PromptIdentifier;
    promptVersion: string;
    modelUsed: string;
    latencyMs: number;
    confidenceScore: number; // 0.0 -> 1.0
    confidenceLevel: AIConfidenceLevel;
    executedAt: string;
    isCached?: boolean;
    similarity?: number;
  };
}

export interface AIDraftEnvelope<T = any> {
  id: string;
  source: 'global-ai-assistant' | 'test-result-ai';
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
  data: T;
}

export interface NormalizedAITestResultItem {
  criteriaName: string;
  value: string;
  unit: string;
  limit: string;
}

export interface NormalizedAIData {
  reportNo?: string;
  labName?: string;
  testDate?: string;
  batchNo?: string;
  batchId?: string;
  productName?: string;
  productCode?: string;
  mfgDate?: string;
  expDate?: string;
  testResults: NormalizedAITestResultItem[];
}
