import { generateAIInsights } from '../autoLearningService';

/**
 * Sinh và trả về danh sách phân tích chất lượng chủ động (AI Insights)
 */
export const getAIInsights = async (
  args: { forceRefresh?: boolean },
  appContext: any,
  generateText?: (prompt: string, systemPrompt?: string) => Promise<string>
) => {
  try {
    const { clearInsightCache } = await import('../autoLearningService');
    if (args.forceRefresh) clearInsightCache();
    const insights = await generateAIInsights(appContext, generateText || (async () => ''));
    if (insights.length === 0) {
      return { count: 0, message: 'Hệ thống hoạt động tốt. Không phát hiện vấn đề chất lượng nào đáng chú ý.' };
    }
    const insightLines = insights.map(i => {
      const badge = i.severity === 'HIGH' ? '[CAO]' : i.severity === 'MEDIUM' ? '[TB]' : '[THAP]';
      return badge + ' **' + i.title + '**\n' + i.detail;
    }).join('\n\n---\n\n');
    return { count: insights.length, message: '### AI Insights\n\n' + insightLines, insights };
  } catch (e: any) {
    return { error: e.message };
  }
};
