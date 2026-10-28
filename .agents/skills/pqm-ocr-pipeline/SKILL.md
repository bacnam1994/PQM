---
name: pqm-ocr-pipeline
description: >-
  Immutable rules and engineering constraints for OCR & AI Vision extraction of
  Test Results (PKN) and TCCS documents in PQM. Activate when working on
  src/services/ocr/, src/services/ai/, PDF/Image extraction, or criteria mapping.
---

# PQM OCR & AI Vision Extraction Rules

This skill defines the 12 immutable rules for extracting Test Results (Phiếu Kiểm Nghiệm - PKN) and TCCS specifications via OCR and AI Vision (`src/services/ocr/`, `src/services/ai/`).

## 12 Immutable Extraction Invariants

1. **Never Infer Invisible Values**: If a result cell, signature, batch number, or date is obscured, torn, or unreadable, leave it blank or mark `UNREADABLE`. Never guess from TCCS limits.
2. **Zero Hallucination / Zero Fabrication**: Every numerical value (assay, percentage, CFU count) must have direct pixel evidence on the source document.
3. **Preserve Decimal Delimiters**: In pharmaceutical records, `0.05` ≠ `0.5` ≠ `50`. Never drop decimal separators or round numbers (`502.48 mg` must not become `502.5 mg`).
4. **Mandatory Unit Preservation**: Always extract and preserve exact measurement units (`ppm`, `ppb`, `%`, `mg/viên`, `CFU/g`, `CFU/ml`, `g/ml`, `pH`).
5. **Strict Separation of Actual Value vs Specification Limit**: Never confuse the "Specification / Limit" column (e.g., `≤ 10.0 ppm`) with the "Actual Result" column (e.g., `1.2 ppm`).
6. **Preserve Comparison & Scientific Notation Symbols**: Retain mathematical and microbiological notation verbatim (`≤`, `≥`, `<`, `>`, `±`, `×10³`, `1.5 x 10^3 CFU/g`). Never strip `<` from `< 0.01`.
7. **Preserve Source Page Index**: Attach `sourcePageNumber` metadata to each extracted criterion for side-by-side PDF review navigation.
8. **Zero Loss Across Multi-Page Documents**: Merge continuation tables across pages (2–10+ pages) without dropping boundary rows (`src/services/ocr/multiPageMerger.ts`).
9. **Raw OCR Preservation**: Store the unmodified raw OCR/Vision text in `rawOcrText` or `rawExtractionPayload` for auditability.
10. **Decouple Extraction from Mapping**:
    - Step 1 (Extraction): Read literal document text (`criteriaName`, `actualResult`).
    - Step 2 (Mapping): Match extracted items against TCCS criteria (`src/services/ocr/tccsMappingService.ts`). Mapping errors must never corrupt Step 1 data.
11. **Decoupled Confidence Score**: Store per-field confidence (`confidence: 0..100`) in dedicated metadata, never mixed into the value string.
12. **Mandatory Low-Confidence Guard**: Any field with `confidence < 75%` (`LOW`) must be flagged in amber/red on the Review UI (`MappingConfirmModal.tsx`) for mandatory human QA/QC verification (`src/services/ocr/confidenceGuard.ts`).
