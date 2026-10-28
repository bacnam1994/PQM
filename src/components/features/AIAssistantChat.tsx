import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  CloudArrowUpIcon,
  ArrowPathIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  XMarkIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { motion, useReducedMotion } from 'motion/react';
import { dialogVariants } from '../../lib/motion';
import {
  geminiService,
  validateOCRFile,
  formatGeminiError,
  AVAILABLE_GEMINI_MODELS,
  getGeminiModel,
  getValidGeminiModel,
} from '../../services/ai/geminiService';
import { buildExtractionPrompt } from '../../services/ai/prompts';
import { useMasterCriteriaActiveQuery } from '../../hooks/queries/useMasterCriterionQueries';
import { writeAIDraft } from '../../services/ai/aiDraftManager';
import { useAppStore } from '../../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { useDataGraph } from '../../hooks/useDataGraph';
import { BATCH_STATUS, generateId, parseDateToISO } from '../../utils';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MappingConfirmModal, AIExtractedItem, ConfirmedMapping } from './MappingConfirmModal';
import { isCriteriaMatch } from '../../utils/aiMapping';
import {
  recordHighConfidenceOCRMappings,
  saveSessionMemory,
  buildSessionMemoryPrompt,
  summarizeSessionWithAI,
} from '../../services/ai/autoLearningService';
import { useAIChatHostStore } from '../../store/useAIChatHostStore';
import { AnimatedCollapsible } from '../ui';

type MessageSender = 'user' | 'ai' | 'system';
type MessageAction = 'CREATE_BATCH' | 'REDIRECT' | null;

interface ChatMessage {
  id: string;
  sender: MessageSender;
  text: string;
  thinking?: string;
  isActionable?: boolean;
  actionType?: MessageAction;
  metadata?: any;
}

const CHAT_HISTORY_KEY = 'pqm_ai_chat_history';

const saveChatHistory = (msgs: ChatMessage[]) => {
  try {
    const toSave = msgs
      .filter((m) => m.id !== 'msg_welcome' && !m.id.startsWith('msg_briefing_'))
      .slice(-50);
    sessionStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
  } catch {
    /* Bỏ qua nếu sessionStorage đầy */
  }
};

/** Khôi phục messages thực tế từ sessionStorage (không tự sinh tin nhắn rác ban đầu) */
const loadChatHistory = (): ChatMessage[] => {
  try {
    const saved = sessionStorage.getItem(CHAT_HISTORY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as ChatMessage[];
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (m) => m && m.id !== 'msg_welcome' && !String(m.id).startsWith('msg_briefing_')
        );
      }
    }
  } catch {
    /* Bỏ qua lỗi parse */
  }
  return [];
};

export interface AIAssistantChatProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AIAssistantChat: React.FC<AIAssistantChatProps> = ({
  isOpen: controlledIsOpen,
  onClose,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(controlledIsOpen ?? false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;
  const shouldReduceMotion = useReducedMotion();

  const setIsOpen = useCallback(
    (val: boolean) => {
      setInternalIsOpen(val);
      if (!val) onClose?.();
    },
    [onClose]
  );

  useEffect(() => {
    if (controlledIsOpen !== undefined) {
      setInternalIsOpen(controlledIsOpen);
    }
  }, [controlledIsOpen]);

  const [messages, setMessages] = useState<ChatMessage[]>(loadChatHistory);

  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    products,
    tccsList,
    testResults,
    addBatch,
    isAdmin,
    aiLearnedMappings,
    addAiLearnedMapping,
    productFormulas,
    rawMaterials,
    user,
  } = useAppStore(
    useShallow((s) => ({
      products: s.products,
      tccsList: s.tccsList,
      testResults: s.testResults,
      addBatch: s.addBatch,
      isAdmin: s.isAdmin,
      aiLearnedMappings: s.aiLearnedMappings,
      addAiLearnedMapping: s.addAiLearnedMapping,
      productFormulas: s.productFormulas,
      rawMaterials: s.rawMaterials,
      user: s.user,
    }))
  );
  const { batches: hydratedBatches } = useDataGraph();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedProductId, setSelectedProductId] = useState('');
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [chatInputText, setChatInputText] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [currentModel, setCurrentModel] = useState(() => getGeminiModel());
  const [thinkingEnabled, setThinkingEnabled] = useState(
    () => localStorage.getItem('GEMINI_THINKING_ENABLED') === 'true'
  );

  const abortControllerRef = useRef<AbortController | null>(null);

  // Tiêu thụ pendingPrompt từ AIChatHostStore khi mở chat và focus vào ô nhập
  useEffect(() => {
    if (isOpen) {
      const pending = useAIChatHostStore.getState().consumePendingPrompt();
      if (pending) {
        setChatInputText(pending);
      }
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Hủy request AI chỉ khi component thực sự unmount (bảo toàn session qua navigation)
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Xác định thực thể đang xem theo URL hiện tại để nhúng ngữ cảnh AI
  const currentContext = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/batches/')) {
      const batchId = path.split('/')[2];
      const b = hydratedBatches.find((item) => item.id === batchId || item.batchNo === batchId);
      if (b) return { type: 'BATCH' as const, batch: b, label: `Lô: ${b.batchNo}` };
    }
    if (path.startsWith('/products/')) {
      const prodId = path.split('/')[2];
      const p = products.find((item) => item.id === prodId || item.code === prodId);
      if (p) return { type: 'PRODUCT' as const, product: p, label: `SP: ${p.name}` };
    }
    if (path.includes('/tccs')) return { type: 'TCCS' as const, label: 'Hồ sơ TCCS' };
    if (path.includes('/quality-summary'))
      return { type: 'PQR_REPORT' as const, label: 'Báo cáo PQR' };
    if (path.includes('/trend-analysis'))
      return { type: 'TREND_SPC' as const, label: 'Kiểm soát SPC' };
    if (path.includes('/audit-logs'))
      return { type: 'AUDIT_LOGS' as const, label: 'Kiểm toán ALCOA+' };
    return { type: 'GENERAL' as const, label: 'Toàn hệ thống' };
  }, [location.pathname, hydratedBatches, products]);

  const contextualChips = useMemo(() => {
    if (currentContext.type === 'BATCH' && currentContext.batch) {
      const b = currentContext.batch;
      return [
        {
          icon: '🔬',
          text: `Thẩm định Lô ${b.batchNo}`,
          prompt: `Thẩm định hồ sơ chất lượng lô ${b.batchNo}`,
        },
        {
          icon: '⚠️',
          text: 'Chỉ tiêu cận ngưỡng',
          prompt: `Lô ${b.batchNo} có chỉ tiêu nào sát ngưỡng giới hạn không?`,
        },
        {
          icon: '📉',
          text: 'Dự báo độ ổn định',
          prompt: `Phân tích độ ổn định của lô ${b.batchNo}`,
        },
      ];
    }
    if (currentContext.type === 'PRODUCT' && currentContext.product) {
      const p = currentContext.product;
      return [
        {
          icon: '📊',
          text: `Xu hướng Cpk ${p.code || ''}`,
          prompt: `Đánh giá năng lực quá trình Cpk của sản phẩm ${p.name}`,
        },
        {
          icon: '📦',
          text: 'Thống kê các lô',
          prompt: `Thống kê các lô đã sản xuất của sản phẩm ${p.name}`,
        },
        {
          icon: '🧪',
          text: 'Đối chiếu TCCS',
          prompt: `Kiểm tra TCCS và công thức của sản phẩm ${p.name}`,
        },
      ];
    }
    if (currentContext.type === 'PQR_REPORT') {
      return [
        {
          icon: '📝',
          text: 'Viết kết luận PQR',
          prompt: 'Soạn thảo nhận xét tổng thể chất lượng cho kỳ báo cáo này',
        },
        {
          icon: '📊',
          text: 'Tóm tắt rủi ro Cpk',
          prompt: 'Tổng hợp các chỉ tiêu có Cpk dưới 1.33 trong kỳ',
        },
      ];
    }
    if (currentContext.type === 'AUDIT_LOGS') {
      return [
        {
          icon: '🛡️',
          text: 'Rà soát ALCOA+',
          prompt: 'Đánh giá mức độ tuân thủ toàn vẹn dữ liệu ALCOA+',
        },
        {
          icon: '🔄',
          text: 'Phiếu sửa nhiều lần',
          prompt: 'Tìm các phiếu kiểm nghiệm bị sửa đổi nhiều lần',
        },
      ];
    }
    if (currentContext.type === 'TCCS') {
      return [
        {
          icon: '🧪',
          text: 'Soát lỗi TCCS',
          prompt: 'Kiểm tra các quy chuẩn Min/Max và đơn vị đo trong TCCS',
        },
        {
          icon: '📖',
          text: 'Tra cứu Dược điển',
          prompt: 'Gợi ý các chỉ tiêu kiểm nghiệm theo Dược điển Việt Nam V',
        },
      ];
    }
    return [
      {
        icon: '⚠️',
        text: 'Cảnh báo chất lượng',
        prompt: 'Kiểm tra xem có bất thường chất lượng nào không?',
      },
      {
        icon: '📦',
        text: 'Tổng quan lô hàng',
        prompt: 'Tóm tắt ngắn gọn tình trạng các lô hàng hiện tại',
      },
      {
        icon: '📥',
        text: 'Xuất báo cáo Excel',
        prompt: 'Xuất báo cáo chất lượng tháng này ra file Excel',
      },
    ];
  }, [currentContext]);

  // Lưu lịch sử chat vào sessionStorage mỗi khi messages thay đổi
  useEffect(() => {
    saveChatHistory(messages);
  }, [messages]);

  // SESSION MEMORY (Phase 10): Đóng chat tức thì, chạy tóm tắt ngầm qua requestIdleCallback
  const handleCloseChat = useCallback(() => {
    setIsOpen(false);

    const realMessages = messages.filter((m) => m.sender === 'user' || m.sender === 'ai');
    if (realMessages.length >= 4 && user?.uid) {
      const runIdleSummary = () => {
        const msgForSummary = realMessages.map((m) => ({
          sender: m.sender as string,
          text: m.text,
        }));
        summarizeSessionWithAI(msgForSummary, (p: string, s?: string) =>
          geminiService.generateText(p, s)
        )
          .then((summary) => {
            if (summary && user?.uid) saveSessionMemory(user.uid, summary, currentModel);
          })
          .catch(() => {
            /* silent fail */
          });
      };

      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(runIdleSummary);
      } else {
        setTimeout(runIdleSummary, 1500);
      }
    }
  }, [messages, user?.uid, currentModel, setIsOpen]);

  const handleModelChange = (model: string) => {
    const validModel = getValidGeminiModel(model);
    setCurrentModel(validModel);
    localStorage.setItem('GEMINI_MODEL', validModel);
    const mInfo = AVAILABLE_GEMINI_MODELS.find((m) => m.id === validModel);
    toast.success(`Đã chuyển sang mô hình ${mInfo?.name || validModel}`);
  };

  const handleThinkingToggle = (enabled: boolean) => {
    setThinkingEnabled(enabled);
    localStorage.setItem('GEMINI_THINKING_ENABLED', String(enabled));
    toast.success(
      enabled ? 'Đã bật hiển thị quy trình suy luận' : 'Đã tắt hiển thị quy trình suy luận'
    );
  };

  const [_isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(
    null
  );

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [pendingHighItems, setPendingHighItems] = useState<AIExtractedItem[]>([]);
  const [pendingLowItems, setPendingLowItems] = useState<AIExtractedItem[]>([]);
  const [pendingNavigateData, setPendingNavigateData] = useState<any>(null);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    const handleTriggerAI = (e: Event) => {
      const customEvent = e as CustomEvent;
      const prompt = customEvent.detail?.prompt;
      setIsOpen(true);
      if (prompt) {
        setChatInputText(prompt);
      }
    };
    window.addEventListener('trigger-ai-chat', handleTriggerAI);
    return () => window.removeEventListener('trigger-ai-chat', handleTriggerAI);
  }, [setIsOpen]);

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: `msg_${Date.now()}_${Math.random()}` }]);
  };

  const handleRedirect = (metadata: any) => {
    setIsOpen(false);

    if (metadata?.path) {
      navigate(metadata.path);
      return;
    }

    const extractedData = metadata?.extractedData;

    if (extractedData) {
      const draftId = writeAIDraft(extractedData);

      if (!draftId) {
        console.error('[AI] Không thể tạo AI draft trước khi điều hướng.');
        toast.error('Không thể chuyển dữ liệu AI sang biểu mẫu. Vui lòng thử lại.');
        return;
      }
    }

    navigate('/test-results/new');
  };

  const handleMessageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'A') {
      const href = target.getAttribute('href');
      if (href && href.startsWith('/')) {
        e.preventDefault();
        setIsOpen(false);
        navigate(href);
      }
    }
  };

  const formatMessageText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(
        /\[(.*?)\]\((.*?)\)/g,
        '<a href="$2" class="text-emerald-600 dark:text-emerald-400 hover:underline font-bold">$1</a>'
      );
  };

  const { data: activeMasterCriteria = [] } = useMasterCriteriaActiveQuery();

  const allActiveTccsNames = useMemo(() => {
    const names = new Set<string>();
    activeMasterCriteria.forEach((mc) => mc?.canonicalName && names.add(mc.canonicalName));
    tccsList
      .filter((t) => t.isActive)
      .forEach((tccs) => {
        (tccs.mainQualityCriteria || []).forEach((c) => c?.name && names.add(c.name));
        (tccs.safetyCriteria || []).forEach((c) => c?.name && names.add(c.name));
      });
    return Array.from(names).sort();
  }, [tccsList, activeMasterCriteria]);

  const processFile = async (file: File) => {
    const validation = validateOCRFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'File không hợp lệ.');
      return;
    }

    addMessage({
      sender: 'user',
      text: `Đã tải lên file: **${file.name}**`,
    });

    setIsLoading(true);

    try {
      const prompt = buildExtractionPrompt(allActiveTccsNames);
      const result = await geminiService.extractDataFromDocument(file, prompt);

      const batchNo = result.batchNo || '';

      if (!batchNo) {
        addMessage({
          sender: 'ai',
          text: 'Đã trích xuất xong dữ liệu nhưng chưa nhận diện được Số Lô. Bạn có muốn mở biểu mẫu để kiểm tra và lưu kết quả không?',
          isActionable: true,
          actionType: 'REDIRECT',
          metadata: { extractedData: result },
        });
        openMappingStep(result, { batchNo: '', matchedBatch: null });
        return;
      }

      const cleanNo = batchNo.trim().toLowerCase();
      const matchedBatch = hydratedBatches.find((b) => {
        if (!b.batchNo) return false;
        const bNo = b.batchNo.trim().toLowerCase();
        return bNo === cleanNo || bNo.includes(cleanNo) || cleanNo.includes(bNo);
      });

      openMappingStep(result, { batchNo, matchedBatch });
    } catch (error: any) {
      addMessage({
        sender: 'ai',
        text: `Không thể phân tích tài liệu:\n\n${formatGeminiError(error)}`,
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  /** Xử lý batch nhiều file OCR tuần tự */
  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    const invalidFiles = files.filter((f) => !validateOCRFile(f).valid);
    if (invalidFiles.length > 0) {
      const errors = invalidFiles
        .map((f) => {
          const v = validateOCRFile(f);
          return `• ${f.name}: ${v.error}`;
        })
        .join('\n');
      toast.error(`Có ${invalidFiles.length} file không hợp lệ:\n${errors}`, { duration: 5000 });
      return;
    }

    if (files.length === 1) {
      await processFile(files[0]);
      return;
    }

    setIsBatchProcessing(true);
    addMessage({
      sender: 'system',
      text: `🗂️ Đang xử lý **${files.length} file** phiếu kiểm nghiệm...`,
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setBatchProgress({ current: i + 1, total: files.length });

      try {
        await processFile(file);
        successCount++;
      } catch {
        failCount++;
        addMessage({
          sender: 'ai',
          text: `❌ Lỗi xử lý file **${file.name}**.`,
        });
      }

      if (i < files.length - 1) await new Promise((r) => setTimeout(r, 800));
    }

    setBatchProgress(null);
    setIsBatchProcessing(false);
    addMessage({
      sender: 'system',
      text: `✅ Hoàn tất: ${successCount} thành công${failCount > 0 ? ` | ${failCount} lỗi` : ''}`,
    });
  };

  const openMappingStep = (result: any, context: { batchNo: string; matchedBatch: any }) => {
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
      if (learnedMatch) {
        return { ...item, mappedName: learnedMatch.systemName, confidence: 'high' };
      }

      const fuzzyMatch = allActiveTccsNames.find((tccsName) =>
        isCriteriaMatch(item.criteriaName, tccsName, aiLearnedMappings)
      );
      if (fuzzyMatch) {
        return { ...item, mappedName: fuzzyMatch, confidence: 'high' };
      }

      return item;
    });

    const highItems = enrichedItems.filter((i) => i.confidence === 'high' && i.mappedName);
    const lowItems = enrichedItems.filter((i) => i.confidence !== 'high' || !i.mappedName);

    setPendingNavigateData({ result, context });
    setPendingHighItems(highItems);
    setPendingLowItems(lowItems);

    if (lowItems.length > 0) {
      setIsMappingModalOpen(true);
    } else {
      const autoMappings = highItems
        .filter((i) => i.mappedName && i.criteriaName !== i.mappedName)
        .map((i) => ({ originalName: i.criteriaName, systemName: i.mappedName }));
      if (autoMappings.length > 0) recordHighConfidenceOCRMappings(autoMappings);
      finalizeMappingAndNavigate(result, context, highItems, [], false);
    }
  };

  const handleMappingConfirmed = (
    confirmedMappings: ConfirmedMapping[],
    rememberMappings: boolean
  ) => {
    setIsMappingModalOpen(false);
    if (!pendingNavigateData) return;

    const { result, context } = pendingNavigateData;

    if (rememberMappings) {
      confirmedMappings.forEach((m) => {
        if (m.originalName !== m.systemName) {
          addAiLearnedMapping(m.originalName, m.systemName);
        }
      });
    }

    const autoMappings = pendingHighItems
      .filter((i) => i.mappedName && i.criteriaName !== i.mappedName)
      .map((i) => ({ originalName: i.criteriaName, systemName: i.mappedName }));
    if (autoMappings.length > 0) recordHighConfidenceOCRMappings(autoMappings);

    finalizeMappingAndNavigate(result, context, pendingHighItems, confirmedMappings, true);
  };

  const finalizeMappingAndNavigate = (
    result: any,
    context: { batchNo: string; matchedBatch: any },
    highItems: AIExtractedItem[],
    confirmedLowItems: ConfirmedMapping[],
    fromModal: boolean
  ) => {
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

    const { batchNo, matchedBatch } = context;
    const enrichedResult = {
      ...result,
      batchId: matchedBatch ? matchedBatch.id : undefined,
      testResults: mergedResults,
    };

    if (result.labName) {
      enrichedResult.labName = result.labName;
    }

    if (!batchNo) {
      handleRedirect({ extractedData: enrichedResult });
      return;
    }

    if (matchedBatch) {
      if (fromModal) {
        handleRedirect({ extractedData: enrichedResult });
        return;
      }
      addMessage({
        sender: 'ai',
        text: `Đã khớp lô **${batchNo}** (${matchedBatch.product?.name || ''}). Nhấn nút bên dưới để điền kết quả.`,
        isActionable: true,
        actionType: 'REDIRECT',
        metadata: { extractedData: enrichedResult },
      });
    } else {
      if (isAdmin) {
        addMessage({
          sender: 'ai',
          text: `Số lô **${batchNo}** chưa có trong hệ thống. Bạn có muốn tạo lô mới không?`,
          isActionable: true,
          actionType: 'CREATE_BATCH',
          metadata: { extractedData: enrichedResult },
        });
      } else {
        addMessage({
          sender: 'ai',
          text: `Số lô **${batchNo}** chưa có trong hệ thống. Vui lòng liên hệ Quản trị viên để đăng ký lô trước khi nhập kết quả.`,
          isActionable: false,
        });
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isLoading) {
      processFile(file);
    }
  };

  const handleCreateBatch = async (messageId: string, metadata: any) => {
    if (!selectedProductId) {
      toast.error('Vui lòng chọn sản phẩm cho lô mới!');
      return;
    }

    const { extractedData } = metadata;
    setIsCreatingBatch(true);

    try {
      const newBatchId = generateId('batch');
      const product = products.find((p) => p.id === selectedProductId);
      const mfgDate = parseDateToISO(extractedData.mfgDate || '') || '';
      const expDate = parseDateToISO(extractedData.expDate || '') || '';
      const activeTccs =
        tccsList.find((t) => t.productId === selectedProductId && t.isActive) ||
        tccsList.find((t) => t.productId === selectedProductId);

      await addBatch({
        id: newBatchId,
        productId: selectedProductId,
        batchNo: (extractedData.batchNo || '').trim(),
        mfgDate,
        expDate,
        status: BATCH_STATUS.PENDING,
        theoreticalYield: 0,
        actualYield: 0,
        yieldUnit: 'kg',
        createdAt: new Date().toISOString(),
        tccsId: activeTccs?.id || '',
      });

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, isActionable: false } : m))
      );

      addMessage({
        sender: 'system',
        text: `Đã tạo lô **${extractedData.batchNo}** (${product?.name}).`,
        isActionable: true,
        actionType: 'REDIRECT',
        metadata: { extractedData: { ...extractedData, batchId: newBatchId } },
      });
    } catch {
      toast.error('Có lỗi xảy ra khi tạo lô!');
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const submitPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    setChatInputText('');
    addMessage({
      sender: 'user',
      text: trimmed,
    });

    setIsLoading(true);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const appContextData = {
        products,
        batches: hydratedBatches,
        tccsList,
        testResults,
        productFormulas: productFormulas || [],
        rawMaterials: rawMaterials || [],
        aiLearnedMappings: aiLearnedMappings || [],
      };

      const history = messages
        .filter((m) => (m.sender === 'user' || m.sender === 'ai') && !m.isActionable)
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        }));

      const preferredModel = getGeminiModel();
      const sessionMemoryPrompt = user?.uid ? buildSessionMemoryPrompt(user.uid) : '';
      const sessionAtStart = useAIChatHostStore.getState().activeSessionId;
      useAIChatHostStore.getState().setIsProcessing(true);

      const aiResponse = await geminiService.chatWithAppContext(
        trimmed,
        appContextData,
        history as any,
        preferredModel,
        sessionMemoryPrompt,
        { signal: controller.signal }
      );

      if (
        controller.signal.aborted ||
        useAIChatHostStore.getState().activeSessionId !== sessionAtStart
      ) {
        return;
      }

      addMessage({
        sender: 'ai',
        text: aiResponse.text,
        thinking: aiResponse.thinking,
      });
    } catch (error: any) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      console.error('Chat Error:', error);
      addMessage({
        sender: 'ai',
        text: `Xin lỗi, đã xảy ra lỗi:\n\n${formatGeminiError(error)}`,
      });
    } finally {
      useAIChatHostStore.getState().setIsProcessing(false);
      if (abortControllerRef.current === controller) {
        setIsLoading(false);
      }
    }
  };

  const handleSendTextMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await submitPrompt(chatInputText);
  };

  if (!isOpen) {
    if (controlledIsOpen !== undefined) {
      return null;
    }
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/25 hover:scale-105 hover:from-emerald-700 hover:to-teal-700 transition-all z-50 group cursor-pointer"
      >
        <SparklesIcon className="w-7 h-7 group-hover:animate-pulse" />
        {messages.length > 0 && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white dark:border-zinc-900 shadow-xs" />
        )}
      </button>
    );
  }

  const activeModelBadge =
    AVAILABLE_GEMINI_MODELS.find((m) => m.id === currentModel)?.name.replace('Gemini ', '') ||
    currentModel;

  return (
    <>
      <MappingConfirmModal
        isOpen={isMappingModalOpen}
        onClose={() => setIsMappingModalOpen(false)}
        highConfidenceItems={pendingHighItems}
        lowConfidenceItems={pendingLowItems}
        tccsNames={allActiveTccsNames}
        onConfirm={handleMappingConfirmed}
      />

      <motion.div
        initial={shouldReduceMotion ? false : 'hidden'}
        animate="visible"
        exit="exit"
        variants={dialogVariants}
        className="fixed bottom-5 right-5 w-[370px] sm:w-[390px] bg-surface/95 dark:bg-surface/95 backdrop-blur-xl rounded-2xl border border-border/80 shadow-2xl flex flex-col overflow-hidden z-50"
        style={{ height: '540px', maxHeight: 'calc(100vh - 40px)' }}
      >
        {/* Top Accent Line */}
        <div className="h-[2px] w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-transparent shrink-0" />

        {/* Minimalist Glassmorphic Header */}
        <div className="px-4 py-3 border-b border-border/80 bg-surface/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <SparklesIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-ink text-xs sm:text-sm tracking-tight font-display truncate">
                  Trợ lý AI V-Biotech
                </h3>
                <span className="px-1.5 py-0.2 text-[9px] font-semibold rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 truncate">
                  {activeModelBadge}
                </span>
              </div>
              <p className="text-[10px] text-ink-muted truncate">{currentContext.label}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem(CHAT_HISTORY_KEY);
                  setMessages([]);
                  useAIChatHostStore.getState().resetSession();
                  toast.success('Đã làm mới đoạn hội thoại');
                }}
                className="p-1.5 rounded-lg text-ink-muted hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Xóa hội thoại"
                aria-label="Xóa hội thoại"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowConfig(!showConfig)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                showConfig
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'text-ink-muted hover:text-ink hover:bg-surface-2'
              }`}
              title="Cấu hình AI"
              aria-label="Cấu hình AI"
            >
              <Cog6ToothIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCloseChat}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-2 transition-colors cursor-pointer"
              title="Đóng"
              aria-label="Đóng"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Panel Cấu hình nhanh AI */}
        <AnimatedCollapsible isOpen={showConfig}>
          <div className="bg-surface-2/80 border-b border-border/80 px-4 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-soft flex items-center gap-1.5">
                <CpuChipIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Mô hình AI:
              </span>
              <select
                value={currentModel}
                onChange={(e) => handleModelChange(e.target.value)}
                className="bg-surface border border-border text-[11px] font-semibold text-ink px-2 py-1 rounded-lg outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer shadow-2xs max-w-[200px]"
              >
                <optgroup label="⭐ Gemini 3.5 & 3.6 (Khuyến nghị & Ổn định)">
                  {AVAILABLE_GEMINI_MODELS.filter((m) => m.group === 'Gemini 3.5 & 3.6').map(
                    (m) => (
                      <option key={m.id} value={m.id}>
                        {m.badge}
                      </option>
                    )
                  )}
                </optgroup>
                <optgroup label="⚡ Gemini 3.8 (Mới nhất)">
                  {AVAILABLE_GEMINI_MODELS.filter((m) => m.group === 'Gemini 3.8').map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.badge}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="📦 Mô hình tiền nhiệm (Legacy)">
                  {AVAILABLE_GEMINI_MODELS.filter((m) => m.isDeprecated).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.badge}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-soft flex items-center gap-1.5">
                <SparklesIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Hiển thị suy luận:
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={thinkingEnabled}
                  onChange={(e) => handleThinkingToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-surface-3 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </AnimatedCollapsible>

        {/* Message List or Minimalist Empty State */}
        <div
          className={`flex-1 overflow-y-auto p-4 relative transition-colors custom-scrollbar ${
            isDragging ? 'bg-emerald-500/10' : 'bg-surface-2/25'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-emerald-500/10 backdrop-blur-xs border-2 border-dashed border-emerald-500 m-2 rounded-xl">
              <div className="bg-surface px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 border border-border">
                <CloudArrowUpIcon className="w-6 h-6 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  Thả file phiếu kiểm nghiệm vào đây...
                </span>
              </div>
            </div>
          )}

          {messages.length === 0 && !isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-3 select-none">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/15 to-teal-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 shadow-2xs">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-ink mb-1">
                Sẵn sàng hỗ trợ theo yêu cầu của bạn
              </p>
              <p className="text-[11px] text-ink-muted leading-relaxed mb-4 max-w-[260px]">
                Nhập câu hỏi tra cứu bên dưới hoặc tải lên file PDF/Ảnh Phiếu Kiểm Nghiệm để trích
                xuất.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-full">
                {contextualChips.map((chip) => (
                  <button
                    key={chip.text}
                    type="button"
                    disabled={isLoading}
                    onClick={() => submitPrompt(chip.prompt)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface hover:bg-emerald-500/10 text-ink-soft hover:text-emerald-700 dark:hover:text-emerald-300 text-[11px] font-medium border border-border/80 hover:border-emerald-500/30 transition-all shadow-2xs cursor-pointer"
                  >
                    <span>{chip.icon}</span>
                    <span>{chip.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  {msg.sender === 'ai' && (
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                      <SparklesIcon className="w-3.5 h-3.5" />
                    </div>
                  )}
                  {msg.sender === 'system' && (
                    <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                      <CheckCircleIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] ${
                      msg.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-xs shadow-xs'
                        : msg.sender === 'system'
                          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 rounded-tl-xs font-medium'
                          : 'bg-surface border border-border/80 shadow-2xs rounded-tl-xs text-ink leading-relaxed'
                    }`}
                  >
                    {msg.thinking && thinkingEnabled && (
                      <details className="mb-2 bg-surface-2 border border-border rounded-lg overflow-hidden group shadow-2xs">
                        <summary className="px-2 py-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:bg-emerald-500/10 cursor-pointer flex items-center gap-1 transition-colors select-none">
                          <SparklesIcon className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                          <span>Quy trình suy luận</span>
                        </summary>
                        <div className="p-2 text-[10px] text-ink-muted border-t border-border whitespace-pre-wrap font-mono leading-relaxed bg-surface-3/50 max-h-[150px] overflow-y-auto">
                          {msg.thinking}
                        </div>
                      </details>
                    )}
                    <div
                      onClick={handleMessageClick}
                      className="whitespace-pre-wrap leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}
                    />

                    {msg.isActionable && msg.actionType === 'CREATE_BATCH' && (
                      <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-2">
                        <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                          <ExclamationCircleIcon className="w-3.5 h-3.5" /> Chọn sản phẩm cho lô
                          mới:
                        </p>
                        <select
                          className="w-full bg-surface border border-amber-500/30 text-xs font-bold text-ink px-2 py-2 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                          value={selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                        >
                          <option value="" disabled>
                            -- Danh sách --
                          </option>
                          {products
                            .filter((p) => p.status === 'ACTIVE')
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.code} - {p.name}
                              </option>
                            ))}
                        </select>
                        <button
                          disabled={isCreatingBatch || !selectedProductId}
                          onClick={() => handleCreateBatch(msg.id, msg.metadata)}
                          className="w-full mt-2 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-bold uppercase text-[10px] tracking-wider rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {isCreatingBatch && (
                            <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                          )}
                          Tạo Lô Nhanh
                        </button>
                      </div>
                    )}

                    {msg.isActionable && msg.actionType === 'REDIRECT' && (
                      <button
                        onClick={() => handleRedirect(msg.metadata)}
                        className="mt-2.5 w-full py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {msg.metadata?.path ? 'Xem Báo cáo chi tiết →' : 'Tới Form Điền Kết Quả →'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 mt-1 shadow-2xs">
                    <SparklesIcon className="w-3.5 h-3.5 animate-pulse" />
                  </div>
                  <div className="bg-surface border border-border/80 shadow-2xs rounded-2xl rounded-tl-xs px-3.5 py-2.5 flex items-center gap-2">
                    <span className="flex gap-1">
                      <span
                        className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSendTextMessage}
          className="p-3 bg-surface/90 border-t border-border/80 flex items-center gap-2 relative shrink-0"
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) {
                processFiles(files);
                e.target.value = '';
              }
            }}
          />

          {batchProgress && (
            <div className="absolute bottom-[64px] left-3 right-3 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span>
                    🗂️ Batch OCR: {batchProgress.current}/{batchProgress.total}
                  </span>
                  <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-1">
                  <div
                    className="bg-white rounded-full h-1 transition-all duration-500"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            title="Tải lên PDF/Ảnh Phiếu Kiểm Nghiệm"
            aria-label="Tải lên PDF/Ảnh Phiếu Kiểm Nghiệm"
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-2 text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 border border-border/80 hover:border-emerald-500/30 transition-all shrink-0 cursor-pointer"
          >
            <CloudArrowUpIcon className="w-4.5 h-4.5" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={chatInputText}
            onChange={(e) => setChatInputText(e.target.value)}
            placeholder="Nhập yêu cầu hoặc câu hỏi..."
            disabled={isLoading}
            className="flex-1 bg-surface-2/80 border border-border/80 rounded-xl px-3.5 py-2 text-xs sm:text-[13px] text-ink placeholder:text-ink-faint font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 focus:bg-surface transition-all"
          />

          <button
            type="submit"
            disabled={!chatInputText.trim() || isLoading}
            aria-label="Gửi"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-surface-2 disabled:text-ink-faint disabled:border disabled:border-border/80 active:scale-95 transition-all shrink-0 cursor-pointer"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </form>
      </motion.div>
    </>
  );
};
