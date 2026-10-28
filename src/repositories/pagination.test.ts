import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  matchesFilter,
  applyFilters,
  applySorting,
  paginateDataset,
  getFieldValue,
} from './utils/paginationHelper';
import { BaseFirebaseRepository } from './firebase/BaseFirebaseRepository';
import { QueryFilter, PaginationOptions } from './types';

// Mock Firebase Realtime Database
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

interface TestEntity {
  id: string;
  name: string;
  category: string;
  quantity: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  meta?: {
    tags?: string[];
  };
}

class MockEntityRepository extends BaseFirebaseRepository<TestEntity> {
  protected readonly collectionPath = 'test_entities';
  private inMemoryData: TestEntity[] = [];

  setMockData(data: TestEntity[]) {
    this.inMemoryData = data;
  }

  override async findAll(): Promise<TestEntity[]> {
    return [...this.inMemoryData];
  }

  async delete(id: string): Promise<void> {
    this.inMemoryData = this.inMemoryData.filter((item) => item.id !== id);
  }
}

describe('Repository Layer - Pagination & Filtering Engine', () => {
  const sampleData: TestEntity[] = [
    {
      id: 'e1',
      name: 'Alpha Paracetamol',
      category: 'Thuốc hạ sốt',
      quantity: 150,
      status: 'ACTIVE',
      createdAt: '2026-01-10T08:00:00Z',
    },
    {
      id: 'e2',
      name: 'Beta Amoxicillin',
      category: 'Kháng sinh',
      quantity: 80,
      status: 'INACTIVE',
      createdAt: '2026-01-15T09:00:00Z',
    },
    {
      id: 'e3',
      name: 'Gamma Ginkgo',
      category: 'Thực phẩm chức năng',
      quantity: 200,
      status: 'ACTIVE',
      createdAt: '2026-02-01T10:00:00Z',
    },
    {
      id: 'e4',
      name: 'Delta Cefalexin',
      category: 'Kháng sinh',
      quantity: 45,
      status: 'ACTIVE',
      createdAt: '2026-02-10T11:00:00Z',
    },
    {
      id: 'e5',
      name: 'Epsilon Vitamin C',
      category: 'Thực phẩm chức năng',
      quantity: 300,
      status: 'ACTIVE',
      createdAt: '2026-02-20T12:00:00Z',
    },
  ];

  describe('1. Filter Operators', () => {
    it('lọc chính xác với toán tử == (case-insensitive string)', () => {
      const filter: QueryFilter<TestEntity> = { field: 'status', operator: '==', value: 'active' };
      const result = applyFilters(sampleData, [filter]);
      expect(result.length).toBe(4);
      expect(result.every((i) => i.status === 'ACTIVE')).toBe(true);
    });

    it('lọc với toán tử !=', () => {
      const filter: QueryFilter<TestEntity> = {
        field: 'category',
        operator: '!=',
        value: 'Kháng sinh',
      };
      const result = applyFilters(sampleData, [filter]);
      expect(result.length).toBe(3);
    });

    it('lọc so sánh số với >, >=, <, <=', () => {
      const filterGt: QueryFilter<TestEntity> = { field: 'quantity', operator: '>', value: 100 };
      expect(applyFilters(sampleData, [filterGt]).length).toBe(3); // 150, 200, 300

      const filterLte: QueryFilter<TestEntity> = { field: 'quantity', operator: '<=', value: 80 };
      expect(applyFilters(sampleData, [filterLte]).length).toBe(2); // 80, 45
    });

    it('lọc chuỗi con với toán tử contains', () => {
      const filter: QueryFilter<TestEntity> = {
        field: 'name',
        operator: 'contains',
        value: 'cillin',
      };
      const result = applyFilters(sampleData, [filter]);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('e2');
    });

    it('lọc danh sách giá trị với toán tử in', () => {
      const filter: QueryFilter<TestEntity> = {
        field: 'id',
        operator: 'in',
        value: ['e1', 'e3', 'e99'],
      };
      const result = applyFilters(sampleData, [filter]);
      expect(result.length).toBe(2);
      expect(result.map((r) => r.id)).toEqual(['e1', 'e3']);
    });
  });

  describe('2. Sorting Engine', () => {
    it('sắp xếp theo trường ngày tháng ISO giảm dần (mặc định)', () => {
      const sorted = applySorting(sampleData, 'createdAt', 'desc');
      expect(sorted[0].id).toBe('e5'); // 2026-02-20
      expect(sorted[sorted.length - 1].id).toBe('e1'); // 2026-01-10
    });

    it('sắp xếp theo trường số tăng dần', () => {
      const sorted = applySorting(sampleData, 'quantity', 'asc');
      expect(sorted[0].quantity).toBe(45);
      expect(sorted[sorted.length - 1].quantity).toBe(300);
    });
  });

  describe('3. Pagination Dataset Processing', () => {
    it('phân trang theo Page/PageSize và tính toán đúng metadata', () => {
      const options: PaginationOptions<TestEntity> = {
        page: 2,
        pageSize: 2,
        orderBy: 'quantity',
        orderDirection: 'asc',
      };

      const result = paginateDataset(sampleData, options);

      expect(result.totalCount).toBe(5);
      expect(result.totalPages).toBe(3);
      expect(result.currentPage).toBe(2);
      expect(result.items.length).toBe(2);
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(true);
      expect(result.items[0].quantity).toBe(150); // Item thứ 3 sau [45, 80]
      expect(result.items[1].quantity).toBe(200); // Item thứ 4
    });

    it('phân trang theo Cursor (Next/Prev tokens)', () => {
      // Trang 1: lấy 2 phần tử đầu
      const page1 = paginateDataset(sampleData, {
        pageSize: 2,
        orderBy: 'id',
        orderDirection: 'asc',
      });
      expect(page1.items.length).toBe(2);
      expect(page1.items[0].id).toBe('e1');
      expect(page1.items[1].id).toBe('e2');
      expect(page1.nextCursor).toBe('e2');

      // Trang 2: dùng cursor của trang 1
      const page2 = paginateDataset(sampleData, {
        pageSize: 2,
        cursor: page1.nextCursor,
        orderBy: 'id',
        orderDirection: 'asc',
      });
      expect(page2.items.length).toBe(2);
      expect(page2.items[0].id).toBe('e3');
      expect(page2.items[1].id).toBe('e4');
      expect(page2.hasPrevPage).toBe(true);
    });

    it('phân trang theo Cursor kết hợp cursorId (Tie-breaker) khi các bản ghi trùng giá trị sắp xếp', () => {
      // 5 bản ghi có cùng createdAt nhưng id khác nhau
      const sameDateData: TestEntity[] = [
        {
          id: 'tr1',
          name: 'Mẫu 1',
          category: 'Thuốc',
          status: 'ACTIVE',
          quantity: 10,
          createdAt: '2026-09-14',
        },
        {
          id: 'tr2',
          name: 'Mẫu 2',
          category: 'Thuốc',
          status: 'ACTIVE',
          quantity: 10,
          createdAt: '2026-09-14',
        },
        {
          id: 'tr3',
          name: 'Mẫu 3',
          category: 'Thuốc',
          status: 'ACTIVE',
          quantity: 10,
          createdAt: '2026-09-14',
        },
        {
          id: 'tr4',
          name: 'Mẫu 4',
          category: 'Thuốc',
          status: 'ACTIVE',
          quantity: 10,
          createdAt: '2026-09-14',
        },
        {
          id: 'tr5',
          name: 'Mẫu 5',
          category: 'Thuốc',
          status: 'ACTIVE',
          quantity: 10,
          createdAt: '2026-09-14',
        },
      ];

      // Trang 1
      const page1 = paginateDataset(sameDateData, {
        pageSize: 2,
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });
      expect(page1.items.length).toBe(2);
      expect(page1.items[0].id).toBe('tr1');
      expect(page1.items[1].id).toBe('tr2');
      expect(page1.nextCursor).toBe('2026-09-14');
      expect(page1.nextCursorId).toBe('tr2');

      // Trang 2: Truyền cursor và cursorId làm tie-breaker, không bị lặp lại trang 1
      const page2 = paginateDataset(sameDateData, {
        pageSize: 2,
        cursor: page1.nextCursor,
        cursorId: page1.nextCursorId,
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });
      expect(page2.items.length).toBe(2);
      expect(page2.items[0].id).toBe('tr3');
      expect(page2.items[1].id).toBe('tr4');
      expect(page2.nextCursorId).toBe('tr4');

      // Trang 3
      const page3 = paginateDataset(sameDateData, {
        pageSize: 2,
        cursor: page2.nextCursor,
        cursorId: page2.nextCursorId,
        orderBy: 'createdAt',
        orderDirection: 'asc',
      });
      expect(page3.items.length).toBe(1);
      expect(page3.items[0].id).toBe('tr5');
      expect(page3.hasNextPage).toBe(false);
    });
  });

  describe('4. BaseFirebaseRepository Implementation', () => {
    let repo: MockEntityRepository;

    beforeEach(() => {
      repo = new MockEntityRepository();
      repo.setMockData(sampleData);
    });

    it('findPaginated tích hợp lọc và phân trang hoàn chỉnh', async () => {
      const result = await repo.findPaginated(
        { page: 1, pageSize: 2, orderBy: 'quantity', orderDirection: 'desc' },
        [{ field: 'category', operator: '==', value: 'Thực phẩm chức năng' }]
      );

      expect(result.totalCount).toBe(2); // Gamma Ginkgo (200), Epsilon Vitamin C (300)
      expect(result.items.length).toBe(2);
      expect(result.items[0].id).toBe('e5'); // 300
      expect(result.items[1].id).toBe('e3'); // 200
    });

    it('count tính toán số lượng bản ghi thỏa mãn điều kiện lọc', async () => {
      const totalActive = await repo.count([{ field: 'status', operator: '==', value: 'ACTIVE' }]);
      expect(totalActive).toBe(4);

      const totalKhongSinh = await repo.count([
        { field: 'category', operator: '==', value: 'Kháng sinh' },
      ]);
      expect(totalKhongSinh).toBe(2);
    });

    it('findByRelation tìm chính xác các bản ghi theo khóa ngoại hoặc thuộc tính liên kết', async () => {
      const antibiotics = await repo.findByRelation('category', 'Kháng sinh');
      expect(antibiotics.length).toBe(2);
      expect(antibiotics.map((a) => a.id)).toEqual(['e2', 'e4']);
    });
  });
});
