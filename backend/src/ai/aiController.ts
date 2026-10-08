/**
 * backend/src/ai/aiController.ts
 * AI Controller handling HTTP request validation and AI RBAC enforcement (Phases 3 & 4)
 */

import { Request, Response } from 'express';
import { AppError, sendErrorResponse } from '../utils/errors';
import { extractCorrelationId } from '../utils/correlationId';
import { AIAnalyzeRequestSchema, type AIAnalysisType } from './aiTypes';
import { AIService } from './aiService';

// AI RBAC Feature Permission Map (Phase 3)
const ROLE_ALLOWED_TYPES: Record<string, AIAnalysisType[]> = {
  ADMIN: [
    'batch_analysis',
    'test_result_analysis',
    'deviation_analysis',
    'document_analysis',
    'capa_assistant',
  ],
  QA: [
    'batch_analysis',
    'test_result_analysis',
    'deviation_analysis',
    'document_analysis',
    'capa_assistant',
  ],
  QC: ['test_result_analysis', 'deviation_analysis'],
  USER: ['document_analysis'],
};

export class AIController {
  /**
   * Health & capabilities check
   * GET /api/ai/health
   */
  public static async health(req: Request, res: Response): Promise<void> {
    const correlationId = req.correlationId || extractCorrelationId(req, 'AI');
    const isConfigured = !!process.env.GEMINI_API_KEY;

    res.status(200).json({
      success: true,
      data: {
        service: 'pqm-ai-backend',
        model: AIService.getModelName(),
        isConfigured,
        supportedTypes: [
          'batch_analysis',
          'test_result_analysis',
          'deviation_analysis',
          'document_analysis',
          'capa_assistant',
        ],
      },
      correlationId,
    });
  }

  /**
   * Main analysis endpoint
   * POST /api/ai/analyze
   */
  public static async analyze(req: Request, res: Response): Promise<void> {
    const correlationId = req.correlationId || extractCorrelationId(req, 'AI');
    const user = req.user;

    if (!user) {
      sendErrorResponse(
        res,
        'UNAUTHENTICATED',
        'Yêu cầu đăng nhập trước khi sử dụng AI.',
        401,
        correlationId
      );
      return;
    }

    try {
      // 1. Validate request body against Zod schema
      const parseResult = AIAnalyzeRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        const issues = parseResult.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join(', ');
        sendErrorResponse(
          res,
          'VALIDATION_ERROR',
          `Dữ liệu yêu cầu không hợp lệ: ${issues}`,
          400,
          correlationId
        );
        return;
      }

      const payload = parseResult.data;

      // 2. Server-side RBAC Enforcement (Phase 3)
      const userRole = user.isAdmin ? 'ADMIN' : user.role || 'USER';
      const allowedFeatures = ROLE_ALLOWED_TYPES[userRole] || [];

      if (!user.isAdmin && !allowedFeatures.includes(payload.type)) {
        sendErrorResponse(
          res,
          'AI_PERMISSION_DENIED',
          `Từ chối quyền: Vai trò '${userRole}' không được cấp phép sử dụng tính năng phân tích '${payload.type}'.`,
          403,
          correlationId
        );
        return;
      }

      // 3. Delegate to AIService
      const result = await AIService.analyze(payload, user, correlationId);

      res.status(200).json({
        success: true,
        data: result.data,
        metadata: result.metadata,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        sendErrorResponse(res, err.code, err.message, err.statusCode, correlationId, err.details);
      } else {
        console.error(`[AIController][${correlationId}] Unexpected error:`, err);
        sendErrorResponse(
          res,
          'INTERNAL',
          `Lỗi máy chủ khi xử lý phân tích AI: ${err.message || String(err)}`,
          500,
          correlationId
        );
      }
    }
  }
}
