/**
 * backend/src/utils/correlationId.ts
 * Correlation ID generation and extraction utilities
 */

import { Request } from 'express';

export function generateCorrelationId(prefix: 'SIG' | 'REL' | 'REQ' = 'REQ'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${dateStr}-${randomPart}`;
}

export function extractCorrelationId(req: Request, prefix: 'SIG' | 'REL' = 'SIG'): string {
  const headerId = req.header('x-correlation-id') || req.header('x-request-id');
  if (headerId && typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim();
  }
  const bodyId = req.body?.correlationId;
  if (bodyId && typeof bodyId === 'string' && bodyId.trim()) {
    return bodyId.trim();
  }
  return generateCorrelationId(prefix);
}
