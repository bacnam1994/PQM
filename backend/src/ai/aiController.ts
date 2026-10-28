/**
 * backend/src/ai/aiController.ts
 * AI Controller handling HTTP request validation and AI RBAC enforcement (Phases 3 & 4)
 */

import { Request, Response } from 'express';
import { AppError, sendErrorResponse } from '../utils/errors';
import { extractCorrelationId } from '../utils/correlationId';
import {
  AIAnalyzeRequestSchema,
  AIConfigUpdateSchema,
  AITestConnectionSchema,
  type AIAnalysisType,
} from './aiTypes';
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
    const isConfigured = AIService.isConfigured();

    res.status(200).json({
      success: true,
      data: {
        service: 'pqm-ai-backend',
        model: AIService.getModelName(),
        isConfigured,
        providerStatus: isConfigured ? 'READY' : 'KEY_MISSING',
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
   * Get AI configuration status (ADMIN only, masked secret)
   * GET /api/ai/config
   */
  public static async getConfig(req: Request, res: Response): Promise<void> {
    const correlationId = req.correlationId || extractCorrelationId(req, 'AI');
    const user = req.user;

    if (!user) {
      sendErrorResponse(res, 'UNAUTHENTICATED', 'Yêu cầu đăng nhập.', 401, correlationId);
      return;
    }

    if (!user.isAdmin) {
      sendErrorResponse(
        res,
        'PERMISSION_DENIED',
        'Chỉ Quản trị viên (ADMIN) mới có quyền xem cấu hình máy chủ AI.',
        403,
        correlationId
      );
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        isConfigured: AIService.isConfigured(),
        maskedKey: AIService.getMaskedKey(),
        model: AIService.getModelName(),
        source: AIService.getKeySource(),
        isPersistent: AIService.isPersistent(),
      },
      correlationId,
    });
  }

  /**
   * Update AI configuration (ADMIN only, validates before saving)
   * POST /api/ai/config
   */
  public static async updateConfig(req: Request, res: Response): Promise<void> {
    const correlationId = req.correlationId || extractCorrelationId(req, 'AI');
    const user = req.user;

    if (!user) {
      sendErrorResponse(res, 'UNAUTHENTICATED', 'Yêu cầu đăng nhập.', 401, correlationId);
      return;
    }

    if (!user.isAdmin) {
      sendErrorResponse(
        res,
        'PERMISSION_DENIED',
        'Chỉ Quản trị viên (ADMIN) mới có quyền cập nhật cấu hình máy chủ AI.',
        403,
        correlationId
      );
      return;
    }

    const parseResult = AIConfigUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join(', ');
      sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        `Dữ liệu cấu hình không hợp lệ: ${issues}`,
        400,
        correlationId
      );
      return;
    }

    const { apiKey, model } = parseResult.data;
    try {
      // Test candidate key to ensure it functions properly before persisting
      await AIService.testConnection(apiKey, model);
      // Persist config to runtime
      AIService.setRuntimeConfig(apiKey, model);

      res.status(200).json({
        success: true,
        message:
          'Cấu hình và kiểm tra API Key thành công (Lưu tạm thời trong In-Memory Runtime của máy chủ).',
        warning:
          'LƯU Ý: Khóa API được lưu tạm trong bộ nhớ phiên làm việc của máy chủ và sẽ bị mất khi máy chủ restart hoặc redeploy. Để lưu bền vững vĩnh viễn, vui lòng cấu hình biến GEMINI_API_KEY trong Dashboard của nhà cung cấp hosting backend.',
        data: {
          isConfigured: true,
          maskedKey: AIService.getMaskedKey(),
          model: AIService.getModelName(),
          source: 'RUNTIME',
          isPersistent: false,
        },
        correlationId,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        sendErrorResponse(res, err.code, err.message, err.statusCode, correlationId, err.details);
      } else {
        sendErrorResponse(
          res,
          'AI_UNAVAILABLE',
          `Không thể kích hoạt API Key: ${err.message || String(err)}`,
          400,
          correlationId
        );
      }
    }
  }

  /**
   * Test AI connection (ADMIN only)
   * POST /api/ai/config/test
   */
  public static async testConfig(req: Request, res: Response): Promise<void> {
    const correlationId = req.correlationId || extractCorrelationId(req, 'AI');
    const user = req.user;

    if (!user) {
      sendErrorResponse(res, 'UNAUTHENTICATED', 'Yêu cầu đăng nhập.', 401, correlationId);
      return;
    }

    if (!user.isAdmin) {
      sendErrorResponse(
        res,
        'PERMISSION_DENIED',
        'Chỉ Quản trị viên (ADMIN) mới có quyền kiểm tra kết nối API Key.',
        403,
        correlationId
      );
      return;
    }

    const parseResult = AITestConnectionSchema.safeParse(req.body || {});
    if (!parseResult.success) {
      sendErrorResponse(
        res,
        'VALIDATION_ERROR',
        'Tham số kiểm tra không hợp lệ.',
        400,
        correlationId
      );
      return;
    }

    try {
      const testResult = await AIService.testConnection(
        parseResult.data.apiKey,
        parseResult.data.model
      );
      res.status(200).json({
        success: true,
        message: 'Kết nối Google Gemini API thành công.',
        data: testResult,
        correlationId,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        sendErrorResponse(res, err.code, err.message, err.statusCode, correlationId, err.details);
      } else {
        sendErrorResponse(
          res,
          'AI_UNAVAILABLE',
          `Lỗi kiểm tra kết nối: ${err.message || String(err)}`,
          502,
          correlationId
        );
      }
    }
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
