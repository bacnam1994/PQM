/**
 * WORKFLOW ACTION CATALOG (CANONICAL)
 *
 * SSoT cho toàn bộ 42 Canonical Workflow Actions trong PQM.
 * Mọi hoạt động có tính chất thay đổi trạng thái, dữ liệu có quy chuẩn (regulated mutation)
 * đều phải ánh xạ về một trong các Action thuộc Catalog này.
 */

export type EntityType =
  | 'PRODUCT'
  | 'MATERIAL'
  | 'TCCS'
  | 'FORMULA'
  | 'BATCH'
  | 'TEST_RESULT'
  | 'QUALITY_SNAPSHOT'
  | 'OOS'
  | 'DEVIATION'
  | 'CAPA'
  | 'CHANGE_REQUEST'
  | 'COA'
  | 'APPROVAL_TASK'
  | 'MASTER_DATA'
  | 'SYSTEM';

export type ActionCategory =
  | 'LIFECYCLE'
  | 'TRANSITION'
  | 'APPROVAL'
  | 'QUALITY'
  | 'DOCUMENT'
  | 'GOVERNANCE'
  | 'ADMIN';

export interface WorkflowActionMetadata {
  actionId: string;
  entityType: EntityType;
  category: ActionCategory;
  description: string;
  allowedRoles: string[];
  requiresAudit: boolean;
  requiresReason: boolean;
  targetFsm?: string;
}

export const WORKFLOW_ACTION_CATALOG: Record<string, WorkflowActionMetadata> = {
  // Product & Material
  PRODUCT_CREATE: {
    actionId: 'PRODUCT_CREATE',
    entityType: 'PRODUCT',
    category: 'LIFECYCLE',
    description: 'Tạo mới hồ sơ sản phẩm',
    allowedRoles: ['admin', 'manager', 'lead'],
    requiresAudit: true,
    requiresReason: false,
  },
  PRODUCT_UPDATE: {
    actionId: 'PRODUCT_UPDATE',
    entityType: 'PRODUCT',
    category: 'LIFECYCLE',
    description: 'Cập nhật thông tin sản phẩm',
    allowedRoles: ['admin', 'manager', 'lead'],
    requiresAudit: true,
    requiresReason: true,
  },
  PRODUCT_ARCHIVE: {
    actionId: 'PRODUCT_ARCHIVE',
    entityType: 'PRODUCT',
    category: 'LIFECYCLE',
    description: 'Lưu trữ/vô hiệu hóa sản phẩm',
    allowedRoles: ['admin', 'manager'],
    requiresAudit: true,
    requiresReason: true,
  },
  MATERIAL_CREATE: {
    actionId: 'MATERIAL_CREATE',
    entityType: 'MATERIAL',
    category: 'LIFECYCLE',
    description: 'Tạo mới nguyên phụ liệu',
    allowedRoles: ['admin', 'manager', 'lead'],
    requiresAudit: true,
    requiresReason: false,
  },
  MATERIAL_UPDATE: {
    actionId: 'MATERIAL_UPDATE',
    entityType: 'MATERIAL',
    category: 'LIFECYCLE',
    description: 'Cập nhật thông tin nguyên liệu',
    allowedRoles: ['admin', 'manager', 'lead'],
    requiresAudit: true,
    requiresReason: true,
  },

  // TCCS & Formula
  TCCS_CREATE: {
    actionId: 'TCCS_CREATE',
    entityType: 'TCCS',
    category: 'LIFECYCLE',
    description: 'Tạo mới tiêu chuẩn cơ sở',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'TccsStateMachine',
  },
  TCCS_SUBMIT: {
    actionId: 'TCCS_SUBMIT',
    entityType: 'TCCS',
    category: 'TRANSITION',
    description: 'Trình duyệt TCCS',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'TccsStateMachine',
  },
  TCCS_APPROVE: {
    actionId: 'TCCS_APPROVE',
    entityType: 'TCCS',
    category: 'APPROVAL',
    description: 'Phê duyệt TCCS',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'TccsStateMachine',
  },
  TCCS_REJECT: {
    actionId: 'TCCS_REJECT',
    entityType: 'TCCS',
    category: 'APPROVAL',
    description: 'Từ chối TCCS',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'TccsStateMachine',
  },
  TCCS_ACTIVATE: {
    actionId: 'TCCS_ACTIVATE',
    entityType: 'TCCS',
    category: 'TRANSITION',
    description: 'Ban hành / Kích hoạt hiệu lực TCCS',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'TccsStateMachine',
  },
  FORMULA_CREATE: {
    actionId: 'FORMULA_CREATE',
    entityType: 'FORMULA',
    category: 'LIFECYCLE',
    description: 'Tạo công thức sản xuất',
    allowedRoles: ['admin', 'manager', 'lead'],
    requiresAudit: true,
    requiresReason: false,
  },
  FORMULA_APPROVE: {
    actionId: 'FORMULA_APPROVE',
    entityType: 'FORMULA',
    category: 'APPROVAL',
    description: 'Phê duyệt công thức sản xuất',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
  },

  // Batch
  BATCH_CREATE: {
    actionId: 'BATCH_CREATE',
    entityType: 'BATCH',
    category: 'LIFECYCLE',
    description: 'Khởi tạo lô sản xuất/kiểm nghiệm',
    allowedRoles: ['admin', 'manager', 'lead', 'operator'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'BatchStateMachine',
  },
  BATCH_START_TESTING: {
    actionId: 'BATCH_START_TESTING',
    entityType: 'BATCH',
    category: 'TRANSITION',
    description: 'Bắt đầu quá trình kiểm nghiệm lô',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist', 'operator'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'BatchStateMachine',
  },
  BATCH_BLOCK: {
    actionId: 'BATCH_BLOCK',
    entityType: 'BATCH',
    category: 'TRANSITION',
    description: 'Phong tỏa / Tạm giữ lô',
    allowedRoles: ['admin', 'manager', 'qa_manager', 'lead'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'BatchStateMachine',
  },
  BATCH_REJECT: {
    actionId: 'BATCH_REJECT',
    entityType: 'BATCH',
    category: 'TRANSITION',
    description: 'Từ chối / Loại bỏ lô không đạt',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'BatchStateMachine',
  },
  BATCH_RELEASE: {
    actionId: 'BATCH_RELEASE',
    entityType: 'BATCH',
    category: 'TRANSITION',
    description: 'Xuất xưởng lô (Yêu cầu thỏa mãn 100% 7 Release Gates, không có ngoại lệ)',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'BatchStateMachine',
  },
  BATCH_RECALL: {
    actionId: 'BATCH_RECALL',
    entityType: 'BATCH',
    category: 'TRANSITION',
    description: 'Thu hồi lô sản phẩm',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'BatchStateMachine',
  },
  BATCH_REOPEN: {
    actionId: 'BATCH_REOPEN',
    entityType: 'BATCH',
    category: 'TRANSITION',
    description: 'Mở lại lô sau khi giải trình điều tra',
    allowedRoles: ['admin', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'BatchStateMachine',
  },

  // Test Result
  TEST_RESULT_CREATE: {
    actionId: 'TEST_RESULT_CREATE',
    entityType: 'TEST_RESULT',
    category: 'LIFECYCLE',
    description: 'Tạo phiếu kiểm nghiệm mới',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist', 'operator'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'TestResultStateMachine',
  },
  TEST_RESULT_SAVE_DRAFT: {
    actionId: 'TEST_RESULT_SAVE_DRAFT',
    entityType: 'TEST_RESULT',
    category: 'LIFECYCLE',
    description: 'Lưu bản nháp phiếu kiểm nghiệm',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist', 'operator'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'TestResultStateMachine',
  },
  TEST_RESULT_SUBMIT: {
    actionId: 'TEST_RESULT_SUBMIT',
    entityType: 'TEST_RESULT',
    category: 'TRANSITION',
    description: 'Trình duyệt kết quả kiểm nghiệm',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist', 'operator'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'TestResultStateMachine',
  },
  TEST_RESULT_FINALIZE: {
    actionId: 'TEST_RESULT_FINALIZE',
    entityType: 'TEST_RESULT',
    category: 'TRANSITION',
    description: 'Hoàn tất kết quả kiểm nghiệm sau soát xét',
    allowedRoles: ['admin', 'manager', 'lead'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'TestResultStateMachine',
  },
  TEST_RESULT_APPROVE: {
    actionId: 'TEST_RESULT_APPROVE',
    entityType: 'TEST_RESULT',
    category: 'APPROVAL',
    description: 'Phê duyệt phiếu kiểm nghiệm chính thức',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'TestResultStateMachine',
  },
  TEST_RESULT_SUPERSEDE: {
    actionId: 'TEST_RESULT_SUPERSEDE',
    entityType: 'TEST_RESULT',
    category: 'TRANSITION',
    description: 'Thay thế phiếu kiểm nghiệm bằng bản kiểm nghiệm lại',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'TestResultStateMachine',
  },

  // Quality & Deviation & CAPA
  QUALITY_SNAPSHOT_FREEZE: {
    actionId: 'QUALITY_SNAPSHOT_FREEZE',
    entityType: 'QUALITY_SNAPSHOT',
    category: 'QUALITY',
    description: 'Đóng băng snapshot chất lượng bất biến',
    allowedRoles: ['admin', 'manager', 'qa_manager', 'system'],
    requiresAudit: true,
    requiresReason: false,
  },
  QUALITY_OOS_TRIGGER: {
    actionId: 'QUALITY_OOS_TRIGGER',
    entityType: 'OOS',
    category: 'QUALITY',
    description: 'Kích hoạt hồ sơ OOS khi chỉ tiêu ngoài mức quy định',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist', 'system'],
    requiresAudit: true,
    requiresReason: true,
  },
  ALTERNATE_RESOLVE: {
    actionId: 'ALTERNATE_RESOLVE',
    entityType: 'QUALITY_SNAPSHOT',
    category: 'QUALITY',
    description: 'Giải quyết và chốt phương án chỉ tiêu thay thế',
    allowedRoles: ['admin', 'manager', 'lead'],
    requiresAudit: true,
    requiresReason: true,
  },
  DEVIATION_CREATE: {
    actionId: 'DEVIATION_CREATE',
    entityType: 'DEVIATION',
    category: 'LIFECYCLE',
    description: 'Tạo hồ sơ sai lệch / sự cố',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist', 'operator'],
    requiresAudit: true,
    requiresReason: false,
    targetFsm: 'DeviationStateMachine',
  },
  DEVIATION_INVESTIGATE: {
    actionId: 'DEVIATION_INVESTIGATE',
    entityType: 'DEVIATION',
    category: 'TRANSITION',
    description: 'Điều tra nguyên nhân sai lệch',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'DeviationStateMachine',
  },
  DEVIATION_APPROVE: {
    actionId: 'DEVIATION_APPROVE',
    entityType: 'DEVIATION',
    category: 'APPROVAL',
    description: 'Phê duyệt kết quả xử lý sai lệch',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'DeviationStateMachine',
  },
  DEVIATION_CLOSE: {
    actionId: 'DEVIATION_CLOSE',
    entityType: 'DEVIATION',
    category: 'TRANSITION',
    description: 'Đóng hồ sơ sai lệch',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
    targetFsm: 'DeviationStateMachine',
  },
  CAPA_CREATE: {
    actionId: 'CAPA_CREATE',
    entityType: 'CAPA',
    category: 'LIFECYCLE',
    description: 'Tạo hành động khắc phục phòng ngừa',
    allowedRoles: ['admin', 'manager', 'lead', 'qa_manager'],
    requiresAudit: true,
    requiresReason: false,
  },
  CAPA_ASSIGN: {
    actionId: 'CAPA_ASSIGN',
    entityType: 'CAPA',
    category: 'TRANSITION',
    description: 'Phân công thực hiện CAPA',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: false,
  },
  CAPA_CLOSE: {
    actionId: 'CAPA_CLOSE',
    entityType: 'CAPA',
    category: 'TRANSITION',
    description: 'Xác nhận hiệu quả và đóng CAPA',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
  },

  // Change Control
  CHANGE_REQUEST_CREATE: {
    actionId: 'CHANGE_REQUEST_CREATE',
    entityType: 'CHANGE_REQUEST',
    category: 'LIFECYCLE',
    description: 'Tạo yêu cầu kiểm soát thay đổi',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist'],
    requiresAudit: true,
    requiresReason: false,
  },
  CHANGE_REQUEST_REVIEW: {
    actionId: 'CHANGE_REQUEST_REVIEW',
    entityType: 'CHANGE_REQUEST',
    category: 'TRANSITION',
    description: 'Soát xét đánh giá rủi ro thay đổi',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
  },
  CHANGE_REQUEST_APPROVE: {
    actionId: 'CHANGE_REQUEST_APPROVE',
    entityType: 'CHANGE_REQUEST',
    category: 'APPROVAL',
    description: 'Phê duyệt thực hiện thay đổi',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
  },
  CHANGE_REQUEST_REJECT: {
    actionId: 'CHANGE_REQUEST_REJECT',
    entityType: 'CHANGE_REQUEST',
    category: 'APPROVAL',
    description: 'Bác bỏ yêu cầu thay đổi',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
  },

  // Certificate of Analysis (CoA)
  COA_GENERATE: {
    actionId: 'COA_GENERATE',
    entityType: 'COA',
    category: 'DOCUMENT',
    description: 'Tạo phiếu kiểm nghiệm CoA từ snapshot chuẩn',
    allowedRoles: ['admin', 'manager', 'lead', 'specialist'],
    requiresAudit: true,
    requiresReason: false,
  },
  COA_SIGN: {
    actionId: 'COA_SIGN',
    entityType: 'COA',
    category: 'DOCUMENT',
    description: 'Ký số xác thực CoA',
    allowedRoles: ['admin', 'manager', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
  },
  COA_REVOKE: {
    actionId: 'COA_REVOKE',
    entityType: 'COA',
    category: 'DOCUMENT',
    description: 'Thu hồi / hủy bỏ hiệu lực CoA',
    allowedRoles: ['admin', 'qa_manager'],
    requiresAudit: true,
    requiresReason: true,
  },

  // System & Master Data
  MASTER_DATA_IMPORT: {
    actionId: 'MASTER_DATA_IMPORT',
    entityType: 'MASTER_DATA',
    category: 'ADMIN',
    description: 'Nhập dữ liệu danh mục hàng loạt (Excel/CSV)',
    allowedRoles: ['admin', 'manager'],
    requiresAudit: true,
    requiresReason: true,
  },
  MASTER_CRITERIA_BULK_RENAME: {
    actionId: 'MASTER_CRITERIA_BULK_RENAME',
    entityType: 'MASTER_DATA',
    category: 'ADMIN',
    description: 'Đổi tên chuẩn hóa chỉ tiêu hàng loạt trong hệ thống',
    allowedRoles: ['admin', 'manager'],
    requiresAudit: true,
    requiresReason: true,
  },
  SYSTEM_BACKUP_RESTORE: {
    actionId: 'SYSTEM_BACKUP_RESTORE',
    entityType: 'SYSTEM',
    category: 'ADMIN',
    description: 'Khôi phục dữ liệu từ bản sao lưu hệ thống',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: true,
  },
  DATABASE_BACKUP: {
    actionId: 'DATABASE_BACKUP',
    entityType: 'SYSTEM',
    category: 'ADMIN',
    description: 'Sao lưu toàn bộ cơ sở dữ liệu hệ thống',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: false,
  },
  DATABASE_RESTORE: {
    actionId: 'DATABASE_RESTORE',
    entityType: 'SYSTEM',
    category: 'ADMIN',
    description: 'Khôi phục dữ liệu từ tệp sao lưu JSON',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: true,
  },
  DATABASE_WIPE: {
    actionId: 'DATABASE_WIPE',
    entityType: 'SYSTEM',
    category: 'ADMIN',
    description: 'Xóa sạch toàn bộ dữ liệu trên hệ thống',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: true,
  },
  DATABASE_RESET_DEMO: {
    actionId: 'DATABASE_RESET_DEMO',
    entityType: 'SYSTEM',
    category: 'ADMIN',
    description: 'Khởi tạo lại dữ liệu mẫu cho hệ thống',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: true,
  },

  // Laboratory Master Data
  LAB_CREATE: {
    actionId: 'LAB_CREATE',
    entityType: 'MASTER_DATA',
    category: 'LIFECYCLE',
    description: 'Tạo mới đơn vị kiểm nghiệm',
    allowedRoles: ['admin', 'qa_manager', 'qa'],
    requiresAudit: true,
    requiresReason: false,
  },
  LAB_UPDATE: {
    actionId: 'LAB_UPDATE',
    entityType: 'MASTER_DATA',
    category: 'LIFECYCLE',
    description: 'Cập nhật thông tin đơn vị kiểm nghiệm',
    allowedRoles: ['admin', 'qa_manager', 'qa'],
    requiresAudit: true,
    requiresReason: false,
  },
  LAB_DELETE: {
    actionId: 'LAB_DELETE',
    entityType: 'MASTER_DATA',
    category: 'LIFECYCLE',
    description: 'Xóa đơn vị kiểm nghiệm khỏi danh mục',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: true,
  },

  // Pharmacopoeia Master Data
  PHARMACOPOEIA_CREATE: {
    actionId: 'PHARMACOPOEIA_CREATE',
    entityType: 'MASTER_DATA',
    category: 'LIFECYCLE',
    description: 'Tạo mới chuyên luận dược điển',
    allowedRoles: ['admin', 'qa_manager', 'qa'],
    requiresAudit: true,
    requiresReason: false,
  },
  PHARMACOPOEIA_UPDATE: {
    actionId: 'PHARMACOPOEIA_UPDATE',
    entityType: 'MASTER_DATA',
    category: 'LIFECYCLE',
    description: 'Cập nhật chuyên luận dược điển',
    allowedRoles: ['admin', 'qa_manager', 'qa'],
    requiresAudit: true,
    requiresReason: false,
  },
  PHARMACOPOEIA_DELETE: {
    actionId: 'PHARMACOPOEIA_DELETE',
    entityType: 'MASTER_DATA',
    category: 'LIFECYCLE',
    description: 'Xóa chuyên luận dược điển',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: true,
  },
  PHARMACOPOEIA_SEED: {
    actionId: 'PHARMACOPOEIA_SEED',
    entityType: 'MASTER_DATA',
    category: 'ADMIN',
    description: 'Nạp danh mục tiêu chuẩn dược điển mặc định',
    allowedRoles: ['admin'],
    requiresAudit: true,
    requiresReason: true,
  },
};
