import { describe, it, expect } from 'vitest';
import { resolveDeclaredBasis, findMatchingFormulaItem } from './basisCalculation';
import { Criterion, CriterionType, ProductFormula } from '../types';

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
        unit: 'mg/viên'
      },
      {
        id: 'ing2',
        name: 'Sắt (II) fumarat',
        declaredContent: 100,
        elementalContent: 32.8,
        unit: 'mg/viên'
      },
      {
        id: 'ing3',
        name: 'Paracetamol',
        declaredContent: 500,
        unit: 'mg/viên'
      }
    ],
    createdAt: '',
    updatedAt: ''
  };

  it('1. Tự động nhận diện nguyên tố khi tên chỉ tiêu là Kẽm (Zn) và công thức có Kẽm gluconat (70mg muối, 10mg nguyên tố)', () => {
    const criterion: Criterion = {
      name: 'Hàm lượng Kẽm (Zn)',
      unit: 'mg/viên',
      min: 8.0,
      max: 12.0,
      type: CriterionType.NUMBER
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
      type: CriterionType.NUMBER
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
      type: CriterionType.NUMBER
    };

    const res = resolveDeclaredBasis(criterion, sampleFormula);
    expect(res.basis).toBe(70);
    expect(res.basisType).toBe('DECLARED');
  });

  it('4. Hỗ trợ người dùng chọn thủ công qua manualChoice', () => {
    const criterion: Criterion = {
      name: 'Sắt',
      unit: 'mg/viên',
      type: CriterionType.NUMBER
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
      type: CriterionType.NUMBER
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
      type: CriterionType.NUMBER
    };

    const res = resolveDeclaredBasis(criterion, undefined);
    expect(res.basis).toBe(100);
    expect(res.basisType).toBe('MIDPOINT');
  });
});
