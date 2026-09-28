import { describe, it, expect } from 'vitest';
import { generateDefaultReportNo } from './reportNoGenerator';

describe('generateDefaultReportNo', () => {
  it('tạo số phiếu mặc định cho phòng QC Nội bộ khi có batchNo', () => {
    const reportNo = generateDefaultReportNo({
      batchNo: 'LOT-2026-001',
      labName: 'Phòng Kiểm nghiệm Nội bộ V-BIOTECH',
      testDate: '2026-03-25',
    });
    expect(reportNo).toBe('PKN/LOT-2026-001/2026');
  });

  it('tạo số phiếu mặc định cho phòng QC Nội bộ khi không có batchNo', () => {
    const reportNo = generateDefaultReportNo({
      labName: 'Phòng QC',
      testDate: '2026-03-25',
    });
    expect(reportNo).toMatch(/^PKN\/QC-2026\/\d{4}$/);
  });

  it('tạo số phiếu mặc định cho phòng kiểm nghiệm bên ngoài (ngoại kiểm) khi có batchNo', () => {
    const reportNo = generateDefaultReportNo({
      batchNo: 'LOT-2026-002',
      labName: 'Trung tâm Kỹ thuật Tiêu chuẩn Đo lường Chất lượng 3 (QUATEST 3)',
      testDate: '2026-03-25',
    });
    expect(reportNo).toBe('KN-EXT-LOT-2026-002');
  });

  it('tạo số phiếu mặc định cho phòng ngoại kiểm khi không có batchNo', () => {
    const reportNo = generateDefaultReportNo({
      labName: 'Viện Kiểm nghiệm Thuốc Trung ương (NIFC)',
      testDate: '2026-03-25',
    });
    expect(reportNo).toMatch(/^KN-EXT-2026\/\d{4}$/);
  });

  it('xử lý định dạng ngày DD/MM/YYYY chính xác', () => {
    const reportNo = generateDefaultReportNo({
      batchNo: 'LOT-99',
      labName: 'V-Biotech',
      testDate: '25/03/2026',
    });
    expect(reportNo).toBe('PKN/LOT-99/2026');
  });
});
