/**
 * CHANGE REQUEST DOMAIN: REPOSITORY BINDING
 * Gắn kết giao diện IChangeControlRepository với triển khai Firebase
 */

import {
  FirebaseChangeControlRepository,
  firebaseChangeControlRepository,
} from '../../../repositories/firebase/FirebaseChangeControlRepository';
import type { IChangeControlRepository } from '../../../repositories/interfaces/IChangeControlRepository';

export { FirebaseChangeControlRepository, firebaseChangeControlRepository };
export type { IChangeControlRepository };
