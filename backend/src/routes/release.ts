/**
 * backend/src/routes/release.ts
 * Express router for Batch Release endpoints
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { serverReleaseService } from '../services/releaseService';
import { getDb } from '../config/firebaseAdmin';
import { extractCorrelationId } from '../utils/correlationId';
import { AppError, sendErrorResponse } from '../utils/errors';

export const releaseRouter = Router();

/**
 * POST /api/batch-release/approve
 * Server-authoritative batch release command
 */
releaseRouter.post(
  '/approve',
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    const correlationId = req.correlationId || extractCorrelationId(req, 'REL');
    req.correlationId = correlationId;

    try {
      const user = req.user!;
      const result = await serverReleaseService.approveRelease(
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

      console.error(`[POST /api/batch-release/approve][${correlationId}] Unexpected error:`, err);
      sendErrorResponse(
        res,
        'INTERNAL',
        'Không thể phê duyệt xuất xưởng Lô trên máy chủ.',
        500,
        correlationId
      );
    }
  }
);
