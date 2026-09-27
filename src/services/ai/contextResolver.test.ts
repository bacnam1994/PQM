import { describe, it, expect } from 'vitest';
import { resolveLeanContext } from './contextResolver';

describe('AI Context Resolver (Phase 8)', () => {
  const mockStoreData = {
    products: [
      { id: 'prod_1', code: 'SP01', name: 'Paracetamol 500mg', status: 'ACTIVE' },
      { id: 'prod_2', code: 'SP02', name: 'Amoxicillin 250mg', status: 'ACTIVE' },
    ],
    batches: [
      {
        id: 'batch_101',
        batchNo: '362605',
        productId: 'prod_1',
        status: 'RELEASED',
        mfgDate: '2026-05-01',
        expDate: '2028-05-01',
        actualYield: 1000,
        yieldUnit: 'viên',
      },
      {
        id: 'batch_102',
        batchNo: '292605',
        productId: 'prod_2',
        status: 'PENDING',
        mfgDate: '2026-06-01',
        expDate: '2028-06-01',
      },
    ],
    tccsList: [
      {
        id: 'tccs_1',
        code: 'TCCS-01/2026',
        productId: 'prod_1',
        isActive: true,
        issueDate: '2026-01-01',
        mainQualityCriteria: [{ name: 'Định lượng' }, { name: 'Độ rã' }],
        safetyCriteria: [{ name: 'Kim loại nặng' }],
      },
    ],
    testResults: [
      {
        id: 'tr_1',
        batchId: 'batch_101',
        labName: 'Phòng Lab Trung Tâm',
        reportNo: 'KN-2026-001',
        testDate: '2026-05-10',
        overallStatus: 'PASSED',
        testResults: [
          { criteriaName: 'Định lượng', status: 'PASSED' },
          { criteriaName: 'Độ rã', status: 'PASSED' },
        ],
      },
    ],
    qualityAlerts: [
      { id: 'alert_1', batchId: 'batch_101', title: 'Cảnh báo nhiệt độ', severity: 'MEDIUM' },
    ],
  };

  it('nên trích xuất đúng ngữ cảnh của Lô cụ thể khi người dùng nhắc tới số lô', () => {
    const question = 'Hãy kiểm tra lô 362605 xem có đạt tiêu chuẩn không?';
    const lean = resolveLeanContext(question, mockStoreData);

    expect(lean._contextType).toBe('SPECIFIC_BATCH');
    expect(lean.batch?.batchNo).toBe('362605');
    expect(lean.batch?.productName).toBe('Paracetamol 500mg');
    expect(lean.product?.code).toBe('SP01');
    expect(lean.tccs?.code).toBe('TCCS-01/2026');
    expect(lean.testResult?.reportNo).toBe('KN-2026-001');
    expect(lean.testResult?.overallStatus).toBe('PASSED');
    expect(lean.relevantAlerts?.length).toBe(1);
    expect(lean.relevantAlerts?.[0].title).toBe('Cảnh báo nhiệt độ');
  });

  it('nên trích xuất đúng sản phẩm khi người dùng chỉ hỏi về tên sản phẩm', () => {
    const question = 'Sản phẩm Paracetamol 500mg có những lô nào gần đây?';
    const lean = resolveLeanContext(question, mockStoreData);

    expect(lean._contextType).toBe('SPECIFIC_PRODUCT');
    expect(lean.product?.name).toBe('Paracetamol 500mg');
    expect(lean.recentBatches?.length).toBe(1);
    expect(lean.recentBatches?.[0].batchNo).toBe('362605');
  });

  it('nên trả về tổng quan hệ thống khi câu hỏi không chứa thực thể cụ thể', () => {
    const question = 'Hôm nay hệ thống có cảnh báo chất lượng nào nghiêm trọng không?';
    const lean = resolveLeanContext(question, mockStoreData);

    expect(lean._contextType).toBe('GENERAL_OVERVIEW');
    expect(lean.systemOverview?.totalProducts).toBe(2);
    expect(lean.systemOverview?.totalBatches).toBe(2);
    expect(lean.recentBatches?.length).toBe(2);
  });
});
