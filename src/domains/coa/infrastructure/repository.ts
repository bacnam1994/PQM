/**
 * COA DOMAIN: REPOSITORY & INFRASTRUCTURE BINDINGS
 */

import { testResultRepository } from '../../../repositories/firebase/FirebaseTestResultRepository';
import { batchRepository } from '../../../repositories/firebase/FirebaseBatchRepository';
import { productRepository } from '../../../repositories/firebase/FirebaseProductRepository';
import { tccsRepository } from '../../../repositories/firebase/FirebaseTCCSRepository';
import { formulaRepository } from '../../../repositories/firebase/FirebaseFormulaRepository';
import { signatureService } from '../../../services/signatureService';

export const coaInfrastructure = {
  testResultRepository,
  batchRepository,
  productRepository,
  tccsRepository,
  formulaRepository,
  signatureService,
};

export {
  testResultRepository,
  batchRepository,
  productRepository,
  tccsRepository,
  formulaRepository,
  signatureService,
};
