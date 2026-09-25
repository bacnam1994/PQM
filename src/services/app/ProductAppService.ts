/**
 * PQM 3.0 - Product Application Service
 * Điều phối các nghiệp vụ quản lý sản phẩm qua WorkflowFacade: RBAC Authorization, Validation, OCC và ALCOA+ Audit Logging
 */

import { Product } from '../../types';
import { IProductRepository } from '../../repositories/ProductRepository';
import { productRepository as defaultProductRepo } from '../../repositories/firebase/FirebaseProductRepository';
import { can } from '../permissionService';
import { validateOptimisticLock, nextVersion } from '../../utils/concurrency';
import { WorkflowFacade } from '../../workflow/WorkflowFacade';
import { WorkflowActor } from '../../workflow/contracts/actions';

export class ProductAppService {
  constructor(private repo: IProductRepository = defaultProductRepo) {}

  private toActor(currentUser: any): WorkflowActor {
    const rawRole = (currentUser?.role || (currentUser?.isAdmin ? 'ADMIN' : 'USER')).toUpperCase();
    return {
      id: currentUser?.id || currentUser?.uid || 'usr_unknown',
      name: currentUser?.displayName || currentUser?.name || 'Unknown User',
      role: rawRole,
      email: currentUser?.email,
    };
  }

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

    const execution = await WorkflowFacade.dispatch<Product>(
      {
        actionId: 'PRODUCT_CREATE',
        entityType: 'PRODUCT',
        entityId: product.id,
        actor: this.toActor(currentUser),
        payload: product,
      },
      async () => {
        await this.repo.save(product);
        return product;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi tạo sản phẩm mới qua Workflow.');
    }
  }

  async updateProduct(
    product: Product,
    currentUser: any,
    oldProduct?: Product,
    reason?: string
  ): Promise<void> {
    if (!can(currentUser, 'product:update')) {
      throw new Error('Từ chối quyền: Bạn không có quyền cập nhật sản phẩm.');
    }

    validateOptimisticLock(
      oldProduct?.version,
      product.version,
      `Sản phẩm ${product.name || product.code}`
    );

    if (!product.name?.trim()) {
      throw new Error('Tên sản phẩm không được để trống.');
    }

    const cleanProduct: Product = {
      ...product,
      version: nextVersion(oldProduct?.version ?? product.version),
      updatedAt: new Date().toISOString(),
    };

    const execution = await WorkflowFacade.dispatch<Product>(
      {
        actionId: 'PRODUCT_UPDATE',
        entityType: 'PRODUCT',
        entityId: cleanProduct.id,
        actor: this.toActor(currentUser),
        payload: cleanProduct,
        reason:
          reason ||
          `Cập nhật sản phẩm: ${cleanProduct.name} (${cleanProduct.code}) (v${cleanProduct.version})`,
        expectedVersion: oldProduct?.version,
      },
      async () => {
        await this.repo.update(cleanProduct);
        return cleanProduct;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi cập nhật sản phẩm qua Workflow.');
    }
  }

  async deleteProduct(
    id: string,
    currentUser: any,
    productName?: string,
    reason?: string
  ): Promise<void> {
    if (!can(currentUser, 'product:delete')) {
      throw new Error('Từ chối quyền: Bạn không có quyền xóa sản phẩm này.');
    }

    const execution = await WorkflowFacade.dispatch<string>(
      {
        actionId: 'PRODUCT_ARCHIVE',
        entityType: 'PRODUCT',
        entityId: id,
        actor: this.toActor(currentUser),
        reason: reason || `Xóa sản phẩm: ${productName || id}`,
      },
      async () => {
        await this.repo.delete(id);
        return id;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi xóa sản phẩm qua Workflow.');
    }
  }

  async bulkCreateProducts(products: Product[], currentUser: any): Promise<void> {
    if (!can(currentUser, 'product:create')) {
      throw new Error('Từ chối quyền: Bạn không có quyền nạp danh sách sản phẩm.');
    }

    const execution = await WorkflowFacade.dispatch<Product[]>(
      {
        actionId: 'PRODUCT_CREATE',
        entityType: 'PRODUCT',
        entityId: `bulk_${products.length}`,
        actor: this.toActor(currentUser),
        payload: products,
      },
      async () => {
        await this.repo.bulkSave(products);
        return products;
      }
    );

    if (!execution.success) {
      throw new Error(execution.failureReason || 'Lỗi nạp hàng loạt sản phẩm qua Workflow.');
    }
  }
}

export const productAppService = new ProductAppService();
