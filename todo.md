# 🛰️ ANTIGRAVITY - AI IMPLEMENTATION ROADMAP

## 📌 THÔNG TIN CHUNG
- **Dự án:** Hệ thống AI tự động hóa kiểm nghiệm PQM (V-Biotech Quality Management).
- **Mục tiêu:** Chuyển đổi từ nhập liệu thủ công sang AI Agent tự trị.
- **Cập nhật lần cuối:** 11/06/2026
- **Trạng thái tổng:** ✅ Cấp độ 1 (Hoàn thành) → ✅ Cấp độ 2 (Hoàn thành) → ✅ Cấp độ 3 (Hoàn thành)

---

## ✅ CẤP ĐỘ 3: TỰ HỌC & ĐẠI LÝ HÀNH ĐỘNG (ACTION AGENTS)
*Mục tiêu: AI tự học từ con người và thực hiện tác vụ độc lập.*

- [x] **Conversational Chatbot** — `chatWithAppContext()` multi-turn, truy vấn dữ liệu thật của app bằng ngôn ngữ tự nhiên (`geminiService.ts`)
- [x] **AI Tools (Stub)** — Các hàm phân tích xu hướng, RCA, FMEA, Risk Assessment đã được định nghĩa (`aiTools.ts`)
- [x] **Function Calling thật sự** — Kết nối Gemini Tools API để chatbot thực sự gọi các hàm AI Tools khi phù hợp
- [x] **Quality Alert Agent** — AI tự phát hiện bất thường và lưu notification vào Firebase
- [x] **Báo cáo tự động** — Agent tổng hợp báo cáo tháng/quý, export Excel với SheetJS

---

## 🛠️ TECH STACK ĐANG SỬ DỤNG

| Lớp | Công nghệ |
|---|---|
| Frontend | React + TypeScript + Vite |
| AI Model | Google Gemini 2.5 Flash (multimodal) |
| State & DB | Zustand + Firebase Realtime DB |
| AI Learning | `ai_learned_mappings` collection trên Firebase |
| Routing | React Router v6 |

---

## 📈 METRICS THEO DÕI

- **Tỷ lệ map thành công (confidence=high):** Đo tự động qua tỷ lệ highItems/totalItems
- **Số lượng Learned Mappings:** Theo dõi tăng trưởng trong collection `ai_learned_mappings`
- **Thời gian trích xuất trung bình:** Mục tiêu < 10s/file