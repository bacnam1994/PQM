/**
 * PQM 3.0 - Criteria Alias Repository Interface
 */

import { CriteriaAlias } from '../types';
import { IRepository } from './types';

export interface ICriteriaAliasRepository extends IRepository<CriteriaAlias> {
  findByTccsId(tccsId: string): Promise<CriteriaAlias[]>;
}
