# 👥 MÔ HÌNH CHỦ THỂ & VAI TRÒ CHUẨN TẮC (PQM ACTOR MODEL V1)

> **Mã văn bản:** `PQM_ACTOR_MODEL_V1.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** ADR-001, FDA 21 CFR Part 11, RBAC Architecture

---

## 1. PHÂN BIỆT RẠCH RÒI GIỮA HUMAN BUSINESS ROLES VÀ SYSTEM ACTORS

Hệ thống PQM phân định ranh giới nghiêm ngặt giữa **Vai trò nghiệp vụ con người** và **Tác nhân tự động hóa hệ thống**:

```text
┌─────────────────────────────────────────────────────────────┐
│                    PQM ACTOR MODEL                          │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│    HUMAN BUSINESS ROLES     │ │       SYSTEM ACTORS         │
│  (Người dùng đăng nhập)     │ │  (Tiến trình máy móc / AI)  │
│  - ADMIN                    │ │  - SYSTEM                   │
│  - QA                       │ │  - AI_ADVISORY              │
│  - QC                       │ └─────────────────────────────┘
│  - LAB                      │  - Không thể đăng nhập như    │
│  - PRODUCTION               │    con người                  │
│  - USER                     │  - Không có chữ ký điện tử    │
│  - VIEWER                   │    21 CFR Part 11             │
│  - GUEST                    │  - Chỉ chạy nền hoặc đề xuất  │
└─────────────────────────────┘    (Proposal pattern)         │
 - Bắt buộc xác thực tài khoản │                              │
 - Có chữ ký số cá nhân (QA)   │                              │
 - Chịu trách nhiệm pháp lý    │                              │
└─────────────────────────────┘──────────────────────────────┘
```

---

## 2. DANH MỤC 8 CANONICAL ROLES CỦA CON NGƯỜI (HUMAN BUSINESS ROLES)

| STT | Canonical Role                | Mã kỹ thuật  | Thẩm quyền nghiệp vụ cốt lõi                                                                                                                                     |                  Chữ ký số 21 CFR Part 11                   |
| :-: | ----------------------------- | :----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------: |
|  1  | **Quản trị viên**             |   `ADMIN`    | Toàn quyền quản trị tài khoản, phân quyền, cấu hình hệ thống, sao lưu/phục hồi. Vẫn phải tuân thủ 7 Release Gates khi xuất xưởng Lô (Không có quyền Bypass FSM). |      Có thẩm quyền ký khi thực hiện thay thế khẩn cấp       |
|  2  | **Đảm bảo chất lượng**        |     `QA`     | Ban hành TCCS, phê duyệt Phiếu kiểm nghiệm, thẩm định xuất xưởng Lô (`RELEASED`), đóng hồ sơ CAPA & Thay đổi (CR), ban hành/ký duyệt CoA.                        | **BẮT BUỘC** (Người quyết định xuất xưởng Lô ra thị trường) |
|  3  | **Kiểm tra chất lượng**       |     `QC`     | Soát xét kết quả phân tích, cảnh báo OOS/OOT, theo dõi xu hướng SPC, khởi tạo điều tra sự cố phòng kiểm nghiệm.                                                  |             Có thẩm quyền ký rà soát (Reviewer)             |
|  4  | **Kiểm nghiệm viên**          |    `LAB`     | Nhập kết quả phân tích đo lường, đính kèm dữ liệu phổ/sắc ký, chạy trích xuất OCR Canvas AI.                                                                     |               Ký xác nhận nhập liệu phân tích               |
|  5  | **Sản xuất**                  | `PRODUCTION` | Khởi tạo Lô sản xuất mới (`BATCH_CREATE`), cập nhật sản lượng thực tế, hạn dùng, quy cách đóng gói và chuyển Lô sang chờ kiểm nghiệm (`TESTING`).                |                  Ký giao nhận mẫu sản xuất                  |
|  6  | **Người dùng nghiệp vụ**      |    `USER`    | Vận hành nhập liệu thông thường trong phạm vi ban đầu.                                                                                                           |                            Không                            |
|  7  | **Quan sát viên / Thanh tra** |   `VIEWER`   | Quyền chỉ đọc (Read-Only) 100% hồ sơ 360°, báo cáo, xu hướng, Audit Trail. Cấm tuyệt đối mọi thao tác sửa đổi.                                                   |                            Không                            |
|  8  | **Khách chờ duyệt**           |   `GUEST`    | Tài khoản mới tạo chưa phân quyền. Bị chặn truy cập toàn bộ các phân hệ nghiệp vụ cho đến khi Admin kích hoạt.                                                   |                            Không                            |

---

## 3. DANH MỤC 2 SYSTEM ACTORS (TÁC NHÂN HỆ THỐNG & AI)

1. **`SYSTEM` (Tác nhân nền tự động)**:
   - Đại diện cho các tác vụ tự động: Scheduled cron jobs, tự động kích hoạt OOS khi chỉ tiêu rớt (`autoLogFromOOS`), hoặc ghi nhận lịch sử đồng bộ.
   - Thao tác phải gắn liền với Correlation ID và ghi rõ `performedBy: 'SYSTEM'`.
2. **`AI_ADVISORY` (Trợ lý Trí tuệ Nhân tạo)**:
   - Đại diện cho suy luận của mô hình Gemini AI (OCR Canvas Vision, Smart Mapping, Stability Prediction, PQR Narrative).
   - **Ràng buộc an toàn tuyệt đối**: `AI_ADVISORY` **CHỈ TẠO BẢN THẢO/ĐỀ XUẤT (PROPOSALS)**. Không bao giờ được phép trực tiếp ghi đè cơ sở dữ liệu hoặc tự động duyệt trạng thái nghiệp vụ.

---

## 4. MA TRẬN KHÁI NIỆM TRONG ACTOR MODEL

- **Actor**: Thực thể thực hiện hành vi tại runtime (User cụ thể với ID, Tên, Email hoặc System).
- **Role**: Vai trò phân quyền chuẩn (1 trong 8 Human Roles hoặc System Actor).
- **Permission**: Quyền hạn vi mô kiểm tra qua hàm `can(user, permissionString, resource)` (ví dụ `batch:release`, `test_result:approve`).
- **Authentication**: Xác thực danh tính qua Firebase Authentication session token.
- **Authorization**: Kiểm tra tính hợp lệ của quyền hạn dựa trên RBAC matrix và trạng thái tài nguyên.
- **Delegation (Ủy quyền)**: Cho phép chuyển giao tạm thời thẩm quyền giữa các nhân sự QA có ghi vết trong Audit Trail.
- **Signature Authority**: Thẩm quyền gắn chữ ký điện tử số hóa xác thực theo quy chuẩn FDA 21 CFR Part 11.
