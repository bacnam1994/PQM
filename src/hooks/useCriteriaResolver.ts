/**
 * useCriteriaResolver.ts
 * ========================
 * Hook React cung cấp API tra cứu tên chỉ tiêu qua bảng alias.
 *
 * Mọi component cần so khớp tên chỉ tiêu (CoAReport, BatchCriteriaHistory,
 * CriteriaInputGroup...) nên dùng hook này thay vì so sánh chuỗi trực tiếp.
 */

import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  buildAliasLookupMap,
  resolveCriteriaName,
  normalizeName,
  similarityScore,
  FUZZY_THRESHOLD,
  AliasLookupMap,
} from '../services/criteriaAliasService';
import { TCCS } from '../types';

// =============================================================================
// HOOK CHÍNH
// =============================================================================

/**
 * Hook để giải mã tên chỉ tiêu cho một TCCS cụ thể.
 *
 * @param tccs  Đối tượng TCCS hiện tại (có thể undefined khi đang load)
 * @returns     Các hàm tiện ích để tra cứu tên chỉ tiêu
 */
export const useCriteriaResolver = (tccs: TCCS | undefined) => {
  const criteriaAliases = useAppStore(s => s.criteriaAliases);

  /**
   * Lookup map O(1): alias (normalized) → tên chuẩn hiện tại
   * Được memoize theo tccsId và danh sách alias.
   */
  const aliasLookupMap: AliasLookupMap = useMemo(() => {
    if (!tccs) return new Map();
    return buildAliasLookupMap(criteriaAliases, tccs.id);
  }, [tccs, criteriaAliases]);

  /**
   * Tập hợp tên chuẩn hiện tại trong TCCS (đã normalize) để tra cứu nhanh.
   */
  const currentNormNames = useMemo(() => {
    if (!tccs) return new Set<string>();
    const all = [
      ...(tccs.mainQualityCriteria || []),
      ...(tccs.safetyCriteria || []),
    ];
    return new Set(all.filter(c => c?.name).map(c => normalizeName(c.name)));
  }, [tccs]);

  /**
   * Map: tên chuẩn (normalized) → tên gốc (để lấy đúng giá trị casing từ TCCS)
   */
  const canonicalNameMap = useMemo(() => {
    if (!tccs) return new Map<string, string>();
    const all = [
      ...(tccs.mainQualityCriteria || []),
      ...(tccs.safetyCriteria || []),
    ];
    const map = new Map<string, string>();
    all.filter(c => c?.name).forEach(c => map.set(normalizeName(c.name), c.name));
    return map;
  }, [tccs]);

  /**
   * Giải mã một tên chỉ tiêu rawName về tên chuẩn trong TCCS.
   *
   * - Nếu rawName đã là tên chuẩn hiện tại → trả về nguyên
   * - Nếu rawName có trong bảng alias → trả về tên chuẩn
   * - Nếu không tìm thấy → trả về rawName (để CoA vẫn hiển thị)
   */
  const resolve = (rawName: string): string => {
    if (!tccs || !rawName) return rawName;
    return resolveCriteriaName(rawName, tccs, aliasLookupMap);
  };

  /**
   * Chuẩn hóa một tên chỉ tiêu để dùng làm key trong Map/Set.
   * Luôn đi qua bước resolve trước khi normalize để đảm bảo nhất quán.
   */
  const resolveKey = (rawName: string): string => {
    return normalizeName(resolve(rawName));
  };

  /**
   * Kiểm tra xem một rawName có khớp với một criterionName cụ thể không.
   * Dùng để thay thế `entry.criteriaName.toLowerCase() === criterion.name.toLowerCase()`.
   */
  const isMatch = (rawName: string, criterionName: string): boolean => {
    if (!rawName || !criterionName) return false;
    const resolvedKey = resolveKey(rawName);
    return resolvedKey === normalizeName(criterionName);
  };

  /**
   * Tìm kiếm chỉ tiêu trong TCCS khớp với rawName (sau khi resolve alias).
   * Trả về tên chuẩn hoặc undefined nếu không tìm thấy.
   *
   * Có fallback fuzzy nếu không tìm thấy exact match qua alias.
   */
  const findCanonicalName = (rawName: string): string | undefined => {
    if (!rawName || !tccs) return undefined;

    // 1. Exact match qua alias
    const resolved = resolve(rawName);
    const resolvedNorm = normalizeName(resolved);
    if (currentNormNames.has(resolvedNorm)) {
      return canonicalNameMap.get(resolvedNorm);
    }

    // 2. Fuzzy fallback (không lưu tự động, chỉ dùng cho hiển thị)
    const all = [
      ...(tccs.mainQualityCriteria || []),
      ...(tccs.safetyCriteria || []),
    ];
    let bestScore = 0;
    let bestName: string | undefined;
    all.forEach(c => {
      if (!c?.name) return;
      const score = similarityScore(rawName, c.name);
      if (score > bestScore) {
        bestScore = score;
        bestName = c.name;
      }
    });

    return bestScore >= FUZZY_THRESHOLD ? bestName : undefined;
  };

  /**
   * Xây dựng Map<string, Criterion> với key là rawName (sau resolve).
   * Thay thế cho pattern `new Map(criteria.map(c => [c.name.toLowerCase(), c]))`.
   *
   * Mọi rawName trong phiếu KN (dù dùng tên cũ hay mới) đều tìm được Criterion.
   */
  const buildResolvedCriteriaMap = <T extends { name: string }>(
    criteria: T[]
  ): Map<string, T> => {
    return new Map(
      criteria
        .filter(c => c?.name)
        .map(c => [normalizeName(c.name), c])
    );
  };

  /**
   * Tra cứu Criterion từ rawName — thay thế `allCriteriaMap.get(rName)`.
   * Tự động đi qua bảng alias trước khi tra cứu.
   */
  const lookupCriterion = <T extends { name: string }>(
    rawName: string,
    criteriaMap: Map<string, T>
  ): T | undefined => {
    if (!rawName) return undefined;

    // 1. Thử tìm trực tiếp (normalized rawName)
    const normRaw = normalizeName(rawName);
    const direct = criteriaMap.get(normRaw);
    if (direct) return direct;

    // 2. Resolve qua alias rồi tìm
    const resolved = resolve(rawName);
    const normResolved = normalizeName(resolved);
    if (normResolved !== normRaw) {
      const viaAlias = criteriaMap.get(normResolved);
      if (viaAlias) return viaAlias;
    }

    return undefined;
  };

  /**
   * Kiểm tra xem tên chỉ tiêu rawName có thuộc TCCS (sau khi resolve alias) không.
   * Dùng để thay thế `testedNames.has(c.name.trim().toLowerCase())`.
   */
  const isTestedInTCCS = (rawName: string, testedNamesSet: Set<string>): boolean => {
    const normRaw = normalizeName(rawName);
    if (testedNamesSet.has(normRaw)) return true;

    // Thử với resolved name
    const resolved = normalizeName(resolve(rawName));
    return testedNamesSet.has(resolved);
  };

  /**
   * Chuẩn hóa một Set tên chỉ tiêu đã kiểm tra — tất cả đều được resolve về tên chuẩn.
   * Dùng trong `conclusion` của CoAReport để kiểm tra completeness.
   */
  const buildResolvedTestedSet = (rawNames: string[]): Set<string> => {
    const set = new Set<string>();
    rawNames.forEach(name => {
      set.add(normalizeName(name));         // tên gốc
      set.add(normalizeName(resolve(name))); // tên sau resolve
    });
    return set;
  };

  return {
    resolve,
    resolveKey,
    isMatch,
    findCanonicalName,
    buildResolvedCriteriaMap,
    lookupCriterion,
    isTestedInTCCS,
    buildResolvedTestedSet,
    aliasLookupMap,
    normalizeName,
  };
};

export default useCriteriaResolver;
