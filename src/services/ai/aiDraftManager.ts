// src/services/ai/aiDraftManager.ts

export interface AIDraftEnvelope<T = any> {
  id: string;
  source: 'global-ai-assistant' | 'test-result-ai';
  createdAt: number;
  expiresAt: number;
  consumedAt?: number;
  data: T;
}

export interface NormalizedAITestResultItem {
  criteriaName: string;
  value: string;
  unit: string;
  limit: string;
}

export interface NormalizedAIData {
  labName?: string;
  testDate?: string;
  batchNo?: string;
  batchId?: string;
  productName?: string;
  productCode?: string;
  mfgDate?: string;
  expDate?: string;
  testResults: NormalizedAITestResultItem[];
}

const STORAGE_KEY = 'pqm:ai-draft:test-result';
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function safeRead(): AIDraftEnvelope | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;

    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.id !== 'string' ||
      typeof parsed.createdAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      !('data' in parsed)
    ) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch (error) {
    console.warn('[AI Draft] Không thể đọc sessionStorage:', error);
    return null;
  }
}

export function writeAIDraft<T>(data: T): string | null {
  try {
    if (typeof sessionStorage === 'undefined') return null;

    const now = Date.now();
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `ai_${now}_${Math.random().toString(36).slice(2)}`;

    const envelope: AIDraftEnvelope<T> = {
      id,
      source: 'global-ai-assistant',
      createdAt: now,
      expiresAt: now + TTL_MS,
      data,
    };

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return id;
  } catch (error) {
    console.warn('[AI Draft] Không thể lưu sessionStorage:', error);
    return null;
  }
}

export function peekAIDraft<T = any>(): AIDraftEnvelope<T> | null {
  return safeRead() as AIDraftEnvelope<T> | null;
}

export function consumeAIDraft<T = any>(): AIDraftEnvelope<T> | null {
  const draft = safeRead() as AIDraftEnvelope<T> | null;
  if (!draft) return null;

  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('[AI Draft] Không thể xóa draft sau consume:', error);
  }

  return {
    ...draft,
    consumedAt: Date.now(),
  };
}

export function clearAIDraft(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

export function hasAIDraft(): boolean {
  return peekAIDraft() !== null;
}

/**
 * Normalizes and validates raw AI extracted data before applying to form.
 * Prevents non-primitive objects, malformed arrays, or undefined fields
 * from corrupting form state.
 */
export function normalizeAIData(input: any): NormalizedAIData | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  return {
    labName:
      typeof input.labName === 'string'
        ? input.labName.trim()
        : undefined,

    testDate:
      typeof input.testDate === 'string'
        ? input.testDate.trim()
        : undefined,

    batchNo:
      typeof input.batchNo === 'string'
        ? input.batchNo.trim()
        : undefined,

    batchId:
      typeof input.batchId === 'string'
        ? input.batchId.trim()
        : undefined,

    productName:
      typeof input.productName === 'string'
        ? input.productName.trim()
        : undefined,

    productCode:
      typeof input.productCode === 'string'
        ? input.productCode.trim()
        : undefined,

    mfgDate:
      typeof input.mfgDate === 'string'
        ? input.mfgDate.trim()
        : undefined,

    expDate:
      typeof input.expDate === 'string'
        ? input.expDate.trim()
        : undefined,

    testResults: Array.isArray(input.testResults)
      ? input.testResults
          .filter(Boolean)
          .map((item: any) => ({
            criteriaName:
              typeof item.criteriaName === 'string'
                ? item.criteriaName.trim()
                : '',
            value: item.value == null ? '' : String(item.value).trim(),
            unit: item.unit == null ? '' : String(item.unit).trim(),
            limit: item.limit == null ? '' : String(item.limit).trim(),
          }))
          .filter((item: any) => item.criteriaName)
      : [],
  };
}
