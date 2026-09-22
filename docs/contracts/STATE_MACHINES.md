# STATE_MACHINES: Đặc Tả Toàn Diện 4 Máy Trạng Thái Hữu Hạn Độc Lập PQM (Finite State Machines)

Tài liệu này chuẩn hóa toàn bộ 4 Máy Trạng Thái Hữu Hạn (FSM) độc lập trong hệ thống PQM:

1. **Batch Workflow FSM** (Vòng đời Lô Sản Phẩm)
2. **TestResult Workflow FSM** (Vòng đời Phiếu Kiểm Nghiệm)
3. **Criterion State FSM** (Vòng đời Thực thi & Chất lượng Chỉ tiêu)
4. **Alternate Rule FSM** (Vòng đời Kích hoạt & Giải quyết Quy tắc Thay thế)

Mỗi FSM được định nghĩa tường minh với: Trạng thái (States), Sự kiện kích hoạt (Triggers), Tác nhân (Actors), Điều kiện tiên quyết (Preconditions), Bước chuyển hợp lệ (Allowed Transitions), Bước chuyển bị cấm (Forbidden Transitions), Đầu ra (Outputs) và Yêu cầu kiểm toán (Audit Trail).

---

## 1. FSM 1: BATCH WORKFLOW FINITE STATE MACHINE

### 1.1. Danh Sách Trạng Thái

- `DRAFT`: Lô mới tạo trên hệ thống, đang chờ lệnh sản xuất.
- `IN_PRODUCTION`: Đang trong dây chuyền sản xuất tại phân xưởng.
- `TESTING`: Sản xuất xong, đã gửi mẫu sang phòng QC để kiểm nghiệm.
- `QA_REVIEW`: Hoàn tất kiểm nghiệm 100%, QA đang thẩm tra hồ sơ lô điện tử (BPR) và kết quả kiểm nghiệm.
- `APPROVED`: QA xác nhận chất lượng đạt chuẩn, đủ điều kiện tiến hành thủ tục xuất xưởng.
- `RELEASED`: Đã vượt qua 7 Release Gates, Trưởng phòng QA ký lệnh xuất xưởng chính thức.
- `REJECTED`: Lô bị loại bỏ do không đạt chất lượng (Terminal State).
- `HOLD`: Lô bị tạm đình chỉ lưu thông sau khi xuất xưởng để điều tra sự cố.
- `RECALLED`: Thu hồi toàn quốc đối với lô đã phát hành ra thị trường (Terminal State).

### 1.2. Sơ Đồ Chuyển Đổi Trạng Thái

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Khởi tạo hồ sơ Lô
    DRAFT --> IN_PRODUCTION: Lệnh sản xuất ban hành
    IN_PRODUCTION --> TESTING: Giao nhận mẫu KCS

    TESTING --> QA_REVIEW: Hoàn tất 100% chỉ tiêu (Pass/Fail)
    TESTING --> REJECTED: Lỗi chí mạng sản xuất / Không thể khắc phục

    QA_REVIEW --> APPROVED: QA thẩm tra Đạt (Canonical Quality = PASS)
    QA_REVIEW --> TESTING: QA yêu cầu kiểm tra lại / Thử nghiệm bổ sung
    QA_REVIEW --> REJECTED: QA bác bỏ hồ sơ lô

    APPROVED --> RELEASED: Vượt qua 7 Release Gates (Ký 21 CFR Part 11)
    APPROVED --> REJECTED: Phát hiện sai lệch nghiêm trọng trước giờ xuất xưởng

    RELEASED --> HOLD: Có cảnh báo chất lượng / Khiếu nại nghiêm trọng
    HOLD --> RELEASED: Giải tỏa nghi ngờ (Investigation Cleared)
    HOLD --> RECALLED: Kết luận nguy cơ cho bệnh nhân

    RELEASED --> RECALLED: Quyết định thu hồi khẩn cấp từ Bộ Y tế

    REJECTED --> [*]
    RECALLED --> [*]
```

### 1.3. Bảng Quy Tắc Chuyển Đổi Chi Tiết (Transition Rules)

| Từ trạng thái   | Tới trạng thái  | Trigger (Sự kiện)  | Actor (Quyền hạn)   | Precondition (Điều kiện tiên quyết)                       | Forbidden Rule (Cấm kỵ)              |
| :-------------- | :-------------- | :----------------- | :------------------ | :-------------------------------------------------------- | :----------------------------------- |
| `DRAFT`         | `IN_PRODUCTION` | `START_PROD`       | `PRODUCTION`        | Đã gán công thức và Snapshot TCCS hợp lệ                  | Cấm chuyển nếu TCCS chưa `EFFECTIVE` |
| `IN_PRODUCTION` | `TESTING`       | `SUBMIT_QC_SAMPLE` | `PRODUCTION` / `QC` | Biên bản bàn giao mẫu đã ký                               | Cấm nếu số lượng mẫu = 0             |
| `TESTING`       | `QA_REVIEW`     | `COMPLETE_TESTING` | `QA_REVIEWER`       | 100% chỉ tiêu đã kiểm xong (`progress = 100%`)            | Cấm nếu còn chỉ tiêu `PENDING`       |
| `QA_REVIEW`     | `APPROVED`      | `APPROVE_BATCH`    | `QA_MANAGER`        | `CanonicalStatusResolver.overallQualityStatus === 'PASS'` | **CẤM DUYỆT NẾU CHẤT LƯỢNG != PASS** |
| `QA_REVIEW`     | `TESTING`       | `RETURN_QC`        | `QA_MANAGER`        | Bắt buộc nhập lý do yêu cầu kiểm lại                      | Cấm trả về nếu không có ghi chú      |
| `APPROVED`      | `RELEASED`      | `EXECUTE_RELEASE`  | `QA_MANAGER` / `QP` | Thỏa mãn đồng thời cả 7 Release Gates                     | **CẤM BYPASS BẤT KỲ CỔNG NÀO**       |
| `RELEASED`      | `HOLD`          | `ISSUE_HOLD`       | `QA_MANAGER`        | Bắt buộc có mã số phiếu sai lệch/khiếu nại                | Cấm giữ lô vô cớ                     |
| `HOLD`          | `RECALLED`      | `ISSUE_RECALL`     | `QUALITY_DIRECTOR`  | Có quyết định thu hồi bằng văn bản                        | Không thể hoàn tác sau khi đã Recall |

---

## 2. FSM 2: TESTRESULT WORKFLOW FINITE STATE MACHINE

### 2.1. Danh Sách Trạng Thái

- `DRAFT`: Kỹ thuật viên (Analyst) đang tạo và nhập số liệu thô.
- `SUBMITTED`: Đã nhập đủ dữ liệu, nộp lên cho Trưởng nhóm KCS thẩm định.
- `REVIEWED`: Trưởng nhóm KCS / QA Reviewer đã thẩm tra số liệu gốc và phương pháp thử.
- `APPROVED`: Trưởng phòng QA đã ký số điện tử phê duyệt chính thức.
- `REJECTED`: Bị từ chối tại bước Thẩm tra hoặc Phê duyệt, trả về cho Analyst làm lại.
- `REVOKED`: Đã duyệt nhưng bị thu hồi vô hiệu do phát hiện gian lận hoặc sai sót thiết bị.

### 2.2. Sơ Đồ Chuyển Đổi Trạng Thái

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Tạo phiếu kiểm nghiệm
    DRAFT --> SUBMITTED: Analyst nộp kết quả

    SUBMITTED --> REVIEWED: QA Reviewer duyệt tính toàn vẹn (reviewerId != analystId)
    SUBMITTED --> REJECTED: QA Reviewer từ chối (Lý do bắt buộc)

    REVIEWED --> APPROVED: QA Manager ký số 21 CFR Part 11
    REVIEWED --> REJECTED: QA Manager từ chối

    REJECTED --> DRAFT: Analyst mở khóa sửa chữa và nộp lại

    APPROVED --> REVOKED: Thu hồi đặc biệt có biên bản
    REVOKED --> [*]
```

### 2.3. Bảng Chuyển Đổi & Kiểm Soát Segregation of Duties (SoD)

| Từ trạng thái | Tới trạng thái | Actor         | Điều kiện SoD & Tính hợp lệ                     | Hành vi hệ thống                                         |
| :------------ | :------------- | :------------ | :---------------------------------------------- | :------------------------------------------------------- |
| `DRAFT`       | `SUBMITTED`    | `Analyst`     | Đã điền đầy đủ các trường đo bắt buộc           | Khóa quyền sửa của Analyst (`isLocked = true`)           |
| `SUBMITTED`   | `REVIEWED`     | `QA_Reviewer` | `currentUserId !== analystId`                   | Ghi vết kiểm toán Review, chuyển lên hàng đợi QA Manager |
| `SUBMITTED`   | `REJECTED`     | `QA_Reviewer` | Bắt buộc có `rejectionReason` (>= 20 ký tự)     | Mở khóa cho Analyst sửa lại                              |
| `REVIEWED`    | `APPROVED`     | `QA_Manager`  | `currentUserId !== analystId` & không có OOS mở | Ký số SHA-256, khóa vĩnh viễn dữ liệu                    |
| `APPROVED`    | `REVOKED`      | `QA_Manager`  | Lô liên quan chưa được `RELEASED`               | Đánh dấu vô hiệu, tạo Revision mới dạng `DRAFT`          |

---

## 3. FSM 3: CRITERION STATE FINITE STATE MACHINE

### 3.1. Danh Sách Trạng Thái

- `NOT_STARTED`: Chỉ tiêu chưa được lấy mẫu kiểm nghiệm.
- `REQUIRED`: Chỉ tiêu bắt buộc phải làm theo quy định của TCCS.
- `TESTING`: Đang trong quá trình thử nghiệm trong phòng lab.
- `COMPLETED`: Đã đo xong và ghi nhận kết quả số/chữ.
- `PASS`: Đạt tiêu chuẩn chấp nhận.
- `FAIL`: Vượt ngưỡng cho phép (Không đạt chuẩn).
- `EXEMPTED`: Miễn kiểm nghiệm thực tế do kích hoạt quy tắc thay thế hợp lệ.
- `NOT_APPLICABLE`: Không áp dụng cho lô hàng này.

### 3.2. Sơ Đồ Chuyển Đổi Trạng Thái

```mermaid
stateDiagram-v2
    [*] --> NOT_STARTED
    NOT_STARTED --> REQUIRED: Gán theo Snapshot TCCS
    NOT_STARTED --> NOT_APPLICABLE: Miễn trừ theo quy cách lô

    REQUIRED --> TESTING: Bắt đầu tiến hành phép thử
    REQUIRED --> EXEMPTED: Quy tắc thay thế CONDITIONAL_CHECK hợp lệ

    TESTING --> COMPLETED: Ghi nhận kết quả đo thô
    COMPLETED --> PASS: Giá trị nằm trong [Min, Max] hoặc Khớp chuẩn định tính
    COMPLETED --> FAIL: Giá trị vượt ngoài [Min, Max] (Kích hoạt OOS)

    FAIL --> PASS: Quy tắc thay thế FAIL_RETRY cứu thành công lần 2
```

### 3.3. Bảng Chuyển Đổi & Quy Tắc Toán Học

| Trạng thái hiện tại | Kết quả thử nghiệm                    | Trạng thái tiếp theo | Quy tắc logic                          |
| :------------------ | :------------------------------------ | :------------------- | :------------------------------------- |
| `NOT_STARTED`       | Khởi tạo Lô                           | `REQUIRED`           | Nếu `criterion.isMandatory === true`   |
| `REQUIRED`          | Analyst mở sổ tay phòng lab           | `TESTING`            | Ghi nhận thời gian bắt đầu làm         |
| `TESTING`           | Nhập $X \in [Min, Max]$               | `PASS`               | Đạt tiêu chuẩn                         |
| `TESTING`           | Nhập $X \notin [Min, Max]$            | `FAIL`               | Tự động kích hoạt thông báo OOS        |
| `FAIL`              | Thử lại lần 2 theo Alternate Rule đạt | `PASS`               | Áp dụng BR-ALT-001 (FAIL_RETRY)        |
| `REQUIRED`          | Chỉ tiêu điều kiện đạt                | `EXEMPTED`           | Áp dụng BR-ALT-002 (CONDITIONAL_CHECK) |

---

## 4. FSM 4: ALTERNATE RULE FINITE STATE MACHINE

### 4.1. Danh Sách Trạng Thái

- `NOT_APPLICABLE`: Quy tắc không có hiệu lực cho lô này.
- `NOT_TRIGGERED`: Điều kiện kích hoạt chưa diễn ra (đang chờ kết quả chỉ tiêu chính).
- `TRIGGERED_PENDING`: Đã kích hoạt điều kiện thay thế, đang chờ làm phép thử phụ/mở rộng.
- `TRIGGERED_PASS`: Phép thử phụ đã hoàn tất và ĐẠT -> Cứu chỉ tiêu chính Đạt.
- `TRIGGERED_FAIL`: Phép thử phụ đã hoàn tất nhưng KHÔNG ĐẠT -> Khẳng định Lô Không Đạt.

### 4.2. Sơ Đồ Chuyển Đổi Trạng Thái

```mermaid
stateDiagram-v2
    [*] --> NOT_TRIGGERED
    NOT_TRIGGERED --> NOT_APPLICABLE: TCCS không áp dụng cho lô
    NOT_TRIGGERED --> NOT_APPLICABLE: Primary Criterion ĐẠT (đối với FAIL_RETRY)

    NOT_TRIGGERED --> TRIGGERED_PENDING: Điều kiện kích hoạt xảy ra (Primary FAIL hoặc Trigger Condition thỏa mãn)

    TRIGGERED_PENDING --> TRIGGERED_PASS: Substitute Criterion hoàn thành và ĐẠT
    TRIGGERED_PENDING --> TRIGGERED_FAIL: Substitute Criterion hoàn thành nhưng KHÔNG ĐẠT

    TRIGGERED_PASS --> [*]
    TRIGGERED_FAIL --> [*]
```

### 4.3. Bảng Chuyển Đổi & Pháp Lý Footnote

| Loại quy tắc  | Kết quả Primary | Trạng thái FSM      | Kết quả Substitute | Phán quyết cuối cùng | Hiển thị CoA                          |
| :------------ | :-------------- | :------------------ | :----------------- | :------------------- | :------------------------------------ |
| `FAIL_RETRY`  | `PASS`          | `NOT_APPLICABLE`    | Không cần làm      | `PASS`               | Hiển thị kết quả lần 1                |
| `FAIL_RETRY`  | `FAIL`          | `TRIGGERED_PENDING` | Đang làm lần 2     | `PENDING`            | Chưa xuất bản được CoA                |
| `FAIL_RETRY`  | `FAIL`          | `TRIGGERED_PASS`    | `PASS`             | `PASS`               | Kết quả lần 2 kèm footnote giải trình |
| `FAIL_RETRY`  | `FAIL`          | `TRIGGERED_FAIL`    | `FAIL`             | `FAIL`               | Kết luận Không Đạt chính thức         |
| `CONDITIONAL` | `PASS`          | `TRIGGERED_PASS`    | Miễn làm           | `PASS`               | Ghi "Miễn thử" kèm căn cứ footnote    |

---

## 5. Nguyên Tắc Đồng Bộ Giữa Các FSM (FSM Cross-Synchronization Invariants)

1. **Hierarchy Cascade**:
   - `Batch FSM` là FSM cấp cao nhất chi phối toàn bộ các FSM con.
   - Khi `Batch FSM` đang ở `DRAFT` hoặc `IN_PRODUCTION`, `TestResult FSM` không được phép chuyển sang `APPROVED`.
   - Khi `Criterion FSM` còn bất kỳ chỉ tiêu nào ở trạng thái `REQUIRED` hoặc `TESTING`, `Batch FSM` không được phép chuyển sang `QA_REVIEW`.
2. **Deterministic State Resolution**: Trạng thái chất lượng của Lô là một hàm toán học thuần túy (Deterministic Pure Function):
   $$\text{BatchQualityStatus} = f(\{\text{CriterionState}_i\}, \{\text{AlternateRuleState}_j\})$$
   Không có biến ngẫu nhiên, không phụ thuộc vào trạng thái UI.
3. **Audit Trail Synchronization**: Mọi chuyển dịch trạng thái trên cả 4 FSM bắt buộc phải ghi nhận đồng thời vào `AuditRecord` với chữ ký số và mã băm toàn vẹn tương ứng.
