/**
 * CriteriaInputGroup.test.tsx
 * =============================
 * Kiểm thử đơn vị giao diện cho CriteriaInputGroup (PHASE 13: PKN IMPLEMENTATION):
 * - Task 13.01: PKN Editor hiển thị 100% tiêu chí từ TCCS Snapshot (không filter mất chỉ tiêu)
 * - Task 13.02: Badge trực quan: PASS, FAIL, PENDING, MIỄN KIỂM, CHỜ KẾT QUẢ, ĐẠT (THAY THẾ)
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CriteriaInputGroup from './CriteriaInputGroup';
import { CriterionType, TCCS } from '../../types';

describe('CriteriaInputGroup Component - PKN Implementation (Phase 13)', () => {
  const mockTccs: TCCS = {
    id: 'tccs-para-01',
    productId: 'prod-01',
    code: 'TCCS-01',
    productName: 'Paracetamol',
    isActive: true,
    mainQualityCriteria: [
      {
        id: 'c1',
        name: 'Định lượng hoạt chất A',
        min: 90,
        max: 110,
        unit: '%',
        type: CriterionType.NUMBER,
      },
      {
        id: 'c2',
        name: 'Định lượng HPLC kiểm tra lại',
        min: 90,
        max: 110,
        unit: '%',
        type: CriterionType.NUMBER,
      },
      { id: 'c3', name: 'Độ ẩm', max: 5.0, unit: '%', type: CriterionType.NUMBER },
    ],
    alternateRules: [
      {
        id: 'alt-01',
        main: 'Định lượng hoạt chất A',
        alt: 'Định lượng HPLC kiểm tra lại',
        type: 'FAIL_RETRY',
        note: 'Khi chỉ tiêu A không đạt, bắt buộc kiểm tra lại bằng HPLC',
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  const defaultProps = {
    title: 'Chỉ tiêu Hóa lý',
    criteria: mockTccs.mainQualityCriteria,
    icon: <span data-testid="test-icon">🧪</span>,
    colorClass: 'text-indigo-600',
    activeTCCS: mockTccs,
    testResultsMap: {},
    setMapValue: vi.fn(),
    existingResultsForBatch: [],
  };

  it('Task 13.01: Hiển thị 100% tiêu chí từ TCCS, tuyệt đối không filter mất chỉ tiêu phụ thuộc', () => {
    render(<CriteriaInputGroup {...defaultProps} />);

    // Kiểm tra cả 3 chỉ tiêu đều xuất hiện trên giao diện
    expect(screen.getByText('Định lượng hoạt chất A')).toBeTruthy();
    expect(screen.getByText('Định lượng HPLC kiểm tra lại')).toBeTruthy();
    expect(screen.getByText('Độ ẩm')).toBeTruthy();

    // Hiển thị tag nhận diện mối quan hệ
    expect(screen.getByText('🔗 Có thay thế')).toBeTruthy();
  });

  it('Task 13.02: Hiển thị Badge MIỄN KIỂM khi chỉ tiêu chính đã ĐẠT (PASS)', () => {
    // Chỉ tiêu chính đạt 100% -> Chỉ tiêu HPLC phụ thuộc được MIỄN KIỂM
    const testResultsMap = {
      'Định lượng hoạt chất A': '100',
    };

    render(<CriteriaInputGroup {...defaultProps} testResultsMap={testResultsMap} />);

    // Chỉ tiêu chính hiển thị ĐẠT
    expect(screen.getByText('ĐẠT')).toBeTruthy();

    // Chỉ tiêu phụ thuộc hiển thị badge MIỄN KIỂM
    expect(screen.getByText('MIỄN KIỂM')).toBeTruthy();
  });

  it('Task 13.02: Hiển thị Badge CHỜ KẾT QUẢ khi chỉ tiêu chính FAIL và chỉ tiêu phụ chưa nhập', () => {
    // Chỉ tiêu chính rớt 80% (dưới 90) -> Kích hoạt quy tắc thay thế, chỉ tiêu HPLC ở trạng thái CHỜ KẾT QUẢ
    const testResultsMap = {
      'Định lượng hoạt chất A': '80',
    };

    render(<CriteriaInputGroup {...defaultProps} testResultsMap={testResultsMap} />);

    // Chỉ tiêu chính hiển thị K.ĐẠT
    expect(screen.getByText('K.ĐẠT')).toBeTruthy();

    // Chỉ tiêu phụ thuộc kích hoạt hiển thị CHỜ KẾT QUẢ
    expect(screen.getByText('CHỜ KẾT QUẢ')).toBeTruthy();
  });

  it('Task 13.02: Hiển thị Badge ĐẠT (THAY THẾ) khi chỉ tiêu phụ đạt tiêu chuẩn', () => {
    // Chỉ tiêu chính rớt 80%, chỉ tiêu HPLC đạt 99%
    const testResultsMap = {
      'Định lượng hoạt chất A': '80',
      'Định lượng HPLC kiểm tra lại': '99',
    };

    render(<CriteriaInputGroup {...defaultProps} testResultsMap={testResultsMap} />);

    // Chỉ tiêu phụ thuộc hiển thị ĐẠT (THAY THẾ)
    expect(screen.getByText('ĐẠT (THAY THẾ)')).toBeTruthy();
  });

  it('Kích hoạt hàm setMapValue khi người dùng nhập kết quả', () => {
    const setMapValueMock = vi.fn();
    render(<CriteriaInputGroup {...defaultProps} setMapValue={setMapValueMock} />);

    const inputs = screen.getAllByPlaceholderText(/Nhập kết quả/i);
    fireEvent.change(inputs[0], { target: { value: '98.5' } });

    expect(setMapValueMock).toHaveBeenCalledWith(
      'testResultsMap',
      'Định lượng hoạt chất A',
      '98.5'
    );
  });
});
