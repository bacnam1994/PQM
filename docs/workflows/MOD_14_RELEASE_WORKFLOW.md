# PHÂN HỆ 14: RELEASE GATE WORKFLOW

## (QUY TRÌNH CHỐT CHẶN XUẤT XƯỞNG LÔ SẢN PHẨM)

> **Mã phân hệ**: `MOD-14`  
> **Tài liệu**: `docs/workflows/MOD_14_RELEASE_WORKFLOW.md`  
> **Phạm vi**: Thẩm định điều kiện xuất xưởng, chốt chặn kỹ thuật (Release Gate), phân quyền Người được ủy quyền (Authorized Person/QA Director), niêm phong hồ sơ lô và cơ chế phong tỏa khẩn cấp.

---

### 1. MỤC ĐÍCH (PURPOSE)

Thiết lập "Rào chắn an ninh tối thượng" của toàn bộ hệ thống PQM. Ngăn chặn tuyệt đối việc bất kỳ lô sản phẩm nào không đạt chất lượng, chưa hoàn thành kiểm nghiệm, hoặc đang có sự cố pháp lý bị xuất xưởng đưa ra thị trường lưu hành.

---

### 2. 5 ĐIỀU KIỆN TIÊN QUYẾT BẮT BUỘC ĐỂ XUẤT XƯỞNG (RELEASE CRITERIA)

Hệ thống chỉ cho phép chuyển trạng thái Lô sang `RELEASED` khi và chỉ khi thỏa mãn đồng thời cả 5 điều kiện sau:

1. **`batch.qualityStatus === 'PASS'`**: Trạng thái chất lượng kỹ thuật do Động cơ Thẩm định xác nhận là ĐẠT (kể cả thông qua Alternate Rule).
2. **Phiếu kiểm nghiệm hoàn tất**: Toàn bộ các Phiếu kiểm nghiệm (`PKN`) liên kết với Lô phải ở trạng thái `APPROVED` và sở hữu bản `EvaluationSnapshot` có mã băm SHA-256 hợp lệ.
3. **Không có OOS đang mở**: Không tồn tại bất kỳ hồ sơ OOS nào của Lô đang ở trạng thái chưa đóng (`INITIATED`, `PHASE_1_LAB`, `PHASE_2_MFG`).
4. **Không có Sai lệch nghiêm trọng chưa đóng**: Không có hồ sơ Deviation mức độ MAJOR hoặc CRITICAL đang mở.
5. **Thẩm quyền Ký số**: Người thực hiện ký lệnh xuất xưởng phải có vai trò `QA_DIRECTOR` hoặc `AUTHORIZED_PERSON` và hoàn tất xác thực ký số điện tử FDA Part 11.

---

### 3. BẢO VỆ ĐA LỚP (DEFENSE IN DEPTH)

Để đảm bảo nguyên tắc Release Gate không bao giờ bị phá vỡ bởi lỗi code hay can thiệp API:

```
[Layer 1: UI Action Guard]
    │  (Kiểm tra 5 điều kiện trước khi hiển thị nút "Xuất xưởng")
    ▼
[Layer 2: Domain State Machine]
    │  (BatchStateMachine.canTransitionTo('RELEASED') ném lỗi nếu vi phạm)
    ▼
[Layer 3: Application Service Guard]
    │  (BatchService.releaseBatch() kiểm tra tính toàn vẹn chữ ký và snapshot)
    ▼
[Layer 4: Database Security Rules (database.rules.json)]
       (Cơ sở dữ liệu Firebase từ chối lệnh ghi nếu qualityStatus !== 'PASS')
```

---

### 4. QUY TRÌNH PHONG TỎA KHẨN CẤP (EMERGENCY BLOCK / RECALL)

- Trong trường hợp phát hiện sự cố chất lượng sau khi Lô đã `RELEASED`:
  1. QA Manager kích hoạt chức năng "Phong tỏa Lô khẩn cấp" tại `SC-10`.
  2. Lô chuyển ngay sang trạng thái `BLOCKED`.
  3. Mọi quyền truy xuất mã QR công khai của CoA lập tức hiển thị cảnh báo: _"LÔ HÀNG ĐANG BỊ PHONG TỎA CHỜ XỬ LÝ"_.
  4. Hệ thống yêu cầu lập ngay hồ sơ Sai lệch khẩn cấp.

---

### 5. TIÊU CHÍ NGHIỆM THU (ACCEPTANCE CRITERIA)

- `AC-REL-01`: Nếu `qualityStatus !== 'PASS'`, nút "Xuất xưởng" bị vô hiệu hóa hoàn toàn trên UI.
- `AC-REL-02`: Lệnh ghi trực tiếp trạng thái `RELEASED` vào cơ sở dữ liệu sẽ bị Firebase Rules từ chối nếu không thỏa điều kiện an toàn.
- `AC-REL-03`: Mọi hành động Xuất xưởng và Phong tỏa đều bắt buộc ghi ALCOA+ Audit Trail.
