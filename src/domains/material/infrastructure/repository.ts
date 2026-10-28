/**
 * MATERIAL DOMAIN: INFRASTRUCTURE REPOSITORY BINDINGS
 */

import { IMaterialRepository } from '../../../repositories/interfaces/IMaterialRepository';
import { materialRepository as defaultMaterialRepo } from '../../../repositories/firebase/FirebaseMaterialRepository';

export { defaultMaterialRepo };
export type { IMaterialRepository };
