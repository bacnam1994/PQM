/**
 * OOS DOMAIN: REPOSITORY BINDING
 * OOS investigations are persisted through the Deviation repository infrastructure
 */

import {
  FirebaseDeviationRepository,
  firebaseDeviationRepository,
} from '../../../repositories/firebase/FirebaseDeviationRepository';
import type { IDeviationRepository } from '../../../repositories/interfaces/IDeviationRepository';

export { FirebaseDeviationRepository, firebaseDeviationRepository };
export type { IDeviationRepository };
