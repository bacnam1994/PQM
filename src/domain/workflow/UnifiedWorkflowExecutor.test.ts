import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnifiedWorkflowExecutor, WorkflowExecutionContext } from './UnifiedWorkflowExecutor';
import * as auditService from '../../services/auditService';

vi.mock('../../services/auditService', () => ({
  logAuditAction: vi.fn(),
}));

describe('UnifiedWorkflowExecutor — Integrity & Negative-Path Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auditService.logAuditAction).mockResolvedValue();
  });

  it('1. UNKNOWN_WORKFLOW_ACTION: Từ chối hành động không nằm trong Workflow Action Catalog', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'NON_EXISTENT_ACTION',
      entityType: 'BATCH',
      entityId: 'b-001',
      actor: { id: 'u-1', name: 'User 1', role: 'admin' },
      payload: {},
    };

    const result = await UnifiedWorkflowExecutor.execute(context, async () => ({ id: 'b-001' }));

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('UNKNOWN_WORKFLOW_ACTION');
    expect(result.failureReason).toContain('không tồn tại trong Workflow Action Catalog');
  });

  it('2. ENTITY_TYPE_MISMATCH: Từ chối khi EntityType không khớp với Action Metadata', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'BATCH_CREATE',
      entityType: 'PRODUCT', // BATCH_CREATE expects BATCH
      entityId: 'prod-001',
      actor: { id: 'u-1', name: 'Admin', role: 'admin' },
      payload: {},
    };

    const result = await UnifiedWorkflowExecutor.execute(context, async () => ({ id: 'prod-001' }));

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('ENTITY_TYPE_MISMATCH');
    expect(result.failureReason).toContain('áp dụng cho BATCH, không thể dùng cho PRODUCT');
  });

  it('3. UNAUTHORIZED_ROLE: Từ chối khi vai trò không có thẩm quyền thực hiện Action', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'BATCH_RELEASE', // Allowed roles: admin, manager, qa_manager
      entityType: 'BATCH',
      entityId: 'b-001',
      actor: { id: 'u-op', name: 'Operator', role: 'operator' },
      payload: {},
      reason: 'Release batch',
    };

    const result = await UnifiedWorkflowExecutor.execute(context, async () => ({ id: 'b-001' }));

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('UNAUTHORIZED_ROLE');
    expect(result.failureReason).toContain(
      "Vai trò 'operator' không được phép thực hiện hành động BATCH_RELEASE"
    );
  });

  it('4. REASON_REQUIRED: Bắt buộc giải trình lý do đối với Action nhạy cảm', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'BATCH_BLOCK', // requiresReason: true
      entityType: 'BATCH',
      entityId: 'b-001',
      actor: { id: 'u-qa', name: 'QA Manager', role: 'qa_manager' },
      payload: {},
      reason: '', // Thiếu reason
    };

    const result = await UnifiedWorkflowExecutor.execute(context, async () => ({ id: 'b-001' }));

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('REASON_REQUIRED');
    expect(result.failureReason).toContain('bắt buộc phải có lý do giải trình');
  });

  it('5. INVALID_STATE_TRANSITION: Từ chối chuyển đổi trạng thái FSM không hợp lệ', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'BATCH_RELEASE',
      entityType: 'BATCH',
      entityId: 'b-001',
      actor: { id: 'u-qa', name: 'QA Manager', role: 'qa_manager' },
      payload: {},
      reason: 'Đạt chuẩn',
      currentState: 'PENDING',
    };

    const transitionResolver = () => {
      throw new Error('Không thể nhảy cóc từ PENDING sang RELEASED theo quy chuẩn GMP');
    };

    const result = await UnifiedWorkflowExecutor.execute(
      context,
      async () => ({ id: 'b-001' }),
      undefined,
      transitionResolver
    );

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('INVALID_STATE_TRANSITION');
    expect(result.failureReason).toContain('Không thể nhảy cóc từ PENDING sang RELEASED');
  });

  it('6. DOMAIN_RULE_VIOLATION: Từ chối khi vi phạm Domain Precondition / Release Gates', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'BATCH_RELEASE',
      entityType: 'BATCH',
      entityId: 'b-001',
      actor: { id: 'u-qa', name: 'QA Manager', role: 'qa_manager' },
      payload: {},
      reason: 'Xuất xưởng',
      currentState: 'IN_TESTING',
    };

    const domainValidator = async () => ({
      valid: false,
      code: 'GATE_EVALUATION_FAILED',
      error: 'Còn 2 chỉ tiêu vi sinh chưa hoàn tất kiểm nghiệm',
    });

    const result = await UnifiedWorkflowExecutor.execute(
      context,
      async () => ({ id: 'b-001' }),
      domainValidator,
      () => ({ nextState: 'RELEASED' })
    );

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('GATE_EVALUATION_FAILED');
    expect(result.failureReason).toContain('Còn 2 chỉ tiêu vi sinh chưa hoàn tất');
  });

  it('7. MUTATION_FAILED: Báo cáo thất bại khi mutation dữ liệu gặp lỗi ngoại lệ', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'PRODUCT_CREATE',
      entityType: 'PRODUCT',
      entityId: 'prod-new',
      actor: { id: 'u-admin', name: 'Admin', role: 'admin' },
      payload: { name: 'Sản phẩm mới' },
    };

    const mutationHandler = async () => {
      throw new Error('Database connection timeout on write');
    };

    const result = await UnifiedWorkflowExecutor.execute(context, mutationHandler);

    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('MUTATION_FAILED');
    expect(result.failureReason).toContain('Database connection timeout');
  });

  it('8. AUDIT_LOG_FAILED (ALCOA+ FAIL-CLOSED): Thất bại audit làm transaction fail-closed, không trả success: true', async () => {
    vi.mocked(auditService.logAuditAction).mockRejectedValue(
      new Error('Firebase audit_logs permission-denied / network error')
    );

    const context: WorkflowExecutionContext = {
      actionId: 'PRODUCT_UPDATE', // requiresAudit: true, requiresReason: true
      entityType: 'PRODUCT',
      entityId: 'prod-001',
      actor: { id: 'u-admin', name: 'Admin', role: 'admin', email: 'admin@vbiotech.com' },
      payload: { name: 'Tên cập nhật' },
      reason: 'Chuẩn hóa danh mục theo quy định mới',
    };

    const mutationHandler = async () => ({ id: 'prod-001', name: 'Tên cập nhật' });

    const result = await UnifiedWorkflowExecutor.execute(context, mutationHandler);

    // Fail-Closed verification: Không được trả success: true khi audit thất bại
    expect(result.success).toBe(false);
    expect(result.failureCode).toBe('AUDIT_LOG_FAILED');
    expect(result.auditStatus).toBe('AUDIT_FAILED');
    expect(result.failureReason).toContain('Theo nguyên tắc ALCOA+ và FDA 21 CFR Part 11');
    expect(result.auditError).toContain('Firebase audit_logs permission-denied');
    // Mutation data được lưu giữ trong result để phục vụ truy vết / bồi hoàn
    expect(result.data).toEqual({ id: 'prod-001', name: 'Tên cập nhật' });
  });

  it('9. SUCCESS_PATH: Thực thi thành công đầy đủ quy trình và ghi nhận audit COMMITTED', async () => {
    const context: WorkflowExecutionContext = {
      actionId: 'PRODUCT_UPDATE',
      entityType: 'PRODUCT',
      entityId: 'prod-001',
      actor: { id: 'u-lead', name: 'QA Lead', role: 'lead', email: 'lead@vbiotech.com' },
      payload: { name: 'Tên cập nhật hợp lệ' },
      reason: 'Cập nhật định dạng tên theo TCCS',
    };

    const mutationHandler = async () => ({ id: 'prod-001', updated: true });

    const result = await UnifiedWorkflowExecutor.execute(context, mutationHandler);

    expect(result.success).toBe(true);
    expect(result.auditStatus).toBe('COMMITTED');
    expect(result.data).toEqual({ id: 'prod-001', updated: true });
    expect(auditService.logAuditAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        collection: 'PRODUCTS',
        documentId: 'prod-001',
        performedBy: 'lead@vbiotech.com',
      }),
      { throwOnError: true }
    );
  });
});
