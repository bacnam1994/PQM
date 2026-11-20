import { ensureArray } from './index';

/**
 * BOUNDARY ENTITY NORMALIZER (DEFENSE-IN-DEPTH AT DATA INGESTION)
 * ================================================================
 * Firebase Realtime Database tự động xóa các trường mảng rỗng (`[]` -> `undefined`)
 * hoặc chuyển mảng thành Object có khóa số (`{0: ..., 1: ...}`), đồng thời các trường
 * chuỗi/ngày tùy chọn trên dữ liệu lịch sử có thể bị `undefined` hoặc kiểu số.
 *
 * Tầng chuẩn hóa biên này ép chuẩn 100% thực thể ngay khi đọc từ Firebase RTDB
 * hoặc IndexedDB trước khi nạp vào TanStack Query Cache và Zustand Store,
 * triệt tiêu tận gốc lỗi `TypeError: Cannot read properties of undefined` ở tầng UI/Domain.
 */
export function normalizeEntityByCollection<T = any>(
  collectionKey: string,
  rawItem: T,
  fallbackId?: string
): T {
  if (!rawItem || typeof rawItem !== 'object') return rawItem;
  const item: any = { ...rawItem };
  if (!item.id && fallbackId) {
    item.id = fallbackId;
  }

  switch (collectionKey) {
    case 'products':
      item.name = item.name != null ? String(item.name) : '';
      item.code = item.code != null ? String(item.code) : '';
      item.registrant = item.registrant != null ? String(item.registrant) : '';
      item.group = item.group != null ? String(item.group) : '';
      break;

    case 'batches':
      item.batchNo = item.batchNo != null ? String(item.batchNo) : '';
      item.mfgDate = item.mfgDate != null ? String(item.mfgDate) : '';
      item.expDate = item.expDate != null ? String(item.expDate) : '';
      item.attachments = ensureArray(item.attachments);
      if (item.releaseSignatures !== undefined) {
        item.releaseSignatures = ensureArray(item.releaseSignatures);
      }
      if (item.tccsSnapshot && typeof item.tccsSnapshot === 'object') {
        item.tccsSnapshot = {
          ...item.tccsSnapshot,
          mainQualityCriteria: ensureArray(item.tccsSnapshot.mainQualityCriteria),
          safetyCriteria: ensureArray(item.tccsSnapshot.safetyCriteria),
          alternateRules: ensureArray(item.tccsSnapshot.alternateRules),
        };
      }
      if (item.formulaSnapshot && typeof item.formulaSnapshot === 'object') {
        item.formulaSnapshot = {
          ...item.formulaSnapshot,
          ingredients: ensureArray(item.formulaSnapshot.ingredients),
          excipients: ensureArray(item.formulaSnapshot.excipients),
        };
      }
      break;

    case 'tccsList':
    case 'tccs':
      item.code = item.code != null ? String(item.code) : '';
      item.issueDate = item.issueDate != null ? String(item.issueDate) : '';
      item.mainQualityCriteria = ensureArray(item.mainQualityCriteria);
      item.safetyCriteria = ensureArray(item.safetyCriteria);
      item.alternateRules = ensureArray(item.alternateRules);
      break;

    case 'productFormulas':
      item.ingredients = ensureArray(item.ingredients);
      item.excipients = ensureArray(item.excipients);
      break;

    case 'rawMaterials':
      item.name = item.name != null ? String(item.name) : '';
      item.code = item.code != null ? String(item.code) : '';
      item.aliases = ensureArray(item.aliases);
      break;

    case 'testResults':
      item.testDate = item.testDate != null ? String(item.testDate) : '';
      item.labName = item.labName != null ? String(item.labName) : '';
      item.results = ensureArray(item.results);
      item.extraCriteria = ensureArray(item.extraCriteria);
      item.attachments = ensureArray(item.attachments);
      if (item.evaluationSnapshot && typeof item.evaluationSnapshot === 'object') {
        item.evaluationSnapshot = {
          ...item.evaluationSnapshot,
          criterionResults: ensureArray(item.evaluationSnapshot.criterionResults),
        };
      }
      break;

    case 'criteriaAliases':
      item.aliases = ensureArray(item.aliases);
      break;

    case 'testingLaboratories':
      item.code = item.code != null ? String(item.code) : '';
      item.canonicalName = item.canonicalName != null ? String(item.canonicalName) : '';
      item.aliases = ensureArray(item.aliases);
      break;

    default:
      break;
  }

  return item as T;
}

export function normalizeCollectionList<T = any>(
  collectionKey: string,
  list: T[] | null | undefined
): T[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item) => item != null && typeof item === 'object')
    .map((item) => normalizeEntityByCollection(collectionKey, item));
}
