import { describe, it, expect } from 'vitest';
import { AlcoaAuditManager, AlcoaAuditRecord, ALCOA_GENESIS_HASH } from '../audit/alcoaAuditModel';

describe('Model 9: Audit Trail Model (ALCOA+) Regression Suite', () => {
  // 1. Genesis & Hash Chaining
  it('tạo bản ghi gốc (Genesis Record) với previousHash khởi thủy và sequence 1', async () => {
    const genesis = await AlcoaAuditManager.createGenesisRecord({
      entityType: 'BATCH',
      entityId: 'batch-001',
      userId: 'admin-01',
      userRole: 'ADMIN',
      initialData: { batchNo: 'B260901', status: 'PENDING' },
    });

    expect(genesis.previousHash).toBe(ALCOA_GENESIS_HASH);
    expect(genesis.sequenceNumber).toBe(1);
    expect(genesis.isGenesis).toBe(true);
    expect(genesis.entryHash).toBeDefined();
    expect(genesis.entryHash).toHaveLength(64); // SHA-256 64 hex chars
    expect(genesis.classification).toBe('REGULATED');
  });

  it('nối các bản ghi tuần tự với appendRecord và tự động liên kết previousHash', async () => {
    const genesis = await AlcoaAuditManager.createGenesisRecord({
      entityType: 'TEST_RESULT',
      entityId: 'tr-001',
      userId: 'qc-01',
    });

    const chain: AlcoaAuditRecord[] = [genesis];

    const { updatedChain: chain2, newRecord: log2 } = await AlcoaAuditManager.appendRecord(chain, {
      entityType: 'TEST_RESULT',
      entityId: 'tr-001',
      action: 'UPDATE',
      field: 'results',
      oldValue: [],
      newValue: [{ criteriaName: 'Định lượng', value: 99.5, isPass: true }],
      userId: 'qc-01',
      reason: 'Nhập kết quả kiểm nghiệm đợt 1',
    });

    expect(log2.previousHash).toBe(genesis.entryHash);
    expect(log2.sequenceNumber).toBe(2);

    const { updatedChain: chain3, newRecord: log3 } = await AlcoaAuditManager.appendRecord(chain2, {
      entityType: 'TEST_RESULT',
      entityId: 'tr-001',
      action: 'STATUS_CHANGE',
      field: 'overallStatus',
      oldValue: 'PENDING',
      newValue: 'PASS',
      userId: 'qa-01',
      userRole: 'QA',
      reason: 'Phê duyệt kết quả kiểm nghiệm đạt chuẩn',
    });

    expect(log3.previousHash).toBe(log2.entryHash);
    expect(log3.sequenceNumber).toBe(3);
    expect(chain3).toHaveLength(3);

    const verify = await AlcoaAuditManager.verifyChainIntegrity(chain3);
    expect(verify.isValid).toBe(true);
    expect(verify.chainLength).toBe(3);
    expect(verify.violations).toHaveLength(0);
  });

  // 2. Inviolable ALCOA+ Guards
  it('chặn tạo bản ghi khi thiếu userId (Vi phạm Attributable)', async () => {
    await expect(
      AlcoaAuditManager.createRecord({
        entityType: 'BATCH',
        entityId: 'batch-001',
        action: 'UPDATE',
        userId: '',
        reason: 'Cập nhật trạng thái',
      })
    ).rejects.toThrow('ALCOA+ Invariant Violation: userId là bắt buộc (Attributable)');
  });

  it('chặn hành động REGULATED khi thiếu lý do thay đổi (Vi phạm Legible & Attributable)', async () => {
    await expect(
      AlcoaAuditManager.createRecord({
        entityType: 'TEST_RESULT',
        entityId: 'tr-001',
        action: 'STATUS_CHANGE',
        userId: 'qa-01',
        reason: '',
      })
    ).rejects.toThrow('yêu cầu lý do thay đổi rõ ràng');
  });

  // 3. Tamper Detection (Bit-flip / Content modification)
  it('phát hiện can thiệp giả mạo khi nội dung newValue bị thay đổi (HASH_MISMATCH)', async () => {
    const log1 = await AlcoaAuditManager.createRecord({
      entityType: 'BATCH',
      entityId: 'batch-001',
      action: 'CREATE',
      userId: 'prod-01',
      reason: 'Khởi tạo lô sản xuất',
      timestamp: '2026-09-01T08:00:00.000Z',
    });

    const log2 = await AlcoaAuditManager.createRecord({
      entityType: 'BATCH',
      entityId: 'batch-001',
      action: 'STATUS_CHANGE',
      oldValue: 'TESTING',
      newValue: 'REJECTED',
      userId: 'qa-01',
      reason: 'Từ chối lô do OOS vi sinh',
      previousHash: log1.entryHash,
      timestamp: '2026-09-01T09:00:00.000Z',
    });

    // Kẻ xấu giả mạo REJECTED thành RELEASED mà không thể làm lại mã băm
    const tamperedLog2: AlcoaAuditRecord = {
      ...log2,
      newValue: 'RELEASED',
    };

    const verify = await AlcoaAuditManager.verifyChainIntegrity([log1, tamperedLog2]);
    expect(verify.isValid).toBe(false);
    expect(verify.tamperedIndex).toBe(1);
    expect(verify.tamperedRecordId).toBe(log2.id);
    expect(verify.reason).toContain('đã bị can thiệp trái phép');
    expect(verify.violations[0].type).toBe('HASH_MISMATCH');
  });

  it('phát hiện can thiệp khi lý do thay đổi (reason) hoặc người thực hiện (userId) bị sửa đổi', async () => {
    const log = await AlcoaAuditManager.createRecord({
      entityType: 'DEVIATION',
      entityId: 'dev-001',
      action: 'UPDATE',
      field: 'rootCause',
      newValue: 'Nhiệt độ phòng sấy vượt 65°C',
      userId: 'qa-auditor',
      reason: 'Ghi nhận nguyên nhân gốc sau điều tra',
    });

    const tamperedLog: AlcoaAuditRecord = {
      ...log,
      reason: 'Lỗi thiết bị nhẹ (đã sửa)',
    };

    const isSingleValid = await AlcoaAuditManager.verifyRecordIntegrity(tamperedLog);
    expect(isSingleValid).toBe(false);

    const chainVerify = await AlcoaAuditManager.verifyChainIntegrity([tamperedLog]);
    expect(chainVerify.isValid).toBe(false);
    expect(chainVerify.violations[0].type).toBe('HASH_MISMATCH');
  });

  // 4. Broken Link Detection (Deleted or inserted records)
  it('phát hiện khi chuỗi bị đứt đoạn do một bản ghi ở giữa bị xóa (BROKEN_LINK)', async () => {
    const log1 = await AlcoaAuditManager.createRecord({
      entityType: 'BATCH',
      entityId: 'batch-001',
      action: 'CREATE',
      userId: 'user-1',
      reason: 'Lô tạo',
      timestamp: '2026-09-01T08:00:00.000Z',
    });

    const log2 = await AlcoaAuditManager.createRecord({
      entityType: 'BATCH',
      entityId: 'batch-001',
      action: 'UPDATE',
      field: 'status',
      newValue: 'TESTING',
      userId: 'user-2',
      reason: 'Gửi mẫu',
      previousHash: log1.entryHash,
      timestamp: '2026-09-01T09:00:00.000Z',
    });

    const log3 = await AlcoaAuditManager.createRecord({
      entityType: 'BATCH',
      entityId: 'batch-001',
      action: 'UPDATE',
      field: 'status',
      newValue: 'RELEASED',
      userId: 'user-3',
      reason: 'Xuất xưởng',
      previousHash: log2.entryHash,
      timestamp: '2026-09-01T10:00:00.000Z',
    });

    // Kẻ xấu xóa log2 ra khỏi chuỗi
    const brokenChain = [log1, log3];

    const verify = await AlcoaAuditManager.verifyChainIntegrity(brokenChain);
    expect(verify.isValid).toBe(false);
    expect(verify.tamperedIndex).toBe(1);
    expect(verify.violations[0].type).toBe('BROKEN_LINK');
    expect(verify.reason).toContain('previousHash không khớp với entryHash của bản ghi trước');
  });

  // 5. Contemporaneous Time Verification (Monotonic Timestamps)
  it('phát hiện khi có bản ghi hồi tố đi lùi thời gian so với bản ghi trước (TIMESTAMP_REGRESSION)', async () => {
    const log1 = await AlcoaAuditManager.createRecord({
      entityType: 'TCCS',
      entityId: 'tccs-001',
      action: 'CREATE',
      userId: 'qa-01',
      reason: 'Tạo TCCS',
      timestamp: '2026-09-01T14:00:00.000Z',
    });

    const log2 = await AlcoaAuditManager.createRecord({
      entityType: 'TCCS',
      entityId: 'tccs-001',
      action: 'UPDATE',
      field: 'version',
      newValue: 2,
      userId: 'qa-02',
      reason: 'Cập nhật phiên bản',
      previousHash: log1.entryHash,
      timestamp: '2026-09-01T12:00:00.000Z', // 12h sớm hơn 14h -> Lỗi hồi tố
    });

    const verify = await AlcoaAuditManager.verifyChainIntegrity([log1, log2]);
    expect(verify.isValid).toBe(false);
    expect(verify.tamperedIndex).toBe(1);
    expect(verify.violations[0].type).toBe('TIMESTAMP_REGRESSION');
    expect(verify.reason).toContain('Vi phạm Contemporaneous');
  });

  // 6. Filtering & Inspection Reporting
  it('hỗ trợ lọc chuỗi audit trail theo entity, action, userId và khoảng thời gian', async () => {
    const records: AlcoaAuditRecord[] = [
      await AlcoaAuditManager.createRecord({
        entityType: 'BATCH',
        entityId: 'b-01',
        action: 'CREATE',
        userId: 'user-A',
        reason: 'Tạo',
        timestamp: '2026-09-01T08:00:00.000Z',
      }),
      await AlcoaAuditManager.createRecord({
        entityType: 'TEST_RESULT',
        entityId: 'tr-01',
        action: 'CREATE',
        userId: 'user-B',
        reason: 'Tạo phiếu',
        timestamp: '2026-09-02T08:00:00.000Z',
      }),
      await AlcoaAuditManager.createRecord({
        entityType: 'BATCH',
        entityId: 'b-01',
        action: 'STATUS_CHANGE',
        userId: 'user-A',
        reason: 'Xuất xưởng',
        timestamp: '2026-09-03T08:00:00.000Z',
      }),
    ];

    const batchRecords = AlcoaAuditManager.filterAuditTrail(records, { entityType: 'BATCH' });
    expect(batchRecords).toHaveLength(2);

    const userBRecords = AlcoaAuditManager.filterAuditTrail(records, { userId: 'user-B' });
    expect(userBRecords).toHaveLength(1);

    const timeFiltered = AlcoaAuditManager.filterAuditTrail(records, {
      fromDate: '2026-09-02T00:00:00.000Z',
      toDate: '2026-09-03T00:00:00.000Z',
    });
    expect(timeFiltered).toHaveLength(1);
    expect(timeFiltered[0].entityType).toBe('TEST_RESULT');
  });

  it('tạo báo cáo thanh tra ALCOA+ Inspection Report đầy đủ 9 tiêu chí và phân tích số liệu', async () => {
    const log1 = await AlcoaAuditManager.createRecord({
      entityType: 'BATCH',
      entityId: 'b-01',
      action: 'CREATE',
      userId: 'user-A',
      reason: 'Khởi tạo lô',
      timestamp: '2026-09-01T08:00:00.000Z',
    });

    const log2 = await AlcoaAuditManager.createRecord({
      entityType: 'TEST_RESULT',
      entityId: 'tr-01',
      action: 'STATUS_CHANGE',
      userId: 'user-B',
      reason: 'Phê duyệt phiếu kiểm nghiệm',
      previousHash: log1.entryHash,
      timestamp: '2026-09-01T09:00:00.000Z',
    });

    const report = await AlcoaAuditManager.generateInspectionReport(
      [log1, log2],
      'Đoàn Thanh Tra Cục Quản Lý Dược'
    );

    expect(report.inspectorName).toBe('Đoàn Thanh Tra Cục Quản Lý Dược');
    expect(report.totalRecords).toBe(2);
    expect(report.isChainIntact).toBe(true);
    expect(report.violationsCount).toBe(0);
    expect(report.actionsBreakdown['CREATE']).toBe(1);
    expect(report.actionsBreakdown['STATUS_CHANGE']).toBe(1);
    expect(report.usersInvolved).toContain('user-A');
    expect(report.usersInvolved).toContain('user-B');

    // ALCOA+ 9 dimension compliance checks
    expect(report.alcoaComplianceSummary.attributable).toBe(true);
    expect(report.alcoaComplianceSummary.legible).toBe(true);
    expect(report.alcoaComplianceSummary.contemporaneous).toBe(true);
    expect(report.alcoaComplianceSummary.original).toBe(true);
    expect(report.alcoaComplianceSummary.accurate).toBe(true);
    expect(report.alcoaComplianceSummary.complete).toBe(true);
    expect(report.alcoaComplianceSummary.consistent).toBe(true);
    expect(report.alcoaComplianceSummary.enduring).toBe(true);
    expect(report.alcoaComplianceSummary.available).toBe(true);
  });

  it('bản ghi audit trail được đóng băng (Object.freeze) bảo vệ tính bất biến trong bộ nhớ', async () => {
    const record = await AlcoaAuditManager.createRecord({
      entityType: 'BATCH',
      entityId: 'b-01',
      action: 'CREATE',
      userId: 'admin',
      reason: 'Tạo mới',
    });

    expect(Object.isFrozen(record)).toBe(true);
  });
});
