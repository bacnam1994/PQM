import { useAppStore } from '../../../store/useAppStore';
import { validateAIAction } from '../aiActionGuard';
import { autoHealAllWithAI } from '../../dataConsistencyService';

/**
 * Tự động kích hoạt bộ máy rà soát và hàn gắn toàn vẹn dữ liệu (Data Consistency Auto-Healing)
 */
export const triggerAutoHealingAction = async () => {
  const store = useAppStore.getState();
  const guard = validateAIAction('autoHealInconsistencies', {}, store.user);
  if (!guard.allowed) {
    return {
      success: false,
      error: guard.reason || 'Tài khoản hiện tại không có quyền kích hoạt tự động hàn gắn dữ liệu.'
    };
  }
  if (guard.requiresUserApproval) {
    return {
      success: false,
      isRegulated: true,
      requiresApproval: true,
      proposal: guard.proposal,
      message: `⚠️ **Hành động tái cấu trúc dữ liệu (Auto-Heal) cần phê duyệt:**\n- Theo chuẩn PQM 3.0, tính năng tự động sửa chữa dữ liệu yêu cầu Trưởng phòng hoặc Quản trị viên duyệt đề xuất trước khi chạy.\n- Vui lòng vào trang [Kiểm toán tính nhất quán dữ liệu](/settings) để xem trước tác động và xác nhận thực thi.`
    };
  }

  try {
    const result = await autoHealAllWithAI(() => useAppStore.getState());
    return result;
  } catch (e: any) {
    return {
      success: false,
      error: `Lỗi khi hàn gắn dữ liệu: ${e.message || e}`
    };
  }
};
