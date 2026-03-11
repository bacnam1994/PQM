
/**
 * Validation Utilities
 * 
 * Common validation functions for the application.
 * Re-exports from existing utils and adds new validation functions.
 */

import { Product, Batch, TCCS, TestResult, RawMaterial } from '../../types';

// Re-export existing validation functions
export { evaluateCriterion, ensureArray } from '../parsing';

// ============================================
// ENTITY VALIDATION
// ============================================

/**
 * Validate Product data
 */
export const validateProduct = (product: Partial<Product>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!product.code?.trim()) {
    errors.push('Mã sản phẩm là bắt buộc');
  }
  
  if (!product.name?.trim()) {
    errors.push('Tên sản phẩm là bắt buộc');
  }
  
  if (!product.group?.trim()) {
    errors.push('Nhóm sản phẩm là bắt buộc');
  }
  
  if (!product.registrant?.trim()) {
    errors.push('Đơn vị đăng ký là bắt buộc');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate Batch data
 */
export const validateBatch = (batch: Partial<Batch>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!batch.productId?.trim()) {
    errors.push('Sản phẩm là bắt buộc');
  }
  
  if (!batch.batchNo?.trim()) {
    errors.push('Số lô là bắt buộc');
  }
  
  if (!batch.mfgDate?.trim()) {
    errors.push('Ngày sản xuất là bắt buộc');
  }
  
  if (!batch.expDate?.trim()) {
    errors.push('Hạn sử dụng là bắt buộc');
  }
  
  if (batch.mfgDate && batch.expDate) {
    const mfg = new Date(batch.mfgDate);
    const exp = new Date(batch.expDate);
    if (exp <= mfg) {
      errors.push('Hạn sử dụng phải lớn hơn ngày sản xuất');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate TCCS data
 */
export const validateTCCS = (tccs: Partial<TCCS>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!tccs.productId?.trim()) {
    errors.push('Sản phẩm là bắt buộc');
  }
  
  if (!tccs.code?.trim()) {
    errors.push('Mã TCCS là bắt buộc');
  }
  
  if (!tccs.issueDate?.trim()) {
    errors.push('Ngày ban hành là bắt buộc');
  }
  
  if (!tccs.mainQualityCriteria || tccs.mainQualityCriteria.length === 0) {
    errors.push('Tiêu chí chất lượng chính là bắt buộc');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate Test Result data
 */
export const validateTestResult = (result: Partial<TestResult>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!result.batchId?.trim()) {
    errors.push('Lô hàng là bắt buộc');
  }
  
  if (!result.labName?.trim()) {
    errors.push('Tên phòng thí nghiệm là bắt buộc');
  }
  
  if (!result.testDate?.trim()) {
    errors.push('Ngày thử nghiệm là bắt buộc');
  }
  
  if (!result.results || result.results.length === 0) {
    errors.push('Kết quả thử nghiệm là bắt buộc');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate Raw Material data
 */
export const validateRawMaterial = (material: Partial<RawMaterial>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!material.name?.trim()) {
    errors.push('Tên nguyên liệu là bắt buộc');
  }
  
  if (!material.category) {
    errors.push('Loại nguyên liệu là bắt buộc');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

// ============================================
// FIELD VALIDATION
// ============================================

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format (Vietnam)
 */
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
  return phoneRegex.test(phone.replace(/[\s.-]/g, ''));
};

/**
 * Validate date string
 */
export const isValidDate = (dateStr: string): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
};

/**
 * Validate date range
 */
export const isValidDateRange = (startDate: string, endDate: string): boolean => {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end;
};

/**
 * Validate number within range
 */
export const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

/**
 * Validate required field
 */
export const isRequired = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
};

/**
 * Validate minimum length
 */
export const minLength = (value: string, min: number): boolean => {
  return value && value.length >= min;
};

/**
 * Validate maximum length
 */
export const maxLength = (value: string, max: number): boolean => {
  return value && value.length <= max;
};

// ============================================
// CRITERION VALIDATION (P0)
// ============================================

import { Criterion, CriterionType } from '../../types';

/**
 * Validate Criterion data - ensures min < max for NUMBER type
 */
export const validateCriterion = (criterion: Partial<Criterion>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!criterion.name?.trim()) {
    errors.push('Tên tiêu chí là bắt buộc');
  }
  
  if (!criterion.type) {
    errors.push('Loại tiêu chí là bắt buộc');
  }
  
  // Validate min < max for NUMBER type
  if (criterion.type === CriterionType.NUMBER) {
    if (criterion.min !== undefined && criterion.min !== null && criterion.max !== undefined && criterion.max !== null) {
      if (criterion.min >= criterion.max) {
        errors.push('Giá trị tối thiểu phải nhỏ hơn giá trị tối đa');
      }
    }
    
    // If only one bound is set, validate it's reasonable
    if (criterion.min !== undefined && criterion.min !== null && criterion.min < 0) {
      errors.push('Giá trị tối thiểu không được âm');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Validate all criteria in a list
 */
export const validateCriteriaList = (criteria: Partial<Criterion>[], criteriaType: string = 'Tiêu chí'): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!criteria || criteria.length === 0) {
    errors.push(`${criteriaType}: Danh sách tiêu chí không được để trống`);
    return { valid: false, errors };
  }
  
  criteria.forEach((criterion, index) => {
    const result = validateCriterion(criterion);
    if (!result.valid) {
      result.errors.forEach(err => {
        errors.push(`${criteriaType} #${index + 1}: ${err}`);
      });
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Check if a value is within the acceptable range for a criterion
 */
export const isValueWithinCriterionRange = (criterion: Criterion, value: string | number): { valid: boolean; message?: string } => {
  if (criterion.type !== CriterionType.NUMBER) {
    return { valid: true };
  }
  
  const numValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/,/g, '.'));
  
  if (isNaN(numValue)) {
    return { valid: false, message: 'Giá trị nhập phải là số' };
  }
  
  // Check bounds
  if (criterion.min !== undefined && criterion.min !== null && numValue < criterion.min) {
    return { valid: false, message: `Giá trị nhỏ hơn giới hạn tối thiểu (${criterion.min})` };
  }
  
  if (criterion.max !== undefined && criterion.max !== null && numValue > criterion.max) {
    return { valid: false, message: `Giá trị vượt giới hạn tối đa (${criterion.max})` };
  }
  
  return { valid: true };
};

/**
 * Validate TCCS with full criteria validation
 */
export const validateTCCSWithCriteria = (tccs: Partial<TCCS>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Basic TCCS validation
  if (!tccs.productId?.trim()) {
    errors.push('Sản phẩm là bắt buộc');
  }
  
  if (!tccs.code?.trim()) {
    errors.push('Mã TCCS là bắt buộc');
  }
  
  if (!tccs.issueDate?.trim()) {
    errors.push('Ngày ban hành là bắt buộc');
  }
  
  // Validate main quality criteria
  if (tccs.mainQualityCriteria) {
    const mainResult = validateCriteriaList(tccs.mainQualityCriteria, 'Tiêu chí chất lượng chính');
    errors.push(...mainResult.errors);
  }
  
  // Validate safety criteria
  if (tccs.safetyCriteria) {
    const safetyResult = validateCriteriaList(tccs.safetyCriteria, 'Tiêu chí an toàn');
    errors.push(...safetyResult.errors);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};



