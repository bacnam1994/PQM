/**
 * PQM REBUILD - LABORATORY REPOSITORY INTERFACE
 */

import { TestingLaboratory } from '../../types';
import { IRepository } from '../types';

export interface ILaboratoryRepository extends IRepository<TestingLaboratory> {
  findByCode(code: string): Promise<TestingLaboratory | null>;
  findActive(): Promise<TestingLaboratory[]>;
}
