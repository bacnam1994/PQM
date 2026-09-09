/**
 * PQM 3.0 - Product Formula Repository Interface
 */

import { ProductFormula } from '../types';
import { IRepository } from './types';

export interface IFormulaRepository extends IRepository<ProductFormula> {
  findByProductId(productId: string): Promise<ProductFormula | null>;
}
