
/**
 * Formatting Utilities
 * 
 * Common formatting functions for the application.
 */

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format date to standard display format (DD/MM/YYYY)
 */
export const formatDate = (dateStr: string | number | undefined | null): string => {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format date to ISO format (YYYY-MM-DD) for input fields
 */
export const formatDateForInput = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  return date.toISOString().split('T')[0];
};

/**
 * Format date to display with time (DD/MM/YYYY HH:mm)
 */
export const formatDateTime = (dateStr: string | number | undefined | null): string => {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

/**
 * Format date to relative time (e.g., "2 giờ trước", "3 ngày trước")
 */
export const formatRelativeTime = (dateStr: string | number | undefined | null): string => {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) {
    return 'Vừa xong';
  } else if (diffMin < 60) {
    return `${diffMin} phút trước`;
  } else if (diffHour < 24) {
    return `${diffHour} giờ trước`;
  } else if (diffDay < 7) {
    return `${diffDay} ngày trước`;
  } else {
    return formatDate(dateStr);
  }
};

/**
 * Parse date string to ISO format (YYYY-MM-DD)
 * @deprecated Use parseDateToISO from dateUtils for more features
 */
export const toISOString = (dateStr: string | undefined): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return new Date().toISOString().split('T')[0];
  
  return date.toISOString().split('T')[0];
};

// ============================================
// NUMBER FORMATTING
// ============================================

/**
 * Format number with thousand separators
 */
export const formatNumber = (num: number | string | undefined | null, decimals: number = 0): string => {
  if (num === undefined || num === null || num === '') return '';
  
  const number = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(number)) return '';
  
  return number.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Format percentage
 */
export const formatPercentage = (value: number | string | undefined | null, decimals: number = 1): string => {
  if (value === undefined || value === null || value === '') return '';
  
  const number = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(number)) return '';
  
  return `${formatNumber(number * 100, decimals)}%`;
};

/**
 * Format currency (VND)
 */
export const formatCurrency = (amount: number | string | undefined | null): string => {
  if (amount === undefined || amount === null || amount === '') return '';
  
  const number = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(number)) return '';
  
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(number);
};

// ============================================
// TEXT FORMATTING
// ============================================

/**
 * Capitalize first letter of each word
 */
export const capitalizeWords = (text: string | undefined | null): string => {
  if (!text) return '';
  return text.replace(/\b\w/g, char => char.toUpperCase());
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string | undefined | null, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Convert to slug format
 */
export const toSlug = (text: string | undefined | null): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ============================================
// STATUS FORMATTING
// ============================================

/**
 * Format status for display with color class
 */
export interface StatusFormat {
  label: string;
  colorClass: string;
  bgClass: string;
}

export const formatStatus = (status: string | undefined | null): StatusFormat => {
  if (!status) {
    return { label: 'N/A', colorClass: 'text-slate-500', bgClass: 'bg-slate-100' };
  }
  
  const statusMap: Record<string, StatusFormat> = {
    // Product Status
    ACTIVE: { label: 'Hoạt động', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-100' },
    DISCONTINUED: { label: 'Ngừng sản xuất', colorClass: 'text-red-600', bgClass: 'bg-red-100' },
    RECALLED: { label: 'Thu hồi', colorClass: 'text-orange-600', bgClass: 'bg-orange-100' },
    
    // Batch Status
    PENDING: { label: 'Chờ xử lý', colorClass: 'text-yellow-600', bgClass: 'bg-yellow-100' },
    TESTING: { label: 'Đang kiểm tra', colorClass: 'text-blue-600', bgClass: 'bg-blue-100' },
    RELEASED: { label: 'Đã phê duyệt', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-100' },
    REJECTED: { label: 'Từ chối', colorClass: 'text-red-600', bgClass: 'bg-red-100' },
    
    // Test Result Status
    PASS: { label: 'Đạt', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-100' },
    FAIL: { label: 'Không đạt', colorClass: 'text-red-600', bgClass: 'bg-red-100' },
    
    // Sync Status
    IDLE: { label: 'Sẵn sàng', colorClass: 'text-slate-500', bgClass: 'bg-slate-100' },
    SAVING: { label: 'Đang lưu', colorClass: 'text-blue-600', bgClass: 'bg-blue-100' },
    SAVED: { label: 'Đã lưu', colorClass: 'text-emerald-600', bgClass: 'bg-emerald-100' },
    ERROR: { label: 'Lỗi', colorClass: 'text-red-600', bgClass: 'bg-red-100' },
    OFFLINE: { label: 'Ngoại tuyến', colorClass: 'text-slate-600', bgClass: 'bg-slate-100' },
  };
  
  return statusMap[status] || { label: status, colorClass: 'text-slate-600', bgClass: 'bg-slate-100' };
};

// ============================================
// FILE SIZE FORMATTING
// ============================================

/**
 * Format file size
 */
export const formatFileSize = (bytes: number | undefined | null): string => {
  if (bytes === undefined || bytes === null || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
};


