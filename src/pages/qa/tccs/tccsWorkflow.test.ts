import { describe, it, expect, vi } from 'vitest';
import { ChangeImpactEngine } from '../../../services/changeImpactEngine';
import { ApprovalWorkflowService } from '../../../services/app/ApprovalWorkflowService';
import { signatureService } from '../../../services/signatureService';
import { Criterion, CriterionType, TCCS, Batch, TestResult } from '../../../types';

vi.mock('../../../services/signatureService', () => ({
  signatureService: {
    verifySignatureIntegrity: vi.fn().mockResolvedValue(true),
    createElectronicSignature: vi.fn().mockResolvedValue({
      id: 'sig_123',
      userId: 'user_qa',
      userEmail: 'qa@pqm.com',
      signerRole: 'QA',
      timestamp: new Date().toISOString(),
      documentType: 'TCCS',
      documentId: 'tccs_001',
      documentVersion: 1,
      meaning: 'Phê duyệt TCCS',
      signatureHash: 'hash_abc_123'
    })
  }
}));

describe('TASK-014: TCCS Versioning & Workflow Integration', () => {
  const oldCriteria: Criterion[] = [
    { name: 'Định lượng Paracetamol', unit: '%', min: 90, max: 110, type: CriterionType.NUMBER },
    { name: 'Độ hòa tan', unit: '%', min: 75, type: CriterionType.NUMBER },
    { name: 'Tạp chất A', unit: '%', max: 0.5, type: CriterionType.NUMBER }
  ];

  const newCriteria: Criterion[] = [
    { name: 'Định lượng Paracetamol', unit: '%', min: 95, max: 105, type: CriterionType.NUMBER }, // Siết chặt Min & Max
    { name: 'Độ hòa tan', unit: '%', min: 75, type: CriterionType.NUMBER }, // Giữ nguyên
    { name: 'Tạp chất B mới', unit: '%', max: 0.2, type: CriterionType.NUMBER } // Thêm mới, xóa Tạp chất A
  ];

  it('so sánh độ lệch chỉ tiêu giữa 2 phiên bản chính xác (compareCriteria)', () => {
    const diffs = ChangeImpactEngine.compareCriteria(oldCriteria, newCriteria);
    expect(diffs).toHaveLength(4);

    const paraDiff = diffs.find(d => d.name === 'Định lượng Paracetamol');
    expect(paraDiff?.type).toBe('MODIFIED');
    expect(paraDiff?.changes.length).toBeGreaterThan(0);

    const tanDiff = diffs.find(d => d.name === 'Độ hòa tan');
    expect(tanDiff?.type).toBe('UNCHANGED');

    const removedDiff = diffs.find(d => d.name === 'Tạp chất A');
    expect(removedDiff?.type).toBe('REMOVED');

    const addedDiff = diffs.find(d => d.name === 'Tạp chất B mới');
    expect(addedDiff?.type).toBe('ADDED');
  });

  it('đánh giá tác động thay đổi tới lô hàng và phiếu kiểm nghiệm (assessImpact)', () => {
    const oldTccs: TCCS = {
      id: 'tccs_old',
      productId: 'prod_1',
      code: 'TCCS-PARA-01',
      issueDate: '2025-01-01',
      createdAt: '2025-01-01',
      isActive: true,
      composition: '',
      mainQualityCriteria: oldCriteria,
      safetyCriteria: []
    };

    const newTccs: TCCS = {
      id: 'tccs_new',
      productId: 'prod_1',
      code: 'TCCS-PARA-02',
      issueDate: '2026-01-01',
      createdAt: '2026-01-01',
      isActive: true,
      composition: '',
      mainQualityCriteria: newCriteria,
      safetyCriteria: []
    };

    const batches: Batch[] = [
      { 
        id: 'b1', 
        batchNo: 'L2601', 
        productId: 'prod_1', 
        status: 'TESTING', 
        mfgDate: '2026-01-01', 
        expDate: '2028-01-01',
        tccsId: 'tccs_old',
        theoreticalYield: 1000,
        actualYield: 990,
        yieldUnit: 'hộp',
        createdAt: '2026-01-01'
      }
    ];

    const testResults: TestResult[] = [
      {
        id: 'tr1',
        batchId: 'b1',
        overallStatus: 'PASS',
        testDate: '2026-01-02',
        labName: 'Lab Nội bộ',
        createdAt: '2026-01-02',
        results: [
          // 92% đạt chuẩn cũ (90-110%) nhưng không đạt chuẩn mới (95-105%)!
          { criteriaName: 'Định lượng Paracetamol', value: 92, isPass: true }
        ]
      }
    ];

    const report = ChangeImpactEngine.assessImpact(oldTccs, newTccs, batches, testResults);
    expect(report.oldTccsCode).toBe('TCCS-PARA-01');
    expect(report.newTccsCode).toBe('TCCS-PARA-02');
    expect(report.affectedActiveBatches).toHaveLength(1);
    expect(report.affectedActiveBatches[0].batchNo).toBe('L2601');
    expect(report.potentialTestResultConflicts.length).toBeGreaterThan(0);
    expect(report.riskLevel).toBe('HIGH');
  });

  it('khởi tạo và duyệt tuần tự 2 bước cho TCCS theo chuẩn 21 CFR Part 11', async () => {
    const task = ApprovalWorkflowService.createStandardTask('TCCS', 'tccs_101', 'Phê duyệt TCCS Paracetamol v2.0', 'initiator@pqm.com');
    expect(task.entityType).toBe('TCCS');
    expect(task.status).toBe('PENDING');
    expect(task.steps).toHaveLength(2);
    expect(task.steps[0].stepName).toContain('QC');
    expect(task.steps[1].stepName).toContain('QA');

    // Bước 1: QC Duyệt
    const qcUser = { uid: 'u_qc', email: 'qc@pqm.com', role: 'QC' as const };
    const validSignature = {
      id: 'sig_1',
      signerUid: 'u_qc',
      signerName: 'QC Lead',
      signerEmail: 'qc@pqm.com',
      role: 'QC' as const,
      documentType: 'TCCS' as const,
      documentId: 'tccs_101',
      documentVersion: 1,
      meaning: 'Thẩm tra Kỹ thuật QC',
      checksum: 'hash_qc',
      signedAt: new Date().toISOString()
    };

    const afterStep1 = await ApprovalWorkflowService.processStepDecision(
      task,
      qcUser,
      'APPROVE',
      'Đã đối chiếu phương pháp kiểm nghiệm Dược điển V',
      validSignature
    );

    expect(afterStep1.status).toBe('IN_PROGRESS');
    expect(afterStep1.currentStepIndex).toBe(1);
    expect(afterStep1.steps[0].status).toBe('APPROVED');

    // Bước 2: QA Phê duyệt Cuối cùng
    const qaUser = { uid: 'u_qa', email: 'qa@pqm.com', role: 'QA' as const };
    const qaSignature = {
      id: 'sig_2',
      signerUid: 'u_qa',
      signerName: 'QA Head',
      signerEmail: 'qa@pqm.com',
      role: 'QA' as const,
      documentType: 'TCCS' as const,
      documentId: 'tccs_101',
      documentVersion: 1,
      meaning: 'Phê duyệt Ban hành TCCS',
      checksum: 'hash_qa',
      signedAt: new Date().toISOString()
    };

    const finalApproved = await ApprovalWorkflowService.processStepDecision(
      afterStep1,
      qaUser,
      'APPROVE',
      'Đồng ý ban hành áp dụng chính thức cho các lô năm 2026',
      qaSignature
    );

    expect(finalApproved.status).toBe('APPROVED');
    expect(finalApproved.steps[1].status).toBe('APPROVED');
    expect(finalApproved.history).toHaveLength(3); // INIT + STEP1 + STEP2
  });
});
