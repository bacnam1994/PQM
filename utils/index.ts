// Re-export constants and utilities
export * from './constants';
export * from './dateUtils';
export * from './idGenerator';
export * from './removeUndefined';

// Explicitly handle duplicate exports from numberParsing and criteriaEvaluation
// Re-export from numberParsing with aliases to avoid conflicts
export { 
  normalizeNumericString as normalizeNumericStringNP, 
  parseNumberFromText as parseNumberFromTextNP, 
  autoFormatInput as autoFormatInputNP,
  parseSpecialValue
} from './numberParsing';

// Re-export from criteriaEvaluation (these are the main versions)
export { 
  normalizeNumericString, 
  parseNumberFromText, 
  autoFormatInput,
  checkRange,
  evaluateCriterionSmart
} from './criteriaEvaluation';

export * from './parsing';
export * from './criteriaUtils';
export * from './evaluation';
export * from './batchEvaluation';
export * from './inventoryUtils';
export * from './materialUtils';
export * from './optimization';
export * from './reportUtils';
export * from './searchUtils';

// New modular exports
export * from './validation';
export * from './formatting';

// Explicitly re-export optimized functions for clarity
export { calculateStockMap, clearStockCache } from './optimization';
