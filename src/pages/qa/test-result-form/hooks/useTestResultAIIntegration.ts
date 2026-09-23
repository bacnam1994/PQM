import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { geminiService, formatGeminiError } from '../../../../services/ai/geminiService';
import { isCriteriaMatch } from '../../../../utils/aiMapping';
import { recordHighConfidenceOCRMappings } from '../../../../services/ai/autoLearningService';
import { buildExtractionPrompt } from '../../../../services/ai/prompts';
import { BatchFileStatus } from '../components/BatchScanProgressModal';
import { GDFile } from '../components/GDFileSelectorModal';
import { AIScanInfo } from '../components/TestResultHeader';
import {
  AIExtractedItem,
  ConfirmedMapping,
} from '../../../../components/features/MappingConfirmModal';
import { ParsedVoiceCriteria } from '../../../../services/ai/voiceParserService';
import { useUIStore } from '../../../../store/useUIStore';
import { useAppStore } from '../../../../store/useAppStore';
import { HydratedBatch } from '../../../../hooks/useDataGraph';
import { Criterion, TCCS, Product, AILearnedMapping } from '../../../../types';
import { normalizeAIData } from '../../../../services/ai/aiDraftManager';
import { generateId, BATCH_STATUS } from '../../../../utils';
import { resolveCanonicalLab } from '../../../../services/laboratoryService';
import { evaluateDocumentConfidenceGuard } from '../../../../services/ocr/confidenceGuard';

/**
 * OCR-09: Áp dụng Confidence Guard lên danh sách chỉ tiêu đã được AI làm giàu.
 * - Tính `assessment` cho từng item (Rule 11: Decoupled Confidence Score).
 * - Item bị guard đánh là LOW (score < 75 hoặc có trường nghi vấn) sẽ bị buộc
 *   chuyển sang vòng xác nhận thủ công dù AI đã đánh là 'high' (Rule 12: LOW Confidence Guard).
 * Trả về { highItems, lowItems, hasCriticalSuspicion }.
 */
function applyConfidenceGuard(enrichedItems: AIExtractedItem[]): {
  highItems: AIExtractedItem[];
  lowItems: AIExtractedItem[];
  hasCriticalSuspicion: boolean;
} {
  // Chuyển đổi AIExtractedItem → ExtractedCriterionItem tương thích với guard
  const guardInput = enrichedItems.map((item) => ({
    criteriaName: item.criteriaName,
    mappedName: item.mappedName,
    confidence: (item.confidence === 'high' ? 'high' : 'low') as 'high' | 'low',
    confidenceScore: item.confidenceScore,
    value: item.value ?? '',
    unit: item.unit,
    limit: item.limit,
    sourcePageNumber: item.sourcePageNumber ?? 1,
  }));

  const report = evaluateDocumentConfidenceGuard(guardInput);

  // Ánh xạ kết quả guard trở lại AIExtractedItem với assessment bổ sung
  const highItems: AIExtractedItem[] = [];
  const lowItems: AIExtractedItem[] = [];

  report.guardedItems.forEach((guarded, idx) => {
    const original = enrichedItems[idx];
    const enriched: AIExtractedItem = {
      ...original,
      confidenceScore: guarded.assessment.overallScore,
      warningMessages:
        guarded.assessment.warningMessages.length > 0
          ? guarded.assessment.warningMessages
          : original.warningMessages,
      isSuspicious: guarded.assessment.isLowConfidence,
    };

    // Rule 12: Nếu guard yêu cầu xác nhận thủ công → buộc vào lowItems
    if (guarded.assessment.requiresManualConfirmation) {
      lowItems.push(enriched);
    } else {
      // Chỉ điền tự động nếu cả AI VÀ guard đều tin tưởng
      if (original.confidence === 'high' && original.mappedName) {
        highItems.push(enriched);
      } else {
        lowItems.push(enriched);
      }
    }
  });

  return { highItems, lowItems, hasCriticalSuspicion: report.hasCriticalSuspicion };
}

interface UseTestResultAIIntegrationProps {
  allActiveTccsNames: string[];
  allCriteria: Criterion[];
  aiLearnedMappings: AILearnedMapping[];
  hydratedBatches: HydratedBatch[];
  tccsList: TCCS[];
  products: Product[];
  formValues: {
    batchId: string;
    labId?: string;
    labName: string;
    testDate: string;
    testResultsMap: Record<string, string | number>;
    extraCriteria: any[];
    attachments: any[];
  };
  setFieldValue: (field: string, value: any) => void;
  setMapValue: (field: string, key: string, value: any) => void;
  addToArray: (field: string, item: any) => void;
  handleBatchSelect: (batchId: string, preserveResults?: boolean) => void;
  setBatchSearch: (val: string) => void;
  aiFilledFields: Set<string>;
  setAiFilledFields: React.Dispatch<React.SetStateAction<Set<string>>>;
  addBatch: (data: any) => Promise<any>;
  setFormValues?: React.Dispatch<React.SetStateAction<any>>;
}

export function useTestResultAIIntegration({
  allActiveTccsNames,
  allCriteria,
  aiLearnedMappings,
  hydratedBatches,
  formValues,
  setFieldValue,
  setMapValue,
  addToArray,
  handleBatchSelect,
  setBatchSearch,
  aiFilledFields,
  setAiFilledFields,
  addBatch,
  setFormValues,
}: UseTestResultAIIntegrationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiScanInfo, setAiScanInfo] = useState<AIScanInfo | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const addAiLearnedMapping = useAppStore((state) => state.addAiLearnedMapping);
  const tccsList = useAppStore((state) => state.tccsList);
  const products = useAppStore((state) => state.products);
  const testingLaboratories = useAppStore((state) => state.testingLaboratories);

  // Mapping modal states
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [pendingAiRawData, setPendingAiRawData] = useState<any>(null);
  const [pendingHighItems, setPendingHighItems] = useState<AIExtractedItem[]>([]);
  const [pendingLowItems, setPendingLowItems] = useState<AIExtractedItem[]>([]);

  // Batch scan states
  const [isBatchProgressOpen, setIsBatchProgressOpen] = useState(false);
  const [batchScanFiles, setBatchScanFiles] = useState<BatchFileStatus[]>([]);

  // Auto create batch states
  const [isAutoCreateModalOpen, setIsAutoCreateModalOpen] = useState(false);
  const [pendingAutoCreateData, setPendingAutoCreateData] = useState<any>(null);

  // Google Drive Modal states
  const { googleDriveFolderUrl, googleDriveFolderId, googleDriveClientId } = useUIStore();
  const [isGDModalOpen, setIsGDModalOpen] = useState(false);
  const [gdFiles, setGDFiles] = useState<GDFile[]>([]);
  const [isLoadingGDFiles, setIsLoadingGDFiles] = useState(false);
  const [gdToken, setGdToken] = useState<string | null>(null);

  // Dev hook for E2E testing
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__TEST_TRIGGER_AUTO_CREATE_BATCH__ = (mockData?: any) => {
        setPendingAutoCreateData(
          mockData || {
            batchNo: 'LÔ-AI-TEST-' + Date.now().toString().slice(-4),
            productCode: 'SP-TEST-01',
            productName: 'Sản phẩm Test AI',
            mfgDate: '01/01/2026',
            expDate: '01/01/2028',
          }
        );
        setIsAutoCreateModalOpen(true);
      };
    }
    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).__TEST_TRIGGER_AUTO_CREATE_BATCH__;
      }
    };
  }, []);

  const handleDataExtracted = useCallback(
    (data: any) => {
      const normalized = normalizeAIData(data);
      if (!normalized) {
        toast.error('Dữ liệu AI không hợp lệ.');
        return;
      }

      let isoDate = normalized.testDate;
      if (isoDate && isoDate.includes('/')) {
        const parts = isoDate.split('/');
        if (parts.length === 3) {
          isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }

      let matchedBatch: HydratedBatch | undefined;
      if (normalized.batchId) {
        matchedBatch = hydratedBatches.find((b) => b.id === normalized.batchId);
      }
      if (!matchedBatch && normalized.batchNo) {
        const cleanNo = normalized.batchNo.trim().toUpperCase();
        matchedBatch = hydratedBatches.find((b) => b.batchNo?.trim().toUpperCase() === cleanNo);

        if (!matchedBatch) {
          const normCleanNo = cleanNo.replace(/[^A-Z0-9]/g, '');
          matchedBatch = hydratedBatches.find((b) => {
            const norm = (b.batchNo || '').replace(/[^A-Z0-9]/g, '');
            return norm && norm === normCleanNo;
          });
        }
      }

      // Resolve criteria to match against
      let criteriaToMatch: any[] = allCriteria;
      if (criteriaToMatch.length === 0 && matchedBatch) {
        const batchTccs =
          (matchedBatch.tccsId ? tccsList.find((t: any) => t.id === matchedBatch.tccsId) : null) ||
          (matchedBatch.mfgDate
            ? tccsList
                .filter((t: any) => t.productId === matchedBatch.productId)
                .sort(
                  (a: any, b: any) =>
                    new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
                )
                .find(
                  (t: any) =>
                    new Date(t.issueDate).getTime() <= new Date(matchedBatch.mfgDate!).getTime()
                )
            : null) ||
          tccsList.find((t: any) => t.productId === matchedBatch.productId && t.isActive) ||
          tccsList.find((t: any) => t.productId === matchedBatch.productId);

        if (batchTccs) {
          criteriaToMatch = [
            ...(batchTccs.mainQualityCriteria || []),
            ...(batchTccs.safetyCriteria || []),
          ];
        }
      }

      if (criteriaToMatch.length === 0) {
        let targetProduct = null;
        if (normalized.productCode) {
          targetProduct = products.find(
            (p: any) =>
              p.code?.trim().toLowerCase() === normalized.productCode?.trim().toLowerCase()
          );
        }
        if (!targetProduct && normalized.productName) {
          targetProduct = products.find(
            (p: any) =>
              p.name?.trim().toLowerCase() === normalized.productName?.trim().toLowerCase()
          );
        }
        if (targetProduct) {
          const prodTccs =
            tccsList.find((t: any) => t.productId === targetProduct.id && t.isActive) ||
            tccsList.find((t: any) => t.productId === targetProduct.id);
          if (prodTccs) {
            criteriaToMatch = [
              ...(prodTccs.mainQualityCriteria || []),
              ...(prodTccs.safetyCriteria || []),
            ];
          }
        }
      }

      if (criteriaToMatch.length === 0) {
        const activeCriteriaMap = new Map<string, any>();
        tccsList
          .filter((t: any) => t.isActive)
          .forEach((tccs: any) => {
            (tccs.mainQualityCriteria || []).forEach((c: any) => {
              if (c?.name && !activeCriteriaMap.has(c.name.trim().toLowerCase())) {
                activeCriteriaMap.set(c.name.trim().toLowerCase(), c);
              }
            });
            (tccs.safetyCriteria || []).forEach((c: any) => {
              if (c?.name && !activeCriteriaMap.has(c.name.trim().toLowerCase())) {
                activeCriteriaMap.set(c.name.trim().toLowerCase(), c);
              }
            });
          });
        criteriaToMatch = Array.from(activeCriteriaMap.values());
      }

      const nextTestResultsMap: Record<string, string | number> = {};
      const nextExtraCriteria: any[] = [];
      const newAiFilled = new Set(aiFilledFields);
      let matchCount = 0;
      let extraCount = 0;

      if (normalized.testResults && Array.isArray(normalized.testResults)) {
        normalized.testResults.forEach((r: any, index: number) => {
          const matchCrit = criteriaToMatch.find((c) =>
            isCriteriaMatch(r.criteriaName, c.name, aiLearnedMappings)
          );

          if (matchCrit) {
            nextTestResultsMap[matchCrit.name] = r.value;
            newAiFilled.add(matchCrit.name);
            matchCount++;
          } else {
            nextExtraCriteria.push({
              id:
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                  ? `extra_${crypto.randomUUID()}`
                  : `extra_${Date.now()}_${index}`,
              name: r.criteriaName,
              value: r.value,
              unit: r.unit || '',
              limit: r.limit || '',
            });
            extraCount++;
          }
        });
      }

      // Phân giải chuẩn hóa Đơn vị Kiểm nghiệm (labId và canonicalName)
      const labInfo = normalized.labName
        ? resolveCanonicalLab(normalized.labName, testingLaboratories)
        : null;

      // Atomic form values update
      if (setFormValues) {
        setFormValues((prev: any) => ({
          ...prev,
          ...(labInfo?.labName
            ? { labName: labInfo.labName }
            : normalized.labName
              ? { labName: normalized.labName }
              : {}),
          ...(labInfo?.labId ? { labId: labInfo.labId } : {}),
          ...(isoDate ? { testDate: isoDate } : {}),
          ...(matchedBatch ? { batchId: matchedBatch.id } : {}),
          testResultsMap: {
            ...(prev?.testResultsMap || {}),
            ...nextTestResultsMap,
          },
          extraCriteria: [...(prev?.extraCriteria || []), ...nextExtraCriteria],
        }));
      } else {
        if (labInfo?.labName) setFieldValue('labName', labInfo.labName);
        else if (normalized.labName) setFieldValue('labName', normalized.labName);
        if (labInfo?.labId) setFieldValue('labId', labInfo.labId);
        if (isoDate) setFieldValue('testDate', isoDate);
        if (matchedBatch) setFieldValue('batchId', matchedBatch.id);
        Object.entries(nextTestResultsMap).forEach(([k, v]) => {
          setMapValue('testResultsMap', k, v);
        });
        nextExtraCriteria.forEach((item) => {
          addToArray('extraCriteria', item);
        });
      }

      // Handle batch side effects safely
      if (matchedBatch) {
        handleBatchSelect(matchedBatch.id, true);
        setBatchSearch(
          matchedBatch.product?.name
            ? `${matchedBatch.batchNo} - ${matchedBatch.product.name}`
            : matchedBatch.batchNo
        );
        toast.success(`Đã tự động chọn lô hàng: ${matchedBatch.batchNo}`);
      } else if (normalized.batchNo) {
        setPendingAutoCreateData({
          batchNo: normalized.batchNo,
          productName: normalized.productName,
          productCode: normalized.productCode,
          mfgDate: normalized.mfgDate,
          expDate: normalized.expDate,
        });
        setIsAutoCreateModalOpen(true);
      }

      setAiFilledFields(newAiFilled);
      if (matchCount > 0 || extraCount > 0) {
        toast.success(
          `AI: Đã điền ${matchCount} chỉ tiêu theo TCCS` +
            (extraCount > 0 ? `, ${extraCount} chỉ tiêu bổ sung.` : '.')
        );
      }
    },
    [
      hydratedBatches,
      allCriteria,
      aiLearnedMappings,
      aiFilledFields,
      setFormValues,
      setFieldValue,
      setMapValue,
      addToArray,
      handleBatchSelect,
      setBatchSearch,
      setAiFilledFields,
      tccsList,
      products,
    ]
  );

  const handleAutoCreateBatchConfirm = useCallback(
    async (newBatchData: {
      batchNo: string;
      productId: string;
      tccsId?: string;
      mfgDate?: string;
      expDate?: string;
      initialQuantity?: number;
      notes?: string;
    }) => {
      try {
        const newBatchId = generateId('batch');
        const activeTccs = newBatchData.tccsId
          ? tccsList.find((t: any) => t.id === newBatchData.tccsId)
          : tccsList.find((t: any) => t.productId === newBatchData.productId && t.isActive) ||
            tccsList.find((t: any) => t.productId === newBatchData.productId);

        const batchToCreate: any = {
          id: newBatchId,
          batchNo: newBatchData.batchNo.trim(),
          productId: newBatchData.productId,
          tccsId: activeTccs?.id || '',
          mfgDate: newBatchData.mfgDate || '',
          expDate: newBatchData.expDate || '',
          status: BATCH_STATUS.PENDING,
          theoreticalYield: 0,
          actualYield: 0,
          yieldUnit: 'kg',
          createdAt: new Date().toISOString(),
        };

        await addBatch(batchToCreate);
        if (!mountedRef.current) return;
        toast.success(`Đã tạo lô mới ${newBatchData.batchNo} thành công!`);
        setIsAutoCreateModalOpen(false);
        setPendingAutoCreateData(null);

        // Select newly created batch
        handleBatchSelect(newBatchId, true);
        const prod = products.find((p: any) => p.id === newBatchData.productId);
        setBatchSearch(`${newBatchData.batchNo}${prod ? ' - ' + prod.name : ''}`);

        // Migrate extra criteria that match the newly assigned TCCS
        if (activeTccs) {
          const batchCriteria = [
            ...(activeTccs.mainQualityCriteria || []),
            ...(activeTccs.safetyCriteria || []),
          ];
          if (batchCriteria.length > 0 && setFormValues) {
            setFormValues((prev: any) => {
              const currentExtras = prev?.extraCriteria || [];
              const remainingExtras: any[] = [];
              const additionalMap: Record<string, any> = {};

              currentExtras.forEach((extra: any) => {
                const matched = batchCriteria.find((c: any) =>
                  isCriteriaMatch(extra.name, c.name, aiLearnedMappings)
                );
                if (matched) {
                  additionalMap[matched.name] = extra.value;
                } else {
                  remainingExtras.push(extra);
                }
              });

              return {
                ...prev,
                batchId: newBatchId,
                testResultsMap: {
                  ...(prev?.testResultsMap || {}),
                  ...additionalMap,
                },
                extraCriteria: remainingExtras,
              };
            });
          }
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        console.error(err);
        toast.error('Lỗi khi tạo lô mới: ' + (err.message || 'Thất bại'));
      }
    },
    [
      addBatch,
      handleBatchSelect,
      products,
      tccsList,
      setBatchSearch,
      setFormValues,
      aiLearnedMappings,
    ]
  );

  const finalizeAiMapping = useCallback(
    (result: any, highItems: AIExtractedItem[], confirmedLowItems: ConfirmedMapping[]) => {
      const autoMappings = highItems
        .filter((i) => i.mappedName && i.criteriaName !== i.mappedName)
        .map((i) => ({ originalName: i.criteriaName, systemName: i.mappedName }));
      if (autoMappings.length > 0) recordHighConfidenceOCRMappings(autoMappings);

      const mergedResults = [
        ...highItems.map((i) => ({
          criteriaName: i.mappedName || i.criteriaName,
          aiOriginalName: i.criteriaName,
          value: i.value,
          unit: i.unit,
          limit: i.limit,
        })),
        ...confirmedLowItems.map((m) => ({
          criteriaName: m.systemName || m.originalName,
          aiOriginalName: m.originalName,
          value: m.value,
          unit: m.unit,
          limit: m.limit,
        })),
      ];

      handleDataExtracted({ ...result, testResults: mergedResults });
    },
    [handleDataExtracted]
  );

  const handleMappingConfirmed = useCallback(
    (confirmedMappings: ConfirmedMapping[], rememberMappings: boolean) => {
      setIsMappingModalOpen(false);
      if (!pendingAiRawData) return;

      if (rememberMappings) {
        confirmedMappings.forEach((m) => {
          if (m.originalName !== m.systemName) {
            addAiLearnedMapping(m.originalName, m.systemName);
          }
        });
      }

      finalizeAiMapping(pendingAiRawData, pendingHighItems, confirmedMappings);
    },
    [pendingAiRawData, pendingHighItems, addAiLearnedMapping, finalizeAiMapping]
  );

  const handleAiFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;

      if (files.length === 1) {
        const file = files[0];
        setIsAiProcessing(true);
        try {
          const prompt = buildExtractionPrompt(allActiveTccsNames, undefined, testingLaboratories);
          const result = await geminiService.extractDataFromDocument(file, prompt);

          setAiScanInfo({
            documentType: result.documentType,
            pageCount: result.pageCount,
            notes: result.notes,
            fileCount: 1,
          });

          const rawItems: AIExtractedItem[] = (result.testResults || []).map((r: any) => ({
            criteriaName: r.criteriaName || '',
            mappedName: r.mappedName || '',
            confidence: r.confidence || 'low',
            value: r.value || '',
            unit: r.unit || '',
            limit: r.limit || '',
            sourcePageNumber: r.sourcePageNumber,
          }));

          const enrichedItems = rawItems.map((item) => {
            if (item.confidence === 'high' && item.mappedName) return item;
            const learnedMatch = aiLearnedMappings.find((m) =>
              isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings)
            );
            if (learnedMatch)
              return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' as const };
            const fuzzyMatch = allActiveTccsNames.find((tccsName) =>
              isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
            );
            if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' as const };
            return item;
          });

          // OCR-09: Chạy Confidence Guard (Rule 11 & Rule 12)
          const { highItems, lowItems, hasCriticalSuspicion } = applyConfidenceGuard(enrichedItems);
          if (hasCriticalSuspicion) {
            toast(
              '⚠️ Phát hiện giá trị nghi ngờ OCR — vui lòng kiểm tra kỹ các chỉ tiêu được đánh dấu.',
              {
                duration: 5000,
                icon: '🔍',
              }
            );
          }

          setPendingAiRawData(result);
          setPendingHighItems(highItems);
          setPendingLowItems(lowItems);

          if (lowItems.length > 0) {
            setIsMappingModalOpen(true);
          } else {
            finalizeAiMapping(result, highItems, []);
          }
        } catch (error: any) {
          toast.error(formatGeminiError(error), { duration: 6000 });
        } finally {
          setIsAiProcessing(false);
          e.target.value = '';
        }
      } else {
        // Batch multi-file scan
        const initialStatuses: BatchFileStatus[] = files.map((f) => ({
          fileName: f.name,
          status: 'waiting',
        }));
        setBatchScanFiles(initialStatuses);
        setIsBatchProgressOpen(true);
        setIsAiProcessing(true);

        const prompt = buildExtractionPrompt(allActiveTccsNames, undefined, testingLaboratories);
        const results: any[] = [];
        const failedFiles: string[] = [];

        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          setBatchScanFiles((prev) =>
            prev.map((item, idx) =>
              idx === i
                ? {
                    ...item,
                    status: 'processing',
                    progressStep: 'Đang trích xuất OCR...',
                    progressPercent: 30,
                  }
                : item
            )
          );

          try {
            const res = await geminiService.extractDataFromDocument(
              f,
              prompt,
              (step: string, percent: number) => {
                setBatchScanFiles((prev) =>
                  prev.map((item, idx) =>
                    idx === i ? { ...item, progressStep: step, progressPercent: percent } : item
                  )
                );
              }
            );
            results.push(res);
            setBatchScanFiles((prev) =>
              prev.map((item, idx) =>
                idx === i
                  ? {
                      ...item,
                      status: 'done',
                      criteriaCount: res.testResults?.length || 0,
                      progressPercent: 100,
                    }
                  : item
              )
            );
          } catch (err: any) {
            console.error(`Batch OCR lỗi file ${f.name}:`, err);
            failedFiles.push(f.name);
            setBatchScanFiles((prev) =>
              prev.map((item, idx) =>
                idx === i ? { ...item, status: 'error', error: formatGeminiError(err) } : item
              )
            );
          }
        }

        if (results.length === 0) {
          toast.error('Không thể trích xuất dữ liệu từ bất kỳ file nào.', { duration: 5000 });
          setIsAiProcessing(false);
          e.target.value = '';
          return;
        }

        try {
          const mergedData: any = {
            batchNo: results.find((r) => r.batchNo)?.batchNo || '',
            labName: results.find((r) => r.labName)?.labName || '',
            testDate: results.find((r) => r.testDate)?.testDate || '',
            testResults: [],
          };

          const seenNames = new Set<string>();
          const extraFromDuplicates: any[] = [];

          results.forEach((r) => {
            (r.testResults || []).forEach((item: any) => {
              const key = (item.criteriaName || '').trim().toLowerCase();
              if (!seenNames.has(key)) {
                seenNames.add(key);
                mergedData.testResults.push(item);
              } else {
                extraFromDuplicates.push(item);
              }
            });
          });

          const totalPages = results.reduce((acc, r) => acc + (r.pageCount || 1), 0);
          setAiScanInfo({
            documentType: results[0]?.documentType,
            pageCount: totalPages,
            notes: results
              .map((r) => r.notes)
              .filter(Boolean)
              .join('; '),
            fileCount: results.length,
          });

          const rawItems: AIExtractedItem[] = mergedData.testResults.map((r: any) => ({
            criteriaName: r.criteriaName || '',
            mappedName: r.mappedName || '',
            confidence: r.confidence || 'low',
            value: r.value || '',
            unit: r.unit || '',
            limit: r.limit || '',
          }));

          const enrichedItems = rawItems.map((item) => {
            if (item.confidence === 'high' && item.mappedName) return item;
            const learnedMatch = aiLearnedMappings.find((m) =>
              isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings)
            );
            if (learnedMatch)
              return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' as const };
            const fuzzyMatch = allActiveTccsNames.find((tccsName) =>
              isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
            );
            if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' as const };
            return item;
          });

          // OCR-09: Chạy Confidence Guard (Rule 11 & Rule 12)
          const { highItems, lowItems, hasCriticalSuspicion } = applyConfidenceGuard(enrichedItems);
          if (hasCriticalSuspicion) {
            toast(
              '⚠️ Phát hiện giá trị nghi ngờ OCR — vui lòng kiểm tra kỹ các chỉ tiêu được đánh dấu.',
              {
                duration: 5000,
                icon: '🔍',
              }
            );
          }

          if (extraFromDuplicates.length > 0) {
            mergedData._extraDuplicates = extraFromDuplicates;
          }

          setPendingAiRawData(mergedData);
          setPendingHighItems(highItems);
          setPendingLowItems(lowItems);

          if (lowItems.length > 0) {
            setIsMappingModalOpen(true);
          } else {
            finalizeAiMapping(mergedData, highItems, []);
          }

          if (extraFromDuplicates.length > 0) {
            extraFromDuplicates.forEach((r: any, idx: number) => {
              addToArray('extraCriteria', {
                id:
                  typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? `extra_dup_${crypto.randomUUID()}`
                    : `extra_dup_${Date.now()}_${idx}`,
                name: r.criteriaName,
                value: r.value,
                unit: r.unit || '',
                limit: r.limit || '',
              });
            });
            toast(
              `${extraFromDuplicates.length} chỉ tiêu trùng tên từ các file khác đã được thêm vào Chỉ tiêu bổ sung.`,
              {
                icon: 'ℹ️',
              }
            );
          }
        } catch (error: any) {
          if (!mountedRef.current) return;
          toast.error(formatGeminiError(error), { duration: 6000 });
        } finally {
          if (mountedRef.current) {
            setIsAiProcessing(false);
            e.target.value = '';
          }
        }
      }
    },
    [allActiveTccsNames, aiLearnedMappings, finalizeAiMapping, addToArray]
  );

  const handleApplyVoiceCriteria = useCallback(
    (entries: ParsedVoiceCriteria[]) => {
      if (!entries || entries.length === 0) return;
      const newAiFilled = new Set(aiFilledFields);
      let matchedCount = 0;
      let extraCount = 0;

      entries.forEach((entry, index) => {
        const matchCrit = allCriteria.find((c) =>
          isCriteriaMatch(entry.criteriaName, c.name, aiLearnedMappings)
        );

        if (matchCrit) {
          setMapValue('testResultsMap', matchCrit.name, entry.value);
          newAiFilled.add(matchCrit.name);
          matchedCount++;
        } else {
          addToArray('extraCriteria', {
            id:
              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                ? `extra_voice_${crypto.randomUUID()}`
                : `extra_voice_${Date.now()}_${index}`,
            name: entry.criteriaName,
            value: entry.value,
            unit: '',
            limit: '',
          });
          extraCount++;
        }
      });

      setAiFilledFields(newAiFilled);
      toast.success(
        `Giọng nói: Đã điền ${matchedCount} chỉ tiêu TCCS` +
          (extraCount > 0 ? `, ${extraCount} chỉ tiêu bổ sung.` : '.')
      );
    },
    [allCriteria, aiLearnedMappings, aiFilledFields, setMapValue, addToArray, setAiFilledFields]
  );

  const fetchFilesFromGD = useCallback(
    async (token: string) => {
      setIsLoadingGDFiles(true);
      try {
        const q = `'${googleDriveFolderId}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
          q
        )}&fields=files(id,name,mimeType,createdTime,size)&orderBy=createdTime+desc`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Không thể tải danh sách file.');
        }

        const data = await response.json();
        if (!mountedRef.current) return;
        setGDFiles(data.files || []);
      } catch (err: any) {
        if (!mountedRef.current) return;
        console.error(err);
        toast.error('Lỗi khi tải file từ Google Drive: ' + err.message);
        setGdToken(null);
      } finally {
        if (mountedRef.current) {
          setIsLoadingGDFiles(false);
        }
      }
    },
    [googleDriveFolderId]
  );

  const handleGDScanClick = useCallback(() => {
    if (!googleDriveClientId || !googleDriveFolderId) {
      toast.error(
        'Vui lòng cấu hình Google Client ID và Đường dẫn thư mục Google Drive trong phần Cài đặt hệ thống!'
      );
      return;
    }

    setIsGDModalOpen(true);
    if (gdToken) {
      fetchFilesFromGD(gdToken);
    } else {
      setIsLoadingGDFiles(true);
      const gClient = (window as any).google?.accounts?.oauth2?.initTokenClient({
        client_id: googleDriveClientId,
        scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (tokenResponse: any) => {
          if (!mountedRef.current) return;
          if (tokenResponse.error) {
            setIsGDModalOpen(false);
            setIsLoadingGDFiles(false);
            toast.error('Yêu cầu đăng nhập Google Drive thất bại: ' + tokenResponse.error);
            return;
          }
          const token = tokenResponse.access_token;
          setGdToken(token);
          fetchFilesFromGD(token);
        },
      });

      if (!gClient) {
        setIsGDModalOpen(false);
        setIsLoadingGDFiles(false);
        toast.error('Không thể khởi tạo Google API Client SDK. Vui lòng tải lại trang.');
      } else {
        gClient.requestAccessToken();
      }
    }
  }, [googleDriveClientId, googleDriveFolderId, gdToken, fetchFilesFromGD]);

  const handleSelectGoogleDriveFile = useCallback(
    async (file: GDFile) => {
      setIsGDModalOpen(false);
      setIsAiProcessing(true);
      try {
        if (!gdToken) throw new Error('Mất kết nối tài khoản Google. Vui lòng thử lại.');

        const url = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${gdToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Lỗi khi tải nội dung file từ Drive');
        }

        const blob = await response.blob();
        const fileObject = new File([blob], file.name, { type: file.mimeType });

        const prompt = buildExtractionPrompt(allActiveTccsNames, undefined, testingLaboratories);
        const result = await geminiService.extractDataFromDocument(fileObject, prompt);

        if (!mountedRef.current) return;
        setAiScanInfo({
          documentType: result.documentType,
          pageCount: result.pageCount,
          notes: result.notes,
          fileCount: 1,
        });

        const rawItems: AIExtractedItem[] = (result.testResults || []).map((r: any) => ({
          criteriaName: r.criteriaName || '',
          mappedName: r.mappedName || '',
          confidence: r.confidence || 'low',
          value: r.value || '',
          unit: r.unit || '',
          limit: r.limit || '',
          sourcePageNumber: r.sourcePageNumber,
        }));

        const enrichedItems = rawItems.map((item) => {
          if (item.confidence === 'high' && item.mappedName) return item;
          const learnedMatch = aiLearnedMappings.find((m) =>
            isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings)
          );
          if (learnedMatch)
            return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' as const };
          const fuzzyMatch = allActiveTccsNames.find((tccsName) =>
            isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
          );
          if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' as const };
          return item;
        });

        // OCR-09: Chạy Confidence Guard (Rule 11 & Rule 12)
        const { highItems, lowItems, hasCriticalSuspicion } = applyConfidenceGuard(enrichedItems);
        if (hasCriticalSuspicion) {
          toast(
            '⚠️ Phát hiện giá trị nghi ngờ OCR — vui lòng kiểm tra kỹ các chỉ tiêu được đánh dấu.',
            {
              duration: 5000,
              icon: '🔍',
            }
          );
        }

        setPendingAiRawData(result);
        setPendingHighItems(highItems);
        setPendingLowItems(lowItems);

        if (lowItems.length > 0) {
          setIsMappingModalOpen(true);
        } else {
          finalizeAiMapping(result, highItems, []);
        }

        const newAttachment = {
          name: file.name,
          url: `https://drive.google.com/file/d/${file.id}/view?usp=drivesdk`,
          source: 'google_drive' as const,
          uploadedAt: new Date().toISOString(),
        };
        setFieldValue('attachments', [...(formValues.attachments || []), newAttachment]);
        toast.success(`Đã tự động đính kèm file quét từ Google Drive: ${file.name}`);
      } catch (error: any) {
        if (!mountedRef.current) return;
        toast.error(formatGeminiError(error), { duration: 6000 });
      } finally {
        if (mountedRef.current) {
          setIsAiProcessing(false);
        }
      }
    },
    [
      gdToken,
      allActiveTccsNames,
      aiLearnedMappings,
      finalizeAiMapping,
      setFieldValue,
      formValues.attachments,
    ]
  );

  return useMemo(
    () => ({
      fileInputRef,
      isAiProcessing,
      aiScanInfo,
      setAiScanInfo,
      isMappingModalOpen,
      setIsMappingModalOpen,
      pendingHighItems,
      pendingLowItems,
      isBatchProgressOpen,
      setIsBatchProgressOpen,
      batchScanFiles,
      isAutoCreateModalOpen,
      setIsAutoCreateModalOpen,
      pendingAutoCreateData,
      setPendingAutoCreateData,
      isGDModalOpen,
      setIsGDModalOpen,
      gdFiles,
      isLoadingGDFiles,
      googleDriveFolderUrl,
      handleDataExtracted,
      handleAutoCreateBatchConfirm,
      handleMappingConfirmed,
      handleAiFileSelect,
      handleApplyVoiceCriteria,
      handleGDScanClick,
      handleSelectGoogleDriveFile,
    }),
    [
      fileInputRef,
      isAiProcessing,
      aiScanInfo,
      isMappingModalOpen,
      pendingHighItems,
      pendingLowItems,
      isBatchProgressOpen,
      batchScanFiles,
      isAutoCreateModalOpen,
      pendingAutoCreateData,
      isGDModalOpen,
      gdFiles,
      isLoadingGDFiles,
      googleDriveFolderUrl,
      handleDataExtracted,
      handleAutoCreateBatchConfirm,
      handleMappingConfirmed,
      handleAiFileSelect,
      handleApplyVoiceCriteria,
      handleGDScanClick,
      handleSelectGoogleDriveFile,
    ]
  );
}
