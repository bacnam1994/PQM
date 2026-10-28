/**
 * BATCH DOMAIN: RULES & STATE MACHINE
 */

import { BatchRules as BaseBatchRules } from '../../../domain/rules/BatchRules';

export { ReleaseRules } from '../../../domain/rules/ReleaseRules';
export { BatchStateMachine } from '../../../domain/workflow/stateMachine';

export class BatchRules extends BaseBatchRules {
  public static validateBatchMetadata(metadata: {
    batchNo?: string;
    productId?: string;
    mfgDate?: string;
    expDate?: string;
  }): { isValid: boolean; error?: string } {
    if (!metadata.batchNo || !metadata.batchNo.trim()) {
      return { isValid: false, error: 'Số lô không được để trống.' };
    }
    if (!metadata.productId || !metadata.productId.trim()) {
      return { isValid: false, error: 'Sản phẩm không được để trống.' };
    }
    if (metadata.mfgDate && metadata.expDate && metadata.expDate <= metadata.mfgDate) {
      return { isValid: false, error: 'Hạn dùng phải sau ngày sản xuất.' };
    }
    return { isValid: true };
  }
}
