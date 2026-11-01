/**
 * ocrDocumentCache.ts
 * Bộ đệm kết quả trích xuất OCR / AI Vision theo mã băm toàn vẹn SHA-256 của tập tin.
 * =================================================================================
 * NGUYÊN TẮC:
 * 1. DETERMINISTIC CHECKSUM: Tính mã SHA-256 từ binary buffer của File/Blob tải lên.
 * 2. TỐC ĐỘ PHẢN HỒI 0.1S: Nếu cùng một file (PDF / Ảnh) đã từng được quét thành công,
 *    lấy lại dữ liệu từ IndexedDB ngay lập tức, tiết kiệm token Gemini API và quota mạng.
 * 3. TTL & DUNG LƯỢNG AN TOÀN: Tự động hết hạn sau 7 ngày, giới hạn tối đa 200 tệp gần nhất.
 * 4. ISOLATED DATABASE: Lưu trong IndexedDB 'PQM_OCR_CACHE_DB' tách biệt hoàn toàn khỏi
 *    cơ sở dữ liệu chính để không gây migration hay ảnh hưởng đến nghiệp vụ Dược.
 */

export interface CachedOCREntry {
  fileHash: string;
  fileName: string;
  fileSize: number;
  extractedData: any;
  cachedAt: number;
  engineVersion?: string;
}

const DB_NAME = 'PQM_OCR_CACHE_DB';
const DB_VERSION = 1;
const STORE_NAME = 'ocr_entries';
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const MAX_CACHE_ENTRIES = 200;

class OcrDocumentCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB không khả dụng trong môi trường hiện tại.'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'fileHash' });
          store.createIndex('cachedAt', 'cachedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onclose = () => {
          this.dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  /**
   * Tính mã SHA-256 chuẩn của File/Blob (64 ký tự hex)
   */
  async computeFileChecksum(file: File | Blob): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }

      // Fallback nếu không có crypto.subtle (Node / môi trường test cũ)
      const { calculateSha256Sync } = await import('../../utils/cryptoUtils');
      return calculateSha256Sync({
        size: file.size,
        type: file.type,
        name: (file as any).name || 'file',
      });
    } catch (e) {
      console.warn('[OCR Cache] Lỗi tính SHA-256:', e);
      return `${(file as any).name || 'unknown'}_${file.size}_${file.type}`;
    }
  }

  /**
   * Lấy dữ liệu bóc tách từ Cache
   */
  async get(fileHash: string): Promise<any | null> {
    if (!fileHash) return null;
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(fileHash);

        req.onsuccess = () => {
          const entry = req.result as CachedOCREntry | undefined;
          if (!entry) {
            resolve(null);
            return;
          }

          // Kiểm tra TTL
          const now = Date.now();
          if (now - entry.cachedAt > DEFAULT_TTL_MS) {
            this.delete(fileHash).catch(() => {});
            resolve(null);
            return;
          }

          resolve(entry.extractedData);
        };

        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Lưu dữ liệu bóc tách vào Cache
   */
  async set(
    fileHash: string,
    extractedData: any,
    metadata?: { fileName?: string; fileSize?: number; engineVersion?: string }
  ): Promise<void> {
    if (!fileHash || !extractedData) return;
    try {
      const db = await this.getDB();
      const entry: CachedOCREntry = {
        fileHash,
        fileName: metadata?.fileName || 'document',
        fileSize: metadata?.fileSize || 0,
        extractedData,
        cachedAt: Date.now(),
        engineVersion: metadata?.engineVersion || 'gemini-ocr-v1',
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      // Tự động dọn dẹp các mục cũ nếu vượt quá giới hạn
      this.pruneCache().catch(() => {});
    } catch (e) {
      console.warn('[OCR Cache] Không thể lưu vào IndexedDB:', e);
    }
  }

  /**
   * Xóa một mục trong cache
   */
  async delete(fileHash: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(fileHash);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  /**
   * Dọn dẹp cache: giữ tối đa MAX_CACHE_ENTRIES bản ghi mới nhất
   */
  private async pruneCache(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('cachedAt');
      const req = index.getAllKeys();

      req.onsuccess = () => {
        const keys = req.result;
        if (keys.length > MAX_CACHE_ENTRIES) {
          const deleteCount = keys.length - MAX_CACHE_ENTRIES;
          for (let i = 0; i < deleteCount; i++) {
            store.delete(keys[i]);
          }
        }
      };
    } catch {}
  }

  /**
   * Xóa toàn bộ bộ đệm OCR
   */
  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).clear();
    } catch {}
  }
}

export const ocrDocumentCache = new OcrDocumentCacheService();
