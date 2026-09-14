/**
 * operational.ts
 * Chuẩn hóa mô hình dữ liệu cho Vòng đời Vận hành PQM:
 * Loading → Draft → AI → Form → Save → Offline → Sync → Error → Retry
 */

export type OperationalStage =
  | 'LOADING' // Tải dữ liệu ban đầu hoặc nạp bản ghi hiện có
  | 'DRAFT' // Quản lý bản nháp (auto-save, restore, discard)
  | 'AI' // Trích xuất OCR/Voice/Mapping dữ liệu từ AI
  | 'FORM' // Nhập liệu người dùng, validate, đánh giá tiêu chuẩn
  | 'SAVE' // Thực thi lưu trữ (optimistic, audit log, locking)
  | 'OFFLINE' // Trạng thái ngoại tuyến, tạm dừng mutation & lưu cục bộ
  | 'SYNC' // Đồng bộ dữ liệu nền với máy chủ
  | 'ERROR' // Xử lý lỗi chuẩn hóa (Network, Permission, Validation, Server)
  | 'RETRY'; // Cơ chế thử lại bảo toàn dữ liệu

export type OperationalErrorType =
  | 'VALIDATION'
  | 'NETWORK'
  | 'PERMISSION'
  | 'AI'
  | 'SERVER'
  | 'UNKNOWN';

export interface OperationalError {
  stage: OperationalStage;
  type: OperationalErrorType;
  code: string;
  message: string;
  technicalDetails?: string;
  retryable: boolean;
  timestamp: string;
  onRetry?: () => void | Promise<void>;
}

export interface DraftMetadata<T> {
  data: T;
  savedAt: string;
  version?: string;
  entityId?: string;
}

/**
 * Hàm chuẩn hóa mọi dạng lỗi (Firebase, Network, Zod, JS Error) thành OperationalError chuẩn tiếng Việt
 */
export function normalizeOperationalError(
  err: unknown,
  stage: OperationalStage = 'SAVE',
  onRetry?: () => void | Promise<void>
): OperationalError {
  const timestamp = new Date().toISOString();
  let code = 'UNKNOWN_ERROR';
  let message = 'Đã có lỗi không mong muốn xảy ra trong quá trình xử lý.';
  let type: OperationalErrorType = 'UNKNOWN';
  let technicalDetails: string | undefined = undefined;
  let retryable = true;

  if (err instanceof Error) {
    technicalDetails = `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ''}`;
    const rawMsg = err.message || '';

    if (rawMsg.includes('permission_denied') || rawMsg.includes('Permission denied')) {
      code = 'PERMISSION_DENIED';
      type = 'PERMISSION';
      message = 'Bạn không có quyền thực hiện thao tác này theo chính sách bảo mật ALCOA+.';
      retryable = false;
    } else if (
      rawMsg.includes('Failed to fetch') ||
      rawMsg.includes('NetworkError') ||
      rawMsg.includes('offline') ||
      rawMsg.includes('network')
    ) {
      code = 'NETWORK_ERROR';
      type = 'NETWORK';
      message = 'Không thể kết nối với máy chủ. Vui lòng kiểm tra lại đường truyền mạng của bạn.';
      retryable = true;
    } else if (rawMsg.includes('AI') || rawMsg.includes('quota') || rawMsg.includes('429')) {
      code = 'AI_ERROR';
      type = 'AI';
      message =
        'Dịch vụ AI tạm thời quá tải hoặc gặp sự cố xử lý tài liệu. Bạn có thể thử lại hoặc nhập liệu thủ công.';
      retryable = true;
    } else if (rawMsg.includes('validation') || rawMsg.includes('hợp lệ')) {
      code = 'VALIDATION_FAILED';
      type = 'VALIDATION';
      message = rawMsg;
      retryable = false;
    } else {
      code = err.name || 'INTERNAL_ERROR';
      message = rawMsg || 'Lỗi hệ thống trong quá trình thực thi.';
    }
  } else if (typeof err === 'string') {
    message = err;
    technicalDetails = err;
  }

  return {
    stage,
    type,
    code,
    message,
    technicalDetails,
    retryable,
    timestamp,
    onRetry,
  };
}
