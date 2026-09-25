/**
 * PQM REBUILD - CHANGE CONTROL REPOSITORY INTERFACE
 */

import { ChangeRequest, ChangeStatus } from '../../types/changeControl';
import { IRepository } from '../types';

export interface IChangeControlRepository extends IRepository<ChangeRequest> {
  findByStatus(status: ChangeStatus): Promise<ChangeRequest[]>;
  findByProductId(productId: string): Promise<ChangeRequest[]>;
}
