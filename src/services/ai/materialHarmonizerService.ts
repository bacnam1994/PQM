/**
 * materialHarmonizerService.ts
 * ============================
 * Dịch vụ AI & Thuật toán Rà soát, Chuẩn hóa & Gộp Nguyên liệu trùng lặp.
 * 
 * Tính năng chính:
 * 1. Phân tích độ tương đồng ngữ nghĩa giữa các nguyên liệu trong danh mục Master Catalog.
 * 2. Phát hiện các nguyên liệu trùng lặp (ví dụ: "Cao bạch quả", "Ginkgo Biloba Extract", "Chiết xuất bạch quả").
 * 3. Đề xuất kế hoạch gộp (Merge Plan): Giữ 1 nguyên liệu chuẩn, chuyển các tên còn lại thành Aliases.
 * 4. Tự động đồng bộ và tái liên kết materialId cho tất cả các Công thức sản phẩm (ProductFormulas).
 */

import { RawMaterial, ProductFormula, FormulaIngredient } from '../../types';
import { normalizeName } from '../criteriaAliasService';
import { PHARMA_TERM_DICTIONARY } from '../../utils/aiMapping';

export interface DuplicateGroup {
  id: string;
  primaryMaterial: RawMaterial;
  duplicateMaterials: RawMaterial[];
  similarityScore: number; // 0 - 100
  reason: string;
  affectedFormulasCount: number;
}

export interface HarmonizationReport {
  analyzedAt: string;
  totalMaterials: number;
  duplicateGroups: DuplicateGroup[];
  unlinkedFormulaIngredients: {
    formulaId: string;
    productId: string;
    productName?: string;
    ingredientName: string;
    isIngredient: boolean;
    suggestedMaterial?: RawMaterial;
    confidence: number;
  }[];
  healthScore: number; // 0 - 100 (100 = Hoàn toàn sạch và liên kết chuẩn)
}

/**
 * Danh sách các từ tiền tố/hậu tố dược khoa thường gặp để bóc tách từ gốc
 */
const PHARMA_AFFIXES = [
  'cao khô', 'cao lỏng', 'cao đặc', 'cao', 'chiết xuất', 'tinh chất', 'bột', 'dầu', 'tinh dầu',
  'extract', 'powder', 'dry extract', 'oil', 'isolate', 'solution', 'purified',
  'tá dược', 'hoạt chất', 'muối', 'hỗn hợp', 'dung dịch', 'chuẩn', 'grade',
  'acid', 'axit', 'vitamin', 'khoáng chất'
];

/**
 * Chuẩn hóa tên nguyên liệu để so sánh tương đồng (loại bỏ phụ tố bào chế)
 */
export const stripPharmaAffixes = (text: string): string => {
  let cleaned = normalizeName(text);
  let changed = true;
  while (changed) {
    changed = false;
    for (const affix of PHARMA_AFFIXES) {
      const normAffix = normalizeName(affix);
      if (cleaned.startsWith(normAffix + ' ')) {
        cleaned = cleaned.substring(normAffix.length).trim();
        changed = true;
      }
      if (cleaned.endsWith(' ' + normAffix)) {
        cleaned = cleaned.substring(0, cleaned.length - normAffix.length).trim();
        changed = true;
      }
    }
  }
  return cleaned;
};

/**
 * Tính toán độ tương đồng giữa 2 chuỗi (0 - 1)
 */
export const calculateStringSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeName(str1);
  const s2 = normalizeName(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.length < 2 || s2.length < 2) return s1 === s2 ? 1.0 : 0.0;

  // So sánh chuỗi đã bóc tách tiền tố
  const core1 = stripPharmaAffixes(str1);
  const core2 = stripPharmaAffixes(str2);
  if (core1 && core2) {
    if (core1 === core2) return 0.95;
    if (core1.length >= 3 && core2.length >= 3) {
      if (core1.includes(core2) || core2.includes(core1)) return 0.88;
    }
  }

  // Tra cứu từ điển Dược học song ngữ (chỉ áp dụng với thuật ngữ có độ dài >= 4 ký tự)
  for (const [canonical, aliases] of Object.entries(PHARMA_TERM_DICTIONARY)) {
    const entryTerms = [canonical, ...(aliases || [])].map(normalizeName).filter(t => t && t.length >= 4);
    if (entryTerms.length === 0) continue;
    const match1 = entryTerms.some(t => s1 === t || s1.startsWith(t + ' ') || s1.endsWith(' ' + t) || s1.includes(' ' + t + ' '));
    const match2 = entryTerms.some(t => s2 === t || s2.startsWith(t + ' ') || s2.endsWith(' ' + t) || s2.includes(' ' + t + ' '));
    if (match1 && match2) return 0.92;
  }

  // Token Jaccard similarity (dựa trên các từ đơn lẻ)
  const tokens1 = new Set(s1.split(/\s+/).filter(t => t.length > 0));
  const tokens2 = new Set(s2.split(/\s+/).filter(t => t.length > 0));
  let tokenIntersection = 0;
  tokens1.forEach(t => { if (tokens2.has(t)) tokenIntersection++; });
  const tokenUnion = new Set([...tokens1, ...tokens2]).size;
  const tokenJaccard = tokenUnion > 0 ? tokenIntersection / tokenUnion : 0;

  // Phân tách bigram ký tự
  const getBigrams = (str: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  };

  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);

  let intersection = 0;
  bigrams1.forEach(bg => {
    if (bigrams2.has(bg)) intersection++;
  });

  const total = bigrams1.size + bigrams2.size;
  const bigramScore = total > 0 ? (2.0 * intersection) / total : 0.0;

  return Math.max(bigramScore, tokenJaccard);
};

/**
 * Phân tích và tìm các nhóm nguyên liệu có khả năng bị trùng lặp
 */
export const analyzeMaterialDuplicates = (
  rawMaterials: RawMaterial[],
  productFormulas: ProductFormula[] = [],
  productMap: Map<string, { id: string; name: string }> = new Map()
): HarmonizationReport => {
  const analyzedAt = new Date().toISOString();
  const duplicateGroups: DuplicateGroup[] = [];
  const processedIds = new Set<string>();

  // Map số lần sử dụng của từng material trong formulas
  const usageCountMap = new Map<string, number>();
  productFormulas.forEach(f => {
    [...(f.ingredients || []), ...(f.excipients || [])].forEach(item => {
      if (item.materialId) {
        usageCountMap.set(item.materialId, (usageCountMap.get(item.materialId) || 0) + 1);
      }
    });
  });

  // 1. Quét tìm các cặp nguyên liệu tương đồng trong danh mục
  for (let i = 0; i < rawMaterials.length; i++) {
    const matA = rawMaterials[i];
    if (processedIds.has(matA.id)) continue;

    const duplicates: { mat: RawMaterial; score: number; reason: string }[] = [];

    for (let j = i + 1; j < rawMaterials.length; j++) {
      const matB = rawMaterials[j];
      if (processedIds.has(matB.id)) continue;

      let highestScore = 0;
      let matchReason = '';

      // A. So sánh tên chính
      const nameScore = calculateStringSimilarity(matA.name, matB.name);
      if (nameScore > highestScore) {
        highestScore = nameScore;
        matchReason = `Tên tương đồng (${Math.round(nameScore * 100)}%)`;
      }

      // B. Kiểm tra tên B có trùng với bất kỳ Alias nào của A không
      if (Array.isArray(matA.aliases)) {
        for (const aliasA of matA.aliases) {
          const score = calculateStringSimilarity(aliasA, matB.name);
          if (score >= 0.70 && score > highestScore) {
            highestScore = score;
            matchReason = `Tên trùng khớp với Alias "${aliasA}" của nguyên liệu gốc`;
          }
        }
      }

      // C. Kiểm tra tên A có trùng với bất kỳ Alias nào của B không
      if (Array.isArray(matB.aliases)) {
        for (const aliasB of matB.aliases) {
          const score = calculateStringSimilarity(matA.name, aliasB);
          if (score >= 0.70 && score > highestScore) {
            highestScore = score;
            matchReason = `Tên trùng khớp với Alias "${aliasB}" của nguyên liệu phụ`;
          }
        }
      }

      // D. Kiểm tra CAS Number nếu cả 2 đều có
      if (matA.casNumber && matB.casNumber && matA.casNumber.trim() === matB.casNumber.trim()) {
        highestScore = 1.0;
        matchReason = `Trùng mã số CAS: ${matA.casNumber}`;
      }

      // Nếu độ tương đồng >= 70%
      if (highestScore >= 0.70) {
        duplicates.push({ mat: matB, score: highestScore, reason: matchReason });
      }
    }

    if (duplicates.length > 0) {
      // Xác định primary material: ưu tiên nguyên liệu có số lần sử dụng cao hơn hoặc tên đầy đủ hơn
      const candidates = [matA, ...duplicates.map(d => d.mat)];
      candidates.sort((c1, c2) => {
        const u1 = usageCountMap.get(c1.id) || 0;
        const u2 = usageCountMap.get(c2.id) || 0;
        if (u1 !== u2) return u2 - u1;
        return (c2.aliases?.length || 0) - (c1.aliases?.length || 0);
      });

      const primary = candidates[0];
      const otherDuplicates = candidates.slice(1);

      // Đánh dấu các ID đã xử lý
      candidates.forEach(c => processedIds.add(c.id));

      const avgScore = Math.round(
        duplicates.reduce((sum, d) => sum + d.score, 0) / duplicates.length * 100
      );

      const affectedFormulas = otherDuplicates.reduce((sum, d) => sum + (usageCountMap.get(d.id) || 0), 0);

      duplicateGroups.push({
        id: `dup_group_${primary.id}`,
        primaryMaterial: primary,
        duplicateMaterials: otherDuplicates,
        similarityScore: avgScore,
        reason: duplicates[0]?.reason || 'Tương đồng tên gọi và hoạt chất',
        affectedFormulasCount: affectedFormulas,
      });
    }
  }

  // 2. Quét các thành phần trong công thức chưa được liên kết
  const unlinkedFormulaIngredients: HarmonizationReport['unlinkedFormulaIngredients'] = [];
  const materialNameMap = new Map<string, RawMaterial>();
  rawMaterials.forEach(m => {
    materialNameMap.set(normalizeName(m.name), m);
    (m.aliases || []).forEach(a => materialNameMap.set(normalizeName(a), m));
  });

  productFormulas.forEach(f => {
    const prod = productMap.get(f.productId);
    const checkItem = (item: FormulaIngredient, isIngredient: boolean) => {
      if (!item.materialId || !rawMaterials.some(m => m.id === item.materialId)) {
        let bestMatch: RawMaterial | undefined;
        let highestConf = 0;

        // Thử tìm chính xác
        const norm = normalizeName(item.name);
        if (materialNameMap.has(norm)) {
          bestMatch = materialNameMap.get(norm);
          highestConf = 1.0;
        } else {
          // Thử tìm mờ
          for (const m of rawMaterials) {
            const score = calculateStringSimilarity(item.name, m.name);
            if (score > highestConf && score >= 0.75) {
              highestConf = score;
              bestMatch = m;
            }
          }
        }

        unlinkedFormulaIngredients.push({
          formulaId: f.id,
          productId: f.productId,
          productName: prod?.name,
          ingredientName: item.name,
          isIngredient,
          suggestedMaterial: bestMatch,
          confidence: Math.round(highestConf * 100),
        });
      }
    };

    (f.ingredients || []).forEach(i => checkItem(i, true));
    (f.excipients || []).forEach(e => checkItem(e, false));
  });

  // Tính điểm sức khỏe dữ liệu nguyên liệu (0 - 100)
  let healthScore = 100;
  healthScore -= duplicateGroups.length * 15;
  healthScore -= unlinkedFormulaIngredients.length * 5;
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    analyzedAt,
    totalMaterials: rawMaterials.length,
    duplicateGroups,
    unlinkedFormulaIngredients,
    healthScore,
  };
};

/**
 * Kế hoạch gộp nguyên liệu: Tạo dữ liệu cập nhật cho Store/Firebase
 */
export interface MergeExecutionPlan {
  updatedPrimaryMaterial: RawMaterial;
  deletedMaterialIds: string[];
  updatedFormulas: ProductFormula[];
}

export const createMergeExecutionPlan = (
  group: DuplicateGroup,
  productFormulas: ProductFormula[]
): MergeExecutionPlan => {
  const primary = { ...group.primaryMaterial };
  const duplicates = group.duplicateMaterials;
  const duplicateIds = new Set(duplicates.map(d => d.id));

  // Tập hợp toàn bộ aliases mới
  const allAliases = new Set<string>(primary.aliases || []);
  duplicates.forEach(d => {
    if (d.name && d.name !== primary.name) allAliases.add(d.name);
    (d.aliases || []).forEach(a => {
      if (a && a !== primary.name) allAliases.add(a);
    });
  });

  primary.aliases = Array.from(allAliases).filter(a => a.trim() !== '');
  primary.updatedAt = new Date().toISOString();

  // Cập nhật các trường còn thiếu từ duplicate nếu primary chưa có
  duplicates.forEach(d => {
    if (!primary.code && d.code) primary.code = d.code;
    if (!primary.standard && d.standard) primary.standard = d.standard;
    if (!primary.casNumber && d.casNumber) primary.casNumber = d.casNumber;
    if (!primary.description && d.description) primary.description = d.description;
  });

  // Cập nhật các formula đang trỏ vào duplicateIds sang primary.id
  const updatedFormulas: ProductFormula[] = [];
  productFormulas.forEach(f => {
    let hasChange = false;
    const newIngredients = (f.ingredients || []).map(ing => {
      if (ing.materialId && duplicateIds.has(ing.materialId)) {
        hasChange = true;
        return { ...ing, materialId: primary.id };
      }
      return ing;
    });

    const newExcipients = (f.excipients || []).map(exc => {
      if (exc.materialId && duplicateIds.has(exc.materialId)) {
        hasChange = true;
        return { ...exc, materialId: primary.id };
      }
      return exc;
    });

    if (hasChange) {
      updatedFormulas.push({
        ...f,
        ingredients: newIngredients,
        excipients: newExcipients,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  return {
    updatedPrimaryMaterial: primary,
    deletedMaterialIds: Array.from(duplicateIds),
    updatedFormulas,
  };
};
