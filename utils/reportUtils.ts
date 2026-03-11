import { TestResultEntry, TCCS } from '../types';

/**
 * Phân nhóm các kết quả kiểm nghiệm để hiển thị trên báo cáo CoA.
 * Logic phân nhóm dựa trên danh mục (`category`) được định nghĩa trong TCCS.
 * - Chỉ tiêu an toàn có category='metal' -> Nhóm Kim loại nặng.
 * - Chỉ tiêu an toàn khác -> Nhóm Vi sinh vật.
 * - Chỉ tiêu không thuộc nhóm an toàn -> Nhóm Lý hóa.
 * @param results Danh sách kết quả kiểm nghiệm.
 * @param tccs Tiêu chuẩn cơ sở đang áp dụng.
 * @returns Một mảng các nhóm đã được sắp xếp và lọc.
 */
export const groupResultsForReport = (results: TestResultEntry[], tccs: TCCS | undefined) => {
  if (!results || !tccs) return [];

  const mainCriteria = tccs.mainQualityCriteria || [];
  const safetyCriteria = tccs.safetyCriteria || [];

  const groups = {
    physical: [] as TestResultEntry[],
    micro: [] as TestResultEntry[],
    metal: [] as TestResultEntry[],
  };

  results.forEach(r => {
    const safetyItem = safetyCriteria.find(c => c.name === r.criteriaName);
    if (safetyItem) {
      const cat = (safetyItem as any).category;
      if (cat === 'metal') {
        groups.metal.push(r);
      } else {
        groups.micro.push(r);
      }
    } else {
      groups.physical.push(r);
    }
  });

  // Sắp xếp nhóm Lý hóa: chỉ tiêu chính lên đầu, theo thứ tự trong TCCS.
  groups.physical.sort((a, b) => {
    const idxA = mainCriteria.findIndex(c => c.name === a.criteriaName);
    const idxB = mainCriteria.findIndex(c => c.name === b.criteriaName);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  return [
    { title: 'I. Chỉ tiêu Lý hóa & Cảm quan', items: groups.physical },
    { title: 'II. Giới hạn Vi sinh vật', items: groups.micro },
    { title: 'III. Giới hạn Kim loại nặng', items: groups.metal },
  ].filter(g => g.items.length > 0);
};