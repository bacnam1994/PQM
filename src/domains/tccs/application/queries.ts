/**
 * TCCS DOMAIN: QUERIES (READ-ONLY)
 */

import { TCCS, ITCCSRepository } from '../domain/types';
import { defaultTccsRepo } from '../infrastructure/repository';

export class TCCSQueries {
  constructor(private repo: ITCCSRepository = defaultTccsRepo) {}

  async getAll(): Promise<TCCS[]> {
    return this.repo.findAll();
  }

  async getById(id: string): Promise<TCCS | null> {
    return this.repo.findById(id);
  }

  async getByCode(code: string): Promise<TCCS | null> {
    return this.repo.findByCode(code);
  }

  async getByProductId(productId: string): Promise<TCCS[]> {
    return this.repo.findByProductId(productId);
  }

  async getActiveByProductId(productId: string): Promise<TCCS | null> {
    return this.repo.findActiveByProductId(productId);
  }
}

export const tccsQueries = new TCCSQueries();
