import { describe, it, expect, beforeEach } from 'vitest';
import { semanticCache } from '../semanticCacheService';

describe('Phase 3 — Semantic Cache Correctness & Identity Binding Tests', () => {
  beforeEach(() => {
    semanticCache.clear();
  });

  it('P3-AC1: Question A + data version 1 -> Cache Set & Cache Hit', () => {
    const queryV1 = {
      promptId: 'AI_ASSISTANT',
      promptVersion: 'prompt-v22',
      model: 'gemini-2.5-flash',
      entityId: 'batch:362605',
      dataVersionHash: 'TESTING|KN-2026-001|PENDING',
      input: 'Tình trạng kiểm nghiệm lô 362605 hiện tại thế nào?',
    };

    semanticCache.set(queryV1, { text: 'Lô 362605 đang trong quá trình kiểm nghiệm.' });

    const cached = semanticCache.get(queryV1);
    expect(cached).not.toBeNull();
    expect(cached?.data?.text).toBe('Lô 362605 đang trong quá trình kiểm nghiệm.');
    expect(cached?.isExactMatch).toBe(true);
  });

  it('P3-AC2: Khi dữ liệu nghiệp vụ thay đổi (data version 2) -> Cache MISS, không trả kết quả cũ', () => {
    const queryV1 = {
      promptId: 'AI_ASSISTANT',
      promptVersion: 'prompt-v22',
      model: 'gemini-2.5-flash',
      entityId: 'batch:362605',
      dataVersionHash: 'TESTING|KN-2026-001|PENDING',
      input: 'Tình trạng kiểm nghiệm lô 362605 hiện tại thế nào?',
    };

    semanticCache.set(queryV1, { text: 'Lô 362605 đang trong quá trình kiểm nghiệm.' });

    // Dữ liệu lô được duyệt xuất xưởng -> dataVersionHash thay đổi
    const queryV2 = {
      ...queryV1,
      dataVersionHash: 'RELEASED|KN-2026-001|PASS',
    };

    const cached = semanticCache.get(queryV2);
    expect(cached).toBeNull(); // Bắt buộc MISS!
  });

  it('P3-AC3: Khi Prompt Version thay đổi -> Cache MISS', () => {
    const queryV21 = {
      promptId: 'AI_ASSISTANT',
      promptVersion: 'prompt-v21',
      model: 'gemini-2.5-flash',
      entityId: 'batch:362605',
      dataVersionHash: 'RELEASED',
      input: 'Hạn dùng lô 362605 là khi nào?',
    };

    semanticCache.set(queryV21, { text: 'Hạn dùng đến 01/2028.' });

    const queryV22 = {
      ...queryV21,
      promptVersion: 'prompt-v22',
    };

    const cached = semanticCache.get(queryV22);
    expect(cached).toBeNull();
  });

  it('P3-AC4: Khi Model thay đổi -> Cache MISS', () => {
    const queryFlash = {
      promptId: 'AI_ASSISTANT',
      promptVersion: 'prompt-v22',
      model: 'gemini-2.5-flash',
      entityId: 'product:P01',
      dataVersionHash: 'ACTIVE',
      input: 'Sản phẩm P01 có bao nhiêu chỉ tiêu chất lượng?',
    };

    semanticCache.set(queryFlash, { text: 'Có 5 chỉ tiêu chất lượng.' });

    const queryPro = {
      ...queryFlash,
      model: 'gemini-2.5-pro',
    };

    const cached = semanticCache.get(queryPro);
    expect(cached).toBeNull();
  });
});
