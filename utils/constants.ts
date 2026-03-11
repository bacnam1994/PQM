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

// --- Pagination & Limits ---
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 12,
  TEST_RESULTS_PAGE_SIZE: 12,
  TEST_RESULTS_LIST_PAGE_SIZE: 15,
  LOAD_MORE_INCREMENT: 50,
} as const;

// --- Toast Durations ---
export const TOAST = {
  DURATION_SHORT: 2000,
  DURATION_MEDIUM: 4000,
  DURATION_LONG: 5000,
} as const;

// --- Date Formats ---
export const DATE_FORMAT = {
  INPUT: 'YYYY-MM-DD',
  DISPLAY: 'en-GB',
} as const;

// --- Sync Status ---
export const SYNC_STATUS = {
  IDLE: 'IDLE',
  SAVED: 'SAVED',
  SAVING: 'SAVING',
  ERROR: 'ERROR',
  OFFLINE: 'OFFLINE',
} as const;
