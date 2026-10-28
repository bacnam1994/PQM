import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseFirebaseRepository } from './firebase/BaseFirebaseRepository';
import { getQueryPolicy, REGULATED_COLLECTIONS, FailClosedQueryError } from './queryPolicy';
import * as dbModule from 'firebase/database';

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  get: vi.fn(),
  query: vi.fn((r) => r),
  orderByChild: vi.fn(() => ({})),
  equalTo: vi.fn(() => ({})),
  limitToFirst: vi.fn(() => ({})),
  limitToLast: vi.fn(() => ({})),
  startAt: vi.fn(() => ({})),
  endAt: vi.fn(() => ({})),
}));

interface SampleEntity {
  id: string;
  batchId?: string;
  name: string;
  status: string;
}

class RegulatedBatchRepo extends BaseFirebaseRepository<SampleEntity> {
  protected readonly collectionPath = 'batches';
  async delete(): Promise<void> {}
}

class RegulatedTestResultRepo extends BaseFirebaseRepository<SampleEntity> {
  protected readonly collectionPath = 'testResults';
  async delete(): Promise<void> {}
}

class NonRegulatedRepo extends BaseFirebaseRepository<SampleEntity> {
  protected readonly collectionPath = 'testing_laboratories';
  private mockItems: SampleEntity[] = [];

  setMockItems(items: SampleEntity[]) {
    this.mockItems = items;
  }

  override async findAll(): Promise<SampleEntity[]> {
    return [...this.mockItems];
  }

  async delete(): Promise<void> {}
}

describe('A5 — Query Policy & Fail-Closed Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Policy Classification', () => {
    it('xác định chính xác các collection thuộc nhóm REGULATED', () => {
      expect(REGULATED_COLLECTIONS.has('batches')).toBe(true);
      expect(REGULATED_COLLECTIONS.has('testResults')).toBe(true);
      expect(REGULATED_COLLECTIONS.has('products')).toBe(true);
      expect(REGULATED_COLLECTIONS.has('tccsList')).toBe(true);
      expect(REGULATED_COLLECTIONS.has('audit_logs')).toBe(true);

      const batchPolicy = getQueryPolicy('batches');
      expect(batchPolicy.classification).toBe('REGULATED');
      expect(batchPolicy.noFullScanFallback).toBe(true);
      expect(batchPolicy.requireIndexedQuery).toBe(true);
      expect(batchPolicy.failClosed).toBe(true);
    });

    it('xác định chính xác các collection thuộc nhóm NON_REGULATED', () => {
      const labPolicy = getQueryPolicy('testing_laboratories');
      expect(labPolicy.classification).toBe('NON_REGULATED');
      expect(labPolicy.noFullScanFallback).toBe(false);
      expect(labPolicy.failClosed).toBe(false);
    });
  });

  describe('Fail-Closed Behavior on Regulated Data', () => {
    it('findByRelation trên batches ném FailClosedQueryError khi query lỗi (KHÔNG fallback findAll)', async () => {
      const repo = new RegulatedBatchRepo();
      const findAllSpy = vi.spyOn(repo, 'findAll');

      vi.mocked(dbModule.get).mockRejectedValueOnce(new Error('Index not defined on batchId'));

      await expect(repo.findByRelation('productId', 'prod-001')).rejects.toThrow(
        FailClosedQueryError
      );

      // Tuyệt đối không được gọi findAll fallback
      expect(findAllSpy).not.toHaveBeenCalled();
    });

    it('findPaginated trên testResults ném FailClosedQueryError khi server query lỗi', async () => {
      const repo = new RegulatedTestResultRepo();
      const findAllSpy = vi.spyOn(repo, 'findAll');

      vi.mocked(dbModule.get).mockRejectedValueOnce(new Error('Network disconnected'));

      await expect(
        repo.findPaginated({ page: 1, pageSize: 20 }, [
          { field: 'status', operator: '==', value: 'PASS' },
        ])
      ).rejects.toThrow(FailClosedQueryError);

      expect(findAllSpy).not.toHaveBeenCalled();
    });

    it('count trên regulated collection ném FailClosedQueryError khi candidate query lỗi', async () => {
      const repo = new RegulatedBatchRepo();
      const findAllSpy = vi.spyOn(repo, 'findAll');

      vi.mocked(dbModule.get).mockRejectedValueOnce(new Error('Permission denied'));

      await expect(
        repo.count([
          { field: 'status', operator: '==', value: 'RELEASED' },
          { field: 'name', operator: '==', value: 'Test' },
        ])
      ).rejects.toThrow(FailClosedQueryError);

      expect(findAllSpy).not.toHaveBeenCalled();
    });
  });

  describe('Non-Regulated Fallback Behavior', () => {
    it('cho phép fallback findAll trên collection NON_REGULATED khi server query lỗi', async () => {
      const repo = new NonRegulatedRepo();
      repo.setMockItems([
        { id: 'lab-1', name: 'Lab A', status: 'ACTIVE' },
        { id: 'lab-2', name: 'Lab B', status: 'INACTIVE' },
      ]);

      const findAllSpy = vi.spyOn(repo, 'findAll');
      vi.mocked(dbModule.get).mockRejectedValueOnce(new Error('Local mock failure'));

      const result = await repo.findByRelation('status', 'ACTIVE');
      expect(findAllSpy).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Lab A');
    });
  });
});
