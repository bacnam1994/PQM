/**
 * COA DOMAIN: RULES & STATE MACHINE
 * Tuân thủ BR-COA-001 -> BR-COA-004 & ALCOA+ Data Integrity
 */

import { EvaluationSnapshot, TCCS } from '../../../types';
import { verifyEvaluationSnapshotIntegrity } from '../../../domain/evaluation/EvaluationSnapshotBuilder';
import { AlternateRuleResolver } from '../../../domain/evaluation/AlternateRuleResolver';
import { CoAFootnote, CoACriterionEntry, CoAStatus } from './types';

export class CoAStateMachine {
  private static readonly VALID_TRANSITIONS: Record<CoAStatus, CoAStatus[]> = {
    GENERATED: ['SIGNED', 'REVOKED'],
    SIGNED: ['REVOKED'],
    REVOKED: [],
  };

  public static getValidNextStates(fromState: CoAStatus): CoAStatus[] {
    return this.VALID_TRANSITIONS[fromState] || [];
  }

  public static canTransition(
    fromState: CoAStatus,
    toState: CoAStatus
  ): { allowed: boolean; reason?: string } {
    if (fromState === toState) return { allowed: true };

    const validNext = this.VALID_TRANSITIONS[fromState] || [];
    if (!validNext.includes(toState)) {
      return {
        allowed: false,
        reason: `Chuyển đổi trạng thái CoA không hợp lệ từ ${fromState} sang ${toState}.`,
      };
    }

    return { allowed: true };
  }
}

export class CoARules {
  /**
   * Thẩm định tính toàn vẹn chữ ký băm ALCOA+ SHA-256 từ EvaluationSnapshot (BR-COA-001 & BR-COA-003)
   */
  public static verifySnapshotIntegrity(
    snapshot: EvaluationSnapshot,
    testResultId: string,
    batchId?: string
  ): boolean {
    return verifyEvaluationSnapshotIntegrity(snapshot, testResultId, batchId);
  }

  /**
   * Xây dựng danh sách chỉ tiêu và thu thập tự động Footnotes từ quy tắc Alternate / Miễn kiểm (BR-COA-002)
   */
  public static buildCriteriaAndFootnotes(
    snapshot: EvaluationSnapshot,
    boundTccs?: TCCS | null
  ): { criteriaList: CoACriterionEntry[]; footnotes: CoAFootnote[] } {
    const footnotes: CoAFootnote[] = [];
    let footnoteCounter = 1;

    const alternateNotesMap = boundTccs?.alternateRules
      ? AlternateRuleResolver.generateAlternateRuleNotes(boundTccs.alternateRules)
      : [];

    const criteriaList = snapshot.criterionResults.map((entry) => {
      let footnoteSymbol: string | undefined;

      if (entry.alternateState && entry.alternateState !== 'NONE') {
        footnoteSymbol = `(*${footnoteCounter++})`;
        let noteText = entry.alternateNote;

        if (!noteText && boundTccs && alternateNotesMap.length > 0) {
          noteText = alternateNotesMap[0];
        }

        if (!noteText) {
          noteText =
            entry.alternateState === 'EXEMPTED'
              ? 'Chỉ tiêu được miễn kiểm tra theo quy định của Tiêu chuẩn cơ sở đã phê duyệt.'
              : 'Chỉ tiêu đạt tiêu chuẩn sau khi thực hiện phép thử bổ sung/thay thế.';
        }

        footnotes.push({
          symbol: footnoteSymbol,
          criterionName: entry.criteriaName,
          text: noteText,
        });
      }

      const displayResult =
        entry.alternateState === 'EXEMPTED'
          ? `Miễn kiểm ${footnoteSymbol || ''}`
          : String(entry.value ?? '');

      return {
        name: entry.criteriaName,
        specification: entry.note || '',
        result: displayResult,
        isPass: entry.isPass !== false,
        isExempted: entry.alternateState === 'EXEMPTED',
        note: entry.note,
        footnoteSymbol,
      };
    });

    return { criteriaList, footnotes };
  }

  /**
   * Kiểm tra lý do thu hồi chứng chỉ CoA (tối thiểu 20 ký tự giải trình)
   */
  public static validateRevocationReason(reason: string): { isValid: boolean; error?: string } {
    if (!reason || reason.trim().length < 20) {
      return {
        isValid: false,
        error:
          'ERR_REVOCATION_REASON_TOO_SHORT: Lý do thu hồi CoA phải tối thiểu 20 ký tự giải trình.',
      };
    }
    return { isValid: true };
  }
}
