# Auth Domain (VS-16)

## 1. Ranh giới kiến trúc (Authentication & Session Management)

Auth Domain phụ trách quản lý danh tính, phiên xác thực và quy chuẩn mật khẩu người dùng:

- **Xác thực bảo mật**: Đăng nhập, đăng ký, đăng xuất, đổi mật khẩu, đặt lại mật khẩu qua email.
- **Tuân thủ quy chuẩn Dược phẩm (GMP / 21 CFR Part 11)**: Kiểm soát độ dài và độ phức tạp mật khẩu, kiểm tra định dạng email và ngăn chặn đặt trùng mật khẩu hiện tại khi đổi mật khẩu.
- **Phiên làm việc bền bỉ (Session Persistence)**: Thiết lập `browserLocalPersistence` duy trì phiên an toàn trên trình duyệt.

## 2. Cấu trúc thư mục

```text
src/domains/auth/
├── domain/
│   ├── types.ts          # AuthUser, LoginCredentials, SignupCredentials, PasswordChangeRequest
│   └── rules.ts          # AuthRules: validateEmail, validatePasswordStrength, validateLoginCredentials
├── infrastructure/
│   └── repository.ts     # IAuthRepository, firebaseAuthRepository
├── application/
│   ├── authAppService.ts # AuthAppService điều phối các luồng xác thực
│   └── queries.ts        # AuthQueries
├── workflow/
│   └── definitions.ts    # AUTH_WORKFLOW_ACTIONS, AUTH_ACTION_LABELS
├── tests/
│   └── authDomain.test.ts # Bộ unit tests xác thực người dùng
├── index.ts              # Canonical entrypoint
└── README.md             # Tài liệu slice
```
