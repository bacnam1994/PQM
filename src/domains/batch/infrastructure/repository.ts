/**
 * BATCH DOMAIN: INFRASTRUCTURE REPOSITORY BINDINGS
 */

import { IBatchRepository } from '../../../repositories/interfaces/IBatchRepository';
import { batchRepository as defaultBatchRepo } from '../../../repositories/firebase/FirebaseBatchRepository';

export { defaultBatchRepo };
export type { IBatchRepository };
