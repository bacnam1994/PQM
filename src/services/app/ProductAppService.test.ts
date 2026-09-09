import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductAppService } from './ProductAppService';
import { IProductRepository } from '../../repositories/ProductRepository';
import { createBaseMockRepository } from '../../repositories/mockRepositoryHelper';
import { Product } from '../../types';

describe('ProductAppService - PQM 3.0 Application Service', () => {
  let mockRepo: IProductRepository;
  let service: ProductAppService;

  const adminUser = { uid: 'u-admin', role: 'ADMIN', isAdmin: true };
  const viewerUser = { uid: 'u-viewer', role: 'VIEWER' };

  const sampleProduct: Product = {
    id: 'prod-001',
    code: 'SP-GINKGO',
    name: 'Ginkgo Biloba 120mg',
    group: 'Viên nang mềm',
    registrationNo: 'VD-12345-20',
    registrationDate: '2020-01-01',
    registrant: 'V-Biotech',
    status: 'ACTIVE',
    description: 'Hỗ trợ tuần hoàn não',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z'
  };

  beforeEach(() => {
    mockRepo = {
      ...createBaseMockRepository<Product>(),
      findById: vi.fn().mockResolvedValue(sampleProduct),
      findAll: vi.fn().mockResolvedValue([sampleProduct]),
      findByCode: vi.fn().mockResolvedValue(sampleProduct),
      searchByName: vi.fn().mockResolvedValue([sampleProduct]),
      bulkSave: vi.fn().mockResolvedValue(undefined)
    };
    service = new ProductAppService(mockRepo);
  });

  it('should allow authorized user to create product', async () => {
    await expect(service.createProduct(sampleProduct, adminUser)).resolves.not.toThrow();
    expect(mockRepo.save).toHaveBeenCalledWith(sampleProduct);
  });

  it('should deny unauthorized viewer from creating product', async () => {
    await expect(service.createProduct(sampleProduct, viewerUser)).rejects.toThrow('Từ chối quyền');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should reject product creation when name or code is missing', async () => {
    const invalidProduct = { ...sampleProduct, name: '' };
    await expect(service.createProduct(invalidProduct, adminUser)).rejects.toThrow('Tên sản phẩm không được để trống');
  });

  it('should allow authorized user to update product and increment version', async () => {
    const updated = { ...sampleProduct, name: 'Ginkgo Biloba Extra' };
    await expect(service.updateProduct(updated, adminUser)).resolves.not.toThrow();
    expect(mockRepo.update).toHaveBeenCalledWith(expect.objectContaining({
      id: 'prod-001',
      name: 'Ginkgo Biloba Extra',
      version: 2,
    }));
  });

  it('should reject update if incoming product version is stale (OCC conflict)', async () => {
    const serverProduct = { ...sampleProduct, version: 3 };
    const staleProduct = { ...sampleProduct, version: 1 };
    await expect(service.updateProduct(staleProduct, adminUser, serverProduct)).rejects.toThrow(/đã được cập nhật bởi một phiên làm việc khác/);
  });

  it('should allow authorized user to delete product', async () => {
    await expect(service.deleteProduct('prod-001', adminUser, 'Ginkgo Biloba')).resolves.not.toThrow();
    expect(mockRepo.delete).toHaveBeenCalledWith('prod-001');
  });

  it('should deny unauthorized user from deleting product', async () => {
    await expect(service.deleteProduct('prod-001', viewerUser)).rejects.toThrow('Từ chối quyền');
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
