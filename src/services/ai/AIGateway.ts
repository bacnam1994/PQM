/**
 * PQM 3.0 - Centralized AI Gateway (FDA AI/ML GMLP & ALCOA+ Compliant)
 * ====================================================================
 * Điểm điều phối tập trung duy nhất cho toàn bộ các tác vụ AI trong hệ thống:
 * 1. Đảm bảo 100% lệnh gọi AI được gán mã phiên bản Prompt chính thức từ PromptRegistry.
 * 2. Giám sát độ trễ (Latency), mô hình sử dụng, điểm tin cậy (Confidence Score).
 * 3. Ghi vết Audit Trail tự động cho mọi lần thực thi suy luận AI (ALCOA+ Traceability).
 * 4. Cơ chế chuyển đổi mô hình dự phòng (Automatic Model Fallback: 2.5 Flash -> 2.0 Flash) khi gặp lỗi 429/503.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getApiKey, getGeminiModel, formatGeminiError } from './geminiService';
import { promptRegistry, PromptIdentifier, PromptDefinition } from './promptRegistry';
import { logAuditAction } from '../auditService';

export interface AIGatewayRequest<TInput = any> {
  promptId: PromptIdentifier;
  promptVersion?: string;
  input: TInput;
  options?: {
    modelOverride?: string;
    temperature?: number;
    userId?: string;
    userEmail?: string;
    documentType?: string;
    documentId?: string;
    responseSchema?: any;
  };
}

export interface AIGatewayResponse<TOutput = any> {
  success: boolean;
  data?: TOutput;
  error?: string;
  metadata: {
    promptId: PromptIdentifier;
    promptVersion: string;
    modelUsed: string;
    latencyMs: number;
    confidenceScore: number; // Thang điểm 0.0 -> 1.0
    confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    executedAt: string;
  };
}

export class AIGatewayService {
  private fallbackModel = 'gemini-2.0-flash';

  /**
   * Tính toán điểm tin cậy chuẩn hóa (0.0 -> 1.0)
   */
  private calculateConfidenceScore(data: any): { score: number; level: 'HIGH' | 'MEDIUM' | 'LOW' } {
    if (!data) return { score: 0.5, level: 'MEDIUM' };

    // 1. Nếu kết quả trả về có trường confidence cụ thể
    if (typeof data.confidence === 'number') {
      const score = Math.max(0, Math.min(1, data.confidence));
      return {
        score,
        level: score >= 0.85 ? 'HIGH' : score >= 0.65 ? 'MEDIUM' : 'LOW'
      };
    }

    if (typeof data.confidence === 'string') {
      const upper = data.confidence.toUpperCase();
      if (upper === 'HIGH') return { score: 0.95, level: 'HIGH' };
      if (upper === 'MEDIUM') return { score: 0.75, level: 'MEDIUM' };
      if (upper === 'LOW') return { score: 0.50, level: 'LOW' };
    }

    // 2. Nếu có danh sách items/criteria có confidence
    if (Array.isArray(data.items) || Array.isArray(data.criteria) || Array.isArray(data.results)) {
      const list = (data.items || data.criteria || data.results) as any[];
      if (list.length > 0) {
        let totalScore = 0;
        let count = 0;
        for (const item of list) {
          if (typeof item.confidence === 'string') {
            const u = item.confidence.toUpperCase();
            totalScore += (u === 'HIGH' ? 0.95 : u === 'LOW' ? 0.5 : 0.75);
            count++;
          } else if (typeof item.confidence === 'number') {
            totalScore += item.confidence;
            count++;
          }
        }
        if (count > 0) {
          const avg = totalScore / count;
          return {
            score: Number(avg.toFixed(2)),
            level: avg >= 0.85 ? 'HIGH' : avg >= 0.65 ? 'MEDIUM' : 'LOW'
          };
        }
      }
    }

    // Mặc định cho suy luận thành công
    return { score: 0.90, level: 'HIGH' };
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
          executedAt
        }
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

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

        const promptInput = typeof request.input === 'string'
          ? request.input
          : JSON.stringify(request.input);

        const result = await model.generateContent([
          promptDef.systemPrompt,
          promptInput,
        ]);

        rawText = result.response.text();
        parsedData = JSON.parse(rawText) as TOutput;
        break; // Thành công
      } catch (err: any) {
        const msg = String(err?.message || '');
        if ((msg.includes('429') || msg.includes('503')) && currentModel !== this.fallbackModel) {
          console.warn(`[AIGateway] Model ${currentModel} quá tải. Chuyển sang fallback ${this.fallbackModel}...`);
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
        performedBy: request.options?.userEmail || 'AI_GATEWAY'
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
          executedAt
        }
      };
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
        executedAt
      }
    };
  }
}

export const aiGateway = new AIGatewayService();
