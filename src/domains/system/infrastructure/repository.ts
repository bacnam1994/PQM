/**
 * SYSTEM DOMAIN: INFRASTRUCTURE REPOSITORY BINDINGS (VS-14)
 * ==========================================================
 * Liên kết Repository trừu tượng với triển khai Firebase hạ tầng thực tế.
 */

import { ISystemRepository } from '../../../repositories/ISystemRepository';
import { firebaseSystemRepository } from '../../../repositories/firebase/FirebaseSystemRepository';

export type { ISystemRepository };
export { firebaseSystemRepository };
