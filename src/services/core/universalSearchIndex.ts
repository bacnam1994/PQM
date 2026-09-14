/**
 * universalSearchIndex.ts
 * =======================
 * Dịch vụ chỉ mục tìm kiếm tức thì đa thực thể (Universal Search Engine).
 * Hỗ trợ In-memory Inverted Token Index, tiếng Việt có dấu & không dấu,
 * xếp hạng độ khớp và tra cứu đồng thời trên toàn bộ 7 phân hệ dữ liệu.
 */

import { Product, Batch, TCCS, TestResult, RawMaterial } from '../../types';
import { QualityDeviation } from '../../types/deviation';
import { ChangeRequest } from '../../types/changeControl';
import { TestingLaboratory } from '../../types/laboratory';

export type SearchResultCategory =
  | 'PRODUCT'
  | 'BATCH'
  | 'TCCS'
  | 'TEST_RESULT'
  | 'MATERIAL'
  | 'DEVIATION'
  | 'CHANGE_CONTROL'
  | 'ACTION'
  | 'PAGE';

export interface UniversalSearchResult {
  id: string;
  category: SearchResultCategory;
  title: string;
  subtitle: string;
  path: string;
  badge?: string;
  badgeColor?: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'gray';
  score: number;
  metadata?: Record<string, any>;
}

export interface UniversalSearchDataset {
  products?: Product[];
  batches?: Batch[];
  tccsList?: TCCS[];
  testResults?: TestResult[];
  rawMaterials?: RawMaterial[];
  deviations?: QualityDeviation[];
  changeRequests?: ChangeRequest[];
  laboratories?: TestingLaboratory[];
}

/**
 * Loại bỏ dấu tiếng Việt và chuẩn hóa chữ thường
 */
export function removeVietnameseAccents(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Tokenize chuỗi thành tập các từ khóa chuẩn hóa
 */
export function tokenize(str: string): string[] {
  const normalized = removeVietnameseAccents(str);
  return normalized.split(/[\s,./\-_+:;()]+/).filter((token) => token.length > 0);
}

/**
 * Tính điểm khớp giữa query và văn bản mục tiêu
 * Điểm càng cao mức độ ưu tiên càng lớn:
 * - Khớp chính xác hoàn toàn: 100
 * - Khớp ở đầu chuỗi (prefix): 60
 * - Chứa toàn bộ chuỗi tìm kiếm: 40
 * - Khớp từng token: 15 / token
 */
export function computeMatchScore(
  query: string,
  targetText: string,
  isCode: boolean = false
): number {
  if (!query || !targetText) return 0;

  const normQuery = removeVietnameseAccents(query);
  const normTarget = removeVietnameseAccents(targetText);

  if (normTarget === normQuery) {
    return isCode ? 120 : 100;
  }

  if (normTarget.startsWith(normQuery)) {
    return isCode ? 80 : 60;
  }

  const idx = normTarget.indexOf(normQuery);
  if (idx !== -1) {
    return (isCode ? 50 : 35) + Math.max(0, 10 - idx);
  }

  const queryTokens = tokenize(query);
  const targetTokens = new Set(tokenize(targetText));
  let tokenMatches = 0;

  for (const qTok of queryTokens) {
    for (const tTok of targetTokens) {
      if (tTok.startsWith(qTok)) {
        tokenMatches += 1;
        break;
      }
    }
  }

  if (queryTokens.length > 0 && tokenMatches === queryTokens.length) {
    return 25 + tokenMatches * 5;
  }

  return tokenMatches * 10;
}

/**
 * Danh mục các hành động nhanh và trang tĩnh mặc định
 */
export const QUICK_ACTIONS: UniversalSearchResult[] = [
  {
    id: 'act-new-batch',
    category: 'ACTION',
    title: 'Tạo Lô sản xuất mới',
    subtitle: 'Khởi tạo hồ sơ lô và thiết lập định mức',
    path: '/batches/new',
    badge: 'Tác vụ',
    badgeColor: 'blue',
    score: 0,
  },
  {
    id: 'act-new-test',
    category: 'ACTION',
    title: 'Tạo Phiếu kiểm nghiệm mới',
    subtitle: 'Nhập kết quả kiểm nghiệm nội bộ hoặc gửi mẫu lab ngoài',
    path: '/test-results/new',
    badge: 'Tác vụ',
    badgeColor: 'purple',
    score: 0,
  },
  {
    id: 'act-manage-labs',
    category: 'ACTION',
    title: 'Quản lý Đơn vị Kiểm nghiệm (Laboratories)',
    subtitle: 'Danh mục phòng lab chuẩn hóa, quản lý bí danh OCR AI và chuẩn hóa phiếu',
    path: '/laboratories',
    badge: 'Danh mục',
    badgeColor: 'purple',
    score: 0,
  },
  {
    id: 'act-new-cr',
    category: 'ACTION',
    title: 'Tạo Yêu cầu Thay đổi (Change Request)',
    subtitle: 'Khởi tạo đề xuất thay đổi chuẩn GMP theo ICH Q10',
    path: '/change-control',
    badge: 'GMP QMS',
    badgeColor: 'amber',
    score: 0,
  },
  {
    id: 'act-pqr-report',
    category: 'ACTION',
    title: 'Báo cáo Tổng kết Chất lượng (PQR / APR)',
    subtitle: 'Đánh giá chất lượng định kỳ và năng lực quy trình $C_{pk}$',
    path: '/reports/quality-summary',
    badge: 'Báo cáo',
    badgeColor: 'green',
    score: 0,
  },
  {
    id: 'act-trend-analysis',
    category: 'ACTION',
    title: 'Phân tích Xu hướng & Đồ thị SPC',
    subtitle: 'Kiểm soát phương sai và phát hiện quy tắc Nelson',
    path: '/reports/trend-analysis',
    badge: 'Analytics',
    badgeColor: 'blue',
    score: 0,
  },
  {
    id: 'act-alerts',
    category: 'ACTION',
    title: 'Trung tâm Cảnh báo Chất lượng & Hạn dùng',
    subtitle: 'Xem các cảnh báo trôi chỉ tiêu, OOS và quá hạn',
    path: '/alerts',
    badge: 'Cảnh báo',
    badgeColor: 'red',
    score: 0,
  },
];

/**
 * Tìm kiếm toàn cục trên dữ liệu hệ thống
 */
export function searchUniversal(
  query: string,
  data: UniversalSearchDataset,
  limit: number = 20
): UniversalSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return QUICK_ACTIONS.slice(0, 6);
  }

  const results: UniversalSearchResult[] = [];

  // 1. Quét Quick Actions
  for (const act of QUICK_ACTIONS) {
    const s1 = computeMatchScore(trimmed, act.title);
    const s2 = computeMatchScore(trimmed, act.subtitle);
    const maxS = Math.max(s1, s2);
    if (maxS > 15) {
      results.push({ ...act, score: maxS });
    }
  }

  // 2. Quét Sản phẩm
  if (data.products) {
    for (const p of data.products) {
      const sCode = computeMatchScore(trimmed, p.code, true);
      const sName = computeMatchScore(trimmed, p.name);
      const sGroup = p.group ? computeMatchScore(trimmed, p.group) : 0;
      const sReg = p.registrationNo ? computeMatchScore(trimmed, p.registrationNo, true) : 0;
      const maxS = Math.max(sCode, sName, sGroup, sReg);
      if (maxS > 15) {
        results.push({
          id: `prod-${p.id}`,
          category: 'PRODUCT',
          title: `${p.name} (${p.code})`,
          subtitle: `Nhóm: ${p.group || 'Chưa phân nhóm'} • ĐKCB: ${p.registrationNo || 'N/A'}`,
          path: `/products/${p.id}`,
          badge: p.status || 'ACTIVE',
          badgeColor: p.status === 'ACTIVE' ? 'green' : 'gray',
          score: maxS + 5,
        });
      }
    }
  }

  // 3. Quét Lô sản xuất
  if (data.batches) {
    for (const b of data.batches) {
      const sBatchNo = computeMatchScore(trimmed, b.batchNo, true);
      const maxS = sBatchNo;
      if (maxS > 15) {
        results.push({
          id: `batch-${b.id}`,
          category: 'BATCH',
          title: `Lô ${b.batchNo}`,
          subtitle: `NSX: ${b.mfgDate || 'N/A'} • HSD: ${b.expDate || 'N/A'} • Năng suất: ${b.actualYield ? `${b.actualYield} ${b.yieldUnit || ''}` : 'N/A'}`,
          path: `/batches/${b.id}`,
          badge: b.status,
          badgeColor: b.status === 'RELEASED' ? 'green' : b.status === 'REJECTED' ? 'red' : 'amber',
          score: maxS + 10,
        });
      }
    }
  }

  // 4. Quét Tiêu chuẩn Cơ sở (TCCS)
  if (data.tccsList) {
    for (const t of data.tccsList) {
      const sCode = computeMatchScore(trimmed, t.code, true);
      const maxS = sCode;
      if (maxS > 15) {
        results.push({
          id: `tccs-${t.id}`,
          category: 'TCCS',
          title: `Tiêu chuẩn ${t.code}`,
          subtitle: `Ngày ban hành: ${t.issueDate || 'N/A'} • Hạn dùng: ${t.shelfLife || 'N/A'}`,
          path: `/tccs/detail/${t.id}`,
          badge: t.isActive ? 'ĐANG HIỆU LỰC' : 'LỊCH SỬ',
          badgeColor: t.isActive ? 'green' : 'gray',
          score: maxS + 5,
        });
      }
    }
  }

  // 5. Quét Phiếu kiểm nghiệm
  if (data.testResults) {
    for (const tr of data.testResults) {
      const sLab = tr.labName ? computeMatchScore(trimmed, tr.labName) : 0;
      const sDate = tr.testDate ? computeMatchScore(trimmed, tr.testDate, true) : 0;
      const sNotes = tr.notes ? computeMatchScore(trimmed, tr.notes) : 0;
      const maxS = Math.max(sLab, sDate, sNotes);
      if (maxS > 15) {
        results.push({
          id: `tr-${tr.id}`,
          category: 'TEST_RESULT',
          title: `Phiếu KN Lab: ${tr.labName || 'Chưa đặt tên Lab'}`,
          subtitle: `Ngày kiểm nghiệm: ${tr.testDate || 'N/A'} • ${tr.notes || 'Không có ghi chú'}`,
          path: `/test-results/print/${tr.id}`,
          badge: tr.overallStatus === 'PASS' ? 'PASS' : 'FAIL',
          badgeColor: tr.overallStatus === 'PASS' ? 'green' : 'red',
          score: maxS,
        });
      }
    }
  }

  // 6. Quét Nguyên vật liệu
  if (data.rawMaterials) {
    for (const m of data.rawMaterials) {
      const sCode = computeMatchScore(trimmed, m.code, true);
      const sName = computeMatchScore(trimmed, m.name);
      const sCas = m.casNumber ? computeMatchScore(trimmed, m.casNumber, true) : 0;
      const sAliases = (m.aliases || []).map((a) => computeMatchScore(trimmed, a));
      const maxAlias = sAliases.length > 0 ? Math.max(...sAliases) : 0;
      const maxS = Math.max(sCode, sName, sCas, maxAlias);
      if (maxS > 15) {
        results.push({
          id: `mat-${m.id}`,
          category: 'MATERIAL',
          title: `${m.name} (${m.code})`,
          subtitle: `Tiêu chuẩn: ${m.standard || 'N/A'} • CAS: ${m.casNumber || 'N/A'} • Phân loại: ${m.category || 'Hoạt chất'}`,
          path: `/materials`,
          badge: m.category || 'MATERIAL',
          badgeColor: 'purple',
          score: maxS,
        });
      }
    }
  }

  // 7. Quét Sai lệch (Deviations)
  if (data.deviations) {
    for (const d of data.deviations) {
      const sCode = computeMatchScore(trimmed, d.deviationNo, true);
      const sTitle = computeMatchScore(trimmed, d.title);
      const sDesc = d.description ? computeMatchScore(trimmed, d.description) : 0;
      const maxS = Math.max(sCode, sTitle, sDesc);
      if (maxS > 15) {
        results.push({
          id: `dev-${d.id}`,
          category: 'DEVIATION',
          title: `Sai lệch [${d.deviationNo}] ${d.title}`,
          subtitle: `Mức độ: ${d.severity} • Trạng thái: ${d.status}`,
          path: `/deviations`,
          badge: d.severity,
          badgeColor: d.severity === 'CRITICAL' ? 'red' : 'amber',
          score: maxS + 8,
        });
      }
    }
  }

  // 8. Quét Yêu cầu thay đổi (Change Requests)
  if (data.changeRequests) {
    for (const cr of data.changeRequests) {
      const sCode = computeMatchScore(trimmed, cr.crNo, true);
      const sTitle = computeMatchScore(trimmed, cr.title);
      const maxS = Math.max(sCode, sTitle);
      if (maxS > 15) {
        results.push({
          id: `cr-${cr.id}`,
          category: 'CHANGE_CONTROL',
          title: `Thay đổi [${cr.crNo}] ${cr.title}`,
          subtitle: `Loại: ${cr.changeType} • Trạng thái: ${cr.status}`,
          path: `/change-control`,
          badge: cr.changeType,
          badgeColor: cr.changeType === 'MAJOR' ? 'red' : 'blue',
          score: maxS + 8,
        });
      }
    }
  }

  // 9. Quét Đơn vị Kiểm nghiệm (Testing Laboratories)
  if (data.laboratories) {
    for (const lab of data.laboratories) {
      const sCode = computeMatchScore(trimmed, lab.code, true);
      const sName = computeMatchScore(trimmed, lab.canonicalName);
      let sAlias = 0;
      if (Array.isArray(lab.aliases)) {
        for (const alias of lab.aliases) {
          const s = computeMatchScore(trimmed, alias);
          if (s > sAlias) sAlias = s;
        }
      }
      const maxS = Math.max(sCode, sName, sAlias);
      if (maxS > 15) {
        results.push({
          id: `lab-${lab.id}`,
          category: 'PAGE',
          title: `Đơn vị: ${lab.canonicalName} (${lab.code})`,
          subtitle: `Phân loại: ${lab.type === 'EXTERNAL' ? 'Ngoại kiểm' : 'Nội bộ'}${lab.aliases?.length ? ` • Bí danh: ${lab.aliases.slice(0, 3).join(', ')}` : ''}`,
          path: '/laboratories',
          badge: lab.code,
          badgeColor: lab.type === 'EXTERNAL' ? 'purple' : 'blue',
          score: maxS,
          metadata: lab,
        });
      }
    }
  }

  // Sắp xếp giảm dần theo score và lấy top kết quả
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export interface PaginatedUniversalSearchResult {
  results: UniversalSearchResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  searchDurationMs: number;
}

/**
 * UniversalInvertedIndex (Phase 6)
 * Chỉ mục đảo (Inverted Token Index) phục vụ tra cứu tức thì < 150ms trên tập dữ liệu lớn.
 */
export class UniversalInvertedIndex {
  private tokenMap = new Map<string, Set<UniversalSearchResult>>();
  private allResults: UniversalSearchResult[] = [];

  constructor(data?: UniversalSearchDataset) {
    if (data) {
      this.buildIndex(data);
    }
  }

  public buildIndex(data: UniversalSearchDataset): void {
    this.tokenMap.clear();
    const items: UniversalSearchResult[] = [];

    for (const act of QUICK_ACTIONS) items.push(act);

    if (data.products) {
      for (const p of data.products) {
        items.push({
          id: `prod-${p.id}`,
          category: 'PRODUCT',
          title: `${p.name} (${p.code})`,
          subtitle: `Nhóm: ${p.group || 'Chưa phân nhóm'} • ĐKCB: ${p.registrationNo || 'N/A'}`,
          path: `/products/${p.id}`,
          badge: p.status || 'ACTIVE',
          badgeColor: p.status === 'ACTIVE' ? 'green' : 'gray',
          score: 0,
        });
      }
    }

    if (data.batches) {
      for (const b of data.batches) {
        items.push({
          id: `batch-${b.id}`,
          category: 'BATCH',
          title: `Lô ${b.batchNo}`,
          subtitle: `NSX: ${b.mfgDate || 'N/A'} • HSD: ${b.expDate || 'N/A'}`,
          path: `/batches/${b.id}`,
          badge: b.status,
          badgeColor: b.status === 'RELEASED' ? 'green' : b.status === 'REJECTED' ? 'red' : 'amber',
          score: 0,
        });
      }
    }

    if (data.tccsList) {
      for (const t of data.tccsList) {
        items.push({
          id: `tccs-${t.id}`,
          category: 'TCCS',
          title: `Tiêu chuẩn ${t.code}`,
          subtitle: `Ngày ban hành: ${t.issueDate || 'N/A'} • Hạn dùng: ${t.shelfLife || 'N/A'}`,
          path: `/tccs/detail/${t.id}`,
          badge: t.isActive ? 'ĐANG HIỆU LỰC' : 'LỊCH SỬ',
          badgeColor: t.isActive ? 'green' : 'gray',
          score: 0,
        });
      }
    }

    if (data.testResults) {
      for (const tr of data.testResults) {
        items.push({
          id: `tr-${tr.id}`,
          category: 'TEST_RESULT',
          title: `Phiếu KN Lab: ${tr.labName || 'Chưa đặt tên Lab'}`,
          subtitle: `Ngày kiểm nghiệm: ${tr.testDate || 'N/A'}`,
          path: `/test-results/print/${tr.id}`,
          badge: tr.overallStatus === 'PASS' ? 'PASS' : 'FAIL',
          badgeColor: tr.overallStatus === 'PASS' ? 'green' : 'red',
          score: 0,
        });
      }
    }

    if (data.rawMaterials) {
      for (const m of data.rawMaterials) {
        items.push({
          id: `mat-${m.id}`,
          category: 'MATERIAL',
          title: `${m.name} (${m.code})`,
          subtitle: `Tiêu chuẩn: ${m.standard || 'N/A'} • CAS: ${m.casNumber || 'N/A'}`,
          path: `/materials`,
          badge: m.category || 'MATERIAL',
          badgeColor: 'purple',
          score: 0,
        });
      }
    }

    if (data.deviations) {
      for (const d of data.deviations) {
        items.push({
          id: `dev-${d.id}`,
          category: 'DEVIATION',
          title: `Sai lệch [${d.deviationNo}] ${d.title}`,
          subtitle: `Mức độ: ${d.severity} • Trạng thái: ${d.status}`,
          path: `/deviations`,
          badge: d.severity,
          badgeColor: d.severity === 'CRITICAL' ? 'red' : 'amber',
          score: 0,
        });
      }
    }

    if (data.changeRequests) {
      for (const cr of data.changeRequests) {
        items.push({
          id: `cr-${cr.id}`,
          category: 'CHANGE_CONTROL',
          title: `Thay đổi [${cr.crNo}] ${cr.title}`,
          subtitle: `Loại: ${cr.changeType} • Trạng thái: ${cr.status}`,
          path: `/change-control`,
          badge: cr.changeType,
          badgeColor: cr.changeType === 'MAJOR' ? 'red' : 'blue',
          score: 0,
        });
      }
    }

    this.allResults = items;

    for (const item of items) {
      const text = `${item.title} ${item.subtitle} ${item.badge || ''}`;
      const tokens = tokenize(text);
      for (const token of tokens) {
        let set = this.tokenMap.get(token);
        if (!set) {
          set = new Set();
          this.tokenMap.set(token, set);
        }
        set.add(item);
      }
    }
  }

  public searchPaginated(
    query: string,
    page: number = 1,
    pageSize: number = 20
  ): PaginatedUniversalSearchResult {
    const startTime = performance.now();
    const trimmed = query.trim();

    if (!trimmed) {
      const quick = QUICK_ACTIONS.slice(0, 6);
      return {
        results: quick,
        total: quick.length,
        page: 1,
        pageSize: quick.length,
        hasMore: false,
        searchDurationMs: performance.now() - startTime,
      };
    }

    const queryTokens = tokenize(trimmed);
    let candidates: Set<UniversalSearchResult>;

    if (queryTokens.length === 0) {
      candidates = new Set(this.allResults);
    } else {
      candidates = new Set();
      for (const qTok of queryTokens) {
        for (const [idxTok, itemSet] of this.tokenMap.entries()) {
          if (idxTok.startsWith(qTok)) {
            for (const item of itemSet) {
              candidates.add(item);
            }
          }
        }
      }
    }

    const scored: UniversalSearchResult[] = [];
    for (const item of candidates) {
      const isCode =
        item.category === 'PRODUCT' || item.category === 'BATCH' || item.category === 'TCCS';
      const s1 = computeMatchScore(trimmed, item.title, isCode);
      const s2 = computeMatchScore(trimmed, item.subtitle);
      const maxS = Math.max(s1, s2);
      if (maxS > 15) {
        scored.push({ ...item, score: maxS });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const total = scored.length;
    const start = (page - 1) * pageSize;
    const paginated = scored.slice(start, start + pageSize);

    return {
      results: paginated,
      total,
      page,
      pageSize,
      hasMore: start + pageSize < total,
      searchDurationMs: performance.now() - startTime,
    };
  }
}

/**
 * Tra cứu phân trang theo chuẩn Phase 6
 */
export function searchUniversalPaginated(
  query: string,
  data: UniversalSearchDataset,
  page: number = 1,
  pageSize: number = 20
): PaginatedUniversalSearchResult {
  const index = new UniversalInvertedIndex(data);
  return index.searchPaginated(query, page, pageSize);
}
