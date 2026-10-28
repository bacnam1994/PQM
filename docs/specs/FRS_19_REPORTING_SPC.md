# FRS-MOD-19: Đặc Tả Nghiệp Vụ Báo Cáo Chất Lượng & Phân Tích Xu Hướng SPC (PQR / APQR & SPC Charts)

Tài liệu này quy định chi tiết chức năng tổng hợp Báo cáo Đánh giá Chất lượng Sản phẩm Hàng năm (PQR/APQR), tính toán chỉ số năng lực quy trình ($C_p, C_{pk}$) và phân tích xu hướng kiểm soát thống kê (SPC Nelson Rules).

---

## 1. Input & Data Schema

- `productId`: ID sản phẩm cần báo cáo.
- `dateRange`: Khoảng thời gian đánh giá (từ ngày - đến ngày).
- `criterionCode`: Chỉ tiêu định lượng trọng yếu cần vẽ biểu đồ kiểm soát (Assay, pH, Độ hòa tan...).

## 2. Validation Rules

- Báo cáo PQR bắt buộc phải tổng hợp 100% các lô trong kỳ (bao gồm cả các lô bị từ chối `REJECTED`). Nghiêm cấm hành vi loại trừ dữ liệu xấu (Cherry-picking).
- Biểu đồ SPC yêu cầu tối thiểu 10 điểm đo liên tiếp để tính toán giới hạn kiểm soát ($UCL, LCL$).

## 3. Business Rules Reference

- `BR-REP-001`: Quy chuẩn Báo cáo Đánh giá Chất lượng Định kỳ (PQR/APQR) và tính toán năng lực quy trình ($C_p, C_{pk}$).
- `BR-REP-002`: Kiểm soát quá trình bằng thống kê & phát hiện xu hướng bất thường theo quy tắc Western Electric / Nelson Rules.

## 4. State Management

- `DRAFT_REPORT` -> `UNDER_REVIEW` -> `APPROVED_REPORT`.

## 5. Service Layer Contract

```typescript
export interface QualityReportingService {
  generatePQRReport(
    productId: string,
    startDate: string,
    endDate: string
  ): Promise<PQRReportContract>;
  calculateProcessCapability(values: number[], usl: number, lsl: number): ProcessCapabilityMetrics;
  analyzeSPCTrends(criterionCode: string, historicalPoints: DataPoint[]): SPCTrendAnalysisResult;
}
```

## 6. Permission & RBAC

- Khởi tạo báo cáo: `QA_SPECIALIST`.
- Phê duyệt báo cáo PQR: `QA_MANAGER` & `QUALITY_DIRECTOR`.

## 7. Error Handling

- `ERR_REP_INSUFFICIENT_DATA`: Cảnh báo khi tập mẫu quá nhỏ để kết luận thống kê.

## 8. Audit Trail Requirement

- Lưu vết toàn bộ các báo cáo PQR đã phát hành và chữ ký số thẩm định.

## 9. Acceptance Criteria (BDD Gherkin)

```gherkin
Scenario: Tự động phát hiện cảnh báo trôi dạt dữ liệu (Nelson Rule 2)
  Given Một chỉ tiêu hàm lượng có 7 lô liên tiếp có kết quả giảm dần liên tục
  When Hệ thống chạy phân tích xu hướng thống kê SPC
  Then Một cảnh báo "DRIFT_DETECTED" được kích hoạt
  And Biểu đồ Shewhart đánh dấu màu đỏ 7 điểm đo liên tiếp kèm khuyến nghị rà soát thiết bị
```
