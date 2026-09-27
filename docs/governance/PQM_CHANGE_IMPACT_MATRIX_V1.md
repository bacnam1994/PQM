# 📊 MA TRẬN TÁC ĐỘNG THAY ĐỔI (PQM CHANGE IMPACT MATRIX V1)

> **Mã văn bản:** `PQM_CHANGE_IMPACT_MATRIX_V1.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Nguyên tắc:** Mỗi cấp độ thay đổi (Class A đến Class H) bắt buộc phải thỏa mãn đầy đủ các yêu cầu kiểm soát tương ứng.

---

## 1. MA TRẬN YÊU CẦU KIỂM SOÁT THEO CẤP ĐỘ THAY ĐỔI

| Cấp độ thay đổi (Change Class)    | Yêu cầu Kiểm thử (Test Requirement)  | Cổng Kiến trúc (Architecture Guard) | Bắt buộc ban hành ADR (ADR Required) | Kế hoạch Di trú (Migration Plan) | Đánh giá An ninh (Security Review) | Người phê duyệt tối thiểu (Minimum Approver) |
| --------------------------------- | ------------------------------------ | :---------------------------------: | :----------------------------------: | :------------------------------: | :--------------------------------: | -------------------------------------------- |
| **CLASS A (UI Only)**             | UI Component / Visual Tests          |             ✅ Bắt buộc             |               ❌ Không               |             ❌ Không             |              ❌ Không              | Frontend Lead / Dev                          |
| **CLASS B (Internal Refactor)**   | Regression Tests (100% Pass)         |             ✅ Bắt buộc             |      ❌ Không (Trừ khi đổi API)      |             ❌ Không             |              ❌ Không              | Senior Dev / Code Reviewer                   |
| **CLASS C (Feature Extension)**   | Unit Tests + Integration Tests       |             ✅ Bắt buộc             |           ⚠️ Nếu cần thiết           |             ❌ Không             |        ⚠️ Nếu có quyền mới         | Module Lead & QA                             |
| **CLASS D (Workflow Change)**     | Full Workflow Regression Suite       |             ✅ Bắt buộc             |           ✅ **BẮT BUỘC**            |   ⚠️ Nếu ảnh hưởng dữ liệu cũ    |          ⚠️ Xem xét RBAC           | Software Architect & QA Lead                 |
| **CLASS E (Domain Rule Change)**  | Full Domain Regression + Edge Cases  |             ✅ Bắt buộc             |           ✅ **BẮT BUỘC**            |      ⚠️ Nếu cần Re-evaluate      |              ❌ Không              | Lead QA & Domain Specialist                  |
| **CLASS F (Security / RBAC)**     | Security Rules Tests + RBAC Tests    |             ✅ Bắt buộc             |           ✅ **BẮT BUỘC**            |     ⚠️ Nếu đổi cấu trúc auth     |          ✅ **BẮT BUỘC**           | Security Lead & Admin                        |
| **CLASS G (Data / Schema)**       | Data Integrity Tests + Migrator Test |             ✅ Bắt buộc             |           ✅ **BẮT BUỘC**            |         ✅ **BẮT BUỘC**          |        ⚠️ Xem xét truy cập         | Database Owner & Architect                   |
| **CLASS H (Architecture Change)** | Toàn bộ Test Suite hệ thống          |             ✅ Bắt buộc             |      ✅ **BẮT BUỘC (Level 4)**       |         ✅ **BẮT BUỘC**          |          ✅ **BẮT BUỘC**           | **Architectural Review Board**               |

---

## 2. QUY TRÌNH ÁP DỤNG TRƯỚC KHI THỰC HIỆN BẤT KỲ TASK NÀO

1. **Giai đoạn Pre-flight**: Kỹ sư / AI bắt buộc phải đối chiếu yêu cầu của task với bảng trên và khai báo rõ `CHANGE CLASS: [A|B|C|D|E|F|G|H]`.
2. **Kích hoạt các điều kiện bắt buộc**: Nếu task thuộc Class D, E, F, G, H mà chưa có ADR hoặc Kế hoạch di trú được phê duyệt: **DỪNG LẠI (STOP) VÀ BÁO CÁO**.
3. **Giai đoạn Post-flight**: Sau khi hoàn thành code, đối soát toàn bộ các cột kiểm thử và an ninh tương ứng để đảm bảo đạt tích xanh trước khi commit.
