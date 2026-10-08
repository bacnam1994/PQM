/**
 * backend/src/ai/aiValidator.ts
 * Structured Output Validator & Hallucination Guard (Phases 7, 8, 9, 11)
 *
 * Validates Zod schema, verifies evidence IDs against context, rejects hallucinated IDs,
 * and ensures mandatory QA/QC advisory limitations.
 */

import { AppError } from '../utils/errors';
import {
  AISummaryResultSchema,
  type AISummaryResult,
  type AIFinding,
  type AIEvidence,
} from './aiTypes';

const DEFAULT_MANDATORY_LIMITATION =
  'Kết quả phân tích từ AI chỉ mang tính hỗ trợ ra quyết định và đối chiếu kỹ thuật, không thay thế thẩm quyền phê duyệt độc lập của QA/QC.';

export class AIValidator {
  /**
   * Safely parses JSON from AI text response, handling markdown blocks if present.
   */
  public static parseJsonFromResponse(rawText: string): any {
    if (!rawText || typeof rawText !== 'string') {
      throw new AppError(
        'AI_INVALID_RESPONSE',
        'Phản hồi từ AI rỗng hoặc không đúng định dạng.',
        502
      );
    }

    let cleaned = rawText.trim();
    // Handle ```json ... ``` or ``` ... ```
    if (cleaned.startsWith('```')) {
      const firstNewline = cleaned.indexOf('\n');
      const lastBackticks = cleaned.lastIndexOf('```');
      if (firstNewline !== -1 && lastBackticks > firstNewline) {
        cleaned = cleaned.substring(firstNewline + 1, lastBackticks).trim();
      }
    }

    try {
      return JSON.parse(cleaned);
    } catch (err: any) {
      throw new AppError(
        'AI_INVALID_RESPONSE',
        `Phản hồi từ mô hình AI không phải là JSON hợp lệ: ${err.message}`,
        502
      );
    }
  }

  /**
   * Validates structure against Zod schema and enforces Hallucination Guard
   */
  public static validateAndGuard(rawJson: any, validRecordIds: Set<string>): AISummaryResult {
    // 1. Zod schema validation
    const parseResult = AISummaryResultSchema.safeParse(rawJson);
    if (!parseResult.success) {
      const issueMsgs = parseResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      throw new AppError(
        'AI_INVALID_RESPONSE',
        `Cấu trúc dữ liệu AI không khớp quy cách chuẩn: ${issueMsgs}`,
        502
      );
    }

    const data = parseResult.data;

    // 2. Hallucination Guard: Evidence & ID verification (Phase 8 & 9)
    const sanitizedFindings: AIFinding[] = [];

    for (const finding of data.findings) {
      const validatedEvidences: AIEvidence[] = [];

      for (const ev of finding.evidence) {
        const idToCheck = ev.sourceId.trim();
        // Check if ID exists in validRecordIds
        let isKnown = validRecordIds.has(idToCheck);

        if (!isKnown) {
          // Check case-insensitive or partial match for identifiers
          for (const knownId of validRecordIds) {
            if (knownId.toLowerCase() === idToCheck.toLowerCase()) {
              isKnown = true;
              ev.sourceId = knownId; // Normalize to canonical known ID
              break;
            }
          }
        }

        if (isKnown) {
          validatedEvidences.push(ev);
        } else {
          // Discard hallucinated ID to prevent fake data propagation
          console.warn(
            `[HallucinationGuard] Discarded hallucinated record ID '${idToCheck}' in finding '${finding.title}'`
          );
        }
      }

      // If finding had evidence but all were hallucinated, mark with caveat
      if (finding.evidence.length > 0 && validatedEvidences.length === 0) {
        sanitizedFindings.push({
          title: finding.title,
          description: `${finding.description} (Lưu ý: Không tìm thấy hồ sơ gốc hợp lệ trong ngữ cảnh để đối chiếu).`,
          evidence: [],
        });
      } else {
        sanitizedFindings.push({
          ...finding,
          evidence: validatedEvidences,
        });
      }
    }

    // 3. Enforce Limitations (Phase 11)
    const limitations = Array.isArray(data.limitations) ? [...data.limitations] : [];
    const hasMandatoryLimitation = limitations.some((l) =>
      l.toLowerCase().includes('không thay thế')
    );

    if (!hasMandatoryLimitation) {
      limitations.unshift(DEFAULT_MANDATORY_LIMITATION);
    }

    // 4. Ensure recommendations don't pretend to be authoritative release/approval actions
    const recommendations = (data.recommendations || []).map((rec) => {
      return rec.replace(
        /Hệ thống tự động phê duyệt|Tự động xuất xưởng/gi,
        'Khuyến nghị QA xem xét'
      );
    });

    return {
      summary: data.summary,
      riskLevel: data.riskLevel,
      findings: sanitizedFindings,
      recommendations,
      limitations,
      confidence: data.confidence || 'MEDIUM',
    };
  }
}
