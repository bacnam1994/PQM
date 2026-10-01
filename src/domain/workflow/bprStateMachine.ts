/**
 * BPR STATE MACHINE (HỒ SƠ SẢN XUẤT - BPR REVIEW WORKFLOW)
 *
 * Quản lý vòng đời thẩm tra BPR (Gate 6):
 * - Không cho phép DRAFT -> APPROVED trực tiếp
 * - Luồng tối thiểu: SUBMITTED -> UNDER_REVIEW -> APPROVED
 * - BPR APPROVE / REJECT / START_REVIEW bắt buộc quyền QA hoặc ADMIN
 * - Ghi nhận đầy đủ audit metadata: bprReviewedAt, bprReviewedBy, bprReviewComment
 */

export type BprReviewStatus = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export type BprWorkflowActionId = 'BPR_SUBMIT' | 'BPR_START_REVIEW' | 'BPR_APPROVE' | 'BPR_REJECT';

export interface BprTransitionContext {
  actorRole?: string;
  actorId?: string;
  comment?: string;
}

export class BprStateMachine {
  /**
   * Tính toán trạng thái BPR tiếp theo dựa trên hành động và trạng thái hiện tại
   */
  public static resolveNextBprStatus(
    actionId: BprWorkflowActionId,
    currentStatus?: BprReviewStatus | null
  ): BprReviewStatus {
    const status: BprReviewStatus = currentStatus || 'DRAFT';

    switch (actionId) {
      case 'BPR_SUBMIT':
        if (status === 'DRAFT' || status === 'REJECTED') {
          return 'SUBMITTED';
        }
        throw new Error(
          `BPR Transition Error: Không thể nộp hồ sơ BPR khi trạng thái hiện tại là '${status}'. Chỉ được nộp khi DRAFT hoặc REJECTED.`
        );

      case 'BPR_START_REVIEW':
        if (status === 'SUBMITTED' || status === 'DRAFT') {
          return 'UNDER_REVIEW';
        }
        throw new Error(
          `BPR Transition Error: Không thể bắt đầu thẩm tra BPR khi trạng thái hiện tại là '${status}'. Bắt buộc hồ sơ ở trạng thái SUBMITTED hoặc DRAFT.`
        );

      case 'BPR_APPROVE':
        if (status === 'DRAFT') {
          throw new Error(
            'BPR Transition Error: Quy chuẩn GMP cấm phê duyệt BPR trực tiếp từ DRAFT. Luồng hợp lệ: SUBMITTED -> UNDER_REVIEW -> APPROVED.'
          );
        }
        if (status !== 'UNDER_REVIEW') {
          throw new Error(
            `BPR Transition Error: Không thể phê duyệt BPR từ trạng thái '${status}'. BPR phải được thẩm tra ở trạng thái 'UNDER_REVIEW' trước khi phê duyệt.`
          );
        }
        return 'APPROVED';

      case 'BPR_REJECT':
        if (status === 'UNDER_REVIEW' || status === 'SUBMITTED') {
          return 'REJECTED';
        }
        throw new Error(
          `BPR Transition Error: Không thể từ chối BPR từ trạng thái '${status}'. Chỉ được từ chối khi UNDER_REVIEW hoặc SUBMITTED.`
        );

      default:
        throw new Error(`Hành động BPR không xác định: ${actionId}`);
    }
  }

  /**
   * Kiểm tra thẩm quyền vai trò đối với hành động BPR
   */
  public static verifyRole(actionId: BprWorkflowActionId, rawRole?: string): void {
    const role = (rawRole || 'USER').toUpperCase();

    if (
      actionId === 'BPR_APPROVE' ||
      actionId === 'BPR_REJECT' ||
      actionId === 'BPR_START_REVIEW'
    ) {
      if (!['QA', 'ADMIN'].includes(role)) {
        throw new Error(
          `BPR Authorization Error: Vai trò '${role}' không có thẩm quyền thực hiện '${actionId}'. Bắt buộc vai trò QA hoặc ADMIN.`
        );
      }
    }
  }
}
