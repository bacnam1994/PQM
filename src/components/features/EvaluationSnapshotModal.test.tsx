import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvaluationSnapshotModal } from './EvaluationSnapshotModal';
import { createEvaluationHash } from '../../domain/evaluation/EvaluationSnapshotBuilder';

describe('Phase 5: EvaluationSnapshotModal - ALCOA+ Snapshot Verification', () => {
  const mockTestResult = {
    id: 'tr_test_1',
    reportNumber: 'KN-2026-001',
    batchId: 'batch_101',
    overallStatus: 'PASS' as const,
    results: [
      { criteriaName: 'Độ ẩm', value: '8.5', isPass: true, limit: '≤ 9.0%' },
      { criteriaName: 'Định lượng', value: '99.5', isPass: true, limit: '90 - 110%' },
    ],
    evaluationSnapshot: {
      engineVersion: '4.0.0-deterministic',
      tccsId: 'tccs_01',
      tccsVersion: 1,
      evaluatedAt: '2026-09-15T08:00:00.000Z',
      evaluatedBy: 'qa@vbiotech.vn',
      overallStatus: 'PASS' as const,
      criterionResults: [
        { criteriaName: 'Độ ẩm', value: '8.5', isPass: true, note: 'Giới hạn: ≤ 9.0%' },
        { criteriaName: 'Định lượng', value: '99.5', isPass: true, note: 'Giới hạn: 90 - 110%' },
      ],
      evaluationHash: '',
    },
  } as any;

  // Tính hash chuẩn
  mockTestResult.evaluationSnapshot.evaluationHash = createEvaluationHash({
    testResultId: mockTestResult.id,
    batchId: mockTestResult.batchId,
    overallStatus: mockTestResult.evaluationSnapshot.overallStatus,
    criterionResults: mockTestResult.evaluationSnapshot.criterionResults,
    evaluatedAt: mockTestResult.evaluationSnapshot.evaluatedAt,
    evaluatedBy: mockTestResult.evaluationSnapshot.evaluatedBy,
  });

  it('hiển thị thông tin snapshot và chứng thực tính toàn vẹn ALCOA+', () => {
    render(
      <EvaluationSnapshotModal
        isOpen={true}
        onClose={() => {}}
        testResult={mockTestResult}
        currentTccs={{ id: 'tccs_01', version: 1 } as any}
      />
    );

    expect(screen.getByText('tr_test_1', { exact: false })).toBeDefined();
    expect(screen.getByText('qa@vbiotech.vn')).toBeDefined();
    expect(screen.getByText(/Chữ ký toàn vẹn/i)).toBeDefined();
    expect(screen.getByText('Độ ẩm')).toBeDefined();
    expect(screen.getByText('Định lượng')).toBeDefined();
  });

  it('cảnh báo khi phiên bản TCCS hiện tại đã thay đổi so với lúc thẩm định', () => {
    render(
      <EvaluationSnapshotModal
        isOpen={true}
        onClose={() => {}}
        testResult={mockTestResult}
        currentTccs={{ id: 'tccs_01', version: 2, code: 'TCCS-01-V2' } as any}
      />
    );

    expect(
      screen.getByText(/Tiêu chuẩn TCCS đã có phiên bản mới hơn phiên bản thẩm định/i)
    ).toBeDefined();
    expect(screen.getByText(/TCCS v1/i)).toBeDefined();
    expect(screen.getByText(/TCCS v2/i)).toBeDefined();
  });
});
