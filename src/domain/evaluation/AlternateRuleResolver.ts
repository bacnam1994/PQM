/**
 * AlternateRuleResolver.ts
 * Domain Service: Single Source of Truth cho việc phân giải trạng thái Quy tắc Thay thế (Alternate Rules).
 * Đảm bảo:
 * - Deterministic 100%, không phân mảnh logic ở UI hay CoA.
 * - Chuẩn hóa các trạng thái AlternateCriterionState (EXEMPTED, TRIGGERED_PENDING, TRIGGERED_PASS, TRIGGERED_FAIL...).
 * - Tự động sinh văn bản Ghi chú Quy tắc Thay thế cho TCCS và CoA.
 */

import {
  AlternateRule,
  AlternateCriterionState,
  TestResultEntry,
  TCCS,
  Criterion,
} from '../../types';
import { normalizeName } from '../../services/criteriaAliasService';
import { CriterionEvaluator } from './CriterionEvaluator';

export interface ResolvedAlternateStatus {
  alternateState: AlternateCriterionState;
  isParticipating: boolean;
  isMain: boolean;
  isAlt: boolean;
  rule: AlternateRule | null;
  pairedCriterionName?: string;
  isExempted: boolean;
  isRequired: boolean;
  isPending: boolean;
  displayBadge: {
    label: string;
    variant: 'EXEMPTED' | 'PENDING' | 'TRIGGERED' | 'PASS' | 'FAIL' | 'INFO';
    tooltip: string;
  } | null;
  displayNote: string;
}

export class AlternateRuleResolver {
  /**
   * So khớp tên chỉ tiêu (chuẩn hóa không phân biệt hoa thường, dấu cách, ký tự đặc biệt)
   */
  static isNameMatch(nameA?: string, nameB?: string): boolean {
    if (!nameA || !nameB) return false;
    return normalizeName(nameA) === normalizeName(nameB);
  }

  /**
   * Tìm quy tắc mà chỉ tiêu này là chỉ tiêu chính (Main)
   */
  static findRuleWhereMain(
    criterionName: string,
    rules: AlternateRule[] = []
  ): AlternateRule | undefined {
    return rules.find((r) => this.isNameMatch(r.main, criterionName));
  }

  /**
   * Tìm quy tắc mà chỉ tiêu này là chỉ tiêu phụ thuộc (Alt)
   */
  static findRuleWhereAlt(
    criterionName: string,
    rules: AlternateRule[] = []
  ): AlternateRule | undefined {
    return rules.find((r) => this.isNameMatch(r.alt, criterionName));
  }

  /**
   * Trích xuất giá trị chỉ tiêu từ map hoặc mảng kết quả
   */
  static extractValue(
    targetName: string,
    allValuesOrResults: Record<string, any> | TestResultEntry[]
  ): { value: any; entry?: TestResultEntry } {
    if (Array.isArray(allValuesOrResults)) {
      const entry = allValuesOrResults.find((r) => this.isNameMatch(r.criteriaName, targetName));
      return { value: entry?.value, entry };
    }

    if (allValuesOrResults && typeof allValuesOrResults === 'object') {
      if (allValuesOrResults[targetName] !== undefined) {
        return { value: allValuesOrResults[targetName] };
      }
      const targetNorm = normalizeName(targetName);
      for (const [k, v] of Object.entries(allValuesOrResults)) {
        if (normalizeName(k) === targetNorm) {
          return { value: v };
        }
      }
    }

    return { value: undefined };
  }

  /**
   * Tìm định nghĩa chỉ tiêu trong TCCS
   */
  static findCriterionDef(criterionName: string, tccs?: TCCS | null): Criterion | undefined {
    if (!tccs) return undefined;
    const allCriteria = [...(tccs.mainQualityCriteria || []), ...(tccs.safetyCriteria || [])];
    return allCriteria.find((c) => this.isNameMatch(c?.name, criterionName));
  }

  /**
   * Chuẩn hóa và kiểm tra xem điều kiện CONDITIONAL_CHECK có bị kích hoạt không.
   * Quy tắc nghiệp vụ:
   * 1. Chỉ tiêu chính TC1 BẮT BUỘC PHẢI ĐẠT (isMainPass === true). Nếu TC1 rớt, điều kiện bổ sung không kích hoạt.
   * 2. Nếu conditionValue là số đơn thuần không kèm toán tử (ví dụ "1.5", "1000"),
   *    do quy tắc CONDITIONAL_CHECK là "Nếu TC1 ĐẠT và > Giá trị -> Kiểm tra TC2",
   *    toán tử mặc định là ">".
   * 3. Nếu conditionValue đã có toán tử (ví dụ "> 1.5", ">= 75", "<= 10"), giữ nguyên toán tử đó.
   */
  static isConditionalCheckTriggered(
    conditionValue: string | undefined,
    mainVal: any,
    isMainPass: boolean
  ): boolean {
    if (!isMainPass) return false;
    if (
      conditionValue === undefined ||
      conditionValue === null ||
      String(conditionValue).trim() === ''
    ) {
      return false;
    }
    const condStr = String(conditionValue).trim();
    const hasOperator = /^(<=|≤|>=|≥|<|>|NMT|NLT)/i.test(condStr);
    const normalizedCond = hasOperator ? condStr : `> ${condStr}`;
    return CriterionEvaluator.checkRange(normalizedCond, String(mainVal)) === true;
  }

  /**
   * Phân giải trạng thái Alternate Rule của một chỉ tiêu cụ thể
   */
  static resolveCriterionState(
    criterionName: string,
    currentValue: any,
    allValuesOrResults: Record<string, any> | TestResultEntry[],
    tccs?: TCCS | null,
    criterionDef?: Criterion | null
  ): ResolvedAlternateStatus {
    const rules = tccs?.alternateRules || [];
    const ruleAsAlt = this.findRuleWhereAlt(criterionName, rules);
    const ruleAsMain = this.findRuleWhereMain(criterionName, rules);

    // Không tham gia bất kỳ quy tắc nào
    if (!ruleAsAlt && !ruleAsMain) {
      return {
        alternateState: 'NONE',
        isParticipating: false,
        isMain: false,
        isAlt: false,
        rule: null,
        isExempted: false,
        isRequired: false,
        isPending: false,
        displayBadge: null,
        displayNote: '',
      };
    }

    // Trường hợp 1: Chỉ tiêu này là CHỈ TIÊU CHÍNH (Main)
    if (!ruleAsAlt && ruleAsMain) {
      const altName = ruleAsMain.alt;
      const ruleType = ruleAsMain.type || 'FAIL_RETRY';

      let displayNote = `Áp dụng quy tắc thay thế với "${altName}".`;
      if (ruleType === 'FAIL_RETRY') {
        displayNote += ` Nếu không đạt, chỉ tiêu "${altName}" sẽ được kích hoạt để đánh giá lại.`;
      } else {
        const condStr = ruleAsMain.conditionValue ? String(ruleAsMain.conditionValue).trim() : '';
        const hasOp = /^(<=|≤|>=|≥|<|>|NMT|NLT)/i.test(condStr);
        const displayCond = condStr ? (hasOp ? condStr : `> ${condStr}`) : '';
        displayNote += ` Khi đạt điều kiện "${displayCond}", chỉ tiêu "${altName}" sẽ được kích hoạt.`;
      }

      return {
        alternateState: 'NONE',
        isParticipating: true,
        isMain: true,
        isAlt: false,
        rule: ruleAsMain,
        pairedCriterionName: altName,
        isExempted: false,
        isRequired: false,
        isPending: false,
        displayBadge: {
          label: '🔗 Có thay thế',
          variant: 'INFO',
          tooltip: displayNote,
        },
        displayNote,
      };
    }

    // Trường hợp 2: Chỉ tiêu này là CHỈ TIÊU PHỤ THUỘC (Alt)
    const rule = ruleAsAlt!;
    const mainName = rule.main;
    const { value: mainVal, entry: mainEntry } = this.extractValue(mainName, allValuesOrResults);
    const mainDef = this.findCriterionDef(mainName, tccs);

    const hasMainVal = mainVal !== undefined && mainVal !== null && String(mainVal).trim() !== '';
    const hasCurVal =
      currentValue !== undefined && currentValue !== null && String(currentValue).trim() !== '';

    const defForCurrent = criterionDef || this.findCriterionDef(criterionName, tccs);

    // Nếu chỉ tiêu chính CHƯA ĐƯỢC NHẬP KẾT QUẢ
    if (!hasMainVal) {
      const note = `Phụ thuộc vào chỉ tiêu "${mainName}". Chưa kích hoạt do "${mainName}" chưa có kết quả.`;
      return {
        alternateState: 'NOT_TRIGGERED',
        isParticipating: true,
        isMain: false,
        isAlt: true,
        rule,
        pairedCriterionName: mainName,
        isExempted: false,
        isRequired: false,
        isPending: false,
        displayBadge: {
          label: `↳ Phụ thuộc ${mainName}`,
          variant: 'INFO',
          tooltip: note,
        },
        displayNote: note,
      };
    }

    // Đánh giá chỉ tiêu chính
    const mainEval = mainDef
      ? CriterionEvaluator.evaluateCriterion(mainDef, mainVal)
      : mainEntry && mainEntry.isPass !== null && mainEntry.isPass !== undefined
        ? { isPass: mainEntry.isPass }
        : { isPass: true };

    const isMainPass = mainEval.isPass === true;
    const ruleType = rule.type || 'FAIL_RETRY';

    // 2.1. Quy tắc FAIL_RETRY
    if (ruleType === 'FAIL_RETRY') {
      if (isMainPass) {
        // Chỉ tiêu chính ĐẠT -> Miễn kiểm chỉ tiêu phụ
        const note = `Miễn kiểm theo quy tắc thay thế: "${mainName}" đã đạt yêu cầu.`;
        return {
          alternateState: 'EXEMPTED',
          isParticipating: true,
          isMain: false,
          isAlt: true,
          rule,
          pairedCriterionName: mainName,
          isExempted: true,
          isRequired: false,
          isPending: false,
          displayBadge: {
            label: 'MIỄN KIỂM',
            variant: 'EXEMPTED',
            tooltip: note,
          },
          displayNote: note,
        };
      } else {
        // Chỉ tiêu chính KHÔNG ĐẠT -> Quy tắc BỊ KÍCH HOẠT, chỉ tiêu phụ TRỞ THÀNH BẮT BUỘC!
        if (!hasCurVal) {
          const note = `Bắt buộc kiểm tra: Chỉ tiêu chính "${mainName}" không đạt, cần kết quả của "${criterionName}" để thẩm định.`;
          return {
            alternateState: 'TRIGGERED_PENDING',
            isParticipating: true,
            isMain: false,
            isAlt: true,
            rule,
            pairedCriterionName: mainName,
            isExempted: false,
            isRequired: true,
            isPending: true,
            displayBadge: {
              label: 'CHỜ KẾT QUẢ',
              variant: 'PENDING',
              tooltip: note,
            },
            displayNote: note,
          };
        }

        // Đã có kết quả chỉ tiêu phụ -> Đánh giá
        let isAltPass = false;
        if (rule.conditionValue) {
          isAltPass =
            CriterionEvaluator.checkRange(rule.conditionValue, String(currentValue)) === true;
        } else if (defForCurrent) {
          isAltPass =
            CriterionEvaluator.evaluateCriterion(defForCurrent, currentValue).isPass === true;
        } else {
          isAltPass = true;
        }

        if (isAltPass) {
          const note = `Đạt theo quy tắc thay thế cho "${mainName}".`;
          return {
            alternateState: 'TRIGGERED_PASS',
            isParticipating: true,
            isMain: false,
            isAlt: true,
            rule,
            pairedCriterionName: mainName,
            isExempted: false,
            isRequired: true,
            isPending: false,
            displayBadge: {
              label: 'ĐẠT (THAY THẾ)',
              variant: 'PASS',
              tooltip: note,
            },
            displayNote: note,
          };
        } else {
          const note = `Không đạt theo quy tắc thay thế cho "${mainName}".`;
          return {
            alternateState: 'TRIGGERED_FAIL',
            isParticipating: true,
            isMain: false,
            isAlt: true,
            rule,
            pairedCriterionName: mainName,
            isExempted: false,
            isRequired: true,
            isPending: false,
            displayBadge: {
              label: 'K.ĐẠT',
              variant: 'FAIL',
              tooltip: note,
            },
            displayNote: note,
          };
        }
      }
    }

    // 2.2. Quy tắc CONDITIONAL_CHECK
    if (ruleType === 'CONDITIONAL_CHECK') {
      const conditionText = rule.conditionValue || '';
      const hasOperator = /^(<=|≤|>=|≥|<|>|NMT|NLT)/i.test(conditionText.trim());
      const displayCond = hasOperator ? conditionText : `> ${conditionText}`;

      // Nếu chỉ tiêu chính KHÔNG ĐẠT:
      // CONDITIONAL_CHECK chỉ áp dụng khi "TC1 ĐẠT". Nếu TC1 rớt, phiếu lập tức bị FAIL độc lập, TC2 không kích hoạt và không cứu.
      if (!isMainPass) {
        const note = `Chỉ tiêu chính "${mainName}" không đạt yêu cầu. Phiếu kiểm nghiệm không đạt độc lập với quy tắc thay thế.`;
        return {
          alternateState: 'NOT_TRIGGERED',
          isParticipating: true,
          isMain: false,
          isAlt: true,
          rule,
          pairedCriterionName: mainName,
          isExempted: false,
          isRequired: false,
          isPending: false,
          displayBadge: {
            label: `↳ Phụ thuộc ${mainName}`,
            variant: 'INFO',
            tooltip: note,
          },
          displayNote: note,
        };
      }

      // Chỉ tiêu chính ĐẠT -> Kiểm tra xem có kích hoạt điều kiện bổ sung không
      const isTriggered = this.isConditionalCheckTriggered(conditionText, mainVal, isMainPass);

      if (!isTriggered) {
        // Điều kiện KHÔNG kích hoạt -> Được MIỄN KIỂM
        const note = `Miễn kiểm: "${mainName}" = ${mainVal} không kích hoạt điều kiện "${displayCond}".`;
        return {
          alternateState: 'EXEMPTED',
          isParticipating: true,
          isMain: false,
          isAlt: true,
          rule,
          pairedCriterionName: mainName,
          isExempted: true,
          isRequired: false,
          isPending: false,
          displayBadge: {
            label: 'MIỄN KIỂM',
            variant: 'EXEMPTED',
            tooltip: note,
          },
          displayNote: note,
        };
      } else {
        // Điều kiện BỊ KÍCH HOẠT -> Chỉ tiêu phụ TRỞ THÀNH BẮT BUỘC!
        if (!hasCurVal) {
          const note = `Bắt buộc kiểm tra: "${mainName}" = ${mainVal} kích hoạt điều kiện "${displayCond}".`;
          return {
            alternateState: 'TRIGGERED_PENDING',
            isParticipating: true,
            isMain: false,
            isAlt: true,
            rule,
            pairedCriterionName: mainName,
            isExempted: false,
            isRequired: true,
            isPending: true,
            displayBadge: {
              label: 'CHỜ KẾT QUẢ',
              variant: 'PENDING',
              tooltip: note,
            },
            displayNote: note,
          };
        }

        // Đã có kết quả chỉ tiêu phụ -> Đánh giá
        let isAltPass = false;
        if (defForCurrent) {
          isAltPass =
            CriterionEvaluator.evaluateCriterion(defForCurrent, currentValue).isPass === true;
        } else {
          isAltPass = true;
        }

        if (isAltPass) {
          const note = `Đạt yêu cầu khi kích hoạt điều kiện "${displayCond}".`;
          return {
            alternateState: 'TRIGGERED_PASS',
            isParticipating: true,
            isMain: false,
            isAlt: true,
            rule,
            pairedCriterionName: mainName,
            isExempted: false,
            isRequired: true,
            isPending: false,
            displayBadge: {
              label: 'ĐẠT',
              variant: 'PASS',
              tooltip: note,
            },
            displayNote: note,
          };
        } else {
          const note = `Không đạt yêu cầu khi kích hoạt điều kiện "${displayCond}".`;
          return {
            alternateState: 'TRIGGERED_FAIL',
            isParticipating: true,
            isMain: false,
            isAlt: true,
            rule,
            pairedCriterionName: mainName,
            isExempted: false,
            isRequired: true,
            isPending: false,
            displayBadge: {
              label: 'K.ĐẠT',
              variant: 'FAIL',
              tooltip: note,
            },
            displayNote: note,
          };
        }
      }
    }

    return {
      alternateState: 'NONE',
      isParticipating: false,
      isMain: false,
      isAlt: false,
      rule: null,
      isExempted: false,
      isRequired: false,
      isPending: false,
      displayBadge: null,
      displayNote: '',
    };
  }

  /**
   * Tự động sinh danh sách ghi chú quy tắc thay thế chuẩn GMP cho TCCS và bản in
   */
  static generateAlternateRuleNotes(rules?: AlternateRule[]): string[] {
    if (!rules || rules.length === 0) return [];
    const validRules = rules.filter((r) => r && r.main && r.alt);
    if (validRules.length === 0) return [];

    const notes: string[] = [];
    validRules.forEach((r) => {
      const isRetry = !r.type || r.type === 'FAIL_RETRY';
      if (isRetry) {
        const cond = r.conditionValue ? ` (tiêu chuẩn đạt thay thế: ${r.conditionValue})` : '';
        notes.push(
          `(*) Chỉ tiêu "${r.main}" được áp dụng quy tắc thay thế với "${r.alt}". Nếu "${r.main}" không đạt yêu cầu, "${r.alt}" trở thành chỉ tiêu bắt buộc để đánh giá lại chất lượng lô${cond}.`
        );
      } else {
        const condStr = r.conditionValue ? String(r.conditionValue).trim() : '';
        const hasOp = /^(<=|≤|>=|≥|<|>|NMT|NLT)/i.test(condStr);
        const displayCond = condStr ? (hasOp ? condStr : `> ${condStr}`) : '';
        const cond = displayCond ? ` (${displayCond})` : '';
        notes.push(
          `(*) Chỉ tiêu "${r.alt}" phụ thuộc vào kết quả của "${r.main}". Chỉ bắt buộc kiểm nghiệm "${r.alt}" khi "${r.main}" đạt và vượt ngưỡng${cond}. Khi không kích hoạt, "${r.alt}" được miễn kiểm.`
        );
      }
    });

    return notes;
  }
}
