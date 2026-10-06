/**
 * backend/src/routes/signature.ts
 * Express router for Electronic Signature endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requireFreshSession } from '../middleware/auth';
import { serverSignatureService } from '../services/signatureService';
import { getDb } from '../config/firebaseAdmin';
import { extractCorrelationId } from '../utils/correlationId';
import { AppError, sendErrorResponse } from '../utils/errors';

export const signatureRouter = Router();

/**
 * POST /api/signatures
 * Create canonical 21 CFR Part 11 compliant electronic signature
 */
signatureRouter.post(
  '/',
  authenticateToken,
  requireFreshSession(300),
  async (req: Request, res: Response): Promise<void> => {
    const correlationId = req.correlationId || extractCorrelationId(req, 'SIG');
    req.correlationId = correlationId;

    try {
      const user = req.user!;
      const result = await serverSignatureService.createSignature(
        user,
        req.body,
        correlationId,
        getDb()
      );

      res.status(200).json(result);
    } catch (err: any) {
      if (err instanceof AppError) {
        sendErrorResponse(res, err.code, err.message, err.statusCode, correlationId, err.details);
        return;
      }

      console.error(`[POST /api/signatures][${correlationId}] Unexpected error:`, err);
      sendErrorResponse(
        res,
        'INTERNAL',
        'Không thể tạo chữ ký điện tử trên máy chủ.',
        500,
        correlationId
      );
    }
  }
);
