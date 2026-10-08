/**
 * backend/src/ai/aiAudit.ts
 * Audit Trail Logging for AI Analysis operations (Phase 12)
 *
 * Records ALCOA+ compliant metadata for every significant AI analysis request.
 */

import { getDb } from '../config/firebaseAdmin';
import type { AIAuditMetadata, AISummaryResult, BuiltContext } from './aiTypes';

export class AIAuditLogger {
  /**
   * Generates unique AI Analysis identifier
   */
  public static generateAnalysisId(): string {
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).substring(2, 8);
    return `AI-ANL-${ts}-${rand}`.toUpperCase();
  }

  /**
   * Records audit metadata to Firebase RTDB under /ai_audit_logs/{aiAnalysisId}
   */
  public static async recordAudit(
    metadata: AIAuditMetadata,
    result?: AISummaryResult
  ): Promise<void> {
    try {
      const db = getDb();
      const auditPayload: Record<string, any> = {
        aiAnalysisId: metadata.aiAnalysisId,
        uid: metadata.uid,
        userEmail: metadata.userEmail,
        timestamp: metadata.timestamp,
        model: metadata.model,
        promptVersion: metadata.promptVersion,
        analysisType: metadata.analysisType,
        contextHash: metadata.contextHash,
        inputRecordIds: metadata.inputRecordIds || [],
        correlationId: metadata.correlationId,
      };

      if (result) {
        auditPayload.riskLevel = result.riskLevel;
        auditPayload.summarySnippet = result.summary.slice(0, 300);
        auditPayload.findingsCount = result.findings.length;
      }

      await db.ref(`ai_audit_logs/${metadata.aiAnalysisId}`).set(auditPayload);
    } catch (err: any) {
      // Non-blocking for AI analysis return, but logged
      console.error(
        `[AIAuditLogger] Failed to write audit log for ${metadata.aiAnalysisId}:`,
        err.message
      );
    }
  }
}
