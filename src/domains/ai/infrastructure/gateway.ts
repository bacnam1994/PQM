/**
 * AI BOUNDARY DOMAIN: INFRASTRUCTURE GATEWAY (VS-15)
 * ===================================================
 * Gateway trừu tượng kết nối AI Inference Providers (Gemini / Offline OCR).
 * Tuân thủ FDA AI/ML GMLP & ALCOA+ Traceability.
 */

import { createGoogleGenerativeAI } from '../../../services/ai/geminiClientLoader';
import { getApiKey, getGeminiModel, formatGeminiError } from '../../../services/ai/geminiService';
import { promptRegistry, PromptDefinition } from '../../../services/ai/promptRegistry';
import { logAuditAction } from '../../../services/auditService';
import { semanticCache } from '../../../services/ai/semanticCacheService';
import { AIBoundaryRules } from '../domain/rules';
import { AIGatewayRequest, AIGatewayResponse } from '../domain/types';

export class AIGatewayService {
  private fallbackModel = 'gemini-2.0-flash';

  /**
   * Tính toán điểm tin cậy chuẩn hóa (0.0 -> 1.0)
   */
  private calculateConfidenceScore(data: any): { score: number; level: 'HIGH' | 'MEDIUM' | 'LOW' } {
    return AIBoundaryRules.calculateConfidenceScore(data);
  }

  /**
   * Thực thi yêu cầu AI với Quản trị phiên bản & Ghi vết Audit Trail
   */
  async execute<TInput = any, TOutput = any>(
    request: AIGatewayRequest<TInput>
  ): Promise<AIGatewayResponse<TOutput>> {
    const startTime = performance.now();
    const executedAt = new Date().toISOString();

    // 1. Phân giải Prompt Definition từ PromptRegistry
    const promptDef: PromptDefinition = promptRegistry.getPrompt(
      request.promptId,
      request.promptVersion
    );

    const primaryModel = request.options?.modelOverride || getGeminiModel();
    let currentModel = primaryModel;
    let rawText = '';
    let parsedData: TOutput | undefined;
    let errorMessage: string | undefined;

    // 2. Tra cứu Semantic Cache (Phản hồi tức thì < 50ms & Tiết kiệm token)
    const cached = semanticCache.get<TOutput>(request);
    if (cached) {
      const cacheLatencyMs = Math.round(performance.now() - startTime);
      try {
        logAuditAction({
          action: 'UPDATE',
          collection: 'AI_GATEWAY',
          documentId: `${promptDef.id}@${promptDef.version}`,
          details: `[AI Cache Hit] Prompt: ${promptDef.id} (v${promptDef.version}) | Mode: ${cached.isExactMatch ? 'EXACT' : 'SEMANTIC'} (${Math.round(cached.similarity * 100)}%) | Latency: ${cacheLatencyMs}ms`,
          performedBy: request.options?.userEmail || 'AI_GATEWAY',
        });
      } catch (auditErr) {
        console.warn('[AIGateway] Ghi audit trail cache hit thất bại:', auditErr);
      }

      return {
        success: true,
        data: cached.data,
        metadata: {
          promptId: promptDef.id,
          promptVersion: promptDef.version,
          modelUsed: `${primaryModel} (cached)`,
          latencyMs: cacheLatencyMs,
          confidenceScore: cached.confidenceScore,
          confidenceLevel: 'HIGH',
          executedAt,
          isCached: true,
          similarity: cached.similarity,
        },
      };
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      errorMessage = 'Chưa cấu hình Gemini API Key.';
      return {
        success: false,
        error: errorMessage,
        metadata: {
          promptId: promptDef.id,
          promptVersion: promptDef.version,
          modelUsed: primaryModel,
          latencyMs: Math.round(performance.now() - startTime),
          confidenceScore: 0,
          confidenceLevel: 'LOW',
          executedAt,
        },
      };
    }

    const genAI = await createGoogleGenerativeAI(apiKey);

    // 2. Gọi model với cơ chế Fallback
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const generationConfig: any = {
          temperature: request.options?.temperature ?? promptDef.temperature,
          responseMimeType: 'application/json',
        };

        if (request.options?.responseSchema) {
          generationConfig.responseSchema = request.options.responseSchema;
        }

        const model = genAI.getGenerativeModel({
          model: currentModel,
          generationConfig,
        });

        const promptInput =
          typeof request.input === 'string' ? request.input : JSON.stringify(request.input);

        const result = await model.generateContent([promptDef.systemPrompt, promptInput]);

        rawText = result.response.text();
        parsedData = JSON.parse(rawText) as TOutput;
        break; // Thành công
      } catch (err: any) {
        const msg = String(err?.message || '');
        if ((msg.includes('429') || msg.includes('503')) && currentModel !== this.fallbackModel) {
          console.warn(
            `[AIGateway] Model ${currentModel} quá tải. Chuyển sang fallback ${this.fallbackModel}...`
          );
          currentModel = this.fallbackModel;
          continue;
        }

        if (attempt === maxRetries) {
          errorMessage = formatGeminiError(err);
        }
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const { score, level } = this.calculateConfidenceScore(parsedData);

    // 3. Ghi vết Audit Trail cho lần suy luận AI (FDA ALCOA+ Compliance)
    try {
      logAuditAction({
        action: 'UPDATE',
        collection: 'AI_GATEWAY',
        documentId: `${promptDef.id}@${promptDef.version}`,
        details: `[AI Inference] Prompt: ${promptDef.id} (v${promptDef.version}) | Model: ${currentModel} | Latency: ${latencyMs}ms | Confidence: ${score} (${level}) | Status: ${parsedData ? 'SUCCESS' : 'FAILED'}${request.options?.documentId ? ` | DocId: ${request.options.documentId}` : ''}`,
        performedBy: request.options?.userEmail || 'AI_GATEWAY',
      });
    } catch (auditErr) {
      console.warn('[AIGateway] Ghi audit trail thất bại:', auditErr);
    }

    if (!parsedData) {
      return {
        success: false,
        error: errorMessage || 'Không thể trích xuất kết quả từ mô hình AI.',
        metadata: {
          promptId: promptDef.id,
          promptVersion: promptDef.version,
          modelUsed: currentModel,
          latencyMs,
          confidenceScore: 0,
          confidenceLevel: 'LOW',
          executedAt,
        },
      };
    }

    // 4. Lưu kết quả suy luận vào Semantic Cache
    try {
      const ttlMs = request.options?.ttlMinutes
        ? request.options.ttlMinutes * 60 * 1000
        : undefined;
      semanticCache.set(request, parsedData, score, ttlMs);
    } catch (cacheErr) {
      console.warn('[AIGateway] Lưu semantic cache thất bại:', cacheErr);
    }

    return {
      success: true,
      data: parsedData,
      metadata: {
        promptId: promptDef.id,
        promptVersion: promptDef.version,
        modelUsed: currentModel,
        latencyMs,
        confidenceScore: score,
        confidenceLevel: level,
        executedAt,
      },
    };
  }
}

export const aiGateway = new AIGatewayService();
