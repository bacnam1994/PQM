import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeControlAppService } from './ChangeControlAppService';

describe('TASK-016: ChangeControlAppService - GMP Change Control Management', () => {
  let service: ChangeControlAppService;

  beforeEach(() => {
    localStorage.clear();
    service = new ChangeControlAppService();
  });

  it('khởi tạo yêu cầu thay đổi mới với mã số tự sinh chuẩn CR-YYYY-XXXX', async () => {
    const newCR = await service.createChangeRequest({
      title: 'Thay thế nhà cung cấp bao bì vỉ màng nhôm',
      category: 'PACKAGING',
      changeType: 'MINOR',
      justification: 'Nhà cung cấp cũ ngưng phân phối quy cách màng 200mm.',
      description: 'Chuyển sang nhà cung cấp phụ Amcor đạt chứng nhận ISO 15378.',
      targetImplementationDate: '2026-08-01'
    }, { email: 'qa@pqm.com' });

    expect(newCR.crNo).toMatch(/^CR-\d{4}-\d{4}$/);
    expect(newCR.status).toBe('DRAFT');
    expect(newCR.category).toBe('PACKAGING');
    expect(newCR.version).toBe(1);
  });

  it('tính toán điểm rủi ro RPN và xác định mức độ rủi ro FMEA chính xác', async () => {
    const cr = await service.createChangeRequest({
      title: 'Thay đổi dung môi chạy HPLC định lượng Paracetamol',
      category: 'ANALYTICAL_METHOD',
      changeType: 'MAJOR',
      justification: 'Giảm độc hại cho KTV',
      description: 'Thay Methanol bằng Acetonitrile',
      targetImplementationDate: '2026-09-01'
    }, { email: 'qc@pqm.com' });

    // S=4 (Nghiêm trọng), P=4 (Thường gặp), D=4 (Khó phát hiện) -> RPN = 64 (HIGH)
    const updatedHigh = await service.assessFMEARisk(cr.id, {
      severity: 4,
      probability: 4,
      detectability: 4,
      mitigationPlan: 'Thẩm định lại phương pháp phân tích theo ICH Q2(R1)'
    }, { email: 'qa@pqm.com' });

    expect(updatedHigh.riskAssessment?.rpn).toBe(64);
    expect(updatedHigh.riskAssessment?.riskLevel).toBe('HIGH');
    expect(updatedHigh.status).toBe('IMPACT_ASSESSMENT');

    // Test Medium (S=3, P=3, D=3 -> 27)
    const updatedMed = await service.assessFMEARisk(cr.id, {
      severity: 3,
      probability: 3,
      detectability: 3
    }, { email: 'qa@pqm.com' });

    expect(updatedMed.riskAssessment?.rpn).toBe(27);
    expect(updatedMed.riskAssessment?.riskLevel).toBe('MEDIUM');
  });

  it('thêm hành động và hoàn tất hành động trong kế hoạch triển khai', async () => {
    const cr = await service.createChangeRequest({
      title: 'Thay đổi nhiệt độ phòng sấy viên',
      category: 'MANUFACTURING_PROCESS',
      changeType: 'MINOR',
      justification: 'Tối ưu độ ẩm',
      description: 'Điều chỉnh nhiệt độ',
      targetImplementationDate: '2026-07-01'
    }, { email: 'prod@pqm.com' });

    const withAction = await service.addActionItem(cr.id, {
      title: 'Cân chỉnh cảm biến nhiệt kế phòng sấy',
      responsible: 'baotri@pqm.com',
      deadline: '2026-06-15'
    }, { email: 'prod@pqm.com' });

    expect(withAction.actionItems).toHaveLength(1);
    const actionId = withAction.actionItems![0].id;
    expect(withAction.actionItems![0].status).toBe('PENDING');

    const completed = await service.completeActionItem(cr.id, actionId, { email: 'baotri@pqm.com' });
    expect(completed.actionItems![0].status).toBe('COMPLETED');
    expect(completed.actionItems![0].completedAt).toBeDefined();
  });

  it('từ chối đóng thay đổi nếu còn hành động chưa hoàn thành hoặc người đóng không phải QA/Admin', async () => {
    const cr = await service.createChangeRequest({
      title: 'Thay đổi tem nhãn',
      category: 'PACKAGING',
      changeType: 'MINOR',
      justification: 'Bổ sung mã QR',
      description: 'Thêm QR truy xuất',
      targetImplementationDate: '2026-07-01'
    }, { email: 'marketing@pqm.com' });

    // Thêm action chưa hoàn thành
    await service.addActionItem(cr.id, {
      title: 'Duyệt market in tem nhãn mới',
      responsible: 'qa@pqm.com',
      deadline: '2026-06-15'
    }, { email: 'qa@pqm.com' });

    // 1. Operator thử đóng -> Bị từ chối quyền
    await expect(
      service.updateStatus(cr.id, 'CLOSED', { email: 'op@pqm.com', role: 'OPERATOR' })
    ).rejects.toThrow('Từ chối quyền: Chỉ Quản lý QA hoặc Quản trị viên');

    // 2. QA thử đóng khi còn action chưa xong -> Bị từ chối do còn việc dở dang
    await expect(
      service.updateStatus(cr.id, 'CLOSED', { email: 'qa@pqm.com', role: 'QA' })
    ).rejects.toThrow('Không thể đóng thay đổi: Vẫn còn các hành động');
  });

  it('cho phép QA đóng thay đổi thành công khi mọi hành động đã hoàn tất', async () => {
    const cr = await service.createChangeRequest({
      title: 'Thay đổi tem nhãn nhỏ',
      category: 'PACKAGING',
      changeType: 'MINOR',
      justification: 'Chỉnh font',
      description: 'Chỉnh font chữ',
      targetImplementationDate: '2026-07-01'
    }, { email: 'marketing@pqm.com' });

    const withAct = await service.addActionItem(cr.id, {
      title: 'In mẫu',
      responsible: 'xuong@pqm.com',
      deadline: '2026-06-10'
    }, { email: 'qa@pqm.com' });

    await service.completeActionItem(cr.id, withAct.actionItems![0].id, { email: 'xuong@pqm.com' });

    const closed = await service.updateStatus(cr.id, 'CLOSED', { email: 'qa_head@pqm.com', role: 'QA' }, 'Đã kiểm tra tem nhãn mẫu đạt chuẩn.');
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedBy).toBe('qa_head@pqm.com');
  });
});
