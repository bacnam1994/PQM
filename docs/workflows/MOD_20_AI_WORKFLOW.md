# PHÂN HỆ 20: AI ASSISTANT & GOVERNANCE WORKFLOW

## (QUY TRÌNH TRỢ LÝ TRÍ TUỆ NHÂN TẠO & RÀO CẢN AN TOÀN AI)

> **Mã phân hệ**: `MOD-20`  
> **Tài liệu**: `docs/workflows/MOD_20_AI_WORKFLOW.md`  
> **Phạm vi**: Ứng dụng mô hình ngôn ngữ lớn (LLM - Gemini 2.5/Flash), trích xuất dữ liệu phiếu kiểm nghiệm (OCR/Data Extraction), giải thích quy tắc nghiệp vụ, rào cản kiểm soát và đạo đức AI trong sản xuất dược phẩm.

---

### 1. MỤC ĐÍCH (PURPOSE)

Gia tăng năng suất cho nhân sự phòng lab và QA thông qua công nghệ trí tuệ nhân tạo, đồng thời thiết lập "Vành đai kiểm soát nghiêm ngặt" (AI Governance Guardrails) để đảm bảo AI hoạt động an toàn, minh bạch và tuân thủ các nguyên tắc GMP.

---

### 2. NGUYÊN TẮC CỐT LÕI VỀ QUẢN TRỊ AI (AI GOVERNANCE PRINCIPLES)

#### A. Human-in-the-loop (Con người luôn nắm quyền quyết định cuối cùng)

- AI chỉ đóng vai trò là **Cố vấn / Người phụ tá (Copilot)**.
- **AI TUYỆT ĐỐI KHÔNG ĐƯỢC**:
  - Tự động quyết định trạng thái chất lượng `PASS` hoặc `FAIL`.
  - Tự động phê duyệt (`APPROVE`) bất kỳ hồ sơ TCCS, PKN hay Lô nào.
  - Tự động kích hoạt xuất xưởng (`RELEASE`) lô hàng ra thị trường.

#### B. Nguồn trích dẫn minh bạch (Grounding & Explainability)

- Mọi câu trả lời, khuyến cáo hoặc gợi ý của AI phải trích dẫn trực tiếp từ các tài liệu cơ sở của hệ thống (Dược điển, TCCS, SOP, Lịch sử kiểm nghiệm). Tuyệt đối ngăn chặn hiện tượng ảo giác (Hallucination).

#### C. Ghi nhật ký tương tác AI (AI Audit Logging)

- Mọi hành động do AI hỗ trợ (ví dụ: tự động điền form bằng AI, gợi ý nguyên nhân OOS) đều phải được đánh dấu badge tím/xanh nhạt `"AI-Assisted"` trên giao diện và ghi vết vào Audit Trail kèm ID phiên làm việc.

---

### 3. CÁC TÍNH NĂNG AI ĐƯỢC PHÉP HOẠT ĐỘNG

1. **Trích xuất dữ liệu từ File ảnh/PDF kết quả phân tích máy (Smart Lab OCR)**: Đọc file sắc ký đồ (HPLC), phổ quang (UV-Vis) và gợi ý điền số liệu vào form PKN. Người dùng phải bấm xác nhận trước khi lưu.
2. **Trợ lý giải thích quy trình (Workflow Copilot)**: Hỗ trợ người dùng tra cứu nhanh: _"Tại sao lô này chưa được xuất xưởng?"_, _"Chỉ tiêu vi sinh này được tính toán theo quy tắc nào?"_.
3. **Soạn thảo gợi ý biên bản điều tra OOS/CAPA**: Giúp tổng hợp dữ liệu lịch sử các lần xảy ra sự cố tương tự để QA tham khảo.

---

### 4. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-AI-01`: Bất kỳ trường dữ liệu nào do AI tự động điền phải được hiển thị badge rõ ràng trên giao diện.
- `AC-AI-02`: Hệ thống chặn đứng hoàn toàn mọi nỗ lực của AI nhằm thực thi các API ký số hoặc đổi trạng thái xuất xưởng.
