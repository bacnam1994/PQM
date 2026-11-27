import { useMemo } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { useMasterCriteriaActiveQuery } from '../../../hooks/queries/useMasterCriterionQueries';
import { ensureArray, normalizeSearch } from '../../../utils';
import { CriterionType } from '../../../types';

export type SuggestionCategory =
  | 'QUALITY'
  | 'SENSORY'
  | 'MICROBIO'
  | 'HEAVY_METAL'
  | 'MYCOTOXIN'
  | 'SAFETY';

export interface CriterionSuggestionItem {
  id: string;
  canonicalName: string;
  defaultUnit?: string;
  type: CriterionType;
  category: SuggestionCategory;
  masterCriterionId?: string;
  usageCount: number;
  source: 'MASTER' | 'TCCS' | 'FORMULA' | 'ALIAS' | 'PKN' | 'STANDARD';
  aliases: string[];
  sampleLimitText?: string;
  sampleMin?: number;
  sampleMax?: number;
  sampleExpectedText?: string;
  declaredContent?: string | number;
  formulaIngredientName?: string;
}

const HEAVY_METAL_KEYWORDS = [
  'asen',
  'chì',
  'thủy ngân',
  'cadmi',
  'pb',
  'cd',
  'hg',
  'as',
  'kim loại nặng',
];
const MYCOTOXIN_KEYWORDS = [
  'aflatoxin',
  'ochratoxin',
  'patulin',
  'zearalenone',
  'độc tố vi nấm',
  'mycotoxin',
  'dư lượng',
  'thuốc bảo vệ thực vật',
];
const MICROBIO_KEYWORDS = [
  'vi sinh',
  'hiếu khí',
  'nấm men',
  'nấm mốc',
  'e. coli',
  'e.coli',
  'escherichia',
  'salmonella',
  'staphylococcus',
  'pseudomonas',
  'coliform',
  'clostridium',
  'enterobacteriaceae',
  'bào tử',
  'cfu',
];
const SENSORY_KEYWORDS = ['cảm quan', 'hình thức', 'màu sắc', 'mùi vị', 'trạng thái', 'độ trong'];

const STANDARD_FALLBACK_CRITERIA: Array<{
  canonicalName: string;
  defaultUnit: string;
  type: CriterionType;
  category: SuggestionCategory;
  sampleLimitText?: string;
  sampleMax?: number;
  sampleExpectedText?: string;
}> = [
  // Chất lượng chính / Cảm quan / Lý hóa phổ biến
  {
    canonicalName: 'Cảm quan',
    defaultUnit: '',
    type: CriterionType.TEXT,
    category: 'SENSORY',
    sampleLimitText: 'Đạt yêu cầu theo tiêu chuẩn',
  },
  {
    canonicalName: 'Độ ẩm',
    defaultUnit: '%',
    type: CriterionType.NUMBER,
    category: 'QUALITY',
    sampleLimitText: '≤ 5.0%',
  },
  {
    canonicalName: 'Độ đồng đều khối lượng',
    defaultUnit: '%',
    type: CriterionType.TEXT,
    category: 'QUALITY',
    sampleLimitText: '± 7.5% so với khối lượng trung bình',
  },
  {
    canonicalName: 'Độ đồng đều thể tích',
    defaultUnit: 'ml',
    type: CriterionType.TEXT,
    category: 'QUALITY',
    sampleLimitText: 'Không dưới thể tích ghi trên nhãn',
  },
  {
    canonicalName: 'Độ rã',
    defaultUnit: 'Phút',
    type: CriterionType.NUMBER,
    category: 'QUALITY',
    sampleLimitText: '≤ 30 phút',
  },
  {
    canonicalName: 'Độ hòa tan',
    defaultUnit: '%',
    type: CriterionType.NUMBER,
    category: 'QUALITY',
    sampleLimitText: '≥ 75%',
  },
  {
    canonicalName: 'pH',
    defaultUnit: '',
    type: CriterionType.NUMBER,
    category: 'QUALITY',
    sampleLimitText: '5.0 ~ 7.0',
  },
  {
    canonicalName: 'Tỷ trọng',
    defaultUnit: 'g/ml',
    type: CriterionType.NUMBER,
    category: 'QUALITY',
  },
  {
    canonicalName: 'Độ mất khối lượng do làm khô',
    defaultUnit: '%',
    type: CriterionType.NUMBER,
    category: 'QUALITY',
    sampleLimitText: '≤ 5.0%',
  },
  // Vi sinh vật (DĐVN V / QCVN)
  {
    canonicalName: 'Tổng số vi sinh vật hiếu khí',
    defaultUnit: 'CFU/g',
    type: CriterionType.NUMBER,
    category: 'MICROBIO',
    sampleMax: 10000,
    sampleLimitText: '≤ 10000 CFU/g',
  },
  {
    canonicalName: 'Tổng số bào tử nấm men - nấm mốc',
    defaultUnit: 'CFU/g',
    type: CriterionType.NUMBER,
    category: 'MICROBIO',
    sampleMax: 100,
    sampleLimitText: '≤ 100 CFU/g',
  },
  {
    canonicalName: 'Escherichia coli',
    defaultUnit: 'CFU/g',
    type: CriterionType.TEXT,
    category: 'MICROBIO',
    sampleExpectedText: 'Không phát hiện',
    sampleLimitText: 'Không phát hiện',
  },
  {
    canonicalName: 'Salmonella',
    defaultUnit: '/25g',
    type: CriterionType.TEXT,
    category: 'MICROBIO',
    sampleExpectedText: 'Không phát hiện',
    sampleLimitText: 'Không phát hiện',
  },
  {
    canonicalName: 'Staphylococcus aureus',
    defaultUnit: 'CFU/g',
    type: CriterionType.TEXT,
    category: 'MICROBIO',
    sampleExpectedText: 'Không phát hiện',
    sampleLimitText: 'Không phát hiện',
  },
  {
    canonicalName: 'Pseudomonas aeruginosa',
    defaultUnit: 'CFU/g',
    type: CriterionType.TEXT,
    category: 'MICROBIO',
    sampleExpectedText: 'Không phát hiện',
    sampleLimitText: 'Không phát hiện',
  },
  {
    canonicalName: 'Coliforms',
    defaultUnit: 'CFU/g',
    type: CriterionType.NUMBER,
    category: 'MICROBIO',
    sampleMax: 10,
    sampleLimitText: '≤ 10 CFU/g',
  },
  {
    canonicalName: 'Clostridium perfringens',
    defaultUnit: 'CFU/g',
    type: CriterionType.TEXT,
    category: 'MICROBIO',
    sampleExpectedText: 'Không phát hiện',
    sampleLimitText: 'Không phát hiện',
  },
  // Kim loại nặng
  {
    canonicalName: 'Chì (Pb)',
    defaultUnit: 'ppm',
    type: CriterionType.NUMBER,
    category: 'HEAVY_METAL',
    sampleMax: 3.0,
    sampleLimitText: '≤ 3.0 ppm',
  },
  {
    canonicalName: 'Asen (As)',
    defaultUnit: 'ppm',
    type: CriterionType.NUMBER,
    category: 'HEAVY_METAL',
    sampleMax: 1.0,
    sampleLimitText: '≤ 1.0 ppm',
  },
  {
    canonicalName: 'Thủy ngân (Hg)',
    defaultUnit: 'ppm',
    type: CriterionType.NUMBER,
    category: 'HEAVY_METAL',
    sampleMax: 0.1,
    sampleLimitText: '≤ 0.1 ppm',
  },
  {
    canonicalName: 'Cadmi (Cd)',
    defaultUnit: 'ppm',
    type: CriterionType.NUMBER,
    category: 'HEAVY_METAL',
    sampleMax: 1.0,
    sampleLimitText: '≤ 1.0 ppm',
  },
  // Độc tố vi nấm
  {
    canonicalName: 'Aflatoxin B1',
    defaultUnit: 'ppb',
    type: CriterionType.NUMBER,
    category: 'MYCOTOXIN',
    sampleMax: 5.0,
    sampleLimitText: '≤ 5.0 ppb',
  },
  {
    canonicalName: 'Aflatoxin tổng số (B1, B2, G1, G2)',
    defaultUnit: 'ppb',
    type: CriterionType.NUMBER,
    category: 'MYCOTOXIN',
    sampleMax: 15.0,
    sampleLimitText: '≤ 15.0 ppb',
  },
  {
    canonicalName: 'Ochratoxin A',
    defaultUnit: 'ppb',
    type: CriterionType.NUMBER,
    category: 'MYCOTOXIN',
    sampleMax: 20.0,
    sampleLimitText: '≤ 20.0 ppb',
  },
];

function classifyCriterionCategory(
  name: string,
  section: 'MAIN' | 'SAFETY',
  rawCategory?: string
): SuggestionCategory {
  const nl = (name || '').trim().toLowerCase();
  const cat = (rawCategory || '').trim().toLowerCase();

  if (cat === 'micro' || cat === 'microbio') return 'MICROBIO';
  if (cat === 'metal') return 'HEAVY_METAL';
  if (cat === 'mycotoxin' || cat === 'other') return 'MYCOTOXIN';
  if (cat === 'sensory') return 'SENSORY';

  if (MICROBIO_KEYWORDS.some((kw) => nl.includes(kw))) return 'MICROBIO';
  if (HEAVY_METAL_KEYWORDS.some((kw) => nl.includes(kw))) return 'HEAVY_METAL';
  if (MYCOTOXIN_KEYWORDS.some((kw) => nl.includes(kw))) return 'MYCOTOXIN';
  if (SENSORY_KEYWORDS.some((kw) => nl.includes(kw))) return 'SENSORY';

  if (section === 'SAFETY') return 'MICROBIO';
  return 'QUALITY';
}

function buildSampleLimitText(c: any): string | undefined {
  if (!c) return undefined;
  const u = c.unit ? ` ${c.unit}` : '';
  if (c.type === CriterionType.NUMBER || c.type === 'NUMBER') {
    if (c.min != null && c.max != null && String(c.min) !== '' && String(c.max) !== '') {
      return `${c.min} ~ ${c.max}${u}`;
    }
    if (c.min != null && String(c.min) !== '') {
      return `≥ ${c.min}${u}`;
    }
    if (c.max != null && String(c.max) !== '') {
      return `≤ ${c.max}${u}`;
    }
  }
  if (c.expectedText && String(c.expectedText).trim() !== '') {
    return String(c.expectedText).trim();
  }
  return undefined;
}

/**
 * Tổng hợp toàn bộ danh mục chỉ tiêu đã có trên hệ thống từ 6 nguồn:
 * 1. Master Criteria (`master_criteria/`)
 * 2. Toàn bộ các hồ sơ TCCS đã có (`tccsList`: cả `mainQualityCriteria` & `safetyCriteria`, kèm tần suất sử dụng)
 * 3. Thành phần Công thức của sản phẩm đang chọn (`productIngredients`)
 * 4. Bảng ánh xạ tên chỉ tiêu (`criteriaAliases`)
 * 5. Lịch sử Phiếu kiểm nghiệm (`testResults`)
 * 6. Danh mục chuẩn Dược điển Việt Nam V / QCVN dự phòng
 */
export function useExistingCriteriaSuggestions(productIngredients: any[] = []) {
  const { data: masterCriteria = [] } = useMasterCriteriaActiveQuery();
  const tccsList = useAppStore((s) => s.tccsList);
  const criteriaAliases = useAppStore((s) => s.criteriaAliases);
  const testResults = useAppStore((s) => s.testResults);

  const allSuggestions = useMemo(() => {
    const map = new Map<string, CriterionSuggestionItem>();

    // 1. Nguồn Master Criteria (ưu tiên ID chuẩn hóa)
    ensureArray(masterCriteria).forEach((mc) => {
      if (!mc || !mc.canonicalName || !mc.canonicalName.trim()) return;
      const cleanName = mc.canonicalName.trim();
      const key = cleanName.toLowerCase();
      const cat: SuggestionCategory =
        mc.category === 'MICROBIO'
          ? 'MICROBIO'
          : mc.category === 'SAFETY'
            ? classifyCriterionCategory(cleanName, 'SAFETY')
            : mc.category === 'SENSORY'
              ? 'SENSORY'
              : 'QUALITY';

      map.set(key, {
        id: mc.id,
        canonicalName: cleanName,
        defaultUnit: mc.defaultUnit || '',
        type: mc.type === 'TEXT' ? CriterionType.TEXT : CriterionType.NUMBER,
        category: cat,
        masterCriterionId: mc.id,
        usageCount: 0,
        source: 'MASTER',
        aliases: ensureArray((mc as any).aliases),
      });
    });

    // 2. Nguồn TCCS hiện có trên hệ thống (tccsList)
    ensureArray(tccsList).forEach((tccs) => {
      if (!tccs) return;

      const processCriterion = (c: any, section: 'MAIN' | 'SAFETY') => {
        if (!c || !c.name || !String(c.name).trim()) return;
        const cleanName = String(c.name).trim();
        const key = cleanName.toLowerCase();
        const sampleLimit = buildSampleLimitText(c);
        const existing = map.get(key);

        if (existing) {
          existing.usageCount += 1;
          if (!existing.defaultUnit && c.unit) existing.defaultUnit = c.unit;
          if (!existing.masterCriterionId && c.masterCriterionId) {
            existing.masterCriterionId = c.masterCriterionId;
          }
          if (!existing.sampleLimitText && sampleLimit) {
            existing.sampleLimitText = sampleLimit;
            if (c.min != null && String(c.min) !== '') existing.sampleMin = Number(c.min);
            if (c.max != null && String(c.max) !== '') existing.sampleMax = Number(c.max);
            if (c.expectedText) existing.sampleExpectedText = String(c.expectedText);
          }
          // Nếu tiêu chí nằm trong safetyCriteria của TCCS thì cập nhật nhóm an toàn tương ứng
          if (section === 'SAFETY' && existing.category === 'QUALITY') {
            existing.category = classifyCriterionCategory(cleanName, 'SAFETY', c.category);
          }
        } else {
          map.set(key, {
            id: c.masterCriterionId || `tccs_crit_${key}`,
            canonicalName: cleanName,
            defaultUnit: c.unit || '',
            type:
              c.type === 'TEXT' || c.type === CriterionType.TEXT
                ? CriterionType.TEXT
                : CriterionType.NUMBER,
            category: classifyCriterionCategory(cleanName, section, c.category),
            masterCriterionId: c.masterCriterionId,
            usageCount: 1,
            source: 'TCCS',
            aliases: [],
            sampleLimitText: sampleLimit,
            sampleMin: c.min != null && String(c.min) !== '' ? Number(c.min) : undefined,
            sampleMax: c.max != null && String(c.max) !== '' ? Number(c.max) : undefined,
            sampleExpectedText: c.expectedText ? String(c.expectedText) : undefined,
          });
        }
      };

      ensureArray(tccs.mainQualityCriteria).forEach((c) => processCriterion(c, 'MAIN'));
      ensureArray(tccs.safetyCriteria).forEach((c) => processCriterion(c, 'SAFETY'));
    });

    // 3. Nguồn Thành phần Công thức của sản phẩm đang chọn
    ensureArray(productIngredients).forEach((ing) => {
      if (!ing || !ing.name || !String(ing.name).trim()) return;
      const rawIngName = String(ing.name).trim();
      const suggestedNames = [
        rawIngName.toLowerCase().startsWith('định lượng') ||
        rawIngName.toLowerCase().startsWith('hàm lượng')
          ? rawIngName
          : `Định lượng ${rawIngName}`,
        rawIngName,
      ];

      suggestedNames.forEach((candName) => {
        const key = candName.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          if (!existing.defaultUnit && ing.unit) existing.defaultUnit = ing.unit;
          if (!existing.declaredContent && ing.declaredContent) {
            existing.declaredContent = ing.declaredContent;
            existing.formulaIngredientName = rawIngName;
          }
        } else {
          map.set(key, {
            id: `formula_crit_${key}`,
            canonicalName: candName,
            defaultUnit: ing.unit || '',
            type: CriterionType.NUMBER,
            category: 'QUALITY',
            usageCount: 0,
            source: 'FORMULA',
            aliases: [rawIngName],
            declaredContent: ing.declaredContent,
            formulaIngredientName: rawIngName,
            sampleLimitText: ing.declaredContent
              ? `Công thức: ${ing.declaredContent} ${ing.unit || ''}`.trim()
              : undefined,
          });
        }
      });
    });

    // 4. Nguồn Criteria Aliases (bổ sung từ đồng nghĩa để tìm kiếm)
    ensureArray(criteriaAliases).forEach((aliasRec) => {
      if (!aliasRec || !aliasRec.standardName || !aliasRec.standardName.trim()) return;
      const cleanName = aliasRec.standardName.trim();
      const key = cleanName.toLowerCase();
      const aliasList = ensureArray(aliasRec.aliases).filter(Boolean);
      const existing = map.get(key);

      if (existing) {
        const mergedAliases = new Set([...existing.aliases, ...aliasList]);
        existing.aliases = Array.from(mergedAliases);
      } else {
        map.set(key, {
          id: `alias_crit_${key}`,
          canonicalName: cleanName,
          defaultUnit: '',
          type: CriterionType.NUMBER,
          category: classifyCriterionCategory(cleanName, 'MAIN'),
          usageCount: 0,
          source: 'ALIAS',
          aliases: aliasList,
        });
      }
    });

    // 5. Nguồn Phiếu kiểm nghiệm (testResults)
    ensureArray(testResults).forEach((tr) => {
      if (!tr) return;
      ensureArray(tr.results).forEach((r) => {
        if (!r || !r.criteriaName || !String(r.criteriaName).trim()) return;
        const cleanName = String(r.criteriaName).trim();
        const key = cleanName.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          if (!existing.defaultUnit && r.unit) existing.defaultUnit = r.unit;
        } else {
          map.set(key, {
            id: `pkn_crit_${key}`,
            canonicalName: cleanName,
            defaultUnit: r.unit || '',
            type:
              r.value != null && !isNaN(Number(String(r.value).replace(',', '.')))
                ? CriterionType.NUMBER
                : CriterionType.TEXT,
            category: classifyCriterionCategory(cleanName, 'MAIN'),
            usageCount: 1,
            source: 'PKN',
            aliases: [],
          });
        }
      });
    });

    // 6. Nguồn Chuẩn Dược điển / QCVN dự phòng (nếu chưa có trong DB)
    STANDARD_FALLBACK_CRITERIA.forEach((std) => {
      const key = std.canonicalName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `std_crit_${key}`,
          canonicalName: std.canonicalName,
          defaultUnit: std.defaultUnit,
          type: std.type,
          category: std.category,
          usageCount: 0,
          source: 'STANDARD',
          aliases: [],
          sampleLimitText: std.sampleLimitText,
          sampleMax: std.sampleMax,
          sampleExpectedText: std.sampleExpectedText,
        });
      }
    });

    // Sắp xếp: Ưu tiên thành phần công thức của SP đang chọn -> Master -> Tần suất sử dụng cao -> Tên A-Z
    return Array.from(map.values()).sort((a, b) => {
      if (a.source === 'FORMULA' && b.source !== 'FORMULA') return -1;
      if (b.source === 'FORMULA' && a.source !== 'FORMULA') return 1;
      if (b.usageCount !== a.usageCount) return b.usageCount - a.usageCount;
      if (a.source === 'MASTER' && b.source !== 'MASTER') return -1;
      if (b.source === 'MASTER' && a.source !== 'MASTER') return 1;
      return a.canonicalName.localeCompare(b.canonicalName, 'vi');
    });
  }, [masterCriteria, tccsList, productIngredients, criteriaAliases, testResults]);

  return allSuggestions;
}

/**
 * Lọc danh sách gợi ý theo từ khóa (hỗ trợ tìm không dấu tiếng Việt và khớp bí danh)
 */
export function filterCriteriaSuggestions(
  allSuggestions: CriterionSuggestionItem[],
  rawQuery: string,
  options?: {
    preferredCategories?: SuggestionCategory[];
    limit?: number;
  }
): CriterionSuggestionItem[] {
  const limit = options?.limit ?? 12;
  const preferredCategories = options?.preferredCategories;
  const qNorm = normalizeSearch(rawQuery || '');
  const qLower = (rawQuery || '').trim().toLowerCase();

  // Nếu chưa gõ từ khóa (mới click focus vào ô input):
  // Hiển thị ngay các chỉ tiêu thuộc đúng nhóm (preferredCategories) được dùng nhiều nhất!
  if (!qNorm) {
    if (preferredCategories && preferredCategories.length > 0) {
      const catMatches = allSuggestions.filter((item) =>
        preferredCategories.includes(item.category)
      );
      if (catMatches.length > 0) {
        return catMatches.slice(0, limit);
      }
    }
    return allSuggestions.slice(0, limit);
  }

  // Khi người dùng gõ từ khóa: chấm điểm độ khớp (có dấu, không dấu, startsWith, includes, alias, nhóm ưu tiên)
  const scored: Array<{ item: CriterionSuggestionItem; score: number }> = [];

  for (const item of allSuggestions) {
    const nameLower = item.canonicalName.toLowerCase();
    const nameNorm = normalizeSearch(item.canonicalName);

    let matchScore = 0;
    if (nameLower === qLower || nameNorm === qNorm) {
      matchScore = 100;
    } else if (nameLower.startsWith(qLower)) {
      matchScore = 85;
    } else if (nameNorm.startsWith(qNorm)) {
      matchScore = 80;
    } else if (nameLower.includes(qLower)) {
      matchScore = 65;
    } else if (nameNorm.includes(qNorm)) {
      matchScore = 60;
    } else if (
      item.aliases.some((al) => {
        const alNorm = normalizeSearch(al);
        return alNorm.includes(qNorm);
      })
    ) {
      matchScore = 50;
    }

    if (matchScore > 0) {
      // Cộng điểm thưởng nếu thuộc đúng nhóm đang nhập (VD: đang ở bảng Vi sinh thì ưu tiên MICROBIO lên đầu)
      if (preferredCategories && preferredCategories.includes(item.category)) {
        matchScore += 15;
      }
      if (item.source === 'FORMULA') {
        matchScore += 8;
      }
      if (item.masterCriterionId) {
        matchScore += 5;
      }
      matchScore += Math.min(item.usageCount, 10) * 0.5;
      scored.push({ item, score: matchScore });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.canonicalName.localeCompare(b.item.canonicalName, 'vi');
  });

  return scored.slice(0, limit).map((s) => s.item);
}
