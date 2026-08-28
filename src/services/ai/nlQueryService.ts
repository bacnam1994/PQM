/**
 * nlQueryService.ts
 * =================
 * AI Natural Language Query Engine cho PQM.
 * Cho phép người dùng hỏi bằng tiếng Việt tự nhiên về dữ liệu hệ thống.
 * 
 * Hỗ trợ các loại truy vấn:
 * - Lọc lô: "lô nào có độ ẩm > 3%?"
 * - Thống kê: "sản phẩm nào có tỷ lệ lỗi cao nhất?"
 * - Hết hạn: "bao nhiêu lô hết hạn trong 60 ngày?"
 * - So sánh: "so sánh hàm lượng lô X vs Y"
 * - Lịch sử: "phiếu kiểm nghiệm tháng 7 của sản phẩm ABC"
 */

export type NLQueryResultType =
  | 'TABLE'           // Bảng danh sách kết quả
  | 'STATS'           // Số liệu thống kê tổng hợp
  | 'COMPARISON'      // So sánh 2 thực thể
  | 'TIMELINE'        // Danh sách theo thời gian
  | 'ALERT_LIST'      // Danh sách cảnh báo
  | 'EMPTY';          // Không có kết quả

export interface NLQueryColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'badge' | 'percent';
  badgeConfig?: Record<string, { color: string; label: string }>;
}

export interface NLQueryTableResult {
  type: 'TABLE';
  title: string;
  subtitle?: string;
  columns: NLQueryColumn[];
  rows: Record<string, any>[];
  totalCount: number;
  summary?: string;
}

export interface NLQueryStatsResult {
  type: 'STATS';
  title: string;
  items: {
    label: string;
    value: string | number;
    unit?: string;
    trend?: 'UP' | 'DOWN' | 'STABLE';
    highlight?: boolean;
  }[];
  summary?: string;
}

export interface NLQueryComparisonResult {
  type: 'COMPARISON';
  title: string;
  entityA: { label: string; value: string };
  entityB: { label: string; value: string };
  rows: {
    criteria: string;
    valueA: string | number;
    valueB: string | number;
    delta?: string;
    winner?: 'A' | 'B' | 'TIE';
  }[];
  summary?: string;
}

export interface NLQueryEmptyResult {
  type: 'EMPTY';
  message: string;
}

export type NLQueryResult =
  | NLQueryTableResult
  | NLQueryStatsResult
  | NLQueryComparisonResult
  | NLQueryEmptyResult;

// ─────────────────────────────────────────────
// PHÂN TÍCH Ý ĐỊNH (Intent Detection)
// ─────────────────────────────────────────────

type QueryIntent =
  | 'BATCH_FILTER'
  | 'PRODUCT_STATS'
  | 'EXPIRY_CHECK'
  | 'FAIL_RATE'
  | 'TEST_RESULT_SEARCH'
  | 'COMPARISON'
  | 'CRITERIA_TREND'
  | 'LAB_PERFORMANCE'
  | 'UNKNOWN';

interface ParsedIntent {
  intent: QueryIntent;
  entities: {
    productName?: string;
    productCode?: string;
    criteriaName?: string;
    labName?: string;
    batchNo?: string;
    batchNoA?: string;
    batchNoB?: string;
    status?: string;
    daysAhead?: number;
    monthStr?: string;  // "tháng 7", "tháng 07/2026"
    yearStr?: string;
    quarterStr?: string;
    percentThreshold?: number; // "độ ẩm > 3%"
    operator?: '>' | '<' | '>=' | '<=' | '=';
    minValue?: number;
    maxValue?: number;
  };
  keywords: string[];
}

const MONTH_WORDS = ['tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6','tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12'];
const QUARTER_WORDS = ['quý 1','quý 2','quý 3','quý 4','q1','q2','q3','q4'];

const detectIntent = (query: string): ParsedIntent => {
  const q = query.toLowerCase().trim();
  const entities: ParsedIntent['entities'] = {};
  const keywords: string[] = [];

  // Trích xuất tháng
  const monthMatch = q.match(/tháng\s*(\d{1,2})(?:\s*[/\-]\s*(\d{4}))?/);
  if (monthMatch) {
    entities.monthStr = `tháng ${monthMatch[1]}`;
    if (monthMatch[2]) entities.yearStr = monthMatch[2];
    keywords.push('month_filter');
  }

  // Trích xuất quý
  const quarterMatch = q.match(/quý\s*(\d)|q([1-4])/i);
  if (quarterMatch) {
    entities.quarterStr = quarterMatch[1] || quarterMatch[2];
    keywords.push('quarter_filter');
  }

  // Trích xuất năm
  const yearMatch = q.match(/năm\s*(\d{4})|(\d{4})\s*năm/);
  if (yearMatch && !entities.yearStr) {
    entities.yearStr = yearMatch[1] || yearMatch[2];
  }

  // Trích xuất số ngày (60 ngày, 30 ngày)
  const daysMatch = q.match(/(\d+)\s*ngày/);
  if (daysMatch) {
    entities.daysAhead = parseInt(daysMatch[1]);
    keywords.push('days_filter');
  }

  // Trích xuất ngưỡng % hoặc số (> 3%, < 5%, >= 90)
  const thresholdMatch = q.match(/([><]=?)\s*(\d+(?:[.,]\d+)?)\s*(%)?/);
  if (thresholdMatch) {
    entities.operator = thresholdMatch[1] as any;
    entities.minValue = parseFloat(thresholdMatch[2].replace(',', '.'));
    keywords.push('threshold_filter');
  }

  // Trích xuất so sánh 2 lô (lô A vs lô B, lô A và lô B)
  const compareMatch = q.match(/lô\s+([A-Z0-9\-]+)\s+(?:vs|và|với|so)\s+(?:lô\s+)?([A-Z0-9\-]+)/i);
  if (compareMatch) {
    entities.batchNoA = compareMatch[1].toUpperCase();
    entities.batchNoB = compareMatch[2].toUpperCase();
    keywords.push('comparison');
    return { intent: 'COMPARISON', entities, keywords };
  }

  // Detect intent chính
  if (q.includes('hết hạn') || q.includes('sắp hết') || q.includes('expire')) {
    return { intent: 'EXPIRY_CHECK', entities, keywords: [...keywords, 'expiry'] };
  }

  if ((q.includes('tỷ lệ lỗi') || q.includes('không đạt') || q.includes('fail')) && 
      (q.includes('cao nhất') || q.includes('nhiều nhất') || q.includes('top'))) {
    return { intent: 'FAIL_RATE', entities, keywords: [...keywords, 'fail_rate'] };
  }

  if (q.includes('phòng lab') || q.includes('phòng kiểm') || q.includes('quatest') || q.includes('eurofins') || q.includes('lab')) {
    return { intent: 'LAB_PERFORMANCE', entities, keywords: [...keywords, 'lab'] };
  }

  if (q.includes('phiếu kiểm') || q.includes('kết quả kiểm') || q.includes('test result')) {
    return { intent: 'TEST_RESULT_SEARCH', entities, keywords: [...keywords, 'test_result'] };
  }

  if (q.includes('sản phẩm') || q.includes('lô') || q.includes('batch')) {
    if (q.includes('xu hướng') || q.includes('biểu đồ') || q.includes('spc') || q.includes('drift')) {
      return { intent: 'CRITERIA_TREND', entities, keywords: [...keywords, 'trend'] };
    }
    if (keywords.includes('threshold_filter') || q.includes('lọc') || q.includes('tìm')) {
      return { intent: 'BATCH_FILTER', entities, keywords };
    }
    return { intent: 'PRODUCT_STATS', entities, keywords: [...keywords, 'product'] };
  }

  return { intent: 'UNKNOWN', entities, keywords };
};

// ─────────────────────────────────────────────
// ENGINE THỰC THI QUERY
// ─────────────────────────────────────────────

export interface NLQueryContext {
  products: any[];
  batches: any[];
  testResults: any[];
  tccsList: any[];
  productFormulas: any[];
}

const fmt = (d: string) => {
  if (!d) return '---';
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN');
  } catch { return d; }
};

const daysBetween = (d1: Date, d2: Date) => Math.round((d2.getTime() - d1.getTime()) / 86400000);

/**
 * Thực thi Natural Language Query trên dữ liệu hệ thống.
 * Đây là hàm pure (không gọi API AI) — thực hiện client-side query.
 */
export const executeNLQuery = (query: string, ctx: NLQueryContext): NLQueryResult => {
  const { intent, entities } = detectIntent(query);
  const now = new Date();

  // ── EXPIRY_CHECK ────────────────────────────────────────
  if (intent === 'EXPIRY_CHECK') {
    const days = entities.daysAhead ?? 30;
    const cutoff = new Date(now.getTime() + days * 86400000);
    
    const expiring = ctx.batches
      .filter(b => {
        if (!b.expDate) return false;
        const exp = new Date(b.expDate);
        return exp >= now && exp <= cutoff;
      })
      .sort((a, b) => new Date(a.expDate).getTime() - new Date(b.expDate).getTime())
      .map(b => {
        const product = ctx.products.find(p => p.id === b.productId);
        const daysLeft = daysBetween(now, new Date(b.expDate));
        return {
          batchNo: b.batchNo,
          product: product?.name || b.productId,
          mfgDate: fmt(b.mfgDate),
          expDate: fmt(b.expDate),
          daysLeft: `${daysLeft} ngày`,
          status: b.status,
        };
      });

    if (expiring.length === 0) {
      return { type: 'EMPTY', message: `✅ Không có lô nào hết hạn trong ${days} ngày tới.` };
    }

    return {
      type: 'TABLE',
      title: `⏰ Lô sắp hết hạn trong ${days} ngày tới`,
      subtitle: `Tìm thấy ${expiring.length} lô`,
      columns: [
        { key: 'batchNo', label: 'Số lô', type: 'text' },
        { key: 'product', label: 'Sản phẩm', type: 'text' },
        { key: 'mfgDate', label: 'NSX', type: 'date' },
        { key: 'expDate', label: 'HSD', type: 'date' },
        { key: 'daysLeft', label: 'Còn lại', type: 'text' },
        { key: 'status', label: 'Trạng thái', type: 'badge', badgeConfig: {
          RELEASED: { color: 'green', label: 'Đã xuất' },
          TESTING: { color: 'yellow', label: 'Đang KN' },
          PENDING: { color: 'gray', label: 'Chờ' },
          REJECTED: { color: 'red', label: 'Bị từ chối' },
        }},
      ],
      rows: expiring,
      totalCount: expiring.length,
      summary: `📌 ${expiring.filter(e => parseInt(e.daysLeft) <= 7).length} lô hết hạn trong 7 ngày tới cần ưu tiên xử lý.`,
    };
  }

  // ── FAIL_RATE ────────────────────────────────────────
  if (intent === 'FAIL_RATE') {
    const statsMap = new Map<string, { productId: string; name: string; total: number; fail: number }>();
    ctx.products.forEach(p => statsMap.set(p.id, { productId: p.id, name: p.name, total: 0, fail: 0 }));
    
    ctx.testResults.forEach(r => {
      const batch = ctx.batches.find(b => b.id === r.batchId);
      if (!batch) return;
      const entry = statsMap.get(batch.productId);
      if (!entry) return;
      entry.total++;
      if (r.overallStatus === 'FAIL') entry.fail++;
    });

    const ranked = Array.from(statsMap.values())
      .filter(e => e.total > 0)
      .map(e => ({
        product: e.name,
        total: e.total,
        fail: e.fail,
        pass: e.total - e.fail,
        failRate: `${((e.fail / e.total) * 100).toFixed(1)}%`,
        failRateNum: (e.fail / e.total) * 100,
      }))
      .sort((a, b) => b.failRateNum - a.failRateNum)
      .slice(0, 10);

    if (ranked.length === 0) {
      return { type: 'EMPTY', message: 'Chưa có đủ dữ liệu kiểm nghiệm để thống kê tỷ lệ lỗi.' };
    }

    return {
      type: 'TABLE',
      title: '📊 Sản phẩm có tỷ lệ lỗi cao nhất',
      subtitle: 'Top 10 sản phẩm theo tỷ lệ phiếu FAIL / Tổng phiếu',
      columns: [
        { key: 'product', label: 'Sản phẩm', type: 'text' },
        { key: 'total', label: 'Tổng phiếu', type: 'number' },
        { key: 'pass', label: 'Đạt', type: 'number' },
        { key: 'fail', label: 'Không đạt', type: 'number' },
        { key: 'failRate', label: 'Tỷ lệ lỗi', type: 'percent' },
      ],
      rows: ranked,
      totalCount: ranked.length,
      summary: `🔴 Sản phẩm "${ranked[0]?.product}" có tỷ lệ lỗi cao nhất: ${ranked[0]?.failRate}`,
    };
  }

  // ── TEST_RESULT_SEARCH ────────────────────────────────────────
  if (intent === 'TEST_RESULT_SEARCH') {
    let filtered = [...ctx.testResults];

    // Lọc theo tháng
    if (entities.monthStr) {
      const month = parseInt(entities.monthStr.replace('tháng ', ''));
      const year = entities.yearStr ? parseInt(entities.yearStr) : now.getFullYear();
      filtered = filtered.filter(r => {
        if (!r.testDate) return false;
        const d = new Date(r.testDate);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
    }

    // Lọc theo quý
    if (entities.quarterStr) {
      const q = parseInt(entities.quarterStr);
      const qMonths: Record<number, number[]> = { 1: [1,2,3], 2: [4,5,6], 3: [7,8,9], 4: [10,11,12] };
      const year = entities.yearStr ? parseInt(entities.yearStr) : now.getFullYear();
      filtered = filtered.filter(r => {
        if (!r.testDate) return false;
        const d = new Date(r.testDate);
        return d.getFullYear() === year && qMonths[q]?.includes(d.getMonth() + 1);
      });
    }

    const rows = filtered
      .sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''))
      .slice(0, 50)
      .map(r => {
        const batch = ctx.batches.find(b => b.id === r.batchId);
        const product = batch ? ctx.products.find(p => p.id === batch.productId) : null;
        return {
          testDate: fmt(r.testDate),
          batchNo: batch?.batchNo || r.batchId,
          product: product?.name || '---',
          labName: r.labName || '---',
          status: r.overallStatus,
          criteriaCount: (r.results || []).length,
        };
      });

    if (rows.length === 0) {
      return { type: 'EMPTY', message: 'Không tìm thấy phiếu kiểm nghiệm phù hợp với điều kiện lọc.' };
    }

    return {
      type: 'TABLE',
      title: '🔬 Danh sách phiếu kiểm nghiệm',
      subtitle: `Hiển thị ${rows.length} phiếu${entities.monthStr ? ` — ${entities.monthStr}` : ''}${entities.quarterStr ? ` — Quý ${entities.quarterStr}` : ''}`,
      columns: [
        { key: 'testDate', label: 'Ngày KN', type: 'date' },
        { key: 'batchNo', label: 'Số lô', type: 'text' },
        { key: 'product', label: 'Sản phẩm', type: 'text' },
        { key: 'labName', label: 'Đơn vị KN', type: 'text' },
        { key: 'status', label: 'Kết quả', type: 'badge', badgeConfig: {
          PASS: { color: 'green', label: 'ĐẠT' },
          FAIL: { color: 'red', label: 'KHÔNG ĐẠT' },
        }},
        { key: 'criteriaCount', label: 'Số chỉ tiêu', type: 'number' },
      ],
      rows,
      totalCount: filtered.length,
    };
  }

  // ── COMPARISON ────────────────────────────────────────
  if (intent === 'COMPARISON' && entities.batchNoA && entities.batchNoB) {
    const batchA = ctx.batches.find(b => b.batchNo?.toUpperCase() === entities.batchNoA);
    const batchB = ctx.batches.find(b => b.batchNo?.toUpperCase() === entities.batchNoB);

    if (!batchA || !batchB) {
      return { type: 'EMPTY', message: `Không tìm thấy lô "${entities.batchNoA}" hoặc "${entities.batchNoB}" trong hệ thống.` };
    }

    const resultsA = ctx.testResults.filter(r => r.batchId === batchA.id);
    const resultsB = ctx.testResults.filter(r => r.batchId === batchB.id);
    
    const latestA = resultsA.sort((a, b) => b.testDate.localeCompare(a.testDate))[0];
    const latestB = resultsB.sort((a, b) => b.testDate.localeCompare(a.testDate))[0];

    if (!latestA || !latestB) {
      return { type: 'EMPTY', message: 'Một trong hai lô chưa có kết quả kiểm nghiệm để so sánh.' };
    }

    const mapA = new Map<string, any>((latestA.results || []).map((r: any) => [r.criteriaName?.toLowerCase(), r]));
    const criteriaNames = [...new Set([...(latestA.results || []), ...(latestB.results || [])].map((r: any) => r.criteriaName))];

    const rows = criteriaNames.map(name => {
      const rA = mapA.get(name?.toLowerCase());
      const rB = (latestB.results || []).find((r: any) => r.criteriaName?.toLowerCase() === name?.toLowerCase());
      const valA = rA ? (rA as any).value : '---';
      const valB = rB ? (rB as any).value : '---';
      
      let delta = '---';
      let winner: 'A' | 'B' | 'TIE' | undefined;
      if (valA !== '---' && valB !== '---') {
        const numA = parseFloat(String(valA).replace(',', '.'));
        const numB = parseFloat(String(valB).replace(',', '.'));
        if (!isNaN(numA) && !isNaN(numB) && numB !== 0) {
          const rpd = Math.abs(((numA - numB) / ((numA + numB) / 2)) * 100);
          delta = `${rpd.toFixed(2)}% RPD`;
          winner = rpd < 1 ? 'TIE' : numA > numB ? 'A' : 'B';
        }
      }

      return { criteria: name, valueA: valA, valueB: valB, delta, winner };
    });

    return {
      type: 'COMPARISON',
      title: `🔄 So sánh lô ${entities.batchNoA} vs ${entities.batchNoB}`,
      entityA: { label: `Lô ${batchA.batchNo}`, value: fmt(latestA.testDate) },
      entityB: { label: `Lô ${batchB.batchNo}`, value: fmt(latestB.testDate) },
      rows,
      summary: `📌 Tỷ lệ đạt: Lô A = ${latestA.overallStatus === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT'} | Lô B = ${latestB.overallStatus === 'PASS' ? 'ĐẠT' : 'KHÔNG ĐẠT'}`,
    };
  }

  // ── PRODUCT_STATS ────────────────────────────────────────
  if (intent === 'PRODUCT_STATS' || intent === 'BATCH_FILTER') {
    const totalProducts = ctx.products.length;
    const totalBatches = ctx.batches.length;
    const totalTests = ctx.testResults.length;
    const failTests = ctx.testResults.filter(r => r.overallStatus === 'FAIL').length;
    const passRate = totalTests > 0 ? ((totalTests - failTests) / totalTests * 100).toFixed(1) : '100';

    const expiring30 = ctx.batches.filter(b => {
      if (!b.expDate) return false;
      const d = new Date(b.expDate);
      return d >= now && d <= new Date(now.getTime() + 30 * 86400000);
    }).length;

    return {
      type: 'STATS',
      title: '📈 Tổng quan chất lượng toàn hệ thống',
      items: [
        { label: 'Tổng sản phẩm', value: totalProducts, highlight: false },
        { label: 'Tổng lô sản xuất', value: totalBatches, highlight: false },
        { label: 'Phiếu kiểm nghiệm', value: totalTests, highlight: false },
        { label: 'Tỷ lệ đạt', value: passRate + '%', highlight: true, trend: parseFloat(passRate) >= 90 ? 'STABLE' : 'DOWN' },
        { label: 'Phiếu không đạt', value: failTests, highlight: failTests > 0 },
        { label: 'Lô sắp hết hạn (30 ngày)', value: expiring30, highlight: expiring30 > 0 },
      ],
      summary: `Hệ thống đang quản lý ${totalProducts} sản phẩm với ${totalBatches} lô sản xuất. Tỷ lệ đạt chất lượng tổng thể: **${passRate}%**.`,
    };
  }

  // ── LAB_PERFORMANCE ────────────────────────────────────────
  if (intent === 'LAB_PERFORMANCE') {
    const labMap = new Map<string, { total: number; fail: number }>();
    ctx.testResults.forEach(r => {
      const lab = r.labName || 'Không xác định';
      const entry = labMap.get(lab) || { total: 0, fail: 0 };
      entry.total++;
      if (r.overallStatus === 'FAIL') entry.fail++;
      labMap.set(lab, entry);
    });

    const rows = Array.from(labMap.entries())
      .map(([lab, stats]) => ({
        labName: lab,
        total: stats.total,
        fail: stats.fail,
        pass: stats.total - stats.fail,
        failRate: `${stats.total > 0 ? ((stats.fail / stats.total) * 100).toFixed(1) : '0'}%`,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      type: 'TABLE',
      title: '🏥 Hiệu suất các phòng kiểm nghiệm',
      subtitle: `${rows.length} đơn vị kiểm nghiệm`,
      columns: [
        { key: 'labName', label: 'Đơn vị KN', type: 'text' },
        { key: 'total', label: 'Tổng phiếu', type: 'number' },
        { key: 'pass', label: 'Đạt', type: 'number' },
        { key: 'fail', label: 'Không đạt', type: 'number' },
        { key: 'failRate', label: 'Tỷ lệ lỗi', type: 'percent' },
      ],
      rows,
      totalCount: rows.length,
    };
  }

  // ── UNKNOWN ────────────────────────────────────────
  return {
    type: 'STATS',
    title: '📊 Tổng quan nhanh hệ thống',
    items: [
      { label: 'Sản phẩm', value: ctx.products.length },
      { label: 'Lô sản xuất', value: ctx.batches.length },
      { label: 'Phiếu kiểm nghiệm', value: ctx.testResults.length },
      { label: 'TCCS đang áp dụng', value: ctx.tccsList.filter(t => t.isActive).length },
    ],
    summary: 'Bạn có thể hỏi tôi các câu như: "Lô nào hết hạn trong 30 ngày?", "Sản phẩm nào có tỷ lệ lỗi cao nhất?", "Phiếu kiểm nghiệm tháng 7 của sản phẩm X?"',
  };
};
