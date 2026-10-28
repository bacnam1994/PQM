/**
 * PRODUCT DOMAIN: APPLICATION QUERIES (READ PATH)
 */

import { Product } from '../domain/types';
import { IProductRepository, defaultProductRepo } from '../infrastructure/repository';

export class ProductQueries {
  constructor(private repo: IProductRepository = defaultProductRepo) {}

  async getAll(): Promise<Product[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<Product | null> {
    return this.repo.findById(id);
  }

  async getByCode(code: string): Promise<Product | null> {
    return this.repo.findByCode(code);
  }

  async searchByName(nameQuery: string): Promise<Product[]> {
    return this.repo.searchByName(nameQuery);
  }
}

export const productQueries = new ProductQueries();
