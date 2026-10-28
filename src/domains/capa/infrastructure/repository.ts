/**
 * CAPA DOMAIN: REPOSITORY BINDING
 * CAPA items are stored within the Deviation aggregate in the Deviation repository
 */

import {
  FirebaseDeviationRepository,
  firebaseDeviationRepository,
} from '../../../repositories/firebase/FirebaseDeviationRepository';
import type { IDeviationRepository } from '../../../repositories/interfaces/IDeviationRepository';

export { FirebaseDeviationRepository, firebaseDeviationRepository };
export type { IDeviationRepository };
