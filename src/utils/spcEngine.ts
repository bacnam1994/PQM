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

export interface SPCParameters {
  mean: number;
  stdDevOverall: number;
  stdDevWithin: number;
  ucl: number;        // Upper Control Limit (+3 sigma)
  lcl: number;        // Lower Control Limit (-3 sigma)
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
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length === 0) return 0;
  return valid.reduce((acc, val) => acc + val, 0) / valid.length;
}

/**
 * Tính độ lệch chuẩn tổng thể (Sample Standard Deviation - n-1)
 */
export function calcStdDev(values: number[], mean?: number): number {
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length < 2) return 0;
  const m = mean !== undefined ? mean : calcMean(valid);
  const variance = valid.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

/**
 * Tính độ lệch chuẩn nội nhóm dựa trên Average Moving Range (d2 = 1.128 cho nhóm n=2)
 */
export function calcWithinStdDev(values: number[]): number {
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
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
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
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
      status: 'MARGINAL'
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
    status
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
      violationIndices: r1Indices
    });
  }

  // ==========================================
  // Rule 2: 9 điểm liên tiếp cùng 1 phía đường trung bình (Mean Shift)
  // ==========================================
  const r2Indices: number[] = [];
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
        if (!r2Indices.includes(j)) r2Indices.push(j);
      }
    }
  }
  if (r2Indices.length > 0) {
    violations.push({
      ruleNumber: 2,
      ruleName: 'Dịch chuyển tâm quy trình (Mean Shift)',
      description: '9 điểm liên tiếp cùng nằm về một phía so với đường trung bình.',
      severity: 'CRITICAL',
      violationIndices: r2Indices
    });
  }

  // ==========================================
  // Rule 3: 6 điểm liên tiếp tăng hoặc giảm đều (Trend)
  // ==========================================
  const r3Indices: number[] = [];
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
        if (!r3Indices.includes(j)) r3Indices.push(j);
      }
    }
  }
  if (r3Indices.length > 0) {
    violations.push({
      ruleNumber: 3,
      ruleName: 'Xu hướng trôi liên tục (Continuous Drift / Trend)',
      description: '6 điểm liên tiếp tăng dần đều hoặc giảm dần đều.',
      severity: 'WARNING',
      violationIndices: r3Indices
    });
  }

  // ==========================================
  // Rule 4: 14 điểm liên tiếp đan xen lên xuống (Oscillation)
  // ==========================================
  const r4Indices: number[] = [];
  let oscCount = 1;

  for (let i = 2; i < n; i++) {
    const diff1 = values[i - 1] - values[i - 2];
    const diff2 = values[i] - values[i - 1];

    if ((diff1 > 0 && diff2 < 0) || (diff1 < 0 && diff2 > 0)) {
      oscCount++;
    } else {
      oscCount = 1;
    }

    if (oscCount >= 13) { // 13 lần đảo chiều = 14 điểm liên tiếp
      for (let j = i - 13; j <= i; j++) {
        if (!r4Indices.includes(j)) r4Indices.push(j);
      }
    }
  }
  if (r4Indices.length > 0) {
    violations.push({
      ruleNumber: 4,
      ruleName: 'Dao động nhân tạo có chu kỳ (Systematic Oscillation)',
      description: '14 điểm liên tiếp đan xen lên xuống liên tục (nghi ngờ can thiệp thủ công).',
      severity: 'WARNING',
      violationIndices: r4Indices
    });
  }

  // ==========================================
  // Rule 5: 2 trong 3 điểm liên tiếp ngoài 2 sigma cùng 1 phía
  // ==========================================
  const r5Indices: number[] = [];
  for (let i = 2; i < n; i++) {
    const window = [values[i - 2], values[i - 1], values[i]];
    const above2Sig = window.filter(v => v > mean + 2 * sigma).length;
    const below2Sig = window.filter(v => v < mean - 2 * sigma).length;

    if (above2Sig >= 2 || below2Sig >= 2) {
      for (let j = i - 2; j <= i; j++) {
        if (!r5Indices.includes(j)) r5Indices.push(j);
      }
    }
  }
  if (r5Indices.length > 0) {
    violations.push({
      ruleNumber: 5,
      ruleName: 'Cảnh báo Vùng A (Zone A Warning)',
      description: '2 trong 3 điểm liên tiếp nằm ngoài vùng 2-Sigma cùng một phía.',
      severity: 'WARNING',
      violationIndices: r5Indices
    });
  }

  // ==========================================
  // Rule 6: 4 trong 5 điểm liên tiếp ngoài 1 sigma cùng 1 phía
  // ==========================================
  const r6Indices: number[] = [];
  for (let i = 4; i < n; i++) {
    const window = values.slice(i - 4, i + 1);
    const above1Sig = window.filter(v => v > mean + sigma).length;
    const below1Sig = window.filter(v => v < mean - sigma).length;

    if (above1Sig >= 4 || below1Sig >= 4) {
      for (let j = i - 4; j <= i; j++) {
        if (!r6Indices.includes(j)) r6Indices.push(j);
      }
    }
  }
  if (r6Indices.length > 0) {
    violations.push({
      ruleNumber: 6,
      ruleName: 'Cảnh báo Vùng B (Zone B Warning)',
      description: '4 trong 5 điểm liên tiếp nằm ngoài vùng 1-Sigma cùng một phía.',
      severity: 'INFO',
      violationIndices: r6Indices
    });
  }

  // ==========================================
  // Rule 7: 15 điểm liên tiếp nằm trong vùng 1 sigma (Stratification / Hugging)
  // ==========================================
  const r7Indices: number[] = [];
  let hugCount = 0;

  for (let i = 0; i < n; i++) {
    if (values[i] >= mean - sigma && values[i] <= mean + sigma) {
      hugCount++;
    } else {
      hugCount = 0;
    }

    if (hugCount >= 15) {
      for (let j = i - 14; j <= i; j++) {
        if (!r7Indices.includes(j)) r7Indices.push(j);
      }
    }
  }
  if (r7Indices.length > 0) {
    violations.push({
      ruleNumber: 7,
      ruleName: 'Thiếu biến thiên ngẫu nhiên (Stratification / Hugging Center)',
      description: '15 điểm liên tiếp nằm trọn trong vùng 1-Sigma (nghi ngờ dữ liệu làm tròn hoặc báo cáo giả lập).',
      severity: 'WARNING',
      violationIndices: r7Indices
    });
  }

  // ==========================================
  // Rule 8: 8 điểm liên tiếp ngoài vùng 1 sigma ở cả 2 phía (Bimodal Mixture)
  // ==========================================
  const r8Indices: number[] = [];
  let mixCount = 0;

  for (let i = 0; i < n; i++) {
    if (values[i] > mean + sigma || values[i] < mean - sigma) {
      mixCount++;
    } else {
      mixCount = 0;
    }

    if (mixCount >= 8) {
      for (let j = i - 7; j <= i; j++) {
        if (!r8Indices.includes(j)) r8Indices.push(j);
      }
    }
  }
  if (r8Indices.length > 0) {
    violations.push({
      ruleNumber: 8,
      ruleName: 'Hỗn hợp hai phân bố (Bimodal Mixture / Out of Zone C)',
      description: '8 điểm liên tiếp nằm ngoài vùng 1-Sigma ở cả hai phía (hỗn hợp hai nguồn nguyên liệu/máy khác nhau).',
      severity: 'CRITICAL',
      violationIndices: r8Indices
    });
  }

  return violations;
}
