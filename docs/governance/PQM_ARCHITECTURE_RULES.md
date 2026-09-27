# 📐 QUY TẮC KIẾN TRÚC VÀ RANH GIỚI PHÂN TẦNG (PQM ARCHITECTURE RULES)

> **Mã văn bản:** `PQM_ARCHITECTURE_RULES.md`  
> **Phiên bản:** 1.0.0-CANONICAL  
> **Thời điểm ban hành:** 2026-09-27  
> **Tiêu chuẩn:** Clean Architecture & Domain-Driven Design (DDD)

---

## 1. MÔ HÌNH KIẾN TRÚC PHÂN TẦNG 4 LỚP

Hệ thống PQM áp dụng nghiêm ngặt nguyên tắc phụ thuộc một chiều từ ngoài vào trong của Clean Architecture:

```text
┌────────────────────────────────────────────────────────┐
│ UI / PRESENTATION LAYER                                │
│ (src/pages/, src/components/, src/hooks/)              │
│  - Phụ thuộc: Application Layer, Workflow Facade       │
│  - CẤM: Không phụ thuộc Domain Entity, Firebase, Repos │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ APPLICATION LAYER                                      │
│ (src/domains/*/application/, src/workflow/)            │
│  - Phụ thuộc: Domain Layer, Repository Interfaces      │
│  - Nhiệm vụ: Điều phối nghiệp vụ, Guards, OCC, Audit   │
│  - CẤM: Không phụ thuộc Firebase SDK, không import UI  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ DOMAIN LAYER                                           │
│ (src/domains/*/domain/, src/domain/)                   │
│  - Phụ thuộc: TUYỆT ĐỐI KHÔNG PHỤ THUỘC TẦNG NÀO       │
│  - Nhiệm vụ: Entities, Value Objects, Rules, FSMs      │
│  - CẤM: Không có bất kỳ I/O, Network, Framework        │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ implements
┌───────────────────────────┴────────────────────────────┐
│ INFRASTRUCTURE LAYER                                   │
│ (src/infrastructure/, src/domains/*/infrastructure/)   │
│  - Triển khai các Repository Interfaces                │
│  - Tương tác với Firebase Realtime Database            │
│  - Cổng AI Gateway, Dịch vụ ký số điện tử              │
└────────────────────────────────────────────────────────┘
```

---

## 2. QUY TẮC PHỤ THUỘC (DEPENDENCY INVERSION PRINCIPLE)

1. **Domain Layer thuần túy**: Thư mục `src/domains/*/domain/` chỉ chứa TypeScript types, interfaces và pure functions/classes. Tuyệt đối không import từ `application/`, `infrastructure/`, `hooks/`, `components/`, hay thư viện Firebase.
2. **Repository Boundary**: Tầng Application chỉ giao tiếp với dữ liệu thông qua **Repository Interfaces** định nghĩa tại `src/repositories/interfaces/` (ví dụ `IBatchRepository`, `IProductRepository`). Không bao giờ import trực tiếp các file triển khai `Firebase*.ts` vào Application Service.
3. **UI Boundary**: Tầng UI chỉ được import các React Query Hooks (`useProductQueries`, `useBatchQueries`, ...) hoặc hook điều phối workflow (`useWorkflowActions`), tuyệt đối không import Repositories hay Firebase database methods.

---

## 3. CÁC KIỂM TRA KIẾN TRÚC TỰ ĐỘNG BẢO VỆ RANH GIỚI

Hệ thống bảo đảm ranh giới kiến trúc bằng bộ 12 Architecture Tests tại `tests/architecture/`:

- `dependencyDirection.test.ts`: Cưỡng chế chiều phụ thuộc Clean Architecture.
- `noDirectFirebaseMutation.test.ts`: Chặn đứng mọi lệnh ghi Firebase từ UI/Hooks.
- `noDirectRepositoryMutation.test.ts`: Chặn đứng UI/Hooks gọi trực tiếp mutation trên repository.
- `workflowTraceability.test.ts`: Cưỡng chế khả năng truy xuất nguồn gốc 2 chiều.
- `scripts/workflow/check_boundaries.cjs` (`npm run workflow:guard`): Quét tĩnh toàn bộ 713 source files mỗi khi build hoặc commit.
