import { lookupPharmacopoeiaDynamic, getPharmacopoeiaStandardsSync, calcRelevanceScore } from '../../pharmacopoeiaService';

/**
 * Tra cứu tiêu chuẩn dược điển cho một chỉ tiêu cụ thể.
 * Hỗ trợ tra cứu động từ RTDB và fallback từ in-memory cache.
 */
export const lookupPharmacoeiaStandard = (query: string) => {
  const standards = getPharmacopoeiaStandardsSync();
  const scored = standards.map(entry => ({
    entry,
    score: calcRelevanceScore(query, entry)
  })).filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return {
      query,
      found: false,
      message: `Chưa có dữ liệu chính xác cho **"${query}"** trong cơ sở kiến thức dược điển (${standards.length} tiêu chuẩn đã lập chỉ mục).\n\n**Gợi ý:** Vui lòng kiểm tra trực tiếp tại:\n- Dược điển Việt Nam V (DĐVN V)\n- USP Online: https://www.uspnf.com\n- British Pharmacopoeia (BP)\n- Hoặc chuyên luận kỹ thuật của sản phẩm`
    };
  }

  const best = scored[0].entry;
  const related = scored.slice(1, 3).map(s => s.entry.keywords[0]);

  return {
    query,
    found: true,
    category: best.category,
    source: best.source,
    content: best.standard,
    relatedTopics: related.length > 0 ? related : undefined,
    note: `Thông tin tham khảo từ Cơ sở Kiến thức Dược điển PQM. Luôn xác minh với phiên bản dược điển mới nhất và TCCS của sản phẩm cụ thể.`
  };
};

/**
 * Tra cứu tiêu chuẩn dược điển bất đồng bộ (tải mới nhất từ Firebase RTDB nếu có)
 */
export const lookupPharmacopoeiaStandardAsync = async (query: string) => {
  return await lookupPharmacopoeiaDynamic(query);
};
