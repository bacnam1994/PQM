/**
 * autoLearningService.ts
 * ======================
 * He thong Tu hoc AI Chu dong (Active / Autonomous Learning)
 *
 * Khac voi Passive Learning (chi hoc khi user sua mapping),
 * module nay tu hoc tu:
 *   1. OCR high-confidence mappings (khong can user xac nhan)
 *   2. Tan suat mapping -> de xuat them vao tu dien
 *   3. Phan tich du lieu kiem nghiem -> sinh AI Insight chu dong
 *   4. Session Memory -> nho ngu canh lien phien chat
 */

import { AIInsight, AILearnedMapping, AISessionSummary } from '../../types';
import { useAppStore } from '../../store/useAppStore';

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const AI_INSIGHTS_KEY = 'pqm_ai_insights';
const AI_SESSION_KEY_PREFIX = 'pqm_ai_session_';
const MAX_SESSION_HISTORY = 5;
/** Sau bao nhieu lan mapping thanh cong -> tu hoc khong can xac nhan */
const AUTO_LEARN_FREQUENCY_THRESHOLD = 3;
/** Insight cache het han sau 12 tieng (ms) */
const INSIGHT_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────
// 1. AUTO-RECORD OCR MAPPING (Post-OCR Self-learning)
// ─────────────────────────────────────────────────────────────

/**
 * Ghi nhan mapping ten chi tieu tu ket qua OCR high-confidence.
 * Goi sau khi AI OCR va tim duoc mapping chac chan (confidence=high),
 * ke ca khi user KHONG sua — he thong van tu hoc tu thanh cong.
 */
export const recordHighConfidenceOCRMappings = (
  mappings: Array<{ originalName: string; systemName: string }>
): void => {
  if (!mappings || mappings.length === 0) return;

  const store = useAppStore.getState();
  const existingMappings: AILearnedMapping[] = store.aiLearnedMappings || [];

  mappings.forEach(({ originalName, systemName }) => {
    if (!originalName || !systemName) return;
    if (originalName.trim().toLowerCase() === systemName.trim().toLowerCase()) return;

    const existing = existingMappings.find(
      m => m.originalName.trim().toLowerCase() === originalName.trim().toLowerCase()
        && m.systemName.trim().toLowerCase() === systemName.trim().toLowerCase()
    );

    if (!existing) {
      store.addAiLearnedMapping(originalName, systemName);
      console.log(`[AutoLearn] Ghi nhan mapping moi (auto): "${originalName}" -> "${systemName}"`);
    }
  });
};

// ─────────────────────────────────────────────────────────────
// 2. DETECT HIGH-FREQUENCY MAPPINGS (Pattern Mining)
// ─────────────────────────────────────────────────────────────

export interface MappingSuggestion {
  originalName: string;
  systemName: string;
  frequency: number;
}

/**
 * Tim cac mapping co tan suat cao nhung chua co trong tu dien cung.
 * Dung de de xuat "Them vao tu dien nhanh" 1 click.
 */
export const detectHighFrequencyMappings = (
  learnedMappings: AILearnedMapping[],
  threshold = AUTO_LEARN_FREQUENCY_THRESHOLD
): MappingSuggestion[] => {
  return learnedMappings
    .filter(m => m.frequency >= threshold)
    .map(m => ({
      originalName: m.originalName,
      systemName: m.systemName,
      frequency: m.frequency,
    }))
    .sort((a, b) => b.frequency - a.frequency);
};

// ─────────────────────────────────────────────────────────────
// 3. AI QUALITY INSIGHT ENGINE
// ─────────────────────────────────────────────────────────────

export const loadCachedInsights = (): AIInsight[] => {
  try {
    const raw = localStorage.getItem(AI_INSIGHTS_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { insights: AIInsight[]; generatedAt: string };
    const age = Date.now() - new Date(data.generatedAt).getTime();
    if (age > INSIGHT_CACHE_TTL_MS) return [];
    return data.insights;
  } catch {
    return [];
  }
};

export const saveCachedInsights = (insights: AIInsight[]): void => {
  try {
    localStorage.setItem(AI_INSIGHTS_KEY, JSON.stringify({
      insights,
      generatedAt: new Date().toISOString(),
    }));
  } catch { /* ignore */ }
};

export const clearInsightCache = (): void => {
  localStorage.removeItem(AI_INSIGHTS_KEY);
};

/**
 * Phan tich du lieu he thong va sinh danh sach AIInsight chu dong.
 * Logic rule-based (khong goi API), chay nhanh trong client.
 */
export const generateRuleBasedInsights = (appContext: any): AIInsight[] => {
  const insights: AIInsight[] = [];
  const now = new Date().toISOString();

  const products = appContext.products || [];
  const batches = appContext.batches || [];
  const testResults = appContext.testResults || [];
  const learnedMappings: AILearnedMapping[] = appContext.aiLearnedMappings || [];

  // Insight 1: Ty le fail cao theo san pham
  const productFailStats: Record<string, { name: string; total: number; fail: number }> = {};
  testResults.forEach((tr: any) => {
    const batch = batches.find((b: any) => b.id === tr.batchId);
    if (!batch) return;
    const prod = products.find((p: any) => p.id === batch.productId);
    if (!prod) return;

    if (!productFailStats[prod.id]) {
      productFailStats[prod.id] = { name: prod.name, total: 0, fail: 0 };
    }
    productFailStats[prod.id].total++;
    if (tr.overallStatus === 'FAIL') productFailStats[prod.id].fail++;
  });

  Object.entries(productFailStats).forEach(([productId, stats]) => {
    if (stats.total < 3) return;
    const failRate = stats.fail / stats.total;
    if (failRate >= 0.3) {
      insights.push({
        id: `insight_fail_${productId}_${Date.now()}`,
        type: 'HIGH_FAIL_RATE',
        severity: failRate >= 0.5 ? 'HIGH' : 'MEDIUM',
        title: `\u26a0\ufe0f Ty le khong dat cao: ${stats.name}`,
        detail: `San pham **${stats.name}** co **${(failRate * 100).toFixed(0)}%** phieu khong dat tren ${stats.total} phieu kiem nghiem gan day. Can xem xet lai quy trinh san xuat hoac thong so TCCS.`,
        productId,
        productName: stats.name,
        generatedAt: now,
      });
    }
  });

  // Insight 2: Lo sap het han trong 60 ngay
  const today = new Date();
  const in60Days = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expiringBatches = batches.filter((b: any) => {
    if (!b.expDate || b.status === 'REJECTED') return false;
    const exp = new Date(b.expDate);
    return exp >= today && exp <= in60Days;
  });

  if (expiringBatches.length > 0) {
    const names = expiringBatches
      .slice(0, 3)
      .map((b: any) => {
        const prod = products.find((p: any) => p.id === b.productId);
        return `${prod?.name || 'SP'} - Lo ${b.batchNo} (HSD: ${b.expDate})`;
      })
      .join(', ');

    insights.push({
      id: `insight_expiry_${Date.now()}`,
      type: 'EXPIRY_RISK',
      severity: expiringBatches.length >= 5 ? 'HIGH' : 'MEDIUM',
      title: `\ud83d\udcc5 ${expiringBatches.length} lo sap het han trong 60 ngay`,
      detail: `Phat hien **${expiringBatches.length} lo** het han truoc ${in60Days.toLocaleDateString('vi-VN')}: ${names}${expiringBatches.length > 3 ? ` va ${expiringBatches.length - 3} lo khac...` : ''}. Xem xet phan phoi, tieu thu hoac lap ke hoach huy theo quy trinh GMP.`,
      generatedAt: now,
    });
  }

  // Insight 3: Xu huong troi chi tieu (3 gia tri lien tiep tang/giam)
  const criteriaTimeSeries: Record<string, { productId: string; productName: string; values: number[] }> = {};

  batches.forEach((batch: any) => {
    const prod = products.find((p: any) => p.id === batch.productId);
    if (!prod) return;
    const batchResults = testResults.filter((tr: any) => tr.batchId === batch.id);
    batchResults.forEach((tr: any) => {
      (tr.results || []).forEach((entry: any) => {
        const numVal = parseFloat(String(entry.value || '').replace(',', '.'));
        if (isNaN(numVal)) return;
        const key = `${batch.productId}::${entry.criteriaName}`;
        if (!criteriaTimeSeries[key]) {
          criteriaTimeSeries[key] = { productId: batch.productId, productName: prod.name, values: [] };
        }
        criteriaTimeSeries[key].values.push(numVal);
      });
    });
  });

  Object.entries(criteriaTimeSeries).forEach(([key, data]) => {
    if (data.values.length < 3) return;
    const last3 = data.values.slice(-3);
    const isMonoIncrease = last3[0] < last3[1] && last3[1] < last3[2];
    const isMonoDecrease = last3[0] > last3[1] && last3[1] > last3[2];

    if (isMonoIncrease || isMonoDecrease) {
      const criteriaName = key.split('::')[1];
      const trend = isMonoIncrease ? 'tang lien tiep' : 'giam lien tiep';
      const trendIcon = isMonoIncrease ? '\ud83d\udcc8' : '\ud83d\udcc9';

      insights.push({
        id: `insight_drift_${key.replace('::', '_')}_${Date.now()}`,
        type: 'DRIFT_RISK',
        severity: 'MEDIUM',
        title: `${trendIcon} Xu huong troi: ${criteriaName} - ${data.productName}`,
        detail: `Chi tieu **${criteriaName}** cua san pham **${data.productName}** dang **${trend}** qua 3 lo lien tiep (${last3.map(v => v.toFixed(2)).join(' -> ')}). Khuyen nghi: Xem xet nguyen nhan va kiem tra dieu kien quy trinh.`,
        productId: data.productId,
        productName: data.productName,
        criteriaName,
        generatedAt: now,
      });
    }
  });

  // Insight 4: OCR mapping co tan suat cao
  const highFreqMappings = detectHighFrequencyMappings(learnedMappings, AUTO_LEARN_FREQUENCY_THRESHOLD);
  if (highFreqMappings.length > 0) {
    const examples = highFreqMappings
      .slice(0, 3)
      .map(m => `"${m.originalName}" -> "${m.systemName}" (${m.frequency}x)`)
      .join(', ');

    insights.push({
      id: `insight_ocr_pattern_${Date.now()}`,
      type: 'OCR_PATTERN',
      severity: 'LOW',
      title: `\ud83d\udcda ${highFreqMappings.length} mapping ten chi tieu tan suat cao`,
      detail: `AI da nhan dang ${highFreqMappings.length} cap ten chi tieu thuong xuyen: ${examples}. Ban co the them vao **tu dien** de tang toc do nhan dien tu dong trong tuong lai.`,
      generatedAt: now,
    });
  }

  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return insights.slice(0, 5);
};

/**
 * Goi Gemini de sinh insight nang cao.
 * Chi goi khi khong co cache hop le.
 */
export const generateAIInsights = async (
  appContext: any,
  generateTextFn: (prompt: string, systemPrompt?: string) => Promise<string>
): Promise<AIInsight[]> => {
  const ruleBasedInsights = generateRuleBasedInsights(appContext);

  const cached = loadCachedInsights();
  if (cached.length > 0) return cached;

  try {
    const products = (appContext.products || []).slice(0, 10);
    const testResults = (appContext.testResults || []).slice(0, 30);
    const passRate = testResults.length > 0
      ? ((testResults.filter((t: any) => t.overallStatus === 'PASS').length / testResults.length) * 100).toFixed(0) + '%'
      : 'N/A';

    const summaryPrompt = `Ban la chuyen gia phan tich chat luong GMP. Phan tich du lieu sau va tra ve DUNG 1 insight quan trong nhat (khong da co trong danh sach).

DU LIEU HE THONG:
- San pham: ${products.map((p: any) => p.name).join(', ')}
- Ty le dat tong the: ${passRate}

INSIGHT DA CO (KHONG LAP LAI):
${ruleBasedInsights.map(i => `- ${i.title}`).join('\n')}

Yeu cau: Tra ve JSON object duy nhat:
{ "title": "...", "detail": "...(toi da 200 ky tu)", "type": "QUALITY_TREND", "severity": "LOW"|"MEDIUM"|"HIGH" }
Neu khong co insight moi -> tra ve: {}`;

    const response = await generateTextFn(summaryPrompt);
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (parsed.title && parsed.detail) {
      ruleBasedInsights.push({
        id: `insight_gemini_${Date.now()}`,
        type: parsed.type || 'QUALITY_TREND',
        severity: parsed.severity || 'LOW',
        title: parsed.title,
        detail: parsed.detail,
        generatedAt: new Date().toISOString(),
      });
    }
  } catch (e) {
    console.info('[AutoLearn] Gemini insight generation skipped:', e);
  }

  saveCachedInsights(ruleBasedInsights);
  return ruleBasedInsights;
};

// ─────────────────────────────────────────────────────────────
// 4. SESSION MEMORY
// ─────────────────────────────────────────────────────────────

const getSessionKey = (userId: string) => `${AI_SESSION_KEY_PREFIX}${userId}`;

export const loadSessionMemory = (userId: string): AISessionSummary[] => {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getSessionKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as AISessionSummary[];
  } catch {
    return [];
  }
};

export const saveSessionMemory = (userId: string, summary: string, modelUsed?: string): void => {
  if (!userId || !summary.trim()) return;
  try {
    const sessions = loadSessionMemory(userId);
    const newSession: AISessionSummary = {
      summary: summary.trim().substring(0, 800),
      timestamp: new Date().toISOString(),
      modelUsed,
    };
    const updated = [newSession, ...sessions].slice(0, MAX_SESSION_HISTORY);
    localStorage.setItem(getSessionKey(userId), JSON.stringify(updated));
  } catch { /* ignore */ }
};

export const clearSessionMemory = (userId: string): void => {
  if (!userId) return;
  localStorage.removeItem(getSessionKey(userId));
};

/**
 * Tao doan system prompt tom tat tu session memory de inject vao chat.
 */
export const buildSessionMemoryPrompt = (userId: string): string => {
  const sessions = loadSessionMemory(userId);
  if (sessions.length === 0) return '';

  const recent = sessions.slice(0, 3);
  const lines = recent.map((s, i) => {
    const date = new Date(s.timestamp).toLocaleDateString('vi-VN');
    return `[Phien ${i + 1} - ${date}]: ${s.summary}`;
  }).join('\n');

  return `\nLICH SU HOI THOAI GAN DAY CUA NGUOI DUNG NAY (dung de hieu ngu canh, KHONG can lap lai):\n${lines}\n`;
};

/**
 * Tom tat mot cuoc hoi thoai bang Gemini (goi sau khi chat ket thuc/dong).
 */
export const summarizeSessionWithAI = async (
  messages: Array<{ sender: string; text: string }>,
  generateTextFn: (prompt: string, systemPrompt?: string) => Promise<string>
): Promise<string> => {
  if (messages.length < 2) return '';

  const userMessages = messages.filter(m => m.sender === 'user');
  if (userMessages.length === 0) return '';

  try {
    const transcript = messages
      .filter(m => m.sender === 'user' || m.sender === 'ai')
      .slice(-10)
      .map(m => `${m.sender === 'user' ? 'User' : 'AI'}: ${m.text.substring(0, 150)}`)
      .join('\n');

    const response = await generateTextFn(
      `Tom tat ngan gon cuoc tro chuyen sau trong 1-2 cau tieng Viet (toi da 150 ky tu), tap trung vao: san pham/lo duoc hoi, van de chinh:\n\n${transcript}`,
      'Ban la cong cu tom tat hoi thoai. Tra loi ngan gon, suc tich.'
    );
    return response.trim().substring(0, 200);
  } catch {
    const topics = userMessages.slice(0, 2).map(m => m.text.substring(0, 60)).join('; ');
    return `Da hoi ve: ${topics}`;
  }
};
