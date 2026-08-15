import { describe, it, expect, beforeEach } from 'vitest';
import { fetchTestResultById } from './testResultService';
import { useAppStore } from '../store/useAppStore';
import { TestResult } from '../types';

describe('testResultService', () => {
  beforeEach(() => {
    useAppStore.setState({
      testResults: [],
      allTestResults: [],
    });
  });

  it('trả về null nếu không truyền id', async () => {
    const result = await fetchTestResultById('');
    expect(result).toBeNull();
  });

  it('tìm thấy phiếu kiểm nghiệm trong store bằng ID đầy đủ', async () => {
    const mockResult: TestResult = {
      id: 'tr_full_id_123456',
      batchId: 'batch_1',
      labName: 'Lab QC',
      testDate: '2026-08-15',
      overallStatus: 'PASS',
      results: [],
      createdAt: '2026-08-15T00:00:00.000Z',
    };

    useAppStore.setState({
      testResults: [mockResult],
    });

    const found = await fetchTestResultById('tr_full_id_123456');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('tr_full_id_123456');
    expect(found?.labName).toBe('Lab QC');
  });

  it('tìm thấy phiếu kiểm nghiệm trong store bằng suffix 6 ký tự', async () => {
    const mockResult: TestResult = {
      id: 'tr_20260815_abc999',
      batchId: 'batch_2',
      labName: 'Quatest 3',
      testDate: '2026-08-15',
      overallStatus: 'PASS',
      results: [],
      createdAt: '2026-08-15T00:00:00.000Z',
    };

    useAppStore.setState({
      testResults: [mockResult],
    });

    const found = await fetchTestResultById('abc999');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('tr_20260815_abc999');
  });

  it('bulkRenameCriteriaInAllTestResults bỏ qua khi tên cũ và tên mới trùng nhau', async () => {
    const { bulkRenameCriteriaInAllTestResults } = await import('./testResultService');
    const res = await bulkRenameCriteriaInAllTestResults('Độ ẩm', 'Độ ẩm');
    expect(res.updatedCount).toBe(0);
  });
});

