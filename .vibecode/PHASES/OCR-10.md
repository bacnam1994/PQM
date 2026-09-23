# PHASE MANIFEST: OCR-10 — TCCS CRITERIA MAPPING ENGINE

_Dự án PQM (Pharma Quality Management) — Chuẩn hóa Framework Vibecode_
_Tách biệt hoàn toàn tầng Ánh xạ TCCS khỏi tầng Trích xuất OCR (Rule 10)_

---

## 1. Mục Tiêu (Objective)

Thực thi **Rule 10 (Tách Bạch Tuyệt Đối giữa Extraction và Mapping)**:

- Xây dựng module `tccsMappingService.ts` độc lập, chuyên trách ánh xạ kết quả OCR thô vào danh mục TCCS.
- Hỗ trợ 4 cấp độ ánh xạ có độ ưu tiên phân tầng: `LEARNED → EXACT → DICTIONARY → FUZZY`.
- Tách riêng hoàn toàn `extractionConfidenceScore` (từ OCR) và `mappingScore` (từ ánh xạ) — Rule 11.
- Bảo toàn nguyên bản `value`, `unit`, `limit`, `sourcePageNumber` từ extraction qua tầng mapping.

---

## 2. Phạm Vi Công Việc (Scope)

### Tạo mới

- `src/services/ocr/tccsMappingService.ts`: Module ánh xạ độc lập.

### Sửa đổi

- `src/components/features/MappingConfirmModal.tsx`: Bổ sung fields metadata mới (`mappingScore`, `mappingConfidenceLevel`, `resolvedDictionaryTerm`, `requiresManualConfirmation`) vào interface `AIExtractedItem`.

### Tạo mới (Tests)

- `tests/ocr/tccsMappingService.test.ts`: 16 unit tests bao phủ toàn bộ luồng.

---

## 3. Kiến Trúc Module (tccsMappingService.ts)

```
ExtractedCriterionItem[] (từ Gemini / Tesseract)
             │
             ▼
    mapOcrResultsToTccs(items, tccsNames, learnedMappings)
             │
             ├── Per item: determineMappingLevel()
             │       ├── findLearnedMapping()   → LEARNED  (score 98)
             │       ├── exact string match     → EXACT    (score 95)
             │       ├── lookupPharmaTerm()     → DICTIONARY (score 85–88)
             │       └── contains match         → FUZZY   (score 70)
             │
             ▼
         MappingReport
             ├── highConfidenceMapped  (LEARNED/EXACT/DICTIONARY + extraction >= 75%)
             ├── lowConfidenceMapped   (FUZZY hoặc extraction < 75%)
             └── unmatchedItems        (UNMATCHED → extraCriteria)
             │
             ▼
    mappedResultToAIExtractedItem()
             │
             ▼
         AIExtractedItem  → MappingConfirmModal / finalizeAiMapping
```

---

## 4. Quy Tắc Bất Biến (Invariants)

| Quy tắc                  | Thực thi                                                             |
| ------------------------ | -------------------------------------------------------------------- |
| Rule 10: Separation      | `tccsMappingService.ts` chỉ nhận data thô, không gọi API             |
| Rule 11: Decoupled Score | `extractionConfidenceScore` ≠ `mappingScore`, không bao giờ lẫn nhau |
| Rule 1/3: Preserve Raw   | `value` luôn là chuỗi thô từ OCR, không bị parse/làm tròn            |
| Rule 4: Unit             | Chuẩn hóa qua `normalizeUnit()` nhưng không tự động đổi đơn vị       |
| Rule 5: value ≠ limit    | Trường `value` và `limit` được truyền riêng biệt                     |
| Rule 7: Page             | `sourcePageNumber` bắt buộc bảo toàn                                 |

---

## 5. Báo Cáo Hoàn Thành (Completion Report)

- **Trạng thái**: ✅ PASS
- **Tests**: 16/16 passed (88ms)
- **TypeScript**: `tsc --noEmit` 0 lỗi
- **Build**: `npm run build` thành công
