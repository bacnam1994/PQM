import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ocrDocumentCache } from '../ocrDocumentCache';

describe('ocrDocumentCache', () => {
  beforeEach(async () => {
    await ocrDocumentCache.clearAll().catch(() => {});
  });

  it('tính toán mã băm SHA-256 nhất quán cho cùng một nội dung file', async () => {
    const file1 = new File(['nội dung kiểm nghiệm lô 12345'], 'pkn.pdf', {
      type: 'application/pdf',
    });
    const file2 = new File(['nội dung kiểm nghiệm lô 12345'], 'pkn_copy.pdf', {
      type: 'application/pdf',
    });

    const hash1 = await ocrDocumentCache.computeFileChecksum(file1);
    const hash2 = await ocrDocumentCache.computeFileChecksum(file2);

    expect(hash1).toBeDefined();
    expect(hash1.length).toBe(64); // Chuẩn SHA-256 64 ký tự hex
    expect(hash1).toBe(hash2);
  });

  it('sinh mã băm khác nhau cho 2 nội dung khác nhau', async () => {
    const file1 = new File(['phiếu kiểm nghiệm A'], 'pkn1.pdf', { type: 'application/pdf' });
    const file2 = new File(['phiếu kiểm nghiệm B'], 'pkn2.pdf', { type: 'application/pdf' });

    const hash1 = await ocrDocumentCache.computeFileChecksum(file1);
    const hash2 = await ocrDocumentCache.computeFileChecksum(file2);

    expect(hash1).not.toBe(hash2);
  });

  it('trả về null khi cache miss', async () => {
    const nonExistent = await ocrDocumentCache.get('non_existent_hash_12345');
    expect(nonExistent).toBeNull();
  });
});
