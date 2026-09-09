/**
 * PQM 3.0 - Product Application Service
 * Điều phối các nghiệp vụ quản lý sản phẩm: RBAC Authorization, Validation và Audit Logging
 */

import { Product } from '../../types';
import { IProductRepository } from '../../repositories/ProductRepository';
import { productRepository as defaultProductRepo } from '../../repositories/firebase/FirebaseProductRepository';
import { can } from '../permissionService';
import { logAuditAction } from '../auditService';
import { validateOptimisticLock, nextVersion } from '../../utils/concurrency';

export class ProductAppService {
  constructor(private repo: IProductRepository = defaultProductRepo) {}

  async createProduct(product: Product, currentUser: any): Promise<void> {
    if (!can(currentUser, 'product:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền tạo sản phẩm mới.');
    }

    if (!product.name?.trim()) {
      throw new Error('Tên sản phẩm không được để trống.');
    }
    if (!product.code?.trim()) {
      throw new Error('Mã sản phẩm không được để trống.');
    }

    await this.repo.save(product);

    logAuditAction({
      action: 'CREATE',
      collection: 'PRODUCTS',
      documentId: product.id,
      details: `Tạo sản phẩm: ${product.name} (${product.code})`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async updateProduct(product: Product, currentUser: any, oldProduct?: Product): Promise<void> {
    if (!can(currentUser, 'product:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật sản phẩm.');
    }

    validateOptimisticLock(oldProduct?.version, product.version, `Sản phẩm ${product.name || product.code}`);

    if (!product.name?.trim()) {
      throw new Error('Tên sản phẩm không được để trống.');
    }

    const cleanProduct: Product = {
      ...product,
      version: nextVersion(oldProduct?.version ?? product.version),
      updatedAt: new Date().toISOString()
    };

    await this.repo.update(cleanProduct);

    logAuditAction({
      action: 'UPDATE',
      collection: 'PRODUCTS',
      documentId: cleanProduct.id,
      details: `Cập nhật sản phẩm: ${cleanProduct.name} (${cleanProduct.code}) (v${cleanProduct.version})`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async deleteProduct(id: string, currentUser: any, productName?: string): Promise<void> {
    if (!can(currentUser, 'product:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa sản phẩm này.');
    }

    await this.repo.delete(id);

    logAuditAction({
      action: 'DELETE',
      collection: 'PRODUCTS',
      documentId: id,
      details: `Xóa sản phẩm: ${productName || id}`,
      performedBy: currentUser?.email || 'unknown'
    });
  }

  async bulkCreateProducts(products: Product[], currentUser: any): Promise<void> {
    if (!can(currentUser, 'product:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền nạp danh sách sản phẩm.');
    }
    await this.repo.bulkSave(products);
  }
}

export const productAppService = new ProductAppService();
