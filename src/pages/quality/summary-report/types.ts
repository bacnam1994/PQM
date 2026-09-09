export interface FailCriteriaSummaryItem {
  name: string;
  unit: string;
  total: number;
  failCount: number;
  failRate: number;
  avgFailValue: number | null;
  limitText: string;
}

export interface CriteriaStat {
  mean: number;
  stdDev: number;
  cv: number;
  cpk: number | null;
  cpkType: 'Cpk' | 'Cpu' | 'Cpl' | null;
  ucl: number;
  lcl: number;
  min: number;
  max: number;
  values: number[];
  batchNos: string[];
  failBatches: { batchNo: string; value: number; limit: string }[];
}

export interface ReportCriteriaResult {
  value: string;
  numericValue: number | null;
  percent: number | null;
  unit: string;
  isPass: boolean | null;
  entryLimit?: string;
}

export interface ReportDataRow {
  batchId: string;
  batchNo: string;
  mfgDate?: string;
  expDate?: string;
  overallStatus: 'PASS' | 'FAIL' | 'PENDING';
  criteriaResults: Record<string, ReportCriteriaResult>;
}
