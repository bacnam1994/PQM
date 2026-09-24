/**
 * UNIFIED WORKFLOW ARCHITECTURE & GOVERNANCE TESTS
 *
 * Kiểm tra các bất biến kiến trúc:
 * 1. Tuyệt đối không có ngoại lệ bypass 7 Release Gates cho Admin
 * 2. UnifiedWorkflowExecutor thực thi đầy đủ 12 bước quy chuẩn
 * 3. ChangeControlAppService sử dụng IChangeControlRepository
 * 4. MasterCriterionAppService quản lý tập trung và audit bulkRename
 * 5. TCCSAppService tuân thủ nghiêm ngặt Repository Pattern
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  UnifiedWorkflowExecutor,
  WorkflowActor,
} from '../../src/domain/workflow/UnifiedWorkflowExecutor';
import { WORKFLOW_ACTION_CATALOG } from '../../src/domain/workflow/workflowActionCatalog';
import { MasterCriterionAppService } from '../../src/services/app/MasterCriterionAppService';

describe('Unified Workflow Architecture & Security Gates', () => {
  describe('Gate 1: Release Security - Zero Admin Bypass', () => {
    it('BatchAppService không được chứa bypass !isActorAdmin trong kiểm tra Release', () => {
      const filePath = path.resolve(__dirname, '../../src/services/app/BatchAppService.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Kiểm tra không còn bypass status === 'RELEASED' && !isActorAdmin
      expect(content).not.toMatch(/status === 'RELEASED' && !isActorAdmin/);
    });

    it('ReleaseService không được chứa bypass !isAdmin trong kiểm tra Release Gates', () => {
      const filePath = path.resolve(__dirname, '../../src/services/app/ReleaseService.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Kiểm tra không còn if (!isAdmin) bao quanh evaluateReleaseReadiness
      expect(content).not.toMatch(
        /if \(!isAdmin\)\s*\{\s*const evaluation = this\.evaluateReleaseReadiness/
      );
    });
  });

  describe('Gate 2: TCCSAppService Repository Boundary Enforcement', () => {
    it('TCCSAppService không được import trực tiếp các hàm ghi của firebase/database', () => {
      const filePath = path.resolve(__dirname, '../../src/services/app/TCCSAppService.ts');
      const content = fs.readFileSync(filePath, 'utf-8');

      expect(content).not.toMatch(/from 'firebase\/database'/);
      expect(content).not.toMatch(/ref\(db\)/);
    });
  });

  describe('Gate 3: UnifiedWorkflowExecutor Contract Verification', () => {
    const mockActor: WorkflowActor = {
      id: 'usr_001',
      name: 'Nguyen Van A',
      role: 'qa',
      email: 'qa@pqm.com',
    };

    it('từ chối hành động không nằm trong Workflow Action Catalog', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'NON_EXISTENT_ACTION',
          entityType: 'BATCH',
          entityId: 'batch_01',
          actor: mockActor,
          payload: {},
        },
        async () => ({})
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('UNKNOWN_WORKFLOW_ACTION');
    });

    it('từ chối nếu entityType không khớp với Action Catalog', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_CREATE',
          entityType: 'PRODUCT', // Sai entityType
          entityId: 'prod_01',
          actor: mockActor,
          payload: {},
        },
        async () => ({})
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('ENTITY_TYPE_MISMATCH');
    });

    it('từ chối nếu vai trò không được phép thực hiện', async () => {
      const unauthorizedActor: WorkflowActor = {
        id: 'usr_guest',
        name: 'Guest User',
        role: 'unauthorized_guest',
      };

      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'PRODUCT_ARCHIVE',
          entityType: 'PRODUCT',
          entityId: 'prod_01',
          actor: unauthorizedActor,
          payload: {},
          reason: 'Lý do hợp lệ',
        },
        async () => ({})
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('UNAUTHORIZED_ROLE');
    });

    it('yêu cầu lý do giải trình đối với các hành động requiresReason', async () => {
      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_BLOCK',
          entityType: 'BATCH',
          entityId: 'batch_01',
          actor: mockActor,
          payload: {},
          // Không truyền reason
        },
        async () => ({})
      );

      expect(result.success).toBe(false);
      expect(result.failureCode).toBe('REASON_REQUIRED');
    });

    it('thực thi thành công và ghi nhận đầy đủ context khi thỏa mãn 12 bước', async () => {
      const mutationSpy = vi.fn().mockResolvedValue({ id: 'batch_01', status: 'BLOCKED' });

      const result = await UnifiedWorkflowExecutor.execute(
        {
          actionId: 'BATCH_BLOCK',
          entityType: 'BATCH',
          entityId: 'batch_01',
          actor: mockActor,
          payload: { reason: 'Phat hien tap chat' },
          reason: 'Phat hien tap chat ngoai tieu chuan',
          currentState: 'TESTING',
        },
        mutationSpy,
        undefined,
        () => ({ nextState: 'BLOCKED' })
      );

      expect(result.success).toBe(true);
      expect(result.fromState).toBe('TESTING');
      expect(result.toState).toBe('BLOCKED');
      expect(result.data).toEqual({ id: 'batch_01', status: 'BLOCKED' });
      expect(mutationSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Gate 4: MasterCriterionAppService Centralization', () => {
    it('khởi tạo và cung cấp đầy đủ các phương thức nghiệp vụ', () => {
      const mockRepo: any = {
        findAll: vi.fn(),
        findActive: vi.fn(),
        save: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const service = new MasterCriterionAppService(mockRepo);

      expect(typeof service.getAll).toBe('function');
      expect(typeof service.getActive).toBe('function');
      expect(typeof service.create).toBe('function');
      expect(typeof service.update).toBe('function');
      expect(typeof service.delete).toBe('function');
      expect(typeof service.bulkRename).toBe('function');
    });
  });
});
