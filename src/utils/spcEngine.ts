/**
 * spcEngine.ts
 * ============
 * Thư viện tính toán Năng lực Quy trình Thống kê (Statistical Process Control - SPC)
 * tuân thủ tiêu chuẩn ISO 22514, AIAG SPC Manual và hướng dẫn USP <1033>.
 *
 * Cung cấp:
 * 1. Thống kê cơ bản: Mean, Overall StdDev, Within-subgroup StdDev (Moving Range d2=1.128).
 * 2. Chỉ số năng lực: Cp, Cpk, Pp, Ppk, Cpm.
 * 3. Bộ phát hiện đầy đủ 8 Quy tắc Nelson (Nelson Rules for SPC).
 */

import { TestingLaboratory } from '../types/laboratory';
import { resolveCanonicalLab } from '../services/laboratoryService';

export interface SPCParameters {
  mean: number;
  stdDevOverall: number;
  stdDevWithin: number;
  ucl: number; // Upper Control Limit (+3 sigma)
  lcl: number; // Lower Control Limit (-3 sigma)
  sigma1Upper: number; // +1 sigma
  sigma1Lower: number; // -1 sigma
  sigma2Upper: number; // +2 sigma
  sigma2Lower: number; // -2 sigma
}

export interface ProcessCapabilityResult {
  mean: number;
  stdDevOverall: number;
  stdDevWithin: number;
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  cpm: number | null;
  status: 'CAPABLE' | 'MARGINAL' | 'INCAPABLE'; // Cpk >= 1.33: Capable, 1.0 <= Cpk < 1.33: Marginal, < 1.0: Incapable
}

export interface NelsonViolation {
  ruleNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  ruleName: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  violationIndices: number[]; // Các vị trí index trong mảng vi phạm
}

/**
 * Tính giá trị trung bình (Arithmetic Mean)
 */
export function calcMean(values: number[]): number {
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v));
  if (valid.length === 0) return 0;
  return valid.reduce((acc, val) => acc + val, 0) / valid.length;
}

/**
 * Tính độ lệch chuẩn tổng thể (Sample Standard Deviation - n-1)
 */
export function calcStdDev(values: number[], mean?: number): number {
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v));
  if (valid.length < 2) return 0;
  const m = mean !== undefined ? mean : calcMean(valid);
  const variance = valid.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

/**
 * Tính độ lệch chuẩn nội nhóm dựa trên Average Moving Range (d2 = 1.128 cho nhóm n=2)
 */
export function calcWithinStdDev(values: number[]): number {
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v));
  if (valid.length < 2) return 0;

  let totalMR = 0;
  for (let i = 1; i < valid.length; i++) {
    totalMR += Math.abs(valid[i] - valid[i - 1]);
  }
  const avgMR = totalMR / (valid.length - 1);
  const d2 = 1.128; // Chuẩn AIAG cho Moving Range cỡ mẫu n = 2
  return avgMR / d2;
}

/**
 * Tính các chỉ số năng lực quy trình Cp, Cpk, Pp, Ppk
 */
export function calcProcessCapability(
  values: number[],
  usl?: number,
  lsl?: number,
  target?: number
): ProcessCapabilityResult {
  const valid = values.filter((v) => typeof v === 'number' && !isNaN(v));
  const mean = calcMean(valid);
  const stdDevOverall = calcStdDev(valid, mean);
  const stdDevWithin = calcWithinStdDev(valid);

  if (valid.length < 2 || (usl === undefined && lsl === undefined)) {
    return {
      mean,
      stdDevOverall,
      stdDevWithin,
      cp: null,
      cpk: null,
      pp: null,
      ppk: null,
      cpm: null,
      status: 'MARGINAL',
    };
  }

  // 1. Chỉ số ngắn hạn (Cp, Cpk) dùng stdDevWithin
  let cp: number | null = null;
  let cpk: number | null = null;

  if (stdDevWithin > 0) {
    if (usl !== undefined && lsl !== undefined) {
      cp = (usl - lsl) / (6 * stdDevWithin);
      const cpu = (usl - mean) / (3 * stdDevWithin);
      const cpl = (mean - lsl) / (3 * stdDevWithin);
      cpk = Math.min(cpu, cpl);
    } else if (usl !== undefined) {
      cpk = (usl - mean) / (3 * stdDevWithin);
    } else if (lsl !== undefined) {
      cpk = (mean - lsl) / (3 * stdDevWithin);
    }
  }

  // 2. Chỉ số dài hạn (Pp, Ppk) dùng stdDevOverall
  let pp: number | null = null;
  let ppk: number | null = null;

  if (stdDevOverall > 0) {
    if (usl !== undefined && lsl !== undefined) {
      pp = (usl - lsl) / (6 * stdDevOverall);
      const ppu = (usl - mean) / (3 * stdDevOverall);
      const ppl = (mean - lsl) / (3 * stdDevOverall);
      ppk = Math.min(ppu, ppl);
    } else if (usl !== undefined) {
      ppk = (usl - mean) / (3 * stdDevOverall);
    } else if (lsl !== undefined) {
      ppk = (mean - lsl) / (3 * stdDevOverall);
    }
  }

  // 3. Chỉ số Cpm (Taguchi) nếu có giá trị mục tiêu Target
  let cpm: number | null = null;
  if (target !== undefined && usl !== undefined && lsl !== undefined && stdDevOverall > 0) {
    const totalDispersion = Math.sqrt(Math.pow(stdDevOverall, 2) + Math.pow(mean - target, 2));
    if (totalDispersion > 0) {
      cpm = (usl - lsl) / (6 * totalDispersion);
    }
  }

  // Đánh giá năng lực: Cpk >= 1.33 là Đạt chuẩn công nghiệp GMP
  let status: ProcessCapabilityResult['status'] = 'MARGINAL';
  const evalCpk = cpk !== null ? cpk : ppk;
  if (evalCpk !== null) {
    if (evalCpk >= 1.33) status = 'CAPABLE';
    else if (evalCpk >= 1.0) status = 'MARGINAL';
    else status = 'INCAPABLE';
  }

  return {
    mean: Number(mean.toFixed(3)),
    stdDevOverall: Number(stdDevOverall.toFixed(4)),
    stdDevWithin: Number(stdDevWithin.toFixed(4)),
    cp: cp !== null ? Number(cp.toFixed(2)) : null,
    cpk: cpk !== null ? Number(cpk.toFixed(2)) : null,
    pp: pp !== null ? Number(pp.toFixed(2)) : null,
    ppk: ppk !== null ? Number(ppk.toFixed(2)) : null,
    cpm: cpm !== null ? Number(cpm.toFixed(2)) : null,
    status,
  };
}

/**
 * Phát hiện 8 Quy tắc Nelson (Nelson Rules) trong Kiểm soát Thống kê
 */
export function detectNelsonRules(
  values: number[],
  customMean?: number,
  customSigma?: number
): NelsonViolation[] {
  const n = values.length;
  if (n < 3) return [];

  const mean = customMean !== undefined ? customMean : calcMean(values);
  const sigma = customSigma !== undefined ? customSigma : calcStdDev(values, mean);

  if (sigma <= 0) return [];

  const violations: NelsonViolation[] = [];

  // ==========================================
  // Rule 1: 1 điểm nằm ngoài 3 sigma (Outlier)
  // ==========================================
  const r1Indices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (values[i] > mean + 3 * sigma || values[i] < mean - 3 * sigma) {
      r1Indices.push(i);
    }
  }
  if (r1Indices.length > 0) {
    violations.push({
      ruleNumber: 1,
      ruleName: 'Điểm đột biến ngoài giới hạn (Gross Outlier)',
      description: 'Có ít nhất 1 điểm nằm vượt ra ngoài khoảng 3-Sigma kiểm soát.',
      severity: 'CRITICAL',
      violationIndices: r1Indices,
    });
  }

  // ==========================================
  // Rule 2: 9 điểm liên tiếp cùng 1 phía đường trung bình (Mean Shift)
  // ==========================================
  const r2Set = new Set<number>();
  let aboveCount = 0;
  let belowCount = 0;

  for (let i = 0; i < n; i++) {
    if (values[i] > mean) {
      aboveCount++;
      belowCount = 0;
    } else if (values[i] < mean) {
      belowCount++;
      aboveCount = 0;
    } else {
      aboveCount = 0;
      belowCount = 0;
    }

    if (aboveCount >= 9 || belowCount >= 9) {
      for (let j = i - 8; j <= i; j++) {
        r2Set.add(j);
      }
    }
  }
  if (r2Set.size > 0) {
    violations.push({
      ruleNumber: 2,
      ruleName: 'Dịch chuyển tâm quy trình (Mean Shift)',
      description: '9 điểm liên tiếp cùng nằm về một phía so với đường trung bình.',
      severity: 'CRITICAL',
      violationIndices: Array.from(r2Set),
    });
  }

  // ==========================================
  // Rule 3: 6 điểm liên tiếp tăng hoặc giảm đều (Trend)
  // ==========================================
  const r3Set = new Set<number>();
  let incCount = 1;
  let decCount = 1;

  for (let i = 1; i < n; i++) {
    if (values[i] > values[i - 1]) {
      incCount++;
      decCount = 1;
    } else if (values[i] < values[i - 1]) {
      decCount++;
      incCount = 1;
    } else {
      incCount = 1;
      decCount = 1;
    }

    if (incCount >= 6 || decCount >= 6) {
      for (let j = i - 5; j <= i; j++) {
        r3Set.add(j);
      }
    }
  }
  if (r3Set.size > 0) {
    violations.push({
      ruleNumber: 3,
      ruleName: 'Xu hướng trôi liên tục (Continuous Drift / Trend)',
      description: '6 điểm liên tiếp tăng dần đều hoặc giảm dần đều.',
      severity: 'WARNING',
      violationIndices: Array.from(r3Set),
    });
  }

  // ==========================================
  // Rule 4: 14 điểm liên tiếp đan xen lên xuống (Oscillation)
  // ==========================================
  const r4Set = new Set<number>();
  let oscCount = 1;

  for (let i = 2; i < n; i++) {
    const diff1 = values[i - 1] - values[i - 2];
    const diff2 = values[i] - values[i - 1];

    if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
      oscCount++;
    } else {
      oscCount = 1;
    }

    if (oscCount >= 13) {
      // 13 lần đảo chiều = 14 điểm liên tiếp
      for (let j = i - 13; j <= i; j++) {
        r4Set.add(j);
      }
    }
  }
  if (r4Set.size > 0) {
    violations.push({
      ruleNumber: 4,
      ruleName: 'Dao động nhân tạo có chu kỳ (Systematic Oscillation)',
      description: '14 điểm liên tiếp đan xen lên xuống liên tục (nghi ngờ can thiệp thủ công).',
      severity: 'WARNING',
      violationIndices: Array.from(r4Set),
    });
  }

  // ==========================================
  // Rule 5: 2 trong 3 điểm liên tiếp ngoài 2 sigma cùng 1 phía
  // ==========================================
  const r5Set = new Set<number>();
  for (let i = 2; i < n; i++) {
    let above2Sig = 0;
    let below2Sig = 0;
    for (let k = i - 2; k <= i; k++) {
      if (values[k] > mean + 2 * sigma) above2Sig++;
      else if (values[k] < mean - 2 * sigma) below2Sig++;
    }

    if (above2Sig >= 2 || below2Sig >= 2) {
      for (let j = i - 2; j <= i; j++) {
        r5Set.add(j);
      }
    }
  }
  if (r5Set.size > 0) {
    violations.push({
      ruleNumber: 5,
      ruleName: 'Cảnh báo Vùng A (Zone A Warning)',
      description: '2 trong 3 điểm liên tiếp nằm ngoài vùng 2-Sigma cùng một phía.',
      severity: 'WARNING',
      violationIndices: Array.from(r5Set),
    });
  }

  // ==========================================
  // Rule 6: 4 trong 5 điểm liên tiếp ngoài 1 sigma cùng 1 phía
  // ==========================================
  const r6Set = new Set<number>();
  for (let i = 4; i < n; i++) {
    let above1Sig = 0;
    let below1Sig = 0;
    for (let k = i - 4; k <= i; k++) {
      if (values[k] > mean + sigma) above1Sig++;
      else if (values[k] < mean - sigma) below1Sig++;
    }

    if (above1Sig >= 4 || below1Sig >= 4) {
      for (let j = i - 4; j <= i; j++) {
        r6Set.add(j);
      }
    }
  }
  if (r6Set.size > 0) {
    violations.push({
      ruleNumber: 6,
      ruleName: 'Cảnh báo Vùng B (Zone B Warning)',
      description: '4 trong 5 điểm liên tiếp nằm ngoài vùng 1-Sigma cùng một phía.',
      severity: 'INFO',
      violationIndices: Array.from(r6Set),
    });
  }

  // ==========================================
  // Rule 7: 15 điểm liên tiếp nằm trong vùng 1 sigma (Stratification / Hugging)
  // ==========================================
  const r7Set = new Set<number>();
  let hugCount = 0;

  for (let i = 0; i < n; i++) {
    if (values[i] >= mean - sigma && values[i] <= mean + sigma) {
      hugCount++;
    } else {
      hugCount = 0;
    }

    if (hugCount >= 15) {
      for (let j = i - 14; j <= i; j++) {
        r7Set.add(j);
      }
    }
  }
  if (r7Set.size > 0) {
    violations.push({
      ruleNumber: 7,
      ruleName: 'Thiếu biến thiên ngẫu nhiên (Stratification / Hugging Center)',
      description:
        '15 điểm liên tiếp nằm trọn trong vùng 1-Sigma (nghi ngờ dữ liệu làm tròn hoặc báo cáo giả lập).',
      severity: 'WARNING',
      violationIndices: Array.from(r7Set),
    });
  }

  // ==========================================
  // Rule 8: 8 điểm liên tiếp ngoài vùng 1 sigma ở cả 2 phía (Bimodal Mixture)
  // ==========================================
  const r8Set = new Set<number>();
  let mixCount = 0;

  for (let i = 0; i < n; i++) {
    if (values[i] > mean + sigma || values[i] < mean - sigma) {
      mixCount++;
    } else {
      mixCount = 0;
    }

    if (mixCount >= 8) {
      for (let j = i - 7; j <= i; j++) {
        r8Set.add(j);
      }
    }
  }
  if (r8Set.size > 0) {
    violations.push({
      ruleNumber: 8,
      ruleName: 'Hỗn hợp hai phân bố (Bimodal Mixture / Out of Zone C)',
      description:
        '8 điểm liên tiếp nằm ngoài vùng 1-Sigma ở cả hai phía (hỗn hợp hai nguồn nguyên liệu/máy khác nhau).',
      severity: 'CRITICAL',
      violationIndices: Array.from(r8Set),
    });
  }

  return violations;
}

export function calculateSPCParameters(values: number[]): SPCParameters {
  const mean = calcMean(values);
  const stdDevOverall = calcStdDev(values, mean);
  const stdDevWithin = calcWithinStdDev(values);
  const sigma = stdDevWithin > 0 ? stdDevWithin : stdDevOverall;

  return {
    mean: Number(mean.toFixed(3)),
    stdDevOverall: Number(stdDevOverall.toFixed(4)),
    stdDevWithin: Number(stdDevWithin.toFixed(4)),
    ucl: Number((mean + 3 * sigma).toFixed(3)),
    lcl: Number(Math.max(0, mean - 3 * sigma).toFixed(3)),
    sigma1Upper: Number((mean + sigma).toFixed(3)),
    sigma1Lower: Number(Math.max(0, mean - sigma).toFixed(3)),
    sigma2Upper: Number((mean + 2 * sigma).toFixed(3)),
    sigma2Lower: Number(Math.max(0, mean - 2 * sigma).toFixed(3)),
  };
}

export interface SPCResult {
  parameters: SPCParameters;
  capability: ProcessCapabilityResult;
  nelsonViolations: NelsonViolation[];
}

export function runComprehensiveSPC(
  values: number[],
  usl?: number,
  lsl?: number,
  target?: number
): SPCResult {
  const parameters = calculateSPCParameters(values);
  const capability = calcProcessCapability(values, usl, lsl, target);
  const sigma = parameters.stdDevWithin > 0 ? parameters.stdDevWithin : parameters.stdDevOverall;
  const nelsonViolations = detectNelsonRules(values, parameters.mean, sigma);
  return { parameters, capability, nelsonViolations };
}

export interface SPCBatchRecord {
  batchNo?: string;
  mfgDate?: string;
  value: number;
  labId?: string;
  labName?: string;
}

export interface SPCAggregationSummary {
  sampleSize: number;
  parameters: SPCParameters;
  capability: ProcessCapabilityResult;
  violationsCount: number;
  violations: NelsonViolation[];
  trendSlope: number; // Điểm hồi quy phát hiện trôi xu hướng (drift slope)
  oosCount: number;
  oosRatePercent: number;
  executionDurationMs: number;
}

/**
 * aggregateBatchSPC (Phase 6)
 * Tổng hợp toàn diện các chỉ số năng lực quy trình thống kê (SPC & Cpk/Ppk)
 * trong một lần quét duy nhất, tối ưu hiệu năng cho tập dữ liệu lớn.
 */
export function aggregateBatchSPC(
  records: (SPCBatchRecord | number)[],
  options?: { usl?: number; lsl?: number; target?: number }
): SPCAggregationSummary {
  const startTime = performance.now();
  const values: number[] = [];

  for (let i = 0; i < records.length; i++) {
    const item = records[i];
    const val = typeof item === 'number' ? item : item.value;
    if (typeof val === 'number' && !isNaN(val)) {
      values.push(val);
    }
  }

  const n = values.length;
  const usl = options?.usl;
  const lsl = options?.lsl;
  const target = options?.target;

  let oosCount = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (usl !== undefined && v > usl) oosCount++;
    else if (lsl !== undefined && v < lsl) oosCount++;
  }

  const spc = runComprehensiveSPC(values, usl, lsl, target);

  let trendSlope = 0;
  if (n >= 2) {
    const meanX = (n - 1) / 2;
    const meanY = spc.parameters.mean;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      const dx = i - meanX;
      const dy = values[i] - meanY;
      numerator += dx * dy;
      denominator += dx * dx;
    }
    trendSlope = denominator !== 0 ? Number((numerator / denominator).toFixed(5)) : 0;
  }

  return {
    sampleSize: n,
    parameters: spc.parameters,
    capability: spc.capability,
    violationsCount: spc.nelsonViolations.length,
    violations: spc.nelsonViolations,
    trendSlope,
    oosCount,
    oosRatePercent: n > 0 ? Number(((oosCount / n) * 100).toFixed(2)) : 0,
    executionDurationMs: performance.now() - startTime,
  };
}

export interface LabSPCGroupSummary {
  labKey: string;
  labId?: string;
  canonicalLabName: string;
  records: SPCBatchRecord[];
  summary: SPCAggregationSummary;
}

/**
 * Gom nhóm các bản ghi SPC theo Đơn vị kiểm nghiệm (ưu tiên labId, tự động đối chiếu canonicalName).
 * Giúp biểu đồ phân tích xu hướng (Trend/SPC) gom dữ liệu của cùng 1 phòng lab
 * kể cả khi có sai khác nhỏ về chuỗi tên nhập tay.
 */
export function groupRecordsByLabSPC(
  records: SPCBatchRecord[],
  options?: {
    usl?: number;
    lsl?: number;
    target?: number;
    laboratories?: TestingLaboratory[];
  }
): Record<string, LabSPCGroupSummary> {
  const groups: Record<
    string,
    { labId?: string; canonicalLabName: string; records: SPCBatchRecord[] }
  > = {};

  for (const record of records) {
    const rawKey = record.labId || record.labName || 'UNKNOWN';
    const resolved = resolveCanonicalLab(rawKey, options?.laboratories);
    const groupKey =
      resolved.labId || (resolved.labName ? resolved.labName.toLowerCase() : 'unknown_lab');

    if (!groups[groupKey]) {
      groups[groupKey] = {
        labId: resolved.labId || undefined,
        canonicalLabName: resolved.labName || 'Không xác định',
        records: [],
      };
    }
    groups[groupKey].records.push(record);
  }

  const result: Record<string, LabSPCGroupSummary> = {};
  for (const [groupKey, group] of Object.entries(groups)) {
    result[groupKey] = {
      labKey: groupKey,
      labId: group.labId,
      canonicalLabName: group.canonicalLabName,
      records: group.records,
      summary: aggregateBatchSPC(group.records, options),
    };
  }

  return result;
}
