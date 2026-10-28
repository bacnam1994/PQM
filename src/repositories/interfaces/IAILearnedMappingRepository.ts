/**
 * PQM REBUILD - AI LEARNED MAPPING REPOSITORY INTERFACE
 */

import { AILearnedMapping } from '../../types';
import { IRepository } from '../types';

export interface IAILearnedMappingRepository extends IRepository<AILearnedMapping> {
  findByOriginalName(name: string): Promise<AILearnedMapping | null>;
  findByRawName?(rawName: string): Promise<AILearnedMapping | null>;
}
