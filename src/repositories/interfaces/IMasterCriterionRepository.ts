/**
 * PQM REBUILD - MASTER CRITERION REPOSITORY INTERFACE
 */

import { MasterCriterion, MasterCriterionCategory } from '../../types';
import { IRepository } from '../types';

export interface IMasterCriterionRepository extends IRepository<MasterCriterion> {
  findActive(): Promise<MasterCriterion[]>;
  findByCategory(category: MasterCriterionCategory): Promise<MasterCriterion[]>;
  searchByName(query: string): Promise<MasterCriterion[]>;
  findByLinkedMaterial(materialId: string): Promise<MasterCriterion[]>;
}
