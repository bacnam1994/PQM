/**
 * FORMULA DOMAIN: INFRASTRUCTURE REPOSITORY BINDINGS
 */

import { IFormulaRepository } from '../../../repositories/interfaces/IFormulaRepository';
import { formulaRepository as defaultFormulaRepo } from '../../../repositories/firebase/FirebaseFormulaRepository';

export { defaultFormulaRepo };
export type { IFormulaRepository };
