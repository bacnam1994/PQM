# GENEALOGY_RULES: Danh Mục Quy Tắc Phả Hệ Dữ Liệu Lô & Truy Vết (Batch Genealogy & Traceability Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc nghiệp vụ về Cây phả hệ lô (Batch Genealogy), đảm bảo khả năng truy xuất nguồn gốc hai chiều (Forward Traceability & Backward Traceability) từ nguyên liệu ban đầu đến thành phẩm xuất xưởng và ngược lại theo chuẩn GMP/Data Integrity.

---

## 1. BR-GEN-001: Cây Phả Hệ Lô Hai Chiều Toàn Diện (Bidirectional Batch Genealogy Rule)

- **Rule ID**: `BR-GEN-001`
- **Purpose**: Đảm bảo từ bất kỳ lô sản phẩm nào, hệ thống có thể truy vết ngược về toàn bộ các lô nguyên liệu, bán thành phẩm, quy trình, kết quả kiểm nghiệm đã cấu thành nên nó; và từ một lô nguyên liệu có thể truy vết xuôi ra tất cả các lô thành phẩm đã sử dụng nó.
- **Actor**: `System` (Tự động xây dựng đồ thị), `QA_Specialist` (Người truy vết).
- **Trigger**: Khi tiếp nhận yêu cầu điều tra chất lượng, xử lý khiếu nại, thu hồi sản phẩm hoặc thanh tra định kỳ.
- **Input**:
  - `targetType`: Loại đối tượng (`FINISHED_PRODUCT`, `SEMI_FINISHED`, `RAW_MATERIAL`, `PACKAGING_MATERIAL`).
  - `targetBatchId` hoặc `targetBatchNumber`: Mã định danh hoặc số lô cần truy vết.
  - `traceDirection`: Hướng truy vết (`BACKWARD` - Ngược về nguồn gốc, `FORWARD` - Xuôi theo dòng phân phối/sử dụng, `BOTH` - Hai chiều).
- **Preconditions**: Dữ liệu công thức (Formula), phiếu xuất kho nguyên liệu và phân bổ lô (Batch Material Allocation) đã được ghi nhận trong hệ thống.
- **Decision Logic**:
  - **Truy vết ngược (Backward Traceability - Root Cause Analysis)**:
    - Bắt đầu từ Lô Thành phẩm (Finished Product Batch).
    - Duyệt qua: Lô bán thành phẩm (Semi-finished) -> Danh sách lô nguyên liệu hoạt chất & tá dược được cân (Dispensed RM Batches) -> Nhà cung cấp & Giấy kiểm nghiệm nguyên liệu (RM CoA / Test Results).
    - Liên kết tới: Thiết bị sản xuất sử dụng, Hồ sơ sai lệch (Deviations) phát sinh, Kết quả kiểm nghiệm IPC (Kiểm soát trong quá trình) và Kết quả kiểm nghiệm Thành phẩm cuối cùng.
  - **Truy vết xuôi (Forward Traceability - Impact / Recall Scope)**:
    - Bắt đầu từ một Lô Nguyên liệu hoặc Bán thành phẩm nghi ngờ bị lỗi/nhiễm chéo.
    - Tìm kiếm toàn bộ các Lô Thành phẩm đã sử dụng lô nguyên liệu đó (thông qua bảng ánh xạ `BatchMaterialAllocations`).
    - Xác định danh sách số hóa đơn / khách hàng / kho phân phối đã nhận các lô thành phẩm liên quan để phục vụ lệnh thu hồi khẩn cấp.
- **Decision Table**:

| Điểm bắt đầu truy vết   | Hướng duyệt | Kết quả kỳ vọng trích xuất                                                         | Thời gian phản hồi tối đa |
| :---------------------- | :---------- | :--------------------------------------------------------------------------------- | :------------------------ |
| Lô Thành phẩm (FP-123)  | `BACKWARD`  | Toàn bộ cây nguyên vật liệu cấu thành, nhà cung ứng, kết quả kiểm nghiệm đầu vào   | < 5 giây                  |
| Lô Nguyên liệu (RM-456) | `FORWARD`   | Danh sách toàn bộ các lô BTP và TP đã dùng nguyên liệu này, trạng thái của từng lô | < 5 giây                  |
| Lô có OOS / Deviation   | `BOTH`      | Toàn bộ mạng lưới quan hệ để đánh giá mức độ ảnh hưởng diện rộng                   | < 10 giây                 |

- **Output**:
  - Đồ thị phả hệ dạng cây/DAG (Directed Acyclic Graph): Danh sách các nút (Nodes: Batches, Materials, Tests) và các cạnh (Edges: Produced_From, Tested_By, Used_In).
- **State Transition**: Không áp dụng (Read & Graph Traversal rule).
- **UI Behavior**:
  - Hiển thị Cây phả hệ trực quan tương tác dạng sơ đồ mạng (Interactive Tree / Network Diagram).
  - Cho phép người dùng click vào từng nút để xem hồ sơ chi tiết (Drill-down to Batch Details, RM CoA, Deviation Details).
  - Tự động đánh dấu màu đỏ các nút có sự cố chất lượng (Fail / OOS / Deviation).
- **Report / CoA Behavior**: Có thể xuất "Báo cáo Phả hệ Truy xuất Nguồn gốc Lô" (Batch Genealogy Traceability Dossier) dưới dạng PDF hoàn chỉnh phục vụ thanh tra.
- **Audit Requirement**: Ghi nhận nhật ký mỗi lần người dùng thực hiện truy vấn truy vết thu hồi.
- **Forbidden Behavior**:
  - Tuyệt đối cấm để đứt gãy liên kết giữa Lô thành phẩm và các Lô nguyên liệu thành phần (Orphan Batch Relationship).
- **Exception Handling**: Nếu phát hiện dữ liệu lô nguyên liệu bị thiếu mã liên kết do dữ liệu nhập liệu cũ (legacy data), hệ thống phải gắn cờ cảnh báo `GENEALOGY_DATA_GAP` và hiển thị cảnh báo trên sơ đồ.
- **Test Cases**:
  - `TC-GEN-001-A`: Truy vết ngược từ 1 lô thành phẩm phải tìm ra chính xác danh sách mã lô nguyên liệu đã ghi nhận trong hồ sơ sản xuất.
  - `TC-GEN-001-B`: Truy vết xuôi từ 1 lô nguyên liệu bị thu hồi phải trả về đầy đủ 100% các lô thành phẩm đã sử dụng nó mà không bỏ sót lô nào.

---

## 2. BR-GEN-002: Bất Biến Mối Quan Hệ Phả Hệ Sau Khi Lô Xuất Xưởng (Genealogy Immutability Rule)

- **Rule ID**: `BR-GEN-002`
- **Purpose**: Đảm bảo mối liên kết phả hệ cấu thành giữa các lô nguyên liệu và lô sản phẩm thành phẩm bị khóa cứng bất biến khi lô đã được sản xuất và xuất xưởng, ngăn ngừa việc gán đổi lô nguyên vật liệu hồi cứu để trốn tránh trách nhiệm.
- **Actor**: `System` (Tự động khóa).
- **Trigger**: Khi lô sản phẩm chuyển sang trạng thái `TESTING` hoặc `RELEASED`.
- **Input**:
  - `batchId`: Mã lô sản phẩm.
  - `materialAllocations[]`: Danh sách phân bổ nguyên liệu của lô.
- **Preconditions**: Lô đã được khởi tạo và ghi nhận phân bổ nguyên vật liệu thực tế.
- **Decision Logic**:
  - Ngay khi Lô chuyển sang `TESTING` (bắt đầu kiểm nghiệm): Danh sách các lô nguyên vật liệu cấu thành bị đóng băng (`genealogyLocked = true`).
  - Mọi yêu cầu thay đổi, gán lại (re-assign) hoặc xóa bớt lô nguyên liệu thành phần đều bị hệ thống từ chối.
  - Trường hợp đặc biệt (ví dụ nhập sai số lô nguyên liệu do gõ nhầm): Chỉ được phép sửa đổi thông qua Quy trình Sai lệch (Deviation Process) có phê duyệt của Trưởng phòng QA, và bắt buộc lưu lại Audit log chi tiết trước và sau khi điều chỉnh.
- **Decision Table**:

| Trạng thái của Lô      | Thao tác trên Phân bổ Nguyên liệu | Cho phép   | Yêu cầu nghiệp vụ                                |
| :--------------------- | :-------------------------------- | :--------- | :----------------------------------------------- |
| `DRAFT` / `PLANNED`    | Thêm, sửa, gán lại lô nguyên liệu | CÓ         | Ghi nhận audit cơ bản                            |
| `TESTING` / `RELEASED` | Thay đổi lô nguyên liệu cấu thành | **BỊ CẤM** | Bắt buộc mở Deviation và có QA Manager phê duyệt |

- **Output**: Cờ `batch.genealogyLocked: boolean`.
- **State Transition**: Mở khóa -> Khóa bất biến (`LOCKED`).
- **UI Behavior**: Ẩn các nút chỉnh sửa/xóa lô nguyên liệu trên màn hình Thành phần Lô khi lô đã bị khóa phả hệ.
- **Report / CoA Behavior**: Không áp dụng.
- **Audit Requirement**: Ghi lại cảnh báo nếu có hành vi cố gắng chỉnh sửa phả hệ khi đã khóa.
- **Forbidden Behavior**: Tuyệt đối cấm cập nhật trực tiếp bảng liên kết phả hệ mà không qua quy trình kiểm soát thay đổi.
- **Exception Handling**: Không có ngoại lệ.
- **Test Cases**:
  - `TC-GEN-002-A`: Không thể thêm hoặc xóa nguyên liệu khỏi Lô đang ở trạng thái `TESTING` hoặc `RELEASED`.
