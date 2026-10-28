import { parseNumberFromText } from '../../../../utils';
import { Criterion } from '../../../../types';

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch { return dateStr; }
};

export const calcMean = (vals: number[]): number =>
  vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;

export const calcStdDev = (vals: number[], mean: number): number => {
  if (vals.length < 2) return 0;
  const variance = vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (vals.length - 1);
  return Math.sqrt(variance);
};

export const calcPercentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
};

export const calcCpk = (
  mean: number, stdDev: number, usl?: number, lsl?: number
): { value: number | null; type: 'Cpk' | 'Cpu' | 'Cpl' | null } => {
  if (stdDev === 0 || (usl === undefined && lsl === undefined)) return { value: null, type: null };
  if (usl !== undefined && lsl !== undefined) {
    const cpu = (usl - mean) / (3 * stdDev);
    const cpl = (mean - lsl) / (3 * stdDev);
    return { value: Math.min(cpu, cpl), type: 'Cpk' };
  }
  if (usl !== undefined) return { value: (usl - mean) / (3 * stdDev), type: 'Cpu' };
  if (lsl !== undefined) return { value: (mean - lsl) / (3 * stdDev), type: 'Cpl' };
  return { value: null, type: null };
};

export const parseCriterionBound = (val: any): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const num = typeof val === 'string' ? parseNumberFromText(val) : Number(val);
  return isNaN(num) ? undefined : num;
};

export const getCriterionLimitText = (criterion: Criterion, entryLimit?: string): string => {
  const minVal = parseCriterionBound(criterion.min);
  const maxVal = parseCriterionBound(criterion.max);
  const unit = criterion.unit || '';

  if (minVal !== undefined && maxVal !== undefined && !(minVal === 0 && maxVal === 0)) {
    return `${minVal} – ${maxVal} ${unit}`.trim();
  }
  if (maxVal !== undefined && maxVal > 0) {
    return `≤ ${maxVal} ${unit}`.trim();
  }
  if (minVal !== undefined && minVal > 0) {
    return `≥ ${minVal} ${unit}`.trim();
  }
  if (entryLimit && entryLimit !== '---' && !/^0\s*[-–]\s*0/.test(entryLimit)) {
    return entryLimit;
  }
  if (criterion.declaredContent) {
    return `${criterion.declaredContent} ${unit}`.trim();
  }
  return '---';
};
