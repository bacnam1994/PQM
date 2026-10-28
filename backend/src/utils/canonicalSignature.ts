/**
 * backend/src/utils/canonicalSignature.ts
 * Deterministic data sanitization and canonical signature calculation utilities
 */

import {
  calculateCanonicalSignatureChecksum,
  verifyCanonicalSignatureChecksum,
  ElectronicSignature,
} from '@pqm/release-engine';

/**
 * Utility to strip undefined properties recursively so that Firebase RTDB Admin SDK set() never fails
 * and canonical serialization remains 100% deterministic.
 */
export function removeUndefinedFields<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (
        val !== null &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        !(val instanceof Date)
      ) {
        result[key] = removeUndefinedFields(val);
      } else {
        result[key] = val;
      }
    }
  }
  return result as T;
}

export {
  calculateCanonicalSignatureChecksum,
  verifyCanonicalSignatureChecksum,
  ElectronicSignature,
};
