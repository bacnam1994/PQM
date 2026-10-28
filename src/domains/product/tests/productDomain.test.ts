import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductAppService } from '../application/service';
import { ProductRules } from '../domain/rules';
import { IProductRepository } from '../infrastructure/repository';
import { Product } from '../domain/types';
import { createBaseMockRepository } from '../../../repositories/mockRepositoryHelper';

vi.mock('../../../services/auditService', () => ({
  logAuditAction: vi.fn().mockResolvedValue(undefined),
}));

describe('Product Domain — Architecture & Canonical Behavior Test Suite', () => {
  let mockRepo: IProductRepository;
  let service: ProductAppService;

  const adminUser = { id: 'u-admin', name: 'Admin', role: 'ADMIN', isAdmin: true };
  const sampleProduct: Product = {
    id: 'prod-001',
    code: 'SP-001',
    name: 'Paracetamol 500mg',
    group: 'Giảm đau hạ sốt',
    registrationNo: 'VD-12345-20',
    registrationDate: '2020-01-01',
    registrant: 'Công ty Dược V-Biotech',
    status: 'ACTIVE',
    description: 'Thuốc giảm đau hạ sốt chuẩn GMP',
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = {
      ...createBaseMockRepository<Product>(),
      findById: vi.fn().mockResolvedValue(sampleProduct),
      findAll: vi.fn().mockResolvedValue([sampleProduct]),
      findByCode: vi.fn().mockResolvedValue(sampleProduct),
      searchByName: vi.fn().mockResolvedValue([sampleProduct]),
      save: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      bulkSave: vi.fn().mockResolvedValue(undefined),
    };
    service = new ProductAppService(mockRepo);
  });

  it('1. ProductRules: Chặn sản phẩm thiếu tên hoặc mã', () => {
    expect(ProductRules.validate({ code: 'SP-01' }).valid).toBe(false);
    expect(ProductRules.validate({ name: 'Thuốc A' }).valid).toBe(false);
    expect(ProductRules.validate({ code: 'SP-01', name: 'Thuốc A' }).valid).toBe(true);
  });

  it('2. Create Product: Tạo sản phẩm hợp lệ qua workflow', async () => {
    await expect(service.createProduct(sampleProduct, adminUser)).resolves.not.toThrow();
    expect(mockRepo.save).toHaveBeenCalledWith(sampleProduct);
  });

  it('3. Update Product: Kiểm tra OCC và tăng version', async () => {
    const updated = { ...sampleProduct, name: 'Paracetamol Extra 500mg' };
    await expect(service.updateProduct(updated, adminUser)).resolves.not.toThrow();
    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'prod-001',
        name: 'Paracetamol Extra 500mg',
        version: 2,
      })
    );
  });

  it('4. Delete Product: Xóa sản phẩm với lý do lưu vết kiểm toán', async () => {
    await expect(
      service.deleteProduct('prod-001', adminUser, 'Paracetamol 500mg', 'Ngừng sản xuất')
    ).resolves.not.toThrow();
    expect(mockRepo.delete).toHaveBeenCalledWith('prod-001');
  });
});
