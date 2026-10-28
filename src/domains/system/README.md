# System Domain (VS-14)

## 1. Ranh giới kiến trúc (Bounded Context)

System Domain chịu trách nhiệm quản lý các hoạt động hạ tầng và quản trị cấp cao của hệ thống PQM:

- **Người dùng và Phân quyền (Users & Permissions)**: Ma trận RBAC chuẩn GMP / 21 CFR Part 11, xác thực năng lực theo ngữ cảnh tài nguyên (Capability-based Authorization).
- **Tác vụ phá hủy & Nhạy cảm (Destructive Operations)**: Sao lưu toàn diện (Backup), Khôi phục (Restore), Dọn sạch cơ sở dữ liệu (Wipe), và Nạp dữ liệu mẫu (Reset Demo).
- **Rào chắn an ninh 2 lớp (Security Guard)**: Bắt buộc quyền ADMIN và Confirmation Token (`CONFIRM_RESTORE`, `CONFIRM_WIPE`, `CONFIRM_RESET_DEMO`) kèm lý do giải trình ghi vết ALCOA+ Audit Trail.

## 2. Cấu trúc thư mục

```text
src/domains/system/
├── domain/
│   ├── types.ts          # UserData, UserAuditLogEntry, SystemActionContext, SystemActionResult
│   └── rules.ts          # SystemRules: validateAdminAuthorization, validateConfirmationToken, validateReason
├── infrastructure/
│   └── repository.ts     # ISystemRepository, firebaseSystemRepository
├── application/
│   ├── systemAppService.ts   # SystemAppService điều phối qua WorkflowFacade
│   ├── userService.ts        # UserService quản lý realtime user & role assignment
│   ├── permissionService.ts  # PermissionService (can, canAny, canAll, hasRole, isAdmin)
│   └── queries.ts            # SystemQueries
├── workflow/
│   └── definitions.ts    # SYSTEM_WORKFLOW_ACTIONS, SYSTEM_ACTION_LABELS
├── tests/
│   └── systemDomain.test.ts  # Unit tests cho System Domain
├── index.ts              # Canonical entrypoint
└── README.md             # Tài liệu slice
```

## 3. Luồng điều phối Canonical Actions

```text
UI -> SystemAppService -> WorkflowFacade.dispatch -> SystemRules -> ISystemRepository -> Firebase RTDB -> Audit Log
```

- `SYSTEM_BACKUP_EXECUTE`: Quản trị viên trích xuất toàn bộ snapshot DB.
- `SYSTEM_RESTORE_EXECUTE`: Khôi phục DB từ snapshot (Yêu cầu token `CONFIRM_RESTORE` + lý do).
- `SYSTEM_WIPE_DEMO_EXECUTE`: Dọn sạch hoặc khởi tạo lại DB (Yêu cầu token `CONFIRM_WIPE` / `CONFIRM_RESET_DEMO` + lý do).
