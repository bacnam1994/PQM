/**
 * WORKFLOW KERNEL PHASE 1 CONTRACT & GATE TEST SUITE
 *
 * Kiểm tra toàn diện 12 bước quy chuẩn của UnifiedWorkflowExecutor V2,
 * WorkflowFacade, Guards, Idempotency, OCC, và Awaited Outbox Audit (ALCOA+).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UnifiedWorkflowExecutor,
  WorkflowFacade,
  LegacyServiceAdapter,
  WorkflowActor,
  WorkflowExecutionContext,
  OutboxAuditQueue,
  WorkflowTelemetry,
} from '../../src/workflow/registry';
import * as auditService from '../../src/services/auditService';

vi.mock('../../src/services/auditService', () => ({
  logAuditAction: vi.fn(),
}));

describe('Workflow Kernel Phase 1: Engine & Gate Verification', () => {
  const qaActor: WorkflowActor = {
    id: 'usr_qa_01',
    name: 'Dang Thi QA',
    role: 'QA',
    email: 'qa@v-biotech.vn',
  };

  const adminActor: WorkflowActor = {
    id: 'usr_admin_01',
    name: 'Quản trị viên',
    role: 'ADMIN',
    email: 'admin@v-biotech.vn',
  };

  const labActor: WorkflowActor = {
    id: 'usr_lab_01',
    name: 'Nguyen Van Lab',
    role: 'LAB',
    email: 'lab@v-biotech.vn',
  };

  const guestActor: WorkflowActor = {
    id: 'usr_guest_01',
    name: 'Khach Vang Lai',
    role: 'GUEST',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditService.logAuditAction).mockResolvedValue({ success: true } as any);
    OutboxAuditQueue.clear();
    WorkflowTelemetry.clear();
  });

  describe('Gate 1: Contract Enforcement & Guards', () => {
    it('1.1. Từ chối hành động không tồn tại trong Action Catalog (UNKNOWN_WORKFLOW_ACTION)', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'NON_EXISTENT_CUSTOM_ACTION' as any,
          entityType: 'BATCH',
          entityId: 'batch_001',
          actor: qaActor,
          payload: {},
        },
        async () => ({ success: true })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('UNKNOWN_WORKFLOW_ACTION');
      expect(result.failureReason).toContain('không tồn tại trong Workflow Action Catalog');
    });

    it('1.2. Từ chối khi EntityType không khớp với Action Metadata (ENTITY_TYPE_MISMATCH)', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_CREATE',
          entityType: 'PRODUCT', // BATCH_CREATE yêu cầu BATCH
          entityId: 'prod_001',
          actor: adminActor,
          payload: {},
        },
        async () => ({ success: true })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('ENTITY_TYPE_MISMATCH');
      expect(result.failureReason).toContain('áp dụng cho BATCH, không thể dùng cho PRODUCT');
    });

    it('1.3. Chặn người dùng không có thẩm quyền RBAC (UNAUTHORIZED_ROLE)', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_RELEASE_APPROVE',
          entityType: 'BATCH',
          entityId: 'batch_001',
          actor: labActor, // LAB không được ký xuất xưởng lô
          payload: {},
        },
        async () => ({ success: true })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('UNAUTHORIZED_ROLE');
      expect(result.failureReason).toContain(
        "Vai trò 'LAB' không được phép thực hiện hành động BATCH_RELEASE_APPROVE"
      );
    });

    it('1.4. Bắt buộc lý do giải trình đối với các thao tác nhạy cảm (REASON_REQUIRED)', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_REJECT', // requiresReason: true
          entityType: 'BATCH',
          entityId: 'batch_001',
          actor: qaActor,
          payload: {},
          reason: '', // Rỗng
        },
        async () => ({ success: true })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('REASON_REQUIRED');
      expect(result.failureReason).toContain('bắt buộc phải có lý do giải trình');
    });

    it('1.5. Bắt buộc Chữ ký số 21 CFR Part 11 cho thao tác phê duyệt (SIGNATURE_REQUIRED)', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_RELEASE_APPROVE', // requiresSignature: true
          entityType: 'BATCH',
          entityId: 'batch_001',
          actor: qaActor,
          payload: {},
          signature: null, // Thiếu chữ ký
        },
        async () => ({ success: true })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('SIGNATURE_REQUIRED');
      expect(result.failureReason).toContain('bắt buộc phải có Chữ ký điện tử');
    });

    it('1.6. Chặn thao tác phá hủy nếu thiếu token xác nhận (INVALID_CONFIRMATION_TOKEN)', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'SYSTEM_WIPE_DEMO_EXECUTE',
          entityType: 'SYSTEM',
          entityId: 'sys_root',
          actor: adminActor,
          payload: {},
          reason: 'Làm sạch dữ liệu demo trước thanh tra',
          confirmationToken: 'WRONG-TOKEN',
        },
        async () => ({ wiped: true })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('INVALID_CONFIRMATION_TOKEN');
      expect(result.failureReason).toContain('CONFIRM-WIPE-DEMO-DATA');
    });
  });

  describe('Gate 2: Concurrency & Idempotency', () => {
    it('2.1. Phát hiện xung đột phiên bản Optimistic Concurrency Control (OCC)', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_UPDATE_METADATA',
          entityType: 'BATCH',
          entityId: 'batch_001',
          actor: adminActor,
          expectedVersion: 2,
          payload: { version: 3 }, // Máy chủ đã lên version 3
        },
        async () => ({ updated: true })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('CONCURRENCY_CONFLICT');
      expect(result.failureReason).toContain('Xung đột phiên bản (OCC)');
    });

    it('2.2. Khử trùng lặp Idempotency Key thành công', async () => {
      const idempotencyKey = 'IDEMPOTENT_REQ_001';

      // Lần chạy 1
      const res1 = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'TCCS_CREATE',
          entityType: 'TCCS',
          entityId: 'tccs_001',
          actor: qaActor,
          idempotencyKey,
          payload: {},
        },
        async () => ({ tccsId: 'tccs_001', created: true })
      );
      expect(res1.success).toBe(true);

      // Lần chạy 2 với cùng key
      const res2 = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'TCCS_CREATE',
          entityType: 'TCCS',
          entityId: 'tccs_001',
          actor: qaActor,
          idempotencyKey,
          payload: {},
        },
        async () => {
          throw new Error('Handler không được phép chạy lại!');
        }
      );

      expect(res2.success).toBe(true);
      expect(res2.executionId).toBe(res1.executionId);
    });
  });

  describe('Gate 3: ALCOA+ Fail-Closed Audit Trail', () => {
    it('3.1. Thất bại ghi nhận Audit Trail khiến transaction Fail-Closed', async () => {
      vi.mocked(auditService.logAuditAction).mockRejectedValue(
        new Error('Firebase RTDB permission-denied / network down')
      );

      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_CREATE',
          entityType: 'BATCH',
          entityId: 'batch_002',
          actor: adminActor,
          payload: {},
        },
        async () => ({ batchId: 'batch_002' })
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('AUDIT_LOG_FAILED');
      expect(result.auditStatus).toBe('AUDIT_FAILED');
      expect(result.failureReason).toContain('Nguyên tắc ALCOA+ (Fail-Closed)');
    });

    it('3.2. Thành công ghi nhận Audit Trail đồng bộ khi đường truyền thông suốt', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_CREATE',
          entityType: 'BATCH',
          entityId: 'batch_003',
          actor: adminActor,
          payload: {},
        },
        async () => ({ batchId: 'batch_003' })
      );

      expect(result.success).toBe(true);
      expect(result.auditStatus).toBe('COMMITTED');
      expect(auditService.logAuditAction).toHaveBeenCalled();
    });
  });

  describe('Gate 4: WorkflowFacade & UI Capability Queries', () => {
    it('4.1. WorkflowFacade.dispatch thực thi lệnh trơn tru qua Kernel', async () => {
      const result = await WorkflowFacade.dispatch(
        {
          actionId: 'TEST_RESULT_ENTRY_INPUT',
          entityType: 'TEST_RESULT',
          entityId: 'tr_001',
          actor: labActor,
          payload: {},
        },
        async () => ({ saved: true })
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ saved: true });
    });

    it('4.2. WorkflowFacade.getAllowedActions chỉ trả về hành động mà Actor có quyền', () => {
      // Cho LAB trên BATCH
      const labBatchActions = WorkflowFacade.getAllowedActions('BATCH', labActor);
      expect(labBatchActions.some((a) => a.actionId === 'BATCH_RELEASE_APPROVE')).toBe(false);

      // Cho QA trên BATCH
      const qaBatchActions = WorkflowFacade.getAllowedActions('BATCH', qaActor);
      expect(qaBatchActions.some((a) => a.actionId === 'BATCH_RELEASE_APPROVE')).toBe(true);

      // Cho GUEST
      const guestActions = WorkflowFacade.getAllowedActions('BATCH', guestActor);
      expect(guestActions.length).toBe(0);
    });

    it('4.3. WorkflowFacade.canExecute trả về boolean chính xác', () => {
      expect(WorkflowFacade.canExecute('BATCH_RELEASE_APPROVE', qaActor)).toBe(true);
      expect(WorkflowFacade.canExecute('BATCH_RELEASE_APPROVE', labActor)).toBe(false);
      expect(WorkflowFacade.canExecute('BATCH_DELETE', adminActor)).toBe(true);
      expect(WorkflowFacade.canExecute('BATCH_DELETE', qaActor)).toBe(false);
    });
  });

  describe('Gate 5: LegacyServiceAdapter Compatibility', () => {
    it('5.1. LegacyServiceAdapter bọc và thực thi mutation thành công', async () => {
      const mockResult = { id: 'batch_legacy_01', status: 'PENDING' };

      const data = await LegacyServiceAdapter.executeWithWorkflow(
        'BATCH_CREATE',
        'BATCH',
        mockResult.id,
        { id: 'usr_01', name: 'User Production', role: 'PRODUCTION' },
        async () => mockResult
      );

      expect(data).toEqual(mockResult);
    });

    it('5.2. LegacyServiceAdapter ném exception khi Kernel từ chối', async () => {
      await expect(
        LegacyServiceAdapter.executeWithWorkflow(
          'BATCH_RELEASE_APPROVE',
          'BATCH',
          'batch_01',
          { id: 'usr_01', name: 'User Production', role: 'PRODUCTION' }, // PRODUCTION không được Release
          async () => ({ released: true }),
          { signature: { signerName: 'Unknown', timestamp: '2026-09-25' } }
        )
      ).rejects.toThrow(/Vai trò 'PRODUCTION' không được phép thực hiện/);
    });
  });
});
