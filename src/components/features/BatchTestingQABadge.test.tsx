import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BatchTestingQABadge } from './BatchTestingQABadge';
import { Batch, TestResult, TCCS, CriterionType } from '../../types';

describe('BatchTestingQABadge - Dynamic QA Badge on UI', () => {
  const mockTccs: TCCS = {
    id: 'tccs-paracetamol-500',
    code: 'TCCS-PARA-001',
    productId: 'prod-para-500',
    issueDate: '2026-01-01',
    isActive: true,
    version: 1,
    createdAt: '2026-01-01T08:00:00Z',
    mainQualityCriteria: [
      {
        id: 'crit-dinhtinh',
        name: 'Định tính Paracetamol',
        type: CriterionType.TEXT,
        expectedText: 'Phải cho phản ứng đặc trưng của Paracetamol',
        unit: '',
      },
      {
        id: 'crit-dinhluong',
        name: 'Định lượng Paracetamol',
        type: CriterionType.NUMBER,
        min: 95,
        max: 105,
        unit: '%',
      },
    ],
    safetyCriteria: [],
  };

  const baseBatch: Batch = {
    id: 'batch-test-01',
    batchNo: 'L2609001',
    productId: 'prod-para-500',
    tccsId: 'tccs-paracetamol-500',
    mfgDate: '2026-09-01',
    expDate: '2028-09-01',
    status: 'TESTING', // Lô trong DB vẫn giữ status là TESTING
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-22T10:00:00Z',
    ...({ tccs: mockTccs } as any),
  };

  it('1. Không render badge khi batch.status không phải là TESTING (ví dụ: RELEASED)', () => {
    const releasedBatch: Batch = { ...baseBatch, status: 'RELEASED' };
    const completedTest: TestResult = {
      id: 'tr-01',
      batchId: releasedBatch.id,
      labName: 'Phòng Hóa lý',
      testDate: '2026-09-02',
      createdAt: '2026-09-02T08:00:00Z',
      overallStatus: 'PASS',
      status: 'APPROVED',
      results: [
        {
          criteriaName: 'Định tính Paracetamol',
          value: 'Phải cho phản ứng đặc trưng của Paracetamol',
          isPass: true,
        },
        { criteriaName: 'Định lượng Paracetamol', value: 99.5, isPass: true },
      ],
    };

    const { container } = render(
      <BatchTestingQABadge batch={releasedBatch} testResults={[completedTest]} tccs={mockTccs} />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Đã kiểm xong - Chờ QA duyệt/i)).toBeNull();
  });

  it('2. Không render badge khi batch.status là TESTING nhưng chưa hoàn tất 100% chỉ tiêu', () => {
    // Chỉ mới kiểm 1 trong 2 chỉ tiêu bắt buộc
    const partialTest: TestResult = {
      id: 'tr-02',
      batchId: baseBatch.id,
      labName: 'Phòng Hóa lý',
      testDate: '2026-09-02',
      createdAt: '2026-09-02T08:00:00Z',
      overallStatus: 'PENDING',
      status: 'SUBMITTED',
      results: [
        {
          criteriaName: 'Định tính Paracetamol',
          value: 'Phải cho phản ứng đặc trưng của Paracetamol',
          isPass: true,
        },
      ],
    };

    const { container } = render(
      <BatchTestingQABadge batch={baseBatch} testResults={[partialTest]} tccs={mockTccs} />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Đã kiểm xong - Chờ QA duyệt/i)).toBeNull();
  });

  it('3. Không render badge khi batch.status là TESTING, đủ 100% chỉ tiêu nhưng có chỉ tiêu FAIL', () => {
    const failedTest: TestResult = {
      id: 'tr-03',
      batchId: baseBatch.id,
      labName: 'Phòng Hóa lý',
      testDate: '2026-09-02',
      createdAt: '2026-09-02T08:00:00Z',
      overallStatus: 'FAIL',
      status: 'SUBMITTED',
      results: [
        {
          criteriaName: 'Định tính Paracetamol',
          value: 'Phải cho phản ứng đặc trưng của Paracetamol',
          isPass: true,
        },
        { criteriaName: 'Định lượng Paracetamol', value: 90.2, isPass: false }, // Dưới 95% -> FAIL
      ],
    };

    const { container } = render(
      <BatchTestingQABadge batch={baseBatch} testResults={[failedTest]} tccs={mockTccs} />
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText(/Đã kiểm xong - Chờ QA duyệt/i)).toBeNull();
  });

  it('4. Render nhãn màu xanh dương "Đã kiểm xong - Chờ QA duyệt" khi percentage === 100 và batchQualityStatus === PASS', () => {
    const passedTest: TestResult = {
      id: 'tr-04',
      batchId: baseBatch.id,
      labName: 'Phòng Hóa lý',
      testDate: '2026-09-02',
      createdAt: '2026-09-02T08:00:00Z',
      overallStatus: 'PASS',
      status: 'APPROVED',
      results: [
        {
          criteriaName: 'Định tính Paracetamol',
          value: 'Phải cho phản ứng đặc trưng của Paracetamol',
          isPass: true,
        },
        { criteriaName: 'Định lượng Paracetamol', value: 100.2, isPass: true },
      ],
    };

    render(<BatchTestingQABadge batch={baseBatch} testResults={[passedTest]} tccs={mockTccs} />);

    const badge = screen.getByTestId('batch-testing-qa-ready-badge');
    expect(badge).toBeDefined();
    expect(badge.textContent).toContain('Đã kiểm xong - Chờ QA duyệt');
    // Kiểm tra class styling màu xanh dương
    expect(badge.className).toContain('text-blue-700');
    expect(badge.className).toContain('bg-blue-50');

    // Xác nhận trong object batch trạng thái vẫn giữ nguyên là TESTING
    expect(baseBatch.status).toBe('TESTING');
  });
});
