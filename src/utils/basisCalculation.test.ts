import { describe, it, expect } from 'vitest';
import {
  resolveDeclaredBasis,
  findMatchingFormulaItem,
  calculateRelativePercentage,
} from './basisCalculation';
import { Criterion, CriterionType, ProductFormula } from '../types';
import { getContentPercent } from './testResultEvaluation';

describe('basisCalculation - resolveDeclaredBasis', () => {
  const sampleFormula: ProductFormula = {
    id: 'f1',
    productId: 'p1',
    ingredients: [
      {
        id: 'ing1',
        name: 'Kẽm gluconat',
        declaredContent: 70,
        elementalContent: 10,
        unit: 'mg/viên',
      },
      {
        id: 'ing2',
        name: 'Sắt (II) fumarat',
        declaredContent: 100,
        elementalContent: 32.8,
        unit: 'mg/viên',
      },
      {
        id: 'ing3',
        name: 'Paracetamol',
        declaredContent: 500,
        unit: 'mg/viên',
      },
    ],
    createdAt: '',
    updatedAt: '',
  };

  it('1. Tự động nhận diện nguyên tố khi tên chỉ tiêu là Kẽm (Zn) và công thức có Kẽm gluconat (70mg muối, 10mg nguyên tố)', () => {
    const criterion: Criterion = {
      name: 'Hàm lượng Kẽm (Zn)',
      unit: 'mg/viên',
      min: 8.0,
      max: 12.0,
      type: CriterionType.NUMBER,
    };

    const res = resolveDeclaredBasis(criterion, sampleFormula);
    expect(res.basis).toBe(10);
    expect(res.basisType).toBe('ELEMENTAL');
    expect(res.isElementalCandidate).toBe(true);
    expect(res.elementalContent).toBe(10);
    expect(res.saltContent).toBe(70);
  });

  it('2. Ưu tiên đúng nguyên tố khi TCCS thiết lập calculationBasis: ELEMENTAL kể cả khi criterion.declaredContent bị điền giá trị muối 70', () => {
    const criterion: Criterion = {
      name: 'Định lượng Kẽm',
      unit: 'mg/viên',
      declaredContent: 70, // Giả sử bị điền nhầm hàm lượng muối vào TCCS
      calculationBasis: 'ELEMENTAL',
      formulaIngredientId: 'Kẽm gluconat',
      type: CriterionType.NUMBER,
    };

    const res = resolveDeclaredBasis(criterion, sampleFormula);
    expect(res.basis).toBe(10);
    expect(res.basisType).toBe('ELEMENTAL');
  });

  it('3. Sử dụng đúng hàm lượng muối khi TCCS thiết lập calculationBasis: DECLARED', () => {
    const criterion: Criterion = {
      name: 'Kẽm gluconat',
      unit: 'mg/viên',
      calculationBasis: 'DECLARED',
      formulaIngredientId: 'Kẽm gluconat',
      type: CriterionType.NUMBER,
    };

    const res = resolveDeclaredBasis(criterion, sampleFormula);
    expect(res.basis).toBe(70);
    expect(res.basisType).toBe('DECLARED');
  });

  it('4. Hỗ trợ người dùng chọn thủ công qua manualChoice', () => {
    const criterion: Criterion = {
      name: 'Sắt',
      unit: 'mg/viên',
      type: CriterionType.NUMBER,
    };

    // Chọn thủ công ELEMENTAL
    const resElem = resolveDeclaredBasis(criterion, sampleFormula, undefined, 'ELEMENTAL');
    expect(resElem.basis).toBe(32.8);
    expect(resElem.basisType).toBe('ELEMENTAL');

    // Chọn thủ công DECLARED
    const resDecl = resolveDeclaredBasis(criterion, sampleFormula, undefined, 'DECLARED');
    expect(resDecl.basis).toBe(100);
    expect(resDecl.basisType).toBe('DECLARED');
  });

  it('5. Chỉ tiêu thông thường không có nguyên tố (Paracetamol 500mg) -> lấy đúng 500mg', () => {
    const criterion: Criterion = {
      name: 'Định lượng Paracetamol',
      unit: 'mg/viên',
      type: CriterionType.NUMBER,
    };

    const res = resolveDeclaredBasis(criterion, sampleFormula);
    expect(res.basis).toBe(500);
    expect(res.basisType).toBe('DECLARED');
    expect(res.isElementalCandidate).toBe(false);
  });

  it('6. Khi không có công thức, fallback sang điểm giữa Min/Max trong TCCS', () => {
    const criterion: Criterion = {
      name: 'Chỉ tiêu không có công thức',
      unit: 'mg',
      min: 90,
      max: 110,
      type: CriterionType.NUMBER,
    };

    const res = resolveDeclaredBasis(criterion, undefined);
    expect(res.basis).toBe(100);
    expect(res.basisType).toBe('MIDPOINT');
  });
});

describe('basisCalculation - calculateRelativePercentage', () => {
  it('1. Tính toán % chính xác từ hàm lượng công bố', () => {
    expect(calculateRelativePercentage(15, 15)).toBe('(100%)');
    expect(calculateRelativePercentage('15.5', 15)).toBe('(103.33%)');
    expect(calculateRelativePercentage(14.7, 15)).toBe('(98%)');
  });

  it('2. Xử lý chuẩn xác định dạng khoa học và số mũ (1.5 x 10⁸ vs 10⁸)', () => {
    expect(calculateRelativePercentage('1.5 x 10⁸', '10⁸')).toBe('(150%)');
    expect(calculateRelativePercentage('1.5x10^5', '10^5')).toBe('(150%)');
  });

  it('3. Dự phòng thông minh: tự bóc tách cơ sở tính toán từ tiêu chuẩn dạng TOLERANCE (15 ± 20 % -> base 15)', () => {
    // Không có declaredContent -> tự động lấy base = 15 từ limitText
    expect(calculateRelativePercentage('16.2', undefined, '15 ± 20 %')).toBe('(108%)');
    expect(calculateRelativePercentage(15, undefined, '15 ± 20%')).toBe('(100%)');
  });

  it('4. Ưu tiên declaredContent trước limitText nếu cả hai đều có', () => {
    expect(calculateRelativePercentage('16', '20', '15 ± 20 %')).toBe('(80%)');
  });

  it('5. Trả về null khi actualValue trống hoặc không phải số hợp lệ', () => {
    expect(calculateRelativePercentage(undefined, 100)).toBeNull();
    expect(calculateRelativePercentage('', 100)).toBeNull();
    expect(calculateRelativePercentage('Không phát hiện', 100)).toBeNull();
    expect(calculateRelativePercentage('Âm tính', 100)).toBeNull();
  });

  it('6. Trả về null khi không tìm được base hợp lệ hoặc base = 0', () => {
    expect(calculateRelativePercentage(15, 0)).toBeNull();
    expect(calculateRelativePercentage(15, undefined, undefined)).toBeNull();
    expect(calculateRelativePercentage(15, undefined, 'Không được có')).toBeNull();
    expect(calculateRelativePercentage(15, 'abc')).toBeNull();
  });

  it('7. Xử lý giá trị 0% cho vi sinh và tạp chất (Zero Value Handling)', () => {
    expect(calculateRelativePercentage(0, 100)).toBe('(0%)');
    expect(calculateRelativePercentage('0', 100)).toBe('(0%)');
    expect(calculateRelativePercentage('0.0', 100)).toBe('(0%)');
    expect(calculateRelativePercentage('0%', 100)).toBe('(0%)');
  });

  it('8. Trả về null khi base <= 0', () => {
    expect(calculateRelativePercentage(15, -10)).toBeNull();
  });
});

describe('basisCalculation - Bacillus Priority & getContentPercent Regression Test', () => {
  it('Khắc phục hồi quy lỗi Bacillus: Ưu tiên formulaItem.declaredContent trước TCCS declaredContent (150% thay vì 15%)', () => {
    const formulaWithBacillus: ProductFormula = {
      id: 'f_bacillus',
      productId: 'p_bacillus',
      ingredients: [
        {
          id: 'ing_bacillus',
          name: 'Bacillus clausii',
          declaredContent: '10^8' as any, // 100,000,000 CFU/mL trong công thức
          unit: 'CFU/mL',
        },
      ],
      excipients: [],
      createdAt: '2026-09-14',
      updatedAt: '2026-09-14',
    };

    const tccsCriterionBacillus: Criterion = {
      name: 'Tổng số vi sinh vật hiếu khí (Bacillus)',
      type: CriterionType.NUMBER,
      formulaIngredientId: 'ing_bacillus',
      declaredContent: '10^9', // Giới hạn tối thiểu TCCS vô tình bị gán 10^9
      min: 1000000000,
      unit: 'CFU/mL',
    };

    // 1. Phân giải basis qua resolveDeclaredBasis phải ra 10^8 (100,000,000), KHÔNG PHẢI 10^9
    const basisInfo = resolveDeclaredBasis(tccsCriterionBacillus, formulaWithBacillus);
    expect(basisInfo.basis).toBe(100000000);

    // 2. Kết quả kiểm nghiệm 1.5 x 10⁸ phải tính ra 150%, không phải 15%
    const pct = getContentPercent(
      'Tổng số vi sinh vật hiếu khí (Bacillus)',
      '1.5 x 10⁸',
      tccsCriterionBacillus,
      formulaWithBacillus
    );
    expect(pct).toBe('(150%)');

    // 3. Kết quả 0 phải hiển thị (0%)
    const pctZero = getContentPercent(
      'Tổng số vi sinh vật hiếu khí (Bacillus)',
      0,
      tccsCriterionBacillus,
      formulaWithBacillus
    );
    expect(pctZero).toBe('(0%)');
  });
});
