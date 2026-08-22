import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordHighConfidenceOCRMappings,
  detectHighFrequencyMappings,
  generateRuleBasedInsights,
  loadCachedInsights,
  saveCachedInsights,
  clearInsightCache,
  saveSessionMemory,
  loadSessionMemory,
  clearSessionMemory,
  buildSessionMemoryPrompt,
  summarizeSessionWithAI,
} from './autoLearningService';
import { useAppStore } from '../../store/useAppStore';

describe('autoLearningService - AI Self-Learning Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Pattern Mining & High-Frequency Mappings', () => {
    it('should detect mappings with frequency >= threshold and sort descending', () => {
      const mockLearnedMappings = [
        { id: '1', originalName: 'Do am', systemName: 'Độ ẩm', frequency: 5, lastUpdated: '2026-01-01' },
        { id: '2', originalName: 'Ham luong Fe', systemName: 'Hàm lượng Sắt', frequency: 2, lastUpdated: '2026-01-01' },
        { id: '3', originalName: 'Loss on drying', systemName: 'Mất khối lượng do làm khô', frequency: 7, lastUpdated: '2026-01-01' },
      ];

      const highFreq = detectHighFrequencyMappings(mockLearnedMappings as any, 3);
      expect(highFreq).toHaveLength(2);
      expect(highFreq[0].originalName).toBe('Loss on drying');
      expect(highFreq[0].frequency).toBe(7);
      expect(highFreq[1].originalName).toBe('Do am');
      expect(highFreq[1].frequency).toBe(5);
    });

    it('should return empty array if no mappings meet threshold', () => {
      const mockLearnedMappings = [
        { id: '1', originalName: 'Do am', systemName: 'Độ ẩm', frequency: 1, lastUpdated: '2026-01-01' },
      ];

      const highFreq = detectHighFrequencyMappings(mockLearnedMappings as any, 3);
      expect(highFreq).toHaveLength(0);
    });
  });

  describe('2. Post-OCR High-Confidence Recording', () => {
    it('should skip duplicate and identical name pairs', () => {
      const addMock = vi.fn();
      vi.spyOn(useAppStore, 'getState').mockReturnValue({
        aiLearnedMappings: [
          { id: '1', originalName: 'Moisture', systemName: 'Độ ẩm', frequency: 1, lastUpdated: '2026-01-01' },
        ],
        addAiLearnedMapping: addMock,
      } as any);

      recordHighConfidenceOCRMappings([
        { originalName: 'Độ ẩm', systemName: 'Độ ẩm' }, // Identical -> skip
        { originalName: 'Moisture', systemName: 'Độ ẩm' }, // Already exists -> skip
        { originalName: 'Lead content', systemName: 'Chì (Pb)' }, // New -> should add
      ]);

      expect(addMock).toHaveBeenCalledTimes(1);
      expect(addMock).toHaveBeenCalledWith('Lead content', 'Chì (Pb)');
    });
  });

  describe('3. Rule-Based AI Quality Insight Engine', () => {
    it('should detect high fail rate products (>=30% failure rate with >= 3 batches)', () => {
      const appContext = {
        products: [
          { id: 'prod_1', name: 'Viên ngậm Hoạt Huyết' },
        ],
        batches: [
          { id: 'b_1', productId: 'prod_1', batchNo: 'HH001' },
          { id: 'b_2', productId: 'prod_1', batchNo: 'HH002' },
          { id: 'b_3', productId: 'prod_1', batchNo: 'HH003' },
        ],
        testResults: [
          { id: 'tr_1', batchId: 'b_1', overallStatus: 'FAIL' },
          { id: 'tr_2', batchId: 'b_2', overallStatus: 'FAIL' },
          { id: 'tr_3', batchId: 'b_3', overallStatus: 'PASS' },
        ],
        aiLearnedMappings: [],
      };

      const insights = generateRuleBasedInsights(appContext);
      const failInsight = insights.find(i => i.type === 'HIGH_FAIL_RATE');

      expect(failInsight).toBeDefined();
      expect(failInsight?.productId).toBe('prod_1');
      expect(failInsight?.severity).toBe('HIGH'); // 67% >= 50%
      expect(failInsight?.title).toContain('Viên ngậm Hoạt Huyết');
    });

    it('should detect batches expiring within 60 days', () => {
      const in20Days = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const appContext = {
        products: [{ id: 'prod_1', name: 'Siro Ho' }],
        batches: [
          { id: 'b_1', productId: 'prod_1', batchNo: 'SH2026-01', expDate: in20Days, status: 'RELEASED' },
        ],
        testResults: [],
        aiLearnedMappings: [],
      };

      const insights = generateRuleBasedInsights(appContext);
      const expiryInsight = insights.find(i => i.type === 'EXPIRY_RISK');

      expect(expiryInsight).toBeDefined();
      expect(expiryInsight?.title).toContain('1 lo sap het han');
    });

    it('should detect monotonic drift trend in criteria values across 3 batches', () => {
      const appContext = {
        products: [{ id: 'prod_1', name: 'Viên nang B Complex' }],
        batches: [
          { id: 'b_1', productId: 'prod_1', batchNo: 'BC01' },
          { id: 'b_2', productId: 'prod_1', batchNo: 'BC02' },
          { id: 'b_3', productId: 'prod_1', batchNo: 'BC03' },
        ],
        testResults: [
          { id: 'tr_1', batchId: 'b_1', results: [{ criteriaName: 'Độ ẩm', value: '4.2' }] },
          { id: 'tr_2', batchId: 'b_2', results: [{ criteriaName: 'Độ ẩm', value: '5.1' }] },
          { id: 'tr_3', batchId: 'b_3', results: [{ criteriaName: 'Độ ẩm', value: '6.0' }] },
        ],
        aiLearnedMappings: [],
      };

      const insights = generateRuleBasedInsights(appContext);
      const driftInsight = insights.find(i => i.type === 'DRIFT_RISK');

      expect(driftInsight).toBeDefined();
      expect(driftInsight?.criteriaName).toBe('Độ ẩm');
      expect(driftInsight?.detail).toContain('tang lien tiep');
    });
  });

  describe('4. Session Memory Snapshot', () => {
    const userId = 'user_test_123';

    it('should save and load session memory correctly up to limit', () => {
      saveSessionMemory(userId, 'Người dùng đã kiểm tra lô HH001 và hỏi về tiêu chuẩn độ ẩm.', 'gemini-2.5-flash');
      saveSessionMemory(userId, 'Người dùng đã tạo phiếu kiểm nghiệm cho lô BC02.', 'gemini-2.5-flash');

      const loaded = loadSessionMemory(userId);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].summary).toContain('BC02');
      expect(loaded[1].summary).toContain('HH001');
    });

    it('should build session memory prompt string for AI context injection', () => {
      saveSessionMemory(userId, 'Đã tra cứu công thức sản phẩm Vitamin C.');

      const prompt = buildSessionMemoryPrompt(userId);
      expect(prompt).toContain('LICH SU HOI THOAI GAN DAY');
      expect(prompt).toContain('Vitamin C');
    });

    it('should clear session memory when requested', () => {
      saveSessionMemory(userId, 'Session to clear');
      clearSessionMemory(userId);
      expect(loadSessionMemory(userId)).toHaveLength(0);
      expect(buildSessionMemoryPrompt(userId)).toBe('');
    });

    it('should summarize session using AI fallback when AI fails', async () => {
      const messages = [
        { sender: 'user', text: 'Kiểm tra độ ẩm của viên nang Calci D3' },
        { sender: 'ai', text: 'Độ ẩm của viên nang Calci D3 đạt 4.5% theo TCCS.' },
      ];

      const summary = await summarizeSessionWithAI(messages, async () => {
        throw new Error('API down');
      });

      expect(summary).toContain('Da hoi ve: Kiểm tra độ ẩm của viên nang Calci D3');
    });
  });

  describe('5. Insight Cache Management', () => {
    it('should save, load, and clear cached insights', () => {
      const sampleInsights = [
        {
          id: 'ins_1',
          type: 'QUALITY_TREND' as const,
          severity: 'LOW' as const,
          title: 'Xu hướng chất lượng ổn định',
          detail: '100% lô đạt tiêu chuẩn trong tuần qua.',
          generatedAt: new Date().toISOString(),
        }
      ];

      saveCachedInsights(sampleInsights);
      const loaded = loadCachedInsights();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].title).toBe('Xu hướng chất lượng ổn định');

      clearInsightCache();
      expect(loadCachedInsights()).toHaveLength(0);
    });
  });
});
