/**
 * MATERIAL DOMAIN: QUERIES (READ-ONLY)
 */

import { RawMaterial, IMaterialRepository } from '../domain/types';
import { defaultMaterialRepo } from '../infrastructure/repository';

export class MaterialQueries {
  constructor(private repo: IMaterialRepository = defaultMaterialRepo) {}

  async getAll(): Promise<RawMaterial[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<RawMaterial | null> {
    return this.repo.findById(id);
  }

  async getByCode(code: string): Promise<RawMaterial | null> {
    return this.repo.findByCode(code);
  }

  async getByCasNumber(casNumber: string): Promise<RawMaterial | null> {
    return this.repo.findByCasNumber(casNumber);
  }

  async searchByNameOrAlias(query: string): Promise<RawMaterial[]> {
    return this.repo.searchByNameOrAlias(query);
  }
}

export const materialQueries = new MaterialQueries();
