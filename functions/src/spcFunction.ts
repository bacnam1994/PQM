/**
 * functions/src/spcFunction.ts
 * Cloud Function tính toán SPC & 8 quy tắc Nelson trên Server
 */

export interface SPCParameters {
  mean: number;
  stdDevOverall: number;
  stdDevWithin: number;
  ucl: number;
  lcl: number;
  sigma1Upper: number;
  sigma1Lower: number;
  sigma2Upper: number;
  sigma2Lower: number;
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
  status: 'CAPABLE' | 'MARGINAL' | 'INCAPABLE';
}

export interface NelsonViolation {
  ruleNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  ruleName: string;
  description: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  violationIndices: number[];
}

export interface SPCMetricsRequest {
  values: number[];
  usl?: number;
  lsl?: number;
  target?: number;
}

export interface SPCMetricsResponse {
  parameters: SPCParameters;
  capability: ProcessCapabilityResult;
  nelsonViolations: NelsonViolation[];
  calculatedAt: string;
}

export function calcMean(values: number[]): number {
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length === 0) return 0;
  return valid.reduce((acc, val) => acc + val, 0) / valid.length;
}

export function calcStdDev(values: number[], mean?: number): number {
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length < 2) return 0;
  const m = mean !== undefined ? mean : calcMean(valid);
  const variance = valid.reduce((acc, v) => acc + Math.pow(v - m, 2), 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

export function calcWithinStdDev(values: number[]): number {
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (valid.length < 2) return 0;

  let totalMR = 0;
  for (let i = 1; i < valid.length; i++) {
    totalMR += Math.abs(valid[i] - valid[i - 1]);
  }
  const avgMR = totalMR / (valid.length - 1);
  const d2 = 1.128;
  return avgMR / d2;
}

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

  let cpm: number | null = null;
  if (target !== undefined && usl !== undefined && lsl !== undefined && stdDevOverall > 0) {
    const totalDispersion = Math.sqrt(Math.pow(stdDevOverall, 2) + Math.pow(mean - target, 2));
    if (totalDispersion > 0) {
      cpm = (usl - lsl) / (6 * totalDispersion);
    }
  }

  let status: ProcessCapabilityResult['status'] = 'MARGINAL';
  const evalCpk = cpk !== null ? cpk : ppk;
  if (evalCpk !== null) {
    if (evalCpk >= 1.33) status = 'CAPABLE';
    else if (evalCpk >= 1.0) status = 'MARGINAL';
    else status = 'INCAPABLE';
  }

  return {
    mean,
    stdDevOverall,
    stdDevWithin,
    cp,
    cpk,
    pp,
    ppk,
    cpm,
    status
  };
}

export function calculateSPCParameters(values: number[]): SPCParameters {
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  const mean = calcMean(valid);
  const stdDevOverall = calcStdDev(valid, mean);
  const stdDevWithin = calcWithinStdDev(valid);
  const sigma = stdDevWithin > 0 ? stdDevWithin : stdDevOverall;

  return {
    mean,
    stdDevOverall,
    stdDevWithin,
    ucl: mean + 3 * sigma,
    lcl: Math.max(0, mean - 3 * sigma),
    sigma1Upper: mean + sigma,
    sigma1Lower: Math.max(0, mean - sigma),
    sigma2Upper: mean + 2 * sigma,
    sigma2Lower: Math.max(0, mean - 2 * sigma)
  };
}

export function detectNelsonRules(values: number[], params: SPCParameters): NelsonViolation[] {
  const violations: NelsonViolation[] = [];
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  const n = valid.length;
  if (n < 3) return violations;

  const { mean, ucl, lcl, sigma1Upper, sigma1Lower, sigma2Upper, sigma2Lower } = params;

  // Rule 1: 1 điểm vượt ngoài 3-sigma (UCL / LCL)
  const r1Indices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (valid[i] > ucl || valid[i] < lcl) {
      r1Indices.push(i);
    }
  }
  if (r1Indices.length > 0) {
    violations.push({
      ruleNumber: 1,
      ruleName: 'Quy tắc 1 (Vượt giới hạn 3-sigma)',
      description: `Có ${r1Indices.length} điểm vượt ngoài giới hạn kiểm soát thống kê UCL/LCL. Báo hiệu sự cố đột xuất (Special Cause).`,
      severity: 'CRITICAL',
      violationIndices: r1Indices
    });
  }

  // Rule 2: 9 điểm liên tiếp cùng nằm về một phía của Mean
  const r2Indices: number[] = [];
  let countAbove = 0;
  let countBelow = 0;
  for (let i = 0; i < n; i++) {
    if (valid[i] > mean) {
      countAbove++;
      countBelow = 0;
    } else if (valid[i] < mean) {
      countBelow++;
      countAbove = 0;
    } else {
      countAbove = 0;
      countBelow = 0;
    }
    if (countAbove >= 9) {
      for (let j = i - countAbove + 1; j <= i; j++) {
        if (!r2Indices.includes(j)) r2Indices.push(j);
      }
    }
    if (countBelow >= 9) {
      for (let j = i - countBelow + 1; j <= i; j++) {
        if (!r2Indices.includes(j)) r2Indices.push(j);
      }
    }
  }
  if (r2Indices.length > 0) {
    violations.push({
      ruleNumber: 2,
      ruleName: 'Quy tắc 2 (Dịch chuyển tâm - Shift)',
      description: 'Có từ 9 điểm liên tiếp cùng nằm về một phía so với giá trị trung bình. Dấu hiệu độ lệch tâm quy trình kéo dài.',
      severity: 'WARNING',
      violationIndices: r2Indices
    });
  }

  // Rule 3: 6 điểm liên tiếp tăng dần hoặc giảm dần (Trend)
  const r3Indices: number[] = [];
  let incCount = 1;
  let decCount = 1;
  for (let i = 1; i < n; i++) {
    if (valid[i] > valid[i - 1]) {
      incCount++;
      decCount = 1;
    } else if (valid[i] < valid[i - 1]) {
      decCount++;
      incCount = 1;
    } else {
      incCount = 1;
      decCount = 1;
    }
    if (incCount >= 6) {
      for (let j = i - incCount + 1; j <= i; j++) {
        if (!r3Indices.includes(j)) r3Indices.push(j);
      }
    }
    if (decCount >= 6) {
      for (let j = i - decCount + 1; j <= i; j++) {
        if (!r3Indices.includes(j)) r3Indices.push(j);
      }
    }
  }
  if (r3Indices.length > 0) {
    violations.push({
      ruleNumber: 3,
      ruleName: 'Quy tắc 3 (Xu hướng trôi dạt - Trend)',
      description: 'Có từ 6 điểm liên tiếp tăng dần hoặc giảm dần liên tục. Thường do hao mòn thiết bị hoặc suy giảm hoạt lực nguyên liệu.',
      severity: 'WARNING',
      violationIndices: r3Indices
    });
  }

  // Rule 4: 14 điểm liên tiếp đan xen xen kẽ lên xuống
  const r4Indices: number[] = [];
  if (n >= 14) {
    let altCount = 1;
    for (let i = 2; i < n; i++) {
      const prevDiff = valid[i - 1] - valid[i - 2];
      const currDiff = valid[i] - valid[i - 1];
      if ((prevDiff > 0 && currDiff < 0) || (prevDiff < 0 && currDiff > 0)) {
        altCount++;
      } else {
        altCount = 1;
      }
      if (altCount >= 13) {
        for (let j = i - altCount; j <= i; j++) {
          if (!r4Indices.includes(j)) r4Indices.push(j);
        }
      }
    }
  }
  if (r4Indices.length > 0) {
    violations.push({
      ruleNumber: 4,
      ruleName: 'Quy tắc 4 (Dao động xen kẽ - Alternating)',
      description: 'Có 14 điểm liên tục biến thiên đan xen lên xuống. Dấu hiệu trộn lẫn giữa 2 ca kíp hoặc 2 nguồn nguyên liệu khác nhau.',
      severity: 'INFO',
      violationIndices: r4Indices
    });
  }

  // Rule 5: 2 trong 3 điểm liên tiếp nằm ngoài 2-sigma cùng một phía
  const r5Indices: number[] = [];
  for (let i = 2; i < n; i++) {
    const windowVals = [valid[i - 2], valid[i - 1], valid[i]];
    const above2s = windowVals.filter(v => v > sigma2Upper).length;
    const below2s = windowVals.filter(v => v < sigma2Lower).length;
    if (above2s >= 2 || below2s >= 2) {
      if (!r5Indices.includes(i - 2)) r5Indices.push(i - 2);
      if (!r5Indices.includes(i - 1)) r5Indices.push(i - 1);
      if (!r5Indices.includes(i)) r5Indices.push(i);
    }
  }
  if (r5Indices.length > 0) {
    violations.push({
      ruleNumber: 5,
      ruleName: 'Quy tắc 5 (Vùng 2-sigma)',
      description: 'Có 2 trong 3 điểm liên tiếp nằm ở vùng cảnh báo ngoài 2-sigma cùng phía.',
      severity: 'WARNING',
      violationIndices: r5Indices
    });
  }

  // Rule 6: 4 trong 5 điểm liên tiếp nằm ngoài 1-sigma cùng một phía
  const r6Indices: number[] = [];
  for (let i = 4; i < n; i++) {
    const windowVals = valid.slice(i - 4, i + 1);
    const above1s = windowVals.filter(v => v > sigma1Upper).length;
    const below1s = windowVals.filter(v => v < sigma1Lower).length;
    if (above1s >= 4 || below1s >= 4) {
      for (let j = i - 4; j <= i; j++) {
        if (!r6Indices.includes(j)) r6Indices.push(j);
      }
    }
  }
  if (r6Indices.length > 0) {
    violations.push({
      ruleNumber: 6,
      ruleName: 'Quy tắc 6 (Vùng 1-sigma)',
      description: 'Có 4 trong 5 điểm liên tiếp nằm ngoài 1-sigma cùng một phía so với trung bình.',
      severity: 'WARNING',
      violationIndices: r6Indices
    });
  }

  // Rule 7: 15 điểm liên tiếp nằm trong dải hẹp 1-sigma (Stratification)
  const r7Indices: number[] = [];
  if (n >= 15) {
    let stratCount = 0;
    for (let i = 0; i < n; i++) {
      if (valid[i] >= sigma1Lower && valid[i] <= sigma1Upper) {
        stratCount++;
      } else {
        stratCount = 0;
      }
      if (stratCount >= 15) {
        for (let j = i - stratCount + 1; j <= i; j++) {
          if (!r7Indices.includes(j)) r7Indices.push(j);
        }
      }
    }
  }
  if (r7Indices.length > 0) {
    violations.push({
      ruleNumber: 7,
      ruleName: 'Quy tắc 7 (Phân tầng giả tạo - Stratification)',
      description: 'Có 15 điểm liên tiếp nằm quá sát tâm (trong dải ±1 sigma). Nghi ngờ dữ liệu bị làm đẹp hoặc phương sai bị co cụm.',
      severity: 'INFO',
      violationIndices: r7Indices
    });
  }

  // Rule 8: 8 điểm liên tiếp nằm ngoài 1-sigma ở cả hai phía (Không có điểm nào nằm trong dải ±1 sigma)
  const r8Indices: number[] = [];
  if (n >= 8) {
    let mixCount = 0;
    for (let i = 0; i < n; i++) {
      if (valid[i] > sigma1Upper || valid[i] < sigma1Lower) {
        mixCount++;
      } else {
        mixCount = 0;
      }
      if (mixCount >= 8) {
        for (let j = i - mixCount + 1; j <= i; j++) {
          if (!r8Indices.includes(j)) r8Indices.push(j);
        }
      }
    }
  }
  if (r8Indices.length > 0) {
    violations.push({
      ruleNumber: 8,
      ruleName: 'Quy tắc 8 (Hỗn hợp phân cực - Mixture)',
      description: 'Có 8 điểm liên tiếp nằm ngoài dải ±1 sigma mà không có điểm nào rơi vào tâm. Hiện tượng phân tách đa phương sai.',
      severity: 'WARNING',
      violationIndices: r8Indices
    });
  }

  return violations;
}

export function executeSPCCalculation(req: SPCMetricsRequest): SPCMetricsResponse {
  const values = req.values || [];
  const params = calculateSPCParameters(values);
  const capability = calcProcessCapability(values, req.usl, req.lsl, req.target);
  const nelsonViolations = detectNelsonRules(values, params);

  return {
    parameters: params,
    capability,
    nelsonViolations,
    calculatedAt: new Date().toISOString()
  };
}
