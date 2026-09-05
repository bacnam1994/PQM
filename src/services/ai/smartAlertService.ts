/**
 * smartAlertService.ts
 * =====================
 * AI Proactive Smart Alert Engine — Cảnh báo thông minh chủ động.
 * 
 * Phát hiện 6 loại pattern nguy hiểm mà hệ thống cảnh báo cơ bản bỏ qua:
 * 1. Pre-failure Warning — 3 lô liên tiếp gần ngưỡng (> 90% giới hạn)
 * 2. Seasonal Risk Alert — Cùng kỳ năm ngoái có lô lỗi
 * 3. Lab Performance Alert — Lab có tỷ lệ FAIL tăng đột biến
 * 4. Cross-product Anomaly — Nhiều sản phẩm cùng chỉ tiêu bất thường
 * 5. Raw Material Quality Drift — Nguyên liệu từ NCC có xu hướng xấu
 * 6. CAPA Effectiveness Check — Theo dõi 3 lô sau sự cố
 */

export type SmartAlertType =
  | 'PRE_FAILURE_WARNING'
  | 'SEASONAL_RISK'
  | 'LAB_PERFORMANCE_DEGRADATION'
  | 'CROSS_PRODUCT_ANOMALY'
  | 'CAPA_EFFECTIVENESS_CHECK'
  | 'TREND_ACCELERATION'
  | 'BORDERLINE_ACCUMULATION';

export interface SmartAlert {
  id: string;
  type: SmartAlertType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  recommendation: string;
  detectedAt: string;
  affectedEntities: {
    type: 'PRODUCT' | 'BATCH' | 'LAB' | 'CRITERIA';
    id?: string;
    name: string;
  }[];
  evidence: string[];       // Các dữ kiện hỗ trợ cảnh báo
  actionRequired: boolean;
  actionSuggestion?: string;
}

export interface SmartAlertReport {
  generatedAt: string;
  totalAlerts: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  alerts: SmartAlert[];
  summary: string;
}

interface AlertContext {
  products: any[];
  batches: any[];
  testResults: any[];
  tccsList: any[];
}

const generateId = () => `sa_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─────────────────────────────────────────────
// DETECTOR 1: Pre-failure Warning
// 3 lô liên tiếp có giá trị > 90% giới hạn (tiệm cận FAIL)
// ─────────────────────────────────────────────

const detectPreFailureWarnings = (ctx: AlertContext): SmartAlert[] => {
  const alerts: SmartAlert[] = [];

  ctx.products.forEach(product => {
    const productBatches = ctx.batches
      .filter(b => b.productId === product.id)
      .sort((a, b) => (b.mfgDate || '').localeCompare(a.mfgDate || ''));

    const activeTccs = ctx.tccsList.find(t => t.productId === product.id && t.isActive);
    if (!activeTccs) return;

    const mainCriteria = [...(activeTccs.mainQualityCriteria || [])].filter(c => c.type === 'NUMBER');

    mainCriteria.forEach(criterion => {
      if (criterion.min === undefined && criterion.max === undefined) return;

      const recentResults: { batchNo: string; value: number; ratio: number }[] = [];

      const recentBatches = productBatches.slice(0, 5);
      recentBatches.forEach(batch => {
        const testResult = ctx.testResults
          .filter(r => r.batchId === batch.id)
          .sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''))[0];
        if (!testResult) return;

        const entry = (testResult.results || []).find((r: any) =>
          r.criteriaName?.toLowerCase() === criterion.name?.toLowerCase()
        );
        if (!entry) return;

        const val = parseFloat(String(entry.value).replace(',', '.'));
        if (isNaN(val)) return;

        let ratio = 0;
        if (criterion.max !== undefined && criterion.min !== undefined) {
          // Tính tỷ lệ gần Max (cao bất thường) hoặc gần Min (thấp bất thường)
          const range = criterion.max - criterion.min;
          if (range > 0) {
            // Khoảng cách tới giới hạn gần nhất, tính theo % range
            const distToMax = criterion.max - val;
            const distToMin = val - criterion.min;
            const minDist = Math.min(distToMax, distToMin);
            ratio = 1 - (minDist / (range / 2));
          }
        } else if (criterion.max !== undefined) {
          ratio = val / criterion.max;  // > 0.9 → nguy hiểm
        } else if (criterion.min !== undefined && criterion.min > 0) {
          ratio = criterion.min / val;  // > 0.9 → nguy hiểm (gần Min)
        }

        recentResults.push({ batchNo: batch.batchNo, value: val, ratio });
      });

      // Kiểm tra: 3 lô liên tiếp có ratio > 0.88 (gần 90% ngưỡng)
      const nearLimitResults = recentResults.filter(r => r.ratio > 0.88);
      if (nearLimitResults.length >= 3) {
        const maxRatio = Math.max(...nearLimitResults.map(r => r.ratio));
        alerts.push({
          id: generateId(),
          type: 'PRE_FAILURE_WARNING',
          severity: maxRatio > 0.95 ? 'HIGH' : 'MEDIUM',
          title: `⚠️ Cảnh báo trước sự cố: ${criterion.name} — ${product.name}`,
          description: `${nearLimitResults.length} lô gần nhất của "${product.name}" có chỉ tiêu "${criterion.name}" tiệm cận giới hạn (> 88% ngưỡng). Pattern này thường báo hiệu lô tiếp theo có nguy cơ FAIL cao.`,
          recommendation: `Kiểm tra ngay nguyên liệu đầu vào, thông số quy trình và điều kiện bảo quản trước khi sản xuất lô tiếp theo. Cân nhắc tăng tần suất IPC cho chỉ tiêu "${criterion.name}".`,
          detectedAt: new Date().toISOString(),
          affectedEntities: [
            { type: 'PRODUCT', id: product.id, name: product.name },
            { type: 'CRITERIA', name: criterion.name },
          ],
          evidence: nearLimitResults.map(r => `Lô ${r.batchNo}: ${criterion.name} = ${r.value} (${(r.ratio * 100).toFixed(1)}% ngưỡng giới hạn)`),
          actionRequired: maxRatio > 0.95,
          actionSuggestion: 'Họp review chất lượng khẩn cấp, xem xét thông số quy trình sản xuất',
        });
      }
    });
  });

  return alerts;
};

// ─────────────────────────────────────────────
// DETECTOR 2: Seasonal Risk Alert
// Cùng tháng năm ngoái có lô FAIL → cảnh báo mùa vụ
// ─────────────────────────────────────────────

const detectSeasonalRisks = (ctx: AlertContext): SmartAlert[] => {
  const alerts: SmartAlert[] = [];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const lastYear = currentYear - 1;

  // Tìm các phiếu FAIL cùng tháng năm ngoái
  const lastYearFails = ctx.testResults.filter(r => {
    if (r.overallStatus !== 'FAIL' || !r.testDate) return false;
    const d = new Date(r.testDate);
    return d.getFullYear() === lastYear && d.getMonth() + 1 === currentMonth;
  });

  if (lastYearFails.length === 0) return alerts;

  // Group by product
  const failsByProduct = new Map<string, number>();
  lastYearFails.forEach(r => {
    const batch = ctx.batches.find(b => b.id === r.batchId);
    if (batch) {
      failsByProduct.set(batch.productId, (failsByProduct.get(batch.productId) || 0) + 1);
    }
  });

  failsByProduct.forEach((count, productId) => {
    if (count < 1) return;
    const product = ctx.products.find(p => p.id === productId);
    if (!product) return;

    // Kiểm tra xem tháng này có lô nào đang được kiểm nghiệm không
    const currentMonthBatches = ctx.batches.filter(b => {
      if (b.productId !== productId) return false;
      const d = new Date(b.mfgDate || '');
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    });

    alerts.push({
      id: generateId(),
      type: 'SEASONAL_RISK',
      severity: count >= 2 ? 'HIGH' : 'MEDIUM',
      title: `🌡️ Rủi ro mùa vụ: ${product.name} — Tháng ${currentMonth}`,
      description: `Lịch sử cho thấy "${product.name}" có ${count} phiếu kiểm nghiệm KHÔNG ĐẠT vào tháng ${currentMonth}/${lastYear} — cùng thời điểm năm ngoái. Nguy cơ tái diễn trong tháng ${currentMonth}/${currentYear} là cao.`,
      recommendation: `Tăng cường kiểm soát chất lượng đầu vào và trong quá trình (IPC) cho "${product.name}" trong tháng ${currentMonth}. Xem xét nguyên nhân gốc rễ từ sự cố tháng ${currentMonth}/${lastYear}.`,
      detectedAt: new Date().toISOString(),
      affectedEntities: [{ type: 'PRODUCT', id: product.id, name: product.name }],
      evidence: [
        `Năm ${lastYear} — tháng ${currentMonth}: ${count} phiếu KHÔNG ĐẠT`,
        currentMonthBatches.length > 0 ? `Tháng ${currentMonth}/${currentYear}: ${currentMonthBatches.length} lô đang được sản xuất/kiểm nghiệm` : 'Chưa có lô nào trong tháng hiện tại',
      ],
      actionRequired: count >= 2,
      actionSuggestion: `Review SOP sản xuất ${product.name}, kiểm tra điều kiện môi trường tháng ${currentMonth}`,
    });
  });

  return alerts;
};

// ─────────────────────────────────────────────
// DETECTOR 3: Lab Performance Degradation
// Lab có tỷ lệ FAIL tăng đột biến so với baseline 6 tháng
// ─────────────────────────────────────────────

const detectLabPerformanceDegradation = (ctx: AlertContext): SmartAlert[] => {
  const alerts: SmartAlert[] = [];
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86400000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 86400000);

  const labStats = new Map<string, { recent: { total: number; fail: number }; baseline: { total: number; fail: number } }>();

  ctx.testResults.forEach(r => {
    if (!r.labName || !r.testDate) return;
    const testDate = new Date(r.testDate);
    if (testDate < sixMonthsAgo) return;

    const stats = labStats.get(r.labName) || { recent: { total: 0, fail: 0 }, baseline: { total: 0, fail: 0 } };
    if (testDate >= oneMonthAgo) {
      stats.recent.total++;
      if (r.overallStatus === 'FAIL') stats.recent.fail++;
    } else {
      stats.baseline.total++;
      if (r.overallStatus === 'FAIL') stats.baseline.fail++;
    }
    labStats.set(r.labName, stats);
  });

  labStats.forEach((stats, labName) => {
    if (stats.recent.total < 3 || stats.baseline.total < 3) return; // Không đủ dữ liệu
    
    const recentFailRate = stats.recent.fail / stats.recent.total;
    const baselineFailRate = stats.baseline.fail / stats.baseline.total;
    
    // Cảnh báo nếu tỷ lệ gần đây tăng > 15% so với baseline
    if (recentFailRate - baselineFailRate > 0.15) {
      alerts.push({
        id: generateId(),
        type: 'LAB_PERFORMANCE_DEGRADATION',
        severity: (recentFailRate - baselineFailRate) > 0.3 ? 'HIGH' : 'MEDIUM',
        title: `🏥 Hiệu suất phòng lab giảm sút: ${labName}`,
        description: `Tỷ lệ FAIL tại "${labName}" tăng từ ${(baselineFailRate * 100).toFixed(1)}% (5 tháng trước) lên ${(recentFailRate * 100).toFixed(1)}% (30 ngày gần nhất). Mức tăng ${((recentFailRate - baselineFailRate) * 100).toFixed(1)}% vượt ngưỡng cảnh báo.`,
        recommendation: `Đánh giá lại năng lực phòng kiểm nghiệm "${labName}": kiểm tra tình trạng thiết bị, chất lượng thuốc thử, năng lực nhân viên. Cân nhắc kiểm tra chéo với phòng lab khác.`,
        detectedAt: new Date().toISOString(),
        affectedEntities: [{ type: 'LAB', name: labName }],
        evidence: [
          `Baseline (5 tháng trước): ${stats.baseline.fail}/${stats.baseline.total} phiếu FAIL (${(baselineFailRate * 100).toFixed(1)}%)`,
          `Gần đây (30 ngày): ${stats.recent.fail}/${stats.recent.total} phiếu FAIL (${(recentFailRate * 100).toFixed(1)}%)`,
          `Mức tăng: +${((recentFailRate - baselineFailRate) * 100).toFixed(1)}%`,
        ],
        actionRequired: (recentFailRate - baselineFailRate) > 0.3,
        actionSuggestion: 'Yêu cầu phòng lab tự đánh giá và báo cáo; cân nhắc audit phòng lab',
      });
    }
  });

  return alerts;
};

// ─────────────────────────────────────────────
// DETECTOR 4: Cross-product Anomaly
// Nhiều sản phẩm cùng chỉ tiêu bất thường → nghi ngờ thiết bị/môi trường
// ─────────────────────────────────────────────

const detectCrossProductAnomalies = (ctx: AlertContext): SmartAlert[] => {
  const alerts: SmartAlert[] = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  // Tìm chỉ tiêu nào bị FAIL trong 30 ngày, gom nhóm theo tên chỉ tiêu
  const criteriaFailMap = new Map<string, Set<string>>();

  ctx.testResults
    .filter(r => r.overallStatus === 'FAIL' && new Date(r.testDate || '') >= thirtyDaysAgo)
    .forEach(r => {
      const batch = ctx.batches.find(b => b.id === r.batchId);
      if (!batch) return;
      (r.results || [])
        .filter((entry: any) => entry.isPass === false)
        .forEach((entry: any) => {
          const critKey = (entry.criteriaName || '').toLowerCase().trim();
          if (!critKey) return;
          const products = criteriaFailMap.get(critKey) || new Set<string>();
          products.add(batch.productId);
          criteriaFailMap.set(critKey, products);
        });
    });

  // Cảnh báo nếu cùng chỉ tiêu bị FAIL ở >= 2 sản phẩm khác nhau
  criteriaFailMap.forEach((productIds, criteriaName) => {
    if (productIds.size < 2) return;
    const productNames = Array.from(productIds)
      .map(id => ctx.products.find(p => p.id === id)?.name || id)
      .filter(Boolean);

    alerts.push({
      id: generateId(),
      type: 'CROSS_PRODUCT_ANOMALY',
      severity: productIds.size >= 3 ? 'HIGH' : 'MEDIUM',
      title: `🔄 Bất thường đa sản phẩm: Chỉ tiêu "${criteriaName}"`,
      description: `Chỉ tiêu "${criteriaName}" bị FAIL ở ${productIds.size} sản phẩm khác nhau trong 30 ngày qua: ${productNames.join(', ')}. Pattern này nghi ngờ vấn đề hệ thống (thiết bị, môi trường, phương pháp kiểm tra).`,
      recommendation: `Kiểm tra ngay: (1) Thiết bị đo lường liên quan đến chỉ tiêu "${criteriaName}", (2) Phương pháp phân tích và thuốc thử đang dùng, (3) Điều kiện môi trường phòng sản xuất. Xem xét kiểm tra chéo (cross-check) với phương pháp khác.`,
      detectedAt: new Date().toISOString(),
      affectedEntities: [
        { type: 'CRITERIA', name: criteriaName },
        ...Array.from(productIds).map(id => ({
          type: 'PRODUCT' as const,
          id,
          name: ctx.products.find(p => p.id === id)?.name || id,
        })),
      ],
      evidence: [
        `${productIds.size} sản phẩm bị FAIL cùng chỉ tiêu trong 30 ngày: ${productNames.join(', ')}`,
        'Nghi ngờ vấn đề mang tính hệ thống (không phải đơn lẻ)',
      ],
      actionRequired: true,
      actionSuggestion: 'Họp khẩn giữa QA, QC và sản xuất; kiểm tra thiết bị và môi trường',
    });
  });

  return alerts;
};

// ─────────────────────────────────────────────
// DETECTOR 5: CAPA Effectiveness Check
// Sau sự cố (lô REJECTED), theo dõi 3 lô tiếp theo có cải thiện không
// ─────────────────────────────────────────────

const detectCAPAEffectiveness = (ctx: AlertContext): SmartAlert[] => {
  const alerts: SmartAlert[] = [];

  ctx.products.forEach(product => {
    const productBatches = ctx.batches
      .filter(b => b.productId === product.id)
      .sort((a, b) => (a.mfgDate || '').localeCompare(b.mfgDate || ''));

    // Tìm lô REJECTED gần nhất
    const lastRejectedIdx = [...productBatches].reverse().findIndex(b => b.status === 'REJECTED');
    if (lastRejectedIdx === -1) return;

    const rejectedBatch = [...productBatches].reverse()[lastRejectedIdx];
    const rejectedDate = rejectedBatch.mfgDate;

    // Lấy 3 lô sau lô REJECTED
    const batchesAfterRejection = productBatches.filter(b => (b.mfgDate || '') > (rejectedDate || ''));
    if (batchesAfterRejection.length < 2) return; // Chưa đủ lô để đánh giá

    const testedBatches = batchesAfterRejection.slice(0, 3);
    const stillFailing = testedBatches.filter(b => {
      const latestResult = ctx.testResults
        .filter(r => r.batchId === b.id)
        .sort((a, b) => (b.testDate || '').localeCompare(a.testDate || ''))[0];
      return latestResult && latestResult.overallStatus === 'FAIL';
    });

    if (stillFailing.length > 0) {
      alerts.push({
        id: generateId(),
        type: 'CAPA_EFFECTIVENESS_CHECK',
        severity: stillFailing.length >= 2 ? 'HIGH' : 'MEDIUM',
        title: `🔍 CAPA chưa hiệu quả: ${product.name}`,
        description: `Sau khi lô ${rejectedBatch.batchNo} bị từ chối, ${stillFailing.length}/${testedBatches.length} lô tiếp theo vẫn có phiếu KHÔNG ĐẠT. Hành động CAPA trước đó có thể chưa giải quyết được nguyên nhân gốc rễ.`,
        recommendation: `Yêu cầu review lại toàn bộ hồ sơ CAPA của lô ${rejectedBatch.batchNo}. Xem xét có cần điều tra bổ sung hoặc thay đổi cách tiếp cận CAPA. Đừng sản xuất lô mới cho đến khi xác nhận CAPA hiệu quả.`,
        detectedAt: new Date().toISOString(),
        affectedEntities: [{ type: 'PRODUCT', id: product.id, name: product.name }],
        evidence: [
          `Lô bị từ chối: ${rejectedBatch.batchNo} (${rejectedBatch.mfgDate || 'N/A'})`,
          `Lô sau đó bị FAIL: ${stillFailing.map(b => b.batchNo).join(', ')}`,
          `Tỷ lệ vẫn FAIL sau CAPA: ${stillFailing.length}/${testedBatches.length} lô`,
        ],
        actionRequired: true,
        actionSuggestion: 'Review CAPA Effectiveness meeting với QA Director',
      });
    }
  });

  return alerts;
};

// ─────────────────────────────────────────────
// DETECTOR 6: Borderline Accumulation
// Tích tụ rủi ro tiệm cận biên (>= 2 lô liên tiếp sát ngưỡng)
// ─────────────────────────────────────────────

const detectBorderlineAccumulation = (ctx: AlertContext): SmartAlert[] => {
  const alerts: SmartAlert[] = [];
  const { products, batches, testResults, tccsList } = ctx;

  products.forEach(p => {
    const pBatches = batches.filter(b => b.productId === p.id);
    const pTccs = tccsList.find(t => t.productId === p.id && t.isActive) || tccsList.find(t => t.productId === p.id);
    if (!pTccs) return;

    const allCriteria = [...(pTccs.mainQualityCriteria || []), ...(pTccs.safetyCriteria || [])];
    const numericCriteria = allCriteria.filter(c => c && (c.min !== undefined || c.max !== undefined));

    numericCriteria.forEach(crit => {
      const points: { batchNo: string; val: number; date: string }[] = [];
      pBatches.forEach(b => {
        const bTests = testResults.filter(tr => tr.batchId === b.id);
        bTests.forEach(tr => {
          const entry = (tr.results || []).find((r: any) => r.criteriaName?.toLowerCase() === crit.name?.toLowerCase());
          if (entry && typeof entry.value === 'string') {
            const num = parseFloat(entry.value.replace(',', '.'));
            if (!isNaN(num)) {
              points.push({ batchNo: b.batchNo, val: num, date: tr.testDate || b.mfgDate || '' });
            }
          }
        });
      });

      if (points.length < 2) return;
      const sorted = points.sort((a, b) => a.date.localeCompare(b.date));
      const recent = sorted.slice(-3);

      let borderlineCount = 0;
      recent.forEach(pt => {
        const isNearMax = crit.max !== undefined && pt.val >= crit.max * 0.88 && pt.val <= crit.max;
        const isNearMin = crit.min !== undefined && pt.val <= crit.min * 1.12 && pt.val >= crit.min;
        if (isNearMax || isNearMin) borderlineCount++;
      });

      if (borderlineCount >= 2) {
        alerts.push({
          id: generateId(),
          type: 'BORDERLINE_ACCUMULATION',
          severity: borderlineCount >= 3 ? 'HIGH' : 'MEDIUM',
          title: `Tích tụ rủi ro tiệm cận ngưỡng: ${p.name} - ${crit.name}`,
          description: `Chỉ tiêu "${crit.name}" của sản phẩm "${p.name}" có ${borderlineCount}/${recent.length} lô gần nhất nằm sát biên giới hạn cho phép (tiềm ẩn nguy cơ OOS).`,
          recommendation: `Rà soát lại thông số quy trình sản xuất và nguyên liệu đầu vào trước khi tiến hành sản xuất lô kế tiếp của sản phẩm "${p.name}".`,
          detectedAt: new Date().toISOString(),
          affectedEntities: [
            { type: 'PRODUCT', id: p.id, name: p.name },
            { type: 'CRITERIA', name: crit.name }
          ],
          evidence: recent.map(r => `Lô ${r.batchNo} (${r.date}): ${r.val} ${crit.unit || ''}`),
          actionRequired: borderlineCount >= 3,
          actionSuggestion: `Họp kiểm thảo quy trình sản xuất sản phẩm ${p.name}`
        });
      }
    });
  });

  return alerts;
};

// ─────────────────────────────────────────────
// MAIN: Chạy toàn bộ detectors
// ─────────────────────────────────────────────

export const runSmartAlertAnalysis = (ctx: AlertContext): SmartAlertReport => {
  const allAlerts: SmartAlert[] = [];

  try { allAlerts.push(...detectPreFailureWarnings(ctx)); } catch (e) { console.warn('[SmartAlert] Pre-failure detector error:', e); }
  try { allAlerts.push(...detectSeasonalRisks(ctx)); } catch (e) { console.warn('[SmartAlert] Seasonal risk detector error:', e); }
  try { allAlerts.push(...detectLabPerformanceDegradation(ctx)); } catch (e) { console.warn('[SmartAlert] Lab performance detector error:', e); }
  try { allAlerts.push(...detectCrossProductAnomalies(ctx)); } catch (e) { console.warn('[SmartAlert] Cross-product detector error:', e); }
  try { allAlerts.push(...detectCAPAEffectiveness(ctx)); } catch (e) { console.warn('[SmartAlert] CAPA effectiveness detector error:', e); }
  try { allAlerts.push(...detectBorderlineAccumulation(ctx)); } catch (e) { console.warn('[SmartAlert] Borderline accumulation detector error:', e); }

  const highCount = allAlerts.filter(a => a.severity === 'HIGH').length;
  const mediumCount = allAlerts.filter(a => a.severity === 'MEDIUM').length;
  const lowCount = allAlerts.filter(a => a.severity === 'LOW').length;

  let summary = '';
  if (allAlerts.length === 0) {
    summary = '✅ Không phát hiện pattern nguy hiểm nào. Hệ thống đang hoạt động ổn định.';
  } else {
    const parts = [];
    if (highCount > 0) parts.push(`${highCount} cảnh báo CẦN HÀNH ĐỘNG NGAY`);
    if (mediumCount > 0) parts.push(`${mediumCount} cần theo dõi`);
    summary = `🧠 AI phát hiện ${allAlerts.length} pattern bất thường: ${parts.join(', ')}.`;
  }

  // Sắp xếp: HIGH trước, sau đó theo thời gian
  allAlerts.sort((a, b) => {
    const sevOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (sevOrder[a.severity] || 0) - (sevOrder[b.severity] || 0);
  });

  return {
    generatedAt: new Date().toISOString(),
    totalAlerts: allAlerts.length,
    highCount,
    mediumCount,
    lowCount,
    alerts: allAlerts,
    summary,
  };
};

// Cache key cho localStorage
const SMART_ALERTS_CACHE_KEY = 'pqm_smart_alerts_cache';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 phút

export const getCachedSmartAlerts = (): SmartAlertReport | null => {
  try {
    const cached = localStorage.getItem(SMART_ALERTS_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(SMART_ALERTS_CACHE_KEY);
      return null;
    }
    return data;
  } catch { return null; }
};

export const saveSmartAlertsCache = (report: SmartAlertReport) => {
  try {
    localStorage.setItem(SMART_ALERTS_CACHE_KEY, JSON.stringify({ data: report, timestamp: Date.now() }));
  } catch { /* ignore */ }
};

export const invalidateSmartAlertsCache = () => {
  try { localStorage.removeItem(SMART_ALERTS_CACHE_KEY); } catch { /* ignore */ }
};
