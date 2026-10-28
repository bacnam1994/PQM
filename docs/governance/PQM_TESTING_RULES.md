# 🧪 QUY TẮC KIỂM THỬ VÀ CHỐNG HỒI QUY (PQM TESTING RULES)

> **Mã văn bản:** `PQM_TESTING_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Test Automation & Regression Prevention

---

## 1. MÔ HÌNH KIM TỰ THÁP KIỂM THỬ TRONG PQM

Hệ thống PQM duy trì chiến lược kiểm thử đa tầng nghiêm ngặt:

```text
       /\
      /  \     E2E Scenarios (Playwright / Critical Business Flows)
     /────\
    /      \    Architecture Tests (tests/architecture/ - 12 Suites)
   /────────\
  /          \   Workflow & Kernel Tests (12-step guard validation)
 /────────────\
/  Unit Tests  \ Domain Unit Tests (16 Slices, Rules, FSMs - 157 tests)
────────────────
```

---

## 2. QUY TẮC VIẾT TEST CHO TÍNH NĂNG MỚI

Khi bổ sung tính năng mới hoặc sửa đổi nghiệp vụ, bắt buộc phải viết các test cases tương ứng:

1. **Happy Path**: Trường hợp luồng dữ liệu hợp lệ, actor có đúng role, state chuyển đổi thành công.
2. **Validation Failure**: Dữ liệu thiếu trường bắt buộc hoặc sai định dạng.
3. **Authorization Failure**: Người dùng không có vai trò phù hợp bị chặn với lỗi "Từ chối quyền".
4. **Invalid State Machine Transition**: Thử nghiệm bước chuyển trái phép và kỳ vọng bị từ chối Fail-Closed.
5. **OCC Concurrency Conflict**: Thử nghiệm gửi dữ liệu phiên bản cũ hơn và kỳ vọng bắt được xung đột.
6. **Audit Trail Verification**: Kiểm tra outbox queue có lưu vết đúng thông tin ALCOA+ hay không.

---

## 3. QUY TRÌNH KIỂM CHỨNG TRƯỚC KHI COMMIT (VERIFICATION PROTOCOL)

Trước mỗi commit, bắt buộc chạy và đạt PASS 100%:

```powershell
# 1. Quét tĩnh vi phạm ranh giới kiến trúc
npm run workflow:guard

# 2. Chạy toàn bộ 12 Architecture Gates
npx vitest run tests/architecture/

# 3. Kiểm tra kiểu dữ liệu TypeScript
npx tsc --noEmit

# 4. Chạy toàn bộ regression test suite
npm test -- --run
```
