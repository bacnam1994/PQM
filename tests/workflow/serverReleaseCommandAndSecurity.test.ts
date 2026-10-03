/**
 * tests/workflow/serverReleaseCommandAndSecurity.test.ts
 * ========================================================
 * Comprehensive Adversarial Test Suite for Server-Side Release Command & Security Hardening
 *
 * Kiểm chứng toàn diện:
 * 1. P0-1: Client cấm trực tiếp ghi status=RELEASED (Security Rules & database.rules.json root .write check)
 * 2. P0-2: Single Release Path: Xóa sạch client release mutation (executeBatchAction & batchRepository)
 * 3. P0-3: Server SSoT: Gate 1-6 dùng chung Canonical Release Engine (missing criteria, OOS variants, CAPA, BPR)
 * 4. P0-4 & P0-5: Signature Integrity: Checksum 64-hex giả BỊ CHẶN, SHA-256 thật, role giả mạo, signerUid lệch
 * 5. P0-6: Signature Lifecycle: status=CONSUMED không được phép tái sử dụng
 * 6. P0-7: Atomic Multi-Location Transaction & Idempotency Key persistence (release_commands/{key})
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityRulesValidator } from '../../src/services/securityRulesValidator';
import { handleApproveBatchRelease } from '../../functions/src/batchReleaseFunction';
import { computeSignatureSha256 } from '../../functions/src/canonicalReleaseEngine';
import { BatchWorkflowHandlers } from '../../src/workflow/handlers/batchWorkflowHandlers';
import { BatchAppService } from '../../src/domains/batch/application/service';
import { FirebaseBatchRepository } from '../../src/repositories/firebase/FirebaseBatchRepository';
import { ElectronicSignature } from '../../src/types/signature';
import { Batch, TestResult } from '../../src/types';

describe('Server-Side Release Command & Security Rules Verification (Comprehensive Hardening)', () => {
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

  describe('1. P0-1: Firebase RTDB Rules & Client Guard: Direct Write of RELEASED is Blocked', () => {
    it('database.rules.json tuyệt đối không chứa root .write (tránh ADMIN bypass quyền node con)', () => {
      const rulesPath = path.resolve(__dirname, '../../database.rules.json');
      const rulesContent = fs.readFileSync(rulesPath, 'utf8');
      const rulesJson = JSON.parse(rulesContent);

      // Root rules không được có thuộc tính .write
      expect(rulesJson.rules['.write']).toBeUndefined();

      // Node batches/$item_id phải có điều kiện cấm ghi RELEASED
      const batchWriteRule = rulesJson.rules.batches['$item_id']['.write'];
      expect(batchWriteRule).toContain("newData.child('status').val() !== 'RELEASED'");

      // Node release_commands phải có write: false (chỉ Cloud Functions Admin SDK được ghi)
      expect(rulesJson.rules.release_commands['.write']).toBe(false);
    });

    it('chặn hoàn toàn client (kể cả QA hoặc ADMIN) tự ghi status=RELEASED trực tiếp qua SecurityRulesValidator', () => {
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

      // 3. User Sản xuất cố tình update sang RELEASED -> Bị chặn
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

  describe('2. P0-2: Single Release Path: Client Mutation Paths Are Completely Blocked', () => {
    it('executeBatchAction(BATCH_RELEASE_APPROVE) bị cấm gọi trực tiếp từ client (throw ERR_CLIENT_RELEASE_PROHIBITED)', async () => {
      const mockRepo: any = {
        findById: vi.fn().mockResolvedValue({ id: 'b_001', status: 'TESTING', version: 1 }),
      };
      const handlers = new BatchWorkflowHandlers(mockRepo);

      await expect(
        handlers.executeBatchAction('BATCH_RELEASE_APPROVE', 'b_001', qaUser)
      ).rejects.toThrow('ERR_CLIENT_RELEASE_PROHIBITED');
    });

    it('FirebaseBatchRepository.updateStatus ném lỗi nếu client cố tình gọi với status=RELEASED', async () => {
      const repo = new FirebaseBatchRepository();
      await expect(repo.updateStatus('b_001', 'RELEASED')).rejects.toThrow(
        'ERR_DIRECT_RELEASE_FORBIDDEN'
      );
    });

    it('FirebaseBatchRepository.save ném lỗi nếu client cố tình tạo lô ở status=RELEASED', async () => {
      const repo = new FirebaseBatchRepository();
      await expect(
        repo.save({ id: 'b_001', batchNo: 'L01', status: 'RELEASED' } as any)
      ).rejects.toThrow('ERR_DIRECT_RELEASE_FORBIDDEN');
    });
  });

  describe('3. P0-3, P0-4, P0-5, P0-6, P0-7: Server Release Command & Canonical 7 Gates Adversarial Tests', () => {
    let mockDbData: Record<string, any>;
    let mockDb: any;

    beforeEach(() => {
      mockDbData = {};

      mockDb = {
        ref: (path?: string) => {
          const currentPath = path || '';
          return {
            once: vi.fn().mockImplementation(async () => {
              const val = mockDbData[currentPath];
              return {
                exists: () => val !== undefined && val !== null,
                val: () => val,
              };
            }),
            orderByChild: (childKey: string) => ({
              equalTo: (expectedVal: any) => ({
                once: vi.fn().mockImplementation(async () => {
                  const collection = mockDbData[currentPath] || {};
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
            update: vi.fn().mockImplementation(async (updates: any) => {
              if (!currentPath) {
                // Multi-location update
                for (const [p, val] of Object.entries(updates)) {
                  mockDbData[p] = val;
                }
              } else {
                mockDbData[currentPath] = { ...mockDbData[currentPath], ...updates };
              }
            }),
            set: vi.fn().mockImplementation(async (val: any) => {
              mockDbData[currentPath] = val;
            }),
            push: vi.fn().mockImplementation(async (logEntry?: any) => {
              const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              if (logEntry) {
                mockDbData[`${currentPath}/${id}`] = logEntry;
              }
              return { key: id };
            }),
          };
        },
      };
    });

    const createValidSignature = (batchId: string, version: number = 1): ElectronicSignature => {
      const unsigned = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: batchId,
        documentVersion: version,
        signerUid: qaUser.uid,
        signerName: 'Nguyễn QA',
        signerEmail: qaUser.email,
        role: 'QA' as const,
        meaning: 'Tôi xác nhận xuất xưởng Lô',
        signedAt: new Date().toISOString(),
        status: 'CREATED' as const,
      };
      const checksum = computeSignatureSha256(unsigned);
      return {
        id: 'sig_valid_001',
        ...unsigned,
        checksum,
      };
    };

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

    it('chữ ký với checksum 64-hex giả mạo (ví dụ 64 ký tự a) bắt buộc phải FAIL (P0-4)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };

      // Chữ ký có checksum là 64 ký tự hex ngẫu nhiên không tương ứng payload
      const fakeHex64 = 'a'.repeat(64);
      const forgedSig = {
        ...createValidSignature('b_001', 1),
        id: 'sig_forged_hex',
        checksum: fakeHex64,
      };
      mockDbData['electronic_signatures/sig_forged_hex'] = forgedSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_forged_hex' },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow(
        'ERR_SIGNATURE_TAMPERED'
      );
    });

    it('chữ ký với checksum SHA-256 sai nội dung bắt buộc phải FAIL (P0-4)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };

      // Checksum đúng cho Lô khác nhưng gán vào Lô này
      const otherBatchChecksum = computeSignatureSha256({
        documentType: 'BATCH_RELEASE',
        documentId: 'b_OTHER',
        documentVersion: 1,
        signerUid: qaUser.uid,
        signerEmail: qaUser.email,
        role: 'QA',
        meaning: 'Ý nghĩa khác',
        signedAt: new Date().toISOString(),
      });

      const badShaSig = {
        ...createValidSignature('b_001', 1),
        id: 'sig_bad_sha',
        checksum: otherBatchChecksum,
      };
      mockDbData['electronic_signatures/sig_bad_sha'] = badShaSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_bad_sha' },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow(
        'ERR_SIGNATURE_TAMPERED'
      );
    });

    it('chữ ký có status=CONSUMED không được tái sử dụng để xuất xưởng lại (P0-6)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };

      const consumedSig = {
        ...createValidSignature('b_001', 1),
        id: 'sig_consumed',
        status: 'CONSUMED',
      };
      // Cập nhật lại checksum theo payload có status
      mockDbData['electronic_signatures/sig_consumed'] = consumedSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_consumed' },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow(
        'ERR_SIGNATURE_ALREADY_USED'
      );
    });

    it('chữ ký giả mạo vai trò hoặc signerUid khác authenticated uid bắt buộc phải FAIL (Gate 7)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };

      // 1. Signer role = USER (không có thẩm quyền)
      const userRoleSigData = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: 'b_001',
        documentVersion: 1,
        signerUid: qaUser.uid,
        signerName: 'Nguyễn User',
        signerEmail: qaUser.email,
        role: 'USER' as const,
        meaning: 'Ký xuất xưởng',
        signedAt: new Date().toISOString(),
        status: 'CREATED' as const,
      };
      const userRoleSig = {
        id: 'sig_user_role',
        ...userRoleSigData,
        checksum: computeSignatureSha256(userRoleSigData),
      };
      mockDbData['electronic_signatures/sig_user_role'] = userRoleSig;

      const req1: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_user_role' },
      };
      await expect(handleApproveBatchRelease(req1, mockDb)).rejects.toThrow(
        'ERR_SIGNATURE_ROLE_UNAUTHORIZED'
      );

      // 2. SignerUid khác với Authenticated callerUid
      const diffUidSigData = {
        documentType: 'BATCH_RELEASE' as const,
        documentId: 'b_001',
        documentVersion: 1,
        signerUid: 'another-user-uid',
        signerName: 'Khác User',
        signerEmail: 'other@vbiotech.com',
        role: 'QA' as const,
        meaning: 'Ký xuất xưởng',
        signedAt: new Date().toISOString(),
        status: 'CREATED' as const,
      };
      const diffUidSig = {
        id: 'sig_diff_uid',
        ...diffUidSigData,
        checksum: computeSignatureSha256(diffUidSigData),
      };
      mockDbData['electronic_signatures/sig_diff_uid'] = diffUidSig;

      const req2: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: 'sig_diff_uid' },
      };
      await expect(handleApproveBatchRelease(req2, mockDb)).rejects.toThrow('ERR_SIGNER_MISMATCH');
    });

    it('Gate 1: Thiếu chỉ tiêu bắt buộc trong TCCS phải FAIL (P0-3 SSoT)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
        tccsSnapshot: {
          id: 'tccs_001',
          mainQualityCriteria: [
            { name: 'Định lượng hoạt chất', isOptional: false },
            { name: 'Độ hòa tan', isOptional: false },
          ],
        },
      };
      // Phiếu kiểm nghiệm chỉ có 1 trong 2 chỉ tiêu
      mockDbData['testResults'] = {
        tr_001: {
          id: 'tr_001',
          batchId: 'b_001',
          overallStatus: 'PASS',
          qualityStatus: 'PASS',
          results: [{ criteriaName: 'Định lượng hoạt chất', value: 99.5, isPass: true }],
        },
      };
      const validSig = createValidSignature('b_001', 1);
      mockDbData[`electronic_signatures/${validSig.id}`] = validSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: validSig.id },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow('ERR_TEST_INCOMPLETE');
    });

    it('Gate 2: Phiếu có chỉ tiêu bị FAIL phải FAIL kể cả overallStatus là PASS', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: {
          id: 'tr_001',
          batchId: 'b_001',
          overallStatus: 'PASS', // Khai báo sai PASS
          qualityStatus: 'PASS',
          results: [
            { criteriaName: 'Định lượng', value: 80.0, isPass: false }, // Nhưng chỉ tiêu bị FAIL!
          ],
        },
      };
      const validSig = createValidSignature('b_001', 1);
      mockDbData[`electronic_signatures/${validSig.id}`] = validSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: validSig.id },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow(
        'ERR_QUALITY_NOT_PASSED'
      );
    });

    it('Gate 3: Lô có OOS mở (type, category hoặc isOos) phải FAIL', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };
      // Deviation loại OOS chưa đóng
      mockDbData['quality_deviations'] = {
        dev_001: {
          id: 'dev_001',
          batchId: 'b_001',
          type: 'OOS',
          status: 'INVESTIGATING',
        },
      };
      const validSig = createValidSignature('b_001', 1);
      mockDbData[`electronic_signatures/${validSig.id}`] = validSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: validSig.id },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow('ERR_OOS_PENDING');
    });

    it('Gate 4: Lô có Sai lệch nghiêm trọng (CRITICAL) chưa đóng phải FAIL', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };
      mockDbData['quality_deviations'] = {
        dev_001: {
          id: 'dev_001',
          batchId: 'b_001',
          severity: 'CRITICAL',
          status: 'OPEN',
        },
      };
      const validSig = createValidSignature('b_001', 1);
      mockDbData[`electronic_signatures/${validSig.id}`] = validSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: validSig.id },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow('ERR_DEV_PENDING');
    });

    it('Gate 5: Lô có CAPA chưa hoàn thành (capaCompleted=false hoặc item chưa xong) phải FAIL', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };
      mockDbData['quality_deviations'] = {
        dev_001: {
          id: 'dev_001',
          batchId: 'b_001',
          severity: 'MAJOR',
          status: 'CLOSED',
          capaRequired: true,
          capaCompleted: false, // CAPA chưa hoàn thành!
        },
      };
      const validSig = createValidSignature('b_001', 1);
      mockDbData[`electronic_signatures/${validSig.id}`] = validSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: validSig.id },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow('ERR_CAPA_PENDING');
    });

    it('Gate 6: BPR chưa được QA APPROVED phải FAIL', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'UNDER_REVIEW', // Chưa APPROVED
      };
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };
      const validSig = createValidSignature('b_001', 1);
      mockDbData[`electronic_signatures/${validSig.id}`] = validSig;

      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA' } },
        data: { batchId: 'b_001', signatureId: validSig.id },
      };

      await expect(handleApproveBatchRelease(req, mockDb)).rejects.toThrow('ERR_BPR_NOT_APPROVED');
    });

    it('Thỏa mãn 7/7 Gates: Atomic Commit, Signature CONSUMED và Idempotency Key Persistence (P0-6 & P0-7)', async () => {
      mockDbData['batches/b_001'] = {
        id: 'b_001',
        batchNo: 'L26001',
        status: 'TESTING',
        version: 1,
        bprReviewStatus: 'APPROVED',
        bprReviewedBy: qaUser.email,
        bprReviewedAt: new Date().toISOString(),
      };
      const validSig = createValidSignature('b_001', 1);
      mockDbData[`electronic_signatures/${validSig.id}`] = validSig;
      mockDbData['testResults'] = {
        tr_001: { id: 'tr_001', batchId: 'b_001', overallStatus: 'PASS', qualityStatus: 'PASS' },
      };

      const idempotencyKey = 'idemp_unique_key_123';
      const req: any = {
        auth: { uid: qaUser.uid, token: { role: 'QA', email: qaUser.email } },
        data: {
          batchId: 'b_001',
          signatureId: validSig.id,
          expectedVersion: 1,
          idempotencyKey,
        },
      };

      const result = await handleApproveBatchRelease(req, mockDb);
      expect(result.success).toBe(true);
      expect(result.status).toBe('RELEASED');
      expect(result.version).toBe(2);

      // Kiểm tra Multi-location atomic commit:
      // 1. Batch status = RELEASED
      expect(mockDbData['batches/b_001/status']).toBe('RELEASED');
      expect(mockDbData['batches/b_001/version']).toBe(2);

      // 2. Signature status = CONSUMED
      expect(mockDbData[`electronic_signatures/${validSig.id}/status`]).toBe('CONSUMED');
      expect(mockDbData[`electronic_signatures/${validSig.id}/consumedAt`]).toBeDefined();

      // 3. Idempotency Key record persisted in release_commands
      const persistedCommand = mockDbData[`release_commands/${idempotencyKey}`];
      expect(persistedCommand).toBeDefined();
      expect(persistedCommand.idempotencyKey).toBe(idempotencyKey);
      expect(persistedCommand.batchId).toBe('b_001');

      // 4. Gọi lại lần 2 với idempotencyKey -> Trả về kết quả cached ngay lập tức
      const replayResult = await handleApproveBatchRelease(req, mockDb);
      expect(replayResult.success).toBe(true);
      expect(replayResult.isIdempotent).toBe(true);
      expect(replayResult.status).toBe('RELEASED');
      expect(replayResult.version).toBe(2);
    });
  });
});
