/**
 * laboratoryService.ts
 * =====================
 * Dịch vụ Quản lý & Chuẩn hóa Đơn vị Kiểm nghiệm (Testing Laboratory Normalization).
 * Cung cấp:
 * 1. Danh mục Master Data mặc định (DEFAULT_TESTING_LABORATORIES).
 * 2. Thuật toán so khớp thông minh (Exact, Alias, Substring, Fuzzy).
 * 3. Phân giải chuẩn hóa labId và canonicalName cho phiếu kiểm nghiệm và đồ thị SPC.
 */

import { TestingLaboratory } from '../types/laboratory';
import { calculateStringSimilarity } from './ai/materialHarmonizerService';
import { normalizeName } from './criteriaAliasService';

/**
 * Danh mục đơn vị kiểm nghiệm chuẩn hóa mặc định hạt giống
 */
export const DEFAULT_TESTING_LABORATORIES: TestingLaboratory[] = [
  {
    id: 'lab_quatest3',
    code: 'QUATEST3',
    canonicalName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3',
    aliases: [
      'Quatest 3',
      'QUATEST 3',
      'KT3',
      'Trung tâm KT 3',
      'Trung tâm KT3',
      'Trung tâm Kỹ thuật 3',
      'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3 (QUATEST 3)',
      'Quality Assurance and Testing Center 3',
      'Trung tâm Kỹ thuật 3',
    ],
    type: 'EXTERNAL',
    description:
      'Tổ chức khoa học và công nghệ công lập trực thuộc Tổng cục Tiêu chuẩn Đo lường Chất lượng (Bộ KH&CN)',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lab_case',
    code: 'CASE',
    canonicalName: 'Trung tâm Dịch vụ Phân tích Thí nghiệm TP.HCM',
    aliases: [
      'CASE',
      'Trung tâm CASE',
      'Trung tâm DV Phân tích Thí nghiệm TP.HCM',
      'Trung tâm Dịch vụ Phân tích Thí nghiệm',
      'Trung tâm Phân tích Thí nghiệm TP.HCM',
      'Trung tâm Dịch vụ Phân tích Thí nghiệm TP.HCM (CASE)',
      'Center of Analytical Services and Experimentation',
      'Sở Khoa học và Công nghệ TP.HCM - CASE',
    ],
    type: 'EXTERNAL',
    description: 'Đơn vị sự nghiệp khoa học công nghệ thuộc Sở Khoa học & Công nghệ TP.HCM',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lab_nifc',
    code: 'NIFC',
    canonicalName: 'Viện Kiểm nghiệm An toàn Vệ sinh Thực phẩm Quốc gia',
    aliases: [
      'NIFC',
      'Viện Kiểm nghiệm NIFC',
      'VKN',
      'Viện Kiểm nghiệm An toàn Vệ sinh Thực phẩm',
      'Viện Kiểm nghiệm ATVSTP Quốc gia',
      'Viện Kiểm nghiệm An toàn Vệ sinh Thực phẩm Quốc gia (NIFC)',
      'National Institute for Food Control',
      'Viện Kiểm nghiệm Quốc gia',
    ],
    type: 'EXTERNAL',
    description:
      'Đơn vị kiểm nghiệm tuyến cao nhất về an toàn vệ sinh thực phẩm trực thuộc Bộ Y tế',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lab_eurofins',
    code: 'EUROFINS',
    canonicalName: 'Eurofins Sắc Ký Hải Đăng',
    aliases: [
      'Eurofins',
      'Eurofins Vietnam',
      'Eurofins Sắc Ký Hải Đăng / Eurofins Vietnam',
      'Sắc Ký Hải Đăng',
      'Công ty TNHH Eurofins Sắc Ký Hải Đăng',
      'Sắc Ký Hà Nội',
      'Eurofins Sac Ky Hai Dang',
      'Eurofins Central Laboratory',
    ],
    type: 'EXTERNAL',
    description: 'Tập đoàn kiểm nghiệm quốc tế hàng đầu về thực phẩm, dược phẩm và môi trường',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lab_pasteur',
    code: 'PASTEUR',
    canonicalName: 'Viện Pasteur TP.HCM',
    aliases: [
      'Viện Pasteur',
      'Pasteur',
      'Pasteur TP.HCM',
      'Viện Pasteur Thành phố Hồ Chí Minh',
      'Pasteur Institute',
    ],
    type: 'EXTERNAL',
    description: 'Viện nghiên cứu y học, dịch tễ và xét nghiệm vi sinh trực thuộc Bộ Y tế',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'lab_internal',
    code: 'INTERNAL',
    canonicalName: 'Phòng Kiểm nghiệm Nội bộ V-BIOTECH',
    aliases: [
      'Phòng QC',
      'QC',
      'Nội bộ',
      'Phòng Kiểm nghiệm Nội bộ',
      'Phòng QA/QC',
      'Phòng Kiểm nghiệm V-Biotech',
      'Phòng QC (Nội bộ)',
      'Phòng QC V-Biotech',
      'V-Biotech',
      'V-BIOTECH',
      'PQM',
    ],
    type: 'INTERNAL',
    description: 'Phòng Kiểm nghiệm & Quản lý Chất lượng Nội bộ Công ty V-BIOTECH',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export interface LabMatchResult {
  lab: TestingLaboratory;
  confidence: 'EXACT' | 'ALIAS' | 'SUBSTRING' | 'FUZZY';
  similarity: number;
}

/**
 * Chuẩn hóa chuỗi văn bản tên Lab để tăng độ chính xác khi tìm kiếm
 */
export const normalizeLabQuery = (str: string): string => {
  if (!str) return '';
  return normalizeName(str)
    .replace(/[()[\]{},;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * So khớp một chuỗi tên Lab đầu vào với danh sách TestingLaboratory
 * Áp dụng đa tầng:
 * 1. Khớp chính xác ID hoặc Mã Code
 * 2. Khớp chính xác Canonical Name (không phân biệt hoa thường)
 * 3. Khớp chính xác một trong các Aliases
 * 4. Khớp chứa chuỗi (Substring containment)
 * 5. So khớp mờ độ tương đồng văn bản (Fuzzy similarity >= 0.72)
 */
export const matchLaboratory = (
  rawQuery: string,
  laboratories: TestingLaboratory[] = DEFAULT_TESTING_LABORATORIES
): LabMatchResult | null => {
  if (!rawQuery || typeof rawQuery !== 'string') return null;

  const trimmed = rawQuery.trim();
  if (!trimmed) return null;

  const activeLabs = laboratories.filter((l) => l.isActive !== false);
  const normalizedQuery = normalizeLabQuery(trimmed);

  // 1. Khớp ID hoặc Code
  const directCodeMatch = activeLabs.find(
    (l) =>
      l.id.toLowerCase() === trimmed.toLowerCase() || l.code.toLowerCase() === trimmed.toLowerCase()
  );
  if (directCodeMatch) {
    return { lab: directCodeMatch, confidence: 'EXACT', similarity: 1.0 };
  }

  // 2. Khớp chính xác Canonical Name
  const exactCanonical = activeLabs.find(
    (l) =>
      l.canonicalName.toLowerCase() === trimmed.toLowerCase() ||
      normalizeLabQuery(l.canonicalName) === normalizedQuery
  );
  if (exactCanonical) {
    return { lab: exactCanonical, confidence: 'EXACT', similarity: 1.0 };
  }

  // 3. Khớp chính xác Aliases
  for (const lab of activeLabs) {
    if (Array.isArray(lab.aliases)) {
      for (const alias of lab.aliases) {
        if (
          alias.toLowerCase() === trimmed.toLowerCase() ||
          normalizeLabQuery(alias) === normalizedQuery
        ) {
          return { lab, confidence: 'ALIAS', similarity: 1.0 };
        }
      }
    }
  }

  // 4. Khớp Substring (VD: "Phiếu kiểm nghiệm Quatest 3 mẫu 01" chứa "Quatest 3")
  for (const lab of activeLabs) {
    const canonicalNorm = normalizeLabQuery(lab.canonicalName);
    if (
      normalizedQuery.length >= 4 &&
      (canonicalNorm.includes(normalizedQuery) || normalizedQuery.includes(canonicalNorm))
    ) {
      return { lab, confidence: 'SUBSTRING', similarity: 0.95 };
    }

    if (Array.isArray(lab.aliases)) {
      for (const alias of lab.aliases) {
        const aliasNorm = normalizeLabQuery(alias);
        if (
          aliasNorm.length >= 2 &&
          (normalizedQuery === aliasNorm ||
            normalizedQuery.startsWith(aliasNorm + ' ') ||
            normalizedQuery.endsWith(' ' + aliasNorm) ||
            normalizedQuery.includes(' ' + aliasNorm + ' ') ||
            (aliasNorm.length >= 4 &&
              (normalizedQuery.includes(aliasNorm) || aliasNorm.includes(normalizedQuery))))
        ) {
          return { lab, confidence: 'SUBSTRING', similarity: 0.92 };
        }
      }
    }
  }

  // 5. So khớp mờ (Fuzzy Semantic Matching)
  let bestMatch: LabMatchResult | null = null;
  let maxScore = 0;

  for (const lab of activeLabs) {
    // So sánh với canonicalName
    const canonScore = calculateStringSimilarity(trimmed, lab.canonicalName);
    if (canonScore > maxScore) {
      maxScore = canonScore;
      bestMatch = { lab, confidence: 'FUZZY', similarity: canonScore };
    }

    // So sánh với từng alias
    if (Array.isArray(lab.aliases)) {
      for (const alias of lab.aliases) {
        const aliasScore = calculateStringSimilarity(trimmed, alias);
        if (aliasScore > maxScore) {
          maxScore = aliasScore;
          bestMatch = { lab, confidence: 'FUZZY', similarity: aliasScore };
        }
      }
    }
  }

  if (bestMatch && maxScore >= 0.72) {
    return bestMatch;
  }

  return null;
};

/**
 * Phân giải thông tin Lab chuẩn hóa từ ID hoặc chuỗi tên tự do
 */
export const resolveCanonicalLab = (
  labNameOrId?: string,
  laboratories: TestingLaboratory[] = DEFAULT_TESTING_LABORATORIES
): { labId: string; labName: string; lab?: TestingLaboratory } => {
  if (!labNameOrId || !labNameOrId.trim()) {
    return { labId: '', labName: '' };
  }

  const trimmed = labNameOrId.trim();

  // Kiểm tra nếu là labId
  const byId = laboratories.find((l) => l.id === trimmed);
  if (byId) {
    return { labId: byId.id, labName: byId.canonicalName, lab: byId };
  }

  // So khớp qua matchLaboratory
  const matched = matchLaboratory(trimmed, laboratories);
  if (matched) {
    return {
      labId: matched.lab.id,
      labName: matched.lab.canonicalName,
      lab: matched.lab,
    };
  }

  // Fallback: Giữ nguyên tên tự do nếu chưa nhận diện được
  return { labId: '', labName: trimmed };
};
