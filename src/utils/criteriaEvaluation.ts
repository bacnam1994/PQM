/**
 * criteriaEvaluation.ts
 * Facade Module tương thích ngược (Backward Compatibility Facade).
 * Toàn bộ logic chuyên môn đã được chuẩn hóa và chuyển giao cho QualityEvaluationEngine (Phase 3 Domain Engine).
 * Tất cả chữ ký hàm được bảo toàn 100% không làm gãy bất kỳ component nào trong hệ thống.
 */

import { QualityEvaluationEngine } from '../domain/evaluation/QualityEvaluationEngine';
import { useUIStore } from '../store/useUIStore';

export const getIsCommaDecimal = (): boolean => {
  try {
    return typeof window !== 'undefined' && useUIStore.getState().decimalSeparator === 'comma';
  } catch {
    return false;
  }
};

export const getActiveLocale = (): string => {
  return QualityEvaluationEngine.getActiveLocale();
};

export const formatNumber = (
  value: number | string | null | undefined,
  options?: Intl.NumberFormatOptions
): string => {
  return QualityEvaluationEngine.formatNumber(value, options);
};

export const standardizeDecimalString = (str: string | number | null | undefined): string => {
  return QualityEvaluationEngine.standardizeDecimalString(str);
};

export const invalidateDecimalCache = (): void => {};

export const safeParseFloat = (str: string): number => {
  return QualityEvaluationEngine.safeParseFloat(str);
};

export const normalizeNumericString = (value: string | number | null | undefined): string => {
  return QualityEvaluationEngine.normalizeNumericString(value);
};

export const parseNumberFromText = (text: string | number | null | undefined): number => {
  return QualityEvaluationEngine.parseNumberFromText(text);
};

export const autoFormatInput = (text: string): string => {
  return QualityEvaluationEngine.autoFormatInput(text);
};

export const checkRange = (limit: string, value: string): boolean | null => {
  return QualityEvaluationEngine.checkRange(limit, value);
};

export const evaluateCriterionSmart = (criterion: any, value: any): boolean => {
  return QualityEvaluationEngine.evaluateCriterionSmart(criterion, value);
};

export const evaluateCriterionWithAlternates = (
  criterion: any,
  value: any,
  allValues: Record<string, any> = {},
  tccsAlternateRules: Array<{
    main: string;
    alt: string;
    type?: 'FAIL_RETRY' | 'CONDITIONAL_CHECK';
    conditionValue?: string;
  }> = []
) => {
  return QualityEvaluationEngine.evaluateCriterionWithAlternates(
    criterion,
    value,
    allValues,
    tccsAlternateRules as any
  );
};

export const formatScientific = (value: string | number): string => {
  return QualityEvaluationEngine.formatScientific(value);
};
