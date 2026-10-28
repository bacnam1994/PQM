# FRS-MOD-18: Đặc Tả Nghiệp Vụ Cây Phả Hệ Lô & Truy Vết Hai Chiều (Batch Genealogy Graph)

Tài liệu này quy định chi tiết chức năng xây dựng đồ thị phả hệ lô (Genealogy Directed Acyclic Graph - DAG), truy vết ngược nguồn gốc (Backward Traceability) và truy vết xuôi phạm vi ảnh hưởng (Forward Traceability).

---

## 1. Input & Data Schema

- `targetBatchId` hoặc `materialLotId`: Điểm bắt đầu truy vết.
- `direction`: `FORWARD` | `BACKWARD` | `BOTH`.
- `maxDepth`: Độ sâu phân cấp truy vết (mặc định: 10 cấp).

## 2. Validation Rules

- Đồ thị phả hệ phải đảm bảo tính liên tục, không bị đứt gãy quan hệ giữa Lô thành phẩm và các lô nguyên vật liệu cấu thành.
- Thời gian phản hồi thuật toán duyệt đồ thị phải dưới 5 giây đối với hồ sơ 10 năm.

## 3. Business Rules Reference

- `BR-GEN-001`: Cây phả hệ lô hai chiều toàn diện phục vụ điều tra gốc rễ và thu hồi sản phẩm.
- `BR-GEN-002`: Bất biến mối quan hệ phả hệ sau khi lô chuyển sang kiểm nghiệm và xuất xưởng.

## 4. State Management

- Read-only Graph Traversal & Topology Cache.

## 5. Service Layer Contract

```typescript
export interface BatchGenealogyService {
  buildGenealogyGraph(
    batchId: string,
    direction: 'FORWARD' | 'BACKWARD' | 'BOTH'
  ): Promise<BatchGenealogyGraphContract>;
  traceAffectedBatchesByMaterialLot(materialLotId: string): Promise<AffectedBatchSummary[]>;
  lockGenealogyRelations(batchId: string): Promise<void>;
}
```

## 6. Permission & RBAC

- Xem đồ thị phả hệ: Toàn bộ nhân sự QA, KCS, Sản xuất và Kho vận.
- Chỉnh sửa phân bổ nguyên liệu: Chỉ Quản đốc sản xuất khi Lô còn ở trạng thái `DRAFT`.

## 7. Error Handling

- `ERR_GEN_ORPHAN_NODE`: Cảnh báo khi phát hiện nút quan hệ mồ côi do lỗi dữ liệu cũ.

## 8. Audit Trail Requirement

- Ghi nhận nhật ký mỗi lần người dùng thực hiện truy vấn truy vết phục vụ thu hồi khẩn cấp.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Truy vết xuôi các lô thành phẩm khi nguyên liệu bị lỗi
  Given Lô tá dược "Povidon K30" số lô "RM-POV-01" bị phát hiện nhiễm tạp chất
  When QA Specialist thực hiện truy vết xuôi ("FORWARD") từ lô nguyên liệu này
  Then Hệ thống trả về danh sách chính xác 5 Lô thuốc thành phẩm đã dùng tá dược này
  And Hiển thị trạng thái lưu thông của từng lô phục vụ ra quyết định thu hồi
```
