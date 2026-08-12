/**
 * criteriaAliasService.ts
 * ========================
 * Hệ thống giải mã tên chỉ tiêu TCCS.
 *
 * Mục tiêu: Duy trì tương thích ngược giữa phiếu kết quả kiểm nghiệm đã lưu
 * (dùng tên cũ) và TCCS đã chỉnh sửa (tên mới/chuẩn), mà không cần thay đổi
 * dữ liệu gốc của các phiếu cũ.
 */

import { CriteriaAlias, TCCS, TestResult } from '../types';

// =============================================================================
// 1. CHUẨN HÓA CHUỖI
// =============================================================================

/**
 * Chuẩn hóa tên chỉ tiêu để so sánh:
 * - Lowercase
 * - Bỏ khoảng trắng thừa ở đầu/cuối
 * - Chuẩn hóa khoảng trắng bên trong (nhiều dấu cách → 1 dấu cách)
 * - Bỏ dấu chấm câu thừa (chấm, phẩy cuối chuỗi)
 */
export const normalizeName = (name: string): string => {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')           // chuẩn hóa khoảng trắng
    .replace(/[.,;:!?]+$/, '')      // bỏ dấu câu cuối
    .replace(/\s*[-–]\s*/g, ' - ') // chuẩn hóa dấu gạch ngang
    .trim();
};

// =============================================================================
// 2. FUZZY MATCHING — Dice Coefficient
// =============================================================================

/**
 * Tính điểm tương đồng Dice Coefficient giữa 2 chuỗi (0 → 1).
 * Dice = 2 * |bigrams_chung| / (|bigrams_A| + |bigrams_B|)
 */
const getBigrams = (str: string): Map<string, number> => {
  const bigrams = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bigram = str.slice(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }
  return bigrams;
};

export const diceScore = (a: string, b: string): number => {
  const normA = normalizeName(a);
  const normB = normalizeName(b);

  if (normA === normB) return 1.0;
  if (normA.length < 2 || normB.length < 2) return 0;

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);

  let intersection = 0;
  bigramsA.forEach((count, bigram) => {
    const countB = bigramsB.get(bigram) || 0;
    intersection += Math.min(count, countB);
  });

  const totalA = normA.length - 1;
  const totalB = normB.length - 1;

  return (2 * intersection) / (totalA + totalB);
};

/**
 * Kiểm tra "chứa nhau" — chuỗi ngắn hơn có phải là substring của chuỗi dài hơn không.
 * Dùng để bắt các trường hợp tên viết tắt / tên đầy đủ.
 */
const isSubstringMatch = (a: string, b: string): boolean => {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (!normA || !normB) return false;
  return normA.includes(normB) || normB.includes(normA);
};

/**
 * Tính điểm tổng hợp dùng để quyết định có phải alias hay không.
 * Kết hợp Dice + substring bonus.
 */
export const similarityScore = (a: string, b: string): number => {
  const dice = diceScore(a, b);
  const subBonus = isSubstringMatch(a, b) ? 0.1 : 0;
  return Math.min(1, dice + subBonus);
};

// Ngưỡng tối thiểu để coi là có thể là alias
export const FUZZY_THRESHOLD = 0.65;
// Ngưỡng để tự động xác nhận (không cần Admin duyệt)
export const AUTO_CONFIRM_THRESHOLD = 0.92;

// =============================================================================
// 3. RESOLVER — Giải mã tên chỉ tiêu
// =============================================================================

/**
 * Map tra cứu nhanh O(1): alias (normalized) → tên chuẩn (canonical)
 */
export type AliasLookupMap = Map<string, string>; // alias → canonicalName

/**
 * Xây dựng lookup map từ danh sách CriteriaAlias của một TCCS.
 */
export const buildAliasLookupMap = (
  aliases: CriteriaAlias[],
  tccsId: string
): AliasLookupMap => {
  const map: AliasLookupMap = new Map();
  aliases
    .filter(a => a.tccsId === tccsId)
    .forEach(a => {
      // Alias list → canonical
      a.aliases.forEach(alias => {
        map.set(normalizeName(alias), a.canonicalName);
      });
      // Tên chuẩn cũng map về chính nó
      map.set(normalizeName(a.canonicalName), a.canonicalName);
    });
  return map;
};

/**
 * Giải mã tên chỉ tiêu rawName về tên chuẩn trong TCCS.
 *
 * Thứ tự ưu tiên:
 * 1. Khớp exact (sau normalize) với tên chuẩn hiện tại → dùng ngay
 * 2. Khớp qua bảng alias đã lưu → trả về canonical
 * 3. Không khớp → trả về rawName gốc (để CoA vẫn hiển thị được)
 */
export const resolveCriteriaName = (
  rawName: string,
  tccs: TCCS,
  aliasLookupMap: AliasLookupMap
): string => {
  if (!rawName) return rawName;

  const normalized = normalizeName(rawName);

  // 1. Kiểm tra xem có phải tên chuẩn hiện tại không
  const allCurrent = [
    ...(tccs.mainQualityCriteria || []),
    ...(tccs.safetyCriteria || []),
  ];
  const isCurrentName = allCurrent.some(
    c => c && normalizeName(c.name) === normalized
  );
  if (isCurrentName) return rawName; // giữ nguyên, đã đúng

  // 2. Tra cứu trong alias map
  const resolved = aliasLookupMap.get(normalized);
  if (resolved) return resolved;

  return rawName; // không tìm thấy → trả về gốc
};

/**
 * Từ tên chuẩn, tìm tất cả các alias đã biết (để query ngược).
 */
export const getKnownAliasesFor = (
  canonicalName: string,
  aliases: CriteriaAlias[],
  tccsId: string
): string[] => {
  const entry = aliases.find(
    a => a.tccsId === tccsId && normalizeName(a.canonicalName) === normalizeName(canonicalName)
  );
  return entry ? entry.aliases : [];
};

// =============================================================================
// 4. PHÁT HIỆN MISMATCH — So sánh TCCS cũ vs mới
// =============================================================================

export interface CriteriaChangeSuggestion {
  oldName: string;        // Tên chỉ tiêu cũ (trong TCCS trước khi sửa)
  newName: string;        // Tên chỉ tiêu mới (trong TCCS sau khi sửa)
  score: number;          // Độ tương đồng (0–1)
  autoConfirm: boolean;   // true nếu đủ tin cậy để tự xác nhận
}

/**
 * So sánh danh sách chỉ tiêu cũ và mới trong TCCS để phát hiện những tên đã đổi.
 * Trả về danh sách gợi ý alias.
 *
 * Thuật toán: Greedy matching — ghép từng tên cũ với tên mới có điểm cao nhất,
 * miễn là điểm >= FUZZY_THRESHOLD và tên mới chưa được dùng.
 */
export const detectCriteriaChanges = (
  oldNames: string[],
  newNames: string[]
): CriteriaChangeSuggestion[] => {
  const suggestions: CriteriaChangeSuggestion[] = [];
  const usedNewNames = new Set<string>();
  const normalizedNewNames = newNames.map(n => normalizeName(n));

  for (const oldName of oldNames) {
    const normOld = normalizeName(oldName);

    // Bỏ qua nếu tên cũ vẫn tồn tại trong danh sách mới (không đổi tên)
    if (normalizedNewNames.includes(normOld)) continue;

    let bestScore = 0;
    let bestNewName = '';

    for (const newName of newNames) {
      if (usedNewNames.has(newName)) continue;
      const score = similarityScore(oldName, newName);
      if (score > bestScore) {
        bestScore = score;
        bestNewName = newName;
      }
    }

    if (bestScore >= FUZZY_THRESHOLD && bestNewName) {
      usedNewNames.add(bestNewName);
      suggestions.push({
        oldName,
        newName: bestNewName,
        score: bestScore,
        autoConfirm: bestScore >= AUTO_CONFIRM_THRESHOLD,
      });
    }
  }

  return suggestions;
};

// =============================================================================
// 5. PHÁT HIỆN MISMATCH TRONG DỮ LIỆU THỰC TẾ
// =============================================================================

export interface DataMismatchReport {
  tccsId: string;
  tccsCode: string;
  criteriaName: string;      // Tên chuẩn trong TCCS
  missingInResults: string[]; // các rawName trong phiếu KN không khớp
  suggestions: Array<{
    rawName: string;
    score: number;
    autoConfirm: boolean;
  }>;
}

/**
 * Quét toàn bộ phiếu kiểm nghiệm để tìm các criteriaName không khớp
 * với TCCS hiện tại và chưa có trong bảng alias.
 */
export const detectDataMismatches = (
  testResults: TestResult[],
  tccsList: TCCS[],
  existingAliases: CriteriaAlias[]
): DataMismatchReport[] => {
  const reports: DataMismatchReport[] = [];

  for (const tccs of tccsList) {
    const aliasMap = buildAliasLookupMap(existingAliases, tccs.id);
    const allCriteria = [
      ...(tccs.mainQualityCriteria || []),
      ...(tccs.safetyCriteria || []),
    ].filter(c => c && c.name);

    const currentNormNames = new Set(allCriteria.map(c => normalizeName(c.name)));

    // Tìm phiếu KN liên quan đến TCCS này (qua batch.tccsId — sẽ được truyền từ bên ngoài)
    // Ở đây ta lấy tất cả rawNames từ tất cả phiếu và tìm không khớp
    const allRawNames = new Set<string>();
    testResults.forEach(tr => {
      (tr.results || []).forEach(entry => {
        if (entry.criteriaName) allRawNames.add(entry.criteriaName);
      });
    });

    allRawNames.forEach(rawName => {
      const normalized = normalizeName(rawName);

      // Đã khớp với tên chuẩn → OK
      if (currentNormNames.has(normalized)) return;
      // Đã có alias → OK
      if (aliasMap.has(normalized)) return;

      // Tìm chỉ tiêu có điểm tương đồng cao nhất trong TCCS này
      let bestScore = 0;
      let bestCriterion = '';
      allCriteria.forEach(c => {
        const score = similarityScore(rawName, c.name);
        if (score > bestScore) {
          bestScore = score;
          bestCriterion = c.name;
        }
      });

      if (bestScore >= FUZZY_THRESHOLD && bestCriterion) {
        // Tìm report đã có cho criterion này
        let report = reports.find(
          r => r.tccsId === tccs.id && r.criteriaName === bestCriterion
        );
        if (!report) {
          report = {
            tccsId: tccs.id,
            tccsCode: tccs.code,
            criteriaName: bestCriterion,
            missingInResults: [],
            suggestions: [],
          };
          reports.push(report);
        }
        if (!report.missingInResults.includes(rawName)) {
          report.missingInResults.push(rawName);
          report.suggestions.push({
            rawName,
            score: bestScore,
            autoConfirm: bestScore >= AUTO_CONFIRM_THRESHOLD,
          });
        }
      }
    });
  }

  return reports;
};

// =============================================================================
// 6. HELPER TẠO ALIAS RECORD
// =============================================================================

export const createAliasRecord = (
  tccsId: string,
  canonicalName: string,
  aliasNames: string[],
  autoDetected: boolean,
  confirmedByAdmin: boolean
): Omit<CriteriaAlias, 'id'> => ({
  tccsId,
  canonicalName,
  aliases: aliasNames.map(normalizeName),
  autoDetected,
  confirmedByAdmin,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Merge alias mới vào record đã tồn tại (tránh trùng lặp).
 */
export const mergeAliases = (
  existing: CriteriaAlias,
  newAliases: string[]
): CriteriaAlias => {
  const normalizedNew = newAliases.map(normalizeName);
  const merged = [...existing.aliases];
  normalizedNew.forEach(a => {
    if (!merged.includes(a)) merged.push(a);
  });
  return {
    ...existing,
    aliases: merged,
    updatedAt: new Date().toISOString(),
  };
};
