# APPROVAL_CONTRACT: Hợp Đồng Quy Trình Phê Duyệt & Kiểm Soát Nhiệm Vụ (Approval & SoD Task Contract)

Tài liệu này chuẩn hóa toàn bộ cấu trúc dữ liệu của các tác vụ phê duyệt đa cấp (Multi-Level Approval Pipeline), hàng đợi công việc thẩm tra (Approval Work Queue) và cơ chế rào chắn chống vi phạm Tách biệt trách nhiệm (Segregation of Duties - SoD).

---

## 1. Bản Chất Nghiệp Vụ

- **Approval Pipeline (Đường ống phê duyệt)**: Mọi tài liệu pháp lý (Phiếu kiểm nghiệm, TCCS, Xuất xưởng lô, Đóng OOS/Deviation) đều phải qua các cổng thẩm duyệt tuần tự: `MAKER` (Người lập) -> `CHECKER / REVIEWER` (Người thẩm tra) -> `APPROVER` (Người phê duyệt).
- **Segregation of Duties (SoD)**: Ngăn chặn tuyệt đối tình huống một người kiêm nhiệm cả người làm lẫn người duyệt, hoặc người duyệt không đúng thẩm quyền.

---

## 2. Định Nghĩa Kiểu Dữ Liệu (TypeScript Domain Interface)

```typescript
export type ApprovalEntityType =
  | 'TEST_RESULT' // Phiếu kiểm nghiệm
  | 'BATCH_RELEASE' // Quyết định xuất xưởng lô
  | 'TCCS_STANDARD' // Ban hành TCCS
  | 'OOS_DISPOSITION' // Đóng hồ sơ điều tra OOS
  | 'DEVIATION_CLOSURE' // Đóng hồ sơ sai lệch
  | 'CAPA_APPROVAL'; // Phê duyệt kế hoạch CAPA

export type ApprovalTaskStatus =
  | 'PENDING' // Đang chờ người dùng xử lý
  | 'APPROVED' // Đã được chấp thuận
  | 'REJECTED' // Bị từ chối, yêu cầu hoàn trả/sửa đổi
  | 'ESCALATED' // Quá hạn xử lý, chuyển tiếp lên cấp cao hơn
  | 'CANCELLED'; // Hủy bỏ do đối tượng nguồn bị thu hồi

export interface ApprovalStepDefinition {
  stepIndex: number; // Thứ tự bước: 1, 2, 3...
  stepName: string; // "Thẩm tra số liệu KCS", "Phê duyệt QA"
  requiredRole: 'QA_REVIEWER' | 'QA_MANAGER' | 'PLANT_DIRECTOR' | 'QUALIFIED_PERSON';
  allowedUserIds?: string[]; // Danh sách người dùng được ủy quyền cụ thể
  requireDigitalSignature: boolean; // Bắt buộc nhập mật khẩu ký 21 CFR Part 11
  timeoutHours?: number; // Giới hạn thời gian xử lý (SLA)
}

export interface ApprovalTaskContract {
  taskId: string;
  entityType: ApprovalEntityType;
  entityId: string;
  entityReferenceCode: string; // Mã số lô hoặc số PKN để nhận diện nhanh

  // Thông tin bước duyệt hiện tại
  currentStepIndex: number;
  totalSteps: number;
  currentStepName: string;
  status: ApprovalTaskStatus;

  // Thông tin người tạo ban đầu (Maker) để kiểm tra SoD
  originator: {
    userId: string;
    userName: string;
    submittedAt: string;
  };

  // Tiến trình lịch sử các bước đã thực hiện
  executionHistory: Array<{
    stepIndex: number;
    actorId: string;
    actorName: string;
    actorRole: string;
    action: 'APPROVE' | 'REJECT' | 'DELEGATE';
    actedAt: string;
    comments?: string;
    rejectionReason?: string;
    signatureChecksum?: string;
    isSoDVerified: boolean; // Cờ xác nhận không vi phạm nguyên tắc tách biệt
  }>;

  // Khóa kiểm soát bảo mật
  securityGuard: {
    forbiddenApproverIds: string[]; // Danh sách ID người bị cấm duyệt bước này (bao gồm cả Originator)
    minimumReviewTimeSeconds: number; // Tránh tình trạng bấm duyệt tự động trong 0.1 giây (Anti-bot/Anti-rush)
  };

  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Bất Biến Ràng Buộc (Invariants)

1. **Originator cấm duyệt**: `originator.userId` luôn nằm trong `securityGuard.forbiddenApproverIds` ở tất cả các bước phê duyệt tiếp theo.
2. **Tuần tự nghiêm ngặt**: Không được kích hoạt bước `stepIndex = 2` khi bước `stepIndex = 1` chưa có trạng thái `APPROVED`.
3. **Từ chối là dừng luồng (Rejection Rollback)**: Bất kỳ bước nào bấm `REJECT`, toàn bộ tác vụ chuyển sang `REJECTED`, trả hồ sơ về cho người tạo ban đầu kèm lý do bắt buộc.
