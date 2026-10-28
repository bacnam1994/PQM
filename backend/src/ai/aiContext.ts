/**
 * backend/src/ai/aiContext.ts
 * Server-Side Context Builder for AI Intelligence Suite (Phase 5)
 *
 * Guarantees bounded data extraction, secret sanitization, context hashing,
 * and valid record ID tracking for Hallucination Guard.
 */

import crypto from 'crypto';
import { getDb } from '../config/firebaseAdmin';
import { AppError } from '../utils/errors';
import type { AIAnalyzeRequest, BuiltContext } from './aiTypes';

/**
 * Strips sensitive fields like passwords, tokens, API keys, credentials.
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const cleaned: Record<string, any> = {};
  const sensitiveKeys = new Set([
    'password',
    'passwordHash',
    'token',
    'secret',
    'apiKey',
    'privateKey',
    'salt',
    'pin',
    'credential',
    'accessToken',
    'refreshToken',
  ]);

  for (const [key, val] of Object.entries(obj)) {
    if (sensitiveKeys.has(key.toLowerCase())) {
      continue;
    }
    cleaned[key] = sanitizeObject(val);
  }
  return cleaned;
}

export class AIContextBuilder {
  /**
   * Builds bounded, sanitized context for AI analysis
   */
  public static async build(req: AIAnalyzeRequest): Promise<BuiltContext> {
    const db = getDb();
    const validRecordIds = new Set<string>();
    const inputRecordIds: string[] = [];
    const rawData: Record<string, any> = {};

    switch (req.type) {
      case 'batch_analysis': {
        if (!req.batchId) {
          throw new AppError(
            'AI_CONTEXT_INVALID',
            'Yêu cầu phân tích Lô cần cung cấp batchId.',
            400
          );
        }
        inputRecordIds.push(req.batchId);
        validRecordIds.add(req.batchId);

        // 1. Load batch
        const batchSnap = await db.ref(`batches/${req.batchId}`).once('value');
        if (!batchSnap.exists()) {
          throw new AppError(
            'BATCH_NOT_FOUND',
            `Không tìm thấy Lô sản xuất '${req.batchId}'.`,
            404
          );
        }
        const batchData = sanitizeObject(batchSnap.val());
        rawData.batch = batchData;
        if (batchData.batchNo) validRecordIds.add(String(batchData.batchNo));
        if (batchData.productId) validRecordIds.add(String(batchData.productId));
        if (batchData.tccsId) validRecordIds.add(String(batchData.tccsId));

        // 2. Load associated Test Results (limit to this batch only)
        const trSnap = await db
          .ref('testResults')
          .orderByChild('batchId')
          .equalTo(req.batchId)
          .once('value');
        const testResults: any[] = [];
        if (trSnap.exists()) {
          trSnap.forEach((childSnap: any) => {
            const tr = sanitizeObject(childSnap.val());
            const trId = childSnap.key || tr.id;
            if (trId) {
              validRecordIds.add(String(trId));
              inputRecordIds.push(String(trId));
            }
            if (tr.reportNumber) validRecordIds.add(String(tr.reportNumber));
            testResults.push(tr);
          });
        }
        rawData.testResults = testResults;

        // 3. Load associated TCCS if exists
        if (batchData.tccsId) {
          const tccsSnap = await db.ref(`tccsList/${batchData.tccsId}`).once('value');
          if (tccsSnap.exists()) {
            const tccs = sanitizeObject(tccsSnap.val());
            rawData.specification = tccs;
            if (tccs.code) validRecordIds.add(String(tccs.code));
            if (tccs.id) validRecordIds.add(String(tccs.id));
          }
        }

        // 4. Load deviations if exists
        try {
          const devSnap = await db
            .ref('deviations')
            .orderByChild('batchId')
            .equalTo(req.batchId)
            .once('value');
          const deviations: any[] = [];
          if (devSnap.exists()) {
            devSnap.forEach((childSnap: any) => {
              const dev = sanitizeObject(childSnap.val());
              const devId = childSnap.key || dev.id;
              if (devId) {
                validRecordIds.add(String(devId));
                inputRecordIds.push(String(devId));
              }
              if (dev.code) validRecordIds.add(String(dev.code));
              deviations.push(dev);
            });
          }
          rawData.deviations = deviations;
        } catch {
          rawData.deviations = [];
        }
        break;
      }

      case 'test_result_analysis': {
        const trId = req.testResultId || req.batchId;
        if (!trId) {
          throw new AppError(
            'AI_CONTEXT_INVALID',
            'Yêu cầu phân tích kết quả kiểm nghiệm cần testResultId.',
            400
          );
        }
        inputRecordIds.push(trId);
        validRecordIds.add(trId);

        const trSnap = await db.ref(`testResults/${trId}`).once('value');
        if (!trSnap.exists()) {
          throw new AppError(
            'AI_CONTEXT_INVALID',
            `Không tìm thấy Phiếu kiểm nghiệm '${trId}'.`,
            404
          );
        }
        const trData = sanitizeObject(trSnap.val());
        rawData.testResult = trData;
        if (trData.reportNumber) validRecordIds.add(String(trData.reportNumber));
        if (trData.batchId) {
          validRecordIds.add(String(trData.batchId));
          const batchSnap = await db.ref(`batches/${trData.batchId}`).once('value');
          if (batchSnap.exists()) {
            rawData.batch = sanitizeObject(batchSnap.val());
          }
        }
        if (trData.tccsId) {
          validRecordIds.add(String(trData.tccsId));
          const tccsSnap = await db.ref(`tccsList/${trData.tccsId}`).once('value');
          if (tccsSnap.exists()) {
            rawData.specification = sanitizeObject(tccsSnap.val());
          }
        }
        break;
      }

      case 'deviation_analysis':
      case 'capa_assistant': {
        const devId = req.deviationId || req.batchId;
        if (!devId) {
          throw new AppError('AI_CONTEXT_INVALID', 'Yêu cầu cần cung cấp deviationId.', 400);
        }
        inputRecordIds.push(devId);
        validRecordIds.add(devId);

        const devSnap = await db.ref(`deviations/${devId}`).once('value');
        if (devSnap.exists()) {
          const devData = sanitizeObject(devSnap.val());
          rawData.deviation = devData;
          if (devData.code) validRecordIds.add(String(devData.code));
          if (devData.batchId) validRecordIds.add(String(devData.batchId));
        } else {
          rawData.deviation = { id: devId, description: 'Bản ghi sự cố / sai lệch' };
        }
        break;
      }

      case 'document_analysis': {
        const docId = req.documentId || req.batchId;
        if (!docId) {
          throw new AppError('AI_CONTEXT_INVALID', 'Yêu cầu cần cung cấp documentId.', 400);
        }
        inputRecordIds.push(docId);
        validRecordIds.add(docId);

        // Check documents or tccs
        const docSnap = await db.ref(`documents/${docId}`).once('value');
        if (docSnap.exists()) {
          rawData.document = sanitizeObject(docSnap.val());
        } else {
          const tccsSnap = await db.ref(`tccsList/${docId}`).once('value');
          if (tccsSnap.exists()) {
            rawData.document = sanitizeObject(tccsSnap.val());
          } else {
            rawData.document = { id: docId, name: `Tài liệu ${docId}` };
          }
        }
        break;
      }

      default:
        throw new AppError('AI_CONTEXT_INVALID', `Loại phân tích '${req.type}' không hợp lệ.`, 400);
    }

    // Format bounded context string
    const contextText = JSON.stringify(rawData, null, 2);

    // Compute cryptographic SHA-256 hash of the context
    const contextHash = crypto.createHash('sha256').update(contextText, 'utf8').digest('hex');

    return {
      type: req.type,
      contextText,
      contextHash,
      validRecordIds,
      inputRecordIds,
      rawData,
    };
  }
}
