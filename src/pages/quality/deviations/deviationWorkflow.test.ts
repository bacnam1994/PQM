import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviationAppService } from '../../../services/app/DeviationAppService';
import { IDeviationRepository } from '../../../repositories/IDeviationRepository';
import { QualityDeviation, DeviationStatus } from '../../../types/deviation';

describe('TASK-015: Deviation / CAPA Complete Workflow Engine & UI', () => {
  let mockDeviations: QualityDeviation[];
  let mockRepo: IDeviationRepository;
  let service: DeviationAppService;

  beforeEach(() => {
    mockDeviations = [
      {
        id: 'dev_1',
        deviationNo: 'DEV-2026-0001',
        title: 'OOS Hàm lượng Paracetamol Lô 2601',
        source: 'OOS_TEST_RESULT',
        status: 'UNDER_INVESTIGATION',
        severity: 'CRITICAL',
        description: 'Định lượng hoạt chất chỉ đạt 92% (TCCS: 95-105%)',
        loggedBy: 'qc@pqm.com',
        loggedAt: '2026-01-02T08:00:00.000Z',
        version: 1,
        updatedAt: '2026-01-02T08:00:00.000Z',
        capaItems: [
          {
            id: 'capa_1',
            type: 'CORRECTIVE',
            action: 'Hiệu chuẩn lại đầu dò máy HPLC và thẩm tra mẫu chuẩn',
            responsible: 'ktv_nghiem@pqm.com',
            deadline: '2026-01-05',
            status: 'PENDING'
          }
        ]
      }
    ];

    mockRepo = {
      findById: vi.fn(async (id: string) => mockDeviations.find(d => d.id === id) || null),
      findAll: vi.fn(async () => [...mockDeviations]),
      save: vi.fn(async (dev: QualityDeviation) => {
        const idx = mockDeviations.findIndex(d => d.id === dev.id);
        if (idx >= 0) mockDeviations[idx] = dev;
        else mockDeviations.push(dev);
      }),
      delete: vi.fn(async () => {}),
      updateStatus: vi.fn(async (id: string, status: DeviationStatus, notes?: string) => {
        const d = mockDeviations.find(x => x.id === id);
        if (d) {
          d.status = status;
          if (notes) d.closureNotes = notes;
        }
      })
    } as unknown as IDeviationRepository;

    service = new DeviationAppService(mockRepo);
  });

  it('bổ sung hành động CAPA và tự động chuyển trạng thái sang CAPA_PLANNED', async () => {
    const user = { email: 'qa@pqm.com', role: 'QA' };
    const updated = await service.addCAPAItem('dev_1', {
      type: 'PREVENTIVE',
      action: 'Đào tạo lại SOP pha chế dung môi chạy sắc ký cho toàn bộ KTV',
      responsible: 'qa_lead@pqm.com',
      deadline: '2026-01-15',
      status: 'PENDING'
    }, user);

    expect(updated.capaItems).toHaveLength(2);
    expect(updated.status).toBe('CAPA_PLANNED');
    expect(updated.version).toBe(2);
  });

  it('hoàn thành một hành động CAPA trong danh mục (completeCAPAItem)', async () => {
    const user = { email: 'ktv@pqm.com', role: 'QC' };
    const updated = await service.completeCAPAItem('dev_1', 'capa_1', user);

    const completedCapa = updated.capaItems?.find(c => c.id === 'capa_1');
    expect(completedCapa?.status).toBe('COMPLETED');
    expect(completedCapa?.completedAt).toBeDefined();
  });

  it('từ chối đóng hồ sơ nếu người thực hiện không có quyền QA hoặc ADMIN', async () => {
    const nonQaUser = { email: 'operator@pqm.com', role: 'OPERATOR' };

    await expect(
      service.updateStatus('dev_1', 'CLOSED', nonQaUser, { notes: 'Xin đóng hồ sơ' })
    ).rejects.toThrow('Từ chối quyền: Chỉ Trưởng phòng QA hoặc Quản trị viên');
  });

  it('từ chối đóng hồ sơ nếu không có ghi chú kết luận thẩm định', async () => {
    const qaUser = { email: 'qa_head@pqm.com', role: 'QA' };

    await expect(
      service.updateStatus('dev_1', 'CLOSED', qaUser, { notes: '' })
    ).rejects.toThrow('Bắt buộc phải ghi nhận ý kiến thẩm định và kết luận');
  });

  it('cho phép Trưởng phòng QA đóng hồ sơ khi có kết luận thẩm định đầy đủ', async () => {
    const qaUser = { email: 'qa_head@pqm.com', role: 'QA' };

    await service.updateStatus('dev_1', 'CLOSED', qaUser, {
      notes: 'Đã hoàn thành toàn bộ CAPA, kiểm tra lại mẫu lưu đạt tiêu chuẩn. Cho phép phát hành lô.'
    });

    const dev = await mockRepo.findById('dev_1');
    expect(dev?.status).toBe('CLOSED');
    expect(dev?.closureNotes).toContain('Cho phép phát hành lô');
  });
});
