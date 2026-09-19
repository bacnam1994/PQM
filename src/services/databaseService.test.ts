import { describe, it, expect, vi } from 'vitest';
import { saveItem, updateBatchStatusService } from './databaseService';

vi.mock('../firebase', () => ({
  db: {},
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  update: vi.fn(),
  query: vi.fn(),
  orderByChild: vi.fn(),
  equalTo: vi.fn(),
  get: vi.fn(),
}));

describe('A4 — Direct Database Write & Status Mutation Audit Guard', () => {
  it('cấm gọi trực tiếp saveItem (bắt buộc qua Repository & App Service)', async () => {
    await expect(saveItem('batches', 'batch-123', { status: 'RELEASED' })).rejects.toThrow(
      /FORBIDDEN DIRECT WRITE/
    );
  });

  it('cấm gọi trực tiếp updateBatchStatusService (bắt buộc qua batchAppService.updateStatus)', async () => {
    await expect(updateBatchStatusService('batch-123', 'RELEASED')).rejects.toThrow(
      /FORBIDDEN STATUS MUTATION/
    );
  });
});
