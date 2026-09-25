/**
 * PQM REBUILD - TCCS REPOSITORY INTERFACE
 */

import { TCCS } from '../../types';
import { IRepository } from '../types';

export interface ITCCSRepository extends IRepository<TCCS> {
  findByProductId(productId: string): Promise<TCCS[]>;
  findActiveByProductId(productId: string): Promise<TCCS | null>;
  findByTCCSNumber(tccsNumber: string): Promise<TCCS | null>;
}
