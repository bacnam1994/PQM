/**
 * packages/release-engine/src/checksum.ts
 * CANONICAL SHA-256 CHECKSUM ALGORITHM (Phase 4.1 Strict Signature Security)
 *
 * CANONICAL PAYLOAD FORMAT:
 * SHA256(
 *   documentType |
 *   documentId |
 *   documentVersion |
 *   signerUid |
 *   signerEmail |
 *   role |
 *   meaning |
 *   signedAt
 * )
 *
 * STRICT RULE: Only storedChecksum === computedChecksum is valid.
 * NO legacy integer hash, NO fallback hash, NO mock checksum, NO docId-only hash.
 */

import { CanonicalElectronicSignature } from './types';

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

/**
 * Pure TypeScript SHA-256 (FIPS 180-4 compliant)
 * Zero dependencies, identical output across Node.js, Cloud Functions, and Browser.
 */
export function sha256Hex(message: string): string {
  // If Node.js crypto is available, prefer it for speed
  try {
    if (typeof process !== 'undefined' && process.versions?.node) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodeCrypto = require('crypto');
      if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
        return nodeCrypto.createHash('sha256').update(message, 'utf8').digest('hex');
      }
    }
  } catch {
    // Fall back to pure TS algorithm
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const hash: number[] = [];
  const k: number[] = [];

  let primeCounter = 0;
  const isPrime = (n: number) => {
    for (let factor = 2, max = Math.sqrt(n); factor <= max; factor++) {
      if (n % factor === 0) return false;
    }
    return true;
  };

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (isPrime(candidate)) {
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 1 / 2) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  const bytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const code = message.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      const code2 = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code2 >> 18),
        0x80 | ((code2 >> 12) & 0x3f),
        0x80 | ((code2 >> 6) & 0x3f),
        0x80 | (code2 & 0x3f)
      );
    }
  }

  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }

  for (let i = 7; i >= 0; i--) {
    bytes.push((bitLength >>> (i * 8)) & 0xff);
  }

  for (let i = 0; i < bytes.length; i += 4) {
    words.push((bytes[i] << 24) | (bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]);
  }

  for (let j = 0; j < words.length; j += 16) {
    const w: number[] = [];
    for (let i = 0; i < 16; i++) w[i] = words[j + i];
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = hash[0];
    let b = hash[1];
    let c = hash[2];
    let d = hash[3];
    let e = hash[4];
    let f = hash[5];
    let g = hash[6];
    let h = hash[7];

    for (let i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + k[i] + w[i]) | 0;
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  for (let i = 0; i < 8; i++) {
    for (let j = 3; j >= 0; j--) {
      const b = (hash[i] >>> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }

  return result;
}

/**
 * Tạo payload canonical để băm chữ ký điện tử
 */
export function buildCanonicalSignaturePayload(
  data: Pick<
    CanonicalElectronicSignature,
    | 'documentType'
    | 'documentId'
    | 'documentVersion'
    | 'signerUid'
    | 'signerEmail'
    | 'role'
    | 'meaning'
    | 'signedAt'
  >
): string {
  return [
    data.documentType,
    data.documentId,
    data.documentVersion ?? '',
    data.signerUid,
    data.signerEmail,
    data.role,
    data.meaning,
    data.signedAt,
  ].join('|');
}

/**
 * Tính toán checksum canonical theo tiêu chuẩn SHA-256 FIPS 180-4
 */
export function calculateCanonicalSignatureChecksum(
  data: Pick<
    CanonicalElectronicSignature,
    | 'documentType'
    | 'documentId'
    | 'documentVersion'
    | 'signerUid'
    | 'signerEmail'
    | 'role'
    | 'meaning'
    | 'signedAt'
  >
): string {
  const payload = buildCanonicalSignaturePayload(data);
  return sha256Hex(payload);
}

/**
 * Thẩm định tính toàn vẹn chữ ký điện tử - CHỈ CHẤP NHẬN EXACT MATCH
 */
export function verifyCanonicalSignatureChecksum(signature: CanonicalElectronicSignature): boolean {
  if (!signature || !signature.checksum) {
    return false;
  }

  const expected = calculateCanonicalSignatureChecksum(signature);
  return signature.checksum.toLowerCase() === expected.toLowerCase();
}
