/**
 * PQM 3.0 - AI Learned Mapping Repository Interface
 */

import { AILearnedMapping } from '../types';
import { IRepository } from './types';

export interface IAILearnedMappingRepository extends IRepository<AILearnedMapping> {
  findByOriginalName(name: string): Promise<AILearnedMapping | null>;
}
