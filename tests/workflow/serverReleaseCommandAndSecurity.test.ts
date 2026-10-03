/**
 * tests/workflow/serverReleaseCommandAndSecurity.test.ts
 * ========================================================
 * Comprehensive Test Suite for Server-Side Release Command & Security Hardening
 *
 * Kiểm chứng toàn diện:
 * 1. P0-1: Client cấm trực tiếp ghi status=RELEASED (Security Rules & Validator)
 * 2. P0-2 & P0-3: Server Release Command kiểm soát thẩm quyền & Fresh DB Read
 * 3. P0-4: Gate 1→7 Fail-Closed (tất cả 7 cổng phải PASS)
 * 4. P0-5: Canonical Gate 7 & Thẩm tra Chữ ký điện tử 21 CFR Part 11
 * 5. P0-6 & P1-1: Atomic Release Transaction & Signature Lifecycle (CONSUMED)
 * 6. P0-7: Idempotency Key an toàn tuyệt đối
 * 7. P1-8: Deprecate updateStatus(..., 'RELEASED')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityRulesValidator } from '../../src/services/securityRulesValidator';
import { handleApproveBatchRelease } from '../../functions/src/batchReleaseFunction';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { BatchAppService } from '../../src/domains/batch/application/service';
import { ElectronicSignature } from '../../src/types/signature';
import { Batch, TestResult } from '../../src/types';

describe('Server-Side Release Command & Security Rules Verification (Phase 1 to 5)', () => {
  const qaUser = {
    uid: 'qa-user-01',
    email: 'qa@v-biotech.vn',
    role: 'QA' as const,
    isAdmin: false,
  };

  const adminUser = {
    uid: 'admin-user-01',
    email: 'admin@v-biotech.vn',
    role: 'ADMIN' as const,
    isAdmin: true,
  };

  const prodUser = {
    uid: 'prod-user-01',
    email: 'prod@v-biotech.vn',
    role: 'PRODUCTION' as const,
    isAdmin: false,
  };

  describe('1. P0-1 Security Rule: Direct Client Write of RELEASED is Blocked', () => {
    it('chặn hoàn toàn client (kể cả QA hoặc ADMIN) tự ghi status=RELEASED trực tiếp qua client SDK', () => {
      // 1. QA cố tình update status sang RELEASED
      const qaResult = SecurityRulesValidator.evaluate(qaUser, 'UPDATE', 'batches/b_001', {
        status: 'RELEASED',
      });
      expect(qaResult.allowed).toBe(false);
      expect(qaResult.reason).toContain('Client bị cấm ghi trực tiếp status=RELEASED');

      // 2. ADMIN cố tình update status sang RELEASED
      const adminResult = SecurityRulesValidator.evaluate(adminUser, 'UPDATE', 'batches/b_001', {
        status: 'RELEASED',
      });
      expect(adminResult.allowed).toBe(false);
      expect(adminResult.reason).toContain('Client bị cấm ghi trực tiếp status=RELEASED');

      // 3. User Sản xuất cố tình update sang RELEASED -> Bị chặn do thiếu thẩm quyền
      const prodResult = SecurityRulesValidator.evaluate(prodUser, 'UPDATE', 'batches/b_001', {
        status: 'RELEASED',
      });
      expect(prodResult.allowed).toBe(false);
      expect(prodResult.reason).toContain('Chỉ QA mới có thẩm quyền');
    });

    it('P1-8: BatchAppService.updateStatus từ chối cuộc gọi trực tiếp với status=RELEASED', async () => {
      const mockRepo: any = {
        findById: vi.fn().mockResolvedValue({ id: 'b_001', status: 'TESTING', version: 1 }),
      };
      const service = new BatchAppService(mockRepo);

      await expect(service.updateStatus('b_001', 'RELEASED', qaUser)).rejects.toThrow(
        'Deprecated API Violation (P1-8)'
      );
    });
  });

  describe('2. P0-2 & P0-3 & P0-4: Server-Side Release Command Gate 1→7 Verification', () => {
    let mockDbData: Record<string, any>;
    let mockDb: any;

    beforeEach(() => {
      mockDbData = {};

      mockDb = {
        ref: (path: string) => {
          return {
            once: vi.fn().mockImplementation(async () => {
              const val = mockDbData[path];
              return {
                exists: () => val !== undefined && val !== null,
                val: () => val,
              };
            }),
            orderByChild: (childKey: string) => ({
              equalTo: (expectedVal: any) => ({
                once: vi.fn().mockImplementation(async () => {
                  const collection = mockDbData[path] || {};
                  const filtered: Record<string, any> = {};
                  for (const [k, v] of Object.entries(collection)) {
                    if ((v as any)[childKey] === expectedVal) {
                      filtered[k] = v;
                    }
                  }
                  return {
                    exists: () => Object.keys(filtered).length > 0,
                    val: () => filtered,
                  };
                }),
              }),
            }),
            transaction: vi.fn().mockImplementation(async (updateFn: any) => {
              const current = mockDbData[path];
              const updated = updateFn(JSON.parse(JSON.stringify(current)));
              if (updated !== undefined) {
                mockDbData[path] = updated;
                return { committed: true, snapshot: { val: () => updated } };
              }
              return { committed: false };
            }),
            update: vi.fn().mockImplementation(async (updates: any) => {
              mockDbData[path] = { ...mockDbData[path], ...updates };
            }),
            push: vi.fn().mockImplementation(async (logEntry: any) => {
              const id = `log_${Date.now()}`;
              mockDbData[`${path}/${id}`] = logEntry;
              return { key: id };
            }),
          };
        },
      };
    });

    const createValidSignature = (batchId: string, version: number = 1): ElectronicSignature => ({
      id: 'sig_valid_001',
      documentType: 'BATCH_RELEASE',
      documentId: batchId,
      documentVersion: version,
      signerUid: qaUser.uid,
      signerName: 'Nguyễn QA',
      signerEmail: qaUser.email,
      role: 'QA',
      meaning: 'Tôi xác nhận xuất xưởng Lô',
      signedAt: new Date().toISOString(),
      checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      status: 'CREATED',
    });

    it('từ chối khi người gọi chưa xác thực hoặc không có quyền QA/Admin (P0-3)', async () => {
      const unauthRequest: any = {
        auth: null,
        data: { batchId: 'b_001', signatureId: 'sig_001' },
      };

      await expect(handleApproveBatchRelease(unauthRequest, mockDb)).rejects.toThrow(
        'Yêu cầu đăng nhập'
      );

      const nonQaRequest: any = {
        auth: { uid: prodUser.uid, token: { role: 'PRODUCTION' } },
        data: { batchId: 'b_001', signatureId: 'sig_001' },
      };

      await expect(handleApproveBatchRelease(nonQaRequest, mockDb)).rejects.toThrow(
        'Chỉ nhân sự có vai trò QA hoặc ADMIN'
      );
    });

    it('từ chối khi Lô ở trạng thái PENDING chưa đưa vào kiểm nghiệm', async () => {
      mockDbData['batches/b_pending'] = {
        id: 'b_pending',
        batchNo: 'L26001',
        status: 'PENDING',
        version: 1,
      };

      const request: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_pending', signatureId: 'sig_001' },
      };

      await expect(handleApproveBatchRelease(request, mockDb)).rejects.toThrow(
        'Lô sản xuất đang ở trạng thái PENDING'
      );
    });

    it('từ chối khi chữ ký sai documentId, sai version hoặc sai loại tài liệu (P0-5 Gate 7)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 2,
        bprReviewStatus: 'APPROVED',
      };

      // 1. Chữ ký sai documentId
      const badDocIdSig = {
        ...createValidSignature('b_OTHER', 2),
      };
      mockDbData['electronic_signatures/sig_bad_doc'] = badDocIdSig;

      const req1: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_bad_doc' },
      };
      await expect(handleApproveBatchRelease(req1, mockDb)).rejects.toThrow(
        'ERR_SIGNATURE_INVALID'
      );

      // 2. Chữ ký sai documentVersion
      const badVerSig = {
        ...createValidSignature('b_001', 1), // Lô hiện tại v2
      };
      mockDbData['electronic_signatures/sig_bad_ver'] = badVerSig;

      const req2: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_bad_ver' },
      };
      await expect(handleApproveBatchRelease(req2, mockDb)).rejects.toThrow(
        'ERR_SIGNATURE_VERSION_MISMATCH'
      );
    });

    it('từ chối khi thiếu phiếu kiểm nghiệm (Gate 1 FAIL) hoặc kết quả kiểm nghiệm FAIL (Gate 2 FAIL)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['electronic_signatures/sig_valid_001'] = createValidSignature('b_001', 1);

      // Chưa có test results trong DB -> Gate 1 FAIL
      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_valid_001' },
      };
      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow(
        'ERR_TEST_RESULTS_MISSING'
      );

      // Thêm phiếu kiểm nghiệm FAIL -> Gate 2 FAIL
      mockDbData['testResults'] = {
        tr_001: {
          id: 'tr_001',
          batchId: 'b_001',
          overallStatus: 'FAIL',
          qualityStatus: 'FAIL',
        },
      };
      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow(
        'ERR_QUALITY_NOT_PASSED'
      );
    });

    it('từ chối khi BPR chưa được QA phê duyệt (Gate 6 FAIL)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'UNDER_REVIEW', // Chưa APPROVED
      };
      mockDbData['electronic_signatures/sig_valid_001'] = createValidSignature('b_001', 1);
      mockDbData['testResults'] = {
        tr_001: {
          id: 'tr_001',
          batchId: 'b_001',
          overallStatus: 'PASS',
          qualityStatus: 'PASS',
        },
      };

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_valid_001' },
      };
      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow('ERR_BPR_NOT_APPROVED');
    });

    it('xuất xưởng thành công khi thỏa mãn 7/7 Gates: Atomic Transaction, Signature CONSUMED và Idempotent (P0-6 & P0-7 & P1-1)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
        bprReviewedBy: qaUser.email,
        bprReviewedAt: new Date().toISOString(),
      };
      mockDbData['electronic_signatures/sig_valid_001'] = createValidSignature('b_001', 1);
      mockDbData['testResults'] = {
        tr_001: {
          id: 'tr_001',
          batchId: 'b_001',
          overallStatus: 'PASS',
          qualityStatus: 'PASS',
        },
      };

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA', email: qaUser.email } },
        data: {
          batchId: 'b_001',
          signatureId: 'sig_valid_001',
          expectedVersion: 1,
        },
      };

      const result = await handleApproveBatchRelease(req, mockDb);
      expect(result.success).toBe(true);
      expect(result.status).toBe('RELEASED');
      expect(result.releaseStage).toBe('RELEASED');
      expect(result.releaseGateProgress.completed).toBe(7);
      expect(result.version).toBe(2);

      // Kiểm tra DB batch đã chuyển sang RELEASED
      const releasedBatch = mockDbData['batches/b_001'];
      expect(releasedBatch.status).toBe('RELEASED');
      expect(releasedBatch.releaseStage).toBe('RELEASED');
      expect(releasedBatch.version).toBe(2);
      expect(releasedBatch.releaseGateProgress.completed).toBe(7);
      expect(releasedBatch.releaseSignatureId).toBe('sig_valid_001');

      // P1-1: Kiểm tra chữ ký được đổi sang trạng thái CONSUMED
      const updatedSig = mockDbData['electronic_signatures/sig_valid_001'];
      expect(updatedSig.status).toBe('CONSUMED');
      expect(updatedSig.consumedAt).toBeDefined();

      // P0-7: Gọi lại lần 2 (Idempotency replay) -> Trả về kết quả thành công mà không release lặp lại
      const replayResult = await handleApproveBatchRelease(req, mockDb);
      expect(replayResult.success).toBe(true);
      expect(replayResult.isIdempotent).toBe(true);
      expect(replayResult.status).toBe('RELEASED');
      expect(mockDbData['batches/b_001'].version).toBe(2); // Version không bị tăng thêm
    });
  });
});
