import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TCCSAppService } from './TCCSAppService';
import { ITCCSRepository } from '../../repositories/TCCSRepository';
import { createBaseMockRepository } from '../../repositories/mockRepositoryHelper';
import { TCCS, Batch, CriterionType } from '../../types';

describe('TCCSAppService - PQM 3.0 Application Service', () => {
  let mockRepo: ITCCSRepository;
  let service: TCCSAppService;

  const adminUser = { uid: 'u-admin', role: 'ADMIN', isAdmin: true };
  const qaUser = { uid: 'u-qa', role: 'QA' };
  const viewerUser = { uid: 'u-viewer', role: 'VIEWER' };

  const sampleTCCS: TCCS = {
    id: 'tccs-001',
    productId: 'prod-001',
    code: 'TCCS 01:2026/VB',
    issueDate: '2026-01-01',
    isActive: true,
    mainQualityCriteria: [
      { name: 'Độ ẩm', unit: '%', max: 9.0, type: CriterionType.NUMBER }
    ],
    safetyCriteria: [],
    createdAt: '2026-01-01T00:00:00Z'
  };

  const sampleBatch: Batch = {
    id: 'b-001',
    productId: 'prod-001',
    tccsId: 'tccs-001',
    batchNo: 'L26001',
    mfgDate: '2026-01-01',
    expDate: '2028-01-01',
    theoreticalYield: 10000,
    actualYield: 9800,
    yieldUnit: 'viên',
    status: 'TESTING',
    createdAt: '2026-01-01T00:00:00Z'
  };

  beforeEach(() => {
    mockRepo = {
      ...createBaseMockRepository<TCCS>(),
      findById: vi.fn().mockResolvedValue(sampleTCCS),
      findAll: vi.fn().mockResolvedValue([sampleTCCS]),
      findByProductId: vi.fn().mockResolvedValue([sampleTCCS]),
      findActiveByProductId: vi.fn().mockResolvedValue(sampleTCCS),
      findByCode: vi.fn().mockResolvedValue(sampleTCCS),
    };
    service = new TCCSAppService(mockRepo);
  });

  it('should allow QA or Admin to create TCCS', async () => {
    await expect(service.createTCCS(sampleTCCS, [], qaUser)).resolves.not.toThrow();
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('should deny unauthorized user from creating TCCS', async () => {
    await expect(service.createTCCS(sampleTCCS, [], viewerUser)).rejects.toThrow('Từ chối quyền');
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should reject TCCS without code or productId', async () => {
    const invalidTCCS = { ...sampleTCCS, code: '' };
    await expect(service.createTCCS(invalidTCCS, [], adminUser)).rejects.toThrow('Mã TCCS không được để trống');
  });

  it('should block deletion of TCCS linked to an active batch', async () => {
    await expect(
      service.deleteTCCS('tccs-001', [sampleBatch], adminUser, 'TCCS 01:2026/VB')
    ).rejects.toThrow('liên kết với ít nhất một lô sản xuất');
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should allow deletion when TCCS is not referenced by any batch', async () => {
    await expect(
      service.deleteTCCS('tccs-unused', [sampleBatch], adminUser, 'TCCS Unused')
    ).resolves.not.toThrow();
    expect(mockRepo.delete).toHaveBeenCalledWith('tccs-unused');
  });
});
