# AI_RULES: Danh Mục Quy Tắc Quản Trị Trí Tuệ Nhân Tạo (AI Governance & Safety Rules)

Tài liệu này chuẩn hóa toàn bộ các quy tắc bắt buộc về việc ứng dụng Trí tuệ Nhân tạo (AI) trong hệ thống PQM. AI chỉ đóng vai trò Trợ lý Tư vấn / Đề xuất (Advisory / Proposal-only), tuyệt đối không có quyền tự quyết định pháp lý hay ghi đè cơ sở dữ liệu khi chưa có con người phê duyệt (Human-in-the-loop).

---

## 1. BR-AI-001: Cơ Chế Đề Xuất Tư Vấn Cấm Ghi Trực Tiếp Cơ Sở Dữ Liệu (Advisory Proposal-Only Rule)

- **Rule ID**: `BR-AI-001`
- **Purpose**: Đảm bảo an toàn tuyệt đối cho dữ liệu kiểm nghiệm và sản xuất theo quy định GAMP 5 và FDA AI/ML Guidance. AI chỉ đóng vai trò trợ lý sinh đề xuất (Proposal), người dùng có chuyên môn bắt buộc phải thẩm định và xác nhận trước khi bất kỳ dữ liệu nào được ghi vào cơ sở dữ liệu chính thức.
- **Actor**: `AI_Assistant` (Mô hình AI: Gemini/Claude/GPT), `Human_Operator` (Dược sĩ/Kỹ thuật viên có chuyên môn).
- **Trigger**: Khi người dùng yêu cầu AI hỗ trợ: Ánh xạ chỉ tiêu (Criterion Mapping), Phân tích nguyên nhân gốc rễ (Root Cause Suggestion), Dự thảo kết luận OOS/CAPA hoặc Soạn thảo hồ sơ.
- **Input**:
  - `userPrompt`: Yêu cầu của người dùng.
  - `contextData`: Dữ liệu ngữ cảnh hệ thống cung cấp (danh sách chỉ tiêu, kết quả thử nghiệm, thông số máy...).
- **Preconditions**:
  - Module AI đã được cấu hình API Key hợp lệ và kích hoạt trong hệ thống.
  - Dữ liệu gửi sang AI đã được khử trùng lọt lộ thông tin nhạy cảm (Sanitized Data).
- **Decision Logic**:
  - **TÁCH BIỆT TẦNG ĐỀ XUẤT VÀ TẦNG THỰC THI**:
    - Phản hồi từ AI được định dạng dưới dạng Bản thảo đề xuất (`AIProposal`).
    - Bản thảo đề xuất CHỈ tồn tại trên bộ nhớ tạm của giao diện người dùng (UI State / In-Memory), TUYỆT ĐỐI KHÔNG tự động gọi API cập nhật hoặc lưu thẳng vào cơ sở dữ liệu chính.
  - **HUMAN-IN-THE-LOOP (Con người là thẩm quyền cao nhất)**:
    - Người dùng có toàn quyền: Chấp thuận toàn bộ (`ACCEPT_ALL`), Chấp thuận một phần (`ACCEPT_PARTIAL`), Chỉnh sửa trước khi nhận (`EDIT_AND_ACCEPT`), hoặc Bác bỏ hoàn toàn (`REJECT`).
    - Chỉ sau khi người dùng bấm "Áp dụng" hoặc "Xác nhận", hệ thống mới gửi dữ liệu do người dùng xác nhận vào cơ sở dữ liệu dưới định danh tài khoản của chính người dùng đó.
- **Decision Table**:

| Hành động của AI               | Có quyền ghi thẳng Database? | Cách xử lý dữ liệu đầu ra                  | Quyền của người dùng                       |
| :----------------------------- | :--------------------------- | :----------------------------------------- | :----------------------------------------- |
| Gợi ý ánh xạ chỉ tiêu OCR      | **KHÔNG**                    | Trả về bảng so sánh đề xuất trên UI        | Kiểm tra từng dòng, bấm xác nhận từng dòng |
| Đề xuất nguyên nhân gốc rễ OOS | **KHÔNG**                    | Điền vào khung gợi ý (Suggestion Box)      | Tự do sửa đổi, xóa hoặc không sử dụng      |
| Dự thảo kế hoạch CAPA          | **KHÔNG**                    | Hiển thị dạng bản thảo xem trước (Preview) | Chỉnh sửa nội dung và ký xác nhận cá nhân  |

- **Output**:
  - Đối tượng `AIProposal`: `proposalId`, `generatedText` / `mappings`, `confidenceScore`, `reasoning`.
- **State Transition**: `GENERATED` -> `ACCEPTED` / `REJECTED` bởi người dùng.
- **UI Behavior**:
  - Toàn bộ kết quả sinh ra bởi AI phải được gắn huy hiệu trực quan rõ ràng: "✨ ĐỀ XUẤT BỞI AI (CẦN XÁC NHẬN)".
  - Có các nút bấm rõ ràng: "Áp dụng đề xuất", "Sửa nội dung", "Bỏ qua".
- **Report / CoA Behavior**: Tuyệt đối không in dòng chữ hoặc gắn nhãn "Được duyệt bởi AI" lên bất kỳ chứng thư pháp lý nào. Mọi quyết định đều đứng tên Dược sĩ phụ trách.
- **Audit Requirement**: Khi người dùng chấp nhận một đề xuất từ AI, bản ghi Audit Trail phải ghi nhận rõ: "Người dùng [User] đã chấp nhận đề xuất từ AI Model [Model Name] cho trường [Field]".
- **Forbidden Behavior**:
  - Tuyệt đối cấm viết code cho phép AI tự động kích hoạt API backend dạng ngầm không thông qua giao diện người dùng.
  - Tuyệt đối cấm AI tự động đưa ra quyết định Đạt/Không Đạt của Lô sản phẩm.
- **Exception Handling**: Nếu dịch vụ AI gặp lỗi (Rate Limit, Timeout, Hallucination error), hệ thống phải thông báo nhẹ nhàng cho người dùng và cho phép tiếp tục thao tác thủ công bình thường mà không làm sập ứng dụng.
- **Test Cases**:
  - `TC-AI-001-A`: Kết quả trả về từ hàm gợi ý AI không tạo ra bất kỳ bản ghi mới nào trong cơ sở dữ liệu nếu người dùng chưa bấm Lưu.
  - `TC-AI-001-B`: Dữ liệu do người dùng bấm áp dụng từ AI phải lưu kèm audit log ghi nhận nguồn gốc AI.

---

## 2. BR-AI-002: Rào Chắn Chống Nhầm Lẫn Nghiệp Vụ Dược Khoa Của AI (AI Pharmacological Guardrails Rule)

- **Rule ID**: `BR-AI-002`
- **Purpose**: Đảm bảo AI không bao giờ thực hiện các phép ánh xạ hoặc suy luận sai lầm về mặt dược khoa và logic kiểm nghiệm, đặc biệt là cấm tuyệt đối việc nhầm lẫn giữa Phép thử Định tính (Identification) và Phép thử Định lượng (Assay), hoặc bỏ qua đơn vị đo lường.
- **Actor**: `System` (Tự động kiểm tra rào chắn logic - Post-AI Guardrail).
- **Trigger**: Ngay khi AI trả về kết quả gợi ý ánh xạ chỉ tiêu kiểm nghiệm hoặc phân tích kết quả.
- **Input**:
  - `aiSuggestedMapping`: Ánh xạ do AI đề xuất giữa Chỉ tiêu trên Phiếu kiểm nghiệm và Chỉ tiêu trong TCCS.
  - `sourceCriterion`: Thông tin chỉ tiêu gốc (Tên, Loại phép thử, Đơn vị).
  - `targetCriterion`: Thông tin chỉ tiêu TCCS đích.
- **Preconditions**: Có sẵn từ điển phân loại loại phép thử (`IDENTIFICATION`, `ASSAY`, `PURITY`, `DISSOLUTION`, `PHYSICAL`).
- **Decision Logic**:
  - **Rào chắn 1 (Type Invariance Guard)**:
    - Nếu `sourceCriterion.type === 'IDENTIFICATION'` và `targetCriterion.type === 'ASSAY'`: **LẬP TỨC CHẶN** và hủy đề xuất này của AI. Định tính chỉ xác nhận sự hiện diện (Có/Không, Dương tính/Âm tính, Phổ IR/HPLC khớp chuẩn), không thể dùng để ánh xạ vào chỉ tiêu đo lường hàm lượng định lượng (% hoặc mg).
  - **Rào chắn 2 (Unit Compatibility Guard)**:
    - Nếu cả hai là định lượng nhưng đơn vị đo lường hoàn toàn không tương thích (ví dụ: một bên là `%`, một bên là `CFU/g` hoặc `ml`) mà không có hệ số chuyển đổi: Đánh dấu vi phạm cảnh báo không tương thích đơn vị.
  - **Rào chắn 3 (Negative Proof Guard)**:
    - AI không được tự ý kết luận một chỉ tiêu không làm là "Đạt theo kinh nghiệm" hoặc suy đoán kết quả khi không có dữ liệu số đo thực tế.
- **Decision Table**:

| Loại phép thử nguồn          | Loại phép thử đích đề xuất   | Phán quyết của Rào chắn Guardrail | Hành vi hệ thống                       |
| :--------------------------- | :--------------------------- | :-------------------------------- | :------------------------------------- |
| `IDENTIFICATION` (Định tính) | `ASSAY` (Định lượng)         | **VI PHẠM NGHIÊM TRỌNG**          | Tự động loại bỏ khỏi danh sách đề xuất |
| `ASSAY` (Định lượng)         | `IDENTIFICATION` (Định tính) | **VI PHẠM NGHIÊM TRỌNG**          | Tự động loại bỏ khỏi danh sách đề xuất |
| `ASSAY` (mg/viên)            | `ASSAY` (% nhãn)             | Hợp lệ nếu có công thức quy đổi   | Cho phép đề xuất kèm nhắc nhở quy đổi  |
| `MICROBIOLOGY`               | `HEAVY_METALS`               | **VI PHẠM NGHIÊM TRỌNG**          | Loại bỏ đề xuất                        |

- **Output**: Danh sách đề xuất đã được làm sạch và lọc bỏ 100% các gợi ý vi phạm rào chắn dược khoa.
- **State Transition**: Không áp dụng.
- **UI Behavior**: Không hiển thị các đề xuất đã bị rào chắn loại bỏ. Nếu người dùng xem chi tiết kiểm duyệt AI, hiển thị thông báo: "Đã loại bỏ 1 gợi ý không phù hợp về phân loại dược điển".
- **Report / CoA Behavior**: Không áp dụng.
- **Audit Requirement**: Lưu vết các trường hợp AI đề xuất sai bị rào chắn chặn đứng để phục vụ tinh chỉnh Prompt (Prompt Engineering) và Fine-tuning mô hình trong tương lai.
- **Forbidden Behavior**: Tuyệt đối cấm tắt bỏ (bypass) bộ lọc Guardrail trong môi trường sản xuất.
- **Exception Handling**: Nếu phát hiện chỉ tiêu có tính chất lai (vừa kiểm tra màu sắc vừa đo độ hấp thụ quang phổ), hệ thống yêu cầu người dùng gán nhãn thủ công thay vì để AI tự phán đoán.
- **Test Cases**:
  - `TC-AI-002-A`: Hàm kiểm tra `isCriteriaMatch` chặn đứng việc ánh xạ giữa phép thử Định tính và Định lượng dù AI trả về điểm tự tin cao.
  - `TC-AI-002-B`: Ánh xạ đúng giữa 2 phép thử cùng loại định lượng được giữ nguyên và hiển thị cho người dùng.
