/**
 * backend/src/utils/errors.ts
 * Standardized Error types and codes for PQM Backend Authority
 */

import { Response } from 'express';

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_ERROR'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_CONSUMED'
  | 'BATCH_NOT_FOUND'
  | 'BATCH_STATE_INVALID'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'CHECKSUM_MISMATCH'
  | 'AI_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_CONTEXT_INVALID'
  | 'AI_PERMISSION_DENIED'
  | 'AI_AUTH_REQUIRED'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 400,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export interface StandardErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    correlationId: string;
    details?: any;
  };
}

export function sendErrorResponse(
  res: Response,
  code: ErrorCode,
  message: string,
  statusCode: number,
  correlationId: string,
  details?: any
): void {
  const payload: StandardErrorResponse = {
    success: false,
    error: {
      code,
      message,
      correlationId,
      ...(details !== undefined ? { details } : {}),
    },
  };
  res.status(statusCode).json(payload);
}
