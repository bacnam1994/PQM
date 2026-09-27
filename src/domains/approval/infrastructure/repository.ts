/**
 * APPROVAL DOMAIN: REPOSITORY & INFRASTRUCTURE BINDINGS
 */

import { IApprovalTaskRepository } from '../../../repositories/IApprovalTaskRepository';
import { firebaseApprovalTaskRepository } from '../../../repositories/firebase/FirebaseApprovalTaskRepository';
import { signatureService } from '../../../services/signatureService';

export const approvalInfrastructure = {
  approvalTaskRepository: firebaseApprovalTaskRepository,
  signatureService,
};

export { firebaseApprovalTaskRepository, signatureService };
export type { IApprovalTaskRepository };
