/**
 * PQM REBUILD - SYSTEM REPOSITORY INTERFACE
 */

import { IRepository } from '../types';

export interface ISystemRepository extends IRepository<any> {
  backup(): Promise<Record<string, any>>;
  restore(backupData: Record<string, any>): Promise<void>;
  wipeDemoData(): Promise<void>;
}
