# ADR-001: PQM CANONICAL WORKFLOW STANDARDS & VOCABULARY

## HỢP ĐỒNG TIÊU CHUẨN HÓA KIẾN TRÚC WORKFLOW, DANH TỪ, VAI TRÒ & ACTION-ID

- **Mã tài liệu**: `ADR-001-WORKFLOW-STANDARDS`
- **Trạng thái**: `ACCEPTED` (Bắt buộc tuân thủ 100%)
- **Ngày ban hành**: 2026-09-25
- **Tài liệu căn cứ**:
  - [`docs/workflow/PQM_SYSTEM_WORKFLOW_MASTER.md`](../workflow/PQM_SYSTEM_WORKFLOW_MASTER.md)
  - [`docs/workflow/PQM_SOURCE_OF_TRUTH_MATRIX.md`](../workflow/PQM_SOURCE_OF_TRUTH_MATRIX.md)
  - [`docs/workflow/PQM_STATE_TRANSITION_MATRIX.md`](../workflow/PQM_STATE_TRANSITION_MATRIX.md)
  - [`docs/workflow/PQM_WORKFLOW_FAILURE_MATRIX.md`](../workflow/PQM_WORKFLOW_FAILURE_MATRIX.md)

---

## 1. BỐI CẢNH & VẤN ĐỀ (CONTEXT & PROBLEM STATEMENT)

Hệ thống PQM đang bước vào giai đoạn chuyển đổi toàn diện sang kiến trúc hướng quy trình điều phối thống nhất (**Workflow-Driven Architecture**). Trước đây, một số vị trí trong mã nguồn còn tồn tại:

1. **Phân mảnh danh xưng vai trò (Role Vocabulary Drift)**: Một số catalog workflow sử dụng các role không có thật trong hệ thống (như `manager`, `lead`, `specialist`), gây mâu thuẫn với 8 vai trò chuẩn định nghĩa tại `PROJECT_OVERVIEW.md` và `permissionService.ts`.
2. **Action ID chung chung**: Dùng các action kiểu `UPDATE`, `BATCH_UPDATE`, `SAVE` làm mờ ranh giới trách nhiệm, gây khó khăn cho việc kiểm toán ALCOA+, thẩm quyền ký số (FDA 21 CFR Part 11) và phân loại rủi ro GMP.
3. **Mập mờ quyền sở hữu trạng thái (Status Ownership Ambiguity)**: Lẫn lộn giữa _Trạng thái chất lượng kỹ thuật_ (Quality Status) và _Trạng thái hành chính vòng đời_ (Workflow Status).
4. **Mutations phân tán**: Các lệnh ghi cơ sở dữ liệu (`repo.save`, `repo.update`, `updateStatus`) bị gọi trực tiếp từ UI/hooks/App Services mà không đi qua một kernel điều phối duy nhất có chốt chặn kiểm toán và bảo vệ giao dịch.

Tài liệu ADR này thiết lập **Bản hiến pháp ngôn ngữ chuẩn (Canonical Standards)** để khóa chặt định danh, thẩm quyền và quy tắc đặt tên hành vi trước khi chuyển đổi toàn bộ mã nguồn.

---

## 2. QUY CHUẨN VAI TRÒ HỆ THỐNG (CANONICAL ROLES)

Hệ thống PQM chỉ công nhận **8 vai trò chuẩn mực duy nhất**. Tuyệt đối không tự đặt thêm các vai trò trung gian như `manager`, `lead`, `specialist`, `checker`.

| Canonical Role                | Mã định danh chuẩn | Thẩm quyền cốt lõi                                                                                                                 | Ràng buộc bảo mật GMP                                                                                                                                |
| :---------------------------- | :----------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quản trị viên**             | `ADMIN`            | Toàn quyền quản trị hệ thống, tài khoản, cấu hình và khắc phục sự cố.                                                              | **KHÔNG CÓ BYPASS**: Admin vẫn phải tuân thủ 7 Release Gates khi xuất xưởng lô và phải có chữ ký số/lý do giải trình khi can thiệp dữ liệu nhạy cảm. |
| **Đảm bảo chất lượng**        | `QA`               | Ban hành TCCS, phê duyệt Phiếu kiểm nghiệm, thẩm định xuất xưởng Lô (`RELEASE`), đóng CAPA & Thay đổi (CR), ban hành/ký duyệt CoA. | Người quyết định cuối cùng về việc đưa thuốc ra thị trường.                                                                                          |
| **Kiểm tra chất lượng**       | `QC`               | Soát xét kết quả kiểm nghiệm, cảnh báo OOS/OOT, theo dõi xu hướng SPC, khởi tạo điều tra sự cố.                                    | Giám sát tính tuân thủ quy chuẩn kiểm nghiệm.                                                                                                        |
| **Kiểm nghiệm viên**          | `LAB`              | Nhập kết quả phân tích đo lường, đính kèm dữ liệu phổ/sắc ký, chạy trích xuất OCR Canvas AI.                                       | Chịu trách nhiệm về tính trung thực và độ chính xác của số liệu thô.                                                                                 |
| **Sản xuất**                  | `PRODUCTION`       | Khởi tạo Lô sản xuất mới (`BATCH_CREATE`), cập nhật sản lượng thực tế, hạn dùng và quy cách đóng gói.                              | Không được phép tự ý thay đổi trạng thái sang `RELEASED` hoặc `TESTING`.                                                                             |
| **Người dùng nghiệp vụ**      | `USER`             | Vai trò vận hành thông thường (tương thích ngược cho các thao tác đăng ký lô cơ bản).                                              | Giới hạn trong phạm vi nhập liệu ban đầu.                                                                                                            |
| **Quan sát viên / Thanh tra** | `VIEWER`           | Quyền chỉ đọc (Read-Only) đối với toàn bộ hồ sơ 360°, báo cáo, xu hướng và Audit Trail.                                            | Cấm 100% mọi thao tác sửa đổi dữ liệu (Mutations).                                                                                                   |
| **Khách chờ duyệt**           | `GUEST`            | Tài khoản mới tạo chưa được cấp thẩm quyền. Chỉ xem trang chào mừng `/welcome`.                                                    | Bị chặn truy cập toàn bộ các phân hệ nghiệp vụ.                                                                                                      |
| **Tác nhân hệ thống**         | `SYSTEM`           | Các tiến trình tự động hóa nền: Firebase Functions, Scheduled Cron, Auto-Heal proposal runner.                                     | Chỉ được thực thi các tác vụ bảo trì có nhật ký và correlation ID.                                                                                   |
| **Trợ lý AI**                 | `AI_ADVISORY`      | Trợ lý phân tích, đọc OCR, đối chiếu tên chỉ tiêu, phát hiện xu hướng Nelson Rules.                                                | **CHỈ TẠO PROPOSAL**. Tuyệt đối cấm AI gọi lệnh ghi trực tiếp vào cơ sở dữ liệu.                                                                     |

---

## 3. DANH MỤC THỰC THỂ CHUẨN (CANONICAL ENTITIES)

Hệ thống chuẩn hóa 15 loại thực thể (`EntityType`) có tính chất điều phối:

```typescript
export type EntityType =
  | 'PRODUCT' // Hồ sơ sản phẩm
  | 'MATERIAL' // Nguyên phụ liệu, bao bì
  | 'TCCS' // Tiêu chuẩn cơ sở kỹ thuật
  | 'FORMULA' // Công thức định tính, định lượng
  | 'BATCH' // Lô sản xuất
  | 'TEST_RESULT' // Phiếu kiểm nghiệm (PKN)
  | 'QUALITY_SNAPSHOT' // Niêm phong toàn vẹn ALCOA+ SHA-256
  | 'OOS' // Sự cố ngoài tiêu chuẩn (Out of Specification)
  | 'DEVIATION' // Sai lệch chất lượng
  | 'CAPA' // Hành động khắc phục & phòng ngừa
  | 'CHANGE_REQUEST' // Kiểm soát thay đổi (Change Control)
  | 'COA' // Chứng nhận phân tích chất lượng
  | 'APPROVAL_TASK' // Tác vụ phê duyệt & Chữ ký điện tử CFR Part 11
  | 'MASTER_DATA' // Danh mục dùng chung (Phòng Lab, Dược điển, Master Criteria)
  | 'SYSTEM'; // Cấu hình hệ thống, Backup, Dữ liệu toàn vẹn
```

---

## 4. NGUYÊN TẮC PHÂN ĐỊNH SỞ HỮU TRẠNG THÁI (STATUS OWNERSHIP)

Tuân thủ triệt để `PRINCIPLE-002` (Quality ≠ Workflow Decoupling):

1. **Trạng thái chất lượng kỹ thuật (`QualityStatus`)**:
   - Giá trị Canonical: `PASS` | `FAIL` | `PENDING` | `UNKNOWN`
   - **Chủ sở hữu độc quyền (Exclusive Owner)**: `QualityEvaluationEngine` và `CanonicalStatusResolver`.
   - **Bất biến**: Không một người dùng nào (kể cả Admin) hay màn hình UI nào được phép gán đè trực tiếp trường này. Nó là kết quả tính toán tất định dựa trên kết quả các chỉ tiêu và quy tắc TCCS.
2. **Trạng thái quy trình hành chính (`WorkflowStatus`)**:
   - Đối với Lô: `PENDING` ➔ `TESTING` ➔ `RELEASED` | `REJECTED` (kèm trạng thái mở rộng `HOLD`, `RECALLED`).
   - Đối với Phiếu kiểm nghiệm: `DRAFT` ➔ `SUBMITTED` ➔ `IN_REVIEW` ➔ `APPROVED` | `REJECTED` | `CANCELLED`.
   - Đối với TCCS: `DRAFT` ➔ `PENDING_APPROVAL` ➔ `ACTIVE` ➔ `OBSOLETE`.
   - **Chủ sở hữu độc quyền**: Các State Machine chuyên trách (`BatchStateMachine`, `TestResultWorkflowStateMachine`, `TccsStateMachine`, etc.) thông qua `UnifiedWorkflowExecutor`.

---

## 5. QUY ƯỚC ĐẶT TÊN HÀNH ĐỘNG WORKFLOW (ACTION-ID CONVENTION)

Mỗi hành vi làm thay đổi trạng thái hoặc dữ liệu có quy chuẩn (Regulated Mutation) phải có một `WorkflowActionId` duy nhất, định dạng theo mẫu:

```text
[ENTITY]_[SPECIFIC_ACTION]
hoặc
[SUB_DOMAIN]_[ENTITY]_[SPECIFIC_ACTION]
```

**Quy tắc bất biến**:

- **KHÔNG** dùng các action ID chung chung như `UPDATE`, `SAVE`, `EDIT`, `MUTATE`.
- Mỗi action ID phải đại diện cho một rủi ro và thẩm quyền rõ ràng.
- Bảng danh mục canonical actions đầy đủ:

### 5.1. Test Result & Quality Evaluation

- `TEST_RESULT_CREATE`: Khởi tạo phiếu kiểm nghiệm mới (gắn TCCS active).
- `TEST_RESULT_ENTRY_INPUT`: Lưu kết quả đo lường từng chỉ tiêu.
- `TEST_RESULT_SUBMIT`: Kiểm nghiệm viên nộp phiếu chờ duyệt.
- `TEST_RESULT_APPROVE`: QA phê duyệt phiếu kiểm nghiệm (tạo evaluation snapshot).
- `TEST_RESULT_REJECT`: QA từ chối phiếu kiểm nghiệm yêu cầu kiểm tra lại.
- `TEST_RESULT_CANCEL`: Hủy phiếu kiểm nghiệm chưa duyệt.
- `TEST_RESULT_REVOKE`: Thu hồi phiếu kiểm nghiệm đã duyệt (yêu cầu lý do và chữ ký số).
- `TEST_RESULT_REEVALUATE`: Tái thẩm định snapshot khi TCCS hoặc dữ liệu sửa đổi có kiểm soát.

### 5.2. Batch Lifecycle & Release Gate

- `BATCH_CREATE`: Tạo hồ sơ Lô mới (luôn khởi tạo ở `PENDING`).
- `BATCH_DISPATCH_TESTING`: Chuyển lô sang trạng thái kiểm nghiệm `TESTING`.
- `BATCH_EVALUATE_RELEASE`: Đánh giá 7 Release Gates xuất xưởng lô (chạy evaluator).
- `BATCH_RELEASE_APPROVE`: QA ký điện tử xuất xưởng lô đạt tiêu chuẩn.
- `BATCH_REJECT`: QA từ chối xuất xưởng lô do không đạt chất lượng.
- `BATCH_HOLD`: Tạm giữ lô nghi ngờ chất lượng để thanh tra.
- `BATCH_RECALL`: Thu hồi lô đã xuất xưởng khỏi thị trường.

### 5.3. Deviation & OOS

- `DEVIATION_CREATE`: Ghi nhận sự cố sai lệch chất lượng mới (tự động hoặc thủ công).
- `DEVIATION_INVESTIGATE`: Nhập báo cáo điều tra nguyên nhân gốc rễ (RCA, 5 Whys, Ishikawa).
- `DEVIATION_APPROVE`: QA phê duyệt kết luận điều tra sai lệch.
- `DEVIATION_CLOSE`: Đóng hồ sơ sai lệch sau khi hoàn thành xử lý.
- `DEVIATION_DELETE`: Xóa hồ sơ sai lệch rác/nhập nhầm (chỉ Admin + lý do bắt buộc).
- `OOS_CREATE`: Ghi nhận kết quả ngoài tiêu chuẩn OOS (tự động kích hoạt khi chỉ tiêu FAIL).
- `OOS_PHASE1_LAB_INVESTIGATE`: Điều tra lỗi phòng Lab (Giai đoạn 1).
- `OOS_PHASE2_MFG_INVESTIGATE`: Điều tra quy trình sản xuất (Giai đoạn 2).
- `OOS_CONCLUDE`: Kết luận xử lý OOS.

### 5.4. CAPA (Corrective and Preventive Action)

- `CAPA_CREATE`: Khởi tạo hành động khắc phục/phòng ngừa liên kết Sai lệch/OOS.
- `CAPA_ASSIGN`: Phân công nhân sự thực hiện hành động.
- `CAPA_COMPLETE`: Nhân sự đánh dấu hoàn thành hành động.
- `CAPA_VERIFY`: QA thẩm tra tính hiệu quả của biện pháp CAPA.
- `CAPA_CLOSE`: QA chính thức đóng hồ sơ CAPA.

### 5.5. Change Control (Kiểm soát Thay đổi)

- `CHANGE_REQUEST_CREATE`: Khởi tạo yêu cầu thay đổi mới (CR-YYYY-XXXX).
- `CHANGE_REQUEST_FMEA_ASSESS`: Đánh giá rủi ro FMEA (S x O x D = RPN).
- `CHANGE_REQUEST_ADD_ACTION`: Bổ sung hành động trong kế hoạch thay đổi.
- `CHANGE_REQUEST_COMPLETE_ACTION`: Hoàn thành hành động trong kế hoạch.
- `CHANGE_REQUEST_REVIEW`: Hội đồng chuyên môn soát xét đề xuất thay đổi.
- `CHANGE_REQUEST_APPROVE`: QA phê duyệt cho phép triển khai thay đổi.
- `CHANGE_REQUEST_REJECT`: QA từ chối yêu cầu thay đổi.
- `CHANGE_REQUEST_IMPLEMENT`: Bắt đầu triển khai kế hoạch thực tế.
- `CHANGE_REQUEST_CLOSE`: QA đóng hồ sơ thay đổi khi 100% hành động hoàn tất.

### 5.6. Approval & e-Signature & CoA

- `APPROVAL_TASK_CREATE`: Khởi tạo nhiệm vụ phê duyệt liên kết thực thể.
- `APPROVAL_TASK_DECIDE`: Người có thẩm quyền phê duyệt hoặc từ chối kèm chữ ký số CFR Part 11.
- `APPROVAL_TASK_CANCEL`: Hủy bỏ yêu cầu phê duyệt khi thay đổi kế hoạch.
- `COA_GENERATE`: Sinh phiếu phân tích thành phẩm từ Locked Evaluation Snapshot.
- `COA_SIGN`: QA ký duyệt ban hành chứng chỉ CoA điện tử.
- `COA_REVOKE`: Thu hồi hiệu lực của chứng nhận CoA đã ban hành.
- `COA_VERIFY_PUBLIC`: Truy vấn xác thực công khai mã QR chứng chỉ (Read-only, không mutation).

### 5.7. Master Data Operations

- `PRODUCT_CREATE`, `PRODUCT_UPDATE`, `PRODUCT_ARCHIVE`
- `MATERIAL_CREATE`, `MATERIAL_UPDATE`, `MATERIAL_DELETE`
- `TCCS_CREATE`, `TCCS_UPDATE_DRAFT`, `TCCS_SUBMIT`, `TCCS_APPROVE`, `TCCS_REVISE`, `TCCS_OBSOLETE`
- `FORMULA_CREATE`, `FORMULA_UPDATE`, `FORMULA_ARCHIVE`
- `CRITERIA_MASTER_CREATE`, `CRITERIA_MASTER_UPDATE`, `CRITERIA_ALIAS_MAP`
- `LAB_MASTER_CREATE`, `LAB_MASTER_UPDATE`
- `PHARMACOPOEIA_CREATE`, `PHARMACOPOEIA_UPDATE`, `PHARMACOPOEIA_DELETE`

### 5.8. System Operations & Data Integrity

- `SYSTEM_BACKUP_EXECUTE`: Sao lưu cơ sở dữ liệu hệ thống (Admin).
- `SYSTEM_RESTORE_EXECUTE`: Phục hồi dữ liệu từ bản sao lưu (Admin + typed confirmation token).
- `SYSTEM_WIPE_DEMO_EXECUTE`: Xóa dữ liệu mẫu/thực nghiệm (Admin + typed token + dual confirmation).
- `SYSTEM_AUTO_HEAL_PROPOSE`: Hệ thống/AI đề xuất phương án hàn gắn toàn vẹn.
- `SYSTEM_AUTO_HEAL_APPROVE`: QA/Admin phê duyệt kế hoạch hàn gắn.
- `SYSTEM_AUTO_HEAL_EXECUTE`: Thực thi kế hoạch hàn gắn nguyên tử có rollback handler.

### 5.9. AI Advisory Operations (Proposal Envelope)

- `AI_OCR_EXTRACT`: Đọc phân đoạn PDF và trích xuất chỉ tiêu (Advisory, no DB write).
- `AI_MAPPING_PROPOSE`: Gợi ý ánh xạ tên viết tắt/OCR sang Canonical Criterion (Proposal only).
- `AI_STABILITY_PREDICT`: Tính toán suy giảm hạn dùng ICH Q1A (Advisory calculation).
- `AI_BATCH_CLEARANCE_PROPOSE`: Trợ lý soát xét hồ sơ xuất xưởng (Proposal only).
- `AI_NATURAL_QUERY`: Truy vấn hỏi đáp dữ liệu ngôn ngữ tự nhiên (Read-only).

---

## 6. HẬU QUẢ & CHẾ TÀI KIẾN TRÚC (CONSEQUENCES)

1. Mọi PR hoặc commit chứa action role không thuộc 8 Canonical Roles sẽ bị chặn bởi CI Test.
2. Mọi lệnh ghi cơ sở dữ liệu phát sinh ngoài `WorkflowFacade` và các workflow handler được coi là lỗ hổng an ninh kiến trúc cần lập tức đưa vào `WORKFLOW_GAP_REGISTER.md`.
3. Hành vi của ứng dụng trong Phase 0 được giữ nguyên trạng (Baseline Freeze); script inventory sẽ cung cấp bức tranh số liệu trung thực tuyệt đối về 100% activities trong toàn bộ codebase.
