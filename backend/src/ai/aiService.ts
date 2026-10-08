/**
 * backend/src/ai/aiService.ts
 * Server-Authoritative AI Intelligence Service (Phases 1, 8, 10, 11, 12, 13)
 *
 * Coordinates Context Building, Prompt Versioning, Gemini API execution,
 * Schema & Hallucination Guard Validation, Audit Logging, and Rate Limiting.
 * STRICTLY READ-ONLY: Never writes or mutates batch, test, or signature records.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppError } from '../utils/errors';
import type { AuthenticatedUser } from '../middleware/auth';
import type { AIAnalyzeRequest, AISummaryResult, AIAuditMetadata } from './aiTypes';
import { AIContextBuilder } from './aiContext';
import { getPromptConfig } from './aiPrompt';
import { AIValidator } from './aiValidator';
import { AIAuditLogger } from './aiAudit';
import { AIRateLimiter } from './aiRateLimit';

export type ModelCallerFn = (
  systemPrompt: string,
  userPrompt: string,
  model: string
) => Promise<string>;

let customModelCaller: ModelCallerFn | null = null;

export function setCustomModelCaller(caller: ModelCallerFn | null): void {
  customModelCaller = caller;
}

export class AIService {
  public static getModelName(): string {
    return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  private static getApiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new AppError(
        'AI_UNAVAILABLE',
        'Máy chủ AI chưa được cấu hình GEMINI_API_KEY. Vui lòng thiết lập biến môi trường ở backend.',
        503
      );
    }
    return key;
  }

  /**
   * Invokes Gemini model (or test mock caller)
   */
  private static async invokeModel(
    systemPrompt: string,
    userPrompt: string,
    modelName: string
  ): Promise<string> {
    if (customModelCaller) {
      return await customModelCaller(systemPrompt, userPrompt, modelName);
    }

    const apiKey = this.getApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    try {
      const result = await model.generateContent(userPrompt);
      const response = await result.response;
      return response.text();
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        throw new AppError(
          'AI_RATE_LIMITED',
          'Đã vượt quá hạn mức truy vấn Google Gemini API (Quota Exceeded). Vui lòng thử lại sau.',
          429
        );
      }
      if (
        msg.includes('503') ||
        msg.includes('Service Unavailable') ||
        msg.includes('overloaded')
      ) {
        throw new AppError(
          'AI_UNAVAILABLE',
          'Dịch vụ Google Gemini hiện đang quá tải hoặc tạm thời gián đoạn (503).',
          503
        );
      }
      throw new AppError('AI_UNAVAILABLE', `Lỗi khi giao tiếp với Gemini API: ${msg}`, 502);
    }
  }

  /**
   * Main AI analysis pipeline
   */
  public static async analyze(
    req: AIAnalyzeRequest,
    user: AuthenticatedUser,
    correlationId: string
  ): Promise<{ data: AISummaryResult; metadata: AIAuditMetadata }> {
    // 1. Rate limiting check (Phase 13)
    AIRateLimiter.checkRateLimit(user.uid);

    // 2. Build bounded context (Phase 5)
    const context = await AIContextBuilder.build(req);

    // 3. Prompt management & versioning (Phase 6)
    const promptConfig = getPromptConfig(req.type);
    const userPrompt = promptConfig.buildPrompt(context.contextText, req.promptOverride);
    const modelName = this.getModelName();

    // 4. Model execution (Phase 1)
    const rawResponse = await this.invokeModel(promptConfig.systemPrompt, userPrompt, modelName);

    // 5. Schema validation & Hallucination Guard (Phase 7, 8, 9, 11)
    const rawJson = AIValidator.parseJsonFromResponse(rawResponse);
    const validatedData = AIValidator.validateAndGuard(rawJson, context.validRecordIds);

    // 6. Audit Trail Logging (Phase 12)
    const aiAnalysisId = AIAuditLogger.generateAnalysisId();
    const metadata: AIAuditMetadata = {
      aiAnalysisId,
      uid: user.uid,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
      model: modelName,
      promptVersion: promptConfig.promptVersion,
      analysisType: req.type,
      contextHash: context.contextHash,
      inputRecordIds: context.inputRecordIds,
      correlationId,
    };

    await AIAuditLogger.recordAudit(metadata, validatedData);

    return {
      data: validatedData,
      metadata,
    };
  }
}
