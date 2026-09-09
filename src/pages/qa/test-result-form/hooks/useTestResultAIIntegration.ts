import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { geminiService, formatGeminiError } from '../../../../services/ai/geminiService';
import { isCriteriaMatch } from '../../../../utils/aiMapping';
import { recordHighConfidenceOCRMappings } from '../../../../services/ai/autoLearningService';
import { buildExtractionPrompt } from '../../../../services/ai/prompts';
import { BatchFileStatus } from '../components/BatchScanProgressModal';
import { GDFile } from '../components/GDFileSelectorModal';
import { AIScanInfo } from '../components/TestResultHeader';
import { AIExtractedItem, ConfirmedMapping } from '../../../../components/features/MappingConfirmModal';
import { ParsedVoiceCriteria } from '../../../../services/ai/voiceParserService';
import { useUIStore } from '../../../../store/useUIStore';
import { useAppStore } from '../../../../store/useAppStore';
import { HydratedBatch } from '../../../../hooks/useDataGraph';
import { Criterion, TCCS, Product, AILearnedMapping } from '../../../../types';

interface UseTestResultAIIntegrationProps {
  allActiveTccsNames: string[];
  allCriteria: Criterion[];
  aiLearnedMappings: AILearnedMapping[];
  hydratedBatches: HydratedBatch[];
  tccsList: TCCS[];
  products: Product[];
  formValues: {
    batchId: string;
    labName: string;
    testDate: string;
    testResultsMap: Record<string, string | number>;
    extraCriteria: any[];
    attachments: any[];
  };
  setFieldValue: (field: string, value: any) => void;
  setMapValue: (field: string, key: string, value: any) => void;
  addToArray: (field: string, item: any) => void;
  handleBatchSelect: (batchId: string) => void;
  setBatchSearch: (val: string) => void;
  aiFilledFields: Set<string>;
  setAiFilledFields: React.Dispatch<React.SetStateAction<Set<string>>>;
  addBatch: (data: any) => Promise<any>;
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
}: UseTestResultAIIntegrationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiScanInfo, setAiScanInfo] = useState<AIScanInfo | null>(null);

  const addAiLearnedMapping = useAppStore((state) => state.addAiLearnedMapping);

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

  const handleDataExtracted = (data: any) => {
    if (data.labName) setFieldValue('labName', data.labName);
    if (data.testDate) {
      let isoDate = data.testDate;
      if (data.testDate.includes('/')) {
        const parts = data.testDate.split('/');
        if (parts.length === 3) isoDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      setFieldValue('testDate', isoDate);
    }

    if (data.batchNo) {
      const cleanNo = data.batchNo.trim().toUpperCase();
      let matchedBatch = hydratedBatches.find((b) => b.batchNo?.trim().toUpperCase() === cleanNo);

      if (!matchedBatch) {
        const normCleanNo = cleanNo.replace(/[^A-Z0-9]/g, '');
        matchedBatch = hydratedBatches.find((b) => {
          const norm = (b.batchNo || '').replace(/[^A-Z0-9]/g, '');
          return norm && norm === normCleanNo;
        });
      }

      if (matchedBatch) {
        handleBatchSelect(matchedBatch.id);
        setBatchSearch(`${matchedBatch.batchNo} - ${matchedBatch.product?.name}`);
        toast.success(`Đã tự động chọn lô hàng: ${matchedBatch.batchNo}`);
      } else {
        setPendingAutoCreateData({
          batchNo: data.batchNo,
          productName: data.productName,
          productCode: data.productCode,
          mfgDate: data.mfgDate,
          expDate: data.expDate,
        });
        setIsAutoCreateModalOpen(true);
      }
    }

    if (data.testResults && Array.isArray(data.testResults)) {
      const newAiFilled = new Set(aiFilledFields);
      let matchCount = 0;
      let extraCount = 0;

      data.testResults.forEach((r: any) => {
        const matchCrit = allCriteria.find((c) =>
          isCriteriaMatch(r.criteriaName, c.name, aiLearnedMappings)
        );

        if (matchCrit) {
          setMapValue('testResultsMap', matchCrit.name, r.value);
          newAiFilled.add(matchCrit.name);
          matchCount++;
        } else {
          addToArray('extraCriteria', {
            id: 'extra_' + Math.random().toString(36).substring(2, 9),
            name: r.criteriaName,
            value: r.value,
            unit: r.unit || '',
            limit: r.limit || '',
          });
          extraCount++;
        }
      });

      setAiFilledFields(newAiFilled);
      toast.success(
        `AI: Đã điền ${matchCount} chỉ tiêu theo TCCS` +
          (extraCount > 0 ? `, ${extraCount} chỉ tiêu bổ sung.` : '.')
      );
    }
  };

  const handleAutoCreateBatchConfirm = async (newBatchData: {
    batchNo: string;
    productId: string;
    mfgDate?: string;
    expDate?: string;
    initialQuantity?: number;
    notes?: string;
  }) => {
    try {
      const createdBatch = await addBatch(newBatchData);
      toast.success(`Đã tạo lô mới ${newBatchData.batchNo} thành công!`);
      setIsAutoCreateModalOpen(false);
      setPendingAutoCreateData(null);
      if (createdBatch && createdBatch.id) {
        handleBatchSelect(createdBatch.id);
        const prod = hydratedBatches.find((b) => b.id === createdBatch.id)?.product;
        setBatchSearch(`${createdBatch.batchNo}${prod ? ' - ' + prod.name : ''}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi tạo lô mới: ' + (err.message || 'Thất bại'));
    }
  };

  const finalizeAiMapping = (result: any, highItems: AIExtractedItem[], confirmedLowItems: ConfirmedMapping[]) => {
    const autoMappings = highItems
      .filter((i) => i.mappedName && i.criteriaName !== i.mappedName)
      .map((i) => ({ originalName: i.criteriaName, systemName: i.mappedName }));
    if (autoMappings.length > 0) recordHighConfidenceOCRMappings(autoMappings);

    const mergedResults = [
      ...highItems.map((i) => ({
        criteriaName: i.mappedName,
        aiOriginalName: i.criteriaName,
        value: i.value,
        unit: i.unit,
        limit: i.limit,
      })),
      ...confirmedLowItems.map((m) => ({
        criteriaName: m.systemName,
        aiOriginalName: m.originalName,
        value: m.value,
        unit: m.unit,
        limit: m.limit,
      })),
    ];

    handleDataExtracted({ ...result, testResults: mergedResults });
  };

  const handleMappingConfirmed = (confirmedMappings: ConfirmedMapping[], rememberMappings: boolean) => {
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
  };

  const handleAiFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      setIsAiProcessing(true);
      try {
        const prompt = buildExtractionPrompt(allActiveTccsNames);
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
        }));

        const enrichedItems = rawItems.map((item) => {
          if (item.confidence === 'high' && item.mappedName) return item;
          const learnedMatch = aiLearnedMappings.find((m) =>
            isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings)
          );
          if (learnedMatch) return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' };
          const fuzzyMatch = allActiveTccsNames.find((tccsName) =>
            isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
          );
          if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' };
          return item;
        });

        const highItems = enrichedItems.filter((i) => i.confidence === 'high' && i.mappedName);
        const lowItems = enrichedItems.filter((i) => i.confidence !== 'high' || !i.mappedName);

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

      const prompt = buildExtractionPrompt(allActiveTccsNames);
      const results: any[] = [];
      const failedFiles: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setBatchScanFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'processing', progressStep: 'Đang trích xuất OCR...', progressPercent: 30 } : item
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
                ? { ...item, status: 'done', criteriaCount: res.testResults?.length || 0, progressPercent: 100 }
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
          notes: results.map((r) => r.notes).filter(Boolean).join('; '),
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
          if (learnedMatch) return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' };
          const fuzzyMatch = allActiveTccsNames.find((tccsName) =>
            isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
          );
          if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' };
          return item;
        });

        const highItems = enrichedItems.filter((i) => i.confidence === 'high' && i.mappedName);
        const lowItems = enrichedItems.filter((i) => i.confidence !== 'high' || !i.mappedName);

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
          extraFromDuplicates.forEach((r: any) => {
            addToArray('extraCriteria', {
              id: 'extra_dup_' + Math.random().toString(36).substring(2, 9),
              name: r.criteriaName,
              value: r.value,
              unit: r.unit || '',
              limit: r.limit || '',
            });
          });
          toast(`${extraFromDuplicates.length} chỉ tiêu trùng tên từ các file khác đã được thêm vào Chỉ tiêu bổ sung.`, {
            icon: 'ℹ️',
          });
        }
      } catch (error: any) {
        toast.error(formatGeminiError(error), { duration: 6000 });
      } finally {
        setIsAiProcessing(false);
        e.target.value = '';
      }
    }
  };

  const handleApplyVoiceCriteria = (entries: ParsedVoiceCriteria[]) => {
    if (!entries || entries.length === 0) return;
    const newAiFilled = new Set(aiFilledFields);
    let matchedCount = 0;
    let extraCount = 0;

    entries.forEach((entry) => {
      const matchCrit = allCriteria.find((c) =>
        isCriteriaMatch(entry.criteriaName, c.name, aiLearnedMappings)
      );

      if (matchCrit) {
        setMapValue('testResultsMap', matchCrit.name, entry.value);
        newAiFilled.add(matchCrit.name);
        matchedCount++;
      } else {
        addToArray('extraCriteria', {
          id: 'extra_voice_' + Math.random().toString(36).substring(2, 9),
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
  };

  const handleGDScanClick = () => {
    if (!googleDriveClientId || !googleDriveFolderId) {
      toast.error('Vui lòng cấu hình Google Client ID và Đường dẫn thư mục Google Drive trong phần Cài đặt hệ thống!');
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
  };

  const fetchFilesFromGD = async (token: string) => {
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
      setGDFiles(data.files || []);
    } catch (err: any) {
      console.error(err);
      toast.error('Lỗi khi tải file từ Google Drive: ' + err.message);
      setGdToken(null);
    } finally {
      setIsLoadingGDFiles(false);
    }
  };

  const handleSelectGoogleDriveFile = async (file: GDFile) => {
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

      const prompt = buildExtractionPrompt(allActiveTccsNames);
      const result = await geminiService.extractDataFromDocument(fileObject, prompt);

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
      }));

      const enrichedItems = rawItems.map((item) => {
        if (item.confidence === 'high' && item.mappedName) return item;
        const learnedMatch = aiLearnedMappings.find((m) =>
          isCriteriaMatch(item.criteriaName, m.systemName, aiLearnedMappings)
        );
        if (learnedMatch) return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' };
        const fuzzyMatch = allActiveTccsNames.find((tccsName) =>
          isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
        );
        if (fuzzyMatch) return { ...item, mappedName: fuzzyMatch, confidence: 'high' };
        return item;
      });

      const highItems = enrichedItems.filter((i) => i.confidence === 'high' && i.mappedName);
      const lowItems = enrichedItems.filter((i) => i.confidence !== 'high' || !i.mappedName);

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
      toast.error(formatGeminiError(error), { duration: 6000 });
    } finally {
      setIsAiProcessing(false);
    }
  };

  return {
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
  };
}
