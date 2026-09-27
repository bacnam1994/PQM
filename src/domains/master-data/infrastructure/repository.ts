/**
 * MASTER DATA DOMAIN: REPOSITORY & INFRASTRUCTURE BINDINGS
 */

import { IMasterCriterionRepository } from '../../../repositories/MasterCriterionRepository';
import { masterCriterionRepository } from '../../../repositories/firebase/FirebaseMasterCriterionRepository';
import { IPharmacopoeiaRepository } from '../../../repositories/IPharmacopoeiaRepository';
import { firebasePharmacopoeiaRepository } from '../../../repositories/firebase/FirebasePharmacopoeiaRepository';
import { ILaboratoryRepository } from '../../../repositories/ILaboratoryRepository';
import { firebaseLaboratoryRepository } from '../../../repositories/firebase/FirebaseLaboratoryRepository';

export const masterDataInfrastructure = {
  masterCriterionRepository,
  pharmacopoeiaRepository: firebasePharmacopoeiaRepository,
  laboratoryRepository: firebaseLaboratoryRepository,
};

export { masterCriterionRepository, firebasePharmacopoeiaRepository, firebaseLaboratoryRepository };

export type { IMasterCriterionRepository, IPharmacopoeiaRepository, ILaboratoryRepository };
