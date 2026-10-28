import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryClient } from '../lib/queryClient';
import { useAppStore } from './useAppStore';
import {
  PRODUCT_QUERY_KEYS,
  BATCH_QUERY_KEYS,
  TCCS_QUERY_KEYS,
  TEST_RESULT_QUERY_KEYS,
} from '../constants/queryKeys';
import { criteriaAliasRepository } from '../repositories/firebase/FirebaseCriteriaAliasRepository';
import { aiLearnedMappingRepository } from '../repositories/firebase/FirebaseAILearnedMappingRepository';

// Mock Firebase Realtime Database
vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({})),
  ref: vi.fn(() => ({})),
  set: vi.fn(() => Promise.resolve()),
  remove: vi.fn(() => Promise.resolve()),
  update: vi.fn(() => Promise.resolve()),
  get: vi.fn(() => Promise.resolve({ exists: () => false, val: () => null })),
  query: vi.fn(() => ({})),
  orderByChild: vi.fn(() => ({})),
  equalTo: vi.fn(() => ({})),
  limitToFirst: vi.fn(() => ({})),
  limitToLast: vi.fn(() => ({})),
  startAt: vi.fn(() => ({})),
  endAt: vi.fn(() => ({})),
}));

describe('Phase 1 — Data Architecture & Single Source of Truth', () => {
  beforeEach(() => {
    queryClient.clear();
    useAppStore.setState({
      products: [],
      batches: [],
      tccsList: [],
      productFormulas: [],
      rawMaterials: [],
      testResults: [],
      criteriaAliases: [],
      aiLearnedMappings: [],
    });
  });

  it('P1-AC1: TanStack Query Cache là Single Source of Truth và tự động đồng bộ sang useAppStore', () => {
    const sampleProducts = [
      { id: 'p1', code: 'SP-01', name: 'Trà thảo mộc', status: 'ACTIVE' } as any,
      { id: 'p2', code: 'SP-02', name: 'Viên ngậm bạc hà', status: 'ACTIVE' } as any,
    ];

    // Cập nhật dữ liệu vào TanStack Query Cache
    queryClient.setQueryData(PRODUCT_QUERY_KEYS.all, sampleProducts);

    // Kiểm tra useAppStore đã tự động cập nhật phản chiếu từ QueryCache
    const storeState = useAppStore.getState();
    expect(storeState.products).toHaveLength(2);
    expect(storeState.products[0].code).toBe('SP-01');
    expect(storeState.products[1].name).toBe('Viên ngậm bạc hà');
  });

  it('P1-AC2: setAppState trong useAppStore đồng bộ dữ liệu vào TanStack Query Cache', () => {
    const sampleBatches = [
      { id: 'b1', batchNo: 'L26-001', productId: 'p1', status: 'TESTING' } as any,
    ];

    useAppStore.getState().setAppState({ batches: sampleBatches });

    // Kiểm tra dữ liệu trong TanStack Query Cache
    const cachedBatches = queryClient.getQueryData(BATCH_QUERY_KEYS.all);
    expect(cachedBatches).toEqual(sampleBatches);
  });

  it('P1-AC3: Đảm bảo tính nhất quán 2 chiều giữa TanStack Query và useAppStore cho mọi thực thể', () => {
    const sampleTCCS = [
      {
        id: 't1',
        code: 'TCCS-01',
        productId: 'p1',
        isActive: true,
        mainQualityCriteria: [],
        safetyCriteria: [],
      } as any,
    ];
    const sampleTestResults = [
      {
        id: 'tr1',
        batchId: 'b1',
        labName: 'Phòng Lab A',
        overallStatus: 'PASS',
        testDate: '2026-09-14',
      } as any,
    ];

    // Đồng bộ TCCS qua queryClient
    queryClient.setQueryData(TCCS_QUERY_KEYS.all, sampleTCCS);
    expect(useAppStore.getState().tccsList).toHaveLength(1);
    expect(useAppStore.getState().tccsList[0].code).toBe('TCCS-01');

    // Đồng bộ TestResults qua queryClient
    queryClient.setQueryData(TEST_RESULT_QUERY_KEYS.all, sampleTestResults);
    expect(useAppStore.getState().testResults).toHaveLength(1);
    expect(useAppStore.getState().testResults[0].overallStatus).toBe('PASS');
  });

  it('P1-AC4: CriteriaAlias và AILearnedMapping repositories triển khai đúng chuẩn IRepository', async () => {
    expect(typeof criteriaAliasRepository.findAll).toBe('function');
    expect(typeof criteriaAliasRepository.findByTccsId).toBe('function');
    expect(typeof criteriaAliasRepository.findById).toBe('function');

    expect(typeof aiLearnedMappingRepository.findAll).toBe('function');
    expect(typeof aiLearnedMappingRepository.findByOriginalName).toBe('function');
    expect(typeof aiLearnedMappingRepository.findById).toBe('function');
  });
});
