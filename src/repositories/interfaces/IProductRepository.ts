/**
 * PQM REBUILD - PRODUCT REPOSITORY INTERFACE
 */

import { Product } from '../../types';
import { IRepository } from '../types';

export interface IProductRepository extends IRepository<Product> {
  findByCode(code: string): Promise<Product | null>;
  searchByName(nameQuery: string): Promise<Product[]>;
  bulkSave(products: Product[]): Promise<void>;
}
