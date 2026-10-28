/**
 * AI BOUNDARY DOMAIN: QUERIES (VS-15)
 * ===================================
 * Cung cấp điểm truy vấn đồng nhất cho AI Domain (Read-Only side).
 */

import { hasAIDraft, peekAIDraft } from './aiDraftManager';
import { AIDraftEnvelope } from '../domain/types';

export class AIQueries {
  static hasActiveDraft(): boolean {
    return hasAIDraft();
  }

  static getActiveDraft<T = any>(): AIDraftEnvelope<T> | null {
    return peekAIDraft<T>();
  }
}
