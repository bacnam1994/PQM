import { Criterion, ProductFormula, FormulaIngredient } from '../types';
import { parseNumberFromText } from './criteriaEvaluation';
import { normalizeName, diceScore } from '../services/criteriaAliasService';
import { isCriteriaMatch, lookupPharmaTerm } from './aiMapping';

export interface BasisInfo {
  basis: number | undefined;
  basisType: 'ELEMENTAL' | 'DECLARED' | 'MIDPOINT' | 'MIN' | 'MAX' | 'MANUAL' | 'NONE';
  formulaItem?: FormulaIngredient;
  saltContent?: number;
  elementalContent?: number;
  isElementalCandidate: boolean;
  activeBasisLabel: string;
  sourceDescription: string;
}

const ELEMENTAL_KEYWORDS = [
  'tính theo', 'nguyên tố', 'elemental', 'ion', 'base',
  '(zn)', '(fe)', '(ca)', '(mg)', '(cu)', '(mn)', '(se)', '(cr)', '(mo)', '(i)', '(k)', '(na)', '(p)',
  'as zn', 'as fe', 'as ca', 'as mg', 'as cu', 'as mn', 'as se', 'as cr', 'as mo', 'as i', 'as k', 'as na',
  'kẽm', 'sắt', 'canxi', 'magnesi', 'magne', 'đồng', 'mangan', 'selen', 'crom', 'molypden', 'iod', 'i-ốt', 'kali', 'natri'
];

/**
 * Tìm thành phần công thức tương ứng theo 4 lớp khớp nối:
 * 1. Khớp theo formulaIngredientId (ID hoặc Tên)
 * 2. Khớp theo tên chuẩn (normalize)
 * 3. Khớp qua Từ điển Dược khoa (PHARMA_TERM_DICTIONARY)
 * 4. Khớp mờ ngữ nghĩa (isCriteriaMatch & diceScore)
 */
export const findMatchingFormulaItem = (
  criterion: Criterion | { name: string; formulaIngredientId?: string },
  formula: ProductFormula | undefined,
  resolver?: { isMatch: (a: string, b: string) => boolean }
): FormulaIngredient | undefined => {
  if (!formula) return undefined;
  const allItems: FormulaIngredient[] = [
    ...(formula.ingredients || []),
    ...(formula.excipients || [])
  ].filter(Boolean);

  if (allItems.length === 0) return undefined;

  // Lớp 0: Khớp trực tiếp qua formulaIngredientId
  if (criterion.formulaIngredientId) {
    const linked = criterion.formulaIngredientId.trim().toLowerCase();
    const match = allItems.find(i => 
      i.id?.toLowerCase() === linked || 
      i.name?.trim().toLowerCase() === linked ||
      (resolver && resolver.isMatch(i.name, linked)) ||
      normalizeName(i.name) === normalizeName(linked)
    );
    if (match) return match;
  }

  const critName = criterion.name || '';
  const critNorm = normalizeName(critName);

  // Lớp 1: Khớp chính xác tên đã chuẩn hóa
  const exact = allItems.find(i => normalizeName(i.name) === critNorm || (resolver && resolver.isMatch(i.name, critName)));
  if (exact) return exact;

  // Lớp 2: Khớp qua Từ điển Dược khoa
  const canonicalOfCriteria = lookupPharmaTerm(critName);
  if (canonicalOfCriteria) {
    const canonNorm = normalizeName(canonicalOfCriteria);
    for (const item of allItems) {
      const canonicalOfItem = lookupPharmaTerm(item.name);
      if (canonicalOfItem && canonicalOfItem === canonicalOfCriteria) return item;
      if (normalizeName(item.name) === canonNorm) return item;
    }
  }

  // Lớp 3: Khớp mờ ngữ nghĩa (Semantic mapping)
  for (const item of allItems) {
    if (isCriteriaMatch(critName, item.name) || isCriteriaMatch(item.name, critName)) {
      return item;
    }
  }

  // Lớp 4: Dice coefficient (ngưỡng 0.6)
  let bestItem: FormulaIngredient | undefined = undefined;
  let bestScore = 0.60;
  for (const item of allItems) {
    const score = Math.max(diceScore(critName, item.name), diceScore(item.name, critName));
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  return bestItem;
};

/**
 * Xác định hàm lượng cơ sở (Basis) để tính % cho một chỉ tiêu
 * Tự động ưu tiên hàm lượng nguyên tố (elementalContent) khi chỉ tiêu định lượng nguyên tố.
 */
export const resolveDeclaredBasis = (
  criterion: Criterion | any,
  formula: ProductFormula | undefined,
  resolver?: { isMatch: (a: string, b: string) => boolean },
  manualChoice: 'AUTO' | 'ELEMENTAL' | 'DECLARED' = 'AUTO'
): BasisInfo => {
  if (!criterion) {
    return {
      basis: undefined,
      basisType: 'NONE',
      isElementalCandidate: false,
      activeBasisLabel: '---',
      sourceDescription: 'Chưa có chỉ tiêu'
    };
  }

  const formulaItem = findMatchingFormulaItem(criterion, formula, resolver);

  const dc = formulaItem?.declaredContent != null
    ? (typeof formulaItem.declaredContent === 'string' ? parseNumberFromText(formulaItem.declaredContent) : Number(formulaItem.declaredContent))
    : undefined;
  const validDc = (dc !== undefined && !isNaN(dc) && dc > 0) ? dc : undefined;

  const ec = formulaItem?.elementalContent != null
    ? (typeof formulaItem.elementalContent === 'string' ? parseNumberFromText(formulaItem.elementalContent) : Number(formulaItem.elementalContent))
    : undefined;
  const validEc = (ec !== undefined && !isNaN(ec) && ec > 0) ? ec : undefined;

  const tccsDc = criterion.declaredContent != null && criterion.declaredContent !== ''
    ? (typeof criterion.declaredContent === 'string' ? parseNumberFromText(criterion.declaredContent) : Number(criterion.declaredContent))
    : undefined;
  const validTccsDc = (tccsDc !== undefined && !isNaN(tccsDc) && tccsDc > 0) ? tccsDc : undefined;

  const minVal = criterion.min != null && criterion.min !== ''
    ? (typeof criterion.min === 'string' ? parseNumberFromText(criterion.min) : Number(criterion.min))
    : undefined;
  const maxVal = criterion.max != null && criterion.max !== ''
    ? (typeof criterion.max === 'string' ? parseNumberFromText(criterion.max) : Number(criterion.max))
    : undefined;

  const isElementalCandidate = Boolean(validEc && validEc > 0);

  // 1. Nếu người dùng ép kiểu thủ công (Manual Choice)
  if (manualChoice === 'ELEMENTAL' && validEc) {
    return {
      basis: validEc,
      basisType: 'ELEMENTAL',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `${validEc} ${criterion.unit || formulaItem?.unit || ''} (Nguyên tố)`,
      sourceDescription: `Nguyên tố ${formulaItem?.name || ''}`
    };
  }
  if (manualChoice === 'DECLARED' && (validDc || validTccsDc)) {
    const b = validDc || validTccsDc;
    return {
      basis: b,
      basisType: 'DECLARED',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `${b} ${criterion.unit || formulaItem?.unit || ''} (Muối/Hợp chất)`,
      sourceDescription: `Muối/Hợp chất ${formulaItem?.name || ''}`
    };
  }

  // 2. Chế độ Tự động (AUTO):
  // A. Xét cấu hình rõ ràng trong TCCS (calculationBasis)
  if (criterion.calculationBasis === 'ELEMENTAL' && validEc) {
    return {
      basis: validEc,
      basisType: 'ELEMENTAL',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `${validEc} ${criterion.unit || formulaItem?.unit || ''} (Nguyên tố - TCCS)`,
      sourceDescription: `Nguyên tố từ công thức (${formulaItem?.name})`
    };
  }
  if (criterion.calculationBasis === 'DECLARED' && (validDc || validTccsDc)) {
    const b = validDc || validTccsDc;
    return {
      basis: b,
      basisType: 'DECLARED',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `${b} ${criterion.unit || formulaItem?.unit || ''} (Muối - TCCS)`,
      sourceDescription: `Muối từ công thức (${formulaItem?.name})`
    };
  }

  // B. Tự động nhận diện thông minh khi có elementalContent
  if (validEc && validEc > 0) {
    const cNameLower = (criterion.name || '').toLowerCase();
    
    // Kiểm tra tên chỉ tiêu có chứa từ khóa nguyên tố hoặc tên nguyên tố
    const hasElementalKeyword = ELEMENTAL_KEYWORDS.some(kw => cNameLower.includes(kw));

    // Kiểm tra thang đo số liệu: Min/Max trong TCCS gần với elementalContent hơn hay gần với declaredContent hơn?
    let isCloserToElemental = false;
    const refVal = (minVal !== undefined && maxVal !== undefined)
      ? (minVal + maxVal) / 2
      : (minVal !== undefined ? minVal : maxVal);

    if (refVal !== undefined && validDc !== undefined) {
      const distEc = Math.abs(refVal - validEc);
      const distDc = Math.abs(refVal - validDc);
      if (distEc < distDc) {
        isCloserToElemental = true;
      }
    }

    if (hasElementalKeyword || isCloserToElemental) {
      return {
        basis: validEc,
        basisType: 'ELEMENTAL',
        formulaItem,
        saltContent: validDc,
        elementalContent: validEc,
        isElementalCandidate: true,
        activeBasisLabel: `${validEc} ${criterion.unit || formulaItem?.unit || ''} (Nguyên tố)`,
        sourceDescription: `Tự động nhận diện nguyên tố (${formulaItem?.name})`
      };
    }
  }

  // C. Fallback: declaredContent từ công thức hoặc TCCS
  if (validDc) {
    return {
      basis: validDc,
      basisType: 'DECLARED',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `${validDc} ${criterion.unit || formulaItem?.unit || ''} (Công bố)`,
      sourceDescription: `Hàm lượng công bố từ công thức (${formulaItem?.name})`
    };
  }

  if (validTccsDc) {
    return {
      basis: validTccsDc,
      basisType: 'DECLARED',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `${validTccsDc} ${criterion.unit || ''} (Công bố TCCS)`,
      sourceDescription: `Hàm lượng công bố khai báo trong TCCS`
    };
  }

  // D. Fallback: Mức Min/Max trong TCCS
  if (minVal !== undefined && maxVal !== undefined && minVal > 0 && maxVal > 0) {
    const mid = (minVal + maxVal) / 2;
    return {
      basis: mid,
      basisType: 'MIDPOINT',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `${mid} ${criterion.unit || ''} (Trung điểm TCCS)`,
      sourceDescription: `Điểm giữa giới hạn Min (${minVal}) - Max (${maxVal})`
    };
  }

  if (minVal !== undefined && minVal > 0) {
    return {
      basis: minVal,
      basisType: 'MIN',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `≥ ${minVal} ${criterion.unit || ''} (Mức Min TCCS)`,
      sourceDescription: `Mức tối thiểu quy định trong TCCS`
    };
  }

  if (maxVal !== undefined && maxVal > 0) {
    return {
      basis: maxVal,
      basisType: 'MAX',
      formulaItem,
      saltContent: validDc,
      elementalContent: validEc,
      isElementalCandidate,
      activeBasisLabel: `≤ ${maxVal} ${criterion.unit || ''} (Mức Max TCCS)`,
      sourceDescription: `Mức tối đa quy định trong TCCS`
    };
  }

  return {
    basis: undefined,
    basisType: 'NONE',
    formulaItem,
    saltContent: validDc,
    elementalContent: validEc,
    isElementalCandidate,
    activeBasisLabel: 'Chưa có chuẩn',
    sourceDescription: 'Không có hàm lượng công bố hoặc mức giới hạn hợp lệ'
  };
};
