/**
 * PQM 3.0 - TCCS Repository Interface
 */

import { TCCS } from '../types';
import { IRepository } from './types';

export interface ITCCSRepository extends IRepository<TCCS> {
  findByProductId(productId: string): Promise<TCCS[]>;
  findActiveByProductId(productId: string): Promise<TCCS | null>;
  findByCode(code: string): Promise<TCCS | null>;
}
