/**
 * PQM REBUILD - FORMULA REPOSITORY INTERFACE
 */

import { ProductFormula } from '../../types';
import { IRepository } from '../types';

export interface IFormulaRepository extends IRepository<ProductFormula> {
  findByProductId(productId: string): Promise<ProductFormula[]>;
  findActiveByProductId(productId: string): Promise<ProductFormula | null>;
}
