/**
 * PQM REBUILD - CRITERIA ALIAS REPOSITORY INTERFACE
 */

import { CriteriaAlias } from '../../types';
import { IRepository } from '../types';

export interface ICriteriaAliasRepository extends IRepository<CriteriaAlias> {
  findByAlias(alias: string): Promise<CriteriaAlias | null>;
}
