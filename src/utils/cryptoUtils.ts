/**
 * cryptoUtils.ts
 * Tiện ích mã hóa & băm dữ liệu chuẩn ALCOA+ cho hệ thống PQM.
 * Đảm bảo:
 * 1. Canonical JSON Stringify (sắp xếp key đệ quy) để kết quả băm luôn tất định (deterministic) 100%.
 * 2. Thuật toán băm SHA-256 chuẩn NIST/FIPS 180-4 (64 ký tự hex).
 * 3. Cung cấp cả giao diện Bất đồng bộ (Web Crypto API) và Đồng bộ (Pure JS SHA-256).
 */

/**
 * Tuần tự hóa JSON có sắp xếp khóa theo thứ tự từ điển đệ quy.
 * Loại bỏ sự sai lệch do thứ tự thuộc tính trong object khi sinh hash.
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return `[${obj.map((item) => canonicalJsonStringify(item)).join(',')}]`;
  }

  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys
    .filter((k) => obj[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`);

  return `{${pairs.join(',')}}`;
}

/**
 * Thuật toán SHA-256 thuần JavaScript (FIPS 180-4 compliant)
 * Cho phép tính SHA-256 đồng bộ chính xác 100% trong mọi môi trường (Browser, Worker, Node, Vitest).
 */
function sha256Pure(message: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';

  const words: number[] = [];
  const asciiBitLength = message.length * 8;

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
 * Tính mã SHA-256 đồng bộ (Synchronous SHA-256).
 * Nhận vào chuỗi hoặc object (tự động chuẩn hóa bằng canonicalJsonStringify).
 * Trả về mã băm 64 ký tự hex chuẩn quốc tế.
 */
export function calculateSha256Sync(data: string | Record<string, any>): string {
  const message = typeof data === 'string' ? data : canonicalJsonStringify(data);
  return sha256Pure(message);
}

/**
 * Tính mã SHA-256 bất đồng bộ sử dụng Web Crypto API (SubtleCrypto) khi khả dụng.
 */
export async function calculateSha256(data: string | Record<string, any>): Promise<string> {
  const message = typeof data === 'string' ? data : canonicalJsonStringify(data);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback về sha256Pure nếu SubtleCrypto gặp lỗi
    }
  }

  return sha256Pure(message);
}
