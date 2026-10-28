/**
 * FORMULA DOMAIN: QUERIES (READ-ONLY)
 */

import { ProductFormula, IFormulaRepository } from '../domain/types';
import { defaultFormulaRepo } from '../infrastructure/repository';

export class FormulaQueries {
  constructor(private repo: IFormulaRepository = defaultFormulaRepo) {}

  async getAll(): Promise<ProductFormula[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<ProductFormula | null> {
    return this.repo.findById(id);
  }

  async getByProductId(productId: string): Promise<ProductFormula | null> {
    return this.repo.findByProductId(productId);
  }
}

export const formulaQueries = new FormulaQueries();
