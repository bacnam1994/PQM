/**
 * PQM 3.0 - Product Repository Interface
 */

import { Product } from '../types';
import { IRepository } from './types';

export interface IProductRepository extends IRepository<Product> {
  findByCode(code: string): Promise<Product | null>;
  searchByName(nameQuery: string): Promise<Product[]>;
  bulkSave(products: Product[]): Promise<void>;
}
