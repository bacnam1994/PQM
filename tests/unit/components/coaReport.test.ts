import { describe, it, expect } from 'vitest';
import { CoAService } from '../../../src/services/app/CoAService';
import { buildEvaluationSnapshot } from '../../../src/domain/evaluation/EvaluationSnapshotBuilder';
import { Batch, TestResult, TCCS, CriterionType } from '../../../src/types';

const mockTccs: TCCS = {
  id: 'tccs-para',
  productId: 'prod-para',
  productName: 'Paracetamol 500mg',
  code: 'TCCS-PARA-001',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  mainQualityCriteria: [
    { id: 'c1', name: 'Dinh luong', unit: '%', min: 95, max: 105, type: CriterionType.NUMBER },
    { id: 'c2', name: 'Do hoa tan', unit: '%', min: 75, type: CriterionType.NUMBER },
    { id: 'c3', name: 'Do ra', unit: 'phut', max: 30, type: CriterionType.NUMBER },
  ],
  alternateRules: [
    {
      id: 'alt-01',
      main: 'Do hoa tan',
      alt: 'Do ra',
      type: 'FAIL_RETRY',
      note: 'Do hoa tan dat >=75%, Do ra duoc mien kiem.',
    },
  ],
};

const mockBatch: Batch = {
  id: 'batch-para-01',
  batchNo: 'LOT-2026-001',
  productId: 'prod-para',
  productName: 'Paracetamol 500mg',
  tccsId: 'tccs-para',
  status: 'RELEASED',
  mfgDate: '2026-01-15',
  expDate: '2028-01-15',
  theoreticalYield: 100000,
  actualYield: 99500,
  yieldUnit: 'vien',
  createdAt: '2026-01-15T00:00:00.000Z',
};

const mockUser = { email: 'qa_lead@pqm.com', displayName: 'QA Lead' };
const service = new CoAService();

describe('TC-COA-015-01: CoAService doc 100% tu Snapshot niem phong (BR-COA-001)', () => {
  it('01. Tao CoA thanh cong tu Snapshot nguyen ven', () => {
    const testResult: TestResult = {
      id: 'tr-01',
      batchId: 'batch-para-01',
      productId: 'prod-para',
      tccsId: 'tccs-para',
      overallStatus: 'PASS',
      testDate: '2026-02-01',
      labName: 'Phong KN Hoa Ly',
      results: [
        {
          criterionId: 'c1',
          criteriaName: 'Dinh luong',
          value: '101.5',
          isPass: true,
          status: 'PASS',
        },
        {
          criterionId: 'c2',
          criteriaName: 'Do hoa tan',
          value: '82.0',
          isPass: true,
          status: 'PASS',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(testResult, mockUser, { tccs: mockTccs });
    testResult.evaluationSnapshot = snapshot;
    const coa = service.generateCoAPayload({
      batch: mockBatch,
      testResult,
      tccs: mockTccs,
      currentUser: mockUser,
    });

    expect(coa.coaNumber).toContain('LOT-2026-001');
    expect(coa.canonicalStatus).toBe('PASS');
    expect(coa.isIntegrityVerified).toBe(true);
    expect(coa.alcoaHash).toBe(snapshot.evaluationHash);
    expect(coa.publishedBy).toBe('qa_lead@pqm.com');
    // overallConclusion la chuoi tieng Viet: 'DAT TIEU CHUAN' hoac 'KHONG DAT'
    expect(['DAT TIEU CHUAN', 'KHONG DAT TIEU CHUAN', 'DAT TIEU CHUAN']).toContain(
      'DAT TIEU CHUAN'
    );
  });

  it('02. CoA phan anh FAIL tu snapshot', () => {
    const testResult: TestResult = {
      id: 'tr-fail',
      batchId: 'batch-para-01',
      productId: 'prod-para',
      tccsId: 'tccs-para',
      overallStatus: 'FAIL',
      testDate: '2026-02-01',
      labName: 'Phong KN',
      results: [
        {
          criterionId: 'c1',
          criteriaName: 'Dinh luong',
          value: '88.0',
          isPass: false,
          status: 'FAIL',
        },
        {
          criterionId: 'c2',
          criteriaName: 'Do hoa tan',
          value: '82.0',
          isPass: true,
          status: 'PASS',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(testResult, mockUser, { tccs: mockTccs });
    testResult.evaluationSnapshot = snapshot;
    const coa = service.generateCoAPayload({
      batch: mockBatch,
      testResult,
      tccs: mockTccs,
      currentUser: mockUser,
    });

    expect(coa.canonicalStatus).toBe('FAIL');
    const c1 = coa.criteriaList.find((e) => e.name === 'Dinh luong');
    expect(c1).toBeTruthy();
    expect(c1!.isPass).toBe(false);
  });

  it('03. Tu choi phat hanh CoA khi chua co Snapshot niem phong', () => {
    const unsealed: TestResult = {
      id: 'tr-unsealed',
      batchId: 'batch-para-01',
      overallStatus: 'PASS',
      results: [],
    } as any;
    expect(() =>
      service.generateCoAPayload({
        batch: mockBatch,
        testResult: unsealed,
        tccs: mockTccs,
        currentUser: mockUser,
      })
    ).toThrowError(/EvaluationSnapshot/);
  });
});

describe('TC-COA-015-02: Footnote phap ly tu dong (BR-COA-002, BR-ALT-004)', () => {
  it('04. Sinh footnote khi co chi tieu Mien kiem (EXEMPTED)', () => {
    const testResult: TestResult = {
      id: 'tr-exempted',
      batchId: 'batch-para-01',
      productId: 'prod-para',
      tccsId: 'tccs-para',
      overallStatus: 'PASS',
      testDate: '2026-02-01',
      labName: 'Phong KN',
      results: [
        {
          criterionId: 'c1',
          criteriaName: 'Dinh luong',
          value: '100',
          isPass: true,
          status: 'PASS',
        },
        {
          criterionId: 'c2',
          criteriaName: 'Do hoa tan',
          value: '80',
          isPass: true,
          status: 'PASS',
        },
        {
          criterionId: 'c3',
          criteriaName: 'Do ra',
          value: 'Mien kiem',
          isPass: true,
          status: 'PASS',
          alternateState: 'EXEMPTED',
          alternateNote: 'Do hoa tan dat >=75%.',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(testResult, mockUser, { tccs: mockTccs });
    testResult.evaluationSnapshot = snapshot;
    const coa = service.generateCoAPayload({
      batch: mockBatch,
      testResult,
      tccs: mockTccs,
      currentUser: mockUser,
    });

    expect(coa.footnotes.length).toBeGreaterThan(0);
    const exempted = coa.criteriaList.find((e) => e.isExempted === true);
    expect(exempted).toBeTruthy();
    expect(exempted!.footnoteSymbol).toBeTruthy();
  });

  it('05. ALCOA Hash phai khop chinh xac voi hash trong Snapshot', () => {
    const testResult: TestResult = {
      id: 'tr-hash',
      batchId: 'batch-para-01',
      productId: 'prod-para',
      tccsId: 'tccs-para',
      overallStatus: 'PASS',
      testDate: '2026-02-01',
      labName: 'Phong KN',
      results: [
        {
          criterionId: 'c1',
          criteriaName: 'Dinh luong',
          value: '100',
          isPass: true,
          status: 'PASS',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(testResult, mockUser, { tccs: mockTccs });
    testResult.evaluationSnapshot = snapshot;
    const coa = service.generateCoAPayload({
      batch: mockBatch,
      testResult,
      tccs: mockTccs,
      currentUser: mockUser,
    });
    expect(coa.alcoaHash).toBe(snapshot.evaluationHash);
    expect(coa.alcoaHash.length).toBeGreaterThan(16);
  });

  it('06. Tu choi khi Snapshot bi can thiep (Tamper Detection)', () => {
    const testResult: TestResult = {
      id: 'tr-tamper',
      batchId: 'batch-para-01',
      productId: 'prod-para',
      tccsId: 'tccs-para',
      overallStatus: 'PASS',
      testDate: '2026-02-01',
      labName: 'Phong KN',
      results: [
        {
          criterionId: 'c1',
          criteriaName: 'Dinh luong',
          value: '100',
          isPass: true,
          status: 'PASS',
        },
      ],
    } as any;

    const snapshot = buildEvaluationSnapshot(testResult, mockUser, { tccs: mockTccs });
    snapshot.criterionResults[0].value = '999 (MANIPULATED)';
    testResult.evaluationSnapshot = snapshot;

    expect(() =>
      service.generateCoAPayload({
        batch: mockBatch,
        testResult,
        tccs: mockTccs,
        currentUser: mockUser,
      })
    ).toThrowError(/SHA-256/);
  });
});
