/**
 * PQM 3.0 - Raw Material Repository Interface
 */

import { RawMaterial } from '../types';
import { IRepository } from './types';

export interface IMaterialRepository extends IRepository<RawMaterial> {
  findByCode(code: string): Promise<RawMaterial | null>;
  findByCasNumber(casNumber: string): Promise<RawMaterial | null>;
  searchByNameOrAlias(query: string): Promise<RawMaterial[]>;
}
