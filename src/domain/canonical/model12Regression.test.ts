import { describe, it, expect, beforeEach } from 'vitest';
import { ObservabilityManager } from '../observability/observabilityModel';

describe('Model 12: Observability & Diagnostics Model Regression Suite', () => {
  beforeEach(() => {
    ObservabilityManager.clearLogs();
  });

  // ===========================================================
  // 1. executeWithDiagnostics — Lifecycle
  // ===========================================================
  describe('executeWithDiagnostics — Bọc đo lường và ghi nhận chẩn đoán', () => {
    it('thực thi thành công và ghi nhận diagnostics đầy đủ', async () => {
      const { result, diagnostics } = await ObservabilityManager.executeWithDiagnostics(
        'EVALUATE_BATCH_QUALITY',
        {
          entityType: 'BATCH',
          entityId: 'batch-001',
          resolver: 'CanonicalStatusResolver',
          tags: ['QUALITY', 'AUTO'],
        },
        () => ({ status: 'PASS', score: 100 })
      );

      expect(result.status).toBe('PASS');
      expect(diagnostics.correlationId).toBeDefined();
      expect(diagnostics.operationId).toBeDefined();
      expect(diagnostics.operationName).toBe('EVALUATE_BATCH_QUALITY');
      expect(diagnostics.entityType).toBe('BATCH');
      expect(diagnostics.entityId).toBe('batch-001');
      expect(diagnostics.durationMs).toBeGreaterThanOrEqual(0);
      expect(['SUCCESS', 'WARNING']).toContain(diagnostics.result);
      expect(diagnostics.tags).toContain('QUALITY');
    });

    it('ghi nhận FAILURE khi hàm ném ra ngoại lệ', async () => {
      await expect(
        ObservabilityManager.executeWithDiagnostics(
          'RESOLVE_TEST_RESULT_STATUS',
          { entityType: 'TEST_RESULT', entityId: 'tr-99' },
          () => {
            throw new Error('Đánh giá thất bại: Không tìm thấy TCCS');
          }
        )
      ).rejects.toThrow('Không tìm thấy TCCS');

      const recent = ObservabilityManager.getRecentDiagnostics(1);
      expect(recent[0].result).toBe('FAILURE');
      expect(recent[0].error).toContain('Không tìm thấy TCCS');
    });

    it('truyền correlationId tùy chỉnh xuyên suốt nhiều operations trong cùng một luồng', async () => {
      const sharedCorrelationId = 'CORR-BATCH-RELEASE-2026';

      await ObservabilityManager.executeWithDiagnostics(
        'VALIDATE_RELEASE_PREREQUISITES',
        { entityType: 'BATCH', entityId: 'b-01', correlationId: sharedCorrelationId },
        () => ({ valid: true })
      );

      await ObservabilityManager.executeWithDiagnostics(
        'GENERATE_COA_REPORT',
        { entityType: 'BATCH', entityId: 'b-01', correlationId: sharedCorrelationId },
        () => ({ pdfUrl: '/reports/coa-b01.pdf' })
      );

      const filteredLogs = ObservabilityManager.filterDiagnostics({
        correlationId: sharedCorrelationId,
      });
      expect(filteredLogs).toHaveLength(2);
      expect(filteredLogs.every((l) => l.correlationId === sharedCorrelationId)).toBe(true);
    });
  });

  // ===========================================================
  // 2. Filtering — filterDiagnostics
  // ===========================================================
  describe('filterDiagnostics — Lọc logs đa chiều', () => {
    it('lọc chính xác theo entityType', async () => {
      await ObservabilityManager.executeWithDiagnostics(
        'BATCH_OP',
        { entityType: 'BATCH' },
        () => 'ok'
      );
      await ObservabilityManager.executeWithDiagnostics(
        'TEST_RESULT_OP',
        { entityType: 'TEST_RESULT' },
        () => 'ok'
      );

      const batchLogs = ObservabilityManager.filterDiagnostics({ entityType: 'BATCH' });
      expect(batchLogs).toHaveLength(1);
      expect(batchLogs[0].operationName).toBe('BATCH_OP');
    });

    it('lọc theo kết quả FAILURE', async () => {
      await ObservabilityManager.executeWithDiagnostics('OP_OK', {}, () => 'ok');

      try {
        await ObservabilityManager.executeWithDiagnostics('OP_FAIL', {}, () => {
          throw new Error('fail');
        });
      } catch {
        /* expected */
      }

      const failLogs = ObservabilityManager.filterDiagnostics({ result: 'FAILURE' });
      expect(failLogs).toHaveLength(1);
      expect(failLogs[0].operationName).toBe('OP_FAIL');
    });

    it('lọc theo tag', async () => {
      await ObservabilityManager.executeWithDiagnostics(
        'TAGGED_OP',
        { tags: ['REGULATED', 'GMP'] },
        () => 'ok'
      );
      await ObservabilityManager.executeWithDiagnostics('UNTAGGED_OP', { tags: [] }, () => 'ok');

      const regulatedLogs = ObservabilityManager.filterDiagnostics({ tag: 'REGULATED' });
      expect(regulatedLogs).toHaveLength(1);
      expect(regulatedLogs[0].operationName).toBe('TAGGED_OP');
    });
  });

  // ===========================================================
  // 3. generateHealthSnapshot — System Health Report
  // ===========================================================
  describe('generateHealthSnapshot — Báo cáo sức khỏe hệ thống', () => {
    it('tổng hợp đúng số liệu thống kê success/failure/warning', async () => {
      // 2 thành công
      await ObservabilityManager.executeWithDiagnostics('OP_1', {}, () => 'ok');
      await ObservabilityManager.executeWithDiagnostics('OP_2', {}, () => 'ok');

      // 1 thất bại
      try {
        await ObservabilityManager.executeWithDiagnostics('OP_3', {}, () => {
          throw new Error('err');
        });
      } catch {
        /* expected */
      }

      const snapshot = ObservabilityManager.generateHealthSnapshot();
      expect(snapshot.totalOperations).toBe(3);
      expect(snapshot.successCount).toBe(2);
      expect(snapshot.failureCount).toBe(1);
      expect(snapshot.errorRate).toBeCloseTo(1 / 3, 2);
    });

    it('đánh dấu isHealthy = false khi tỷ lệ lỗi >= 5%', async () => {
      // Tạo 100 thao tác với 10 lỗi (10% error rate)
      for (let i = 0; i < 90; i++) {
        await ObservabilityManager.executeWithDiagnostics(`OP_OK_${i}`, {}, () => 'ok');
      }
      for (let i = 0; i < 10; i++) {
        try {
          await ObservabilityManager.executeWithDiagnostics(`OP_FAIL_${i}`, {}, () => {
            throw new Error('fail');
          });
        } catch {
          /* expected */
        }
      }

      const snapshot = ObservabilityManager.generateHealthSnapshot();
      expect(snapshot.totalOperations).toBe(100);
      expect(snapshot.failureCount).toBe(10);
      expect(snapshot.isHealthy).toBe(false);
    });

    it('tạo domain breakdown chính xác theo entityType', async () => {
      await ObservabilityManager.executeWithDiagnostics(
        'BATCH_OP',
        { entityType: 'BATCH' },
        () => 'ok'
      );
      await ObservabilityManager.executeWithDiagnostics(
        'BATCH_OP2',
        { entityType: 'BATCH' },
        () => 'ok'
      );
      await ObservabilityManager.executeWithDiagnostics(
        'TR_OP',
        { entityType: 'TEST_RESULT' },
        () => 'ok'
      );

      const snapshot = ObservabilityManager.generateHealthSnapshot();
      expect(snapshot.domainBreakdown['BATCH'].count).toBe(2);
      expect(snapshot.domainBreakdown['TEST_RESULT'].count).toBe(1);
    });

    it('lọc snapshot theo correlationId trả về đúng subset', async () => {
      const corrId = 'CORR-ISOLATED-TEST';

      await ObservabilityManager.executeWithDiagnostics(
        'ISOLATED_OP',
        { correlationId: corrId },
        () => 'ok'
      );
      await ObservabilityManager.executeWithDiagnostics(
        'OTHER_OP',
        { correlationId: 'OTHER-CORR' },
        () => 'ok'
      );

      const snapshot = ObservabilityManager.generateHealthSnapshot(corrId);
      expect(snapshot.totalOperations).toBe(1);
      expect(snapshot.correlationId).toBe(corrId);
    });
  });

  // ===========================================================
  // 4. Circular Buffer & Memory Management
  // ===========================================================
  describe('Quản lý bộ nhớ đệm', () => {
    it('clearLogs xóa sạch toàn bộ logs trong bộ nhớ', async () => {
      await ObservabilityManager.executeWithDiagnostics('OP', {}, () => 'ok');
      expect(ObservabilityManager.getTotalLogCount()).toBeGreaterThan(0);

      ObservabilityManager.clearLogs();
      expect(ObservabilityManager.getTotalLogCount()).toBe(0);
    });

    it('getRecentDiagnostics giới hạn đúng số lượng kết quả', async () => {
      for (let i = 0; i < 10; i++) {
        await ObservabilityManager.executeWithDiagnostics(`OP_${i}`, {}, () => i);
      }

      const recent3 = ObservabilityManager.getRecentDiagnostics(3);
      expect(recent3).toHaveLength(3);
    });
  });
});
