/**
 * laboratory.ts
 * =============
 * Định nghĩa thực thể Master Data: Đơn vị / Phòng kiểm nghiệm (TestingLaboratory)
 * Quản lý danh mục phòng lab chuẩn hóa (Nội bộ & Ngoại kiểm) cùng các biến thể tên gọi (aliases).
 */

export type LabType = 'EXTERNAL' | 'INTERNAL';

export interface TestingLaboratory {
  id: string; // Khóa chính (VD: 'lab_quatest3', 'lab_case', 'lab_nifc', 'lab_eurofins', 'lab_internal')
  code: string; // Mã ngắn gọn (VD: 'QUATEST3', 'CASE', 'NIFC', 'EUROFINS', 'INTERNAL')
  canonicalName: string; // Tên hiển thị chuẩn trên biểu đồ, báo cáo, CoA
  aliases: string[]; // Mảng các tên gọi khác / viết tắt (được chuẩn hóa để so khớp mờ)
  type: LabType; // 'EXTERNAL' hoặc 'INTERNAL'
  description?: string; // Ghi chú hoặc thông tin bổ sung
  isActive: boolean; // Trạng thái hiệu lực
  createdAt: string; // Thời gian tạo
  updatedAt?: string; // Thời gian cập nhật
}
