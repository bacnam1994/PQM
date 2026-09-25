/**
 * TCCS DOMAIN: INFRASTRUCTURE REPOSITORY BINDINGS
 */

import { ITCCSRepository } from '../../../repositories/interfaces/ITCCSRepository';
import { tccsRepository as defaultTccsRepo } from '../../../repositories/firebase/FirebaseTCCSRepository';
import { ICriteriaAliasRepository } from '../../../repositories/interfaces/ICriteriaAliasRepository';
import { criteriaAliasRepository as defaultCriteriaAliasRepo } from '../../../repositories/firebase/FirebaseCriteriaAliasRepository';
import { IAILearnedMappingRepository } from '../../../repositories/interfaces/IAILearnedMappingRepository';
import { aiLearnedMappingRepository as defaultAiLearnedMappingRepo } from '../../../repositories/firebase/FirebaseAILearnedMappingRepository';

export { defaultTccsRepo, defaultCriteriaAliasRepo, defaultAiLearnedMappingRepo };
export type { ITCCSRepository, ICriteriaAliasRepository, IAILearnedMappingRepository };
