import React from 'react';
import { parseNumberFromText } from '../../../../utils';

export const removeVietnameseTones = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
};

export const highlightMatch = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;
  const q = query.trim().toLowerCase();
  const lowerText = text.toLowerCase();
  const idx = lowerText.indexOf(q);
  if (idx === -1) {
    const normalizedText = removeVietnameseTones(text);
    const normalizedQuery = removeVietnameseTones(query);
    const normIdx = normalizedText.indexOf(normalizedQuery);
    if (normIdx === -1) return text;
    return (
      React.createElement(React.Fragment, null,
        text.substring(0, normIdx),
        React.createElement('mark', { className: 'bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100 px-0.5 rounded font-bold' }, text.substring(normIdx, normIdx + query.length)),
        text.substring(normIdx + query.length)
      )
    );
  }
  return (
    React.createElement(React.Fragment, null,
      text.substring(0, idx),
      React.createElement('mark', { className: 'bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100 px-0.5 rounded font-bold' }, text.substring(idx, idx + q.length)),
      text.substring(idx + q.length)
    )
  );
};

export const calcMean = (vals: number[]): number => {
  const valid = vals.filter(v => typeof v === 'number' && !isNaN(v));
  return valid.length === 0 ? 0 : valid.reduce((a, b) => a + b, 0) / valid.length;
};

export const calcStdDev = (vals: number[], mean: number): number => {
  const valid = vals.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length < 2) return 0;
  return Math.sqrt(valid.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (valid.length - 1));
};

export const calcCpk = (mean: number, std: number, usl?: number, lsl?: number): number | null => {
  if (std === 0 || isNaN(std) || isNaN(mean) || (usl === undefined && lsl === undefined)) return null;
  const validUsl = usl !== undefined && !isNaN(usl) ? usl : undefined;
  const validLsl = lsl !== undefined && !isNaN(lsl) ? lsl : undefined;
  if (validUsl === undefined && validLsl === undefined) return null;
  if (validUsl !== undefined && validLsl !== undefined)
    return Math.min((validUsl - mean) / (3 * std), (mean - validLsl) / (3 * std));
  if (validUsl !== undefined) return (validUsl - mean) / (3 * std);
  if (validLsl !== undefined) return (mean - validLsl) / (3 * std);
  return null;
};

export const parseCriterionBound = (val: any): number | undefined => {
  if (val === undefined || val === null || val === '') return undefined;
  const num = typeof val === 'string' ? parseNumberFromText(val) : Number(val);
  return isNaN(num) ? undefined : num;
};
