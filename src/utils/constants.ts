// d:\26 Kiem nghiem\hệ-thống-quản-lý-chất-lượng\utils\constants.ts

export const TEST_RESULT_STATUS = {
  PASS: 'PASS',
  FAIL: 'FAIL',
} as const;

export const BATCH_STATUS = {
  PENDING: 'PENDING',
  TESTING: 'TESTING',
  RELEASED: 'RELEASED',
  REJECTED: 'REJECTED',
} as const;

export const PRODUCT_STATUS = {
  ACTIVE: 'ACTIVE',
  DISCONTINUED: 'DISCONTINUED',
  RECALLED: 'RECALLED',
} as const;

export const EVALUATION_RULE = {
  FAIL_RETRY: 'FAIL_RETRY',
  CONDITIONAL_CHECK: 'CONDITIONAL_CHECK',
} as const;

export const CRITERION_TYPE_CONST = {
  NUMBER: 'NUMBER',
  TEXT: 'TEXT',
} as const;
