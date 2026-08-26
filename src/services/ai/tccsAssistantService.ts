import { Criterion, CriterionType, ProductFormula, FormulaIngredient } from '../../types';
import { ensureArray, parseNumberFromText } from '../../utils';

export type DosageFormType = 'TABLET' | 'CAPSULE' | 'SYRUP' | 'POWDER_GRANULE' | 'INJECTION' | 'CREAM_OINTMENT';

export interface DosageFormTemplate {
  code: DosageFormType;
  label: string;
  description: string;
  criteria: Array<{
    name: string;
    type: CriterionType;
    unit?: string;
    min?: number;
    max?: number;
    expectedText?: string;
    category: 'main' | 'micro' | 'metal' | 'mycotoxin';
    notes?: string;
  }>;
}

export const PHARMACOPOEIA_TEMPLATES: Record<DosageFormType, DosageFormTemplate> = {
  TABLET: {
    code: 'TABLET',
    label: 'Viên nén (Tablets - DĐVN V)',
    description: 'Tiêu chuẩn chung cho viên nén không bao / bao phim theo Dược điển Việt Nam V',
    criteria: [
      { name: 'Cảm quan', type: CriterionType.TEXT, expectedText: 'Viên nén nguyên vẹn, bề mặt nhẵn, màu sắc đồng nhất', category: 'main' },
      { name: 'Độ đồng đều khối lượng', type: CriterionType.TEXT, expectedText: 'Đạt yêu cầu phép thử độ đồng đều khối lượng', category: 'main' },
      { name: 'Độ rã', type: CriterionType.NUMBER, max: 15, unit: 'phút', category: 'main', notes: '≤ 15 phút (viên không bao) hoặc ≤ 30 phút (viên bao phim)' },
      { name: 'Độ hòa tan', type: CriterionType.NUMBER, min: 75, unit: '%', category: 'main', notes: 'Q ≥ 70-75% sau 30-45 phút' },
      { name: 'Độ ẩm / Mất khối lượng do làm khô', type: CriterionType.NUMBER, max: 5.0, unit: '%', category: 'main' },
      { name: 'Tổng số vi sinh vật hiếu khí (TAMC)', type: CriterionType.NUMBER, max: 1000, unit: 'CFU/g', category: 'micro' },
      { name: 'Tổng số nấm men, nấm mốc (TYMC)', type: CriterionType.NUMBER, max: 100, unit: 'CFU/g', category: 'micro' },
      { name: 'Escherichia coli', type: CriterionType.TEXT, expectedText: 'Không được có / 1g', category: 'micro' },
      { name: 'Chì (Pb)', type: CriterionType.NUMBER, max: 5.0, unit: 'mg/kg', category: 'metal' },
      { name: 'Cadmi (Cd)', type: CriterionType.NUMBER, max: 0.5, unit: 'mg/kg', category: 'metal' },
      { name: 'Thủy ngân (Hg)', type: CriterionType.NUMBER, max: 0.5, unit: 'mg/kg', category: 'metal' },
      { name: 'Arsen (As)', type: CriterionType.NUMBER, max: 1.5, unit: 'mg/kg', category: 'metal' }
    ]
  },
  CAPSULE: {
    code: 'CAPSULE',
    label: 'Viên nang (Capsules - DĐVN V)',
    description: 'Tiêu chuẩn chung cho viên nang cứng và viên nang mềm theo Dược điển Việt Nam V',
    criteria: [
      { name: 'Cảm quan', type: CriterionType.TEXT, expectedText: 'Viên nang nguyên vẹn, không biến dạng, bột/dịch bên trong đồng nhất', category: 'main' },
      { name: 'Độ đồng đều khối lượng', type: CriterionType.TEXT, expectedText: 'Đạt yêu cầu phép thử độ đồng đều khối lượng viên nang', category: 'main' },
      { name: 'Độ rã', type: CriterionType.NUMBER, max: 30, unit: 'phút', category: 'main', notes: '≤ 30 phút' },
      { name: 'Tổng số vi sinh vật hiếu khí (TAMC)', type: CriterionType.NUMBER, max: 1000, unit: 'CFU/g', category: 'micro' },
      { name: 'Tổng số nấm men, nấm mốc (TYMC)', type: CriterionType.NUMBER, max: 100, unit: 'CFU/g', category: 'micro' },
      { name: 'Escherichia coli', type: CriterionType.TEXT, expectedText: 'Không được có / 1g', category: 'micro' },
      { name: 'Chì (Pb)', type: CriterionType.NUMBER, max: 5.0, unit: 'mg/kg', category: 'metal' },
      { name: 'Cadmi (Cd)', type: CriterionType.NUMBER, max: 0.5, unit: 'mg/kg', category: 'metal' },
      { name: 'Thủy ngân (Hg)', type: CriterionType.NUMBER, max: 0.5, unit: 'mg/kg', category: 'metal' },
      { name: 'Arsen (As)', type: CriterionType.NUMBER, max: 1.5, unit: 'mg/kg', category: 'metal' }
    ]
  },
  SYRUP: {
    code: 'SYRUP',
    label: 'Siro / Dung dịch uống (Oral Liquids)',
    description: 'Tiêu chuẩn cho siro, hỗn dịch và dung dịch thuốc uống',
    criteria: [
      { name: 'Cảm quan', type: CriterionType.TEXT, expectedText: 'Chất lỏng trong suốt hoặc hỗn dịch đồng nhất, mùi thơm đặc trưng, vị ngọt', category: 'main' },
      { name: 'pH', type: CriterionType.NUMBER, min: 4.0, max: 7.0, category: 'main' },
      { name: 'Tỷ trọng', type: CriterionType.NUMBER, min: 1.15, max: 1.35, category: 'main' },
      { name: 'Thể tích thực', type: CriterionType.TEXT, expectedText: 'Không được dưới thể tích ghi trên nhãn', category: 'main' },
      { name: 'Tổng số vi sinh vật hiếu khí (TAMC)', type: CriterionType.NUMBER, max: 100, unit: 'CFU/ml', category: 'micro' },
      { name: 'Tổng số nấm men, nấm mốc (TYMC)', type: CriterionType.NUMBER, max: 10, unit: 'CFU/ml', category: 'micro' },
      { name: 'Escherichia coli', type: CriterionType.TEXT, expectedText: 'Không được có / 1ml', category: 'micro' }
    ]
  },
  POWDER_GRANULE: {
    code: 'POWDER_GRANULE',
    label: 'Thuốc bột / Thuốc cốm (Powders & Granules)',
    description: 'Tiêu chuẩn cho thuốc bột và cốm pha hỗn dịch/dung dịch uống',
    criteria: [
      { name: 'Cảm quan', type: CriterionType.TEXT, expectedText: 'Bột/cốm khô tơi, đồng nhất về màu sắc, không vón cục', category: 'main' },
      { name: 'Mất khối lượng do làm khô (Độ ẩm)', type: CriterionType.NUMBER, max: 5.0, unit: '%', category: 'main' },
      { name: 'Độ đồng đều khối lượng', type: CriterionType.TEXT, expectedText: 'Đạt yêu cầu độ đồng đều khối lượng gói', category: 'main' },
      { name: 'Độ hòa tan / Phân tán', type: CriterionType.TEXT, expectedText: 'Hòa tan hoặc phân tán hoàn toàn trong nước', category: 'main' },
      { name: 'Tổng số vi sinh vật hiếu khí (TAMC)', type: CriterionType.NUMBER, max: 1000, unit: 'CFU/g', category: 'micro' },
      { name: 'Tổng số nấm men, nấm mốc (TYMC)', type: CriterionType.NUMBER, max: 100, unit: 'CFU/g', category: 'micro' }
    ]
  },
  INJECTION: {
    code: 'INJECTION',
    label: 'Thuốc tiêm / Thuốc tiêm truyền (Injections)',
    description: 'Tiêu chuẩn nghiêm ngặt cho thuốc vô khuẩn dạng tiêm theo DĐVN V',
    criteria: [
      { name: 'Cảm quan & Độ trong', type: CriterionType.TEXT, expectedText: 'Dung dịch trong suốt, không có tiểu phân lạ nhìn thấy bằng mắt thường', category: 'main' },
      { name: 'pH', type: CriterionType.NUMBER, min: 6.0, max: 8.0, category: 'main' },
      { name: 'Thể tích có thể lấy ra', type: CriterionType.TEXT, expectedText: 'Đạt theo chuyên luận thể tích thuốc tiêm', category: 'main' },
      { name: 'Nội độc tố vi khuẩn (Bacterial Endotoxin)', type: CriterionType.NUMBER, max: 0.25, unit: 'EU/ml', category: 'main' },
      { name: 'Độ vô khuẩn (Sterility Test)', type: CriterionType.TEXT, expectedText: 'Vô khuẩn (Không phát hiện vi sinh vật)', category: 'micro' }
    ]
  },
  CREAM_OINTMENT: {
    code: 'CREAM_OINTMENT',
    label: 'Thuốc mỡ / Kem / Gel bôi ngoài (Semisolids)',
    description: 'Tiêu chuẩn cho chế phẩm bán rắn dùng ngoài da',
    criteria: [
      { name: 'Cảm quan', type: CriterionType.TEXT, expectedText: 'Chế phẩm mềm mịn, đồng nhất, không tách pha hay biến màu', category: 'main' },
      { name: 'Độ đồng đều khối lượng', type: CriterionType.TEXT, expectedText: 'Đạt yêu cầu khối lượng tuýp/lọ', category: 'main' },
      { name: 'pH', type: CriterionType.NUMBER, min: 4.5, max: 7.5, category: 'main' },
      { name: 'Tổng số vi sinh vật hiếu khí', type: CriterionType.NUMBER, max: 100, unit: 'CFU/g', category: 'micro' },
      { name: 'Pseudomonas aeruginosa & S. aureus', type: CriterionType.TEXT, expectedText: 'Không được có / 1g', category: 'micro' }
    ]
  }
};

/**
 * Tự động tạo các chỉ tiêu định lượng từ Công thức sản phẩm
 * @param formula Công thức sản phẩm
 * @param tolerancePercentage Biên độ chấp nhận hàm lượng (mặc định ±10% hoặc ±5% theo Dược điển)
 */
export const generateCriteriaFromFormula = (
  formula: ProductFormula,
  tolerancePercentage: number = 10
): Array<Criterion & { notes?: string }> => {
  const ingredients: FormulaIngredient[] = ensureArray(formula.ingredients);
  const result: Array<Criterion & { notes?: string }> = [];

  ingredients.forEach(ing => {
    if (!ing || !ing.name) return;
    const baseContent = ing.declaredContent || ing.elementalContent || 0;
    const unit = ing.unit || 'mg';

    let minVal: number | undefined = undefined;
    let maxVal: number | undefined = undefined;

    if (baseContent > 0) {
      const delta = baseContent * (tolerancePercentage / 100);
      minVal = Math.round((baseContent - delta) * 100) / 100;
      maxVal = Math.round((baseContent + delta) * 100) / 100;
    }

    result.push({
      name: `Định lượng ${ing.name}`,
      type: CriterionType.NUMBER,
      unit,
      min: minVal,
      max: maxVal,
      declaredContent: baseContent > 0 ? baseContent : undefined,
      notes: baseContent > 0 ? `Hàm lượng danh định: ${baseContent} ${unit} (±${tolerancePercentage}%)` : 'Theo công thức'
    });
  });

  return result;
};

/**
 * Kiểm tra các sai khác giữa TCCS và Công thức sản phẩm
 */
export const checkTCCSFormulaConflicts = (
  tccsCriteria: Criterion[],
  formula?: ProductFormula
): string[] => {
  if (!formula) return [];
  const warnings: string[] = [];
  const activeIngredients = ensureArray(formula.ingredients);

  const tccsNames = tccsCriteria.map(c => (c.name || '').toLowerCase().trim());

  activeIngredients.forEach(ing => {
    if (!ing || !ing.name) return;
    const ingNameLower = ing.name.toLowerCase().trim();
    const hasMatch = tccsNames.some(name => name.includes(ingNameLower) || ingNameLower.includes(name));
    if (!hasMatch) {
      warnings.push(`Hoạt chất "${ing.name}" trong công thức chưa có chỉ tiêu định lượng tương ứng trong TCCS.`);
    }
  });

  return warnings;
};
